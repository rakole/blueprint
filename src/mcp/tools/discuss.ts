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
  phaseTopologyFingerprintFromLocation,
  phaseTopologyFingerprintsMatch,
  type PhaseTopologyFingerprint,
} from "./phase-topology-lock.js";
import { artifactPathFor } from "./phase-locations.js";
import { blueprintPhaseArtifactWrite } from "./phase-artifacts.js";
import { blueprintPhaseCheckpointDelete } from "./phase-checkpoints.js";
import {
  renderPhaseContextModelContent,
  validatePhaseContextModelInput,
} from "./phase-context-model.js";
import { blueprintStateUpdate, blueprintStateLoad } from "./state.js";
import { evaluateCheckpointFreshness } from "./phase-checkpoint-freshness.js";
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
type Lookup = { cwd?: string; phase: string };
const lookupShape = { cwd: z.string().optional(), phase: z.string().min(1) };
const idSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/);
const recordInput = z.object({
  ...lookupShape,
  requestId: idSchema,
  expectedRevision: z.number().int().min(0),
  records: z.array(recordSchema).max(100).optional(),
  candidate: z.unknown().optional(),
  corrections: z
    .array(
      z.object({
        path: z.array(z.string()).min(1).max(20),
        value: z.unknown(),
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
    roadmapEntry: z.unknown(),
  }),
  basis: z.object({
    prepared: z.boolean(),
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
  const present = readSet.filter((item) => item.hash !== null);
  const result = present.length
    ? await evaluateCheckpointFreshness(root, {
        ownerCommand: "/blu-discuss-phase",
        readSet: present,
      })
    : {
        status: readSet.length ? "fresh" : "unknown",
        stalePaths: [] as string[],
        unknownPaths: [] as string[],
        warnings: [] as string[],
      };
  for (const item of readSet.filter((item) => item.hash === null))
    if ((await hashPath(root, item.path)) !== null)
      result.stalePaths.push(item.path);
  if (result.stalePaths.length) result.status = "stale";
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
    if (
      session.phase !== session.topology.phaseNumber ||
      relative !==
        `${session.topology.phaseDir}/${session.topology.phasePrefix}-DISCUSS-SESSION.json`
    )
      throw new Error("Discuss session phase/path identity mismatch.");
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
  await writeTextFile(resolveBlueprintPath(root, relative), content);
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
    expectedRevision?: number;
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
    const freshness = await basisFreshness(loc.projectRoot, args.readSet);
    if (freshness.status !== "fresh") return { status: "stale", freshness };
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
        .filter((r) => r.type === "decision")
        .map((r) => ({
          decision: `[${r.id}] ${r.value}`,
          tradeoffOrConstraint: `${r.rationale}${r.evidence.length ? ` Evidence: ${r.evidence.join("; ")}` : ""}`,
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
        r.type === "open-question" &&
        r.status !== "resolved" &&
        (r.blocking || !r.downstreamOwner),
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
        target[correction.path.at(-1)!] = checkedPayload(correction.value);
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
      const log = args.includeLog
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
export const discussToolDefinitions: ToolDefinition[] = [
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
