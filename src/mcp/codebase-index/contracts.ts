import * as z from "zod/v4";

import {
  CODEBASE_DOCUMENT_IDS,
  codebaseDocumentModelSchema,
  type CodebaseDocumentId
} from "../codebase-authoring.js";

/**
 * Portable codebase-map contracts are intentionally source-owned.  Consumers
 * can copy a sealed generation and use these values without a Blueprint
 * runtime, while writers can still reject a generation from another format.
 */
export const PORTABLE_MAP_FORMAT_VERSION = 1 as const;
export const PORTABLE_MAP_PROTOCOL_VERSION = 1 as const;
export const PORTABLE_MAP_PUBLICATION_MARKER_VERSION = 2 as const;
export const PORTABLE_MAP_OPERATION_METADATA_VERSION = 2 as const;
export const PORTABLE_MAP_VERSION = PORTABLE_MAP_FORMAT_VERSION;
export const PORTABLE_MAP_MARKER_VERSION = PORTABLE_MAP_PUBLICATION_MARKER_VERSION;

export const PORTABLE_MAP_BYTE_LIMITS = {
  index: 4 * 1024,
  entry: 4 * 1024,
  intermediateRoute: 8 * 1024,
  capabilityPage: 12 * 1024,
  recordPage: 12 * 1024,
  searchShard: 32 * 1024,
  searchHit: 2 * 1024,
  modelPacket: 48 * 1024
} as const;

export const PORTABLE_MAP_MAX_MODEL_PACKET_BYTES = PORTABLE_MAP_BYTE_LIMITS.modelPacket;
export const PORTABLE_MAP_MAX_MODEL_PACKET_UTF8_BYTES = PORTABLE_MAP_MAX_MODEL_PACKET_BYTES;
export const PORTABLE_MAP_MAX_INDEX_BYTES = PORTABLE_MAP_BYTE_LIMITS.index;
export const PORTABLE_MAP_MAX_ENTRY_BYTES = PORTABLE_MAP_BYTE_LIMITS.entry;
export const PORTABLE_MAP_MAX_ROUTE_PAGE_BYTES = PORTABLE_MAP_BYTE_LIMITS.intermediateRoute;
export const PORTABLE_MAP_MAX_CAPABILITY_PAGE_BYTES = PORTABLE_MAP_BYTE_LIMITS.capabilityPage;
export const PORTABLE_MAP_MAX_RECORD_PAGE_BYTES = PORTABLE_MAP_BYTE_LIMITS.recordPage;
export const PORTABLE_MAP_MAX_SEARCH_SHARD_BYTES = PORTABLE_MAP_BYTE_LIMITS.searchShard;
export const PORTABLE_MAP_MAX_SEARCH_HIT_BYTES = PORTABLE_MAP_BYTE_LIMITS.searchHit;

/** UTF-8 bytes, rather than JavaScript UTF-16 code units. */
export function utf8ByteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

/**
 * Serialize a packet exactly as it crosses the model boundary.  Callers must
 * split on record boundaries when this exceeds the cap; this helper never
 * truncates or otherwise changes the supplied value.
 */
export function serializedUtf8ByteLength(value: unknown): number {
  return utf8ByteLength(JSON.stringify(value) ?? "");
}

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/, "Expected a lowercase SHA-256 digest.");
const gitCommitSchema = z.string().regex(/^[a-f0-9]{7,64}$/, "Expected a hexadecimal Git commit id.");
export const portableSha256Schema = sha256Schema;
export const portableGitCommitSchema = gitCommitSchema;

/** Safe, generation-local identifiers never become path fragments. */
export const generationLocalIdSchema = z.string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/, "Expected a safe generation-local identifier.");
export type GenerationLocalId = z.infer<typeof generationLocalIdSchema>;

/** Repository-relative paths only; dot segments, separators and control bytes are rejected. */
export const repositoryRelativePathSchema = z.string()
  .min(1)
  .max(4096)
  // Paths are rendered into Markdown and used as literal search terms.  Keep
  // every C0 control and DEL out of the public contract; allowing tabs or ESC
  // here would make a path look different from the bytes that were validated.
  .refine(value => !/[\u0000-\u001f\u007f]/.test(value), "Paths cannot contain control characters.")
  .refine(value => !value.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(value), "Paths must be repository-relative.")
  .refine(value => !value.includes("\\"), "Paths must use forward slashes.")
  .refine(value => !value.split("/").some(segment => segment === "" || segment === "." || segment === ".."), "Paths cannot contain empty or dot segments.");
export type RepositoryRelativePath = z.infer<typeof repositoryRelativePathSchema>;

const boundedText = (maximum: number) => z.string()
  .min(1)
  .max(maximum)
  .refine(value => !/[\0]/.test(value), "Text cannot contain NUL bytes.");

const boundedOptionalText = (maximum: number) => z.string()
  .max(maximum)
  .refine(value => !/[\0]/.test(value), "Text cannot contain NUL bytes.");

const lineSchema = z.number().int().positive().max(10_000_000);
const columnSchema = z.number().int().nonnegative().max(10_000_000);
const byteOffsetSchema = z.number().int().nonnegative().max(1_000_000_000);

/** Inclusive source range, with both line/column and UTF-8 byte coordinates. */
export const portableSourceCoordinateSchema = z.strictObject({
  start: z.strictObject({ line: lineSchema, column: columnSchema, byte: byteOffsetSchema }),
  end: z.strictObject({ line: lineSchema, column: columnSchema, byte: byteOffsetSchema })
}).superRefine((coordinate, ctx) => {
  const startsAfterEnds = coordinate.start.byte > coordinate.end.byte ||
    coordinate.start.line > coordinate.end.line ||
    (coordinate.start.line === coordinate.end.line && coordinate.start.column > coordinate.end.column);
  if (startsAfterEnds) {
    ctx.addIssue({ code: "custom", path: ["end"], message: "Coordinate end must not precede its start." });
  }
});
export type PortableSourceCoordinate = z.infer<typeof portableSourceCoordinateSchema>;

export const PORTABLE_MAP_LANGUAGES = [
  "javascript", "jsx", "typescript", "tsx", "python", "java", "unknown"
] as const;
export const portableLanguageSchema = z.enum(PORTABLE_MAP_LANGUAGES);
export type PortableLanguage = z.infer<typeof portableLanguageSchema>;

export const PORTABLE_MAP_FILE_ROLES = [
  "source", "test", "configuration", "documentation", "generated", "unknown"
] as const;
export const portableFileRoleSchema = z.enum(PORTABLE_MAP_FILE_ROLES);

export const PORTABLE_MAP_PARSE_STATUSES = [
  "parsed", "partial", "failed", "unsupported", "skipped"
] as const;
export const portableParseStatusSchema = z.enum(PORTABLE_MAP_PARSE_STATUSES);
export type PortableParseStatus = z.infer<typeof portableParseStatusSchema>;

export const PORTABLE_MAP_COVERAGE_STATUSES = ["full", "file", "none"] as const;
export const portableCoverageStatusSchema = z.enum(PORTABLE_MAP_COVERAGE_STATUSES);
export type PortableCoverageStatus = z.infer<typeof portableCoverageStatusSchema>;

export const PORTABLE_MAP_LIMITATION_REASONS = [
  "none", "unsupported-language", "too-large", "binary", "parse-error", "excluded", "unreadable"
] as const;
export const portableLimitationReasonSchema = z.enum(PORTABLE_MAP_LIMITATION_REASONS);

export const portableFileRecordSchema = z.strictObject({
  id: generationLocalIdSchema,
  path: repositoryRelativePathSchema,
  language: portableLanguageSchema,
  role: portableFileRoleSchema,
  byteSize: z.number().int().nonnegative().max(1_000_000_000),
  contentHash: sha256Schema,
  parseStatus: portableParseStatusSchema,
  coverageStatus: portableCoverageStatusSchema,
  limitationReason: portableLimitationReasonSchema.optional(),
  coordinate: portableSourceCoordinateSchema.optional()
}).superRefine((record, ctx) => {
  const reason = record.limitationReason ?? "none";
  const valid = record.parseStatus === "parsed"
    ? record.coverageStatus === "full" && reason === "none"
    : record.parseStatus === "partial"
      ? record.coverageStatus === "file" && reason === "parse-error"
      : record.parseStatus === "failed"
        ? (record.coverageStatus === "file" || record.coverageStatus === "none") && reason === "parse-error"
        : record.parseStatus === "unsupported"
          ? (record.coverageStatus === "file" || record.coverageStatus === "none") && reason === "unsupported-language"
          : record.coverageStatus === "file"
            ? ["too-large", "binary"].includes(reason)
            : ["excluded", "unreadable", "binary", "too-large"].includes(reason);
  if (!valid) {
    ctx.addIssue({ code: "custom", path: ["coverageStatus"], message: "Parse status, coverage status, and limitation reason are inconsistent." });
  }
});
export type PortableFileRecord = z.infer<typeof portableFileRecordSchema>;

export const PORTABLE_MAP_SYMBOL_KINDS = [
  "module", "class", "interface", "type", "enum", "function", "method", "constructor",
  "variable", "constant", "property", "field", "unknown"
] as const;
export const portableSymbolKindSchema = z.enum(PORTABLE_MAP_SYMBOL_KINDS);
export type PortableSymbolKind = z.infer<typeof portableSymbolKindSchema>;

export const portableSymbolRecordSchema = z.strictObject({
  id: generationLocalIdSchema,
  fileId: generationLocalIdSchema,
  path: repositoryRelativePathSchema,
  qualifiedName: boundedText(1024),
  kind: portableSymbolKindSchema,
  signature: boundedOptionalText(4096).optional(),
  coordinate: portableSourceCoordinateSchema,
  contentHash: sha256Schema,
  lexicalParentId: generationLocalIdSchema.nullable(),
  exported: z.boolean()
});
export type PortableSymbolRecord = z.infer<typeof portableSymbolRecordSchema>;

export const PORTABLE_MAP_UNRESOLVED_REASONS = [
  "dynamic-import", "reflection", "dependency-injection", "dynamic-dispatch", "ambiguous-module",
  "unsupported-resolution", "missing-target", "parse-error", "external-dependency", "unknown"
] as const;
export const portableUnresolvedReasonSchema = z.enum(PORTABLE_MAP_UNRESOLVED_REASONS);
export type PortableUnresolvedReason = z.infer<typeof portableUnresolvedReasonSchema>;

export const PORTABLE_MAP_RESOLUTION_STATUSES = ["resolved", "unresolved", "ambiguous", "unsupported"] as const;
export const portableResolutionStatusSchema = z.enum(PORTABLE_MAP_RESOLUTION_STATUSES);
export type PortableResolutionStatus = z.infer<typeof portableResolutionStatusSchema>;

const relationshipResolutionShape = {
  resolutionStatus: portableResolutionStatusSchema,
  targetFileId: generationLocalIdSchema.nullable(),
  targetSymbolId: generationLocalIdSchema.nullable(),
  unresolvedReason: portableUnresolvedReasonSchema.optional()
};

function enforceResolutionSemantics<T extends {
  resolutionStatus: PortableResolutionStatus;
  targetFileId: string | null;
  targetSymbolId: string | null;
  unresolvedReason?: PortableUnresolvedReason;
}>(record: T, ctx: z.RefinementCtx): void {
  if (record.resolutionStatus === "resolved") {
    if (!record.targetFileId && !record.targetSymbolId) {
      ctx.addIssue({ code: "custom", path: ["targetFileId"], message: "Resolved relationships require a target record." });
    }
    if (record.unresolvedReason) {
      ctx.addIssue({ code: "custom", path: ["unresolvedReason"], message: "Resolved relationships cannot carry unresolved semantics." });
    }
  } else {
    if (record.targetFileId || record.targetSymbolId) {
      ctx.addIssue({ code: "custom", path: ["targetFileId"], message: "Unresolved relationships cannot claim a resolved target." });
    }
    if (!record.unresolvedReason) {
      ctx.addIssue({ code: "custom", path: ["unresolvedReason"], message: "Unresolved relationships require an explicit reason." });
    }
  }
}

export const portableImportRelationshipSchema = z.strictObject({
  id: generationLocalIdSchema,
  kind: z.enum(["import", "export", "reexport"]),
  sourceFileId: generationLocalIdSchema,
  sourcePath: repositoryRelativePathSchema,
  specifier: boundedText(512),
  coordinate: portableSourceCoordinateSchema,
  contentHash: sha256Schema,
  ...relationshipResolutionShape,
  origin: z.literal("syntax"),
  certainty: z.enum(["observed", "supported-inference", "unknown"])
}).superRefine(enforceResolutionSemantics);
export type PortableImportRelationship = z.infer<typeof portableImportRelationshipSchema>;
export type PortableImportRecord = PortableImportRelationship;
export const portableImportRecordSchema = portableImportRelationshipSchema;

export const portableRelationshipRecordSchema = z.strictObject({
  id: generationLocalIdSchema,
  kind: z.enum(["contains", "references", "implements", "extends", "uses"]),
  sourceFileId: generationLocalIdSchema,
  sourceSymbolId: generationLocalIdSchema.nullable(),
  sourcePath: repositoryRelativePathSchema,
  coordinate: portableSourceCoordinateSchema,
  contentHash: sha256Schema,
  ...relationshipResolutionShape,
  origin: z.enum(["syntax", "inferred", "authored"]),
  certainty: z.enum(["observed", "supported-inference", "unknown"])
}).superRefine(enforceResolutionSemantics);
export type PortableRelationshipRecord = z.infer<typeof portableRelationshipRecordSchema>;

export const PORTABLE_MAP_RECORD_KINDS = ["files", "symbols", "imports", "relationships"] as const;
export const portableRecordKindSchema = z.enum(PORTABLE_MAP_RECORD_KINDS);

export const portableInventoryContinuationSchema = z.strictObject({
  cursor: generationLocalIdSchema.nullable(),
  hasMore: z.boolean()
}).superRefine((value, ctx) => {
  if (value.hasMore !== Boolean(value.cursor)) {
    ctx.addIssue({ code: "custom", path: ["cursor"], message: "Continuation cursor must match hasMore." });
  }
});
export type PortableInventoryContinuation = z.infer<typeof portableInventoryContinuationSchema>;

/** A bounded structural shard. The manifest is the index over multiple shards. */
export const portableStructuralInventorySchema = z.strictObject({
  generationId: generationLocalIdSchema,
  shardId: generationLocalIdSchema,
  files: z.array(portableFileRecordSchema).max(4096),
  symbols: z.array(portableSymbolRecordSchema).max(4096),
  imports: z.array(portableImportRelationshipSchema).max(4096),
  relationships: z.array(portableRelationshipRecordSchema).max(4096),
  continuation: portableInventoryContinuationSchema.optional()
}).superRefine((inventory, ctx) => {
  const ids = [
    ...inventory.files.map(record => record.id),
    ...inventory.symbols.map(record => record.id),
    ...inventory.imports.map(record => record.id),
    ...inventory.relationships.map(record => record.id)
  ];
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: "custom", path: [], message: "Structural record identifiers must be unique within a shard." });
  }
});
export type PortableStructuralInventory = z.infer<typeof portableStructuralInventorySchema>;

export const portableEvidenceDependencySchema = z.strictObject({
  kind: z.enum(["file", "symbol", "relationship", "compatibility-document"]),
  path: repositoryRelativePathSchema,
  recordId: generationLocalIdSchema,
  contentHash: sha256Schema,
  coordinate: portableSourceCoordinateSchema.optional()
});
export type PortableEvidenceDependency = z.infer<typeof portableEvidenceDependencySchema>;

const authoredShortText = boundedText(4096);

export const portableClaimSchema = z.strictObject({
  id: generationLocalIdSchema,
  basis: z.enum(["observed", "supported-inference", "unknown"]),
  statement: authoredShortText,
  evidence: z.array(portableEvidenceDependencySchema).min(1).max(32)
});
export type PortableClaim = z.infer<typeof portableClaimSchema>;

export const portableCapabilitySchema = z.strictObject({
  id: generationLocalIdSchema,
  name: boundedText(256),
  summary: authoredShortText,
  claimIds: z.array(generationLocalIdSchema).min(1).max(128),
  evidence: z.array(portableEvidenceDependencySchema).min(1).max(32)
}).superRefine((capability, ctx) => {
  if (new Set(capability.claimIds).size !== capability.claimIds.length) {
    ctx.addIssue({ code: "custom", path: ["claimIds"], message: "Capability claim identifiers must be unique." });
  }
});
export type PortableCapability = z.infer<typeof portableCapabilitySchema>;

export const portableAliasSchema = z.strictObject({
  id: generationLocalIdSchema,
  alias: boundedText(256),
  targetKind: z.enum(["capability", "symbol"]),
  targetId: generationLocalIdSchema,
  evidence: z.array(portableEvidenceDependencySchema).min(1).max(32)
});
export type PortableAlias = z.infer<typeof portableAliasSchema>;

/** Accepted authored meaning; structural inventory is deliberately not embedded here. */
export const portableAcceptedSemanticModelSchema = z.strictObject({
  capabilities: z.array(portableCapabilitySchema).max(256),
  claims: z.array(portableClaimSchema).max(2048),
  aliases: z.array(portableAliasSchema).max(1024)
}).superRefine((model, ctx) => {
  const claimIds = new Set(model.claims.map(claim => claim.id));
  const capabilityIds = new Set(model.capabilities.map(capability => capability.id));
  const duplicateIds = [
    ...model.capabilities.map(capability => ["capability", capability.id] as const),
    ...model.claims.map(claim => ["claim", claim.id] as const),
    ...model.aliases.map(alias => ["alias", alias.id] as const)
  ];
  if (new Set(duplicateIds.map(([, id]) => id)).size !== duplicateIds.length) {
    ctx.addIssue({ code: "custom", path: [], message: "Semantic record identifiers must be unique." });
  }
  for (const [index, capability] of model.capabilities.entries()) {
    for (const [claimIndex, claimId] of capability.claimIds.entries()) {
      if (!claimIds.has(claimId)) {
        ctx.addIssue({ code: "custom", path: ["capabilities", index, "claimIds", claimIndex], message: "Capability references an unknown claim." });
      }
    }
  }
  for (const [index, alias] of model.aliases.entries()) {
    if (alias.targetKind === "capability" && !capabilityIds.has(alias.targetId)) {
      ctx.addIssue({ code: "custom", path: ["aliases", index, "targetId"], message: "Capability alias references an unknown capability." });
    }
    // Symbol identity is generated by the structural extractor, so symbol
    // alias closure is checked when this model joins a selected inventory shard.
  }
});
export type PortableAcceptedSemanticModel = z.infer<typeof portableAcceptedSemanticModelSchema>;

const completeCodebaseMapShape = Object.fromEntries(
  CODEBASE_DOCUMENT_IDS.map(id => [id, codebaseDocumentModelSchema])
) as Record<CodebaseDocumentId, typeof codebaseDocumentModelSchema>;

/** Existing seven codebase views, made required for a portable submission. */
export const portableCompleteCodebaseMapModelSchema = z.strictObject(completeCodebaseMapShape);
export type PortableCompleteCodebaseMapModel = z.infer<typeof portableCompleteCodebaseMapModelSchema>;
export const portableSevenViewModelSchema = portableCompleteCodebaseMapModelSchema;
export type PortableSevenViewModel = PortableCompleteCodebaseMapModel;
export const portableCodebaseDocumentModelSchema = codebaseDocumentModelSchema;
export const portableCodebaseMapModelSchema = portableCompleteCodebaseMapModelSchema;
export const PORTABLE_MAP_REQUIRED_DOCUMENT_IDS = CODEBASE_DOCUMENT_IDS;

export const portableMapSubmissionSchema = z.strictObject({
  formatVersion: z.literal(PORTABLE_MAP_FORMAT_VERSION),
  generationId: generationLocalIdSchema,
  documents: portableCompleteCodebaseMapModelSchema,
  semantic: portableAcceptedSemanticModelSchema
});
export type PortableMapSubmission = z.infer<typeof portableMapSubmissionSchema>;
export const portableMapModelSchema = portableMapSubmissionSchema;
export type PortableMapModel = PortableMapSubmission;

export const portableInventoryShardManifestSchema = z.strictObject({
  shardId: generationLocalIdSchema,
  path: repositoryRelativePathSchema,
  recordKind: portableRecordKindSchema,
  recordCount: z.number().int().nonnegative().max(1_000_000),
  byteSize: z.number().int().nonnegative().max(1_000_000_000),
  checksum: sha256Schema
});
export type PortableInventoryShardManifest = z.infer<typeof portableInventoryShardManifestSchema>;

const coverageCountSchema = z.number().int().nonnegative().max(1_000_000_000);
export const portableStructuralCoverageSchema = z.strictObject({
  filesInventoried: coverageCountSchema,
  filesWithFullCoverage: coverageCountSchema,
  filesWithFileCoverage: coverageCountSchema,
  symbolsExtracted: coverageCountSchema,
  importsExtracted: coverageCountSchema,
  relationshipsExtracted: coverageCountSchema
}).superRefine((coverage, ctx) => {
  if (coverage.filesWithFullCoverage + coverage.filesWithFileCoverage > coverage.filesInventoried) {
    ctx.addIssue({
      code: "custom",
      path: ["filesWithFileCoverage"],
      message: "Full and file coverage cannot exceed inventoried files."
    });
  }
});
export type PortableStructuralCoverage = z.infer<typeof portableStructuralCoverageSchema>;

export const portableSemanticCoverageSchema = z.strictObject({
  capabilitiesAccepted: coverageCountSchema,
  claimsAccepted: coverageCountSchema,
  aliasesAccepted: coverageCountSchema,
  evidenceDependencies: coverageCountSchema
});
export type PortableSemanticCoverage = z.infer<typeof portableSemanticCoverageSchema>;

const pageChecksumSchema = z.strictObject({ path: repositoryRelativePathSchema, checksum: sha256Schema });
const compatibilityViewHashesShape = Object.fromEntries(
  CODEBASE_DOCUMENT_IDS.map(id => [id, sha256Schema])
) as Record<CodebaseDocumentId, typeof sha256Schema>;
export const portableCompatibilityViewHashesSchema = z.strictObject(compatibilityViewHashesShape);
export type PortableCompatibilityViewHashes = z.infer<typeof portableCompatibilityViewHashesSchema>;

export const portableGenerationChecksumsSchema = z.strictObject({
  entry: sha256Schema,
  pages: z.array(pageChecksumSchema).max(100_000),
  compatibility: portableCompatibilityViewHashesSchema
});
export type PortableGenerationChecksums = z.infer<typeof portableGenerationChecksumsSchema>;

const timestampSchema = z.string().datetime({ offset: true });

export const portableGenerationManifestSchema = z.strictObject({
  formatVersion: z.literal(PORTABLE_MAP_FORMAT_VERSION),
  protocolVersion: z.literal(PORTABLE_MAP_PROTOCOL_VERSION),
  generationId: generationLocalIdSchema,
  generatedAt: timestampSchema,
  gitCommit: gitCommitSchema.nullable(),
  inventoryFingerprint: sha256Schema,
  structuralCoverage: portableStructuralCoverageSchema,
  semanticCoverage: portableSemanticCoverageSchema,
  parserAssets: z.array(z.strictObject({
    name: boundedText(256),
    version: boundedText(128),
    checksum: sha256Schema
  })).max(128),
  inventoryShards: z.array(portableInventoryShardManifestSchema).min(1).max(100_000),
  checksums: portableGenerationChecksumsSchema,
  evidenceDependencies: z.array(portableEvidenceDependencySchema).max(100_000),
  predecessorGenerationId: generationLocalIdSchema.nullable()
}).superRefine((manifest, ctx) => {
  const shardIds = manifest.inventoryShards.map(shard => shard.shardId);
  if (new Set(shardIds).size !== shardIds.length) {
    ctx.addIssue({ code: "custom", path: ["inventoryShards"], message: "Inventory shard identifiers must be unique." });
  }
  const pagePaths = manifest.checksums.pages.map(page => page.path);
  if (new Set(pagePaths).size !== pagePaths.length) {
    ctx.addIssue({ code: "custom", path: ["checksums", "pages"], message: "Page checksum paths must be unique." });
  }
});
export type PortableGenerationManifest = z.infer<typeof portableGenerationManifestSchema>;

export const portableSourceBasisSchema = z.strictObject({
  rootHash: sha256Schema,
  inventoryHash: sha256Schema,
  evidenceHash: sha256Schema
});
export type PortableSourceBasis = z.infer<typeof portableSourceBasisSchema>;

const portableTargetHashesShape = Object.fromEntries(
  CODEBASE_DOCUMENT_IDS.map(id => [id, sha256Schema.nullable()])
) as Record<CodebaseDocumentId, z.ZodNullable<typeof sha256Schema>>;
export const portableTargetHashesSchema = z.strictObject(portableTargetHashesShape);
export type PortableTargetHashes = z.infer<typeof portableTargetHashesSchema>;

export const PORTABLE_MAP_OPERATION_STAGES = ["prepared"] as const;
export const portableOperationStageSchema = z.enum(PORTABLE_MAP_OPERATION_STAGES);
export type PortableOperationStage = z.infer<typeof portableOperationStageSchema>;

export const PORTABLE_MAP_PUBLICATION_STAGES = [
  "publishing", "index-committed", "cleanup"
] as const;
export const portablePublicationStageSchema = z.enum(PORTABLE_MAP_PUBLICATION_STAGES);
export type PortablePublicationStage = z.infer<typeof portablePublicationStageSchema>;

/** Pre-authoring state. It intentionally has no future rendered hash. */
export const portableOperationMetadataSchema = z.strictObject({
  version: z.literal(PORTABLE_MAP_OPERATION_METADATA_VERSION),
  operationId: generationLocalIdSchema,
  stage: portableOperationStageSchema,
  generationId: generationLocalIdSchema,
  previousGenerationId: generationLocalIdSchema.nullable(),
  previousIndexHash: sha256Schema.nullable(),
  sourceBasis: portableSourceBasisSchema,
  targetHashes: portableTargetHashesSchema,
  createdAt: timestampSchema
});
export type PortableOperationMetadata = z.infer<typeof portableOperationMetadataSchema>;
export const portablePreparedOperationMetadataSchema = portableOperationMetadataSchema;
export type PortablePreparedOperationMetadata = PortableOperationMetadata;

/** Accepted publication state. Only this marker carries a sealed next hash. */
export const portablePublicationMarkerSchema = z.strictObject({
  version: z.literal(PORTABLE_MAP_PUBLICATION_MARKER_VERSION),
  operationId: generationLocalIdSchema,
  transactionId: generationLocalIdSchema,
  stage: portablePublicationStageSchema,
  generationId: generationLocalIdSchema,
  previousGenerationId: generationLocalIdSchema.nullable(),
  previousIndexHash: sha256Schema.nullable(),
  nextIndexHash: sha256Schema,
  sourceBasis: portableSourceBasisSchema,
  targetHashes: portableTargetHashesSchema,
  createdAt: timestampSchema
});
export type PortablePublicationMarker = z.infer<typeof portablePublicationMarkerSchema>;

const selectedCapabilitySchema = z.strictObject({
  id: generationLocalIdSchema,
  name: boundedText(256),
  summary: authoredShortText
});

/**
 * Bounded, selected context for one authoring request. It has no inventory
 * field, so an entire inventory cannot accidentally be embedded in a model
 * submission or a session receipt.
 */
export const portableModelPacketSchema = z.strictObject({
  packetVersion: z.literal(1),
  operationId: generationLocalIdSchema,
  generationId: generationLocalIdSchema,
  selectedFiles: z.array(portableFileRecordSchema).max(128),
  selectedSymbols: z.array(portableSymbolRecordSchema).max(256),
  selectedImports: z.array(portableImportRelationshipSchema).max(256),
  selectedRelationships: z.array(portableRelationshipRecordSchema).max(256),
  selectedCapabilities: z.array(selectedCapabilitySchema).max(64),
  continuation: portableInventoryContinuationSchema.optional()
}).superRefine((packet, ctx) => {
  const bytes = serializedUtf8ByteLength(packet);
  if (bytes > PORTABLE_MAP_MAX_MODEL_PACKET_BYTES) {
    ctx.addIssue({
      code: "custom",
      path: ["$bytes"],
      message: `Serialized model packet exceeds ${PORTABLE_MAP_MAX_MODEL_PACKET_BYTES} UTF-8 bytes.`
    });
  }
});
export type PortableModelPacket = z.infer<typeof portableModelPacketSchema>;
export const portableModelEvidencePacketSchema = portableModelPacketSchema;
export type PortableModelEvidencePacket = PortableModelPacket;

/** Fixed public vocabulary; never expose Zod prose, keys, inputs, or values. */
export const PORTABLE_CONTRACT_DIAGNOSTIC_CODES = [
  "invalid-structure",
  "invalid-type",
  "invalid-format",
  "too-small",
  "too-large",
  "missing-field",
  "unrecognized-field",
  "invalid-value"
] as const;
export type PortableContractDiagnosticCode = typeof PORTABLE_CONTRACT_DIAGNOSTIC_CODES[number];

const diagnosticPathSegments = new Set([
  "formatVersion", "protocolVersion", "generationId", "generatedAt", "gitCommit",
  "inventoryFingerprint", "structuralCoverage", "semanticCoverage", "parserAssets",
  "inventoryShards", "checksums", "evidenceDependencies", "predecessorGenerationId",
  "operationId", "transactionId", "stage", "previousGenerationId", "previousIndexHash",
  "nextIndexHash", "sourceBasis", "targetHashes", "createdAt", "packetVersion",
  "selectedFiles", "selectedSymbols", "selectedImports", "selectedRelationships",
  "selectedCapabilities", "continuation", "files", "symbols", "imports", "relationships",
  "id", "path", "language", "role", "byteSize", "contentHash", "parseStatus",
  "coverageStatus", "limitationReason", "coordinate", "start", "end", "line", "column",
  "byte", "capabilities", "claims", "aliases", "name", "summary", "claimIds", "evidence",
  "basis", "statement", "kind", "recordId", "targetKind", "targetId", "fileId",
  "qualifiedName", "signature", "lexicalParentId", "exported", "specifier", "resolutionStatus",
  "targetFileId", "targetSymbolId", "unresolvedReason", "origin", "certainty", "shardId",
  "recordKind", "recordCount", "checksum", "entry", "pages", "compatibility", "sourceBasis"
]);

const diagnosticCodeByIssueCode: Record<string, PortableContractDiagnosticCode> = {
  invalid_type: "invalid-type",
  invalid_format: "invalid-format",
  invalid_string_format: "invalid-format",
  too_small: "too-small",
  too_big: "too-large",
  unrecognized_keys: "unrecognized-field",
  invalid_union: "invalid-structure",
  invalid_value: "invalid-value",
  custom: "invalid-value"
};

function portableDiagnosticPath(path: PropertyKey[]): string {
  if (path.length === 1 && path[0] === "$bytes") return "model-packet";
  const known = path.find((segment): segment is string => typeof segment === "string" && diagnosticPathSegments.has(segment));
  if (known) return known;
  if (path.some(segment => typeof segment === "number")) return "record-item";
  return "portable-contract";
}

function portableDiagnosticMessage(code: PortableContractDiagnosticCode): string {
  switch (code) {
    case "invalid-type": return "Value has an invalid type.";
    case "invalid-format": return "Value has an invalid format.";
    case "too-small": return "Value is below the permitted minimum.";
    case "too-large": return "Value exceeds the permitted maximum.";
    case "missing-field": return "A required field is missing.";
    case "unrecognized-field": return "The input contains an unrecognized field.";
    case "invalid-structure": return "The input structure is invalid.";
    case "invalid-value": return "The input value is invalid.";
  }
}

export function portableContractIssues(error: z.ZodError): Array<{ path: string; code: PortableContractDiagnosticCode; message: string }> {
  return error.issues.map(issue => {
    const code = issue.code === "custom" && issue.path.length === 1 && issue.path[0] === "$bytes"
      ? "too-large"
      : diagnosticCodeByIssueCode[issue.code] ?? "invalid-value";
    return {path: portableDiagnosticPath(issue.path), code, message: portableDiagnosticMessage(code)};
  });
}
