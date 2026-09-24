import { type PortableAlias, type PortableCapability, type PortableClaim, type PortableFileRecord, type PortableGenerationManifest, type PortableImportRelationship, type PortableRelationshipRecord, type PortableStructuralDetailRecord, type PortableSymbolRecord } from "./contracts.js";
import { parsePortableSemanticShard, type PortableSemanticFragment, type PortableSemanticIndexEntry } from "./render.js";
import { type PortablePinReceipt } from "./pin-authority.js";
export type { PortablePinReceipt } from "./pin-authority.js";
/** Ordinary untrusted retained-generation navigation remains bounded. Durable
 * owner receipts use direct target verification and do not use this budget. */
export declare const PORTABLE_PIN_HANDOFF_PREDECESSOR_DEPTH = 100000;
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
export type PortableResolverDiagnosticCode = "missing" | "invalid" | "unsupported" | "unsafe-path" | "checksum-mismatch" | "cycle" | "duplicate-authority" | "resource-limit" | "stale" | "not-found";
export type PortableResolverDiagnosticScope = "index" | "marker" | "generation" | "manifest" | "entry" | "page" | "records" | "semantic" | "predecessor" | "compatibility" | "selection";
export type PortableResolverDiagnostic = {
    readonly code: PortableResolverDiagnosticCode;
    readonly scope: PortableResolverDiagnosticScope;
    readonly message: string;
};
type Page = {
    readonly path: string;
    readonly bytes: Uint8Array;
    readonly body: string;
    readonly hash: string;
};
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
    readonly structural: ReadonlyMap<string, {
        kind: StructuralKind;
        record: StructuralRecord;
        page: Page;
    }>;
    readonly files: ReadonlyMap<string, PortableFileRecord>;
    readonly symbols: ReadonlyMap<string, PortableSymbolRecord>;
    readonly imports: ReadonlyMap<string, PortableImportRelationship>;
    readonly relationships: ReadonlyMap<string, PortableRelationshipRecord>;
    readonly details: ReadonlyMap<string, PortableStructuralDetailRecord>;
    readonly semantic: ReadonlyMap<SemanticKey, {
        record: SemanticRecord;
        parts: readonly PortableSemanticFragment[];
        pages: readonly Page[];
    }>;
    readonly semanticPages: ReadonlyMap<string, PortableSemanticShardPage>;
    readonly semanticIndex: ReadonlyMap<SemanticKey, PortableSemanticIndexEntry>;
};
type PortableSemanticShardPage = {
    readonly shard: ReturnType<typeof parsePortableSemanticShard> & object;
    readonly page: Page;
};
type CompatibilityState = "matching" | "absent" | "mismatch" | "guarded" | "unknown";
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
    readonly entry: {
        readonly path: string;
        readonly sha256: string;
    };
    readonly manifest: {
        readonly path: string;
        readonly sha256: string;
    };
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
export declare function isPortablePinHandoff(value: unknown): value is PortablePinHandoff;
/** True only for a handoff restored from the owner-authenticated receipt store. */
export declare function isPortableDurablePinHandoff(value: unknown): value is PortableDurablePinHandoff;
export type PortablePinReceiptResult = {
    readonly status: "ok";
    readonly receipt: PortablePinReceipt;
    readonly handoff: PortableDurablePinHandoff;
} | {
    readonly status: "invalid";
    readonly reason: string;
};
/**
 * Freshly prove a published pin, then persist an owner-authenticated receipt.
 * The low-level receipt writer never receives unverified caller data from the
 * public API: this function performs the publication proof first.
 */
export declare function issuePortablePinReceipt(root: string, pin: PortableImmutablePin, options?: ResolveCodebaseNavigationOptions): Promise<PortablePinReceiptResult>;
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
export declare function restorePortablePinReceipt(root: string, value: unknown, options?: ResolveCodebaseNavigationOptions): Promise<PortableRestoredPin>;
export type PortableFallback = {
    readonly used: boolean;
    readonly reason: "none" | "absent" | "invalid" | "unsupported" | "stale" | "not-found";
    readonly guidance: string;
};
export type CodebaseNavigationSuccess = {
    readonly status: "ok";
    readonly portable: {
        readonly status: "valid";
        readonly generationId: string;
    };
    readonly entry: {
        readonly path: string;
        readonly body: string;
        readonly sha256: string;
    };
    readonly immutable: PortableImmutablePin;
    readonly pin: PortableImmutablePin;
    readonly coverage: PortableCoverage;
    readonly compatibility: {
        readonly status: CompatibilityState;
        readonly guard: "open" | "blocked" | "unknown";
    };
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
    readonly portable: {
        readonly status: "absent" | "invalid" | "unsupported";
        readonly generationId: string | null;
    };
    readonly entry: null;
    readonly immutable: null;
    readonly pin: null;
    readonly coverage: null;
    readonly compatibility: {
        readonly status: CompatibilityState;
        readonly guard: "open" | "blocked" | "unknown";
    };
    readonly fallback: PortableFallback;
    readonly fallbackUsed: true;
    readonly fallbackReason: PortableFallback["reason"];
    readonly fallbackGuidance: string;
    readonly diagnostics: readonly PortableResolverDiagnostic[];
};
export type CodebaseNavigationResult = CodebaseNavigationSuccess | CodebaseNavigationFallback;
/** Resolve the compact immutable navigation context without returning a manifest or corpus. */
export declare function resolveCodebaseNavigation(root: string, options?: ResolveCodebaseNavigationOptions): Promise<CodebaseNavigationResult>;
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
export declare function verifyPortablePinHandoff(root: string, pin: PortableImmutablePin, options?: ResolveCodebaseNavigationOptions): Promise<CodebaseNavigationResult>;
/** Naming alias for lifecycle owners that describe this operation as a handoff. */
export declare const handoffPortableGenerationPin: typeof verifyPortablePinHandoff;
/**
 * Prove that a literal path is a sealed member of the selected generation.
 * Directory identity alone is insufficient: an extra child can otherwise be
 * mistaken for generated evidence after a valid generation is committed.
 */
export declare function resolveCodebaseSealedMember(root: string, relativePath: string): Promise<boolean>;
/** Navigation/search pages are discovery-only and must say so explicitly. */
export type PortableSelection = {
    readonly kind: "page";
    readonly path: string;
    readonly mode: "discovery";
} | {
    readonly kind: "file" | "symbol" | "import" | "relationship" | "detail";
    readonly recordId: string;
} | {
    readonly kind: "capability" | "claim" | "alias";
    readonly recordId: string;
} | {
    readonly kind: "structural";
    readonly recordKind: "file" | "symbol" | "import" | "relationship" | "detail";
    readonly recordId: string;
} | {
    readonly kind: "semantic";
    readonly recordKind: "capability" | "claim" | "alias";
    readonly recordId: string;
};
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
    readonly entry: {
        readonly path: string;
        readonly sha256: string;
    };
    readonly manifest: {
        readonly path: string;
        readonly sha256: string;
    };
    readonly pages: readonly {
        readonly path: string;
        readonly sha256: string;
    }[];
};
export type PortableSelectionResult = {
    readonly status: "ok";
    /** Consumers may register implementation results; discovery results are only navigation hints. */
    readonly mode: "implementation" | "discovery";
    readonly generationId: string;
    readonly roots: readonly string[];
    readonly entries: readonly PortableSelectedEvidence[];
    readonly selected: readonly {
        readonly kind: PortableDirectSelectionKind;
        readonly recordId?: string;
        readonly page: string;
    }[];
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
/** Resolve exact selected page/record dependencies for later evidence delivery. */
export declare function resolveSelectedCodebaseEvidence(root: string, selection: PortableSelection, options?: ResolveCodebaseNavigationOptions, authenticatedGeneration?: VerifiedGeneration): Promise<PortableSelectionResolution>;
/** Select evidence from an owner-authenticated target without reading INDEX or predecessors. */
export declare function resolveSelectedCodebaseEvidenceWithPortablePin(root: string, selection: PortableSelection, handoff: PortablePinHandoff, options?: ResolveCodebaseNavigationOptions): Promise<PortableSelectionResolution>;
export declare const resolvePortableCodebaseEvidence: typeof resolveSelectedCodebaseEvidence;
export declare const resolveCodebaseSelection: typeof resolveSelectedCodebaseEvidence;
export declare const resolvePortableSelection: typeof resolveSelectedCodebaseEvidence;
