import * as z from "zod/v4";
import { type PortableImmutablePin, type PortablePinHandoff, type PortablePinReceipt, type PortablePinnedMemberHash, type PortableSelection, type ResolveCodebaseNavigationOptions } from "./resolver.js";
import { type ConsumerEvidenceBaseline, type ConsumerReadSetEntry } from "./consumer-evidence.js";
import { type EvidenceDeliveryFailure, type EvidenceDeliveryLimits, type EvidenceDeliverySuccess, type EvidenceIdentity, type EvidencePacket, type PriorEvidenceDelivery, type ReadTimeEvidence } from "../evidence-delivery.js";
declare const PROVIDER_SCHEMA_VERSION: 1;
export declare const portableProviderRootIdentitySchema: z.ZodObject<{
    path: z.ZodString;
    realPath: z.ZodString;
    device: z.ZodNumber;
    inode: z.ZodNumber;
    ancestors: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        device: z.ZodNumber;
        inode: z.ZodNumber;
    }, z.core.$strict>>;
}, z.core.$strict>;
/** Canonical metadata-only receipt projection accepted in provider sessions. */
export declare const portableProviderReceiptSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    root: z.ZodObject<{
        path: z.ZodString;
        realPath: z.ZodString;
        device: z.ZodNumber;
        inode: z.ZodNumber;
        ancestors: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            device: z.ZodNumber;
            inode: z.ZodNumber;
        }, z.core.$strict>>;
    }, z.core.$strict>;
    pin: z.ZodObject<{
        generationId: z.ZodString;
        entry: z.ZodObject<{
            path: z.ZodString;
            sha256: z.ZodString;
        }, z.core.$strict>;
        manifest: z.ZodObject<{
            path: z.ZodString;
            sha256: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>;
    issuedAt: z.ZodString;
    authentication: z.ZodString;
}, z.core.$strict>;
/** The nested delivery control avoids colliding with a lifecycle's own mode. */
export declare const portableProviderEvidenceModeSchema: z.ZodEnum<{
    full: "full";
    delta: "delta";
    register: "register";
}>;
export type PortableProviderEvidenceMode = z.infer<typeof portableProviderEvidenceModeSchema>;
export declare const portableProviderEvidenceIdentitySchema: z.ZodObject<{
    path: z.ZodUnion<readonly [z.ZodString, z.ZodString]>;
    generation: z.ZodString;
    hash: z.ZodString;
}, z.core.$strict>;
/**
 * Metadata that can safely cross a session boundary.  It contains hashes and
 * paths only; source and generated-page bodies are intentionally absent.
 */
export type PortableProviderEvidencePrior = PriorEvidenceDelivery & {
    readonly registered?: readonly EvidenceIdentity[];
};
export type PortableProviderEvidenceDelivery = {
    readonly mode: PortableProviderEvidenceMode;
    readonly prior?: PortableProviderEvidencePrior;
    readonly readTimeEvidence?: readonly ReadTimeEvidence[];
    readonly limits?: EvidenceDeliveryLimits;
    readonly baseline?: ConsumerEvidenceBaseline;
};
export declare const portableProviderEvidenceDeliverySchema: z.ZodObject<{
    mode: z.ZodEnum<{
        full: "full";
        delta: "delta";
        register: "register";
    }>;
    prior: z.ZodOptional<z.ZodObject<{
        binding: z.ZodObject<{
            pinnedGeneration: z.ZodString;
            identities: z.ZodArray<z.ZodObject<{
                path: z.ZodUnion<readonly [z.ZodString, z.ZodString]>;
                generation: z.ZodString;
                hash: z.ZodString;
            }, z.core.$strict>>;
            hash: z.ZodString;
        }, z.core.$strict>;
        delivered: z.ZodArray<z.ZodObject<{
            path: z.ZodUnion<readonly [z.ZodString, z.ZodString]>;
            generation: z.ZodString;
            hash: z.ZodString;
        }, z.core.$strict>>;
        registered: z.ZodOptional<z.ZodArray<z.ZodObject<{
            path: z.ZodUnion<readonly [z.ZodString, z.ZodString]>;
            generation: z.ZodString;
            hash: z.ZodString;
        }, z.core.$strict>>>;
    }, z.core.$strict>>;
    readTimeEvidence: z.ZodOptional<z.ZodArray<z.ZodObject<{
        path: z.ZodUnion<readonly [z.ZodString, z.ZodString]>;
        bytes: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodCustom<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>]>>;
        hash: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>>;
    limits: z.ZodOptional<z.ZodObject<{
        maxSourceCount: z.ZodOptional<z.ZodNumber>;
        maxReadSetCount: z.ZodOptional<z.ZodNumber>;
        maxPacketBytes: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
    baseline: z.ZodOptional<z.ZodObject<{
        selectedCount: z.ZodOptional<z.ZodNumber>;
        readSetCount: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type PortableProviderPinContext = {
    readonly pin: PortableImmutablePin;
    readonly receipt?: PortablePinReceipt;
};
export declare const portableProviderPinSchema: z.ZodObject<{
    generationId: z.ZodString;
    entry: z.ZodObject<{
        path: z.ZodString;
        sha256: z.ZodString;
    }, z.core.$strict>;
    manifest: z.ZodObject<{
        path: z.ZodString;
        sha256: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>;
export declare const portableProviderPinContextSchema: z.ZodObject<{
    pin: z.ZodObject<{
        generationId: z.ZodString;
        entry: z.ZodObject<{
            path: z.ZodString;
            sha256: z.ZodString;
        }, z.core.$strict>;
        manifest: z.ZodObject<{
            path: z.ZodString;
            sha256: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>;
    receipt: z.ZodOptional<z.ZodObject<{
        version: z.ZodLiteral<1>;
        root: z.ZodObject<{
            path: z.ZodString;
            realPath: z.ZodString;
            device: z.ZodNumber;
            inode: z.ZodNumber;
            ancestors: z.ZodArray<z.ZodObject<{
                path: z.ZodString;
                device: z.ZodNumber;
                inode: z.ZodNumber;
            }, z.core.$strict>>;
        }, z.core.$strict>;
        pin: z.ZodObject<{
            generationId: z.ZodString;
            entry: z.ZodObject<{
                path: z.ZodString;
                sha256: z.ZodString;
            }, z.core.$strict>;
            manifest: z.ZodObject<{
                path: z.ZodString;
                sha256: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>;
        issuedAt: z.ZodString;
        authentication: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const portableProviderReadSetEntrySchema: z.ZodObject<{
    path: z.ZodUnion<readonly [z.ZodString, z.ZodString]>;
    generation: z.ZodString;
    hash: z.ZodString;
    kind: z.ZodEnum<{
        source: "source";
        page: "page";
    }>;
    fullFileHash: z.ZodOptional<z.ZodString>;
    rangeHash: z.ZodOptional<z.ZodString>;
    coordinate: z.ZodOptional<z.ZodObject<{
        start: z.ZodObject<{
            line: z.ZodNumber;
            column: z.ZodNumber;
            byte: z.ZodNumber;
        }, z.core.$strict>;
        end: z.ZodObject<{
            line: z.ZodNumber;
            column: z.ZodNumber;
            byte: z.ZodNumber;
        }, z.core.$strict>;
    }, z.core.$strict>>;
    deliveryPath: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodString]>>;
}, z.core.$strict>;
/** A common metadata-only pin/read-set shape for research-to-plan handoffs. */
export type PortableProviderPinnedMemberSet = {
    readonly pin?: PortableImmutablePin;
    readonly receipt?: PortablePinReceipt;
    /** Request-local owner capability; never persist this field. */
    readonly handoff?: PortablePinHandoff;
    readonly members: readonly string[];
};
export type PortableProviderEvidenceInput = {
    readonly root: string;
    /** Existing one-selection bridge spelling, retained for callers adopting this helper incrementally. */
    readonly selection?: PortableSelection;
    /** Multiple selections are merged into one exact closure. */
    readonly selections?: readonly PortableSelection[];
    readonly evidenceDelivery?: PortableProviderEvidenceDelivery;
    /** Backward-compatible shorthand; new providers should use evidenceDelivery. */
    readonly mode?: PortableProviderEvidenceMode;
    readonly prior?: PortableProviderEvidencePrior;
    readonly readTimeEvidence?: readonly ReadTimeEvidence[];
    readonly limits?: EvidenceDeliveryLimits;
    readonly baseline?: ConsumerEvidenceBaseline;
    readonly generationId?: string;
    readonly pinReceipt?: PortablePinReceipt;
    /** Request-local owner capability; never persist this field. */
    readonly pinHandoff?: PortablePinHandoff;
    readonly resolverOptions?: ResolveCodebaseNavigationOptions;
    /** Additional pinned bases used by a provider's freshness/read-set loop. */
    readonly pinnedMemberSets?: readonly PortableProviderPinnedMemberSet[];
};
export type PortableProviderEvidenceContext = {
    readonly generationId: string;
    readonly entry: EvidenceIdentity;
    readonly pin: PortableImmutablePin;
    readonly trustedPins: readonly PortableProviderPinContext[];
};
export declare const portableProviderEvidenceContextSchema: z.ZodObject<{
    generationId: z.ZodString;
    entry: z.ZodObject<{
        path: z.ZodUnion<readonly [z.ZodString, z.ZodString]>;
        generation: z.ZodString;
        hash: z.ZodString;
    }, z.core.$strict>;
    pin: z.ZodObject<{
        generationId: z.ZodString;
        entry: z.ZodObject<{
            path: z.ZodString;
            sha256: z.ZodString;
        }, z.core.$strict>;
        manifest: z.ZodObject<{
            path: z.ZodString;
            sha256: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>;
    trustedPins: z.ZodArray<z.ZodObject<{
        pin: z.ZodObject<{
            generationId: z.ZodString;
            entry: z.ZodObject<{
                path: z.ZodString;
                sha256: z.ZodString;
            }, z.core.$strict>;
            manifest: z.ZodObject<{
                path: z.ZodString;
                sha256: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>;
        receipt: z.ZodOptional<z.ZodObject<{
            version: z.ZodLiteral<1>;
            root: z.ZodObject<{
                path: z.ZodString;
                realPath: z.ZodString;
                device: z.ZodNumber;
                inode: z.ZodNumber;
                ancestors: z.ZodArray<z.ZodObject<{
                    path: z.ZodString;
                    device: z.ZodNumber;
                    inode: z.ZodNumber;
                }, z.core.$strict>>;
            }, z.core.$strict>;
            pin: z.ZodObject<{
                generationId: z.ZodString;
                entry: z.ZodObject<{
                    path: z.ZodString;
                    sha256: z.ZodString;
                }, z.core.$strict>;
                manifest: z.ZodObject<{
                    path: z.ZodString;
                    sha256: z.ZodString;
                }, z.core.$strict>;
            }, z.core.$strict>;
            issuedAt: z.ZodString;
            authentication: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type PortableProviderEvidenceReadSet = {
    readonly sourceAndPage: readonly ConsumerReadSetEntry[];
    readonly sealedMembers: readonly PortablePinnedMemberHash[];
};
export type PortableProviderEvidenceNext = {
    readonly schemaVersion: typeof PROVIDER_SCHEMA_VERSION;
    /** Every identity bound to the accepted evidence basis. */
    readonly bound: readonly EvidenceIdentity[];
    readonly bindingHash: string;
    /** Bodies actually present in this response or a prior delivered response. */
    readonly delivered: readonly EvidenceIdentity[];
    /** Current identities omitted only because an actual read-time hash was verified. */
    readonly registered: readonly EvidenceIdentity[];
    readonly readSet: PortableProviderEvidenceReadSet;
};
export type PortableProviderEvidenceBasis = {
    readonly schemaVersion: typeof PROVIDER_SCHEMA_VERSION;
    readonly generationId: string;
    readonly pin: PortableImmutablePin;
    readonly entry: EvidenceIdentity;
    readonly bound: readonly EvidenceIdentity[];
    readonly bindingHash: string;
    readonly readSet: PortableProviderEvidenceReadSet;
    readonly trustedPins: readonly PortableProviderPinContext[];
    readonly pinReceipt?: PortablePinReceipt;
};
export declare const portableProviderEvidenceNextSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    bound: z.ZodArray<z.ZodObject<{
        path: z.ZodUnion<readonly [z.ZodString, z.ZodString]>;
        generation: z.ZodString;
        hash: z.ZodString;
    }, z.core.$strict>>;
    bindingHash: z.ZodString;
    delivered: z.ZodArray<z.ZodObject<{
        path: z.ZodUnion<readonly [z.ZodString, z.ZodString]>;
        generation: z.ZodString;
        hash: z.ZodString;
    }, z.core.$strict>>;
    registered: z.ZodArray<z.ZodObject<{
        path: z.ZodUnion<readonly [z.ZodString, z.ZodString]>;
        generation: z.ZodString;
        hash: z.ZodString;
    }, z.core.$strict>>;
    readSet: z.ZodObject<{
        sourceAndPage: z.ZodArray<z.ZodObject<{
            path: z.ZodUnion<readonly [z.ZodString, z.ZodString]>;
            generation: z.ZodString;
            hash: z.ZodString;
            kind: z.ZodEnum<{
                source: "source";
                page: "page";
            }>;
            fullFileHash: z.ZodOptional<z.ZodString>;
            rangeHash: z.ZodOptional<z.ZodString>;
            coordinate: z.ZodOptional<z.ZodObject<{
                start: z.ZodObject<{
                    line: z.ZodNumber;
                    column: z.ZodNumber;
                    byte: z.ZodNumber;
                }, z.core.$strict>;
                end: z.ZodObject<{
                    line: z.ZodNumber;
                    column: z.ZodNumber;
                    byte: z.ZodNumber;
                }, z.core.$strict>;
            }, z.core.$strict>>;
            deliveryPath: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodString]>>;
        }, z.core.$strict>>;
        sealedMembers: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            sha256: z.ZodString;
            generationId: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>;
}, z.core.$strict>;
export declare const portableProviderEvidenceBasisSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    generationId: z.ZodString;
    pin: z.ZodObject<{
        generationId: z.ZodString;
        entry: z.ZodObject<{
            path: z.ZodString;
            sha256: z.ZodString;
        }, z.core.$strict>;
        manifest: z.ZodObject<{
            path: z.ZodString;
            sha256: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>;
    entry: z.ZodObject<{
        path: z.ZodUnion<readonly [z.ZodString, z.ZodString]>;
        generation: z.ZodString;
        hash: z.ZodString;
    }, z.core.$strict>;
    bound: z.ZodArray<z.ZodObject<{
        path: z.ZodUnion<readonly [z.ZodString, z.ZodString]>;
        generation: z.ZodString;
        hash: z.ZodString;
    }, z.core.$strict>>;
    bindingHash: z.ZodString;
    readSet: z.ZodObject<{
        sourceAndPage: z.ZodArray<z.ZodObject<{
            path: z.ZodUnion<readonly [z.ZodString, z.ZodString]>;
            generation: z.ZodString;
            hash: z.ZodString;
            kind: z.ZodEnum<{
                source: "source";
                page: "page";
            }>;
            fullFileHash: z.ZodOptional<z.ZodString>;
            rangeHash: z.ZodOptional<z.ZodString>;
            coordinate: z.ZodOptional<z.ZodObject<{
                start: z.ZodObject<{
                    line: z.ZodNumber;
                    column: z.ZodNumber;
                    byte: z.ZodNumber;
                }, z.core.$strict>;
                end: z.ZodObject<{
                    line: z.ZodNumber;
                    column: z.ZodNumber;
                    byte: z.ZodNumber;
                }, z.core.$strict>;
            }, z.core.$strict>>;
            deliveryPath: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodString]>>;
        }, z.core.$strict>>;
        sealedMembers: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            sha256: z.ZodString;
            generationId: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>;
    trustedPins: z.ZodArray<z.ZodObject<{
        pin: z.ZodObject<{
            generationId: z.ZodString;
            entry: z.ZodObject<{
                path: z.ZodString;
                sha256: z.ZodString;
            }, z.core.$strict>;
            manifest: z.ZodObject<{
                path: z.ZodString;
                sha256: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>;
        receipt: z.ZodOptional<z.ZodObject<{
            version: z.ZodLiteral<1>;
            root: z.ZodObject<{
                path: z.ZodString;
                realPath: z.ZodString;
                device: z.ZodNumber;
                inode: z.ZodNumber;
                ancestors: z.ZodArray<z.ZodObject<{
                    path: z.ZodString;
                    device: z.ZodNumber;
                    inode: z.ZodNumber;
                }, z.core.$strict>>;
            }, z.core.$strict>;
            pin: z.ZodObject<{
                generationId: z.ZodString;
                entry: z.ZodObject<{
                    path: z.ZodString;
                    sha256: z.ZodString;
                }, z.core.$strict>;
                manifest: z.ZodObject<{
                    path: z.ZodString;
                    sha256: z.ZodString;
                }, z.core.$strict>;
            }, z.core.$strict>;
            issuedAt: z.ZodString;
            authentication: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    pinReceipt: z.ZodOptional<z.ZodObject<{
        version: z.ZodLiteral<1>;
        root: z.ZodObject<{
            path: z.ZodString;
            realPath: z.ZodString;
            device: z.ZodNumber;
            inode: z.ZodNumber;
            ancestors: z.ZodArray<z.ZodObject<{
                path: z.ZodString;
                device: z.ZodNumber;
                inode: z.ZodNumber;
            }, z.core.$strict>>;
        }, z.core.$strict>;
        pin: z.ZodObject<{
            generationId: z.ZodString;
            entry: z.ZodObject<{
                path: z.ZodString;
                sha256: z.ZodString;
            }, z.core.$strict>;
            manifest: z.ZodObject<{
                path: z.ZodString;
                sha256: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>;
        issuedAt: z.ZodString;
        authentication: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const portableProviderEvidenceInputSchema: z.ZodObject<{
    root: z.ZodString;
    selection: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
        kind: z.ZodLiteral<"page">;
        path: z.ZodString;
        mode: z.ZodLiteral<"discovery">;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodEnum<{
            symbol: "symbol";
            file: "file";
            import: "import";
            relationship: "relationship";
            detail: "detail";
        }>;
        recordId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodEnum<{
            alias: "alias";
            capability: "capability";
            claim: "claim";
        }>;
        recordId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"structural">;
        recordKind: z.ZodEnum<{
            symbol: "symbol";
            file: "file";
            import: "import";
            relationship: "relationship";
            detail: "detail";
        }>;
        recordId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"semantic">;
        recordKind: z.ZodEnum<{
            alias: "alias";
            capability: "capability";
            claim: "claim";
        }>;
        recordId: z.ZodString;
    }, z.core.$strict>]>>;
    selections: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
        kind: z.ZodLiteral<"page">;
        path: z.ZodString;
        mode: z.ZodLiteral<"discovery">;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodEnum<{
            symbol: "symbol";
            file: "file";
            import: "import";
            relationship: "relationship";
            detail: "detail";
        }>;
        recordId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodEnum<{
            alias: "alias";
            capability: "capability";
            claim: "claim";
        }>;
        recordId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"structural">;
        recordKind: z.ZodEnum<{
            symbol: "symbol";
            file: "file";
            import: "import";
            relationship: "relationship";
            detail: "detail";
        }>;
        recordId: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"semantic">;
        recordKind: z.ZodEnum<{
            alias: "alias";
            capability: "capability";
            claim: "claim";
        }>;
        recordId: z.ZodString;
    }, z.core.$strict>]>>>;
    evidenceDelivery: z.ZodOptional<z.ZodObject<{
        mode: z.ZodEnum<{
            full: "full";
            delta: "delta";
            register: "register";
        }>;
        prior: z.ZodOptional<z.ZodObject<{
            binding: z.ZodObject<{
                pinnedGeneration: z.ZodString;
                identities: z.ZodArray<z.ZodObject<{
                    path: z.ZodUnion<readonly [z.ZodString, z.ZodString]>;
                    generation: z.ZodString;
                    hash: z.ZodString;
                }, z.core.$strict>>;
                hash: z.ZodString;
            }, z.core.$strict>;
            delivered: z.ZodArray<z.ZodObject<{
                path: z.ZodUnion<readonly [z.ZodString, z.ZodString]>;
                generation: z.ZodString;
                hash: z.ZodString;
            }, z.core.$strict>>;
            registered: z.ZodOptional<z.ZodArray<z.ZodObject<{
                path: z.ZodUnion<readonly [z.ZodString, z.ZodString]>;
                generation: z.ZodString;
                hash: z.ZodString;
            }, z.core.$strict>>>;
        }, z.core.$strict>>;
        readTimeEvidence: z.ZodOptional<z.ZodArray<z.ZodObject<{
            path: z.ZodUnion<readonly [z.ZodString, z.ZodString]>;
            bytes: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodCustom<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>]>>;
            hash: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>>;
        limits: z.ZodOptional<z.ZodObject<{
            maxSourceCount: z.ZodOptional<z.ZodNumber>;
            maxReadSetCount: z.ZodOptional<z.ZodNumber>;
            maxPacketBytes: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>>;
        baseline: z.ZodOptional<z.ZodObject<{
            selectedCount: z.ZodOptional<z.ZodNumber>;
            readSetCount: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    mode: z.ZodOptional<z.ZodEnum<{
        full: "full";
        delta: "delta";
        register: "register";
    }>>;
    prior: z.ZodOptional<z.ZodUnknown>;
    readTimeEvidence: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
    limits: z.ZodOptional<z.ZodObject<{
        maxSourceCount: z.ZodOptional<z.ZodNumber>;
        maxReadSetCount: z.ZodOptional<z.ZodNumber>;
        maxPacketBytes: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
    baseline: z.ZodOptional<z.ZodUnknown>;
    generationId: z.ZodOptional<z.ZodString>;
    pinReceipt: z.ZodOptional<z.ZodUnknown>;
    pinHandoff: z.ZodOptional<z.ZodUnknown>;
    resolverOptions: z.ZodOptional<z.ZodUnknown>;
    pinnedMemberSets: z.ZodOptional<z.ZodArray<z.ZodUnknown>>;
}, z.core.$strict>;
export type PortableProviderEvidenceSuccess = {
    readonly status: "ok";
    readonly schemaVersion: typeof PROVIDER_SCHEMA_VERSION;
    readonly mode: PortableProviderEvidenceMode;
    readonly context: PortableProviderEvidenceContext;
    /** Metadata-only accepted basis suitable for a provider session journal. */
    readonly basis: PortableProviderEvidenceBasis;
    /** ENTRY is included exactly once here when its body is delivered. */
    readonly packet: EvidencePacket;
    readonly binding: EvidenceDeliverySuccess["binding"];
    readonly counts: EvidenceDeliverySuccess["counts"];
    readonly next: PortableProviderEvidenceNext;
    /** Metadata only; present when a trusted receipt was supplied or prepared. */
    readonly pinReceipt?: PortablePinReceipt;
};
export type PortableProviderEvidenceFailure = {
    readonly status: "fallback" | "invalid" | "not-found" | "reread_required" | "evidence_limit";
    readonly code: string;
    readonly reason: string;
    readonly paths: readonly string[];
    readonly diagnostics?: readonly unknown[];
    readonly counts?: EvidenceDeliverySuccess["counts"];
    readonly scopeReduction?: EvidenceDeliveryFailure["scopeReduction"];
};
export type PortableProviderEvidenceResult = PortableProviderEvidenceSuccess | PortableProviderEvidenceFailure;
export type PortableProviderPinnedMemberSetsResult = {
    readonly status: "ok";
    readonly members: readonly PortablePinnedMemberHash[];
    readonly pins: readonly PortableProviderPinContext[];
} | PortableProviderEvidenceFailure;
/**
 * Authenticate and hash one or more pinned generation member sets.  This is
 * the common metadata-only freshness primitive for providers that carry a
 * research basis from one generation while preparing against another.
 */
export declare function hashPortableProviderMemberSets(root: string, sets: readonly PortableProviderPinnedMemberSet[], options?: ResolveCodebaseNavigationOptions): Promise<PortableProviderPinnedMemberSetsResult>;
/** Resolve compact ENTRY context plus optional selected portable evidence. */
export declare function resolvePortableProviderEvidence(input: PortableProviderEvidenceInput): Promise<PortableProviderEvidenceResult>;
/** Owning prepare wrapper.  Navigation/resolution never provisions a receipt. */
export declare function preparePortableProviderEvidence(input: PortableProviderEvidenceInput): Promise<PortableProviderEvidenceResult>;
/** Compact aliases for provider owners that call this operation a context read. */
export declare const resolvePortableProviderContext: typeof resolvePortableProviderEvidence;
export declare const preparePortableProviderContext: typeof preparePortableProviderEvidence;
export {};
