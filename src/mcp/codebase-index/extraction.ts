import {createHash} from "node:crypto";
import {lstat, realpath} from "node:fs/promises";
import path from "node:path";

import {
  PORTABLE_MAP_MAX_MODEL_PACKET_BYTES,
  portableModelPacketSchema,
  portableStructuralInventorySchema,
  serializedUtf8ByteLength,
  type PortableFileRecord,
  type PortableImportRelationship,
  type PortableRelationshipRecord,
  type PortableStructuralDetailRecord,
  type PortableStructuralInventory,
  type PortableSymbolRecord
} from "./contracts.js";
import {
  portableAuthoritativeSourceBasisSchema,
  type PortableAuthoritativeSourceBasis,
  type PortableAuthoritativeSourceRecord
} from "./model-validation.js";
import {
  adaptJavaFile,
  JAVA_ADAPTER_RULE_VERSION,
  type JavaAdapterResult
} from "./adapters/java.js";
import {
  adaptJavaScriptFile,
  JAVASCRIPT_ADAPTER_RULE_VERSION,
  type JavaScriptAdapterResult
} from "./adapters/javascript.js";
import {
  adaptPythonFile,
  PYTHON_ADAPTER_RULE_VERSION,
  type PythonAdapterResult
} from "./adapters/python.js";
import {inspectContentBoundaries} from "./content-boundary.js";
import {
  buildSourceInventory,
  INVENTORY_MAX_FILE_BYTES,
  type SourceInventory,
  type SourceInventoryFile
} from "./inventory.js";
import {getParserAssetManifest} from "./parser-runtime.js";
import {sourcePathExclusionReason, sourcePathSafetyReason} from "./path-policy.js";
import {withParserSource, type ParserSourceBasis} from "./parser-source.js";

/** The structural shard cap is a contract limit, not a model packet limit. */
const STRUCTURAL_SHARD_RECORD_LIMIT = 4096;

export const EXTRACTION_ADAPTER_RULE_VERSIONS = {
  javascript: JAVASCRIPT_ADAPTER_RULE_VERSION,
  python: PYTHON_ADAPTER_RULE_VERSION,
  java: JAVA_ADAPTER_RULE_VERSION
} as const;

export type ExtractionDiagnosticCode =
  | "root-unavailable"
  | "root-changed"
  | "inventory-failed"
  | "unstable-inventory"
  | "unsafe-path"
  | "source-read-failed"
  | "source-mismatch"
  | "parser-provenance"
  | "invalid-structure"
  | "packet-selection"
  | "packet-too-large"
  | "unsafe-content";

/** Fixed metadata-only diagnostics. Paths, source values, and parser errors are omitted. */
export type ExtractionDiagnostic = {
  readonly code: ExtractionDiagnosticCode;
  readonly message: string;
};

const DIAGNOSTIC_MESSAGES: Record<ExtractionDiagnosticCode, string> = {
  "root-unavailable": "The repository root is unavailable.",
  "root-changed": "The repository root changed while extraction was running.",
  "inventory-failed": "The source inventory could not be captured.",
  "unstable-inventory": "The source inventory contains an unstable or unreadable exclusion.",
  "unsafe-path": "A source path crossed the permitted repository boundary.",
  "source-read-failed": "A source file could not be read for extraction.",
  "source-mismatch": "A source file no longer matches its inventory basis.",
  "parser-provenance": "Pinned parser provenance could not be verified.",
  "invalid-structure": "The extracted structural records failed their fixed contract.",
  "packet-selection": "The requested model packet selection is not canonical.",
  "packet-too-large": "A complete model packet record exceeds the fixed UTF-8 byte limit.",
  "unsafe-content": "A model packet value crossed a content boundary."
};

function diagnostic(code: ExtractionDiagnosticCode): ExtractionDiagnostic {
  return {code, message: DIAGNOSTIC_MESSAGES[code]};
}

export type ExtractionRootIdentity = {
  /** Caller-resolved path, retained only for server-side compare-and-swap checks. */
  readonly path: string;
  /** Actual filesystem target captured with the device and inode. */
  readonly realPath: string;
  readonly device: number;
  readonly inode: number;
};

export type ExtractionParserProvenance = {
  readonly runtime: {
    readonly package: string;
    readonly version: string;
    readonly packageSha256: string;
    readonly module: string;
    readonly moduleSha256: string;
    readonly wasm: string;
    readonly wasmSha256: string;
    readonly languageVersion: number;
    readonly minimumCompatibleVersion: number;
  };
  readonly grammars: readonly {
    readonly package: string;
    readonly version: string;
    readonly packageSha256: string;
    readonly asset: string;
    readonly sha256: string;
    readonly abiVersion: number;
  }[];
  readonly adapters: readonly {
    readonly name: "javascript" | "python" | "java";
    readonly ruleVersion: string;
  }[];
};

export type ExtractionCoverageSummary = {
  readonly candidateCount: number;
  readonly includedCount: number;
  readonly excludedCount: number;
  readonly exclusions: readonly {readonly reason: string; readonly count: number}[];
  readonly structural: {
    readonly filesInventoried: number;
    readonly filesWithFullCoverage: number;
    readonly filesWithFileCoverage: number;
    readonly symbolsExtracted: number;
    readonly importsExtracted: number;
    readonly relationshipsExtracted: number;
  };
};

export type PortableExtractionSuccess = {
  readonly ok: true;
  readonly generationId: string;
  readonly root: ExtractionRootIdentity;
  readonly inventoryFingerprint: string;
  readonly structuralShards: readonly PortableStructuralInventory[];
  readonly sourceBasis: PortableAuthoritativeSourceBasis;
  readonly coverage: ExtractionCoverageSummary;
  readonly provenance: ExtractionParserProvenance;
};

export type PortableExtractionFailure = {
  readonly ok: false;
  readonly diagnostics: readonly ExtractionDiagnostic[];
};

export type PortableExtractionResult = PortableExtractionSuccess | PortableExtractionFailure;

export type PortableExtractionOptions = {
  readonly repositoryRoot: string;
  readonly generationId: string;
  readonly useGit?: boolean;
};

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableId(prefix: string, value: string): string {
  return `${prefix}${sha256(value).slice(0, 32)}`;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareById<T extends {readonly id: string}>(left: T, right: T): number {
  return compareText(left.id, right.id);
}

function makeInitialFile(file: SourceInventoryFile): PortableFileRecord {
  const id = stableId("file-", file.path);
  if (file.support === "unsupported") {
    return {
      id,
      path: file.path,
      language: file.language,
      role: file.role,
      byteSize: file.byteSize,
      contentHash: file.contentHash,
      parseStatus: "unsupported",
      coverageStatus: "file",
      limitationReason: "unsupported-language"
    };
  }
  if (file.byteSize > INVENTORY_MAX_FILE_BYTES) {
    return {
      id,
      path: file.path,
      language: file.language,
      role: file.role,
      byteSize: file.byteSize,
      contentHash: file.contentHash,
      parseStatus: "skipped",
      coverageStatus: "file",
      limitationReason: "too-large"
    };
  }
  return {
    id,
    path: file.path,
    language: file.language,
    role: file.role,
    byteSize: file.byteSize,
    contentHash: file.contentHash,
    parseStatus: "skipped",
    coverageStatus: "file",
    limitationReason: "not-extracted"
  };
}

function sameRoot(left: ExtractionRootIdentity, right: ExtractionRootIdentity): boolean {
  return left.path === right.path && left.realPath === right.realPath &&
    left.device === right.device && left.inode === right.inode;
}

async function captureRoot(repositoryRoot: string): Promise<ExtractionRootIdentity | null> {
  const requested = path.resolve(repositoryRoot);
  const actual = await realpath(requested).catch(() => null);
  if (!actual) return null;
  const info = await lstat(actual).catch(() => null);
  if (!info || !info.isDirectory()) return null;
  return {
    path: requested,
    realPath: actual,
    device: info.dev,
    inode: info.ino
  };
}

function hasUnsafePathBoundary(inventory: SourceInventory): boolean {
  return inventory.files.some(file => {
    if (sourcePathSafetyReason(file.path) || sourcePathExclusionReason(file.path)) return true;
    return !inspectContentBoundaries(file.path).safe;
  });
}

function hasUnstableExclusion(inventory: SourceInventory): boolean {
  return inventory.exclusions.some(item => [
    "missing", "not-a-regular-file", "unreadable", "changed-during-read", "symlink"
  ].includes(item.reason));
}

async function adaptFile(
  file: PortableFileRecord,
  source: Uint8Array,
  knownFiles: readonly PortableFileRecord[]
): Promise<JavaScriptAdapterResult | PythonAdapterResult | JavaAdapterResult> {
  switch (file.language) {
    case "javascript":
    case "jsx":
    case "typescript":
    case "tsx":
      return adaptJavaScriptFile({file, source, knownFiles});
    case "python":
      return adaptPythonFile({file, source, knownFiles});
    case "java":
      return adaptJavaFile({file, source, knownFiles});
    default:
      return {
        ok: false,
        status: "unsupported",
        file,
        symbols: [],
        imports: [],
        relationships: [],
        details: [],
        diagnostics: [{code: "unsupported-language", message: DIAGNOSTIC_MESSAGES["invalid-structure"]}],
        ruleVersion: JAVA_ADAPTER_RULE_VERSION
      } as JavaAdapterResult;
  }
}

function sourceBasisRecord(
  kind: PortableAuthoritativeSourceRecord["kind"],
  record: {readonly id: string; readonly path?: string; readonly sourcePath?: string; readonly contentHash: string; readonly coordinate?: PortableFileRecord["coordinate"]}
): PortableAuthoritativeSourceRecord {
  return {
    kind,
    recordId: record.id,
    path: record.path ?? record.sourcePath ?? "",
    contentHash: record.contentHash,
    ...(record.coordinate ? {coordinate: record.coordinate} : {})
  };
}

function makeSourceBasis(
  generationId: string,
  files: readonly PortableFileRecord[],
  symbols: readonly PortableSymbolRecord[],
  imports: readonly PortableImportRelationship[],
  relationships: readonly PortableRelationshipRecord[]
): PortableAuthoritativeSourceBasis {
  const basis: PortableAuthoritativeSourceBasis = {
    generationId,
    files: files.map(file => ({path: file.path, byteSize: file.byteSize, contentHash: file.contentHash})),
    records: [
      ...files.map(file => sourceBasisRecord("file", file)),
      ...symbols.map(symbol => sourceBasisRecord("symbol", symbol)),
      ...imports.map(item => sourceBasisRecord("import", item)),
      ...relationships.map(item => sourceBasisRecord("relationship", item))
    ]
  };
  return portableAuthoritativeSourceBasisSchema.parse(basis);
}

type StructuralRecords = {
  readonly files: readonly PortableFileRecord[];
  readonly symbols: readonly PortableSymbolRecord[];
  readonly imports: readonly PortableImportRelationship[];
  readonly relationships: readonly PortableRelationshipRecord[];
  readonly details: readonly PortableStructuralDetailRecord[];
};

function makeStructuralShards(generationId: string, records: StructuralRecords): PortableStructuralInventory[] {
  const sorted = {
    files: [...records.files].sort(compareById),
    symbols: [...records.symbols].sort(compareById),
    imports: [...records.imports].sort(compareById),
    relationships: [...records.relationships].sort(compareById),
    details: [...records.details].sort(compareById)
  };
  const shardCount = Math.max(
    1,
    ...Object.values(sorted).map(items => Math.ceil(items.length / STRUCTURAL_SHARD_RECORD_LIMIT))
  );
  const shards: PortableStructuralInventory[] = [];
  for (let index = 0; index < shardCount; index += 1) {
    const shard = {
      generationId,
      shardId: `structural-${String(index + 1).padStart(3, "0")}`,
      files: sorted.files.slice(index * STRUCTURAL_SHARD_RECORD_LIMIT, (index + 1) * STRUCTURAL_SHARD_RECORD_LIMIT),
      symbols: sorted.symbols.slice(index * STRUCTURAL_SHARD_RECORD_LIMIT, (index + 1) * STRUCTURAL_SHARD_RECORD_LIMIT),
      imports: sorted.imports.slice(index * STRUCTURAL_SHARD_RECORD_LIMIT, (index + 1) * STRUCTURAL_SHARD_RECORD_LIMIT),
      relationships: sorted.relationships.slice(index * STRUCTURAL_SHARD_RECORD_LIMIT, (index + 1) * STRUCTURAL_SHARD_RECORD_LIMIT),
      details: sorted.details.slice(index * STRUCTURAL_SHARD_RECORD_LIMIT, (index + 1) * STRUCTURAL_SHARD_RECORD_LIMIT)
    } satisfies PortableStructuralInventory;
    // Complete canonical shards deliberately omit continuation metadata.
    if (!portableStructuralInventorySchema.safeParse(shard).success) throw new Error("invalid structural shard");
    shards.push(shard);
  }
  return shards;
}

function makeProvenance(manifest: Awaited<ReturnType<typeof getParserAssetManifest>>): ExtractionParserProvenance {
  const grammars = manifest.grammars.flatMap(raw => {
    const grammar = raw as Record<string, unknown>;
    const packageName = typeof grammar.package === "string" ? grammar.package : "";
    const version = typeof grammar.version === "string" ? grammar.version : "";
    const packageSha256 = typeof grammar.packageSha256 === "string" ? grammar.packageSha256 : "";
    if (typeof grammar.asset === "string" && typeof grammar.sha256 === "string" && typeof grammar.abiVersion === "number") {
      return [{package: packageName, version, packageSha256, asset: grammar.asset, sha256: grammar.sha256, abiVersion: grammar.abiVersion}];
    }
    if (!Array.isArray(grammar.assets)) return [];
    return grammar.assets.flatMap(item => {
      if (!item || typeof item !== "object") return [];
      const asset = item as Record<string, unknown>;
      return typeof asset.asset === "string" && typeof asset.sha256 === "string" && typeof asset.abiVersion === "number"
        ? [{package: packageName, version, packageSha256, asset: asset.asset, sha256: asset.sha256, abiVersion: asset.abiVersion}]
        : [];
    });
  }).sort((left, right) => compareText(`${left.package}\u0000${left.version}\u0000${left.asset}`, `${right.package}\u0000${right.version}\u0000${right.asset}`));
  return {
    runtime: {
      package: manifest.runtime.package,
      version: manifest.runtime.version,
      packageSha256: manifest.runtime.packageSha256,
      module: manifest.runtime.module,
      moduleSha256: manifest.runtime.moduleSha256,
      wasm: manifest.runtime.wasm,
      wasmSha256: manifest.runtime.wasmSha256,
      languageVersion: manifest.runtime.languageVersion,
      minimumCompatibleVersion: manifest.runtime.minimumCompatibleVersion
    },
    grammars,
    adapters: [
      {name: "javascript", ruleVersion: JAVASCRIPT_ADAPTER_RULE_VERSION},
      {name: "python", ruleVersion: PYTHON_ADAPTER_RULE_VERSION},
      {name: "java", ruleVersion: JAVA_ADAPTER_RULE_VERSION}
    ]
  };
}

/**
 * Inventory and extract all eligible repository files without writing state.
 * Source bytes are passed only through the private parser reader callback and
 * are cleared by that reader as soon as the adapter returns.
 */
export async function extractPortableRepository(
  options: PortableExtractionOptions
): Promise<PortableExtractionResult> {
  const beforeRoot = await captureRoot(options.repositoryRoot);
  if (!beforeRoot) return {ok: false, diagnostics: [diagnostic("root-unavailable")]};

  let inventory: SourceInventory;
  try {
    inventory = await buildSourceInventory(options.repositoryRoot, {useGit: options.useGit});
  } catch {
    return {ok: false, diagnostics: [diagnostic("inventory-failed")]};
  }
  const afterInventoryRoot = await captureRoot(options.repositoryRoot);
  if (!afterInventoryRoot || !sameRoot(beforeRoot, afterInventoryRoot)) {
    return {ok: false, diagnostics: [diagnostic("root-changed")]};
  }
  if (hasUnstableExclusion(inventory)) return {ok: false, diagnostics: [diagnostic("unstable-inventory")]};
  if (hasUnsafePathBoundary(inventory)) return {ok: false, diagnostics: [diagnostic("unsafe-path")]};

  let provenance: ExtractionParserProvenance;
  try {
    provenance = makeProvenance(await getParserAssetManifest());
  } catch {
    return {ok: false, diagnostics: [diagnostic("parser-provenance")]};
  }

  const initialFiles = inventory.files.map(makeInitialFile).sort((left, right) => compareText(left.path, right.path));
  const knownFiles = initialFiles;
  const files: PortableFileRecord[] = [];
  const symbols: PortableSymbolRecord[] = [];
  const imports: PortableImportRelationship[] = [];
  const relationships: PortableRelationshipRecord[] = [];
  const details: PortableStructuralDetailRecord[] = [];
  for (const file of initialFiles) {
    if (file.language === "unknown" || file.byteSize > INVENTORY_MAX_FILE_BYTES) {
      files.push(file);
      continue;
    }
    const sourceBasis: ParserSourceBasis = {
      path: file.path,
      byteSize: file.byteSize,
      contentHash: file.contentHash
    };
    const read = await withParserSource(options.repositoryRoot, sourceBasis, source => adaptFile(file, source, knownFiles));
    if (!read.ok) {
      const code = read.diagnostic.reason === "hash-mismatch" || read.diagnostic.reason === "size-mismatch"
        ? "source-mismatch"
        : "source-read-failed";
      return {ok: false, diagnostics: [diagnostic(code)]};
    }
    const result = read.result;
    if (!result.ok && result.status === "stale") return {ok: false, diagnostics: [diagnostic("source-mismatch")]};
    files.push(result.file);
    symbols.push(...result.symbols);
    imports.push(...result.imports);
    relationships.push(...result.relationships);
    details.push(...result.details);
  }

  const structuralRecords: StructuralRecords = {files, symbols, imports, relationships, details};
  let structuralShards: PortableStructuralInventory[];
  let sourceBasis: PortableAuthoritativeSourceBasis;
  try {
    structuralShards = makeStructuralShards(options.generationId, structuralRecords);
    sourceBasis = makeSourceBasis(options.generationId, files, symbols, imports, relationships);
  } catch {
    return {ok: false, diagnostics: [diagnostic("invalid-structure")]};
  }
  const structural = {
    filesInventoried: files.length,
    filesWithFullCoverage: files.filter(file => file.coverageStatus === "full").length,
    filesWithFileCoverage: files.filter(file => file.coverageStatus === "file").length,
    symbolsExtracted: symbols.length,
    importsExtracted: imports.length,
    relationshipsExtracted: relationships.length
  };
  return {
    ok: true,
    generationId: options.generationId,
    root: beforeRoot,
    inventoryFingerprint: inventory.inventoryFingerprint,
    structuralShards,
    sourceBasis,
    coverage: {
      candidateCount: inventory.candidateCount,
      includedCount: inventory.includedCount,
      excludedCount: inventory.excludedCount,
      exclusions: inventory.exclusions,
      structural
    },
    provenance
  };
}

export const extractCodebaseStructure = extractPortableRepository;
export const extractRepositoryCodebase = extractPortableRepository;

export type PortableModelPacketCapability = {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
};

export type ModelPacketSelection = {
  readonly fileIds?: readonly string[];
  readonly symbolIds?: readonly string[];
  readonly detailIds?: readonly string[];
  readonly importIds?: readonly string[];
  readonly relationshipIds?: readonly string[];
  readonly capabilities?: readonly PortableModelPacketCapability[];
};

export type PortableModelPacket = {
  readonly packetVersion: 1;
  readonly operationId: string;
  readonly generationId: string;
  readonly selectedFiles: readonly PortableFileRecord[];
  readonly selectedSymbols: readonly PortableSymbolRecord[];
  readonly selectedDetails: readonly PortableStructuralDetailRecord[];
  readonly selectedImports: readonly PortableImportRelationship[];
  readonly selectedRelationships: readonly PortableRelationshipRecord[];
  readonly selectedCapabilities: readonly PortableModelPacketCapability[];
  readonly continuation?: {readonly cursor: string; readonly hasMore: boolean};
};

export type ModelPacketResult =
  | {
    readonly ok: true;
    readonly packets: readonly PortableModelPacket[];
    readonly serializedBytes: readonly number[];
    readonly complete: boolean;
  }
  | {
    readonly ok: false;
    readonly diagnostics: readonly ExtractionDiagnostic[];
  };

type PacketRecords = {
  files: PortableFileRecord[];
  symbols: PortableSymbolRecord[];
  details: PortableStructuralDetailRecord[];
  imports: PortableImportRelationship[];
  relationships: PortableRelationshipRecord[];
};

type PacketUnit =
  | {readonly kind: "files"; readonly value: PortableFileRecord}
  | {readonly kind: "symbols"; readonly value: PortableSymbolRecord}
  | {readonly kind: "details"; readonly value: PortableStructuralDetailRecord}
  | {readonly kind: "imports"; readonly value: PortableImportRelationship}
  | {readonly kind: "relationships"; readonly value: PortableRelationshipRecord};

function flattenShards(extraction: PortableExtractionSuccess): PacketRecords {
  const records: PacketRecords = {files: [], symbols: [], details: [], imports: [], relationships: []};
  for (const shard of extraction.structuralShards) {
    records.files.push(...shard.files);
    records.symbols.push(...shard.symbols);
    records.details.push(...(shard.details ?? []));
    records.imports.push(...shard.imports);
    records.relationships.push(...shard.relationships);
  }
  records.files.sort(compareById);
  records.symbols.sort(compareById);
  records.details.sort(compareById);
  records.imports.sort(compareById);
  records.relationships.sort(compareById);
  return records;
}

function choose<T extends {readonly id: string}>(
  all: readonly T[],
  requested: readonly string[] | undefined
): T[] | null {
  if (!requested) return [...all];
  if (new Set(requested).size !== requested.length) return null;
  const byId = new Map(all.map(item => [item.id, item]));
  const selected = requested.map(id => byId.get(id));
  return selected.every(Boolean) ? selected as T[] : null;
}

function packetHasUnsafeContent(packet: PortableModelPacket): boolean {
  const strings = [
    ...packet.selectedFiles.map(item => item.path),
    ...packet.selectedSymbols.flatMap(item => [item.path, item.qualifiedName ?? "", item.signature ?? ""]),
    ...packet.selectedImports.flatMap(item => [item.sourcePath, item.specifier]),
    ...packet.selectedRelationships.map(item => item.sourcePath),
    ...packet.selectedDetails.map(item => item.text),
    ...packet.selectedCapabilities.flatMap(item => [item.name, item.summary])
  ];
  return strings.some(value => value.length > 0 && !inspectContentBoundaries(value).safe);
}

function packetWithinRecordLimits(packet: PortableModelPacket): boolean {
  return packet.selectedFiles.length <= 128 &&
    packet.selectedSymbols.length <= 256 &&
    packet.selectedDetails.length <= 256 &&
    packet.selectedImports.length <= 256 &&
    packet.selectedRelationships.length <= 256 &&
    packet.selectedCapabilities.length <= 64;
}

function packetContractIsValid(packet: PortableModelPacket): boolean {
  return packetWithinRecordLimits(packet) && portableModelPacketSchema.safeParse(packet).success;
}

/**
 * Build final serialized packets from complete records. The greedy boundary
 * is tested against the actual JSON UTF-8 bytes, so a record is never sliced
 * or silently omitted. Complete structural shards stay continuation-free for
 * the model validator; only this model-facing stream carries cursors.
 */
export function packetizePortableModelEvidence(
  extraction: PortableExtractionSuccess,
  operationId: string,
  selection: ModelPacketSelection = {}
): ModelPacketResult {
  const records = flattenShards(extraction);
  const chosen: PacketRecords = {
    files: choose(records.files, selection.fileIds) ?? [],
    symbols: choose(records.symbols, selection.symbolIds) ?? [],
    details: choose(records.details, selection.detailIds) ?? [],
    imports: choose(records.imports, selection.importIds) ?? [],
    relationships: choose(records.relationships, selection.relationshipIds) ?? []
  };
  if (Object.values({
    files: selection.fileIds,
    symbols: selection.symbolIds,
    details: selection.detailIds,
    imports: selection.importIds,
    relationships: selection.relationshipIds
  }).some((requested, index) => requested && [chosen.files, chosen.symbols, chosen.details, chosen.imports, chosen.relationships][index]!.length !== requested.length)) {
    return {ok: false, diagnostics: [diagnostic("packet-selection")]};
  }
  const capabilities = [...(selection.capabilities ?? [])];
  const base = (): Omit<PortableModelPacket, "continuation"> => ({
    packetVersion: 1,
    operationId,
    generationId: extraction.generationId,
    selectedFiles: [],
    selectedSymbols: [],
    selectedDetails: [],
    selectedImports: [],
    selectedRelationships: [],
    selectedCapabilities: capabilities
  });
  const basePacket = base();
  if (!packetContractIsValid(basePacket)) return {ok: false, diagnostics: [diagnostic("packet-selection")]};
  const packets: PortableModelPacket[] = [];
  const serializedBytes: number[] = [];
  let current = base();
  const units: PacketUnit[] = [];
  for (const value of chosen.files) units.push({kind: "files", value});
  for (const value of chosen.symbols) units.push({kind: "symbols", value});
  for (const value of chosen.details) units.push({kind: "details", value});
  for (const value of chosen.imports) units.push({kind: "imports", value});
  for (const value of chosen.relationships) units.push({kind: "relationships", value});
  if (units.length === 0) {
    const empty = {...current, ...(capabilities.length > 0 ? {} : {})};
    if (packetHasUnsafeContent(empty)) return {ok: false, diagnostics: [diagnostic("unsafe-content")]};
    const bytes = serializedUtf8ByteLength(empty);
    if (bytes > PORTABLE_MAP_MAX_MODEL_PACKET_BYTES) return {ok: false, diagnostics: [diagnostic("packet-too-large")]};
    if (!packetContractIsValid(empty)) return {ok: false, diagnostics: [diagnostic("packet-selection")]};
    return {ok: true, packets: [empty], serializedBytes: [bytes], complete: true};
  }
  const assign = (packet: Omit<PortableModelPacket, "continuation">, unit: PacketUnit): Omit<PortableModelPacket, "continuation"> => {
    switch (unit.kind) {
      case "files": return {...packet, selectedFiles: [...packet.selectedFiles, unit.value]};
      case "symbols": return {...packet, selectedSymbols: [...packet.selectedSymbols, unit.value]};
      case "details": return {...packet, selectedDetails: [...packet.selectedDetails, unit.value]};
      case "imports": return {...packet, selectedImports: [...packet.selectedImports, unit.value]};
      case "relationships": return {...packet, selectedRelationships: [...packet.selectedRelationships, unit.value]};
    }
  };
  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index]!;
    const candidate = assign(current, unit);
    const hasMore = index + 1 < units.length;
    const candidateWithContinuation: PortableModelPacket = hasMore
      ? {...candidate, continuation: {cursor: `packet-${String(packets.length + 2)}`, hasMore: true}}
      : candidate;
    const bytes = serializedUtf8ByteLength(candidateWithContinuation);
    if (bytes <= PORTABLE_MAP_MAX_MODEL_PACKET_BYTES && packetContractIsValid(candidateWithContinuation)) {
      current = candidate;
      continue;
    }
    const currentHasRecords = current.selectedFiles.length > 0 || current.selectedSymbols.length > 0 ||
      current.selectedDetails.length > 0 || current.selectedImports.length > 0 || current.selectedRelationships.length > 0;
    if (!currentHasRecords) {
      return {ok: false, diagnostics: [diagnostic("packet-too-large")]};
    }
    const finalized: PortableModelPacket = {...current, continuation: {cursor: `packet-${String(packets.length + 2)}`, hasMore: true}};
    if (packetHasUnsafeContent(finalized)) return {ok: false, diagnostics: [diagnostic("unsafe-content")]};
    const finalizedBytes = serializedUtf8ByteLength(finalized);
    if (finalizedBytes > PORTABLE_MAP_MAX_MODEL_PACKET_BYTES) return {ok: false, diagnostics: [diagnostic("packet-too-large")]};
    if (!packetContractIsValid(finalized)) return {ok: false, diagnostics: [diagnostic("packet-selection")]};
    packets.push(finalized);
    serializedBytes.push(finalizedBytes);
    current = assign(base(), unit);
  }
  const finalPacket: PortableModelPacket = current;
  if (packetHasUnsafeContent(finalPacket)) return {ok: false, diagnostics: [diagnostic("unsafe-content")]};
  const finalBytes = serializedUtf8ByteLength(finalPacket);
  if (finalBytes > PORTABLE_MAP_MAX_MODEL_PACKET_BYTES) return {ok: false, diagnostics: [diagnostic("packet-too-large")]};
  if (!packetContractIsValid(finalPacket)) return {ok: false, diagnostics: [diagnostic("packet-selection")]};
  packets.push(finalPacket);
  serializedBytes.push(finalBytes);
  return {ok: true, packets, serializedBytes, complete: true};
}

export const createPortableModelPackets = packetizePortableModelEvidence;
export const createModelPackets = packetizePortableModelEvidence;
