import * as z from "zod/v4";
import { portableTargetHashesSchema, type PortableModelPacket } from "./contracts.js";
import { type PortableExtractionSuccess } from "./extraction.js";
import { type PortablePublicationPreflight } from "./publication.js";
/** Operational state intentionally lives beside, but outside, the portable bundle. */
export declare const PORTABLE_OPERATIONS_ROOT = ".blueprint/codebase-operations";
export declare const PORTABLE_OPERATION_METADATA_FILE = "metadata.json";
export declare const PORTABLE_OPERATION_MARKER_FILE = "operation.json";
export declare const PORTABLE_OPERATION_STRUCTURAL_FILE = "structural.json";
export declare const PORTABLE_OPERATION_AUTHORITY_FILE = "authority.json";
export declare const PORTABLE_OPERATION_PROVENANCE_FILE = "provenance.json";
export declare const PORTABLE_OPERATION_PACKETS_FILE = "packets.json";
export declare const PORTABLE_OPERATION_INACTIVITY_MS: number;
/** Reserve deterministic server-owned room for the complete public receipt envelope. */
export declare const PORTABLE_OPERATION_RECEIPT_ENVELOPE_RESERVE_BYTES: number;
export declare const PORTABLE_OPERATION_PACKET_BUDGET_BYTES: number;
/** Public map receipts carry a source-owned authoring contract on the first page. */
export declare const PORTABLE_OPERATION_PUBLIC_PACKET_BUDGET_BYTES: number;
export declare const PORTABLE_OPERATION_ACCEPTED_FILE = "accepted.json";
export declare const PORTABLE_OPERATION_COMMITTED_FILE = "committed.json";
/** Fixture-only seam for exercising the post-bind filesystem recheck. */
export declare const portableOperationTestHooks: {
    beforeAtomicWrite?: (relativePath: string) => Promise<void> | void;
    afterTempWrite?: (relativePath: string) => Promise<void> | void;
};
declare const metadataSchema: z.ZodObject<{
    version: z.ZodLiteral<2>;
    operationId: z.ZodString;
    stage: z.ZodLiteral<"prepared">;
    generationId: z.ZodString;
    transactionId: z.ZodString;
    previousGenerationId: z.ZodNullable<z.ZodString>;
    previousIndexHash: z.ZodNullable<z.ZodString>;
    rootFingerprint: z.ZodString;
    observedMarkerHash: z.ZodNullable<z.ZodString>;
    packetBudgetBytes: z.ZodNumber;
    repair: z.ZodUnion<readonly [z.ZodLiteral<false>, z.ZodObject<{
        authorized: z.ZodLiteral<true>;
        previousIndexHash: z.ZodNullable<z.ZodString>;
        targetHashes: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodNullable<z.ZodString>>, z.core.$strict>;
        observedMarkerHash: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>]>;
    sourceBasis: z.ZodObject<{
        rootHash: z.ZodString;
        inventoryHash: z.ZodString;
        evidenceHash: z.ZodString;
    }, z.core.$strict>;
    targetHashes: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodNullable<z.ZodString>>, z.core.$strict>;
    createdAt: z.ZodString;
    lastActivityAt: z.ZodString;
    expiresAt: z.ZodString;
    revision: z.ZodNumber;
    renderGeneratedAt: z.ZodString;
    predecessorProof: z.ZodNullable<z.ZodObject<{
        generationId: z.ZodString;
        manifest: z.ZodObject<{
            path: z.ZodString;
            checksum: z.ZodString;
        }, z.core.$strict>;
        entry: z.ZodObject<{
            path: z.ZodString;
            checksum: z.ZodString;
        }, z.core.$strict>;
        committedIndexHash: z.ZodString;
    }, z.core.$strict>>;
    rootIdentity: z.ZodObject<{
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
    inventoryFingerprint: z.ZodString;
    coverage: z.ZodObject<{
        candidateCount: z.ZodNumber;
        includedCount: z.ZodNumber;
        excludedCount: z.ZodNumber;
        exclusions: z.ZodArray<z.ZodObject<{
            reason: z.ZodString;
            count: z.ZodNumber;
        }, z.core.$strict>>;
        structural: z.ZodObject<{
            filesInventoried: z.ZodNumber;
            filesWithFullCoverage: z.ZodNumber;
            filesWithFileCoverage: z.ZodNumber;
            symbolsExtracted: z.ZodNumber;
            importsExtracted: z.ZodNumber;
            relationshipsExtracted: z.ZodNumber;
        }, z.core.$strict>;
    }, z.core.$strict>;
    provenanceHash: z.ZodString;
    publication: z.ZodObject<{
        repositoryRoot: z.ZodString;
        operationId: z.ZodString;
        transactionId: z.ZodString;
        generationId: z.ZodString;
        sourceBasis: z.ZodObject<{
            rootHash: z.ZodString;
            inventoryHash: z.ZodString;
            evidenceHash: z.ZodString;
        }, z.core.$strict>;
        rootFingerprint: z.ZodString;
        previousGenerationId: z.ZodNullable<z.ZodString>;
        previousIndexHash: z.ZodNullable<z.ZodString>;
        previousTargetHashes: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodNullable<z.ZodString>>, z.core.$strict>;
        observedMarkerHash: z.ZodNullable<z.ZodString>;
        legacyBackup: z.ZodBoolean;
        repair: z.ZodUnion<readonly [z.ZodLiteral<false>, z.ZodObject<{
            authorized: z.ZodLiteral<true>;
            previousIndexHash: z.ZodNullable<z.ZodString>;
            targetHashes: z.ZodObject<Record<"stack" | "architecture" | "structure" | "conventions" | "testing" | "integrations" | "concerns", z.ZodNullable<z.ZodString>>, z.core.$strict>;
            observedMarkerHash: z.ZodNullable<z.ZodString>;
        }, z.core.$strict>]>;
    }, z.core.$strict>;
    files: z.ZodObject<{
        structural: z.ZodObject<{
            path: z.ZodEnum<{
                "structural.json": "structural.json";
                "authority.json": "authority.json";
                "provenance.json": "provenance.json";
                "packets.json": "packets.json";
            }>;
            checksum: z.ZodString;
            byteSize: z.ZodNumber;
        }, z.core.$strict>;
        authority: z.ZodObject<{
            path: z.ZodEnum<{
                "structural.json": "structural.json";
                "authority.json": "authority.json";
                "provenance.json": "provenance.json";
                "packets.json": "packets.json";
            }>;
            checksum: z.ZodString;
            byteSize: z.ZodNumber;
        }, z.core.$strict>;
        provenance: z.ZodObject<{
            path: z.ZodEnum<{
                "structural.json": "structural.json";
                "authority.json": "authority.json";
                "provenance.json": "provenance.json";
                "packets.json": "packets.json";
            }>;
            checksum: z.ZodString;
            byteSize: z.ZodNumber;
        }, z.core.$strict>;
        packets: z.ZodObject<{
            path: z.ZodEnum<{
                "structural.json": "structural.json";
                "authority.json": "authority.json";
                "provenance.json": "provenance.json";
                "packets.json": "packets.json";
            }>;
            checksum: z.ZodString;
            byteSize: z.ZodNumber;
        }, z.core.$strict>;
    }, z.core.$strict>;
    cursor: z.ZodObject<{
        basisHash: z.ZodString;
        secret: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>;
export type PortablePreparedOperationMetadata = z.infer<typeof metadataSchema>;
declare const acceptedSubmissionSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    operationId: z.ZodString;
    generationId: z.ZodString;
    modelHash: z.ZodString;
    rootIndexHash: z.ZodString;
    acceptedAt: z.ZodString;
}, z.core.$strict>;
export type PortableAcceptedSubmission = z.infer<typeof acceptedSubmissionSchema>;
declare const committedSubmissionSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    operationId: z.ZodString;
    generationId: z.ZodString;
    modelHash: z.ZodString;
    rootIndexHash: z.ZodString;
    manifestHash: z.ZodString;
    entryHash: z.ZodString;
    committedAt: z.ZodString;
}, z.core.$strict>;
export type PortableCommittedSubmission = z.infer<typeof committedSubmissionSchema>;
export type PortableOperationDiagnosticCode = "invalid-input" | "not-found" | "unsafe-root" | "invalid-state" | "integrity-failure" | "stale-root" | "stale-source" | "stale-target" | "stale-provenance" | "expired" | "invalid-cursor" | "packet-too-large" | "publication-conflict" | "unknown-marker";
export type PortableOperationDiagnostic = {
    readonly code: PortableOperationDiagnosticCode;
    readonly message: string;
};
type OperationFailure = {
    readonly ok: false;
    readonly status: "invalid" | "not-found" | "unsafe" | "invalid-state" | "stale" | "expired" | "conflict";
    readonly diagnostics: readonly PortableOperationDiagnostic[];
    readonly operationId?: string;
    readonly generationId?: string;
};
export type PortableOperationReceipt = {
    readonly ok: boolean;
    readonly status: "ready" | "stale" | "expired" | "invalid" | "not-found" | "unsafe" | "conflict";
    readonly operationId: string;
    readonly generationId: string;
    readonly packet?: PortableModelPacket;
    readonly packetBytes?: number;
    readonly continuation: {
        readonly cursor: string | null;
        readonly hasMore: boolean;
    } | null;
    readonly diagnostics: readonly PortableOperationDiagnostic[];
};
export type PortableOperationLoad = {
    readonly ok: true;
    readonly metadata: PortablePreparedOperationMetadata;
    readonly extraction: PortableExtractionSuccess;
    readonly packets: readonly PortableModelPacket[];
};
export type PortableOperationRevalidation = ({
    readonly ok: true;
    readonly status: "fresh";
    readonly metadata: PortablePreparedOperationMetadata;
    readonly extraction: PortableExtractionSuccess;
}) | OperationFailure;
export type PortablePrepareOperationResult = ({
    readonly ok: true;
    readonly status: "ready";
    readonly operationId: string;
    readonly generationId: string;
    readonly metadata: PortablePreparedOperationMetadata;
    readonly receipt: PortableOperationReceipt;
}) | OperationFailure;
export type PortableOperationRepairInput = {
    readonly authorized: true;
    readonly previousIndexHash: string | null;
    readonly targetHashes: z.infer<typeof portableTargetHashesSchema>;
    readonly observedMarkerHash: string | null;
};
type RepositoryInput = {
    readonly repositoryRoot?: string;
    readonly root?: string;
};
type NowInput = {
    readonly now?: Date | string;
};
/** Reconstitute the exact prepared publication CAS; never recapture it from current files. */
export declare function portableOperationPublicationPreflight(metadata: PortablePreparedOperationMetadata): PortablePublicationPreflight;
export declare function preparePortableOperation(input?: RepositoryInput & NowInput & {
    readonly repair?: PortableOperationRepairInput;
    /** Internal callers may reserve more room for their public response envelope. */
    readonly packetBudgetBytes?: number;
}): Promise<PortablePrepareOperationResult>;
export declare const preparePortableMapOperation: typeof preparePortableOperation;
export declare const prepareCodebaseOperation: typeof preparePortableOperation;
/**
 * Retain only the identity of an accepted model.  The model itself remains
 * transient and is never written to operation state, which lets a retry tell
 * an exact committed submission from a changed submission without retaining
 * rejected content.
 */
export declare function readPortableOperationAcceptance(input: RepositoryInput & {
    readonly operationId: string;
}): Promise<PortableAcceptedSubmission | null>;
export declare function recordPortableOperationAcceptance(input: RepositoryInput & {
    readonly operationId: string;
    readonly generationId: string;
    readonly modelHash: string;
    readonly rootIndexHash: string;
    readonly acceptedAt?: Date | string;
}): Promise<boolean>;
type PortableOperationCommitInput = RepositoryInput & {
    readonly operationId: string;
    readonly generationId: string;
    readonly modelHash: string;
    readonly rootIndexHash: string;
    readonly manifestHash: string;
    readonly entryHash: string;
    readonly committedAt?: Date | string;
};
export declare function recordPortableOperationCommit(input: PortableOperationCommitInput): Promise<boolean>;
/**
 * Publication already owns the repository lock when it reaches INDEX commit.
 * Persisting this immutable receipt through the operation lock here would
 * invert the revalidation lock order (operation -> publication), so this
 * narrow atomic helper is reserved for the publication callback. The write is
 * still anchored, CAS-checked against accepted identity, and idempotent.
 */
export declare function recordPortableOperationCommitUnderPublicationLock(input: PortableOperationCommitInput): Promise<boolean>;
/** Determine both historical commit truth and whether that generation is active. */
export declare function portableOperationCommitState(input: RepositoryInput & {
    readonly operationId: string;
}): Promise<{
    readonly accepted: PortableAcceptedSubmission | null;
    readonly receipt: PortableCommittedSubmission | null;
    /** A durable receipt proves the operation reached the commit point historically. */
    readonly historicallyCommitted: boolean;
    /** Fresh manifest, ENTRY, page, compatibility, and INDEX checks for this retry. */
    readonly generationValid: boolean;
    readonly committed: boolean;
    readonly current: boolean;
}>;
export declare function loadPortableOperation(input: RepositoryInput & {
    readonly operationId: string;
}): Promise<PortableOperationLoad | OperationFailure>;
export declare function readPortableOperationMetadata(input: RepositoryInput & {
    readonly operationId: string;
    readonly now?: Date | string;
}): Promise<OperationFailure | {
    ok: true;
    status: "ready" | "expired";
    metadata: {
        version: 2;
        operationId: string;
        stage: "prepared";
        generationId: string;
        transactionId: string;
        previousGenerationId: string | null;
        previousIndexHash: string | null;
        rootFingerprint: string;
        observedMarkerHash: string | null;
        packetBudgetBytes: number;
        repair: false | {
            authorized: true;
            previousIndexHash: string | null;
            targetHashes: {
                stack: string | null;
                architecture: string | null;
                structure: string | null;
                conventions: string | null;
                testing: string | null;
                integrations: string | null;
                concerns: string | null;
            };
            observedMarkerHash: string | null;
        };
        sourceBasis: {
            rootHash: string;
            inventoryHash: string;
            evidenceHash: string;
        };
        targetHashes: {
            stack: string | null;
            architecture: string | null;
            structure: string | null;
            conventions: string | null;
            testing: string | null;
            integrations: string | null;
            concerns: string | null;
        };
        createdAt: string;
        lastActivityAt: string;
        expiresAt: string;
        revision: number;
        renderGeneratedAt: string;
        predecessorProof: {
            generationId: string;
            manifest: {
                path: string;
                checksum: string;
            };
            entry: {
                path: string;
                checksum: string;
            };
            committedIndexHash: string;
        } | null;
        rootIdentity: {
            path: string;
            realPath: string;
            device: number;
            inode: number;
            ancestors: {
                path: string;
                device: number;
                inode: number;
            }[];
        };
        inventoryFingerprint: string;
        coverage: {
            candidateCount: number;
            includedCount: number;
            excludedCount: number;
            exclusions: {
                reason: string;
                count: number;
            }[];
            structural: {
                filesInventoried: number;
                filesWithFullCoverage: number;
                filesWithFileCoverage: number;
                symbolsExtracted: number;
                importsExtracted: number;
                relationshipsExtracted: number;
            };
        };
        provenanceHash: string;
        publication: {
            repositoryRoot: string;
            operationId: string;
            transactionId: string;
            generationId: string;
            sourceBasis: {
                rootHash: string;
                inventoryHash: string;
                evidenceHash: string;
            };
            rootFingerprint: string;
            previousGenerationId: string | null;
            previousIndexHash: string | null;
            previousTargetHashes: {
                stack: string | null;
                architecture: string | null;
                structure: string | null;
                conventions: string | null;
                testing: string | null;
                integrations: string | null;
                concerns: string | null;
            };
            observedMarkerHash: string | null;
            legacyBackup: boolean;
            repair: false | {
                authorized: true;
                previousIndexHash: string | null;
                targetHashes: {
                    stack: string | null;
                    architecture: string | null;
                    structure: string | null;
                    conventions: string | null;
                    testing: string | null;
                    integrations: string | null;
                    concerns: string | null;
                };
                observedMarkerHash: string | null;
            };
        };
        files: {
            structural: {
                path: "structural.json" | "authority.json" | "provenance.json" | "packets.json";
                checksum: string;
                byteSize: number;
            };
            authority: {
                path: "structural.json" | "authority.json" | "provenance.json" | "packets.json";
                checksum: string;
                byteSize: number;
            };
            provenance: {
                path: "structural.json" | "authority.json" | "provenance.json" | "packets.json";
                checksum: string;
                byteSize: number;
            };
            packets: {
                path: "structural.json" | "authority.json" | "provenance.json" | "packets.json";
                checksum: string;
                byteSize: number;
            };
        };
        cursor: {
            basisHash: string;
            secret: string;
        };
    };
    expired: boolean;
    diagnostics: readonly [];
}>;
export declare function readPortableOperationExtraction(input: RepositoryInput & {
    readonly operationId: string;
}): Promise<OperationFailure | {
    ok: true;
    status: "available";
    metadata: {
        version: 2;
        operationId: string;
        stage: "prepared";
        generationId: string;
        transactionId: string;
        previousGenerationId: string | null;
        previousIndexHash: string | null;
        rootFingerprint: string;
        observedMarkerHash: string | null;
        packetBudgetBytes: number;
        repair: false | {
            authorized: true;
            previousIndexHash: string | null;
            targetHashes: {
                stack: string | null;
                architecture: string | null;
                structure: string | null;
                conventions: string | null;
                testing: string | null;
                integrations: string | null;
                concerns: string | null;
            };
            observedMarkerHash: string | null;
        };
        sourceBasis: {
            rootHash: string;
            inventoryHash: string;
            evidenceHash: string;
        };
        targetHashes: {
            stack: string | null;
            architecture: string | null;
            structure: string | null;
            conventions: string | null;
            testing: string | null;
            integrations: string | null;
            concerns: string | null;
        };
        createdAt: string;
        lastActivityAt: string;
        expiresAt: string;
        revision: number;
        renderGeneratedAt: string;
        predecessorProof: {
            generationId: string;
            manifest: {
                path: string;
                checksum: string;
            };
            entry: {
                path: string;
                checksum: string;
            };
            committedIndexHash: string;
        } | null;
        rootIdentity: {
            path: string;
            realPath: string;
            device: number;
            inode: number;
            ancestors: {
                path: string;
                device: number;
                inode: number;
            }[];
        };
        inventoryFingerprint: string;
        coverage: {
            candidateCount: number;
            includedCount: number;
            excludedCount: number;
            exclusions: {
                reason: string;
                count: number;
            }[];
            structural: {
                filesInventoried: number;
                filesWithFullCoverage: number;
                filesWithFileCoverage: number;
                symbolsExtracted: number;
                importsExtracted: number;
                relationshipsExtracted: number;
            };
        };
        provenanceHash: string;
        publication: {
            repositoryRoot: string;
            operationId: string;
            transactionId: string;
            generationId: string;
            sourceBasis: {
                rootHash: string;
                inventoryHash: string;
                evidenceHash: string;
            };
            rootFingerprint: string;
            previousGenerationId: string | null;
            previousIndexHash: string | null;
            previousTargetHashes: {
                stack: string | null;
                architecture: string | null;
                structure: string | null;
                conventions: string | null;
                testing: string | null;
                integrations: string | null;
                concerns: string | null;
            };
            observedMarkerHash: string | null;
            legacyBackup: boolean;
            repair: false | {
                authorized: true;
                previousIndexHash: string | null;
                targetHashes: {
                    stack: string | null;
                    architecture: string | null;
                    structure: string | null;
                    conventions: string | null;
                    testing: string | null;
                    integrations: string | null;
                    concerns: string | null;
                };
                observedMarkerHash: string | null;
            };
        };
        files: {
            structural: {
                path: "structural.json" | "authority.json" | "provenance.json" | "packets.json";
                checksum: string;
                byteSize: number;
            };
            authority: {
                path: "structural.json" | "authority.json" | "provenance.json" | "packets.json";
                checksum: string;
                byteSize: number;
            };
            provenance: {
                path: "structural.json" | "authority.json" | "provenance.json" | "packets.json";
                checksum: string;
                byteSize: number;
            };
            packets: {
                path: "structural.json" | "authority.json" | "provenance.json" | "packets.json";
                checksum: string;
                byteSize: number;
            };
        };
        cursor: {
            basisHash: string;
            secret: string;
        };
    };
    extraction: PortableExtractionSuccess;
    diagnostics: readonly [];
}>;
export declare function revalidatePortableOperation(input: RepositoryInput & {
    readonly operationId: string;
    readonly now?: Date | string;
}): Promise<PortableOperationRevalidation>;
export declare function readPortableOperationReceipt(input: RepositoryInput & {
    readonly operationId: string;
    readonly cursor?: string;
    readonly now?: Date | string;
}): Promise<PortableOperationReceipt | OperationFailure>;
export declare const continuePortableOperation: typeof readPortableOperationReceipt;
export declare const readPortableOperation: typeof readPortableOperationReceipt;
export declare const readPortableMapOperation: typeof readPortableOperationReceipt;
export {};
