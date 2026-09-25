import * as z from "zod/v4";
import { type PortableProviderEvidenceBasis, type PortableProviderEvidenceNext } from "../codebase-index/provider-evidence.js";
import { type PortableSelection } from "../codebase-index/resolver.js";
export declare const researchNumericPhase: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
export declare const researchLookup: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
};
export declare const researchRequestId: z.ZodString;
declare const journalSchema: z.ZodObject<{
    requestId: z.ZodString;
    requestHash: z.ZodString;
    revision: z.ZodNumber;
    modelHash: z.ZodOptional<z.ZodString>;
    researchedAt: z.ZodString;
    contentHash: z.ZodString;
    baselineHash: z.ZodNullable<z.ZodString>;
    provenance: z.ZodString;
    provenanceHash: z.ZodString;
    baselineProvenanceHash: z.ZodNullable<z.ZodString>;
    readSet: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        hash: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    reuse: z.ZodBoolean;
    planningReady: z.ZodBoolean;
    stages: z.ZodRecord<z.ZodEnum<{
        artifact: "artifact";
        provenance: "provenance";
        cleanup: "cleanup";
        state: "state";
        routing: "routing";
    }> & z.core.$partial, z.ZodEnum<{
        complete: "complete";
        intent: "intent";
    }>>;
    portable: z.ZodOptional<z.ZodObject<{
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
    }, z.core.$strict>>;
    receipt: z.ZodOptional<z.ZodObject<{
        status: z.ZodEnum<{
            reused: "reused";
            published: "published";
        }>;
        saved: z.ZodLiteral<true>;
        ready: z.ZodBoolean;
        planningReady: z.ZodBoolean;
        revision: z.ZodNumber;
        path: z.ZodString;
        sessionPath: z.ZodString;
        provenancePath: z.ZodString;
        contentHash: z.ZodString;
        provenanceHash: z.ZodString;
        nextAction: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
declare const sessionSchema: z.ZodObject<{
    version: z.ZodLiteral<2>;
    phase: z.ZodString;
    topology: z.ZodObject<{
        phaseNumber: z.ZodString;
        phasePrefix: z.ZodString;
        phaseName: z.ZodNullable<z.ZodString>;
        phaseDir: z.ZodString;
        roadmapEntry: z.ZodNullable<z.ZodObject<{
            phaseNumber: z.ZodString;
            phasePrefix: z.ZodString;
            phaseName: z.ZodString;
            completed: z.ZodBoolean;
            summary: z.ZodNullable<z.ZodString>;
            goal: z.ZodNullable<z.ZodString>;
            successCriteria: z.ZodNullable<z.ZodString>;
            requirements: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    revision: z.ZodNumber;
    prepared: z.ZodBoolean;
    readSet: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        hash: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    evidencePaths: z.ZodArray<z.ZodString>;
    baselineHash: z.ZodNullable<z.ZodString>;
    baselineProvenanceHash: z.ZodNullable<z.ZodString>;
    grounding: z.ZodObject<{
        requirements: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            description: z.ZodString;
        }, z.core.$strip>>;
        lockedDecisions: z.ZodArray<z.ZodString>;
        userConstraints: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    requests: z.ZodRecord<z.ZodString, z.ZodObject<{
        hash: z.ZodString;
        modelHash: z.ZodOptional<z.ZodString>;
        revision: z.ZodNumber;
        receipt: z.ZodOptional<z.ZodObject<{
            status: z.ZodEnum<{
                reused: "reused";
                published: "published";
            }>;
            saved: z.ZodLiteral<true>;
            ready: z.ZodBoolean;
            planningReady: z.ZodBoolean;
            revision: z.ZodNumber;
            path: z.ZodString;
            sessionPath: z.ZodString;
            provenancePath: z.ZodString;
            contentHash: z.ZodString;
            provenanceHash: z.ZodString;
            nextAction: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    portable: z.ZodOptional<z.ZodObject<{
        selections: z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
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
        basis: z.ZodObject<{
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
        next: z.ZodObject<{
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
    }, z.core.$strict>>;
    delivery: z.ZodOptional<z.ZodObject<{
        delivered: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            hash: z.ZodString;
        }, z.core.$strict>>;
        registered: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            hash: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    legacyPublication: z.ZodOptional<z.ZodObject<{
        contentHash: z.ZodString;
    }, z.core.$strip>>;
    journal: z.ZodOptional<z.ZodObject<{
        requestId: z.ZodString;
        requestHash: z.ZodString;
        revision: z.ZodNumber;
        modelHash: z.ZodOptional<z.ZodString>;
        researchedAt: z.ZodString;
        contentHash: z.ZodString;
        baselineHash: z.ZodNullable<z.ZodString>;
        provenance: z.ZodString;
        provenanceHash: z.ZodString;
        baselineProvenanceHash: z.ZodNullable<z.ZodString>;
        readSet: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            hash: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>;
        reuse: z.ZodBoolean;
        planningReady: z.ZodBoolean;
        stages: z.ZodRecord<z.ZodEnum<{
            artifact: "artifact";
            provenance: "provenance";
            cleanup: "cleanup";
            state: "state";
            routing: "routing";
        }> & z.core.$partial, z.ZodEnum<{
            complete: "complete";
            intent: "intent";
        }>>;
        portable: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strict>>;
        receipt: z.ZodOptional<z.ZodObject<{
            status: z.ZodEnum<{
                reused: "reused";
                published: "published";
            }>;
            saved: z.ZodLiteral<true>;
            ready: z.ZodBoolean;
            planningReady: z.ZodBoolean;
            revision: z.ZodNumber;
            path: z.ZodString;
            sessionPath: z.ZodString;
            provenancePath: z.ZodString;
            contentHash: z.ZodString;
            provenanceHash: z.ZodString;
            nextAction: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ResearchPortableSession = {
    selections: PortableSelection[];
    basis: PortableProviderEvidenceBasis;
    next: PortableProviderEvidenceNext;
};
export type ResearchSession = Omit<z.infer<typeof sessionSchema>, "topology" | "portable" | "delivery" | "journal"> & {
    topology: import("./phase-topology-lock.js").PhaseTopologyFingerprint;
    portable?: ResearchPortableSession;
    delivery?: {
        delivered: Array<{
            path: string;
            hash: string;
        }>;
        registered: Array<{
            path: string;
            hash: string;
        }>;
    };
    journal?: ResearchJournal;
};
export type ResearchJournal = Omit<z.infer<typeof journalSchema>, "portable"> & {
    portable?: PortableProviderEvidenceBasis;
};
export type ResearchLocation = Awaited<ReturnType<typeof researchLocation>>;
export declare function researchLocation(args: {
    cwd?: string;
    phase?: string | number;
}): Promise<{
    sessionPath: string;
    projectRoot: string;
    resolved: import("./phase-tool-types.js").ResolvedPhaseLocation;
    located: import("./phase-tool-types.js").PhaseLocateResult;
    artifacts: string[];
    matchedPhase: import("./phase-roadmap-parser.js").ParsedRoadmapPhase | null;
}>;
/** Input safety only; this function never stores model content. */
export declare function checkedResearchPayload(value: unknown): unknown;
export declare function readResearchSession(loc: ResearchLocation): Promise<ResearchSession | null>;
export declare function saveResearchSession(loc: ResearchLocation, session: ResearchSession): Promise<void>;
export declare function withResearchSession<T>(args: {
    cwd?: string;
    phase?: string | number;
}, task: (loc: ResearchLocation) => Promise<T>): Promise<T>;
export declare function initialResearchSession(loc: ResearchLocation): ResearchSession;
export {};
