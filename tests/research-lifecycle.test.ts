import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createGitRepo } from "./helpers/git-fixtures.js";
import { validPhaseContextModel } from "./helpers/context-model.js";
import { blueprintConfigSet } from "../src/mcp/tools/config.js";
import { validatePhaseArtifactContent } from "../src/mcp/tools/artifacts.js";
import { blueprintPhaseArtifactRead, blueprintPhaseArtifactWrite } from "../src/mcp/tools/phase-artifacts.js";
import { blueprintPhaseCheckpointGet, blueprintPhaseCheckpointPut } from "../src/mcp/tools/phase-checkpoints.js";
import { blueprintStateLoad } from "../src/mcp/tools/state.js";
import { blueprintPhaseResearchStatus } from "../src/mcp/tools/phase-context-tools.js";
import { executeToolHandlerWithFailureLogging } from "../src/mcp/mutation-failure-logging.js";
import { renderPhaseResearchModelContent, validatePhaseResearchModelInput, type PhaseResearchStructuredModel } from "../src/mcp/tools/phase-research-model.js";
import {
  blueprintResearchPrepare,
  blueprintResearchRead,
  blueprintResearchSubmit,
  researchSubmitDependencies,
  researchToolDefinitions,
} from "../src/mcp/tools/research.js";

const phaseDir = ".blueprint/phases/01-research";
const researchPath = `${phaseDir}/01-RESEARCH.md`;
const contextPath = `${phaseDir}/01-CONTEXT.md`;
const specPath = `${phaseDir}/01-SPEC.md`;
const provenancePath = `${phaseDir}/01-RESEARCH-PROVENANCE.json`;
const sessionPath = `${phaseDir}/01-RESEARCH-SESSION.json`;
const lookup = (cwd: string) => ({ cwd, phase: "1" });

function model(): PhaseResearchStructuredModel {
  return {
    summary: "Research publication marker: preserve the existing core entry point with validated persistence.",
    findings: [{ id: "CLM-001", finding: "The core module exports the integration entry point.", sourceIds: ["SRC-001"], confidence: "HIGH", requirementIds: ["R-1"], status: "supported" }],
    recommendations: [{ id: "REC-001", recommendation: "Extend the existing core entry point with durable persistence.", findingIds: ["CLM-001"], affectedSurfaces: ["src/core.ts"], verification: ["Interrupt publication and verify that retry publishes the exact validated document."], requirementIds: ["R-1"], status: "ready" }],
    openQuestions: [],
    sources: [{ id: "SRC-001", lane: "repo", reference: "src/core.ts:1", excerpt: "export const core = 1;" }],
  };
}

function revision(result: unknown): number {
  assert.ok(result && typeof result === "object" && "revision" in result, JSON.stringify(result));
  assert.equal(typeof result.revision, "number");
  return result.revision as number;
}

function receipt(result: unknown) {
  assert.ok(result && typeof result === "object");
  const { warnings: _warnings, stages: _stages, ...durable } = result as Record<string, unknown>;
  return durable;
}

async function fixture(t: TestContext, options: { context?: boolean; policy?: "off" | "ask" | "auto" } = {}) {
  const cwd = await createGitRepo("research-lifecycle-");
  t.after(() => rm(path.dirname(cwd), { recursive: true, force: true }));
  await mkdir(path.join(cwd, phaseDir), { recursive: true });
  await mkdir(path.join(cwd, "src"), { recursive: true });
  await writeFile(path.join(cwd, "src/core.ts"), "export const core = 1;\n");
  await writeFile(path.join(cwd, ".blueprint/PROJECT.md"), "# Project\n\nDurable research for a small product.\n");
  await writeFile(path.join(cwd, ".blueprint/REQUIREMENTS.md"), "# Requirements\n\n- R-1: Validate research before saving the canonical document.\n");
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

async function metadata(cwd: string, markers: string[] = []) {
  const raw = await readFile(path.join(cwd, sessionPath), "utf8");
  const session = JSON.parse(raw);
  assert.equal(session.version, 2);
  for (const field of ["candidate", "model", "notes", "history", "content"]) assert.equal(Object.hasOwn(session, field), false, field);
  if (session.journal) {
    for (const field of ["content", "candidate", "model", "notes", "history"]) assert.equal(Object.hasOwn(session.journal, field), false, `journal.${field}`);
  }
  for (const marker of markers) assert.equal(raw.includes(marker), false, `Authored content leaked into session: ${marker}`);
  return session;
}

async function assertNoSavedMarker(cwd: string, marker: string) {
  const walk = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(target);
      else if (entry.isFile()) assert.equal((await readFile(target, "utf8")).includes(marker), false, target);
    }
  };
  await walk(path.join(cwd, ".blueprint"));
}

test("prepare provides the complete authoring contract before a representative first submission publishes", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  assert.ok("spec" in prepared && prepared.spec.content === null, "A spec is optional.");
  assert.ok("schema" in prepared && prepared.schema);
  assert.ok("example" in prepared && validatePhaseResearchModelInput(prepared.example).validation.valid);
  assert.ok("grounding" in prepared && JSON.stringify(prepared.grounding).includes("R-1"));
  assert.ok("validationRules" in prepared);
  for (const category of ["reject", "planningOnly", "advisory", "normalize"]) {
    assert.ok(Array.isArray((prepared.validationRules as Record<string, unknown>)[category]), category);
  }
  assert.equal(researchToolDefinitions.some(tool => tool.name === "blueprint_research_record"), false);
  const args = { ...lookup(cwd), requestId: "one-shot", expectedRevision: prepared.revision, model: model() };
  const result = await blueprintResearchSubmit(args) as Record<string, unknown>;
  assert.equal(result.status, "published", JSON.stringify(result));
  assert.equal(result.saved, true);
  assert.equal(result.planningReady, true);
  assert.equal(result.ready, true);
  assert.equal(result.path, researchPath);
  assert.deepEqual(result.stages, { artifact: "complete", provenance: "complete", state: "complete", routing: "complete", cleanup: "complete" });
  const downstream = await blueprintPhaseArtifactRead({ ...lookup(cwd), artifact: "research" });
  assert.equal(downstream.found, true);
  assert.equal(validatePhaseArtifactContent(downstream.content!, "research").valid, true);
  assert.match(downstream.content!, /Research publication marker/);
  assert.match(downstream.content!, /Validate research before saving the canonical document/);
  assert.match(downstream.content!, /Structured phase.context models are the semantic source of truth/);
  assert.match(downstream.content!, /Do not mutate host-global Blueprint state/);
  assert.match(downstream.content!, /Preserve customer data across all retries/);
  const provenance = JSON.parse(await readFile(path.join(cwd, provenancePath), "utf8"));
  assert.ok(provenance.readSet.some((entry: { path: string }) => entry.path === "src/core.ts"));
  const state = await blueprintStateLoad({ cwd });
  assert.equal(state.state.currentPhase, "1");
  assert.match(await readFile(path.join(cwd, ".blueprint/STATE.md"), "utf8"), /- Active command: \/blu-research-phase/);
  assert.equal(result.nextAction, state.derivedStatus.nextAction);
  assert.deepEqual(receipt(await blueprintResearchSubmit(args)), receipt(result));
  const read = await blueprintResearchRead(lookup(cwd));
  assert.equal(read.published.content, downstream.content);
  assert.equal(read.session?.revision, prepared.revision + 1);
  const session = await metadata(cwd, [args.model.summary]);
  assert.deepEqual(read.session, session);
});

for (const invalid of ["malformed-json", "schema", "source-link"] as const) {
  test(`${invalid} rejection saves no body and corrected input can reuse the request ID and revision`, async t => {
    const cwd = await fixture(t);
    const prepared = await prepare(cwd);
    const marker = `Rejected confidential research ${invalid}`;
    const input = invalid === "malformed-json" ? `{"summary":"${marker}","findings":[` : { ...model(), summary: marker, ...(invalid === "schema" ? { unexpected: "invalid field" } : { findings: [{ ...model().findings[0], sourceIds: ["SRC-MISSING"] }] }) };
    const before = await readFile(path.join(cwd, sessionPath), "utf8");
    const args = { ...lookup(cwd), requestId: "correctable", expectedRevision: prepared.revision, model: input };
    const rejected = await blueprintResearchSubmit(args) as Record<string, unknown>;
    assert.equal(rejected.status, "needs_revision", JSON.stringify(rejected));
    assert.equal(rejected.saved, false);
    assert.equal(rejected.ready, false);
    assert.equal(rejected.outcome, "rejected-not-saved");
    assert.equal(revision(rejected), prepared.revision);
    assert.equal(await readFile(path.join(cwd, sessionPath), "utf8"), before);
    await assertNoSavedMarker(cwd, marker);
    assert.equal((await blueprintPhaseArtifactRead({ ...lookup(cwd), artifact: "research" })).found, false);
    const corrected = await blueprintResearchSubmit({ ...args, model: model() });
    assert.equal(corrected.status, "published", JSON.stringify(corrected));
  });
}

test("mutation failure telemetry records diagnostics without retaining rejected model text", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const marker = "Unpublished private research telemetry marker";
  const definition = researchToolDefinitions.find(tool => tool.name === "blueprint_research_submit")!;
  const result = await executeToolHandlerWithFailureLogging(definition, { ...lookup(cwd), requestId: "rejected-log", expectedRevision: prepared.revision, model: { ...model(), summary: marker, unexpected: true } });
  assert.equal(result.status, "needs_revision");
  const failureLog = await readFile(path.join(cwd, ".blueprint/mcp-write-failures.ndjson"), "utf8");
  assert.match(failureLog, /blueprint_research_submit/);
  assert.equal(failureLog.includes(marker), false);
  assert.equal(failureLog.includes(model().findings[0].finding), false);
  await assertNoSavedMarker(cwd, marker);
});

test("candidate remains a compatibility alias that publishes without creating a draft store", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const result = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "legacy-client", expectedRevision: prepared.revision, candidate: model() });
  assert.equal(result.status, "published", JSON.stringify(result));
  await metadata(cwd, [model().summary]);
});

test("ordinary first-attempt formatting variations publish after deterministic in-memory normalization", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const input = {
    ...model(),
    summary: `  ${model().summary}  `,
    openQuestions: "No open questions",
    sources: [{ ...model().sources[0], lane: "repository", title: "" }],
    findings: [{ ...model().findings[0], confidence: "high", status: "directly supported", sourceIds: "SRC-001", requirementIds: "R-1" }],
    recommendations: [{ ...model().recommendations[0], status: "planning ready", findingIds: "CLM-001", requirementIds: "R-1", affectedSurfaces: "src/core.ts", verification: null }],
    sections: { codeExamples: "```ts\nexport const core = 1;\n```", commonPitfalls: null },
  };
  const result = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "natural-format", expectedRevision: prepared.revision, model: JSON.stringify(input) }) as Record<string, unknown>;
  assert.equal(result.status, "published", JSON.stringify(result));
  assert.equal(result.planningReady, true);
  const published = await readFile(path.join(cwd, researchPath), "utf8");
  assert.equal(validatePhaseArtifactContent(published, "research").valid, true);
  assert.match(published, /\| CLM-001 \|[^\n]+\| supported \| HIGH \| SRC-001 \|/);
  assert.doesNotMatch(published, /No open questions|directly supported|planning ready/);
  await metadata(cwd, [model().summary]);
});

test("reserved request IDs and stale revisions cannot poison session metadata", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  for (const requestId of ["constructor", "prototype", "__proto__"]) await assert.rejects(blueprintResearchSubmit({ ...lookup(cwd), requestId, expectedRevision: prepared.revision, model: model() }));
  const before = await readFile(path.join(cwd, sessionPath), "utf8");
  const stale = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "stale", expectedRevision: prepared.revision - 1, model: model() }) as Record<string, unknown>;
  assert.equal(stale.status, "stale");
  assert.equal(stale.saved, false);
  assert.equal(await readFile(path.join(cwd, sessionPath), "utf8"), before);
});

test("missing context blocks publication without persisting the rejected document", async t => {
  const cwd = await fixture(t, { context: false });
  const prepared = await blueprintResearchPrepare({ ...lookup(cwd), evidencePaths: ["src/core.ts"] });
  assert.equal(prepared.status, "blocked");
  const result = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "missing-context", expectedRevision: revision(prepared), model: model() }) as Record<string, unknown>;
  assert.equal(result.status, "needs_revision");
  assert.equal(result.saved, false);
  await assertNoSavedMarker(cwd, model().summary);
});

for (const policy of ["off", "ask", "auto"] as const) {
  test(`external source policy ${policy} is checked before saving research`, async t => {
    const cwd = await fixture(t, { policy });
    const prepared = await prepare(cwd);
    const external = model();
    external.sources[0] = { id: "SRC-001", lane: "external", reference: "https://example.org/official-api", excerpt: "The public API supports a durable persistence extension." };
    const args = { ...lookup(cwd), requestId: "external", expectedRevision: prepared.revision, model: external, ...(policy === "off" ? { externalSourcesApproved: true } : {}) };
    const result = await blueprintResearchSubmit(args) as Record<string, unknown>;
    if (policy === "auto") assert.equal(result.status, "published", JSON.stringify(result));
    else {
      assert.equal(result.status, "needs_revision", JSON.stringify(result));
      assert.equal(result.saved, false);
      assert.equal(revision(result), prepared.revision);
      await assertNoSavedMarker(cwd, external.summary);
      if (policy === "ask") {
        const approved = await blueprintResearchSubmit({ ...args, externalSourcesApproved: true });
        assert.equal(approved.status, "published", JSON.stringify(approved));
      }
    }
  });
}

test("repository references must be captured before submission and can be added without consuming the rejected request", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd, []);
  const args = { ...lookup(cwd), requestId: "unread-source", expectedRevision: prepared.revision, model: model() };
  const missing = await blueprintResearchSubmit(args) as Record<string, unknown>;
  assert.equal(missing.status, "needs_revision");
  assert.equal(missing.saved, false);
  assert.deepEqual(missing.missingEvidencePaths, ["src/core.ts"]);
  await assertNoSavedMarker(cwd, args.model.summary);
  const captured = await prepare(cwd);
  assert.equal((await blueprintResearchSubmit({ ...args, expectedRevision: captured.revision })).status, "published");
});

test("prior-phase research supports normalized relative source paths while self-reference is rejected", async t => {
  const cwd = await fixture(t);
  const priorPath = ".blueprint/phases/00-foundation/00-RESEARCH.md";
  await mkdir(path.dirname(path.join(cwd, priorPath)), { recursive: true });
  await writeFile(path.join(cwd, priorPath), "# Prior research\n\nThe core module is the integration entry point.\n");
  const prepared = await prepare(cwd, [`./${priorPath}`]);
  const input = model();
  input.sources[0].reference = priorPath;
  assert.equal((await blueprintResearchSubmit({ ...lookup(cwd), requestId: "prior-research", expectedRevision: prepared.revision, model: input })).status, "published");
  assert.equal((await blueprintResearchPrepare({ ...lookup(cwd), evidencePaths: [`./${researchPath}`] })).status, "blocked");
});

for (const input of ["source", "context", "optional-spec", "effective-config", "codebase-summary"] as const) {
  test(`changed ${input} input rejects publication without retaining the model`, async t => {
    const cwd = await fixture(t);
    const prepared = await prepare(cwd);
    if (input === "source") await writeFile(path.join(cwd, "src/core.ts"), "export const core = 2;\n");
    else if (input === "context") {
      const result = await blueprintPhaseArtifactWrite({ ...lookup(cwd), artifact: "context", overwrite: true, model: validPhaseContextModel({ phaseLabel: "phase 1", decision: "Add a requirement to preserve source provenance.", openQuestions: [], deferredIdeas: [] }) });
      assert.notEqual(result.status, "invalid");
    } else if (input === "optional-spec") await writeFile(path.join(cwd, specPath), "# Newly supplied specification\nReview before publishing.\n");
    else if (input === "effective-config") await blueprintConfigSet({ cwd, patch: { research: { external_sources: "ask" } } });
    else {
      await mkdir(path.join(cwd, ".blueprint/codebase"), { recursive: true });
      await writeFile(path.join(cwd, ".blueprint/codebase/ARCHITECTURE.md"), "# Architecture\n\nA new module boundary needs review.\n");
    }
    const args = { ...lookup(cwd), requestId: "changed-input", expectedRevision: prepared.revision, model: model() };
    const result = await blueprintResearchSubmit(args) as Record<string, unknown>;
    assert.equal(result.status, "needs_revision", JSON.stringify(result));
    assert.equal(result.saved, false);
    assert.equal((result.freshness as { status: string }).status, "stale");
    assert.equal((await metadata(cwd)).revision, prepared.revision);
    await assertNoSavedMarker(cwd, args.model.summary);
    if (input === "source") {
      assert.equal((await blueprintResearchPrepare(lookup(cwd))).status, "stale");
      const refreshed = await blueprintResearchPrepare({ ...lookup(cwd), expectedRevision: prepared.revision, acknowledgeChangedInputs: true });
      assert.equal(refreshed.status, "prepared", JSON.stringify(refreshed));
      args.model.sources[0].excerpt = "export const core = 2;";
      assert.equal((await blueprintResearchSubmit({ ...args, expectedRevision: revision(refreshed) })).status, "published");
    }
  });
}

test("fresh research reuse preserves the original document and source provenance", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  assert.equal((await blueprintResearchSubmit({ ...lookup(cwd), requestId: "initial", expectedRevision: prepared.revision, model: model() })).status, "published");
  const content = await readFile(path.join(cwd, researchPath), "utf8");
  const provenance = await readFile(path.join(cwd, provenancePath), "utf8");
  const rechecked = await prepare(cwd);
  const reused = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "reuse", expectedRevision: rechecked.revision, reuse: true });
  assert.equal(reused.status, "reused", JSON.stringify(reused));
  assert.equal(await readFile(path.join(cwd, researchPath), "utf8"), content);
  assert.equal(await readFile(path.join(cwd, provenancePath), "utf8"), provenance);
});

test("legacy research without provenance cannot be reused merely because its Markdown validates", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  assert.equal((await blueprintResearchSubmit({ ...lookup(cwd), requestId: "initial", expectedRevision: prepared.revision, model: model() })).status, "published");
  const content = await readFile(path.join(cwd, researchPath), "utf8");
  await rm(path.join(cwd, provenancePath));
  await rm(path.join(cwd, sessionPath));
  const legacy = await prepare(cwd);
  const result = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "legacy-reuse", expectedRevision: legacy.revision, reuse: true }) as Record<string, unknown>;
  assert.equal(result.status, "needs_revision", JSON.stringify(result));
  assert.equal(result.saved, false);
  assert.equal(await readFile(path.join(cwd, researchPath), "utf8"), content);
});

test("refreshing preparation never rebases stale published research into reusable evidence", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const published = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "initial", expectedRevision: prepared.revision, model: model() });
  assert.equal(published.status, "published", JSON.stringify(published));
  const provenance = await readFile(path.join(cwd, provenancePath), "utf8");
  await writeFile(path.join(cwd, "src/core.ts"), "export const core = 3;\n");
  const refreshed = await blueprintResearchPrepare({ ...lookup(cwd), expectedRevision: revision(published), acknowledgeChangedInputs: true });
  assert.equal(refreshed.status, "prepared", JSON.stringify(refreshed));
  const reused = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "stale-reuse", expectedRevision: revision(refreshed), reuse: true }) as Record<string, unknown>;
  assert.equal(reused.status, "needs_revision", JSON.stringify(reused));
  assert.equal(reused.saved, false);
  assert.equal(await readFile(path.join(cwd, provenancePath), "utf8"), provenance);
});

test("an unapproved update saves nothing and the same request can succeed after overwrite authorization", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const initial = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "initial", expectedRevision: prepared.revision, model: model() });
  assert.equal(initial.status, "published", JSON.stringify(initial));
  const content = await readFile(path.join(cwd, researchPath), "utf8");
  const updated = { ...model(), summary: "Unapproved update marker: add a source-specific recovery check." };
  const args = { ...lookup(cwd), requestId: "update", expectedRevision: revision(initial), model: updated };
  const result = await blueprintResearchSubmit(args) as Record<string, unknown>;
  assert.equal(result.status, "needs_revision", JSON.stringify(result));
  assert.equal(result.saved, false);
  assert.equal(revision(result), revision(initial));
  assert.equal(await readFile(path.join(cwd, researchPath), "utf8"), content);
  await assertNoSavedMarker(cwd, updated.summary);
  const authorized = await blueprintResearchSubmit({ ...args, overwrite: true });
  assert.equal(authorized.status, "published", JSON.stringify(authorized));
  assert.match(await readFile(path.join(cwd, researchPath), "utf8"), /Unapproved update marker/);
});

test("external target changes require reviewed reconciliation even with overwrite authorization", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const external = "# External research\n\nKeep this independently authored document.\n";
  await writeFile(path.join(cwd, researchPath), external);
  const args = { ...lookup(cwd), requestId: "conflict", expectedRevision: prepared.revision, model: model(), overwrite: true };
  const blocked = await blueprintResearchSubmit(args) as Record<string, unknown>;
  assert.equal(blocked.status, "stale", JSON.stringify(blocked));
  assert.equal(blocked.saved, false);
  assert.equal(await readFile(path.join(cwd, researchPath), "utf8"), external);
  await assertNoSavedMarker(cwd, args.model.summary);
  const observed = await blueprintResearchPrepare(lookup(cwd));
  assert.equal(observed.status, "reconciliation_required");
  assert.ok("existing" in observed);
  const reconciled = await blueprintResearchPrepare({ ...lookup(cwd), expectedRevision: revision(observed), reconcile: { confirmed: true, researchHash: observed.existing.hash } });
  assert.equal(reconciled.status, "prepared", JSON.stringify(reconciled));
  assert.equal((await blueprintResearchSubmit({ ...args, expectedRevision: revision(reconciled) })).status, "published");
});

test("unsafe model keys, excessive bodies and paths are rejected without creating authored state", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  for (const unsafe of [JSON.parse('{"__proto__":{"polluted":true}}'), { constructor: "bad" }, "x".repeat(1024 * 1024 + 1)]) {
    await assert.rejects(blueprintResearchSubmit({ ...lookup(cwd), requestId: "unsafe", expectedRevision: prepared.revision, model: unsafe }), /Unsafe|1 MiB/);
  }
  assert.equal((await metadata(cwd)).revision, prepared.revision);
  for (const evidencePath of ["../outside.md", "/etc/passwd", researchPath, ".blueprint/STATE.md"]) assert.equal((await blueprintResearchPrepare({ ...lookup(cwd), evidencePaths: [evidencePath] })).status, "blocked", evidencePath);
});

test("publication preserves a checkpoint belonging to another workflow", async t => {
  const cwd = await fixture(t);
  const checkpoint = { schemaVersion: 2, ownerCommand: "/blu-discuss-phase", mode: "discuss", progress: {}, areaQueue: [], carryForward: { question: "Keep the pending discussion answer." }, readSet: [] };
  await blueprintPhaseCheckpointPut({ ...lookup(cwd), checkpoint });
  const prepared = await prepare(cwd);
  const published = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "foreign-checkpoint", expectedRevision: prepared.revision, model: model() }) as Record<string, unknown>;
  assert.equal(published.status, "published", JSON.stringify(published));
  assert.deepEqual((await blueprintPhaseCheckpointGet(lookup(cwd))).checkpoint, checkpoint);
  assert.ok((published.warnings as string[]).some(warning => /owner|belongs|mismatch/i.test(warning)));
});

test("an I/O failure before the canonical write stores only metadata and retry must resend the validated model", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const args = { ...lookup(cwd), requestId: "before-artifact", expectedRevision: prepared.revision, model: model() };
  const fault = t.mock.method(researchSubmitDependencies, "artifactWrite", async () => { throw new Error("Injected failure before artifact publication"); });
  const failed = await blueprintResearchSubmit(args) as Record<string, unknown>;
  fault.mock.restore();
  assert.equal(failed.status, "partial", JSON.stringify(failed));
  assert.equal(failed.saved, false);
  assert.equal((await blueprintPhaseArtifactRead({ ...lookup(cwd), artifact: "research" })).found, false);
  await assertNoSavedMarker(cwd, args.model.summary);
  const session = await metadata(cwd, [args.model.summary]);
  assert.equal(session.journal.requestId, args.requestId);
  const { model: _model, ...withoutModel } = args;
  const missing = await blueprintResearchSubmit(withoutModel) as Record<string, unknown>;
  assert.notEqual(missing.status, "published");
  assert.equal(missing.saved, false);
  const changed = await blueprintResearchSubmit({ ...args, model: { ...args.model, summary: "Different retry body" } });
  assert.equal(changed.status, "rejected", JSON.stringify(changed));
  const retried = await blueprintResearchSubmit(args);
  assert.equal(retried.status, "published", JSON.stringify(retried));
  assert.equal((await metadata(cwd, [args.model.summary])).revision, prepared.revision + 1);
});

for (const stage of ["artifactWrite", "writeText", "stateUpdate", "stateLoad", "checkpointDelete"] as const) {
  test(`an interruption after ${stage} resumes from exact canonical bytes without resending the model`, async t => {
    const cwd = await fixture(t);
    const prepared = await prepare(cwd);
    const args = { ...lookup(cwd), requestId: `interrupted-${stage}`, expectedRevision: prepared.revision, model: model() };
    const original = researchSubmitDependencies[stage];
    const fault = t.mock.method(researchSubmitDependencies, stage, async (...args: unknown[]) => {
      await (original as (...args: unknown[]) => Promise<unknown>)(...args);
      throw new Error(`Injected interruption after ${stage}`);
    });
    const interrupted = await blueprintResearchSubmit(args) as Record<string, unknown>;
    fault.mock.restore();
    assert.equal(interrupted.status, "partial", JSON.stringify(interrupted));
    assert.match(String(interrupted.reason), /Injected interruption/);
    assert.equal(interrupted.saved, true);
    const content = await readFile(path.join(cwd, researchPath), "utf8");
    const pending = await metadata(cwd, [args.model.summary]);
    assert.equal(pending.journal.requestId, args.requestId);
    const { model: _model, ...withoutModel } = args;
    const resumed = await blueprintResearchSubmit(withoutModel);
    assert.equal(resumed.status, "published", JSON.stringify(resumed));
    assert.equal(await readFile(path.join(cwd, researchPath), "utf8"), content);
    assert.deepEqual(receipt(await blueprintResearchSubmit(args)), receipt(resumed));
    const saved = await metadata(cwd, [args.model.summary]);
    assert.equal(saved.revision, prepared.revision + 1);
    assert.deepEqual(saved.journal.receipt, receipt(resumed));
  });
}

test("concurrent identical submissions publish once and conflicting request bodies cannot replace that publication", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const writes = t.mock.method(researchSubmitDependencies, "artifactWrite", researchSubmitDependencies.artifactWrite);
  const args = { ...lookup(cwd), requestId: "concurrent", expectedRevision: prepared.revision, model: model() };
  const results = await Promise.all([blueprintResearchSubmit(args), blueprintResearchSubmit(args)]);
  assert.equal(results[0].status, "published", JSON.stringify(results));
  assert.deepEqual(receipt(results[0]), receipt(results[1]));
  assert.equal(writes.mock.callCount(), 1);
  const changed = await blueprintResearchSubmit({ ...args, model: { ...args.model, summary: "Conflicting request body" } });
  assert.equal(changed.status, "rejected");
  await assertNoSavedMarker(cwd, "Conflicting request body");
  assert.equal((await metadata(cwd, [args.model.summary])).revision, prepared.revision + 1);
});

for (const mutation of ["replace", "delete"] as const) {
  test(`provenance ${mutation} during cleanup prevents false success`, async t => {
    const cwd = await fixture(t);
    const prepared = await prepare(cwd);
    const original = researchSubmitDependencies.checkpointDelete;
    const tamper = t.mock.method(researchSubmitDependencies, "checkpointDelete", async args => {
      const result = await original(args);
      if (mutation === "replace") await writeFile(path.join(cwd, provenancePath), '{"unexpected":"external modification"}\n');
      else await rm(path.join(cwd, provenancePath));
      return result;
    });
    const args = { ...lookup(cwd), requestId: `provenance-${mutation}`, expectedRevision: prepared.revision, model: model() };
    const result = await blueprintResearchSubmit(args) as Record<string, unknown>;
    tamper.mock.restore();
    assert.equal(result.status, "partial", JSON.stringify(result));
    assert.equal(result.ready, false);
    assert.match(String(result.reason), /provenance changed/i);
    assert.equal((await metadata(cwd, [args.model.summary])).journal.receipt, undefined);
    assert.equal((await blueprintResearchSubmit(args)).status, "partial", "Retry must preserve externally changed provenance.");
  });
}

test("large valid research publishes and retries without copying its body into the session", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const large = model();
  large.summary = "Large publication body marker: observed repository evidence supports validated persistence.\n".repeat(3600);
  assert.ok(Buffer.byteLength(large.summary) > 300 * 1024);
  const original = researchSubmitDependencies.artifactWrite;
  const interruption = t.mock.method(researchSubmitDependencies, "artifactWrite", async args => {
    await original(args);
    throw new Error("Interrupted after publishing the large research artifact.");
  });
  const args = { ...lookup(cwd), requestId: "large-research", expectedRevision: prepared.revision, model: large };
  const partial = await blueprintResearchSubmit(args);
  interruption.mock.restore();
  assert.equal(partial.status, "partial", JSON.stringify(partial));
  await metadata(cwd, ["Large publication body marker"]);
  const { model: _model, ...withoutModel } = args;
  assert.equal((await blueprintResearchSubmit(withoutModel)).status, "published");
  const content = await readFile(path.join(cwd, researchPath), "utf8");
  assert.ok(Buffer.byteLength(content) > 300 * 1024);
  const rechecked = await prepare(cwd);
  assert.equal((await blueprintResearchSubmit({ ...lookup(cwd), requestId: "reuse-large", expectedRevision: rechecked.revision, reuse: true })).status, "reused");
  assert.equal(await readFile(path.join(cwd, researchPath), "utf8"), content);
});

test("a valid report with an explicit open blocker is published while downstream planning remains blocked", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const blocked = model();
  blocked.openQuestions = [{ question: "Which storage provider meets the confirmed retention requirement?", blocking: true }];
  const result = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "honest-blocker", expectedRevision: prepared.revision, model: blocked }) as Record<string, unknown>;
  assert.equal(result.status, "published", JSON.stringify(result));
  assert.equal(result.saved, true);
  assert.equal(result.planningReady, false);
  assert.equal(result.ready, false);
  assert.match(await readFile(path.join(cwd, researchPath), "utf8"), /Which storage provider meets the confirmed retention requirement/);
  const downstream = await blueprintPhaseResearchStatus(lookup(cwd));
  assert.equal(downstream.researchValid, false);
  assert.equal(downstream.planningReadiness.readyForPlanPhase, false);
  assert.ok(downstream.researchDiagnostics.some(entry => entry.code === "research.planning_blocked"), JSON.stringify(downstream));
  assert.doesNotMatch(downstream.planningReadiness.nextSafeAction, /\/blu-plan-phase/);
  await metadata(cwd, [blocked.summary, blocked.openQuestions[0].question]);
});

for (const changedGoal of [false, true]) test(`reading a v1 session removes previously saved drafts with changed roadmap goal=${changedGoal}`, async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const session = JSON.parse(await readFile(path.join(cwd, sessionPath), "utf8"));
  const marker = "Old rejected draft that must disappear during migration";
  await writeFile(path.join(cwd, sessionPath), JSON.stringify({ ...session, version: 1, candidate: { ...model(), summary: marker }, notes: [marker], history: [{ revision: session.revision, kind: "record", candidate: marker }], requests: {} }));
  if (changedGoal) {
    const roadmapPath = path.join(cwd, ".blueprint/ROADMAP.md");
    await writeFile(roadmapPath, (await readFile(roadmapPath, "utf8")).replace("Save durable research.", "Save validated research efficiently."));
  }
  const migrated = await blueprintResearchRead(lookup(cwd));
  assert.equal(migrated.session?.revision, prepared.revision + 1);
  assert.equal(migrated.session?.prepared, false, "Legacy research must bind the current validation contract before publishing.");
  await metadata(cwd, [marker]);
  await assertNoSavedMarker(cwd, marker);
  const refreshed = await prepare(cwd);
  const published = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "after-migration", expectedRevision: refreshed.revision, model: model() });
  assert.equal(published.status, "published", JSON.stringify(published));
});

test("legacy research writes cannot bypass evidence validation with warn mode", async t => {
  const cwd = await fixture(t);
  const broken = model();
  const marker = "Rejected legacy research must never reach canonical storage";
  broken.summary = marker;
  broken.findings[0].sourceIds = ["missing"];
  const content = renderPhaseResearchModelContent({ resolved: { phasePrefix: "01", phaseName: "Research" }, model: broken });
  const result = await blueprintPhaseArtifactWrite({ ...lookup(cwd), artifact: "research", content, validationMode: "warn" });
  assert.equal(result.validation.valid, false);
  assert.equal(result.written, false);
  assert.ok(result.validation.diagnostics.some(entry => entry.code === "research.source_reference_missing"));
  await assert.rejects(readFile(path.join(cwd, researchPath)), { code: "ENOENT" });
  await assertNoSavedMarker(cwd, marker);
});

for (const blocker of ["question", "recommendation"] as const) test(`legacy research saves a ${blocker} blocker while preventing planning`, async t => {
  const cwd = await fixture(t);
  const blocked = model();
  if (blocker === "question") blocked.openQuestions = [{ question: "Which retention guarantee is required?", blocking: true }];
  else blocked.recommendations[0].status = "blocked";
  const content = renderPhaseResearchModelContent({ resolved: { phasePrefix: "01", phaseName: "Research" }, model: blocked });
  const written = await blueprintPhaseArtifactWrite({ ...lookup(cwd), artifact: "research", content });
  assert.equal(written.written, true, JSON.stringify(written));
  assert.equal(written.validation.valid, true);
  const status = await blueprintPhaseResearchStatus(lookup(cwd));
  assert.equal(status.researchValid, false, JSON.stringify(status));
  assert.equal(status.planningReadiness.readyForPlanPhase, false);
  assert.ok(status.researchDiagnostics.some(entry => entry.code === "research.planning_blocked"));
});

test("v1 migration strips journal bodies and old drafts without changing committed canonical research", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const result = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "committed", expectedRevision: prepared.revision, model: model() });
  assert.equal(result.status, "published", JSON.stringify(result));
  const content = await readFile(path.join(cwd, researchPath), "utf8");
  const provenance = await readFile(path.join(cwd, provenancePath), "utf8");
  const session = JSON.parse(await readFile(path.join(cwd, sessionPath), "utf8"));
  const marker = "Old rejected private draft adjacent to committed research";
  await writeFile(path.join(cwd, sessionPath), JSON.stringify({ ...session, version: 1, candidate: marker, notes: [marker], history: [{ revision: 0, kind: "record", candidate: marker, journal: { ...session.journal, content: marker } }], journal: { ...session.journal, content, provenance } }));
  const migrated = await blueprintResearchRead(lookup(cwd));
  assert.equal(migrated.published.content, content);
  await metadata(cwd, [marker, model().summary]);
  assert.equal(await readFile(path.join(cwd, researchPath), "utf8"), content);
  assert.equal(await readFile(path.join(cwd, provenancePath), "utf8"), provenance);
  await assertNoSavedMarker(cwd, marker);
});

test("v1 migration keeps incomplete canonical publication blocked after discarding the old body journal", async t => {
  const cwd = await fixture(t);
  const prepared = await prepare(cwd);
  const original = researchSubmitDependencies.artifactWrite;
  const interruption = t.mock.method(researchSubmitDependencies, "artifactWrite", async args => {
    await original(args);
    throw new Error("Interrupted after canonical write and before provenance.");
  });
  const result = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "old-partial", expectedRevision: prepared.revision, model: model() });
  interruption.mock.restore();
  assert.equal(result.status, "partial", JSON.stringify(result));
  const content = await readFile(path.join(cwd, researchPath), "utf8");
  const session = JSON.parse(await readFile(path.join(cwd, sessionPath), "utf8"));
  await writeFile(path.join(cwd, sessionPath), JSON.stringify({ ...session, version: 1, candidate: model(), notes: [], history: [], journal: { ...session.journal, content } }));
  await blueprintResearchRead(lookup(cwd));
  const migrated = await metadata(cwd, [model().summary]);
  assert.equal(migrated.legacyPublication.contentHash, session.journal.contentHash);
  assert.equal(migrated.journal, undefined);
  const status = await blueprintPhaseResearchStatus(lookup(cwd));
  assert.equal(status.researchValid, false, JSON.stringify(status));
  assert.equal(status.planningReadiness.readyForPlanPhase, false);
  assert.ok(status.researchDiagnostics.some(entry => entry.code === "research.inputs_stale"), JSON.stringify(status.researchDiagnostics));
  const refreshed = await prepare(cwd);
  const reused = await blueprintResearchSubmit({ ...lookup(cwd), requestId: "unsafe-legacy-reuse", expectedRevision: refreshed.revision, reuse: true });
  assert.equal(reused.status, "needs_revision", JSON.stringify(reused));
  assert.equal(await readFile(path.join(cwd, researchPath), "utf8"), content);
});
