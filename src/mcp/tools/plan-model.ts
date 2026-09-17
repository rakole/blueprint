import * as z from "zod/v4";
import { safeJsonParse } from "../../shared/security.js";
import { uniquePreservingOrder } from "./phase-collection-helpers.js";
import { normalizePlanId } from "./phase-plan-identifiers.js";
import type { PhasePlanStructuredModel } from "./phase-plan-rendering.js";

// Publication still uses phase.plan's existing structured model. This smaller
// contract contains author judgment; the compiler owns its repeated ledgers.
const narrative = z.string().min(1).regex(/\S/, "Use concrete nonblank text.")
  .regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+$/, "Text cannot contain control characters other than tabs and line endings.")
  .transform(value => value.replace(/\r\n?/g, "\n").trim());
const heading = narrative.transform(value => value.replace(/[\t\n]/g, " "));
const repoPath = z.string().min(1).regex(
  /^(?!\s)(?!.*\s$)(?!.*[\u0000-\u001f\u007f])(?!\/)(?!~)(?![A-Za-z]:)(?!.*\\)(?!.*(?:^|\/)\.\.?(?:\/|$))(?!.*\/\/)(?!.*[*?])(?!.*\/$).*\S.*$/,
  "Use a concrete repo-relative file path without traversal, wildcard operators (* and ?), or control characters. Brackets, braces and parentheses are literal filename characters.",
);
const taskId = z.string().trim().regex(/^[A-Za-z0-9._-]+$/);
const reference = z.string().trim().min(1).regex(/^[^\u0000-\u001f\u007f]+$/);
const key = reference.refine(value => !/^[0-9]+$/.test(value), "Numeric keys are reserved for existing saved plan ids.")
  .describe("Optional local plan key, referenced by dependsOn. Any nonnumeric text is allowed. Omit for a single independent plan.");
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
    key: key.optional(),
    title: heading,
    goal: narrative,
    scope: z.array(narrative).optional().describe("Optional narrower scope; defaults to the goal."),
    dependsOn: z.array(reference).optional().describe("Local plan keys or retained saved numeric plan ids. Defaults to no dependencies."),
    tasks: z.array(z.strictObject({
      id: taskId.optional().describe("Optional task reference; MCP assigns T1, T2, etc. when omitted."),
      title: heading,
      readFirst: z.array(repoPath).optional().describe("Additional executor context. When omitted or empty, MCP selects a prepared evidence artifact."),
      filesModified: z.array(repoPath).min(1),
      requirements: z.array(reference).min(1),
      action: z.array(narrative).min(1),
      acceptanceCriteria: z.array(narrative).min(1),
    })).min(1),
    mustHaves: z.array(narrative).optional().describe("Optional goal-backward facts; defaults to the task acceptance criteria."),
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
      .describe("Only phase-artifact paths from prepare.knownEvidenceArtifacts, with the reason used. Repository source files belong in task.readFirst; prepare narrows the allowed citation values.").optional(),
    unknownsAndDeferrals: z.array(unknownOrDeferral).optional(),
  })).min(1),
  deferrals: z.array(z.strictObject({
    requirement: reference,
    rationale: narrative,
    followUp: narrative,
  })).optional(),
});

// Older/full PLAN models repeat these values. Accept and recompute them rather
// than making the author regenerate otherwise usable work to remove bookkeeping.
const runtimePlanFields = new Set([
  "planId", "path", "wave", "status", "objective", "requirements", "filesModified", "readFirst",
  "requirementCoverage", "evidenceCoverage", "fileSurfaceCoverage",
]);
export const planningCandidateJsonSchema: Record<string, unknown> = z.toJSONSchema(authoringSchema, { io: "input" });

/** Give the author the actual allowed references before generation. */
export function planningPreparedSchema(context: Pick<PlanningCandidateContext, "knownRequirements" | "knownEvidenceArtifacts">): Record<string, unknown> {
  const allowed = (values: string[]) => values.length ? z.enum(values) : z.never();
  const plan = authoringSchema.shape.plans.element;
  const prepared = authoringSchema.extend({
    plans: z.array(plan.extend({
      tasks: z.array(plan.shape.tasks.element.extend({
        requirements: z.array(allowed(context.knownRequirements)).min(1),
      })).min(1),
      evidence: z.array(z.strictObject({
        artifact: allowed(context.knownEvidenceArtifacts), rationale: narrative,
      })).optional().describe("Cite only these saved phase artifacts. Put repository source paths in task.readFirst."),
    })).min(1),
  });
  return z.toJSONSchema(prepared, { io: "input" });
}

export const planningDerivedFields = [
  "Canonical plan ids and paths, planned status, dependency waves, objective, aggregate requirements/files/read-first lists, and coverage tables are computed by MCP.",
  "Omitted keys and task ids receive stable local identifiers. Empty or omitted dependencies mean no dependencies.",
  "Empty or omitted scope uses the goal; mustHaves and verification use authored acceptance criteria; readFirst uses prepared evidence.",
  "Optional evidence, service prerequisites, deferrals, and unknowns need only describe relevant facts. Empty arrays or omitted sections need no filler rows.",
];

export const planningValidationRules = {
  reject: [
    "Missing goal, task action, acceptance criteria, concrete modified files, or known requirement references.",
    "Any required phase outcome left unassigned across submitted and retained plans. A deferral explains missing work but does not satisfy final phase coverage.",
    "Unknown references, ambiguous identifiers, dependency cycles, or conflicting file ownership in the same wave.",
    "Evidence citations must use knownEvidenceArtifacts; repository sources belong in task.readFirst. The prepared schema lists allowed requirement and citation values.",
    "Unsafe paths or control characters, changed evidence/targets, and unapproved overwrite of existing plans.",
  ],
  advisory: ["Missing evidence citations, task/file counts, wording preferences and keyword-based judgments are guidance; semantic adequacy belongs to review."],
  normalize: ["Prose and code may span lines. MCP normalizes CRLF and outer whitespace and renders canonical Markdown safely.", ...planningDerivedFields],
};

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

/** A shape example grounded in the actual prepared requirement/evidence inventory. */
export function planningModelExample(context: Pick<PlanningCandidateContext, "knownRequirements" | "knownEvidenceArtifacts">): PlanningCandidate {
  return {
    plans: [{
      title: "Implement the selected phase behavior",
      goal: "Deliver the behavior described by the selected requirement through the existing application boundary.",
      tasks: [{
        title: "Implement and verify the required behavior",
        filesModified: ["src/feature.ts", "tests/feature.test.ts"],
        requirements: [...context.knownRequirements],
        action: ["Replace these illustrative paths with the concrete repository files to change. Describe the implementation using the prepared context and research."],
        acceptanceCriteria: ["The feature test exercises the required behavior and passes with the repository's test command."],
        ...(context.knownEvidenceArtifacts[0] ? { readFirst: [context.knownEvidenceArtifacts[0]] } : {}),
      }],
    }],
  };
}
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
  return "model" + segments.map((part) => typeof part === "number" ? `[${part}]` : `.${String(part)}`).join("");
}

/** Pure, deterministic compilation. Invalid authoring input is never persisted. */
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
    issue("model", "schema.json", error instanceof Error ? error.message : "Planning candidate is not valid JSON.");
    return result;
  }
  if (input && typeof input === "object" && "plans" in input && Array.isArray(input.plans)) {
    input = {
      ...input,
      plans: input.plans.map((plan: unknown, index: number) => {
        if (!plan || typeof plan !== "object" || Array.isArray(plan)) return plan;
        const entries = Object.entries(plan);
        const ignored = entries.filter(([field]) => runtimePlanFields.has(field)).map(([field]) => field);
        if (ignored.length) issue(`model.plans[${index}]`, "planning.derived_fields", `MCP recomputed supplied bookkeeping: ${ignored.join(", ")}.`, "warning");
        return Object.fromEntries(entries.filter(([field]) => !runtimePlanFields.has(field)));
      }),
    };
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
  const explicitKeys = new Set(parsed.data.plans.flatMap(plan => plan.key ? [plan.key] : []));
  let nextKey = 1;
  const candidate = {
    ...parsed.data,
    plans: parsed.data.plans.map(plan => {
      let planKey = plan.key;
      if (!planKey) {
        while (explicitKeys.has(`plan${nextKey}`)) nextKey += 1;
        planKey = `plan${nextKey++}`;
        explicitKeys.add(planKey);
      }
      const explicitTaskIds = new Set(plan.tasks.flatMap(task => task.id ? [task.id] : []));
      let nextTask = 1;
      const tasks = plan.tasks.map(task => {
        let id = task.id;
        if (!id) {
          while (explicitTaskIds.has(`T${nextTask}`)) nextTask += 1;
          id = `T${nextTask++}`;
          explicitTaskIds.add(id);
        }
        return { ...task, id, readFirst: task.readFirst?.length ? task.readFirst : context.knownEvidenceArtifacts.slice(0, 1) };
      });
      return {
        ...plan,
        key: planKey,
        dependsOn: plan.dependsOn ?? [],
        scope: plan.scope?.length ? plan.scope : [plan.goal],
        mustHaves: plan.mustHaves?.length ? plan.mustHaves : uniquePreservingOrder(tasks.flatMap(task => task.acceptanceCriteria)),
        tasks,
      };
    }),
  };
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
    issue("model.plans", "planning.target_count", "Revise requires one candidate plan for each targetPlanIds entry, in the selected order.");
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
    if (localIds.has(plan.key)) issue(`model.plans[${index}].key`, "planning.duplicate_key", `Plan key ${plan.key} must be unique.`);
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
        issue(`model.plans[${index}].dependsOn[${dependencyIndex}]`, "planning.dependency_missing", `Dependency ${dependency} is not a candidate key or a retained saved plan. Use candidate keys to reference plans in this submission.`);
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
      issue("model.plans", "planning.dependency_cycle", `Dependency cycle reaches plan ${id}.`);
      return 0;
    }
    if (visited.has(id)) return waves.get(id) ?? 1;
    visiting.add(id);
    const minimumWave = Math.max(0, ...(dependencies.get(id) ?? []).map(visit)) + 1;
    if (retainedIds.has(id)) {
      if ((waves.get(id) ?? 0) < minimumWave) {
        issue("model.plans", "planning.saved_wave_conflict", `Saved plan ${id} would need wave ${minimumWave} or later. Include that plan in the revision targets to recompute its wave.`);
      }
    } else {
      waves.set(id, minimumWave);
      if (!Number.isSafeInteger(minimumWave)) {
        issue("model.plans", "planning.wave_overflow", `Plan ${id} would exceed the supported integer wave range.`);
      }
    }
    visiting.delete(id);
    visited.add(id);
    return waves.get(id) ?? minimumWave;
  };
  for (const id of dependencies.keys()) visit(id);
  const deferrals = new Map<string, NonNullable<PlanningCandidate["deferrals"]>[number]>();
  for (const [index, row] of (candidate.deferrals ?? []).entries()) {
    if (!knownRequirements.has(row.requirement)) issue(`model.deferrals[${index}].requirement`, "planning.requirement_unknown", `Unknown requirement ${row.requirement}.`);
    if (deferrals.has(row.requirement)) issue(`model.deferrals[${index}].requirement`, "planning.duplicate_deferral", `Requirement ${row.requirement} has multiple deferrals.`);
    deferrals.set(row.requirement, row);
  }
  const owners = new Map<string, string[]>();
  const fileOwners = new Map<string, { id: string; wave: number }>();
  for (const [index, plan] of candidate.plans.entries()) {
    const id = result.planIds[index];
    const taskIds = new Set<string>();
    for (const [taskIndex, task] of plan.tasks.entries()) {
      if (taskIds.has(task.id)) issue(`model.plans[${index}].tasks[${taskIndex}].id`, "planning.duplicate_task", `Task id ${task.id} must be unique within its plan.`);
      taskIds.add(task.id);
      for (const [requirementIndex, requirement] of task.requirements.entries()) {
        if (!knownRequirements.has(requirement)) issue(`model.plans[${index}].tasks[${taskIndex}].requirements[${requirementIndex}]`, "planning.requirement_unknown", `Unknown requirement ${requirement}.`);
        owners.set(requirement, uniquePreservingOrder([...(owners.get(requirement) ?? []), id]));
      }
    }
    for (const [evidenceIndex, evidence] of (plan.evidence ?? []).entries()) {
      if (!knownEvidence.has(evidence.artifact)) issue(`model.plans[${index}].evidence[${evidenceIndex}].artifact`, "planning.evidence_unknown", `Evidence ${evidence.artifact} is not in the prepared evidence inventory.`);
    }
    for (const file of uniquePreservingOrder(plan.tasks.flatMap((task) => task.filesModified))) {
      const wave = waves.get(id) ?? 1;
      const ownershipKey = `${wave}:${file}`;
      const prior = fileOwners.get(ownershipKey);
      if (prior) issue(`model.plans[${index}].tasks`, "planning.file_ownership_conflict", `Plans ${prior.id} and ${id} both modify ${file} in wave ${wave}. Add a dependency or split ownership.`);
      else fileOwners.set(ownershipKey, { id, wave });
    }
  }
  for (const [requirement, row] of deferrals) {
    if (owners.has(requirement)) issue("model.deferrals", "planning.deferral_conflict", `Requirement ${row.requirement} is both assigned to candidate tasks and deferred for the phase.`);
  }
  for (const requirement of requirements) {
    if (!owners.has(requirement) && !deferrals.has(requirement) && !retained.some((plan) => plan.requirements?.includes(requirement))) {
      issue("model.plans", "planning.requirement_unassigned", `Requirement ${requirement} is not assigned by this candidate. Final plan-set coverage must resolve it before execution.`, "warning");
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
    const citedEvidence = new Map<string, string>();
    for (const row of plan.evidence ?? []) {
      citedEvidence.set(row.artifact, uniquePreservingOrder([...(citedEvidence.has(row.artifact) ? [citedEvidence.get(row.artifact)!] : []), row.rationale]).join("\n"));
    }
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
