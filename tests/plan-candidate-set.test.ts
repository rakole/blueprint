import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { createGitRepo } from "./helpers/git-fixtures.js";
import {
  blueprintPhaseExecutionTargets, blueprintPhasePlanIndex, blueprintPhasePlanRead,
  blueprintPhasePlanValidate, validatePhasePlanCandidateSet
} from "../src/mcp/tools/phase.js";

const phaseDir = ".blueprint/phases/03-planning";
async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const cwd = await createGitRepo("blueprint-candidate-set-");
  t.after(() => rm(path.dirname(cwd), { recursive: true, force: true }));
  await mkdir(path.join(cwd, phaseDir), { recursive: true });
  await writeFile(path.join(cwd, ".blueprint/ROADMAP.md"), `# Roadmap

## Phases

- [ ] **Phase 3: Planning** - Compile plans

## Phase Details

### Phase 3: Planning
**Goal**: Compile durable plans.
**Requirements**: PLAN-01, PLAN-02
`);
  return cwd;
}
function model(id: string, options: { requirement?: string; wave?: number; dependsOn?: string[]; file?: string } = {}) {
  const requirement = options.requirement ?? `PLAN-${id}`;
  const file = options.file ?? `src/plan-${id}.ts`;
  return {
    title: `Plan ${id}`, wave: options.wave ?? 1, status: "planned", objective: "Compile durable phase plans.",
    dependsOn: options.dependsOn ?? [], requirements: [requirement], filesModified: [file], readFirst: [file],
    autonomous: true, goal: "Preserve executable planning output.", scope: ["Implement the assigned planning behavior."],
    tasks: [{ id: "task-1", title: "Implement plan compilation", readFirst: [file],
      action: ["Implement the assigned plan compiler behavior and verify its generated document."],
      acceptanceCriteria: ["tests/plan-candidate-set.test.ts exits 0"], requirements: [requirement], filesModified: [file] }],
    externalServicePrerequisites: [], verification: [{ item: "Compiler regression", method: "test", evidence: "tests/plan-candidate-set.test.ts exits 0" }],
    mustHaves: ["Compile the assigned plan document with preserved requirements."],
    requirementCoverage: ["PLAN-01", "PLAN-02"].map((id) => ({ requirement: id,
      status: id === requirement ? "covered" : "deferred", coveredByTasks: id === requirement ? ["task-1"] : [],
      evidence: file, rationale: id === requirement ? "The assigned task implements this requirement." : "The other plan implements this requirement." })),
    evidenceCoverage: [], fileSurfaceCoverage: [{ surface: file, coveredByTasks: ["task-1"], verification: "tests/plan-candidate-set.test.ts exits 0", rationale: "The task owns this compiler surface." }],
    unknownsAndDeferrals: [{ item: "No open compiler unknowns remain.", disposition: "none", rationale: "The task is bounded.", followUp: "Run the focused compiler tests." }]
  };
}

test("candidate sets resolve unsaved dependencies and never write canonical files", async (t) => {
  const cwd = await fixture(t);
  const before = await readdir(path.join(cwd, phaseDir));
  const result = await validatePhasePlanCandidateSet({ cwd, phase: "3", requireComplete: true,
    models: [{ planId: "01", model: model("01") }, { planId: "02", model: model("02", { wave: 2, dependsOn: ["01"] }) }] });
  assert.equal(result.valid, true, JSON.stringify(result.diagnostics));
  assert.equal(result.planSetValidation?.status, "valid");
  assert.deepEqual(result.plans.map((plan) => plan.planId), ["01", "02"]);
  assert.match(result.plans[1].content, /depends_on: \["01"\]/);
  assert.deepEqual(await readdir(path.join(cwd, phaseDir)), before);
});

test("candidate sets distinguish incomplete drafting from final coverage", async (t) => {
  const cwd = await fixture(t);
  const args = { cwd, phase: "3", models: [{ planId: "01", model: model("01") }] };
  const draft = await validatePhasePlanCandidateSet({ ...args, requireComplete: false });
  const final = await validatePhasePlanCandidateSet({ ...args, requireComplete: true });
  assert.equal(draft.valid, true, JSON.stringify(draft.diagnostics));
  assert.equal(final.valid, false);
  assert.deepEqual(final.planSetValidation?.uncoveredRequirementIds, ["PLAN-02"]);
  assert.ok(draft.diagnostics.some((diagnostic) => diagnostic.severity === "warning" && /PLAN-02/.test(diagnostic.message)));
});

test("candidate sets reject duplicate IDs, unknown dependencies, cycles, and same-wave file ownership", async (t) => {
  const cwd = await fixture(t);
  for (const [models, expected] of [
    [[{ planId: "01", model: model("01") }, { planId: "1", model: model("01") }], /unique/],
    [[{ planId: "01", model: model("01", { dependsOn: ["99"] }) }], /dependsOn/],
    [[{ planId: "01", model: model("01", { dependsOn: ["02"] }) }, { planId: "02", model: model("02", { wave: 2, dependsOn: ["01"] }) }], /cycle/],
    [[{ planId: "01", model: model("01", { file: "src/shared.ts" }) }, { planId: "02", model: model("02", { file: "src/shared.ts" }) }], /both modify/]
  ] as const) {
    const result = await validatePhasePlanCandidateSet({ cwd, phase: "3", models: [...models], requireComplete: false });
    assert.equal(result.valid, false);
    assert.match(JSON.stringify(result.diagnostics), expected);
  }
});

test("replacement candidates exclude overwritten and removed plan documents from evidence", async (t) => {
  const cwd = await fixture(t);
  const initial = await validatePhasePlanCandidateSet({ cwd, phase: "3", models: [
    { planId: "01", model: model("01") }, { planId: "02", model: model("02") }
  ] });
  assert.equal(initial.valid, true, JSON.stringify(initial.diagnostics));
  for (const plan of initial.plans) await writeFile(path.join(cwd, plan.path), plan.content);
  const nextModel = model("03", { requirement: "PLAN-02" });
  const replacement = await validatePhasePlanCandidateSet({ cwd, phase: "3", removePlanIds: ["02"], models: [
    { planId: "01", model: model("01") }, { planId: "03", model: nextModel }
  ] });
  assert.equal(replacement.valid, true, JSON.stringify(replacement.diagnostics));
  assert.deepEqual(replacement.planSetValidation?.planIds, ["01", "03"]);
  assert.equal(await readFile(path.join(cwd, initial.plans[1].path), "utf8"), initial.plans[1].content);
});

test("public plan readers block a pending publication while the internal candidate validator can resume", async (t) => {
  const cwd = await fixture(t);
  const models = [{ planId: "01", model: model("01") }, { planId: "02", model: model("02") }];
  const initial = await validatePhasePlanCandidateSet({ cwd, phase: "3", models });
  assert.equal(initial.valid, true, JSON.stringify(initial.diagnostics));
  for (const plan of initial.plans) await writeFile(path.join(cwd, plan.path), plan.content);
  const marker = { version: 1, status: "pending", requestId: "publish-1", revision: 1,
    files: initial.plans.map((plan) => ({ path: plan.path, hash: createHash("sha256").update(plan.content).digest("hex") })), removedPaths: [] };
  await writeFile(path.join(cwd, phaseDir, "03-PLAN-PUBLICATION.json"), JSON.stringify(marker));
  const [index, read, set, execution, candidate] = await Promise.all([
    blueprintPhasePlanIndex({ cwd, phase: "3" }), blueprintPhasePlanRead({ cwd, phase: "3", planId: "01" }),
    blueprintPhasePlanValidate({ cwd, phase: "3" }), blueprintPhaseExecutionTargets({ cwd, phase: "3" }),
    validatePhasePlanCandidateSet({ cwd, phase: "3", models })
  ]);
  assert.ok(index.plans.every((plan) => !plan.valid));
  assert.equal(read.validation?.valid, false);
  assert.equal(set.status, "invalid");
  assert.match(set.issues.join("\n"), /publication is incomplete/i);
  assert.equal(execution.blockers.executionBlocked, true);
  assert.equal(candidate.valid, true, JSON.stringify(candidate.diagnostics));
});


test("plan readers reject a committed publication token that changes during their byte read", async (t) => {
  const cwd = await fixture(t);
  const models = [{ planId: "01", model: model("01") }, { planId: "02", model: model("02") }];
  const initial = await validatePhasePlanCandidateSet({ cwd, phase: "3", models });
  assert.equal(initial.valid, true, JSON.stringify(initial.diagnostics));
  for (const plan of initial.plans) await writeFile(path.join(cwd, plan.path), plan.content);
  const markerPath = path.join(cwd, phaseDir, "03-PLAN-PUBLICATION.json");
  const marker = { version: 1, status: "committed", requestId: "publish-1", revision: 1,
    files: initial.plans.map((plan) => ({ path: plan.path, hash: createHash("sha256").update(plan.content).digest("hex") })), removedPaths: [] };
  for (const kind of ["read", "index", "validate", "execution"] as const) {
    await t.test(kind, async (t) => {
      await writeFile(markerPath, JSON.stringify(marker));
      const originalReadFile = fs.readFile;
      let changed = false;
      t.mock.method(fs, "readFile", async (...args: Parameters<typeof fs.readFile>) => {
        const bytes = await originalReadFile(...args);
        if (!changed && String(args[0]).endsWith("-PLAN.md")) {
          changed = true;
          await writeFile(markerPath, JSON.stringify({ ...marker, requestId: "publish-2", revision: 2 }));
        }
        return bytes;
      });
      if (kind === "read") {
        const result = await blueprintPhasePlanRead({ cwd, phase: "3", planId: "01" });
        assert.equal(result.validation?.valid, false);
        assert.match(result.validation?.issues.join("\n") ?? "", /publication changed during/);
      } else if (kind === "index") {
        const result = await blueprintPhasePlanIndex({ cwd, phase: "3" });
        assert.ok(result.plans.every((plan) => !plan.valid));
        assert.match(result.warnings.join("\n"), /publication changed during/);
      } else if (kind === "validate") {
        const result = await blueprintPhasePlanValidate({ cwd, phase: "3" });
        assert.equal(result.status, "invalid");
        assert.match(result.issues.join("\n"), /publication changed during/);
      } else {
        const result = await blueprintPhaseExecutionTargets({ cwd, phase: "3" });
        assert.equal(result.blockers.executionBlocked, true);
        assert.match(result.blockers.reasons.join("\n"), /publication changed during/);
      }
      assert.equal(changed, true);
    });
  }
});

test("plan readers refresh inventory when publication completes after phase resolution listed artifacts", async (t) => {
  const cwd = await fixture(t);
  const models = [{ planId: "01", model: model("01") }, { planId: "02", model: model("02") }];
  const compiled = await validatePhasePlanCandidateSet({ cwd, phase: "3", models });
  assert.equal(compiled.valid, true, JSON.stringify(compiled.diagnostics));
  const markerPath = path.join(cwd, phaseDir, "03-PLAN-PUBLICATION.json");
  const marker = { version: 1, status: "committed", requestId: "publish-1", revision: 1,
    files: compiled.plans.map((plan) => ({ path: plan.path, hash: createHash("sha256").update(plan.content).digest("hex") })), removedPaths: [] };
  for (const kind of ["index", "execution"] as const) {
    await t.test(kind, async (t) => {
      await writeFile(path.join(cwd, compiled.plans[0].path), compiled.plans[0].content);
      await rm(path.join(cwd, compiled.plans[1].path), { force: true });
      await writeFile(markerPath, JSON.stringify({ ...marker, files: marker.files.slice(0, 1) }));
      const originalReaddir = fs.readdir;
      let changed = false;
      t.mock.method(fs, "readdir", async (...args: Parameters<typeof fs.readdir>) => {
        const entries = await originalReaddir(...args);
        if (!changed && String(args[0]) === path.join(cwd, phaseDir)) {
          changed = true;
          await writeFile(path.join(cwd, compiled.plans[1].path), compiled.plans[1].content);
          await writeFile(markerPath, JSON.stringify({ ...marker, requestId: "publish-2", revision: 2 }));
        }
        return entries;
      });
      if (kind === "index") {
        const result = await blueprintPhasePlanIndex({ cwd, phase: "3" });
        assert.deepEqual(result.plans.map((plan) => plan.planId), ["01", "02"]);
        assert.ok(result.plans.every((plan) => plan.valid));
      } else {
        const result = await blueprintPhaseExecutionTargets({ cwd, phase: "3" });
        assert.deepEqual(result.candidatePlanIds, ["01", "02"]);
        assert.equal(result.planSetValidation?.status, "valid");
      }
      assert.equal(changed, true);
    });
  }
});
