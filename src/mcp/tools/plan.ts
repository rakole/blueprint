import { promises as fs } from "node:fs";
import * as z from "zod/v4";
import { prepareTextForPersistence, safeJsonParseObject } from "../../shared/security.js";
import type { ToolDefinition } from "../tool-types.js";
import { CODEBASE_ARTIFACTS, isBootstrapStarterContext, resolveBlueprintPath, validatePhaseArtifactContent, withBlueprintRepoLock, writeTextFile } from "./artifacts.js";
import { artifactPathFor } from "./phase-locations.js";
import { extractMarkdownSection } from "./phase-markdown.js";
import { blueprintPhasePlanIndex, blueprintPhasePlanReadiness, validatePhasePlanCandidateSet } from "./phase.js";
import { planningPreparedSchema, planningModelExample, planningValidationRules, planningDerivedFields, compilePlanCandidate } from "./plan-model.js";
import type { PhasePlanStructuredModel } from "./phase-plan-rendering.js";
import { blueprintStateLoad, blueprintStateUpdate } from "./state.js";
import { blueprintCommandCatalog } from "./project.js";
import { withFreshPhaseTopologyForMutation } from "./phase-resolution.js";
import { phaseTopologyFingerprintFromLocation, phaseTopologyFingerprintsMatch } from "./phase-topology-lock.js";
import { researchDigest, researchInputHash, stableResearchValue } from "./research-evidence.js";
import { capturePlanEvidence, planBasisFreshness, planTargetFreshness, readPlanTargetHashes, shapePlanOrdinaryEvidence } from "./plan-evidence.js";
import { checkedPlanPayload, initialPlanSession, planLocation, planLookup, planNumericPhase, planPublicationPath, planRequestId, readPlanPublicationStatus, readPlanSession, savePlanSession, withPlanSession, type PlanJournal, type PlanLocation, type PlanPortableSession, type PlanSession } from "./plan-session.js";
import { planPublicationConsumptionIssue, readPlanPublicationSnapshot } from "./plan-publication.js";
import {
  portableProviderEvidenceBasisSchema,
  portableProviderEvidenceModeSchema,
  preparePortableProviderEvidence,
  resolvePortableProviderEvidence,
  type PortableProviderEvidenceBasis,
  type PortableProviderEvidenceDelivery,
  type PortableProviderEvidenceResult
} from "../codebase-index/provider-evidence.js";
import { portableSelectionSchema, type PortableSelection } from "../codebase-index/resolver.js";
import { PORTABLE_MAP_MAX_MODEL_PACKET_BYTES } from "../codebase-index/contracts.js";
import { loadPlanCursorAuthorityKey, sealPlanCursor, verifyPlanCursorSeal } from "./plan-cursor-authority.js";

const mode = z.enum(["add", "revise", "replace"]);
const planId = z.string().regex(/^\d+$/).transform(value => value.padStart(2, "0"));
export const PLAN_ORDINARY_EVIDENCE_BODY_BYTES = 48 * 1024;
export const PLAN_READ_BODY_PAGE_BYTES = 48 * 1024;
export const PLAN_READ_TIME_EVIDENCE_BYTES = 2 * 1024 * 1024;
export const PLAN_READ_TIME_EVIDENCE_ITEM_BYTES = 64 * 1024;
export const PLAN_READ_TIME_EVIDENCE_MAX_ITEMS = 33;

const evidenceContinuationSchema = z.strictObject({
  path: z.string().min(1).max(4096),
  offsetBytes: z.number().int().nonnegative().max(1024 * 1024),
  totalBytes: z.number().int().positive().max(1024 * 1024),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  revision: z.number().int().nonnegative(),
  basisHash: z.string().regex(/^[a-f0-9]{64}$/),
  seal: z.string().regex(/^[a-f0-9]{64}$/)
});
const publicEvidenceDeliverySchema = z.strictObject({
  mode: portableProviderEvidenceModeSchema,
  readTimeEvidence: z.array(z.strictObject({
    path: z.string().min(1).max(1024),
    hash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    bytes: z.string().max(PLAN_READ_TIME_EVIDENCE_ITEM_BYTES).refine(value => Buffer.byteLength(value, "utf8") <= PLAN_READ_TIME_EVIDENCE_ITEM_BYTES, { message: `Read-time evidence bytes must not exceed ${PLAN_READ_TIME_EVIDENCE_ITEM_BYTES} UTF-8 bytes.` }).optional()
  }).refine(item => item.hash !== undefined || item.bytes !== undefined, { message: "Read-time evidence requires hash or bytes." })).max(PLAN_READ_TIME_EVIDENCE_MAX_ITEMS).optional(),
  continuations: z.array(evidenceContinuationSchema).max(60).optional()
});
const prepareInputShape = {
  cwd: z.string().optional(), phase: planNumericPhase.optional(), mode: mode.optional(), targetPlanIds: z.array(planId).max(100).optional(),
  evidencePaths: z.array(z.string().min(1).max(4096)).max(60).optional(), expectedRevision: z.number().int().nonnegative().optional(), acknowledgeChangedInputs: z.boolean().optional(),
  portableSelections: z.array(portableSelectionSchema).max(60).optional(),
  evidenceDelivery: publicEvidenceDeliverySchema.optional(),
  reconcile: z.object({ confirmed: z.literal(true), targetHashes: z.record(z.string(), z.string().nullable()) }).optional(),
};
const prepareInput = z.object(prepareInputShape).superRefine((value, context) => {
  const readTimeBytes = (value.evidenceDelivery?.readTimeEvidence ?? [])
    .reduce((total, item) => total + (item.bytes === undefined ? 0 : Buffer.byteLength(item.bytes, "utf8")), 0);
  if (readTimeBytes > PLAN_READ_TIME_EVIDENCE_BYTES) context.addIssue({
    code: "custom",
    path: ["evidenceDelivery", "readTimeEvidence"],
    message: `Read-time evidence exceeds the ${PLAN_READ_TIME_EVIDENCE_BYTES}-byte aggregate limit. Send hashes or smaller bounded excerpts.`
  });
  const paths = value.evidenceDelivery?.continuations?.map(item => item.path) ?? [];
  if (new Set(paths).size !== paths.length) context.addIssue({
    code: "custom",
    path: ["evidenceDelivery", "continuations"],
    message: "Evidence continuations must contain each path at most once."
  });
});
const reviewInput = z.object({ verdict: z.enum(["accept", "revise"]), summary: z.string().min(1).max(20000) });
const submitInput = z.object({ ...planLookup, requestId: planRequestId, expectedRevision: z.number().int().nonnegative(), model: z.unknown().optional(), overwrite: z.boolean().optional(), review: reviewInput.optional() });
const readInputShape = {
  ...planLookup,
  bodyMode: z.enum(["metadata", "page"]).optional(),
  planIds: z.array(planId).max(20).optional(),
  bodyCursor: z.strictObject({
    planId,
    offsetBytes: z.number().int().nonnegative().max(4 * 1024 * 1024),
    totalBytes: z.number().int().nonnegative().max(4 * 1024 * 1024),
    planHash: z.string().regex(/^[a-f0-9]{64}$/),
    publicationToken: z.string().min(1).max(128),
    filterHash: z.string().regex(/^[a-f0-9]{64}$/),
    seal: z.string().regex(/^[a-f0-9]{64}$/)
  }).optional(),
  bodyByteLimit: z.number().int().min(1024).max(PLAN_READ_BODY_PAGE_BYTES).optional()
};
const lookupSchema = z.object(readInputShape);

function requestHash(args: z.infer<typeof submitInput>) {
  return researchDigest(stableResearchValue({ phase: String(args.phase), requestId: args.requestId, expectedRevision: args.expectedRevision, overwrite: args.overwrite ?? false }));
}
function responseBase(loc: PlanLocation, session: PlanSession) {
  return { revision: session.revision, sessionPath: loc.sessionPath };
}
async function safeNextAction(proposed?: string | null) {
  const catalog = await blueprintCommandCatalog();
  const command = proposed?.match(/\/blu-([a-z][a-z-]*)\b/)?.[1];
  if (command && catalog.commands[command]?.implemented) return proposed!;
  return catalog.commands.progress?.implemented ? "Run /blu-progress to review the next safe action." : null;
}
async function readinessGates(loc: PlanLocation, readiness: Awaited<ReturnType<typeof blueprintPhasePlanReadiness>>, inputs?: Awaited<ReturnType<typeof capturePlanEvidence>>["inputs"]) {
  const contextPath = artifactPathFor(loc.resolved, "context");
  const content = inputs?.find(input => input.path === contextPath)?.content ?? await fs.readFile(resolveBlueprintPath(loc.projectRoot, contextPath), "utf8").catch(error => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  });
  const validation = content === null ? null : validatePhaseArtifactContent(content, "context");
  const blockers = [...readiness.authoringContext.planningReadiness.blockers];
  if (!validation?.valid || isBootstrapStarterContext(content ?? "")) blockers.push("A complete, validated phase context is required before drafting plans.");
  const spec = inputs?.find(input => input.path === artifactPathFor(loc.resolved, "spec"));
  if (spec?.content && !validatePhaseArtifactContent(spec.content, "spec").valid) blockers.push("The saved phase specification is invalid.");
  return { ready: readiness.status === "ready" && blockers.length === 0, blockers: [...new Set(blockers)], checkerRequired: readiness.effectiveConfig.workflow.plan_check };
}

type PublicPortableDelivery = z.infer<typeof publicEvidenceDeliverySchema>;

function canonicalPortableSelectionList(values: readonly PortableSelection[]): PortableSelection[] {
  const seen = new Set<string>();
  const selections: PortableSelection[] = [];
  for (const value of values) {
    const parsed = portableSelectionSchema.parse(value);
    const key = JSON.stringify(parsed);
    if (!seen.has(key)) { seen.add(key); selections.push(parsed); }
  }
  return stablePortableList(selections);
}

function canonicalPortableSelections(session: PlanSession, requested?: readonly PortableSelection[]): PortableSelection[] {
  return canonicalPortableSelectionList(requested ?? session.portable?.selections ?? []);
}

function portablePrior(session: PlanSession, selections: readonly PortableSelection[]) {
  const previous = session.portable;
  if (!previous || stableResearchValue(canonicalPortableSelectionList(previous.selections)) !== stableResearchValue(selections)) return undefined;
  return {
    binding: { pinnedGeneration: previous.basis.generationId, identities: previous.next.bound.map(item => ({ path: item.path, hash: item.hash, generation: item.generation })), hash: previous.next.bindingHash },
    delivered: previous.next.delivered.map(item => ({ path: item.path, hash: item.hash, generation: item.generation })),
    registered: previous.next.registered.map(item => ({ path: item.path, hash: item.hash, generation: item.generation }))
  };
}

function stablePortableList<T>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => stableResearchValue(left).localeCompare(stableResearchValue(right)));
}

function portableReadSetIdentity(readSet: PortableProviderEvidenceBasis["readSet"], pins: readonly PortableProviderEvidenceBasis["pin"][]) {
  const memberPath = (pathValue: string, generationId: string) => {
    const mapPath = pathValue.startsWith(".blueprint/codebase/") ? pathValue.slice(".blueprint/codebase/".length) : pathValue;
    const prefix = `generations/${generationId}/`;
    return mapPath.startsWith(prefix) ? mapPath.slice(prefix.length) : mapPath;
  };
  const sourceAndPage = stablePortableList(readSet.sourceAndPage);
  const coveredMembers = new Set([
    ...sourceAndPage.filter(item => item.kind === "page").map(item => `${item.generation}\u0000${memberPath(item.path, item.generation)}`),
    ...pins.flatMap(pin => [pin.entry, pin.manifest].map(item => `${pin.generationId}\u0000${memberPath(item.path, pin.generationId)}`)),
  ]);
  return {
    sourceAndPage,
    sealedMembers: stablePortableList(readSet.sealedMembers.filter(item => !coveredMembers.has(`${item.generationId}\u0000${memberPath(item.path, item.generationId)}`))),
  };
}

function portableSessionIdentity(portable: PlanPortableSession | undefined) {
  if (!portable) return null;
  const pins = stablePortableList([...new Map(
    [portable.basis.pin, ...portable.basis.trustedPins.map(item => item.pin)]
      .map(pin => [stableResearchValue(pin), pin] as const),
  ).values()]);
  return {
    selections: canonicalPortableSelectionList(portable.selections),
    basis: {
      schemaVersion: portable.basis.schemaVersion,
      generationId: portable.basis.generationId,
      pin: portable.basis.pin,
      entry: portable.basis.entry,
      bound: stablePortableList(portable.basis.bound),
      bindingHash: portable.basis.bindingHash,
      readSet: portableReadSetIdentity(portable.basis.readSet, pins),
      trustedPins: pins,
    },
    binding: { bound: stablePortableList(portable.next.bound), bindingHash: portable.next.bindingHash },
    readSet: portableReadSetIdentity(portable.next.readSet, pins),
  };
}

function portableGenerationIdentity(basis: PortableProviderEvidenceBasis) {
  return {
    schemaVersion: basis.schemaVersion,
    generationId: basis.generationId,
    pin: basis.pin,
    entry: basis.entry,
  };
}

function portablePreparedResponse(portable: PlanPortableSession, result: Extract<PortableProviderEvidenceResult, {status: "ok"}>) {
  return {
    selections: portable.selections,
    basis: portable.basis,
    next: portable.next,
    packet: result.packet,
    binding: {
      pinnedGeneration: portable.basis.generationId,
      identities: portable.next.bound.map(item => ({ path: item.path, hash: item.hash, generation: item.generation })),
      hash: portable.next.bindingHash,
    },
    counts: result.counts,
    mode: result.mode,
  };
}

function portableDelivery(args: PublicPortableDelivery | undefined, session: PlanSession, selections: readonly PortableSelection[], ordinaryReadSetCount: number, ordinarySelectedCount: number, reusePinnedBasis: boolean): PortableProviderEvidenceDelivery {
  const prior = reusePinnedBasis ? portablePrior(session, selections) : undefined;
  return {
    mode: args?.mode ?? "full",
    ...(prior ? { prior } : {}),
    ...(args?.readTimeEvidence && selections.length ? { readTimeEvidence: args.readTimeEvidence.map(item => ({ path: item.path, ...(item.hash ? { hash: item.hash } : {}), ...(item.bytes !== undefined ? { bytes: item.bytes } : {}) })) } : {}),
    limits: { maxSourceCount: 60, maxReadSetCount: 300 },
    baseline: { selectedCount: ordinarySelectedCount, readSetCount: ordinaryReadSetCount }
  };
}

function portableCodebaseOverride(result: Extract<PortableProviderEvidenceResult, { status: "ok" }>) {
  return { mapped: true, artifacts: [result.context.entry.path], missingArtifacts: [], digest: [], warnings: [] };
}

function directEvidenceCodebaseOverride() {
  return { mapped: false, artifacts: [], missingArtifacts: [...CODEBASE_ARTIFACTS], digest: [], warnings: ["Portable codebase navigation was not requested; use the selected live source evidence."] };
}

function provenancePortableBasis(inputs: Awaited<ReturnType<typeof capturePlanEvidence>>["inputs"], loc: PlanLocation): PortableProviderEvidenceBasis | undefined {
  const researchPath = artifactPathFor(loc.resolved, "research").replace(/-RESEARCH\.md$/, "-RESEARCH-PROVENANCE.json");
  const input = inputs.find(item => item.path === researchPath);
  if (!input?.content) return undefined;
  try {
    const parsed = safeJsonParseObject(input.content, { label: researchPath, maxBytes: 1024 * 1024 });
    const result = portableProviderEvidenceBasisSchema.safeParse(parsed.portable);
    return result.success ? result.data : undefined;
  } catch { return undefined; }
}

function portablePinnedMemberSets(basis: PortableProviderEvidenceBasis) {
  const contexts = basis.trustedPins.length ? basis.trustedPins : [{ pin: basis.pin, ...(basis.pinReceipt ? { receipt: basis.pinReceipt } : {}) }];
  const memberName = (pathValue: string, generationId: string) => {
    const mapPath = pathValue.startsWith(".blueprint/codebase/") ? pathValue.slice(".blueprint/codebase/".length) : pathValue;
    const prefix = `generations/${generationId}/`;
    return mapPath.startsWith(prefix) ? mapPath.slice(prefix.length) : mapPath;
  };
  return contexts.map(context => ({
    pin: context.pin,
    ...(context.receipt ? { receipt: context.receipt } : {}),
    members: [...new Set([
      "ENTRY.md", "manifest.json",
      ...basis.readSet.sourceAndPage.filter(item => item.kind === "page" && item.generation === context.pin.generationId).map(item => memberName(item.path, context.pin.generationId)),
      ...basis.readSet.sealedMembers.filter(item => item.generationId === context.pin.generationId).map(item => memberName(item.path, context.pin.generationId))
    ])].sort()
  }));
}

function mergePortableReadSets(primary: PortableProviderEvidenceBasis, inherited?: PortableProviderEvidenceBasis): PortableProviderEvidenceBasis {
  if (!inherited) return primary;
  const sourceAndPage = [...new Map(
    [...inherited.readSet.sourceAndPage, ...primary.readSet.sourceAndPage]
      .map(item => [JSON.stringify(item), item] as const),
  ).values()].sort((left, right) =>
    left.path.localeCompare(right.path) || left.generation.localeCompare(right.generation) || left.kind.localeCompare(right.kind) || left.hash.localeCompare(right.hash),
  );
  const sealedMembers = [...new Map(
    [...inherited.readSet.sealedMembers, ...primary.readSet.sealedMembers]
      .map(item => [`${item.generationId}\u0000${item.path}`, item] as const),
  ).values()].sort((left, right) => left.generationId.localeCompare(right.generationId) || left.path.localeCompare(right.path));
  return {
    ...primary,
    readSet: { sourceAndPage, sealedMembers },
  };
}

function portableSourceCount(basis: PortableProviderEvidenceBasis | undefined): number {
  if (!basis) return 0;
  return new Set(
    basis.readSet.sourceAndPage
      .filter(item => item.kind === "source" && !item.path.startsWith("@"))
      .map(item => `${item.path}\u0000${item.generation}\u0000${item.fullFileHash ?? item.hash}`),
  ).size;
}

function portableReadSetCount(basis: PortableProviderEvidenceBasis | undefined): number {
  if (!basis) return 0;
  return new Set([
    ...basis.readSet.sourceAndPage.map(item => `${item.kind}\u0000${item.path}\u0000${item.generation}\u0000${item.deliveryPath ?? ""}`),
    ...basis.readSet.sealedMembers.map(item => `sealed\u0000${item.path}\u0000${item.generationId}`),
  ]).size;
}

function utf8Slice(value: string, offsetBytes: number, maxBytes: number) {
  const bytes = Buffer.from(value, "utf8");
  if (offsetBytes > bytes.length || offsetBytes > 0 && (bytes[offsetBytes] & 0xc0) === 0x80) {
    throw new Error("Evidence continuation offset is outside the file or splits a UTF-8 character.");
  }
  let end = Math.min(bytes.length, offsetBytes + maxBytes);
  while (end > offsetBytes && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
  return { content: bytes.subarray(offsetBytes, end).toString("utf8"), nextOffsetBytes: end < bytes.length ? end : null, totalBytes: bytes.length };
}

function boundedEvidence(inputs: Awaited<ReturnType<typeof capturePlanEvidence>>["inputs"], continuations: readonly z.infer<typeof evidenceContinuationSchema>[] = []) {
  let remaining = PLAN_ORDINARY_EVIDENCE_BODY_BYTES;
  const offsets = new Map(continuations.map(item => [item.path, item.offsetBytes]));
  const continuationOrder = new Map(continuations.map((item, index) => [item.path, index]));
  const priority = (path: string) => /-CONTEXT\.md$/.test(path) ? 0 : /-RESEARCH\.md$/.test(path) ? 1 : /-(?:UI-)?SPEC\.md$/.test(path) ? 2 : /\/(?:PROJECT|REQUIREMENTS)\.md$/.test(path) ? 3 : 4;
  return [...inputs].sort((left, right) => {
    const leftContinuation = continuationOrder.get(left.path);
    const rightContinuation = continuationOrder.get(right.path);
    if (leftContinuation !== undefined || rightContinuation !== undefined) {
      if (leftContinuation === undefined) return 1;
      if (rightContinuation === undefined) return -1;
      return leftContinuation - rightContinuation;
    }
    return priority(left.path) - priority(right.path);
  }).map(input => {
    if (input.content === null) return { ...input, content: null, truncated: false };
    const offsetBytes = offsets.get(input.path) ?? 0;
    const perFileBytes = /-(?:CONTEXT|SPEC|UI-SPEC)\.md$/.test(input.path) ? 16 * 1024 : 6 * 1024;
    const sliced = utf8Slice(input.content, offsetBytes, Math.min(perFileBytes, remaining));
    const deliveredBytes = Buffer.byteLength(sliced.content, "utf8");
    remaining -= deliveredBytes;
    return {
      ...input,
      content: sliced.content,
      truncated: offsetBytes > 0 || sliced.nextOffsetBytes !== null,
      contentOffsetBytes: offsetBytes,
      nextOffsetBytes: sliced.nextOffsetBytes,
      totalBytes: sliced.totalBytes
    };
  });
}

function ordinaryEvidenceBudget(evidence: readonly { path: string; content?: string | null; nextOffsetBytes?: number | null; totalBytes?: number }[]) {
  const deliveredBodyBytes = evidence.reduce((total, item) => total + (typeof item.content === "string" ? Buffer.byteLength(item.content, "utf8") : 0), 0);
  return {
    maxBodyBytes: PLAN_ORDINARY_EVIDENCE_BODY_BYTES,
    deliveredBodyBytes,
    continuations: evidence.flatMap(item => item.nextOffsetBytes === null || item.nextOffsetBytes === undefined ? [] : [{ path: item.path, offsetBytes: item.nextOffsetBytes, totalBytes: item.totalBytes ?? item.nextOffsetBytes }])
  };
}

function ordinaryEvidenceBasisHash(capture: Awaited<ReturnType<typeof capturePlanEvidence>>) {
  return researchDigest(stableResearchValue({ readSet: capture.readSet, evidencePaths: capture.evidencePaths }));
}

function evidenceCursorPayload(cursor: Omit<z.infer<typeof evidenceContinuationSchema>, "seal">) {
  return {
    path: cursor.path,
    offsetBytes: cursor.offsetBytes,
    totalBytes: cursor.totalBytes,
    hash: cursor.hash,
    revision: cursor.revision,
    basisHash: cursor.basisHash
  };
}

type PlanBodyCursor = NonNullable<z.infer<typeof lookupSchema.shape.bodyCursor>>;

function planBodyCursorPayload(cursor: Omit<PlanBodyCursor, "seal">) {
  return {
    planId: cursor.planId,
    offsetBytes: cursor.offsetBytes,
    totalBytes: cursor.totalBytes,
    planHash: cursor.planHash,
    publicationToken: cursor.publicationToken,
    filterHash: cursor.filterHash
  };
}

function publicOrdinaryEvidence(evidence: readonly Record<string, unknown>[]) {
  return evidence.map(item => {
    const { nextOffsetBytes: _nextOffsetBytes, totalBytes: _totalBytes, ...publicItem } = item;
    return publicItem;
  });
}

function boundOrdinaryEvidenceBudget(
  evidence: readonly { path: string; hash?: string | null; content?: string | null; nextOffsetBytes?: number | null; totalBytes?: number }[],
  revision: number,
  basisHash: string,
  cursorKey: Uint8Array
) {
  const budget = ordinaryEvidenceBudget(evidence);
  const hashes = new Map(evidence.flatMap(item => typeof item.hash === "string" ? [[item.path, item.hash] as const] : []));
  return {
    ...budget,
    continuations: budget.continuations.flatMap(item => {
      const hash = hashes.get(item.path);
      if (!hash) return [];
      const payload = evidenceCursorPayload({ ...item, hash, revision, basisHash });
      return [{ ...payload, seal: sealPlanCursor(cursorKey, "evidence", payload) }];
    })
  };
}

export async function blueprintPlanPrepare(raw: z.input<typeof prepareInput> = {}) {
  const args = prepareInput.parse(raw);
  try {
    return await withPlanSession(args, async loc => {
      const session = await readPlanSession(loc) ?? initialPlanSession(loc);
      let marker = await readPlanPublicationStatus(loc.projectRoot, loc.resolved.phaseDir, loc.resolved.phasePrefix);
      if (session.journal && !session.journal.receipt || session.legacyPublication || marker.status === "pending" || marker.status === "invalid") {
        const targetHashes = Object.fromEntries((await readPlanTargetHashes(loc)).map(item => [item.path, item.hash]));
        if (!args.reconcile || args.expectedRevision !== session.revision || !args.acknowledgeChangedInputs || stableResearchValue(args.reconcile.targetHashes) !== stableResearchValue(targetHashes)) return {
          status: "reconciliation_required", ...responseBase(loc, session), targetHashes, publication: marker,
          nextAction: session.journal ? `Retry blueprint_plan_submit requestId ${session.journal.requestId} with the original revision/control flags and model if any plan is still missing. Alternatively, prepare with expectedRevision, acknowledgeChangedInputs=true and reconcile containing observed targetHashes to accept the current canonical files.` : "Review the observed canonical files, then prepare with expectedRevision, acknowledgeChangedInputs=true and reconcile containing targetHashes. Reconciliation preserves all observed files and removes obsolete publication metadata.",
        };
        await reconcilePublication(loc, session, args.reconcile.targetHashes, marker.token);
        loc = await planLocation({ cwd: loc.projectRoot, phase: session.phase });
        marker = await readPlanPublicationStatus(loc.projectRoot, loc.resolved.phaseDir, loc.resolved.phasePrefix);
      }
      if (args.expectedRevision !== undefined && args.expectedRevision !== session.revision) return { status: "stale", ...responseBase(loc, session), reason: "Revision conflict" };
      const initialTargets = await readPlanTargetHashes(loc);
      const explicitPortable = args.portableSelections !== undefined || Boolean(session.portable);
      const defaultPortable = !explicitPortable
        ? await resolvePortableProviderEvidence({root: loc.projectRoot})
        : undefined;
      // A valid existing map is preferred by default.  Absent, malformed, or
      // unsupported maps continue through the ordinary bounded capture path.
      const portableRequested = explicitPortable || defaultPortable?.status === "ok";
      const guardedPortableFallback = defaultPortable !== undefined && defaultPortable.status !== "ok" &&
        (defaultPortable.diagnostics ?? []).some(item => (item as {code?: string}).code !== "missing");
      const directEvidenceOnly = guardedPortableFallback;
      const selections = canonicalPortableSelections(session, args.portableSelections);
      const sessionPortableSelections = canonicalPortableSelectionList(session.portable?.selections ?? []);
      const samePortableSelection = Boolean(session.portable) &&
        stableResearchValue(selections) === stableResearchValue(sessionPortableSelections);
      const priorPortableBasis = !args.acknowledgeChangedInputs && session.portable && stableResearchValue(session.portable.selections) === stableResearchValue(selections)
        ? session.portable.basis
        : undefined;
      // A successful portable refresh keeps selected declaration dependencies
      // private.  Re-capture their whole files only for an actual portable
      // failure that is handled by the ordinary fallback path.
      const selectedPaths = [...new Set([...session.evidencePaths, ...args.evidencePaths ?? []])];
      let capture = await capturePlanEvidence(loc, selectedPaths, { skipCodebaseArtifacts: portableRequested || directEvidenceOnly });
      let evidenceBasisHash = ordinaryEvidenceBasisHash(capture);
      const continuationKey = args.evidenceDelivery?.continuations?.length
        ? await loadPlanCursorAuthorityKey(loc.projectRoot, false)
        : null;
      const invalidContinuations = (args.evidenceDelivery?.continuations ?? []).filter(item => {
        const input = capture.inputs.find(candidate => candidate.path === item.path);
        if (!input?.content || !input.hash) return true;
        const totalBytes = Buffer.byteLength(input.content, "utf8");
        const { seal, ...payload } = item;
        return !continuationKey || !verifyPlanCursorSeal(continuationKey, "evidence", evidenceCursorPayload(payload), seal) ||
          item.revision !== session.revision || item.basisHash !== evidenceBasisHash ||
          item.hash !== input.hash || item.totalBytes !== totalBytes || item.offsetBytes >= totalBytes;
      });
      if (invalidContinuations.length) return {
        status: "reread_required", saved: false, ready: false,
        paths: invalidContinuations.map(item => item.path),
        reason: "Evidence continuations must match the current prepared revision and immutable source basis.",
        nextAction: "Retry blueprint_plan_prepare with a continuation returned by the current evidenceBudget."
      };
      let inheritedBasis = provenancePortableBasis(capture.inputs, loc);
      const provider = portableRequested
        ? await preparePortableProviderEvidence({
            root: loc.projectRoot,
            selections,
            evidenceDelivery: portableDelivery(args.evidenceDelivery, session, selections, capture.readSet.length + 1, capture.evidencePaths.length, !args.acknowledgeChangedInputs),
            ...(session.portable && !args.acknowledgeChangedInputs && stableResearchValue(session.portable.selections) === stableResearchValue(selections) && session.portable.basis.pinReceipt ? { pinReceipt: session.portable.basis.pinReceipt } : {}),
            ...((inheritedBasis ?? priorPortableBasis) ? { pinnedMemberSets: portablePinnedMemberSets(inheritedBasis ?? priorPortableBasis!) } : {})
          })
        : ({ status: "fallback", code: "portable_not_requested", reason: "Portable evidence was not requested.", paths: [] } satisfies PortableProviderEvidenceResult);
      let acknowledgedPortableFailure = false;
      if (args.acknowledgeChangedInputs && portableRequested && provider.status === "reread_required" && samePortableSelection && session.portable) {
        const currentPortable = await resolvePortableProviderEvidence({root: loc.projectRoot});
        const priorSourceEntries = session.portable.next.readSet.sourceAndPage.filter(item => item.kind === "source" && !item.path.startsWith("@"));
        const priorSourcePaths = [...new Set(priorSourceEntries.map(item => item.path))];
        const coveredFailurePaths = new Set(priorSourceEntries.flatMap(item => [item.path, ...(item.deliveryPath ? [item.deliveryPath] : [])]));
        // A prior closure proves a complete ordinary fallback only for the
        // exact same selection and sealed generation identity.  Generation IDs
        // are labels, so comparing them alone could accept a replacement map
        // whose ENTRY or manifest bytes bind a different dependency closure.
        const canCaptureCompleteFallback = currentPortable.status === "ok" &&
          stableResearchValue(portableGenerationIdentity(currentPortable.basis)) ===
            stableResearchValue(portableGenerationIdentity(session.portable.basis)) &&
          (selections.length === 0 || priorSourcePaths.length > 0) &&
          provider.paths.length > 0 && provider.paths.every(item => coveredFailurePaths.has(item));
        if (canCaptureCompleteFallback) {
          const fallbackCapture = await capturePlanEvidence(loc, [...new Set([...selectedPaths, ...priorSourcePaths])], { skipCodebaseArtifacts: true });
          const capturedByPath = new Map(fallbackCapture.inputs.map(item => [item.path, item]));
          const capturedEverySource = priorSourcePaths.every(item => {
            const captured = capturedByPath.get(item);
            return Boolean(captured && captured.content !== null && captured.hash !== null);
          });
          if (capturedEverySource) {
            capture = fallbackCapture;
            evidenceBasisHash = ordinaryEvidenceBasisHash(capture);
            inheritedBasis = provenancePortableBasis(capture.inputs, loc);
            acknowledgedPortableFailure = true;
          }
        }
      }
      const providerFailure = !portableRequested || provider.status === "ok" || acknowledgedPortableFailure ? null : provider;
      if (providerFailure) return {
        status: providerFailure.status, saved: false, ready: false, reason: providerFailure.reason, paths: providerFailure.paths,
        ...(providerFailure.code ? { code: providerFailure.code } : {}), ...(providerFailure.counts ? { counts: providerFailure.counts } : {}),
        ...(providerFailure.scopeReduction ? { scopeReduction: providerFailure.scopeReduction } : {}),
        nextAction: providerFailure.status === "evidence_limit" ? "Reduce portableSelections or evidencePaths to fit the planning evidence limits, then retry blueprint_plan_prepare." : "Read the selected source again and retry blueprint_plan_prepare with matching read-time evidence, or refresh the portable map."
      };
      const portableResult = provider.status === "ok" ? provider : null;
      // Portable source bindings are private freshness dependencies.  They do
      // not become ordinary evidence paths or whole-file bodies merely because
      // a selected declaration range depends on the source file.
      const portableBasis = portableResult
        ? mergePortableReadSets(mergePortableReadSets(portableResult.basis, inheritedBasis), priorPortableBasis)
        : acknowledgedPortableFailure
          ? undefined
          : inheritedBasis ?? session.portable?.basis;
      const portableBases = portableBasis ? [portableBasis] : [];
      const portableReadSetSources = portableBasis?.readSet.sourceAndPage.filter(item => item.kind === "source" && !item.path.startsWith("@")) ?? [];
      // Keep every expected portable source hash.  A research source and a
      // plan source may share a path across generations; collapsing by path
      // would let whichever generation sorts last decide freshness.
      const readSet = [...capture.readSet, ...portableReadSetSources.map(item => ({ path: item.path, hash: item.fullFileHash ?? item.hash }))];
      const combinedSourceCount = capture.evidencePaths.length + portableSourceCount(portableBasis);
      const combinedReadSetCount = capture.readSet.length + portableReadSetCount(portableBasis) + 1;
      if (combinedSourceCount > 60 || combinedReadSetCount > 300) return {
        status: "evidence_limit", saved: false, ready: false,
        counts: { selectedCount: combinedSourceCount, sourceCount: combinedSourceCount, readSetCount: combinedReadSetCount, deliveredCount: 0, omittedCount: 0, packetBytes: 0 },
        scopeReduction: { selectedCount: combinedSourceCount, suggestedMaxCount: combinedSourceCount > 60 ? 60 : 300, omittedBodyCount: 0, omittedPathCount: Math.max(0, combinedReadSetCount - 300) },
        reason: "Planning evidence exceeds the fixed portable source or read-set limit.",
        nextAction: "Reduce evidencePaths or portableSelections to fit the planning evidence limits, then retry blueprint_plan_prepare.",
      };
      const readinessOptions = portableResult ? { codebase: portableCodebaseOverride(portableResult) } : directEvidenceOnly || acknowledgedPortableFailure ? { codebase: directEvidenceCodebaseOverride() } : undefined;
      const readiness = await blueprintPhasePlanReadiness({ cwd: loc.projectRoot, phase: session.phase, bodyMode: "summary" }, readinessOptions);
      const current = await planLocation({ cwd: loc.projectRoot, phase: session.phase });
      const fresh = await planBasisFreshness(loc.projectRoot, session.phase, readSet, portableBases);
      const targets = await readPlanTargetHashes(current);
      const finalMarker = await readPlanPublicationStatus(loc.projectRoot, loc.resolved.phaseDir, loc.resolved.phasePrefix);
      if (fresh.status !== "fresh" || marker.token !== finalMarker.token || stableResearchValue(targets) !== stableResearchValue(initialTargets) || !phaseTopologyFingerprintsMatch(phaseTopologyFingerprintFromLocation(loc.resolved, loc.matchedPhase), phaseTopologyFingerprintFromLocation(current.resolved, current.matchedPhase))) return { status: "stale", ...responseBase(loc, session), freshness: fresh, nextAction: "Retry prepare; inputs changed during collection." };
      const gates = await readinessGates(loc, readiness, capture.inputs);
      const plans = readiness.planIndex?.plans ?? [];
      const contextContent = capture.inputs.find(input => input.path === artifactPathFor(loc.resolved, "context"))?.content ?? "";
      const ordinaryPacketEvidence = boundedEvidence(capture.inputs, args.evidenceDelivery?.continuations);
      const packet = {
        phase: readiness.phaseSelection, gates, config: { workflow: readiness.effectiveConfig.workflow },
        requirements: readiness.context?.requirementsGrounding, projectBrief: readiness.context?.projectBrief,
        evidence: publicOrdinaryEvidence(ordinaryPacketEvidence),
        grounding: {
          lockedDecisions: extractMarkdownSection(contextContent, "Implementation Decisions"),
          phaseBoundary: extractMarkdownSection(contextContent, "Phase Boundary"),
          dependencies: extractMarkdownSection(contextContent, "Dependencies"),
          discoveryGrounding: extractMarkdownSection(contextContent, "Discovery Grounding"),
          projectConstraints: readiness.context?.projectBrief.constraints ?? [],
        },
        existingPlans: plans.map(({ planId, path, title, wave, dependsOn, requirements, status }) => ({ planId, path, title, wave, dependsOn, requirements, status })),
        targetHashes: Object.fromEntries(targets.map(item => [item.path, item.hash])),
        schema: planningPreparedSchema(readiness.authoringContext),
        example: planningModelExample({ knownRequirements: readiness.authoringContext.knownRequirements, knownEvidenceArtifacts: readiness.authoringContext.knownEvidenceArtifacts }),
        validationRules: planningValidationRules, derivedFields: planningDerivedFields, exampleNote: "Example paths are illustrative; replace them with inspected repository files and cover every phase requirement across the complete plan set.",
      };
      const ordinary = shapePlanOrdinaryEvidence(ordinaryPacketEvidence, args.evidenceDelivery, session.delivery);
      if (ordinary.status !== "ok") return { ...packet, status: ordinary.status, saved: false, ready: false, paths: ordinary.paths, reason: "Read-time evidence does not match the selected repository source.", nextAction: "Read the selected source again and retry blueprint_plan_prepare with matching read-time evidence." };
      const ordinaryBudget = ordinaryEvidenceBudget(ordinary.evidence);
      const portableBodyBytes = portableResult?.counts.packetBytes ?? 0;
      let responseCursorKey = continuationKey;
      const packetWithDeliveryAt = async (revision: number) => {
        if (ordinaryBudget.continuations.length && !responseCursorKey) {
          responseCursorKey = await loadPlanCursorAuthorityKey(loc.projectRoot, true);
          if (!responseCursorKey) throw new Error("Planning evidence continuation authority is unavailable.");
        }
        return ({
        ...packet,
        evidence: publicOrdinaryEvidence(ordinary.evidence),
        evidenceBudget: {
          ordinary: responseCursorKey
            ? boundOrdinaryEvidenceBudget(ordinary.evidence, revision, evidenceBasisHash, responseCursorKey)
            : { ...ordinaryBudget, continuations: [] },
          portable: { maxPacketBytes: PORTABLE_MAP_MAX_MODEL_PACKET_BYTES, deliveredPacketBytes: portableBodyBytes },
          aggregate: {
            maxPayloadBytes: PLAN_ORDINARY_EVIDENCE_BODY_BYTES + PORTABLE_MAP_MAX_MODEL_PACKET_BYTES,
            deliveredPayloadBytes: ordinaryBudget.deliveredBodyBytes + portableBodyBytes
          }
        },
        ...(portableResult ? { portable: { selections, basis: portableBasis ?? portableResult.basis, next: { ...portableResult.next, readSet: (portableBasis ?? portableResult.basis).readSet }, packet: portableResult.packet, binding: portableResult.binding, counts: portableResult.counts, mode: portableResult.mode } } : {})
        });
      };
      const nextPortable: PlanPortableSession | undefined = portableResult
        ? { selections, basis: portableBasis ?? portableResult.basis, next: { ...portableResult.next, readSet: (portableBasis ?? portableResult.basis).readSet } }
        : acknowledgedPortableFailure
          ? undefined
          : session.portable;
      if (plans.length && !args.mode && (!session.readSet.length || session.journal?.receipt || session.needsIntent)) {
        await savePlanSession(loc, session);
        return { ...await packetWithDeliveryAt(session.revision), status: "choice_required", ...responseBase(loc, session), nextAction: "Choose add, revise selected plans, or replace selected plans; supply mode and targetPlanIds for revise/replace." };
      }
      const nextMode = args.mode ?? (plans.length ? session.mode : "add");
      const targetPlanIds = [...new Set(args.targetPlanIds ?? (nextMode === "add" ? [] : nextMode === "replace" && args.mode ? plans.map(plan => plan.planId) : session.targetPlanIds))];
      if (nextMode === "add" && targetPlanIds.length || nextMode !== "add" && !targetPlanIds.length || targetPlanIds.some(id => !plans.some(plan => plan.planId === id))) return { ...await packetWithDeliveryAt(session.revision), status: "choice_required", ...responseBase(loc, session), reason: "Add accepts no targets; revise/replace require existing selected targetPlanIds." };
      const changed = session.readSet.length ? await planBasisFreshness(loc.projectRoot, session.phase, session.readSet, session.portable ? [session.portable.basis] : []) : null;
      const topologyChanged = !phaseTopologyFingerprintsMatch(session.topology, phaseTopologyFingerprintFromLocation(current.resolved, current.matchedPhase));
      const targetsChanged = session.readSet.length > 0 && stableResearchValue(targets) !== stableResearchValue(session.targets);
      const modeChanged = session.readSet.length > 0 && (nextMode !== session.mode || stableResearchValue(targetPlanIds) !== stableResearchValue(session.targetPlanIds));
      const selectedEvidenceChanged = session.readSet.length > 0 && stableResearchValue(capture.evidencePaths) !== stableResearchValue(session.evidencePaths);
      const portableSelectionChanged = session.readSet.length > 0 && stableResearchValue(selections) !== stableResearchValue(canonicalPortableSelectionList(session.portable?.selections ?? []));
      const portableIdentityChanged = session.readSet.length > 0 && stableResearchValue(portableSessionIdentity(nextPortable)) !== stableResearchValue(portableSessionIdentity(session.portable));
      const deliveryChanged = stableResearchValue(ordinary.delivery) !== stableResearchValue(session.delivery);
      if ((targetsChanged || topologyChanged) && (!args.reconcile || args.expectedRevision !== session.revision || stableResearchValue(args.reconcile.targetHashes) !== stableResearchValue(packet.targetHashes))) return { ...await packetWithDeliveryAt(session.revision), status: "reconciliation_required", ...responseBase(loc, session), reason: "Review changed topology and publication targets, then prepare with expectedRevision and reconcile containing the observed targetHashes." };
      if ((changed && changed.status !== "fresh" || modeChanged && !session.needsIntent || selectedEvidenceChanged || portableSelectionChanged || portableIdentityChanged) && (!args.acknowledgeChangedInputs || args.expectedRevision !== session.revision)) return { ...await packetWithDeliveryAt(session.revision), status: "stale", ...responseBase(loc, session), freshness: changed, nextAction: "Review the changed evidence or scope, then prepare with expectedRevision and acknowledgeChangedInputs=true. No document draft is stored; use the refreshed packet to author the model." };
      const unchanged = !session.needsIntent && !session.journal?.receipt && session.prepared === gates.ready && session.readSet.length && !topologyChanged && !targetsChanged && !modeChanged && !selectedEvidenceChanged && !portableSelectionChanged && !portableIdentityChanged && !deliveryChanged && changed?.status === "fresh";
      if (!unchanged) {
        delete session.journal;
        session.requests = {};
        session.topology = phaseTopologyFingerprintFromLocation(current.resolved, current.matchedPhase);
        session.prepared = gates.ready; session.mode = nextMode; session.targetPlanIds = targetPlanIds;
        if (args.mode || !plans.length) session.needsIntent = false;
        session.readSet = readSet; session.evidencePaths = capture.evidencePaths; session.targets = targets;
        session.existingPlans = plans.map(plan => ({ planId: plan.planId, wave: plan.wave ?? 1, dependsOn: plan.dependsOn, requirements: plan.requirements }));
        session.knownRequirements = readiness.authoringContext.knownRequirements;
        const selectedPaths = new Set(targetPlanIds.map(id => `${loc.resolved.phaseDir}/${loc.resolved.phasePrefix}-${id}-PLAN.md`));
        session.knownEvidenceArtifacts = readiness.authoringContext.knownEvidenceArtifacts.filter(p => !selectedPaths.has(p));
        session.checkerRequired = gates.checkerRequired;
        if (nextPortable) session.portable = nextPortable;
        else if (acknowledgedPortableFailure) delete session.portable;
        if (ordinary.delivery.delivered.length || ordinary.delivery.registered.length) session.delivery = ordinary.delivery;
        session.revision++;
        await savePlanSession(loc, session);
      }
      return {
        ...await packetWithDeliveryAt(session.revision),
        ...(portableResult && session.portable ? { portable: portablePreparedResponse(session.portable, portableResult) } : {}),
        schema: planningPreparedSchema(session), status: gates.ready ? "prepared" : "blocked", ...responseBase(loc, session), mode: nextMode, targetPlanIds,
        knownRequirements: session.knownRequirements, knownEvidenceArtifacts: session.knownEvidenceArtifacts,
        nextAction: gates.ready ? "Use schema, example and validationRules to author the model. If checkerRequired, review this model in memory, then call blueprint_plan_submit once with model and the review verdict. Read any truncated required evidence before relying on it. Planning performs no live external research." : await safeNextAction(readiness.nextSafeAction),
      };
    });
  } catch (error) {
    return { status: "blocked", reason: (error as Error).message, nextAction: await safeNextAction("Run /blu-progress to resolve planning preparation.") };
  }
}

async function assess(loc: PlanLocation, session: PlanSession, model: unknown) {
  const compiled = planDependencies.compile(model, { knownRequirements: session.knownRequirements, knownEvidenceArtifacts: session.knownEvidenceArtifacts, existingPlans: session.existingPlans, mode: session.mode, targetPlanIds: session.targetPlanIds });
  if (!compiled.valid) return { valid: false, diagnostics: compiled.diagnostics, plans: [], planIds: compiled.planIds, planSetValidation: null };
  const validated = await planDependencies.validate({ cwd: loc.projectRoot, phase: session.phase, models: compiled.models, removePlanIds: session.mode === "replace" ? session.targetPlanIds : [], requireComplete: true });
  return { ...validated, diagnostics: [...compiled.diagnostics, ...validated.diagnostics], planIds: compiled.planIds };
}
function validationSummary(result: Awaited<ReturnType<typeof assess>>) {
  const budget = { remaining: 64000, truncated: false };
  const bound = (value: unknown, depth = 0): unknown => {
    if (budget.remaining <= 0 || depth > 6) { budget.truncated = true; return "[truncated]"; }
    if (typeof value === "string") {
      const limit = Math.min(2000, budget.remaining);
      if (value.length > limit) budget.truncated = true;
      const output = value.slice(0, limit); budget.remaining -= output.length;
      return output;
    }
    if (Array.isArray(value)) {
      if (value.length > 20) budget.truncated = true;
      return value.slice(0, 20).map(item => bound(item, depth + 1));
    }
    if (value && typeof value === "object") {
      const entries = Object.entries(value);
      if (entries.length > 30) budget.truncated = true;
      return Object.fromEntries(entries.slice(0, 30).map(([key, item]) => [key.slice(0, 200), bound(item, depth + 1)]));
    }
    return value;
  };
  const diagnostics = result.diagnostics.slice(0, 100).map(item => bound(item));
  const planSetValidation = bound(result.planSetValidation);
  return { valid: result.valid, diagnostics, diagnosticCount: result.diagnostics.length, diagnosticsTruncated: result.diagnostics.length > diagnostics.length || budget.truncated, planSetValidation };
}

function publicPlanSession(session: PlanSession | null, requestedIds: ReadonlySet<string> | null = null) {
  if (!session) return null;
  const detailBudget = { remaining: 24 * 1024, truncated: false };
  const boundedStrings = (values: readonly string[], maxItems: number) => {
    const output: string[] = [];
    for (const value of values.slice(0, maxItems)) {
      const bounded = value.slice(0, 1024);
      const bytes = Buffer.byteLength(JSON.stringify(bounded), "utf8");
      if (bytes > detailBudget.remaining) { detailBudget.truncated = true; break; }
      detailBudget.remaining -= bytes;
      output.push(bounded);
      if (bounded.length !== value.length) detailBudget.truncated = true;
    }
    if (values.length > output.length) detailBudget.truncated = true;
    return output;
  };
  const scopedTargets = session.targetPlanIds.filter(id => !requestedIds || requestedIds.has(id));
  const scopedExisting = session.existingPlans.filter(plan => !requestedIds || requestedIds.has(plan.planId));
  const returnedExisting = scopedExisting.slice(0, requestedIds ? 20 : 100).map(plan => ({
    planId: plan.planId.slice(0, 64),
    wave: plan.wave,
    dependsOn: boundedStrings(plan.dependsOn, 50),
    requirements: boundedStrings(plan.requirements, 50),
    counts: { dependsOn: plan.dependsOn.length, requirements: plan.requirements.length }
  }));
  if (returnedExisting.length !== scopedExisting.length) detailBudget.truncated = true;
  return {
    version: session.version,
    phase: session.phase,
    revision: session.revision,
    prepared: session.prepared,
    needsIntent: session.needsIntent,
    publicationOwned: session.publicationOwned,
    mode: session.mode,
    targetPlanIds: boundedStrings(scopedTargets, requestedIds ? 20 : 100),
    checkerRequired: session.checkerRequired,
    existingPlans: returnedExisting,
    metadataScope: {
      filtered: Boolean(requestedIds),
      planIds: requestedIds ? [...requestedIds] : [],
      truncated: detailBudget.truncated
    },
    counts: {
      readSet: session.readSet.length,
      evidencePaths: session.evidencePaths.length,
      targets: session.targets.length,
      knownRequirements: session.knownRequirements.length,
      knownEvidenceArtifacts: session.knownEvidenceArtifacts.length,
      requests: Object.keys(session.requests).length,
      targetPlanIds: session.targetPlanIds.length,
      scopedTargetPlanIds: scopedTargets.length,
      existingPlans: session.existingPlans.length,
      scopedExistingPlans: scopedExisting.length
    },
    ...(session.portable ? {
      portable: {
        selectionCount: session.portable.selections.length,
        generationId: session.portable.basis.generationId,
        bindingHash: session.portable.next.bindingHash
      }
    } : {}),
    ...(session.delivery ? {
      delivery: {
        deliveredCount: session.delivery.delivered.length,
        registeredCount: session.delivery.registered.length
      }
    } : {}),
    ...(session.journal ? {
      journal: {
        requestId: session.journal.requestId,
        revision: session.journal.revision,
        stages: session.journal.stages,
        ...(session.journal.receipt ? {
          receipt: {
            status: session.journal.receipt.status,
            saved: session.journal.receipt.saved,
            ready: session.journal.receipt.ready,
            revision: session.journal.receipt.revision,
            pathCount: session.journal.receipt.paths.length,
            planCount: session.journal.receipt.plans.length,
            removedPathCount: session.journal.receipt.removedPaths.length
          }
        } : {})
      }
    } : {}),
    ...(session.legacyPublication ? { legacyPublication: { markerToken: session.legacyPublication.markerToken.slice(0, 128) } } : {})
  };
}

function boundedFreshness(freshness: Awaited<ReturnType<typeof planBasisFreshness>> | null) {
  if (!freshness) return null;
  let remaining = 32 * 1024;
  let truncated = false;
  const bounded = (values: readonly string[]) => values.flatMap(value => {
    const bytes = Buffer.byteLength(value, "utf8");
    if (bytes > remaining) { truncated = true; return []; }
    remaining -= bytes;
    return [value];
  });
  const stalePaths = bounded(freshness.stalePaths);
  const unknownPaths = bounded(freshness.unknownPaths);
  return {
    status: freshness.status,
    stalePaths,
    unknownPaths,
    stalePathCount: freshness.stalePaths.length,
    unknownPathCount: freshness.unknownPaths.length,
    truncated
  };
}

export async function blueprintPlanRead(raw: z.input<typeof lookupSchema>) {
  const args = lookupSchema.parse(raw);
  return withPlanSession(args, async loc => {
    const session = await readPlanSession(loc);
    const before = await readPlanPublicationSnapshot(loc.projectRoot, loc.resolved.phaseDir, loc.resolved.phasePrefix);
    const current = await planLocation(args);
    const targets = before.status === "committed" && before.version === 2
      ? before.files
      : await readPlanTargetHashes(current);
    const requestedPlanIds = args.planIds?.length ? [...new Set(args.planIds)].sort() : [];
    const requestedIds = requestedPlanIds.length ? new Set(requestedPlanIds) : null;
    const bodyTargets = targets.filter(target => !requestedIds || requestedIds.has(target.path.match(/-(\d+)-PLAN\.md$/)?.[1] ?? ""));
    const filterHash = researchDigest(stableResearchValue({
      planIds: requestedPlanIds,
      targets: bodyTargets.map(target => ({ path: target.path, hash: target.hash }))
    }));
    const bodyMode = args.bodyMode ?? "page";
    const bodyLimit = args.bodyByteLimit ?? PLAN_READ_BODY_PAGE_BYTES;
    let bodyRemaining = bodyMode === "page" ? bodyLimit : 0;
    let startIndex = 0;
    let startOffset = 0;
    if (args.bodyCursor) {
      const cursorKey = await loadPlanCursorAuthorityKey(loc.projectRoot, false);
      const { seal, ...cursorPayload } = args.bodyCursor;
      startIndex = bodyTargets.findIndex(target => target.path.endsWith(`-${args.bodyCursor!.planId}-PLAN.md`));
      if (startIndex < 0) throw new Error("Plan body cursor does not match the selected plan set.");
      const cursorTarget = bodyTargets[startIndex];
      if (!cursorKey || !verifyPlanCursorSeal(cursorKey, "plan", planBodyCursorPayload(cursorPayload), seal) ||
          bodyMode !== "page" || args.bodyCursor.filterHash !== filterHash ||
          args.bodyCursor.publicationToken !== before.token || cursorTarget.hash === null || args.bodyCursor.planHash !== cursorTarget.hash ||
          before.status !== "committed" && before.status !== "absent") {
        throw new Error("Plan body cursor is stale or does not match the current publication and filters.");
      }
      startOffset = args.bodyCursor.offsetBytes;
    }
    const bodies = new Map<string, { content: string; contentOffsetBytes: number; contentComplete: boolean }>();
    let nextCursor: PlanBodyCursor | null = null;
    let bodyReadIssue: string | null = null;
    const targetContent = async (target: { path: string; hash: string | null }) => {
      if (target.hash === null) throw new Error(`Plan body has no canonical hash: ${target.path}.`);
      const content = before.status === "committed"
        ? before.contents?.get(target.path) ?? null
        : await fs.readFile(resolveBlueprintPath(loc.projectRoot, target.path), "utf8");
      if (content === null) throw new Error("Verified plan content is unavailable.");
      if (before.status === "absent" && researchDigest(content) !== target.hash) throw new Error(`Plan changed during read: ${target.path}.`);
      return content;
    };
    let responseCursorKey: Uint8Array | null = null;
    const cursorFor = async (target: { path: string; hash: string | null }, offsetBytes: number, totalBytes: number) => {
      if (target.hash === null) throw new Error(`Plan body has no canonical hash: ${target.path}.`);
      responseCursorKey ??= await loadPlanCursorAuthorityKey(loc.projectRoot, true);
      if (!responseCursorKey) throw new Error("Plan body continuation authority is unavailable.");
      const payload = planBodyCursorPayload({
        planId: target.path.match(/-(\d+)-PLAN\.md$/)?.[1] ?? "",
        offsetBytes,
        totalBytes,
        planHash: target.hash,
        publicationToken: before.token,
        filterHash
      });
      return { ...payload, seal: sealPlanCursor(responseCursorKey, "plan", payload) };
    };
    if (bodyMode === "page" && (before.status === "committed" || before.status === "absent")) {
      for (let index = startIndex; index < bodyTargets.length && bodyRemaining > 0; index++) {
        const target = bodyTargets[index];
        const content = await targetContent(target).catch(error => { bodyReadIssue = (error as Error).message; return null; });
        if (content === null) break;
        const totalBytes = Buffer.byteLength(content, "utf8");
        const offsetBytes = index === startIndex ? startOffset : 0;
        if (args.bodyCursor && index === startIndex &&
            (args.bodyCursor.totalBytes !== totalBytes || offsetBytes >= totalBytes && totalBytes > 0 || offsetBytes !== 0 && totalBytes === 0)) {
          throw new Error("Plan body cursor offset or total does not match the current canonical plan.");
        }
        const page = utf8Slice(content, offsetBytes, bodyRemaining);
        const deliveredBytes = Buffer.byteLength(page.content, "utf8");
        bodyRemaining -= deliveredBytes;
        bodies.set(target.path, { content: page.content, contentOffsetBytes: offsetBytes, contentComplete: page.nextOffsetBytes === null });
        if (page.nextOffsetBytes !== null) {
          nextCursor = await cursorFor(target, page.nextOffsetBytes, totalBytes);
          break;
        }
        if (bodyRemaining === 0 && index + 1 < bodyTargets.length) {
          for (let nextIndex = index + 1; nextIndex < bodyTargets.length; nextIndex++) {
            const nextTarget = bodyTargets[nextIndex];
            const nextContent = await targetContent(nextTarget).catch(error => { bodyReadIssue = (error as Error).message; return null; });
            if (nextContent === null) break;
            const nextTotalBytes = Buffer.byteLength(nextContent, "utf8");
            if (nextTotalBytes > 0) { nextCursor = await cursorFor(nextTarget, 0, nextTotalBytes); break; }
          }
        }
      }
    }
    const published = bodyTargets.map(target => ({
      ...target,
      content: bodies.get(target.path)?.content ?? null,
      ...(bodies.has(target.path) ? {
        contentOffsetBytes: bodies.get(target.path)!.contentOffsetBytes,
        contentComplete: bodies.get(target.path)!.contentComplete
      } : {})
    }));
    const after = await readPlanPublicationSnapshot(loc.projectRoot, loc.resolved.phaseDir, loc.resolved.phasePrefix);
    const publicationIssue = bodyReadIssue ?? (before.token !== after.token
      ? "Plan publication changed during this read; refresh before using the plan set."
      : after.status === "pending" || after.status === "invalid"
        ? after.reason
        : before.status === "committed" && before.contents
          ? planPublicationConsumptionIssue(before, before.contents, { complete: true })
          : null);
    if (publicationIssue) {
      for (const file of published) file.content = null;
    }
    const publication = publicationIssue && after.status !== "pending" && after.status !== "invalid"
      ? { status: "invalid" as const, token: after.token, reason: publicationIssue }
      : { status: after.status, token: after.token, reason: after.reason };
    const freshness = session ? await planBasisFreshness(loc.projectRoot, session.phase, session.readSet, session.portable ? [session.portable.basis] : []) : null;
    return { status: session || published.length ? "found" : "not_found", sessionPath: loc.sessionPath, session: publicPlanSession(session, requestedIds), published, publication,
      bodyPage: {
        mode: bodyMode,
        maxBytes: bodyLimit,
        deliveredBytes: bodyMode === "page" && !publicationIssue ? bodyLimit - bodyRemaining : 0,
        nextCursor: publicationIssue ? null : nextCursor
      },
      freshness: boundedFreshness(freshness) };
  });
}

// Owning operations are injectable so interruption tests cover every metadata stage.
export const planDependencies = { compile: compilePlanCandidate, validate: validatePhasePlanCandidateSet, writeText: writeTextFile, remove: (path: string) => fs.unlink(path), stateUpdate: blueprintStateUpdate, stateLoad: blueprintStateLoad };
function markerContent(session: PlanSession, journal: PlanJournal, status: "pending" | "committed", version: 1 | 2 = 2) {
  const files = version === 1
    ? new Map(journal.files.map(({ path, hash }) => [path, hash]))
    : new Map(session.targets.map(({ path, hash }) => [path, hash]));
  if (version === 2) {
    for (const file of journal.files) files.set(file.path, file.hash);
    for (const file of journal.removed) files.delete(file.path);
  }
  return JSON.stringify({
    version,
    status,
    requestId: journal.requestId,
    revision: session.revision,
    files: [...files].sort(([left], [right]) => left.localeCompare(right)).map(([path, hash]) => ({ path, hash })),
    removedPaths: journal.removed.map(file => file.path).sort((left, right) => left.localeCompare(right))
  }, null, 2) + "\n";
}
async function verifyPublished(loc: PlanLocation, journal: PlanJournal, session: PlanSession) {
  for (const file of journal.files) if (await researchInputHash(loc.projectRoot, file.path) !== file.hash) throw new Error(`Published plan changed: ${file.path}.`);
  for (const file of journal.removed) if (await researchInputHash(loc.projectRoot, file.path) !== null) throw new Error(`Removed plan reappeared: ${file.path}.`);
  const expected = new Map(session.targets.map(item => [item.path, item.hash]));
  for (const file of journal.files) expected.set(file.path, file.hash);
  for (const file of journal.removed) expected.delete(file.path);
  const observed = await readPlanTargetHashes(await planLocation({ cwd: loc.projectRoot, phase: session.phase }));
  if (observed.length !== expected.size || observed.some(item => !expected.has(item.path) || expected.get(item.path) !== item.hash)) throw new Error("The complete published plan set changed; retained plans or inventory no longer match the validated set.");
}
async function filesSaved(loc: PlanLocation, journal: PlanJournal) {
  return (await Promise.all(journal.files.map(async file => await researchInputHash(loc.projectRoot, file.path) === file.hash))).every(Boolean);
}

/** Accept reviewed canonical files as the new baseline. No document backups exist. */
async function reconcilePublication(loc: PlanLocation, session: PlanSession, reviewedTargets: Record<string, string | null>, markerToken: string) {
  const current = await planLocation({ cwd: loc.projectRoot, phase: session.phase });
  const topology = phaseTopologyFingerprintFromLocation(current.resolved, current.matchedPhase);
  await withFreshPhaseTopologyForMutation(loc.projectRoot, { phase: session.phase }, topology, "Planning publication reconciliation", async () => withBlueprintRepoLock(loc.projectRoot, "phase-plan-write", async () => {
    const targets = await readPlanTargetHashes(await planLocation({ cwd: loc.projectRoot, phase: session.phase }));
    if (stableResearchValue(Object.fromEntries(targets.map(item => [item.path, item.hash]))) !== stableResearchValue(reviewedTargets)) throw new Error("Planning targets changed during reconciliation; review their new hashes before retrying.");
    const observed = await readPlanPublicationStatus(loc.projectRoot, loc.resolved.phaseDir, loc.resolved.phasePrefix);
    if (observed.token !== markerToken) throw new Error("Publication marker changed during reconciliation; refresh before retrying.");
    // Change the marker before clearing intent. A failure here leaves recovery
    // metadata intact, while replay after a later failure remains idempotent.
    if (observed.status !== "absent") await planDependencies.writeText(resolveBlueprintPath(loc.projectRoot, planPublicationPath(loc.resolved.phaseDir, loc.resolved.phasePrefix)), JSON.stringify({ version: 2, status: "committed", requestId: "reconciled", revision: session.revision, files: targets, removedPaths: [] }, null, 2) + "\n");
    session.topology = topology; session.targets = targets; session.prepared = false; session.needsIntent = true; session.publicationOwned = true; session.readSet = []; session.requests = {};
    delete session.journal; delete session.legacyPublication;
    await savePlanSession(loc, session, true);
  }));
}

export async function blueprintPlanSubmit(raw: z.input<typeof submitInput>) {
  const args = submitInput.parse(raw);
  checkedPlanPayload(args);
  return withPlanSession(args, async loc => {
    const session = await readPlanSession(loc);
    if (!session) return { status: "not_found", saved: false, nextAction: "Call blueprint_plan_prepare first." };
    const reject = (status: string, details: Record<string, unknown>) => ({ status, saved: false, ready: false, outcome: "rejected-not-saved", ...responseBase(loc, session), ...details });
    const hash = requestHash(args), suppliedHash = args.model === undefined ? undefined : researchDigest(stableResearchValue(args.model));
    const accepted = Object.hasOwn(session.requests, args.requestId) ? session.requests[args.requestId] : undefined;
    if (accepted && (accepted.hash !== hash || suppliedHash && accepted.modelHash !== suppliedHash)) return reject("rejected", { reason: "Request ID conflict; retry accepted publication with the same model and control flags." });
    let journal = session.journal?.requestId === args.requestId ? session.journal : undefined;
    if (session.journal && !session.journal.receipt && !journal) return reject("partial", { nextAction: `Retry blueprint_plan_submit requestId ${session.journal.requestId} first, or explicitly reconcile the observed canonical files through prepare.` });
    if (!accepted && args.expectedRevision !== session.revision) return reject("stale", { reason: "Revision conflict." });
    if (accepted?.receipt) {
      if (!journal || journal.revision !== session.revision) return reject("stale", { reason: "This publication belongs to an earlier preparation." });
      try {
        await verifyPublished(loc, journal, session);
        if ((await planBasisFreshness(loc.projectRoot, session.phase, session.readSet, session.portable ? [session.portable.basis] : [])).status !== "fresh") throw new Error("Planning evidence changed after publication; refresh preparation.");
        if (await fs.readFile(resolveBlueprintPath(loc.projectRoot, planPublicationPath(loc.resolved.phaseDir, loc.resolved.phasePrefix)), "utf8") !== markerContent(session, journal, "committed")) throw new Error("Publication marker changed after publication.");
        return accepted.receipt;
      } catch (error) { return reject("stale", { reason: (error as Error).message }); }
    }
    const contents = new Map<string, string>();
    if (!journal) {
      try {
        if (args.model === undefined) return reject("needs_revision", { reason: "Supply model using prepare.schema and prepare.example." });
        const freshness = await planBasisFreshness(loc.projectRoot, session.phase, session.readSet, session.portable ? [session.portable.basis] : []);
        const targets = await planTargetFreshness(loc, session);
        const current = await planLocation({ cwd: loc.projectRoot, phase: session.phase });
        if (!phaseTopologyFingerprintsMatch(session.topology, phaseTopologyFingerprintFromLocation(current.resolved, current.matchedPhase))) return reject("stale", { reason: "Phase topology changed; reconcile preparation." });
        if (!session.prepared || session.needsIntent || freshness.status !== "fresh" || !targets.fresh) return reject("needs_revision", { freshness, targets, nextAction: "Refresh prepare with the intended add/revise/replace mode and review changed inputs before submitting the model." });
        if (session.mode !== "add" && !args.overwrite) return reject("needs_revision", { reason: "Revise/replace requires overwrite=true after the user chooses those targets." });
        const executed = session.targetPlanIds.filter(id => current.artifacts.includes(`${current.resolved.phaseDir}/${current.resolved.phasePrefix}-${id}-SUMMARY.md`));
        if (executed.length) return reject("needs_revision", { reason: "Executed target plans cannot be revised or replaced; add follow-up plans instead.", executedPlanIds: executed });
        if (args.review?.verdict === "revise" || session.checkerRequired && args.review?.verdict !== "accept") return reject("needs_revision", { reason: "Review this model in memory and supply an accepting review verdict when plan_check is enabled." });
        const result = await assess(loc, session, args.model);
        if (!result.valid || !result.plans.length) return reject("needs_revision", { validation: validationSummary(result), nextAction: "Correct the indicated fields and submit again using the same preparation revision. No draft was stored." });
        const files: PlanJournal["files"] = [];
        for (const plan of result.plans) {
          const content = prepareTextForPersistence(plan.content, { label: "Compiled phase plan" }).content;
          if (Buffer.byteLength(content) > 4 * 1024 * 1024) return reject("needs_revision", { reason: "Rendered plan exceeds 4 MiB; reduce repeated prose." });
          const baselineHash = session.targets.find(item => item.path === plan.path)?.hash ?? null;
          if (session.mode === "add" && baselineHash || session.mode === "revise" && !session.targetPlanIds.includes(plan.planId)) return reject("needs_revision", { reason: "Model attempts to overwrite a plan outside the selected targets." });
          const model = plan.model as PhasePlanStructuredModel;
          files.push({ planId: plan.planId, wave: model.wave, taskCount: model.tasks.length, path: plan.path, hash: researchDigest(content), baselineHash });
          contents.set(plan.path, content);
        }
        const removed: PlanJournal["removed"] = [];
        if (session.mode === "replace") for (const id of session.targetPlanIds) {
          const path = `${loc.resolved.phaseDir}/${loc.resolved.phasePrefix}-${id}-PLAN.md`;
          if (files.some(file => file.path === path)) continue;
          const baselineHash = session.targets.find(item => item.path === path)?.hash;
          if (!baselineHash) return reject("stale", { reason: `Selected replacement target is missing: ${path}.` });
          removed.push({ path, baselineHash });
        }
        const marker = await readPlanPublicationStatus(loc.projectRoot, loc.resolved.phaseDir, loc.resolved.phasePrefix);
        if (session.legacyPublication || marker.status === "pending" || marker.status === "invalid") return reject("partial", { reason: marker.reason, nextAction: "Prepare and reconcile the observed canonical files before publishing." });
        // Accepted publication intent contains only hashes, paths and stages.
        // Neither rejected models nor copies of accepted documents are stored.
        session.revision++;
        journal = { requestId: args.requestId, requestHash: hash, revision: session.revision, modelHash: suppliedHash!, baselineMarkerToken: marker.token, files, removed, stages: {} };
        session.journal = journal; session.requests[args.requestId] = { hash, modelHash: suppliedHash!, revision: session.revision };
        await savePlanSession(loc, session);
      } catch (error) {
        if (!journal) return reject("needs_revision", { reason: (error as Error).message, nextAction: "Correct the model or refresh preparation and retry. No draft was stored." });
        return { status: "partial", saved: false, ready: false, ...responseBase(loc, session), reason: (error as Error).message, nextAction: "Retry submit with the same requestId, original expectedRevision and model." };
      }
    }
    const publicationPath = planPublicationPath(loc.resolved.phaseDir, loc.resolved.phasePrefix);
    const assertFresh = async () => {
      const fresh = await planBasisFreshness(loc.projectRoot, session.phase, session.readSet, session.portable ? [session.portable.basis] : []);
      if (fresh.status !== "fresh") throw new Error(`Planning evidence changed: ${[...fresh.stalePaths, ...fresh.unknownPaths].join(", ")}. Reconcile observed canonical files before continuing.`);
    };
    try {
      await assertFresh();
      if (!contents.size && !await filesSaved(loc, journal)) {
        if (args.model === undefined) throw new Error("Resend the same model to finish publication; no document draft is retained.");
        const result = await assess(loc, session, args.model);
        if (!result.valid) throw new Error("The supplied model no longer validates against the observed plan set; reconcile before publishing.");
        for (const plan of result.plans) contents.set(plan.path, prepareTextForPersistence(plan.content, { label: "Compiled phase plan" }).content);
        if (journal.files.some(file => !contents.has(file.path) || researchDigest(contents.get(file.path)!) !== file.hash)) throw new Error("The supplied model does not reproduce the accepted publication hashes.");
      }
      await withFreshPhaseTopologyForMutation(loc.projectRoot, { phase: session.phase }, session.topology, "Plan-set publication", async () => withBlueprintRepoLock(loc.projectRoot, "phase-plan-write", async () => {
        await assertFresh();
        const checkpoint = () => savePlanSession(loc, session, true);
        const current = await planLocation({ cwd: loc.projectRoot, phase: session.phase });
        const desiredPaths = new Set(journal!.files.map(file => file.path)), removedPaths = new Set(journal!.removed.map(file => file.path)), originalPaths = new Set(session.targets.map(item => item.path));
        for (const target of await readPlanTargetHashes(current)) {
          if (!originalPaths.has(target.path) && !desiredPaths.has(target.path)) throw new Error(`An unreviewed plan appeared during publication: ${target.path}.`);
          if (!desiredPaths.has(target.path) && !removedPaths.has(target.path) && session.targets.find(item => item.path === target.path)?.hash !== target.hash) throw new Error(`Unselected plan changed: ${target.path}.`);
        }
        for (const target of session.targets) if (!desiredPaths.has(target.path) && !removedPaths.has(target.path) && await researchInputHash(loc.projectRoot, target.path) !== target.hash) throw new Error(`Unselected plan changed: ${target.path}.`);
        if (journal!.stages.commit !== "complete") {
          const observedMarker = await readPlanPublicationStatus(loc.projectRoot, loc.resolved.phaseDir, loc.resolved.phasePrefix, { allowOwnedMissing: true });
          const pendingToken = researchDigest(markerContent(session, journal!, "pending"));
          const committedToken = researchDigest(markerContent(session, journal!, "committed"));
          const legacyPendingToken = researchDigest(markerContent(session, journal!, "pending", 1));
          const legacyCommittedToken = researchDigest(markerContent(session, journal!, "committed", 1));
          if (![journal!.baselineMarkerToken, pendingToken, committedToken, legacyPendingToken, legacyCommittedToken].includes(observedMarker.token)) throw new Error("Publication marker changed externally; refusing to overwrite it.");
          if (!journal!.stages.files) {
            for (const file of [...journal!.files, ...journal!.removed]) if (await researchInputHash(loc.projectRoot, file.path) !== file.baselineHash) throw new Error(`Plan target changed before publication: ${file.path}.`);
            journal!.stages.files = "intent"; await checkpoint();
          }
          if (observedMarker.token === journal!.baselineMarkerToken) await planDependencies.writeText(resolveBlueprintPath(loc.projectRoot, publicationPath), markerContent(session, journal!, "pending"));
          for (const file of journal!.files) {
            const observed = await researchInputHash(loc.projectRoot, file.path);
            if (observed === file.hash) continue;
            if (observed !== file.baselineHash) throw new Error(`Plan target changed externally: ${file.path}.`);
            const content = contents.get(file.path);
            if (content === undefined || researchDigest(content) !== file.hash) throw new Error("Resend the accepted model to finish the missing plan files.");
            await planDependencies.writeText(resolveBlueprintPath(loc.projectRoot, file.path), content);
          }
          for (const file of journal!.removed) {
            const observed = await researchInputHash(loc.projectRoot, file.path);
            if (observed === null) continue;
            if (observed !== file.baselineHash) throw new Error(`Replacement target changed externally: ${file.path}.`);
            await planDependencies.remove(resolveBlueprintPath(loc.projectRoot, file.path));
          }
          await verifyPublished(loc, journal!, session); await assertFresh();
          journal!.stages.files = "complete"; journal!.stages.commit = "intent"; await checkpoint();
          await planDependencies.writeText(resolveBlueprintPath(loc.projectRoot, publicationPath), markerContent(session, journal!, "committed"));
          journal!.stages.commit = "complete"; session.publicationOwned = true; await checkpoint();
        } else {
          const observedMarker = await fs.readFile(resolveBlueprintPath(loc.projectRoot, publicationPath), "utf8");
          const committedMarker = markerContent(session, journal!, "committed");
          const legacyCommittedMarker = markerContent(session, journal!, "committed", 1);
          if (observedMarker !== committedMarker && observedMarker !== legacyCommittedMarker) throw new Error("Committed publication marker changed externally.");
          await verifyPublished(loc, journal!, session);
          if (observedMarker === legacyCommittedMarker) await planDependencies.writeText(resolveBlueprintPath(loc.projectRoot, publicationPath), committedMarker);
        }
      }));
      await assertFresh();
      if (journal.stages.state !== "complete") {
        journal.stages.state = "intent"; await savePlanSession(loc, session);
        await planDependencies.stateUpdate({ cwd: loc.projectRoot, base: "synced", patch: { currentPhase: session.phase, activeCommand: "/blu-plan-phase" } });
        journal.stages.state = "complete"; await savePlanSession(loc, session);
      }
      const state = await planDependencies.stateLoad({ cwd: loc.projectRoot });
      const nextAction = await safeNextAction(state.derivedStatus.nextAction);
      if (!nextAction) throw new Error("No implemented follow-up is available.");
      return await withFreshPhaseTopologyForMutation(loc.projectRoot, { phase: session.phase }, session.topology, "Plan-set completion", async () => withBlueprintRepoLock(loc.projectRoot, "phase-plan-write", async () => {
        await verifyPublished(loc, journal!, session); await assertFresh();
        const index = await blueprintPhasePlanIndex({ cwd: loc.projectRoot, phase: session.phase });
        if (!index.phaseFound || !index.plans.length || index.plans.some(plan => !plan.valid)) throw new Error("The published plan index is no longer valid.");
        await verifyPublished(loc, journal!, session);
        const targets = new Map(session.targets.map(item => [item.path, item.hash]));
        for (const file of journal!.files) targets.set(file.path, file.hash);
        for (const file of journal!.removed) targets.delete(file.path);
        session.targets = [...targets].sort(([left], [right]) => left.localeCompare(right)).map(([path, hash]) => ({ path, hash }));
        session.existingPlans = index.plans.map(plan => ({ planId: plan.planId, wave: plan.wave ?? 1, dependsOn: plan.dependsOn, requirements: plan.requirements }));
        journal!.stages.routing = "complete"; session.needsIntent = true; session.publicationOwned = true;
        journal!.receipt = { status: "published", saved: true, ready: true, ...responseBase(loc, session), paths: journal!.files.map(file => file.path), plans: journal!.files.map(({ planId, wave, taskCount, path }) => ({ planId, wave, taskCount, path })), removedPaths: journal!.removed.map(file => file.path), stages: { ...journal!.stages }, nextAction };
        session.requests[args.requestId].receipt = journal!.receipt;
        await savePlanSession(loc, session, true);
        return journal!.receipt;
      }));
    } catch (error) {
      const saved = await filesSaved(loc, journal).catch(() => false);
      return { status: "partial", saved, ready: false, ...responseBase(loc, session), stages: journal.stages, reason: (error as Error).message, nextAction: `Retry blueprint_plan_submit with requestId ${args.requestId} and the original expectedRevision/control flags${saved ? "; all canonical plan files are saved and model may be omitted" : "; resend model because no document draft is retained"}. Reconcile changed inputs or targets through prepare.` };
    }
  });
}

export const planningToolDefinitions: ToolDefinition[] = [
  { name: "blueprint_plan_prepare", description: "Prepare bounded phase evidence, exact model schema/example, derivable fields and meaningful validation rules for first-attempt plan publication. Saves only preparation metadata. Pass sealed evidenceBudget continuations back unchanged for truncated bodies. Existing plans require add/revise/replace intent.", inputSchema: prepareInputShape, handler: args => blueprintPlanPrepare(args as z.input<typeof prepareInput>) },
  { name: "blueprint_plan_submit", description: "Normalize and validate a model in memory, then publish the complete canonical plan set. Rejected drafts are never saved. An optional configured checker reviews the supplied model before this call. Retry interrupted publication with the same model until all canonical plans are saved.", inputSchema: submitInput.shape, handler: args => blueprintPlanSubmit(args as z.input<typeof submitInput>) },
  { name: "blueprint_plan_read", description: "Read bounded canonical plan metadata, body pages, preparation summary, publication stages and evidence freshness. planIds narrows metadata and bodies. Use bodyMode=metadata when no body is needed, or pass the sealed bodyPage.nextCursor back unchanged with the same planIds filter. No rejected drafts, document history or backups are retained.", inputSchema: readInputShape, handler: args => blueprintPlanRead(args as z.input<typeof lookupSchema>) },
];
