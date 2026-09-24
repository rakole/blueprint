import { type PortableSourceCoordinate } from "./contracts.js";
import { type PortableResolverDiagnostic, type PortableSelection, type PortableSelectionResult, type PortablePinHandoff, type PortablePinReceipt, type ResolveCodebaseNavigationOptions } from "./resolver.js";
import { type EvidenceDeliveryFailure, type EvidenceDeliveryLimits, type EvidenceDeliverySuccess, type EvidenceMode, type EvidencePacket, type PriorEvidenceBinding, type PriorEvidenceDelivery, type ReadTimeEvidence } from "../evidence-delivery.js";
/** A source correctness read, separate from a model-delivery identity. */
export type ConsumerReadSetEntry = {
    readonly path: string;
    readonly generation: string;
    readonly hash: string;
    readonly kind: "page" | "source";
    readonly fullFileHash?: string;
    readonly rangeHash?: string;
    readonly coordinate?: PortableSourceCoordinate;
    /** Present for a bounded source range whose delivered bytes are virtual. */
    readonly deliveryPath?: string;
};
export type ConsumerEvidenceBaseline = {
    /** Existing provider-selected evidence already in the lifecycle read set. */
    readonly selectedCount?: number;
    /** Existing provider read-set identities, including any source reads. */
    readonly readSetCount?: number;
};
export type ConsumerEvidenceInput = {
    readonly root: string;
    readonly selection: PortableSelection;
    readonly mode: EvidenceMode;
    /** Optional explicit generation target; this is proved by the resolver. */
    readonly generationId?: string;
    /** Non-serializable owner capability returned by verifyPortablePinHandoff. */
    readonly pinHandoff?: PortablePinHandoff;
    /** Serialized owner receipt restored through the repository-owned pin store. */
    readonly pinReceipt?: PortablePinReceipt;
    /** A prior binding is evidence input, never a trust grant. */
    readonly prior?: PriorEvidenceDelivery;
    readonly readTimeEvidence?: readonly ReadTimeEvidence[];
    readonly limits?: EvidenceDeliveryLimits;
    readonly baseline?: ConsumerEvidenceBaseline;
    readonly resolverOptions?: ResolveCodebaseNavigationOptions;
};
export type ConsumerEvidenceCounts = EvidenceDeliverySuccess["counts"];
export type ConsumerEvidenceSuccess = {
    readonly status: "ok";
    readonly mode: EvidenceMode;
    readonly generationId: string;
    readonly packet: EvidencePacket;
    readonly binding: PriorEvidenceBinding;
    readonly counts: ConsumerEvidenceCounts;
    /** Source and page identities actually re-read for this request. */
    readonly readSet: readonly ConsumerReadSetEntry[];
    /** The resolver proof that was created in this request and consumed here. */
    readonly snapshot: PortableSelectionResult["snapshot"];
    readonly selected: PortableSelectionResult["selected"];
    readonly diagnostics: readonly PortableResolverDiagnostic[];
};
export type ConsumerEvidenceFailureCode = "invalid_input" | "discovery_only" | "resolver_failure" | "page_tampered" | "entry_tampered" | "source_tampered" | "unsafe_content" | "source_unreadable" | "invalid_range" | "evidence_limit" | "delivery_failure";
export type ConsumerEvidenceFailure = {
    readonly status: "fallback" | "invalid" | "not-found" | "reread_required" | "evidence_limit";
    readonly code: ConsumerEvidenceFailureCode;
    readonly reason: string;
    readonly paths: readonly string[];
    readonly diagnostics: readonly PortableResolverDiagnostic[];
    readonly delivery?: EvidenceDeliveryFailure;
    readonly counts?: ConsumerEvidenceCounts;
    readonly scopeReduction?: {
        readonly selectedCount: number;
        readonly suggestedMaxCount?: number;
        readonly omittedBodyCount: number;
        readonly omittedPathCount?: number;
    };
};
export type ConsumerEvidenceResult = ConsumerEvidenceSuccess | ConsumerEvidenceFailure;
/**
 * Resolve one consumer selection, re-read every selected page/source literally,
 * and shape the verified bytes through the pure full/delta/register helper.
 * This function has no session or persistence side effects.  In particular,
 * it never accepts a caller-provided resolver snapshot or pin as authority.
 */
export declare function resolveConsumerEvidence(input: ConsumerEvidenceInput): Promise<ConsumerEvidenceResult>;
export declare const prepareConsumerEvidence: typeof resolveConsumerEvidence;
export declare const resolvePortableConsumerEvidence: typeof resolveConsumerEvidence;
