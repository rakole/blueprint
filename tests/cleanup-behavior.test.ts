import test from "node:test";
import assert from "node:assert/strict";
import {
  access,
  cp,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import { constants as fsConstants, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  blueprintArtifactList,
  blueprintArtifactReportWrite,
  blueprintArtifactSummaryDigest
} from "../src/mcp/tools/artifacts.js";
import {
  blueprintCleanupArchive,
  blueprintCleanupArchiveTestHooks
} from "../src/mcp/tools/cleanup.js";
import { blueprintProjectStatus } from "../src/mcp/tools/project.js";
import { blueprintRoadmapRead } from "../src/mcp/tools/phase.js";
import { createGitRepo, runGit } from "./helpers/git-fixtures.js";

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
  status: "archived" | "blocked" | "partial" | "failed" | "ready" | "invalid" | "project_missing";
  reason: string | null;
  selectedPhaseDirs: string[];
  protectedEntries: ProtectedEntry[];
  archivedPhaseDirs: string[];
  failedPhaseDirs: string[];
  skippedPhaseDirs: string[];
  keptPhaseDirs: string[];
  archiveDestination: string;
  digestInputs: string[];
  reportPath: string | null;
  reportWritten: boolean;
  issues: string[];
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

- [ ] **Phase 4: Active Roadmap** - Current milestone work stays in the active roadmap
- [ ] **Phase 5: Current Maintenance** - Current cleanup execution focus

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

  await runGit(["config", "user.name", "Blueprint Tests"], repoPath);
  await runGit(["config", "user.email", "blueprint-tests@example.com"], repoPath);
  await runGit(["add", "."], repoPath);
  await runGit(["commit", "-m", "baseline cleanup fixture"], repoPath);

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
    /Call `mcp_blueprint_blueprint_cleanup_archive` in `mode: "preview"`[\s\S]*call `mcp_blueprint_blueprint_cleanup_archive` in `mode: "commit"`/
  );
  assert.match(
    skill,
    /Commit archival only through `blueprint_cleanup_archive` with `mode: "commit"`/i
  );
  assert.match(
    command,
    /If `cleanup-latest` would be replaced, keep the report-overwrite waiting state visible as `report-overwrite-confirmation`/i
  );
  assert.match(
    skill,
    /keep `report-overwrite-confirmation` visible until overwrite is explicitly approved/i
  );
  assert.match(
    command,
    /If filesystem archival partially fails, preserve the runtime-written cleanup report when `reportWritten` is true, keep already archived, failed, skipped, and kept directories explicit, and surface the partial failure honestly\./
  );
  assert.match(
    skill,
    /If filesystem archival partially fails, preserve the runtime-written cleanup report when `reportWritten` is true, keep already archived, failed, skipped, and kept directories explicit, and surface the partial failure honestly\./
  );
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
  const events: string[] = [];

  await assertCleanupContractInvariants();

  events.push("mcp:cleanup-preview");
  const preview = await blueprintCleanupArchive({
    cwd: options.cwd,
    mode: "preview",
    archiveDestination,
    operation: "move"
  });

  assert.equal(preview.status, "ready");

  const restoreFileSystem = options.fsArchiveOperation
    ? blueprintCleanupArchiveTestHooks.setFileSystemForTest({
        mkdir: (targetPath, mkdirOptions) => {
          events.push(`fs:mkdir:${path.relative(options.cwd, targetPath)}`);
          return mkdir(targetPath, mkdirOptions);
        },
        rename: (sourcePath, destinationPath) => {
          const sourceRelativePath = path.relative(options.cwd, sourcePath);
          events.push(`fs:rename:${sourceRelativePath}`);
          return options.fsArchiveOperation
            ? options.fsArchiveOperation(sourcePath, destinationPath)
            : rename(sourcePath, destinationPath);
        },
        cp: (sourcePath, destinationPath, cpOptions) => {
          const sourceRelativePath = path.relative(options.cwd, sourcePath);
          events.push(`fs:cp:${sourceRelativePath}`);
          return cp(sourcePath, destinationPath, cpOptions);
        },
        rm: (targetPath, rmOptions) => {
          events.push(`fs:rm:${path.relative(options.cwd, targetPath)}`);
          return rm(targetPath, rmOptions);
        }
      })
    : null;

  try {
    events.push("mcp:cleanup-commit");
    const commit = await blueprintCleanupArchive({
      cwd: options.cwd,
      mode: "commit",
      archiveDestination,
      operation: "move",
      confirmed: true,
      approveDestinationCreation: approveDestination,
      overwriteReport,
      expectedSelectedPhaseDirs: preview.selectedPhaseDirs,
      expectedProtectedPhaseDirs: preview.protectedEntries.map((entry) => entry.path)
    });

    return {
      status: commit.status,
      reason: commit.reason ?? commit.waitingState,
      selectedPhaseDirs: commit.selectedPhaseDirs,
      protectedEntries: commit.protectedEntries,
      archivedPhaseDirs: commit.archivedPhaseDirs,
      failedPhaseDirs: commit.failedPhaseDirs,
      skippedPhaseDirs: commit.skippedPhaseDirs,
      keptPhaseDirs: commit.keptPhaseDirs,
      archiveDestination,
      digestInputs: commit.digestInputs,
      reportPath: commit.reportPath,
      reportWritten: commit.reportWritten,
      issues: commit.issues,
      events
    };
  } finally {
    restoreFileSystem?.();
  }
}

test("cleanup archives only evidence-backed historical phases and writes cleanup-latest from actual outcome", async (t) => {
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
  assert.match(cleanupReport, /Status: archived/);
  assert.doesNotMatch(cleanupReport, /Status: pending|- pending/);
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
  assert.match(result.reason ?? "", /archive destination .* does not exist/i);
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
  assert.equal(result.events.some((entry) => entry.startsWith("fs:")), false);
});

test("cleanup commit blocks a dirty working tree before report persistence and archive mutation", async (t) => {
  const repoPath = await createCleanupBehaviorFixture();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const preview = await blueprintCleanupArchive({
    cwd: repoPath,
    mode: "preview",
    archiveDestination: ".blueprint/archive/v1",
    operation: "move"
  });

  assert.equal(preview.status, "ready");

  await writeRepoFile(repoPath, "dirty.txt", "uncommitted local work\n");

  const events: string[] = [];
  const restoreFileSystem = blueprintCleanupArchiveTestHooks.setFileSystemForTest({
    mkdir: async (targetPath, mkdirOptions) => {
      events.push(`fs:mkdir:${path.relative(repoPath, targetPath)}`);
      return mkdir(targetPath, mkdirOptions);
    },
    rename: async (sourcePath, destinationPath) => {
      events.push(`fs:rename:${path.relative(repoPath, sourcePath)}`);
      return rename(sourcePath, destinationPath);
    },
    cp: async (sourcePath, destinationPath, cpOptions) => {
      events.push(`fs:cp:${path.relative(repoPath, sourcePath)}`);
      return cp(sourcePath, destinationPath, cpOptions);
    },
    rm: async (targetPath, rmOptions) => {
      events.push(`fs:rm:${path.relative(repoPath, targetPath)}`);
      return rm(targetPath, rmOptions);
    }
  });

  try {
    const commit = await blueprintCleanupArchive({
      cwd: repoPath,
      mode: "commit",
      archiveDestination: ".blueprint/archive/v1",
      operation: "move",
      confirmed: true,
      approveDestinationCreation: true,
      overwriteReport: true,
      expectedSelectedPhaseDirs: preview.selectedPhaseDirs,
      expectedProtectedPhaseDirs: preview.protectedEntries.map((entry) => entry.path)
    });

    assert.equal(commit.status, "blocked");
    assert.equal(commit.waitingState, "dirty-working-tree");
    assert.match(commit.reason ?? "", /clean working tree/i);
    assert.match(commit.issues.join("\n"), /dirty\.txt/);
    assert.equal(commit.reportWritten, false);
    assert.equal(
      await pathExists(path.join(repoPath, ".blueprint/reports/cleanup-latest.md")),
      false
    );
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
    assert.deepEqual(events, []);
  } finally {
    restoreFileSystem();
  }
});

test("cleanup commit requires preview expectations before report persistence and archive mutation", async (t) => {
  const repoPath = await createCleanupBehaviorFixture();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const preview = await blueprintCleanupArchive({
    cwd: repoPath,
    mode: "preview",
    archiveDestination: ".blueprint/archive/v1",
    operation: "move"
  });

  assert.equal(preview.status, "ready");

  const events: string[] = [];
  const restoreFileSystem = blueprintCleanupArchiveTestHooks.setFileSystemForTest({
    mkdir: async (targetPath, mkdirOptions) => {
      events.push(`fs:mkdir:${path.relative(repoPath, targetPath)}`);
      return mkdir(targetPath, mkdirOptions);
    },
    rename: async (sourcePath, destinationPath) => {
      events.push(`fs:rename:${path.relative(repoPath, sourcePath)}`);
      return rename(sourcePath, destinationPath);
    },
    cp: async (sourcePath, destinationPath, cpOptions) => {
      events.push(`fs:cp:${path.relative(repoPath, sourcePath)}`);
      return cp(sourcePath, destinationPath, cpOptions);
    },
    rm: async (targetPath, rmOptions) => {
      events.push(`fs:rm:${path.relative(repoPath, targetPath)}`);
      return rm(targetPath, rmOptions);
    }
  });

  try {
    const commitArgs = {
      cwd: repoPath,
      mode: "commit",
      archiveDestination: ".blueprint/archive/v1",
      operation: "move",
      confirmed: true,
      approveDestinationCreation: true,
      overwriteReport: true
    } as const;

    const results = [
      await blueprintCleanupArchive(commitArgs),
      await blueprintCleanupArchive({
        ...commitArgs,
        expectedSelectedPhaseDirs: preview.selectedPhaseDirs
      }),
      await blueprintCleanupArchive({
        ...commitArgs,
        expectedProtectedPhaseDirs: preview.protectedEntries.map((entry) => entry.path)
      })
    ];

    for (const result of results) {
      assert.equal(result.status, "blocked");
      assert.equal(result.waitingState, "stale-cleanup-preview");
      assert.match(result.reason ?? "", /requires preview expectation/i);
      assert.equal(result.reportWritten, false);
    }

    assert.match(results[0]?.reason ?? "", /expectedSelectedPhaseDirs/);
    assert.match(results[0]?.reason ?? "", /expectedProtectedPhaseDirs/);
    assert.match(results[1]?.reason ?? "", /expectedProtectedPhaseDirs/);
    assert.match(results[2]?.reason ?? "", /expectedSelectedPhaseDirs/);
    assert.equal(
      await pathExists(path.join(repoPath, ".blueprint/reports/cleanup-latest.md")),
      false
    );
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
    assert.deepEqual(events, []);
  } finally {
    restoreFileSystem();
  }
});

test("cleanup preview ignores stale expectation arrays and does not mutate", async (t) => {
  const repoPath = await createCleanupBehaviorFixture();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const events: string[] = [];
  const restoreFileSystem = blueprintCleanupArchiveTestHooks.setFileSystemForTest({
    mkdir: async (targetPath, mkdirOptions) => {
      events.push(`fs:mkdir:${path.relative(repoPath, targetPath)}`);
      return mkdir(targetPath, mkdirOptions);
    },
    rename: async (sourcePath, destinationPath) => {
      events.push(`fs:rename:${path.relative(repoPath, sourcePath)}`);
      return rename(sourcePath, destinationPath);
    },
    cp: async (sourcePath, destinationPath, cpOptions) => {
      events.push(`fs:cp:${path.relative(repoPath, sourcePath)}`);
      return cp(sourcePath, destinationPath, cpOptions);
    },
    rm: async (targetPath, rmOptions) => {
      events.push(`fs:rm:${path.relative(repoPath, targetPath)}`);
      return rm(targetPath, rmOptions);
    }
  });

  try {
    const preview = await blueprintCleanupArchive({
      cwd: repoPath,
      mode: "preview",
      archiveDestination: ".blueprint/archive/v1",
      operation: "move",
      expectedSelectedPhaseDirs: [
        ".blueprint/phases/01-prior-milestone-alpha",
        ".blueprint/phases/05-current-maintenance"
      ],
      expectedProtectedPhaseDirs: [".blueprint/phases/03-missing-closeout"]
    });

    assert.equal(preview.status, "ready");
    assert.equal(preview.mode, "preview");
    assert.equal(preview.waitingState, null);
    assert.deepEqual(preview.selectedPhaseDirs, [
      ".blueprint/phases/01-prior-milestone-alpha",
      ".blueprint/phases/02-prior-milestone-beta"
    ]);
    assert.deepEqual(
      preview.protectedEntries.map((entry) => entry.path),
      [
        ".blueprint/phases/03-missing-closeout",
        ".blueprint/phases/04-active-roadmap",
        ".blueprint/phases/05-current-maintenance"
      ]
    );
    assert.equal(preview.reportWritten, false);
    assert.equal(
      await pathExists(path.join(repoPath, ".blueprint/reports/cleanup-latest.md")),
      false
    );
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
    assert.deepEqual(events, []);
  } finally {
    restoreFileSystem();
  }
});

test("cleanup commit rejects stale or overbroad selected scope before filesystem mutation", async (t) => {
  const repoPath = await createCleanupBehaviorFixture();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const preview = await blueprintCleanupArchive({
    cwd: repoPath,
    mode: "preview",
    archiveDestination: ".blueprint/archive/v1"
  });
  const commit = await blueprintCleanupArchive({
    cwd: repoPath,
    mode: "commit",
    archiveDestination: ".blueprint/archive/v1",
    confirmed: true,
    approveDestinationCreation: true,
    overwriteReport: true,
    expectedSelectedPhaseDirs: [
      ...preview.selectedPhaseDirs,
      ".blueprint/phases/05-current-maintenance"
    ],
    expectedProtectedPhaseDirs: preview.protectedEntries.map((entry) => entry.path)
  });

  assert.equal(commit.status, "blocked");
  assert.equal(commit.waitingState, "stale-cleanup-preview");
  assert.match(commit.reason ?? "", /Selected phase directories changed since preview/);
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/reports/cleanup-latest.md")),
    false
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/05-current-maintenance")),
    true
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/archive/v1/05-current-maintenance")),
    false
  );
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

  assert.equal(result.status, "partial");
  assert.equal(archiveAttempts, 2);
  assert.match(result.reason ?? "", /simulated archive failure on second candidate/);
  assert.deepEqual(result.selectedPhaseDirs, [
    ".blueprint/phases/01-prior-milestone-alpha",
    ".blueprint/phases/02-prior-milestone-beta"
  ]);
  assert.match(cleanupReport, /01-prior-milestone-alpha/);
  assert.match(cleanupReport, /02-prior-milestone-beta/);
  assert.match(cleanupReport, /Status: partial/);
  assert.match(cleanupReport, /Failed phase directories:[\s\S]*02-prior-milestone-beta: simulated archive failure on second candidate/);
  assert.match(cleanupReport, /Archived phase directories:[\s\S]*01-prior-milestone-alpha/);
  assert.match(cleanupReport, /Kept phase directories:[\s\S]*02-prior-milestone-beta/);
  assert.doesNotMatch(cleanupReport, /Status: pending|- pending/);
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
});

test("cleanup keeps archive outcome public when cleanup-latest report write fails after successful archival", async (t) => {
  const repoPath = await createCleanupBehaviorFixture();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const realWriteFile = fs.writeFile.bind(fs);
  let simulatedReportWriteFailure = false;

  t.mock.method(fs, "writeFile", async (filePath, data, options) => {
    const normalizedPath =
      typeof filePath === "string" ? filePath : path.resolve(String(filePath));

    if (
      normalizedPath.includes(`${path.sep}.cleanup-latest.md.`) &&
      normalizedPath.endsWith(".tmp")
    ) {
      simulatedReportWriteFailure = true;
      throw new Error("simulated cleanup report write failure");
    }

    return realWriteFile(
      filePath as Parameters<typeof fs.writeFile>[0],
      data as Parameters<typeof fs.writeFile>[1],
      options as Parameters<typeof fs.writeFile>[2]
    );
  });

  const result = await runCleanupBehavior({ cwd: repoPath });

  assert.equal(simulatedReportWriteFailure, true);
  assert.equal(result.status, "archived");
  assert.equal(result.reportWritten, false);
  assert.equal(result.reportPath, ".blueprint/reports/cleanup-latest.md");
  assert.match(result.reason ?? "", /cleanup-latest\.md could not be written/i);
  assert.match(result.issues.join("\n"), /simulated cleanup report write failure/);
  assert.deepEqual(result.archivedPhaseDirs, [
    ".blueprint/phases/01-prior-milestone-alpha",
    ".blueprint/phases/02-prior-milestone-beta"
  ]);
  assert.deepEqual(result.failedPhaseDirs, []);
  assert.deepEqual(result.skippedPhaseDirs, []);
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/reports/cleanup-latest.md")),
    false
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/archive/v1/01-prior-milestone-alpha")),
    true
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/archive/v1/02-prior-milestone-beta")),
    true
  );
});
