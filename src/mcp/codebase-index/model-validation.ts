import {createHash} from "node:crypto";
import * as z from "zod/v4";

import {
  CODEBASE_DOCUMENT_IDS,
  compileCodebaseDocument,
  type CodebaseDocumentId,
  validateCodebaseContent
} from "../codebase-authoring.js";
import {
  portableContractIssues,
  generationLocalIdSchema,
  portableMapSubmissionSchema,
  portableSha256Schema,
  portableSourceCoordinateSchema,
  portableStructuralInventorySchema,
  repositoryRelativePathSchema,
  type PortableAcceptedSemanticModel,
  type PortableEvidenceDependency,
  type PortableFileRecord,
  type PortableImportRelationship,
  type PortableMapSubmission,
  type PortableRelationshipRecord,
  type PortableSourceCoordinate,
  type PortableStructuralDetailRecord,
  type PortableStructuralInventory,
  type PortableSymbolRecord
} from "./contracts.js";
import {inspectContentBoundaries} from "./content-boundary.js";

/**
 * The source basis is supplied by the lifecycle owner after fresh reads. It is
 * deliberately separate from authored evidence: the model cannot invent its
 * own freshness proof. `records` covers every structural record except detail
 * segments, whose lossless hashes are checked locally by this validator.
 */
const safeNonNegativeInteger = z.number().int().nonnegative()
  .refine(Number.isSafeInteger, "Expected a safe integer.");
const sourceBasisFileSchema = z.strictObject({
  path: repositoryRelativePathSchema,
  byteSize: safeNonNegativeInteger,
  contentHash: portableSha256Schema
});
const sourceBasisRecordKindSchema = z.enum(["file", "symbol", "import", "relationship"]);
const sourceBasisRecordSchema = z.strictObject({
  kind: sourceBasisRecordKindSchema,
  recordId: generationLocalIdSchema,
  path: repositoryRelativePathSchema,
  contentHash: portableSha256Schema,
  coordinate: portableSourceCoordinateSchema.optional()
});

export const portableAuthoritativeSourceBasisSchema = z.strictObject({
  generationId: z.string().min(1).max(128),
  files: z.array(sourceBasisFileSchema).min(1).max(100_000),
  records: z.array(sourceBasisRecordSchema).min(1).max(100_000)
});
export type PortableAuthoritativeSourceBasis = z.infer<typeof portableAuthoritativeSourceBasisSchema>;
export type PortableAuthoritativeSourceFile = z.infer<typeof sourceBasisFileSchema>;
export type PortableAuthoritativeSourceRecord = z.infer<typeof sourceBasisRecordSchema>;

export const PORTABLE_MODEL_VALIDATION_CODES = [
  "invalid-input",
  "incomplete-structure",
  "duplicate-id",
  "source-mismatch",
  "dangling-reference",
  "invalid-coordinate",
  "parent-cycle",
  "invalid-detail-chain",
  "invalid-evidence",
  "invalid-document",
  "unsafe-content"
] as const;
export type PortableModelValidationCode = typeof PORTABLE_MODEL_VALIDATION_CODES[number];

export type PortableModelValidationScope =
  | "source-basis"
  | "structural-shard"
  | "structural-record"
  | "semantic"
  | "document";

/** Fixed metadata-only diagnostics. Values from rejected input are excluded. */
export type PortableModelValidationDiagnostic = {
  code: PortableModelValidationCode;
  scope: PortableModelValidationScope;
  message: string;
  field?: string;
  index?: number;
};

export type PortableValidatedMapData = {
  submission: PortableMapSubmission;
  structuralShards: readonly PortableStructuralInventory[];
  sourceBasis: PortableAuthoritativeSourceBasis;
  compiledDocuments: Readonly<Record<CodebaseDocumentId, string>>;
};

export type PortableModelValidationResult =
  | {ok: true; data: PortableValidatedMapData}
  | {ok: false; diagnostics: readonly PortableModelValidationDiagnostic[]};

const MAX_DIAGNOSTICS = 128;
const SCOPE_ORDER: Record<PortableModelValidationScope, number> = {
  "source-basis": 0,
  "structural-shard": 1,
  "structural-record": 2,
  semantic: 3,
  document: 4
};
const CODE_ORDER = new Map(PORTABLE_MODEL_VALIDATION_CODES.map((code, index) => [code, index]));

const diagnosticMessage: Record<PortableModelValidationCode, string> = {
  "invalid-input": "The supplied model or source basis is structurally invalid.",
  "incomplete-structure": "The supplied structural model is incomplete.",
  "duplicate-id": "A structural identifier is duplicated.",
  "source-mismatch": "A model record does not match the authoritative source basis.",
  "dangling-reference": "A structural reference does not resolve to a canonical record.",
  "invalid-coordinate": "A source coordinate is outside its authoritative file range.",
  "parent-cycle": "Lexical containment contains an impossible cycle.",
  "invalid-detail-chain": "A structural detail chain is missing, duplicated, cyclic, orphaned, or inconsistent.",
  "invalid-evidence": "Authored evidence does not resolve to fresh canonical source evidence.",
  "invalid-document": "A required compatibility document is missing or substantively invalid.",
  "unsafe-content": "A model value crossed a content boundary and was rejected."
};

/** Public fixed messages for callers that need to render diagnostics. */
export function portableModelValidationMessage(code: PortableModelValidationCode): string {
  return diagnosticMessage[code];
}

type MutableDiagnostic = PortableModelValidationDiagnostic;

function compareDiagnostics(left: MutableDiagnostic, right: MutableDiagnostic): number {
  const scope = SCOPE_ORDER[left.scope] - SCOPE_ORDER[right.scope];
  if (scope !== 0) return scope;
  const index = (left.index ?? -1) - (right.index ?? -1);
  if (index !== 0) return index;
  const field = (left.field ?? "").localeCompare(right.field ?? "", "en-US");
  if (field !== 0) return field;
  return (CODE_ORDER.get(left.code) ?? 0) - (CODE_ORDER.get(right.code) ?? 0);
}

function finishDiagnostics(diagnostics: MutableDiagnostic[]): readonly PortableModelValidationDiagnostic[] {
  const unique = new Map<string, MutableDiagnostic>();
  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.code}|${diagnostic.scope}|${diagnostic.field ?? ""}|${diagnostic.index ?? ""}`;
    unique.set(key, diagnostic);
  }
  return [...unique.values()].sort(compareDiagnostics).slice(0, MAX_DIAGNOSTICS);
}

function pushDiagnostic(
  diagnostics: MutableDiagnostic[],
  code: PortableModelValidationCode,
  scope: PortableModelValidationScope,
  field?: string,
  index?: number
): void {
  diagnostics.push({
    code,
    scope,
    message: portableModelValidationMessage(code),
    ...(field ? {field} : {}),
    ...(index === undefined ? {} : {index})
  });
}

function coordinateKey(value: PortableSourceCoordinate | undefined): string {
  if (!value) return "";
  return [
    value.start.line, value.start.column, value.start.byte,
    value.end.line, value.end.column, value.end.byte
  ].join(":");
}

function coordinatesEqual(left: PortableSourceCoordinate | undefined, right: PortableSourceCoordinate | undefined): boolean {
  return coordinateKey(left) === coordinateKey(right);
}

function sourceRecordKey(kind: PortableAuthoritativeSourceRecord["kind"], id: string): string {
  return `${kind}:${id}`;
}

function inspectText(
  value: string,
  diagnostics: MutableDiagnostic[],
  scope: PortableModelValidationScope,
  field: string,
  index?: number
): void {
  if (!inspectContentBoundaries(value).safe) pushDiagnostic(diagnostics, "unsafe-content", scope, field, index);
}

function inspectStructuralStrings(
  shards: readonly PortableStructuralInventory[],
  basis: PortableAuthoritativeSourceBasis,
  diagnostics: MutableDiagnostic[]
): void {
  for (const [shardIndex, shard] of shards.entries()) {
    for (const [index, record] of shard.files.entries()) {
      inspectText(record.path, diagnostics, "structural-record", "file.path", shardIndex * 4096 + index);
    }
    for (const [index, record] of shard.symbols.entries()) {
      inspectText(record.path, diagnostics, "structural-record", "symbol.path", shardIndex * 4096 + index);
      if (record.qualifiedName) inspectText(record.qualifiedName, diagnostics, "structural-record", "symbol.qualifiedName", shardIndex * 4096 + index);
      if (record.signature) inspectText(record.signature, diagnostics, "structural-record", "symbol.signature", shardIndex * 4096 + index);
    }
    for (const [index, record] of shard.imports.entries()) {
      inspectText(record.sourcePath, diagnostics, "structural-record", "import.sourcePath", shardIndex * 4096 + index);
      inspectText(record.specifier, diagnostics, "structural-record", "import.specifier", shardIndex * 4096 + index);
    }
    for (const [index, record] of shard.relationships.entries()) {
      inspectText(record.sourcePath, diagnostics, "structural-record", "relationship.sourcePath", shardIndex * 4096 + index);
    }
    for (const [index, record] of (shard.details ?? []).entries()) {
      inspectText(record.text, diagnostics, "structural-record", "detail.text", shardIndex * 4096 + index);
    }
  }
  for (const [index, file] of basis.files.entries()) {
    inspectText(file.path, diagnostics, "source-basis", "file.path", index);
  }
  for (const [index, record] of basis.records.entries()) {
    inspectText(record.path, diagnostics, "source-basis", "record.path", index);
  }
}

function inspectSemanticStrings(
  semantic: PortableAcceptedSemanticModel,
  documents: PortableMapSubmission["documents"],
  diagnostics: MutableDiagnostic[]
): void {
  for (const [index, capability] of semantic.capabilities.entries()) {
    inspectText(capability.name, diagnostics, "semantic", "capability.name", index);
    inspectText(capability.summary, diagnostics, "semantic", "capability.summary", index);
    for (const evidence of capability.evidence) inspectText(evidence.path, diagnostics, "semantic", "evidence.path", index);
  }
  for (const [index, claim] of semantic.claims.entries()) {
    inspectText(claim.statement, diagnostics, "semantic", "claim.statement", index);
    for (const evidence of claim.evidence) inspectText(evidence.path, diagnostics, "semantic", "evidence.path", index);
  }
  for (const [index, alias] of semantic.aliases.entries()) {
    inspectText(alias.alias, diagnostics, "semantic", "alias.alias", index);
    for (const evidence of alias.evidence) inspectText(evidence.path, diagnostics, "semantic", "evidence.path", index);
  }
  for (const [documentIndex, id] of CODEBASE_DOCUMENT_IDS.entries()) {
    const document = documents[id];
    inspectText(document.summary, diagnostics, "document", "summary", documentIndex);
    for (const section of document.sections ?? []) {
      inspectText(section.heading, diagnostics, "document", "section.heading", documentIndex);
      inspectText(section.content, diagnostics, "document", "section.content", documentIndex);
    }
    for (const evidencePath of document.evidencePaths) {
      inspectText(evidencePath, diagnostics, "document", "evidencePath", documentIndex);
    }
  }
}

function parseStructuralShards(
  input: readonly unknown[],
  diagnostics: MutableDiagnostic[]
): PortableStructuralInventory[] | null {
  if (!Array.isArray(input) || input.length === 0) {
    pushDiagnostic(diagnostics, "incomplete-structure", "structural-shard");
    return null;
  }
  const parsed: PortableStructuralInventory[] = [];
  for (const [index, item] of input.entries()) {
    const result = portableStructuralInventorySchema.safeParse(item);
    if (!result.success) {
      // Convert Zod issues into one fixed public diagnostic. Never expose paths,
      // values, or parser text from an untrusted submission.
      portableContractIssues(result.error);
      pushDiagnostic(diagnostics, "invalid-input", "structural-shard", "schema", index);
    } else {
      parsed.push(result.data);
    }
  }
  return parsed.length === input.length ? parsed : null;
}

function collectStructuralRecords(shards: readonly PortableStructuralInventory[], diagnostics: MutableDiagnostic[]): {
  files: Map<string, PortableFileRecord>;
  symbols: Map<string, PortableSymbolRecord>;
  imports: Map<string, PortableImportRelationship>;
  relationships: Map<string, PortableRelationshipRecord>;
  details: Map<string, PortableStructuralDetailRecord>;
} | null {
  const files = new Map<string, PortableFileRecord>();
  const symbols = new Map<string, PortableSymbolRecord>();
  const imports = new Map<string, PortableImportRelationship>();
  const relationships = new Map<string, PortableRelationshipRecord>();
  const details = new Map<string, PortableStructuralDetailRecord>();
  let duplicate = false;
  const add = <T extends {id: string}>(map: Map<string, T>, values: readonly T[], field: string): void => {
    for (const [index, value] of values.entries()) {
      if (files.has(value.id) || symbols.has(value.id) || imports.has(value.id) || relationships.has(value.id) || details.has(value.id)) {
        pushDiagnostic(diagnostics, "duplicate-id", "structural-record", field, index);
        duplicate = true;
      } else {
        map.set(value.id, value);
      }
    }
  };
  for (const shard of shards) {
    add(files, shard.files, "files");
    add(symbols, shard.symbols, "symbols");
    add(imports, shard.imports, "imports");
    add(relationships, shard.relationships, "relationships");
    add(details, shard.details ?? [], "details");
  }
  return duplicate ? null : {files, symbols, imports, relationships, details};
}

function validateSourceBasis(
  raw: unknown,
  diagnostics: MutableDiagnostic[]
): PortableAuthoritativeSourceBasis | null {
  const parsed = portableAuthoritativeSourceBasisSchema.safeParse(raw);
  if (!parsed.success) {
    portableContractIssues(parsed.error);
    pushDiagnostic(diagnostics, "invalid-input", "source-basis", "schema");
    return null;
  }
  const basis = parsed.data;
  const filePaths = new Set<string>();
  for (const [index, file] of basis.files.entries()) {
    if (filePaths.has(file.path)) pushDiagnostic(diagnostics, "duplicate-id", "source-basis", "file.path", index);
    filePaths.add(file.path);
  }
  const recordKeys = new Set<string>();
  const fileRecordPaths = new Map<string, number>();
  for (const [index, record] of basis.records.entries()) {
    const key = sourceRecordKey(record.kind, record.recordId);
    if (recordKeys.has(key)) pushDiagnostic(diagnostics, "duplicate-id", "source-basis", "recordId", index);
    recordKeys.add(key);
    if (record.kind === "file") {
      const previous = fileRecordPaths.get(record.path);
      if (previous !== undefined) pushDiagnostic(diagnostics, "duplicate-id", "source-basis", "file.record.path", index);
      fileRecordPaths.set(record.path, index);
    }
    const file = basis.files.find(candidate => candidate.path === record.path);
    if (!file) pushDiagnostic(diagnostics, "source-mismatch", "source-basis", "record.path", index);
    if (record.kind === "file" && file && file.contentHash !== record.contentHash) {
      pushDiagnostic(diagnostics, "source-mismatch", "source-basis", "file.record", index);
    }
  }
  for (const [index, file] of basis.files.entries()) {
    if (fileRecordPaths.get(file.path) === undefined) pushDiagnostic(diagnostics, "incomplete-structure", "source-basis", "file.record", index);
  }
  return basis;
}

function validateCoordinate(
  coordinate: PortableSourceCoordinate,
  file: PortableFileRecord,
  diagnostics: MutableDiagnostic[],
  field: string,
  index?: number
): void {
  if (coordinate.start.byte > coordinate.end.byte || coordinate.start.byte > file.byteSize || coordinate.end.byte > file.byteSize) {
    pushDiagnostic(diagnostics, "invalid-coordinate", "structural-record", field, index);
  }
}

function verifySourceRecord(
  kind: PortableAuthoritativeSourceRecord["kind"],
  recordId: string,
  path: string,
  contentHash: string,
  coordinate: PortableSourceCoordinate | undefined,
  authority: Map<string, PortableAuthoritativeSourceRecord>,
  diagnostics: MutableDiagnostic[],
  index?: number
): void {
  const expected = authority.get(sourceRecordKey(kind, recordId));
  if (!expected || expected.path !== path || expected.contentHash !== contentHash || !coordinatesEqual(expected.coordinate, coordinate)) {
    pushDiagnostic(diagnostics, "source-mismatch", "structural-record", `${kind}.source`, index);
  }
}

function validateDetailChains(
  records: ReturnType<typeof collectStructuralRecords> & object,
  diagnostics: MutableDiagnostic[]
): void {
  const referencedDetails = new Set<string>();
  const detailOwners = new Map<string, string>();
  for (const [symbolIndex, symbol] of [...records.symbols.values()].entries()) {
    for (const reference of symbol.detailReferences ?? []) {
      let currentId: string | null = reference.firstSegmentId;
      const chain = new Set<string>();
      let previousId: string | null = null;
      let reconstructed = "";
      for (let index = 0; index < reference.segmentCount; index += 1) {
        if (!currentId || chain.has(currentId)) {
          pushDiagnostic(diagnostics, "invalid-detail-chain", "structural-record", `symbol.${reference.field}`, symbolIndex);
          break;
        }
        const segment = records.details.get(currentId);
        if (!segment || segment.sourceRecordId !== symbol.id || segment.field !== reference.field ||
            segment.segmentIndex !== index || segment.segmentCount !== reference.segmentCount ||
            segment.previousSegmentId !== previousId) {
          pushDiagnostic(diagnostics, "invalid-detail-chain", "structural-record", `symbol.${reference.field}`, symbolIndex);
          break;
        }
        chain.add(currentId);
        const previousOwner = detailOwners.get(currentId);
        const owner = `${symbol.id}:${reference.field}`;
        if (previousOwner && previousOwner !== owner) {
          pushDiagnostic(diagnostics, "invalid-detail-chain", "structural-record", `symbol.${reference.field}`, symbolIndex);
        }
        detailOwners.set(currentId, owner);
        referencedDetails.add(currentId);
        reconstructed += segment.text;
        previousId = currentId;
        currentId = segment.nextSegmentId;
      }
      if (!inspectContentBoundaries(reconstructed).safe) {
        pushDiagnostic(diagnostics, "unsafe-content", "structural-record", `symbol.${reference.field}`, symbolIndex);
      }
      const last = previousId ? records.details.get(previousId) : undefined;
      if (chain.size !== reference.segmentCount || currentId !== null || !last ||
          last.nextSegmentId !== null ||
          Buffer.byteLength(reconstructed, "utf8") !== reference.byteSize ||
          sha256(reconstructed) !== reference.contentHash) {
        pushDiagnostic(diagnostics, "invalid-detail-chain", "structural-record", `symbol.${reference.field}`, symbolIndex);
      }
    }
  }
  for (const [index, detail] of [...records.details.values()].entries()) {
    if (!referencedDetails.has(detail.id)) pushDiagnostic(diagnostics, "invalid-detail-chain", "structural-record", "detail.orphan", index);
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function validatePortableStructure(
  submission: PortableMapSubmission,
  shards: readonly PortableStructuralInventory[],
  basis: PortableAuthoritativeSourceBasis,
  diagnostics: MutableDiagnostic[]
): void {
  const records = collectStructuralRecords(shards, diagnostics);
  if (!records) return;
  const authority = new Map<string, PortableAuthoritativeSourceRecord>();
  for (const record of basis.records) authority.set(sourceRecordKey(record.kind, record.recordId), record);
  const basisFiles = new Map(basis.files.map(file => [file.path, file]));
  const filesById = records.files;
  if (filesById.size === 0) pushDiagnostic(diagnostics, "incomplete-structure", "structural-record", "files");

  // The source basis is the complete canonical inventory. A forward join from
  // submitted records is insufficient: omitted authority entries and duplicate
  // structural identities must both fail before semantic evidence is accepted.
  const structuralFilesByPath = new Map<string, PortableFileRecord[]>();
  for (const file of records.files.values()) {
    const values = structuralFilesByPath.get(file.path) ?? [];
    values.push(file);
    structuralFilesByPath.set(file.path, values);
  }
  for (const [index, file] of basis.files.entries()) {
    const matches = structuralFilesByPath.get(file.path) ?? [];
    if (matches.length !== 1) {
      pushDiagnostic(diagnostics, matches.length > 1 ? "duplicate-id" : "incomplete-structure", "structural-record", "file.path", index);
    }
  }
  for (const [index, file] of [...records.files.values()].entries()) {
    if (!basisFiles.has(file.path)) pushDiagnostic(diagnostics, "incomplete-structure", "structural-record", "file.path", index);
  }

  const structuralByKind = new Map<PortableAuthoritativeSourceRecord["kind"], Set<string>>([
    ["file", new Set(records.files.keys())],
    ["symbol", new Set(records.symbols.keys())],
    ["import", new Set(records.imports.keys())],
    ["relationship", new Set(records.relationships.keys())]
  ]);
  const authorityKeys = new Set<string>();
  for (const record of basis.records) authorityKeys.add(sourceRecordKey(record.kind, record.recordId));
  for (const [index, record] of basis.records.entries()) {
    if (!structuralByKind.get(record.kind)?.has(record.recordId)) {
      pushDiagnostic(diagnostics, "incomplete-structure", "structural-record", `${record.kind}.record`, index);
    }
  }
  for (const [kind, ids] of structuralByKind) {
    for (const [index, id] of [...ids].entries()) {
      if (!authorityKeys.has(sourceRecordKey(kind, id))) {
        pushDiagnostic(diagnostics, "incomplete-structure", "structural-record", `${kind}.record`, index);
      }
    }
  }

  for (const [index, shard] of shards.entries()) {
    if (shard.generationId !== submission.generationId) pushDiagnostic(diagnostics, "source-mismatch", "structural-shard", "generationId", index);
    if (shard.continuation?.hasMore) pushDiagnostic(diagnostics, "incomplete-structure", "structural-shard", "continuation", index);
  }
  const shardIds = new Set<string>();
  for (const [index, shard] of shards.entries()) {
    if (shardIds.has(shard.shardId)) pushDiagnostic(diagnostics, "duplicate-id", "structural-shard", "shardId", index);
    shardIds.add(shard.shardId);
  }

  for (const [index, file] of [...records.files.values()].entries()) {
    const source = basisFiles.get(file.path);
    if (!source || source.byteSize !== file.byteSize || source.contentHash !== file.contentHash) {
      pushDiagnostic(diagnostics, "source-mismatch", "structural-record", "file.source", index);
    }
    if (file.coordinate) validateCoordinate(file.coordinate, file, diagnostics, "file.coordinate", index);
    verifySourceRecord("file", file.id, file.path, file.contentHash, file.coordinate, authority, diagnostics, index);
  }
  for (const [index, symbol] of [...records.symbols.values()].entries()) {
    const file = filesById.get(symbol.fileId);
    if (!file || file.path !== symbol.path) pushDiagnostic(diagnostics, "source-mismatch", "structural-record", "symbol.file", index);
    if (file) validateCoordinate(symbol.coordinate, file, diagnostics, "symbol.coordinate", index);
    verifySourceRecord("symbol", symbol.id, symbol.path, symbol.contentHash, symbol.coordinate, authority, diagnostics, index);
    if (symbol.lexicalParentId !== null) {
      const parent = records.symbols.get(symbol.lexicalParentId);
      if (!parent || parent.fileId !== symbol.fileId) pushDiagnostic(diagnostics, "dangling-reference", "structural-record", "symbol.lexicalParentId", index);
    }
  }
  for (const [index, item] of [...records.imports.values()].entries()) {
    const file = filesById.get(item.sourceFileId);
    if (!file || file.path !== item.sourcePath) pushDiagnostic(diagnostics, "source-mismatch", "structural-record", "import.sourceFile", index);
    if (file) validateCoordinate(item.coordinate, file, diagnostics, "import.coordinate", index);
    verifySourceRecord("import", item.id, item.sourcePath, item.contentHash, item.coordinate, authority, diagnostics, index);
    validateTarget(item.targetFileId, item.targetSymbolId, records, diagnostics, index);
  }
  for (const [index, item] of [...records.relationships.values()].entries()) {
    const file = filesById.get(item.sourceFileId);
    if (!file || file.path !== item.sourcePath) pushDiagnostic(diagnostics, "source-mismatch", "structural-record", "relationship.sourceFile", index);
    if (file) validateCoordinate(item.coordinate, file, diagnostics, "relationship.coordinate", index);
    if (item.sourceSymbolId !== null) {
      const sourceSymbol = records.symbols.get(item.sourceSymbolId);
      if (!sourceSymbol || sourceSymbol.fileId !== item.sourceFileId) pushDiagnostic(diagnostics, "dangling-reference", "structural-record", "relationship.sourceSymbolId", index);
    }
    verifySourceRecord("relationship", item.id, item.sourcePath, item.contentHash, item.coordinate, authority, diagnostics, index);
    validateTarget(item.targetFileId, item.targetSymbolId, records, diagnostics, index);
    if (item.kind === "contains") {
      const sourceSymbol = item.sourceSymbolId === null ? undefined : records.symbols.get(item.sourceSymbolId);
      const targetSymbol = item.targetSymbolId === null ? undefined : records.symbols.get(item.targetSymbolId);
      if (!sourceSymbol || !targetSymbol || targetSymbol.fileId !== item.sourceFileId ||
          targetSymbol.lexicalParentId !== item.sourceSymbolId || item.targetFileId !== item.sourceFileId ||
          !coordinatesEqual(item.coordinate, targetSymbol.coordinate) || item.contentHash !== targetSymbol.contentHash) {
        pushDiagnostic(diagnostics, "source-mismatch", "structural-record", "relationship.contains", index);
      }
    }
  }
  for (const [index, symbol] of [...records.symbols.values()].entries()) {
    if (symbol.lexicalParentId === null) continue;
    const parent = records.symbols.get(symbol.lexicalParentId);
    const sameRange = parent !== undefined &&
      parent.coordinate.start.byte === symbol.coordinate.start.byte &&
      parent.coordinate.end.byte === symbol.coordinate.end.byte;
    if (!parent || parent.fileId !== symbol.fileId ||
        parent.coordinate.start.byte > symbol.coordinate.start.byte ||
        symbol.coordinate.end.byte > parent.coordinate.end.byte || sameRange) {
      pushDiagnostic(diagnostics, "invalid-coordinate", "structural-record", "symbol.lexicalParentId", index);
    }
  }
  validateParentCycles(records.symbols, diagnostics);
  validateDetailChains(records, diagnostics);
}

function validateTarget(
  targetFileId: string | null,
  targetSymbolId: string | null,
  records: ReturnType<typeof collectStructuralRecords> & object,
  diagnostics: MutableDiagnostic[],
  index: number
): void {
  if (targetFileId !== null && !records.files.has(targetFileId)) pushDiagnostic(diagnostics, "dangling-reference", "structural-record", "targetFileId", index);
  const symbol = targetSymbolId === null ? undefined : records.symbols.get(targetSymbolId);
  if (targetSymbolId !== null && !symbol) pushDiagnostic(diagnostics, "dangling-reference", "structural-record", "targetSymbolId", index);
  if (targetFileId !== null && symbol && symbol.fileId !== targetFileId) pushDiagnostic(diagnostics, "source-mismatch", "structural-record", "target.file", index);
}

function validateParentCycles(symbols: Map<string, PortableSymbolRecord>, diagnostics: MutableDiagnostic[]): void {
  const state = new Map<string, "visiting" | "done">();
  for (const [index, symbol] of [...symbols.values()].entries()) {
    if (state.get(symbol.id) === "done") continue;
    const path: string[] = [];
    const pathSet = new Set<string>();
    let current: string | null = symbol.id;
    while (current && symbols.has(current) && state.get(current) !== "done") {
      if (pathSet.has(current) || state.get(current) === "visiting") {
        pushDiagnostic(diagnostics, "parent-cycle", "structural-record", "symbol.lexicalParentId", index);
        break;
      }
      path.push(current);
      pathSet.add(current);
      state.set(current, "visiting");
      current = symbols.get(current)?.lexicalParentId ?? null;
    }
    for (const id of path) state.set(id, "done");
  }
}

function evidenceRecord(
  evidence: PortableEvidenceDependency,
  records: ReturnType<typeof collectStructuralRecords> & object
): {path: string; contentHash: string; coordinate?: PortableSourceCoordinate} | null {
  switch (evidence.kind) {
    case "file": {
      const value = records.files.get(evidence.recordId);
      return value ? {path: value.path, contentHash: value.contentHash, coordinate: value.coordinate} : null;
    }
    case "symbol": {
      const value = records.symbols.get(evidence.recordId);
      return value ? {path: value.path, contentHash: value.contentHash, coordinate: value.coordinate} : null;
    }
    case "relationship": {
      const value = records.relationships.get(evidence.recordId);
      return value ? {path: value.sourcePath, contentHash: value.contentHash, coordinate: value.coordinate} : null;
    }
    case "compatibility-document":
      return null;
  }
}

function validateEvidence(
  evidence: PortableEvidenceDependency,
  records: ReturnType<typeof collectStructuralRecords> & object,
  diagnostics: MutableDiagnostic[],
  index: number
): void {
  const canonical = evidenceRecord(evidence, records);
  if (!canonical || canonical.path !== evidence.path || canonical.contentHash !== evidence.contentHash ||
      !coordinatesEqual(canonical.coordinate, evidence.coordinate)) {
    pushDiagnostic(diagnostics, "invalid-evidence", "semantic", "evidence", index);
  }
}

function validateSemanticModel(
  semantic: PortableAcceptedSemanticModel,
  records: ReturnType<typeof collectStructuralRecords> & object,
  diagnostics: MutableDiagnostic[]
): void {
  for (const [index, capability] of semantic.capabilities.entries()) {
    for (const evidence of capability.evidence) validateEvidence(evidence, records, diagnostics, index);
  }
  for (const [index, claim] of semantic.claims.entries()) {
    for (const evidence of claim.evidence) validateEvidence(evidence, records, diagnostics, index);
  }
  for (const [index, alias] of semantic.aliases.entries()) {
    const targetExists = alias.targetKind === "capability"
      ? semantic.capabilities.some(capability => capability.id === alias.targetId)
      : records.symbols.has(alias.targetId);
    if (!targetExists) pushDiagnostic(diagnostics, "dangling-reference", "semantic", "alias.targetId", index);
    for (const evidence of alias.evidence) validateEvidence(evidence, records, diagnostics, index);
  }
}

function validateDocuments(
  submission: PortableMapSubmission,
  basis: PortableAuthoritativeSourceBasis,
  diagnostics: MutableDiagnostic[]
): Record<CodebaseDocumentId, string> | null {
  const basisPaths = new Set(basis.files.map(file => file.path));
  const compiled = {} as Record<CodebaseDocumentId, string>;
  let valid = true;
  for (const [index, id] of CODEBASE_DOCUMENT_IDS.entries()) {
    const document = submission.documents[id];
    for (const evidencePath of document.evidencePaths) {
      if (!basisPaths.has(evidencePath)) {
        pushDiagnostic(diagnostics, "invalid-document", "document", "evidencePaths", index);
        valid = false;
      }
    }
    try {
      const content = compileCodebaseDocument(id, document);
      const validation = validateCodebaseContent(content, `codebase.${id}`);
      if (!validation.valid || !inspectContentBoundaries(content).safe) {
        pushDiagnostic(diagnostics, validation.valid ? "unsafe-content" : "invalid-document", "document", validation.valid ? "content-boundary" : "substantive", index);
        valid = false;
      }
      compiled[id] = content;
    } catch {
      pushDiagnostic(diagnostics, "invalid-document", "document", "compile", index);
      valid = false;
    }
  }
  return valid ? compiled : null;
}

/**
 * Validate a complete portable model in memory. The function never reads or
 * writes the filesystem and never retains rejected input in its result.
 */
export function validatePortableMapModel(
  structuralShardsInput: readonly unknown[],
  authoredSubmissionInput: unknown,
  authoritativeSourceBasisInput: unknown
): PortableModelValidationResult {
  const diagnostics: MutableDiagnostic[] = [];
  const shards = parseStructuralShards(structuralShardsInput, diagnostics);
  const submissionResult = portableMapSubmissionSchema.safeParse(authoredSubmissionInput);
  if (!submissionResult.success) {
    portableContractIssues(submissionResult.error);
    pushDiagnostic(diagnostics, "invalid-input", "semantic", "submission");
  }
  const basis = validateSourceBasis(authoritativeSourceBasisInput, diagnostics);
  if (!shards || !submissionResult.success || !basis) {
    return {ok: false, diagnostics: finishDiagnostics(diagnostics)};
  }
  const submission = submissionResult.data;
  if (basis.generationId !== submission.generationId) pushDiagnostic(diagnostics, "source-mismatch", "source-basis", "generationId");
  inspectStructuralStrings(shards, basis, diagnostics);
  inspectSemanticStrings(submission.semantic, submission.documents, diagnostics);
  validatePortableStructure(submission, shards, basis, diagnostics);
  const records = collectStructuralRecords(shards, diagnostics);
  if (records) validateSemanticModel(submission.semantic, records, diagnostics);
  const compiledDocuments = validateDocuments(submission, basis, diagnostics);
  if (diagnostics.length > 0 || !compiledDocuments) {
    return {ok: false, diagnostics: finishDiagnostics(diagnostics)};
  }
  return {
    ok: true,
    data: {
      submission,
      structuralShards: shards,
      sourceBasis: basis,
      compiledDocuments
    }
  };
}
