import {createHash} from "node:crypto";
import path from "node:path";
import * as z from "zod/v4";

import {CODEBASE_DOCUMENT_IDS, type CodebaseDocumentId} from "../codebase-authoring.js";
import {
  portableFileRecordSchema,
  portableGenerationManifestSchema,
  portableImportRelationshipSchema,
  portablePublicationMarkerSchema,
  portableRelationshipRecordSchema,
  portableStructuralDetailRecordSchema,
  portableSymbolRecordSchema,
  repositoryRelativePathSchema,
  type PortableAlias,
  type PortableCapability,
  type PortableClaim,
  type PortableFileRecord,
  type PortableGenerationManifest,
  type PortableImportRelationship,
  type PortableRelationshipRecord,
  type PortableStructuralDetailRecord,
  type PortableSymbolRecord
} from "./contracts.js";
import {
  parsePortableRootDescriptor,
  parsePortableSemanticIndex,
  parsePortableSemanticShard,
  type PortableSemanticFragment,
  type PortableSemanticIndexEntry,
  type PortableRootDescriptor
} from "./render.js";
import {readHardenedLiteralFile} from "./literal-read.js";
import {
  capturePortablePinAuthorityRoot,
  persistPortablePinReceipt,
  restorePortablePinReceipt as restoreStoredPortablePinReceipt,
  type PortablePinReceipt
} from "./pin-authority.js";
export type {PortablePinReceipt} from "./pin-authority.js";

/**
 * The generated bundle has a different safety boundary from source files.
 * `.blueprint` is intentionally excluded by the source inventory policy, but
 * it is the only place this reader is allowed to inspect.
 */
const CODEBASE_ROOT = ".blueprint/codebase";
const INDEX_PATH = `${CODEBASE_ROOT}/INDEX.md`;
const PUBLICATION_MARKER_PATH = `${CODEBASE_ROOT}/.publication.json`;
const MAX_DIAGNOSTICS = 32;
const SHA256 = /^[a-f0-9]{64}$/;
const DEFAULT_LIMITS = {
  indexBytes: 4 * 1024,
  entryBytes: 4 * 1024,
  manifestBytes: 8 * 1024 * 1024,
  pageBytes: 32 * 1024,
  compatibilityBytes: 2 * 1024 * 1024,
  generationFiles: 100_000,
  generationBytes: 128 * 1024 * 1024,
  records: 100_000,
  semanticFragments: 100_000,
  predecessorDepth: 32
} as const;
/** Ordinary untrusted retained-generation navigation remains bounded. Durable
 * owner receipts use direct target verification and do not use this budget. */
export const PORTABLE_PIN_HANDOFF_PREDECESSOR_DEPTH = 100_000;

export type PortableResolverLimits = {
  readonly indexBytes?: number;
  readonly entryBytes?: number;
  readonly manifestBytes?: number;
  readonly pageBytes?: number;
  readonly compatibilityBytes?: number;
  readonly generationFiles?: number;
  readonly generationBytes?: number;
  readonly records?: number;
  readonly semanticFragments?: number;
  readonly predecessorDepth?: number;
};

type EffectiveLimits = {
  readonly [K in keyof typeof DEFAULT_LIMITS]: number;
};

function limitsOf(input?: PortableResolverLimits): EffectiveLimits | null {
  if (input !== undefined && (input === null || typeof input !== "object" || Array.isArray(input))) return null;
  const result = {...DEFAULT_LIMITS, ...(input ?? {})} as EffectiveLimits;
  for (const value of Object.values(result)) {
    if (!Number.isSafeInteger(value) || value <= 0) return null;
  }
  return result;
}

export type PortableResolverDiagnosticCode =
  | "missing"
  | "invalid"
  | "unsupported"
  | "unsafe-path"
  | "checksum-mismatch"
  | "cycle"
  | "duplicate-authority"
  | "resource-limit"
  | "stale"
  | "not-found";

export type PortableResolverDiagnosticScope =
  | "index"
  | "marker"
  | "generation"
  | "manifest"
  | "entry"
  | "page"
  | "records"
  | "semantic"
  | "predecessor"
  | "compatibility"
  | "selection";

export type PortableResolverDiagnostic = {
  readonly code: PortableResolverDiagnosticCode;
  readonly scope: PortableResolverDiagnosticScope;
  readonly message: string;
};

const DIAGNOSTIC_MESSAGES: Record<PortableResolverDiagnosticCode, string> = {
  missing: "The portable map is unavailable.",
  invalid: "The portable map failed its fixed contract.",
  unsupported: "The portable map uses an unsupported format or state.",
  "unsafe-path": "The portable map contains an unsafe path.",
  "checksum-mismatch": "The portable map contains bytes that do not match its sealed checksum.",
  cycle: "The portable map contains a cyclic publication or continuation link.",
  "duplicate-authority": "The portable map contains conflicting authorities.",
  "resource-limit": "The portable map exceeds a fixed resolver resource limit.",
  stale: "The portable map publication basis is stale or guarded.",
  "not-found": "The requested retained generation or evidence was not found."
};

function diagnostic(code: PortableResolverDiagnosticCode, scope: PortableResolverDiagnosticScope): PortableResolverDiagnostic {
  return {code, scope, message: DIAGNOSTIC_MESSAGES[code]};
}

function addDiagnostic(list: PortableResolverDiagnostic[], item: PortableResolverDiagnostic): void {
  if (list.length < MAX_DIAGNOSTICS) list.push(item);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function byteLength(bytes: Uint8Array): number {
  return bytes.byteLength;
}

function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(bytes);
  } catch {
    return null;
  }
}

function safeRelativePath(value: string): boolean {
  return repositoryRelativePathSchema.safeParse(value).success;
}

function safeGenerationId(value: string): boolean {
  return z.string().min(1).max(128).regex(/^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/).safeParse(value).success;
}

async function readLiteralBytes(root: string, relativePath: string, maxBytes: number): Promise<
  {ok: true; bytes: Uint8Array} | {ok: false; reason: "missing" | "unsafe-path" | "too-large" | "unreadable" | "changed" | "binary"}
> {
  if (!safeRelativePath(relativePath)) return {ok: false, reason: "unsafe-path"};
  const result = await readHardenedLiteralFile(root, relativePath, maxBytes);
  if (result.ok) return result;
  return {ok: false, reason: result.reason === "unsafe" ? "unsafe-path" : result.reason};
}

function parsedJson<T>(bytes: Uint8Array, parse: (value: unknown) => T | null): T | null {
  const text = decodeUtf8(bytes);
  if (text === null) return null;
  try { return parse(JSON.parse(text)); } catch { return null; }
}

function parseSafe<T>(schema: z.ZodType<T>, value: unknown): T | null {
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}

type Page = {readonly path: string; readonly bytes: Uint8Array; readonly body: string; readonly hash: string};
type StructuralKind = "files" | "symbols" | "imports" | "relationships" | "details";
type StructuralRecord = PortableFileRecord | PortableSymbolRecord | PortableImportRelationship | PortableRelationshipRecord | PortableStructuralDetailRecord;
type SemanticKind = "capability" | "claim" | "alias";
type SemanticRecord = PortableCapability | PortableClaim | PortableAlias;
type SemanticKey = `${SemanticKind}\u0000${string}`;

type VerifiedGeneration = {
  readonly generationId: string;
  readonly manifest: PortableGenerationManifest;
  readonly manifestHash: string;
  readonly entry: Page;
  readonly pages: ReadonlyMap<string, Page>;
  readonly structural: ReadonlyMap<string, {kind: StructuralKind; record: StructuralRecord; page: Page}>;
  readonly files: ReadonlyMap<string, PortableFileRecord>;
  readonly symbols: ReadonlyMap<string, PortableSymbolRecord>;
  readonly imports: ReadonlyMap<string, PortableImportRelationship>;
  readonly relationships: ReadonlyMap<string, PortableRelationshipRecord>;
  readonly details: ReadonlyMap<string, PortableStructuralDetailRecord>;
  readonly semantic: ReadonlyMap<SemanticKey, {record: SemanticRecord; parts: readonly PortableSemanticFragment[]; pages: readonly Page[]}>;
  readonly semanticPages: ReadonlyMap<string, PortableSemanticShardPage>;
  readonly semanticIndex: ReadonlyMap<SemanticKey, PortableSemanticIndexEntry>;
};

type PortableSemanticShardPage = {readonly shard: ReturnType<typeof parsePortableSemanticShard> & object; readonly page: Page};

type VerifyResult = {ok: true; value: VerifiedGeneration} | {ok: false; diagnostics: readonly PortableResolverDiagnostic[]};

function mapKey(kind: string, id: string): string {
  return `${kind}\u0000${id}`;
}

function recordTypeFor(kind: StructuralKind): z.ZodType<unknown> {
  switch (kind) {
    case "files": return portableFileRecordSchema;
    case "symbols": return portableSymbolRecordSchema;
    case "imports": return portableImportRelationshipSchema;
    case "relationships": return portableRelationshipRecordSchema;
    case "details": return portableStructuralDetailRecordSchema;
  }
}

function isRecordKind(value: unknown): value is StructuralKind {
  return value === "files" || value === "symbols" || value === "imports" || value === "relationships" || value === "details";
}

function fixedReadDiagnostic(scope: PortableResolverDiagnosticScope, result: Awaited<ReturnType<typeof readLiteralBytes>>): PortableResolverDiagnostic {
  if (result.ok) return diagnostic("invalid", scope);
  if (result.reason === "unsafe-path") return diagnostic("unsafe-path", scope);
  if (result.reason === "too-large") return diagnostic("resource-limit", scope);
  if (result.reason === "missing") return diagnostic("missing", scope);
  return diagnostic(result.reason === "changed" ? "stale" : "invalid", scope);
}

async function readPage(root: string, relativePath: string, maxBytes: number, diagnostics: PortableResolverDiagnostic[], scope: PortableResolverDiagnosticScope = "page"): Promise<Page | null> {
  const result = await readLiteralBytes(root, relativePath, maxBytes);
  if (!result.ok) {
    addDiagnostic(diagnostics, fixedReadDiagnostic(scope, result));
    return null;
  }
  const body = decodeUtf8(result.bytes);
  if (body === null) {
    addDiagnostic(diagnostics, diagnostic("invalid", scope));
    return null;
  }
  return {path: relativePath, bytes: result.bytes, body, hash: sha256(result.bytes)};
}

function pathInGeneration(relativePath: string, generationId: string): boolean {
  return relativePath.startsWith(`generations/${generationId}/`) && safeRelativePath(relativePath);
}

function expectedChecksum(manifest: PortableGenerationManifest, relativePath: string): string | null {
  return manifest.checksums.pages.find(item => item.path === relativePath)?.checksum ?? null;
}

function validateRecordReferences(
  structural: Map<string, {kind: StructuralKind; record: StructuralRecord; page: Page}>,
  files: Map<string, PortableFileRecord>,
  symbols: Map<string, PortableSymbolRecord>,
  imports: Map<string, PortableImportRelationship>,
  relationships: Map<string, PortableRelationshipRecord>,
  details: Map<string, PortableStructuralDetailRecord>,
  diagnostics: PortableResolverDiagnostic[]
): boolean {
  let valid = true;
  const fail = () => { valid = false; };
  for (const symbol of symbols.values()) {
    const file = files.get(symbol.fileId);
    if (!file || file.path !== symbol.path || symbol.lexicalParentId !== null && !symbols.has(symbol.lexicalParentId)) fail();
  }
  for (const item of imports.values()) {
    const file = files.get(item.sourceFileId);
    if (!file || file.path !== item.sourcePath || (item.targetFileId !== null && !files.has(item.targetFileId)) ||
        (item.targetSymbolId !== null && !symbols.has(item.targetSymbolId))) fail();
  }
  for (const item of relationships.values()) {
    const file = files.get(item.sourceFileId);
    if (!file || file.path !== item.sourcePath || (item.sourceSymbolId !== null && !symbols.has(item.sourceSymbolId)) ||
        (item.targetFileId !== null && !files.has(item.targetFileId)) ||
        (item.targetSymbolId !== null && !symbols.has(item.targetSymbolId))) fail();
  }
  const detailsBySource = new Map<string, PortableStructuralDetailRecord[]>();
  for (const detail of details.values()) {
    if (!structural.has(detail.sourceRecordId)) fail();
    const key = mapKey(detail.sourceRecordId, detail.field);
    const group = detailsBySource.get(key) ?? [];
    group.push(detail);
    detailsBySource.set(key, group);
  }
  for (const [key, group] of detailsBySource) {
    group.sort((a, b) => a.segmentIndex - b.segmentIndex);
    const expectedCount = group[0]?.segmentCount ?? 0;
    if (group.length !== expectedCount || group.some((item, index) => item.segmentCount !== expectedCount || item.segmentIndex !== index)) fail();
    for (let index = 0; index < group.length; index += 1) {
      const item = group[index]!;
      if ((index === 0 ? item.previousSegmentId : item.previousSegmentId !== group[index - 1]!.id ? item.previousSegmentId : null) !== null ||
          (index === group.length - 1 ? item.nextSegmentId : item.nextSegmentId !== group[index + 1]!.id ? item.nextSegmentId : null) !== null) fail();
    }
    const source = structural.get(key.split("\u0000", 1)[0]!);
    if (source && "detailReferences" in source.record) {
      const reference = source.record.detailReferences?.find(item => item.field === key.split("\u0000")[1]);
      const joined = group.map(item => item.text).join("");
      if (reference && (
        reference.segmentCount !== group.length ||
        reference.firstSegmentId !== group[0]?.id ||
        reference.byteSize !== Buffer.byteLength(joined, "utf8") ||
        reference.contentHash !== sha256(new TextEncoder().encode(joined))
      )) fail();
    }
  }
  if (!valid) addDiagnostic(diagnostics, diagnostic("invalid", "records"));
  return valid;
}

function evidenceRecord(
  item: {kind: string; recordId: string; path: string; contentHash: string; coordinate?: unknown},
  structural: Map<string, {kind: StructuralKind; record: StructuralRecord; page: Page}>,
  files: Map<string, PortableFileRecord>,
  symbols: Map<string, PortableSymbolRecord>,
  imports: Map<string, PortableImportRelationship>,
  relationships: Map<string, PortableRelationshipRecord>
): {record: StructuralRecord | undefined; file: PortableFileRecord | undefined; rangeHash?: string} {
  let found: StructuralRecord | undefined;
  if (item.kind === "file" || item.kind === "symbol") found = structural.get(item.recordId)?.record;
  else found = imports.get(item.recordId) ?? relationships.get(item.recordId);
  const file = item.kind === "file" ? files.get(item.recordId) :
    item.kind === "symbol" ? files.get((found as PortableSymbolRecord | undefined)?.fileId ?? "") :
      files.get((found as PortableImportRelationship | PortableRelationshipRecord | undefined)?.sourceFileId ?? "");
  return {record: found, file, rangeHash: found && item.kind !== "file" ? (found as PortableSymbolRecord | PortableImportRelationship | PortableRelationshipRecord).contentHash : undefined};
}

function verifySemanticEvidence(
  record: SemanticRecord,
  structural: Map<string, {kind: StructuralKind; record: StructuralRecord; page: Page}>,
  files: Map<string, PortableFileRecord>,
  symbols: Map<string, PortableSymbolRecord>,
  imports: Map<string, PortableImportRelationship>,
  relationships: Map<string, PortableRelationshipRecord>,
  diagnostics: PortableResolverDiagnostic[]
): boolean {
  let valid = true;
  for (const item of record.evidence) {
    if (item.kind === "compatibility-document") {
      if (!safeRelativePath(item.path) || item.recordId.length === 0) valid = false;
      continue;
    }
    const selected = evidenceRecord(item, structural, files, symbols, imports, relationships);
    if (!selected.record || !selected.file || selected.file.path !== item.path || selected.record.contentHash !== item.contentHash) {
      valid = false;
      continue;
    }
    if (item.coordinate && JSON.stringify(item.coordinate) !== JSON.stringify((selected.record as {coordinate?: unknown}).coordinate)) valid = false;
  }
  if (!valid) addDiagnostic(diagnostics, diagnostic("invalid", "semantic"));
  return valid;
}

function mergeSemanticParts(parts: readonly PortableSemanticFragment[]): SemanticRecord | null {
  if (parts.length === 0) return null;
  const ordered = [...parts].sort((left, right) => left.evidenceStart - right.evidenceStart);
  let nextStart = 0;
  for (const part of ordered) {
    if (part.evidenceStart !== nextStart) return null;
    nextStart += part.evidenceCount;
  }
  const first = ordered[0]!.record;
  return {...first, evidence: ordered.flatMap(part => part.record.evidence)} as SemanticRecord;
}

async function verifyGeneration(root: string, generationId: string, inputLimits: PortableResolverLimits | undefined, predecessorMode: boolean): Promise<VerifyResult> {
  const limits = limitsOf(inputLimits);
  if (!limits) return {ok: false, diagnostics: [diagnostic("resource-limit", "selection")]};
  const diagnostics: PortableResolverDiagnostic[] = [];
  if (!safeGenerationId(generationId)) return {ok: false, diagnostics: [diagnostic("unsafe-path", "generation")]};
  const generationPrefix = `generations/${generationId}`;
  const manifestPath = `${generationPrefix}/manifest.json`;
  const entryPath = `${generationPrefix}/ENTRY.md`;
  const manifestBytes = await readLiteralBytes(root, `${CODEBASE_ROOT}/${manifestPath}`, limits.manifestBytes);
  if (!manifestBytes.ok) return {ok: false, diagnostics: [fixedReadDiagnostic("manifest", manifestBytes)]};
  const manifest = parsedJson(manifestBytes.bytes, value => parseSafe(portableGenerationManifestSchema, value));
  if (!manifest || manifest.generationId !== generationId) return {ok: false, diagnostics: [diagnostic("invalid", "manifest")]};
  if (manifest.inventoryShards.length > limits.generationFiles || manifest.checksums.pages.length > limits.generationFiles) {
    return {ok: false, diagnostics: [diagnostic("resource-limit", "generation")]};
  }
  const entryRead = await readPage(root, `${CODEBASE_ROOT}/${entryPath}`, limits.entryBytes, diagnostics, "entry");
  const entry = entryRead ? {...entryRead, path: entryPath} : null;
  if (!entry || sha256(entry.bytes) !== manifest.checksums.entry) {
    if (entry) addDiagnostic(diagnostics, diagnostic("checksum-mismatch", "entry"));
    return {ok: false, diagnostics};
  }
  const pages = new Map<string, Page>();
  let totalBytes = byteLength(entry.bytes) + byteLength(manifestBytes.bytes);
  for (const checksum of manifest.checksums.pages) {
    if (!pathInGeneration(checksum.path, generationId) || checksum.path.endsWith("/manifest.json") || checksum.path.endsWith("/ENTRY.md")) {
      addDiagnostic(diagnostics, diagnostic("unsafe-path", "page"));
      continue;
    }
    if (pages.has(checksum.path)) {
      addDiagnostic(diagnostics, diagnostic("duplicate-authority", "page"));
      continue;
    }
    const pageRead = await readPage(root, `${CODEBASE_ROOT}/${checksum.path}`, limits.pageBytes, diagnostics);
    if (!pageRead) continue;
    const page = {...pageRead, path: checksum.path};
    totalBytes += byteLength(page.bytes);
    if (totalBytes > limits.generationBytes) {
      addDiagnostic(diagnostics, diagnostic("resource-limit", "generation"));
      break;
    }
    if (page.hash !== checksum.checksum) addDiagnostic(diagnostics, diagnostic("checksum-mismatch", "page"));
    pages.set(checksum.path, page);
  }
  if (diagnostics.length > 0) return {ok: false, diagnostics};

  const structural = new Map<string, {kind: StructuralKind; record: StructuralRecord; page: Page}>();
  const files = new Map<string, PortableFileRecord>();
  const symbols = new Map<string, PortableSymbolRecord>();
  const imports = new Map<string, PortableImportRelationship>();
  const relationships = new Map<string, PortableRelationshipRecord>();
  const details = new Map<string, PortableStructuralDetailRecord>();
  const semanticPages = new Map<string, PortableSemanticShardPage>();
  const semanticParts = new Map<SemanticKey, Array<{fragment: PortableSemanticFragment; page: Page}>>();
  const indexEntries = new Map<SemanticKey, PortableSemanticIndexEntry>();
  const recognizedSemanticPaths = new Set<string>();
  const inventoryPaths = new Set(manifest.inventoryShards.map(item => item.path));
  let recordCount = 0;
  let fragmentCount = 0;

  for (const shardManifest of manifest.inventoryShards) {
    if (!pathInGeneration(shardManifest.path, generationId)) {
      addDiagnostic(diagnostics, diagnostic("unsafe-path", "records"));
      continue;
    }
    const page = pages.get(shardManifest.path);
    if (!page || page.hash !== shardManifest.checksum) {
      addDiagnostic(diagnostics, page ? diagnostic("checksum-mismatch", "page") : diagnostic("invalid", "records"));
      continue;
    }
    const parsed = parsedJson(page.bytes, value => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const candidate = value as Record<string, unknown>;
      if (candidate.generationId !== generationId || candidate.shardId !== shardManifest.shardId || candidate.recordKind !== shardManifest.recordKind || !Array.isArray(candidate.records)) return null;
      return candidate;
    });
    if (!parsed || !isRecordKind(parsed.recordKind) || !Array.isArray(parsed.records) || parsed.records.length !== shardManifest.recordCount || byteLength(page.bytes) !== shardManifest.byteSize) {
      addDiagnostic(diagnostics, diagnostic("invalid", "records"));
      continue;
    }
    const schema = recordTypeFor(parsed.recordKind);
    const records = parsed.records as unknown[];
    for (const item of records) {
      const checked = parseSafe(schema, item) as StructuralRecord | null;
      if (!checked) {
        addDiagnostic(diagnostics, diagnostic("invalid", "records"));
        continue;
      }
      recordCount += 1;
      if (recordCount > limits.records) {
        addDiagnostic(diagnostics, diagnostic("resource-limit", "records"));
        break;
      }
      const id = checked.id;
      if (structural.has(id)) {
        addDiagnostic(diagnostics, diagnostic("duplicate-authority", "records"));
        continue;
      }
      const entry = {kind: parsed.recordKind, record: checked, page};
      structural.set(id, entry);
      if (parsed.recordKind === "files") files.set(id, checked as PortableFileRecord);
      else if (parsed.recordKind === "symbols") symbols.set(id, checked as PortableSymbolRecord);
      else if (parsed.recordKind === "imports") imports.set(id, checked as PortableImportRelationship);
      else if (parsed.recordKind === "relationships") relationships.set(id, checked as PortableRelationshipRecord);
      else details.set(id, checked as PortableStructuralDetailRecord);
    }
  }
  // Parse semantic pages from the already checksum-verified page set. This is
  // intentionally separate from inventoryShards; semantic records have their
  // own fragment/index codecs and continuation chains.
  for (const page of pages.values()) {
    if (!page.path.includes("/data/")) continue;
    const semanticShard = parsePortableSemanticShard(page.body);
    if (semanticShard && semanticShard.generationId !== generationId) {
      addDiagnostic(diagnostics, diagnostic("duplicate-authority", "semantic"));
    } else if (semanticShard) {
      recognizedSemanticPaths.add(page.path);
      if (semanticPages.has(page.path)) addDiagnostic(diagnostics, diagnostic("duplicate-authority", "semantic"));
      semanticPages.set(page.path, {shard: semanticShard as PortableSemanticShardPage["shard"], page});
      for (const fragment of semanticShard.records) {
        fragmentCount += 1;
        if (fragmentCount > limits.semanticFragments) {
          addDiagnostic(diagnostics, diagnostic("resource-limit", "semantic"));
          break;
        }
        const key = `${fragment.kind}\u0000${fragment.recordId}` as SemanticKey;
        const list = semanticParts.get(key) ?? [];
        list.push({fragment, page});
        semanticParts.set(key, list);
      }
      continue;
    }
    const semanticIndex = parsePortableSemanticIndex(page.body);
    if (semanticIndex && semanticIndex.generationId !== generationId) {
      addDiagnostic(diagnostics, diagnostic("duplicate-authority", "semantic"));
    } else if (semanticIndex) {
      recognizedSemanticPaths.add(page.path);
      for (const entry of semanticIndex.entries) {
        const key = `${entry.kind}\u0000${entry.recordId}` as SemanticKey;
        if (indexEntries.has(key)) addDiagnostic(diagnostics, diagnostic("duplicate-authority", "semantic"));
        indexEntries.set(key, entry);
      }
    }
  }
  for (const page of pages.values()) {
    if (page.path.includes("/data/") && !inventoryPaths.has(page.path) && !recognizedSemanticPaths.has(page.path)) {
      addDiagnostic(diagnostics, diagnostic("invalid", "semantic"));
    }
  }
  if (diagnostics.length > 0) return {ok: false, diagnostics};
  if (!validateRecordReferences(structural, files, symbols, imports, relationships, details, diagnostics)) return {ok: false, diagnostics};

  const semantic = new Map<SemanticKey, {record: SemanticRecord; parts: readonly PortableSemanticFragment[]; pages: readonly Page[]}>();
  for (const [key, entries] of semanticParts) {
    const parts = entries.map(item => item.fragment);
    const partCount = parts[0]?.partCount ?? 0;
    const indexes = new Set<number>();
    if (!parts.every(item => item.partCount === partCount && !indexes.has(item.partIndex) && indexes.add(item.partIndex))) {
      addDiagnostic(diagnostics, diagnostic("invalid", "semantic"));
      continue;
    }
    const record = mergeSemanticParts(parts);
    if (!record || !verifySemanticEvidence(record, structural, files, symbols, imports, relationships, diagnostics)) continue;
    const index = indexEntries.get(key);
    if (!index || index.partCount !== partCount || index.evidenceCount !== record.evidence.length ||
        index.firstPath !== entries.find(item => item.fragment.partIndex === 0)?.page.path ||
        index.contentHash !== sha256(new TextEncoder().encode(JSON.stringify(record)))) {
      addDiagnostic(diagnostics, diagnostic("invalid", "semantic"));
      continue;
    }
    semantic.set(key, {record, parts, pages: [...new Map(entries.map(item => [item.page.path, item.page])).values()]});
  }
  for (const key of semantic.keys()) {
    const id = key.slice(key.indexOf("\u0000") + 1);
    if (structural.has(id)) addDiagnostic(diagnostics, diagnostic("duplicate-authority", "semantic"));
  }
  for (const item of semantic.values()) {
    if ("claimIds" in item.record) {
      for (const claimId of item.record.claimIds) if (!semantic.has(`claim\u0000${claimId}`)) addDiagnostic(diagnostics, diagnostic("invalid", "semantic"));
    }
    if ("targetKind" in item.record) {
      const targetExists = item.record.targetKind === "capability"
        ? semantic.has(`capability\u0000${item.record.targetId}`)
        : symbols.has(item.record.targetId);
      if (!targetExists) addDiagnostic(diagnostics, diagnostic("invalid", "semantic"));
    }
  }
  if (semantic.size !== indexEntries.size || semantic.size !== semanticParts.size) addDiagnostic(diagnostics, diagnostic("invalid", "semantic"));

  // Every semantic continuation must point at the adjacent fragment for the
  // same kind+record. Index continuations form a separate finite chain.
  const fragmentByPath = new Map<string, PortableSemanticFragment[]>();
  for (const item of semanticPages.values()) fragmentByPath.set(item.page.path, item.shard.records);
  for (const item of semanticPages.values()) for (const fragment of item.shard.records) {
    const key = `${fragment.kind}\u0000${fragment.recordId}` as SemanticKey;
    const target = (pathValue: string | null, delta: -1 | 1): boolean => {
      if (pathValue === null) return true;
      if (!pathInGeneration(pathValue, generationId)) return false;
      const candidates = fragmentByPath.get(pathValue) ?? [];
      return candidates.some(other => other.kind === fragment.kind && other.recordId === fragment.recordId && other.partIndex === fragment.partIndex + delta);
    };
    if (!target(fragment.continuation.previous, -1) || !target(fragment.continuation.next, 1) || !semantic.has(key)) addDiagnostic(diagnostics, diagnostic("invalid", "semantic"));
  }
  const indexPages = [...pages.values()].filter(page => page.path.includes("/data/semantic-index-"));
  if (indexPages.length > 0) {
    const indexByPath = new Map<string, ReturnType<typeof parsePortableSemanticIndex>>();
    for (const page of indexPages) indexByPath.set(page.path, parsePortableSemanticIndex(page.body));
    const first = indexPages.find(page => indexByPath.get(page.path)?.continuation.previous === null);
    if (!first) addDiagnostic(diagnostics, diagnostic("cycle", "semantic"));
    else {
      const seen = new Set<string>();
      let current: string | null = first.path;
      while (current) {
        if (seen.has(current)) { addDiagnostic(diagnostics, diagnostic("cycle", "semantic")); break; }
        seen.add(current);
        const page = indexByPath.get(current);
        if (!page) { addDiagnostic(diagnostics, diagnostic("invalid", "semantic")); break; }
        const next = page.continuation.next;
        if (next !== null && (!pathInGeneration(next, generationId) || !indexByPath.has(next))) { addDiagnostic(diagnostics, diagnostic("invalid", "semantic")); break; }
        if (next && indexByPath.get(next)?.continuation.previous !== current) addDiagnostic(diagnostics, diagnostic("invalid", "semantic"));
        current = next;
      }
      if (seen.size !== indexPages.length) addDiagnostic(diagnostics, diagnostic("duplicate-authority", "semantic"));
    }
  }
  if (diagnostics.length > 0) return {ok: false, diagnostics};
  if (manifest.structuralCoverage.filesInventoried !== files.size ||
      manifest.structuralCoverage.filesWithFullCoverage !== [...files.values()].filter(item => item.coverageStatus === "full").length ||
      manifest.structuralCoverage.filesWithFileCoverage !== [...files.values()].filter(item => item.coverageStatus === "file").length ||
      manifest.structuralCoverage.symbolsExtracted !== symbols.size ||
      manifest.structuralCoverage.importsExtracted !== imports.size ||
      manifest.structuralCoverage.relationshipsExtracted !== relationships.size ||
      manifest.semanticCoverage.capabilitiesAccepted !== [...semantic.values()].filter(item => "name" in item.record).length ||
      manifest.semanticCoverage.claimsAccepted !== [...semantic.values()].filter(item => "statement" in item.record).length ||
      manifest.semanticCoverage.aliasesAccepted !== [...semantic.values()].filter(item => "alias" in item.record).length ||
      manifest.semanticCoverage.evidenceDependencies !== manifest.evidenceDependencies.length) {
    addDiagnostic(diagnostics, diagnostic("invalid", "manifest"));
  }
  if (diagnostics.length > 0) return {ok: false, diagnostics};
  // `predecessorMode` documents why this function is called. Active reads do
  // not open predecessor files; retained reads do so in the chain verifier.
  void predecessorMode;
  return {ok: true, value: {generationId, manifest, manifestHash: sha256(manifestBytes.bytes), entry, pages, structural, files, symbols, imports, relationships, details, semantic, semanticPages, semanticIndex: indexEntries}};
}

type MarkerState = {kind: "none"} | {kind: "valid"; marker: z.infer<typeof portablePublicationMarkerSchema>} | {kind: "unknown"};

async function readMarker(root: string, limits: EffectiveLimits, diagnostics: PortableResolverDiagnostic[]): Promise<MarkerState> {
  const result = await readLiteralBytes(root, PUBLICATION_MARKER_PATH, limits.manifestBytes);
  if (!result.ok) {
    if (result.reason === "missing") return {kind: "none"};
    addDiagnostic(diagnostics, diagnostic(result.reason === "unsafe-path" ? "unsafe-path" : "invalid", "marker"));
    return {kind: "unknown"};
  }
  const marker = parsedJson(result.bytes, value => {
    // Importing the schema value here avoids adding a dependency on any writer
    // or artifacts tool while retaining strict v2 validation.
    return parseSafe(portablePublicationMarkerSchema, value);
  });
  if (!marker) {
    addDiagnostic(diagnostics, diagnostic("unsupported", "marker"));
    return {kind: "unknown"};
  }
  return {kind: "valid", marker};
}

type NavigationInternal = {
  readonly indexBody: string;
  readonly indexHash: string;
  readonly descriptor: PortableRootDescriptor | null;
  readonly marker: MarkerState;
  readonly active: VerifiedGeneration | null;
  readonly portableState: "valid" | "absent" | "invalid" | "unsupported";
  readonly diagnostics: readonly PortableResolverDiagnostic[];
};

async function readNavigationInternal(root: string, options: ResolveCodebaseNavigationOptions = {}): Promise<NavigationInternal> {
  const limits = limitsOf(options.limits);
  if (!limits) return {
    indexBody: "", indexHash: "", descriptor: null, marker: {kind: "none"}, active: null,
    portableState: "invalid", diagnostics: [diagnostic("resource-limit", "selection")]
  };
  const diagnostics: PortableResolverDiagnostic[] = [];
  const index = await readLiteralBytes(root, INDEX_PATH, limits.indexBytes);
  if (!index.ok) {
    if (index.reason === "missing") return {indexBody: "", indexHash: "", descriptor: null, marker: {kind: "none"}, active: null, portableState: "absent", diagnostics: [diagnostic("missing", "index")]};
    return {indexBody: "", indexHash: "", descriptor: null, marker: {kind: "none"}, active: null, portableState: index.reason === "unsafe-path" ? "unsupported" : "invalid", diagnostics: [fixedReadDiagnostic("index", index)]};
  }
  const indexBody = decodeUtf8(index.bytes);
  if (indexBody === null) return {indexBody: "", indexHash: sha256(index.bytes), descriptor: null, marker: {kind: "none"}, active: null, portableState: "invalid", diagnostics: [diagnostic("invalid", "index")]};
  const descriptor = parsePortableRootDescriptor(indexBody);
  if (!descriptor) return {indexBody, indexHash: sha256(index.bytes), descriptor: null, marker: {kind: "none"}, active: null, portableState: "invalid", diagnostics: [diagnostic("invalid", "index")]};
  if (!safeGenerationId(descriptor.generationId) || !pathInGeneration(descriptor.manifest.path, descriptor.generationId) || !pathInGeneration(descriptor.entry.path, descriptor.generationId)) {
    return {indexBody, indexHash: sha256(index.bytes), descriptor, marker: {kind: "none"}, active: null, portableState: "invalid", diagnostics: [diagnostic("unsafe-path", "index")]};
  }
  const marker = await readMarker(root, limits, diagnostics);
  const verified = await verifyGeneration(root, descriptor.generationId, options.limits, false);
  if (!verified.ok) {
    return {indexBody, indexHash: sha256(index.bytes), descriptor, marker, active: null, portableState: marker.kind === "unknown" ? "unsupported" : "invalid", diagnostics: [...diagnostics, ...verified.diagnostics]};
  }
  if (verified.value.manifestHash !== descriptor.manifest.sha256 || verified.value.entry.hash !== descriptor.entry.sha256) {
    addDiagnostic(diagnostics, diagnostic("checksum-mismatch", "index"));
    return {indexBody, indexHash: sha256(index.bytes), descriptor, marker, active: null, portableState: "invalid", diagnostics};
  }
  if (marker.kind === "valid") {
    const current = marker.marker;
    const generationIsPrevious = current.previousGenerationId === descriptor.generationId;
    const generationIsNext = current.generationId === descriptor.generationId;
    if (!generationIsPrevious && !generationIsNext) {
      addDiagnostic(diagnostics, diagnostic("duplicate-authority", "marker"));
      return {indexBody, indexHash: sha256(index.bytes), descriptor, marker, active: null, portableState: "unsupported", diagnostics};
    }
    // INDEX is the commit point: after it names B, B remains authoritative
    // even if cleanup or stage-marker updates were interrupted.
  } else if (marker.kind === "unknown") {
    // The bytes may happen to describe a valid generation, but an unknown
    // marker cannot safely authorize publication recovery or compatibility use.
    return {indexBody, indexHash: sha256(index.bytes), descriptor, marker, active: verified.value, portableState: "unsupported", diagnostics};
  }
  const compatibility = await verifyCompatibility(root, verified.value, limits, diagnostics);
  void compatibility;
  return {indexBody, indexHash: sha256(index.bytes), descriptor, marker, active: verified.value, portableState: "valid", diagnostics};
}

type CompatibilityState = "matching" | "absent" | "mismatch" | "guarded" | "unknown";

async function verifyCompatibility(root: string, generation: VerifiedGeneration, limits: EffectiveLimits, diagnostics: PortableResolverDiagnostic[]): Promise<CompatibilityState> {
  let present = 0;
  let matching = 0;
  for (const id of CODEBASE_DOCUMENT_IDS) {
    const relativePath = `${CODEBASE_ROOT}/${id.toUpperCase()}.md`;
    const result = await readLiteralBytes(root, relativePath, limits.compatibilityBytes);
    if (!result.ok) {
      if (result.reason === "missing") continue;
      addDiagnostic(diagnostics, fixedReadDiagnostic("compatibility", result));
      continue;
    }
    present += 1;
    if (sha256(result.bytes) === generation.manifest.checksums.compatibility[id]) matching += 1;
    else addDiagnostic(diagnostics, diagnostic("checksum-mismatch", "compatibility"));
  }
  if (present === 0) return "absent";
  return matching === CODEBASE_DOCUMENT_IDS.length ? "matching" : "mismatch";
}

async function verifyRetainedLineage(root: string, active: VerifiedGeneration, requestedGenerationId: string, options: ResolveCodebaseNavigationOptions): Promise<VerifyResult> {
  if (requestedGenerationId === active.generationId) return {ok: true, value: active};
  const limits = limitsOf(options.limits);
  if (!limits) return {ok: false, diagnostics: [diagnostic("resource-limit", "predecessor")]};
  const diagnostics: PortableResolverDiagnostic[] = [];
  const seen = new Set<string>([active.generationId]);
  let current = active;
  for (let depth = 0; depth < limits.predecessorDepth; depth += 1) {
    const predecessorId = current.manifest.predecessorGenerationId;
    const proof = current.manifest.predecessorPublicationProof;
    if (!predecessorId || !proof || proof.generationId !== predecessorId) {
      addDiagnostic(diagnostics, diagnostic("not-found", "predecessor"));
      return {ok: false, diagnostics};
    }
    if (seen.has(predecessorId)) {
      addDiagnostic(diagnostics, diagnostic("cycle", "predecessor"));
      return {ok: false, diagnostics};
    }
    seen.add(predecessorId);
    const next = await verifyGeneration(root, predecessorId, options.limits, true);
    if (!next.ok) return next;
    if (next.value.manifestHash !== proof.manifest.checksum || next.value.entry.hash !== proof.entry.checksum) {
      addDiagnostic(diagnostics, diagnostic("checksum-mismatch", "predecessor"));
      return {ok: false, diagnostics};
    }
    if (predecessorId === requestedGenerationId) return next;
    current = next.value;
  }
  return {ok: false, diagnostics: [diagnostic("resource-limit", "predecessor")]};
}

export type ResolveCodebaseNavigationOptions = {
  readonly requestedGenerationId?: string;
  readonly limits?: PortableResolverLimits;
};

export type PortableCoverage = {
  readonly structural: PortableGenerationManifest["structuralCoverage"];
  readonly semantic: PortableGenerationManifest["semanticCoverage"];
};

export type PortableImmutablePin = {
  readonly generationId: string;
  readonly entry: {readonly path: string; readonly sha256: string};
  readonly manifest: {readonly path: string; readonly sha256: string};
};

/**
 * An in-process owner capability for carrying an immutable pin to a later
 * bridge call.  The WeakSet below is the authority; the visible fields are
 * only fresh-verification inputs and are deliberately not serializable state.
 * A future persisted session must reacquire this capability by calling
 * verifyPortablePinHandoff after provider restart rather than trusting JSON.
 */
export type PortablePinHandoff = PortableImmutablePin & {
  readonly predecessorDepth: number;
};
export type PortableDurablePinHandoff = PortablePinHandoff & {
  /** Type-only owner authority brand; the runtime authority is a WeakSet. */
  readonly ownerAuthority: "durable";
};
const issuedPinHandoffs = new WeakSet<object>();
const issuedDurablePinHandoffs = new WeakSet<object>();

export function isPortablePinHandoff(value: unknown): value is PortablePinHandoff {
  return Boolean(value && typeof value === "object" && issuedPinHandoffs.has(value));
}

/** True only for a handoff restored from the owner-authenticated receipt store. */
export function isPortableDurablePinHandoff(value: unknown): value is PortableDurablePinHandoff {
  return Boolean(value && typeof value === "object" && issuedDurablePinHandoffs.has(value));
}

function issuePinHandoff(pin: PortableImmutablePin, predecessorDepth: number, durable = false): PortablePinHandoff {
  const immutable = Object.freeze({
    generationId: pin.generationId,
    entry: Object.freeze({path: pin.entry.path, sha256: pin.entry.sha256}),
    manifest: Object.freeze({path: pin.manifest.path, sha256: pin.manifest.sha256})
  });
  const handoff = Object.freeze({...immutable, predecessorDepth});
  issuedPinHandoffs.add(handoff);
  if (durable) issuedDurablePinHandoffs.add(handoff);
  return handoff;
}

export type PortablePinReceiptResult =
  | {readonly status: "ok"; readonly receipt: PortablePinReceipt; readonly handoff: PortableDurablePinHandoff}
  | {readonly status: "invalid"; readonly reason: string};

/**
 * Freshly prove a published pin, then persist an owner-authenticated receipt.
 * The low-level receipt writer never receives unverified caller data from the
 * public API: this function performs the publication proof first.
 */
export async function issuePortablePinReceipt(
  root: string,
  pin: PortableImmutablePin,
  options: ResolveCodebaseNavigationOptions = {}
): Promise<PortablePinReceiptResult> {
  const provedRoot = await capturePortablePinAuthorityRoot(root);
  if (!provedRoot) return {status: "invalid", reason: "The repository root is not a safe literal owner root."};
  const verified = await verifyPortablePinHandoff(root, pin, options);
  if (verified.status !== "ok" || !verified.handoff) return {status: "invalid", reason: "The requested pin is not a freshly proved published generation."};
  const receipt = await persistPortablePinReceipt(root, verified.handoff, provedRoot);
  if (!receipt) return {status: "invalid", reason: "The owning pin receipt store is unavailable."};
  return {status: "ok", receipt, handoff: issuePinHandoff(receipt.pin, 0, true) as PortableDurablePinHandoff};
}

export type PortableRestoredPin = {
  readonly status: "ok";
  readonly receipt: PortablePinReceipt;
  readonly handoff: PortableDurablePinHandoff;
} | {
  readonly status: "invalid";
  readonly reason: string;
};

/**
 * Restore a durable pin without consulting INDEX or any predecessor. The
 * receipt's MAC proves that this owner previously proved publication; the
 * target generation is still fully re-read and checksum verified here.
 */
export async function restorePortablePinReceipt(
  root: string,
  value: unknown,
  options: ResolveCodebaseNavigationOptions = {}
): Promise<PortableRestoredPin> {
  const receipt = await restoreStoredPortablePinReceipt(root, value);
  if (!receipt) return {status: "invalid", reason: "The pin receipt is not authenticated by this repository owner."};
  const verified = await verifyGeneration(root, receipt.pin.generationId, options.limits, false);
  if (!verified.ok || verified.value.entry.hash !== receipt.pin.entry.sha256 || verified.value.manifestHash !== receipt.pin.manifest.sha256) {
    return {status: "invalid", reason: "The authenticated pin target is missing or its sealed bytes changed."};
  }
  return {status: "ok", receipt, handoff: issuePinHandoff(receipt.pin, 0, true) as PortableDurablePinHandoff};
}

export type PortableFallback = {
  readonly used: boolean;
  readonly reason: "none" | "absent" | "invalid" | "unsupported" | "stale" | "not-found";
  readonly guidance: string;
};

export type CodebaseNavigationSuccess = {
  readonly status: "ok";
  readonly portable: {readonly status: "valid"; readonly generationId: string};
  readonly entry: {readonly path: string; readonly body: string; readonly sha256: string};
  readonly immutable: PortableImmutablePin;
  readonly pin: PortableImmutablePin;
  readonly coverage: PortableCoverage;
  readonly compatibility: {readonly status: CompatibilityState; readonly guard: "open" | "blocked" | "unknown"};
  readonly fallback: PortableFallback;
  readonly fallbackUsed: false;
  readonly fallbackReason: "none";
  readonly fallbackGuidance: string;
  readonly diagnostics: readonly PortableResolverDiagnostic[];
  /** Owner-only capability returned by explicit handoff verification. */
  readonly handoff?: PortablePinHandoff;
};

export type CodebaseNavigationFallback = {
  readonly status: "fallback";
  readonly portable: {readonly status: "absent" | "invalid" | "unsupported"; readonly generationId: string | null};
  readonly entry: null;
  readonly immutable: null;
  readonly pin: null;
  readonly coverage: null;
  readonly compatibility: {readonly status: CompatibilityState; readonly guard: "open" | "blocked" | "unknown"};
  readonly fallback: PortableFallback;
  readonly fallbackUsed: true;
  readonly fallbackReason: PortableFallback["reason"];
  readonly fallbackGuidance: string;
  readonly diagnostics: readonly PortableResolverDiagnostic[];
};

export type CodebaseNavigationResult = CodebaseNavigationSuccess | CodebaseNavigationFallback;

function fallbackReasonFor(state: NavigationInternal["portableState"]): PortableFallback["reason"] {
  return state === "absent" ? "absent" : state === "unsupported" ? "unsupported" : "invalid";
}

function fallbackGuidance(): string {
  return "Use ordinary bounded live-source discovery; the portable bundle is not an evidence authority.";
}

function markerGuard(marker: MarkerState, active: boolean): "open" | "blocked" | "unknown" {
  if (marker.kind === "unknown") return "unknown";
  if (marker.kind === "valid" || !active) return marker.kind === "valid" ? "blocked" : "open";
  return "open";
}

/** Resolve the compact immutable navigation context without returning a manifest or corpus. */
export async function resolveCodebaseNavigation(root: string, options: ResolveCodebaseNavigationOptions = {}): Promise<CodebaseNavigationResult> {
  const internal = await readNavigationInternal(root, options);
  const requested = options.requestedGenerationId;
  let active = internal.active;
  let diagnostics = [...internal.diagnostics];
  if (active && requested && requested !== active.generationId) {
    const retained = await verifyRetainedLineage(root, active, requested, options);
    if (!retained.ok) {
      diagnostics.push(...retained.diagnostics);
      return {
        status: "fallback", portable: {status: "unsupported", generationId: requested}, entry: null, immutable: null, pin: null, coverage: null,
        compatibility: {status: "unknown", guard: markerGuard(internal.marker, false)},
        fallback: {used: true, reason: retained.diagnostics.some(item => item.code === "not-found") ? "not-found" : "unsupported", guidance: fallbackGuidance()},
        fallbackUsed: true, fallbackReason: retained.diagnostics.some(item => item.code === "not-found") ? "not-found" : "unsupported", fallbackGuidance: fallbackGuidance(), diagnostics
      };
    }
    active = retained.value;
  }
  if (!active || internal.portableState !== "valid") {
    const state = internal.portableState === "valid" ? "invalid" : internal.portableState;
    const reason = fallbackReasonFor(state);
    return {
      status: "fallback", portable: {status: state, generationId: internal.descriptor?.generationId ?? null}, entry: null, immutable: null, pin: null, coverage: null,
      compatibility: {status: "unknown", guard: markerGuard(internal.marker, false)},
      fallback: {used: true, reason, guidance: fallbackGuidance()}, fallbackUsed: true, fallbackReason: reason, fallbackGuidance: fallbackGuidance(), diagnostics
    };
  }
  const limits = limitsOf(options.limits);
  if (!limits) {
    return {
      status: "fallback", portable: {status: "unsupported", generationId: active.generationId}, entry: null, immutable: null, pin: null, coverage: null,
      compatibility: {status: "unknown", guard: "unknown"},
      fallback: {used: true, reason: "unsupported", guidance: fallbackGuidance()}, fallbackUsed: true,
      fallbackReason: "unsupported", fallbackGuidance: fallbackGuidance(), diagnostics: [...diagnostics, diagnostic("resource-limit", "selection")]
    };
  }
  const compatibilityDiagnostics: PortableResolverDiagnostic[] = [];
  const compatibilityStatus = await verifyCompatibility(root, active, limits, compatibilityDiagnostics);
  diagnostics = [...diagnostics, ...compatibilityDiagnostics];
  // `active` may be an explicitly pinned predecessor while INDEX names a
  // newer generation. Build every immutable locator from the selected
  // generation, never from the root descriptor.
  const activeEntryPath = `generations/${active.generationId}/ENTRY.md`;
  const activeManifestPath = `generations/${active.generationId}/manifest.json`;
  const pin: PortableImmutablePin = {
    generationId: active.generationId,
    entry: {path: activeEntryPath, sha256: active.entry.hash},
    manifest: {path: activeManifestPath, sha256: active.manifestHash}
  };
  return {
    status: "ok", portable: {status: "valid", generationId: active.generationId},
    entry: {path: activeEntryPath, body: active.entry.body, sha256: active.entry.hash}, immutable: pin, pin,
    coverage: {structural: active.manifest.structuralCoverage, semantic: active.manifest.semanticCoverage},
    compatibility: {status: compatibilityStatus, guard: markerGuard(internal.marker, true)},
    fallback: {used: false, reason: "none", guidance: "Read selected map pages and verify current source before relying on a generated claim."},
    fallbackUsed: false, fallbackReason: "none", fallbackGuidance: "Read selected map pages and verify current source before relying on a generated claim.", diagnostics
  };
}

/**
 * Prove a previously published immutable pin before handing it to a future
 * lifecycle owner.  The supplied pin is only a lookup target: the active
 * INDEX, sealed generation, and predecessor proofs are read again here.  A
 * caller cannot make an unpublished or tampered generation trusted by copying
 * this metadata.
 *
 * Pin handoff has a larger bounded predecessor budget than ordinary
 * navigation so an immutable session can remain usable across many unrelated
 * publications.  The budget is still finite and may be lowered or raised by
 * the owning caller through `limits.predecessorDepth`.
 */
export async function verifyPortablePinHandoff(
  root: string,
  pin: PortableImmutablePin,
  options: ResolveCodebaseNavigationOptions = {}
): Promise<CodebaseNavigationResult> {
  if (!pin || typeof pin.generationId !== "string" ||
      pin.entry?.path !== `generations/${pin.generationId}/ENTRY.md` ||
      pin.manifest?.path !== `generations/${pin.generationId}/manifest.json` ||
      !SHA256.test(pin.entry?.sha256 ?? "") || !SHA256.test(pin.manifest?.sha256 ?? "")) {
    return {
      status: "fallback",
      portable: {status: "unsupported", generationId: null},
      entry: null,
      immutable: null,
      pin: null,
      coverage: null,
      compatibility: {status: "unknown", guard: "unknown"},
      fallback: {used: true, reason: "unsupported", guidance: fallbackGuidance()},
      fallbackUsed: true,
      fallbackReason: "unsupported",
      fallbackGuidance: fallbackGuidance(),
      diagnostics: [diagnostic("unsupported", "selection")]
    };
  }
  const normalized = limitsOf(options.limits);
  if (!normalized) {
    return {
      status: "fallback",
      portable: {status: "unsupported", generationId: pin.generationId},
      entry: null,
      immutable: null,
      pin: null,
      coverage: null,
      compatibility: {status: "unknown", guard: "unknown"},
      fallback: {used: true, reason: "unsupported", guidance: fallbackGuidance()},
      fallbackUsed: true,
      fallbackReason: "unsupported",
      fallbackGuidance: fallbackGuidance(),
      diagnostics: [diagnostic("resource-limit", "selection")]
    };
  }
  const predecessorDepth = options.limits?.predecessorDepth ?? PORTABLE_PIN_HANDOFF_PREDECESSOR_DEPTH;
  const resolved = await resolveCodebaseNavigation(root, {
    ...options,
    requestedGenerationId: pin.generationId,
    limits: {...(options.limits ?? {}), predecessorDepth}
  });
  if (resolved.status !== "ok") return resolved;
  if (resolved.immutable.generationId !== pin.generationId ||
      resolved.immutable.entry.path !== pin.entry.path ||
      resolved.immutable.entry.sha256 !== pin.entry.sha256 ||
      resolved.immutable.manifest.path !== pin.manifest.path ||
      resolved.immutable.manifest.sha256 !== pin.manifest.sha256) {
    return {
      status: "fallback",
      portable: {status: "unsupported", generationId: pin.generationId},
      entry: null,
      immutable: null,
      pin: null,
      coverage: null,
      compatibility: {status: "unknown", guard: "unknown"},
      fallback: {used: true, reason: "stale", guidance: fallbackGuidance()},
      fallbackUsed: true,
      fallbackReason: "stale",
      fallbackGuidance: fallbackGuidance(),
      diagnostics: [diagnostic("stale", "selection")]
    };
  }
  return {...resolved, handoff: issuePinHandoff(resolved.pin, predecessorDepth)};
}

/** Naming alias for lifecycle owners that describe this operation as a handoff. */
export const handoffPortableGenerationPin = verifyPortablePinHandoff;

/**
 * Prove that a literal path is a sealed member of the selected generation.
 * Directory identity alone is insufficient: an extra child can otherwise be
 * mistaken for generated evidence after a valid generation is committed.
 */
export async function resolveCodebaseSealedMember(root: string, relativePath: string): Promise<boolean> {
  const prefix = `${CODEBASE_ROOT}/generations/`;
  if (!relativePath.startsWith(prefix)) return false;
  const suffix = relativePath.slice(prefix.length);
  const separator = suffix.indexOf("/");
  if (separator <= 0) return false;
  const generationId = suffix.slice(0, separator);
  const member = suffix.slice(separator + 1);
  if (!safeGenerationId(generationId) || !member || !safeRelativePath(relativePath)) return false;
  const internal = await readNavigationInternal(root);
  if (!internal.active || internal.portableState !== "valid") return false;
  let generation = internal.active;
  if (generationId !== generation.generationId) {
    const retained = await verifyRetainedLineage(root, generation, generationId, {});
    if (!retained.ok) return false;
    generation = retained.value;
  }
  const generationRelative = `generations/${generationId}/${member}`;
  let expected: string | null = null;
  if (member === "ENTRY.md") expected = generation.entry.hash;
  else if (member === "manifest.json") expected = generation.manifestHash;
  else expected = expectedChecksum(generation.manifest, generationRelative);
  if (!expected) return false;
  const bytes = await readLiteralBytes(root, `${CODEBASE_ROOT}/${generationRelative}`, DEFAULT_LIMITS.pageBytes * 256);
  return bytes.ok && sha256(bytes.bytes) === expected;
}

/** Navigation/search pages are discovery-only and must say so explicitly. */
export type PortableSelection =
  | {readonly kind: "page"; readonly path: string; readonly mode: "discovery"}
  | {readonly kind: "file" | "symbol" | "import" | "relationship" | "detail"; readonly recordId: string}
  | {readonly kind: "capability" | "claim" | "alias"; readonly recordId: string}
  | {readonly kind: "structural"; readonly recordKind: "file" | "symbol" | "import" | "relationship" | "detail"; readonly recordId: string}
  | {readonly kind: "semantic"; readonly recordKind: "capability" | "claim" | "alias"; readonly recordId: string};

type PortableDirectSelectionKind = "page" | "file" | "symbol" | "import" | "relationship" | "detail" | "capability" | "claim" | "alias";

export type PortableSourceBinding = {
  readonly path: string;
  readonly fullFileHash: string;
  readonly rangeHash?: string;
  readonly coordinate?: unknown;
};

export type PortableSelectedEvidence = {
  readonly path: string;
  readonly generation: string;
  readonly hash: string;
  readonly kind: "page" | "source";
  readonly dependencies: readonly string[];
  readonly bytes?: string;
};

/**
 * Request-local proof material for a selected generation.  This is returned
 * by the resolver that created it and is deliberately not accepted as an
 * input to any resolver call.  Consumers must prove the generation again when
 * starting a new request; a copied snapshot can never bless changed bytes.
 */
export type PortableSelectionSnapshot = {
  readonly generationId: string;
  readonly entry: {readonly path: string; readonly sha256: string};
  readonly manifest: {readonly path: string; readonly sha256: string};
  readonly pages: readonly {readonly path: string; readonly sha256: string}[];
};

export type PortableSelectionResult = {
  readonly status: "ok";
  /** Consumers may register implementation results; discovery results are only navigation hints. */
  readonly mode: "implementation" | "discovery";
  readonly generationId: string;
  readonly roots: readonly string[];
  readonly entries: readonly PortableSelectedEvidence[];
  readonly selected: readonly {readonly kind: PortableDirectSelectionKind; readonly recordId?: string; readonly page: string}[];
  readonly sourceBindings: readonly PortableSourceBinding[];
  readonly snapshot: PortableSelectionSnapshot;
  readonly diagnostics: readonly PortableResolverDiagnostic[];
};

export type PortableSelectionFailure = {
  readonly status: "fallback" | "invalid" | "not-found";
  readonly reason: string;
  readonly diagnostics: readonly PortableResolverDiagnostic[];
  readonly fallback: PortableFallback;
};

export type PortableSelectionResolution = PortableSelectionResult | PortableSelectionFailure;

function sourceBindingForRecord(item: StructuralRecord, files: ReadonlyMap<string, PortableFileRecord>): PortableSourceBinding | null {
  if ("path" in item && "contentHash" in item && "byteSize" in item) return {path: item.path, fullFileHash: item.contentHash};
  const fileId = "sourceFileId" in item ? item.sourceFileId : "fileId" in item ? item.fileId : null;
  if (!fileId) return null;
  const file = files.get(fileId);
  if (!file) return null;
  return {path: file.path, fullFileHash: file.contentHash, rangeHash: item.contentHash, ...( "coordinate" in item ? {coordinate: item.coordinate} : {})};
}

/** Resolve exact selected page/record dependencies for later evidence delivery. */
export async function resolveSelectedCodebaseEvidence(root: string, selection: PortableSelection, options: ResolveCodebaseNavigationOptions = {}, authenticatedGeneration?: VerifiedGeneration): Promise<PortableSelectionResolution> {
  let generation: VerifiedGeneration;
  if (authenticatedGeneration) {
    generation = authenticatedGeneration;
    if (options.requestedGenerationId && options.requestedGenerationId !== generation.generationId) {
      return {status: "invalid", reason: "The requested generation does not match the authenticated pin.", diagnostics: [diagnostic("stale", "selection")], fallback: {used: true, reason: "invalid", guidance: fallbackGuidance()}};
    }
  } else {
    const internal = await readNavigationInternal(root, options);
    if (!internal.active || internal.portableState !== "valid") {
      const reason = fallbackReasonFor(internal.portableState);
      return {status: "fallback", reason, diagnostics: internal.diagnostics, fallback: {used: true, reason, guidance: fallbackGuidance()}};
    }
    generation = internal.active;
    if (options.requestedGenerationId && options.requestedGenerationId !== generation.generationId) {
      const retained = await verifyRetainedLineage(root, generation, options.requestedGenerationId, options);
      if (!retained.ok) return {status: "not-found", reason: "The requested retained generation could not be proved.", diagnostics: retained.diagnostics, fallback: {used: true, reason: "not-found", guidance: fallbackGuidance()}};
      generation = retained.value;
    }
  }
  const limits = limitsOf(options.limits);
  if (!limits) return {status: "invalid", reason: "Resolver limits are invalid.", diagnostics: [diagnostic("resource-limit", "selection")], fallback: {used: true, reason: "invalid", guidance: fallbackGuidance()}};
  const entries = new Map<string, PortableSelectedEvidence>();
  const selected: Array<{kind: PortableDirectSelectionKind; recordId?: string; page: string}> = [];
  const bindings = new Map<string, PortableSourceBinding>();
  const diagnostics: PortableResolverDiagnostic[] = [];
  const selectedKind: PortableDirectSelectionKind = selection.kind === "structural" || selection.kind === "semantic" ? selection.recordKind : selection.kind;
  const selectedRecordId = selection.kind === "page" ? undefined : selection.recordId;
  const addPage = (page: Page, deps: readonly string[] = []): void => {
    if (!entries.has(page.path)) entries.set(page.path, {path: page.path, generation: generation.generationId, hash: page.hash, kind: "page", dependencies: [...new Set(deps)].sort(), bytes: page.body});
  };
  const addBinding = (item: StructuralRecord): void => {
    const binding = sourceBindingForRecord(item, generation.files);
    if (binding) bindings.set(`${binding.path}\u0000${binding.rangeHash ?? ""}\u0000${binding.coordinate ? JSON.stringify(binding.coordinate) : ""}`, binding);
  };
  if (selection.kind === "page") {
    if (selection.mode !== "discovery") {
      return {status: "invalid", reason: "Only explicit navigation/search discovery pages may be selected as pages.", diagnostics: [diagnostic("invalid", "selection")], fallback: {used: true, reason: "invalid", guidance: fallbackGuidance()}};
    }
    if (!pathInGeneration(selection.path, generation.generationId)) return {status: "invalid", reason: "The selected page path is not canonical.", diagnostics: [diagnostic("unsafe-path", "selection")], fallback: {used: true, reason: "invalid", guidance: fallbackGuidance()}};
    if (!selection.path.includes(`/routes/`) && !selection.path.includes(`/search/`)) {
      return {status: "invalid", reason: "Only navigation/search pages may be selected for discovery.", diagnostics: [diagnostic("invalid", "selection")], fallback: {used: true, reason: "invalid", guidance: fallbackGuidance()}};
    }
    const page = generation.pages.get(selection.path);
    if (!page) return {status: "not-found", reason: "The selected page was not found.", diagnostics: [diagnostic("not-found", "selection")], fallback: {used: true, reason: "not-found", guidance: fallbackGuidance()}};
    addPage(page);
    selected.push({kind: "page", page: page.path});
  } else if (["file", "symbol", "import", "relationship", "detail"].includes(selectedKind)) {
    const kind = selectedKind === "file" ? "files" : selectedKind === "symbol" ? "symbols" : selectedKind === "import" ? "imports" : selectedKind === "relationship" ? "relationships" : "details";
    const item = generation.structural.get(selectedRecordId!);
    if (!item) return {status: "not-found", reason: "The selected structural record was not found.", diagnostics: [diagnostic("not-found", "selection")], fallback: {used: true, reason: "not-found", guidance: fallbackGuidance()}};
    if (item.kind !== kind) {
      return {status: "invalid", reason: "The selected structural record kind does not match the requested kind.", diagnostics: [diagnostic("invalid", "selection")], fallback: {used: true, reason: "invalid", guidance: fallbackGuidance()}};
    }
    addPage(item.page);
    addBinding(item.record);
    if (selectedKind === "detail") {
      const source = generation.structural.get((item.record as PortableStructuralDetailRecord).sourceRecordId);
      if (source) addBinding(source.record);
    }
    selected.push({kind: selectedKind, recordId: selectedRecordId, page: item.page.path});
  } else {
    const key = `${selectedKind}\u0000${selectedRecordId!}` as SemanticKey;
    const semantic = generation.semantic.get(key);
    if (!semantic) return {status: "not-found", reason: "The selected semantic record was not found.", diagnostics: [diagnostic("not-found", "selection")], fallback: {used: true, reason: "not-found", guidance: fallbackGuidance()}};
    const dependencyPaths = new Set<string>();
    const semanticPagePaths = new Set<string>();
    const addSemanticBindings = (record: SemanticRecord): void => {
      for (const item of record.evidence) {
        if (item.kind === "compatibility-document") continue;
        const target = evidenceRecord(item, generation.structural as Map<string, {kind: StructuralKind; record: StructuralRecord; page: Page}>, generation.files as Map<string, PortableFileRecord>, generation.symbols as Map<string, PortableSymbolRecord>, generation.imports as Map<string, PortableImportRelationship>, generation.relationships as Map<string, PortableRelationshipRecord>);
        if (target.record && target.file) {
          const recordCoordinate = target.record && "coordinate" in target.record ? target.record.coordinate : undefined;
          const binding: PortableSourceBinding = {
            path: target.file.path,
            fullFileHash: target.file.contentHash,
            ...(target.rangeHash ? {rangeHash: target.rangeHash} : {}),
            ...((item.coordinate ?? recordCoordinate) ? {coordinate: item.coordinate ?? recordCoordinate} : {})
          };
          bindings.set(`${binding.path}\u0000${binding.rangeHash ?? ""}\u0000${binding.coordinate ? JSON.stringify(binding.coordinate) : ""}`, binding);
          dependencyPaths.add(binding.path);
        }
      }
    };
    const visited = new Set<SemanticKey>();
    const addSemanticClosure = (kind: SemanticKind, recordId: string): void => {
      const key = `${kind}\u0000${recordId}` as SemanticKey;
      if (visited.has(key)) return;
      const current = generation.semantic.get(key);
      if (!current) return;
      // Visit explicit semantic edges before the current record so the
      // selected list is deterministic and contains the complete transitive
      // claim closure. Grouped neighbors remain excluded.
      if (kind === "capability") {
        for (const claimId of (current.record as PortableCapability).claimIds) addSemanticClosure("claim", claimId);
      }
      visited.add(key);
      for (const page of current.pages) {
        addPage(page);
        semanticPagePaths.add(page.path);
      }
      addSemanticBindings(current.record);
      selected.push({kind, recordId, page: current.pages[0]?.path ?? ""});
    };
    addSemanticClosure(selectedKind as SemanticKind, selectedRecordId!);
    if (selectedKind === "alias") {
      const alias = semantic.record as PortableAlias;
      if (alias.targetKind === "capability") addSemanticClosure("capability", alias.targetId);
      const symbol = generation.symbols.get(alias.targetId);
      if (symbol) {
        const structural = generation.structural.get(symbol.id);
        if (structural) { addPage(structural.page); addBinding(symbol); selected.push({kind: "symbol", recordId: symbol.id, page: structural.page.path}); }
      }
      // The alias itself is selected after its target closure, matching the
      // dependency-first contract used by direct capability selection.
      const aliasIndex = selected.findIndex(item => item.kind === "alias" && item.recordId === alias.id);
      if (aliasIndex >= 0) {
        const [aliasSelection] = selected.splice(aliasIndex, 1);
        selected.push(aliasSelection!);
      }
    }
    for (const pagePath of semanticPagePaths) {
      const page = entries.get(pagePath);
      if (page) entries.set(pagePath, {...page, dependencies: [...dependencyPaths].sort()});
    }
  }
  if (entries.size > limits.generationFiles) {
    return {status: "invalid", reason: "Selected evidence exceeds the resolver limit.", diagnostics: [diagnostic("resource-limit", "selection")], fallback: {used: true, reason: "unsupported", guidance: fallbackGuidance()}};
  }
  return {
    status: "ok",
    mode: selection.kind === "page" ? "discovery" : "implementation",
    generationId: generation.generationId,
    roots: [...entries.keys()],
    entries: [...entries.values()],
    selected,
    sourceBindings: [...bindings.values()],
    snapshot: {
      generationId: generation.generationId,
      entry: {path: generation.entry.path, sha256: generation.entry.hash},
      manifest: {path: `generations/${generation.generationId}/manifest.json`, sha256: generation.manifestHash},
      pages: [...entries.values()].map(item => ({path: item.path, sha256: item.hash}))
    },
    diagnostics
  };
}

/** Select evidence from an owner-authenticated target without reading INDEX or predecessors. */
export async function resolveSelectedCodebaseEvidenceWithPortablePin(
  root: string,
  selection: PortableSelection,
  handoff: PortablePinHandoff,
  options: ResolveCodebaseNavigationOptions = {}
): Promise<PortableSelectionResolution> {
  if (!isPortableDurablePinHandoff(handoff)) {
    return {status: "invalid", reason: "The supplied pin is not an owner-authenticated durable handoff.", diagnostics: [diagnostic("unsupported", "selection")], fallback: {used: true, reason: "invalid", guidance: fallbackGuidance()}};
  }
  const verified = await verifyGeneration(root, handoff.generationId, options.limits, false);
  if (!verified.ok || verified.value.entry.hash !== handoff.entry.sha256 || verified.value.manifestHash !== handoff.manifest.sha256) {
    return {status: "invalid", reason: "The authenticated pin target is missing or its sealed bytes changed.", diagnostics: verified.ok ? [diagnostic("checksum-mismatch", "selection")] : verified.diagnostics, fallback: {used: true, reason: "invalid", guidance: fallbackGuidance()}};
  }
  return resolveSelectedCodebaseEvidence(root, selection, {...options, requestedGenerationId: handoff.generationId}, verified.value);
}

export const resolvePortableCodebaseEvidence = resolveSelectedCodebaseEvidence;
export const resolveCodebaseSelection = resolveSelectedCodebaseEvidence;
export const resolvePortableSelection = resolveSelectedCodebaseEvidence;
