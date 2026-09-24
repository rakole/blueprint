import {createHash} from "node:crypto";
import * as z from "zod/v4";

import {
  generationLocalIdSchema,
  portableAcceptedSemanticModelSchema,
  portableSha256Schema,
  portableStructuralInventorySchema,
  type PortableAcceptedSemanticModel,
  type PortableFileRecord,
  type PortableStructuralInventory
} from "./contracts.js";
import {
  portableAuthoritativeSourceBasisSchema,
  type PortableAuthoritativeSourceBasis
} from "./model-validation.js";
import {
  capturePortableExtractionSnapshot,
  createPortableExtractionReuse,
  extractPortableRepositoryFromSnapshot,
  makePortableInitialFile,
  type ExtractionCoverageSummary,
  type ExtractionParserProvenance,
  type PortableExtractionFailure,
  type PortableExtractionOptions,
  type PortableExtractionSnapshot,
  type PortableExtractionSuccess,
  type ExtractionRootIdentity
} from "./extraction.js";
import {INVENTORY_MAX_FILE_BYTES} from "./inventory.js";

const CACHE_VERSION = 1 as const;
/**
 * Incremental reuse is internal until an owning runtime can authenticate a
 * persisted cache. A checksum catches accidental corruption but cannot prove
 * who created a caller-supplied object, so this non-serializable capability is
 * required for the current in-process contract.
 */
const CACHE_AUTHORITY = Symbol("blueprint.portable.incremental.cache-authority");
const cacheTrust = z.literal("operational");
const rootSchema = z.strictObject({
  path: z.string().min(1),
  realPath: z.string().min(1),
  device: z.number().int().nonnegative(),
  inode: z.number().int().nonnegative()
});
export const portableIncrementalProvenanceSchema = z.strictObject({
  runtime: z.strictObject({
    package: z.string().min(1),
    version: z.string().min(1),
    packageSha256: portableSha256Schema,
    module: z.string().min(1),
    moduleSha256: portableSha256Schema,
    wasm: z.string().min(1),
    wasmSha256: portableSha256Schema,
    languageVersion: z.number().int().nonnegative(),
    minimumCompatibleVersion: z.number().int().nonnegative()
  }),
  grammars: z.array(z.strictObject({
    package: z.string().min(1),
    version: z.string().min(1),
    packageSha256: portableSha256Schema,
    asset: z.string().min(1),
    sha256: portableSha256Schema,
    abiVersion: z.number().int().nonnegative()
  })),
  adapters: z.array(z.strictObject({
    name: z.enum(["javascript", "python", "java"]),
    ruleVersion: z.string().min(1)
  }))
});
const coverageSchema = z.strictObject({
  candidateCount: z.number().int().nonnegative(),
  includedCount: z.number().int().nonnegative(),
  excludedCount: z.number().int().nonnegative(),
  exclusions: z.array(z.strictObject({reason: z.string().min(1), count: z.number().int().nonnegative()})),
  structural: z.strictObject({
    filesInventoried: z.number().int().nonnegative(),
    filesWithFullCoverage: z.number().int().nonnegative(),
    filesWithFileCoverage: z.number().int().nonnegative(),
    symbolsExtracted: z.number().int().nonnegative(),
    importsExtracted: z.number().int().nonnegative(),
    relationshipsExtracted: z.number().int().nonnegative()
  })
});

/**
 * Checksummed operational cache.  It intentionally stores accepted structure
 * and provenance metadata only; source bytes, model prompts, and rejected
 * payloads never enter this projection.
 */
export type PortableIncrementalCache = {
  readonly version: typeof CACHE_VERSION;
  readonly trust: "operational";
  readonly generationId: string;
  readonly root: ExtractionRootIdentity;
  readonly inventoryFingerprint: string;
  readonly provenance: ExtractionParserProvenance;
  readonly provenanceHash: string;
  readonly structuralShards: readonly PortableStructuralInventory[];
  readonly sourceBasis: PortableAuthoritativeSourceBasis;
  readonly coverage: ExtractionCoverageSummary;
  readonly semantic?: PortableAcceptedSemanticModel;
  readonly cacheHash: string;
};

const cacheWithoutHashSchema = z.strictObject({
  version: z.literal(CACHE_VERSION),
  trust: cacheTrust,
  generationId: generationLocalIdSchema,
  root: rootSchema,
  inventoryFingerprint: portableSha256Schema,
  provenance: portableIncrementalProvenanceSchema,
  provenanceHash: portableSha256Schema,
  structuralShards: z.array(portableStructuralInventorySchema).min(1),
  sourceBasis: portableAuthoritativeSourceBasisSchema,
  coverage: coverageSchema,
  semantic: portableAcceptedSemanticModelSchema.optional()
});
const cacheSchema = cacheWithoutHashSchema.extend({cacheHash: portableSha256Schema});
export const portableIncrementalCacheSchema = cacheSchema;

export type PortableIncrementalReason =
  | "cold"
  | "no-cache"
  | "invalid-cache"
  | "provenance-drift"
  | "root-drift"
  | "unchanged"
  | "source-changed"
  | "inventory-scope-changed"
  | "dependency-reparse";

export type PortableIncrementalCounters = {
  readonly cacheAccepted: boolean;
  readonly filesConsidered: number;
  readonly filesReused: number;
  readonly filesParsed: number;
  readonly filesAdded: number;
  readonly filesChanged: number;
  readonly filesDeleted: number;
  readonly importerFilesReparsed: number;
};

export type PortableSemanticInvalidation = {
  readonly model?: PortableAcceptedSemanticModel;
  readonly invalidatedCapabilityIds: readonly string[];
  readonly invalidatedClaimIds: readonly string[];
  readonly invalidatedAliasIds: readonly string[];
  readonly reasons: readonly ("evidence-changed" | "dependency-closure" | "inventory-scope")[];
};

export type PortableIncrementalSuccess = PortableExtractionSuccess & {
  readonly cache: PortableIncrementalCache;
  readonly incremental: {
    readonly reason: PortableIncrementalReason;
    readonly counters: PortableIncrementalCounters;
    readonly semantic: PortableSemanticInvalidation;
  };
};

export type PortableIncrementalResult = PortableIncrementalSuccess | PortableExtractionFailure;

/** @internal Test-only seam for exercising parser provenance drift. */
export const incrementalTestHooks: {
  provenanceOverride?: ExtractionParserProvenance;
} = {};

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function digest(value: unknown): string {
  return sha256(canonical(value));
}

function provenanceProjection(provenance: ExtractionParserProvenance): unknown {
  return {
    runtime: provenance.runtime,
    grammars: [...provenance.grammars].sort((left, right) => `${left.package}\u0000${left.asset}`.localeCompare(`${right.package}\u0000${right.asset}`)),
    adapters: [...provenance.adapters].sort((left, right) => left.name.localeCompare(right.name))
  };
}

function cachePayload(cache: Omit<PortableIncrementalCache, "cacheHash">): Omit<PortableIncrementalCache, "cacheHash"> {
  return cache;
}

export function portableProvenanceHash(provenance: ExtractionParserProvenance): string {
  return digest(provenanceProjection(provenance));
}

function validateCacheShape(input: unknown): PortableIncrementalCache | null {
  if (!input || typeof input !== "object" || (input as {[CACHE_AUTHORITY]?: true})[CACHE_AUTHORITY] !== true) return null;
  const parsed = cacheSchema.safeParse(input);
  if (!parsed.success) return null;
  const cache = parsed.data as unknown as PortableIncrementalCache;
  try {
    if (cache.provenanceHash !== portableProvenanceHash(cache.provenance)) return null;
    const {cacheHash, ...payload} = cache;
    if (cacheHash !== digest(cachePayload(payload))) return null;
    const fileRecords = cache.structuralShards.flatMap(shard => shard.files);
    const sourceFiles = cache.sourceBasis.files;
    if (cache.structuralShards.some(shard => shard.generationId !== cache.generationId) ||
        cache.sourceBasis.generationId !== cache.generationId ||
        new Set(fileRecords.map(file => file.path)).size !== fileRecords.length ||
        new Set(sourceFiles.map(file => file.path)).size !== sourceFiles.length ||
        fileRecords.length !== sourceFiles.length) return null;
    for (const file of fileRecords) {
      const basis = sourceFiles.find(item => item.path === file.path);
      if (!basis || basis.byteSize !== file.byteSize || basis.contentHash !== file.contentHash) return null;
    }
  } catch {
    return null;
  }
  return input as PortableIncrementalCache;
}

export function createPortableIncrementalCache(
  extraction: PortableExtractionSuccess,
  semantic?: PortableAcceptedSemanticModel
): PortableIncrementalCache {
  const payload: Omit<PortableIncrementalCache, "cacheHash"> = {
    version: CACHE_VERSION,
    trust: "operational",
    generationId: extraction.generationId,
    root: extraction.root,
    inventoryFingerprint: extraction.inventoryFingerprint,
    provenance: extraction.provenance,
    provenanceHash: portableProvenanceHash(extraction.provenance),
    structuralShards: extraction.structuralShards,
    sourceBasis: extraction.sourceBasis,
    coverage: extraction.coverage,
    ...(semantic ? {semantic} : {})
  };
  const parsed = cacheWithoutHashSchema.safeParse(payload);
  if (!parsed.success || !portableAuthoritativeSourceBasisSchema.safeParse(payload.sourceBasis).success) {
    throw new Error("invalid portable incremental cache");
  }
  const cache = {...payload, cacheHash: digest(cachePayload(payload))};
  Object.defineProperty(cache, CACHE_AUTHORITY, {value: true, enumerable: false, configurable: false, writable: false});
  return cache;
}

export function parsePortableIncrementalCache(input: unknown): PortableIncrementalCache | null {
  return validateCacheShape(input);
}

function sameRoot(left: ExtractionRootIdentity, right: ExtractionRootIdentity): boolean {
  return left.path === right.path && left.realPath === right.realPath && left.device === right.device && left.inode === right.inode;
}

function flatten(cache: PortableIncrementalCache): PortableExtractionSuccess {
  return {
    ok: true,
    generationId: cache.generationId,
    root: cache.root,
    inventoryFingerprint: cache.inventoryFingerprint,
    structuralShards: cache.structuralShards,
    sourceBasis: cache.sourceBasis,
    coverage: cache.coverage,
    provenance: cache.provenance
  };
}

type SourceFacts = {
  readonly files: ReadonlyMap<string, PortableFileRecord>;
  readonly records: ReadonlyMap<string, {readonly path: string; readonly contentHash: string}>;
};

function sourceFacts(extraction: PortableExtractionSuccess): SourceFacts {
  const files = new Map<string, PortableFileRecord>();
  const records = new Map<string, {path: string; contentHash: string}>();
  for (const shard of extraction.structuralShards) {
    for (const file of shard.files) {
      files.set(file.path, file);
      records.set(file.id, {path: file.path, contentHash: file.contentHash});
    }
    for (const record of [...shard.symbols, ...shard.imports, ...shard.relationships]) {
      records.set(record.id, {path: "path" in record ? record.path : record.sourcePath, contentHash: record.contentHash});
    }
  }
  return {files, records};
}

function changedEvidence(
  before: PortableExtractionSuccess,
  after: PortableExtractionSuccess,
  afterSnapshot: PortableExtractionSnapshot,
  added: ReadonlySet<string>,
  deleted: ReadonlySet<string>,
  changed: ReadonlySet<string>
): {readonly paths: ReadonlySet<string>; readonly recordIds: ReadonlySet<string>} {
  const oldFacts = sourceFacts(before);
  const newFacts = sourceFacts(after);
  const currentFiles = new Map(afterSnapshot.inventory.files.map(file => [file.path, makePortableInitialFile(file)]));
  const paths = new Set<string>([...added, ...deleted, ...changed]);
  const recordIds = new Set<string>();
  for (const [id, item] of oldFacts.records) {
    if (paths.has(item.path)) recordIds.add(id);
  }
  for (const [path, file] of currentFiles) {
    if (paths.has(path)) recordIds.add(file.id);
  }
  const changedTargets = new Set(recordIds);
  for (const shard of before.structuralShards) {
    for (const record of [...shard.imports, ...shard.relationships]) {
      if ((record.targetFileId && changedTargets.has(record.targetFileId)) ||
          (record.targetSymbolId && changedTargets.has(record.targetSymbolId))) {
        recordIds.add(record.id);
      }
    }
  }
  for (const [id, current] of newFacts.records) {
    const previous = oldFacts.records.get(id);
    if (!previous || previous.contentHash !== current.contentHash || paths.has(current.path)) {
      recordIds.add(id);
      paths.add(current.path);
    }
  }
  for (const [id, previous] of oldFacts.records) {
    if (!newFacts.records.has(id)) {
      recordIds.add(id);
      paths.add(previous.path);
    }
  }
  return {paths, recordIds};
}

/**
 * Remove semantic records whose declared evidence changed, then close over
 * capability -> claims and alias -> capability/symbol dependencies.  The
 * returned model contains only records still eligible to be called fresh.
 */
export function invalidatePortableSemanticModel(
  model: PortableAcceptedSemanticModel | undefined,
  options: {
    readonly changedPaths?: ReadonlySet<string>;
    readonly changedRecordIds?: ReadonlySet<string>;
    readonly inventoryScopeChanged?: boolean;
  } = {}
): PortableSemanticInvalidation {
  if (!model) return {model: undefined, invalidatedCapabilityIds: [], invalidatedClaimIds: [], invalidatedAliasIds: [], reasons: []};
  const changedPaths = options.changedPaths ?? new Set<string>();
  const changedRecordIds = options.changedRecordIds ?? new Set<string>();
  const allScope = Boolean(options.inventoryScopeChanged);
  const evidenceChanged = (evidence: readonly {path: string; recordId: string}[]): boolean =>
    allScope || evidence.some(item => changedPaths.has(item.path) || changedRecordIds.has(item.recordId));
  const invalidClaims = new Set<string>();
  const invalidCapabilities = new Set<string>();
  const invalidAliases = new Set<string>();
  for (const claim of model.claims) if (evidenceChanged(claim.evidence)) invalidClaims.add(claim.id);
  for (const capability of model.capabilities) {
    if (evidenceChanged(capability.evidence) || capability.claimIds.some(id => invalidClaims.has(id))) invalidCapabilities.add(capability.id);
  }
  for (const alias of model.aliases) {
    if (evidenceChanged(alias.evidence) || (alias.targetKind === "capability" && invalidCapabilities.has(alias.targetId)) ||
        (alias.targetKind === "symbol" && changedRecordIds.has(alias.targetId))) invalidAliases.add(alias.id);
  }
  const reasons = new Set<"evidence-changed" | "dependency-closure" | "inventory-scope">();
  if (allScope && (invalidClaims.size > 0 || invalidCapabilities.size > 0 || invalidAliases.size > 0)) reasons.add("inventory-scope");
  if (!allScope && (invalidClaims.size > 0 || invalidCapabilities.size > 0 || invalidAliases.size > 0)) reasons.add("evidence-changed");
  if ([...invalidCapabilities].some(id => model.capabilities.find(item => item.id === id)?.claimIds.some(claim => invalidClaims.has(claim))) ||
      [...invalidAliases].some(id => { const alias = model.aliases.find(item => item.id === id); return alias?.targetKind === "capability" && invalidCapabilities.has(alias.targetId); })) {
    reasons.add("dependency-closure");
  }
  return {
    model: {
      capabilities: model.capabilities.filter(item => !invalidCapabilities.has(item.id)),
      claims: model.claims.filter(item => !invalidClaims.has(item.id)),
      aliases: model.aliases.filter(item => !invalidAliases.has(item.id))
    },
    invalidatedCapabilityIds: [...invalidCapabilities].sort(),
    invalidatedClaimIds: [...invalidClaims].sort(),
    invalidatedAliasIds: [...invalidAliases].sort(),
    reasons: [...reasons]
  };
}

function makeFallbackReason(cache: unknown): PortableIncrementalReason {
  return cache === undefined ? "no-cache" : "invalid-cache";
}

function isParserEligible(file: PortableFileRecord): boolean {
  return file.language !== "unknown" && file.byteSize <= INVENTORY_MAX_FILE_BYTES;
}

/**
 * Incrementally refresh a previously accepted operational extraction. Public
 * lifecycle owners may adopt this later; this module deliberately performs no
 * operation-store, publication, or MCP writes.
 */
export async function extractPortableRepositoryIncremental(
  options: PortableExtractionOptions & {
    readonly previous?: unknown;
    readonly semantic?: PortableAcceptedSemanticModel;
  }
): Promise<PortableIncrementalResult> {
  const snapshot = await capturePortableExtractionSnapshot(options.repositoryRoot, options.useGit);
  if ("ok" in snapshot) return snapshot;
  const effectiveSnapshot: PortableExtractionSnapshot = incrementalTestHooks.provenanceOverride
    ? {...snapshot, provenance: incrementalTestHooks.provenanceOverride}
    : snapshot;
  const supplied = options.previous;
  const cache = parsePortableIncrementalCache(supplied);
  const currentRoot = effectiveSnapshot.root;
  const currentProvenanceHash = portableProvenanceHash(effectiveSnapshot.provenance);
  if (!cache || !sameRoot(cache.root, currentRoot) || cache.provenanceHash !== currentProvenanceHash) {
    const extraction = await extractPortableRepositoryFromSnapshot(options, effectiveSnapshot);
    if (!extraction.ok) return extraction;
    const semantic = invalidatePortableSemanticModel(options.semantic, {
      inventoryScopeChanged: Boolean(options.semantic)
    });
    const nextCache = createPortableIncrementalCache(extraction, semantic.model);
    return {
      ...extraction,
      cache: nextCache,
      incremental: {
        reason: !cache ? makeFallbackReason(supplied) : !sameRoot(cache.root, currentRoot) ? "root-drift" : "provenance-drift",
        counters: {
          cacheAccepted: false,
          filesConsidered: effectiveSnapshot.inventory.files.length,
          filesReused: 0,
          filesParsed: effectiveSnapshot.inventory.files.map(makePortableInitialFile).filter(isParserEligible).length,
          filesAdded: effectiveSnapshot.inventory.files.length,
          filesChanged: 0,
          filesDeleted: 0,
          importerFilesReparsed: 0
        },
        semantic
      }
    };
  }

  const before = flatten(cache);
  const beforeFacts = sourceFacts(before);
  const currentFiles = new Map(effectiveSnapshot.inventory.files.map(file => [file.path, makePortableInitialFile(file)]));
  const oldPaths = new Set(beforeFacts.files.keys());
  const newPaths = new Set(currentFiles.keys());
  const added = new Set([...newPaths].filter(path => !oldPaths.has(path)));
  const deleted = new Set([...oldPaths].filter(path => !newPaths.has(path)));
  const changed = new Set([...newPaths].filter(path => {
    const previous = beforeFacts.files.get(path);
    const current = currentFiles.get(path)!;
    return Boolean(previous && (previous.contentHash !== current.contentHash || previous.byteSize !== current.byteSize || previous.language !== current.language || previous.role !== current.role));
  }));
  const inventoryScopeChanged = added.size > 0 || deleted.size > 0;
  const importerPaths = new Set(before.structuralShards.flatMap(shard => shard.imports.map(item => item.sourcePath)));
  const reparsePaths = new Set<string>([...added, ...changed]);
  if (inventoryScopeChanged) for (const path of importerPaths) if (newPaths.has(path)) reparsePaths.add(path);
  const reusablePaths = new Set([...newPaths].filter(path => beforeFacts.files.has(path) && !reparsePaths.has(path)));
  const reuse = createPortableExtractionReuse(before);
  const extraction = await extractPortableRepositoryFromSnapshot(options, effectiveSnapshot, {...reuse, paths: reusablePaths});
  if (!extraction.ok) return extraction;
  const verification = await capturePortableExtractionSnapshot(options.repositoryRoot, options.useGit);
  if ("ok" in verification) return verification;
  const effectiveVerification: PortableExtractionSnapshot = incrementalTestHooks.provenanceOverride
    ? {...verification, provenance: incrementalTestHooks.provenanceOverride}
    : verification;
  if (!sameRoot(effectiveVerification.root, currentRoot) || effectiveVerification.inventory.inventoryFingerprint !== effectiveSnapshot.inventory.inventoryFingerprint) {
    return {ok: false, diagnostics: [{code: "source-mismatch", message: "A source file no longer matches its inventory basis."}]};
  }
  if (portableProvenanceHash(effectiveVerification.provenance) !== currentProvenanceHash) {
    return {ok: false, diagnostics: [{code: "parser-provenance", message: "Pinned parser provenance could not be verified."}]};
  }
  const changedFacts = changedEvidence(before, extraction, effectiveSnapshot, added, deleted, changed);
  const semantic = invalidatePortableSemanticModel(options.semantic ?? cache.semantic, {
    changedPaths: changedFacts.paths,
    changedRecordIds: changedFacts.recordIds,
    inventoryScopeChanged
  });
  const nextCache = createPortableIncrementalCache(extraction, semantic.model);
  const reason: PortableIncrementalReason = inventoryScopeChanged
    ? "inventory-scope-changed"
    : changed.size > 0
      ? "source-changed"
      : reparsePaths.size > 0
        ? "dependency-reparse"
        : "unchanged";
  return {
    ...extraction,
    cache: nextCache,
    incremental: {
      reason,
      counters: {
        cacheAccepted: true,
        filesConsidered: currentFiles.size,
        filesReused: reusablePaths.size,
        filesParsed: [...reparsePaths].filter(path => isParserEligible(currentFiles.get(path)!)).length,
        filesAdded: added.size,
        filesChanged: changed.size,
        filesDeleted: deleted.size,
        importerFilesReparsed: [...reparsePaths].filter(path => importerPaths.has(path)).length
      },
      semantic
    }
  };
}

export const refreshPortableRepository = extractPortableRepositoryIncremental;
export const incrementalExtractPortableRepository = extractPortableRepositoryIncremental;
export const extractPortableRepositoryIncrementally = extractPortableRepositoryIncremental;
