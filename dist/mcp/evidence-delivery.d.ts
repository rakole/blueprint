/**
 * Evidence bytes are supplied by a lifecycle owner that has already selected
 * canonical paths. This helper does not read files, resolve virtual paths, or
 * persist a session.
 */
export type EvidenceBytes = string | Uint8Array;
export type EvidenceMode = "full" | "delta" | "register";
export type EvidenceKind = "source" | "page" | "virtual";
export interface EvidenceIdentity {
    path: string;
    hash: string;
    generation: string;
}
export interface CanonicalEvidence {
    /** A repository-relative canonical path or a caller-owned virtual identity. */
    path: string;
    /** The immutable generation that owns this evidence identity. */
    generation: string;
    /** Fresh current bytes are required for every selected identity. */
    bytes?: EvidenceBytes;
    /** Optional asserted hash; it is always checked against supplied bytes. */
    hash?: string;
    /** Exact selected immediate dependencies, expressed by canonical path. */
    dependencies?: readonly string[];
    kind?: EvidenceKind;
}
export interface ReadTimeEvidence {
    /** Ordinary-file read captured by the lifecycle owner at read time. */
    path: string;
    /** Optional bytes from that read. The selected record still must supply current bytes. */
    bytes?: EvidenceBytes;
    /** A hash-only read-time assertion is allowed when the owner retains no old body. */
    hash?: string;
}
export interface PriorEvidenceBinding {
    pinnedGeneration: string;
    identities: readonly EvidenceIdentity[];
    /** SHA-256 of the canonical sorted identities. */
    hash: string;
}
export interface PriorEvidenceDelivery {
    binding: PriorEvidenceBinding;
    /** Hashes actually delivered in the prior session, usually a subset. */
    delivered: readonly EvidenceIdentity[];
}
export interface EvidenceDeliveryLimits {
    /** Counted over the complete selected transitive closure, before mode shaping. */
    maxSourceCount?: number;
    /** Counted over the complete selected transitive closure, before mode shaping. */
    maxReadSetCount?: number;
    /** UTF-8 bytes of the exact JSON packet returned by this helper. */
    maxPacketBytes?: number;
}
export interface EvidenceDeliveryInput {
    /** Opaque immutable generation selected by the lifecycle owner. */
    pinnedGeneration: string;
    mode: EvidenceMode;
    /** Root records from which the exact transitive dependency closure is built. */
    roots: readonly string[];
    /** Complete selected closure. Extra or missing records are rejected. */
    evidence: readonly CanonicalEvidence[];
    /** Moving discovery metadata such as root INDEX. It never enters the binding. */
    discovery?: readonly CanonicalEvidence[];
    prior?: PriorEvidenceDelivery;
    readTimeEvidence?: readonly ReadTimeEvidence[];
    limits?: EvidenceDeliveryLimits;
}
export interface DeliveredEvidence {
    path: string;
    generation: string;
    hash: string;
    dependencies: string[];
    /** UTF-8 body is present only when this mode requires fresh delivery. */
    content?: string;
}
export interface EvidencePacket {
    version: 1;
    mode: EvidenceMode;
    pinnedGeneration: string;
    roots: string[];
    entries: DeliveredEvidence[];
}
export interface EvidenceDeliveryCounts {
    /** All selected records, including pages and virtual records. */
    selectedCount: number;
    /** Alias for selectedCount retained for source/read-set limit reporting. */
    sourceCount: number;
    readSetCount: number;
    dependencyCount: number;
    bodyCount: number;
    bodyBytes: number;
    packetBytes: number;
}
export interface EvidenceLimit {
    limit: "maxSourceCount" | "maxReadSetCount" | "maxPacketBytes";
    actual: number;
    maximum: number;
    scope: "full-selected-transitive-closure" | "serialized-packet";
}
export interface EvidenceDeliverySuccess {
    status: "ok";
    mode: EvidenceMode;
    pinnedGeneration: string;
    packet: EvidencePacket;
    binding: PriorEvidenceBinding;
    counts: EvidenceDeliveryCounts;
    omittedPaths: string[];
    /** Validated discovery identities are reported separately from the basis. */
    discovery: EvidenceIdentity[];
}
export type EvidenceFailureCode = "invalid_input" | "invalid_path" | "invalid_hash" | "hash_mismatch" | "conflicting_identity" | "generation_mismatch" | "missing_dependency" | "unselected_record" | "invalid_prior_binding" | "reread_required";
export interface EvidenceDeliveryFailure {
    status: "invalid" | "evidence_limit" | "reread_required";
    code?: EvidenceFailureCode;
    reason: string;
    /** Metadata only: bodies and serialized evidence packets are never returned. */
    paths: string[];
    limits?: EvidenceLimit[];
    counts?: EvidenceDeliveryCounts;
    scopeReduction?: {
        selectedCount: number;
        suggestedMaxCount?: number;
        omittedBodyCount: number;
        omittedPathCount?: number;
    };
}
export type EvidenceDeliveryResult = EvidenceDeliverySuccess | EvidenceDeliveryFailure;
/** Stable binding hash used by lifecycle sessions without importing a tool module. */
export declare function evidenceBindingHash(identities: readonly EvidenceIdentity[]): string;
/**
 * Select and bound evidence for a lifecycle owner.
 *
 * Caller preconditions: repository paths, virtual identities, publication
 * freshness, revision/topology, and overwrite policy have already been
 * resolved by the owning lifecycle. This function receives bytes only as
 * transient input; it never reads, writes, persists, or mutates lifecycle
 * state. Every selected identity is derived from fresh current bytes. A hash
 * without current bytes is never treated as a fresh read; read-time evidence
 * only verifies those current bytes and can authorize register omission.
 */
export declare function selectEvidenceDelivery(input: EvidenceDeliveryInput): EvidenceDeliveryResult;
/** Exact UTF-8 size used by the packet cap. */
export declare function serializeEvidencePacket(packet: EvidencePacket): string;
