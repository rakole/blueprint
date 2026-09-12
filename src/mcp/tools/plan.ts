import { promises as fs } from "node:fs";
import * as z from "zod/v4";
import { prepareTextForPersistence, safeJsonParseObject, validateFieldNameSegment } from "../../shared/security.js";
import type { ToolDefinition } from "../tool-types.js";
import { isBootstrapStarterContext, resolveBlueprintPath, validatePhaseArtifactContent, withBlueprintRepoLock, writeTextFile } from "./artifacts.js";
import { artifactPathFor } from "./phase-locations.js";
import { blueprintPhasePlanIndex, blueprintPhasePlanReadiness, validatePhasePlanCandidateSet } from "./phase.js";
import { planningCandidateJsonSchema, compilePlanCandidate } from "./plan-model.js";
import type { PhasePlanStructuredModel } from "./phase-plan-rendering.js";
import { blueprintStateLoad, blueprintStateUpdate } from "./state.js";
import { blueprintCommandCatalog } from "./project.js";
import { withFreshPhaseTopologyForMutation } from "./phase-resolution.js";
import { phaseTopologyFingerprintFromLocation, phaseTopologyFingerprintsMatch } from "./phase-topology-lock.js";
import { researchDigest, researchInputHash, stableResearchValue } from "./research-evidence.js";
import { capturePlanEvidence, planBasisFreshness, planTargetFreshness, readPlanTargetHashes } from "./plan-evidence.js";
import { checkedPlanPayload, initialPlanSession, planLocation, planLookup, planNumericPhase, planPublicationPath, planRequestId, readPlanPublicationStatus, readPlanSession, savePlanSession, withPlanSession, type PlanJournal, type PlanLocation, type PlanSession } from "./plan-session.js";

const mode = z.enum(["add", "revise", "replace"]);
const planId = z.string().regex(/^\d+$/).transform(value => value.padStart(2, "0"));
const prepareInput = z.object({
  cwd: z.string().optional(), phase: planNumericPhase.optional(), mode: mode.optional(), targetPlanIds: z.array(planId).max(100).optional(),
  evidencePaths: z.array(z.string().min(1)).max(60).optional(), expectedRevision: z.number().int().nonnegative().optional(), acknowledgeChangedInputs: z.boolean().optional(),
  reconcile: z.object({ confirmed: z.literal(true), targetHashes: z.record(z.string(), z.string().nullable()) }).optional(),
});
const correction = z.object({ path: z.array(z.string()).min(1).max(20), operation: z.enum(["set", "remove"]).default("set"), value: z.unknown().optional() });
const submitInput = z.object({ ...planLookup, requestId: planRequestId, expectedRevision: z.number().int().nonnegative(), candidate: z.unknown().optional(), corrections: z.array(correction).max(50).optional() });
const reviewInput = z.object({ revision: z.number().int().nonnegative(), candidateHash: z.string().regex(/^[a-f0-9]{64}$/), verdict: z.enum(["accept", "revise"]), summary: z.string().min(1).max(20000) });
const finalizeInput = z.object({ ...planLookup, requestId: planRequestId, expectedRevision: z.number().int().nonnegative(), overwrite: z.boolean().optional(), review: reviewInput.optional() });
const lookupSchema = z.object(planLookup);

function requestHash(args: Record<string, unknown>) {
  const { cwd: _cwd, ...logical } = args;
  return researchDigest(stableResearchValue(logical));
}
function responseBase(loc: PlanLocation, session: PlanSession) {
  return { saved: session.candidate !== undefined, revision: session.revision, candidateHash: session.candidateHash, sessionPath: loc.sessionPath };
}
async function safeNextAction(proposed?: string | null) {
  const catalog = await blueprintCommandCatalog();
  const command = proposed?.match(/\/blu-([a-z][a-z-]*)\b/)?.[1];
  if (command && catalog.commands[command]?.implemented) return proposed!;
  return catalog.commands.progress?.implemented ? "Run /blu-progress to review the next safe action." : null;
}
function pendingRequest(session: PlanSession, except?: string) {
  return Object.entries(session.requests).find(([id, request]) => id !== except && !request.receipt);
}
function replay(session: PlanSession, id: string, hash: string) {
  const previous = Object.hasOwn(session.requests, id) ? session.requests[id] : undefined;
  if (previous && previous.hash !== hash) return { status: "rejected", reason: "Request ID conflict", revision: session.revision };
  return previous?.receipt ?? null;
}
async function saveReceipt(loc: PlanLocation, session: PlanSession, id: string, value: Record<string, unknown>) {
  session.requests[id].receipt = value;
  await savePlanSession(loc, session);
  return value;
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

function boundedEvidence(inputs: Awaited<ReturnType<typeof capturePlanEvidence>>["inputs"]) {
  let remaining = 12000;
  const priority = (path: string) => /-CONTEXT\.md$/.test(path) ? 0 : /-RESEARCH\.md$/.test(path) ? 1 : /-(?:UI-)?SPEC\.md$/.test(path) ? 2 : /\/(?:PROJECT|REQUIREMENTS)\.md$/.test(path) ? 3 : 4;
  return [...inputs].sort((left, right) => priority(left.path) - priority(right.path)).map(input => {
    const content = input.content === null ? null : input.content.slice(0, Math.min(3000, remaining));
    remaining -= content?.length ?? 0;
    return { ...input, content, truncated: (input.content?.length ?? 0) > (content?.length ?? 0) };
  });
}

export async function blueprintPlanPrepare(raw: z.input<typeof prepareInput> = {}) {
  const args = prepareInput.parse(raw);
  try {
    return await withPlanSession(args, async loc => {
      const session = await readPlanSession(loc) ?? initialPlanSession(loc);
      let pending = pendingRequest(session);
      if (pending && args.reconcile && session.journal && args.expectedRevision === session.revision && args.acknowledgeChangedInputs) {
        const observed = await readPlanTargetHashes(await planLocation({ cwd: loc.projectRoot, phase: session.phase }));
        if (stableResearchValue(Object.fromEntries(observed.map(item => [item.path, item.hash]))) !== stableResearchValue(args.reconcile.targetHashes)) return { status: "reconciliation_required", ...responseBase(loc, session), targetHashes: Object.fromEntries(observed.map(item => [item.path, item.hash])), reason: "Reconciliation requires the currently observed target hashes." };
        await rollbackPublication(loc, session, args.reconcile.targetHashes);
        loc = await planLocation({ cwd: loc.projectRoot, phase: session.phase });
        pending = pendingRequest(session);
      }
      if (pending) return { status: "partial", ...responseBase(loc, session), targetHashes: Object.fromEntries((await readPlanTargetHashes(loc)).map(item => [item.path, item.hash])), nextAction: `Retry blueprint_plan_${pending[1].operation} with requestId ${pending[0]} and identical arguments. If external evidence changed, prepare with expectedRevision, acknowledgeChangedInputs=true and reconcile containing observed targetHashes to restore the previous plans before refreshing.` };
      const marker = await readPlanPublicationStatus(loc.projectRoot, loc.resolved.phaseDir, loc.resolved.phasePrefix);
      if (marker.status === "pending" || marker.status === "invalid") return { status: "partial", ...responseBase(loc, session), reason: marker.reason, nextAction: "Resume the original finalize request before changing preparation." };
      const initialTargets = await readPlanTargetHashes(loc);
      const capture = await capturePlanEvidence(loc, [...new Set([...session.evidencePaths, ...args.evidencePaths ?? []])]);
      const readiness = await blueprintPhasePlanReadiness({ cwd: loc.projectRoot, phase: session.phase, bodyMode: "summary" });
      const current = await planLocation({ cwd: loc.projectRoot, phase: session.phase });
      const fresh = await planBasisFreshness(loc.projectRoot, session.phase, capture.readSet);
      const targets = await readPlanTargetHashes(current);
      const finalMarker = await readPlanPublicationStatus(loc.projectRoot, loc.resolved.phaseDir, loc.resolved.phasePrefix);
      if (fresh.status !== "fresh" || marker.token !== finalMarker.token || stableResearchValue(targets) !== stableResearchValue(initialTargets) || !phaseTopologyFingerprintsMatch(phaseTopologyFingerprintFromLocation(loc.resolved, loc.matchedPhase), phaseTopologyFingerprintFromLocation(current.resolved, current.matchedPhase))) return { status: "stale", ...responseBase(loc, session), freshness: fresh, nextAction: "Retry prepare; inputs changed during collection." };
      const gates = await readinessGates(loc, readiness, capture.inputs);
      const plans = readiness.planIndex?.plans ?? [];
      const packet = {
        phase: readiness.phaseSelection, gates, config: { workflow: readiness.effectiveConfig.workflow },
        requirements: readiness.context?.requirementsGrounding, projectBrief: readiness.context?.projectBrief,
        evidence: boundedEvidence(capture.inputs),
        existingPlans: plans.map(({ planId, path, title, wave, dependsOn, requirements, status }) => ({ planId, path, title, wave, dependsOn, requirements, status })),
        targetHashes: Object.fromEntries(targets.map(item => [item.path, item.hash])),
        planningCandidateJsonSchema,
      };
      if (args.expectedRevision !== undefined && args.expectedRevision !== session.revision) return { ...packet, status: "stale", ...responseBase(loc, session), reason: "Revision conflict" };
      if (plans.length && !args.mode && (!session.readSet.length || session.journal?.receipt || session.needsIntent)) {
        await savePlanSession(loc, session);
        return { ...packet, status: "choice_required", ...responseBase(loc, session), nextAction: "Choose add, revise selected plans, or replace selected plans; supply mode and targetPlanIds for revise/replace." };
      }
      const nextMode = args.mode ?? session.mode;
      const targetPlanIds = [...new Set(args.targetPlanIds ?? (nextMode === "add" ? [] : nextMode === "replace" && args.mode ? plans.map(plan => plan.planId) : session.targetPlanIds))];
      if (nextMode === "add" && targetPlanIds.length || nextMode !== "add" && !targetPlanIds.length || targetPlanIds.some(id => !plans.some(plan => plan.planId === id))) return { ...packet, status: "choice_required", ...responseBase(loc, session), reason: "Add accepts no targets; revise/replace require existing selected targetPlanIds." };
      const changed = session.readSet.length ? await planBasisFreshness(loc.projectRoot, session.phase, session.readSet) : null;
      const topologyChanged = !phaseTopologyFingerprintsMatch(session.topology, phaseTopologyFingerprintFromLocation(current.resolved, current.matchedPhase));
      const targetsChanged = session.readSet.length > 0 && stableResearchValue(targets) !== stableResearchValue(session.targets);
      const modeChanged = session.readSet.length > 0 && (nextMode !== session.mode || stableResearchValue(targetPlanIds) !== stableResearchValue(session.targetPlanIds));
      const selectedEvidenceChanged = session.readSet.length > 0 && stableResearchValue(capture.evidencePaths) !== stableResearchValue(session.evidencePaths);
      if ((targetsChanged || topologyChanged) && (!args.reconcile || args.expectedRevision !== session.revision || stableResearchValue(args.reconcile.targetHashes) !== stableResearchValue(packet.targetHashes))) return { ...packet, status: "reconciliation_required", ...responseBase(loc, session), reason: "Review changed topology and publication targets, then prepare with expectedRevision and reconcile containing the observed targetHashes." };
      if ((changed && changed.status !== "fresh" || modeChanged && !session.needsIntent || selectedEvidenceChanged) && (!args.acknowledgeChangedInputs || args.expectedRevision !== session.revision)) return { ...packet, status: "stale", ...responseBase(loc, session), freshness: changed, nextAction: "Review the changed evidence or scope, then prepare with expectedRevision and acknowledgeChangedInputs=true. Saved candidates remain available." };
      const unchanged = !session.needsIntent && !session.journal?.receipt && session.prepared === gates.ready && session.readSet.length && !topologyChanged && !targetsChanged && !modeChanged && !selectedEvidenceChanged && changed?.status === "fresh";
      if (!unchanged) {
        session.history.push({ revision: session.revision, kind: "prepare", readSet: session.readSet, targets: session.targets, ...(session.journal ? { journal: session.journal } : {}) });
        delete session.journal;
        session.topology = phaseTopologyFingerprintFromLocation(current.resolved, current.matchedPhase);
        session.prepared = gates.ready; session.mode = nextMode; session.targetPlanIds = targetPlanIds;
        if (args.mode) session.needsIntent = false;
        session.readSet = capture.readSet; session.evidencePaths = capture.evidencePaths; session.targets = targets;
        session.existingPlans = plans.map(plan => ({ planId: plan.planId, wave: plan.wave ?? 1, dependsOn: plan.dependsOn, requirements: plan.requirements }));
        session.knownRequirements = readiness.authoringContext.knownRequirements;
        const selectedPaths = new Set(targetPlanIds.map(id => `${loc.resolved.phaseDir}/${loc.resolved.phasePrefix}-${id}-PLAN.md`));
        session.knownEvidenceArtifacts = readiness.authoringContext.knownEvidenceArtifacts.filter(p => !selectedPaths.has(p));
        session.checkerRequired = gates.checkerRequired;
        session.revision++;
        await savePlanSession(loc, session);
      }
      return { ...packet, status: gates.ready ? "prepared" : "blocked", ...responseBase(loc, session), mode: nextMode, targetPlanIds, knownRequirements: session.knownRequirements, knownEvidenceArtifacts: session.knownEvidenceArtifacts, nextAction: gates.ready ? "Draft the compact plan set using the saved evidence, then call blueprint_plan_submit once. Read any truncated required evidence before relying on it. Planning performs no live external research." : await safeNextAction(readiness.nextSafeAction) };
    });
  } catch (error) {
    return { status: "blocked", reason: (error as Error).message, nextAction: await safeNextAction("Run /blu-progress to resolve planning preparation.") };
  }
}

function correctedCandidate(session: PlanSession, args: z.infer<typeof submitInput>) {
  if (args.candidate !== undefined && args.corrections?.length) throw new Error("Supply a candidate or field corrections, not both.");
  if (args.candidate !== undefined) return checkedPlanPayload(args.candidate);
  if (!args.corrections?.length) throw new Error("Supply a candidate or field corrections.");
  let candidate = checkedPlanPayload(session.candidate);
  if (typeof candidate === "string") candidate = safeJsonParseObject(candidate, { label: "Saved planning candidate", maxBytes: 1024 * 1024 });
  for (const change of args.corrections) {
    change.path.forEach(segment => {
      validateFieldNameSegment(segment);
      if (["__proto__", "prototype", "constructor"].includes(segment)) throw new Error("Unsafe correction path.");
    });
    let target = candidate as Record<string, unknown>;
    for (const segment of change.path.slice(0, -1)) {
      if (!target || typeof target !== "object" || !Object.hasOwn(target, segment)) throw new Error("Correction parent does not exist.");
      target = target[segment] as Record<string, unknown>;
    }
    if (!target || typeof target !== "object") throw new Error("Correction target is not an object.");
    const field = change.path.at(-1)!;
    if (Array.isArray(target) && (!/^(0|[1-9]\d*)$/.test(field) || Number(field) > target.length || change.operation === "remove" && Number(field) === target.length)) throw new Error("Array correction requires an existing index, or the next index when setting.");
    if (change.operation === "remove") { if (Array.isArray(target)) target.splice(Number(field), 1); else delete target[field]; }
    else target[field] = checkedPlanPayload(change.value);
  }
  return checkedPlanPayload(candidate);
}

async function assess(loc: PlanLocation, session: PlanSession) {
  const compiled = planDependencies.compile(session.candidate, { knownRequirements: session.knownRequirements, knownEvidenceArtifacts: session.knownEvidenceArtifacts, existingPlans: session.existingPlans, mode: session.mode, targetPlanIds: session.targetPlanIds });
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

export async function blueprintPlanSubmit(raw: z.input<typeof submitInput>) {
  const args = submitInput.parse(raw);
  checkedPlanPayload(args);
  return withPlanSession(args, async loc => {
    const session = await readPlanSession(loc);
    if (!session) return { status: "not_found", saved: false, nextAction: "Call blueprint_plan_prepare first." };
    const hash = requestHash(args), previous = replay(session, args.requestId, hash);
    if (previous) return previous;
    const pending = pendingRequest(session, args.requestId);
    if (pending) {
      const marker = await readPlanPublicationStatus(loc.projectRoot, loc.resolved.phaseDir, loc.resolved.phasePrefix);
      const canCorrect = args.expectedRevision === session.revision && (args.candidate !== undefined || Boolean(args.corrections?.length)) && (!session.journal || Boolean(session.journal.receipt)) && (marker.status === "absent" || marker.status === "committed");
      if (!canCorrect) return { status: "partial", ...responseBase(loc, session), nextAction: `Retry blueprint_plan_${pending[1].operation} with requestId ${pending[0]} first. A current-revision correction can supersede an interrupted assessment only before publication begins.` };
      // The session lock proves no other assessment is currently active. Validate
      // correction syntax first, then save the old receipt with the new revision.
      correctedCandidate(session, args);
      pending[1].receipt = { status: "superseded", ...responseBase(loc, session), ready: false, reason: "A current-revision candidate correction superseded this interrupted assessment. Original candidate history is retained." };
    }
    const accepted = Object.hasOwn(session.requests, args.requestId) ? session.requests[args.requestId] : undefined;
    if (!accepted) {
      if (args.expectedRevision !== session.revision) return { status: "stale", ...responseBase(loc, session), reason: "Revision conflict" };
      const candidate = correctedCandidate(session, args);
      if (session.journal) { session.history.push({ revision: session.revision, kind: "published", journal: session.journal }); delete session.journal; }
      session.candidate = candidate; session.candidateHash = researchDigest(stableResearchValue(candidate)); session.revision++;
      session.history.push({ revision: session.revision, kind: "submit", candidate });
      session.requests[args.requestId] = { hash, revision: session.revision, operation: "submit" };
      // The original object or exact raw JSON string is durable before any assessment.
      await savePlanSession(loc, session);
    } else if (accepted.operation !== "submit" || accepted.revision !== session.revision) return { status: "stale", ...responseBase(loc, session), reason: "Accepted request was superseded." };
    try {
      const freshness = await planBasisFreshness(loc.projectRoot, session.phase, session.readSet);
      const result = await assess(loc, session);
      const valid = session.prepared && !session.needsIntent && freshness.status === "fresh" && result.valid;
      return await saveReceipt(loc, session, args.requestId, { status: valid ? "ready" : "needs_revision", ...responseBase(loc, session), validation: validationSummary(result), planIds: result.planIds, freshness, checkerRequired: session.checkerRequired, ...(valid ? { reviewPacket: { revision: session.revision, candidateHash: session.candidateHash, plans: result.plans.map(({ planId, path, model }) => ({ planId, path, model })) } } : {}), nextAction: valid ? session.checkerRequired ? "Review this complete candidate set; finalize with the review verdict bound to this revision and candidateHash." : "Call blueprint_plan_finalize with this revision." : session.needsIntent ? "The draft is saved. Call blueprint_plan_prepare with an explicit add/revise/replace mode before requesting readiness or publication." : "The candidate is saved. Refresh stale preparation or correct only the fields identified by diagnostics, then submit with a new requestId." });
    } catch (error) {
      return { status: "partial", ...responseBase(loc, session), reason: (error as Error).message, nextAction: `The candidate is saved. Retry blueprint_plan_submit with requestId ${args.requestId} and identical arguments to resume assessment.` };
    }
  });
}

export async function blueprintPlanRead(raw: z.input<typeof lookupSchema>) {
  const args = lookupSchema.parse(raw);
  return withPlanSession(args, async loc => {
    const session = await readPlanSession(loc);
    return { status: session ? "found" : "not_found", sessionPath: loc.sessionPath, session, freshness: session ? await planBasisFreshness(loc.projectRoot, session.phase, session.readSet) : null, publication: await readPlanPublicationStatus(loc.projectRoot, loc.resolved.phaseDir, loc.resolved.phasePrefix) };
  });
}

// Owning operations are injectable so interruption tests cover every durable stage.
export const planDependencies = { compile: compilePlanCandidate, validate: validatePhasePlanCandidateSet, readiness: blueprintPhasePlanReadiness, writeText: writeTextFile, remove: (path: string) => fs.unlink(path), stateUpdate: blueprintStateUpdate, stateLoad: blueprintStateLoad };

function markerContent(session: PlanSession, journal: PlanJournal, status: "pending" | "committed") {
  return JSON.stringify({ version: 1, status, requestId: journal.requestId, revision: session.revision, files: journal.files.map(({ path, hash }) => ({ path, hash })), removedPaths: journal.removed.map(file => file.path) }, null, 2) + "\n";
}
async function verifyPublished(loc: PlanLocation, journal: PlanJournal, session: PlanSession) {
  for (const file of journal.files) if (await researchInputHash(loc.projectRoot, file.path) !== file.hash) throw new Error(`Published plan changed: ${file.path}.`);
  for (const file of journal.removed) if (await researchInputHash(loc.projectRoot, file.path) !== null) throw new Error(`Removed plan reappeared: ${file.path}.`);
  const expected = new Map(session.targets.map(item => [item.path, item.hash]));
  for (const file of journal.files) expected.set(file.path, file.hash);
  for (const file of journal.removed) expected.delete(file.path);
  const observed = await readPlanTargetHashes(await planLocation({ cwd: loc.projectRoot, phase: session.phase }));
  if (observed.length !== expected.size || observed.some(item => !expected.has(item.path) || expected.get(item.path) !== item.hash)) throw new Error("The complete published plan set changed; retained plans or inventory no longer match the validated candidate set.");
}

/** Explicit reconciliation rolls back only bytes owned by this interrupted write. */
async function rollbackPublication(loc: PlanLocation, session: PlanSession, reviewedTargets: Record<string, string | null>) {
  const journal = session.journal!;
  const current = await planLocation({ cwd: loc.projectRoot, phase: session.phase });
  const topology = phaseTopologyFingerprintFromLocation(current.resolved, current.matchedPhase);
  await withFreshPhaseTopologyForMutation(loc.projectRoot, { phase: session.phase }, topology, "Planning publication reconciliation", async () => withBlueprintRepoLock(loc.projectRoot, "phase-plan-write", async () => {
    const targets = await readPlanTargetHashes(await planLocation({ cwd: loc.projectRoot, phase: session.phase }));
    if (stableResearchValue(Object.fromEntries(targets.map(item => [item.path, item.hash]))) !== stableResearchValue(reviewedTargets)) throw new Error("Planning targets changed during reconciliation; review their new hashes before retrying.");
    const publicationPath = planPublicationPath(loc.resolved.phaseDir, loc.resolved.phasePrefix);
    const observedMarker = await fs.readFile(resolveBlueprintPath(loc.projectRoot, publicationPath), "utf8").catch(error => { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; });
    if (![journal.baselineMarker, markerContent(session, journal, "pending"), markerContent(session, journal, "committed")].includes(observedMarker)) throw new Error("Publication marker changed externally; reconciliation will not overwrite it.");
    // Reinstate the read barrier even when file publication committed before a later failure.
    await planDependencies.writeText(resolveBlueprintPath(loc.projectRoot, publicationPath), markerContent(session, journal, "pending"));
    for (const file of journal.files) {
      const observed = await researchInputHash(loc.projectRoot, file.path);
      if (observed !== file.hash) continue; // Preserve separately changed files, which the user just reviewed.
      if (file.backup === null) await planDependencies.remove(resolveBlueprintPath(loc.projectRoot, file.path));
      else await planDependencies.writeText(resolveBlueprintPath(loc.projectRoot, file.path), file.backup);
    }
    for (const file of journal.removed) if (await researchInputHash(loc.projectRoot, file.path) === null) await planDependencies.writeText(resolveBlueprintPath(loc.projectRoot, file.path), file.backup);
    // Journal and request history remain available after rebasing preparation.
    session.history.push({ revision: session.revision, kind: "publication-reconciled", journal });
    session.requests[journal.requestId].receipt = { status: "superseded", ...responseBase(loc, session), ready: false, reason: "Interrupted publication was explicitly reconciled; use the refreshed session revision." };
    session.topology = topology;
    session.targets = await readPlanTargetHashes(await planLocation({ cwd: loc.projectRoot, phase: session.phase }));
    delete session.journal;
    session.prepared = false;
    if (journal.baselineMarker === null) await planDependencies.remove(resolveBlueprintPath(loc.projectRoot, publicationPath));
    else await planDependencies.writeText(resolveBlueprintPath(loc.projectRoot, publicationPath), journal.baselineMarker);
    await savePlanSession(loc, session, true);
  }));
}

export async function blueprintPlanFinalize(raw: z.input<typeof finalizeInput>) {
  const args = finalizeInput.parse(raw);
  checkedPlanPayload(args);
  return withPlanSession(args, async loc => {
    const session = await readPlanSession(loc);
    if (!session) return { status: "not_found", saved: false, nextAction: "Call blueprint_plan_prepare first." };
    const hash = requestHash(args), previous = replay(session, args.requestId, hash);
    if (previous) {
      if (previous.status === "published" && previous.revision !== session.revision) return { ...previous, status: "superseded", ready: false, nextAction: "This receipt belongs to an earlier session revision; use blueprint_plan_read for the current candidate and publication." };
      if (previous.status === "published" && session.journal?.requestId === args.requestId) {
        try {
          await verifyPublished(loc, session.journal, session);
          if ((await planBasisFreshness(loc.projectRoot, session.phase, session.readSet)).status !== "fresh") throw new Error("Planning evidence changed after publication; refresh preparation.");
          if (await fs.readFile(resolveBlueprintPath(loc.projectRoot, planPublicationPath(loc.resolved.phaseDir, loc.resolved.phasePrefix)), "utf8") !== markerContent(session, session.journal, "committed")) throw new Error("Publication marker changed after publication.");
        }
        catch (error) { return { status: "stale", ...responseBase(loc, session), reason: (error as Error).message }; }
      }
      return previous;
    }
    const pending = pendingRequest(session, args.requestId);
    if (pending) return { status: "partial", ...responseBase(loc, session), nextAction: `Retry blueprint_plan_${pending[1].operation} with requestId ${pending[0]} first.` };
    const accepted = Object.hasOwn(session.requests, args.requestId) ? session.requests[args.requestId] : undefined;
    if (!accepted) {
      if (args.expectedRevision !== session.revision) return { status: "stale", ...responseBase(loc, session), reason: "Revision conflict" };
      session.requests[args.requestId] = { hash, revision: session.revision, operation: "finalize" };
      await savePlanSession(loc, session);
    } else if (accepted.operation !== "finalize" || accepted.revision !== session.revision) return { status: "stale", ...responseBase(loc, session), reason: "Accepted request was superseded." };
    const fail = (status: string, details: Record<string, unknown>) => saveReceipt(loc, session, args.requestId, { status, ...responseBase(loc, session), ready: false, ...details });
    let journal = session.journal?.requestId === args.requestId ? session.journal : undefined;
    if (!journal) {
      try {
        const freshness = await planBasisFreshness(loc.projectRoot, session.phase, session.readSet);
        const targets = await planTargetFreshness(loc, session);
        const current = await planLocation({ cwd: loc.projectRoot, phase: session.phase });
        if (!phaseTopologyFingerprintsMatch(session.topology, phaseTopologyFingerprintFromLocation(current.resolved, current.matchedPhase))) return fail("stale", { reason: "Phase topology changed; explicitly reconcile preparation." });
        if (!session.prepared || session.needsIntent || freshness.status !== "fresh" || !targets.fresh) return fail("needs_revision", { freshness, targets, nextAction: "Refresh planning preparation with an explicit mode choice and reconcile any changed inputs or targets; the candidate is saved." });
        const readiness = await planDependencies.readiness({ cwd: loc.projectRoot, phase: session.phase, readMode: "hashes-only" });
        const gates = await readinessGates(loc, readiness);
        if (!gates.ready) return fail("blocked", { gates, nextAction: await safeNextAction(readiness.nextSafeAction) });
        if (session.mode !== "add" && !args.overwrite) return fail("needs_revision", { reason: "Revise/replace requires explicit overwrite authorization after the user chooses the selected targets." });
        const executed = session.targetPlanIds.filter(id => current.artifacts.some(p => p === `${current.resolved.phaseDir}/${current.resolved.phasePrefix}-${id}-SUMMARY.md`));
        if (executed.length) return fail("needs_revision", { reason: "Executed target plans cannot be revised or replaced; add follow-up plans instead.", executedPlanIds: executed });
        if (gates.checkerRequired && (!args.review || args.review.verdict !== "accept" || args.review.revision !== session.revision || args.review.candidateHash !== session.candidateHash)) return fail("needs_revision", { reason: "An accepting checker review tied to the current revision and candidateHash is required." });
        const result = await assess(loc, session);
        if (!result.valid || !result.plans.length || !session.candidateHash) return fail("needs_revision", { validation: validationSummary(result), nextAction: "Correct the saved candidate fields, submit a new revision, and review the updated set." });
        const files: PlanJournal["files"] = [];
        for (const plan of result.plans) {
          const content = prepareTextForPersistence(plan.content, { label: "Compiled phase plan" }).content;
          if (Buffer.byteLength(content) > 4 * 1024 * 1024) return fail("needs_revision", { reason: "Rendered plan exceeds 4 MiB; candidate remains saved." });
          const baselineHash = session.targets.find(item => item.path === plan.path)?.hash ?? null;
          if (session.mode === "add" && baselineHash || session.mode === "revise" && !session.targetPlanIds.includes(plan.planId)) return fail("needs_revision", { reason: "Candidate attempts to overwrite a plan outside the selected mode and targets." });
          const backup = baselineHash === null ? null : await fs.readFile(resolveBlueprintPath(loc.projectRoot, plan.path), "utf8");
          if (backup !== null && researchDigest(backup) !== baselineHash) return fail("stale", { reason: `Plan changed before staging: ${plan.path}.` });
          const model = plan.model as PhasePlanStructuredModel;
          files.push({ planId: plan.planId, title: model.title, wave: model.wave, taskCount: model.tasks.length, path: plan.path, hash: researchDigest(content), content, baselineHash, backup });
        }
        const removed: PlanJournal["removed"] = [];
        if (session.mode === "replace") for (const id of session.targetPlanIds) {
          const path = `${loc.resolved.phaseDir}/${loc.resolved.phasePrefix}-${id}-PLAN.md`;
          if (files.some(file => file.path === path)) continue;
          const baselineHash = session.targets.find(item => item.path === path)?.hash;
          if (!baselineHash) return fail("stale", { reason: `Selected replacement target is missing: ${path}.` });
          const backup = await fs.readFile(resolveBlueprintPath(loc.projectRoot, path), "utf8");
          if (researchDigest(backup) !== baselineHash) return fail("stale", { reason: `Replacement target changed: ${path}.` });
          removed.push({ path, baselineHash, backup });
        }
        const marker = await readPlanPublicationStatus(loc.projectRoot, loc.resolved.phaseDir, loc.resolved.phasePrefix);
        if (marker.status === "pending" || marker.status === "invalid") return fail("partial", { reason: marker.reason });
        const baselineMarker = await fs.readFile(resolveBlueprintPath(loc.projectRoot, planPublicationPath(loc.resolved.phaseDir, loc.resolved.phasePrefix)), "utf8").catch(error => { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; });
        journal = { requestId: args.requestId, requestHash: hash, revision: session.revision, candidateHash: session.candidateHash, baselineMarker, ...(args.review ? { review: args.review } : {}), files, removed, stages: {} };
        session.journal = journal;
        await savePlanSession(loc, session);
      } catch (error) {
        return { status: "partial", ...responseBase(loc, session), ready: false, reason: (error as Error).message, nextAction: `Retry blueprint_plan_finalize with requestId ${args.requestId} and identical arguments; the candidate is saved.` };
      }
    }
    const publicationPath = planPublicationPath(loc.resolved.phaseDir, loc.resolved.phasePrefix);
    const assertFresh = async () => {
      const fresh = await planBasisFreshness(loc.projectRoot, session.phase, session.readSet);
      if (fresh.status !== "fresh") throw new Error(`Planning evidence changed: ${[...fresh.stalePaths, ...fresh.unknownPaths].join(", ")}. Candidate and publication journal are retained.`);
    };
    try {
      await withFreshPhaseTopologyForMutation(loc.projectRoot, { phase: session.phase }, session.topology, "Plan-set publication", async () => withBlueprintRepoLock(loc.projectRoot, "phase-plan-write", async () => {
        await assertFresh();
        const checkpoint = () => savePlanSession(loc, session, true);
        const current = await planLocation({ cwd: loc.projectRoot, phase: session.phase });
        const desiredPaths = new Set(journal!.files.map(file => file.path));
        const removedPaths = new Set(journal!.removed.map(file => file.path));
        const originalPaths = new Set(session.targets.map(item => item.path));
        for (const target of await readPlanTargetHashes(current)) {
          if (!originalPaths.has(target.path) && !desiredPaths.has(target.path)) throw new Error(`An unreviewed plan appeared during publication: ${target.path}.`);
          if (!desiredPaths.has(target.path) && !removedPaths.has(target.path) && session.targets.find(item => item.path === target.path)?.hash !== target.hash) throw new Error(`Unselected plan changed: ${target.path}.`);
        }
        for (const target of session.targets) if (!desiredPaths.has(target.path) && !removedPaths.has(target.path) && await researchInputHash(loc.projectRoot, target.path) !== target.hash) throw new Error(`Unselected plan changed: ${target.path}.`);
        if (journal!.stages.commit !== "complete") {
          const observedMarker = await fs.readFile(resolveBlueprintPath(loc.projectRoot, publicationPath), "utf8").catch(error => { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; });
          if (observedMarker !== journal!.baselineMarker && observedMarker !== markerContent(session, journal!, "pending") && observedMarker !== markerContent(session, journal!, "committed")) throw new Error("Publication marker changed externally; refusing to overwrite it.");
          if (!journal!.stages.files) {
            const marker = await readPlanPublicationStatus(loc.projectRoot, loc.resolved.phaseDir, loc.resolved.phasePrefix);
            if (marker.status === "pending" || marker.status === "invalid") throw new Error("Another incomplete publication marker requires recovery.");
            // Check every baseline before setting the read barrier.
            for (const file of [...journal!.files, ...journal!.removed]) if (await researchInputHash(loc.projectRoot, file.path) !== file.baselineHash) throw new Error(`Plan target changed before publication: ${file.path}.`);
            journal!.stages.files = "intent"; await checkpoint();
          }
          if (observedMarker === journal!.baselineMarker) await planDependencies.writeText(resolveBlueprintPath(loc.projectRoot, publicationPath), markerContent(session, journal!, "pending"));
          for (const file of journal!.files) {
            const observed = await researchInputHash(loc.projectRoot, file.path);
            if (observed === file.hash) continue;
            if (observed !== file.baselineHash) throw new Error(`Plan target changed externally: ${file.path}.`);
            await planDependencies.writeText(resolveBlueprintPath(loc.projectRoot, file.path), file.content);
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
          journal!.stages.commit = "complete"; await checkpoint();
        } else {
          if (await fs.readFile(resolveBlueprintPath(loc.projectRoot, publicationPath), "utf8") !== markerContent(session, journal!, "committed")) throw new Error("Committed publication marker changed externally.");
          await verifyPublished(loc, journal!, session);
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
        const acceptedTargets = new Map(session.targets.map(item => [item.path, item.hash]));
        for (const file of journal!.files) acceptedTargets.set(file.path, file.hash);
        for (const file of journal!.removed) acceptedTargets.delete(file.path);
        session.targets = [...acceptedTargets].sort(([left], [right]) => left.localeCompare(right)).map(([path, hash]) => ({ path, hash }));
        session.existingPlans = index.plans.map(plan => ({ planId: plan.planId, wave: plan.wave ?? 1, dependsOn: plan.dependsOn, requirements: plan.requirements }));
        journal!.stages.routing = "complete";
        session.needsIntent = true;
        journal!.receipt = { status: "published", ...responseBase(loc, session), ready: true, paths: journal!.files.map(file => file.path), plans: journal!.files.map(({ planId, title, wave, taskCount, path }) => ({ planId, title, wave, taskCount, path })), removedPaths: journal!.removed.map(file => file.path), stages: { ...journal!.stages }, warnings: state.warnings ?? [], nextAction };
        session.requests[args.requestId].receipt = journal!.receipt;
        await savePlanSession(loc, session, true);
        return journal!.receipt;
      }));
    } catch (error) {
      return { status: "partial", ...responseBase(loc, session), ready: false, stages: journal.stages, reason: (error as Error).message, nextAction: `Retry blueprint_plan_finalize with requestId ${args.requestId} and identical arguments. The journal retains exact candidate, previous plans, and intended publication bytes.` };
    }
  });
}

export const planningToolDefinitions: ToolDefinition[] = [
  { name: "blueprint_plan_prepare", description: "Prepare a compact, freshness-bound plan-set authoring packet and durable session. Existing plans require an explicit add/revise/replace choice; changed evidence requires reviewed reconciliation.", inputSchema: prepareInput.shape, handler: args => blueprintPlanPrepare(args as z.input<typeof prepareInput>) },
  { name: "blueprint_plan_submit", description: "Durably retain a plan candidate or exact raw JSON before validation, or apply narrow field corrections. Return diagnostics and a review packet without writing canonical plans.", inputSchema: submitInput.shape, handler: args => blueprintPlanSubmit(args as z.input<typeof submitInput>) },
  { name: "blueprint_plan_read", description: "Recover saved planning candidate, revisions, receipts, evidence freshness, backups, and publication journal.", inputSchema: planLookup, handler: args => blueprintPlanRead(args as z.input<typeof lookupSchema>) },
  { name: "blueprint_plan_finalize", description: "Validate and publish the complete saved plan set with freshness and overwrite gates, revision-bound checker review, a publication read barrier, and resumable state synchronization.", inputSchema: finalizeInput.shape, handler: args => blueprintPlanFinalize(args as z.input<typeof finalizeInput>) },
];
