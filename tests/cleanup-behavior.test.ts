import test from "node:test";
import assert from "node:assert/strict";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  blueprintArtifactList,
  blueprintArtifactReportWrite,
  blueprintArtifactSummaryDigest
} from "../src/mcp/tools/artifacts.js";
import { blueprintProjectStatus } from "../src/mcp/tools/project.js";
import { blueprintRoadmapRead } from "../src/mcp/tools/phase.js";
import { createGitRepo } from "./helpers/git-fixtures.js";

const repoRoot = process.cwd();

type ProtectedEntry = {
  path: string;
  reason: string;
};

type CleanupContractFiles = {
  command: string;
  skill: string;
};

type CleanupRunOptions = {
  cwd: string;
  archiveDestination?: string;
  approveDestination?: boolean;
  overwriteReport?: boolean;
  fsArchiveOperation?: (sourcePath: string, destinationPath: string) => Promise<void>;
};

type CleanupRunResult = {
  status: "archived" | "blocked" | "fs_failed";
  reason: string | null;
  selectedPhaseDirs: string[];
  protectedEntries: ProtectedEntry[];
  archiveDestination: string;
  digestInputs: string[];
  reportPath: string | null;
  events: string[];
};

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readRepoFile(repoPath: string, repoRelativePath: string): Promise<string> {
  return readFile(path.join(repoPath, repoRelativePath), "utf8");
}

async function writeRepoFile(
  repoPath: string,
  repoRelativePath: string,
  content: string
): Promise<void> {
  const absolutePath = path.join(repoPath, repoRelativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

async function createCleanupBehaviorFixture(): Promise<string> {
  const repoPath = await createGitRepo("blueprint-cleanup-behavior-");

  await mkdir(path.join(repoPath, ".blueprint/phases"), { recursive: true });
  await mkdir(path.join(repoPath, ".blueprint/reports"), { recursive: true });
  await mkdir(path.join(repoPath, ".blueprint/archive/v1"), { recursive: true });

  await writeRepoFile(repoPath, ".blueprint/PROJECT.md", "# Project\n");
  await writeRepoFile(repoPath, ".blueprint/REQUIREMENTS.md", "# Requirements\n");
  await writeRepoFile(
    repoPath,
    ".blueprint/ROADMAP.md",
    `# Roadmap

## Milestone

- Active milestone: v2

## Phases

- [ ] Phase 4: Active Roadmap
- [ ] Phase 5: Current Maintenance

## Phase Details

### Phase 4: Active Roadmap
**Goal**: Continue planned carry-forward work.
**Requirements**: BP-03

### Phase 5: Current Maintenance
**Goal**: Maintain the current Blueprint surface.
**Requirements**: BP-04
`
  );
  await writeRepoFile(
    repoPath,
    ".blueprint/STATE.md",
    `# Blueprint State

- Project status: initialized
- Current milestone: v2
- Current phase: 5
- Active command: /blu-cleanup
- Next action: Run /blu-progress
- Last updated: 2026-05-03T00:00:00.000Z

## Blockers

- none
`
  );
  await writeRepoFile(
    repoPath,
    ".blueprint/config.json",
    JSON.stringify({ version: 2 }, null, 2)
  );

  await writeRepoFile(
    repoPath,
    ".blueprint/phases/01-prior-milestone-alpha/01-01-SUMMARY.md",
    `# Phase 01 Summary

## Outcome

- Historical milestone work finished with durable closeout evidence.

## Verification

- npx tsx --test tests/cleanup-behavior.test.ts
`
  );
  await writeRepoFile(
    repoPath,
    ".blueprint/phases/02-prior-milestone-beta/02-02-SUMMARY.md",
    `# Phase 02 Summary

## Outcome

- Second historical milestone slice finished with durable closeout evidence.

## Verification

- npx tsx --test tests/cleanup-behavior.test.ts
`
  );
  await writeRepoFile(
    repoPath,
    ".blueprint/phases/03-missing-closeout/03-03-SUMMARY.md",
    `# Phase 03 Summary

## Outcome

- Historical cleanup candidate still needs milestone closeout proof.

## Verification

- Follow-up closeout review still pending.
`
  );
  await writeRepoFile(
    repoPath,
    ".blueprint/phases/04-active-roadmap/04-CONTEXT.md",
    `# Phase 04 Context

## Focus

- Active roadmap work remains in progress and must stay in place.
`
  );
  await writeRepoFile(
    repoPath,
    ".blueprint/phases/05-current-maintenance/05-CONTEXT.md",
    `# Phase 05 Context

## Focus

- Current maintenance work is still active and must not be archived.
`
  );
  await writeRepoFile(
    repoPath,
    ".blueprint/reports/milestone-summary-v1.md",
    `# Milestone Summary

## Scope Summary

- .blueprint/phases/01-prior-milestone-alpha is fully closed out and safe to archive.
- .blueprint/phases/02-prior-milestone-beta is fully closed out and safe to archive.

## Recommended Carry-Forward Context

- Keep .blueprint/phases/03-missing-closeout in place until milestone evidence is complete.
- Keep .blueprint/phases/04-active-roadmap and .blueprint/phases/05-current-maintenance active.
`
  );

  return repoPath;
}

function cleanupReportContent(
  selectedPhaseDirs: string[],
  protectedEntries: ProtectedEntry[],
  archiveDestination: string,
  nextSafeAction = "/blu-progress"
): string {
  const selectedLines =
    selectedPhaseDirs.length > 0
      ? selectedPhaseDirs.map((phaseDir) => `- ${phaseDir}`).join("\n")
      : "- none";
  const protectedLines =
    protectedEntries.length > 0
      ? protectedEntries.map((entry) => `- ${entry.path} (${entry.reason})`).join("\n")
      : "- none";

  return `# Cleanup Report

## Selected Phase Directories

${selectedLines}

## Protected Exclusions

${protectedLines}

## Archive Destination

- ${archiveDestination}

## Mutation Outcome

- pending

## Next Safe Action

- ${nextSafeAction}
`;
}

function normalizePhaseNumber(phaseNumber: string | null): string | null {
  if (!phaseNumber) {
    return null;
  }

  return phaseNumber.split(".")[0] ?? phaseNumber;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function loadCleanupContractFiles(): Promise<CleanupContractFiles> {
  const [command, skill] = await Promise.all([
    readFile(path.join(repoRoot, "commands/blu-cleanup.toml"), "utf8"),
    readFile(path.join(repoRoot, "skills/blueprint-maintenance/SKILL.md"), "utf8")
  ]);

  return { command, skill };
}

async function assertCleanupContractInvariants(): Promise<void> {
  const { command, skill } = await loadCleanupContractFiles();

  assert.match(
    command,
    /Only propose phase directories that belong to completed milestones, are no longer referenced by the active roadmap, and are not the current phase directory\./
  );
  assert.match(
    skill,
    /only archive phase directories from completed milestones, never the current phase or any phase still referenced by the active roadmap/i
  );
  assert.match(
    command,
    /Treat the current phase and every phase still referenced by the active roadmap as protected cleanup exclusions\./
  );
  assert.match(
    skill,
    /Read `blueprint_roadmap_read` before proposing any archive scope so the current phase and active roadmap references stay visible as protected exclusions\./
  );
  assert.match(
    command,
    /After approval, persist the approved cleanup plan[\s\S]*After confirmation and report persistence, run only the approved filesystem operations\./
  );
  assert.match(
    skill,
    /Persist the approved cleanup plan through `blueprint_artifact_report_write` with the bare report name `cleanup-latest` before filesystem mutation begins/i
  );
  assert.match(
    command,
    /If `cleanup-latest` would be replaced, keep the report-overwrite waiting state visible as `report-overwrite-confirmation`/i
  );
  assert.match(
    skill,
    /If replacing `cleanup-latest` needs overwrite approval, keep the report-overwrite waiting state visible as `report-overwrite-confirmation`/i
  );
  assert.match(
    command,
    /If filesystem archival partially fails after report persistence, preserve the written cleanup report, keep already archived and failed directories explicit, and surface the partial failure honestly\./
  );
  assert.match(
    skill,
    /If filesystem archival partially fails after report persistence, preserve the written cleanup report, keep already archived and failed directories explicit, and surface the partial failure honestly\./
  );
}

function assertReportWrittenBeforeFs(events: string[]): void {
  const reportIndex = events.indexOf("report:write");
  const firstFsIndex = events.findIndex((entry) => entry.startsWith("fs:"));

  assert.notEqual(reportIndex, -1, `expected report:write event in ${events.join(", ")}`);

  if (firstFsIndex !== -1) {
    assert.ok(
      reportIndex < firstFsIndex,
      `expected report:write before filesystem mutation in ${events.join(", ")}`
    );
  }
}

async function listPhaseArtifactPaths(
  repoPath: string,
  phaseDir: string
): Promise<string[]> {
  const absolutePhaseDir = path.join(repoPath, phaseDir);
  const entries = await readdir(absolutePhaseDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.posix.join(phaseDir, entry.name))
    .sort();
}

async function listPhaseDirectories(repoPath: string): Promise<string[]> {
  const phasesRoot = path.join(repoPath, ".blueprint/phases");
  const entries = await readdir(phasesRoot, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.posix.join(".blueprint/phases", entry.name))
    .sort();
}

function milestoneFromSummaryReportPath(reportPath: string): string | null {
  const match = path.posix.basename(reportPath).match(/^milestone-summary-(.+)\.md$/);
  return match?.[1] ?? null;
}

async function completedMilestoneEvidenceForPhase(
  repoPath: string,
  phaseDir: string,
  reportPaths: string[],
  activeMilestone: string | null
): Promise<string[]> {
  const matches: string[] = [];

  for (const reportPath of reportPaths.filter((value) =>
    path.posix.basename(value).startsWith("milestone-summary-")
  )) {
    const evidenceMilestone = milestoneFromSummaryReportPath(reportPath);

    if (!evidenceMilestone || evidenceMilestone === activeMilestone) {
      continue;
    }

    const reportContent = await readRepoFile(repoPath, reportPath);
    const archivalEvidencePattern = new RegExp(
      `${escapeRegExp(phaseDir)}[^\\n]*safe to archive`,
      "i"
    );

    if (archivalEvidencePattern.test(reportContent)) {
      matches.push(reportPath);
    }
  }

  return matches.sort();
}

async function protectedArtifactPaths(
  repoPath: string,
  protectedEntries: ProtectedEntry[]
): Promise<string[]> {
  const artifactPaths: string[] = [];

  for (const entry of protectedEntries) {
    artifactPaths.push(...(await listPhaseArtifactPaths(repoPath, entry.path)));
  }

  return uniqueSorted(artifactPaths);
}

async function runCleanupBehavior(
  options: CleanupRunOptions
): Promise<CleanupRunResult> {
  const archiveDestination = options.archiveDestination ?? ".blueprint/archive/v1";
  const approveDestination = options.approveDestination ?? true;
  const overwriteReport = options.overwriteReport ?? true;
  const fsArchiveOperation = options.fsArchiveOperation ?? rename;
  const events: string[] = [];

  await assertCleanupContractInvariants();

  events.push("mcp:project-status");
  const projectStatus = await blueprintProjectStatus({ cwd: options.cwd });
  events.push("mcp:roadmap-read");
  const roadmap = await blueprintRoadmapRead({ cwd: options.cwd });
  events.push("mcp:artifact-list");
  const artifactList = await blueprintArtifactList({ cwd: options.cwd });

  assert.equal(projectStatus.initialized, true);
  assert.equal(projectStatus.currentPhase, "5");
  assert.equal(roadmap.milestone, "v2");

  const currentPhaseNumber = normalizePhaseNumber(projectStatus.currentPhase);
  const protectedEntryMap = new Map<string, ProtectedEntry>();
  const selectedPhaseDirs: string[] = [];
  const selectedEvidencePaths: string[] = [];

  const protectPhase = (phaseDir: string, reason: string): void => {
    protectedEntryMap.set(phaseDir, { path: phaseDir, reason });
  };

  const currentPhaseDir =
    roadmap.phases.find((phase) => phase.phaseNumber === currentPhaseNumber)?.phaseDir ?? null;
  const activeRoadmapDirs = new Set(
    roadmap.phases.flatMap((phase) => (phase.phaseDir ? [phase.phaseDir] : []))
  );
  const phaseDirs = await listPhaseDirectories(options.cwd);

  for (const phaseDir of phaseDirs) {
    if (phaseDir === currentPhaseDir) {
      protectPhase(phaseDir, "current phase");
      continue;
    }

    if (activeRoadmapDirs.has(phaseDir)) {
      protectPhase(phaseDir, "active roadmap");
      continue;
    }
  }

  for (const phaseDir of phaseDirs) {
    if (protectedEntryMap.has(phaseDir)) {
      continue;
    }

    const phaseArtifacts = await listPhaseArtifactPaths(options.cwd, phaseDir);
    const milestoneEvidence = await completedMilestoneEvidenceForPhase(
      options.cwd,
      phaseDir,
      artifactList.reports,
      roadmap.milestone
    );

    if (phaseArtifacts.length === 0 || milestoneEvidence.length === 0) {
      protectPhase(phaseDir, "missing milestone closeout evidence");
      continue;
    }

    selectedPhaseDirs.push(phaseDir);
    selectedEvidencePaths.push(...phaseArtifacts, ...milestoneEvidence);
  }

  const protectedEntries = [...protectedEntryMap.values()].sort((left, right) =>
    left.path.localeCompare(right.path)
  );
  const digestArtifactPaths = uniqueSorted([
    ".blueprint/ROADMAP.md",
    ".blueprint/STATE.md",
    ...selectedEvidencePaths,
    ...(await protectedArtifactPaths(options.cwd, protectedEntries))
  ]);

  events.push("mcp:artifact-summary-digest");
  const digest = await blueprintArtifactSummaryDigest({
    cwd: options.cwd,
    artifactPaths: digestArtifactPaths
  });

  const archiveDestinationPath = path.join(options.cwd, archiveDestination);
  const archiveDestinationExists = await pathExists(archiveDestinationPath);

  if (!archiveDestinationExists && !approveDestination) {
    return {
      status: "blocked",
      reason: "archive-destination-confirmation",
      selectedPhaseDirs: [...selectedPhaseDirs].sort(),
      protectedEntries,
      archiveDestination,
      digestInputs: digest.inputsUsed,
      reportPath: null,
      events
    };
  }

  events.push("report:attempt");

  let reportPath: string;

  try {
    const reportResult = await blueprintArtifactReportWrite({
      cwd: options.cwd,
      reportName: "cleanup-latest",
      content: cleanupReportContent(
        [...selectedPhaseDirs].sort(),
        protectedEntries,
        archiveDestination
      ),
      overwrite: overwriteReport
    });
    reportPath = reportResult.path;
    events.push("report:write");
  } catch (error) {
    return {
      status: "blocked",
      reason: error instanceof Error ? error.message : String(error),
      selectedPhaseDirs: [...selectedPhaseDirs].sort(),
      protectedEntries,
      archiveDestination,
      digestInputs: digest.inputsUsed,
      reportPath: null,
      events
    };
  }

  try {
    if (!archiveDestinationExists) {
      events.push(`fs:mkdir:${archiveDestination}`);
      await mkdir(archiveDestinationPath, { recursive: true });
    }

    for (const phaseDir of [...selectedPhaseDirs].sort()) {
      const sourcePath = path.join(options.cwd, phaseDir);
      const destinationPath = path.join(archiveDestinationPath, path.basename(phaseDir));
      events.push(`fs:rename:${phaseDir}`);
      await fsArchiveOperation(sourcePath, destinationPath);
    }

    return {
      status: "archived",
      reason: null,
      selectedPhaseDirs: [...selectedPhaseDirs].sort(),
      protectedEntries,
      archiveDestination,
      digestInputs: digest.inputsUsed,
      reportPath,
      events
    };
  } catch (error) {
    return {
      status: "fs_failed",
      reason: error instanceof Error ? error.message : String(error),
      selectedPhaseDirs: [...selectedPhaseDirs].sort(),
      protectedEntries,
      archiveDestination,
      digestInputs: digest.inputsUsed,
      reportPath,
      events
    };
  }
}

test("cleanup archives only evidence-backed historical phases and persists cleanup-latest before mutation", async (t) => {
  const repoPath = await createCleanupBehaviorFixture();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await runCleanupBehavior({ cwd: repoPath });
  const cleanupReport = await readRepoFile(repoPath, ".blueprint/reports/cleanup-latest.md");

  assert.equal(result.status, "archived");
  assert.deepEqual(result.selectedPhaseDirs, [
    ".blueprint/phases/01-prior-milestone-alpha",
    ".blueprint/phases/02-prior-milestone-beta"
  ]);
  assert.deepEqual(
    result.protectedEntries.map((entry) => entry.path),
    [
      ".blueprint/phases/03-missing-closeout",
      ".blueprint/phases/04-active-roadmap",
      ".blueprint/phases/05-current-maintenance"
    ]
  );
  assert.deepEqual(
    result.protectedEntries.map((entry) => entry.reason),
    ["missing milestone closeout evidence", "active roadmap", "current phase"]
  );
  assert.ok(
    result.digestInputs.includes(
      ".blueprint/phases/01-prior-milestone-alpha/01-01-SUMMARY.md"
    )
  );
  assert.ok(
    result.digestInputs.includes(
      ".blueprint/phases/02-prior-milestone-beta/02-02-SUMMARY.md"
    )
  );
  assert.ok(result.digestInputs.includes(".blueprint/reports/milestone-summary-v1.md"));
  assert.ok(
    result.digestInputs.includes(".blueprint/phases/03-missing-closeout/03-03-SUMMARY.md")
  );
  assert.ok(
    result.digestInputs.includes(".blueprint/phases/04-active-roadmap/04-CONTEXT.md")
  );
  assert.ok(
    result.digestInputs.includes(".blueprint/phases/05-current-maintenance/05-CONTEXT.md")
  );
  assert.match(cleanupReport, /01-prior-milestone-alpha/);
  assert.match(cleanupReport, /02-prior-milestone-beta/);
  assert.match(cleanupReport, /03-missing-closeout/);
  assert.match(cleanupReport, /04-active-roadmap/);
  assert.match(cleanupReport, /05-current-maintenance/);
  assert.match(cleanupReport, /\.blueprint\/archive\/v1/);
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/archive/v1/01-prior-milestone-alpha")),
    true
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/archive/v1/02-prior-milestone-beta")),
    true
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/01-prior-milestone-alpha")),
    false
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/02-prior-milestone-beta")),
    false
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/03-missing-closeout")),
    true
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/04-active-roadmap")),
    true
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/05-current-maintenance")),
    true
  );
  assertReportWrittenBeforeFs(result.events);
});

test("cleanup blocks on existing cleanup-latest without overwrite and preserves the previous report before filesystem mutation", async (t) => {
  const repoPath = await createCleanupBehaviorFixture();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const existingReport = cleanupReportContent(
    [".blueprint/phases/legacy-archive-scope"],
    [{ path: ".blueprint/phases/legacy-protected", reason: "prior report snapshot" }],
    ".blueprint/archive/v0",
    "/blu-new-milestone"
  );
  await blueprintArtifactReportWrite({
    cwd: repoPath,
    reportName: "cleanup-latest",
    content: existingReport
  });

  const result = await runCleanupBehavior({
    cwd: repoPath,
    overwriteReport: false
  });
  const cleanupReport = await readRepoFile(repoPath, ".blueprint/reports/cleanup-latest.md");

  assert.equal(result.status, "blocked");
  assert.match(result.reason ?? "", /explicit overwrite confirmation/i);
  assert.equal(cleanupReport, existingReport.endsWith("\n") ? existingReport : `${existingReport}\n`);
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/01-prior-milestone-alpha")),
    true
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/02-prior-milestone-beta")),
    true
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/archive/v1/01-prior-milestone-alpha")),
    false
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/archive/v1/02-prior-milestone-beta")),
    false
  );
  assert.equal(result.events.some((entry) => entry.startsWith("fs:")), false);
});

test("cleanup blocks before report persistence when the archive destination needs approval", async (t) => {
  const repoPath = await createCleanupBehaviorFixture();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await runCleanupBehavior({
    cwd: repoPath,
    archiveDestination: ".blueprint/archive/v2",
    approveDestination: false
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "archive-destination-confirmation");
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/reports/cleanup-latest.md")),
    false
  );
  assert.equal(await pathExists(path.join(repoPath, ".blueprint/archive/v2")), false);
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/01-prior-milestone-alpha")),
    true
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/02-prior-milestone-beta")),
    true
  );
  assert.equal(result.events.includes("report:write"), false);
  assert.equal(result.events.some((entry) => entry.startsWith("fs:")), false);
});

test("cleanup preserves cleanup-latest, keeps archived progress explicit, and leaves the failed candidate plus protected dirs in place when filesystem archival partially fails", async (t) => {
  const repoPath = await createCleanupBehaviorFixture();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  let archiveAttempts = 0;
  const result = await runCleanupBehavior({
    cwd: repoPath,
    fsArchiveOperation: async (sourcePath, destinationPath) => {
      archiveAttempts += 1;

      if (archiveAttempts === 1) {
        await rename(sourcePath, destinationPath);
        return;
      }

      throw new Error("simulated archive failure on second candidate");
    }
  });
  const cleanupReport = await readRepoFile(repoPath, ".blueprint/reports/cleanup-latest.md");

  assert.equal(result.status, "fs_failed");
  assert.equal(archiveAttempts, 2);
  assert.match(result.reason ?? "", /simulated archive failure on second candidate/);
  assert.deepEqual(result.selectedPhaseDirs, [
    ".blueprint/phases/01-prior-milestone-alpha",
    ".blueprint/phases/02-prior-milestone-beta"
  ]);
  assert.match(cleanupReport, /01-prior-milestone-alpha/);
  assert.match(cleanupReport, /02-prior-milestone-beta/);
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/archive/v1/01-prior-milestone-alpha")),
    true
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/01-prior-milestone-alpha")),
    false
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/02-prior-milestone-beta")),
    true
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/archive/v1/02-prior-milestone-beta")),
    false
  );
  assert.equal(await pathExists(path.join(repoPath, ".blueprint/phases/03-missing-closeout")), true);
  assert.equal(await pathExists(path.join(repoPath, ".blueprint/phases/04-active-roadmap")), true);
  assert.equal(await pathExists(path.join(repoPath, ".blueprint/phases/05-current-maintenance")), true);
  assertReportWrittenBeforeFs(result.events);
});
