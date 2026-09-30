import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {promises as fs} from "node:fs";
import path from "node:path";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {InMemoryTransport} from "@modelcontextprotocol/sdk/inMemory.js";

import {createGitRepo} from "./helpers/git-fixtures.js";
import {validPhaseContextModel} from "./helpers/context-model.js";
import {CODEBASE_DOCUMENT_IDS} from "../src/mcp/codebase-authoring.js";
import {validatePortableMapModel, type PortableAuthoritativeSourceBasis} from "../src/mcp/codebase-index/model-validation.js";
import {renderPortableMap} from "../src/mcp/codebase-index/render.js";
import {blueprintConfigSet} from "../src/mcp/tools/config.js";
import {blueprintPhaseArtifactWrite} from "../src/mcp/tools/phase-artifacts.js";
import {blueprintPlanPrepare, blueprintPlanRead, blueprintPlanSubmit, planningToolDefinitions} from "../src/mcp/tools/plan.js";
import {
  countPublicString,
  createProviderMap,
  createProviderFixture,
  installProviderMap,
  installProviderSuccessor,
  installSqlPortableMap,
  projectCitationResearchModel,
  providerLookup,
  providerPlanModel,
} from "./helpers/portable-provider-fixture.js";
import {blueprintResearchPrepare, blueprintResearchSubmit} from "../src/mcp/tools/research.js";
import {createBlueprintServer, executeToolHandlerWithFailureLogging, MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES, planMcpJsonRpcResponseBytes, summarizeToolResult} from "../src/mcp/server.js";
import {MCP_WRITE_FAILURE_LOG_PATH} from "../src/mcp/write-failure-log.js";

const source = "export function entry() { return \"entry\"; }\n";
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const phaseDir = ".blueprint/phases/01-plan";
const lookup = (cwd: string) => ({cwd, phase: "1"});
const planPrepareDefinition = planningToolDefinitions.find(tool => tool.name === "blueprint_plan_prepare")!;
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function assertLoggedProviderFailure(
  root: string,
  expectedStatus: "reread_required" | "evidence_limit" | "fallback" | "not-found",
  result: Record<string, unknown>,
  bodySentinels: readonly string[]
) {
  assert.equal(result.status, expectedStatus, JSON.stringify(result));
  assert.equal(result.saved, false);
  assert.equal(result.ready, false);
  assert.equal(typeof result.reason, "string");
  assert.equal(typeof result.nextAction, "string");

  const logText = await fs.readFile(path.join(root, MCP_WRITE_FAILURE_LOG_PATH), "utf8");
  const entries = logText.trim().split("\n").map(line => JSON.parse(line));
  const entry = entries.at(-1);
  assert.equal(entry.toolName, "blueprint_plan_prepare");
  assert.equal(entry.failureKind, "rejected");
  assert.equal(entry.result.status, expectedStatus);
  assert.equal(entry.result.saved, false);
  assert.equal(entry.result.ready, false);
  assert.equal(entry.result.reason, undefined);
  assert.equal(entry.result.nextAction, undefined);
  for (const sentinel of bodySentinels) assert.equal(logText.includes(sentinel), false, `failure log retained ${sentinel}`);

  const summary = summarizeToolResult("blueprint_plan_prepare", result);
  assert.doesNotMatch(summary, /^Completed\b/);
  assert.match(summary, new RegExp(`status: ${expectedStatus}`));
  assert.match(summary, new RegExp(`reason: ${escapeRegExp(String(result.reason).replace(/[.!\s]+$/u, ""))}`));
  assert.match(summary, /Next action:/);
  assert.match(summary, new RegExp(escapeRegExp(String(result.nextAction).replace(/[.!\s]+$/u, ""))));
}

function assertMetadataOnlyProviderLog(entry: Record<string, unknown>, logText: string, sentinels: readonly string[]) {
  const sensitiveKeys = new Set(["evidence", "paths", "reason", "nextAction", "receipt", "pinReceipt", "portableSelections"]);
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      assert.equal(sensitiveKeys.has(key), false, `failure log retained ${key}`);
      visit(child);
    }
  };
  visit(entry);
  for (const sentinel of sentinels) assert.equal(logText.includes(sentinel), false, `failure log retained ${sentinel}`);
}

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
    assert.ok(full.evidenceBudget.aggregate.deliveredPayloadBytes <= full.evidenceBudget.aggregate.maxPayloadBytes, JSON.stringify(full.evidenceBudget));
    assert.equal(full.evidenceBudget.aggregate.maxPayloadBytes, 96 * 1024);
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

test("live combined ordinary and portable plan evidence stays within the escaped JSON-RPC envelope", async t => {
  const state = await fixture();
  const quotedPath = `src/${"long-segment-".repeat(12)}\"quoted-source.ts`;
  try {
    await fs.mkdir(path.dirname(path.join(state.root, quotedPath)), {recursive: true});
    await fs.writeFile(path.join(state.root, quotedPath), `export const escaped = "\\\\\"value";\n`.repeat(10000));
    const server = createBlueprintServer();
    const client = new Client({name: "plan-combined-boundary", version: "1.0.0"}, {capabilities: {}});
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    t.after(async () => Promise.all([client.close(), server.close()]));
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response: any = await client.callTool({
      name: "blueprint_plan_prepare",
      arguments: {...lookup(state.root), evidencePaths: [quotedPath], portableSelections: [state.selection]}
    });
    assert.equal(response.content[0].text, JSON.stringify(response.structuredContent));
    assert.notEqual(response.structuredContent.status, "response_limit", JSON.stringify(response.structuredContent));
    assert.ok(response.structuredContent.portable);
    assert.ok(response.structuredContent.evidenceBudget.ordinary.deliveredBodyBytes > 0);
    const conservativeBytes = planMcpJsonRpcResponseBytes(response.structuredContent);
    const exactBytes = Buffer.byteLength(JSON.stringify({jsonrpc: "2.0", id: 1, result: response}), "utf8");
    assert.ok(conservativeBytes <= MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES, String(conservativeBytes));
    assert.ok(exactBytes <= MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES, String(exactBytes));
  } finally {
    await state.cleanup();
  }
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
    const full: any = await blueprintPlanPrepare({...lookup(state.root), portableSelections: [state.selection]});
    assert.equal(full.status, "prepared", JSON.stringify(full));
    const sessionPath = path.join(state.root, phaseDir, "01-PLAN-SESSION.json");
    const priorSession = await fs.readFile(sessionPath, "utf8");
    await fs.appendFile(path.join(state.root, "src", "entry.ts"), "// changed\n");
    const stale: any = await blueprintPlanPrepare({...lookup(state.root), portableSelections: [state.selection], expectedRevision: full.revision, evidenceDelivery: {mode: "delta"}});
    assert.notEqual(stale.status, "prepared", JSON.stringify(stale));
    assert.equal(await fs.readFile(sessionPath, "utf8"), priorSession);
    const refreshed: any = await blueprintPlanPrepare({...lookup(state.root), portableSelections: [state.selection], expectedRevision: full.revision, acknowledgeChangedInputs: true, evidenceDelivery: {mode: "full"}});
    assert.equal(refreshed.status, "prepared", JSON.stringify(refreshed));
    assert.equal(refreshed.revision, full.revision + 1);
    assert.equal(Object.hasOwn(refreshed, "portable"), false);
    assert.match(refreshed.evidence.find((item: any) => item.path === "src/entry.ts")?.content ?? "", /changed/);
    const saved = JSON.parse(await fs.readFile(sessionPath, "utf8"));
    assert.equal(saved.portable, undefined);
    assert.deepEqual(saved.evidencePaths, ["src/entry.ts"]);
    assert.equal((await blueprintPlanRead(lookup(state.root))).freshness?.status, "fresh");
  } finally { await state.cleanup(); }
});

test("selection change preserves A on stale B, then replaces it atomically when B is complete", async () => {
  const state = await createProviderFixture({portableOnly: true});
  const sessionPath = path.join(state.root, ".blueprint/phases/01-service/01-PLAN-SESSION.json");
  const pythonPath = "python/library.py";
  const changedBody = "STALE_SELECTION_B_PRIVATE_BODY";
  try {
    const first: any = await blueprintPlanPrepare({...providerLookup(state.root), portableSelections: [state.selectionServiceFile]});
    assert.equal(first.status, "prepared", JSON.stringify(first));
    const originalPython = await fs.readFile(path.join(state.root, pythonPath), "utf8");
    const priorSession = await fs.readFile(sessionPath, "utf8");
    await fs.appendFile(path.join(state.root, pythonPath), `# ${changedBody}\n`);

    const failed: any = await executeToolHandlerWithFailureLogging(planPrepareDefinition, {
      ...providerLookup(state.root), portableSelections: [state.selectionPythonFile],
      expectedRevision: first.revision, acknowledgeChangedInputs: true,
    });
    assert.equal(failed.status, "reread_required", JSON.stringify(failed));
    assert.equal(failed.code, "source_tampered");
    assert.deepEqual(failed.paths, [pythonPath]);
    assert.equal(failed.saved, false);
    assert.equal(failed.ready, false);
    assert.equal(await fs.readFile(sessionPath, "utf8"), priorSession);
    const afterFailure: any = await blueprintPlanRead(providerLookup(state.root));
    assert.equal(afterFailure.session.revision, first.revision);
    assert.equal(afterFailure.session.portable.generationId, "provider-original");
    await assertLoggedProviderFailure(state.root, "reread_required", failed, [changedBody, "privatePythonPayload", pythonPath]);

    await fs.writeFile(path.join(state.root, pythonPath), originalPython);
    const replacement: any = await blueprintPlanPrepare({
      ...providerLookup(state.root), portableSelections: [state.selectionPythonFile],
      expectedRevision: first.revision, acknowledgeChangedInputs: true,
    });
    assert.equal(replacement.status, "prepared", JSON.stringify(replacement));
    assert.equal(replacement.revision, first.revision + 1);
    assert.deepEqual(replacement.portable.selections, [state.selectionPythonFile]);
    const saved = JSON.parse(await fs.readFile(sessionPath, "utf8"));
    assert.equal(saved.revision, replacement.revision);
    assert.deepEqual(saved.portable.selections, [state.selectionPythonFile]);
    assert.ok(saved.portable.next.readSet.sourceAndPage.some((item: any) => item.path === pythonPath && item.kind === "source"));
    assert.equal(saved.portable.next.readSet.sourceAndPage.some((item: any) => item.path === "src/service.ts" && item.kind === "source"), false);

    const staleRevision: any = await blueprintPlanSubmit({
      ...providerLookup(state.root), requestId: "selection-b-stale-revision",
      expectedRevision: first.revision, model: providerPlanModel(),
    });
    assert.notEqual(staleRevision.status, "published", JSON.stringify(staleRevision));
    const request: any = {
      ...providerLookup(state.root), requestId: "selection-b-plan",
      expectedRevision: replacement.revision, model: providerPlanModel(),
    };
    const published: any = await blueprintPlanSubmit(request);
    assert.equal(published.status, "published", JSON.stringify(published));
    await fs.appendFile(path.join(state.root, pythonPath), "# changed after B publication\n");
    const staleRead: any = await blueprintPlanRead(providerLookup(state.root));
    assert.notEqual(staleRead.freshness?.status, "fresh", JSON.stringify(staleRead));
    const staleSubmit: any = await blueprintPlanSubmit(request);
    assert.notEqual(staleSubmit.status, "published", JSON.stringify(staleSubmit));
  } finally {
    await state.cleanup();
  }
});

test("same generation id with replacement sealed bytes cannot reuse the prior fallback closure", async () => {
  const state = await createProviderFixture({portableOnly: true});
  const sessionPath = path.join(state.root, ".blueprint/phases/01-service/01-PLAN-SESSION.json");
  try {
    const first: any = await blueprintPlanPrepare({...providerLookup(state.root), portableSelections: [state.selectionServiceFile]});
    assert.equal(first.status, "prepared", JSON.stringify(first));
    const priorSession = await fs.readFile(sessionPath, "utf8");
    const prior = JSON.parse(priorSession);

    const replacement = await createProviderMap("provider-original", {changedService: true});
    await installProviderMap(state.root, replacement.rendered, true);
    const failed: any = await executeToolHandlerWithFailureLogging(planPrepareDefinition, {
      ...providerLookup(state.root), portableSelections: [state.selectionServiceFile],
      expectedRevision: first.revision, acknowledgeChangedInputs: true,
    });
    assert.equal(failed.status, "reread_required", JSON.stringify(failed));
    assert.equal(failed.code, "source_tampered");
    assert.deepEqual(failed.paths, ["src/service.ts"]);
    assert.equal(failed.saved, false);
    assert.equal(failed.ready, false);
    assert.equal(await fs.readFile(sessionPath, "utf8"), priorSession);
    const after = JSON.parse(await fs.readFile(sessionPath, "utf8"));
    assert.equal(after.revision, first.revision);
    assert.deepEqual(after.portable.basis.pin, prior.portable.basis.pin);
    assert.deepEqual(after.portable.selections, prior.portable.selections);
    await assertLoggedProviderFailure(state.root, "reread_required", failed, ["privateBodyPayload", "refreshedPayload", "src/service.ts"]);
  } finally {
    await state.cleanup();
  }
});

test("explicit empty selection removes prior source bindings with a new revision", async () => {
  const state = await createProviderFixture({portableOnly: true});
  try {
    const first: any = await blueprintPlanPrepare({...providerLookup(state.root), portableSelections: [state.selectionServiceFile]});
    assert.equal(first.status, "prepared", JSON.stringify(first));
    const removed: any = await blueprintPlanPrepare({
      ...providerLookup(state.root), portableSelections: [],
      expectedRevision: first.revision, acknowledgeChangedInputs: true,
    });
    assert.equal(removed.status, "prepared", JSON.stringify(removed));
    assert.equal(removed.revision, first.revision + 1);
    assert.deepEqual(removed.portable.selections, []);
    const session = JSON.parse(await fs.readFile(path.join(state.root, ".blueprint/phases/01-service/01-PLAN-SESSION.json"), "utf8"));
    assert.deepEqual(session.portable.selections, []);
    assert.equal(session.portable.next.readSet.sourceAndPage.some((item: any) => item.path === "src/service.ts"), false);
    await fs.appendFile(path.join(state.root, "src/service.ts"), "// removed selection changed\n");
    const read: any = await blueprintPlanRead(providerLookup(state.root));
    assert.equal(read.freshness?.status, "fresh", JSON.stringify(read));
  } finally {
    await state.cleanup();
  }
});

test("automatic portable adoption and ordinary fallback keep stable revision semantics", async () => {
  const mapped = await createProviderFixture({portableOnly: true});
  try {
    const adopted: any = await blueprintPlanPrepare(providerLookup(mapped.root));
    assert.equal(adopted.status, "prepared", JSON.stringify(adopted));
    assert.deepEqual(adopted.portable.selections, []);
    const repeated: any = await blueprintPlanPrepare({...providerLookup(mapped.root), expectedRevision: adopted.revision});
    assert.equal(repeated.status, "prepared", JSON.stringify(repeated));
    assert.equal(repeated.revision, adopted.revision);
  } finally {
    await mapped.cleanup();
  }

  const ordinary = await createProviderFixture({portableOnly: true});
  try {
    await fs.rm(path.join(ordinary.root, ".blueprint/codebase"), {recursive: true, force: true});
    const fallback: any = await blueprintPlanPrepare(providerLookup(ordinary.root));
    assert.equal(fallback.status, "prepared", JSON.stringify(fallback));
    assert.equal(Object.hasOwn(fallback, "portable"), false);
    const repeated: any = await blueprintPlanPrepare({...providerLookup(ordinary.root), expectedRevision: fallback.revision});
    assert.equal(repeated.status, "prepared", JSON.stringify(repeated));
    assert.equal(repeated.revision, fallback.revision);
  } finally {
    await ordinary.cleanup();
  }
});

test("acknowledged same-selection successor refresh persists the returned portable basis", async () => {
  const state = await createProviderFixture({portableOnly: true});
  try {
    const first: any = await blueprintPlanPrepare({...providerLookup(state.root), portableSelections: [state.selectionServiceFile]});
    assert.equal(first.status, "prepared", JSON.stringify(first));
    assert.equal(first.portable.basis.generationId, "provider-original");

    await installProviderSuccessor(state.root, state.map, "same-selection-successor", true);
    const sessionPath = path.join(state.root, ".blueprint/phases/01-service/01-PLAN-SESSION.json");
    const wrongRevision: any = await blueprintPlanPrepare({
      ...providerLookup(state.root), portableSelections: [state.selectionServiceFile],
      expectedRevision: first.revision + 1, acknowledgeChangedInputs: true,
    });
    assert.equal(wrongRevision.status, "stale", JSON.stringify(wrongRevision));
    assert.equal(Object.hasOwn(wrongRevision, "portable"), false);
    assert.equal(Object.hasOwn(wrongRevision, "evidence"), false);
    const beforeRefresh = JSON.parse(await fs.readFile(sessionPath, "utf8"));
    assert.equal(beforeRefresh.revision, first.revision);
    assert.equal(beforeRefresh.portable.basis.generationId, "provider-original");
    const mixedSubmit: any = await blueprintPlanSubmit({
      ...providerLookup(state.root), requestId: "unsaved-successor-plan",
      expectedRevision: wrongRevision.revision, model: providerPlanModel(),
    });
    assert.notEqual(mixedSubmit.status, "published", JSON.stringify(mixedSubmit));
    assert.notEqual(mixedSubmit.freshness?.status, "fresh", JSON.stringify(mixedSubmit));

    const refreshed: any = await blueprintPlanPrepare({
      ...providerLookup(state.root), portableSelections: [state.selectionServiceFile],
      expectedRevision: first.revision, acknowledgeChangedInputs: true,
    });
    assert.equal(refreshed.status, "prepared", JSON.stringify(refreshed));
    assert.equal(refreshed.revision, first.revision + 1);
    assert.equal(refreshed.portable.basis.generationId, "same-selection-successor");
    const saved = JSON.parse(await fs.readFile(sessionPath, "utf8"));
    assert.equal(saved.revision, refreshed.revision);
    assert.deepEqual(refreshed.portable.selections, saved.portable.selections);
    assert.deepEqual(refreshed.portable.basis, saved.portable.basis);
    assert.deepEqual(refreshed.portable.next, saved.portable.next);
    assert.equal(refreshed.portable.binding.pinnedGeneration, saved.portable.basis.generationId);
    assert.deepEqual(refreshed.portable.binding.identities, saved.portable.next.bound);
    assert.equal(refreshed.portable.binding.hash, saved.portable.next.bindingHash);

    const unchanged: any = await blueprintPlanPrepare({
      ...providerLookup(state.root), portableSelections: [state.selectionServiceFile],
      expectedRevision: refreshed.revision, acknowledgeChangedInputs: true,
    });
    assert.equal(unchanged.status, "prepared", JSON.stringify(unchanged));
    assert.equal(unchanged.revision, refreshed.revision);
    assert.deepEqual(unchanged.portable.basis, saved.portable.basis);
    assert.deepEqual(unchanged.portable.next, saved.portable.next);

    await fs.appendFile(path.join(state.root, "src/service.ts"), "// changed after successor prepare\n");
    const submitted: any = await blueprintPlanSubmit({
      ...providerLookup(state.root), requestId: "same-selection-successor-plan",
      expectedRevision: refreshed.revision, model: providerPlanModel(),
    });
    assert.notEqual(submitted.status, "published", JSON.stringify(submitted));
    assert.notEqual(submitted.freshness?.status, "fresh", JSON.stringify(submitted));
  } finally {
    await state.cleanup();
  }
});

test("portable selections have order-independent set semantics", async () => {
  const state = await createProviderFixture({portableOnly: true});
  try {
    const first: any = await blueprintPlanPrepare({
      ...providerLookup(state.root),
      portableSelections: [state.selectionPythonFile, state.selectionServiceFile],
    });
    assert.equal(first.status, "prepared", JSON.stringify(first));
    assert.deepEqual(first.portable.selections.map((item: any) => item.recordId), ["file-0", "file-2"]);
    const sessionPath = path.join(state.root, ".blueprint/phases/01-service/01-PLAN-SESSION.json");
    const before = await fs.readFile(sessionPath, "utf8");

    const reordered: any = await blueprintPlanPrepare({
      ...providerLookup(state.root), expectedRevision: first.revision,
      portableSelections: [state.selectionServiceFile, state.selectionPythonFile],
    });
    assert.equal(reordered.status, "prepared", JSON.stringify(reordered));
    assert.equal(reordered.revision, first.revision);
    assert.deepEqual(reordered.portable.selections, first.portable.selections);
    assert.equal(await fs.readFile(sessionPath, "utf8"), before);
  } finally {
    await state.cleanup();
  }
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

test("plan provider fallback is logged privately and summarized as a recovery outcome", async () => {
  const state = await createProviderFixture({portableOnly: true});
  try {
    await fs.rm(path.join(state.root, ".blueprint/codebase"), {recursive: true, force: true});
    const result = await executeToolHandlerWithFailureLogging(planPrepareDefinition, {
      ...providerLookup(state.root),
      portableSelections: [state.selectionServiceFile]
    });
    await assertLoggedProviderFailure(state.root, "fallback", result, [
      "privateBodyPayload",
      "export class Service"
    ]);
  } finally {
    await state.cleanup();
  }
});

test("plan provider missing selection is logged privately and summarized as not found", async () => {
  const state = await createProviderFixture({portableOnly: true});
  const missingRecordId = "private-missing-plan-record";
  try {
    const result = await executeToolHandlerWithFailureLogging(planPrepareDefinition, {
      ...providerLookup(state.root),
      portableSelections: [{kind: "file", recordId: missingRecordId}]
    });
    assert.equal(result.status, "not-found", JSON.stringify(result));
    assert.equal(result.saved, false);
    assert.equal(result.ready, false);
    assert.equal(typeof result.reason, "string");
    assert.equal(typeof result.nextAction, "string");

    const logText = await fs.readFile(path.join(state.root, MCP_WRITE_FAILURE_LOG_PATH), "utf8");
    const entry = JSON.parse(logText.trim().split("\n").at(-1)!);
    assert.equal(entry.toolName, "blueprint_plan_prepare");
    assert.equal(entry.failureKind, "rejected");
    assert.deepEqual(entry.request, {});
    assert.equal(entry.result.status, "not-found");
    assert.equal(entry.result.saved, false);
    assert.equal(entry.result.ready, false);
    assertMetadataOnlyProviderLog(entry, logText, [missingRecordId, "privateBodyPayload", "src/service.ts"]);

    const summary = summarizeToolResult("blueprint_plan_prepare", result);
    assert.doesNotMatch(summary, /^Completed\b/);
    assert.match(summary, /^Not found plan prepare/);
    assert.match(summary, /status: not-found/);
    assert.match(summary, /reason: The selected portable map evidence could not be proved/);
    assert.match(summary, /Next action:/);
  } finally {
    await state.cleanup();
  }
});

test("plan provider reread requirement is logged privately and summarized with its retry action", async () => {
  const state = await createProviderFixture({portableOnly: true});
  const changedBody = "PROVIDER_CHANGED_SOURCE_BODY";
  try {
    const prepared: any = await blueprintPlanPrepare({
      ...providerLookup(state.root),
      portableSelections: [state.selectionServiceFile]
    });
    assert.equal(prepared.status, "prepared", JSON.stringify(prepared));
    await fs.appendFile(path.join(state.root, "src/service.ts"), `// ${changedBody}\n`);
    const result = await executeToolHandlerWithFailureLogging(planPrepareDefinition, {
      ...providerLookup(state.root),
      portableSelections: [state.selectionServiceFile],
      expectedRevision: prepared.revision,
      evidenceDelivery: {mode: "delta"}
    });
    await assertLoggedProviderFailure(state.root, "reread_required", result, [
      "privateBodyPayload",
      "export class Service",
      changedBody
    ]);
  } finally {
    await state.cleanup();
  }
});

test("plan provider evidence limit is logged privately and summarized with scope reduction guidance", async () => {
  const state = await createProviderFixture({portableOnly: true});
  const privateBody = "EVIDENCE_LIMIT_PRIVATE_BODY";
  try {
    const evidencePaths = Array.from({length: 60}, (_, index) => `evidence/limit-${index}.txt`);
    await fs.mkdir(path.join(state.root, "evidence"), {recursive: true});
    await Promise.all(evidencePaths.map((evidencePath, index) =>
      fs.writeFile(path.join(state.root, evidencePath), `${privateBody}_${index}\n`)
    ));
    const result = await executeToolHandlerWithFailureLogging(planPrepareDefinition, {
      ...providerLookup(state.root),
      evidencePaths,
      portableSelections: [state.selectionServiceFile]
    });
    await assertLoggedProviderFailure(state.root, "evidence_limit", result, [
      privateBody,
      "privateBodyPayload"
    ]);
  } finally {
    await state.cleanup();
  }
});
