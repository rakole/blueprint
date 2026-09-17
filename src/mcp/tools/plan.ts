import { promises as fs } from "node:fs";
import * as z from "zod/v4";
import { prepareTextForPersistence } from "../../shared/security.js";
import type { ToolDefinition } from "../tool-types.js";
import { isBootstrapStarterContext, resolveBlueprintPath, validatePhaseArtifactContent, withBlueprintRepoLock, writeTextFile } from "./artifacts.js";
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
import { capturePlanEvidence, planBasisFreshness, planTargetFreshness, readPlanTargetHashes } from "./plan-evidence.js";
import { checkedPlanPayload, initialPlanSession, planLocation, planLookup, planNumericPhase, planPublicationPath, planRequestId, readPlanPublicationStatus, readPlanSession, savePlanSession, withPlanSession, type PlanJournal, type PlanLocation, type PlanSession } from "./plan-session.js";

const mode = z.enum(["add", "revise", "replace"]);
const planId = z.string().regex(/^\d+$/).transform(value => value.padStart(2, "0"));
const prepareInput = z.object({
  cwd: z.string().optional(), phase: planNumericPhase.optional(), mode: mode.optional(), targetPlanIds: z.array(planId).max(100).optional(),
  evidencePaths: z.array(z.string().min(1)).max(60).optional(), expectedRevision: z.number().int().nonnegative().optional(), acknowledgeChangedInputs: z.boolean().optional(),
  reconcile: z.object({ confirmed: z.literal(true), targetHashes: z.record(z.string(), z.string().nullable()) }).optional(),
});
const reviewInput = z.object({ verdict: z.enum(["accept", "revise"]), summary: z.string().min(1).max(20000) });
const submitInput = z.object({ ...planLookup, requestId: planRequestId, expectedRevision: z.number().int().nonnegative(), model: z.unknown().optional(), overwrite: z.boolean().optional(), review: reviewInput.optional() });
const lookupSchema = z.object(planLookup);

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

function boundedEvidence(inputs: Awaited<ReturnType<typeof capturePlanEvidence>>["inputs"]) {
  let remaining = 48000;
  const priority = (path: string) => /-CONTEXT\.md$/.test(path) ? 0 : /-RESEARCH\.md$/.test(path) ? 1 : /-(?:UI-)?SPEC\.md$/.test(path) ? 2 : /\/(?:PROJECT|REQUIREMENTS)\.md$/.test(path) ? 3 : 4;
  return [...inputs].sort((left, right) => priority(left.path) - priority(right.path)).map(input => {
    const content = input.content === null ? null : input.content.slice(0, Math.min(/-(?:CONTEXT|SPEC|UI-SPEC)\.md$/.test(input.path) ? 16000 : 6000, remaining));
    remaining -= content?.length ?? 0;
    return { ...input, content, truncated: (input.content?.length ?? 0) > (content?.length ?? 0) };
  });
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
      const contextContent = capture.inputs.find(input => input.path === artifactPathFor(loc.resolved, "context"))?.content ?? "";
      const packet = {
        phase: readiness.phaseSelection, gates, config: { workflow: readiness.effectiveConfig.workflow },
        requirements: readiness.context?.requirementsGrounding, projectBrief: readiness.context?.projectBrief,
        evidence: boundedEvidence(capture.inputs),
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
      if (args.expectedRevision !== undefined && args.expectedRevision !== session.revision) return { ...packet, status: "stale", ...responseBase(loc, session), reason: "Revision conflict" };
      if (plans.length && !args.mode && (!session.readSet.length || session.journal?.receipt || session.needsIntent)) {
        await savePlanSession(loc, session);
        return { ...packet, status: "choice_required", ...responseBase(loc, session), nextAction: "Choose add, revise selected plans, or replace selected plans; supply mode and targetPlanIds for revise/replace." };
      }
      const nextMode = args.mode ?? (plans.length ? session.mode : "add");
      const targetPlanIds = [...new Set(args.targetPlanIds ?? (nextMode === "add" ? [] : nextMode === "replace" && args.mode ? plans.map(plan => plan.planId) : session.targetPlanIds))];
      if (nextMode === "add" && targetPlanIds.length || nextMode !== "add" && !targetPlanIds.length || targetPlanIds.some(id => !plans.some(plan => plan.planId === id))) return { ...packet, status: "choice_required", ...responseBase(loc, session), reason: "Add accepts no targets; revise/replace require existing selected targetPlanIds." };
      const changed = session.readSet.length ? await planBasisFreshness(loc.projectRoot, session.phase, session.readSet) : null;
      const topologyChanged = !phaseTopologyFingerprintsMatch(session.topology, phaseTopologyFingerprintFromLocation(current.resolved, current.matchedPhase));
      const targetsChanged = session.readSet.length > 0 && stableResearchValue(targets) !== stableResearchValue(session.targets);
      const modeChanged = session.readSet.length > 0 && (nextMode !== session.mode || stableResearchValue(targetPlanIds) !== stableResearchValue(session.targetPlanIds));
      const selectedEvidenceChanged = session.readSet.length > 0 && stableResearchValue(capture.evidencePaths) !== stableResearchValue(session.evidencePaths);
      if ((targetsChanged || topologyChanged) && (!args.reconcile || args.expectedRevision !== session.revision || stableResearchValue(args.reconcile.targetHashes) !== stableResearchValue(packet.targetHashes))) return { ...packet, status: "reconciliation_required", ...responseBase(loc, session), reason: "Review changed topology and publication targets, then prepare with expectedRevision and reconcile containing the observed targetHashes." };
      if ((changed && changed.status !== "fresh" || modeChanged && !session.needsIntent || selectedEvidenceChanged) && (!args.acknowledgeChangedInputs || args.expectedRevision !== session.revision)) return { ...packet, status: "stale", ...responseBase(loc, session), freshness: changed, nextAction: "Review the changed evidence or scope, then prepare with expectedRevision and acknowledgeChangedInputs=true. No document draft is stored; use the refreshed packet to author the model." };
      const unchanged = !session.needsIntent && !session.journal?.receipt && session.prepared === gates.ready && session.readSet.length && !topologyChanged && !targetsChanged && !modeChanged && !selectedEvidenceChanged && changed?.status === "fresh";
      if (!unchanged) {
        delete session.journal;
        session.requests = {};
        session.topology = phaseTopologyFingerprintFromLocation(current.resolved, current.matchedPhase);
        session.prepared = gates.ready; session.mode = nextMode; session.targetPlanIds = targetPlanIds;
        if (args.mode || !plans.length) session.needsIntent = false;
        session.readSet = capture.readSet; session.evidencePaths = capture.evidencePaths; session.targets = targets;
        session.existingPlans = plans.map(plan => ({ planId: plan.planId, wave: plan.wave ?? 1, dependsOn: plan.dependsOn, requirements: plan.requirements }));
        session.knownRequirements = readiness.authoringContext.knownRequirements;
        const selectedPaths = new Set(targetPlanIds.map(id => `${loc.resolved.phaseDir}/${loc.resolved.phasePrefix}-${id}-PLAN.md`));
        session.knownEvidenceArtifacts = readiness.authoringContext.knownEvidenceArtifacts.filter(p => !selectedPaths.has(p));
        session.checkerRequired = gates.checkerRequired;
        session.revision++;
        await savePlanSession(loc, session);
      }
      return { ...packet, schema: planningPreparedSchema(session), status: gates.ready ? "prepared" : "blocked", ...responseBase(loc, session), mode: nextMode, targetPlanIds, knownRequirements: session.knownRequirements, knownEvidenceArtifacts: session.knownEvidenceArtifacts, nextAction: gates.ready ? "Use schema, example and validationRules to author the model. If checkerRequired, review this model in memory, then call blueprint_plan_submit once with model and the review verdict. Read any truncated required evidence before relying on it. Planning performs no live external research." : await safeNextAction(readiness.nextSafeAction) };
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

export async function blueprintPlanRead(raw: z.input<typeof lookupSchema>) {
  const args = lookupSchema.parse(raw);
  return withPlanSession(args, async loc => {
    const session = await readPlanSession(loc);
    const before = await readPlanPublicationStatus(loc.projectRoot, loc.resolved.phaseDir, loc.resolved.phasePrefix);
    const current = await planLocation(args);
    const published = await Promise.all((await readPlanTargetHashes(current)).map(async target => ({ ...target,
      content: before.status === "pending" || before.status === "invalid" ? null : await fs.readFile(resolveBlueprintPath(loc.projectRoot, target.path), "utf8"),
    })));
    const publication = await readPlanPublicationStatus(loc.projectRoot, loc.resolved.phaseDir, loc.resolved.phasePrefix);
    if (before.token !== publication.token) for (const file of published) file.content = null;
    return { status: session || published.length ? "found" : "not_found", sessionPath: loc.sessionPath, session, published, publication,
      freshness: session ? await planBasisFreshness(loc.projectRoot, session.phase, session.readSet) : null };
  });
}

// Owning operations are injectable so interruption tests cover every metadata stage.
export const planDependencies = { compile: compilePlanCandidate, validate: validatePhasePlanCandidateSet, writeText: writeTextFile, remove: (path: string) => fs.unlink(path), stateUpdate: blueprintStateUpdate, stateLoad: blueprintStateLoad };
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
    if (observed.status !== "absent") await planDependencies.writeText(resolveBlueprintPath(loc.projectRoot, planPublicationPath(loc.resolved.phaseDir, loc.resolved.phasePrefix)), JSON.stringify({ version: 1, status: "committed", requestId: "reconciled", revision: session.revision, files: targets, removedPaths: [] }, null, 2) + "\n");
    session.topology = topology; session.targets = targets; session.prepared = false; session.needsIntent = true; session.readSet = []; session.requests = {};
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
        if ((await planBasisFreshness(loc.projectRoot, session.phase, session.readSet)).status !== "fresh") throw new Error("Planning evidence changed after publication; refresh preparation.");
        if (await fs.readFile(resolveBlueprintPath(loc.projectRoot, planPublicationPath(loc.resolved.phaseDir, loc.resolved.phasePrefix)), "utf8") !== markerContent(session, journal, "committed")) throw new Error("Publication marker changed after publication.");
        return accepted.receipt;
      } catch (error) { return reject("stale", { reason: (error as Error).message }); }
    }
    const contents = new Map<string, string>();
    if (!journal) {
      try {
        if (args.model === undefined) return reject("needs_revision", { reason: "Supply model using prepare.schema and prepare.example." });
        const freshness = await planBasisFreshness(loc.projectRoot, session.phase, session.readSet);
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
      const fresh = await planBasisFreshness(loc.projectRoot, session.phase, session.readSet);
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
          const observedMarker = await readPlanPublicationStatus(loc.projectRoot, loc.resolved.phaseDir, loc.resolved.phasePrefix);
          const pendingToken = researchDigest(markerContent(session, journal!, "pending")), committedToken = researchDigest(markerContent(session, journal!, "committed"));
          if (![journal!.baselineMarkerToken, pendingToken, committedToken].includes(observedMarker.token)) throw new Error("Publication marker changed externally; refusing to overwrite it.");
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
        const targets = new Map(session.targets.map(item => [item.path, item.hash]));
        for (const file of journal!.files) targets.set(file.path, file.hash);
        for (const file of journal!.removed) targets.delete(file.path);
        session.targets = [...targets].sort(([left], [right]) => left.localeCompare(right)).map(([path, hash]) => ({ path, hash }));
        session.existingPlans = index.plans.map(plan => ({ planId: plan.planId, wave: plan.wave ?? 1, dependsOn: plan.dependsOn, requirements: plan.requirements }));
        journal!.stages.routing = "complete"; session.needsIntent = true;
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
  { name: "blueprint_plan_prepare", description: "Prepare phase evidence, exact model schema/example, derivable fields and meaningful validation rules for first-attempt plan publication. Saves only preparation metadata. Existing plans require add/revise/replace intent.", inputSchema: prepareInput.shape, handler: args => blueprintPlanPrepare(args as z.input<typeof prepareInput>) },
  { name: "blueprint_plan_submit", description: "Normalize and validate a model in memory, then publish the complete canonical plan set. Rejected drafts are never saved. An optional configured checker reviews the supplied model before this call. Retry interrupted publication with the same model until all canonical plans are saved.", inputSchema: submitInput.shape, handler: args => blueprintPlanSubmit(args as z.input<typeof submitInput>) },
  { name: "blueprint_plan_read", description: "Read canonical plans, preparation metadata, publication stages and evidence freshness. No rejected drafts, document history or backups are retained.", inputSchema: planLookup, handler: args => blueprintPlanRead(args as z.input<typeof lookupSchema>) },
];
