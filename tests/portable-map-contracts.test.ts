import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
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
  PORTABLE_MAP_MAX_STRUCTURAL_DETAIL_SEGMENT_BYTES,
  PORTABLE_MAP_OPERATION_METADATA_VERSION,
  PORTABLE_MAP_PUBLICATION_MARKER_VERSION,
  PORTABLE_MAP_COORDINATE_CONVENTION,
  portableAcceptedSemanticModelSchema,
  portableCompleteCodebaseMapModelSchema,
  portableContractIssues,
  portableFileRecordSchema,
  portableGenerationManifestSchema,
  portableModelPacketSchema,
  portableOperationMetadataSchema,
  portablePublicationMarkerSchema,
  portablePreparedOperationMetadataSchema,
  portableStructuralDetailRecordSchema,
  portableStructuralCoverageSchema,
  portableSourceCoordinateSchema,
  portableSymbolRecordSchema,
  portableStructuralInventorySchema,
  portableMapSubmissionSchema,
  portableV1BackupReferenceSchema,
  portablePredecessorPublicationProofSchema,
  portableSealedGenerationReferenceSchema,
  repositoryRelativePathSchema,
  serializedUtf8ByteLength,
  utf8ByteLength
} from "../src/mcp/codebase-index/contracts.js";

const HASH = "a".repeat(64);
function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
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
  assert.equal(PORTABLE_MAP_MAX_STRUCTURAL_DETAIL_SEGMENT_BYTES, 4 * 1024);
  assert.deepEqual(PORTABLE_MAP_COORDINATE_CONVENTION, {
    line: "one-based",
    column: "zero-based-utf8-byte",
    byte: "zero-based-utf8-byte-offset",
    range: "end-exclusive"
  });
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
  assert.equal(portableSourceCoordinateSchema.safeParse({
    start: { line: 1, column: 4, byte: 4 },
    end: { line: 1, column: 4, byte: 4 }
  }).success, true);
  assert.equal(portableSourceCoordinateSchema.safeParse({
    start: { line: 1, column: 0, byte: Number.MAX_SAFE_INTEGER },
    end: { line: 1, column: 1, byte: Number.MAX_SAFE_INTEGER }
  }).success, true);
  assert.equal(portableSourceCoordinateSchema.safeParse({
    start: { line: 1, column: 0, byte: Number.MAX_SAFE_INTEGER + 1 },
    end: { line: 1, column: 1, byte: Number.MAX_SAFE_INTEGER + 1 }
  }).success, false);
  assert.equal(portableSourceCoordinateSchema.safeParse({
    start: { line: 10_000_001, column: 0, byte: 20_000_000 },
    end: { line: 10_000_001, column: 0, byte: 20_000_000 }
  }).success, true);
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
  assert.equal(portableFileRecordSchema.safeParse(fileRecord({ parseStatus: "partial", coverageStatus: "file", limitationReason: "unsafe-content" })).success, true);
  assert.equal(portableFileRecordSchema.safeParse(fileRecord({ parseStatus: "partial", coverageStatus: "file", limitationReason: "unsupported-construct" })).success, true);
  assert.equal(portableFileRecordSchema.safeParse(fileRecord({ parseStatus: "unsupported", coverageStatus: "none", limitationReason: "unsupported-language" })).success, true);
  assert.equal(portableFileRecordSchema.safeParse(fileRecord({ parseStatus: "skipped", coverageStatus: "file", limitationReason: "too-large" })).success, true);
  assert.equal(portableFileRecordSchema.safeParse(fileRecord({ parseStatus: "skipped", coverageStatus: "file", limitationReason: "not-extracted" })).success, true);
  assert.equal(portableFileRecordSchema.safeParse(fileRecord({ parseStatus: "failed", coverageStatus: "full" })).success, false);
  assert.equal(portableFileRecordSchema.safeParse(fileRecord({ extra: "ignored" })).success, false);
  assert.equal(portableFileRecordSchema.safeParse(fileRecord({ byteSize: 2_000_000_000 })).success, true);
  assert.equal(portableFileRecordSchema.safeParse(fileRecord({ byteSize: Number.MAX_SAFE_INTEGER })).success, true);
  assert.equal(portableFileRecordSchema.safeParse(fileRecord({ byteSize: Number.MAX_SAFE_INTEGER + 1 })).success, false);
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

test("oversized structural names use lossless bounded detail chains", () => {
  const firstText = "🙂".repeat(1024); // exactly 4 KiB of UTF-8 bytes
  const secondText = "x".repeat(1024);
  const first = {
    id: "detail_1",
    sourceRecordId: "symbol_1",
    field: "qualifiedName" as const,
    segmentIndex: 0,
    segmentCount: 2,
    text: firstText,
    byteSize: utf8ByteLength(firstText),
    contentHash: digest(firstText),
    previousSegmentId: null,
    nextSegmentId: "detail_2"
  };
  const second = {
    id: "detail_2",
    sourceRecordId: "symbol_1",
    field: "qualifiedName" as const,
    segmentIndex: 1,
    segmentCount: 2,
    text: secondText,
    byteSize: utf8ByteLength(secondText),
    contentHash: digest(secondText),
    previousSegmentId: "detail_1",
    nextSegmentId: null
  };
  assert.ok(utf8ByteLength(`${firstText}${secondText}`) > 1024);
  assert.equal(portableStructuralDetailRecordSchema.safeParse(first).success, true);
  assert.equal(portableStructuralDetailRecordSchema.safeParse(second).success, true);
  assert.equal(portableStructuralDetailRecordSchema.safeParse({ ...first, contentHash: HASH }).success, false);
  assert.equal(portableStructuralDetailRecordSchema.safeParse({ ...second, byteSize: 1 }).success, false);
  assert.equal(portableStructuralDetailRecordSchema.safeParse({ ...second, nextSegmentId: "detail_3" }).success, false);

  const symbol = {
    id: "symbol_1",
    fileId: "file_1",
    path: "src/index.ts",
    kind: "class",
    coordinate: COORDINATE,
    contentHash: HASH,
    lexicalParentId: null,
    exported: true,
    detailReferences: [{
      field: "qualifiedName" as const,
      firstSegmentId: "detail_1",
      segmentCount: 2,
      byteSize: utf8ByteLength(`${first.text}${second.text}`),
      contentHash: digest(`${first.text}${second.text}`)
    }]
  };
  assert.equal(portableSymbolRecordSchema.safeParse(symbol).success, true);
  assert.equal(portableSymbolRecordSchema.safeParse({ ...symbol, signature: "x".repeat(4 * 1024) }).success, true);
  assert.equal(portableSymbolRecordSchema.safeParse({ ...symbol, signature: "\u0800".repeat(4 * 1024) }).success, false);
  assert.equal(portableSymbolRecordSchema.safeParse({ ...symbol, signature: "🙂".repeat(2 * 1024) }).success, false);
  assert.equal(portableSymbolRecordSchema.safeParse({ ...symbol, qualifiedName: "x" }).success, false);
  assert.equal(portableSymbolRecordSchema.safeParse({
    ...symbol,
    detailReferences: [{ ...symbol.detailReferences[0], field: "signature" as const }]
  }).success, false);
  assert.equal(portableSymbolRecordSchema.safeParse({
    ...symbol,
    qualifiedName: "x".repeat(1025),
    detailReferences: undefined
  }).success, false);

  const inventory = portableStructuralInventorySchema.safeParse({
    generationId: "gen_1",
    shardId: "shard_1",
    files: [fileRecord()],
    symbols: [symbol],
    imports: [],
    relationships: [],
    details: [first, second]
  });
  assert.equal(inventory.success, true);
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
    inventoryShards: [{ shardId: "shard_1", path: "data/files-1.json", recordKind: "files", recordCount: 2_000_000, byteSize: 2_000_000_000, checksum: HASH }],
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
  assert.equal(portableGenerationManifestSchema.safeParse({
    ...manifest,
    structuralCoverage: { ...manifest.structuralCoverage, filesInventoried: Number.MAX_SAFE_INTEGER + 1 }
  }).success, false);
  assert.equal(portableGenerationManifestSchema.safeParse({ ...manifest, unexpected: "content" }).success, false);
});

test("predecessor publication proofs close the retained-generation lineage without a checksum cycle", () => {
  const proof = {
    generationId: "gen_1",
    manifest: { path: "generations/gen_1/manifest.json", checksum: HASH },
    entry: { path: "generations/gen_1/ENTRY.md", checksum: HASH },
    committedIndexHash: HASH
  };
  assert.equal(portablePredecessorPublicationProofSchema.safeParse(proof).success, true);
  assert.equal(portablePredecessorPublicationProofSchema.safeParse({ ...proof, manifest: proof.entry }).success, false);

  const baseManifest = {
    formatVersion: 1,
    protocolVersion: 1,
    generationId: "gen_2",
    generatedAt: "2026-09-23T00:00:00.000Z",
    gitCommit: null,
    inventoryFingerprint: HASH,
    structuralCoverage: {
      filesInventoried: 1, filesWithFullCoverage: 1, filesWithFileCoverage: 0,
      symbolsExtracted: 0, importsExtracted: 0, relationshipsExtracted: 0
    },
    semanticCoverage: { capabilitiesAccepted: 0, claimsAccepted: 0, aliasesAccepted: 0, evidenceDependencies: 0 },
    parserAssets: [],
    inventoryShards: [{ shardId: "shard_1", path: "data/files.json", recordKind: "files", recordCount: 1, byteSize: 12, checksum: HASH }],
    checksums: {
      entry: HASH,
      pages: [{ path: "ENTRY.md", checksum: HASH }],
      compatibility: Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, HASH]))
    },
    evidenceDependencies: [],
    predecessorGenerationId: "gen_1",
    predecessorPublicationProof: proof
  };
  assert.equal(portableGenerationManifestSchema.safeParse(baseManifest).success, true);
  assert.equal(portableGenerationManifestSchema.safeParse({ ...baseManifest, predecessorPublicationProof: undefined }).success, false);
  assert.equal(portableGenerationManifestSchema.safeParse({
    ...baseManifest,
    predecessorPublicationProof: { ...proof, generationId: "gen_2" }
  }).success, false);
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
  assert.equal(portableOperationMetadataSchema.safeParse({ ...prepared, previousGenerationId: "gen_1" }).success, false);
  assert.equal(portableOperationMetadataSchema.safeParse({ ...prepared, previousGenerationId: "gen_0", previousIndexHash: null }).success, false);
  assert.equal(portableOperationMetadataSchema.safeParse({ ...prepared, previousIndexHash: HASH }).success, true);

  const marker = {
    version: 2,
    operationId: "op_1",
    transactionId: "txn_1",
    stage: "publishing",
    generationId: "gen_1",
    previousGenerationId: "gen_0",
    previousIndexHash: HASH,
    nextIndexHash: HASH,
    sourceBasis: { rootHash: HASH, inventoryHash: HASH, evidenceHash: HASH },
    previousTargetHashes: Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, HASH])),
    nextTargetHashes: Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, HASH])),
    sealedGeneration: {
      generationId: "gen_1",
      manifest: { path: "generations/gen_1/manifest.json", checksum: HASH },
      entry: { path: "generations/gen_1/ENTRY.md", checksum: HASH }
    },
    v1BackupReference: {
      version: 1,
      rootPath: "staging/op_1/v1-backup",
      generationId: "gen_0",
      compatibility: Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, {
        path: `staging/op_1/v1-backup/${id.toUpperCase()}.md`, checksum: HASH
      }]))
    },
    createdAt: "2026-09-23T00:00:00.000Z"
  };
  assert.equal(portablePublicationMarkerSchema.safeParse(marker).success, true);
  assert.equal(portablePublicationMarkerSchema.safeParse({ ...marker, stage: "prepared", nextIndexHash: undefined }).success, false);
  assert.equal(portablePublicationMarkerSchema.safeParse({ ...marker, nextTargetHashes: Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, null])) }).success, false);
  assert.equal(portablePublicationMarkerSchema.safeParse({ ...marker, previousGenerationId: "gen_1" }).success, false);
  assert.equal(portablePublicationMarkerSchema.safeParse({ ...marker, previousGenerationId: "gen_0", previousIndexHash: null }).success, false);
  assert.equal(portablePublicationMarkerSchema.safeParse({ ...marker, sealedGeneration: { ...marker.sealedGeneration, generationId: "other_generation" } }).success, false);
  assert.equal(portablePublicationMarkerSchema.safeParse({ ...marker, sealedGeneration: { ...marker.sealedGeneration, manifest: { path: "other/manifest.json", checksum: HASH } } }).success, false);
  assert.equal(portablePublicationMarkerSchema.safeParse({ ...marker, v1BackupReference: { ...marker.v1BackupReference, compatibility: { ...marker.v1BackupReference.compatibility, stack: { path: "wrong.md", checksum: HASH } } } }).success, false);
  assert.equal(portableV1BackupReferenceSchema.safeParse({ ...marker.v1BackupReference, compatibility: { ...marker.v1BackupReference.compatibility, stack: { path: "staging/op_1/v1-backup/stack.md", checksum: HASH } } }).success, false);
  assert.equal(portablePublicationMarkerSchema.safeParse({ ...marker, previousTargetHashes: { ...marker.previousTargetHashes, stack: null } }).success, false);
  assert.equal(portableSealedGenerationReferenceSchema.safeParse({
    ...marker.sealedGeneration,
    entry: marker.sealedGeneration.manifest
  }).success, false);
  assert.equal(portableV1BackupReferenceSchema.safeParse(marker.v1BackupReference).success, true);
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
