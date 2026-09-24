import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {CODEBASE_DOCUMENT_IDS} from "../src/mcp/codebase-authoring.js";
import {renderPortableMap} from "../src/mcp/codebase-index/render.js";
import {validatePortableMapModel, type PortableAuthoritativeSourceBasis} from "../src/mcp/codebase-index/model-validation.js";
import {resolveCodebaseNavigation, resolveSelectedCodebaseEvidence} from "../src/mcp/codebase-index/resolver.js";

const digest = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
const coordinate = {start: {line: 1, column: 0, byte: 0}, end: {line: 1, column: 43, byte: 43}};

function modelFixture(generationId: string, predecessorPublicationProof?: {generationId: string; manifest: {path: string; checksum: string}; entry: {path: string; checksum: string}; committedIndexHash: string}, semanticAliasTarget: "symbol" | "capability" = "symbol") {
  const source = "export class Entry { run() { return 1; } }\n";
  const sourceHash = digest(source);
  const library = "def library(): return 1\n";
  const libraryHash = digest(library);
  const symbol0Hash = digest(source.slice(0, 21));
  const symbol1Hash = digest(source.slice(20, 40));
  const files = [
    {id: "file_main", path: "src/entry.ts", language: "typescript" as const, role: "source" as const, byteSize: Buffer.byteLength(source), contentHash: sourceHash, parseStatus: "parsed" as const, coverageStatus: "full" as const},
    ...(semanticAliasTarget === "capability" ? [{id: "file_library", path: "python/library.py", language: "python" as const, role: "source" as const, byteSize: Buffer.byteLength(library), contentHash: libraryHash, parseStatus: "parsed" as const, coverageStatus: "full" as const}] : [])
  ];
  const symbols = [
    {id: "symbol_entry", fileId: "file_main", path: "src/entry.ts", qualifiedName: "Entry", kind: "class" as const, signature: "class Entry", coordinate, contentHash: symbol0Hash, lexicalParentId: null, exported: true},
    {id: "symbol_run", fileId: "file_main", path: "src/entry.ts", qualifiedName: "Entry.run", kind: "method" as const, signature: "run()", coordinate: {start: {line: 1, column: 20, byte: 20}, end: {line: 1, column: 40, byte: 40}}, contentHash: symbol1Hash, lexicalParentId: "symbol_entry", exported: false}
  ];
  const documents = Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, {
    summary: `${id} is grounded in the entry file.`,
    sections: [{heading: "Observed", content: "The entry class is the selected implementation boundary."}],
    evidencePaths: ["src/entry.ts"]
  }]));
  const model = {
    formatVersion: 1 as const,
    generationId,
    documents,
    semantic: {
      capabilities: [{id: "cap_entry", name: "Entry flow", summary: "Coordinates the entry flow.", claimIds: ["claim_entry"], evidence: [{kind: "symbol" as const, path: "src/entry.ts", recordId: "symbol_entry", contentHash: symbol0Hash, coordinate}]}],
      claims: [{id: "claim_entry", basis: "observed" as const, statement: "Entry is exported.", evidence: [semanticAliasTarget === "capability" ? {kind: "file" as const, path: "python/library.py", recordId: "file_library", contentHash: libraryHash} : {kind: "symbol" as const, path: "src/entry.ts", recordId: "symbol_entry", contentHash: symbol0Hash, coordinate}]}],
      aliases: [{id: "alias_start", alias: "start", targetKind: semanticAliasTarget, targetId: semanticAliasTarget === "capability" ? "cap_entry" : "symbol_entry", evidence: [{kind: "file" as const, path: "src/entry.ts", recordId: "file_main", contentHash: sourceHash}]}]
    }
  };
  const basis: PortableAuthoritativeSourceBasis = {
    generationId,
    files: files.map(file => ({path: file.path, byteSize: file.byteSize, contentHash: file.contentHash})),
    records: [
      ...files.map(file => ({kind: "file" as const, recordId: file.id, path: file.path, contentHash: file.contentHash})),
      ...symbols.map(symbol => ({kind: "symbol" as const, recordId: symbol.id, path: symbol.path, contentHash: symbol.contentHash, coordinate: symbol.coordinate}))
    ]
  };
  const validated = validatePortableMapModel([{generationId, shardId: "source_1", files, symbols, imports: [], relationships: []}], model, basis);
  assert.equal(validated.ok, true, validated.ok ? undefined : JSON.stringify(validated.diagnostics));
  if (!validated.ok) throw new Error("fixture should validate");
  const rendered = renderPortableMap(validated.data, {
    generationId,
    generatedAt: "2026-09-24T10:00:00+00:00",
    gitCommit: null,
    inventoryFingerprint: digest(`${generationId}:inventory`),
    parserAssets: [],
    ...(predecessorPublicationProof ? {predecessorPublicationProof} : {})
  });
  assert.equal(rendered.ok, true, rendered.ok ? undefined : JSON.stringify(rendered.diagnostics));
  if (!rendered.ok) throw new Error("fixture should render");
  return {rendered, source, sourceHash, symbols};
}

async function installBundle(root: string, rendered: {files: Readonly<Record<string, Uint8Array>>}, include: (filePath: string) => boolean = () => true): Promise<void> {
  for (const [filePath, bytes] of Object.entries(rendered.files)) {
    if (!include(filePath)) continue;
    const target = path.join(root, ".blueprint", "codebase", filePath);
    await mkdir(path.dirname(target), {recursive: true});
    await writeFile(target, bytes);
  }
}

async function temporaryRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "blueprint-portable-resolver-"));
}

test("resolves compact navigation and exact grouped-record evidence", async () => {
  const root = await temporaryRoot();
  try {
    const fixture = modelFixture("generation_a");
    await installBundle(root, fixture.rendered);
    const navigation = await resolveCodebaseNavigation(root);
    assert.equal(navigation.status, "ok");
    if (navigation.status !== "ok") return;
    assert.equal(navigation.portable.generationId, "generation_a");
    assert.equal(navigation.entry.body.length > 0, true);
    assert.equal(navigation.fallback.used, false);
    assert.equal(navigation.compatibility.status, "matching");
    assert.equal("manifest" in navigation, false, "the compact result must not expose the manifest");

    const selected = await resolveSelectedCodebaseEvidence(root, {kind: "symbol", recordId: "symbol_entry"});
    assert.equal(selected.status, "ok");
    if (selected.status !== "ok") return;
    assert.equal(selected.selected.length, 1);
    assert.equal(selected.selected[0]?.recordId, "symbol_entry");
    assert.equal(selected.sourceBindings[0]?.fullFileHash, fixture.sourceHash);
    assert.equal(selected.sourceBindings[0]?.rangeHash, fixture.symbols[0]?.contentHash);
    assert.equal(selected.entries.length, 1);
    assert.match(selected.entries[0]!.bytes ?? "", /symbol_entry/);
    assert.match(selected.entries[0]!.bytes ?? "", /symbol_run/, "the grouped page may contain a neighbor");
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("accepts a refreshed generation transfer with only INDEX and complete B", async () => {
  const root = await temporaryRoot();
  try {
    const a = modelFixture("generation_a");
    const b = modelFixture("generation_b", {
      generationId: "generation_a",
      manifest: {path: a.rendered.sealedGeneration.manifest.path, checksum: a.rendered.sealedGeneration.manifest.checksum},
      entry: {path: a.rendered.sealedGeneration.entry.path, checksum: a.rendered.sealedGeneration.entry.checksum},
      committedIndexHash: a.rendered.rootIndexHash
    });
    await installBundle(root, b.rendered, filePath => filePath === "INDEX.md" || filePath.startsWith("generations/generation_b/"));
    const navigation = await resolveCodebaseNavigation(root);
    assert.equal(navigation.status, "ok");
    if (navigation.status === "ok") assert.equal(navigation.portable.generationId, "generation_b");
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("proves an explicitly pinned retained generation through predecessor checksums", async () => {
  const root = await temporaryRoot();
  try {
    const a = modelFixture("generation_a");
    const b = modelFixture("generation_b", {
      generationId: "generation_a",
      manifest: {path: a.rendered.sealedGeneration.manifest.path, checksum: a.rendered.sealedGeneration.manifest.checksum},
      entry: {path: a.rendered.sealedGeneration.entry.path, checksum: a.rendered.sealedGeneration.entry.checksum},
      committedIndexHash: a.rendered.rootIndexHash
    });
    await installBundle(root, a.rendered);
    await installBundle(root, b.rendered);
    const retained = await resolveCodebaseNavigation(root, {requestedGenerationId: "generation_a"});
    assert.equal(retained.status, "ok");
    if (retained.status === "ok") {
      assert.equal(retained.portable.generationId, "generation_a");
      assert.equal(retained.entry.path, "generations/generation_a/ENTRY.md");
      assert.equal(retained.immutable.entry.path, "generations/generation_a/ENTRY.md");
      assert.equal(retained.immutable.manifest.path, "generations/generation_a/manifest.json");
      assert.equal(retained.immutable.entry.sha256, a.rendered.sealedGeneration.entry.checksum);
      assert.equal(retained.immutable.manifest.sha256, a.rendered.sealedGeneration.manifest.checksum);
    }
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("keeps route-page selection isolated and rejects malformed or tampered bundles", async () => {
  const root = await temporaryRoot();
  try {
    const fixture = modelFixture("generation_a");
    await installBundle(root, fixture.rendered);
    const routePath = Object.keys(fixture.rendered.files).find(item => item.includes("/routes/"))!;
    const page = await resolveSelectedCodebaseEvidence(root, {kind: "page", path: routePath, mode: "discovery"});
    assert.equal(page.status, "ok");
    if (page.status === "ok") {
      assert.equal(page.mode, "discovery");
      assert.equal(page.sourceBindings.length, 0);
      assert.deepEqual(page.selected, [{kind: "page", page: routePath}]);
    }
    const indexPath = path.join(root, ".blueprint", "codebase", "INDEX.md");
    const indexBody = await readFile(indexPath, "utf8");
    const descriptorLine = indexBody.split("\n").find(line => line.includes("blueprint:portable-root-descriptor"));
    assert.ok(descriptorLine);
    await writeFile(indexPath, `${indexBody}\n${descriptorLine}\n`);
    const ambiguous = await resolveCodebaseNavigation(root);
    assert.equal(ambiguous.status, "fallback");
    assert.equal(ambiguous.fallbackReason, "invalid");
    await writeFile(path.join(root, ".blueprint", "codebase", "INDEX.md"), "<!-- blueprint:portable-root-descriptor {\"version\":1,\"generationId\":\"generation_a\",\"manifest\":{\"path\":\"generations/generation_a/manifest.json\",\"sha256\":\"bad\"},\"entry\":{\"path\":\"generations/generation_a/ENTRY.md\",\"sha256\":\"bad\"}} -->\n");
    const tampered = await resolveCodebaseNavigation(root);
    assert.equal(tampered.status, "fallback");
    assert.equal(tampered.fallback.used, true);
    assert.ok(tampered.diagnostics.some(item => item.code === "invalid"));
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("resolves semantic dependency edges without selecting grouped neighbors", async () => {
  const root = await temporaryRoot();
  try {
    const fixture = modelFixture("generation_a");
    await installBundle(root, fixture.rendered);
    const capability = await resolveSelectedCodebaseEvidence(root, {kind: "capability", recordId: "cap_entry"});
    assert.equal(capability.status, "ok");
    if (capability.status === "ok") {
      assert.deepEqual(capability.selected.map(item => `${item.kind}:${item.recordId}`), ["claim:claim_entry", "capability:cap_entry"]);
      assert.equal(capability.sourceBindings.length, 1);
      assert.equal(capability.sourceBindings[0]?.fullFileHash, fixture.sourceHash);
      assert.match(capability.entries[0]?.bytes ?? "", /alias_start/);
    }
    const alias = await resolveSelectedCodebaseEvidence(root, {kind: "semantic", recordKind: "alias", recordId: "alias_start"});
    assert.equal(alias.status, "ok");
    if (alias.status === "ok") {
      assert.deepEqual(alias.selected.map(item => `${item.kind}:${item.recordId}`), ["symbol:symbol_entry", "alias:alias_start"]);
      assert.equal(alias.sourceBindings.length, 2);
      assert.ok(alias.sourceBindings.every(item => item.fullFileHash === fixture.sourceHash));
    }
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("rejects exact structural selections under the wrong record kind", async () => {
  const root = await temporaryRoot();
  try {
    const fixture = modelFixture("generation_a");
    await installBundle(root, fixture.rendered);
    const wrong = await resolveSelectedCodebaseEvidence(root, {kind: "file", recordId: "symbol_entry"});
    assert.equal(wrong.status, "invalid");
    assert.equal(wrong.diagnostics[0]?.scope, "selection");
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("alias capability selection includes the complete claim and source closure", async () => {
  const root = await temporaryRoot();
  try {
    const fixture = modelFixture("generation_alias_capability", undefined, "capability");
    await installBundle(root, fixture.rendered);
    const selected = await resolveSelectedCodebaseEvidence(root, {kind: "alias", recordId: "alias_start"});
    assert.equal(selected.status, "ok");
    if (selected.status !== "ok") return;
    assert.equal(selected.mode, "implementation");
    assert.deepEqual(selected.selected.map(item => `${item.kind}:${item.recordId}`), ["claim:claim_entry", "capability:cap_entry", "alias:alias_start"]);
    assert.deepEqual([...new Set(selected.sourceBindings.map(item => item.path))].sort(), ["python/library.py", "src/entry.ts"]);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("semantic and compatibility pages cannot masquerade as discovery evidence", async () => {
  const root = await temporaryRoot();
  try {
    const fixture = modelFixture("generation_a");
    await installBundle(root, fixture.rendered);
    const semanticPath = Object.keys(fixture.rendered.files).find(item => item.includes("/capabilities/"))!;
    const rejected = await resolveSelectedCodebaseEvidence(root, {kind: "page", path: semanticPath, mode: "discovery"});
    assert.equal(rejected.status, "invalid");
    assert.equal(rejected.diagnostics[0]?.scope, "selection");
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("uses fixed conservative fallback for unknown markers and literal path attacks", async () => {
  const root = await temporaryRoot();
  try {
    const fixture = modelFixture("generation_a");
    await installBundle(root, fixture.rendered);
    await writeFile(path.join(root, ".blueprint", "codebase", ".publication.json"), JSON.stringify({version: 99, payload: "do-not-echo"}));
    const unknown = await resolveCodebaseNavigation(root);
    assert.equal(unknown.status, "fallback");
    assert.equal(unknown.portable.status, "unsupported");
    assert.doesNotMatch(JSON.stringify(unknown.diagnostics), /do-not-echo|generation_a/);
    await rm(path.join(root, ".blueprint", "codebase", ".publication.json"), {force: true});
    const unsafe = await resolveSelectedCodebaseEvidence(root, {kind: "page", path: "../outside", mode: "discovery"});
    assert.equal(unsafe.status, "invalid");
    assert.equal(unsafe.diagnostics[0]?.code, "unsafe-path");
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("keeps stale or renamed live sources outside the immutable map pin", async () => {
  const root = await temporaryRoot();
  try {
    const fixture = modelFixture("generation_a");
    await installBundle(root, fixture.rendered);
    await mkdir(path.join(root, "src"), {recursive: true});
    await writeFile(path.join(root, "src", "renamed.ts"), fixture.source.replace("Entry", "RenamedEntry"));
    const selected = await resolveSelectedCodebaseEvidence(root, {kind: "symbol", recordId: "symbol_entry"});
    assert.equal(selected.status, "ok");
    if (selected.status !== "ok") return;
    assert.equal(selected.sourceBindings[0]?.path, "src/entry.ts");
    assert.equal(selected.sourceBindings[0]?.fullFileHash, fixture.sourceHash);
    assert.equal(selected.entries.some(item => item.path === "src/entry.ts"), false, "resolver does not claim a fresh source read");
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
