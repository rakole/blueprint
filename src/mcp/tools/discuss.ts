import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import * as z from "zod/v4";
import {
  prepareTextForPersistence,
  safeJsonParseObject,
  resolveRepoRelativeInputPathSync,
  validateFieldNameSegment,
} from "../../shared/security.js";
import {
  ensureRepoRoot,
  resolveBlueprintPath,
  withBlueprintRepoLock,
  writeTextFile,
  validatePhaseArtifactContent,
  isScaffoldGeneratedArtifact,
} from "./artifacts.js";
import { resolveLocatedPhaseForMutation } from "./phase-resolution.js";
import {
  PHASE_TOPOLOGY_LOCK_NAME,
  phaseTopologyFingerprintFromLocation,
  phaseTopologyFingerprintsMatch,
  type PhaseTopologyFingerprint,
} from "./phase-topology-lock.js";
import { artifactPathFor } from "./phase-locations.js";
import { blueprintPhaseArtifactWrite } from "./phase-artifacts.js";
import { blueprintPhaseCheckpointDelete } from "./phase-checkpoints.js";
import {
  phaseContextAuthoringSchema,
  renderPhaseContextModelContent,
  validatePhaseContextModelInput,
} from "./phase-context-model.js";
import { blueprintStateUpdate, blueprintStateLoad } from "./state.js";
import {
  collectDiscussEvidence,
  discussEvidenceHash,
} from "./discuss-evidence.js";
import type { ToolDefinition } from "../tool-types.js";

const recordSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/),
  type: z.enum(["decision", "open-question", "deferred"]),
  value: z.string().min(1),
  rationale: z.string().min(1),
  evidence: z.array(z.string()),
  rejectedOptions: z.array(z.string()).optional(),
  blocking: z.boolean().optional(),
  downstreamOwner: z.string().optional(),
  status: z.enum(["accepted", "open", "resolved", "deferred"]).optional(),
});
export type DiscussRecord = z.infer<typeof recordSchema>;
type Basis = {
  readSet: Array<{ path: string; hash: string | null }>;
  prepared: boolean;
  evidencePaths?: string[];
};
type Event = {
  revision: number;
  requestId: string;
  records?: DiscussRecord[];
  candidate?: unknown;
  kind: string;
  basis?: Basis;
  baseline?: DiscussSession["baseline"];
  journal?: Journal;
};
type Journal = {
  requestId: string;
  requestHash: string;
  revision: number;
  context: { path: string; hash: string; model: Record<string, unknown> };
  log?: { path: string; hash: string; content: string };
  stages: Record<string, "intent" | "complete">;
  receipt?: Record<string, unknown>;
  warnings?: string[];
};
export type DiscussSession = {
  version: 1;
  phase: string;
  topology: PhaseTopologyFingerprint;
  revision: number;
  basis: Basis;
  baseline: { context: string | null; log: string | null };
  records: DiscussRecord[];
  candidate?: unknown;
  history: Event[];
  requests: Record<string, { hash: string; revision: number }>;
  journal?: Journal;
};
type Lookup = { cwd?: string; phase: string | number };
const numericPhase = z
  .union([z.string().regex(/^\d+(?:\.\d+)*$/), z.number().nonnegative()])
  .describe("Numeric phase reference, never a directory or filename.");
const lookupShape = { cwd: z.string().optional(), phase: numericPhase };
const idSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/);
const recordInput = z.object({
  ...lookupShape,
  requestId: idSchema,
  expectedRevision: z.number().int().min(0),
  records: z.array(recordSchema).max(100).optional(),
  model: phaseContextAuthoringSchema
    .optional()
    .describe(
      "Typed canonical context. Use candidate instead to salvage incomplete or invalid drafts.",
    ),
  candidate: z
    .unknown()
    .optional()
    .describe("Lossless raw JSON salvage; saved before context schema checks."),
  corrections: z
    .array(
      z.object({
        path: z.array(z.string()).min(1).max(20),
        value: z.unknown().optional(),
        operation: z.enum(["set", "remove"]).default("set"),
      }),
    )
    .max(50)
    .optional(),
});
const finalizeInput = z.object({
  ...lookupShape,
  requestId: idSchema,
  expectedRevision: z.number().int().min(0),
  overwrite: z.boolean().optional(),
  includeLog: z.boolean().optional(),
});
const digest = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const stable = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
async function hashPath(root: string, relative: string) {
  try {
    return digest(
      await fs.readFile(resolveRepoRelativeInputPathSync(root, relative)),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
function checkedPayload(value: unknown) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined || Buffer.byteLength(serialized) > 1024 * 1024)
    throw new Error("Discuss payload must be JSON and at most 1 MiB.");
  // Reject unsafe strings before storing; JSON escaping retains exact accepted strings.
  const inspect = (item: unknown): void => {
    if (typeof item === "string")
      prepareTextForPersistence(item, { label: "Discuss payload" });
    else if (item && typeof item === "object")
      for (const [key, val] of Object.entries(item)) {
        if (["__proto__", "prototype", "constructor"].includes(key))
          throw new Error("Unsafe JSON key.");
        inspect(key);
        inspect(val);
      }
  };
  inspect(value);
  return JSON.parse(serialized) as unknown;
}
async function location(args: Lookup) {
  const found = await resolveLocatedPhaseForMutation(args);
  return {
    ...found,
    sessionPath: `${found.resolved.phaseDir}/${found.resolved.phasePrefix}-DISCUSS-SESSION.json`,
  };
}
const sessionSchema = z.object({
  version: z.literal(1),
  phase: z.string().regex(/^\d+(?:\.\d+)*$/),
  revision: z.number().int().min(0),
  topology: z.object({
    phaseNumber: z.string(),
    phasePrefix: z.string(),
    phaseName: z.string().nullable(),
    phaseDir: z.string(),
    roadmapEntry: z.object({
      phaseNumber: z.string(), phasePrefix: z.string(), phaseName: z.string(),
      completed: z.boolean(), summary: z.string().nullable(), goal: z.string().nullable(),
      successCriteria: z.string().nullable(), requirements: z.array(z.string()),
    }).nullable(),
  }),
  basis: z.object({
    prepared: z.boolean(),
    evidencePaths: z.array(z.string()).optional(),
    readSet: z.array(
      z.object({
        path: z.string(),
        hash: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .nullable(),
      }),
    ),
  }),
  baseline: z.object({
    context: z.string().nullable(),
    log: z.string().nullable(),
  }),
  records: z.array(recordSchema),
  candidate: z.unknown().optional(),
  history: z.array(
    z.object({
      revision: z.number().int(),
      requestId: z.string(),
      kind: z.string(),
      records: z.array(recordSchema).optional(),
      candidate: z.unknown().optional(),
    }),
  ),
  requests: z.record(
    z.string(),
    z.object({ hash: z.string(), revision: z.number().int() }),
  ),
  journal: z
    .object({
      requestId: z.string(),
      requestHash: z.string(),
      revision: z.number().int(),
      context: z.object({
        path: z.string(),
        hash: z.string(),
        model: z.record(z.string(), z.unknown()),
      }),
      log: z
        .object({ path: z.string(), hash: z.string(), content: z.string() })
        .optional(),
      stages: z.record(z.string(), z.enum(["intent", "complete"])),
      receipt: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});
async function basisFreshness(root: string, readSet: Basis["readSet"]) {
  const result = {
    status: readSet.length ? "fresh" : "unknown",
    stalePaths: [] as string[],
    unknownPaths: [] as string[],
    warnings: [] as string[],
  };
  await Promise.all(
    readSet.map(async (item) => {
      try {
        if ((await discussEvidenceHash(root, item.path)) !== item.hash)
          result.stalePaths.push(item.path);
      } catch {
        result.unknownPaths.push(item.path);
      }
    }),
  );
  result.stalePaths.sort();
  result.unknownPaths.sort();
  result.status = result.stalePaths.length
    ? "stale"
    : result.unknownPaths.length
      ? "unknown"
      : result.status;
  return result;
}
async function readSession(
  root: string,
  relative: string,
): Promise<DiscussSession | null> {
  try {
    const parsed = safeJsonParseObject(
      await fs.readFile(resolveBlueprintPath(root, relative), "utf8"),
      { label: relative, maxBytes: 32 * 1024 * 1024 },
    );
    sessionSchema.parse(parsed);
    const session = parsed as unknown as DiscussSession;
    const prefix = session.topology.phasePrefix;
    const sessionPathPattern = new RegExp(`^\\.blueprint/phases/${prefix.replaceAll(".", "\\.")}(?:-[^/]+)?/${prefix.replaceAll(".", "\\.")}-DISCUSS-SESSION\\.json$`);
    if (
      session.phase !== session.topology.phaseNumber ||
      !/^\d+(?:\.\d+)*$/.test(prefix) ||
      prefix.replace(/^0+(?=\d)/, "") !== session.phase ||
      !sessionPathPattern.test(relative) ||
      !sessionPathPattern.test(`${session.topology.phaseDir}/${prefix}-DISCUSS-SESSION.json`)
    )
      throw new Error("Discuss session phase/path identity mismatch.");
    const journal = session.journal;
    if (journal) {
      const receipt = session.requests[journal.requestId];
      const contextPath = `${session.topology.phaseDir}/${session.topology.phasePrefix}-CONTEXT.md`;
      const logPath = `${session.topology.phaseDir}/${session.topology.phasePrefix}-DISCUSSION-LOG.md`;
      const model = validatePhaseContextModelInput(journal.context.model).model;
      if (!model || journal.context.path !== contextPath ||
        (journal.log && journal.log.path !== logPath) ||
        journal.revision > session.revision || !receipt ||
        receipt.revision !== journal.revision || receipt.hash !== journal.requestHash ||
        Object.keys(journal.stages).some((stage) => !["context", "log", "state", "refresh", "cleanup"].includes(stage)) ||
        digest(prepareTextForPersistence(renderPhaseContextModelContent({ resolved: { phasePrefix: session.topology.phasePrefix, phaseName: session.topology.phaseName ?? "" }, model })).content.replace(/\r\n/g, "\n")) !== journal.context.hash ||
        (journal.log && digest(journal.log.content) !== journal.log.hash))
        throw new Error("Discuss publication journal identity or integrity mismatch.");
    }
    return parsed as unknown as DiscussSession;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
async function save(root: string, relative: string, session: DiscussSession) {
  // Escape non-ASCII code units so prompt sanitization cannot alter accepted raw JSON strings.
  const content =
    JSON.stringify(session, null, 2).replace(
      /[\u007f-\uffff]/g,
      (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
    ) + "\n";
  if (Buffer.byteLength(content) > 32 * 1024 * 1024)
    throw new Error(
      "Discuss session exceeds 32 MiB; preserve history and start a new phase session through runtime maintenance.",
    );
  await withBlueprintRepoLock(root, PHASE_TOPOLOGY_LOCK_NAME, async () => {
    const current = await location({ cwd: root, phase: session.phase });
    if (current.sessionPath !== relative || !phaseTopologyFingerprintsMatch(
      session.topology, phaseTopologyFingerprintFromLocation(current.resolved, current.matchedPhase),
    )) throw new Error("Phase topology changed; prepare with explicit reconciliation before saving.");
    await writeTextFile(resolveBlueprintPath(root, relative), content);
  });
}
async function locked<T>(
  args: Lookup,
  task: (loc: Awaited<ReturnType<typeof location>>) => Promise<T>,
) {
  const root = await ensureRepoRoot(args.cwd);
  return withBlueprintRepoLock(root, "discuss-session", async () =>
    task(await location({ ...args, cwd: root })),
  );
}
async function initial(
  loc: Awaited<ReturnType<typeof location>>,
): Promise<DiscussSession> {
  return {
    version: 1,
    phase: loc.resolved.phaseNumber,
    topology: phaseTopologyFingerprintFromLocation(
      loc.resolved,
      loc.matchedPhase,
    ),
    revision: 0,
    basis: { prepared: false, readSet: [] },
    baseline: {
      context: await hashPath(
        loc.projectRoot,
        artifactPathFor(loc.resolved, "context"),
      ),
      log: await hashPath(
        loc.projectRoot,
        artifactPathFor(loc.resolved, "discussion-log"),
      ),
    },
    records: [],
    history: [],
    requests: {},
  };
}
/** Runtime-only prepare hook. Call only after resolving/reading the authoritative input packet.
 * No model-facing flag can assert freshness. Changed evidence requires a new prepare packet. */
export async function prepareDiscussInputBasis(
  args: Lookup & {
    readSet: Array<{ path: string; hash: string | null }>;
    evidencePaths?: string[];
    expectedRevision?: number;
    acknowledgeChangedInputs?: boolean;
    targetHashes?: { context: string | null; log: string | null };
    reconcile?: {
      confirmed: true;
      contextHash: string | null;
      logHash: string | null;
    };
  },
) {
  return locked(args, async (loc) => {
    const session =
      (await readSession(loc.projectRoot, loc.sessionPath)) ??
      (await initial(loc));
    if (
      args.expectedRevision !== undefined &&
      session.revision !== args.expectedRevision
    )
      throw new Error("Discuss revision conflict.");
    if (args.targetHashes) {
      const actual = {
        context: await hashPath(
          loc.projectRoot,
          artifactPathFor(loc.resolved, "context"),
        ),
        log: await hashPath(
          loc.projectRoot,
          artifactPathFor(loc.resolved, "discussion-log"),
        ),
      };
      if (
        actual.context !== args.targetHashes.context ||
        actual.log !== args.targetHashes.log
      )
        return {
          status: "stale",
          reason: "Canonical targets changed while preparing; retry.",
        };
      if (
        !args.reconcile &&
        (actual.context !== session.baseline.context ||
          actual.log !== session.baseline.log)
      )
        return {
          status: "reconciliation_required",
          revision: session.revision,
          reason:
            "Canonical targets changed; review packet and explicitly reconcile target hashes.",
          affectedRecordIds: session.records.map((r) => r.id),
        };
    }
    const freshness = await basisFreshness(loc.projectRoot, args.readSet);
    if (freshness.status !== "fresh") return { status: "stale", freshness };
    const changedPaths = [
      ...new Set([
        ...session.basis.readSet.map((i) => i.path),
        ...args.readSet.map((i) => i.path),
      ]),
    ].filter(
      (path) =>
        session.basis.readSet.find((i) => i.path === path)?.hash !==
        args.readSet.find((i) => i.path === path)?.hash,
    );
    if (
      session.basis.prepared &&
      changedPaths.length &&
      !args.acknowledgeChangedInputs
    )
      return {
        status: "reconciliation_required",
        revision: session.revision,
        changedPaths,
        affectedRecordIds: session.records.map((r) => r.id),
        candidateNeedsReview: session.candidate !== undefined,
        nextAction:
          "Review affected records and candidate against this packet, save corrections, then prepare with expectedRevision and acknowledgeChangedInputs=true.",
      };
    if (args.acknowledgeChangedInputs && args.expectedRevision === undefined)
      throw new Error("Input acknowledgment requires expectedRevision.");
    if (session.basis.prepared && !changedPaths.length && !args.reconcile)
      return {
        status: "prepared",
        revision: session.revision,
        path: loc.sessionPath,
        reused: true,
      };
    if (args.reconcile) {
      if (
        args.expectedRevision === undefined ||
        args.reconcile.confirmed !== true
      )
        throw new Error(
          "Reconciliation requires an expected revision and explicit confirmation.",
        );
      const actual = {
        context: await hashPath(
          loc.projectRoot,
          artifactPathFor(loc.resolved, "context"),
        ),
        log: await hashPath(
          loc.projectRoot,
          artifactPathFor(loc.resolved, "discussion-log"),
        ),
      };
      if (
        actual.context !== args.reconcile.contextHash ||
        actual.log !== args.reconcile.logHash
      )
        return {
          status: "stale",
          reason:
            "Reconciliation target hashes changed; review current targets again.",
        };
      session.history.push({
        revision: session.revision + 1,
        requestId: `reconcile-${session.revision + 1}`,
        kind: "reconciliation",
        basis: session.basis,
        baseline: session.baseline,
        journal: session.journal,
      });
      session.baseline = actual;
      session.topology = phaseTopologyFingerprintFromLocation(
        loc.resolved,
        loc.matchedPhase,
      );
      delete session.journal;
    } else if (session.journal && !session.journal.receipt)
      return {
        status: "blocked",
        nextAction:
          "Retry blueprint_discuss_finalize with the existing requestId, or use blueprint_discuss_prepare with explicit target reconciliation.",
      };
    if (args.readSet.some((item) => /(?:^|\/)STATE\.md$/.test(item.path)))
      throw new Error(
        "Mutable STATE.md must not be included in discuss evidence basis.",
      );
    session.basis = {
      prepared: true,
      readSet: checkedPayload(args.readSet) as Basis["readSet"],
      evidencePaths: args.evidencePaths ?? session.basis.evidencePaths,
    };
    session.revision++;
    session.history.push({
      revision: session.revision,
      requestId: `prepare-${session.revision}`,
      kind: "input-basis",
      basis: session.basis,
      baseline: session.baseline,
    });
    await save(loc.projectRoot, loc.sessionPath, session);
    return {
      status: "prepared",
      revision: session.revision,
      path: loc.sessionPath,
    };
  });
}
function assemble(session: DiscussSession): unknown {
  const candidate = structuredClone(session.candidate);
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
    return candidate;
  const model = candidate as Record<string, unknown>;
  if (session.records.length) {
    const ids = new Set(session.records.map((r) => r.id));
    const isOwned = (text: unknown) =>
      typeof text === "string" &&
      [...ids].some((id) => text.startsWith(`[${id}] `));
    const decisions = Array.isArray(model.implementationDecisions)
      ? model.implementationDecisions
      : [];
    model.implementationDecisions = [
      ...decisions.filter((item) => !isOwned(item?.decision ?? "")),
      ...session.records
        .filter(
          (r) =>
            r.type === "decision" ||
            (r.type === "open-question" && r.status === "resolved"),
        )
        .map((r) => ({
          decision: `[${r.id}] ${r.value}`,
          tradeoffOrConstraint: `${r.rationale}${r.evidence.length ? ` Evidence: ${r.evidence.join("; ")}` : ""}${r.rejectedOptions?.length ? ` Rejected options: ${r.rejectedOptions.join("; ")}` : ""}`,
        })),
    ];
    for (const [field, type] of [
      ["openQuestions", "open-question"],
      ["deferredIdeas", "deferred"],
    ] as const) {
      const existing = Array.isArray(model[field])
        ? (model[field] as unknown[])
        : [];
      model[field] = [
        ...existing.filter(
          (item) =>
            typeof item !== "string" ||
            (!isOwned(item) && item.toLowerCase() !== "none"),
        ),
        ...session.records
          .filter((r) => r.type === type && r.status !== "resolved")
          .map(
            (r) =>
              `[${r.id}] ${r.value}; Rationale: ${r.rationale}${r.downstreamOwner ? ` (Owner: ${r.downstreamOwner})` : ""}${r.evidence.length ? ` Evidence: ${r.evidence.join("; ")}` : ""}`,
          ),
      ];
    }
  }
  return model;
}
function assess(
  session: DiscussSession,
  resolved: Awaited<ReturnType<typeof location>>["resolved"],
) {
  const model = assemble(session);
  const shape = validatePhaseContextModelInput(model);
  const blockers = session.records
    .filter(
      (r) =>
        (r.type === "open-question" &&
          r.status !== "resolved" &&
          (r.blocking || !r.downstreamOwner)) ||
        (r.type === "decision" &&
          (r.blocking || r.status === "open" || r.status === "deferred")),
    )
    .map((r) => r.id);
  if (!shape.model)
    return {
      ready: false,
      blockers,
      validation: shape.validation,
      model: null,
      content: null,
    };
  const content = renderPhaseContextModelContent({
    resolved,
    model: shape.model,
  });
  const validation = validatePhaseArtifactContent(content, "context");
  return {
    ready: validation.valid && !blockers.length,
    blockers,
    validation,
    model: shape.model,
    content,
  };
}
function compactReadiness(assessment: ReturnType<typeof assess>) {
  return {
    ready: assessment.ready,
    blockers: assessment.blockers,
    validation: assessment.validation,
  };
}
export async function blueprintDiscussRecord(raw: z.input<typeof recordInput>) {
  const args = recordInput.parse(raw);
  checkedPayload(args);
  return locked(args, async (loc) => {
    const session =
      (await readSession(loc.projectRoot, loc.sessionPath)) ??
      (await initial(loc));
    if (args.model !== undefined) {
      if (args.candidate !== undefined || args.corrections?.length)
        throw new Error(
          "Pass model, candidate, or corrections, not multiple authoring inputs.",
        );
      args.candidate = args.model;
    }
    const requestHash = digest(stable(args));
    const replay = Object.hasOwn(session.requests, args.requestId)
      ? session.requests[args.requestId]
      : undefined;
    if (replay) {
      if (replay.hash !== requestHash)
        return {
          status: "rejected",
          reason: "Request ID conflict",
          revision: session.revision,
        };
      return {
        status: "reused",
        revision: replay.revision,
        currentRevision: session.revision,
        path: loc.sessionPath,
      };
    }
    if (session.revision !== args.expectedRevision)
      return {
        status: "stale",
        reason: "Revision conflict",
        revision: session.revision,
      };
    if (session.journal && !session.journal.receipt)
      return {
        status: "blocked",
        nextAction:
          "Retry blueprint_discuss_finalize with the existing requestId before recording more answers.",
      };
    if (args.candidate !== undefined && args.corrections?.length)
      throw new Error("Pass candidate or field corrections, not both.");
    if (args.candidate !== undefined)
      session.candidate = checkedPayload(args.candidate);
    if (args.corrections?.length) {
      for (const correction of args.corrections) {
        correction.path.forEach((segment) => {
          validateFieldNameSegment(segment);
          if (["__proto__", "prototype", "constructor"].includes(segment))
            throw new Error("Unsafe correction path.");
        });
        let target = session.candidate as Record<string, unknown>;
        for (const segment of correction.path.slice(0, -1)) {
          if (
            !target ||
            typeof target !== "object" ||
            !Object.hasOwn(target, segment)
          )
            throw new Error("Correction parent does not exist.");
          target = target[segment] as Record<string, unknown>;
        }
        if (!target || typeof target !== "object")
          throw new Error("Correction target is not an object.");
        const field = correction.path.at(-1)!;
        if (correction.operation === "remove") {
          if (Array.isArray(target)) {
            if (!/^(?:0|[1-9]\d*)$/.test(field))
              throw new Error("Array correction requires an index.");
            target.splice(Number(field), 1);
          } else delete target[field];
        } else target[field] = checkedPayload(correction.value);
      }
    }
    for (const record of args.records ?? []) {
      const index = session.records.findIndex((r) => r.id === record.id);
      if (index === -1) session.records.push(record);
      else session.records[index] = record;
    }
    session.revision++;
    session.history.push({
      revision: session.revision,
      requestId: args.requestId,
      kind: "record",
      records: args.records,
      ...(args.candidate !== undefined || args.corrections?.length
        ? { candidate: session.candidate }
        : {}),
    });
    session.requests[args.requestId] = {
      hash: requestHash,
      revision: session.revision,
    };
    // Receipt is durable before readiness/schema evaluation; invalid drafts survive new processes.
    await save(loc.projectRoot, loc.sessionPath, session);
    const assessment = assess(session, loc.resolved);
    return {
      status: "recorded",
      revision: session.revision,
      path: loc.sessionPath,
      candidateSaved: session.candidate !== undefined,
      readiness: compactReadiness(assessment),
      nextAction: assessment.ready
        ? "Call blueprint_discuss_finalize after preparing fresh inputs."
        : "Repair fields or resolve blocking questions using blueprint_discuss_record.",
    };
  });
}
export async function blueprintDiscussRead(args: Lookup) {
  z.object(lookupShape).parse(args);
  return locked(args, async (loc) => {
    const session = await readSession(loc.projectRoot, loc.sessionPath);
    return {
      status: session ? "found" : "not_found",
      path: loc.sessionPath,
      session,
      readiness: session
        ? compactReadiness(assess(session, loc.resolved))
        : null,
    };
  });
}
function renderLog(session: DiscussSession, prefix: string) {
  return `# Phase ${prefix} Discussion Log\n\n## Summary\n\n${session.records.length} durable records; revision ${session.revision}.\n\n## Notes\n\n${
    session.history
      .filter((e) => e.records?.length)
      .flatMap((e) =>
        e.records!.map(
          (r) =>
            `- Revision ${e.revision} [${r.id}] (${r.type}): ${r.value}\n  Rationale: ${r.rationale}\n  Evidence: ${r.evidence.join("; ") || "Not supplied"}${r.rejectedOptions?.length ? `\n  Rejected options: ${r.rejectedOptions.join("; ")}` : ""}`,
        ),
      )
      .join("\n") ||
    "No incremental answers recorded; candidate context supplied."
  }\n\n## Follow-Ups\n\n${
    session.records
      .filter((r) => r.type !== "decision" && r.status !== "resolved")
      .map(
        (r) =>
          `- [${r.id}] ${r.value}${r.downstreamOwner ? ` — ${r.downstreamOwner}` : ""}`,
      )
      .join("\n") || "- none"
  }\n`;
}
export const discussFinalizeDependencies = {
  artifactWrite: blueprintPhaseArtifactWrite,
  stateUpdate: blueprintStateUpdate,
  stateLoad: blueprintStateLoad,
  checkpointDelete: blueprintPhaseCheckpointDelete,
};
export async function blueprintDiscussFinalize(
  raw: z.input<typeof finalizeInput>,
) {
  const args = finalizeInput.parse(raw);
  return locked(args, async (loc) => {
    const session = await readSession(loc.projectRoot, loc.sessionPath);
    if (!session)
      return {
        status: "not_found",
        nextAction: "Call blueprint_discuss_record.",
      };
    const requestHash = digest(stable(args));
    let journal = session.journal;
    if (
      journal?.requestId === args.requestId &&
      journal.requestHash !== requestHash
    )
      return { status: "rejected", reason: "Request ID conflict" };
    if (journal?.requestId === args.requestId && journal.receipt)
      return { ...journal.receipt, status: "reused" };
    if (journal && journal.requestId !== args.requestId && !journal.receipt)
      return {
        status: "blocked",
        nextAction: `Retry blueprint_discuss_finalize requestId ${journal.requestId}.`,
      };
    if (!journal || journal.requestId !== args.requestId) {
      if (Object.hasOwn(session.requests, args.requestId))
        return { status: "rejected", reason: "Request ID already used" };
      if (session.revision !== args.expectedRevision)
        return {
          status: "stale",
          reason: "Revision conflict",
          revision: session.revision,
        };
      if (
        !phaseTopologyFingerprintsMatch(
          session.topology,
          phaseTopologyFingerprintFromLocation(loc.resolved, loc.matchedPhase),
        )
      )
        return {
          status: "stale",
          reason: "Phase topology changed",
          nextAction:
            "Run blueprint_discuss_prepare with explicit target reconciliation.",
        };
      const assessment = assess(session, loc.resolved);
      if (!assessment.ready || !assessment.model || !assessment.content)
        return {
          status: "blocked",
          draftPersisted: true,
          readiness: compactReadiness(assessment),
          nextAction:
            "Repair the saved candidate or blocking records using blueprint_discuss_record.",
        };
      const freshness = await basisFreshness(
        loc.projectRoot,
        session.basis.readSet,
      );
      if (!session.basis.prepared || freshness.status !== "fresh")
        return {
          status: "stale",
          draftPersisted: true,
          freshness,
          nextAction:
            "Run blueprint_discuss_prepare to refresh the authoritative input packet and reconcile affected decisions.",
        };
      const content = prepareTextForPersistence(
        assessment.content,
      ).content.replace(/\r\n/g, "\n");
      const logNeeded =
        args.includeLog ??
        (session.records.length > 1 ||
          session.records.some((r) => r.rejectedOptions?.length) ||
          session.history.filter((e) => e.kind === "record").length > 1);
      const log = logNeeded
        ? prepareTextForPersistence(
            renderLog(session, loc.resolved.phasePrefix),
          ).content.replace(/\r\n/g, "\n")
        : undefined;
      for (const kind of ["context", ...(log ? ["log"] : [])] as Array<
        "context" | "log"
      >) {
        const target = artifactPathFor(
          loc.resolved,
          kind === "context" ? "context" : "discussion-log",
        );
        const observed = await hashPath(loc.projectRoot, target);
        if (observed !== session.baseline[kind])
          return {
            status: "stale",
            reason: `Stale ${kind} baseline`,
            nextAction:
              "Run blueprint_discuss_prepare with explicit target reconciliation after reviewing changed canonical artifacts; the saved draft remains editable.",
          };
        if (observed && !args.overwrite) {
          const existing = await fs.readFile(
            resolveBlueprintPath(loc.projectRoot, target),
            "utf8",
          );
          if (
            !isScaffoldGeneratedArtifact(existing) &&
            digest(kind === "context" ? content : log!) !== observed
          )
            return {
              status: "blocked",
              reason: `Explicit overwrite confirmation required for ${target}`,
              nextAction:
                "Obtain explicit overwrite confirmation, then retry with overwrite=true.",
            };
        }
      }
      if (log && !validatePhaseArtifactContent(log, "discussion-log").valid)
        return {
          status: "blocked",
          reason: "Generated discussion log failed validation",
          nextAction: "Repair saved records before retrying.",
        };
      journal = {
        requestId: args.requestId,
        requestHash,
        revision: session.revision,
        context: {
          path: artifactPathFor(loc.resolved, "context"),
          hash: digest(content),
          model: assessment.model,
        },
        ...(log
          ? {
              log: {
                path: artifactPathFor(loc.resolved, "discussion-log"),
                content: log,
                hash: digest(log),
              },
            }
          : {}),
        stages: {},
      };
      session.journal = journal;
      session.requests[args.requestId] = {
        hash: requestHash,
        revision: session.revision,
      };
      await save(loc.projectRoot, loc.sessionPath, session);
    }
    const checkpoint = async () =>
      save(loc.projectRoot, loc.sessionPath, session);
    const assertTopology = async () => {
      const current = await location(args);
      if (
        !phaseTopologyFingerprintsMatch(
          session.topology,
          phaseTopologyFingerprintFromLocation(
            current.resolved,
            current.matchedPhase,
          ),
        )
      )
        throw new Error(
          "Phase topology changed; preserve publication and reconcile before retry.",
        );
    };
    try {
      await assertTopology();
      const freshness = await basisFreshness(loc.projectRoot, session.basis.readSet);
      if (!session.basis.prepared || freshness.status !== "fresh")
        throw new Error("Discussion evidence changed or is unknown; run blueprint_discuss_prepare with explicit target reconciliation and review changed inputs.");
      for (const kind of ["context", "log"] as const) {
        const item = journal[kind];
        if (!item) continue;
        const observed = await hashPath(loc.projectRoot, item.path);
        if (journal.stages[kind]) {
          if (observed === item.hash) {
            journal.stages[kind] = "complete";
            await checkpoint();
            continue;
          }
          if (journal.stages[kind] === "complete")
            throw new Error(
              `Published ${kind} changed externally; preserve it and reconcile manually.`,
            );
        }
        if (observed !== session.baseline[kind])
          throw new Error(
            `Stale ${kind} baseline; preserve canonical content and reconcile through a new prepared session.`,
          );
        journal.stages[kind] = "intent";
        await checkpoint();
        await assertTopology();
        const result = await discussFinalizeDependencies.artifactWrite({
          cwd: loc.projectRoot,
          phase: session.phase,
          artifact: kind === "log" ? "discussion-log" : "context",
          ...(kind === "context"
            ? { model: journal.context.model }
            : { content: journal.log!.content }),
          overwrite: args.overwrite,
          expectedContentHash: session.baseline[kind],
          expectedTopology: session.topology,
        });
        if (result.status === "invalid")
          throw new Error(`Canonical ${kind} validation rejected publication.`);
        if ((await hashPath(loc.projectRoot, item.path)) !== item.hash)
          throw new Error(
            `Published ${kind} bytes differ from journal intent.`,
          );
        journal.stages[kind] = "complete";
        await checkpoint();
      }
      if (journal.stages.state !== "complete") {
        journal.stages.state = "intent";
        await checkpoint();
        await assertTopology();
        const stateUpdate = await discussFinalizeDependencies.stateUpdate({
          cwd: loc.projectRoot,
          base: "synced",
          patch: {
            currentPhase: session.phase,
            activeCommand: "/blu-discuss-phase",
          },
        });
        journal.warnings = [
          ...(journal.warnings ?? []),
          ...stateUpdate.warnings,
        ];
        journal.stages.state = "complete";
        await checkpoint();
      }
      journal.stages.refresh = "intent";
      await checkpoint();
      const state = await discussFinalizeDependencies.stateLoad({
        cwd: loc.projectRoot,
      });
      journal.stages.refresh = "complete";
      await checkpoint();
      const warnings: string[] = [
        ...(journal.warnings ?? []),
        ...(state.warnings ?? []),
      ];
      if (journal.stages.cleanup !== "complete") {
        journal.stages.cleanup = "intent";
        await checkpoint();
        const cleanup = await discussFinalizeDependencies.checkpointDelete({
          cwd: loc.projectRoot,
          phase: session.phase,
          expectedTopology: session.topology,
          expectedOwnerCommand: "/blu-discuss-phase",
          expectedMode: "discuss",
        });
        if (!cleanup.deleted && cleanup.reason) warnings.push(cleanup.reason);
        journal.stages.cleanup = "complete";
        await checkpoint();
      }
      journal.receipt = {
        status: "finalized",
        revision: session.revision,
        path: loc.sessionPath,
        stages: { ...journal.stages },
        contextPath: journal.context.path,
        logPath: journal.log?.path ?? null,
        coveredRecordIds: session.records.map((r) => r.id),
        state,
        warnings,
        nextAction: state.derivedStatus.nextAction,
      };
      session.baseline = {
        context: journal.context.hash,
        log: journal.log?.hash ?? session.baseline.log,
      };
      await checkpoint();
      return journal.receipt;
    } catch (error) {
      return {
        status: "partial",
        draftPersisted: true,
        revision: session.revision,
        stages: journal.stages,
        reason: (error as Error).message,
        nextAction: `Retry blueprint_discuss_finalize with the same requestId ${args.requestId} and identical arguments after resolving the reported failure. If canonical targets or topology changed, use blueprint_discuss_prepare with explicit target reconciliation.`,
      };
    }
  });
}
const prepareInput = z.object({
  cwd: z.string().optional(),
  phase: numericPhase.optional(),
  evidencePaths: z.array(z.string().min(1)).max(20).optional(),
  expectedRevision: z.number().int().min(0).optional(),
  acknowledgeChangedInputs: z.boolean().optional(),
  reconcile: z
    .object({
      confirmed: z.literal(true),
      contextHash: z.string().nullable(),
      logHash: z.string().nullable(),
    })
    .optional(),
});
export async function blueprintDiscussPrepare(
  raw: z.input<typeof prepareInput>,
) {
  const args = prepareInput.parse(raw);
  let evidencePaths = args.evidencePaths;
  const evidence = await collectDiscussEvidence({ ...args,
    resolveEvidencePaths: async (root, relative) => {
      if (evidencePaths === undefined) {
        const prior = await readSession(root, relative);
        evidencePaths = prior?.basis.evidencePaths ?? [];
      }
      return evidencePaths;
    },
  });
  if (evidence.status !== "collected") return evidence;
  const result = await prepareDiscussInputBasis({
    ...args,
    cwd: evidence.root,
    phase: evidence.phase,
    readSet: evidence.readSet,
    evidencePaths,
    targetHashes: {
      context: evidence.packet.artifacts.context.hash,
      log: evidence.packet.artifacts.log.hash,
    },
  });
  const saved = await blueprintDiscussRead({
    cwd: evidence.root,
    phase: evidence.phase,
  });
  return {
    ...result,
    packet: evidence.packet,
    readSet: evidence.readSet,
    session: saved.session
      ? {
          revision: saved.session.revision,
          records: saved.session.records,
          candidateAvailable: saved.session.candidate !== undefined,
          readiness: saved.readiness,
          publication: saved.session.journal
            ? {
                requestId: saved.session.journal.requestId,
                stages: saved.session.journal.stages,
                receipt: saved.session.journal.receipt,
              }
            : null,
        }
      : null,
  };
}
export const discussToolDefinitions: ToolDefinition[] = [
  {
    name: "blueprint_discuss_prepare",
    description:
      "Resolve and prepare one evidence packet; bind durable session freshness. Missing planned phase directories are scaffolded. Reconcile changed inputs explicitly before publication.",
    inputSchema: prepareInput.shape,
    handler: (args) =>
      blueprintDiscussPrepare(args as z.input<typeof prepareInput>),
  },
  {
    name: "blueprint_discuss_record",
    description:
      "Append durable discussion records and losslessly save a raw candidate before schema/readiness checks. Repair fields with revision CAS; request IDs are idempotent.",
    inputSchema: recordInput.shape,
    handler: (args) =>
      blueprintDiscussRecord(args as z.input<typeof recordInput>),
  },
  {
    name: "blueprint_discuss_read",
    description:
      "Read the complete versioned discussion session, exact saved candidate, decision history and publication journal.",
    inputSchema: lookupShape,
    handler: (args) => blueprintDiscussRead(args as Lookup),
  },
  {
    name: "blueprint_discuss_finalize",
    description:
      "Publish a valid saved candidate and record-derived context/log with stale-target checks and recoverable state synchronization. overwrite requires explicit user confirmation.",
    inputSchema: finalizeInput.shape,
    handler: (args) =>
      blueprintDiscussFinalize(args as z.input<typeof finalizeInput>),
  },
];
