import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import * as z from "zod/v4";

import type { ToolDefinition } from "../tool-types.js";
import {
  BLUEPRINT_DIR,
  BLUEPRINT_PHASES_PATH,
  buildBlueprintReportPath,
  blueprintArtifactList,
  blueprintArtifactSummaryDigest,
  ensureParentDirectory,
  ensureRepoRoot,
  inspectBlueprintArtifacts,
  resolveBlueprintPath,
  toRepoRelativePath,
  withBlueprintRepoLock,
  writeTextFile
} from "./artifacts.js";
import { blueprintRoadmapRead } from "./phase.js";
import { blueprintStateLoad } from "./state.js";

const CLEANUP_ARCHIVE_DEFAULT_DESTINATION = `${BLUEPRINT_DIR}/archive/v1`;
const CLEANUP_LATEST_REPORT_NAME = "cleanup-latest";
const CLEANUP_NEXT_ACTION = "/blu-progress";
const execFileAsync = promisify(execFile);

const cleanupArchiveInputSchema = {
  cwd: z.string().optional(),
  mode: z.enum(["preview", "commit"]).optional(),
  archiveDestination: z.string().optional(),
  operation: z.enum(["move", "copy-delete"]).optional(),
  confirmed: z.boolean().optional(),
  approveDestinationCreation: z.boolean().optional(),
  overwriteReport: z.boolean().optional(),
  expectedSelectedPhaseDirs: z.array(z.string()).optional(),
  expectedProtectedPhaseDirs: z.array(z.string()).optional()
};

type CleanupArchiveMode = "preview" | "commit";
type CleanupArchiveOperation = "move" | "copy-delete";
type CleanupArchiveStatus =
  | "ready"
  | "archived"
  | "partial"
  | "failed"
  | "blocked"
  | "invalid"
  | "project_missing";
type CleanupArchiveWaitingState =
  | "cleanup-confirmation"
  | "archive-destination-confirmation"
  | "report-overwrite-confirmation"
  | "missing-phase-root"
  | "inconsistent-phase-layout"
  | "stale-cleanup-preview"
  | "archive-destination-collision"
  | "no-cleanup-candidates"
  | "dirty-working-tree"
  | null;

type CleanupArchiveArgs = {
  cwd?: string;
  mode?: CleanupArchiveMode;
  archiveDestination?: string;
  operation?: CleanupArchiveOperation;
  confirmed?: boolean;
  approveDestinationCreation?: boolean;
  overwriteReport?: boolean;
  expectedSelectedPhaseDirs?: string[];
  expectedProtectedPhaseDirs?: string[];
};

type CleanupProtectedEntry = {
  path: string;
  reason: string;
};

type CleanupArchiveFileSystem = {
  mkdir(targetPath: string, options: { recursive: true }): Promise<unknown>;
  rename(sourcePath: string, destinationPath: string): Promise<void>;
  cp(
    sourcePath: string,
    destinationPath: string,
    options: { recursive: true; errorOnExist: true; force: false }
  ): Promise<void>;
  rm(targetPath: string, options: { recursive: true; force: true }): Promise<void>;
};

type CleanupArchiveScope = {
  selectedPhaseDirs: string[];
  protectedEntries: CleanupProtectedEntry[];
  digestInputs: string[];
  blockers: Array<{ waitingState: CleanupArchiveWaitingState; reason: string }>;
  warnings: string[];
};

type CleanupArchiveOutcome = {
  archivedPhaseDirs: string[];
  failedPhaseDirs: string[];
  skippedPhaseDirs: string[];
  failureReasons: Record<string, string>;
  archiveDestinationCreated: boolean;
};

type CleanupArchiveResult = {
  status: CleanupArchiveStatus;
  projectRoot: string | null;
  mode: CleanupArchiveMode;
  operation: CleanupArchiveOperation;
  archiveDestination: string;
  archiveDestinationExists: boolean;
  archiveDestinationCreated: boolean;
  selectedPhaseDirs: string[];
  protectedEntries: CleanupProtectedEntry[];
  archivedPhaseDirs: string[];
  failedPhaseDirs: string[];
  skippedPhaseDirs: string[];
  keptPhaseDirs: string[];
  digestInputs: string[];
  reportPath: string | null;
  reportWritten: boolean;
  waitingState: CleanupArchiveWaitingState;
  reason: string | null;
  issues: string[];
  warnings: string[];
  nextAction: string;
};

const defaultCleanupArchiveFileSystem: CleanupArchiveFileSystem = {
  mkdir: (targetPath, options) => fs.mkdir(targetPath, options),
  rename: (sourcePath, destinationPath) => fs.rename(sourcePath, destinationPath),
  cp: (sourcePath, destinationPath, options) => fs.cp(sourcePath, destinationPath, options),
  rm: (targetPath, options) => fs.rm(targetPath, options)
};

let cleanupArchiveFileSystemForTest: CleanupArchiveFileSystem | null = null;

function activeCleanupArchiveFileSystem(): CleanupArchiveFileSystem {
  return cleanupArchiveFileSystemForTest ?? defaultCleanupArchiveFileSystem;
}

export const blueprintCleanupArchiveTestHooks = {
  setFileSystemForTest(fileSystem: CleanupArchiveFileSystem): () => void {
    const previous = cleanupArchiveFileSystemForTest;
    cleanupArchiveFileSystemForTest = fileSystem;

    return () => {
      cleanupArchiveFileSystemForTest = previous;
    };
  }
};

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function gitStatusShort(projectRoot: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("git", [
      "-C",
      projectRoot,
      "status",
      "--short",
      "--untracked-files=all",
      "--",
      ".",
      `:(exclude)${BLUEPRINT_DIR}/locks/**`
    ]);

    return stdout
      .trim()
      .split(/\r?\n/u)
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0);
  } catch (error) {
    return [`git status failed: ${errorMessage(error)}`];
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

function listLines(values: readonly string[]): string {
  return values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : "- none";
}

function protectedEntryLines(entries: readonly CleanupProtectedEntry[]): string {
  return entries.length > 0
    ? entries.map((entry) => `- ${entry.path} (${entry.reason})`).join("\n")
    : "- none";
}

function repoRelativePath(projectRoot: string, absolutePath: string): string {
  return toRepoRelativePath(projectRoot, absolutePath);
}

function normalizeBlueprintRepoPath(
  projectRoot: string,
  inputPath: string,
  label: string
): string {
  const absolutePath = resolveBlueprintPath(projectRoot, inputPath);
  return repoRelativePath(projectRoot, absolutePath);
}

function normalizePhaseDirectoryInput(
  projectRoot: string,
  inputPath: string,
  label: string
): string {
  const normalized = normalizeBlueprintRepoPath(projectRoot, inputPath, label);
  const segments = normalized.split("/");

  if (
    !normalized.startsWith(`${BLUEPRINT_PHASES_PATH}/`) ||
    segments.length !== 3 ||
    segments.some((segment) => segment.length === 0)
  ) {
    throw new Error(`${label} must be an immediate phase directory under ${BLUEPRINT_PHASES_PATH}.`);
  }

  return normalized;
}

function normalizeArchiveDestination(projectRoot: string, inputPath: string): string {
  const normalized = normalizeBlueprintRepoPath(projectRoot, inputPath, "Archive destination");

  if (normalized !== `${BLUEPRINT_DIR}/archive` && !normalized.startsWith(`${BLUEPRINT_DIR}/archive/`)) {
    throw new Error(
      `Archive destination must stay under ${BLUEPRINT_DIR}/archive, received ${inputPath}.`
    );
  }

  return normalized;
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function mismatchReason(label: string, expected: string[], actual: string[]): string {
  return `${label} changed since preview. Expected [${expected.join(", ") || "none"}], actual [${actual.join(", ") || "none"}]. Re-run preview before confirming cleanup.`;
}

function buildCleanupArchiveResult(args: {
  status: CleanupArchiveStatus;
  projectRoot: string | null;
  mode: CleanupArchiveMode;
  operation: CleanupArchiveOperation;
  archiveDestination: string;
  archiveDestinationExists?: boolean;
  archiveDestinationCreated?: boolean;
  selectedPhaseDirs?: string[];
  protectedEntries?: CleanupProtectedEntry[];
  archivedPhaseDirs?: string[];
  failedPhaseDirs?: string[];
  skippedPhaseDirs?: string[];
  digestInputs?: string[];
  reportPath?: string | null;
  reportWritten?: boolean;
  waitingState?: CleanupArchiveWaitingState;
  reason?: string | null;
  issues?: string[];
  warnings?: string[];
}): CleanupArchiveResult {
  const protectedPhaseDirs = (args.protectedEntries ?? []).map((entry) => entry.path);
  const keptPhaseDirs = uniqueSorted([
    ...protectedPhaseDirs,
    ...(args.failedPhaseDirs ?? []),
    ...(args.skippedPhaseDirs ?? [])
  ]);

  return {
    status: args.status,
    projectRoot: args.projectRoot,
    mode: args.mode,
    operation: args.operation,
    archiveDestination: args.archiveDestination,
    archiveDestinationExists: args.archiveDestinationExists ?? false,
    archiveDestinationCreated: args.archiveDestinationCreated ?? false,
    selectedPhaseDirs: args.selectedPhaseDirs ?? [],
    protectedEntries: args.protectedEntries ?? [],
    archivedPhaseDirs: args.archivedPhaseDirs ?? [],
    failedPhaseDirs: args.failedPhaseDirs ?? [],
    skippedPhaseDirs: args.skippedPhaseDirs ?? [],
    keptPhaseDirs,
    digestInputs: args.digestInputs ?? [],
    reportPath: args.reportPath ?? null,
    reportWritten: args.reportWritten ?? false,
    waitingState: args.waitingState ?? null,
    reason: args.reason ?? null,
    issues: args.issues ?? [],
    warnings: args.warnings ?? [],
    nextAction: CLEANUP_NEXT_ACTION
  };
}

async function listPhaseDirectories(projectRoot: string): Promise<string[]> {
  const phasesRoot = resolveBlueprintPath(projectRoot, BLUEPRINT_PHASES_PATH);

  if (!(await pathExists(phasesRoot))) {
    throw new Error(`Missing ${BLUEPRINT_PHASES_PATH}.`);
  }

  const entries = await fs.readdir(phasesRoot, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.posix.join(BLUEPRINT_PHASES_PATH, entry.name))
    .sort();
}

async function listPhaseArtifactPaths(
  projectRoot: string,
  phaseDir: string
): Promise<string[]> {
  const absolutePhaseDir = resolveBlueprintPath(projectRoot, phaseDir);
  const entries = await fs.readdir(absolutePhaseDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.posix.join(phaseDir, entry.name))
    .sort();
}

function milestoneFromSummaryReportPath(reportPath: string): string | null {
  const match = path.posix.basename(reportPath).match(/^milestone-summary-(.+)\.md$/);
  return match?.[1] ?? null;
}

async function completedMilestoneEvidenceForPhase(
  projectRoot: string,
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

    const reportContent = await fs.readFile(resolveBlueprintPath(projectRoot, reportPath), "utf8");
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
  projectRoot: string,
  protectedEntries: CleanupProtectedEntry[]
): Promise<string[]> {
  const artifactPaths: string[] = [];

  for (const entry of protectedEntries) {
    artifactPaths.push(...(await listPhaseArtifactPaths(projectRoot, entry.path)));
  }

  return uniqueSorted(artifactPaths);
}

async function computeCleanupArchiveScope(projectRoot: string): Promise<CleanupArchiveScope> {
  const blockers: CleanupArchiveScope["blockers"] = [];
  const warnings: string[] = [];
  const inspection = await inspectBlueprintArtifacts(projectRoot);

  if (inspection.readiness !== "initialized") {
    return {
      selectedPhaseDirs: [],
      protectedEntries: [],
      digestInputs: [],
      blockers: [
        {
          waitingState: null,
          reason: "Blueprint cleanup requires an initialized project. Run /blu-new-project first."
        }
      ],
      warnings: ["Blueprint cleanup requires initialized core project artifacts."]
    };
  }

  const stateResult = await blueprintStateLoad({ cwd: projectRoot });
  const roadmap = await blueprintRoadmapRead({ cwd: projectRoot });
  warnings.push(...roadmap.warnings);

  let phaseDirs: string[];

  try {
    phaseDirs = await listPhaseDirectories(projectRoot);
  } catch (error) {
    return {
      selectedPhaseDirs: [],
      protectedEntries: [],
      digestInputs: [],
      blockers: [
        {
          waitingState: "missing-phase-root",
          reason: errorMessage(error)
        }
      ],
      warnings
    };
  }

  const artifactList = await blueprintArtifactList({ cwd: projectRoot });
  const currentPhaseNumber = normalizePhaseNumber(stateResult.derivedStatus.currentPhase);
  const protectedEntryMap = new Map<string, CleanupProtectedEntry>();
  const selectedPhaseDirs: string[] = [];
  const selectedEvidencePaths: string[] = [];

  const protectPhase = (phaseDir: string, reason: string): void => {
    if (!protectedEntryMap.has(phaseDir)) {
      protectedEntryMap.set(phaseDir, { path: phaseDir, reason });
    }
  };

  const currentPhaseDir = currentPhaseNumber
    ? roadmap.phases.find(
        (phase) => normalizePhaseNumber(phase.phaseNumber) === currentPhaseNumber
      )?.phaseDir ?? null
    : null;

  if (currentPhaseNumber && !currentPhaseDir) {
    blockers.push({
      waitingState: "inconsistent-phase-layout",
      reason: `Current phase ${currentPhaseNumber} does not have exactly one directory under ${BLUEPRINT_PHASES_PATH}.`
    });
  }

  const activeRoadmapDirs = new Set(
    roadmap.phases.flatMap((phase) => (phase.phaseDir ? [phase.phaseDir] : []))
  );

  for (const phaseDir of phaseDirs) {
    if (phaseDir === currentPhaseDir) {
      protectPhase(phaseDir, "current phase");
      continue;
    }

    if (activeRoadmapDirs.has(phaseDir)) {
      protectPhase(phaseDir, "active roadmap");
    }
  }

  for (const phaseDir of phaseDirs) {
    if (protectedEntryMap.has(phaseDir)) {
      continue;
    }

    const phaseArtifacts = await listPhaseArtifactPaths(projectRoot, phaseDir);
    const milestoneEvidence = await completedMilestoneEvidenceForPhase(
      projectRoot,
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
    `${BLUEPRINT_DIR}/ROADMAP.md`,
    `${BLUEPRINT_DIR}/STATE.md`,
    ...selectedEvidencePaths,
    ...(await protectedArtifactPaths(projectRoot, protectedEntries))
  ]);
  const digest = await blueprintArtifactSummaryDigest({
    cwd: projectRoot,
    artifactPaths: digestArtifactPaths
  });

  return {
    selectedPhaseDirs: uniqueSorted(selectedPhaseDirs),
    protectedEntries,
    digestInputs: digest.inputsUsed,
    blockers,
    warnings
  };
}

async function archivePhaseDirectory(args: {
  projectRoot: string;
  operation: CleanupArchiveOperation;
  sourcePhaseDir: string;
  destinationPhaseDir: string;
  fileSystem: CleanupArchiveFileSystem;
}): Promise<void> {
  const sourcePath = resolveBlueprintPath(args.projectRoot, args.sourcePhaseDir);
  const destinationPath = resolveBlueprintPath(args.projectRoot, args.destinationPhaseDir);

  if (args.operation === "move") {
    await args.fileSystem.rename(sourcePath, destinationPath);
    return;
  }

  await args.fileSystem.cp(sourcePath, destinationPath, {
    recursive: true,
    errorOnExist: true,
    force: false
  });
  await args.fileSystem.rm(sourcePath, { recursive: true, force: true });
}

async function executeCleanupArchiveMutation(args: {
  projectRoot: string;
  operation: CleanupArchiveOperation;
  archiveDestination: string;
  selectedPhaseDirs: string[];
}): Promise<CleanupArchiveOutcome> {
  const fileSystem = activeCleanupArchiveFileSystem();
  const archiveDestinationPath = resolveBlueprintPath(args.projectRoot, args.archiveDestination);
  const archiveDestinationCreated = !(await pathExists(archiveDestinationPath));

  if (archiveDestinationCreated) {
    await fileSystem.mkdir(archiveDestinationPath, { recursive: true });
  }

  const archivedPhaseDirs: string[] = [];
  const failedPhaseDirs: string[] = [];
  const skippedPhaseDirs: string[] = [];
  const failureReasons: Record<string, string> = {};

  for (const phaseDir of args.selectedPhaseDirs) {
    const destinationPhaseDir = path.posix.join(args.archiveDestination, path.posix.basename(phaseDir));

    try {
      await archivePhaseDirectory({
        projectRoot: args.projectRoot,
        operation: args.operation,
        sourcePhaseDir: phaseDir,
        destinationPhaseDir,
        fileSystem
      });
      archivedPhaseDirs.push(phaseDir);
    } catch (error) {
      failedPhaseDirs.push(phaseDir);
      failureReasons[phaseDir] = errorMessage(error);
      const remaining = args.selectedPhaseDirs.slice(args.selectedPhaseDirs.indexOf(phaseDir) + 1);
      skippedPhaseDirs.push(...remaining);
      break;
    }
  }

  return {
    archivedPhaseDirs,
    failedPhaseDirs,
    skippedPhaseDirs,
    failureReasons,
    archiveDestinationCreated
  };
}

function renderCleanupArchiveReport(args: {
  status: CleanupArchiveStatus;
  operation: CleanupArchiveOperation;
  archiveDestination: string;
  selectedPhaseDirs: string[];
  protectedEntries: CleanupProtectedEntry[];
  outcome: CleanupArchiveOutcome;
}): string {
  const keptPhaseDirs = uniqueSorted([
    ...args.protectedEntries.map((entry) => entry.path),
    ...args.outcome.failedPhaseDirs,
    ...args.outcome.skippedPhaseDirs
  ]);
  const failureLines = args.outcome.failedPhaseDirs.length > 0
    ? args.outcome.failedPhaseDirs
        .map((phaseDir) => `- ${phaseDir}: ${args.outcome.failureReasons[phaseDir] ?? "archive failed"}`)
        .join("\n")
    : "- none";

  return `# Cleanup Report

## Selected Phase Directories

${listLines(args.selectedPhaseDirs)}

## Protected Exclusions

${protectedEntryLines(args.protectedEntries)}

## Archive Destination

- ${args.archiveDestination}

## Mutation Outcome

- Status: ${args.status}
- Operation: ${args.operation}
- Destination created: ${args.outcome.archiveDestinationCreated ? "yes" : "no"}
- Archived phase directories:
${listLines(args.outcome.archivedPhaseDirs)}
- Failed phase directories:
${failureLines}
- Skipped phase directories:
${listLines(args.outcome.skippedPhaseDirs)}
- Kept phase directories:
${listLines(keptPhaseDirs)}

## Next Safe Action

- ${CLEANUP_NEXT_ACTION}
`;
}

async function writeCleanupArchiveReport(args: {
  projectRoot: string;
  status: CleanupArchiveStatus;
  operation: CleanupArchiveOperation;
  archiveDestination: string;
  selectedPhaseDirs: string[];
  protectedEntries: CleanupProtectedEntry[];
  outcome: CleanupArchiveOutcome;
}): Promise<{ reportPath: string; warnings: string[] }> {
  const reportPath = buildBlueprintReportPath(CLEANUP_LATEST_REPORT_NAME);
  const absoluteReportPath = resolveBlueprintPath(args.projectRoot, reportPath);

  await ensureParentDirectory(absoluteReportPath);
  const warnings = await writeTextFile(
    absoluteReportPath,
    renderCleanupArchiveReport(args),
    { label: reportPath }
  );

  return { reportPath, warnings };
}

function cleanupArchiveStatusForOutcome(outcome: CleanupArchiveOutcome): CleanupArchiveStatus {
  if (outcome.failedPhaseDirs.length === 0) {
    return "archived";
  }

  return outcome.archivedPhaseDirs.length > 0 ? "partial" : "failed";
}

async function rejectDestinationCollisions(args: {
  projectRoot: string;
  archiveDestination: string;
  selectedPhaseDirs: string[];
}): Promise<string[]> {
  const collisions: string[] = [];

  for (const phaseDir of args.selectedPhaseDirs) {
    const destinationPhaseDir = path.posix.join(args.archiveDestination, path.posix.basename(phaseDir));

    if (await pathExists(resolveBlueprintPath(args.projectRoot, destinationPhaseDir))) {
      collisions.push(destinationPhaseDir);
    }
  }

  return collisions.sort();
}

async function blueprintCleanupArchiveWithProjectRoot(
  args: CleanupArchiveArgs,
  projectRoot: string
): Promise<CleanupArchiveResult> {
  const mode = args.mode ?? "preview";
  const operation = args.operation ?? "move";
  let archiveDestination: string;
  let expectedSelectedPhaseDirs: string[] | null = null;
  let expectedProtectedPhaseDirs: string[] | null = null;

  try {
    archiveDestination = normalizeArchiveDestination(
      projectRoot,
      args.archiveDestination ?? CLEANUP_ARCHIVE_DEFAULT_DESTINATION
    );
    expectedSelectedPhaseDirs = args.expectedSelectedPhaseDirs
      ? uniqueSorted(
          args.expectedSelectedPhaseDirs.map((phaseDir, index) =>
            normalizePhaseDirectoryInput(projectRoot, phaseDir, `expectedSelectedPhaseDirs[${index}]`)
          )
        )
      : null;
    expectedProtectedPhaseDirs = args.expectedProtectedPhaseDirs
      ? uniqueSorted(
          args.expectedProtectedPhaseDirs.map((phaseDir, index) =>
            normalizePhaseDirectoryInput(projectRoot, phaseDir, `expectedProtectedPhaseDirs[${index}]`)
          )
        )
      : null;
  } catch (error) {
    return buildCleanupArchiveResult({
      status: "invalid",
      projectRoot,
      mode,
      operation,
      archiveDestination: args.archiveDestination ?? CLEANUP_ARCHIVE_DEFAULT_DESTINATION,
      reason: errorMessage(error),
      issues: [errorMessage(error)]
    });
  }

  const run = async (): Promise<CleanupArchiveResult> => {
    const scope = await computeCleanupArchiveScope(projectRoot);
    const archiveDestinationPath = resolveBlueprintPath(projectRoot, archiveDestination);
    const archiveDestinationExists = await pathExists(archiveDestinationPath);
    const reportPath = buildBlueprintReportPath(CLEANUP_LATEST_REPORT_NAME);
    const reportExists = await pathExists(resolveBlueprintPath(projectRoot, reportPath));

    if (scope.blockers.length > 0) {
      const firstBlocker = scope.blockers[0];
      const status = firstBlocker?.reason.includes("initialized project")
        ? "project_missing"
        : "blocked";

      return buildCleanupArchiveResult({
        status,
        projectRoot,
        mode,
        operation,
        archiveDestination,
        archiveDestinationExists,
        selectedPhaseDirs: scope.selectedPhaseDirs,
        protectedEntries: scope.protectedEntries,
        digestInputs: scope.digestInputs,
        waitingState: firstBlocker?.waitingState ?? null,
        reason: firstBlocker?.reason ?? "Cleanup archive is blocked.",
        issues: scope.blockers.map((blocker) => blocker.reason),
        warnings: scope.warnings
      });
    }

    const protectedPhaseDirs = scope.protectedEntries.map((entry) => entry.path);

    if (mode === "commit" && (!expectedSelectedPhaseDirs || !expectedProtectedPhaseDirs)) {
      const missingFields: string[] = [];

      if (!expectedSelectedPhaseDirs) {
        missingFields.push("expectedSelectedPhaseDirs");
      }

      if (!expectedProtectedPhaseDirs) {
        missingFields.push("expectedProtectedPhaseDirs");
      }

      const reason = `Cleanup archive commit requires preview expectation ${missingFields.length === 1 ? "field" : "fields"} ${missingFields.join(" and ")}. Re-run preview before confirming cleanup.`;

      return buildCleanupArchiveResult({
        status: "blocked",
        projectRoot,
        mode,
        operation,
        archiveDestination,
        archiveDestinationExists,
        selectedPhaseDirs: scope.selectedPhaseDirs,
        protectedEntries: scope.protectedEntries,
        digestInputs: scope.digestInputs,
        waitingState: "stale-cleanup-preview",
        reason,
        issues: [reason],
        warnings: scope.warnings
      });
    }

    if (
      mode === "commit" &&
      expectedSelectedPhaseDirs &&
      !arraysEqual(expectedSelectedPhaseDirs, scope.selectedPhaseDirs)
    ) {
      const reason = mismatchReason(
        "Selected phase directories",
        expectedSelectedPhaseDirs,
        scope.selectedPhaseDirs
      );

      return buildCleanupArchiveResult({
        status: "blocked",
        projectRoot,
        mode,
        operation,
        archiveDestination,
        archiveDestinationExists,
        selectedPhaseDirs: scope.selectedPhaseDirs,
        protectedEntries: scope.protectedEntries,
        digestInputs: scope.digestInputs,
        waitingState: "stale-cleanup-preview",
        reason,
        issues: [reason],
        warnings: scope.warnings
      });
    }

    if (
      mode === "commit" &&
      expectedProtectedPhaseDirs &&
      !arraysEqual(expectedProtectedPhaseDirs, protectedPhaseDirs)
    ) {
      const reason = mismatchReason(
        "Protected phase directories",
        expectedProtectedPhaseDirs,
        protectedPhaseDirs
      );

      return buildCleanupArchiveResult({
        status: "blocked",
        projectRoot,
        mode,
        operation,
        archiveDestination,
        archiveDestinationExists,
        selectedPhaseDirs: scope.selectedPhaseDirs,
        protectedEntries: scope.protectedEntries,
        digestInputs: scope.digestInputs,
        waitingState: "stale-cleanup-preview",
        reason,
        issues: [reason],
        warnings: scope.warnings
      });
    }

    if (mode === "preview") {
      return buildCleanupArchiveResult({
        status: "ready",
        projectRoot,
        mode,
        operation,
        archiveDestination,
        archiveDestinationExists,
        selectedPhaseDirs: scope.selectedPhaseDirs,
        protectedEntries: scope.protectedEntries,
        digestInputs: scope.digestInputs,
        reportPath,
        warnings: scope.warnings
      });
    }

    if (scope.selectedPhaseDirs.length === 0) {
      return buildCleanupArchiveResult({
        status: "blocked",
        projectRoot,
        mode,
        operation,
        archiveDestination,
        archiveDestinationExists,
        selectedPhaseDirs: scope.selectedPhaseDirs,
        protectedEntries: scope.protectedEntries,
        digestInputs: scope.digestInputs,
        reportPath,
        waitingState: "no-cleanup-candidates",
        reason: "Cleanup archive found no evidence-backed historical phase directories to archive.",
        issues: ["No cleanup candidates were selected."],
        warnings: scope.warnings
      });
    }

    if (args.confirmed !== true) {
      return buildCleanupArchiveResult({
        status: "blocked",
        projectRoot,
        mode,
        operation,
        archiveDestination,
        archiveDestinationExists,
        selectedPhaseDirs: scope.selectedPhaseDirs,
        protectedEntries: scope.protectedEntries,
        digestInputs: scope.digestInputs,
        reportPath,
        waitingState: "cleanup-confirmation",
        reason: "Cleanup archive commit requires explicit cleanup confirmation.",
        issues: ["Explicit cleanup confirmation is required before phase directories are archived."],
        warnings: scope.warnings
      });
    }

    if (!archiveDestinationExists && args.approveDestinationCreation !== true) {
      return buildCleanupArchiveResult({
        status: "blocked",
        projectRoot,
        mode,
        operation,
        archiveDestination,
        archiveDestinationExists,
        selectedPhaseDirs: scope.selectedPhaseDirs,
        protectedEntries: scope.protectedEntries,
        digestInputs: scope.digestInputs,
        reportPath,
        waitingState: "archive-destination-confirmation",
        reason: `Archive destination ${archiveDestination} does not exist and creation was not approved.`,
        issues: [`Approve creating ${archiveDestination} before committing cleanup.`],
        warnings: scope.warnings
      });
    }

    if (reportExists && args.overwriteReport !== true) {
      return buildCleanupArchiveResult({
        status: "blocked",
        projectRoot,
        mode,
        operation,
        archiveDestination,
        archiveDestinationExists,
        selectedPhaseDirs: scope.selectedPhaseDirs,
        protectedEntries: scope.protectedEntries,
        digestInputs: scope.digestInputs,
        reportPath,
        waitingState: "report-overwrite-confirmation",
        reason: `${reportPath} already exists. Re-run only after explicit overwrite confirmation.`,
        issues: [`${reportPath} already exists and overwriteReport was not true.`],
        warnings: scope.warnings
      });
    }

    const destinationCollisions = await rejectDestinationCollisions({
      projectRoot,
      archiveDestination,
      selectedPhaseDirs: scope.selectedPhaseDirs
    });

    if (destinationCollisions.length > 0) {
      const reason = `Archive destination already contains selected phase director${destinationCollisions.length === 1 ? "y" : "ies"}: ${destinationCollisions.join(", ")}.`;

      return buildCleanupArchiveResult({
        status: "blocked",
        projectRoot,
        mode,
        operation,
        archiveDestination,
        archiveDestinationExists,
        selectedPhaseDirs: scope.selectedPhaseDirs,
        protectedEntries: scope.protectedEntries,
        digestInputs: scope.digestInputs,
        reportPath,
        waitingState: "archive-destination-collision",
        reason,
        issues: [reason],
        warnings: scope.warnings
      });
    }

    const dirtyGitStatus = await gitStatusShort(projectRoot);

    if (dirtyGitStatus.length > 0) {
      const reason =
        "Cleanup archive commit requires a clean working tree before report persistence or archive mutation.";

      return buildCleanupArchiveResult({
        status: "blocked",
        projectRoot,
        mode,
        operation,
        archiveDestination,
        archiveDestinationExists,
        selectedPhaseDirs: scope.selectedPhaseDirs,
        protectedEntries: scope.protectedEntries,
        digestInputs: scope.digestInputs,
        reportPath,
        waitingState: "dirty-working-tree",
        reason,
        issues: [reason, ...dirtyGitStatus],
        warnings: scope.warnings
      });
    }

    let outcome: CleanupArchiveOutcome;

    try {
      outcome = await executeCleanupArchiveMutation({
        projectRoot,
        operation,
        archiveDestination,
        selectedPhaseDirs: scope.selectedPhaseDirs
      });
    } catch (error) {
      const reason = errorMessage(error);
      outcome = {
        archivedPhaseDirs: [],
        failedPhaseDirs: scope.selectedPhaseDirs,
        skippedPhaseDirs: [],
        failureReasons: Object.fromEntries(
          scope.selectedPhaseDirs.map((phaseDir) => [phaseDir, reason])
        ),
        archiveDestinationCreated: false
      };
    }

    const status = cleanupArchiveStatusForOutcome(outcome);
    const reportWarnings: string[] = [];
    let reportWritten = false;
    let reportWriteReason: string | null = null;

    try {
      const reportResult = await writeCleanupArchiveReport({
        projectRoot,
        status,
        operation,
        archiveDestination,
        selectedPhaseDirs: scope.selectedPhaseDirs,
        protectedEntries: scope.protectedEntries,
        outcome
      });
      reportWritten = true;
      reportWarnings.push(...reportResult.warnings);
    } catch (error) {
      reportWriteReason = `Cleanup archive ${status}, but ${reportPath} could not be written: ${errorMessage(error)}`;
    }

    const failureReasons = outcome.failedPhaseDirs
      .map((phaseDir) => `${phaseDir}: ${outcome.failureReasons[phaseDir] ?? "archive failed"}`)
      .join("; ");
    const reason =
      reportWriteReason ??
      (outcome.failedPhaseDirs.length > 0
        ? `Cleanup archive ${status}; failed phase directories: ${failureReasons}.`
        : null);
    const issues = [
      ...outcome.failedPhaseDirs.map(
        (phaseDir) => `${phaseDir}: ${outcome.failureReasons[phaseDir] ?? "archive failed"}`
      ),
      ...(reportWriteReason ? [reportWriteReason] : [])
    ];

    return buildCleanupArchiveResult({
      status,
      projectRoot,
      mode,
      operation,
      archiveDestination,
      archiveDestinationExists: true,
      archiveDestinationCreated: outcome.archiveDestinationCreated,
      selectedPhaseDirs: scope.selectedPhaseDirs,
      protectedEntries: scope.protectedEntries,
      archivedPhaseDirs: outcome.archivedPhaseDirs,
      failedPhaseDirs: outcome.failedPhaseDirs,
      skippedPhaseDirs: outcome.skippedPhaseDirs,
      digestInputs: scope.digestInputs,
      reportPath,
      reportWritten,
      reason,
      issues,
      warnings: [...scope.warnings, ...reportWarnings]
    });
  };

  if (mode === "preview") {
    return run();
  }

  return withBlueprintRepoLock(projectRoot, "cleanup-archive", run);
}

export async function blueprintCleanupArchive(
  rawArgs: Record<string, unknown> = {}
): Promise<CleanupArchiveResult> {
  const parsed = z.object(cleanupArchiveInputSchema).safeParse(rawArgs);
  const fallbackMode = "preview";
  const fallbackOperation = "move";
  const fallbackDestination = CLEANUP_ARCHIVE_DEFAULT_DESTINATION;

  if (!parsed.success) {
    const reason = parsed.error.issues.map((issue) => issue.message).join("; ");

    return buildCleanupArchiveResult({
      status: "invalid",
      projectRoot: null,
      mode: fallbackMode,
      operation: fallbackOperation,
      archiveDestination: fallbackDestination,
      reason,
      issues: [reason]
    });
  }

  const projectRoot = await ensureRepoRoot(parsed.data.cwd);
  return blueprintCleanupArchiveWithProjectRoot(parsed.data, projectRoot);
}

export const cleanupToolDefinitions: ToolDefinition[] = [
  {
    name: "blueprint_cleanup_archive",
    description:
      "Preview or commit protected cleanup archival for completed Blueprint phase directories, with runtime-enforced exclusions, evidence checks, and final cleanup-latest reporting.",
    inputSchema: cleanupArchiveInputSchema,
    handler: async (args: Record<string, unknown>) => blueprintCleanupArchive(args)
  }
];
