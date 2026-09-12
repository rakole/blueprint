import * as z from "zod/v4";
import { safeJsonParse } from "../../shared/security.js";
import { uniquePreservingOrder } from "./phase-collection-helpers.js";
import { normalizePlanId } from "./phase-plan-identifiers.js";
import type { PhasePlanStructuredModel } from "./phase-plan-rendering.js";

// Publication still uses phase.plan's existing structured model. This smaller
// contract contains author judgment; the compiler owns its repeated ledgers.
const narrative = z.string().min(1).regex(/\S/, "Use concrete nonblank text.")
  .regex(/^[^\r\n\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+$/, "Use one line per entry; the original candidate remains saved for correction.");
const repoPath = z.string().min(1).regex(
  /^(?!\s)(?!.*\s$)(?!.*[\u0000-\u001f\u007f])(?!\/)(?!~)(?![A-Za-z]:)(?!.*\\)(?!.*(?:^|\/)\.\.?(?:\/|$))(?!.*\/\/)(?!.*[*?])(?!.*\/$).*\S.*$/,
  "Use a concrete repo-relative file path without traversal, wildcard operators (* and ?), or control characters. Brackets, braces and parentheses are literal filename characters.",
);
const taskId = z.string().regex(/^[A-Za-z0-9._-]+$/);
const key = z.string().regex(/^[A-Za-z][A-Za-z0-9._-]*$/)
  .describe("Local plan key. Dependencies use these keys or existing numeric plan ids.");
const verification = z.strictObject({
  item: narrative,
  method: z.enum(["test", "grep", "command", "file-read", "artifact-validation"]),
  evidence: narrative,
});
const unknownOrDeferral = z.strictObject({
  item: narrative,
  disposition: z.enum(["unknown", "deferred", "blocked", "none"]),
  rationale: narrative,
  followUp: narrative,
});
const authoringSchema = z.strictObject({
  plans: z.array(z.strictObject({
    key,
    title: narrative,
    goal: narrative,
    scope: z.array(narrative).min(1),
    dependsOn: z.array(z.string().regex(/^(?:[A-Za-z][A-Za-z0-9._-]*|[0-9]+)$/)),
    tasks: z.array(z.strictObject({
      id: taskId,
      title: narrative,
      readFirst: z.array(repoPath).min(1),
      filesModified: z.array(repoPath).min(1),
      requirements: z.array(narrative).min(1),
      action: z.array(narrative).min(1),
      acceptanceCriteria: z.array(narrative).min(1),
    })).min(1),
    mustHaves: z.array(narrative).min(1),
    autonomous: z.boolean().optional(),
    gapClosure: z.boolean().optional(),
    externalServicePrerequisites: z.array(z.strictObject({
      service: narrative,
      category: narrative,
      purpose: narrative,
      userSetup: narrative,
      readinessCheck: narrative,
      canAgentProceedWithoutIt: z.boolean(),
    })).optional(),
    verification: z.array(verification).optional(),
    evidence: z.array(z.strictObject({ artifact: repoPath, rationale: narrative }))
      .describe("Only explicitly cited saved evidence, with the reason it informed this plan.").optional(),
    unknownsAndDeferrals: z.array(unknownOrDeferral).optional(),
  })).min(1),
  deferrals: z.array(z.strictObject({
    requirement: narrative,
    rationale: narrative,
    followUp: narrative,
  })).optional(),
});

export const planningCandidateJsonSchema: Record<string, unknown> = z.toJSONSchema(authoringSchema);

export type PlanningCandidate = z.infer<typeof authoringSchema>;
export type PlanningCandidateContext = {
  knownRequirements: string[];
  knownEvidenceArtifacts: string[];
  existingPlans: Array<{
    planId: string;
    wave: number;
    dependsOn?: string[];
    requirements?: string[];
  }>;
  mode: "add" | "revise" | "replace";
  targetPlanIds: string[];
};
export type PlanningCandidateDiagnostic = {
  path: string;
  code: string;
  message: string;
  severity: "error" | "warning";
};
export type PlanningCandidateCompilation = {
  valid: boolean;
  diagnostics: PlanningCandidateDiagnostic[];
  models: Array<{ planId: string; model: PhasePlanStructuredModel }>;
  planIds: string[];
};

function numericIdentity(value: string): string | null {
  if (!/^[0-9]+$/.test(value) || /^0+$/.test(value)) return null;
  return BigInt(value).toString();
}

function candidatePath(segments: PropertyKey[]): string {
  return "candidate" + segments.map((part) => typeof part === "number" ? `[${part}]` : `.${String(part)}`).join("");
}

/** Pure, deterministic compilation. Callers persist raw input before calling. */
export function compilePlanCandidate(
  raw: unknown,
  context: PlanningCandidateContext,
): PlanningCandidateCompilation {
  const result: PlanningCandidateCompilation = { valid: false, diagnostics: [], models: [], planIds: [] };
  const issue = (path: string, code: string, message: string, severity: "error" | "warning" = "error"): void => {
    result.diagnostics.push({ path, code, message, severity });
  };
  const hasErrors = (): boolean => result.diagnostics.some((entry) => entry.severity === "error");
  let input: unknown;
  try {
    input = typeof raw === "string"
      ? safeJsonParse(raw, { label: "Planning candidate", maxBytes: 1024 * 1024 })
      : raw;
  } catch (error) {
    issue("candidate", "schema.json", error instanceof Error ? error.message : "Planning candidate is not valid JSON.");
    return result;
  }
  const parsed = authoringSchema.safeParse(input);
  if (!parsed.success) {
    for (const error of parsed.error.issues) {
      if (error.code === "unrecognized_keys") {
        for (const property of error.keys) issue(candidatePath([...error.path, property]), "schema.unknown_field", "This field is not part of the compact planning contract.");
      } else {
        issue(candidatePath(error.path), `schema.${error.code}`, error.message);
      }
    }
    return result;
  }
  const candidate = parsed.data;
  const requirements = uniquePreservingOrder(context.knownRequirements);
  const knownRequirements = new Set(requirements);
  const evidenceArtifacts = uniquePreservingOrder(context.knownEvidenceArtifacts);
  const knownEvidence = new Set(evidenceArtifacts);
  // A numeric identity maps aliases such as 1 / 01 to the actual saved slot.
  // Preserve a saved slot's spelling instead of silently changing its filename.
  const savedByNumber = new Map<string, PlanningCandidateContext["existingPlans"][number]>();
  for (const [index, saved] of context.existingPlans.entries()) {
    const identity = numericIdentity(saved.planId);
    if (!identity || !Number.isSafeInteger(saved.wave) || saved.wave < 1) {
      issue(`context.existingPlans[${index}]`, "planning.invalid_saved_plan", "Saved plans require a positive numeric id and a positive integer wave.");
    } else if (savedByNumber.has(identity)) {
      issue(`context.existingPlans[${index}].planId`, "planning.ambiguous_saved_slot", `Multiple saved plans resolve to numeric slot ${identity}.`);
    } else {
      savedByNumber.set(identity, { ...saved, planId: normalizePlanId(saved.planId) });
    }
  }
  const targets: string[] = [];
  const requestedTargets = context.mode === "replace" && context.targetPlanIds.length === 0
    ? [...savedByNumber.values()].map(plan => plan.planId)
    : context.targetPlanIds;
  for (const [index, id] of requestedTargets.entries()) {
    const identity = numericIdentity(id);
    const saved = identity ? savedByNumber.get(identity) : undefined;
    if (!saved) {
      issue(`context.targetPlanIds[${index}]`, "planning.target_missing", `Target plan ${id} is not an existing saved plan.`);
    } else if (targets.includes(saved.planId)) {
      issue(`context.targetPlanIds[${index}]`, "planning.duplicate_target", `Target plan ${id} was selected more than once.`);
    } else {
      targets.push(saved.planId);
    }
  }
  if (context.mode === "revise" && targets.length !== candidate.plans.length) {
    issue("candidate.plans", "planning.target_count", "Revise requires one candidate plan for each targetPlanIds entry, in the selected order.");
  }
  if (context.mode === "add" && context.targetPlanIds.length > 0) {
    issue("context.targetPlanIds", "planning.add_targets", "Add assigns new slots and cannot select saved targets.");
  }
  if (hasErrors()) return result;
  const maxSaved = [...savedByNumber.keys()].reduce((max, value) => BigInt(value) > max ? BigInt(value) : max, 0n);
  result.planIds = candidate.plans.map((_, index) => context.mode === "revise"
    ? targets[index]
    : context.mode === "replace" && index < targets.length ? targets[index]
    : normalizePlanId((maxSaved + BigInt(index + 1 - (context.mode === "replace" ? targets.length : 0))).toString()));
  const localIds = new Map<string, string>();
  for (const [index, plan] of candidate.plans.entries()) {
    if (localIds.has(plan.key)) issue(`candidate.plans[${index}].key`, "planning.duplicate_key", `Plan key ${plan.key} must be unique.`);
    else localIds.set(plan.key, result.planIds[index]);
  }
  const candidateIds = new Set(result.planIds);
  const retained = [...savedByNumber.values()].filter((saved) => !candidateIds.has(saved.planId) &&
    !(context.mode === "replace" && targets.includes(saved.planId)));
  const retainedIds = new Set(retained.map((plan) => plan.planId));
  const dependencies = new Map<string, string[]>();
  for (const [index, plan] of candidate.plans.entries()) {
    const resolved: string[] = [];
    for (const [dependencyIndex, dependency] of plan.dependsOn.entries()) {
      const identity = numericIdentity(dependency);
      const saved = identity ? savedByNumber.get(identity) : undefined;
      const target = localIds.get(dependency) ?? (saved && (context.mode !== "replace" || retainedIds.has(saved.planId)) ? saved.planId : undefined);
      if (!target) {
        issue(`candidate.plans[${index}].dependsOn[${dependencyIndex}]`, "planning.dependency_missing", `Dependency ${dependency} is not a candidate key or a retained saved plan. Use candidate keys to reference plans in this submission.`);
      } else {
        resolved.push(target);
      }
    }
    dependencies.set(result.planIds[index], uniquePreservingOrder(resolved));
  }
  for (const saved of retained) {
    const resolved: string[] = [];
    for (const dependency of saved.dependsOn ?? []) {
      const identity = numericIdentity(dependency);
      const target = identity ? savedByNumber.get(identity)?.planId : undefined;
      if (!target || (!retainedIds.has(target) && !candidateIds.has(target))) {
        issue("context.existingPlans", "planning.saved_dependency_missing", `Saved plan ${saved.planId} depends on missing plan ${dependency}.`);
      } else {
        resolved.push(target);
      }
    }
    dependencies.set(saved.planId, uniquePreservingOrder(resolved));
  }
  const waves = new Map(retained.map((plan) => [plan.planId, plan.wave]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): number => {
    if (visiting.has(id)) {
      issue("candidate.plans", "planning.dependency_cycle", `Dependency cycle reaches plan ${id}.`);
      return 0;
    }
    if (visited.has(id)) return waves.get(id) ?? 1;
    visiting.add(id);
    const minimumWave = Math.max(0, ...(dependencies.get(id) ?? []).map(visit)) + 1;
    if (retainedIds.has(id)) {
      if ((waves.get(id) ?? 0) < minimumWave) {
        issue("candidate.plans", "planning.saved_wave_conflict", `Saved plan ${id} would need wave ${minimumWave} or later. Include that plan in the revision targets to recompute its wave.`);
      }
    } else {
      waves.set(id, minimumWave);
      if (!Number.isSafeInteger(minimumWave)) {
        issue("candidate.plans", "planning.wave_overflow", `Plan ${id} would exceed the supported integer wave range.`);
      }
    }
    visiting.delete(id);
    visited.add(id);
    return waves.get(id) ?? minimumWave;
  };
  for (const id of dependencies.keys()) visit(id);
  const deferrals = new Map<string, NonNullable<PlanningCandidate["deferrals"]>[number]>();
  for (const [index, row] of (candidate.deferrals ?? []).entries()) {
    if (!knownRequirements.has(row.requirement)) issue(`candidate.deferrals[${index}].requirement`, "planning.requirement_unknown", `Unknown requirement ${row.requirement}.`);
    if (deferrals.has(row.requirement)) issue(`candidate.deferrals[${index}].requirement`, "planning.duplicate_deferral", `Requirement ${row.requirement} has multiple deferrals.`);
    deferrals.set(row.requirement, row);
  }
  const owners = new Map<string, string[]>();
  const fileOwners = new Map<string, { id: string; wave: number }>();
  for (const [index, plan] of candidate.plans.entries()) {
    const id = result.planIds[index];
    const taskIds = new Set<string>();
    const citedEvidence = new Set<string>();
    for (const [taskIndex, task] of plan.tasks.entries()) {
      if (taskIds.has(task.id)) issue(`candidate.plans[${index}].tasks[${taskIndex}].id`, "planning.duplicate_task", `Task id ${task.id} must be unique within its plan.`);
      taskIds.add(task.id);
      for (const [requirementIndex, requirement] of task.requirements.entries()) {
        if (!knownRequirements.has(requirement)) issue(`candidate.plans[${index}].tasks[${taskIndex}].requirements[${requirementIndex}]`, "planning.requirement_unknown", `Unknown requirement ${requirement}.`);
        owners.set(requirement, uniquePreservingOrder([...(owners.get(requirement) ?? []), id]));
      }
    }
    for (const [evidenceIndex, evidence] of (plan.evidence ?? []).entries()) {
      if (!knownEvidence.has(evidence.artifact)) issue(`candidate.plans[${index}].evidence[${evidenceIndex}].artifact`, "planning.evidence_unknown", `Evidence ${evidence.artifact} is not in the prepared evidence inventory.`);
      if (citedEvidence.has(evidence.artifact)) issue(`candidate.plans[${index}].evidence[${evidenceIndex}].artifact`, "planning.duplicate_evidence", `Evidence ${evidence.artifact} is cited more than once.`);
      citedEvidence.add(evidence.artifact);
    }
    for (const file of uniquePreservingOrder(plan.tasks.flatMap((task) => task.filesModified))) {
      const wave = waves.get(id) ?? 1;
      const ownershipKey = `${wave}:${file}`;
      const prior = fileOwners.get(ownershipKey);
      if (prior) issue(`candidate.plans[${index}].tasks`, "planning.file_ownership_conflict", `Plans ${prior.id} and ${id} both modify ${file} in wave ${wave}. Add a dependency or split ownership.`);
      else fileOwners.set(ownershipKey, { id, wave });
    }
  }
  for (const [requirement, row] of deferrals) {
    if (owners.has(requirement)) issue("candidate.deferrals", "planning.deferral_conflict", `Requirement ${row.requirement} is both assigned to candidate tasks and deferred for the phase.`);
  }
  for (const requirement of requirements) {
    if (!owners.has(requirement) && !deferrals.has(requirement) && !retained.some((plan) => plan.requirements?.includes(requirement))) {
      issue("candidate.plans", "planning.requirement_unassigned", `Requirement ${requirement} is not assigned by this candidate. Final plan-set coverage must resolve it before execution.`, "warning");
    }
  }
  if (hasErrors()) return result;
  result.models = candidate.plans.map((plan, index) => {
    const id = result.planIds[index];
    const tasks = plan.tasks.map((task) => ({
      ...task,
      requirements: uniquePreservingOrder(task.requirements),
      filesModified: uniquePreservingOrder(task.filesModified),
      readFirst: uniquePreservingOrder(task.readFirst),
    }));
    const filesModified = uniquePreservingOrder(tasks.flatMap((task) => task.filesModified));
    const citedEvidence = new Map((plan.evidence ?? []).map((row) => [row.artifact, row.rationale]));
    const checks: PhasePlanStructuredModel["verification"] = plan.verification?.length ? plan.verification : tasks.flatMap((task) => task.acceptanceCriteria.map((criterion) => ({
      item: `Verify ${task.id}: ${criterion}`,
      method: /(?:^|`)(?:npm|npx|pnpm|yarn|node|python3?|pytest|cargo|go|make|rg|grep)\s/.test(criterion) ? "command" as const : "file-read" as const,
      evidence: `${criterion} Collect evidence after executing ${task.id}; inspect ${task.filesModified.join(", ")}.`,
    })));
    const unknowns: PhasePlanStructuredModel["unknownsAndDeferrals"] = [...(plan.unknownsAndDeferrals ?? []), ...[...deferrals.values()].map((row) => ({
      item: row.requirement,
      disposition: "deferred" as const,
      rationale: row.rationale,
      followUp: row.followUp,
    }))];
    if (unknowns.length === 0) unknowns.push({
      item: "No additional unknowns or deferrals were declared in this candidate.",
      disposition: "none",
      rationale: "This row records the candidate's declared state; it does not certify that execution has resolved every risk.",
      followUp: "Record newly discovered blockers before changing the accepted plan.",
    });
    const model: PhasePlanStructuredModel = {
      title: plan.title,
      wave: waves.get(id) ?? 1,
      status: "planned",
      objective: plan.goal,
      dependsOn: dependencies.get(id) ?? [],
      requirements: uniquePreservingOrder(tasks.flatMap((task) => task.requirements)),
      filesModified,
      readFirst: uniquePreservingOrder(tasks.flatMap((task) => task.readFirst)),
      autonomous: plan.autonomous ?? true,
      goal: plan.goal,
      scope: plan.scope,
      tasks,
      externalServicePrerequisites: plan.externalServicePrerequisites ?? [],
      verification: checks,
      mustHaves: plan.mustHaves,
      requirementCoverage: requirements.map((requirement) => {
        const coveredTasks = tasks.filter((task) => task.requirements.includes(requirement));
        if (coveredTasks.length) return {
          requirement, status: "covered" as const,
          coveredByTasks: coveredTasks.map((task) => task.id),
          evidence: coveredTasks.flatMap((task) => task.acceptanceCriteria).join("; "),
          rationale: `Assigned to tasks ${coveredTasks.map((task) => task.id).join(", ")} in this plan.`,
        };
        const otherOwners = uniquePreservingOrder([
          ...(owners.get(requirement) ?? []),
          ...retained.filter((saved) => saved.requirements?.includes(requirement)).map((saved) => saved.planId),
        ]);
        const deferral = deferrals.get(requirement);
        return {
          requirement, status: "deferred" as const, coveredByTasks: [],
          evidence: otherOwners.length ? `Assigned to plans ${otherOwners.join(", ")}.` : deferral ? deferral.followUp : "No owner identified in the supplied plan-set context; final coverage validation is required.",
          rationale: otherOwners.length ? "Owned by another plan in the phase; this plan does not claim its work." : deferral ? deferral.rationale : "This candidate leaves the requirement unassigned; execution readiness is not established by this ledger.",
        };
      }),
      evidenceCoverage: evidenceArtifacts.map((artifact) => ({
        artifact,
        status: citedEvidence.has(artifact) ? "used" as const : "irrelevant" as const,
        rationale: citedEvidence.get(artifact) ?? "Available in the prepared evidence inventory but not cited by this candidate; no use is claimed.",
      })),
      fileSurfaceCoverage: filesModified.map((surface) => {
        const coveredTasks = tasks.filter((task) => task.filesModified.includes(surface));
        return {
          surface,
          coveredByTasks: coveredTasks.map((task) => task.id),
          verification: coveredTasks.flatMap((task) => task.acceptanceCriteria).join("; "),
          rationale: `Declared modification surface of tasks ${coveredTasks.map((task) => task.id).join(", ")}.`,
        };
      }),
      unknownsAndDeferrals: unknowns,
      ...(plan.gapClosure === undefined ? {} : { gapClosure: plan.gapClosure }),
    };
    return { planId: id, model };
  });
  result.valid = true;
  return result;
}
