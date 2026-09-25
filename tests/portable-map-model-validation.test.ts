import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";

import {CODEBASE_DOCUMENT_IDS} from "../src/mcp/codebase-authoring.js";
import {adaptPythonFile} from "../src/mcp/codebase-index/adapters/python.ts";
import {
  validatePortableMapModel,
  type PortableAuthoritativeSourceBasis
} from "../src/mcp/codebase-index/model-validation.js";

const FILE_HASH = "a".repeat(64);
const SYMBOL_HASH = "b".repeat(64);
const IMPORT_HASH = "c".repeat(64);
const RELATIONSHIP_HASH = "d".repeat(64);
const SOURCE_PATH = "src/index.ts";
const COORDINATE = {
  start: {line: 1, column: 0, byte: 0},
  end: {line: 1, column: 12, byte: 12}
};

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function details() {
  const firstText = "🙂".repeat(1024);
  const secondText = "tail";
  return [
    {
      id: "detail_1",
      sourceRecordId: "symbol_1",
      field: "signature" as const,
      segmentIndex: 0,
      segmentCount: 2,
      text: firstText,
      byteSize: Buffer.byteLength(firstText, "utf8"),
      contentHash: digest(firstText),
      previousSegmentId: null,
      nextSegmentId: "detail_2"
    },
    {
      id: "detail_2",
      sourceRecordId: "symbol_1",
      field: "signature" as const,
      segmentIndex: 1,
      segmentCount: 2,
      text: secondText,
      byteSize: Buffer.byteLength(secondText, "utf8"),
      contentHash: digest(secondText),
      previousSegmentId: "detail_1",
      nextSegmentId: null
    }
  ];
}

function structuralShards() {
  const fullDetailText = `${details()[0]!.text}${details()[1]!.text}`;
  return [
    {
      generationId: "gen_1",
      shardId: "shard_1",
      files: [{
        id: "file_1",
        path: SOURCE_PATH,
        language: "typescript" as const,
        role: "source" as const,
        byteSize: 64,
        contentHash: FILE_HASH,
        parseStatus: "parsed" as const,
        coverageStatus: "full" as const
      }],
      symbols: [{
        id: "symbol_1",
        fileId: "file_1",
        path: SOURCE_PATH,
        qualifiedName: "answer",
        kind: "constant" as const,
        coordinate: COORDINATE,
        contentHash: SYMBOL_HASH,
        lexicalParentId: null,
        exported: true,
        detailReferences: [{
          field: "signature" as const,
          firstSegmentId: "detail_1",
          segmentCount: 2,
          byteSize: Buffer.byteLength(fullDetailText, "utf8"),
          contentHash: digest(fullDetailText)
        }]
      }],
      imports: [],
      relationships: [],
      details: details()
    },
    {
      generationId: "gen_1",
      shardId: "shard_2",
      files: [],
      symbols: [],
      imports: [{
        id: "import_1",
        kind: "import" as const,
        sourceFileId: "file_1",
        sourcePath: SOURCE_PATH,
        specifier: "./answer",
        coordinate: COORDINATE,
        contentHash: IMPORT_HASH,
        resolutionStatus: "resolved" as const,
        targetFileId: "file_1",
        targetSymbolId: "symbol_1",
        origin: "syntax" as const,
        certainty: "observed" as const
      }],
      relationships: [{
        id: "relationship_1",
        kind: "references" as const,
        sourceFileId: "file_1",
        sourceSymbolId: "symbol_1",
        sourcePath: SOURCE_PATH,
        coordinate: COORDINATE,
        contentHash: RELATIONSHIP_HASH,
        resolutionStatus: "resolved" as const,
        targetFileId: "file_1",
        targetSymbolId: "symbol_1",
        origin: "syntax" as const,
        certainty: "observed" as const
      }]
    }
  ];
}

function evidence(kind: "file" | "symbol" | "relationship", recordId: string, contentHash: string) {
  return {
    kind,
    path: SOURCE_PATH,
    recordId,
    contentHash,
    coordinate: kind === "file" ? undefined : COORDINATE
  };
}

function submission() {
  const documents = Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, {
    summary: `${id} findings are grounded in the indexed source file.`,
    sections: [{heading: "Observed", content: `The ${id} view records the source-backed result.`}],
    evidencePaths: [SOURCE_PATH]
  }]));
  return {
    formatVersion: 1 as const,
    generationId: "gen_1",
    documents,
    semantic: {
      capabilities: [{
        id: "capability_1",
        name: "Answer export",
        summary: "Exports the answer constant from the source module.",
        claimIds: ["claim_1"],
        evidence: [evidence("symbol", "symbol_1", SYMBOL_HASH)]
      }],
      claims: [{
        id: "claim_1",
        basis: "observed" as const,
        statement: "The module exports the answer constant.",
        evidence: [evidence("symbol", "symbol_1", SYMBOL_HASH)]
      }],
      aliases: [{
        id: "alias_1",
        alias: "answer export",
        targetKind: "symbol" as const,
        targetId: "symbol_1",
        evidence: [evidence("file", "file_1", FILE_HASH)]
      }]
    }
  };
}

function sourceBasis(): PortableAuthoritativeSourceBasis {
  return {
    generationId: "gen_1",
    files: [{path: SOURCE_PATH, byteSize: 64, contentHash: FILE_HASH}],
    records: [
      {kind: "file", recordId: "file_1", path: SOURCE_PATH, contentHash: FILE_HASH},
      {kind: "symbol", recordId: "symbol_1", path: SOURCE_PATH, contentHash: SYMBOL_HASH, coordinate: COORDINATE},
      {kind: "import", recordId: "import_1", path: SOURCE_PATH, contentHash: IMPORT_HASH, coordinate: COORDINATE},
      {kind: "relationship", recordId: "relationship_1", path: SOURCE_PATH, contentHash: RELATIONSHIP_HASH, coordinate: COORDINATE}
    ]
  };
}

function fixture() {
  return {
    shards: structuralShards(),
    model: submission(),
    basis: sourceBasis()
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function codes(result: ReturnType<typeof validatePortableMapModel>): string[] {
  return result.ok ? [] : result.diagnostics.map(diagnostic => diagnostic.code);
}

test("accepts a complete joined model and reconstructs multibyte detail chains", () => {
  const input = fixture();
  const before = clone(input);
  const result = validatePortableMapModel(input.shards, input.model, input.basis);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(Object.keys(result.data.compiledDocuments).length, 7);
  assert.ok(result.data.compiledDocuments.stack.includes("## Evidence"));
  assert.deepEqual(input, before);
});

test("rejects source hash, unknown path, and unknown record id claims", () => {
  const hashMismatch = fixture();
  hashMismatch.basis.files[0]!.contentHash = "e".repeat(64);
  const hashResult = validatePortableMapModel(hashMismatch.shards, hashMismatch.model, hashMismatch.basis);
  assert.equal(hashResult.ok, false);
  assert.ok(codes(hashResult).includes("source-mismatch"));

  const unknownPath = fixture();
  unknownPath.model.documents.stack!.evidencePaths = ["src/missing.ts"];
  const pathResult = validatePortableMapModel(unknownPath.shards, unknownPath.model, unknownPath.basis);
  assert.equal(pathResult.ok, false);
  assert.ok(codes(pathResult).includes("invalid-document"));

  const unknownId = fixture();
  unknownId.model.semantic.claims[0]!.evidence[0]!.recordId = "symbol_missing";
  const idResult = validatePortableMapModel(unknownId.shards, unknownId.model, unknownId.basis);
  assert.equal(idResult.ok, false);
  assert.ok(codes(idResult).includes("invalid-evidence"));
});

test("rejects duplicate cross-shard ids and dangling import or relationship targets", () => {
  const duplicate = fixture();
  duplicate.shards[1]!.imports[0]!.id = "file_1";
  const duplicateResult = validatePortableMapModel(duplicate.shards, duplicate.model, duplicate.basis);
  assert.equal(duplicateResult.ok, false);
  assert.ok(codes(duplicateResult).includes("duplicate-id"));

  const dangling = fixture();
  dangling.shards[1]!.imports[0]!.targetSymbolId = "symbol_missing";
  dangling.shards[1]!.relationships[0]!.targetFileId = "file_missing";
  const danglingResult = validatePortableMapModel(dangling.shards, dangling.model, dangling.basis);
  assert.equal(danglingResult.ok, false);
  assert.ok(codes(danglingResult).includes("dangling-reference"));
});

test("rejects impossible lexical parents and coordinates outside authoritative file bytes", () => {
  const parentCycle = fixture();
  parentCycle.shards[0]!.symbols[0]!.lexicalParentId = "symbol_1";
  const cycleResult = validatePortableMapModel(parentCycle.shards, parentCycle.model, parentCycle.basis);
  assert.equal(cycleResult.ok, false);
  assert.ok(codes(cycleResult).includes("parent-cycle"));

  const range = fixture();
  const outOfRange = {...COORDINATE, end: {line: 1, column: 100, byte: 100}};
  range.shards[0]!.symbols[0]!.coordinate = outOfRange;
  range.basis.records[1]!.coordinate = outOfRange;
  const rangeResult = validatePortableMapModel(range.shards, range.model, range.basis);
  assert.equal(rangeResult.ok, false);
  assert.ok(codes(rangeResult).includes("invalid-coordinate"));
});

test("rejects missing, changed, swapped, orphaned, and hash-inconsistent detail chains", () => {
  const missing = fixture();
  missing.shards[0]!.details = [];
  const missingResult = validatePortableMapModel(missing.shards, missing.model, missing.basis);
  assert.equal(missingResult.ok, false);
  assert.ok(codes(missingResult).includes("invalid-detail-chain"));

  const changed = fixture();
  changed.shards[0]!.details![1]!.text = "changed";
  changed.shards[0]!.details![1]!.byteSize = Buffer.byteLength("changed", "utf8");
  changed.shards[0]!.details![1]!.contentHash = digest("changed");
  const changedResult = validatePortableMapModel(changed.shards, changed.model, changed.basis);
  assert.equal(changedResult.ok, false);
  assert.ok(codes(changedResult).includes("invalid-detail-chain"));

  const swapped = fixture();
  swapped.shards[0]!.details![0]!.nextSegmentId = "detail_1";
  const swappedResult = validatePortableMapModel(swapped.shards, swapped.model, swapped.basis);
  assert.equal(swappedResult.ok, false);
  assert.ok(codes(swappedResult).includes("invalid-detail-chain"));

  const orphan = fixture();
  orphan.shards[0]!.details!.push({
    id: "detail_orphan",
    sourceRecordId: "symbol_1",
    field: "signature",
    segmentIndex: 0,
    segmentCount: 1,
    text: "orphan",
    byteSize: 6,
    contentHash: digest("orphan"),
    previousSegmentId: null,
    nextSegmentId: null
  });
  const orphanResult = validatePortableMapModel(orphan.shards, orphan.model, orphan.basis);
  assert.equal(orphanResult.ok, false);
  assert.ok(codes(orphanResult).includes("invalid-detail-chain"));

  const badHash = fixture();
  badHash.shards[0]!.details![0]!.contentHash = "f".repeat(64);
  const badHashResult = validatePortableMapModel(badHash.shards, badHash.model, badHash.basis);
  assert.equal(badHashResult.ok, false);
  assert.ok(codes(badHashResult).includes("invalid-input"));
});

test("requires alias closure and source-backed evidence instead of compatibility prose", () => {
  const alias = fixture();
  alias.model.semantic.aliases[0]!.targetId = "symbol_missing";
  const aliasResult = validatePortableMapModel(alias.shards, alias.model, alias.basis);
  assert.equal(aliasResult.ok, false);
  assert.ok(codes(aliasResult).includes("dangling-reference"));

  const compatibility = fixture();
  compatibility.model.semantic.claims[0]!.evidence[0] = {
    kind: "compatibility-document",
    path: SOURCE_PATH,
    recordId: "document_stack",
    contentHash: FILE_HASH
  };
  const compatibilityResult = validatePortableMapModel(compatibility.shards, compatibility.model, compatibility.basis);
  assert.equal(compatibilityResult.ok, false);
  assert.ok(codes(compatibilityResult).includes("invalid-evidence"));
});

test("rejects unsafe authored and structural strings with bounded metadata-only diagnostics", () => {
  const sentinel = "ghp_model_validation_secret_1234567890";
  const authored = fixture();
  authored.model.semantic.claims[0]!.statement = `The source contains ${sentinel}`;
  const authoredResult = validatePortableMapModel(authored.shards, authored.model, authored.basis);
  assert.equal(authoredResult.ok, false);
  assert.ok(codes(authoredResult).includes("unsafe-content"));
  assert.doesNotMatch(JSON.stringify(authoredResult), new RegExp(sentinel));

  const structural = fixture();
  const unsafeDetail = `const token = '${sentinel}';`;
  structural.shards[0]!.details![1]!.text = unsafeDetail;
  structural.shards[0]!.details![1]!.byteSize = Buffer.byteLength(unsafeDetail, "utf8");
  structural.shards[0]!.details![1]!.contentHash = digest(unsafeDetail);
  const structuralResult = validatePortableMapModel(structural.shards, structural.model, structural.basis);
  assert.equal(structuralResult.ok, false);
  assert.ok(codes(structuralResult).includes("unsafe-content"));
  assert.doesNotMatch(JSON.stringify(structuralResult), new RegExp(sentinel));
});

test("requires all seven substantive documents and exact source evidence paths", () => {
  const missing = fixture();
  delete missing.model.documents.concerns;
  const missingResult = validatePortableMapModel(missing.shards, missing.model, missing.basis);
  assert.equal(missingResult.ok, false);
  assert.ok(codes(missingResult).includes("invalid-input"));

  const weak = fixture();
  weak.model.documents.testing.summary = "";
  const weakResult = validatePortableMapModel(weak.shards, weak.model, weak.basis);
  assert.equal(weakResult.ok, false);
  assert.ok(codes(weakResult).includes("invalid-input"));

  const evidence = fixture();
  evidence.model.documents.architecture.evidencePaths = ["src/unknown.ts"];
  const evidenceResult = validatePortableMapModel(evidence.shards, evidence.model, evidence.basis);
  assert.equal(evidenceResult.ok, false);
  assert.ok(codes(evidenceResult).includes("invalid-document"));
});

test("requires reciprocal canonical file and structural record closure", () => {
  const omittedFile = fixture();
  omittedFile.basis.files.push({path: "src/omitted.ts", byteSize: 10, contentHash: FILE_HASH});
  omittedFile.basis.records.push({kind: "file", recordId: "file_omitted", path: "src/omitted.ts", contentHash: FILE_HASH});
  const omittedResult = validatePortableMapModel(omittedFile.shards, omittedFile.model, omittedFile.basis);
  assert.equal(omittedResult.ok, false);
  assert.ok(codes(omittedResult).includes("incomplete-structure"));

  const omittedSymbol = fixture();
  omittedSymbol.basis.records.push({kind: "symbol", recordId: "symbol_missing", path: SOURCE_PATH, contentHash: SYMBOL_HASH, coordinate: COORDINATE});
  const missingResult = validatePortableMapModel(omittedSymbol.shards, omittedSymbol.model, omittedSymbol.basis);
  assert.equal(missingResult.ok, false);
  assert.ok(codes(missingResult).includes("incomplete-structure"));

  const duplicatePath = fixture();
  duplicatePath.shards[0]!.files.push({...duplicatePath.shards[0]!.files[0]!, id: "file_duplicate"});
  duplicatePath.basis.records.push({kind: "file", recordId: "file_duplicate", path: SOURCE_PATH, contentHash: FILE_HASH});
  const duplicateResult = validatePortableMapModel(duplicatePath.shards, duplicatePath.model, duplicatePath.basis);
  assert.equal(duplicateResult.ok, false);
  assert.ok(codes(duplicateResult).includes("duplicate-id"));
});

test("requires geometric lexical enclosure and consistent contains edges", () => {
  const outside = fixture();
  outside.shards[0]!.symbols[0]!.coordinate = {...COORDINATE, end: {line: 1, column: 12, byte: 12}};
  const childCoordinate = {start: {line: 1, column: 30, byte: 30}, end: {line: 1, column: 40, byte: 40}};
  outside.shards[0]!.symbols.push({
    id: "symbol_child", fileId: "file_1", path: SOURCE_PATH, qualifiedName: "answer.child", kind: "function",
    coordinate: childCoordinate, contentHash: SYMBOL_HASH, lexicalParentId: "symbol_1", exported: false
  });
  outside.basis.records.push({kind: "symbol", recordId: "symbol_child", path: SOURCE_PATH, contentHash: SYMBOL_HASH, coordinate: childCoordinate});
  const outsideResult = validatePortableMapModel(outside.shards, outside.model, outside.basis);
  assert.equal(outsideResult.ok, false);
  assert.ok(codes(outsideResult).includes("invalid-coordinate"));

  const mismatchedContains = fixture();
  const parentCoordinate = {start: {line: 1, column: 0, byte: 0}, end: {line: 1, column: 100, byte: 100}};
  const nestedCoordinate = {start: {line: 1, column: 30, byte: 30}, end: {line: 1, column: 40, byte: 40}};
  mismatchedContains.shards[0]!.symbols[0]!.coordinate = parentCoordinate;
  mismatchedContains.basis.records[1]!.coordinate = parentCoordinate;
  mismatchedContains.shards[0]!.symbols.push({
    id: "symbol_child", fileId: "file_1", path: SOURCE_PATH, qualifiedName: "answer.child", kind: "function",
    coordinate: nestedCoordinate, contentHash: SYMBOL_HASH, lexicalParentId: null, exported: false
  });
  mismatchedContains.shards[0]!.relationships.push({
    id: "relationship_contains", kind: "contains", sourceFileId: "file_1", sourceSymbolId: "symbol_1", sourcePath: SOURCE_PATH,
    coordinate: nestedCoordinate, contentHash: SYMBOL_HASH, resolutionStatus: "resolved", targetFileId: "file_1", targetSymbolId: "symbol_child",
    origin: "syntax", certainty: "observed"
  });
  mismatchedContains.basis.records.push({kind: "symbol", recordId: "symbol_child", path: SOURCE_PATH, contentHash: SYMBOL_HASH, coordinate: nestedCoordinate});
  mismatchedContains.basis.records.push({kind: "relationship", recordId: "relationship_contains", path: SOURCE_PATH, contentHash: SYMBOL_HASH, coordinate: nestedCoordinate});
  const containsResult = validatePortableMapModel(mismatchedContains.shards, mismatchedContains.model, mismatchedContains.basis);
  assert.equal(containsResult.ok, false);
  assert.ok(codes(containsResult).includes("source-mismatch"));
});

test("accepts adapter-produced containment when child and parent share an endpoint", async () => {
  const source = new TextEncoder().encode("class C:\n    def run(self) -> int:\n        return 1\n");
  const file = {
    id: "file_python", path: "src/containment.py", language: "python" as const, role: "source" as const,
    byteSize: source.byteLength, contentHash: digest(new TextDecoder().decode(source)),
    parseStatus: "skipped" as const, coverageStatus: "file" as const, limitationReason: "not-extracted" as const
  };
  const adapted = await adaptPythonFile({file, source});
  assert.equal(adapted.ok, true);
  if (!adapted.ok) return;
  const shard = {
    generationId: "gen_1", shardId: "shard_1", files: [adapted.file], symbols: adapted.symbols,
    imports: adapted.imports, relationships: adapted.relationships, details: adapted.details
  };
  const records = [
    {kind: "file" as const, recordId: adapted.file.id, path: adapted.file.path, contentHash: adapted.file.contentHash, coordinate: adapted.file.coordinate},
    ...adapted.symbols.map(symbol => ({kind: "symbol" as const, recordId: symbol.id, path: symbol.path, contentHash: symbol.contentHash, coordinate: symbol.coordinate})),
    ...adapted.imports.map(item => ({kind: "import" as const, recordId: item.id, path: item.sourcePath, contentHash: item.contentHash, coordinate: item.coordinate})),
    ...adapted.relationships.map(item => ({kind: "relationship" as const, recordId: item.id, path: item.sourcePath, contentHash: item.contentHash, coordinate: item.coordinate}))
  ];
  const model = fixture().model;
  for (const id of CODEBASE_DOCUMENT_IDS) model.documents[id].evidencePaths = [file.path];
  model.semantic = {capabilities: [], claims: [], aliases: []};
  const result = validatePortableMapModel([shard], model, {
    generationId: "gen_1", files: [{path: file.path, byteSize: file.byteSize, contentHash: file.contentHash}], records
  });
  assert.equal(result.ok, true);
});

test("checks reconstructed detail values at the content boundary", () => {
  const split = fixture();
  const chunks = ["x".repeat(4093) + " gh", "p_" + "a".repeat(36)];
  const full = chunks.join("");
  split.shards[0]!.details = chunks.map((text, index) => ({
    id: `detail_${index}`, sourceRecordId: "symbol_1", field: "signature" as const, segmentIndex: index, segmentCount: 2,
    text, byteSize: Buffer.byteLength(text, "utf8"), contentHash: digest(text), previousSegmentId: index === 0 ? null : "detail_0",
    nextSegmentId: index === 0 ? "detail_1" : null
  }));
  split.shards[0]!.symbols[0]!.detailReferences = [{field: "signature", firstSegmentId: "detail_0", segmentCount: 2, byteSize: Buffer.byteLength(full, "utf8"), contentHash: digest(full)}];
  const result = validatePortableMapModel(split.shards, split.model, split.basis);
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes("unsafe-content"));
  assert.doesNotMatch(JSON.stringify(result), new RegExp(full));
});

test("validates deep parent chains iteratively without overflowing the stack", () => {
  const input = fixture();
  const shards = input.shards as any[];
  for (const shard of shards) {
    shard.symbols = [];
    shard.imports = [];
    shard.relationships = [];
  }
  shards.push({generationId: "gen_1", shardId: "shard_3", files: [], symbols: [], imports: [], relationships: [], details: []});
  input.basis.records = input.basis.records.filter((record: any) => record.kind === "file");
  const count = 10_000;
  for (let index = 0; index < count; index += 1) {
    const id = index === 0 ? "symbol_1" : `deep_${index}`;
    const next = index === count - 1 ? null : (index + 1 === 0 ? "symbol_1" : `deep_${index + 1}`);
    const symbol = {
      id, fileId: "file_1", path: SOURCE_PATH, qualifiedName: `member${index}`, kind: "function" as const,
      coordinate: COORDINATE, contentHash: SYMBOL_HASH, lexicalParentId: next, exported: false
    };
    shards[Math.floor(index / 4000)]!.symbols.push(symbol);
    input.basis.records.push({kind: "symbol", recordId: id, path: SOURCE_PATH, contentHash: SYMBOL_HASH, coordinate: COORDINATE});
  }
  const result = validatePortableMapModel(shards, input.model, input.basis);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.length > 0);
});
