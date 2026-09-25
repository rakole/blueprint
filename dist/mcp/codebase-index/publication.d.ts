import { type CodebaseDocumentId } from "../codebase-authoring.js";
import { type PortableRenderSuccess } from "./render.js";
import { type PortablePublicationMarker, type PortableSourceBasis, type PortableTargetHashes } from "./contracts.js";
/** The portable root is deliberately separate from the legacy artifact writer. */
export declare const PORTABLE_CODEBASE_ROOT = ".blueprint/codebase";
export declare const PORTABLE_CODEBASE_INDEX = ".blueprint/codebase/INDEX.md";
export declare const PORTABLE_PUBLICATION_MARKER = ".blueprint/codebase/.publication.json";
export declare const PORTABLE_PUBLICATION_LOCK = "codebase-publication";
export declare const PORTABLE_GENERATION_INDEX_NAME = "INDEX.md";
export type PortablePublicationPhase = "capture" | "before-marker" | "before-index";
export type PortableFreshnessContext = {
    readonly phase: PortablePublicationPhase;
    readonly repositoryRoot: string;
    readonly sourceBasis: PortableSourceBasis;
    readonly operationId: string;
    readonly transactionId: string;
    readonly generationId: string;
    readonly previousIndexHash: string | null;
    readonly previousTargetHashes: PortableTargetHashes;
};
export type PortableFreshnessResult = boolean | {
    readonly ok: boolean;
    readonly code?: string;
};
export type PortableFreshnessCheck = (context: PortableFreshnessContext) => Promise<PortableFreshnessResult> | PortableFreshnessResult;
export type PortablePublicationPreflight = {
    readonly repositoryRoot: string;
    readonly operationId: string;
    readonly transactionId: string;
    readonly generationId: string;
    readonly sourceBasis: PortableSourceBasis;
    readonly rootFingerprint: string;
    readonly previousGenerationId: string | null;
    readonly previousIndexHash: string | null;
    readonly previousTargetHashes: PortableTargetHashes;
    readonly observedMarkerHash: string | null;
    readonly legacyBackup: boolean;
    /** The prepare-time replacement authority, retained by operation metadata. */
    readonly intent: "new" | "upgrade" | "refresh" | "repair";
    /** True only when the owning runtime explicitly requested fresh repair. */
    readonly repair: boolean;
};
type PublicationDiagnosticCode = "invalid-input" | "unsafe-root" | "unsafe-target" | "unknown-marker" | "publication-conflict" | "stale-source" | "stale-target" | "compatibility-divergence" | "invalid-generation" | "publication-failed" | "recovery-required";
export type PortablePublicationDiagnostic = {
    readonly code: PublicationDiagnosticCode;
    readonly message: string;
};
export type PortablePublicationResult = {
    readonly ok: boolean;
    readonly status: "published" | "committed" | "reused" | "recovered" | "partial" | "rejected" | "conflict";
    readonly committed: boolean;
    readonly cleanupPending?: boolean;
    readonly retainedGenerations: number;
    readonly retainedBytes: number;
    readonly allocatedGenerations: number;
    readonly allocatedBytes: number;
    readonly diagnostics: readonly PortablePublicationDiagnostic[];
    readonly preflight?: PortablePublicationPreflight;
};
export type CapturePortablePublicationInput = {
    readonly repositoryRoot?: string;
    readonly root?: string;
    readonly operationId: string;
    readonly transactionId?: string;
    readonly generationId: string;
    readonly sourceBasis: PortableSourceBasis;
    readonly intent?: PortablePublicationPreflight["intent"];
    /** The stored prepare-time marker identity for an exact-operation retry. */
    readonly observedMarkerHash?: string | null;
    /** Internal only: exact prepared authority permitted to resume its own marker. */
    readonly resumePreflight?: PortablePublicationPreflight;
    readonly verifyFreshness?: PortableFreshnessCheck;
    /**
     * Repair is an explicit authority. It binds the observed INDEX, target, and
     * marker hashes captured by this preflight and permits replacement of a
     * malformed/partial prior publication. Ordinary publication never infers it.
     */
    readonly repair?: {
        readonly authorized: true;
    };
};
export type PublishPortableMapInput = CapturePortablePublicationInput & {
    readonly rendered: PortableRenderSuccess;
    readonly preflight?: PortablePublicationPreflight;
    /** Persist metadata-only commit truth before cleanup removes the marker. */
    readonly onCommitted?: () => Promise<boolean> | boolean;
};
export type RecoverPortableMapInput = {
    readonly repositoryRoot?: string;
    readonly root?: string;
    /** A caller may bind a marker observed before dispatch. The hash is checked under the lock. */
    readonly observedMarker?: PortablePublicationMarker | string;
    readonly verifyFreshness?: PortableFreshnessCheck;
};
export declare function capturePortablePublicationPreflight(input: CapturePortablePublicationInput): Promise<PortablePublicationPreflight | PortablePublicationResult>;
export declare const preparePortablePublication: typeof capturePortablePublicationPreflight;
/** Test seam for real rename crash-window tests; production callers leave it empty. */
export declare const portablePublicationTestHooks: {
    beforeMarkerWrite?: (marker: PortablePublicationMarker) => Promise<void> | void;
    afterMarkerWrite?: (marker: PortablePublicationMarker) => Promise<void> | void;
    beforeCompatibilityWrite?: (id: CodebaseDocumentId) => Promise<void> | void;
    beforeIndexCommit?: () => Promise<void> | void;
    afterIndexCommit?: () => Promise<void> | void;
    beforeCleanup?: () => Promise<void> | void;
};
export declare function publishPortableMap(input: PublishPortableMapInput): Promise<PortablePublicationResult>;
export declare const publishPortableBundle: typeof publishPortableMap;
export declare const publishPortableCodebaseMap: typeof publishPortableMap;
export declare function recoverPortableMap(input: RecoverPortableMapInput): Promise<PortablePublicationResult>;
export declare const recoverPortablePublication: typeof recoverPortableMap;
export declare const repairPortablePublication: typeof recoverPortableMap;
export {};
