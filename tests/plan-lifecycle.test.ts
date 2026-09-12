import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createGitRepo } from "./helpers/git-fixtures.js";
import { validPhaseContextModel } from "./helpers/context-model.js";
import { blueprintConfigSet } from "../src/mcp/tools/config.js";
import { blueprintPhaseArtifactWrite } from "../src/mcp/tools/phase-artifacts.js";
import { blueprintPhasePlanIndex, blueprintPhasePlanRead, blueprintPhasePlanValidate } from "../src/mcp/tools/phase.js";
import { blueprintPlanPrepare, blueprintPlanSubmit, blueprintPlanRead, blueprintPlanFinalize, planDependencies } from "../src/mcp/tools/plan.js";
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
  const result = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId, candidate: draft });
  assert.equal(result.status, "ready", JSON.stringify(result));
  return result;
}
async function publish(cwd: string, submitted: unknown, requestId = "publish") {
  const result = await blueprintPlanFinalize({ ...lookup(cwd), expectedRevision: revision(submitted), requestId });
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

test("one-shot candidate publishes the complete plan set and replayable state receipt", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  assert.ok("planningCandidateJsonSchema" in prepared);
  const packetBytes = Buffer.byteLength(JSON.stringify(prepared));
  t.diagnostic(`Compact preparation packet: ${packetBytes} bytes, one authoring schema.`);
  assert.ok(packetBytes < 24000, `Small-fixture preparation packet is ${packetBytes} bytes.`);
  assert.equal("contract" in prepared, false);
  assert.equal("authoringContext" in prepared, false);
  assert.equal(revision(await prepare(cwd)), revision(prepared));
  const saved = await submit(cwd, prepared, candidate(["core", "api"]));
  assert.ok("reviewPacket" in saved);
  assert.ok(!(saved.reviewPacket as { plans: Record<string, unknown>[] }).plans.some(plan => "content" in plan), "Review receives one model representation, without duplicate Markdown.");
  assert.equal((await blueprintPhasePlanIndex(lookup(cwd))).plans.length, 0);
  const args = { ...lookup(cwd), expectedRevision: revision(saved), requestId: "publish" };
  const result = await blueprintPlanFinalize(args);
  assert.equal(result.status, "published", JSON.stringify(result));
  assert.ok("plans" in result && (result.plans as Array<{ taskCount: number }>).every(plan => plan.taskCount === 1));
  assert.deepEqual(await blueprintPlanFinalize(args), result);
  const plans = await blueprintPhasePlanIndex(lookup(cwd));
  assert.deepEqual(plans.plans.map(plan => [plan.planId, plan.wave]), [["01", 1], ["02", 2]]);
  assert.equal((await blueprintPhasePlanValidate(lookup(cwd))).status, "valid");
  const restored = await blueprintPlanRead(lookup(cwd));
  assert.deepEqual(restored.session!.candidate, candidate(["core", "api"]));
  assert.equal(restored.publication.status, "committed");
});

test("invalid objects and exact malformed JSON survive validation and narrow corrections", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd);
  const malformed = ' { "plans": [\n  {"title":"Do not lose this one-shot draft"}\n';
  const first = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "raw", candidate: malformed });
  assert.equal(first.status, "needs_revision");
  assert.equal((await blueprintPlanRead(lookup(cwd))).session!.candidate, malformed);
  const draft = candidate(); draft.plans[0].title = "";
  const second = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(first), requestId: "incomplete", candidate: draft });
  assert.equal(second.status, "needs_revision");
  const fixed = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(second), requestId: "repair", corrections: [{ path: ["plans", "0", "title"], value: "Implement core" }] });
  assert.equal(fixed.status, "ready", JSON.stringify(fixed));
  const session = (await blueprintPlanRead(lookup(cwd))).session!;
  assert.deepEqual(session.candidate, candidate());
  assert.equal(session.history.find(item => item.revision === revision(first))?.candidate, malformed);
  assert.equal((session.history.find(item => item.revision === revision(second))?.candidate as PlanningCandidate).plans[0].title, "");
  assert.equal((await blueprintPhasePlanIndex(lookup(cwd))).plans.length, 0);
});

test("assessment exceptions retain the draft and retry without a second revision", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd);
  const original = planDependencies.compile;
  t.after(() => { planDependencies.compile = original; });
  planDependencies.compile = () => { throw new Error("injected assessor failure"); };
  const args = { ...lookup(cwd), expectedRevision: revision(prepared), requestId: "retry", candidate: candidate() };
  const interrupted = await blueprintPlanSubmit(args);
  assert.equal(interrupted.status, "partial");
  assert.deepEqual((await blueprintPlanRead(lookup(cwd))).session!.candidate, candidate());
  planDependencies.compile = original;
  const result = await blueprintPlanSubmit(args);
  assert.equal(result.status, "ready", JSON.stringify(result));
  assert.equal(revision(result), revision(interrupted));
  assert.deepEqual(await blueprintPlanSubmit(args), result);
  const conflict = await blueprintPlanSubmit({ ...args, candidate: { plans: [] } });
  assert.equal(conflict.status, "rejected");
  const stale = await blueprintPlanSubmit({ ...args, requestId: "stale" });
  assert.equal(stale.status, "stale");
});

test("missing context and enabled research gates block drafting but retain received candidates", async t => {
  for (const options of [{ context: false }, { research: true }]) {
    const cwd = await fixture(t, options);
    const prepared = await blueprintPlanPrepare(lookup(cwd));
    assert.equal(prepared.status, "blocked");
    const saved = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "blocked-draft", candidate: candidate() });
    assert.equal(saved.status, "needs_revision");
    assert.deepEqual((await blueprintPlanRead(lookup(cwd))).session!.candidate, candidate());
  }
});

test("project, requirements, optional evidence and repository changes require reviewed refresh", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd), saved = await submit(cwd, prepared);
  for (const relative of [".blueprint/PROJECT.md", ".blueprint/REQUIREMENTS.md", "src/core.ts"]) {
    await writeFile(path.join(cwd, relative), (await readFile(path.join(cwd, relative), "utf8")) + "\nChanged evidence.\n");
  }
  const stale = await blueprintPlanFinalize({ ...lookup(cwd), expectedRevision: revision(saved), requestId: "stale-final" });
  assert.equal(stale.status, "needs_revision");
  const refresh = await blueprintPlanPrepare(lookup(cwd));
  assert.equal(refresh.status, "stale");
  const reconciled = await blueprintPlanPrepare({ ...lookup(cwd), expectedRevision: revision(saved), acknowledgeChangedInputs: true });
  assert.equal(reconciled.status, "prepared", JSON.stringify(reconciled));
  assert.deepEqual((await blueprintPlanRead(lookup(cwd))).session!.candidate, candidate());
});

test("checker acceptance is bound to the exact candidate revision and hash", async t => {
  const cwd = await fixture(t, { checker: true }), saved = await submit(cwd, await prepare(cwd));
  const missing = await blueprintPlanFinalize({ ...lookup(cwd), expectedRevision: revision(saved), requestId: "no-review" });
  assert.equal(missing.status, "needs_revision");
  const hash = (await blueprintPlanRead(lookup(cwd))).session!.candidateHash!;
  const stale = await blueprintPlanFinalize({ ...lookup(cwd), expectedRevision: revision(saved), requestId: "stale-review", review: { revision: revision(saved) - 1, candidateHash: hash, verdict: "accept", summary: "Reviewed complete plan set." } });
  assert.equal(stale.status, "needs_revision");
  const result = await blueprintPlanFinalize({ ...lookup(cwd), expectedRevision: revision(saved), requestId: "reviewed", review: { revision: revision(saved), candidateHash: hash, verdict: "accept", summary: "Reviewed dependencies, requirements, scope and acceptance checks." } });
  assert.equal(result.status, "published", JSON.stringify(result));
});

test("interrupted multi-plan publication blocks readers and identical retry finishes exact bytes", async t => {
  const cwd = await fixture(t), saved = await submit(cwd, await prepare(cwd), candidate(["core", "api"]));
  const original = planDependencies.writeText;
  t.after(() => { planDependencies.writeText = original; });
  let failed = false;
  planDependencies.writeText = async (...args) => { if (!failed && args[0].endsWith("01-02-PLAN.md")) { failed = true; throw new Error("injected second plan failure"); } return original(...args); };
  const args = { ...lookup(cwd), expectedRevision: revision(saved), requestId: "interrupted" };
  const partial = await blueprintPlanFinalize(args);
  assert.equal(partial.status, "partial", JSON.stringify(partial));
  assert.equal((await blueprintPlanRead(lookup(cwd))).publication.status, "pending");
  assert.equal((await blueprintPhasePlanRead({ ...lookup(cwd), planId: "01" })).validation?.valid, false);
  assert.equal((await blueprintPhasePlanValidate(lookup(cwd))).status, "invalid");
  planDependencies.writeText = original;
  const result = await blueprintPlanFinalize(args);
  assert.equal(result.status, "published", JSON.stringify(result));
  assert.equal((await blueprintPhasePlanIndex(lookup(cwd))).plans.length, 2);
});

test("failed state synchronization resumes after committed files without rewriting plans", async t => {
  const cwd = await fixture(t), saved = await submit(cwd, await prepare(cwd));
  const original = planDependencies.stateUpdate;
  t.after(() => { planDependencies.stateUpdate = original; });
  planDependencies.stateUpdate = async () => { throw new Error("injected state failure"); };
  const args = { ...lookup(cwd), expectedRevision: revision(saved), requestId: "state-retry" };
  assert.equal((await blueprintPlanFinalize(args)).status, "partial");
  const bytes = await readFile(path.join(cwd, firstPath), "utf8");
  planDependencies.stateUpdate = original;
  assert.equal((await blueprintPlanFinalize(args)).status, "published");
  assert.equal(await readFile(path.join(cwd, firstPath), "utf8"), bytes);
});

test("selected revise preserves other plans and requires overwrite authorization", async t => {
  const cwd = await fixture(t), saved = await submit(cwd, await prepare(cwd), candidate(["core", "api"]));
  await publish(cwd, saved);
  const second = await readFile(path.join(cwd, secondPath), "utf8");
  const prepared = await blueprintPlanPrepare({ ...lookup(cwd), mode: "revise", targetPlanIds: ["01"], expectedRevision: revision(saved), acknowledgeChangedInputs: true });
  assert.equal(prepared.status, "prepared", JSON.stringify(prepared));
  const replacement = candidate(); replacement.plans[0].title = "Improve core implementation";
  const revised = await submit(cwd, prepared, replacement, "revised");
  const rejected = await blueprintPlanFinalize({ ...lookup(cwd), expectedRevision: revision(revised), requestId: "no-overwrite" });
  assert.equal(rejected.status, "needs_revision");
  const result = await blueprintPlanFinalize({ ...lookup(cwd), expectedRevision: revision(revised), requestId: "overwrite", overwrite: true });
  assert.equal(result.status, "published", JSON.stringify(result));
  assert.equal(await readFile(path.join(cwd, secondPath), "utf8"), second);
  assert.match(await readFile(path.join(cwd, firstPath), "utf8"), /Improve core implementation/);
});

test("executed targets and changed target hashes cannot be overwritten", async t => {
  const cwd = await fixture(t), saved = await submit(cwd, await prepare(cwd));
  await publish(cwd, saved);
  await writeFile(path.join(cwd, `${phaseDir}/01-01-SUMMARY.md`), "# Summary\n\nCompleted core behavior.\n");
  const prepared = await blueprintPlanPrepare({ ...lookup(cwd), mode: "replace", targetPlanIds: ["01"], expectedRevision: revision(saved), acknowledgeChangedInputs: true });
  assert.equal(prepared.status, "prepared", JSON.stringify(prepared));
  const revised = await submit(cwd, prepared, candidate(), "replacement");
  const result = await blueprintPlanFinalize({ ...lookup(cwd), expectedRevision: revision(revised), requestId: "executed", overwrite: true });
  assert.equal(result.status, "needs_revision");
  assert.match(String("reason" in result && result.reason), /Executed/);
  await writeFile(path.join(cwd, firstPath), (await readFile(path.join(cwd, firstPath), "utf8")) + "\nExternal update.\n");
  const changed = await blueprintPlanPrepare({ ...lookup(cwd), mode: "replace", targetPlanIds: ["01"] });
  assert.equal(changed.status, "reconciliation_required");
});

test("marker write interruptions resume both before and after the commit boundary", async t => {
  for (const status of ["pending", "committed"]) {
    const cwd = await fixture(t), saved = await submit(cwd, await prepare(cwd));
    const original = planDependencies.writeText;
    let failed = false;
    planDependencies.writeText = async (...args) => {
      const result = await original(...args);
      if (!failed && args[0].endsWith("PLAN-PUBLICATION.json") && args[1].includes(`"status": "${status}"`)) { failed = true; throw new Error(`crash after ${status} marker bytes`); }
      return result;
    };
    const args = { ...lookup(cwd), expectedRevision: revision(saved), requestId: `marker-${status}` };
    try { assert.equal((await blueprintPlanFinalize(args)).status, "partial"); }
    finally { planDependencies.writeText = original; }
    assert.equal((await blueprintPlanFinalize(args)).status, "published");
  }
});

test("stale evidence during publication can explicitly roll back without losing candidate history", async t => {
  const cwd = await fixture(t), saved = await submit(cwd, await prepare(cwd), candidate(["core", "api"]));
  const original = planDependencies.writeText;
  let changed = false;
  planDependencies.writeText = async (...args) => {
    const result = await original(...args);
    if (!changed && args[0].endsWith("01-01-PLAN.md")) { changed = true; await writeFile(path.join(cwd, "src/core.ts"), "export const core = 2;\n"); }
    return result;
  };
  try { assert.equal((await blueprintPlanFinalize({ ...lookup(cwd), expectedRevision: revision(saved), requestId: "stale-publish" })).status, "partial"); }
  finally { planDependencies.writeText = original; }
  const pending = await blueprintPlanPrepare(lookup(cwd));
  assert.equal(pending.status, "partial");
  assert.ok("targetHashes" in pending);
  const prepared = await blueprintPlanPrepare({ ...lookup(cwd), expectedRevision: revision(saved), acknowledgeChangedInputs: true, reconcile: { confirmed: true, targetHashes: pending.targetHashes as Record<string, string | null> } });
  assert.equal(prepared.status, "prepared", JSON.stringify(prepared));
  assert.equal((await blueprintPhasePlanIndex(lookup(cwd))).plans.length, 0);
  const restored = await blueprintPlanRead(lookup(cwd));
  assert.deepEqual(restored.session!.candidate, candidate(["core", "api"]));
  assert.ok(restored.session!.history.some(item => item.kind === "publication-reconciled" && item.journal));
  assert.equal(restored.publication.status, "absent");
  assert.equal((await blueprintPlanFinalize({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "fresh-publish" })).status, "published");
});

test("replace removes selected superseded slots and preserves unrelated files", async t => {
  const cwd = await fixture(t), saved = await submit(cwd, await prepare(cwd), candidate(["core", "api"]));
  await publish(cwd, saved);
  const unknownPath = path.join(cwd, phaseDir, "custom-notes.md");
  await writeFile(unknownPath, "Keep this independently authored note.\n");
  const prepared = await blueprintPlanPrepare({ ...lookup(cwd), mode: "replace", expectedRevision: revision(saved), acknowledgeChangedInputs: true });
  assert.equal(prepared.status, "prepared", JSON.stringify(prepared));
  const revised = await submit(cwd, prepared, candidate(), "replacement");
  const original = planDependencies.remove;
  let failed = false;
  planDependencies.remove = async value => { await original(value); if (!failed && value.endsWith("01-02-PLAN.md")) { failed = true; throw new Error("interrupted after removing superseded plan"); } };
  const args = { ...lookup(cwd), expectedRevision: revision(revised), requestId: "replace-publish", overwrite: true };
  try { assert.equal((await blueprintPlanFinalize(args)).status, "partial"); }
  finally { planDependencies.remove = original; }
  const published = await blueprintPlanFinalize(args);
  assert.equal(published.status, "published", JSON.stringify(published));
  assert.deepEqual((await blueprintPhasePlanIndex(lookup(cwd))).plans.map(plan => plan.planId), ["01"]);
  assert.equal(await readFile(unknownPath, "utf8"), "Keep this independently authored note.\n");
  assert.ok((await blueprintPlanRead(lookup(cwd))).session!.journal!.removed[0].backup.includes("Implement api"));
});

test("stale roadmap decisions do not prevent durable candidate salvage", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd);
  const roadmapPath = path.join(cwd, ".blueprint/ROADMAP.md");
  await writeFile(roadmapPath, (await readFile(roadmapPath, "utf8")).replace("Save durable planning.", "Save durable planning with stronger recovery."));
  const saved = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "stale-topology-draft", candidate: candidate() });
  assert.equal(saved.status, "needs_revision");
  assert.deepEqual((await blueprintPlanRead(lookup(cwd))).session!.candidate, candidate());
  assert.equal((await blueprintPlanPrepare(lookup(cwd))).status, "reconciliation_required");
});

test("rollback marker failures retain an idempotent recovery journal", async t => {
  for (const failure of ["before", "after"]) {
    const cwd = await fixture(t), first = await submit(cwd, await prepare(cwd));
    await publish(cwd, first);
    const oldContent = await readFile(path.join(cwd, firstPath), "utf8");
    const prepared = await blueprintPlanPrepare({ ...lookup(cwd), mode: "revise", targetPlanIds: ["01"], expectedRevision: revision(first), acknowledgeChangedInputs: true });
    const draft = candidate(); draft.plans[0].title = "Improve recovery behavior";
    const saved = await submit(cwd, prepared, draft, "rollback-draft");
    const originalState = planDependencies.stateUpdate;
    planDependencies.stateUpdate = async () => { throw new Error("state unavailable"); };
    try { assert.equal((await blueprintPlanFinalize({ ...lookup(cwd), expectedRevision: revision(saved), requestId: "rollback-publication", overwrite: true })).status, "partial"); }
    finally { planDependencies.stateUpdate = originalState; }
    const pending = await blueprintPlanPrepare(lookup(cwd));
    assert.ok("targetHashes" in pending);
    const args = { ...lookup(cwd), expectedRevision: revision(saved), acknowledgeChangedInputs: true, reconcile: { confirmed: true as const, targetHashes: pending.targetHashes as Record<string, string | null> } };
    const originalWrite = planDependencies.writeText;
    let failed = false;
    planDependencies.writeText = async (...input) => {
      const shouldFail = !failed && input[0].endsWith("PLAN-PUBLICATION.json") && input[1].includes('"status": "committed"');
      if (shouldFail && failure === "before") { failed = true; throw new Error("rollback marker failure before write"); }
      const result = await originalWrite(...input);
      if (shouldFail) { failed = true; throw new Error("rollback marker failure after write"); }
      return result;
    };
    try { assert.equal((await blueprintPlanPrepare(args)).status, "blocked"); }
    finally { planDependencies.writeText = originalWrite; }
    assert.ok((await blueprintPlanRead(lookup(cwd))).session!.journal, "Incomplete rollback keeps its recovery journal.");
    const observed = await blueprintPlanPrepare(lookup(cwd));
    assert.ok("targetHashes" in observed);
    const recovered = await blueprintPlanPrepare({ ...args, reconcile: { confirmed: true, targetHashes: observed.targetHashes as Record<string, string | null> } });
    assert.equal(recovered.status, "prepared", JSON.stringify(recovered));
    assert.equal(await readFile(path.join(cwd, firstPath), "utf8"), oldContent);
    assert.deepEqual((await blueprintPlanRead(lookup(cwd))).session!.candidate, draft);
  }
});

test("preparation bounds the combined evidence excerpts and retains previously tracked sources", async t => {
  const cwd = await fixture(t);
  for (let index = 0; index < 6; index++) await writeFile(path.join(cwd, `src/large-${index}.ts`), "// meaningful evidence\n".repeat(1000));
  const paths = Array.from({ length: 6 }, (_, index) => `src/large-${index}.ts`);
  const prepared = await blueprintPlanPrepare({ ...lookup(cwd), evidencePaths: paths });
  assert.equal(prepared.status, "prepared");
  assert.ok("evidence" in prepared);
  const evidence = prepared.evidence as Array<{ content: string | null; truncated: boolean }>;
  assert.ok(evidence.reduce((sum, item) => sum + (item.content?.length ?? 0), 0) <= 12000);
  assert.ok(evidence.every(item => (item.content?.length ?? 0) <= 3000));
  assert.ok(evidence.some(item => item.truncated));
  const again = await blueprintPlanPrepare({ ...lookup(cwd), evidencePaths: [] });
  assert.equal(again.status, "prepared");
  assert.equal(revision(again), revision(prepared));
  assert.deepEqual((await blueprintPlanRead(lookup(cwd))).session!.evidencePaths, paths);
});

test("retained plan edits during state synchronization prevent a ready receipt and stay outside the baseline", async t => {
  const cwd = await fixture(t), first = await submit(cwd, await prepare(cwd), candidate(["core", "api"]));
  await publish(cwd, first);
  const prepared = await blueprintPlanPrepare({ ...lookup(cwd), mode: "revise", targetPlanIds: ["01"], expectedRevision: revision(first), acknowledgeChangedInputs: true });
  const saved = await submit(cwd, prepared, candidate(), "retained-draft");
  const original = planDependencies.stateUpdate;
  planDependencies.stateUpdate = async args => {
    const result = await original(args);
    await writeFile(path.join(cwd, secondPath), (await readFile(path.join(cwd, secondPath), "utf8")) + "\nExternal retained plan edit.\n");
    return result;
  };
  const expectedHash = (await blueprintPlanRead(lookup(cwd))).session!.targets.find(item => item.path === secondPath)!.hash;
  let result: unknown;
  try { result = await blueprintPlanFinalize({ ...lookup(cwd), expectedRevision: revision(saved), requestId: "retained-race", overwrite: true }); }
  finally { planDependencies.stateUpdate = original; }
  assert.equal((result as { status: string }).status, "partial", JSON.stringify(result));
  assert.match((result as { reason: string }).reason, /complete published plan set changed/);
  assert.equal((await blueprintPlanRead(lookup(cwd))).session!.targets.find(item => item.path === secondPath)!.hash, expectedHash);
});

test("planning binds transitive research source fingerprints through publication", async t => {
  const cwd = await fixture(t, { research: true });
  const sourcePath = "src/research-only.ts";
  const source = "export const researchFinding = 1;\n";
  await writeFile(path.join(cwd, sourcePath), source);
  await publishResearchBasis(cwd, sourcePath, source);
  const prepared = await blueprintPlanPrepare(lookup(cwd));
  assert.equal(prepared.status, "prepared", JSON.stringify(prepared));
  const saved = await submit(cwd, prepared);
  assert.equal((await blueprintPlanRead(lookup(cwd))).session!.readSet.find(item => item.path === sourcePath)?.hash, researchDigest(source));
  const original = planDependencies.writeText;
  let changed = false;
  planDependencies.writeText = async (...args) => {
    const result = await original(...args);
    if (!changed && args[0].endsWith("01-01-PLAN.md")) { changed = true; await writeFile(path.join(cwd, sourcePath), "export const researchFinding = 2;\n"); }
    return result;
  };
  let result: unknown;
  try { result = await blueprintPlanFinalize({ ...lookup(cwd), expectedRevision: revision(saved), requestId: "transitive-evidence" }); }
  finally { planDependencies.writeText = original; }
  assert.equal((result as { status: string }).status, "partial", JSON.stringify(result));
  assert.match((result as { reason: string }).reason, /research-only\.ts/);
  assert.equal((await blueprintPlanRead(lookup(cwd))).publication.status, "pending");
});

test("large invalid candidates produce bounded diagnostics and remain directly correctable", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd);
  const invalid = { plans: Array.from({ length: 40000 }, () => ({})) };
  const saved = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "large-invalid", candidate: invalid });
  assert.equal(saved.status, "needs_revision", JSON.stringify(saved).slice(0, 1000));
  assert.ok("validation" in saved);
  const validation = saved.validation as { diagnostics: unknown[]; diagnosticCount: number; diagnosticsTruncated: boolean };
  assert.ok(validation.diagnostics.length <= 100);
  assert.ok(validation.diagnosticCount > validation.diagnostics.length);
  assert.equal(validation.diagnosticsTruncated, true);
  assert.ok(Buffer.byteLength(JSON.stringify(saved)) < 100000);
  const fixed = await submit(cwd, saved, candidate(), "large-fixed");
  assert.equal(fixed.status, "ready");
  assert.deepEqual((await blueprintPlanRead(lookup(cwd))).session!.history.find(item => item.revision === revision(saved))?.candidate, invalid);
});

test("current-revision corrections supersede failed assessments but never pending publication", async t => {
  const cwd = await fixture(t), prepared = await prepare(cwd);
  const original = planDependencies.compile;
  planDependencies.compile = () => { throw new Error("permanent assessment error for original shape"); };
  let failed: unknown;
  try { failed = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(prepared), requestId: "failed-assessment", candidate: candidate() }); }
  finally { planDependencies.compile = original; }
  const corrected = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(failed), requestId: "superseding-correction", corrections: [{ path: ["plans", "0", "title"], value: "Improved core plan" }] });
  assert.equal(corrected.status, "ready", JSON.stringify(corrected));
  assert.equal((await blueprintPlanRead(lookup(cwd))).session!.requests["failed-assessment"].receipt?.status, "superseded");
  const originalWrite = planDependencies.writeText;
  planDependencies.writeText = async (...args) => { if (args[0].endsWith("01-01-PLAN.md")) throw new Error("publication interrupted"); return originalWrite(...args); };
  try { assert.equal((await blueprintPlanFinalize({ ...lookup(cwd), expectedRevision: revision(corrected), requestId: "pending-publication" })).status, "partial"); }
  finally { planDependencies.writeText = originalWrite; }
  const refused = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(corrected), requestId: "unsafe-supersession", candidate: candidate() });
  assert.equal(refused.status, "partial");
  assert.equal((await blueprintPlanRead(lookup(cwd))).session!.journal?.requestId, "pending-publication");
});

test("completed planning sessions require a fresh mode choice and authoring revision", async t => {
  const cwd = await fixture(t), saved = await submit(cwd, await prepare(cwd));
  await publish(cwd, saved);
  const choice = await blueprintPlanPrepare(lookup(cwd));
  assert.equal(choice.status, "choice_required");
  assert.equal(revision(choice), revision(saved));
  const prepared = await blueprintPlanPrepare({ ...lookup(cwd), mode: "add" });
  assert.equal(prepared.status, "prepared", JSON.stringify(prepared));
  assert.ok(revision(prepared) > revision(saved));
  const session = (await blueprintPlanRead(lookup(cwd))).session!;
  assert.equal(session.journal, undefined);
  assert.ok(session.history.some(item => item.journal?.receipt?.status === "published"));
  assert.ok(session.knownEvidenceArtifacts.includes(firstPath));
  assert.equal(revision(await blueprintPlanPrepare(lookup(cwd))), revision(prepared), "Unfinished preparation reuses its chosen intent.");
});

test("preexisting stale research blocks with a research repair route and a current planning snapshot", async t => {
  const cwd = await fixture(t, { research: true });
  const sourcePath = "src/research-only.ts", oldSource = "export const researchFinding = 1;\n", currentSource = "export const researchFinding = 2;\n";
  await writeFile(path.join(cwd, sourcePath), oldSource);
  await publishResearchBasis(cwd, sourcePath, oldSource);
  await writeFile(path.join(cwd, sourcePath), currentSource);
  const prepared = await blueprintPlanPrepare({ ...lookup(cwd), evidencePaths: [sourcePath] });
  assert.equal(prepared.status, "blocked", JSON.stringify(prepared));
  assert.ok("nextAction" in prepared);
  assert.match(String(prepared.nextAction), /\/blu-research-phase/);
  assert.ok("evidence" in prepared);
  const evidence = prepared.evidence.find(item => item.path === sourcePath)!;
  assert.equal(evidence.content, currentSource);
  assert.equal(evidence.hash, researchDigest(currentSource));
  const restored = await blueprintPlanRead(lookup(cwd));
  assert.equal(restored.session!.readSet.find(item => item.path === sourcePath)?.hash, researchDigest(currentSource));
  assert.equal(restored.freshness?.status, "fresh");
  const again = await blueprintPlanPrepare(lookup(cwd));
  assert.equal(again.status, "blocked", "Unchanged stale research is a repair blocker, not an endless collection retry.");
});

test("direct drafts after publication retain a durable requirement for a new explicit intent", async t => {
  const cwd = await fixture(t), saved = await submit(cwd, await prepare(cwd));
  const published = await publish(cwd, saved);
  assert.deepEqual(await blueprintPlanFinalize({ ...lookup(cwd), expectedRevision: revision(saved), requestId: "publish" }), published);
  assert.equal((await blueprintPlanRead(lookup(cwd))).session!.needsIntent, true);
  const draft = candidate(["api"]);
  const direct = await blueprintPlanSubmit({ ...lookup(cwd), expectedRevision: revision(saved), requestId: "direct-draft", candidate: draft });
  assert.equal(direct.status, "needs_revision");
  assert.match(String("nextAction" in direct && direct.nextAction), /explicit add\/revise\/replace mode/);
  const restored = await blueprintPlanRead(lookup(cwd));
  assert.deepEqual(restored.session!.candidate, draft);
  assert.equal(restored.session!.journal, undefined);
  assert.equal(restored.session!.needsIntent, true);
  assert.equal((await blueprintPlanPrepare(lookup(cwd))).status, "choice_required");
  assert.equal((await blueprintPlanFinalize({ ...lookup(cwd), expectedRevision: revision(direct), requestId: "direct-finalize" })).status, "needs_revision");
  const prepared = await blueprintPlanPrepare({ ...lookup(cwd), mode: "add" });
  assert.equal(prepared.status, "prepared", JSON.stringify(prepared));
  assert.ok(revision(prepared) > revision(direct));
  assert.equal((await blueprintPlanRead(lookup(cwd))).session!.needsIntent, false);
  const ready = await submit(cwd, prepared, draft, "chosen-draft");
  await publish(cwd, ready, "chosen-publish");
  assert.equal((await blueprintPhasePlanIndex(lookup(cwd))).plans.length, 2);
});
