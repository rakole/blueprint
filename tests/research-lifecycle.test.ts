import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createGitRepo } from "./helpers/git-fixtures.js";
import { validPhaseContextModel } from "./helpers/context-model.js";
import { blueprintConfigSet } from "../src/mcp/tools/config.js";
import { validatePhaseArtifactContent } from "../src/mcp/tools/artifacts.js";
import { blueprintPhaseArtifactRead, blueprintPhaseArtifactWrite } from "../src/mcp/tools/phase-artifacts.js";
import { blueprintPhaseCheckpointGet, blueprintPhaseCheckpointPut } from "../src/mcp/tools/phase-checkpoints.js";
import { blueprintStateLoad } from "../src/mcp/tools/state.js";
import { type PhaseResearchStructuredModel } from "../src/mcp/tools/phase-research-model.js";
import {
  blueprintResearchPrepare,
  blueprintResearchRead,
  blueprintResearchRecord,
  blueprintResearchSubmit,
  researchSubmitDependencies,
} from "../src/mcp/tools/research.js";

const phaseDir = ".blueprint/phases/01-research";
const researchPath = `${phaseDir}/01-RESEARCH.md`;
const contextPath = `${phaseDir}/01-CONTEXT.md`;
const specPath = `${phaseDir}/01-SPEC.md`;
const provenancePath = `${phaseDir}/01-RESEARCH-PROVENANCE.json`;
const lookup = (cwd: string) => ({ cwd, phase: "1" });

function candidate(): PhaseResearchStructuredModel {
  return {
    summary: "Preserve the existing core entry point while adding durable research persistence.",
    findings: [{ id: "CLM-001", finding: "The core module exports the integration entry point.", sourceIds: ["SRC-001"], confidence: "HIGH", requirementIds: ["R-1"], status: "supported" }],
    recommendations: [{ id: "REC-001", recommendation: "Extend the existing core entry point with durable persistence.", findingIds: ["CLM-001"], affectedSurfaces: ["src/core.ts"], verification: ["Interrupt publication and verify that retry preserves the complete draft."], requirementIds: ["R-1"], status: "ready" }],
    openQuestions: [],
    sources: [{ id: "SRC-001", lane: "repo", reference: "src/core.ts:1", excerpt: "export const core = 1;" }],
  };
}

function revision(result: unknown): number {
  assert.ok(result && typeof result === "object" && "revision" in result, JSON.stringify(result));
  assert.equal(typeof result.revision, "number");
  return result.revision as number;
}

async function fixture(t: TestContext, options: { context?: boolean; policy?: "off" | "ask" | "auto" } = {}) {
  const cwd = await createGitRepo("research-lifecycle-");
  t.after(() => rm(path.dirname(cwd), { recursive: true, force: true }));
  await mkdir(path.join(cwd, phaseDir), { recursive: true });
  await mkdir(path.join(cwd, "src"), { recursive: true });
  await writeFile(path.join(cwd, "src/core.ts"), "export const core = 1;\n");
  await writeFile(path.join(cwd, ".blueprint/PROJECT.md"), "# Project\n\nDurable research for a small product.\n");
  await writeFile(path.join(cwd, ".blueprint/REQUIREMENTS.md"), "# Requirements\n\n- R-1: Preserve complete research before publication validation.\n");
  await writeFile(path.join(cwd, ".blueprint/ROADMAP.md"), "# Roadmap: Fixture\n\n## Phases\n\n- [ ] **Phase 1: Research** - Durable research\n\n## Phase Details\n\n### Phase 1: Research\n**Goal**: Save durable research.\n**Requirements**: R-1\n");
  await blueprintConfigSet({ cwd, patch: { research: { external_sources: options.policy ?? "off" } } });
  if (options.context !== false) {
    const result = await blueprintPhaseArtifactWrite({ ...lookup(cwd), artifact: "context", model: validPhaseContextModel({ phaseLabel: "phase 1", openQuestions: [], deferredIdeas: [], externalConstraints: ["Do not mutate host-global Blueprint state.", "Preserve customer data across all retries."] }) });
    assert.notEqual(result.status, "invalid", JSON.stringify(result));
  }
  return cwd;
}

async function prepare(cwd: string, evidencePaths = ["src/core.ts"]) {
  const result = await blueprintResearchPrepare({ ...lookup(cwd), evidencePaths });
  assert.equal(result.status, "prepared", JSON.stringify(result));
  return { ...result, revision: revision(result) };
}

test("prepare and a single submit publish canonical research, state, provenance and a replayable receipt", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  assert.ok("spec" in prepared && prepared.spec.content === null, "A spec is optional.");
  assert.ok("schema" in prepared && prepared.schema);
  const args = { ...lookup(cwd), requestId: "one-shot", expectedRevision: prepared.revision, candidate: candidate() };
  const result = await blueprintResearchSubmit(args) as Record<string, unknown>;
  assert.equal(result.status, "published", JSON.stringify(result));
  assert.equal(result.saved, true);
  assert.equal(result.ready, true);
  assert.equal(result.path, researchPath);
  assert.deepEqual(result.stages, { artifact: "complete", provenance: "complete", state: "complete", routing: "complete", cleanup: "complete" });
  const downstream = await blueprintPhaseArtifactRead({ ...lookup(cwd), artifact: "research" });
  assert.equal(downstream.found, true);
  assert.equal(validatePhaseArtifactContent(downstream.content!, "research").valid, true);
  assert.match(downstream.content!, /Preserve the existing core entry point/);
  assert.match(downstream.content!, /Preserve complete research before publication validation/);
  assert.match(downstream.content!, /Structured phase.context models are the semantic source of truth/);
  assert.match(downstream.content!, /Do not mutate host-global Blueprint state/);
  assert.match(downstream.content!, /Preserve customer data across all retries/);
  const provenance = JSON.parse(await readFile(path.join(cwd, provenancePath), "utf8"));
  assert.ok(provenance.readSet.some((entry: { path: string }) => entry.path === "src/core.ts"));
  const state = await blueprintStateLoad({ cwd });
  assert.equal(state.state.currentPhase, "1");
  assert.match(await readFile(path.join(cwd, ".blueprint/STATE.md"), "utf8"), /- Active command: \/blu-research-phase/);
  assert.equal(result.nextAction, state.derivedStatus.nextAction);
  assert.deepEqual(await blueprintResearchSubmit(args), result);
  const saved = await blueprintResearchRead(lookup(cwd));
  assert.deepEqual(saved.session?.candidate, args.candidate);
  assert.equal(saved.session?.revision, prepared.revision + 1);
  assert.equal(saved.session?.history.filter(entry => entry.kind === "submit").length, 1);
});

test("malformed raw JSON remains recoverable after failed validation and an identical retry", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const raw = '{"summary":"All generated work stays here", "findings": [';
  const args = { ...lookup(cwd), requestId: "malformed", expectedRevision: prepared.revision, candidate: raw };
  const result = await blueprintResearchSubmit(args) as Record<string, unknown>;
  assert.equal(result.status, "needs_revision", JSON.stringify(result));
  assert.equal(result.saved, true);
  assert.equal((await blueprintResearchRead(lookup(cwd))).session?.candidate, raw);
  assert.deepEqual(await blueprintResearchSubmit(args), result);
  assert.equal((await blueprintPhaseArtifactRead({ ...lookup(cwd), artifact: "research" })).found, false);
});

test("reserved request IDs cannot poison a durable session", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  for (const requestId of ["constructor", "prototype", "__proto__"]) {
    await assert.rejects(blueprintResearchSubmit({ ...lookup(cwd), requestId, expectedRevision: prepared.revision, candidate: candidate() }));
    await assert.rejects(blueprintResearchRecord({ ...lookup(cwd), requestId, expectedRevision: prepared.revision, candidate: candidate() }));
  }
  assert.equal((await blueprintResearchRead(lookup(cwd))).session?.revision, prepared.revision);
  const published = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "safe-id", expectedRevision: prepared.revision, candidate: candidate() });
  assert.equal(published.status, "published", JSON.stringify(published));
});

test("a codebase summary appearing after preparation invalidates the saved evidence basis", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  await mkdir(path.join(cwd, ".blueprint/codebase"), { recursive: true });
  await writeFile(path.join(cwd, ".blueprint/codebase/ARCHITECTURE.md"), "# Architecture\n\nThe module boundary changed.\n");
  const result = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "new-summary", expectedRevision: prepared.revision, candidate: candidate() }) as Record<string, unknown>;
  assert.equal(result.status, "needs_revision", JSON.stringify(result));
  assert.equal(result.saved, true);
  assert.equal((result.freshness as { status: string }).status, "stale");
  assert.equal((await blueprintPhaseArtifactRead({ ...lookup(cwd), artifact: "research" })).found, false);
});

test("prior-phase research can be captured and cited using equivalent relative paths", async t => {
  const cwd = await fixture(t);
  const priorPath = ".blueprint/phases/00-foundation/00-RESEARCH.md";
  await mkdir(path.dirname(path.join(cwd, priorPath)), { recursive: true });
  await writeFile(path.join(cwd, priorPath), "# Prior research\n\nThe core module is the integration entry point.\n");
  const prepared = await prepare(cwd, [`./${priorPath}`]);
  const model = candidate();
  model.sources[0].reference = priorPath;
  const result = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "prior-research", expectedRevision: prepared.revision, candidate: model });
  assert.equal(result.status, "published", JSON.stringify(result));
  const selfReference = await blueprintResearchPrepare({ ...lookup(cwd), evidencePaths: [`./${researchPath}`] });
  assert.equal(selfReference.status, "blocked");
});

test("candidate recovery survives an unreadable canonical research target", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const raw = "The full draft must remain available even when canonical research cannot be read.";
  await blueprintResearchRecord({ ...lookup(cwd), requestId: "recover-draft", expectedRevision: prepared.revision, candidate: raw });
  await mkdir(path.join(cwd, researchPath));
  const read = await blueprintResearchRead(lookup(cwd));
  assert.equal(read.status, "found");
  assert.equal(read.session?.candidate, raw);
  assert.ok("error" in read.published && read.published.error);
});

test("request identity and revision conflicts cannot silently replace a saved candidate", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const original = { ...candidate(), summary: "" };
  const args = { ...lookup(cwd), requestId: "retain", expectedRevision: prepared.revision, candidate: original };
  const recorded = await blueprintResearchRecord(args);
  assert.equal(recorded.status, "recorded");
  assert.deepEqual(await blueprintResearchRecord(args), recorded);
  const conflict = await blueprintResearchRecord({ ...args, candidate: candidate() });
  assert.equal(conflict.status, "rejected");
  const stale = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "wrong-revision", expectedRevision: prepared.revision, candidate: candidate() });
  assert.equal(stale.status, "stale");
  const saved = await blueprintResearchRead(lookup(cwd));
  assert.deepEqual(saved.session?.candidate, original);
  assert.equal(saved.session?.revision, revision(recorded));
});

test("a narrow field correction publishes the saved candidate without regenerating its other fields", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const original = { ...candidate(), summary: "" };
  const rejected = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "incomplete", expectedRevision: prepared.revision, candidate: original });
  assert.equal(rejected.status, "needs_revision");
  const corrected = await blueprintResearchRecord({ ...lookup(cwd), requestId: "repair-summary", expectedRevision: revision(rejected), corrections: [{ path: ["summary"], value: candidate().summary }] });
  assert.equal(corrected.status, "recorded");
  assert.deepEqual((await blueprintResearchRead(lookup(cwd))).session?.candidate, candidate());
  const result = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "publish-repair", expectedRevision: revision(corrected) });
  assert.equal(result.status, "published", JSON.stringify(result));
});

test("missing context blocks publication while a submitted draft is still retained", async t => {
  const cwd = await fixture(t, { context: false });
  const prepared = await blueprintResearchPrepare({ ...lookup(cwd), evidencePaths: ["src/core.ts"] });
  assert.equal(prepared.status, "blocked");
  const result = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "missing-context", expectedRevision: revision(prepared), candidate: candidate() });
  assert.equal(result.status, "needs_revision");
  assert.deepEqual((await blueprintResearchRead(lookup(cwd))).session?.candidate, candidate());
});

for (const policy of ["off", "ask", "auto"] as const) {
  test(`external sources honor ${policy} policy without losing a candidate`, async t => {
    const cwd = await fixture(t, { policy });
    const prepared = await prepare(cwd);
    const external = candidate();
    external.sources[0] = { id: "SRC-001", lane: "external", reference: "https://example.org/official-api", excerpt: "The public API supports a durable persistence extension." };
    const result = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "external", expectedRevision: prepared.revision, candidate: external, ...(policy === "off" ? { externalSourcesApproved: true } : {}) });
    assert.deepEqual((await blueprintResearchRead(lookup(cwd))).session?.candidate, external);
    if (policy === "auto") {
      assert.equal(result.status, "published", JSON.stringify(result));
    } else {
      assert.equal(result.status, "needs_revision", JSON.stringify(result));
      assert.equal((await blueprintPhaseArtifactRead({ ...lookup(cwd), artifact: "research" })).found, false);
      if (policy === "ask") {
        const approved = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "external-approved", expectedRevision: revision(result), externalSourcesApproved: true });
        assert.equal(approved.status, "published", JSON.stringify(approved));
      }
    }
  });
}

test("repository sources need captured evidence and can be added without replacing the saved candidate", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd, []);
  const missing = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "unread-source", expectedRevision: prepared.revision, candidate: candidate() }) as Record<string, unknown>;
  assert.equal(missing.status, "needs_revision");
  assert.deepEqual(missing.missingEvidencePaths, ["src/core.ts"]);
  const captured = await prepare(cwd);
  assert.deepEqual((await blueprintResearchRead(lookup(cwd))).session?.candidate, candidate());
  const result = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "captured-source", expectedRevision: captured.revision });
  assert.equal(result.status, "published", JSON.stringify(result));
});

for (const input of ["source", "context", "optional-spec", "effective-config"] as const) {
  test(`changed ${input} evidence blocks publication and retains the complete draft`, async t => {
    const cwd = await fixture(t);
    const prepared = await prepare(cwd);
    let changedPath: string;
    if (input === "source") {
      changedPath = "src/core.ts";
      await writeFile(path.join(cwd, changedPath), "export const core = 2;\n");
    } else if (input === "context") {
      changedPath = contextPath;
      const result = await blueprintPhaseArtifactWrite({ ...lookup(cwd), artifact: "context", overwrite: true, model: validPhaseContextModel({ phaseLabel: "phase 1", decision: "Add a requirement to preserve source provenance.", openQuestions: [], deferredIdeas: [] }) });
      assert.notEqual(result.status, "invalid");
    } else if (input === "optional-spec") {
      changedPath = specPath;
      await writeFile(path.join(cwd, changedPath), "# Newly supplied specification\nReview before publishing.\n");
    } else {
      changedPath = "@research/effective-config";
      await blueprintConfigSet({ cwd, patch: { research: { external_sources: "ask" } } });
    }
    const result = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "changed-input", expectedRevision: prepared.revision, candidate: candidate() }) as Record<string, unknown>;
    assert.equal(result.status, "needs_revision", JSON.stringify(result));
    assert.deepEqual((result.freshness as { stalePaths: string[] }).stalePaths, [changedPath]);
    assert.deepEqual((await blueprintResearchRead(lookup(cwd))).session?.candidate, candidate());
    assert.equal((await blueprintPhaseArtifactRead({ ...lookup(cwd), artifact: "research" })).found, false);
    if (input === "source") {
      const stale = await blueprintResearchPrepare(lookup(cwd));
      assert.equal(stale.status, "stale");
      const refreshed = await blueprintResearchPrepare({ ...lookup(cwd), expectedRevision: revision(result), acknowledgeChangedInputs: true });
      assert.equal(refreshed.status, "prepared", JSON.stringify(refreshed));
      const correction = await blueprintResearchRecord({ ...lookup(cwd), requestId: "source-update", expectedRevision: revision(refreshed), corrections: [{ path: ["sources", "0", "excerpt"], value: "export const core = 2;" }] });
      const published = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "reviewed-input", expectedRevision: revision(correction) });
      assert.equal(published.status, "published", JSON.stringify(published));
    }
  });
}

test("fresh published research is reusable with its original provenance", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const published = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "initial", expectedRevision: prepared.revision, candidate: candidate() });
  assert.equal(published.status, "published", JSON.stringify(published));
  const content = await readFile(path.join(cwd, researchPath), "utf8");
  const provenance = await readFile(path.join(cwd, provenancePath), "utf8");
  const rechecked = await prepare(cwd);
  assert.ok("existing" in rechecked && rechecked.existing.freshness?.status === "fresh");
  const reused = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "reuse", expectedRevision: rechecked.revision, reuse: true });
  assert.equal(reused.status, "reused", JSON.stringify(reused));
  assert.equal(await readFile(path.join(cwd, researchPath), "utf8"), content);
  assert.equal(await readFile(path.join(cwd, provenancePath), "utf8"), provenance);
});

test("valid legacy research without provenance cannot be silently reused", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const published = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "initial", expectedRevision: prepared.revision, candidate: candidate() });
  assert.equal(published.status, "published", JSON.stringify(published));
  const content = await readFile(path.join(cwd, researchPath), "utf8");
  // Simulate an existing legacy artifact created before sessions and provenance.
  await rm(path.join(cwd, provenancePath));
  await rm(path.join(cwd, `${phaseDir}/01-RESEARCH-SESSION.json`));
  const legacy = await prepare(cwd);
  assert.ok("existing" in legacy && legacy.existing.valid);
  assert.ok("existing" in legacy && legacy.existing.freshness?.status === "unknown");
  const result = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "legacy-reuse", expectedRevision: legacy.revision, reuse: true });
  assert.equal(result.status, "needs_revision", JSON.stringify(result));
  assert.equal(await readFile(path.join(cwd, researchPath), "utf8"), content);
});

test("refreshing a session does not rebase stale published research into reusable evidence", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const published = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "initial", expectedRevision: prepared.revision, candidate: candidate() });
  assert.equal(published.status, "published", JSON.stringify(published));
  const originalProvenance = await readFile(path.join(cwd, provenancePath), "utf8");
  await writeFile(path.join(cwd, "src/core.ts"), "export const core = 3;\n");
  const refreshed = await blueprintResearchPrepare({ ...lookup(cwd), expectedRevision: revision(published), acknowledgeChangedInputs: true });
  assert.equal(refreshed.status, "prepared", JSON.stringify(refreshed));
  const reused = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "stale-reuse", expectedRevision: revision(refreshed), reuse: true });
  assert.equal(reused.status, "needs_revision", JSON.stringify(reused));
  assert.equal(await readFile(path.join(cwd, provenancePath), "utf8"), originalProvenance);
});

test("updating existing research saves the revision before requiring explicit overwrite", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const initial = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "initial", expectedRevision: prepared.revision, candidate: candidate() });
  assert.equal(initial.status, "published", JSON.stringify(initial));
  const original = await readFile(path.join(cwd, researchPath), "utf8");
  const updated = { ...candidate(), summary: "A revised recommendation retains durable persistence and adds a recovery check." };
  const result = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "update", expectedRevision: revision(initial), candidate: updated });
  assert.equal(result.status, "needs_revision", JSON.stringify(result));
  assert.equal(await readFile(path.join(cwd, researchPath), "utf8"), original);
  assert.deepEqual((await blueprintResearchRead(lookup(cwd))).session?.candidate, updated);
  const authorized = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "authorized-update", expectedRevision: revision(result), overwrite: true });
  assert.equal(authorized.status, "published", JSON.stringify(authorized));
  assert.match(await readFile(path.join(cwd, researchPath), "utf8"), /A revised recommendation/);
});

test("an external research edit after preparation is preserved even with overwrite authorization", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const external = "# Research edited by another author\n\nKeep this independently authored work.\n";
  await writeFile(path.join(cwd, researchPath), external);
  const result = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "conflicting-target", expectedRevision: prepared.revision, candidate: candidate(), overwrite: true });
  assert.equal(result.status, "stale", JSON.stringify(result));
  assert.equal(await readFile(path.join(cwd, researchPath), "utf8"), external);
  assert.deepEqual((await blueprintResearchRead(lookup(cwd))).session?.candidate, candidate());
  const pending = await blueprintResearchPrepare(lookup(cwd));
  assert.equal(pending.status, "reconciliation_required", JSON.stringify(pending));
});

test("reviewed target reconciliation preserves the draft and permits an explicitly authorized replacement", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  await writeFile(path.join(cwd, researchPath), "# External draft\n\nIndependently edited research.\n");
  const blocked = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "conflict", expectedRevision: prepared.revision, candidate: candidate(), overwrite: true });
  assert.equal(blocked.status, "stale");
  const observed = await blueprintResearchPrepare(lookup(cwd));
  assert.equal(observed.status, "reconciliation_required");
  assert.ok("existing" in observed);
  const reconciled = await blueprintResearchPrepare({ ...lookup(cwd), expectedRevision: revision(observed), reconcile: { confirmed: true, researchHash: observed.existing.hash } });
  assert.equal(reconciled.status, "prepared", JSON.stringify(reconciled));
  assert.deepEqual((await blueprintResearchRead(lookup(cwd))).session?.candidate, candidate());
  const replaced = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "reviewed-replacement", expectedRevision: revision(reconciled), overwrite: true });
  assert.equal(replaced.status, "published", JSON.stringify(replaced));
});

test("unsafe candidate keys, paths and excessive payloads are rejected before persistence", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  for (const unsafe of [JSON.parse('{"__proto__":{"polluted":true}}'), { constructor: "bad" }, "x".repeat(1024 * 1024 + 1)]) {
    await assert.rejects(blueprintResearchSubmit({ ...lookup(cwd), requestId: "unsafe", expectedRevision: prepared.revision, candidate: unsafe }), /Unsafe|1 MiB/);
  }
  const stored = await blueprintResearchRead(lookup(cwd));
  assert.equal(stored.session?.candidate, undefined);
  assert.equal(stored.session?.revision, prepared.revision);
  for (const evidencePath of ["../outside.md", "/etc/passwd", researchPath, ".blueprint/STATE.md"]) {
    const result = await blueprintResearchPrepare({ ...lookup(cwd), evidencePaths: [evidencePath] });
    assert.equal(result.status, "blocked", `${evidencePath}: ${JSON.stringify(result)}`);
  }
});

test("publication preserves checkpoints owned by another workflow", async t => {
  const cwd = await fixture(t);
  const checkpoint = { schemaVersion: 2, ownerCommand: "/blu-discuss-phase", mode: "discuss", progress: {}, areaQueue: [], carryForward: { question: "Keep the pending discussion answer." }, readSet: [] };
  await blueprintPhaseCheckpointPut({ ...lookup(cwd), checkpoint });
  const prepared = await prepare(cwd);
  const published = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "foreign-checkpoint", expectedRevision: prepared.revision, candidate: candidate() }) as Record<string, unknown>;
  assert.equal(published.status, "published", JSON.stringify(published));
  assert.deepEqual((await blueprintPhaseCheckpointGet(lookup(cwd))).checkpoint, checkpoint);
  assert.ok((published.warnings as string[]).some(warning => /owner|belongs|mismatch/i.test(warning)), JSON.stringify(published.warnings));
});

for (const stage of ["artifactWrite", "writeText", "stateUpdate", "stateLoad", "checkpointDelete"] as const) {
  test(`an interruption after ${stage} resumes from the journal with identical submission arguments`, async t => {
    const cwd = await fixture(t);
    const prepared = await prepare(cwd);
    const args = { ...lookup(cwd), requestId: `interrupted-${stage}`, expectedRevision: prepared.revision, candidate: candidate() };
    const original = researchSubmitDependencies[stage];
    // The injected failure happens after the owning operation succeeds, like a
    // process interruption before its successful result can be checkpointed.
    const fault = t.mock.method(researchSubmitDependencies, stage, async (...args: unknown[]) => {
      await (original as (...args: unknown[]) => Promise<unknown>)(...args);
      throw new Error(`Injected interruption after ${stage}`);
    });
    const interrupted = await blueprintResearchSubmit(args) as Record<string, unknown>;
    fault.mock.restore();
    assert.equal(interrupted.status, "partial", JSON.stringify(interrupted));
    assert.match(String(interrupted.reason), /Injected interruption/);
    assert.equal(interrupted.saved, true);
    const pending = await blueprintResearchRead(lookup(cwd));
    assert.deepEqual(pending.session?.candidate, args.candidate);
    assert.equal(pending.session?.journal?.requestId, args.requestId);
    const artifactBefore = await readFile(path.join(cwd, researchPath), "utf8");
    const resumed = await blueprintResearchSubmit(args) as Record<string, unknown>;
    assert.equal(resumed.status, "published", JSON.stringify(resumed));
    assert.equal(await readFile(path.join(cwd, researchPath), "utf8"), artifactBefore);
    assert.deepEqual(await blueprintResearchSubmit(args), resumed);
    const saved = await blueprintResearchRead(lookup(cwd));
    assert.equal(saved.session?.revision, prepared.revision + 1);
    assert.equal(saved.session?.history.filter(entry => entry.kind === "submit").length, 1);
    assert.deepEqual(saved.session?.journal?.receipt, resumed);
  });
}

test("concurrent duplicate submissions publish once and return the same durable receipt", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const original = researchSubmitDependencies.artifactWrite;
  const writes = t.mock.method(researchSubmitDependencies, "artifactWrite", original);
  const args = { ...lookup(cwd), requestId: "concurrent", expectedRevision: prepared.revision, candidate: candidate() };
  const results = await Promise.all([blueprintResearchSubmit(args), blueprintResearchSubmit(args)]);
  assert.equal(results[0].status, "published", JSON.stringify(results));
  assert.deepEqual(results[0], results[1]);
  assert.equal(writes.mock.callCount(), 1);
  const saved = await blueprintResearchRead(lookup(cwd));
  assert.equal(saved.session?.revision, prepared.revision + 1);
  const changed = await blueprintResearchSubmit({ ...args, candidate: { ...candidate(), summary: "A different logical request." } });
  assert.equal(changed.status, "rejected");
  assert.deepEqual((await blueprintResearchRead(lookup(cwd))).session?.candidate, args.candidate);
});

for (const mutation of ["replace", "delete"] as const) {
  test(`provenance ${mutation} during cleanup prevents a false publication receipt`, async t => {
    const cwd = await fixture(t);
    const prepared = await prepare(cwd);
    const original = researchSubmitDependencies.checkpointDelete;
    const tamper = t.mock.method(researchSubmitDependencies, "checkpointDelete", async args => {
      const result = await original(args);
      if (mutation === "replace") await writeFile(path.join(cwd, provenancePath), '{"unexpected":"external modification"}\n');
      else await rm(path.join(cwd, provenancePath));
      return result;
    });
    const args = { ...lookup(cwd), requestId: `provenance-${mutation}`, expectedRevision: prepared.revision, candidate: candidate() };
    const result = await blueprintResearchSubmit(args) as Record<string, unknown>;
    tamper.mock.restore();
    assert.equal(result.status, "partial", JSON.stringify(result));
    assert.equal(result.ready, false);
    assert.match(String(result.reason), /provenance changed/i);
    const saved = await blueprintResearchRead(lookup(cwd));
    assert.deepEqual(saved.session?.candidate, args.candidate);
    assert.equal(saved.session?.journal?.receipt, undefined);
    assert.equal((await blueprintResearchSubmit(args)).status, "partial", "Retry must not overwrite externally changed provenance.");
  });
}

test("a 300 KiB research candidate publishes, recovers and reuses beyond the source-packet size limit", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const large = candidate();
  large.summary = "Observed repository evidence supports durable research persistence.\n".repeat(4700);
  assert.ok(Buffer.byteLength(large.summary) > 300 * 1024);
  const original = researchSubmitDependencies.artifactWrite;
  const interruption = t.mock.method(researchSubmitDependencies, "artifactWrite", async args => {
    await original(args);
    throw new Error("Interrupted after publishing the large research artifact.");
  });
  const args = { ...lookup(cwd), requestId: "large-research", expectedRevision: prepared.revision, candidate: large };
  const partial = await blueprintResearchSubmit(args) as Record<string, unknown>;
  interruption.mock.restore();
  assert.equal(partial.status, "partial", JSON.stringify(partial));
  assert.match(String(partial.reason), /Interrupted after publishing/);
  assert.deepEqual((await blueprintResearchRead(lookup(cwd))).session?.candidate, large);
  const published = await blueprintResearchSubmit(args);
  assert.equal(published.status, "published", JSON.stringify(published));
  const content = await readFile(path.join(cwd, researchPath), "utf8");
  assert.ok(Buffer.byteLength(content) > 300 * 1024);
  const rechecked = await prepare(cwd);
  assert.ok("existing" in rechecked && rechecked.existing.freshness?.status === "fresh");
  const reused = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "reuse-large-research", expectedRevision: rechecked.revision, reuse: true });
  assert.equal(reused.status, "reused", JSON.stringify(reused));
  assert.equal(await readFile(path.join(cwd, researchPath), "utf8"), content);
});
