import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {promises as fs} from "node:fs";
import path from "node:path";
import * as z from "zod/v4";

import {createGitRepo} from "./helpers/git-fixtures.js";
import {validPhaseContextModel} from "./helpers/context-model.js";
import {CODEBASE_DOCUMENT_IDS} from "../src/mcp/codebase-authoring.js";
import {validatePortableMapModel, type PortableAuthoritativeSourceBasis} from "../src/mcp/codebase-index/model-validation.js";
import {renderPortableMap} from "../src/mcp/codebase-index/render.js";
import {blueprintConfigSet} from "../src/mcp/tools/config.js";
import {blueprintPhaseArtifactWrite} from "../src/mcp/tools/phase-artifacts.js";
import {blueprintResearchPrepare, blueprintResearchRead, blueprintResearchSubmit, researchToolDefinitions} from "../src/mcp/tools/research.js";
import {countPublicString, createProviderFixture, installSqlPortableMap, providerLookup} from "./helpers/portable-provider-fixture.js";

const source = "export function entry() { return \"entry\"; }\n";
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const phaseDir = ".blueprint/phases/01-research";
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
  const model = {
    formatVersion: 1 as const, generationId: "generation_research", documents,
    semantic: {
      capabilities: [{id: "cap_entry", name: "Entry", summary: "Entry capability.", claimIds: ["claim_entry"], evidence}],
      claims: [{id: "claim_entry", basis: "observed" as const, statement: "The entry function is exported.", evidence}],
      aliases: [{id: "alias_entry", alias: "start entry", targetKind: "capability" as const, targetId: "cap_entry", evidence: [{kind: "file" as const, path: "src/entry.ts", recordId: "file_entry", contentHash: fileHash}]}]
    }
  };
  const basis: PortableAuthoritativeSourceBasis = {generationId: "generation_research", files: [{path: "src/entry.ts", byteSize: bytes.byteLength, contentHash: fileHash}], records: [{kind: "file", recordId: "file_entry", path: "src/entry.ts", contentHash: fileHash}, {kind: "symbol", recordId: "symbol_entry", path: "src/entry.ts", contentHash: rangeHash, coordinate}]};
  const checked = validatePortableMapModel([{generationId: "generation_research", shardId: "source", files, symbols, imports: [], relationships: []}], model, basis);
  assert.equal(checked.ok, true, checked.ok ? undefined : JSON.stringify(checked.diagnostics));
  if (!checked.ok) throw new Error("research portable map fixture did not validate");
  const rendered = renderPortableMap(checked.data, {generationId: "generation_research", generatedAt: "2026-09-24T00:00:00.000Z", gitCommit: null, inventoryFingerprint: hash("research-inventory"), parserAssets: []});
  assert.equal(rendered.ok, true, rendered.ok ? undefined : JSON.stringify(rendered.diagnostics));
  if (!rendered.ok) throw new Error("research portable map fixture did not render");
  return {rendered, fileHash};
}

async function fixture(): Promise<{root: string; selection: {kind: "symbol"; recordId: string}; cleanup: () => Promise<void>}> {
  const root = await createGitRepo("portable-research-provider-");
  const built = mapFixture();
  for (const [relative, bytes] of Object.entries(built.rendered.files)) {
    if (/^(?:ARCHITECTURE|STRUCTURE|STACK|INTEGRATIONS|CONVENTIONS|TESTING|CONCERNS)\.md$/.test(relative)) continue;
    const target = path.join(root, ".blueprint", "codebase", relative);
    await fs.mkdir(path.dirname(target), {recursive: true});
    await fs.writeFile(target, bytes);
  }
  await fs.mkdir(path.join(root, "src"), {recursive: true});
  await fs.writeFile(path.join(root, "src", "entry.ts"), source);
  await fs.writeFile(path.join(root, ".blueprint", "PROJECT.md"), "# Portable research fixture\n\nPreserve selected source evidence.\n");
  await fs.writeFile(path.join(root, ".blueprint", "REQUIREMENTS.md"), "# Requirements\n\n- R-1: Preserve source freshness.\n");
  await fs.writeFile(path.join(root, ".blueprint", "ROADMAP.md"), "# Roadmap\n\n## Phases\n\n- [ ] **Phase 1: Research** - Preserve selected evidence\n\n## Phase Details\n\n### Phase 1: Research\n**Goal**: Preserve selected evidence.\n**Requirements**: R-1\n**Success Criteria**:\n1. Changed source becomes stale.\n");
  await fs.mkdir(path.join(root, phaseDir), {recursive: true});
  await blueprintConfigSet({cwd: root, patch: {research: {external_sources: "off"}}});
  const context = await blueprintPhaseArtifactWrite({...lookup(root), artifact: "context", model: validPhaseContextModel({phaseLabel: "phase 1", openQuestions: [], deferredIdeas: [], externalConstraints: ["Preserve selected source freshness."]})});
  assert.notEqual(context.status, "invalid", JSON.stringify(context));
  return {root, selection: {kind: "symbol", recordId: "symbol_entry"}, cleanup: () => fs.rm(path.dirname(root), {recursive: true, force: true})};
}

function researchModel() {
  return {
    summary: "Preserve the inspected entry source while validating freshness.",
    findings: [{id: "CLM-001", finding: "The entry function is exported from the selected source.", sourceIds: ["SRC-001"], confidence: "HIGH", requirementIds: ["R-1"], status: "supported"}],
    recommendations: [{id: "REC-001", recommendation: "Keep the source-backed entry behavior and recheck freshness before publication.", findingIds: ["CLM-001"], affectedSurfaces: ["src/entry.ts"], verification: ["Append to the source and verify the prior basis becomes stale."], requirementIds: ["R-1"], status: "ready"}],
    openQuestions: [], sources: [{id: "SRC-001", lane: "repo", reference: "src/entry.ts:1", excerpt: "export function entry"}]
  };
}

test("research portable provider retains one packet, durable metadata and delivery modes", async () => {
  const state = await fixture();
  try {
    const selection = state.selection;
    const full: any = await blueprintResearchPrepare({...lookup(state.root), evidencePaths: ["src/entry.ts"], portableSelections: [selection]});
    assert.equal(full.status, "prepared", JSON.stringify(full));
    assert.equal(full.portable.packet.entries.filter((entry: any) => entry.content !== undefined && entry.path.endsWith("/ENTRY.md")).length, 1);
    assert.equal(full.evidence.some((entry: any) => entry.path.endsWith("/ENTRY.md")), false);
    const delta: any = await blueprintResearchPrepare({...lookup(state.root), evidencePaths: ["src/entry.ts"], portableSelections: [selection], expectedRevision: full.revision, evidenceDelivery: {mode: "delta"}});
    assert.equal(delta.status, "prepared", JSON.stringify(delta));
    assert.equal(delta.revision, full.revision);
    assert.equal(delta.portable.packet.entries.every((entry: any) => entry.content === undefined), true);
    const registered: any = await blueprintResearchPrepare({...lookup(state.root), evidencePaths: ["src/entry.ts"], portableSelections: [selection], expectedRevision: delta.revision, evidenceDelivery: {mode: "register"}});
    assert.equal(registered.status, "prepared", JSON.stringify(registered));
    assert.equal(registered.portable.packet.entries.every((entry: any) => entry.content === undefined), true);
    const read: any = await blueprintResearchRead(lookup(state.root));
    assert.equal(read.freshness.status, "fresh", JSON.stringify(read));
    const sessionText = await fs.readFile(path.join(state.root, phaseDir, "01-RESEARCH-SESSION.json"), "utf8");
    assert.doesNotMatch(sessionText, /# Portable Codebase Map Entry/);
    assert.doesNotMatch(sessionText, /privateBodyPayload/);
    assert.equal(sessionText.includes('"portable"'), true);
    const published: any = await blueprintResearchSubmit({...lookup(state.root), requestId: "portable-research", expectedRevision: registered.revision, model: researchModel()});
    assert.equal(published.status, "published", JSON.stringify(published));
    const provenance = await fs.readFile(path.join(state.root, phaseDir, "01-RESEARCH-PROVENANCE.json"), "utf8");
    assert.equal(JSON.parse(provenance).portable.schemaVersion, 1);
    assert.doesNotMatch(provenance, /# Portable Codebase Map Entry/);
    const reused: any = await blueprintResearchSubmit({...lookup(state.root), requestId: "portable-research-reuse", expectedRevision: published.revision, reuse: true});
    assert.equal(reused.status, "reused", JSON.stringify(reused));
    await fs.appendFile(path.join(state.root, "src", "entry.ts"), "// changed\n");
    const stale: any = await blueprintResearchRead(lookup(state.root));
    assert.equal(stale.freshness.status, "stale", JSON.stringify(stale));
    const acknowledged: any = await blueprintResearchPrepare({...lookup(state.root), evidencePaths: ["src/entry.ts"], portableSelections: [selection], expectedRevision: published.revision + 1, acknowledgeChangedInputs: true, evidenceDelivery: {mode: "full"}});
    assert.equal(acknowledged.status, "prepared", JSON.stringify(acknowledged));
  } finally { await state.cleanup(); }
});

test("research ordinary source delivery works without a map and enforces combined limits", async () => {
  const state = await fixture();
  try {
    await fs.rm(path.join(state.root, ".blueprint", "codebase"), {recursive: true, force: true});
    const full: any = await blueprintResearchPrepare({...lookup(state.root), evidencePaths: ["src/entry.ts"], evidenceDelivery: {mode: "full"}});
    assert.equal(full.status, "prepared", JSON.stringify(full));
    assert.equal(full.evidence.find((item: any) => item.path === "src/entry.ts")?.content, source);
    const delta: any = await blueprintResearchPrepare({...lookup(state.root), evidencePaths: ["src/entry.ts"], expectedRevision: full.revision, evidenceDelivery: {mode: "delta"}});
    assert.equal(delta.status, "prepared", JSON.stringify(delta));
    assert.equal(delta.evidence.find((item: any) => item.path === "src/entry.ts")?.content, undefined);
    const wrongBytes: any = await blueprintResearchPrepare({...lookup(state.root), evidencePaths: ["src/entry.ts"], expectedRevision: delta.revision, evidenceDelivery: {mode: "register", readTimeEvidence: [{path: "src/entry.ts", bytes: "different", hash: hash(source)}]}});
    assert.notEqual(wrongBytes.status, "prepared", JSON.stringify(wrongBytes));
    const checked = z.toJSONSchema(z.object(researchToolDefinitions.find(tool => tool.name === "blueprint_research_prepare")!.inputSchema));
    assert.ok(checked.properties && !JSON.stringify(checked).includes("Uint8Array"));
  } finally { await state.cleanup(); }

  const limited = await fixture();
  try {
    const first: any = await blueprintResearchPrepare({...lookup(limited.root), portableSelections: []});
    assert.equal(first.status, "prepared", JSON.stringify(first));
    const selected = Array.from({length: 60}, (_, index) => `extra/source-${index}.txt`);
    await Promise.all(selected.map(async relative => { await fs.mkdir(path.dirname(path.join(limited.root, relative)), {recursive: true}); await fs.writeFile(path.join(limited.root, relative), `${relative}\n`); }));
    const over: any = await blueprintResearchPrepare({...lookup(limited.root), expectedRevision: first.revision, acknowledgeChangedInputs: true, evidencePaths: selected, portableSelections: [limited.selection], evidenceDelivery: {mode: "register"}});
    assert.equal(over.status, "evidence_limit", JSON.stringify(over));
    assert.equal(over.saved, false);
  } finally { await limited.cleanup(); }
});

test("research accepts a source citation from the authenticated portable basis", async () => {
  const state = await fixture();
  try {
    const prepared: any = await blueprintResearchPrepare({...lookup(state.root), portableSelections: [state.selection]});
    assert.equal(prepared.status, "prepared", JSON.stringify(prepared));
    // The source is selected through the portable closure only; it is not an
    // ordinary evidencePath and must still be an admissible repository source.
    const published: any = await blueprintResearchSubmit({...lookup(state.root), requestId: "portable-only-citation", expectedRevision: prepared.revision, model: researchModel()});
    assert.equal(published.status, "published", JSON.stringify(published));
  } finally { await state.cleanup(); }
});

test("research records first-ever delta and register delivery without repeating the body", async () => {
  for (const mode of ["delta", "register"] as const) {
    const state = await createProviderFixture({portableOnly: true});
    try {
      await fs.rm(path.join(state.root, ".blueprint/codebase"), {recursive: true, force: true});
      const sourceText = await fs.readFile(path.join(state.root, "src/service.ts"), "utf8");
      const args: any = {...providerLookup(state.root), evidencePaths: ["src/service.ts"], evidenceDelivery: {mode}};
      const first: any = await blueprintResearchPrepare(args);
      assert.equal(first.status, "prepared", `${mode}: ${JSON.stringify(first)}`);
      const second: any = await blueprintResearchPrepare({...args, expectedRevision: first.revision});
      assert.equal(second.status, "prepared", `${mode} second: ${JSON.stringify(second)}`);
      assert.equal(countPublicString("blueprint_research_prepare", first, sourceText), 1);
      assert.equal(countPublicString("blueprint_research_prepare", second, sourceText), 0);
      assert.equal(second.revision, first.revision);
      const sessionText = await fs.readFile(path.join(state.root, ".blueprint/phases/01-service/01-RESEARCH-SESSION.json"), "utf8");
      assert.doesNotMatch(sessionText, /privateBodyPayload/);
    } finally {
      await state.cleanup();
    }
  }
});

test("research fallback enforces the ordinary source limit before accepting the session", async () => {
  const state = await createProviderFixture({portableOnly: true});
  try {
    const map = await installSqlPortableMap(state.root, "fallback-limit");
    const portableSelections = map.selections.slice(0, 50);
    const initial: any = await blueprintResearchPrepare({...providerLookup(state.root), portableSelections});
    assert.equal(initial.status, "prepared", JSON.stringify(initial));
    const sessionPath = path.join(state.root, ".blueprint/phases/01-service/01-RESEARCH-SESSION.json");
    const prior = await fs.readFile(sessionPath, "utf8");
    await fs.appendFile(path.join(state.root, "sql/query-0.sql"), "-- changed source\n");
    const overLimitPaths = Array.from({length: 20}, (_, index) => `sql/query-${index + 50}.sql`);
    const overLimit: any = await blueprintResearchPrepare({
      ...providerLookup(state.root), portableSelections, evidencePaths: overLimitPaths,
      expectedRevision: initial.revision, acknowledgeChangedInputs: true,
    });
    assert.equal(overLimit.status, "evidence_limit", JSON.stringify(overLimit));
    assert.ok((overLimit.counts?.sourceCount ?? 0) >= 70);
    assert.equal(await fs.readFile(sessionPath, "utf8"), prior);

    const boundedPaths = Array.from({length: 10}, (_, index) => `sql/query-${index + 50}.sql`);
    const bounded: any = await blueprintResearchPrepare({
      ...providerLookup(state.root), portableSelections, evidencePaths: boundedPaths,
      expectedRevision: initial.revision, acknowledgeChangedInputs: true,
    });
    assert.equal(bounded.status, "prepared", JSON.stringify(bounded));
    const saved = JSON.parse(await fs.readFile(sessionPath, "utf8"));
    assert.deepEqual(saved.evidencePaths, boundedPaths);
    assert.ok(saved.readSet.some((item: any) => item.path === "sql/query-0.sql"));
  } finally {
    await state.cleanup();
  }

  const overlap = await createProviderFixture({portableOnly: true});
  try {
    const map = await installSqlPortableMap(overlap.root, "fallback-dedupe");
    const portableSelections = map.selections.slice(0, 50);
    const initial: any = await blueprintResearchPrepare({...providerLookup(overlap.root), portableSelections});
    assert.equal(initial.status, "prepared", JSON.stringify(initial));
    await fs.appendFile(path.join(overlap.root, "sql/query-0.sql"), "-- changed source\n");
    const sourceText = await fs.readFile(path.join(overlap.root, "sql/query-0.sql"), "utf8");
    const prepared: any = await blueprintResearchPrepare({
      ...providerLookup(overlap.root), portableSelections, evidencePaths: ["sql/query-0.sql"],
      expectedRevision: initial.revision, acknowledgeChangedInputs: true,
    });
    assert.equal(prepared.status, "prepared", JSON.stringify(prepared));
    assert.equal(prepared.evidence.filter((item: any) => item.path === "sql/query-0.sql" && item.content === sourceText).length, 1);
    assert.equal(prepared.readSet.filter((item: any) => item.path === "sql/query-0.sql").length, 1);
  } finally {
    await overlap.cleanup();
  }
});
