import { type PortableFileRecord, type PortableImportRelationship, type PortableRelationshipRecord, type PortableStructuralDetailRecord, type PortableStructuralInventory, type PortableSymbolRecord } from "./contracts.js";
import { type PortableAuthoritativeSourceBasis } from "./model-validation.js";
export declare const EXTRACTION_ADAPTER_RULE_VERSIONS: {
    readonly javascript: "javascript-declarations-v1/tree-sitter-0.27.0";
    readonly python: "python-declarations-v1/tree-sitter-0.27.0";
    readonly java: "java-declarations-v1/tree-sitter-0.27.0";
};
export type ExtractionDiagnosticCode = "root-unavailable" | "root-changed" | "inventory-failed" | "unstable-inventory" | "unsafe-path" | "source-read-failed" | "source-mismatch" | "parser-provenance" | "invalid-structure" | "packet-selection" | "packet-too-large" | "unsafe-content";
/** Fixed metadata-only diagnostics. Paths, source values, and parser errors are omitted. */
export type ExtractionDiagnostic = {
    readonly code: ExtractionDiagnosticCode;
    readonly message: string;
};
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
    readonly exclusions: readonly {
        readonly reason: string;
        readonly count: number;
    }[];
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
/**
 * Inventory and extract all eligible repository files without writing state.
 * Source bytes are passed only through the private parser reader callback and
 * are cleared by that reader as soon as the adapter returns.
 */
export declare function extractPortableRepository(options: PortableExtractionOptions): Promise<PortableExtractionResult>;
export declare const extractCodebaseStructure: typeof extractPortableRepository;
export declare const extractRepositoryCodebase: typeof extractPortableRepository;
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
    readonly continuation?: {
        readonly cursor: string;
        readonly hasMore: boolean;
    };
};
export type ModelPacketResult = {
    readonly ok: true;
    readonly packets: readonly PortableModelPacket[];
    readonly serializedBytes: readonly number[];
    readonly complete: boolean;
} | {
    readonly ok: false;
    readonly diagnostics: readonly ExtractionDiagnostic[];
};
/**
 * Build final serialized packets from complete records. The greedy boundary
 * is tested against the actual JSON UTF-8 bytes, so a record is never sliced
 * or silently omitted. Complete structural shards stay continuation-free for
 * the model validator; only this model-facing stream carries cursors.
 */
export declare function packetizePortableModelEvidence(extraction: PortableExtractionSuccess, operationId: string, selection?: ModelPacketSelection): ModelPacketResult;
export declare const createPortableModelPackets: typeof packetizePortableModelEvidence;
export declare const createModelPackets: typeof packetizePortableModelEvidence;
