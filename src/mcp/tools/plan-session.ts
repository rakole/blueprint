import { promises as fs } from "node:fs";
import * as z from "zod/v4";
import { safeJsonParseObject } from "../../shared/security.js";
import { ensureRepoRoot, resolveBlueprintPath, withBlueprintRepoLock, writeTextFile } from "./artifacts.js";
import { resolveLocatedPhaseForMutation } from "./phase-resolution.js";
import { PHASE_TOPOLOGY_LOCK_NAME, phaseTopologyFingerprintFromLocation, type PhaseTopologyFingerprint } from "./phase-topology-lock.js";
import { checkedResearchPayload, researchNumericPhase, researchRequestId } from "./research-session.js";
import { researchDigest, stableResearchValue, type ResearchReadSet } from "./research-evidence.js";

export const planNumericPhase = researchNumericPhase;
export const planRequestId = researchRequestId;
export const planLookup = { cwd: z.string().optional(), phase: planNumericPhase };
export const checkedPlanPayload = checkedResearchPayload;
export type PlanMode = "add" | "revise" | "replace";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const receipt = z.record(z.string(), z.unknown());
const targetSchema = z.object({ path: z.string(), hash: hash.nullable() });
const journalSchema = z.object({
  requestId: planRequestId, requestHash: hash, revision: z.number().int().nonnegative(), candidateHash: hash,
  baselineMarker: z.string().nullable(),
  review: z.object({ revision: z.number().int(), candidateHash: hash, verdict: z.enum(["accept", "revise"]), summary: z.string() }).optional(),
  files: z.array(z.object({ planId: z.string(), title: z.string(), wave: z.number().int().positive(), taskCount: z.number().int().positive(), path: z.string(), hash, content: z.string(), baselineHash: hash.nullable(), backup: z.string().nullable() })),
  removed: z.array(z.object({ path: z.string(), baselineHash: hash, backup: z.string() })),
  stages: z.partialRecord(z.enum(["files", "commit", "state", "routing"]), z.enum(["intent", "complete"])),
  receipt: receipt.optional(),
});
const schema = z.object({
  version: z.literal(1), phase: z.string(), topology: z.custom<PhaseTopologyFingerprint>(value => Boolean(value && typeof value === "object" && "phaseDir" in value)),
  revision: z.number().int().nonnegative(), prepared: z.boolean(), needsIntent: z.boolean().default(false), mode: z.enum(["add", "revise", "replace"]), targetPlanIds: z.array(z.string()),
  readSet: z.array(targetSchema).max(300), evidencePaths: z.array(z.string()), targets: z.array(targetSchema),
  existingPlans: z.array(z.object({ planId: z.string(), wave: z.number(), dependsOn: z.array(z.string()), requirements: z.array(z.string()) })),
  knownRequirements: z.array(z.string()), knownEvidenceArtifacts: z.array(z.string()), checkerRequired: z.boolean(),
  candidate: z.unknown().optional(), candidateHash: hash.nullable(),
  history: z.array(z.object({ revision: z.number().int(), kind: z.string(), candidate: z.unknown().optional(), readSet: z.array(targetSchema).optional(), targets: z.array(targetSchema).optional(), journal: journalSchema.optional() })),
  requests: z.record(z.string(), z.object({ hash, operation: z.enum(["submit", "finalize"]), revision: z.number().int(), receipt: receipt.optional() })),
  journal: journalSchema.optional(),
});
export type PlanSession = z.infer<typeof schema>;
export type PlanJournal = z.infer<typeof journalSchema>;
export type PlanLocation = Awaited<ReturnType<typeof planLocation>>;

export function planPublicationPath(phaseDir: string, phasePrefix: string) {
  return `${phaseDir}/${phasePrefix}-PLAN-PUBLICATION.json`;
}

export { readPlanPublicationStatus } from "./plan-publication.js";

export async function planLocation(args: { cwd?: string; phase?: string | number }) {
  const located = await resolveLocatedPhaseForMutation(args);
  return { ...located, sessionPath: `${located.resolved.phaseDir}/${located.resolved.phasePrefix}-PLAN-SESSION.json` };
}

export async function readPlanSession(loc: PlanLocation): Promise<PlanSession | null> {
  try {
    const session = schema.parse(safeJsonParseObject(await fs.readFile(resolveBlueprintPath(loc.projectRoot, loc.sessionPath), "utf8"), { label: loc.sessionPath, maxBytes: 32 * 1024 * 1024 }));
    if (session.phase !== loc.resolved.phaseNumber || session.topology.phaseDir !== loc.resolved.phaseDir || session.topology.phasePrefix !== loc.resolved.phasePrefix) throw new Error("Planning session identity mismatch.");
    if (session.candidateHash !== (session.candidate === undefined ? null : researchDigest(stableResearchValue(session.candidate)))) throw new Error("Planning candidate integrity mismatch.");
    const validPlanPath = (value: string) => value.startsWith(`${loc.resolved.phaseDir}/${loc.resolved.phasePrefix}-`) && /^\d+-PLAN\.md$/.test(value.slice(`${loc.resolved.phaseDir}/${loc.resolved.phasePrefix}-`.length));
    if (session.targets.some(item => !validPlanPath(item.path))) throw new Error("Invalid planning target path.");
    if (session.journal) {
      const j = session.journal;
      const request = Object.hasOwn(session.requests, j.requestId) ? session.requests[j.requestId] : undefined;
      if (!request || request.hash !== j.requestHash || j.revision !== session.revision || j.candidateHash !== session.candidateHash || j.files.some(file => !validPlanPath(file.path) || researchDigest(file.content) !== file.hash || (file.backup === null ? null : researchDigest(file.backup)) !== file.baselineHash) || j.removed.some(file => !validPlanPath(file.path) || researchDigest(file.backup) !== file.baselineHash)) throw new Error("Planning publication journal integrity mismatch.");
    }
    return session;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function savePlanSession(loc: PlanLocation, session: PlanSession, topologyLockHeld = false) {
  schema.parse(session);
  const text = JSON.stringify(session, null, 2).replace(/[\u007f-\uffff]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`) + "\n";
  if (Buffer.byteLength(text) > 32 * 1024 * 1024) throw new Error("Planning session exceeds 32 MiB; archive retained history through runtime maintenance.");
  const write = async () => {
    const current = await planLocation({ cwd: loc.projectRoot, phase: session.phase });
    // Stale evidence must not prevent salvaging a received candidate. Publication
    // separately checks the stored topology; session writes only require identity.
    if (current.sessionPath !== loc.sessionPath || current.resolved.phaseNumber !== session.phase) throw new Error("Phase storage identity changed; recover the previous planning session before saving.");
    await writeTextFile(resolveBlueprintPath(loc.projectRoot, loc.sessionPath), text);
  };
  return topologyLockHeld ? write() : withBlueprintRepoLock(loc.projectRoot, PHASE_TOPOLOGY_LOCK_NAME, write);
}

export async function withPlanSession<T>(args: { cwd?: string; phase?: string | number }, task: (loc: PlanLocation) => Promise<T>) {
  const root = await ensureRepoRoot(args.cwd);
  return withBlueprintRepoLock(root, "plan-session", async () => task(await planLocation({ ...args, cwd: root })));
}

export function initialPlanSession(loc: PlanLocation): PlanSession {
  return { version: 1, phase: loc.resolved.phaseNumber, topology: phaseTopologyFingerprintFromLocation(loc.resolved, loc.matchedPhase), revision: 0, prepared: false, needsIntent: false, mode: "add", targetPlanIds: [], readSet: [] as ResearchReadSet, evidencePaths: [], targets: [], existingPlans: [], knownRequirements: [], knownEvidenceArtifacts: [], checkerRequired: false, candidateHash: null, history: [], requests: {} };
}
