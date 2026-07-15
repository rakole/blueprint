import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import * as z from "zod/v4";

import type { ToolDefinition } from "../tool-types.js";
import { blueprintConfigGet } from "./config.js";
import { blueprintArtifactValidate } from "./artifacts.js";
import {
  blueprintPhaseExecutionPrepare,
  capturePhaseExecutionRepositorySnapshot,
  hasPassingBoundPhaseExecutionVerification,
  mutatePhaseExecutionSession,
  type PhaseExecutionPlanProgress,
  type PhaseExecutionPreparedStateUpdate,
  type PhaseExecutionSession
} from "./phase-execution-control.js";
import {
  applyPhaseExecutionMutations,
  observePhaseExecutionGitState,
  runPhaseExecutionVerification,
  type PhaseExecutionFileMutation,
  type PhaseExecutionMutationReceipt,
  type PhaseExecutionProcessRunner,
  type PhaseExecutionVerificationReceipt
} from "./phase-execution-runtime.js";
import { blueprintPhaseSummaryIndex, blueprintPhaseSummaryWrite } from "./phase.js";
import {
  prepareBlueprintStateUpdate,
  writePreparedBlueprintStateUpdate
} from "./state.js";

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

async function readRepoHash(projectRoot: string, relativePath: string): Promise<{
  hash: string | null;
  bytes: number;
  mode: number | null;
}> {
  const absolutePath = path.resolve(projectRoot, ...relativePath.split("/"));
  if (!absolutePath.startsWith(`${path.resolve(projectRoot)}${path.sep}`)) {
    throw new Error(`Execution authority path escapes the repository: ${relativePath}.`);
  }
  try {
    const stats = await fs.lstat(absolutePath);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(`Execution authority path is not a regular file: ${relativePath}.`);
    }
    const content = await fs.readFile(absolutePath);
    return { hash: sha256(content), bytes: content.byteLength, mode: stats.mode & 0o7777 };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { hash: null, bytes: 0, mode: null };
    }
    throw error;
  }
}

function interruptedVerificationReceipt(command: string): PhaseExecutionVerificationReceipt {
  const stderr = "Verification was interrupted before a complete process receipt was persisted.\n";
  return {
    command,
    argv: ["-c", command],
    exitCode: null,
    signal: null,
    timedOut: true,
    outputLimitExceeded: false,
    passed: false,
    stdout: "",
    stdoutBytes: 0,
    stdoutHash: sha256(""),
    stdoutTruncated: false,
    stderr,
    stderrBytes: Buffer.byteLength(stderr),
    stderrHash: sha256(stderr),
    stderrTruncated: false
  };
}

function latestReceiptByPath(session: PhaseExecutionSession): Map<string, PhaseExecutionMutationReceipt> {
  const receipts = new Map<string, PhaseExecutionMutationReceipt>();
  for (const plan of Object.values(session.execution.plans)) {
    for (const receipt of plan.mutationReceipts) receipts.set(receipt.path, receipt);
  }
  return receipts;
}

function currentPlan(session: PhaseExecutionSession): {
  packetPlan: PhaseExecutionSession["packet"]["selectedPlans"][number];
  progress: PhaseExecutionPlanProgress;
} {
  const packetPlan = session.packet.selectedPlans[session.execution.currentPlanIndex];
  if (!packetPlan) throw new Error("Execute-phase session has no current selected plan.");
  const progress = session.execution.plans[packetPlan.planId];
  if (!progress) throw new Error(`Execute-phase session is missing progress for plan ${packetPlan.planId}.`);
  return { packetPlan, progress };
}

async function assertSessionAuthority(
  projectRoot: string,
  session: PhaseExecutionSession
): Promise<void> {
  const receipts = latestReceiptByPath(session);
  const mutationStatuses = new Map<string, string | null>();
  const persistedSummaryPaths = new Set<string>();
  let stateWasPersisted = false;
  let pendingStateUpdate: PhaseExecutionPreparedStateUpdate | null = null;
  for (const [planId, progress] of Object.entries(session.execution.plans)) {
    for (const receipt of progress.mutationGitStatusReceipts) {
      mutationStatuses.set(receipt.path, receipt.status);
    }
    if (progress.persistenceStage !== "none") {
      persistedSummaryPaths.add(
        `${session.packet.selection.phaseDir}/${session.packet.selection.phasePrefix}-${planId}-SUMMARY.md`
      );
    }
    if (progress.persistenceStage === "done" || progress.pendingStateUpdate !== null) {
      stateWasPersisted = true;
    }
    if (progress.pendingStateUpdate) {
      if (pendingStateUpdate) throw new Error("Execute-phase session contains multiple pending STATE effects.");
      pendingStateUpdate = progress.pendingStateUpdate;
    }
  }
  const baselinePaths = session.packet.repository.workingTree.map((entry) => entry.path);
  const observation = await observePhaseExecutionGitState({
    projectRoot,
    authorizedFiles: [...receipts.keys()],
    baselineChangedPaths: baselinePaths
  });
  if (observation.head !== session.packet.repository.head) {
    throw new Error(
      `Execute-phase session HEAD drifted: expected ${session.packet.repository.head}, observed ${observation.head}.`
    );
  }
  const exactRepository = await capturePhaseExecutionRepositorySnapshot(projectRoot);
  const currentStatusByPath = new Map(
    exactRepository.workingTree.map((entry) => [entry.path, entry.status])
  );
  const pendingMutationPaths = new Set(
    Object.values(session.execution.plans).flatMap((progress) =>
      progress.pendingMutations.map((mutation) => mutation.path)
    )
  );
  for (const relativePath of receipts.keys()) {
    if (pendingMutationPaths.has(relativePath)) continue;
    if (currentStatusByPath.get(relativePath) !== mutationStatuses.get(relativePath)) {
      throw new Error(`Execute-phase mutation Git status drifted: ${relativePath}.`);
    }
  }
  for (const baseline of session.packet.repository.workingTree) {
    if (receipts.has(baseline.path) || pendingMutationPaths.has(baseline.path)) continue;
    if (currentStatusByPath.get(baseline.path) !== baseline.status) {
      throw new Error(`Execute-phase baseline Git status drifted: ${baseline.path}.`);
    }
  }
  const unauthorizedChangedPaths = observation.unauthorizedChangedPaths.filter(
    (relativePath) =>
      !persistedSummaryPaths.has(relativePath) &&
      !(stateWasPersisted && relativePath === ".blueprint/STATE.md")
  );
  if (unauthorizedChangedPaths.length > 0) {
    throw new Error(
      `Execute-phase observed changes without MCP receipts: ${unauthorizedChangedPaths.join(", ")}.`
    );
  }

  const config = await blueprintConfigGet({
    cwd: projectRoot,
    scope: "effective",
    defaultsPath: session.prepareArgs.defaultsPath ?? undefined
  });
  if (canonicalJson(config) !== canonicalJson(session.packet.effectiveConfig)) {
    throw new Error("Execute-phase effective config drifted after claim.");
  }

  let stateMatchesPendingPostimage = false;
  if (pendingStateUpdate) {
    const observed = await readRepoHash(projectRoot, ".blueprint/STATE.md");
    const matches = (digest: PhaseExecutionPreparedStateUpdate["preimage"]) =>
      observed.hash === digest.sha256 &&
      observed.bytes === digest.sizeBytes &&
      observed.mode === digest.mode;
    stateMatchesPendingPostimage = matches(pendingStateUpdate.postimage);
    if (!matches(pendingStateUpdate.preimage) && !stateMatchesPendingPostimage) {
      throw new Error(
        "Execute-phase pending STATE effect matches neither its trusted preimage nor prepared postimage."
      );
    }
  }

  for (const progress of Object.values(session.execution.plans)) {
    if (progress.summaryReceipt) {
      const observed = await readRepoHash(projectRoot, progress.summaryReceipt.path);
      if (
        observed.hash !== progress.summaryReceipt.sha256 ||
        observed.bytes !== progress.summaryReceipt.sizeBytes ||
        observed.mode !== progress.summaryReceipt.mode
      ) {
        throw new Error(`Execute-phase persisted summary receipt drifted: ${progress.summaryReceipt.path}.`);
      }
    } else if (
      progress.persistenceStage !== "none" &&
      progress.persistenceStage !== "summary-write"
    ) {
      throw new Error(`Execute-phase plan ${progress.planId} is missing its persisted summary receipt.`);
    }
    if (progress.stateReceipt && !stateMatchesPendingPostimage) {
      const observed = await readRepoHash(projectRoot, progress.stateReceipt.path);
      if (
        observed.hash !== progress.stateReceipt.sha256 ||
        observed.bytes !== progress.stateReceipt.sizeBytes ||
        observed.mode !== progress.stateReceipt.mode
      ) {
        throw new Error(`Execute-phase persisted state receipt drifted: ${progress.stateReceipt.path}.`);
      }
    } else if (progress.persistenceStage === "done" && !stateMatchesPendingPostimage) {
      throw new Error(`Execute-phase plan ${progress.planId} is missing its persisted STATE receipt.`);
    }
  }

  for (const baseline of session.packet.repository.workingTree) {
    if (receipts.has(baseline.path)) continue;
    const observed = await readRepoHash(projectRoot, baseline.path);
    if (
      observed.hash !== baseline.sha256 ||
      observed.bytes !== baseline.sizeBytes ||
      observed.mode !== baseline.mode
    ) {
      throw new Error(`Execute-phase baseline working-tree authority drifted: ${baseline.path}.`);
    }
  }

  for (const artifact of session.packet.artifacts) {
    if (
      persistedSummaryPaths.has(artifact.path) ||
      (stateWasPersisted && artifact.path === ".blueprint/STATE.md")
    ) continue;
    const observed = await readRepoHash(projectRoot, artifact.path);
    if (
      observed.hash !== artifact.sha256 ||
      observed.bytes !== artifact.sizeBytes ||
      observed.mode !== artifact.mode
    ) {
      throw new Error(`Execute-phase authority artifact drifted after claim: ${artifact.path}.`);
    }
  }

  for (const plan of session.packet.selectedPlans) {
    for (const artifact of [...plan.ownedFilePreimages, ...plan.readFirstArtifacts]) {
      const receipt = receipts.get(artifact.path);
      const observed = await readRepoHash(projectRoot, artifact.path);
      const expectedHash = receipt ? receipt.afterHash : artifact.sha256;
      const expectedMode = receipt ? receipt.afterMode : artifact.mode;
      if (observed.hash !== expectedHash || observed.mode !== expectedMode) {
        throw new Error(`Execute-phase repo preimage drifted outside MCP ownership: ${artifact.path}.`);
      }
    }
  }
}

async function recoverInterruptedMutation(
  projectRoot: string,
  session: PhaseExecutionSession,
  progress: PhaseExecutionPlanProgress
): Promise<"none" | "rolled-back" | "committed" | "ambiguous"> {
  if (progress.status !== "applying" && progress.status !== "repairing") return "none";
  const observations = await Promise.all(progress.pendingMutations.map(async (mutation) => ({
    mutation,
    observed: await readRepoHash(projectRoot, mutation.path)
  })));
  const allBefore = observations.every(({ mutation, observed }) =>
    observed.hash === mutation.expectedHash && observed.mode === mutation.expectedMode
  );
  const allAfter = observations.every(({ mutation, observed }) =>
    observed.hash === (mutation.operation === "write" ? sha256(mutation.content ?? "") : null) &&
    observed.mode === mutation.expectedAfterMode
  );
  if (allBefore) {
    progress.status = progress.status === "repairing" ? "awaiting-repair" : "pending";
    progress.pendingMutations = [];
    return "rolled-back";
  }
  if (allAfter) {
    const receipts = observations.map(({ mutation, observed }) => ({
      path: mutation.path,
      operation: mutation.operation,
      beforeHash: mutation.expectedHash,
      beforeMode: mutation.expectedMode,
      afterHash: observed.hash,
      afterMode: mutation.expectedAfterMode,
      bytesWritten: observed.bytes
    } satisfies PhaseExecutionMutationReceipt));
    progress.mutationReceipts.push(...receipts);
    progress.mutationGitStatusReceipts.push(
      ...await captureMutationGitStatusReceipts(projectRoot, receipts)
    );
    progress.applyAttempts += 1;
    progress.pendingMutations = [];
    progress.status = "mutated";
    return "committed";
  }
  progress.status = "blocked";
  progress.failure = "Interrupted mutation left a mixed or unknown repo postimage.";
  return "ambiguous";
}

async function captureMutationGitStatusReceipts(
  projectRoot: string,
  receipts: PhaseExecutionMutationReceipt[]
): Promise<Array<{ path: string; status: string | null }>> {
  const repository = await capturePhaseExecutionRepositorySnapshot(projectRoot);
  const statuses = new Map(repository.workingTree.map((entry) => [entry.path, entry.status]));
  return receipts.map((receipt) => ({
    path: receipt.path,
    status: statuses.get(receipt.path) ?? null
  }));
}

function expectedPreimages(
  session: PhaseExecutionSession,
  planId: string
): Map<string, string | null> {
  const plan = session.packet.selectedPlans.find((candidate) => candidate.planId === planId);
  if (!plan) throw new Error(`Plan ${planId} is not selected in this execute-phase session.`);
  const expected = new Map(plan.ownedFilePreimages.map((entry) => [entry.path, entry.sha256]));
  for (const packetPlan of session.packet.selectedPlans) {
    for (const receipt of session.execution.plans[packetPlan.planId]?.mutationReceipts ?? []) {
      if (expected.has(receipt.path)) expected.set(receipt.path, receipt.afterHash);
    }
    if (packetPlan.planId === planId) break;
  }
  return expected;
}

export type PhaseExecutionApplyResult = {
  status: "mutated" | "recovered" | "blocked";
  sessionId: string;
  planId: string;
  attempt: number;
  receipts: PhaseExecutionMutationReceipt[];
  failure: string | null;
};

export async function blueprintPhaseExecutionApply(args: {
  cwd?: string;
  sessionId: string;
  planId: string;
  mutations: PhaseExecutionFileMutation[];
}): Promise<PhaseExecutionApplyResult> {
  const updated = await mutatePhaseExecutionSession<PhaseExecutionApplyResult>({
    cwd: args.cwd,
    sessionId: args.sessionId,
    mutate: async (session, context) => {
      const { packetPlan, progress } = currentPlan(session);
      if (packetPlan.planId !== args.planId) {
        throw new Error(
          `Execute-phase plan order is deterministic; current plan is ${packetPlan.planId}, not ${args.planId}.`
        );
      }
      const recovery = await recoverInterruptedMutation(context.projectRoot, session, progress);
      if (recovery === "ambiguous") {
        return {
          session,
          result: {
            status: "blocked",
            sessionId: session.sessionId,
            planId: packetPlan.planId,
            attempt: progress.applyAttempts,
            receipts: progress.mutationReceipts,
            failure: progress.failure
          } satisfies PhaseExecutionApplyResult
        };
      }
      if (recovery === "committed") {
        await assertSessionAuthority(context.projectRoot, session);
        return {
          session,
          result: {
            status: "recovered",
            sessionId: session.sessionId,
            planId: packetPlan.planId,
            attempt: progress.applyAttempts,
            receipts: progress.mutationReceipts,
            failure: null
          } satisfies PhaseExecutionApplyResult
        };
      }
      if (progress.status !== "pending" && progress.status !== "awaiting-repair") {
        throw new Error(`Plan ${packetPlan.planId} cannot accept mutations from status ${progress.status}.`);
      }
      if (progress.status === "awaiting-repair" && progress.applyAttempts !== 1) {
        throw new Error("Execute-phase repair is allowed exactly once after the first failed verification.");
      }
      if (progress.status === "pending" && progress.applyAttempts !== 0) {
        throw new Error("Execute-phase initial mutation attempt has already been consumed.");
      }
      const expected = expectedPreimages(session, packetPlan.planId);
      for (const mutation of args.mutations) {
        if (!expected.has(mutation.path)) {
          throw new Error(`Mutation path is outside plan ${packetPlan.planId} ownership: ${mutation.path}.`);
        }
        if (expected.get(mutation.path) !== mutation.expectedHash) {
          throw new Error(`Mutation preimage is not the claimed session preimage: ${mutation.path}.`);
        }
      }
      await assertSessionAuthority(context.projectRoot, session);
      progress.status = progress.status === "awaiting-repair" ? "repairing" : "applying";
      progress.pendingMutations = await Promise.all(args.mutations.map(async (mutation) => {
        const observed = await readRepoHash(context.projectRoot, mutation.path);
        const expectedAfterMode = mutation.operation === "delete"
          ? null
          : observed.mode ?? (0o666 & ~process.umask());
        return {
          ...structuredClone(mutation),
          expectedMode: observed.mode,
          expectedAfterMode
        };
      }));
      progress.failure = null;
      session.status = "executing";
      await context.checkpoint(session);

      let outcome;
      try {
        outcome = await applyPhaseExecutionMutations({
          projectRoot: context.projectRoot,
          authorizedFiles: packetPlan.allowedFiles,
          mutations: args.mutations
        });
      } catch (error) {
        progress.status = progress.applyAttempts === 0 ? "pending" : "awaiting-repair";
        progress.pendingMutations = [];
        progress.failure = error instanceof Error ? error.message : String(error);
        return {
          session,
          result: {
            status: "blocked",
            sessionId: session.sessionId,
            planId: packetPlan.planId,
            attempt: progress.applyAttempts,
            receipts: progress.mutationReceipts,
            failure: progress.failure
          } satisfies PhaseExecutionApplyResult
        };
      }
      progress.pendingMutations = [];
      progress.mutationReceipts.push(...outcome.receipts);
      progress.mutationGitStatusReceipts.push(
        ...await captureMutationGitStatusReceipts(context.projectRoot, outcome.receipts)
      );
      if (outcome.status !== "committed") {
        progress.status = "blocked";
        progress.failure = outcome.failure ?? outcome.status;
        return {
          session,
          result: {
            status: "blocked",
            sessionId: session.sessionId,
            planId: packetPlan.planId,
            attempt: progress.applyAttempts,
            receipts: progress.mutationReceipts,
            failure: progress.failure
          } satisfies PhaseExecutionApplyResult
        };
      }
      progress.applyAttempts += 1;
      progress.status = "mutated";
      await assertSessionAuthority(context.projectRoot, session);
      return {
        session,
        result: {
          status: "mutated",
          sessionId: session.sessionId,
          planId: packetPlan.planId,
          attempt: progress.applyAttempts,
          receipts: outcome.receipts,
          failure: null
        } satisfies PhaseExecutionApplyResult
      };
    }
  });
  return updated.result;
}

export type PhaseExecutionVerifyResult = {
  status: "verified" | "awaiting-repair" | "blocked";
  sessionId: string;
  planId: string;
  attempt: number;
  commands: string[];
  receipts: PhaseExecutionVerificationReceipt[];
  failure: string | null;
};

export async function blueprintPhaseExecutionVerify(
  args: {
    cwd?: string;
    sessionId: string;
    planId: string;
  },
  dependencies: {
    processRunner?: PhaseExecutionProcessRunner;
    timeoutMs?: number;
  } = {}
): Promise<PhaseExecutionVerifyResult> {
  const updated = await mutatePhaseExecutionSession<PhaseExecutionVerifyResult>({
    cwd: args.cwd,
    sessionId: args.sessionId,
    mutate: async (session, context) => {
      const { packetPlan, progress } = currentPlan(session);
      if (packetPlan.planId !== args.planId) {
        throw new Error(`Execute-phase current plan is ${packetPlan.planId}, not ${args.planId}.`);
      }
      const recovery = await recoverInterruptedMutation(context.projectRoot, session, progress);
      if (recovery === "ambiguous") {
        return {
          session,
          result: {
            status: "blocked",
            sessionId: session.sessionId,
            planId: packetPlan.planId,
            attempt: progress.verificationAttempts,
            commands: packetPlan.verificationCommands,
            receipts: [],
            failure: progress.failure
          } satisfies PhaseExecutionVerifyResult
        };
      }
      if (progress.status === "verifying") {
        await assertSessionAuthority(context.projectRoot, session);
        if (progress.verificationReceipts.length < progress.verificationAttempts) {
          progress.verificationReceipts.push([
            interruptedVerificationReceipt(packetPlan.verificationCommands[0]!)
          ]);
        }
        progress.failure =
          `Verification attempt ${progress.verificationAttempts} was interrupted before a complete receipt was persisted.`;
        if (progress.verificationAttempts >= 2) {
          progress.status = "blocked";
          return {
            session,
            result: {
              status: "blocked",
              sessionId: session.sessionId,
              planId: packetPlan.planId,
              attempt: progress.verificationAttempts,
              commands: packetPlan.verificationCommands,
              receipts: [],
              failure: progress.failure
            }
          };
        }
        progress.status = "awaiting-repair";
        return {
          session,
          result: {
            status: "awaiting-repair",
            sessionId: session.sessionId,
            planId: packetPlan.planId,
            attempt: progress.verificationAttempts,
            commands: packetPlan.verificationCommands,
            receipts: [],
            failure: progress.failure
          }
        };
      }
      if (progress.verificationAttempts >= 2) {
        throw new Error("Execute-phase verification and one repair attempt are already exhausted.");
      }
      if (progress.status !== "mutated") {
        throw new Error(`Plan ${packetPlan.planId} must have an MCP mutation receipt before verification.`);
      }
      if (packetPlan.verificationCommands.length === 0) {
        throw new Error(`Plan ${packetPlan.planId} has no bound verification commands.`);
      }
      await assertSessionAuthority(context.projectRoot, session);
      progress.status = "verifying";
      progress.verificationAttempts += 1;
      progress.failure = null;
      await context.checkpoint(session);
      const receipts = await runPhaseExecutionVerification({
        projectRoot: context.projectRoot,
        commands: packetPlan.verificationCommands,
        processRunner: dependencies.processRunner,
        timeoutMs: dependencies.timeoutMs
      });
      progress.verificationReceipts.push(receipts);
      const passed =
        receipts.length === packetPlan.verificationCommands.length &&
        receipts.every((receipt) => receipt.passed);
      await assertSessionAuthority(context.projectRoot, session);
      if (passed) {
        progress.status = "verified";
        progress.failure = null;
        return {
          session,
          result: {
            status: "verified",
            sessionId: session.sessionId,
            planId: packetPlan.planId,
            attempt: progress.verificationAttempts,
            commands: packetPlan.verificationCommands,
            receipts,
            failure: null
          } satisfies PhaseExecutionVerifyResult
        };
      }
      const failure = receipts.find((receipt) => !receipt.passed);
      progress.failure = failure
        ? `Verification failed for ${failure.command} (exit ${failure.exitCode ?? "none"}${failure.timedOut ? ", timed out" : ""}).`
        : "Verification did not produce receipts for every bound command.";
      if (progress.verificationAttempts === 1) {
        progress.status = "awaiting-repair";
        return {
          session,
          result: {
            status: "awaiting-repair",
            sessionId: session.sessionId,
            planId: packetPlan.planId,
            attempt: progress.verificationAttempts,
            commands: packetPlan.verificationCommands,
            receipts,
            failure: progress.failure
          } satisfies PhaseExecutionVerifyResult
        };
      }
      progress.status = "blocked";
      return {
        session,
        result: {
          status: "blocked",
          sessionId: session.sessionId,
          planId: packetPlan.planId,
          attempt: progress.verificationAttempts,
          commands: packetPlan.verificationCommands,
          receipts,
          failure: progress.failure
        } satisfies PhaseExecutionVerifyResult
      };
    }
  });
  return updated.result;
}

type PhaseExecutionFinalizeDependencies = {
  summaryWrite: typeof blueprintPhaseSummaryWrite;
  summaryIndex: typeof blueprintPhaseSummaryIndex;
  artifactValidate: typeof blueprintArtifactValidate;
  statePrepare: typeof prepareBlueprintStateUpdate;
  stateWrite: typeof writePreparedBlueprintStateUpdate;
  afterStage?: (
    stage: PhaseExecutionPlanProgress["persistenceStage"],
    session: PhaseExecutionSession
  ) => Promise<void> | void;
};

function hasReceiptDerivedCompletion(
  packetPlan: PhaseExecutionSession["packet"]["selectedPlans"][number],
  progress: PhaseExecutionPlanProgress
): boolean {
  const latest = progress.verificationReceipts.at(-1);
  return (
    progress.applyAttempts > 0 &&
    progress.mutationReceipts.length > 0 &&
    progress.verificationAttempts === progress.verificationReceipts.length &&
    hasPassingBoundPhaseExecutionVerification(packetPlan.verificationCommands, latest)
  );
}

function summaryModelForPlan(
  session: PhaseExecutionSession,
  packetPlan: PhaseExecutionSession["packet"]["selectedPlans"][number],
  progress: PhaseExecutionPlanProgress
): Record<string, unknown> {
  const completed = hasReceiptDerivedCompletion(packetPlan, progress);
  const phase = session.packet.selection.phaseNumber ?? String(session.prepareArgs.phase ?? "");
  const remainingPending = session.packet.selection.pendingPlanIds.filter(
    (planId) =>
      planId !== packetPlan.planId &&
      session.execution.plans[planId]?.status !== "persisted"
  );
  const nextSafeAction = completed
    ? remainingPending.length > 0
      ? `/blu-execute-phase ${phase}`
      : `/blu-validate-phase ${phase}`
    : "/blu-progress";
  const latestVerification = progress.verificationReceipts.at(-1) ?? [];
  const existingByPlan = new Map(
    session.packet.existingSummaries.map((summary) => [summary.planId, summary])
  );
  const changes = progress.mutationReceipts.map((receipt) =>
    `${receipt.operation === "delete" ? "Deleted" : "Updated"} ${receipt.path} through the Blueprint MCP execution boundary (${receipt.beforeHash ?? "missing"} -> ${receipt.afterHash ?? "missing"}).`
  );
  const failure = progress.failure ?? "Execution stopped before the selected plan reached passing verification.";

  return {
    status: completed ? "COMPLETED" : "BLOCKED",
    readiness: completed ? "ready-for-validation" : "blocked",
    completionState: completed ? "complete" : "blocked",
    outcome: completed
      ? [`Plan ${packetPlan.planId} completed with MCP-owned mutation and verification receipts.`]
      : [`Plan ${packetPlan.planId} stopped with durable execution evidence: ${failure}`],
    changesMade: changes.length > 0
      ? changes
      : [`No repository mutation was accepted for plan ${packetPlan.planId}.`],
    targetedVerification: packetPlan.verificationCommands.map((command) => {
      const receipt = latestVerification.find((candidate) => candidate.command === command);
      return {
        check: `${command} exits 0`,
        command,
        result: completed && receipt?.passed ? "pass" : "blocked",
        evidence: receipt
          ? `Exit ${receipt.exitCode ?? "none"}; stdout sha256 ${receipt.stdoutHash}; stderr sha256 ${receipt.stderrHash}.`
          : "No successful verification receipt was persisted.",
        notes: receipt?.timedOut
          ? "The bound command timed out and its process group was terminated."
          : receipt?.passed
            ? "The exact packet-bound command passed."
            : failure
      };
    }),
    dependencyPlans: packetPlan.dependsOn.map((planId) => {
      const summary = existingByPlan.get(planId);
      return {
        planId,
        path: summary?.path ?? `${session.packet.selection.phaseDir}/${session.packet.selection.phasePrefix}-${planId}-SUMMARY.md`,
        status: "satisfied",
        evidence: summary?.path
          ? `Dependency completion was bound from ${summary.path}.`
          : `Dependency plan ${planId} was satisfied by the claimed plan topology.`
      };
    }),
    manualOrDeferredWork: completed
      ? [{ item: "none", reason: "none", followUp: "none", status: "NONE" }]
      : [{
          item: `Resolve execute-phase blocker for plan ${packetPlan.planId}`,
          reason: failure,
          followUp: "/blu-progress",
          status: "MANUAL"
        }],
    gapRoutes: completed
      ? [{ gap: "none", evidence: "none", repair: "none", status: "NONE" }]
      : [{
          gap: `Plan ${packetPlan.planId} did not reach passing verification`,
          evidence: failure,
          repair: "Inspect the persisted receipts and resolve the blocker before a new claimed execution.",
          status: "BLOCKED"
        }],
    followUps: completed ? ["none"] : ["Resolve the persisted execution blocker."],
    evidence: [
      {
        kind: "artifact",
        source: packetPlan.path,
        summary: `Claimed execution authority for plan ${packetPlan.planId}.`
      },
      ...progress.mutationReceipts.map((receipt) => ({
        kind: "repo-path",
        source: receipt.path,
        summary: `MCP mutation receipt ${receipt.beforeHash ?? "missing"} -> ${receipt.afterHash ?? "missing"}.`
      })),
      ...latestVerification.map((receipt) => ({
        kind: "command",
        source: receipt.command,
        summary: `Bound verification ${receipt.passed ? "passed" : "failed"} with exit ${receipt.exitCode ?? "none"}.`
      }))
    ],
    nextSafeAction
  };
}

export type PhaseExecutionFinalizeResult = {
  status: "completed" | "blocked" | "advanced";
  sessionId: string;
  planId: string;
  summaryPath: string;
  persistenceStage: "done";
  nextPlanId: string | null;
  failure: string | null;
};

export async function blueprintPhaseExecutionFinalize(
  args: { cwd?: string; sessionId: string; planId: string },
  dependencyOverrides: Partial<PhaseExecutionFinalizeDependencies> = {}
): Promise<PhaseExecutionFinalizeResult> {
  const deps: PhaseExecutionFinalizeDependencies = {
    summaryWrite: blueprintPhaseSummaryWrite,
    summaryIndex: blueprintPhaseSummaryIndex,
    artifactValidate: blueprintArtifactValidate,
    statePrepare: prepareBlueprintStateUpdate,
    stateWrite: writePreparedBlueprintStateUpdate,
    ...dependencyOverrides
  };
  const updated = await mutatePhaseExecutionSession<PhaseExecutionFinalizeResult>({
    cwd: args.cwd,
    sessionId: args.sessionId,
    mutate: async (session, context) => {
      const { packetPlan, progress } = currentPlan(session);
      if (packetPlan.planId !== args.planId) {
        throw new Error(`Execute-phase current plan is ${packetPlan.planId}, not ${args.planId}.`);
      }
      if (
        progress.status !== "verified" &&
        progress.status !== "blocked" &&
        progress.status !== "summary-written" &&
        progress.status !== "persisted"
      ) {
        throw new Error(
          `Plan ${packetPlan.planId} cannot persist an execution summary from status ${progress.status}.`
        );
      }
      const completed = hasReceiptDerivedCompletion(packetPlan, progress);
      if (progress.status !== "blocked" && !completed) {
        throw new Error(
          `Plan ${packetPlan.planId} cannot claim COMPLETED without accepted mutation receipts and a fully passing packet-bound verification receipt.`
        );
      }
      const model = summaryModelForPlan(session, packetPlan, progress);
      const phase = session.packet.selection.phaseNumber ?? session.prepareArgs.phase;
      if (phase === null) throw new Error("Execute-phase session has no bound phase number.");
      await assertSessionAuthority(context.projectRoot, session);

      if (progress.persistenceStage === "none") {
        progress.persistenceStage = "summary-write";
        await context.checkpoint(session);
      }
      if (progress.persistenceStage === "summary-write") {
        const summary = await deps.summaryWrite({
          cwd: context.projectRoot,
          phase,
          planId: packetPlan.planId,
          model,
          authoringMode: "model-only",
          overwrite: session.packet.options.overwriteConfirmedPlanIds.includes(packetPlan.planId)
        });
        if (summary.status === "invalid" || (!summary.written && summary.status !== "reused")) {
          throw new Error(`Execute-phase summary persistence failed: ${summary.issues.join("; ")}`);
        }
        const summaryDigest = await readRepoHash(context.projectRoot, summary.path);
        progress.summaryReceipt = {
          path: summary.path,
          sha256: summaryDigest.hash,
          sizeBytes: summaryDigest.bytes,
          mode: summaryDigest.mode
        };
        progress.status = "summary-written";
        progress.persistenceStage = "summary-index";
        await context.checkpoint(session);
        await deps.afterStage?.("summary-write", session);
      }
      if (progress.persistenceStage === "summary-index") {
        await assertSessionAuthority(context.projectRoot, session);
        const index = await deps.summaryIndex({ cwd: context.projectRoot, phase });
        const saved = index.summaries.find((summary) => summary.planId === packetPlan.planId);
        if (!saved || saved.status !== (completed ? "COMPLETED" : "BLOCKED")) {
          throw new Error(`Execute-phase summary index did not project plan ${packetPlan.planId}.`);
        }
        progress.persistenceStage = "artifact-validate";
        await context.checkpoint(session);
        await deps.afterStage?.("summary-index", session);
      }
      if (progress.persistenceStage === "artifact-validate") {
        await assertSessionAuthority(context.projectRoot, session);
        const validation = await deps.artifactValidate({ cwd: context.projectRoot });
        if (!validation.valid) {
          throw new Error(`Execute-phase artifact validation failed: ${validation.issues.join("; ")}`);
        }
        progress.persistenceStage = "state-update";
        await context.checkpoint(session);
        await deps.afterStage?.("artifact-validate", session);
      }
      if (progress.persistenceStage === "state-update") {
        await assertSessionAuthority(context.projectRoot, session);
        if (progress.pendingStateUpdate === null) {
          const prepared = await deps.statePrepare({ cwd: context.projectRoot, base: "synced" });
          const observed = await readRepoHash(context.projectRoot, ".blueprint/STATE.md");
          const currentContent = observed.hash === null
            ? null
            : await fs.readFile(path.join(context.projectRoot, ".blueprint/STATE.md"), "utf8");
          if (prepared.expectedStateContent !== currentContent) {
            throw new Error("Execute-phase STATE authority changed while its deterministic update was prepared.");
          }
          const canonicalPrepared = {
            ...prepared,
            projectRoot: session.packet.repository.canonicalRoot,
            absoluteStatePath: path.join(
              session.packet.repository.canonicalRoot,
              ".blueprint/STATE.md"
            )
          };
          progress.pendingStateUpdate = {
            prepared: canonicalPrepared,
            preimage: {
              path: ".blueprint/STATE.md",
              sha256: observed.hash,
              sizeBytes: observed.hash === null ? null : observed.bytes,
              mode: observed.mode
            },
            postimage: {
              path: ".blueprint/STATE.md",
              sha256: sha256(prepared.content),
              sizeBytes: Buffer.byteLength(prepared.content),
              mode: observed.mode ?? (0o666 & ~process.umask())
            }
          };
          await context.checkpoint(session);
        }
        await assertSessionAuthority(context.projectRoot, session);
        const effect = progress.pendingStateUpdate;
        const stateBeforeWrite = await readRepoHash(context.projectRoot, ".blueprint/STATE.md");
        const matches = (digest: typeof effect.preimage) =>
          stateBeforeWrite.hash === digest.sha256 &&
          stateBeforeWrite.bytes === digest.sizeBytes &&
          stateBeforeWrite.mode === digest.mode;
        if (matches(effect.preimage)) {
          await deps.stateWrite(effect.prepared);
        } else if (!matches(effect.postimage)) {
          throw new Error(
            "Execute-phase pending STATE effect matches neither its trusted preimage nor prepared postimage."
          );
        }
        const stateDigest = await readRepoHash(context.projectRoot, ".blueprint/STATE.md");
        if (
          stateDigest.hash !== effect.postimage.sha256 ||
          stateDigest.bytes !== effect.postimage.sizeBytes ||
          stateDigest.mode !== effect.postimage.mode
        ) {
          throw new Error("Execute-phase prepared STATE postimage was not written exactly.");
        }
        const stateReceipt = {
          path: ".blueprint/STATE.md",
          sha256: stateDigest.hash,
          sizeBytes: stateDigest.bytes,
          mode: stateDigest.mode
        };
        for (const candidate of Object.values(session.execution.plans)) {
          if (candidate.persistenceStage === "done" || candidate.planId === progress.planId) {
            candidate.stateReceipt = stateReceipt;
          }
        }
        progress.pendingStateUpdate = null;
        progress.persistenceStage = "done";
        progress.status = "persisted";
        await context.checkpoint(session);
        await deps.afterStage?.("state-update", session);
      }

      await assertSessionAuthority(context.projectRoot, session);

      const summaryPath = `${session.packet.selection.phaseDir}/${session.packet.selection.phasePrefix}-${packetPlan.planId}-SUMMARY.md`;
      let nextPlanId: string | null = null;
      let status: PhaseExecutionFinalizeResult["status"];
      if (completed) {
        session.execution.currentPlanIndex += 1;
        nextPlanId = session.packet.selectedPlans[session.execution.currentPlanIndex]?.planId ?? null;
        if (nextPlanId) {
          session.status = "executing";
          status = "advanced";
        } else {
          session.status = "completed";
          status = "completed";
        }
      } else {
        session.status = "blocked";
        status = "blocked";
      }
      return {
        session,
        result: {
          status,
          sessionId: session.sessionId,
          planId: packetPlan.planId,
          summaryPath,
          persistenceStage: "done",
          nextPlanId,
          failure: completed ? null : progress.failure
        }
      };
    }
  });
  return updated.result;
}

const commonExecutionInputSchema = {
  cwd: z.string().optional(),
  sessionId: z.string().min(1),
  planId: z.string().min(1)
};

export const phaseExecutionToolDefinitions: ToolDefinition[] = [
  {
    name: "blueprint_phase_execution_prepare",
    description:
      "Preview, claim, or resume a deterministic execute-phase session bound to repository, plan, config, selection, and approval fingerprints.",
    inputSchema: {
      cwd: z.string().optional(),
      mode: z.enum(["preview", "claim", "resume"]).optional(),
      phase: z.union([z.string(), z.number()]).optional(),
      wave: z.number().int().nonnegative().optional(),
      gapsOnly: z.boolean().optional(),
      includeConflicts: z.boolean().optional(),
      externalServiceConfirmed: z.boolean().optional(),
      overwriteConfirmedPlanIds: z.array(z.string()).optional(),
      confirmation: z.string().optional(),
      previewFingerprint: z.string().optional(),
      sessionId: z.string().optional(),
      defaultsPath: z.string().optional()
    },
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseExecutionPrepare(
        args as Parameters<typeof blueprintPhaseExecutionPrepare>[0]
      )
  },
  {
    name: "blueprint_phase_execution_apply",
    description:
      "Apply one preimage-bound initial or repair mutation set through pinned MCP workers and persist exact mutation receipts.",
    inputSchema: {
      ...commonExecutionInputSchema,
      mutations: z.array(z.object({
        path: z.string().min(1),
        operation: z.enum(["write", "delete"]),
        content: z.string().optional(),
        expectedHash: z.string().nullable()
      })).min(1)
    },
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseExecutionApply(args as Parameters<typeof blueprintPhaseExecutionApply>[0])
  },
  {
    name: "blueprint_phase_execution_verify",
    description:
      "Run the exact packet-bound verification commands, persist bounded receipts, and enforce at most one repair cycle.",
    inputSchema: commonExecutionInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseExecutionVerify(args as Parameters<typeof blueprintPhaseExecutionVerify>[0])
  },
  {
    name: "blueprint_phase_execution_finalize",
    description:
      "Derive and persist the plan execution summary, validate its index and artifacts, sync STATE, and advance or terminate the durable session.",
    inputSchema: commonExecutionInputSchema,
    handler: async (args: Record<string, unknown>) =>
      blueprintPhaseExecutionFinalize(args as Parameters<typeof blueprintPhaseExecutionFinalize>[0])
  }
];
