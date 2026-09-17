import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createGitRepo } from "./helpers/git-fixtures.js";
import { validPhaseContextModel } from "./helpers/context-model.js";
import { blueprintConfigSet } from "../src/mcp/tools/config.js";
import { blueprintPhaseArtifactWrite } from "../src/mcp/tools/phase-artifacts.js";
import { blueprintPhasePlanIndex, blueprintPhasePlanRead, blueprintPhasePlanValidate } from "../src/mcp/tools/phase.js";
import { blueprintPlanPrepare, blueprintPlanSubmit, blueprintPlanRead, planDependencies } from "../src/mcp/tools/plan.js";
import { type PlanningCandidate } from "../src/mcp/tools/plan-model.js";
import { researchDigest } from "../src/mcp/tools/research-evidence.js";
import { blueprintResearchPrepare, blueprintResearchSubmit } from "../src/mcp/tools/research.js";

const phaseDir = ".blueprint/phases/01-planning";
const firstPath = `${phaseDir}/01-01-PLAN.md`;
const secondPath = `${phaseDir}/01-02-PLAN.md`;
const lookup = (cwd: string) => ({ cwd, phase: "1" });
const revision = (result: unknown) => {
  assert.ok(result && typeof result === "object" && "revision" in result, JSON.stringify(result));
  return result.revision as number;
};
function candidate(keys = ["core"]): PlanningCandidate {
  return { plans: keys.map((key, index) => ({
    key, title: `Implement ${key}`, goal: `Expose ${key} behavior through the existing service.`, scope: [`Update src/${key}.ts and its acceptance checks.`],
    dependsOn: index ? [keys[index - 1]] : [],
    tasks: [{ id: "T1", title: `Implement ${key} behavior`, readFirst: ["README.md", `src/${key}.ts`], filesModified: [`src/${key}.ts`], requirements: ["R-1"], action: [`Add the ${key} behavior in src/${key}.ts.`], acceptanceCriteria: [`src/${key}.ts exports the ${key} function.`, "npm test exits with status 0."] }],
    mustHaves: [`The ${key} function exposes the required behavior.`],
  })) };
}
async function fixture(t: TestContext, options: { context?: boolean; checker?: boolean; research?: boolean } = {}) {
  const cwd = await createGitRepo("plan-lifecycle-");
  t.after(() => rm(path.dirname(cwd), { recursive: true, force: true }));
  await mkdir(path.join(cwd, phaseDir), { recursive: true });
  await mkdir(path.join(cwd, "src"), { recursive: true });
  await writeFile(path.join(cwd, "src/core.ts"), "export const core = 1;\n");
  await writeFile(path.join(cwd, ".blueprint/PROJECT.md"), "# Project\n\nDurable planning for a small product.\n\n## Constraints\n\n- Preserve customer data.\n");
  await writeFile(path.join(cwd, ".blueprint/REQUIREMENTS.md"), "# Requirements\n\n- R-1: Expose service behavior and preserve complete plans before publication validation.\n");
  await writeFile(path.join(cwd, ".blueprint/ROADMAP.md"), "# Roadmap: Fixture\n\n## Phases\n\n- [ ] **Phase 1: Planning** - Durable planning\n\n## Phase Details\n\n### Phase 1: Planning\n**Goal**: Save durable planning.\n**Requirements**: R-1\n");
  await blueprintConfigSet({ cwd, patch: { workflow: { research: options.research ?? false, ui_phase: false, plan_check: options.checker ?? false }, research: { external_sources: "off" } } });
  if (options.context !== false) {
    const result = await blueprintPhaseArtifactWrite({ ...lookup(cwd), artifact: "context", model: validPhaseContextModel({ phaseLabel: "phase 1", openQuestions: [], deferredIdeas: [], externalConstraints: ["Preserve customer data across all retries."] }) });
    assert.notEqual(result.status, "invalid", JSON.stringify(result));
  }
  return cwd;
}
async function prepare(cwd: string) {
  const result = await blueprintPlanPrepare({ ...lookup(cwd), evidencePaths: ["src/core.ts"] });
  assert.equal(result.status, "prepared", JSON.stringify(result));
  return result;
}
async function submit(cwd: string, prepared: unknown, draft = candidate(), requestId = "draft") {
  const result = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId, model: draft });
  assert.equal(result.status, "published", JSON.stringify(result));
  return result;
}
async function publishResearchBasis(cwd: string, sourcePath: string, source: string) {
  const research = await blueprintResearchPrepare({ ...lookup(cwd), evidencePaths: [sourcePath] });
  assert.equal(research.status, "prepared", JSON.stringify(research));
  const publishedResearch = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "research-basis", expectedRevision: revision(research), candidate: {
    summary: "Preserve the existing core entry point while adding durable planning persistence.",
    findings: [{ id: "CLM-001", finding: "The research module exports the integration finding.", sourceIds: ["SRC-001"], confidence: "HIGH", requirementIds: ["R-1"], status: "supported" }],
    recommendations: [{ id: "REC-001", recommendation: "Extend the existing core entry point with durable persistence.", findingIds: ["CLM-001"], affectedSurfaces: ["src/core.ts"], verification: ["Interrupt publication and verify that retry preserves the complete draft."], requirementIds: ["R-1"], status: "ready" }],
    openQuestions: [], sources: [{ id: "SRC-001", lane: "repo", reference: `${sourcePath}:1`, excerpt: source.trim() }],
  } });
  assert.equal(publishedResearch.status, "published", JSON.stringify(publishedResearch));
}

const sessionPath = `${phaseDir}/01-PLAN-SESSION.json`;
const markerPath = `${phaseDir}/01-PLAN-PUBLICATION.json`;
async function sessionBytes(cwd: string) { return readFile(path.join(cwd, sessionPath), "utf8"); }
async function targets(cwd: string) { return Object.fromEntries((await blueprintPlanRead(lookup(cwd))).published.map(file => [file.path, file.hash])); }

test("one model submission publishes the complete canonical plan set and one replayable receipt", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd);
  assert.ok("schema" in prepared && "example" in prepared && "validationRules" in prepared && "derivedFields" in prepared);
  assert.ok(JSON.stringify(prepared.example).includes("R-1"));
  assert.equal(revision(await prepare(cwd)), revision(prepared));
  const original = planDependencies.validate;
  let validations = 0;
  t.after(() => { planDependencies.validate = original; });
  planDependencies.validate = async args => { validations++; return original(args); };
  const model = candidate(["core", "api"]);
  delete model.plans[0].mustHaves;
  model.plans[0].tasks[0].acceptanceCriteria = ["```\nnpm test\n```"];
  const schema = prepared.schema as { properties: { plans: { items: { properties: {
    evidence: { items: { properties: { artifact: { enum: string[] } } } };
  } } } } };
  assert.deepEqual(schema.properties.plans.items.properties.evidence.items.properties.artifact.enum, prepared.knownEvidenceArtifacts);
  const args = { ...lookup(cwd), expectedRevision: revision(prepared), requestId: "publish", model };
  const result = await blueprintPlanSubmit(args);
  assert.equal(result.status, "published", JSON.stringify(result));
  assert.equal(validations, 1, "The successful first submission validates its complete set once.");
  assert.deepEqual(await blueprintPlanSubmit(args), result);
  assert.equal(validations, 1, "Receipt replay does not regenerate or revalidate the model.");
  const plans = await blueprintPhasePlanIndex(lookup(cwd));
  assert.deepEqual(plans.plans.map(plan => [plan.planId, plan.wave]), [["01", 1], ["02", 2]]);
  assert.equal((await blueprintPhasePlanValidate(lookup(cwd))).status, "valid");
  const restored = await blueprintPlanRead(lookup(cwd));
  assert.equal(restored.publication.status, "committed");
  assert.equal(restored.published.length, 2);
  assert.match(restored.published[0].content!, /Implement core/);
  assert.equal(restored.session!.version, 2);
  assert.equal("candidate" in restored.session!, false);
  assert.equal("history" in restored.session!, false);
  const metadata = await sessionBytes(cwd);
  for (const phrase of ["Expose core behavior through the existing service.", "Add the core behavior", '"content":', '"backup":', '"review":']) assert.ok(!metadata.includes(phrase), phrase);
});

test("invalid objects and malformed JSON are rejected without changing session or storing any draft", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd), original = await sessionBytes(cwd);
  const malformed = ' { "plans": [{"title":"private rejected prose"}\n';
  const invalid = candidate(); invalid.plans[0].tasks[0].filesModified = ["../unsafe.ts"];
  for (const model of [malformed, invalid, { plans: [] }]) {
    const result = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "invalid", model });
    assert.equal(result.status, "needs_revision", JSON.stringify(result));
    assert.equal(result.saved, false); assert.equal(revision(result), revision(prepared));
    assert.equal(await sessionBytes(cwd), original);
    assert.equal((await blueprintPhasePlanIndex(lookup(cwd))).plans.length, 0);
  }
  // A rejected request ID was never reserved; correcting it needs no new revision.
  await submit(cwd, prepared, candidate(), "invalid");
});

test("assessment exceptions retain no prose or pending request and a retry can publish", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd), before = await sessionBytes(cwd);
  const original = planDependencies.compile;
  t.after(() => { planDependencies.compile = original; });
  planDependencies.compile = () => { throw new Error("private injected assessor failure"); };
  const args = { ...lookup(cwd), expectedRevision: revision(prepared), requestId: "retry", model: candidate() };
  assert.equal((await blueprintPlanSubmit(args)).status, "needs_revision");
  assert.equal(await sessionBytes(cwd), before);
  planDependencies.compile = original;
  assert.equal((await blueprintPlanSubmit(args)).status, "published");
  assert.equal((await blueprintPlanSubmit({ ...args, model: { plans: [] } })).status, "rejected");
  assert.equal((await blueprintPlanSubmit({ ...args, requestId: "stale" })).status, "stale");
});

test("missing context and enabled research gates reject models without retaining them", async t => {
  for (const options of [{ context: false }, { research: true }]) {
    const cwd = await fixture(t, options), prepared = await blueprintPlanPrepare(lookup(cwd));
    assert.equal(prepared.status, "blocked");
    const before = await sessionBytes(cwd);
    const result = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "blocked-model", model: candidate() });
    assert.equal(result.status, "needs_revision"); assert.equal(result.saved, false);
    assert.equal(await sessionBytes(cwd), before);
  }
});

test("changed project, requirements and repository evidence require a reviewed refresh", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd);
  for (const relative of [".blueprint/PROJECT.md", ".blueprint/REQUIREMENTS.md", "src/core.ts"]) await writeFile(path.join(cwd, relative), (await readFile(path.join(cwd, relative), "utf8")) + "\nChanged evidence.\n");
  const before = await sessionBytes(cwd);
  assert.equal((await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "stale", model: candidate() })).status, "needs_revision");
  assert.equal(await sessionBytes(cwd), before);
  assert.equal((await blueprintPlanPrepare(lookup(cwd))).status, "stale");
  const refreshed = await blueprintPlanPrepare({ ...lookup(cwd), expectedRevision: revision(prepared), acknowledgeChangedInputs: true });
  assert.equal(refreshed.status, "prepared", JSON.stringify(refreshed));
  await submit(cwd, refreshed);
});

test("optional checker reviews the supplied model without caller-computed hashes or review storage", async t => {
  const cwd = await fixture(t, { checker: true }), prepared = await prepare(cwd), before = await sessionBytes(cwd);
  const args = { ...lookup(cwd), expectedRevision: revision(prepared), requestId: "review", model: candidate() };
  assert.equal((await blueprintPlanSubmit(args)).status, "needs_revision");
  assert.equal((await blueprintPlanSubmit({ ...args, review: { verdict: "revise", summary: "Private reviewer details." } })).status, "needs_revision");
  assert.equal(await sessionBytes(cwd), before);
  const accepted = await blueprintPlanSubmit({ ...args, review: { verdict: "accept", summary: "Private reviewer details." } });
  assert.equal(accepted.status, "published", JSON.stringify(accepted));
  assert.ok(!(await sessionBytes(cwd)).includes("Private reviewer"));
  assert.equal((await blueprintPlanSubmit({ ...args, model: candidate(["different"]) })).status, "rejected");
});

test("interrupted multi-plan publication blocks readers; retry resends the unstored model", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd), original = planDependencies.writeText;
  t.after(() => { planDependencies.writeText = original; });
  let failed = false;
  planDependencies.writeText = async (...args) => { if (!failed && args[0].endsWith("01-02-PLAN.md")) { failed = true; throw new Error("private second plan failure"); } return original(...args); };
  const args = { ...lookup(cwd), expectedRevision: revision(prepared), requestId: "interrupted", model: candidate(["core", "api"]) };
  const partial = await blueprintPlanSubmit(args);
  assert.equal(partial.status, "partial", JSON.stringify(partial)); assert.equal(partial.saved, false);
  assert.equal((await blueprintPlanRead(lookup(cwd))).publication.status, "pending");
  assert.equal((await blueprintPhasePlanRead({ ...lookup(cwd), planId: "01" })).validation?.valid, false);
  assert.equal((await blueprintPhasePlanValidate(lookup(cwd))).status, "invalid");
  const metadata = await sessionBytes(cwd);
  assert.ok(!metadata.includes("Expose api behavior")); assert.ok(!metadata.includes("private second plan failure"));
  const { model: _model, ...retry } = args;
  const missing = await blueprintPlanSubmit(retry);
  assert.equal(missing.status, "partial"); assert.match(String("reason" in missing && missing.reason), /Resend/);
  planDependencies.writeText = original;
  assert.equal((await blueprintPlanSubmit(args)).status, "published");
  assert.equal((await blueprintPhasePlanIndex(lookup(cwd))).plans.length, 2);
});

test("state synchronization retry can omit model after canonical files are saved", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd), original = planDependencies.stateUpdate;
  t.after(() => { planDependencies.stateUpdate = original; });
  planDependencies.stateUpdate = async () => { throw new Error("private state failure"); };
  const args = { ...lookup(cwd), expectedRevision: revision(prepared), requestId: "state-retry", model: candidate() };
  const partial = await blueprintPlanSubmit(args);
  assert.equal(partial.status, "partial"); assert.equal(partial.saved, true);
  const bytes = await readFile(path.join(cwd, firstPath), "utf8");
  planDependencies.stateUpdate = original;
  const { model: _model, ...retry } = args;
  assert.equal((await blueprintPlanSubmit(retry)).status, "published");
  assert.equal(await readFile(path.join(cwd, firstPath), "utf8"), bytes);
});

test("selected revise preserves other plans and requires explicit overwrite", async t => {
  const cwd = await fixture(t), saved = await submit(cwd, await prepare(cwd), candidate(["core", "api"]));
  const second = await readFile(path.join(cwd, secondPath), "utf8");
  assert.equal((await blueprintPlanPrepare(lookup(cwd))).status, "choice_required");
  const prepared = await blueprintPlanPrepare({ ...lookup(cwd), mode: "revise", targetPlanIds: ["01"], expectedRevision: revision(saved) });
  assert.equal(prepared.status, "prepared", JSON.stringify(prepared));
  const model = candidate(); model.plans[0].title = "Improve core implementation";
  const args = { ...lookup(cwd), expectedRevision: revision(prepared), requestId: "revise", model };
  assert.equal((await blueprintPlanSubmit(args)).status, "needs_revision");
  assert.equal((await blueprintPlanSubmit({ ...args, overwrite: true })).status, "published");
  assert.equal(await readFile(path.join(cwd, secondPath), "utf8"), second);
  assert.match(await readFile(path.join(cwd, firstPath), "utf8"), /Improve core implementation/);
});

test("replace deletes selected surplus plans while add allocates the next slot", async t => {
  const cwd = await fixture(t), saved = await submit(cwd, await prepare(cwd), candidate(["core", "api"]));
  const prepared = await blueprintPlanPrepare({ ...lookup(cwd), mode: "replace", expectedRevision: revision(saved) });
  assert.equal(prepared.status, "prepared", JSON.stringify(prepared));
  const replaced = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "replace", overwrite: true, model: candidate() });
  assert.equal(replaced.status, "published", JSON.stringify(replaced));
  assert.deepEqual((await blueprintPhasePlanIndex(lookup(cwd))).plans.map(p => p.planId), ["01"]);
  const added = await blueprintPlanPrepare({ ...lookup(cwd), mode: "add", expectedRevision: revision(replaced) });
  const model = candidate(["api"]); model.plans[0].dependsOn = ["01"];
  assert.equal((await submit(cwd, added, model, "add")).status, "published");
  assert.deepEqual((await blueprintPhasePlanIndex(lookup(cwd))).plans.map(p => p.planId), ["01", "02"]);
});

test("executed plans and changed targets cannot be overwritten", async t => {
  const cwd = await fixture(t), saved = await submit(cwd, await prepare(cwd));
  await writeFile(path.join(cwd, `${phaseDir}/01-01-SUMMARY.md`), "# Summary\n\nCompleted core behavior.\n");
  const prepared = await blueprintPlanPrepare({ ...lookup(cwd), mode: "replace", targetPlanIds: ["01"], expectedRevision: revision(saved), acknowledgeChangedInputs: true });
  assert.equal(prepared.status, "prepared", JSON.stringify(prepared));
  const result = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "executed", overwrite: true, model: candidate() });
  assert.equal(result.status, "needs_revision"); assert.match(String("reason" in result && result.reason), /Executed/);
  await writeFile(path.join(cwd, firstPath), (await readFile(path.join(cwd, firstPath), "utf8")) + "\nExternal update.\n");
  assert.equal((await blueprintPlanPrepare({ ...lookup(cwd), mode: "replace", targetPlanIds: ["01"] })).status, "reconciliation_required");
});

test("marker write interruptions resume before and after the commit boundary", async t => {
  for (const status of ["pending", "committed"]) {
    const cwd = await fixture(t), prepared = await prepare(cwd), original = planDependencies.writeText;
    t.after(() => { planDependencies.writeText = original; });
    let failed = false;
    planDependencies.writeText = async (...args) => { if (!failed && args[0].endsWith("PLAN-PUBLICATION.json") && args[1].includes(`"status": "${status}"`)) { failed = true; throw new Error(`injected ${status} marker failure`); } return original(...args); };
    const args = { ...lookup(cwd), expectedRevision: revision(prepared), requestId: status, model: candidate() };
    assert.equal((await blueprintPlanSubmit(args)).status, "partial");
    planDependencies.writeText = original;
    assert.equal((await blueprintPlanSubmit(args)).status, "published");
  }
});

test("reconciliation preserves observed canonical and unrelated files without backups", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd), original = planDependencies.writeText;
  t.after(() => { planDependencies.writeText = original; });
  planDependencies.writeText = async (...args) => { if (args[0].endsWith("01-02-PLAN.md")) throw new Error("second file interruption"); return original(...args); };
  const interrupted = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "interrupt", model: candidate(["core", "api"]) });
  assert.equal(interrupted.status, "partial");
  planDependencies.writeText = original;
  const originalFirst = await readFile(path.join(cwd, firstPath), "utf8");
  const external = originalFirst + "\nExternally reviewed note.\n";
  await writeFile(path.join(cwd, firstPath), external);
  const unrelated = path.join(cwd, phaseDir, "user-notes.md"); await writeFile(unrelated, "Keep these user notes.\n");
  const observed = await targets(cwd);
  assert.equal((await blueprintPlanPrepare(lookup(cwd))).status, "reconciliation_required");
  const bad = await blueprintPlanPrepare({ ...lookup(cwd), expectedRevision: revision(interrupted), acknowledgeChangedInputs: true, reconcile: { confirmed: true, targetHashes: {} }, mode: "add" });
  assert.equal(bad.status, "reconciliation_required");
  const next = await blueprintPlanPrepare({ ...lookup(cwd), expectedRevision: revision(interrupted), acknowledgeChangedInputs: true, reconcile: { confirmed: true, targetHashes: observed }, mode: "add" });
  assert.equal(next.status, "prepared", JSON.stringify(next));
  assert.equal(await readFile(path.join(cwd, firstPath), "utf8"), external);
  assert.equal(await readFile(unrelated, "utf8"), "Keep these user notes.\n");
  assert.equal((await blueprintPlanRead(lookup(cwd))).publication.status, "committed");
  assert.equal((await blueprintPlanRead(lookup(cwd))).session!.journal, undefined);
});

test("reconciliation failure keeps metadata available for a safe retry", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd), original = planDependencies.writeText;
  t.after(() => { planDependencies.writeText = original; });
  planDependencies.writeText = async (...args) => { if (args[0].endsWith("01-02-PLAN.md")) throw new Error("stop"); return original(...args); };
  const partial = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "partial", model: candidate(["core", "api"]) });
  const observed = await targets(cwd);
  const args = { ...lookup(cwd), expectedRevision: revision(partial), acknowledgeChangedInputs: true, reconcile: { confirmed: true as const, targetHashes: observed }, mode: "add" as const };
  planDependencies.writeText = async (...input) => { if (input[0].endsWith("PLAN-PUBLICATION.json")) throw new Error("marker recovery interruption"); return original(...input); };
  assert.equal((await blueprintPlanPrepare(args)).status, "blocked");
  assert.ok((await blueprintPlanRead(lookup(cwd))).session!.journal);
  planDependencies.writeText = original;
  assert.equal((await blueprintPlanPrepare(args)).status, "prepared");
});

test("legacy session migration deletes draft history and reconciles a pending read barrier", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd);
  const session = JSON.parse(await sessionBytes(cwd));
  session.version = 1; session.candidate = { secret: "legacy private rejected draft" }; session.candidateHash = researchDigest(JSON.stringify(session.candidate));
  session.history = [{ revision: 0, kind: "submit", candidate: "legacy private history" }];
  session.journal = { content: "legacy rendered body", backup: "legacy old backup", review: { summary: "legacy reviewer prose" } };
  await writeFile(path.join(cwd, sessionPath), JSON.stringify(session));
  await writeFile(path.join(cwd, markerPath), JSON.stringify({ version: 1, status: "pending", requestId: "legacy", revision: revision(prepared), files: [], removedPaths: [] }));
  const read = await blueprintPlanRead(lookup(cwd));
  assert.equal(read.session!.version, 2); assert.ok(read.session!.legacyPublication);
  const migrated = await sessionBytes(cwd);
  for (const phrase of ["private rejected draft", "private history", "rendered body", "old backup", "reviewer prose"]) assert.ok(!migrated.includes(phrase));
  const next = await blueprintPlanPrepare({ ...lookup(cwd), expectedRevision: read.session!.revision, mode: "add", acknowledgeChangedInputs: true, reconcile: { confirmed: true, targetHashes: {} } });
  assert.equal(next.status, "prepared", JSON.stringify(next));
  assert.equal((await blueprintPlanRead(lookup(cwd))).publication.status, "committed");
  await submit(cwd, next);
});

test("completed publication requires new intent and cannot silently reuse its previous add mode", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd), saved = await submit(cwd, prepared);
  assert.equal((await blueprintPlanPrepare(lookup(cwd))).status, "choice_required");
  const before = await sessionBytes(cwd);
  assert.equal((await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(saved), requestId: "implicit", model: candidate(["api"]) })).status, "needs_revision");
  assert.equal(await sessionBytes(cwd), before);
  const next = await blueprintPlanPrepare({ ...lookup(cwd), expectedRevision: revision(saved), mode: "add" });
  assert.equal(next.status, "prepared", JSON.stringify(next)); assert.ok(revision(next) > revision(saved));
});

test("retained plan mutation during state sync cannot be silently accepted", async t => {
  const cwd = await fixture(t), saved = await submit(cwd, await prepare(cwd), candidate(["core", "api"]));
  const prepared = await blueprintPlanPrepare({ ...lookup(cwd), expectedRevision: revision(saved), mode: "revise", targetPlanIds: ["01"] });
  const original = planDependencies.stateUpdate;
  t.after(() => { planDependencies.stateUpdate = original; });
  planDependencies.stateUpdate = async args => {
    const result = await original(args);
    await writeFile(path.join(cwd, secondPath), (await readFile(path.join(cwd, secondPath), "utf8")) + "\nUnrelated concurrent edit.\n");
    return result;
  };
  const result = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "race", overwrite: true, model: candidate() });
  assert.equal(result.status, "partial", JSON.stringify(result));
  assert.match(String("reason" in result && result.reason), /complete published plan set changed/);
});

test("transitive research source changes are rejected even when not explicitly selected", async t => {
  const cwd = await fixture(t, { research: true }), sourcePath = "src/research-only.ts", source = "export const researchFinding = true;\n";
  await writeFile(path.join(cwd, sourcePath), source);
  await publishResearchBasis(cwd, sourcePath, source);
  const prepared = await prepare(cwd), original = planDependencies.writeText;
  t.after(() => { planDependencies.writeText = original; });
  planDependencies.writeText = async (...args) => {
    const result = await original(...args);
    if (args[0].endsWith("01-01-PLAN.md")) await writeFile(path.join(cwd, sourcePath), source + "// Changed after planning readiness.\n");
    return result;
  };
  const result = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "source-race", model: candidate() });
  assert.equal(result.status, "partial", JSON.stringify(result));
  assert.match(String("reason" in result && result.reason), /research-only/);
  assert.equal((await blueprintPlanRead(lookup(cwd))).publication.status, "pending");
});

test("large malformed input produces bounded diagnostics and never grows metadata", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd), before = await sessionBytes(cwd);
  const result = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "large", model: { plans: Array.from({ length: 5000 }, () => ({})) } });
  assert.equal(result.status, "needs_revision");
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < 100000);
  assert.equal(await sessionBytes(cwd), before);
});

test("prepare exposes late saved constraints outside truncated evidence excerpts", async t => {
  const cwd = await fixture(t);
  const lateConstraint = "Never send customer records to the public network.";
  const contextPath = path.join(cwd, `${phaseDir}/01-CONTEXT.md`);
  const content = await readFile(contextPath, "utf8");
  await writeFile(contextPath, content.replace("## Dependencies", `${"Useful implementation background. ".repeat(800)}\n\n## Dependencies`).replace("Preserve customer data across all retries.", lateConstraint));
  const prepared = await prepare(cwd);
  assert.ok("grounding" in prepared && JSON.stringify(prepared.grounding).includes(lateConstraint));
  assert.ok("evidence" in prepared && prepared.evidence.some(item => item.path.endsWith("CONTEXT.md") && item.truncated));
  assert.ok(!(await sessionBytes(cwd)).includes(lateConstraint), "Grounding is returned to the author but not duplicated in metadata.");
});
