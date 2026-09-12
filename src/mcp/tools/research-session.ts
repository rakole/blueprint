import { promises as fs } from "node:fs";
import * as z from "zod/v4";
import { prepareTextForPersistence, safeJsonParseObject } from "../../shared/security.js";
import { ensureRepoRoot, resolveBlueprintPath, withBlueprintRepoLock, writeTextFile } from "./artifacts.js";
import { resolveLocatedPhaseForMutation } from "./phase-resolution.js";
import { PHASE_TOPOLOGY_LOCK_NAME, phaseTopologyFingerprintFromLocation, phaseTopologyFingerprintsMatch } from "./phase-topology-lock.js";
import { researchDigest, stableResearchValue } from "./research-evidence.js";

export const researchNumericPhase = z.union([z.string().regex(/^\d+(?:\.\d+)*$/), z.number().nonnegative()]);
export const researchLookup = { cwd: z.string().optional(), phase: researchNumericPhase };
export const researchRequestId = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/)
  .refine(value => !["constructor", "prototype", "__proto__"].includes(value), "Reserved request ID.");
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const readSetSchema = z.array(z.object({ path: z.string(), hash: hash.nullable() })).max(100);
const topologySchema = z.object({
  phaseNumber: z.string(), phasePrefix: z.string(), phaseName: z.string().nullable(), phaseDir: z.string(),
  roadmapEntry: z.object({ phaseNumber: z.string(), phasePrefix: z.string(), phaseName: z.string(), completed: z.boolean(), summary: z.string().nullable(), goal: z.string().nullable(), successCriteria: z.string().nullable(), requirements: z.array(z.string()) }).nullable(),
});
const receiptSchema = z.record(z.string(), z.unknown());
const journalSchema = z.object({
  requestId: researchRequestId, requestHash: hash, revision: z.number().int().min(0),
  content: z.string(), contentHash: hash, baselineHash: hash.nullable(),
  provenance: z.string(), provenanceHash: hash, baselineProvenanceHash: hash.nullable(),
  readSet: readSetSchema, reuse: z.boolean(),
  stages: z.partialRecord(z.enum(["artifact", "provenance", "state", "routing", "cleanup"]), z.enum(["intent", "complete"])),
  receipt: receiptSchema.optional(),
});
const sessionSchema = z.object({
  version: z.literal(1), phase: z.string(), topology: topologySchema, revision: z.number().int().min(0),
  prepared: z.boolean(), readSet: readSetSchema, evidencePaths: z.array(z.string()),
  baselineHash: hash.nullable(), baselineProvenanceHash: hash.nullable(),
  grounding: z.object({ requirements: z.array(z.object({ id: z.string(), description: z.string() })), lockedDecisions: z.array(z.string()), userConstraints: z.array(z.string()) }),
  candidate: z.unknown().optional(), notes: z.array(z.string()),
  history: z.array(z.object({ revision: z.number().int(), kind: z.string(), candidate: z.unknown().optional(), journal: journalSchema.optional() })),
  requests: z.record(z.string(), z.object({ hash, revision: z.number().int().min(0), operation: z.enum(["record", "submit"]), receipt: receiptSchema.optional() })),
  journal: journalSchema.optional(),
});
export type ResearchSession = Omit<z.infer<typeof sessionSchema>, "topology"> & { topology: import("./phase-topology-lock.js").PhaseTopologyFingerprint };
export type ResearchJournal = z.infer<typeof journalSchema>;
export type ResearchLocation = Awaited<ReturnType<typeof researchLocation>>;

export async function researchLocation(args: { cwd?: string; phase?: string | number }) {
  const located = await resolveLocatedPhaseForMutation(args);
  return { ...located, sessionPath: `${located.resolved.phaseDir}/${located.resolved.phasePrefix}-RESEARCH-SESSION.json` };
}

export function checkedResearchPayload(value: unknown) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined || Buffer.byteLength(serialized) > 1024 * 1024) throw new Error("Research candidate must be JSON-compatible and at most 1 MiB.");
  const inspect = (item: unknown, depth: number) => {
    if (depth > 40) throw new Error("Research candidate is too deeply nested.");
    if (typeof item === "string") prepareTextForPersistence(item, { label: "Research candidate" });
    else if (item && typeof item === "object") for (const [key, val] of Object.entries(item)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("Unsafe research candidate key.");
      prepareTextForPersistence(key, { label: "Research candidate key" });
      inspect(val, depth + 1);
    }
  };
  inspect(value, 0);
  return JSON.parse(serialized) as unknown;
}

export async function readResearchSession(loc: ResearchLocation): Promise<ResearchSession | null> {
  try {
    const session = sessionSchema.parse(safeJsonParseObject(await fs.readFile(resolveBlueprintPath(loc.projectRoot, loc.sessionPath), "utf8"), { label: loc.sessionPath, maxBytes: 32 * 1024 * 1024 }));
    if (session.phase !== loc.resolved.phaseNumber || session.topology.phaseNumber !== session.phase || session.topology.phaseDir !== loc.resolved.phaseDir || session.topology.phasePrefix !== loc.resolved.phasePrefix) throw new Error("Research session phase/path identity mismatch.");
    if (session.journal) {
      const j = session.journal;
      const request = Object.hasOwn(session.requests, j.requestId) ? session.requests[j.requestId] : undefined;
      const provenance = safeJsonParseObject(j.provenance, { label: "Research journal provenance" });
      if (!request || request.hash !== j.requestHash || j.revision > session.revision || researchDigest(j.content) !== j.contentHash || researchDigest(j.provenance) !== j.provenanceHash || provenance.researchHash !== j.contentHash || stableResearchValue(provenance.readSet) !== stableResearchValue(j.readSet)) throw new Error("Research publication journal integrity mismatch.");
    }
    return session;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function saveResearchSession(loc: ResearchLocation, session: ResearchSession) {
  sessionSchema.parse(session);
  const text = JSON.stringify(session, null, 2).replace(/[\u007f-\uffff]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`) + "\n";
  if (Buffer.byteLength(text) > 32 * 1024 * 1024) throw new Error("Research session exceeds 32 MiB; retained history must be archived through runtime maintenance.");
  await withBlueprintRepoLock(loc.projectRoot, PHASE_TOPOLOGY_LOCK_NAME, async () => {
    const current = await researchLocation({ cwd: loc.projectRoot, phase: session.phase });
    if (current.sessionPath !== loc.sessionPath || !phaseTopologyFingerprintsMatch(session.topology, phaseTopologyFingerprintFromLocation(current.resolved, current.matchedPhase))) throw new Error("Phase topology changed; refresh research preparation before saving.");
    await writeTextFile(resolveBlueprintPath(loc.projectRoot, loc.sessionPath), text);
  });
}

export async function withResearchSession<T>(args: { cwd?: string; phase?: string | number }, task: (loc: ResearchLocation) => Promise<T>) {
  const root = await ensureRepoRoot(args.cwd);
  return withBlueprintRepoLock(root, "research-session", async () => task(await researchLocation({ ...args, cwd: root })));
}

export function initialResearchSession(loc: ResearchLocation): ResearchSession {
  return { version: 1, phase: loc.resolved.phaseNumber, topology: phaseTopologyFingerprintFromLocation(loc.resolved, loc.matchedPhase), revision: 0, prepared: false, readSet: [], evidencePaths: [], baselineHash: null, baselineProvenanceHash: null, grounding: { requirements: [], lockedDecisions: [], userConstraints: [] }, notes: [], history: [], requests: {} };
}
