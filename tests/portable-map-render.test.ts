import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import path from "node:path";

import {CODEBASE_DOCUMENT_IDS} from "../src/mcp/codebase-authoring.js";
import {parsePortableRootDescriptor, parsePortableSemanticIndex, parsePortableSemanticShard, renderPortableMap, serializePortableRootDescriptor} from "../src/mcp/codebase-index/render.js";
import {validatePortableMapModel, type PortableAuthoritativeSourceBasis} from "../src/mcp/codebase-index/model-validation.js";

const digest = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
const fileHash = digest("file");
const unknownPath = `docs/${"long-name-".repeat(220)}.sql`;
const sourcePath = "src/entry.ts";
const coordinate = {start: {line: 1, column: 0, byte: 0}, end: {line: 1, column: 12, byte: 12}};

function fixture() {
  const symbols = Array.from({length: 36}, (_, index) => ({
    id: `symbol_${String(index).padStart(2, "0")}`,
    fileId: "file_main",
    path: sourcePath,
    qualifiedName: index === 0 ? "Entrée|🙂" : `EntryCoordinator.member${index}`,
    kind: index === 0 ? "class" as const : "method" as const,
    signature: index === 0 ? "class Entrée|🙂" : `member${index}(): string`,
    coordinate: index === 0 ? {start: {line: 1, column: 0, byte: 0}, end: {line: 1, column: 100, byte: 100}} : {start: {line: 1, column: 10 + index, byte: 10 + index}, end: {line: 1, column: 20 + index, byte: 20 + index}},
    contentHash: digest(`symbol-${index}`),
    lexicalParentId: index === 0 ? null : "symbol_00",
    exported: index === 0
  }));
  const files = [
    {
      id: "file_main",
      path: sourcePath,
      language: "typescript" as const,
      role: "source" as const,
      byteSize: 128,
      contentHash: fileHash,
      parseStatus: "parsed" as const,
      coverageStatus: "full" as const
    },
    {
      id: "file_unknown",
      path: unknownPath,
      language: "unknown" as const,
      role: "unknown" as const,
      byteSize: 64,
      contentHash: digest("unknown-file"),
      parseStatus: "unsupported" as const,
      coverageStatus: "file" as const,
      limitationReason: "unsupported-language" as const
    }
  ];
  const documents = Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, {
    summary: `${id} is grounded in the indexed TypeScript entrypoint and the unsupported file inventory.`,
    sections: [{heading: "Observed", content: `The ${id} view retains the accepted source-backed finding.`}],
    evidencePaths: [sourcePath, unknownPath]
  }]));
  const model = {
    formatVersion: 1 as const,
    generationId: "gen_render_1",
    documents,
    semantic: {
      capabilities: [{
        id: "capability_checkout",
        name: "Checkout | entry flow",
        summary: "Coordinates the accepted entry flow across the indexed declarations.",
        claimIds: ["claim_entry"],
        evidence: [{kind: "symbol" as const, path: sourcePath, recordId: "symbol_00", contentHash: digest("symbol-0"), coordinate: symbols[0]!.coordinate}]
      }],
      claims: [{
        id: "claim_entry",
        basis: "observed" as const,
        statement: "The exported entry declaration coordinates the flow.",
        evidence: [{kind: "symbol" as const, path: sourcePath, recordId: "symbol_00", contentHash: digest("symbol-0"), coordinate: symbols[0]!.coordinate}]
      }],
      aliases: [{
        id: "alias_basket",
        alias: "basket | entry 🙂",
        targetKind: "symbol" as const,
        targetId: "symbol_00",
        evidence: [{kind: "file" as const, path: sourcePath, recordId: "file_main", contentHash: fileHash}]
      }]
    }
  };
  const basis: PortableAuthoritativeSourceBasis = {
    generationId: "gen_render_1",
    files: [
      {path: sourcePath, byteSize: 128, contentHash: fileHash},
      {path: unknownPath, byteSize: 64, contentHash: digest("unknown-file")}
    ],
    records: [
      {kind: "file", recordId: "file_main", path: sourcePath, contentHash: fileHash},
      {kind: "file", recordId: "file_unknown", path: unknownPath, contentHash: digest("unknown-file")},
      ...symbols.map(symbol => ({kind: "symbol" as const, recordId: symbol.id, path: sourcePath, contentHash: symbol.contentHash, coordinate: symbol.coordinate}))
    ]
  };
  const shards = [{
    generationId: "gen_render_1",
    shardId: "structural_1",
    files,
    symbols,
    imports: [],
    relationships: []
  }];
  return {shards, model, basis};
}

function renderFixture() {
  const input = fixture();
  const before = structuredClone(input);
  const validated = validatePortableMapModel(input.shards, input.model, input.basis);
  assert.equal(validated.ok, true, validated.ok ? undefined : JSON.stringify(validated.diagnostics));
  if (!validated.ok) throw new Error("fixture should validate");
  const result = renderPortableMap(validated.data, {
    generationId: "gen_render_1",
    generatedAt: "2026-09-24T10:00:00+00:00",
    gitCommit: null,
    inventoryFingerprint: "a".repeat(64),
    parserAssets: [{name: "tree-sitter", version: "0.27.0", checksum: "b".repeat(64)}],
    predecessorGenerationId: null
  });
  assert.deepEqual(input, before);
  assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result.diagnostics));
  if (!result.ok) throw new Error("fixture should render");
  return result;
}

test("renders a deterministic complete bundle with bounded pages and seven views", () => {
  const first = renderFixture();
  const second = renderFixture();
  assert.deepEqual(Object.keys(first.files), Object.keys(second.files));
  for (const filePath of Object.keys(first.files)) assert.deepEqual(first.files[filePath], second.files[filePath], filePath);
  assert.ok(first.files["INDEX.md"]);
  assert.ok(first.files["generations/gen_render_1/ENTRY.md"]);
  assert.ok(first.files["generations/gen_render_1/manifest.json"]);
  assert.equal(Object.keys(first.rootViewBytes).length, 7);
  assert.equal(first.manifest.structuralCoverage.filesInventoried, 2);
  assert.equal(first.manifest.structuralCoverage.filesWithFileCoverage, 1);
  assert.equal(first.manifest.structuralCoverage.symbolsExtracted, 36);
  assert.equal(first.manifest.semanticCoverage.aliasesAccepted, 1);
  assert.equal(first.manifest.checksums.entry, first.sealedGeneration.entry.checksum);
  assert.equal(first.manifest.checksums.compatibility.stack.length, 64);
  assert.ok(Buffer.byteLength(new TextDecoder().decode(first.rootIndexBytes), "utf8") <= 4096);
  assert.ok(Buffer.byteLength(new TextDecoder().decode(first.entryBytes), "utf8") <= 4096);
  assert.ok(Object.keys(first.files).some(filePath => filePath.includes("data/")));
  const descriptor = parsePortableRootDescriptor(new TextDecoder().decode(first.rootIndexBytes));
  assert.deepEqual(descriptor, {
    version: 1,
    generationId: "gen_render_1",
    manifest: {path: "generations/gen_render_1/manifest.json", sha256: first.sealedGeneration.manifest.checksum},
    entry: {path: "generations/gen_render_1/ENTRY.md", sha256: first.sealedGeneration.entry.checksum}
  });
  assert.equal(parsePortableRootDescriptor(serializePortableRootDescriptor(descriptor!))?.generationId, "gen_render_1");
  const semanticData = Object.entries(first.files)
    .filter(([filePath]) => filePath.includes("/data/semantic-"))
    .map(([, bytes]) => new TextDecoder().decode(bytes)).join("\n");
  assert.match(semanticData, /capability_checkout/);
  assert.match(semanticData, /claim_entry/);
  assert.match(semanticData, /alias_basket/);
  assert.ok(Object.keys(first.files).some(filePath => filePath.includes("compatibility/STACK.md")));
});

test("keeps every link closed and every file, declaration, alias, and long path searchable", () => {
  const result = renderFixture();
  const paths = new Set(Object.keys(result.files));
  for (const [filePath, bytes] of Object.entries(result.files)) {
    if (!filePath.endsWith(".md")) continue;
    const markdown = new TextDecoder().decode(bytes);
    for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = decodeURIComponent(match[1]!.split("#", 1)[0]!);
      if (!target || target === "#") continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(filePath), target));
      assert.ok(paths.has(resolved), `${filePath} points to missing ${resolved}`);
    }
    for (const line of markdown.split("\n").filter(Boolean)) {
      if (line.startsWith("file | ") || line.startsWith("symbol | ") || line.startsWith("alias | ")) {
        assert.ok(Buffer.byteLength(line, "utf8") <= 2048, `${filePath} has an oversized hit`);
      }
    }
  }
  const search = Object.entries(result.files)
    .filter(([filePath]) => filePath.includes("/search/"))
    .map(([, bytes]) => new TextDecoder().decode(bytes)).join("\n");
  assert.match(search, /src\\\/entry\.ts|src\/entry\.ts/);
  assert.match(search, /Entrée/);
  assert.match(search, /basket/);
  const fullMap = Object.entries(result.files).map(([, bytes]) => new TextDecoder().decode(bytes)).join("\n");
  assert.match(fullMap, new RegExp(unknownPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("rejects invalid metadata with fixed bounded diagnostics and no input echo", () => {
  const input = fixture();
  const validated = validatePortableMapModel(input.shards, input.model, input.basis);
  assert.equal(validated.ok, true, validated.ok ? undefined : JSON.stringify(validated.diagnostics));
  if (!validated.ok) return;
  const secret = "PRIVATE-METADATA-DO-NOT-ECHO";
  const result = renderPortableMap(validated.data, {
    generationId: "other-generation",
    generatedAt: "not-a-date",
    gitCommit: null,
    inventoryFingerprint: secret,
    parserAssets: []
  } as never);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.diagnostics.length <= 128);
  assert.doesNotMatch(JSON.stringify(result.diagnostics), /PRIVATE-METADATA-DO-NOT-ECHO|not-a-date|other-generation/);
});

test("emits real bounded placeholders for empty semantic routes and rejects ambiguous descriptors", () => {
  const input = fixture();
  const model = structuredClone(input.model);
  model.semantic = {capabilities: [], claims: [], aliases: []};
  const validated = validatePortableMapModel(input.shards, model, input.basis);
  assert.equal(validated.ok, true, validated.ok ? undefined : JSON.stringify(validated.diagnostics));
  if (!validated.ok) return;
  const result = renderPortableMap(validated.data, {
    generationId: "gen_render_1",
    generatedAt: "2026-09-24T10:00:00+00:00",
    gitCommit: null,
    inventoryFingerprint: "a".repeat(64),
    parserAssets: []
  });
  assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result.diagnostics));
  if (!result.ok) return;
  for (const category of ["capabilities", "records", "search", "data", "compatibility"]) {
    assert.ok(result.files[`generations/gen_render_1/routes/${category}-001.md`], category);
  }
  const capabilities = new TextDecoder().decode(result.files["generations/gen_render_1/routes/capabilities-001.md"]);
  assert.match(capabilities, /No pages were emitted/);
  const descriptor = parsePortableRootDescriptor(new TextDecoder().decode(result.rootIndexBytes));
  assert.ok(descriptor);
  const marker = serializePortableRootDescriptor(descriptor!);
  assert.deepEqual(parsePortableRootDescriptor(`${marker}\nordinary prose\n`), descriptor);
  assert.equal(parsePortableRootDescriptor(`${marker}\n${marker}\n`), null);
  assert.equal(parsePortableRootDescriptor(`${marker} trailing prose`), null);
  assert.equal(parsePortableRootDescriptor(`prefix ${marker}`), null);
});

test("partitions maximum semantic evidence losslessly with linkable continuations", () => {
  const input = fixture();
  const model = structuredClone(input.model);
  const mediumPath = `src/${"namespace/".repeat(14)}é|[x].rb`;
  input.shards[0]!.files[1]!.path = mediumPath;
  input.basis.files[1]!.path = mediumPath;
  input.basis.records[1]!.path = mediumPath;
  for (const document of Object.values(model.documents)) document.evidencePaths = document.evidencePaths.map(path => path === unknownPath ? mediumPath : path);
  const evidence = Array.from({length: 32}, (_, index) => ({
    kind: "file" as const,
    path: index % 2 === 0 ? sourcePath : mediumPath,
    recordId: index % 2 === 0 ? "file_main" : "file_unknown",
    contentHash: index % 2 === 0 ? fileHash : digest("unknown-file")
  }));
  model.semantic.capabilities[0]!.evidence = evidence;
  model.semantic.claims[0]!.evidence = evidence;
  const validated = validatePortableMapModel(input.shards, model, input.basis);
  assert.equal(validated.ok, true, validated.ok ? undefined : JSON.stringify(validated.diagnostics));
  if (!validated.ok) return;
  const result = renderPortableMap(validated.data, {
    generationId: "gen_render_1",
    generatedAt: "2026-09-24T10:00:00+00:00",
    gitCommit: null,
    inventoryFingerprint: "a".repeat(64),
    parserAssets: []
  });
  assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result.diagnostics));
  if (!result.ok) return;
  const semanticFiles = Object.entries(result.files).filter(([filePath]) => filePath.includes("/data/semantic-") && !filePath.includes("/data/semantic-index-") && filePath.endsWith(".json"));
  assert.ok(semanticFiles.length > 1);
  const fragments = semanticFiles.flatMap(([, bytes]) => (JSON.parse(new TextDecoder().decode(bytes)) as {records: Array<{kind: string; recordId: string; evidenceStart: number; record: {evidence: unknown[]}; continuation: {previous: string | null; next: string | null}}>}).records);
  for (const part of fragments) {
    for (const continuation of [part.continuation.previous, part.continuation.next]) if (continuation) assert.ok(result.files[continuation]);
  }
  for (const kind of ["capability", "claim"]) {
    const parts = fragments.filter(part => part.kind === kind && part.recordId === (kind === "capability" ? "capability_checkout" : "claim_entry")).sort((left, right) => left.evidenceStart - right.evidenceStart);
    assert.deepEqual(parts.flatMap(part => part.record.evidence), evidence);
  }
  assert.ok(semanticFiles.every(([, bytes]) => bytes.byteLength <= 12 * 1024));
});

test("allocates forward structural locations before rendering paginated records", () => {
  const input = fixture();
  for (let index = 36; index < 100; index += 1) {
    const symbol = {
      id: `symbol_${String(index).padStart(2, "0")}`,
      fileId: "file_main",
      path: sourcePath,
      qualifiedName: `EntryCoordinator.member${index}`,
      kind: "method" as const,
      signature: `member${index}(): string`,
      coordinate,
      contentHash: digest(`forward-symbol-${index}`),
      lexicalParentId: null,
      exported: false
    };
    input.shards[0]!.symbols.push(symbol);
    input.basis.records.push({kind: "symbol", recordId: symbol.id, path: sourcePath, contentHash: symbol.contentHash, coordinate});
  }
  const relationship = {
    id: "a_rel_forward",
    kind: "references" as const,
    sourceFileId: "file_main",
    sourceSymbolId: "symbol_00",
    sourcePath,
    coordinate,
    contentHash: digest("forward-relationship"),
    resolutionStatus: "resolved" as const,
    targetFileId: "file_main",
    targetSymbolId: "symbol_99",
    origin: "syntax" as const,
    certainty: "observed" as const
  };
  input.shards[0]!.relationships.push(relationship);
  input.basis.records.push({kind: "relationship", recordId: relationship.id, path: sourcePath, contentHash: relationship.contentHash, coordinate});
  const validated = validatePortableMapModel(input.shards, input.model, input.basis);
  assert.equal(validated.ok, true, validated.ok ? undefined : JSON.stringify(validated.diagnostics));
  if (!validated.ok) return;
  const result = renderPortableMap(validated.data, {
    generationId: "gen_render_1",
    generatedAt: "2026-09-24T10:00:00+00:00",
    gitCommit: null,
    inventoryFingerprint: "a".repeat(64),
    parserAssets: []
  });
  assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result.diagnostics));
  if (!result.ok) return;
  const recordPages = Object.entries(result.files).filter(([filePath]) => filePath.includes("/records/") && filePath.endsWith(".md"));
  assert.ok(recordPages.length > 1);
  const relationPage = recordPages.find(([, bytes]) => new TextDecoder().decode(bytes).includes("relationship-a_rel_forward"));
  assert.ok(relationPage);
  assert.match(new TextDecoder().decode(relationPage![1]), /target symbol: .*#symbol-symbol_99/u);
});

test("uses path-prefix and range labels for high-fanout record routes", () => {
  const input = fixture();
  for (let index = 36; index < 520; index += 1) {
    const symbol = {
      id: `symbol_${String(index).padStart(3, "0")}`,
      fileId: "file_main",
      path: sourcePath,
      qualifiedName: `EntryCoordinator.member${index}`,
      kind: "method" as const,
      signature: `member${index}(): string`,
      coordinate,
      contentHash: digest(`route-symbol-${index}`),
      lexicalParentId: null,
      exported: false
    };
    input.shards[0]!.symbols.push(symbol);
    input.basis.records.push({kind: "symbol", recordId: symbol.id, path: sourcePath, contentHash: symbol.contentHash, coordinate});
  }
  const validated = validatePortableMapModel(input.shards, input.model, input.basis);
  assert.equal(validated.ok, true, validated.ok ? undefined : JSON.stringify(validated.diagnostics));
  if (!validated.ok) return;
  const result = renderPortableMap(validated.data, {
    generationId: "gen_render_1",
    generatedAt: "2026-09-24T10:00:00+00:00",
    gitCommit: null,
    inventoryFingerprint: "a".repeat(64),
    parserAssets: []
  });
  assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result.diagnostics));
  if (!result.ok) return;
  const routePages = Object.entries(result.files).filter(([filePath]) => filePath.includes("/routes/records-") && filePath.endsWith(".md"));
  assert.ok(routePages.length > 1);
  const routeDirectory = new TextDecoder().decode(result.files["generations/gen_render_1/routes/records-001.md"]);
  assert.match(routeDirectory, /records-(?:leaf|branch)-/u);
  assert.doesNotMatch(routeDirectory, /Next route page/u);
  const routeTargets = [...routeDirectory.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)].map(match => match[1]!);
  assert.ok(routeTargets.length > 1);
  for (const targetLink of routeTargets) {
    const target = path.posix.normalize(path.posix.join("generations/gen_render_1/routes", decodeURIComponent(targetLink)));
    assert.ok(result.files[target], target);
  }
  const labels = routePages.flatMap(([, bytes]) => [...new TextDecoder().decode(bytes).matchAll(/^- \[([^\]]+)\]\(/gmu)].map(match => match[1]!));
  assert.ok(labels.some(label => label.includes("path prefix src")));
  assert.ok(labels.some(label => /range \d{3}/u.test(label)));
});

test("renders and reconstructs many small semantic records under the model packet cap", () => {
  const input = fixture();
  const model = structuredClone(input.model);
  const evidence = [{kind: "file" as const, path: sourcePath, recordId: "file_main", contentHash: fileHash}];
  const claims = Array.from({length: 100}, (_, index) => ({
    id: `claim_${String(index).padStart(3, "0")}`,
    basis: "observed" as const,
    statement: `Accepted small claim ${index} retains its canonical evidence.`,
    evidence
  }));
  model.semantic.claims = claims;
  model.semantic.capabilities[0]!.claimIds = claims.map(claim => claim.id);
  model.semantic.aliases = [];
  assert.ok(Buffer.byteLength(JSON.stringify(model), "utf8") <= 48 * 1024);
  const validated = validatePortableMapModel(input.shards, model, input.basis);
  assert.equal(validated.ok, true, validated.ok ? undefined : JSON.stringify(validated.diagnostics));
  if (!validated.ok) return;
  const result = renderPortableMap(validated.data, {
    generationId: "gen_render_1",
    generatedAt: "2026-09-24T10:00:00+00:00",
    gitCommit: null,
    inventoryFingerprint: "a".repeat(64),
    parserAssets: []
  });
  assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result.diagnostics));
  if (!result.ok) return;
  const semanticShardFiles = Object.entries(result.files).filter(([filePath]) => /\/data\/semantic-\d{3}\.json$/u.test(filePath));
  const semanticIndexFiles = Object.entries(result.files).filter(([filePath]) => /\/data\/semantic-index-\d{3}\.json$/u.test(filePath));
  assert.ok(semanticShardFiles.length > 1);
  assert.ok(semanticIndexFiles.length > 1);
  assert.ok([...semanticShardFiles, ...semanticIndexFiles].every(([, bytes]) => bytes.byteLength <= 12 * 1024));
  const fragments = semanticShardFiles.flatMap(([, bytes]) => parsePortableSemanticShard(new TextDecoder().decode(bytes))?.records ?? []);
  const claimIds = fragments.filter(fragment => fragment.kind === "claim").map(fragment => fragment.recordId).sort();
  assert.deepEqual(claimIds, claims.map(claim => claim.id).sort());
  const indexes = semanticIndexFiles.map(([, bytes]) => parsePortableSemanticIndex(new TextDecoder().decode(bytes))).filter((index): index is NonNullable<typeof index> => Boolean(index));
  assert.equal(indexes.reduce((count, index) => count + index.entries.length, 0), 101);
  for (const index of indexes) for (const target of [index.continuation.previous, index.continuation.next]) if (target) assert.ok(result.files[target]);
  const capabilityRoute = new TextDecoder().decode(result.files["generations/gen_render_1/routes/capabilities-001.md"]);
  assert.match(capabilityRoute, /Checkout/u);
});

test("packs escaped route leaves and directories by final UTF-8 bytes", () => {
  const input = fixture();
  for (let index = 0; index < 30; index += 1) {
    const filePath = `pkg${"[".repeat(210)}/src/file-${String(index).padStart(2, "0")}.ts`;
    const file = {
      id: `file_bracket_${String(index).padStart(2, "0")}`,
      path: filePath,
      language: "unknown" as const,
      role: "unknown" as const,
      byteSize: 10,
      contentHash: digest(filePath),
      parseStatus: "unsupported" as const,
      coverageStatus: "file" as const,
      limitationReason: "unsupported-language" as const
    };
    input.shards[0]!.files.push(file);
    input.basis.files.push({path: filePath, byteSize: file.byteSize, contentHash: file.contentHash});
    input.basis.records.push({kind: "file", recordId: file.id, path: filePath, contentHash: file.contentHash});
  }
  const validated = validatePortableMapModel(input.shards, input.model, input.basis);
  assert.equal(validated.ok, true, validated.ok ? undefined : JSON.stringify(validated.diagnostics));
  if (!validated.ok) return;
  const result = renderPortableMap(validated.data, {
    generationId: "gen_render_1",
    generatedAt: "2026-09-24T10:00:00+00:00",
    gitCommit: null,
    inventoryFingerprint: "a".repeat(64),
    parserAssets: []
  });
  assert.equal(result.ok, true, result.ok ? undefined : JSON.stringify(result.diagnostics));
  if (!result.ok) return;
  const routeFiles = Object.entries(result.files).filter(([filePath]) => filePath.includes("/routes/") && filePath.endsWith(".md"));
  assert.ok(routeFiles.length > 1);
  for (const [filePath, bytes] of routeFiles) {
    assert.ok(bytes.byteLength <= 8192, filePath);
    const markdown = new TextDecoder().decode(bytes);
    const links = [...markdown.matchAll(/^- \[[^\n]+\]\(([^)]+)\)$/gmu)];
    assert.ok(links.length <= 24, filePath);
    for (const match of links) {
      const target = decodeURIComponent(match[1]!.split("#", 1)[0]!);
      if (!target || target === "#") continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(filePath), target));
      assert.ok(result.files[resolved], `${filePath} points to missing ${resolved}`);
    }
  }
  const routeText = routeFiles.map(([, bytes]) => new TextDecoder().decode(bytes)).join("\n");
  assert.match(routeText, /\\\[/u);
  assert.match(routeText, /…/u);
  assert.doesNotMatch(routeText, /group p-[0-9a-f]{12}/u);
});
