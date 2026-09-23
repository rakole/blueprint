import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";

import {
  CODEBASE_DOCUMENT_IDS,
  codebaseDocumentModelSchema
} from "../src/mcp/codebase-authoring.js";
import {
  PORTABLE_MAP_BYTE_LIMITS,
  PORTABLE_MAP_FORMAT_VERSION,
  PORTABLE_MAP_MAX_MODEL_PACKET_BYTES,
  PORTABLE_MAP_OPERATION_METADATA_VERSION,
  PORTABLE_MAP_PUBLICATION_MARKER_VERSION,
  portableAcceptedSemanticModelSchema,
  portableCompleteCodebaseMapModelSchema,
  portableContractIssues,
  portableFileRecordSchema,
  portableGenerationManifestSchema,
  portableModelPacketSchema,
  portableOperationMetadataSchema,
  portablePublicationMarkerSchema,
  portablePreparedOperationMetadataSchema,
  portableStructuralCoverageSchema,
  portableSourceCoordinateSchema,
  portableStructuralInventorySchema,
  portableMapSubmissionSchema,
  repositoryRelativePathSchema,
  serializedUtf8ByteLength,
  utf8ByteLength
} from "../src/mcp/codebase-index/contracts.js";

const HASH = "a".repeat(64);
const COORDINATE = {
  start: { line: 1, column: 0, byte: 0 },
  end: { line: 2, column: 4, byte: 12 }
};
const EVIDENCE = {
  kind: "file" as const,
  path: "src/index.ts",
  recordId: "file_1",
  contentHash: HASH
};

function fileRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "file_1",
    path: "src/index.ts",
    language: "typescript",
    role: "source",
    byteSize: 12,
    contentHash: HASH,
    parseStatus: "parsed",
    coverageStatus: "full",
    ...overrides
  };
}

function semanticModel() {
  return {
    capabilities: [{
      id: "cap_1",
      name: "Routing",
      summary: "Routes requests to handlers.",
      claimIds: ["claim_1"],
      evidence: [EVIDENCE]
    }],
    claims: [{
      id: "claim_1",
      basis: "observed",
      statement: "The router dispatches requests.",
      evidence: [EVIDENCE]
    }],
    aliases: [{
      id: "alias_1",
      alias: "request routing",
      targetKind: "capability",
      targetId: "cap_1",
      evidence: [EVIDENCE]
    }]
  };
}

function sevenViews() {
  return Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, {
    summary: `${id} findings.`,
    evidencePaths: ["src/index.ts"]
  }]));
}

test("source-owned versions and byte limits are explicit", () => {
  assert.equal(PORTABLE_MAP_FORMAT_VERSION, 1);
  assert.equal(PORTABLE_MAP_PUBLICATION_MARKER_VERSION, 2);
  assert.equal(PORTABLE_MAP_OPERATION_METADATA_VERSION, 2);
  assert.equal(PORTABLE_MAP_BYTE_LIMITS.modelPacket, 48 * 1024);
  assert.equal(PORTABLE_MAP_MAX_MODEL_PACKET_BYTES, 48 * 1024);
  assert.equal(utf8ByteLength("🙂"), 4);
  assert.equal(serializedUtf8ByteLength({ text: "🙂" }), Buffer.byteLength(JSON.stringify({ text: "🙂" }), "utf8"));
});

test("coordinates are ordered and carry line, column, and byte positions", () => {
  assert.equal(portableSourceCoordinateSchema.safeParse(COORDINATE).success, true);
  assert.equal(portableSourceCoordinateSchema.safeParse({
    start: { line: 4, column: 0, byte: 20 },
    end: { line: 3, column: 0, byte: 19 }
  }).success, false);
  assert.equal(portableSourceCoordinateSchema.safeParse({
    start: { line: 2, column: 0, byte: 20 },
    end: { line: 3, column: 0, byte: 19 }
  }).success, false);
  assert.equal(portableSourceCoordinateSchema.safeParse({
    start: { line: 2, column: 4, byte: 20 },
    end: { line: 2, column: 3, byte: 21 }
  }).success, false);
  assert.equal(portableSourceCoordinateSchema.safeParse({ ...COORDINATE, extra: true }).success, false);
});

test("paths reject every rendered control byte and file records enforce coverage state", () => {
  assert.equal(repositoryRelativePathSchema.safeParse("src/ok.ts").success, true);
  assert.equal(repositoryRelativePathSchema.safeParse("src/has\t-tab.ts").success, false);
  assert.equal(repositoryRelativePathSchema.safeParse("src/has\u001b-escape.ts").success, false);
  assert.equal(portableFileRecordSchema.safeParse(fileRecord()).success, true);
  assert.equal(portableFileRecordSchema.safeParse(fileRecord({ path: "../secret.ts" })).success, false);
  assert.equal(portableFileRecordSchema.safeParse(fileRecord({ contentHash: "secret" })).success, false);
  assert.equal(portableFileRecordSchema.safeParse(fileRecord({ coverageStatus: "file" })).success, false);
  assert.equal(portableFileRecordSchema.safeParse(fileRecord({ coverageStatus: "file", limitationReason: "none" })).success, false);
  assert.equal(portableFileRecordSchema.safeParse(fileRecord({ parseStatus: "partial", coverageStatus: "file", limitationReason: "parse-error" })).success, true);
  assert.equal(portableFileRecordSchema.safeParse(fileRecord({ parseStatus: "unsupported", coverageStatus: "none", limitationReason: "unsupported-language" })).success, true);
  assert.equal(portableFileRecordSchema.safeParse(fileRecord({ parseStatus: "skipped", coverageStatus: "file", limitationReason: "too-large" })).success, true);
  assert.equal(portableFileRecordSchema.safeParse(fileRecord({ parseStatus: "skipped", coverageStatus: "file", limitationReason: "not-extracted" })).success, true);
  assert.equal(portableFileRecordSchema.safeParse(fileRecord({ parseStatus: "failed", coverageStatus: "full" })).success, false);
  assert.equal(portableFileRecordSchema.safeParse(fileRecord({ extra: "ignored" })).success, false);
});

test("structural coverage counts cannot overstate file coverage", () => {
  assert.equal(portableStructuralCoverageSchema.safeParse({
    filesInventoried: 1, filesWithFullCoverage: 1, filesWithFileCoverage: 0,
    symbolsExtracted: 0, importsExtracted: 0, relationshipsExtracted: 0
  }).success, true);
  assert.equal(portableStructuralCoverageSchema.safeParse({
    filesInventoried: 1, filesWithFullCoverage: 1, filesWithFileCoverage: 1,
    symbolsExtracted: 0, importsExtracted: 0, relationshipsExtracted: 0
  }).success, false);
});

test("structural inventory is bounded, strict, and supports explicit unresolved relationships", () => {
  const parsed = portableStructuralInventorySchema.safeParse({
    generationId: "gen_1",
    shardId: "shard_1",
    files: [fileRecord()],
    symbols: [],
    imports: [{
      id: "import_1",
      kind: "import",
      sourceFileId: "file_1",
      sourcePath: "src/index.ts",
      specifier: "./missing",
      coordinate: COORDINATE,
      contentHash: HASH,
      resolutionStatus: "unresolved",
      targetFileId: null,
      targetSymbolId: null,
      unresolvedReason: "missing-target",
      origin: "syntax",
      certainty: "observed"
    }],
    relationships: [],
    continuation: { cursor: "cursor_1", hasMore: true }
  });
  assert.equal(parsed.success, true);
  assert.equal(portableStructuralInventorySchema.safeParse({
    generationId: "gen_1", shardId: "shard_1", files: [], symbols: [], imports: [], relationships: [],
    continuation: { cursor: null, hasMore: true }
  }).success, false);
});

test("accepted semantic records require exact evidence and close capability claim references", () => {
  assert.equal(portableAcceptedSemanticModelSchema.safeParse(semanticModel()).success, true);
  assert.equal(portableAcceptedSemanticModelSchema.safeParse({
    ...semanticModel(),
    capabilities: [{ ...semanticModel().capabilities[0], claimIds: ["missing"] }]
  }).success, false);
  assert.equal(portableAcceptedSemanticModelSchema.safeParse({
    ...semanticModel(),
    claims: [{ ...semanticModel().claims[0], evidence: [] }]
  }).success, false);
  assert.equal(portableAcceptedSemanticModelSchema.safeParse({ ...semanticModel(), extra: "authored" }).success, false);
});

test("portable submissions require all seven existing codebase views", () => {
  const views = sevenViews();
  assert.equal(portableCompleteCodebaseMapModelSchema.safeParse(views).success, true);
  assert.equal(portableMapSubmissionSchema.safeParse({
    formatVersion: 1,
    generationId: "gen_1",
    documents: views,
    semantic: semanticModel()
  }).success, true);
  const missing = { ...views } as Record<string, unknown>;
  delete missing.concerns;
  assert.equal(portableCompleteCodebaseMapModelSchema.safeParse(missing).success, false);
  assert.equal(portableMapSubmissionSchema.safeParse({
    formatVersion: 1,
    generationId: "gen_1",
    documents: missing,
    semantic: semanticModel()
  }).success, false);
  assert.equal(codebaseDocumentModelSchema.safeParse(views.stack).success, true);
});

test("manifest carries checksums, coverage, provenance, and sharded inventory metadata", () => {
  const manifest = {
    formatVersion: 1,
    protocolVersion: 1,
    generationId: "gen_1",
    generatedAt: "2026-09-23T00:00:00.000Z",
    gitCommit: "a".repeat(40),
    inventoryFingerprint: HASH,
    structuralCoverage: {
      filesInventoried: 1, filesWithFullCoverage: 1, filesWithFileCoverage: 0,
      symbolsExtracted: 0, importsExtracted: 0, relationshipsExtracted: 0
    },
    semanticCoverage: { capabilitiesAccepted: 1, claimsAccepted: 1, aliasesAccepted: 1, evidenceDependencies: 1 },
    parserAssets: [{ name: "typescript", version: "1.0.0", checksum: HASH }],
    inventoryShards: [{ shardId: "shard_1", path: "data/files-1.json", recordKind: "files", recordCount: 1, byteSize: 100, checksum: HASH }],
    checksums: {
      entry: HASH,
      pages: [{ path: "ENTRY.md", checksum: HASH }],
      compatibility: Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, HASH]))
    },
    evidenceDependencies: [EVIDENCE],
    predecessorGenerationId: null
  };
  assert.equal(portableGenerationManifestSchema.safeParse(manifest).success, true);
  assert.equal(portableGenerationManifestSchema.safeParse({ ...manifest, inventoryShards: [] }).success, false);
  assert.equal(portableGenerationManifestSchema.safeParse({ ...manifest, unexpected: "content" }).success, false);
});

test("prepared operation metadata is separate from v2 publication markers", () => {
  const prepared = {
    version: 2,
    operationId: "op_1",
    stage: "prepared",
    generationId: "gen_1",
    previousGenerationId: null,
    previousIndexHash: null,
    sourceBasis: { rootHash: HASH, inventoryHash: HASH, evidenceHash: HASH },
    targetHashes: Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, null])),
    createdAt: "2026-09-23T00:00:00.000Z"
  };
  assert.equal(portableOperationMetadataSchema.safeParse(prepared).success, true);
  assert.equal(portablePreparedOperationMetadataSchema.safeParse(prepared).success, true);

  const marker = {
    version: 2,
    operationId: "op_1",
    transactionId: "txn_1",
    stage: "publishing",
    generationId: "gen_1",
    previousGenerationId: null,
    previousIndexHash: null,
    nextIndexHash: HASH,
    sourceBasis: { rootHash: HASH, inventoryHash: HASH, evidenceHash: HASH },
    targetHashes: Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, null])),
    createdAt: "2026-09-23T00:00:00.000Z"
  };
  assert.equal(portablePublicationMarkerSchema.safeParse(marker).success, true);
  assert.equal(portablePublicationMarkerSchema.safeParse({ ...marker, stage: "prepared", nextIndexHash: undefined }).success, false);
  assert.equal(portablePublicationMarkerSchema.safeParse({ ...marker, model: { statement: "secret" } }).success, false);
});

test("model packets measure serialized UTF-8 bytes and reject without truncation", () => {
  const base = {
    packetVersion: 1,
    operationId: "op_1",
    generationId: "gen_1",
    selectedFiles: [fileRecord()],
    selectedSymbols: [],
    selectedImports: [],
    selectedRelationships: [],
    selectedCapabilities: [],
  };
  assert.equal(portableModelPacketSchema.safeParse(base).success, true);
  const oversized = {
    ...base,
    selectedCapabilities: Array.from({length: 30}, (_, index) => ({
      id: `cap_${index}`,
      name: "Capability",
      summary: "🙂".repeat(1_000)
    }))
  };
  const result = portableModelPacketSchema.safeParse(oversized);
  assert.equal(result.success, false);
  if (!result.success) {
    const issues = portableContractIssues(result.error);
    assert.ok(issues.some(issue => issue.code === "too-large"));
    assert.ok(issues.some(issue => issue.path === "model-packet"));
    assert.doesNotMatch(JSON.stringify(issues), /🙂/);
  }
  assert.ok(serializedUtf8ByteLength(oversized) > PORTABLE_MAP_MAX_MODEL_PACKET_BYTES);
});

test("contract diagnostics never echo unknown keys or rejected values", () => {
  const sentinelKey = "PRIVATE_REJECTED_KEY_SENTINEL";
  const sentinelValue = "PRIVATE_REJECTED_VALUE_SENTINEL";
  const unknown = portableModelPacketSchema.safeParse({
    packetVersion: 1,
    operationId: "op_1",
    generationId: "gen_1",
    selectedFiles: [],
    selectedSymbols: [],
    selectedImports: [],
    selectedRelationships: [],
    selectedCapabilities: [],
    [sentinelKey]: sentinelValue
  });
  assert.equal(unknown.success, false);
  if (!unknown.success) {
    const rendered = JSON.stringify(portableContractIssues(unknown.error));
    assert.doesNotMatch(rendered, new RegExp(sentinelKey));
    assert.doesNotMatch(rendered, new RegExp(sentinelValue));
  }

  const invalid = portableModelPacketSchema.safeParse({
    packetVersion: 1,
    operationId: "op_1",
    generationId: "gen_1",
    selectedFiles: [{...fileRecord(), path: `../${sentinelValue}`}],
    selectedSymbols: [],
    selectedImports: [],
    selectedRelationships: [],
    selectedCapabilities: []
  });
  assert.equal(invalid.success, false);
  if (!invalid.success) {
    const rendered = JSON.stringify(portableContractIssues(invalid.error));
    assert.doesNotMatch(rendered, new RegExp(sentinelValue));
  }
});

test("the pilot manifest and structural shard satisfy public contracts", async () => {
  const fixtureRoot = path.join(process.cwd(), "tests/fixtures/portable-map-pilot/bundle/generations/gen-001");
  const manifest = JSON.parse(await readFile(path.join(fixtureRoot, "manifest.json"), "utf8"));
  const parsedManifest = portableGenerationManifestSchema.safeParse(manifest);
  assert.equal(parsedManifest.success, true);
  const inventory = JSON.parse(await readFile(path.join(fixtureRoot, "data/files.json"), "utf8"));
  const parsedInventory = portableStructuralInventorySchema.safeParse(inventory);
  assert.equal(parsedInventory.success, true);
});
