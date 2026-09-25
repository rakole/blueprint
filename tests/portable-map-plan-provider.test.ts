import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {promises as fs} from "node:fs";
import path from "node:path";

import {createGitRepo} from "./helpers/git-fixtures.js";
import {validPhaseContextModel} from "./helpers/context-model.js";
import {CODEBASE_DOCUMENT_IDS} from "../src/mcp/codebase-authoring.js";
import {validatePortableMapModel, type PortableAuthoritativeSourceBasis} from "../src/mcp/codebase-index/model-validation.js";
import {renderPortableMap} from "../src/mcp/codebase-index/render.js";
import {blueprintConfigSet} from "../src/mcp/tools/config.js";
import {blueprintPhaseArtifactWrite} from "../src/mcp/tools/phase-artifacts.js";
import {blueprintPlanPrepare, blueprintPlanRead, blueprintPlanSubmit} from "../src/mcp/tools/plan.js";
import {
  countPublicString,
  createProviderFixture,
  installProviderSuccessor,
  installSqlPortableMap,
  projectCitationResearchModel,
  providerLookup,
  providerPlanModel,
} from "./helpers/portable-provider-fixture.js";
import {blueprintResearchPrepare, blueprintResearchSubmit} from "../src/mcp/tools/research.js";

const source = "export function entry() { return \"entry\"; }\n";
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const phaseDir = ".blueprint/phases/01-plan";
const lookup = (cwd: string) => ({cwd, phase: "1"});

function mapFixture() {
  const bytes = new TextEncoder().encode(source);
  const fileHash = hash(bytes);
  const coordinate = {start: {line: 1, column: 0, byte: 0}, end: {line: 1, column: 23, byte: 23}};
  const rangeHash = hash(bytes.slice(0, 23));
  const files = [{id: "file_entry", path: "src/entry.ts", language: "typescript" as const, role: "source" as const, byteSize: bytes.byteLength, contentHash: fileHash, parseStatus: "parsed" as const, coverageStatus: "full" as const}];
  const symbols = [{id: "symbol_entry", fileId: "file_entry", path: "src/entry.ts", qualifiedName: "entry", kind: "function" as const, signature: "function entry()", coordinate, contentHash: rangeHash, lexicalParentId: null, exported: true}];
  const evidence = [{kind: "symbol" as const, path: "src/entry.ts", recordId: "symbol_entry", contentHash: rangeHash, coordinate}];
  const documents = Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, {summary: `${id} summary`, sections: [{heading: "Observed", content: "The selected entry is source-backed."}], evidencePaths: ["src/entry.ts"]}]));
  const model = {formatVersion: 1 as const, generationId: "generation_plan", documents,
    semantic: {capabilities: [{id: "cap_entry", name: "Entry", summary: "Entry capability.", claimIds: ["claim_entry"], evidence}], claims: [{id: "claim_entry", basis: "observed" as const, statement: "The entry function is exported.", evidence}], aliases: [{id: "alias_entry", alias: "start entry", targetKind: "capability" as const, targetId: "cap_entry", evidence: [{kind: "file" as const, path: "src/entry.ts", recordId: "file_entry", contentHash: fileHash}]}]}};
  const basis: PortableAuthoritativeSourceBasis = {generationId: "generation_plan", files: [{path: "src/entry.ts", byteSize: bytes.byteLength, contentHash: fileHash}], records: [{kind: "file", recordId: "file_entry", path: "src/entry.ts", contentHash: fileHash}, {kind: "symbol", recordId: "symbol_entry", path: "src/entry.ts", contentHash: rangeHash, coordinate}]};
  const checked = validatePortableMapModel([{generationId: "generation_plan", shardId: "source", files, symbols, imports: [], relationships: []}], model, basis);
  assert.equal(checked.ok, true, checked.ok ? undefined : JSON.stringify(checked.diagnostics));
  if (!checked.ok) throw new Error("plan portable map fixture did not validate");
  const rendered = renderPortableMap(checked.data, {generationId: "generation_plan", generatedAt: "2026-09-24T00:00:00.000Z", gitCommit: null, inventoryFingerprint: hash("plan-inventory"), parserAssets: []});
  assert.equal(rendered.ok, true, rendered.ok ? undefined : JSON.stringify(rendered.diagnostics));
  if (!rendered.ok) throw new Error("plan portable map fixture did not render");
  return {rendered, fileHash};
}

async function fixture(): Promise<{root: string; selection: {kind: "symbol"; recordId: string}; cleanup: () => Promise<void>}> {
  const root = await createGitRepo("portable-plan-provider-");
  const built = mapFixture();
  for (const [relative, bytes] of Object.entries(built.rendered.files)) {
    if (/^(?:ARCHITECTURE|STRUCTURE|STACK|INTEGRATIONS|CONVENTIONS|TESTING|CONCERNS)\.md$/.test(relative)) continue;
    const target = path.join(root, ".blueprint", "codebase", relative);
    await fs.mkdir(path.dirname(target), {recursive: true});
    await fs.writeFile(target, bytes);
  }
  await fs.mkdir(path.join(root, "src"), {recursive: true});
  await fs.writeFile(path.join(root, "src", "entry.ts"), source);
  await fs.writeFile(path.join(root, ".blueprint", "PROJECT.md"), "# Portable plan fixture\n\nPreserve selected source evidence.\n");
  await fs.writeFile(path.join(root, ".blueprint", "REQUIREMENTS.md"), "# Requirements\n\n- R-1: Preserve source freshness.\n");
  await fs.writeFile(path.join(root, ".blueprint", "ROADMAP.md"), "# Roadmap\n\n## Phases\n\n- [ ] **Phase 1: Plan** - Preserve selected evidence\n\n## Phase Details\n\n### Phase 1: Plan\n**Goal**: Preserve selected evidence.\n**Requirements**: R-1\n**Success Criteria**:\n1. Changed source becomes stale.\n");
  await fs.mkdir(path.join(root, phaseDir), {recursive: true});
  await blueprintConfigSet({cwd: root, patch: {workflow: {research: false, ui_phase: false, plan_check: false}, research: {external_sources: "off"}}});
  const context = await blueprintPhaseArtifactWrite({...lookup(root), artifact: "context", model: validPhaseContextModel({phaseLabel: "phase 1", openQuestions: [], deferredIdeas: [], externalConstraints: ["Preserve selected source freshness."]})});
  assert.notEqual(context.status, "invalid", JSON.stringify(context));
  return {root, selection: {kind: "symbol", recordId: "symbol_entry"}, cleanup: () => fs.rm(path.dirname(root), {recursive: true, force: true})};
}

function planModel() {
  return {plans: [{key: "entry", title: "Preserve entry behavior", goal: "Keep the inspected entry source behavior while validating freshness.", scope: ["Update src/entry.ts and its freshness checks."], dependsOn: [], tasks: [{id: "T1", title: "Verify entry evidence", readFirst: ["src/entry.ts"], filesModified: ["src/entry.ts"], requirements: ["R-1"], action: ["Preserve the entry function in src/entry.ts."], acceptanceCriteria: ["src/entry.ts still exports entry.", "Changed source becomes stale."]}], mustHaves: ["Source changes cannot be represented as unchanged evidence."]}]};
}

test("plan portable provider keeps ENTRY separate, supports delivery modes, and publishes", async () => {
  const state = await fixture();
  try {
    const full: any = await blueprintPlanPrepare({...lookup(state.root), evidencePaths: ["src/entry.ts"], portableSelections: [state.selection]});
    assert.equal(full.status, "prepared", JSON.stringify(full));
    assert.equal(full.portable.packet.entries.filter((entry: any) => entry.content !== undefined && entry.path.endsWith("/ENTRY.md")).length, 1);
    assert.equal(full.evidence.some((entry: any) => entry.path.endsWith("/ENTRY.md")), false);
    const delta: any = await blueprintPlanPrepare({...lookup(state.root), evidencePaths: ["src/entry.ts"], portableSelections: [state.selection], expectedRevision: full.revision, evidenceDelivery: {mode: "delta"}});
    assert.equal(delta.status, "prepared", JSON.stringify(delta));
    assert.equal(delta.portable.packet.entries.every((entry: any) => entry.content === undefined), true);
    assert.equal(delta.evidence.find((entry: any) => entry.path === "src/entry.ts")?.content, undefined);
    const registered: any = await blueprintPlanPrepare({...lookup(state.root), evidencePaths: ["src/entry.ts"], portableSelections: [state.selection], expectedRevision: delta.revision, evidenceDelivery: {mode: "register"}});
    assert.equal(registered.status, "prepared", JSON.stringify(registered));
    assert.equal(registered.portable.packet.entries.every((entry: any) => entry.content === undefined), true);
    const read: any = await blueprintPlanRead(lookup(state.root));
    assert.equal(read.freshness.status, "fresh", JSON.stringify(read));
    const sessionText = await fs.readFile(path.join(state.root, phaseDir, "01-PLAN-SESSION.json"), "utf8");
    assert.doesNotMatch(sessionText, /# Portable Codebase Map Entry/);
    assert.doesNotMatch(sessionText, /export function entry/);
    const published: any = await blueprintPlanSubmit({...lookup(state.root), requestId: "portable-plan", expectedRevision: registered.revision, model: planModel()});
    assert.equal(published.status, "published", JSON.stringify(published));
  } finally { await state.cleanup(); }
});

test("plan ordinary evidence delivery works without a map", async () => {
  const state = await fixture();
  try {
    await fs.rm(path.join(state.root, ".blueprint", "codebase"), {recursive: true, force: true});
    const full: any = await blueprintPlanPrepare({...lookup(state.root), evidencePaths: ["src/entry.ts"], evidenceDelivery: {mode: "full"}});
    assert.equal(full.status, "prepared", JSON.stringify(full));
    assert.equal(full.evidence.find((entry: any) => entry.path === "src/entry.ts")?.content, source);
    const delta: any = await blueprintPlanPrepare({...lookup(state.root), evidencePaths: ["src/entry.ts"], expectedRevision: full.revision, evidenceDelivery: {mode: "delta"}});
    assert.equal(delta.status, "prepared", JSON.stringify(delta));
    assert.equal(delta.evidence.find((entry: any) => entry.path === "src/entry.ts")?.content, undefined);
    const wrong: any = await blueprintPlanPrepare({...lookup(state.root), evidencePaths: ["src/entry.ts"], expectedRevision: delta.revision, evidenceDelivery: {mode: "register", readTimeEvidence: [{path: "src/entry.ts", bytes: "different", hash: hash(source)}]}});
    assert.notEqual(wrong.status, "prepared", JSON.stringify(wrong));
  } finally { await state.cleanup(); }
});

test("plan keeps portable range dependencies private until an ordinary file is selected", async () => {
  const state = await fixture();
  try {
    const prepared: any = await blueprintPlanPrepare({...lookup(state.root), portableSelections: [state.selection]});
    assert.equal(prepared.status, "prepared", JSON.stringify(prepared));
    assert.equal(prepared.evidence.find((item: any) => item.path === "src/entry.ts")?.content, undefined);
    const expanded: any = await blueprintPlanPrepare({...lookup(state.root), evidencePaths: ["src/entry.ts"], portableSelections: [state.selection], expectedRevision: prepared.revision, acknowledgeChangedInputs: true, evidenceDelivery: {mode: "delta"}});
    assert.equal(expanded.status, "prepared", JSON.stringify(expanded));
    assert.equal(expanded.evidence.find((item: any) => item.path === "src/entry.ts")?.content, source);
  } finally { await state.cleanup(); }
});

test("acknowledged portable source change has a usable live-source refresh path", async () => {
  const state = await fixture();
  try {
    const full: any = await blueprintPlanPrepare({...lookup(state.root), evidencePaths: ["src/entry.ts"], portableSelections: [state.selection]});
    assert.equal(full.status, "prepared", JSON.stringify(full));
    await fs.appendFile(path.join(state.root, "src", "entry.ts"), "// changed\n");
    const stale: any = await blueprintPlanPrepare({...lookup(state.root), evidencePaths: ["src/entry.ts"], portableSelections: [state.selection], expectedRevision: full.revision, evidenceDelivery: {mode: "delta"}});
    assert.notEqual(stale.status, "prepared", JSON.stringify(stale));
    const refreshed: any = await blueprintPlanPrepare({...lookup(state.root), evidencePaths: ["src/entry.ts"], portableSelections: [state.selection], expectedRevision: full.revision, acknowledgeChangedInputs: true, evidenceDelivery: {mode: "full"}});
    assert.equal(refreshed.status, "prepared", JSON.stringify(refreshed));
    assert.equal((await blueprintPlanRead(lookup(state.root))).freshness?.status, "fresh");
  } finally { await state.cleanup(); }
});

test("plan records first-ever delta and register delivery without repeating the body", async () => {
  for (const mode of ["delta", "register"] as const) {
    const state = await createProviderFixture({portableOnly: true});
    try {
      await fs.rm(path.join(state.root, ".blueprint/codebase"), {recursive: true, force: true});
      const sourceText = await fs.readFile(path.join(state.root, "src/service.ts"), "utf8");
      const args: any = {...providerLookup(state.root), evidencePaths: ["src/service.ts"], evidenceDelivery: {mode}};
      const first: any = await blueprintPlanPrepare(args);
      assert.equal(first.status, "prepared", `${mode}: ${JSON.stringify(first)}`);
      const second: any = await blueprintPlanPrepare({...args, expectedRevision: first.revision});
      assert.equal(second.status, "prepared", `${mode} second: ${JSON.stringify(second)}`);
      assert.equal(countPublicString("blueprint_plan_prepare", first, sourceText), 1);
      assert.equal(countPublicString("blueprint_plan_prepare", second, sourceText), 0);
      assert.equal(second.revision, first.revision);
      const sessionText = await fs.readFile(path.join(state.root, ".blueprint/phases/01-service/01-PLAN-SESSION.json"), "utf8");
      assert.doesNotMatch(sessionText, /privateBodyPayload/);
    } finally {
      await state.cleanup();
    }
  }
});

test("plan preserves pure portable research sources across distinct successor selections", async () => {
  for (const generationId of ["provider-next", "zz-provider-next"] as const) {
    const state = await createProviderFixture({portableOnly: true});
    try {
      const research: any = await blueprintResearchPrepare({...providerLookup(state.root), portableSelections: [state.selectionServiceFile]});
      assert.equal(research.status, "prepared", JSON.stringify(research));
      const publishedResearch: any = await blueprintResearchSubmit({
        ...providerLookup(state.root), requestId: `research-a-${generationId}`, expectedRevision: research.revision,
        model: projectCitationResearchModel(),
      });
      assert.equal(publishedResearch.status, "published", JSON.stringify(publishedResearch));
      await installProviderSuccessor(state.root, state.map, generationId);
      const plan: any = await blueprintPlanPrepare({...providerLookup(state.root), portableSelections: [state.selectionPythonFile]});
      if (plan.status === "prepared") {
        const sessionPath = path.join(state.root, ".blueprint/phases/01-service/01-PLAN-SESSION.json");
        const session = JSON.parse(await fs.readFile(sessionPath, "utf8"));
        assert.ok(session.readSet.some((item: any) => item.path === "src/service.ts"));
        await fs.rm(path.join(state.root, ".blueprint/codebase/INDEX.md"));
        const fresh: any = await blueprintPlanRead(providerLookup(state.root));
        assert.equal(fresh.freshness?.status, "fresh", JSON.stringify({generationId, fresh}));
        const request: any = {...providerLookup(state.root), requestId: `plan-b-${generationId}`, expectedRevision: plan.revision, model: providerPlanModel()};
        const published: any = await blueprintPlanSubmit(request);
        assert.equal(published.status, "published", JSON.stringify({generationId, published}));
        const retried: any = await blueprintPlanSubmit(request);
        assert.equal(retried.status, "published", JSON.stringify({generationId, retried}));
        await fs.appendFile(path.join(state.root, "src/service.ts"), "// research A source changed\n");
        const read: any = await blueprintPlanRead(providerLookup(state.root));
        assert.notEqual(read.freshness?.status, "fresh", JSON.stringify({generationId, read}));
        const submitted: any = await blueprintPlanSubmit(request);
        assert.notEqual(submitted.status, "published", JSON.stringify({generationId, submitted}));
      } else {
        assert.notEqual(plan.status, "published");
      }
    } finally {
      await state.cleanup();
    }
  }
});

test("plan never lets generation ordering discard conflicting inherited source hashes", async () => {
  for (const generationId of ["provider-next", "zz-provider-next"] as const) {
    const state = await createProviderFixture({portableOnly: true});
    try {
      const research: any = await blueprintResearchPrepare({...providerLookup(state.root), portableSelections: [state.selectionServiceFile]});
      assert.equal(research.status, "prepared", JSON.stringify(research));
      const publishedResearch: any = await blueprintResearchSubmit({
        ...providerLookup(state.root), requestId: `overlap-research-${generationId}`, expectedRevision: research.revision,
        model: projectCitationResearchModel(),
      });
      assert.equal(publishedResearch.status, "published", JSON.stringify(publishedResearch));
      await installProviderSuccessor(state.root, state.map, generationId, true);
      const plan: any = await blueprintPlanPrepare({...providerLookup(state.root), portableSelections: [state.selectionServiceFile]});
      if (plan.status === "prepared") {
        await fs.rm(path.join(state.root, ".blueprint/codebase/INDEX.md"));
        const read: any = await blueprintPlanRead(providerLookup(state.root));
        assert.notEqual(read.freshness?.status, "fresh", JSON.stringify({generationId, read}));
        const submitted: any = await blueprintPlanSubmit({...providerLookup(state.root), requestId: `overlap-plan-${generationId}`, expectedRevision: plan.revision, model: providerPlanModel()});
        assert.notEqual(submitted.status, "published", JSON.stringify({generationId, submitted}));
      } else {
        assert.notEqual(plan.status, "published");
      }
    } finally {
      await state.cleanup();
    }
  }
});

test("plan rejects inherited research and successor source closure before mutating the session limit", async () => {
  const state = await createProviderFixture({portableOnly: true});
  try {
    const mapA = await installSqlPortableMap(state.root, "inherited-limit-a");
    const research: any = await blueprintResearchPrepare({...providerLookup(state.root), portableSelections: mapA.selections.slice(0, 50)});
    assert.equal(research.status, "prepared", JSON.stringify(research));
    const published: any = await blueprintResearchSubmit({...providerLookup(state.root), requestId: "inherited-limit-research", expectedRevision: research.revision, model: projectCitationResearchModel()});
    assert.equal(published.status, "published", JSON.stringify(published));
    const first: any = await blueprintPlanPrepare({...providerLookup(state.root), portableSelections: []});
    assert.equal(first.status, "prepared", JSON.stringify(first));
    const sessionPath = path.join(state.root, ".blueprint/phases/01-service/01-PLAN-SESSION.json");
    const prior = await fs.readFile(sessionPath, "utf8");
    const mapB = await installSqlPortableMap(state.root, "inherited-limit-b");
    const limited: any = await blueprintPlanPrepare({...providerLookup(state.root), expectedRevision: first.revision, acknowledgeChangedInputs: true, portableSelections: mapB.selections.slice(50, 61), evidenceDelivery: {mode: "register"}});
    assert.equal(limited.status, "evidence_limit", JSON.stringify(limited));
    assert.ok((limited.counts?.sourceCount ?? 0) >= 61);
    assert.equal(await fs.readFile(sessionPath, "utf8"), prior);
  } finally {
    await state.cleanup();
  }
});
