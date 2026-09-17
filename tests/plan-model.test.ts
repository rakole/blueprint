import test from "node:test";
import assert from "node:assert/strict";
import { readArtifactContract } from "../src/mcp/artifact-contracts/index.js";
import { createAjvValidator } from "../src/mcp/tools/phase-json-helpers.js";
import {
  compilePlanCandidate,
  planningCandidateJsonSchema,
  planningPreparedSchema,
  planningModelExample,
  planningValidationRules,
  type PlanningCandidate,
  type PlanningCandidateContext,
} from "../src/mcp/tools/plan-model.js";
import { renderPhasePlanModelContent } from "../src/mcp/tools/phase-plan-rendering.js";
import { validatePlanArtifactContent } from "../src/mcp/tools/artifacts.js";

function plan(key = "base", requirement = "REQ-01"): PlanningCandidate["plans"][number] {
  return {
    key,
    title: `Implement ${key}`,
    goal: `Expose ${key} behavior through the existing service.`,
    scope: [`Update src/${key}.ts and its acceptance checks.`],
    dependsOn: [],
    tasks: [{
      id: "T1",
      title: `Implement ${key} behavior`,
      readFirst: ["README.md", `src/${key}.ts`],
      filesModified: [`src/${key}.ts`],
      requirements: [requirement],
      action: [`Add the ${key} behavior in src/${key}.ts.`],
      acceptanceCriteria: [`src/${key}.ts exports the ${key} function.`, "npm test exits with status 0."],
    }],
    mustHaves: [`The ${key} function exposes the required behavior.`],
  };
}

function context(overrides: Partial<PlanningCandidateContext> = {}): PlanningCandidateContext {
  return {
    knownRequirements: ["REQ-01"],
    knownEvidenceArtifacts: [".blueprint/PROJECT.md", ".blueprint/phases/01-core/01-CONTEXT.md"],
    existingPlans: [], mode: "add", targetPlanIds: [],
    ...overrides,
  };
}

test("compact schema accepts one-shot candidates and compiled models preserve the legacy contract", () => {
  const raw = { plans: [plan()] };
  const validateCandidate = createAjvValidator().compile(planningCandidateJsonSchema);
  assert.equal(validateCandidate(raw), true, JSON.stringify(validateCandidate.errors));
  const compiled = compilePlanCandidate(raw, context());
  assert.equal(compiled.valid, true, JSON.stringify(compiled.diagnostics));
  assert.deepEqual(compiled.planIds, ["01"]);
  const model = compiled.models[0].model;
  assert.equal(Object.keys(model).length, 19);
  const validateLegacy = createAjvValidator().compile(readArtifactContract("phase.plan").modelContract!.jsonSchema);
  assert.equal(validateLegacy(model), true, JSON.stringify(validateLegacy.errors));
  assert.equal(model.objective, raw.plans[0].goal);
  assert.equal(model.status, "planned");
  assert.equal(model.wave, 1);
  assert.equal(model.autonomous, true);
  assert.deepEqual(model.externalServicePrerequisites, []);
  assert.equal(model.unknownsAndDeferrals[0].disposition, "none");
  assert.equal(model.verification[0].method, "file-read");
  assert.equal(model.verification[1].method, "command");
  assert.ok(model.verification.every((item) => item.evidence.includes("Collect evidence after executing")));
});

test("local dependencies support forward references and derive waves above retained saved plans", () => {
  const first = plan("feature", "REQ-02");
  first.dependsOn = ["foundation", "2", "02"];
  const second = plan("foundation");
  second.dependsOn = ["02"];
  const compiled = compilePlanCandidate({ plans: [first, second] }, context({
    knownRequirements: ["REQ-01", "REQ-02"],
    existingPlans: [{ planId: "02", wave: 3 }],
  }));
  assert.equal(compiled.valid, true, JSON.stringify(compiled.diagnostics));
  assert.deepEqual(compiled.planIds, ["03", "04"]);
  assert.deepEqual(compiled.models.map(({ model }) => model.wave), [5, 4]);
  assert.deepEqual(compiled.models[0].model.dependsOn, ["04", "02"]);
  assert.deepEqual(compiled.models[1].model.dependsOn, ["02"]);
  const row = compiled.models[0].model.requirementCoverage.find((entry) => entry.requirement === "REQ-01")!;
  assert.equal(row.status, "deferred");
  assert.deepEqual(row.coveredByTasks, []);
  assert.match(row.evidence, /04/);
});

test("task declarations derive stable unique unions and exact ledgers without invented evidence use", () => {
  const raw = plan();
  raw.tasks.push({ ...raw.tasks[0], id: "T2", readFirst: ["README.md", "src/second.ts"], requirements: ["REQ-02", "REQ-02"], filesModified: ["src/base.ts", "src/second.ts"] });
  raw.evidence = [{ artifact: ".blueprint/PROJECT.md", rationale: "The project defines the service boundary." }];
  const compiled = compilePlanCandidate({ plans: [raw] }, context({ knownRequirements: ["REQ-01", "REQ-02", "REQ-01"] }));
  assert.equal(compiled.valid, true, JSON.stringify(compiled.diagnostics));
  const model = compiled.models[0].model;
  assert.deepEqual(model.readFirst, ["README.md", "src/base.ts", "src/second.ts"]);
  assert.deepEqual(model.filesModified, ["src/base.ts", "src/second.ts"]);
  assert.deepEqual(model.requirements, ["REQ-01", "REQ-02"]);
  assert.deepEqual(model.requirementCoverage.map((row) => row.coveredByTasks), [["T1"], ["T2"]]);
  assert.deepEqual(model.fileSurfaceCoverage.map((row) => row.coveredByTasks), [["T1", "T2"], ["T2"]]);
  assert.equal(model.evidenceCoverage.length, 2);
  assert.equal(model.evidenceCoverage[0].status, "used");
  assert.equal(model.evidenceCoverage[0].rationale, raw.evidence[0].rationale);
  assert.equal(model.evidenceCoverage[1].status, "irrelevant");
  assert.match(model.evidenceCoverage[1].rationale, /not cited/);
});

test("per-plan coverage names actual retained owners and preserves explicit deferral reasoning", () => {
  const compiled = compilePlanCandidate({
    plans: [plan()],
    deferrals: [{ requirement: "REQ-03", rationale: "The upstream API is unavailable.", followUp: "Schedule API integration after access is provisioned." }],
  }, context({
    knownRequirements: ["REQ-01", "REQ-02", "REQ-03", "REQ-04"],
    existingPlans: [{ planId: "01", wave: 1, requirements: ["REQ-02"] }],
  }));
  assert.equal(compiled.valid, true, JSON.stringify(compiled.diagnostics));
  const model = compiled.models[0].model;
  assert.match(model.requirementCoverage[1].evidence, /plans 01/);
  assert.equal(model.requirementCoverage[2].rationale, "The upstream API is unavailable.");
  assert.equal(model.requirementCoverage[2].evidence, "Schedule API integration after access is provisioned.");
  assert.equal(model.unknownsAndDeferrals[0].item, "REQ-03");
  assert.equal(model.unknownsAndDeferrals[0].disposition, "deferred");
  assert.match(model.requirementCoverage[3].rationale, /unassigned/);
  assert.equal(compiled.diagnostics.filter((row) => row.code === "planning.requirement_unassigned").length, 1);
  assert.equal(compiled.diagnostics[0].severity, "warning");
});

test("unknown requirements, unknown evidence and conflicting phase deferrals are field errors", () => {
  const raw = plan("base", "REQ-404");
  raw.evidence = [{ artifact: "missing.md", rationale: "Cited by the author." }];
  const compiled = compilePlanCandidate({ plans: [raw], deferrals: [{ requirement: "REQ-404", rationale: "Deferred elsewhere.", followUp: "Revisit the API." }] }, context());
  assert.equal(compiled.valid, false);
  assert.deepEqual(compiled.models, []);
  for (const code of ["planning.requirement_unknown", "planning.evidence_unknown", "planning.deferral_conflict"]) {
    assert.ok(compiled.diagnostics.some((row) => row.code === code), code);
  }
  assert.ok(compiled.diagnostics.some((row) => row.path === "model.plans[0].tasks[0].requirements[0]"));
});

test("cycles, self references and missing dependencies cannot compile into publishable plans", () => {
  for (const dependencies of [["base"], ["missing"], ["99"]]) {
    const raw = plan(); raw.dependsOn = dependencies;
    const compiled = compilePlanCandidate({ plans: [raw] }, context());
    assert.equal(compiled.valid, false);
    assert.ok(compiled.diagnostics.some((row) => row.code === (dependencies[0] === "base" ? "planning.dependency_cycle" : "planning.dependency_missing")));
  }
  const first = plan("first"); first.dependsOn = ["second"];
  const second = plan("second"); second.dependsOn = ["first"];
  assert.ok(compilePlanCandidate({ plans: [first, second] }, context()).diagnostics.some((row) => row.code === "planning.dependency_cycle"));
});

test("revisions keep selected slot order and resolve numeric references to revised plans", () => {
  const first = plan("feature"); first.dependsOn = ["foundation"];
  const second = plan("foundation");
  const ctx = context({ mode: "revise", targetPlanIds: ["5", "02"], existingPlans: [{ planId: "02", wave: 1 }, { planId: "05", wave: 2, dependsOn: ["02"] }] });
  const compiled = compilePlanCandidate({ plans: [first, second] }, ctx);
  assert.equal(compiled.valid, true, JSON.stringify(compiled.diagnostics));
  assert.deepEqual(compiled.planIds, ["05", "02"]);
  assert.deepEqual(compiled.models.map(({ model }) => model.wave), [2, 1]);
  first.dependsOn = ["2"];
  assert.deepEqual(compilePlanCandidate({ plans: [first, second] }, ctx), compiled);
  assert.ok(compilePlanCandidate({ plans: [first] }, ctx).diagnostics.some((row) => row.code === "planning.target_count"));
});

test("revisions detect cycles through retained plans and reject invalid retained waves", () => {
  const raw = plan(); raw.dependsOn = ["02"];
  const cyclic = compilePlanCandidate({ plans: [raw] }, context({ mode: "revise", targetPlanIds: ["01"], existingPlans: [{ planId: "01", wave: 1 }, { planId: "02", wave: 2, dependsOn: ["01"] }] }));
  assert.ok(cyclic.diagnostics.some((row) => row.code === "planning.dependency_cycle"));
  raw.dependsOn = ["03"];
  const conflict = compilePlanCandidate({ plans: [raw] }, context({ mode: "revise", targetPlanIds: ["01"], existingPlans: [{ planId: "01", wave: 1 }, { planId: "02", wave: 2, dependsOn: ["01"] }, { planId: "03", wave: 3 }] }));
  assert.ok(conflict.diagnostics.some((row) => row.code === "planning.saved_wave_conflict"));
});

test("replace reuses selected slots and cannot accidentally depend on discarded saved plans", () => {
  const raw = plan();
  const ctx = context({ mode: "replace", existingPlans: [{ planId: "09", wave: 4 }] });
  const compiled = compilePlanCandidate({ plans: [raw, plan("next")] }, ctx);
  assert.equal(compiled.valid, true, JSON.stringify(compiled.diagnostics));
  assert.deepEqual(compiled.planIds, ["09", "10"]);
  raw.dependsOn = ["09"];
  assert.ok(compilePlanCandidate({ plans: [raw] }, ctx).diagnostics.some((row) => row.code === "planning.dependency_missing"));
});

test("ambiguous numeric slots, duplicate selections and invalid slot choices are rejected", () => {
  const raw = { plans: [plan()] };
  const fixtures: Array<[Partial<PlanningCandidateContext>, string]> = [
    [{ existingPlans: [{ planId: "01", wave: 1 }, { planId: "001", wave: 1 }] }, "planning.ambiguous_saved_slot"],
    [{ existingPlans: [{ planId: "0", wave: 1 }] }, "planning.invalid_saved_plan"],
    [{ existingPlans: [{ planId: "01", wave: 0 }] }, "planning.invalid_saved_plan"],
    [{ mode: "revise", targetPlanIds: ["99"] }, "planning.target_missing"],
    [{ mode: "revise", targetPlanIds: ["1", "01"], existingPlans: [{ planId: "01", wave: 1 }] }, "planning.duplicate_target"],
    [{ targetPlanIds: ["01"], existingPlans: [{ planId: "01", wave: 1 }] }, "planning.add_targets"],
  ];
  for (const [override, code] of fixtures) assert.ok(compilePlanCandidate(raw, context(override)).diagnostics.some((row) => row.code === code), code);
});

test("partial replacement preserves unselected plans and allocates extra slots above saved ids", () => {
  const first = plan("first"); first.dependsOn = ["02"];
  const second = plan("second"); second.dependsOn = ["first"];
  const ctx = context({ mode: "replace", targetPlanIds: ["05"], existingPlans: [
    { planId: "02", wave: 2 }, { planId: "05", wave: 3 }, { planId: "09", wave: 1 }
  ] });
  const compiled = compilePlanCandidate({ plans: [first, second] }, ctx);
  assert.equal(compiled.valid, true, JSON.stringify(compiled.diagnostics));
  assert.deepEqual(compiled.planIds, ["05", "10"]);
  assert.deepEqual(compiled.models.map(plan => plan.model.wave), [3, 4]);
  assert.deepEqual(compiled.models[0].model.dependsOn, ["02"]);
  const removedDependency = compilePlanCandidate({ plans: [plan()] }, context({
    mode: "replace", targetPlanIds: ["01", "02"], existingPlans: [
      { planId: "01", wave: 1 }, { planId: "02", wave: 1 }, { planId: "03", wave: 2, dependsOn: ["02"] }
    ]
  }));
  assert.ok(removedDependency.diagnostics.some(issue => issue.code === "planning.saved_dependency_missing"));
});

test("overlapping files in one wave require an explicit dependency", () => {
  const first = plan("first"); const second = plan("second");
  second.tasks[0].filesModified = first.tasks[0].filesModified;
  const raw = { plans: [first, second] };
  assert.ok(compilePlanCandidate(raw, context()).diagnostics.some((row) => row.code === "planning.file_ownership_conflict"));
  second.dependsOn = ["first"];
  assert.equal(compilePlanCandidate(raw, context()).valid, true);
});

test("literal framework paths are supported while traversal and path aliases are rejected", () => {
  for (const file of ["app/users/[id]/page.tsx", "app/(group)/[...slug]/page.tsx", "src/data store.ts", "src/{a,b}.ts"]) {
    const raw = plan(); raw.tasks[0].filesModified = [file];
    assert.equal(compilePlanCandidate({ plans: [raw] }, context()).valid, true, file);
  }
  for (const file of ["../outside", "src/../outside", "/tmp/file", "~/file", "C:\\file", "C:file", "src\\file", "src/*.ts", "src/?.ts", "src/\nfile", "src/\u0000file", ".", "./file", "src//file", "src/", " src/file", "src/file "]) {
    const raw = plan(); raw.tasks[0].filesModified = [file];
    const compiled = compilePlanCandidate({ plans: [raw] }, context());
    assert.equal(compiled.valid, false, file);
    assert.ok(compiled.diagnostics.some((row) => row.path === "model.plans[0].tasks[0].filesModified[0]"), file);
  }
});

test("schema errors identify malformed JSON, omitted concrete work and unrecognized fields", () => {
  for (const raw of ['{"plans":', null, [], 4, { plans: [] }]) {
    const compiled = compilePlanCandidate(raw, context());
    assert.equal(compiled.valid, false);
    assert.ok(compiled.diagnostics.every((row) => row.path.startsWith("model")));
  }
  const raw = plan();
  const extra = { ...plan(), unrelatedField: "unrecognized authoring content" };
  assert.ok(compilePlanCandidate({ plans: [extra] }, context()).diagnostics.some((row) => row.path === "model.plans[0].unrelatedField" && row.code === "schema.unknown_field"));
  raw.tasks[0].action = [];
  assert.equal(compilePlanCandidate({ plans: [raw] }, context()).valid, false);
});

test("duplicate local/task ids and numeric local keys cannot be mistaken for references", () => {
  const raw = plan(); raw.tasks.push(structuredClone(raw.tasks[0]));
  raw.evidence = [{ artifact: ".blueprint/PROJECT.md", rationale: "Defines the boundary." }, { artifact: ".blueprint/PROJECT.md", rationale: "Defines the goal." }];
  const compiled = compilePlanCandidate({ plans: [raw, structuredClone(raw)] }, context());
  for (const code of ["planning.duplicate_key", "planning.duplicate_task"]) assert.ok(compiled.diagnostics.some((row) => row.code === code), code);
  raw.key = "01";
  assert.equal(compilePlanCandidate({ plans: [raw] }, context()).valid, false);
});

test("JSON code strings and optional human-authored details survive without raw input mutation", () => {
  const raw = plan();
  raw.tasks[0].action = ['Add `const payload = {"ok": true, "text": "value"};` to the serializer.'];
  raw.autonomous = false;
  raw.gapClosure = true;
  raw.verification = [{ item: "Verify serializer bytes", method: "test", evidence: "node --test tests/serializer.test.js exits 0." }];
  raw.externalServicePrerequisites = [{ service: "Test API", category: "local API server", purpose: "Exercise round trips", userSetup: "Start the test server", readinessCheck: "curl localhost:3000/health returns 200", canAgentProceedWithoutIt: false }];
  raw.unknownsAndDeferrals = [{ item: "API response latency", disposition: "unknown", rationale: "The new API has no recorded baseline.", followUp: "Record timings during verification." }];
  const candidate = { plans: [raw] };
  const ctx = context();
  const before = structuredClone({ candidate, ctx });
  const compiled = compilePlanCandidate(candidate, ctx);
  assert.equal(compiled.valid, true, JSON.stringify(compiled.diagnostics));
  assert.deepEqual(compiled, compilePlanCandidate(JSON.stringify(candidate), ctx));
  assert.deepEqual({ candidate, ctx }, before);
  const model = compiled.models[0].model;
  assert.equal(model.autonomous, false);
  assert.equal(model.gapClosure, true);
  assert.deepEqual(model.tasks[0].action, raw.tasks[0].action);
  assert.deepEqual(model.verification, raw.verification);
  assert.deepEqual(model.externalServicePrerequisites, raw.externalServicePrerequisites);
  assert.deepEqual(model.unknownsAndDeferrals, raw.unknownsAndDeferrals);
  model.tasks[0].action.push("Edit only the compiled copy.");
  assert.deepEqual({ candidate, ctx }, before);
});

test("the prepared authoring example compiles with useful defaults and matches its input schema", () => {
  const prepared = context();
  const example = planningModelExample(prepared);
  const validate = createAjvValidator().compile(planningCandidateJsonSchema);
  assert.equal(validate(example), true, JSON.stringify(validate.errors));
  const compiled = compilePlanCandidate(example, prepared);
  assert.equal(compiled.valid, true, JSON.stringify(compiled.diagnostics));
  const model = compiled.models[0].model;
  assert.equal(model.tasks[0].id, "T1");
  assert.deepEqual(model.scope, [example.plans[0].goal]);
  assert.deepEqual(model.mustHaves, example.plans[0].tasks[0].acceptanceCriteria);
  assert.deepEqual(model.dependsOn, []);
  assert.ok(planningValidationRules.reject.some(rule => rule.includes("acceptance criteria")));
});

test("empty optional lists and omitted bookkeeping preserve concrete task work on the first compile", () => {
  const raw = planningModelExample(context());
  raw.plans[0].scope = [];
  raw.plans[0].mustHaves = [];
  raw.plans[0].verification = [];
  raw.plans[0].evidence = [];
  raw.plans[0].externalServicePrerequisites = [];
  raw.plans[0].unknownsAndDeferrals = [];
  raw.plans[0].tasks[0].readFirst = [];
  const compiled = compilePlanCandidate(raw, context());
  assert.equal(compiled.valid, true, JSON.stringify(compiled.diagnostics));
  const model = compiled.models[0].model;
  assert.deepEqual(model.tasks[0].readFirst, [context().knownEvidenceArtifacts[0]]);
  assert.deepEqual(model.scope, [raw.plans[0].goal]);
  assert.deepEqual(model.mustHaves, raw.plans[0].tasks[0].acceptanceCriteria);
  assert.equal(model.verification.length, 1);
});

test("generated identifiers avoid explicit ids and dependencies accept descriptive keys", () => {
  const first = plan("1. Foundation — API");
  first.tasks[0].id = undefined;
  first.tasks.push({ ...first.tasks[0], id: "T1" });
  const second = plan("_Consumer"); second.dependsOn = ["1. Foundation — API"];
  const third = plan("plan1"); third.key = undefined;
  const fourth = plan("plan1"); fourth.tasks[0].filesModified = ["src/fourth.ts"];
  const compiled = compilePlanCandidate({ plans: [first, second, third, fourth] }, context());
  assert.equal(compiled.valid, true, JSON.stringify(compiled.diagnostics));
  assert.deepEqual(compiled.models[0].model.tasks.map(task => task.id), ["T2", "T1"]);
  assert.deepEqual(compiled.models[1].model.dependsOn, ["01"]);
  assert.deepEqual(compiled.models.map(plan => plan.model.wave), [1, 2, 1, 1]);
});

test("redundant computed fields and repeated evidence do not reject substantive plans", () => {
  const raw = {
    ...plan(),
    wave: 99, status: "draft", objective: "A redundant objective", requirements: ["REQ-404"],
    evidence: [
      { artifact: ".blueprint/PROJECT.md", rationale: "Defines the application boundary." },
      { artifact: ".blueprint/PROJECT.md", rationale: "Specifies the compatibility promise." },
    ],
  };
  const compiled = compilePlanCandidate({ plans: [raw] }, context());
  assert.equal(compiled.valid, true, JSON.stringify(compiled.diagnostics));
  const model = compiled.models[0].model;
  assert.equal(model.wave, 1);
  assert.equal(model.status, "planned");
  assert.equal(model.objective, raw.goal);
  assert.deepEqual(model.requirements, ["REQ-01"]);
  assert.match(model.evidenceCoverage[0].rationale, /boundary\.\nSpecifies/);
  assert.equal(compiled.diagnostics.filter(diagnostic => diagnostic.code === "planning.derived_fields").length, 1);
});

test("multiline prose and code retain content while canonical Markdown structure remains intact", () => {
  const raw = plan();
  raw.title = "  Implement the\r\nbase behavior  ";
  raw.goal = "Expose the base behavior.\r\n## Nested explanation\r\nKeep the contract compatible.";
  raw.tasks[0].action = ["Add this code to src/base.ts:\r\n```ts\r\nconst value = {\r\n  enabled: true\r\n};\r\n```\r\n## Verification\r\nKeep the existing exports."];
  raw.tasks[0].acceptanceCriteria = ["The exported base function returns:\n```json\n{\"enabled\": true}\n```", "npm test exits with status 0."];
  raw.externalServicePrerequisites = [{ service: "Local API", category: "test service", purpose: "Verify round trips", userSetup: "Start the local API.", readinessCheck: "curl localhost:3000/health\nExpect status 200.", canAgentProceedWithoutIt: false }];
  const before = structuredClone(raw);
  const compiled = compilePlanCandidate({ plans: [raw] }, context());
  assert.equal(compiled.valid, true, JSON.stringify(compiled.diagnostics));
  const model = compiled.models[0].model;
  const validate = createAjvValidator().compile(readArtifactContract("phase.plan").modelContract!.jsonSchema);
  assert.equal(validate(model), true, JSON.stringify(validate.errors));
  assert.equal(model.title, "Implement the base behavior");
  assert.equal(model.tasks[0].action[0], raw.tasks[0].action[0].replace(/\r\n/g, "\n"));
  const rendered = renderPhasePlanModelContent(model, { phaseNumber: "1", phasePrefix: "01", phaseName: "Core" }, "01");
  assert.equal((rendered.match(/^## Verification$/gm) ?? []).length, 1);
  assert.match(rendered, /\n    const value = \{\n      enabled: true\n    \};/);
  assert.match(rendered, /objective: "Expose the base behavior\.\\n## Nested explanation/);
  assert.match(rendered, /curl localhost:3000\/health<br>Expect status 200/);
  const validation = validatePlanArtifactContent(rendered, "1", { strict: true });
  assert.equal(validation.valid, true, JSON.stringify(validation.issues));
  assert.equal(validation.metadata.objective, model.goal);
  assert.deepEqual(validation.metadata.acceptanceCriteria, model.tasks[0].acceptanceCriteria);
  assert.deepEqual(raw, before);
});

test("multiline support does not admit empty task instructions or control characters", () => {
  for (const change of [
    (raw: PlanningCandidate["plans"][number]) => { raw.tasks[0].action = [" \r\n \t "]; },
    (raw: PlanningCandidate["plans"][number]) => { raw.tasks[0].acceptanceCriteria = []; },
    (raw: PlanningCandidate["plans"][number]) => { raw.tasks[0].filesModified = []; },
    (raw: PlanningCandidate["plans"][number]) => { raw.tasks[0].requirements = ["REQ-404"]; },
    (raw: PlanningCandidate["plans"][number]) => { raw.goal = "Write the output\u001b[2J"; },
  ]) {
    const raw = plan(); change(raw);
    const compiled = compilePlanCandidate({ plans: [raw] }, context());
    assert.equal(compiled.valid, false);
    assert.deepEqual(compiled.models, []);
  }
});


test("prepared schema exposes allowed citations and requirement ids before model generation", () => {
  const ctx = context();
  const schema = planningPreparedSchema(ctx);
  const validate = createAjvValidator().compile(schema);
  const example = planningModelExample(ctx);
  assert.equal(validate(example), true, JSON.stringify(validate.errors));
  example.plans[0].evidence = [{ artifact: ctx.knownEvidenceArtifacts[0], rationale: "Defines scope." }];
  assert.equal(validate(example), true, JSON.stringify(validate.errors));
  example.plans[0].evidence[0].artifact = "src/base.ts";
  assert.equal(validate(example), false);
  assert.ok(JSON.stringify(schema).includes("task.readFirst"));
  delete example.plans[0].evidence;
  example.plans[0].tasks[0].readFirst = ["src/base.ts"];
  assert.equal(validate(example), true);
  example.plans[0].tasks[0].requirements = ["REQ-404"];
  assert.equal(validate(example), false);
});

test("derived must-haves accept untagged code fences and terse observable outcomes", () => {
  for (const criterion of ["```\nnpm test\n```", "/health → 200", "返回状态码200"]) {
    const raw = plan();
    delete raw.mustHaves;
    raw.tasks[0].acceptanceCriteria = [criterion];
    const compiled = compilePlanCandidate({ plans: [raw] }, context());
    assert.equal(compiled.valid, true, JSON.stringify(compiled.diagnostics));
    const rendered = renderPhasePlanModelContent(compiled.models[0].model,
      { phaseNumber: "1", phasePrefix: "01", phaseName: "Core" }, "01");
    const validation = validatePlanArtifactContent(rendered, "1", { strict: true });
    assert.equal(validation.valid, true, JSON.stringify({ criterion, issues: validation.issues }));
    assert.deepEqual(validation.metadata.acceptanceCriteria, [criterion]);
  }
});

test("empty fenced examples cannot replace substantive task content", () => {
  for (const criterion of ["```\n```", "```sh\n```", "~~~\n~~~"]) {
    const raw = plan(); delete raw.mustHaves;
    raw.tasks[0].acceptanceCriteria = [criterion];
    const compiled = compilePlanCandidate({ plans: [raw] }, context());
    const rendered = renderPhasePlanModelContent(compiled.models[0].model,
      { phaseNumber: "1", phasePrefix: "01", phaseName: "Core" }, "01");
    assert.equal(validatePlanArtifactContent(rendered, "1", { strict: true }).valid, false, criterion);
  }
});
