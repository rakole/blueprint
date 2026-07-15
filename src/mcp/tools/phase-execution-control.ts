import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  BLUEPRINT_CONFIG_PATH,
  BLUEPRINT_DIR,
  BLUEPRINT_STATE_PATH,
  ensureRepoRoot,
  resolveBlueprintPath,
  withBlueprintRepoLock,
  writeJsonFile
} from "./artifacts.js";
import { blueprintConfigGet } from "./config.js";
import { blueprintPhaseExecutionTargets } from "./phase.js";
import type {
  PhaseExecutionFileMutation,
  PhaseExecutionMutationReceipt,
  PhaseExecutionVerificationReceipt
} from "./phase-execution-runtime.js";
import type {
  PhaseExecutionTargetsArgs,
  PhaseExecutionTargetsResult
} from "./phase-tool-types.js";
import type { PreparedStateUpdate } from "./state.js";

const CONTROL_ROOT = `${BLUEPRINT_DIR}/executions/execute-phase`;
const INDEX_PATH = `${CONTROL_ROOT}/index.json`;
const SESSION_ROOT = `${CONTROL_ROOT}/sessions`;
const CONTROL_LOCK = "execute-phase-control";

export const EXECUTE_PHASE_CLAIM_CONFIRMATION =
  "CLAIM BLUEPRINT PHASE EXECUTION";

export type PhaseExecutionPrepareMode = "preview" | "claim" | "resume";

export type PhaseExecutionPrepareArgs = PhaseExecutionTargetsArgs & {
  mode?: PhaseExecutionPrepareMode;
  confirmation?: string;
  previewFingerprint?: string;
  sessionId?: string;
  defaultsPath?: string;
  overwriteConfirmedPlanIds?: string[];
};

export type PhaseExecutionControlProcessResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
};

export type PhaseExecutionControlProcessRunner = (
  command: "git",
  argv: readonly string[],
  cwd: string
) => Promise<PhaseExecutionControlProcessResult>;

export type PhaseExecutionControlDependencies = {
  processRunner: PhaseExecutionControlProcessRunner;
  targetResolver: typeof blueprintPhaseExecutionTargets;
  configReader: typeof blueprintConfigGet;
  now: () => string;
  createSessionId: () => string;
  afterSessionPersisted?: (session: PhaseExecutionSession) => Promise<void> | void;
  beforeAuthorityRecheck?: () => Promise<void> | void;
};

type ArtifactDigest = {
  path: string;
  sha256: string | null;
  sizeBytes: number | null;
  mode: number | null;
};

type WorkingTreeDigest = ArtifactDigest & {
  status: string;
};

export type SelectedPlanPacket = {
  planId: string;
  path: string;
  title: string | null;
  wave: number | null;
  dependsOn: string[];
  requirements: string[];
  allowedFiles: string[];
  readFirst: string[];
  verificationCriteria: string[];
  verificationCommands: string[];
  content: string;
  contentSha256: string;
  ownedFilePreimages: ArtifactDigest[];
  readFirstArtifacts: ArtifactDigest[];
};

export type PhaseExecutionControlPacket = {
  schemaVersion: 1;
  command: "execute-phase";
  repository: {
    canonicalRoot: string;
    head: string;
    porcelainV1Z: string;
    porcelainSha256: string;
    workingTree: WorkingTreeDigest[];
  };
  options: {
    phase: string | number | null;
    wave: number | null;
    gapsOnly: boolean;
    includeConflicts: boolean;
    externalServiceConfirmed: boolean;
    overwriteConfirmedPlanIds: string[];
  };
  selection: {
    phaseNumber: string | null;
    phasePrefix: string | null;
    phaseName: string | null;
    phaseDir: string | null;
    selectedWave: number | null;
    selectedPlanIds: string[];
    selectedPlanPaths: string[];
    pendingPlanIds: string[];
    candidatePlanIds: string[];
    overlapPlanIds: string[];
  };
  selectedPlans: SelectedPlanPacket[];
  planSetValidation: PhaseExecutionTargetsResult["planSetValidation"];
  externalServicePreflight: PhaseExecutionTargetsResult["externalServicePreflight"];
  conflicts: PhaseExecutionTargetsResult["conflicts"];
  existingSummaries: PhaseExecutionTargetsResult["existingSummaries"];
  artifacts: ArtifactDigest[];
  effectiveConfig: Awaited<ReturnType<typeof blueprintConfigGet>>;
};

export type PhaseExecutionSession = {
  schemaVersion: 1;
  sessionId: string;
  status: "claimed" | "executing" | "blocked" | "completed";
  fingerprint: string;
  createdAt: string;
  lastResumedAt: string | null;
  resumeCount: number;
  prepareArgs: {
    phase: string | number | null;
    wave: number | null;
    gapsOnly: boolean;
    includeConflicts: boolean;
    externalServiceConfirmed: boolean;
    overwriteConfirmedPlanIds: string[];
    defaultsPath: string | null;
  };
  packet: PhaseExecutionControlPacket;
  execution: PhaseExecutionProgress;
};

export type PhaseExecutionPlanProgress = {
  planId: string;
  status:
    | "pending"
    | "applying"
    | "mutated"
    | "awaiting-repair"
    | "repairing"
    | "verifying"
    | "verified"
    | "blocked"
    | "summary-written"
    | "persisted";
  applyAttempts: number;
  verificationAttempts: number;
  pendingMutations: PhaseExecutionPendingMutation[];
  mutationReceipts: PhaseExecutionMutationReceipt[];
  mutationGitStatusReceipts: Array<{ path: string; status: string | null }>;
  verificationReceipts: PhaseExecutionVerificationReceipt[][];
  failure: string | null;
  summaryReceipt: ArtifactDigest | null;
  stateReceipt: ArtifactDigest | null;
  pendingStateUpdate: PhaseExecutionPreparedStateUpdate | null;
  persistenceStage:
    | "none"
    | "summary-write"
    | "summary-index"
    | "artifact-validate"
    | "state-update"
    | "done";
};

export type PhaseExecutionPendingMutation = PhaseExecutionFileMutation & {
  expectedMode: number | null;
  expectedAfterMode: number | null;
};

export type PhaseExecutionPreparedStateUpdate = {
  prepared: PreparedStateUpdate;
  preimage: ArtifactDigest;
  postimage: ArtifactDigest;
};

export type PhaseExecutionProgress = {
  schemaVersion: 1;
  currentPlanIndex: number;
  plans: Record<string, PhaseExecutionPlanProgress>;
};

export type PhaseExecutionPrepareResult = {
  status: "preview" | "claimed" | "resumed" | "blocked" | "stale";
  mode: PhaseExecutionPrepareMode;
  ready: boolean;
  reused: boolean;
  projectRoot: string | null;
  fingerprint: string | null;
  packet: PhaseExecutionControlPacket | null;
  session: PhaseExecutionSession | null;
  blockers: string[];
  warnings: string[];
};

type ControlIndex = {
  schemaVersion: 1;
  activeSessionId: string | null;
  consumedFingerprints: Record<string, string>;
  sessions: Record<string, string>;
};

const defaultProcessRunner: PhaseExecutionControlProcessRunner =
  async (command, argv, cwd) =>
    new Promise((resolve) => {
      execFile(
        command,
        [...argv],
        {
          cwd,
          encoding: "utf8",
          windowsHide: true,
          env: {
            ...process.env,
            GIT_OPTIONAL_LOCKS: "0",
            LANG: "C",
            LC_ALL: "C"
          }
        },
        (error, stdout, stderr) => {
          const code = (error as NodeJS.ErrnoException | null)?.code;
          resolve({
            exitCode: error
              ? typeof code === "number"
                ? code
                : null
              : 0,
            signal: (error as { signal?: NodeJS.Signals } | null)?.signal ?? null,
            stdout: stdout ?? "",
            stderr: stderr ?? ""
          });
        }
      );
    });

const defaultDependencies: PhaseExecutionControlDependencies = {
  processRunner: defaultProcessRunner,
  targetResolver: blueprintPhaseExecutionTargets,
  configReader: blueprintConfigGet,
  now: () => new Date().toISOString(),
  createSessionId: randomUUID
};

function dependencies(
  overrides?: Partial<PhaseExecutionControlDependencies>
): PhaseExecutionControlDependencies {
  return { ...defaultDependencies, ...overrides };
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }

  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const key of Object.keys(input).sort()) {
      if (input[key] !== undefined) {
        output[key] = canonicalize(input[key]);
      }
    }

    return output;
  }

  return value;
}

function fingerprintPacket(packet: PhaseExecutionControlPacket): string {
  return sha256(JSON.stringify(canonicalize(packet)));
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function extractBoundVerificationCommands(planContent: string): string[] {
  const verificationSection = planContent.match(
    /(?:^|\n)## Verification\s*\n([\s\S]*?)(?=\n## |$)/i
  )?.[1] ?? "";
  const commands = [...verificationSection.matchAll(/`([^`\n]+)`/g)]
    .map((match) => match[1]?.trim() ?? "")
    .filter((command) => /^(?:npm|npx|node|pnpm|yarn|bun|deno|python\d*|pytest|cargo|go|make|cmake|\.\/|\/bin\/sh)\b/.test(command));
  return unique(commands);
}

function isInside(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function assertSafeRelativePath(
  relativePath: string,
  options: { allowBlueprint: boolean }
): string {
  if (
    !relativePath ||
    path.isAbsolute(relativePath) ||
    relativePath.includes("\0") ||
    relativePath.includes("\\")
  ) {
    throw new Error(`Unsafe execution path: ${JSON.stringify(relativePath)}.`);
  }

  const normalized = path.posix.normalize(relativePath.replace(/^\.\//, ""));

  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized !== relativePath.replace(/^\.\//, "") ||
    normalized === ".git" ||
    normalized.startsWith(".git/") ||
    (!options.allowBlueprint &&
      (normalized === BLUEPRINT_DIR || normalized.startsWith(`${BLUEPRINT_DIR}/`)))
  ) {
    throw new Error(`Unsafe execution path: ${JSON.stringify(relativePath)}.`);
  }

  return normalized;
}

async function readRepoFile(
  projectRoot: string,
  canonicalRoot: string,
  relativePath: string
): Promise<{ content: string; digest: ArtifactDigest }> {
  const safePath = assertSafeRelativePath(relativePath, { allowBlueprint: true });
  const absolutePath = resolveBlueprintPath(projectRoot, safePath);
  const [stats, realPath, bytes] = await Promise.all([
    fs.lstat(absolutePath),
    fs.realpath(absolutePath),
    fs.readFile(absolutePath)
  ]);

  if (!stats.isFile() || !isInside(canonicalRoot, realPath)) {
    throw new Error(`Execution authority path is not a regular repo file: ${safePath}.`);
  }

  let content: string;
  try {
    content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`Execution authority path is not valid UTF-8: ${safePath}.`);
  }

  return {
    content,
    digest: {
      path: safePath,
      sha256: sha256(bytes),
      sizeBytes: bytes.byteLength,
      mode: stats.mode & 0o7777
    }
  };
}

function isOwnedControlStatusPath(value: string): boolean {
  const normalized = value.replace(/^\.\//, "");
  const lockPath = `${BLUEPRINT_DIR}/locks/${CONTROL_LOCK}.lock`;
  return (
    normalized === CONTROL_ROOT ||
    normalized.startsWith(`${CONTROL_ROOT}/`) ||
    normalized === lockPath ||
    normalized.startsWith(`${lockPath}/`)
  );
}

function withoutOwnedControlStatus(raw: string): string {
  const records = raw.split("\0");
  const kept: string[] = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    const status = record.slice(0, 2);
    const targetPath = record.slice(3);
    const renamed = status.includes("R") || status.includes("C");
    const sourcePath = renamed ? records[index + 1] ?? "" : "";

    if (!isOwnedControlStatusPath(targetPath) && !isOwnedControlStatusPath(sourcePath)) {
      kept.push(record);
      if (renamed) kept.push(sourcePath);
    }

    if (renamed) index += 1;
  }

  return kept.length > 0 ? `${kept.join("\0")}\0` : "";
}

function porcelainEntries(raw: string): Array<{ status: string; path: string }> {
  const records = raw.split("\0");
  const entries: Array<{ status: string; path: string }> = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    if (record.length < 4 || record[2] !== " ") {
      throw new Error("Git porcelain status returned an invalid NUL-delimited record.");
    }
    const status = record.slice(0, 2);
    const targetPath = record.slice(3);
    entries.push({ status, path: targetPath });

    if (status.includes("R") || status.includes("C")) {
      const sourcePath = records[++index];
      if (!sourcePath) {
        throw new Error("Git porcelain rename/copy status omitted one endpoint.");
      }
      entries.push({ status: `${status}:source`, path: sourcePath });
    }
  }

  return entries;
}

async function digestRepoBoundaryPath(args: {
  projectRoot: string;
  canonicalRoot: string;
  relativePath: string;
  allowBlueprint: boolean;
  allowMissing: boolean;
}): Promise<ArtifactDigest> {
  const safePath = assertSafeRelativePath(args.relativePath, {
    allowBlueprint: args.allowBlueprint
  });
  const absolutePath = path.resolve(args.projectRoot, ...safePath.split("/"));
  const segments = safePath.split("/");
  let current = args.canonicalRoot;

  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index] ?? "");

    try {
      const stats = await fs.lstat(current);
      if (stats.isSymbolicLink()) {
        throw new Error(`Execution boundary path traverses a symbolic link: ${safePath}.`);
      }
      if (index < segments.length - 1 && !stats.isDirectory()) {
        throw new Error(`Execution boundary path parent is not a directory: ${safePath}.`);
      }
      if (index === segments.length - 1 && !stats.isFile()) {
        throw new Error(`Execution boundary path is not a regular file: ${safePath}.`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" && args.allowMissing) {
        const existingParent = path.dirname(current);
        const realParent = await fs.realpath(existingParent);
        if (!isInside(args.canonicalRoot, realParent)) {
          throw new Error(`Execution boundary path escapes the repository: ${safePath}.`);
        }
        return { path: safePath, sha256: null, sizeBytes: null, mode: null };
      }
      throw error;
    }
  }

  const [realPath, stats, bytes] = await Promise.all([
    fs.realpath(absolutePath),
    fs.lstat(absolutePath),
    fs.readFile(absolutePath)
  ]);
  if (!isInside(args.canonicalRoot, realPath)) {
    throw new Error(`Execution boundary path escapes the repository: ${safePath}.`);
  }

  return {
    path: safePath,
    sha256: sha256(bytes),
    sizeBytes: bytes.byteLength,
    mode: stats.mode & 0o7777
  };
}

async function workingTreeDigests(
  projectRoot: string,
  canonicalRoot: string,
  porcelainV1Z: string
): Promise<WorkingTreeDigest[]> {
  const digests: WorkingTreeDigest[] = [];

  for (const entry of porcelainEntries(porcelainV1Z)) {
    const digest = await digestRepoBoundaryPath({
      projectRoot,
      canonicalRoot,
      relativePath: entry.path,
      allowBlueprint: true,
      allowMissing: true
    });
    digests.push({ ...digest, status: entry.status });
  }

  return digests.sort((left, right) =>
    left.path.localeCompare(right.path) || left.status.localeCompare(right.status)
  );
}

async function gitSnapshot(
  projectRoot: string,
  deps: PhaseExecutionControlDependencies
): Promise<PhaseExecutionControlPacket["repository"]> {
  const [headResult, statusResult, canonicalRoot] = await Promise.all([
    deps.processRunner("git", ["rev-parse", "--verify", "HEAD^{commit}"], projectRoot),
    deps.processRunner(
      "git",
      ["-c", "core.quotepath=false", "status", "--porcelain=v1", "-z", "--untracked-files=all"],
      projectRoot
    ),
    fs.realpath(projectRoot)
  ]);

  const head = headResult.stdout.trim();
  if (
    headResult.exitCode !== 0 ||
    headResult.signal !== null ||
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(head)
  ) {
    throw new Error(`Git HEAD is unavailable or invalid: ${headResult.stderr.trim() || "rev-parse failed"}.`);
  }
  if (statusResult.exitCode !== 0 || statusResult.signal !== null) {
    throw new Error(`Git status is unavailable: ${statusResult.stderr.trim() || "status failed"}.`);
  }

  const porcelainV1Z = withoutOwnedControlStatus(statusResult.stdout);
  const workingTree = await workingTreeDigests(projectRoot, canonicalRoot, porcelainV1Z);
  return {
    canonicalRoot,
    head,
    porcelainV1Z,
    porcelainSha256: sha256(porcelainV1Z),
    workingTree
  };
}

export async function capturePhaseExecutionRepositorySnapshot(
  projectRoot: string
): Promise<PhaseExecutionControlPacket["repository"]> {
  return gitSnapshot(projectRoot, dependencies());
}

async function artifactInventory(
  projectRoot: string,
  canonicalRoot: string,
  phaseDir: string
): Promise<{ digests: ArtifactDigest[]; contents: Map<string, string> }> {
  const safePhaseDir = assertSafeRelativePath(phaseDir, { allowBlueprint: true });
  if (!safePhaseDir.startsWith(`${BLUEPRINT_DIR}/phases/`)) {
    throw new Error(`Unsafe phase directory: ${phaseDir}.`);
  }
  const phaseAbsolute = resolveBlueprintPath(projectRoot, safePhaseDir);
  const realPhaseDir = await fs.realpath(phaseAbsolute);
  if (!isInside(canonicalRoot, realPhaseDir)) {
    throw new Error(`Phase directory escapes the canonical repository: ${phaseDir}.`);
  }

  const entries = await fs.readdir(phaseAbsolute, { withFileTypes: true });
  const paths = [
    `${BLUEPRINT_DIR}/ROADMAP.md`,
    BLUEPRINT_STATE_PATH,
    BLUEPRINT_CONFIG_PATH,
    ...entries
      .filter(
        (entry) =>
          entry.name.endsWith("-PLAN.md") || entry.name.endsWith("-SUMMARY.md")
      )
      .map((entry) => `${safePhaseDir}/${entry.name}`)
  ].sort();
  const contents = new Map<string, string>();
  const digests: ArtifactDigest[] = [];

  for (const artifactPath of paths) {
    const artifact = await readRepoFile(projectRoot, canonicalRoot, artifactPath);
    contents.set(artifactPath, artifact.content);
    digests.push(artifact.digest);
  }

  return { digests, contents };
}

function prepareOptions(args: PhaseExecutionPrepareArgs) {
  return {
    phase: args.phase ?? null,
    wave: args.wave ?? null,
    gapsOnly: args.gapsOnly ?? false,
    includeConflicts: args.includeConflicts ?? true,
    externalServiceConfirmed: args.externalServiceConfirmed ?? false,
    overwriteConfirmedPlanIds: unique(args.overwriteConfirmedPlanIds ?? []).sort()
  };
}

async function buildPacket(
  projectRoot: string,
  args: PhaseExecutionPrepareArgs,
  deps: PhaseExecutionControlDependencies
): Promise<{
  packet: PhaseExecutionControlPacket;
  fingerprint: string;
  blockers: string[];
  warnings: string[];
}> {
  const options = prepareOptions(args);
  const targetArgs: PhaseExecutionTargetsArgs = {
    cwd: projectRoot,
    phase: args.phase,
    wave: args.wave,
    gapsOnly: options.gapsOnly,
    includeConflicts: options.includeConflicts,
    externalServiceConfirmed: options.externalServiceConfirmed
  };
  const [targets, config, repository] = await Promise.all([
    deps.targetResolver(targetArgs),
    deps.configReader({ cwd: projectRoot, scope: "effective", defaultsPath: args.defaultsPath }),
    gitSnapshot(projectRoot, deps)
  ]);
  const blockers = [...targets.blockers.reasons];
  const unconfirmedOverwrites = targets.overwriteCandidatePlanIds.filter(
    (planId) =>
      targets.selectedPlanIds.includes(planId) &&
      !options.overwriteConfirmedPlanIds.includes(planId)
  );
  if (unconfirmedOverwrites.length > 0) {
    blockers.push(
      `Selected plan summaries require explicit overwrite confirmation in overwriteConfirmedPlanIds: ${unconfirmedOverwrites.join(", ")}.`
    );
  }

  if (!targets.phaseFound || !targets.phaseDir) {
    blockers.push("The selected phase could not be resolved to a safe phase directory.");
  }
  if (targets.selectedPlanIds.length === 0) {
    blockers.push("The execute-phase selection is empty; no execution session can be claimed.");
  }

  const inventory = targets.phaseDir
    ? await artifactInventory(projectRoot, repository.canonicalRoot, targets.phaseDir)
    : { digests: [] as ArtifactDigest[], contents: new Map<string, string>() };
  const selectedPlans: SelectedPlanPacket[] = [];

  for (const plan of targets.selectedPlans) {
    const safePlanPath = assertSafeRelativePath(plan.path, { allowBlueprint: true });
    const content = inventory.contents.get(safePlanPath);
    if (content === undefined) {
      throw new Error(`Selected plan body could not be read from the live inventory: ${safePlanPath}.`);
    }
    const allowedFiles = plan.filesModified.map((filePath) =>
      assertSafeRelativePath(filePath, { allowBlueprint: false })
    );
    const readFirst = plan.readFirst.map((filePath) =>
      assertSafeRelativePath(filePath, { allowBlueprint: true })
    );
    const [ownedFilePreimages, readFirstArtifacts] = await Promise.all([
      Promise.all(allowedFiles.map((filePath) => digestRepoBoundaryPath({
        projectRoot,
        canonicalRoot: repository.canonicalRoot,
        relativePath: filePath,
        allowBlueprint: false,
        allowMissing: true
      }))),
      Promise.all(readFirst.map((filePath) => digestRepoBoundaryPath({
        projectRoot,
        canonicalRoot: repository.canonicalRoot,
        relativePath: filePath,
        allowBlueprint: true,
        allowMissing: false
      })))
    ]);

    selectedPlans.push({
      planId: plan.planId,
      path: safePlanPath,
      title: plan.title,
      wave: plan.wave,
      dependsOn: [...plan.dependsOn],
      requirements: [...plan.requirements],
      allowedFiles,
      readFirst,
      verificationCriteria: [...plan.acceptanceCriteria],
      verificationCommands: extractBoundVerificationCommands(content),
      content,
      contentSha256: sha256(content),
      ownedFilePreimages,
      readFirstArtifacts
    });
    if (selectedPlans.at(-1)?.verificationCommands.length === 0) {
      blockers.push(
        `${safePlanPath}: no exact repo-local verification command could be bound from ## Verification.`
      );
    }
  }

  await deps.beforeAuthorityRecheck?.();
  const recheckedInventory = targets.phaseDir
    ? await artifactInventory(projectRoot, repository.canonicalRoot, targets.phaseDir)
    : { digests: [] as ArtifactDigest[], contents: new Map<string, string>() };
  const recheckedSelectedInputs = await Promise.all(selectedPlans.map(async (plan) => ({
    planId: plan.planId,
    ownedFilePreimages: await Promise.all(plan.allowedFiles.map((filePath) =>
      digestRepoBoundaryPath({
        projectRoot,
        canonicalRoot: repository.canonicalRoot,
        relativePath: filePath,
        allowBlueprint: false,
        allowMissing: true
      })
    )),
    readFirstArtifacts: await Promise.all(plan.readFirst.map((filePath) =>
      digestRepoBoundaryPath({
        projectRoot,
        canonicalRoot: repository.canonicalRoot,
        relativePath: filePath,
        allowBlueprint: true,
        allowMissing: false
      })
    ))
  })));
  const [recheckedTargets, recheckedConfig, recheckedRepository] = await Promise.all([
    deps.targetResolver(targetArgs),
    deps.configReader({ cwd: projectRoot, scope: "effective", defaultsPath: args.defaultsPath }),
    gitSnapshot(projectRoot, deps)
  ]);

  if (
    canonicalJson(recheckedInventory.digests) !== canonicalJson(inventory.digests) ||
    canonicalJson(recheckedSelectedInputs) !== canonicalJson(
      selectedPlans.map((plan) => ({
        planId: plan.planId,
        ownedFilePreimages: plan.ownedFilePreimages,
        readFirstArtifacts: plan.readFirstArtifacts
      }))
    ) ||
    canonicalJson(recheckedTargets) !== canonicalJson(targets) ||
    canonicalJson(recheckedConfig) !== canonicalJson(config) ||
    canonicalJson(recheckedRepository) !== canonicalJson(repository)
  ) {
    throw new Error(
      "Execute-phase authority changed while the preview packet was being built; retry preview from a stable repository snapshot."
    );
  }

  const packet: PhaseExecutionControlPacket = {
    schemaVersion: 1,
    command: "execute-phase",
    repository,
    options,
    selection: {
      phaseNumber: targets.phaseNumber,
      phasePrefix: targets.phasePrefix,
      phaseName: targets.phaseName,
      phaseDir: targets.phaseDir,
      selectedWave: targets.selectedWave,
      selectedPlanIds: [...targets.selectedPlanIds],
      selectedPlanPaths: [...targets.selectedPlanPaths],
      pendingPlanIds: [...targets.pendingPlanIds],
      candidatePlanIds: [...targets.candidatePlanIds],
      overlapPlanIds: [...targets.overlapPlanIds]
    },
    selectedPlans,
    planSetValidation: targets.planSetValidation,
    externalServicePreflight: targets.externalServicePreflight,
    conflicts: targets.conflicts,
    existingSummaries: targets.existingSummaries,
    artifacts: inventory.digests,
    effectiveConfig: config
  };

  return {
    packet,
    fingerprint: fingerprintPacket(packet),
    blockers: unique(blockers),
    warnings: unique(targets.warnings)
  };
}

async function validateExecutingSessionAuthority(
  projectRoot: string,
  session: PhaseExecutionSession,
  deps: PhaseExecutionControlDependencies
): Promise<string[]> {
  const blockers: string[] = [];
  const repository = await gitSnapshot(projectRoot, deps);
  if (repository.head !== session.packet.repository.head) {
    blockers.push(
      `Execution session HEAD drifted: expected ${session.packet.repository.head}, observed ${repository.head}.`
    );
  }
  const config = await deps.configReader({
    cwd: projectRoot,
    scope: "effective",
    defaultsPath: session.prepareArgs.defaultsPath ?? undefined
  });
  if (canonicalJson(config) !== canonicalJson(session.packet.effectiveConfig)) {
    blockers.push("Execute-phase effective config drifted after claim.");
  }

  const latestReceipts = new Map<string, PhaseExecutionMutationReceipt>();
  const latestMutationStatuses = new Map<string, string | null>();
  const pendingMutations = new Map<string, PhaseExecutionPendingMutation>();
  const persistencePaths = new Set<string>();
  let stateMayBePersisted = false;
  let pendingStateUpdate: PhaseExecutionPreparedStateUpdate | null = null;
  for (const [planId, progress] of Object.entries(session.execution.plans)) {
    for (const receipt of progress.mutationReceipts) latestReceipts.set(receipt.path, receipt);
    for (const receipt of progress.mutationGitStatusReceipts) {
      latestMutationStatuses.set(receipt.path, receipt.status);
    }
    for (const mutation of progress.pendingMutations) pendingMutations.set(mutation.path, mutation);
    if (progress.persistenceStage !== "none") {
      persistencePaths.add(
        `${session.packet.selection.phaseDir}/${session.packet.selection.phasePrefix}-${planId}-SUMMARY.md`
      );
    }
    if (progress.persistenceStage === "done" || progress.pendingStateUpdate !== null) {
      stateMayBePersisted = true;
    }
    if (progress.pendingStateUpdate) {
      if (pendingStateUpdate) blockers.push("Execute-phase session contains multiple pending STATE effects.");
      pendingStateUpdate = progress.pendingStateUpdate;
    }
  }
  const authorizedChangedPaths = new Set([
    ...session.packet.repository.workingTree.map((entry) => entry.path),
    ...latestReceipts.keys(),
    ...pendingMutations.keys(),
    ...persistencePaths,
    ...(stateMayBePersisted ? [BLUEPRINT_STATE_PATH] : [])
  ]);
  for (const entry of repository.workingTree) {
    if (!authorizedChangedPaths.has(entry.path)) {
      blockers.push(`Execute-phase observed changes without MCP receipts: ${entry.path}.`);
    }
  }
  const currentStatusByPath = new Map(
    repository.workingTree.map((entry) => [entry.path, entry.status])
  );

  const observe = async (relativePath: string, allowBlueprint: boolean) =>
    digestRepoBoundaryPath({
      projectRoot,
      canonicalRoot: repository.canonicalRoot,
      relativePath,
      allowBlueprint,
      allowMissing: true
    });
  let stateMatchesPendingPostimage = false;
  if (pendingStateUpdate) {
    const observed = await observe(BLUEPRINT_STATE_PATH, true);
    const matches = (digest: ArtifactDigest) =>
      observed.sha256 === digest.sha256 &&
      observed.sizeBytes === digest.sizeBytes &&
      observed.mode === digest.mode;
    stateMatchesPendingPostimage = matches(pendingStateUpdate.postimage);
    if (!matches(pendingStateUpdate.preimage) && !stateMatchesPendingPostimage) {
      blockers.push("Execute-phase pending STATE effect matches neither its trusted preimage nor prepared postimage.");
    }
  }
  for (const progress of Object.values(session.execution.plans)) {
    if (
      progress.persistenceStage !== "none" &&
      progress.persistenceStage !== "summary-write" &&
      progress.summaryReceipt === null
    ) {
      blockers.push(`Execute-phase plan ${progress.planId} is missing its persisted summary receipt.`);
    }
    if (progress.summaryReceipt) {
      const observed = await observe(progress.summaryReceipt.path, true);
      if (
        observed.sha256 !== progress.summaryReceipt.sha256 ||
        observed.sizeBytes !== progress.summaryReceipt.sizeBytes ||
        observed.mode !== progress.summaryReceipt.mode
      ) {
        blockers.push(`Execute-phase persisted summary receipt drifted: ${progress.summaryReceipt.path}.`);
      }
    }
    if (
      progress.persistenceStage === "done" &&
      progress.stateReceipt === null &&
      !stateMatchesPendingPostimage
    ) {
      blockers.push(`Execute-phase plan ${progress.planId} is missing its persisted state receipt.`);
    }
    if (progress.stateReceipt && !stateMatchesPendingPostimage) {
      const observed = await observe(progress.stateReceipt.path, true);
      if (
        observed.sha256 !== progress.stateReceipt.sha256 ||
        observed.sizeBytes !== progress.stateReceipt.sizeBytes ||
        observed.mode !== progress.stateReceipt.mode
      ) {
        blockers.push(`Execute-phase persisted state receipt drifted: ${progress.stateReceipt.path}.`);
      }
    }
  }
  for (const baseline of session.packet.repository.workingTree) {
    if (latestReceipts.has(baseline.path) || pendingMutations.has(baseline.path)) continue;
    if (currentStatusByPath.get(baseline.path) !== baseline.status) {
      blockers.push(`Execute-phase baseline Git status drifted: ${baseline.path}.`);
    }
    const observed = await observe(baseline.path, baseline.path.startsWith(`${BLUEPRINT_DIR}/`));
    if (
      observed.sha256 !== baseline.sha256 ||
      observed.sizeBytes !== baseline.sizeBytes ||
      observed.mode !== baseline.mode
    ) {
      blockers.push(`Execute-phase baseline working-tree authority drifted: ${baseline.path}.`);
    }
  }
  for (const [relativePath, receipt] of latestReceipts) {
    if (pendingMutations.has(relativePath)) continue;
    if (currentStatusByPath.get(relativePath) !== latestMutationStatuses.get(relativePath)) {
      blockers.push(`Execute-phase mutation Git status drifted: ${relativePath}.`);
    }
    const observed = await observe(relativePath, false);
    if (observed.sha256 !== receipt.afterHash || observed.mode !== receipt.afterMode) {
      blockers.push(`Execute-phase mutation receipt no longer matches ${relativePath}.`);
    }
  }
  if (pendingMutations.size > 0) {
    const observations = await Promise.all([...pendingMutations.values()].map(async (mutation) => ({
      mutation,
      observed: await observe(mutation.path, false)
    })));
    const allAfter = observations.every(({ mutation, observed }) =>
      observed.sha256 === (mutation.operation === "write" ? sha256(mutation.content ?? "") : null) &&
      observed.mode === mutation.expectedAfterMode
    );
    const allBeforeWithMode = observations.every(({ mutation, observed }) =>
      observed.sha256 === mutation.expectedHash && observed.mode === mutation.expectedMode
    );
    if (!allBeforeWithMode && !allAfter) {
      blockers.push("Interrupted execute-phase mutation has a mixed or unknown repository postimage.");
    }
  }
  for (const artifact of session.packet.artifacts) {
    if (
      persistencePaths.has(artifact.path) ||
      (stateMayBePersisted && artifact.path === BLUEPRINT_STATE_PATH)
    ) continue;
    const observed = await observe(artifact.path, true);
    if (
      observed.sha256 !== artifact.sha256 ||
      observed.sizeBytes !== artifact.sizeBytes ||
      observed.mode !== artifact.mode
    ) {
      blockers.push(`Execute-phase authority artifact drifted after claim: ${artifact.path}.`);
    }
  }
  for (const plan of session.packet.selectedPlans) {
    for (const artifact of [...plan.ownedFilePreimages, ...plan.readFirstArtifacts]) {
      if (pendingMutations.has(artifact.path)) continue;
      const receipt = latestReceipts.get(artifact.path);
      const observed = await observe(artifact.path, artifact.path.startsWith(`${BLUEPRINT_DIR}/`));
      if (
        observed.sha256 !== (receipt?.afterHash ?? artifact.sha256) ||
        observed.mode !== (receipt?.afterMode ?? artifact.mode)
      ) {
        blockers.push(`Execute-phase repo authority drifted outside MCP ownership: ${artifact.path}.`);
      }
    }
  }
  return unique(blockers);
}

function emptyIndex(): ControlIndex {
  return {
    schemaVersion: 1,
    activeSessionId: null,
    consumedFingerprints: {},
    sessions: {}
  };
}

function createExecutionProgress(packet: PhaseExecutionControlPacket): PhaseExecutionProgress {
  return {
    schemaVersion: 1,
    currentPlanIndex: 0,
    plans: Object.fromEntries(packet.selectedPlans.map((plan) => [plan.planId, {
      planId: plan.planId,
      status: "pending",
      applyAttempts: 0,
      verificationAttempts: 0,
      pendingMutations: [],
      mutationReceipts: [],
      mutationGitStatusReceipts: [],
      verificationReceipts: [],
      failure: null,
      summaryReceipt: null,
      stateReceipt: null,
      pendingStateUpdate: null,
      persistenceStage: "none"
    } satisfies PhaseExecutionPlanProgress]))
  };
}

function sessionPath(sessionId: string): string {
  if (!/^[0-9A-Za-z-]{1,128}$/.test(sessionId)) {
    throw new Error("Execute-phase sessionId is unsafe or invalid.");
  }
  return `${SESSION_ROOT}/${sessionId}.json`;
}

async function assertControlStorageSafe(
  projectRoot: string,
  relativePath: string
): Promise<void> {
  const safePath = assertSafeRelativePath(relativePath, { allowBlueprint: true });
  const segments = safePath.split("/");
  let cursor = projectRoot;

  for (const segment of segments.slice(0, -1)) {
    cursor = path.join(cursor, segment);
    try {
      const stats = await fs.lstat(cursor);
      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        throw new Error(`Execute-phase control storage has an unsafe ancestor: ${safePath}.`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") break;
      throw error;
    }
  }

  const target = resolveBlueprintPath(projectRoot, safePath);
  try {
    const stats = await fs.lstat(target);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(`Execute-phase control storage is not a regular file: ${safePath}.`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function assertExecutionLockStorageSafe(projectRoot: string): Promise<void> {
  const canonicalRoot = await fs.realpath(projectRoot);
  const blueprintRoot = path.join(canonicalRoot, BLUEPRINT_DIR);
  const locksRoot = path.join(blueprintRoot, "locks");
  const blueprintStats = await fs.lstat(blueprintRoot);
  if (blueprintStats.isSymbolicLink() || !blueprintStats.isDirectory()) {
    throw new Error("Execute-phase lock storage has an unsafe .blueprint ancestor.");
  }
  try {
    const lockStats = await fs.lstat(locksRoot);
    if (lockStats.isSymbolicLink() || !lockStats.isDirectory()) {
      throw new Error("Execute-phase lock storage must be a real repository directory.");
    }
    const realLocksRoot = await fs.realpath(locksRoot);
    if (!isInside(canonicalRoot, realLocksRoot)) {
      throw new Error("Execute-phase lock storage escapes the canonical repository.");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function readJsonIfPresent(projectRoot: string, relativePath: string): Promise<unknown | null> {
  await assertControlStorageSafe(projectRoot, relativePath);
  try {
    const raw = await fs.readFile(resolveBlueprintPath(projectRoot, relativePath), "utf8");
    return JSON.parse(raw) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function asIndex(value: unknown): ControlIndex {
  if (value === null) return emptyIndex();
  if (!value || typeof value !== "object") throw new Error("Execute-phase control index is malformed.");
  const candidate = value as Partial<ControlIndex>;
  if (
    candidate.schemaVersion !== 1 ||
    !(candidate.activeSessionId === null || typeof candidate.activeSessionId === "string") ||
    !candidate.consumedFingerprints ||
    typeof candidate.consumedFingerprints !== "object" ||
    Array.isArray(candidate.consumedFingerprints) ||
    !candidate.sessions ||
    typeof candidate.sessions !== "object" ||
    Array.isArray(candidate.sessions)
  ) {
    throw new Error("Execute-phase control index is malformed.");
  }
  const index = candidate as ControlIndex;
  if (
    (index.activeSessionId !== null && !/^[0-9A-Za-z-]{1,128}$/.test(index.activeSessionId)) ||
    Object.entries(index.consumedFingerprints).some(
      ([fingerprint, sessionId]) =>
        !/^[0-9a-f]{64}$/.test(fingerprint) ||
        typeof sessionId !== "string" ||
        !/^[0-9A-Za-z-]{1,128}$/.test(sessionId)
    ) ||
    Object.entries(index.sessions).some(
      ([sessionId, storedPath]) =>
        !/^[0-9A-Za-z-]{1,128}$/.test(sessionId) ||
        storedPath !== sessionPath(sessionId)
    )
  ) {
    throw new Error("Execute-phase control index is malformed.");
  }
  return index;
}

function isArtifactDigest(value: unknown): value is ArtifactDigest {
  if (!value || typeof value !== "object") return false;
  const digest = value as Partial<ArtifactDigest>;
  return (
    typeof digest.path === "string" &&
    (digest.sha256 === null || (typeof digest.sha256 === "string" && /^[0-9a-f]{64}$/.test(digest.sha256))) &&
    (digest.sizeBytes === null || (Number.isInteger(digest.sizeBytes) && (digest.sizeBytes ?? -1) >= 0)) &&
    (digest.mode === null || Number.isInteger(digest.mode))
  );
}

function isVerificationOutputValid(receipt: Record<string, unknown>, channel: "stdout" | "stderr"): boolean {
  const text = receipt[channel];
  const bytes = receipt[`${channel}Bytes`];
  const hash = receipt[`${channel}Hash`];
  const truncated = receipt[`${channel}Truncated`];
  if (
    typeof text !== "string" ||
    !Number.isInteger(bytes) ||
    (bytes as number) < Buffer.byteLength(text) ||
    typeof hash !== "string" ||
    !/^[0-9a-f]{64}$/.test(hash) ||
    typeof truncated !== "boolean"
  ) {
    return false;
  }
  if (truncated) return (bytes as number) > Buffer.byteLength(text);
  return bytes === Buffer.byteLength(text) && hash === sha256(text);
}

export function isValidPhaseExecutionVerificationReceipt(
  value: unknown,
  command: string
): value is PhaseExecutionVerificationReceipt {
  if (!value || typeof value !== "object") return false;
  const receipt = value as Record<string, unknown>;
  const argv = receipt.argv;
  const exitCode = receipt.exitCode;
  const signal = receipt.signal;
  const timedOut = receipt.timedOut;
  const outputLimitExceeded = receipt.outputLimitExceeded;
  const passed = receipt.passed;
  const outcomePassed =
    exitCode === 0 && signal === null && timedOut === false && outputLimitExceeded === false;
  return (
    receipt.command === command &&
    Array.isArray(argv) &&
    argv.length === 2 &&
    argv[0] === "-c" &&
    argv[1] === command &&
    (exitCode === null || Number.isInteger(exitCode)) &&
    (signal === null || typeof signal === "string") &&
    typeof timedOut === "boolean" &&
    typeof outputLimitExceeded === "boolean" &&
    typeof passed === "boolean" &&
    passed === outcomePassed &&
    isVerificationOutputValid(receipt, "stdout") &&
    isVerificationOutputValid(receipt, "stderr")
  );
}

export function hasPassingBoundPhaseExecutionVerification(
  commands: readonly string[],
  receipts: readonly PhaseExecutionVerificationReceipt[] | undefined
): boolean {
  return (
    Array.isArray(receipts) &&
    receipts.length === commands.length &&
    receipts.every((receipt, index) =>
      isValidPhaseExecutionVerificationReceipt(receipt, commands[index]!) && receipt.passed
    )
  );
}

function isPreparedStateUpdate(
  value: unknown,
  packet: PhaseExecutionControlPacket
): value is PhaseExecutionPreparedStateUpdate {
  if (!value || typeof value !== "object") return false;
  const effect = value as Partial<PhaseExecutionPreparedStateUpdate>;
  if (!isArtifactDigest(effect.preimage) || !isArtifactDigest(effect.postimage)) return false;
  const prepared = effect.prepared as Partial<PreparedStateUpdate> | undefined;
  if (!prepared) return false;
  const expectedAbsolutePath = path.join(packet.repository.canonicalRoot, ...BLUEPRINT_STATE_PATH.split("/"));
  const expectedStateContent = prepared.expectedStateContent;
  if (!(expectedStateContent === null || typeof expectedStateContent === "string")) return false;
  if (
    prepared.projectRoot !== packet.repository.canonicalRoot ||
    prepared.statePath !== BLUEPRINT_STATE_PATH ||
    prepared.absoluteStatePath !== expectedAbsolutePath ||
    typeof prepared.content !== "string" ||
    typeof prepared.updated !== "boolean" ||
    !Array.isArray(prepared.updatedFields) ||
    !prepared.updatedFields.every((entry) => typeof entry === "string") ||
    !Array.isArray(prepared.warnings) ||
    !prepared.warnings.every((entry) => typeof entry === "string") ||
    effect.preimage.path !== BLUEPRINT_STATE_PATH ||
    effect.postimage.path !== BLUEPRINT_STATE_PATH ||
    effect.preimage.sha256 !== (expectedStateContent === null ? null : sha256(expectedStateContent)) ||
    effect.preimage.sizeBytes !== (expectedStateContent === null ? null : Buffer.byteLength(expectedStateContent)) ||
    effect.postimage.sha256 !== sha256(prepared.content) ||
    effect.postimage.sizeBytes !== Buffer.byteLength(prepared.content)
  ) {
    return false;
  }
  return true;
}

function isExecutionProgress(value: unknown, packet: PhaseExecutionControlPacket): value is PhaseExecutionProgress {
  if (!value || typeof value !== "object") return false;
  const progress = value as Partial<PhaseExecutionProgress>;
  if (
    progress.schemaVersion !== 1 ||
    !Number.isInteger(progress.currentPlanIndex) ||
    (progress.currentPlanIndex ?? -1) < 0 ||
    (progress.currentPlanIndex ?? Infinity) > packet.selectedPlans.length ||
    !progress.plans ||
    typeof progress.plans !== "object" ||
    Array.isArray(progress.plans)
  ) {
    return false;
  }
  const expectedIds = packet.selectedPlans.map((plan) => plan.planId).sort();
  if (canonicalJson(Object.keys(progress.plans).sort()) !== canonicalJson(expectedIds)) return false;
  const statuses = new Set([
    "pending", "applying", "mutated", "awaiting-repair", "repairing", "verifying",
    "verified", "blocked", "summary-written", "persisted"
  ]);
  const stages = new Set([
    "none", "summary-write", "summary-index", "artifact-validate", "state-update", "done"
  ]);
  return Object.entries(progress.plans).every(([planId, candidate]) => {
    const plan = candidate as Partial<PhaseExecutionPlanProgress>;
    const packetPlan = packet.selectedPlans.find((entry) => entry.planId === planId);
    if (!packetPlan) return false;
    const mutationReceiptsValid =
      Array.isArray(plan.mutationReceipts) &&
      plan.mutationReceipts.every((receipt) =>
        receipt &&
        typeof receipt === "object" &&
        packetPlan.allowedFiles.includes(receipt.path) &&
        (receipt.operation === "write" || receipt.operation === "delete") &&
        (receipt.beforeHash === null || /^[0-9a-f]{64}$/.test(receipt.beforeHash)) &&
        (receipt.afterHash === null || /^[0-9a-f]{64}$/.test(receipt.afterHash)) &&
        (receipt.beforeMode === null || Number.isInteger(receipt.beforeMode)) &&
        (receipt.afterMode === null || Number.isInteger(receipt.afterMode)) &&
        Number.isInteger(receipt.bytesWritten) &&
        receipt.bytesWritten >= 0
      );
    const mutationGitStatusReceiptsValid =
      Array.isArray(plan.mutationGitStatusReceipts) &&
      plan.mutationGitStatusReceipts.length === plan.mutationReceipts?.length &&
      plan.mutationGitStatusReceipts.every((receipt, index) =>
        receipt &&
        typeof receipt === "object" &&
        receipt.path === plan.mutationReceipts?.[index]?.path &&
        packetPlan.allowedFiles.includes(receipt.path) &&
        (receipt.status === null || (typeof receipt.status === "string" && receipt.status.length === 2))
      );
    const verificationReceiptsValid =
      Array.isArray(plan.verificationReceipts) &&
      plan.verificationReceipts.every((attempt) =>
        Array.isArray(attempt) &&
        attempt.length > 0 &&
        attempt.length <= packetPlan.verificationCommands.length &&
        attempt.every((receipt, index) =>
          isValidPhaseExecutionVerificationReceipt(receipt, packetPlan.verificationCommands[index]!)
        )
      );
    const latestVerification = plan.verificationReceipts?.at(-1);
    const hasPassingBoundVerification = hasPassingBoundPhaseExecutionVerification(
      packetPlan.verificationCommands,
      latestVerification
    );
    const completedStatus =
      plan.status === "verified" ||
      ((plan.status === "summary-written" || plan.status === "persisted") && plan.failure === null);
    const receiptAttemptDelta =
      (plan.verificationAttempts ?? -1) - (plan.verificationReceipts?.length ?? 0);
    const attemptCountsValid = completedStatus
      ? receiptAttemptDelta === 0
      : receiptAttemptDelta === 0 ||
        (receiptAttemptDelta === 1 &&
          (plan.status === "verifying" ||
            ((plan.status === "awaiting-repair" || plan.status === "blocked") &&
              typeof plan.failure === "string" &&
              /verification attempt \d+ was interrupted/i.test(plan.failure))));
    const pendingMutationsValid =
      Array.isArray(plan.pendingMutations) &&
      plan.pendingMutations.every((mutation) =>
        mutation &&
        typeof mutation === "object" &&
        packetPlan.allowedFiles.includes(mutation.path) &&
        (mutation.operation === "write" || mutation.operation === "delete") &&
        (mutation.expectedHash === null || /^[0-9a-f]{64}$/.test(mutation.expectedHash)) &&
        (mutation.expectedMode === null || Number.isInteger(mutation.expectedMode)) &&
        (mutation.expectedAfterMode === null || Number.isInteger(mutation.expectedAfterMode)) &&
        (mutation.operation === "write" ? typeof mutation.content === "string" : mutation.content === undefined)
      );
    const completionClaimValid =
      !(
        (plan.status === "verified" ||
          ((plan.status === "summary-written" || plan.status === "persisted") && plan.failure === null)) &&
        (!(plan.applyAttempts && plan.applyAttempts > 0) ||
          !plan.mutationReceipts?.length ||
          !hasPassingBoundVerification)
      );
    return (
      plan.planId === planId &&
      typeof plan.status === "string" &&
      statuses.has(plan.status) &&
      Number.isInteger(plan.applyAttempts) &&
      (plan.applyAttempts ?? -1) >= 0 &&
      (plan.applyAttempts ?? Infinity) <= 2 &&
      Number.isInteger(plan.verificationAttempts) &&
      (plan.verificationAttempts ?? -1) >= 0 &&
      (plan.verificationAttempts ?? Infinity) <= 2 &&
      pendingMutationsValid &&
      mutationReceiptsValid &&
      mutationGitStatusReceiptsValid &&
      verificationReceiptsValid &&
      attemptCountsValid &&
      (plan.failure === null || typeof plan.failure === "string") &&
      (plan.summaryReceipt === null || isArtifactDigest(plan.summaryReceipt)) &&
      (plan.stateReceipt === null || isArtifactDigest(plan.stateReceipt)) &&
      (plan.pendingStateUpdate === null || isPreparedStateUpdate(plan.pendingStateUpdate, packet)) &&
      (plan.pendingStateUpdate === null || plan.persistenceStage === "state-update") &&
      typeof plan.persistenceStage === "string" &&
      stages.has(plan.persistenceStage) &&
      completionClaimValid
    );
  });
}

function asSession(value: unknown): PhaseExecutionSession {
  if (!value || typeof value !== "object") throw new Error("Execute-phase session is malformed.");
  const candidate = value as Partial<PhaseExecutionSession>;
  if (
    candidate.schemaVersion !== 1 ||
    typeof candidate.sessionId !== "string" ||
    !["claimed", "executing", "blocked", "completed"].includes(candidate.status ?? "") ||
    typeof candidate.fingerprint !== "string" ||
    !/^[0-9a-f]{64}$/.test(candidate.fingerprint) ||
    typeof candidate.createdAt !== "string" ||
    !(candidate.lastResumedAt === null || typeof candidate.lastResumedAt === "string") ||
    !Number.isInteger(candidate.resumeCount) ||
    (candidate.resumeCount ?? -1) < 0 ||
    !candidate.packet ||
    candidate.packet.schemaVersion !== 1 ||
    candidate.packet.command !== "execute-phase" ||
    !candidate.prepareArgs ||
    fingerprintPacket(candidate.packet) !== candidate.fingerprint ||
    !isExecutionProgress(candidate.execution, candidate.packet)
  ) {
    throw new Error("Execute-phase session is malformed.");
  }
  return candidate as PhaseExecutionSession;
}

async function loadSession(projectRoot: string, sessionId: string): Promise<PhaseExecutionSession> {
  const value = await readJsonIfPresent(projectRoot, sessionPath(sessionId));
  if (value === null) throw new Error(`Execute-phase session ${sessionId} does not exist.`);
  const session = asSession(value);
  if (session.sessionId !== sessionId) throw new Error("Execute-phase session identity is inconsistent.");
  return session;
}

async function loadDurableSessions(
  projectRoot: string
): Promise<Map<string, PhaseExecutionSession>> {
  const absoluteRoot = resolveBlueprintPath(projectRoot, SESSION_ROOT);
  let names: string[];
  try {
    const [stats, canonicalProjectRoot, canonicalSessionRoot] = await Promise.all([
      fs.lstat(absoluteRoot),
      fs.realpath(projectRoot),
      fs.realpath(absoluteRoot)
    ]);
    if (
      stats.isSymbolicLink() ||
      !stats.isDirectory() ||
      !isInside(canonicalProjectRoot, canonicalSessionRoot)
    ) {
      throw new Error("Execute-phase session storage is unsafe.");
    }
    names = await fs.readdir(absoluteRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw error;
  }
  const sessions = new Map<string, PhaseExecutionSession>();
  for (const name of names.sort()) {
    if (!name.endsWith(".json")) continue;
    const sessionId = name.slice(0, -5);
    if (!/^[0-9A-Za-z-]{1,128}$/.test(sessionId)) {
      throw new Error(`Execute-phase session filename is invalid: ${name}.`);
    }
    const session = await loadSession(projectRoot, sessionId);
    sessions.set(sessionId, session);
  }
  return sessions;
}

function isEmptyIndex(index: ControlIndex): boolean {
  return (
    index.activeSessionId === null &&
    Object.keys(index.consumedFingerprints).length === 0 &&
    Object.keys(index.sessions).length === 0
  );
}

async function reconcileControlIndex(
  projectRoot: string,
  index: ControlIndex
): Promise<{ index: ControlIndex; sessions: Map<string, PhaseExecutionSession> }> {
  const sessions = await loadDurableSessions(projectRoot);

  if (isEmptyIndex(index) && sessions.size === 1) {
    const orphan = [...sessions.values()][0]!;
    const recovered: ControlIndex = {
      schemaVersion: 1,
      activeSessionId:
        orphan.status === "completed" || orphan.status === "blocked"
          ? null
          : orphan.sessionId,
      consumedFingerprints: { [orphan.fingerprint]: orphan.sessionId },
      sessions: { [orphan.sessionId]: sessionPath(orphan.sessionId) }
    };
    await persistIndex(projectRoot, recovered);
    return { index: recovered, sessions };
  }

  if (isEmptyIndex(index) && sessions.size > 1) {
    throw new Error(
      "Multiple orphaned execute-phase sessions exist; control ownership is ambiguous and requires repair."
    );
  }

  const indexedIds = Object.keys(index.sessions).sort();
  const durableIds = [...sessions.keys()].sort();
  const missingIndexedIds = indexedIds.filter((sessionId) => !sessions.has(sessionId));
  const orphanIds = durableIds.filter((sessionId) => !(sessionId in index.sessions));
  if (
    missingIndexedIds.length === 0 &&
    orphanIds.length === 1 &&
    index.activeSessionId === null
  ) {
    const orphan = sessions.get(orphanIds[0]!)!;
    const indexedSessionsAreTerminal = indexedIds.every((sessionId) => {
      const status = sessions.get(sessionId)?.status;
      return status === "completed" || status === "blocked";
    });
    if (
      orphan.status === "claimed" &&
      indexedSessionsAreTerminal &&
      !(orphan.fingerprint in index.consumedFingerprints)
    ) {
      const recovered: ControlIndex = {
        ...index,
        activeSessionId: orphan.sessionId,
        consumedFingerprints: {
          ...index.consumedFingerprints,
          [orphan.fingerprint]: orphan.sessionId
        },
        sessions: {
          ...index.sessions,
          [orphan.sessionId]: sessionPath(orphan.sessionId)
        }
      };
      await persistIndex(projectRoot, recovered);
      return { index: recovered, sessions };
    }
  }
  if (canonicalJson(indexedIds) !== canonicalJson(durableIds)) {
    throw new Error("Execute-phase index/session membership is inconsistent.");
  }

  const seenFingerprints = new Set<string>();
  for (const sessionId of indexedIds) {
    const session = sessions.get(sessionId)!;
    if (index.sessions[sessionId] !== sessionPath(sessionId)) {
      throw new Error(`Execute-phase index path is inconsistent for session ${sessionId}.`);
    }
    if (seenFingerprints.has(session.fingerprint)) {
      throw new Error(`Execute-phase durable sessions duplicate fingerprint ${session.fingerprint}.`);
    }
    seenFingerprints.add(session.fingerprint);
    if (index.consumedFingerprints[session.fingerprint] !== sessionId) {
      throw new Error(`Execute-phase consumed fingerprint mapping is inconsistent for session ${sessionId}.`);
    }
  }

  for (const [fingerprint, sessionId] of Object.entries(index.consumedFingerprints)) {
    const session = sessions.get(sessionId);
    if (!session || session.fingerprint !== fingerprint) {
      throw new Error(`Execute-phase consumed fingerprint ${fingerprint} is dangling or mismatched.`);
    }
  }

  if (index.activeSessionId !== null) {
    const active = sessions.get(index.activeSessionId);
    if (!active || index.consumedFingerprints[active.fingerprint] !== active.sessionId) {
      throw new Error("Execute-phase active-session mapping is inconsistent.");
    }
    if (active.status === "completed" || active.status === "blocked") {
      index.activeSessionId = null;
      await persistIndex(projectRoot, index);
    }
  } else if ([...sessions.values()].some(
    (session) => session.status !== "completed" && session.status !== "blocked"
  )) {
    throw new Error("Execute-phase durable active sessions exist without an active-session mapping.");
  }

  return { index, sessions };
}

async function persistIndex(projectRoot: string, index: ControlIndex): Promise<void> {
  await assertControlStorageSafe(projectRoot, INDEX_PATH);
  await writeJsonFile(
    resolveBlueprintPath(projectRoot, INDEX_PATH),
    index as unknown as Record<string, unknown>
  );
}

async function persistSession(projectRoot: string, session: PhaseExecutionSession): Promise<void> {
  await assertControlStorageSafe(projectRoot, sessionPath(session.sessionId));
  await writeJsonFile(
    resolveBlueprintPath(projectRoot, sessionPath(session.sessionId)),
    session as unknown as Record<string, unknown>
  );
}

function failure(
  mode: PhaseExecutionPrepareMode,
  projectRoot: string | null,
  message: string,
  status: "blocked" | "stale" = "blocked",
  packet: PhaseExecutionControlPacket | null = null,
  fingerprint: string | null = null,
  warnings: string[] = []
): PhaseExecutionPrepareResult {
  return {
    status,
    mode,
    ready: false,
    reused: false,
    projectRoot,
    fingerprint,
    packet,
    session: null,
    blockers: [message],
    warnings
  };
}

export type PhaseExecutionSessionMutationContext = {
  projectRoot: string;
  checkpoint: (session: PhaseExecutionSession) => Promise<void>;
};

export async function mutatePhaseExecutionSession<T>(args: {
  cwd?: string;
  sessionId: string;
  mutate: (
    session: PhaseExecutionSession,
    context: PhaseExecutionSessionMutationContext
  ) => Promise<{ session: PhaseExecutionSession; result: T }>;
}): Promise<{ session: PhaseExecutionSession; result: T; projectRoot: string }> {
  const projectRoot = await ensureRepoRoot(args.cwd);
  await assertExecutionLockStorageSafe(projectRoot);
  return withBlueprintRepoLock(projectRoot, CONTROL_LOCK, async () => {
    const reconciled = await reconcileControlIndex(
      projectRoot,
      asIndex(await readJsonIfPresent(projectRoot, INDEX_PATH))
    );
    const original = reconciled.sessions.get(args.sessionId);
    if (!original) throw new Error(`Execute-phase session ${args.sessionId} does not exist.`);
    if (reconciled.index.activeSessionId !== original.sessionId) {
      throw new Error(`Execute-phase session ${args.sessionId} is not active.`);
    }
    const assertIdentity = (session: PhaseExecutionSession): PhaseExecutionSession => {
      const validated = asSession(structuredClone(session));
      if (
        validated.sessionId !== original.sessionId ||
        validated.fingerprint !== original.fingerprint ||
        canonicalJson(validated.packet) !== canonicalJson(original.packet)
      ) {
        throw new Error("Execute-phase session mutation changed immutable execution authority.");
      }
      return validated;
    };
    const checkpoint = async (session: PhaseExecutionSession): Promise<void> => {
      await persistSession(projectRoot, assertIdentity(session));
    };
    const updated = await args.mutate(structuredClone(original), {
      projectRoot,
      checkpoint
    });
    const session = assertIdentity(updated.session);
    await persistSession(projectRoot, session);
    if (session.status === "completed" || session.status === "blocked") {
      reconciled.index.activeSessionId = null;
      await persistIndex(projectRoot, reconciled.index);
    }
    return { session, result: updated.result, projectRoot };
  });
}

export async function blueprintPhaseExecutionPrepare(
  args: PhaseExecutionPrepareArgs = {},
  dependencyOverrides?: Partial<PhaseExecutionControlDependencies>
): Promise<PhaseExecutionPrepareResult> {
  const mode = args.mode ?? "preview";
  const deps = dependencies(dependencyOverrides);
  let projectRoot: string;

  try {
    projectRoot = await ensureRepoRoot(args.cwd);
    await assertExecutionLockStorageSafe(projectRoot);
  } catch (error) {
    return failure(mode, null, (error as Error).message);
  }

  if (mode === "resume") {
    if (!args.sessionId) return failure(mode, projectRoot, "Resume requires an exact sessionId.");

    try {
      return await withBlueprintRepoLock(projectRoot, CONTROL_LOCK, async () => {
        const reconciled = await reconcileControlIndex(
          projectRoot,
          asIndex(await readJsonIfPresent(projectRoot, INDEX_PATH))
        );
        const index = reconciled.index;
        const session = reconciled.sessions.get(args.sessionId!);
        if (!session) {
          return failure(mode, projectRoot, `Execute-phase session ${args.sessionId} does not exist.`);
        }
        if (index.activeSessionId !== session.sessionId) {
          return failure(mode, projectRoot, "The requested session is not the active execute-phase session.");
        }
        if (session.packet.repository.canonicalRoot !== await fs.realpath(projectRoot)) {
          return failure(mode, projectRoot, "The durable session belongs to a different canonical repository.", "stale");
        }
        const current = session.status === "claimed"
          ? await buildPacket(projectRoot, {
              cwd: projectRoot,
              mode: "preview",
              phase: session.prepareArgs.phase ?? undefined,
              wave: session.prepareArgs.wave ?? undefined,
              gapsOnly: session.prepareArgs.gapsOnly,
              includeConflicts: session.prepareArgs.includeConflicts,
              externalServiceConfirmed: session.prepareArgs.externalServiceConfirmed,
              overwriteConfirmedPlanIds: session.prepareArgs.overwriteConfirmedPlanIds,
              defaultsPath: session.prepareArgs.defaultsPath ?? undefined
            }, deps)
          : {
              packet: session.packet,
              fingerprint: session.fingerprint,
              blockers: await validateExecutingSessionAuthority(projectRoot, session, deps),
              warnings: [] as string[]
            };
        if (current.fingerprint !== session.fingerprint || current.blockers.length > 0) {
          return {
            ...failure(
              mode,
              projectRoot,
              `Execution session is stale; expected ${session.fingerprint}, observed ${current.fingerprint}.`,
              "stale",
              current.packet,
              current.fingerprint,
              current.warnings
            ),
            blockers: unique([
              `Execution session is stale; expected ${session.fingerprint}, observed ${current.fingerprint}.`,
              ...current.blockers
            ])
          };
        }
        const resumed: PhaseExecutionSession = {
          ...session,
          lastResumedAt: deps.now(),
          resumeCount: session.resumeCount + 1
        };
        await persistSession(projectRoot, resumed);
        return {
          status: "resumed",
          mode,
          ready: true,
          reused: true,
          projectRoot,
          fingerprint: current.fingerprint,
          packet: current.packet,
          session: resumed,
          blockers: [],
          warnings: current.warnings
        };
      });
    } catch (error) {
      return failure(mode, projectRoot, (error as Error).message);
    }
  }

  if (mode === "claim" && args.confirmation !== EXECUTE_PHASE_CLAIM_CONFIRMATION) {
    return failure(
      mode,
      projectRoot,
      `Claim requires the exact confirmation literal: ${EXECUTE_PHASE_CLAIM_CONFIRMATION}.`
    );
  }
  if (mode === "claim" && !/^[0-9a-f]{64}$/.test(args.previewFingerprint ?? "")) {
    return failure(mode, projectRoot, "Claim requires the exact 64-character preview fingerprint.");
  }

  const execute = async (): Promise<PhaseExecutionPrepareResult> => {
    const built = await buildPacket(projectRoot, args, deps);
    if (mode === "preview") {
      return {
        status: built.blockers.length > 0 ? "blocked" : "preview",
        mode,
        ready: built.blockers.length === 0,
        reused: false,
        projectRoot,
        fingerprint: built.fingerprint,
        packet: built.packet,
        session: null,
        blockers: built.blockers,
        warnings: built.warnings
      };
    }
    if (args.previewFingerprint !== built.fingerprint) {
      return failure(
        mode,
        projectRoot,
        `Preview drifted; expected ${args.previewFingerprint}, observed ${built.fingerprint}.`,
        "stale",
        built.packet,
        built.fingerprint,
        built.warnings
      );
    }
    if (built.blockers.length > 0) {
      return {
        ...failure(mode, projectRoot, built.blockers[0]!, "blocked", built.packet, built.fingerprint, built.warnings),
        blockers: built.blockers
      };
    }

    const reconciled = await reconcileControlIndex(
      projectRoot,
      asIndex(await readJsonIfPresent(projectRoot, INDEX_PATH))
    );
    const index = reconciled.index;
    const consumedSessionId = index.consumedFingerprints[built.fingerprint];
    if (consumedSessionId) {
      const session = reconciled.sessions.get(consumedSessionId);
      if (!session || session.fingerprint !== built.fingerprint) {
        throw new Error("Execute-phase consumed fingerprint mapping is inconsistent.");
      }
      if (index.activeSessionId === session.sessionId) {
        return {
          status: "claimed",
          mode,
          ready: true,
          reused: true,
          projectRoot,
          fingerprint: built.fingerprint,
          packet: built.packet,
          session,
          blockers: [],
          warnings: unique([...built.warnings, "Identical claim reused the active durable session."])
        };
      }
      return failure(mode, projectRoot, "This preview fingerprint was already consumed and cannot be replayed.");
    }
    if (index.activeSessionId) {
      return failure(
        mode,
        projectRoot,
        `A different execute-phase session is already active: ${index.activeSessionId}.`
      );
    }

    const sessionId = deps.createSessionId();
    sessionPath(sessionId);
    const options = prepareOptions(args);
    const session: PhaseExecutionSession = {
      schemaVersion: 1,
      sessionId,
      status: "claimed",
      fingerprint: built.fingerprint,
      createdAt: deps.now(),
      lastResumedAt: null,
      resumeCount: 0,
      prepareArgs: {
        ...options,
        defaultsPath: args.defaultsPath ?? null
      },
      packet: built.packet,
      execution: createExecutionProgress(built.packet)
    };
    await persistSession(projectRoot, session);
    await deps.afterSessionPersisted?.(session);
    index.activeSessionId = sessionId;
    index.consumedFingerprints[built.fingerprint] = sessionId;
    index.sessions[sessionId] = sessionPath(sessionId);
    await persistIndex(projectRoot, index);
    return {
      status: "claimed",
      mode,
      ready: true,
      reused: false,
      projectRoot,
      fingerprint: built.fingerprint,
      packet: built.packet,
      session,
      blockers: [],
      warnings: built.warnings
    };
  };

  try {
    return mode === "claim"
      ? await withBlueprintRepoLock(projectRoot, CONTROL_LOCK, execute)
      : await execute();
  } catch (error) {
    return failure(mode, projectRoot, (error as Error).message);
  }
}
