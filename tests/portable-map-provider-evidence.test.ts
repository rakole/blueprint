import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {promises as fs} from "node:fs";
import os from "node:os";
import path from "node:path";

import {CODEBASE_DOCUMENT_IDS} from "../src/mcp/codebase-authoring.js";
import {portableSourceCoordinateSchema, type PortableSourceCoordinate} from "../src/mcp/codebase-index/contracts.js";
import {renderPortableMap} from "../src/mcp/codebase-index/render.js";
import {validatePortableMapModel, type PortableAuthoritativeSourceBasis} from "../src/mcp/codebase-index/model-validation.js";
import {
  hashPortableProviderMemberSets,
  portableProviderEvidenceBasisSchema,
  portableProviderEvidenceContextSchema,
  portableProviderEvidenceNextSchema,
  preparePortableProviderEvidence,
  resolvePortableProviderEvidence
} from "../src/mcp/codebase-index/provider-evidence.js";
import {verifyPortablePinHandoff} from "../src/mcp/codebase-index/resolver.js";

const digest = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
const source = "export function entry() {\n  return \"entry\";\n}\n";

function coordinateFor(value: string, from: string, to: string): PortableSourceCoordinate {
  const bytes = new TextEncoder().encode(value);
  const start = value.indexOf(from);
  const end = start + from.length;
  const position = (offset: number) => {
    let line = 1;
    let column = 0;
    for (let index = 0; index < offset; index += 1) {
      if (bytes[index] === 0x0a) { line += 1; column = 0; } else column += 1;
    }
    return {line, column, byte: offset};
  };
  const result = {start: position(Buffer.byteLength(value.slice(0, start))), end: position(Buffer.byteLength(value.slice(0, end)))};
  assert.equal(portableSourceCoordinateSchema.safeParse(result).success, true);
  return result;
}

function fixture(generationId: string, sourceText = source) {
  const sourceBytes = new TextEncoder().encode(sourceText);
  const fileHash = digest(sourceBytes);
  const coordinate = coordinateFor(source, "export function entry()", "export function entry() {");
  const rangeHash = digest(sourceBytes.slice(coordinate.start.byte, coordinate.end.byte));
  const files = [{
    id: "file_entry", path: "src/entry.ts", language: "typescript" as const, role: "source" as const,
    byteSize: sourceBytes.byteLength, contentHash: fileHash, parseStatus: "parsed" as const, coverageStatus: "full" as const
  }];
  const symbols = [{
    id: "symbol_entry", fileId: "file_entry", path: "src/entry.ts", qualifiedName: "entry", kind: "function" as const,
    signature: "function entry()", coordinate, contentHash: rangeHash, lexicalParentId: null, exported: true
  }];
  const documents = Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, {
    summary: `${id} summary`, sections: [{heading: "Observed", content: "The selected entry is source-backed."}], evidencePaths: ["src/entry.ts"]
  }]));
  const model = {
    formatVersion: 1 as const,
    generationId,
    documents,
    semantic: {
      capabilities: [{id: "cap_entry", name: "Entry", summary: "Entry capability.", claimIds: ["claim_entry"], evidence: [{kind: "symbol" as const, path: "src/entry.ts", recordId: "symbol_entry", contentHash: rangeHash, coordinate}]}],
      claims: [{id: "claim_entry", basis: "observed" as const, statement: "The entry function is exported.", evidence: [{kind: "symbol" as const, path: "src/entry.ts", recordId: "symbol_entry", contentHash: rangeHash, coordinate}]}],
      aliases: [{id: "alias_entry", alias: "start entry", targetKind: "capability" as const, targetId: "cap_entry", evidence: [{kind: "file" as const, path: "src/entry.ts", recordId: "file_entry", contentHash: fileHash}]}]
    }
  };
  const basis: PortableAuthoritativeSourceBasis = {
    generationId,
    files: [{path: "src/entry.ts", byteSize: sourceBytes.byteLength, contentHash: fileHash}],
    records: [
      {kind: "file", recordId: "file_entry", path: "src/entry.ts", contentHash: fileHash},
      {kind: "symbol", recordId: "symbol_entry", path: "src/entry.ts", contentHash: rangeHash, coordinate}
    ]
  };
  const checked = validatePortableMapModel([{generationId, shardId: "source", files, symbols, imports: [], relationships: []}], model, basis);
  assert.equal(checked.ok, true, checked.ok ? undefined : JSON.stringify(checked.diagnostics));
  if (!checked.ok) throw new Error("fixture model must validate");
  const rendered = renderPortableMap(checked.data, {
    generationId, generatedAt: "2026-09-24T00:00:00.000Z", gitCommit: null,
    inventoryFingerprint: digest(`${generationId}:inventory`), parserAssets: []
  });
  assert.equal(rendered.ok, true, rendered.ok ? undefined : JSON.stringify(rendered.diagnostics));
  if (!rendered.ok) throw new Error("fixture map must render");
  return {rendered, fileHash};
}

async function install(root: string, rendered: {files: Readonly<Record<string, Uint8Array>>}): Promise<void> {
  for (const [relative, bytes] of Object.entries(rendered.files)) {
    const target = path.join(root, ".blueprint", "codebase", relative);
    await fs.mkdir(path.dirname(target), {recursive: true});
    await fs.writeFile(target, bytes);
  }
}

async function rootFixture(sourceText = source): Promise<{root: string; rendered: ReturnType<typeof fixture>["rendered"]; fileHash: string}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-provider-evidence-"));
  const built = fixture("generation_a", sourceText);
  await install(root, built.rendered);
  await fs.mkdir(path.join(root, "src"), {recursive: true});
  await fs.writeFile(path.join(root, "src", "entry.ts"), sourceText);
  return {root, rendered: built.rendered, fileHash: built.fileHash};
}

test("provider context is compact and no selection emits only one ENTRY", async () => {
  const fixtureState = await rootFixture();
  try {
    const result = await resolvePortableProviderEvidence({root: fixtureState.root});
    assert.equal(result.status, "ok", JSON.stringify(result));
    if (result.status !== "ok") return;
    assert.equal(result.packet.entries.length, 1);
    assert.equal(result.packet.entries[0]?.path.endsWith("/ENTRY.md"), true);
    assert.equal(result.packet.entries[0]?.content !== undefined, true);
    assert.equal(result.packet.entries.filter(entry => entry.path.endsWith("/ENTRY.md")).length, 1);
    assert.equal(result.packet.entries.some(entry => /\/(?:ARCHITECTURE|STRUCTURE|CONVENTIONS|STACK|TESTING|INTEGRATIONS|CONCERNS)\.md$/.test(entry.path)), false);
    assert.equal("content" in result.context.entry, false);
    assert.equal(JSON.stringify(result.next).includes("The selected entry is source-backed."), false);
  } finally { await fs.rm(fixtureState.root, {recursive: true, force: true}); }
});

test("multiple selections share one closure and full, delta, and register preserve delivery state", async () => {
  const fixtureState = await rootFixture();
  try {
    const selections = [{kind: "alias" as const, recordId: "alias_entry"}, {kind: "capability" as const, recordId: "cap_entry"}];
    const full = await resolvePortableProviderEvidence({root: fixtureState.root, selections, evidenceDelivery: {mode: "full"}});
    assert.equal(full.status, "ok", JSON.stringify(full));
    if (full.status !== "ok") return;
    assert.equal(new Set(full.packet.entries.map(entry => entry.path)).size, full.packet.entries.length);
    assert.equal(full.next.bound.length, full.binding.identities.length);
    assert.equal(full.next.delivered.length, full.next.bound.length);
    const delta = await resolvePortableProviderEvidence({root: fixtureState.root, selections, evidenceDelivery: {mode: "delta", prior: {binding: full.binding, delivered: full.next.delivered}}});
    assert.equal(delta.status, "ok", JSON.stringify(delta));
    if (delta.status !== "ok") return;
    assert.equal(delta.packet.entries.every(entry => entry.content === undefined), true);
    const readTimeEvidence = full.packet.entries.map(entry => ({path: entry.path, hash: entry.hash}));
    const registered = await resolvePortableProviderEvidence({root: fixtureState.root, selections, evidenceDelivery: {mode: "register", readTimeEvidence}});
    assert.equal(registered.status, "ok", JSON.stringify(registered));
    if (registered.status !== "ok") return;
    assert.equal(registered.packet.entries.every(entry => entry.content === undefined), true);
    assert.equal(registered.next.delivered.length, 0);
    assert.equal(registered.next.registered.length, full.next.bound.length);
    const capped = await resolvePortableProviderEvidence({root: fixtureState.root, selections, evidenceDelivery: {mode: "full", limits: {maxSourceCount: 1}}});
    assert.equal(capped.status, "evidence_limit");
  } finally { await fs.rm(fixtureState.root, {recursive: true, force: true}); }
});

test("prepare issues a metadata-only receipt and pinned member freshness rejects unknown members", async () => {
  const fixtureState = await rootFixture();
  try {
    const prepared = await preparePortableProviderEvidence({root: fixtureState.root});
    assert.equal(prepared.status, "ok", JSON.stringify(prepared));
    if (prepared.status !== "ok" || !prepared.pinReceipt) return;
    assert.equal(JSON.stringify(prepared.pinReceipt).includes(source), false);
    const members = await hashPortableProviderMemberSets(fixtureState.root, [{receipt: prepared.pinReceipt, members: ["ENTRY.md", "manifest.json"]}]);
    assert.equal(members.status, "ok", JSON.stringify(members));
    if (members.status !== "ok") return;
    assert.equal(members.members.length, 2);
    const unknown = await hashPortableProviderMemberSets(fixtureState.root, [{receipt: prepared.pinReceipt, members: ["extra.md"]}]);
    assert.equal(unknown.status, "invalid");
    await fs.mkdir(path.join(fixtureState.root, ".blueprint", "codebase", "generations", "generation_a", "extra"), {recursive: true});
    await fs.writeFile(path.join(fixtureState.root, ".blueprint", "codebase", "generations", "generation_a", "extra", "unsealed.md"), "unsealed-body");
    const extra = await hashPortableProviderMemberSets(fixtureState.root, [{receipt: prepared.pinReceipt, members: ["extra/unsealed.md"]}]);
    assert.equal(extra.status, "invalid");
    assert.doesNotMatch(JSON.stringify(extra), /unsealed-body/);
  } finally { await fs.rm(fixtureState.root, {recursive: true, force: true}); }
});

test("portable provider falls back for absent maps and rejects stale selected sources", async () => {
  const absent = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-provider-absent-"));
  try {
    const fallback = await resolvePortableProviderEvidence({root: absent, selection: {kind: "alias", recordId: "missing"}, evidenceDelivery: {mode: "full"}});
    assert.equal(fallback.status, "fallback");
    assert.equal(JSON.stringify(fallback).includes("ENTRY.md"), false);
  } finally { await fs.rm(absent, {recursive: true, force: true}); }

  const fixtureState = await rootFixture();
  try {
    const first = await resolvePortableProviderEvidence({root: fixtureState.root, selection: {kind: "symbol", recordId: "symbol_entry"}, evidenceDelivery: {mode: "full"}});
    assert.equal(first.status, "ok", JSON.stringify(first));
    if (first.status !== "ok") return;
    await fs.writeFile(path.join(fixtureState.root, "src", "entry.ts"), `${source}stale-source-sentinel\n`);
    const stale = await resolvePortableProviderEvidence({root: fixtureState.root, selection: {kind: "symbol", recordId: "symbol_entry"}, evidenceDelivery: {mode: "delta", prior: {binding: first.binding, delivered: first.next.delivered}}});
    assert.equal(stale.status, "reread_required");
    assert.doesNotMatch(JSON.stringify(stale), /stale-source-sentinel/);
  } finally { await fs.rm(fixtureState.root, {recursive: true, force: true}); }
});

test("register requires an actual caller read and rejects an incorrect source hash", async () => {
  const fixtureState = await rootFixture();
  try {
    const selection = {kind: "symbol" as const, recordId: "symbol_entry"};
    const withoutRead = await resolvePortableProviderEvidence({root: fixtureState.root, selection, evidenceDelivery: {mode: "register"}});
    assert.equal(withoutRead.status, "ok", JSON.stringify(withoutRead));
    if (withoutRead.status !== "ok") return;
    assert.ok(withoutRead.packet.entries.some(entry => entry.content !== undefined));
    assert.equal(withoutRead.next.registered.length, 0);

    const wrong = await resolvePortableProviderEvidence({
      root: fixtureState.root,
      selection,
      evidenceDelivery: {mode: "register", readTimeEvidence: [{path: "src/entry.ts", hash: "0".repeat(64)}]}
    });
    assert.equal(wrong.status, "invalid");
    assert.doesNotMatch(JSON.stringify(wrong), /REJECTED|entry\(\)/);

    const actual = await resolvePortableProviderEvidence({
      root: fixtureState.root,
      selection,
      evidenceDelivery: {mode: "register", readTimeEvidence: [{path: "src/entry.ts", hash: fixtureState.fileHash}]}
    });
    assert.equal(actual.status, "ok", JSON.stringify(actual));
    if (actual.status !== "ok") return;
    const ranges = actual.packet.entries.filter(entry => entry.path.startsWith("@codebase/source-range/"));
    assert.ok(ranges.length > 0);
    assert.ok(ranges.every(entry => entry.content === undefined));
    assert.ok(ranges.every(entry => actual.next.registered.some(item => item.path === entry.path && item.hash === entry.hash)));
  } finally { await fs.rm(fixtureState.root, {recursive: true, force: true}); }
});

test("prepared and restored ENTRY-only provider metadata stays canonical and trusted", async () => {
  const fixtureState = await rootFixture();
  try {
    const prepared = await preparePortableProviderEvidence({root: fixtureState.root});
    assert.equal(prepared.status, "ok", JSON.stringify(prepared));
    if (prepared.status !== "ok" || !prepared.pinReceipt) return;
    assert.equal(portableProviderEvidenceContextSchema.safeParse(prepared.context).success, true);
    assert.equal(portableProviderEvidenceBasisSchema.safeParse(prepared.basis).success, true);
    assert.equal(portableProviderEvidenceNextSchema.safeParse(prepared.next).success, true);
    assert.ok(prepared.context.trustedPins.some(item => item.receipt?.authentication === prepared.pinReceipt?.authentication));

    const restored = await resolvePortableProviderEvidence({root: fixtureState.root, pinReceipt: prepared.pinReceipt});
    assert.equal(restored.status, "ok", JSON.stringify(restored));
    if (restored.status !== "ok") return;
    assert.equal(portableProviderEvidenceContextSchema.safeParse(restored.context).success, true);
    assert.equal(portableProviderEvidenceBasisSchema.safeParse(restored.basis).success, true);
    assert.equal(portableProviderEvidenceNextSchema.safeParse(restored.next).success, true);
    assert.equal("predecessorDepth" in (restored.context.pin as object), false);
    assert.equal("predecessorDepth" in (restored.basis.pin as object), false);
  } finally { await fs.rm(fixtureState.root, {recursive: true, force: true}); }
});

test("request-local handoffs cannot cross repository roots", async t => {
  const fixtureState = await rootFixture();
  const foreign = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-provider-foreign-"));
  t.after(async () => fs.rm(foreign, {recursive: true, force: true}));
  try {
    const resolved = await resolvePortableProviderEvidence({root: fixtureState.root});
    assert.equal(resolved.status, "ok", JSON.stringify(resolved));
    if (resolved.status !== "ok") return;
    const handoff = await verifyPortablePinHandoff(fixtureState.root, resolved.context.pin);
    assert.equal(handoff.status, "ok", JSON.stringify(handoff));
    if (handoff.status !== "ok" || !handoff.handoff) return;
    await fs.cp(fixtureState.root, foreign, {recursive: true});
    const rejected = await resolvePortableProviderEvidence({root: foreign, pinHandoff: handoff.handoff});
    assert.equal(rejected.status, "invalid");
  } finally { await fs.rm(fixtureState.root, {recursive: true, force: true}); }
});

test("broken sealed generation rejects a previously issued handoff", async () => {
  const fixtureState = await rootFixture();
  try {
    const resolved = await resolvePortableProviderEvidence({root: fixtureState.root});
    assert.equal(resolved.status, "ok", JSON.stringify(resolved));
    if (resolved.status !== "ok") return;
    const handoff = await verifyPortablePinHandoff(fixtureState.root, resolved.context.pin);
    assert.equal(handoff.status, "ok", JSON.stringify(handoff));
    if (handoff.status !== "ok" || !handoff.handoff) return;
    const manifest = path.join(fixtureState.root, ".blueprint", "codebase", handoff.handoff.manifest.path);
    await fs.appendFile(manifest, "\n");
    const rejected = await resolvePortableProviderEvidence({root: fixtureState.root, pinHandoff: handoff.handoff});
    assert.equal(rejected.status, "invalid");
  } finally { await fs.rm(fixtureState.root, {recursive: true, force: true}); }
});

test("register can omit a large known source while full remains packet-bounded", async () => {
  const largeSource = `${"x".repeat(76_000)}\n${source}`;
  const fixtureState = await rootFixture(largeSource);
  try {
    const selection = {kind: "alias" as const, recordId: "alias_entry"};
    const full = await resolvePortableProviderEvidence({root: fixtureState.root, selection, evidenceDelivery: {mode: "full"}});
    assert.equal(full.status, "evidence_limit");
    const registered = await resolvePortableProviderEvidence({
      root: fixtureState.root,
      selection,
      evidenceDelivery: {mode: "register", readTimeEvidence: [{path: "src/entry.ts", hash: fixtureState.fileHash}]}
    });
    assert.equal(registered.status, "ok", JSON.stringify(registered));
    if (registered.status !== "ok") return;
    const sourceEntry = registered.packet.entries.find(entry => entry.path === "src/entry.ts");
    assert.ok(sourceEntry);
    assert.equal(sourceEntry.content, undefined);
    assert.ok(registered.next.registered.some(entry => entry.path === "src/entry.ts" && entry.hash === fixtureState.fileHash));
  } finally { await fs.rm(fixtureState.root, {recursive: true, force: true}); }
});
