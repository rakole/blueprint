import { promises as fs } from "node:fs";
import * as z from "zod/v4";
import { safeJsonParseObject } from "../../shared/security.js";
import { ensureRepoRoot, resolveBlueprintPath, withBlueprintRepoLock, writeTextFile } from "./artifacts.js";
import { resolveLocatedPhaseForMutation } from "./phase-resolution.js";
import { PHASE_TOPOLOGY_LOCK_NAME, phaseTopologyFingerprintFromLocation, type PhaseTopologyFingerprint } from "./phase-topology-lock.js";
import { checkedResearchPayload, researchNumericPhase, researchRequestId } from "./research-session.js";
import { readPlanPublicationStatus } from "./plan-publication.js";
import {
  portableProviderEvidenceBasisSchema,
  portableProviderEvidenceNextSchema,
  type PortableProviderEvidenceBasis,
  type PortableProviderEvidenceNext
} from "../codebase-index/provider-evidence.js";
import { portableSelectionSchema, type PortableSelection } from "../codebase-index/resolver.js";

export const planNumericPhase = researchNumericPhase;
export const planRequestId = researchRequestId;
export const planLookup = { cwd: z.string().optional(), phase: planNumericPhase };
export const checkedPlanPayload = checkedResearchPayload;
export type PlanMode = "add" | "revise" | "replace";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const targetSchema = z.object({ path: z.string(), hash: hash.nullable() });
const topologySchema = z.object({
  phaseNumber: z.string(), phasePrefix: z.string(), phaseName: z.string().nullable(), phaseDir: z.string(),
  roadmapEntry: z.object({ phaseNumber: z.string(), phasePrefix: z.string(), phaseName: z.string(), completed: z.boolean(), summary: z.string().nullable(), goal: z.string().nullable(), successCriteria: z.string().nullable(), requirements: z.array(z.string()) }).nullable(),
});
const stagesSchema = z.partialRecord(z.enum(["files", "commit", "state", "routing"]), z.enum(["intent", "complete"]));
const publishedPlanSchema = z.object({ planId: z.string(), wave: z.number().int().positive(), taskCount: z.number().int().positive(), path: z.string() });
const receiptSchema = z.object({
  status: z.literal("published"), saved: z.literal(true), ready: z.literal(true), revision: z.number().int().nonnegative(),
  sessionPath: z.string(), paths: z.array(z.string()), plans: z.array(publishedPlanSchema), removedPaths: z.array(z.string()),
  stages: stagesSchema, nextAction: z.string(),
});
const journalSchema = z.object({
  requestId: planRequestId, requestHash: hash, revision: z.number().int().nonnegative(), modelHash: hash,
  baselineMarkerToken: z.string(),
  files: z.array(publishedPlanSchema.extend({ hash, baselineHash: hash.nullable() })),
  removed: z.array(z.object({ path: z.string(), baselineHash: hash })),
  stages: stagesSchema, receipt: receiptSchema.optional(),
});
const portableSessionSchema = z.strictObject({
  selections: z.array(portableSelectionSchema).max(60),
  basis: portableProviderEvidenceBasisSchema,
  next: portableProviderEvidenceNextSchema
});
const ordinaryDeliveryIdentitySchema = z.strictObject({path: z.string().min(1), hash});
const ordinaryDeliverySchema = z.strictObject({
  delivered: z.array(ordinaryDeliveryIdentitySchema).max(300),
  registered: z.array(ordinaryDeliveryIdentitySchema).max(300)
});
const schema = z.object({
  version: z.literal(2), phase: z.string(), topology: topologySchema,
  revision: z.number().int().nonnegative(), prepared: z.boolean(), needsIntent: z.boolean().default(false), mode: z.enum(["add", "revise", "replace"]), targetPlanIds: z.array(z.string()),
  readSet: z.array(targetSchema).max(300), evidencePaths: z.array(z.string()), targets: z.array(targetSchema),
  existingPlans: z.array(z.object({ planId: z.string(), wave: z.number(), dependsOn: z.array(z.string()), requirements: z.array(z.string()) })),
  knownRequirements: z.array(z.string()), knownEvidenceArtifacts: z.array(z.string()), checkerRequired: z.boolean(),
  portable: portableSessionSchema.optional(), delivery: ordinaryDeliverySchema.optional(),
  requests: z.record(planRequestId, z.object({ hash, modelHash: hash, revision: z.number().int(), receipt: receiptSchema.optional() })),
  legacyPublication: z.object({ markerToken: z.string() }).optional(), journal: journalSchema.optional(),
});
export type PlanPortableSession = { selections: PortableSelection[]; basis: PortableProviderEvidenceBasis; next: PortableProviderEvidenceNext };
export type PlanSession = Omit<z.infer<typeof schema>, "topology" | "portable" | "delivery"> & {
  topology: PhaseTopologyFingerprint;
  portable?: PlanPortableSession;
  delivery?: { delivered: Array<{path: string; hash: string}>; registered: Array<{path: string; hash: string}> };
};
export type PlanJournal = z.infer<typeof journalSchema>;
export type PlanLocation = Awaited<ReturnType<typeof planLocation>>;

export function planPublicationPath(phaseDir: string, phasePrefix: string) { return `${phaseDir}/${phasePrefix}-PLAN-PUBLICATION.json`; }
export { readPlanPublicationStatus } from "./plan-publication.js";
export async function planLocation(args: { cwd?: string; phase?: string | number }) {
  const located = await resolveLocatedPhaseForMutation(args);
  return { ...located, sessionPath: `${located.resolved.phaseDir}/${located.resolved.phasePrefix}-PLAN-SESSION.json` };
}

export async function readPlanSession(loc: PlanLocation): Promise<PlanSession | null> {
  let raw: Record<string, unknown>;
  try { raw = safeJsonParseObject(await fs.readFile(resolveBlueprintPath(loc.projectRoot, loc.sessionPath), "utf8"), { label: loc.sessionPath, maxBytes: 32 * 1024 * 1024 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  const migrate = raw.version === 1;
  // Project only metadata. Legacy candidates, histories, rendered bodies,
  // backups and review prose disappear on the first owning runtime read.
  const session = schema.parse(migrate ? { ...raw, version: 2, requests: {}, journal: undefined, legacyPublication: undefined } : raw);
  if (session.phase !== loc.resolved.phaseNumber || session.topology.phaseDir !== loc.resolved.phaseDir || session.topology.phasePrefix !== loc.resolved.phasePrefix) throw new Error("Planning session identity mismatch.");
  const validPlanPath = (value: string) => value.startsWith(`${loc.resolved.phaseDir}/${loc.resolved.phasePrefix}-`) && /^\d+-PLAN\.md$/.test(value.slice(`${loc.resolved.phaseDir}/${loc.resolved.phasePrefix}-`.length));
  if (session.targets.some(item => !validPlanPath(item.path))) throw new Error("Invalid planning target path.");
  if (session.journal) {
    const j = session.journal, request = Object.hasOwn(session.requests, j.requestId) ? session.requests[j.requestId] : undefined;
    if (!request || request.hash !== j.requestHash || request.modelHash !== j.modelHash || j.revision !== session.revision || j.files.some(file => !validPlanPath(file.path)) || j.removed.some(file => !validPlanPath(file.path)) || new Set(j.files.map(file => file.path)).size !== j.files.length) throw new Error("Planning publication journal integrity mismatch.");
  }
  if (migrate) {
    const marker = await readPlanPublicationStatus(loc.projectRoot, loc.resolved.phaseDir, loc.resolved.phasePrefix);
    if (marker.status === "pending" || marker.status === "invalid") session.legacyPublication = { markerToken: marker.token };
    session.prepared = false; session.needsIntent = true; session.revision++;
    await savePlanSession(loc, session);
  }
  return session;
}

export async function savePlanSession(loc: PlanLocation, session: PlanSession, topologyLockHeld = false) {
  // Never serialize an unprojected caller object: unknown document fields must
  // not leak back into metadata through migration or future code changes.
  const metadata = schema.parse(session);
  const text = JSON.stringify(metadata, null, 2).replace(/[\u007f-\uffff]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`) + "\n";
  if (Buffer.byteLength(text) > 4 * 1024 * 1024) throw new Error("Planning publication metadata exceeds 4 MiB.");
  const write = async () => {
    const current = await planLocation({ cwd: loc.projectRoot, phase: session.phase });
    if (current.sessionPath !== loc.sessionPath || current.resolved.phaseNumber !== session.phase) throw new Error("Phase storage identity changed; refresh planning preparation.");
    await writeTextFile(resolveBlueprintPath(loc.projectRoot, loc.sessionPath), text);
  };
  return topologyLockHeld ? write() : withBlueprintRepoLock(loc.projectRoot, PHASE_TOPOLOGY_LOCK_NAME, write);
}
export async function withPlanSession<T>(args: { cwd?: string; phase?: string | number }, task: (loc: PlanLocation) => Promise<T>) {
  const root = await ensureRepoRoot(args.cwd);
  return withBlueprintRepoLock(root, "plan-session", async () => task(await planLocation({ ...args, cwd: root })));
}
export function initialPlanSession(loc: PlanLocation): PlanSession {
  return { version: 2, phase: loc.resolved.phaseNumber, topology: phaseTopologyFingerprintFromLocation(loc.resolved, loc.matchedPhase), revision: 0, prepared: false, needsIntent: false, mode: "add", targetPlanIds: [], readSet: [], evidencePaths: [], targets: [], existingPlans: [], knownRequirements: [], knownEvidenceArtifacts: [], checkerRequired: false, requests: {} };
}
