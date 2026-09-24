import { type PortableGenerationManifest } from "./contracts.js";
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
export declare function resolveSelectedCodebaseEvidence(root: string, selection: PortableSelection, options?: ResolveCodebaseNavigationOptions): Promise<PortableSelectionResolution>;
export declare const resolvePortableCodebaseEvidence: typeof resolveSelectedCodebaseEvidence;
export declare const resolveCodebaseSelection: typeof resolveSelectedCodebaseEvidence;
export declare const resolvePortableSelection: typeof resolveSelectedCodebaseEvidence;
export {};
