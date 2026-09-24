import * as z from "zod/v4";
import { type PhaseTopologyFingerprint } from "./phase-topology-lock.js";
import { checkedResearchPayload } from "./research-session.js";
import { type PortableProviderEvidenceBasis, type PortableProviderEvidenceNext } from "../codebase-index/provider-evidence.js";
import { type PortableSelection } from "../codebase-index/resolver.js";
export declare const planNumericPhase: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
export declare const planRequestId: z.ZodString;
export declare const planLookup: {
    cwd: z.ZodOptional<z.ZodString>;
    phase: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
};
export declare const checkedPlanPayload: typeof checkedResearchPayload;
export type PlanMode = "add" | "revise" | "replace";
declare const journalSchema: z.ZodObject<{
    requestId: z.ZodString;
    requestHash: z.ZodString;
    revision: z.ZodNumber;
    modelHash: z.ZodString;
    baselineMarkerToken: z.ZodString;
    files: z.ZodArray<z.ZodObject<{
        planId: z.ZodString;
        wave: z.ZodNumber;
        taskCount: z.ZodNumber;
        path: z.ZodString;
        hash: z.ZodString;
        baselineHash: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    removed: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        baselineHash: z.ZodString;
    }, z.core.$strip>>;
    stages: z.ZodRecord<z.ZodEnum<{
        files: "files";
        state: "state";
        routing: "routing";
        commit: "commit";
    }> & z.core.$partial, z.ZodEnum<{
        complete: "complete";
        intent: "intent";
    }>>;
    receipt: z.ZodOptional<z.ZodObject<{
        status: z.ZodLiteral<"published">;
        saved: z.ZodLiteral<true>;
        ready: z.ZodLiteral<true>;
        revision: z.ZodNumber;
        sessionPath: z.ZodString;
        paths: z.ZodArray<z.ZodString>;
        plans: z.ZodArray<z.ZodObject<{
            planId: z.ZodString;
            wave: z.ZodNumber;
            taskCount: z.ZodNumber;
            path: z.ZodString;
        }, z.core.$strip>>;
        removedPaths: z.ZodArray<z.ZodString>;
        stages: z.ZodRecord<z.ZodEnum<{
            files: "files";
            state: "state";
            routing: "routing";
            commit: "commit";
        }> & z.core.$partial, z.ZodEnum<{
            complete: "complete";
            intent: "intent";
        }>>;
        nextAction: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
declare const schema: z.ZodObject<{
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
    needsIntent: z.ZodDefault<z.ZodBoolean>;
    mode: z.ZodEnum<{
        replace: "replace";
        add: "add";
        revise: "revise";
    }>;
    targetPlanIds: z.ZodArray<z.ZodString>;
    readSet: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        hash: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    evidencePaths: z.ZodArray<z.ZodString>;
    targets: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        hash: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    existingPlans: z.ZodArray<z.ZodObject<{
        planId: z.ZodString;
        wave: z.ZodNumber;
        dependsOn: z.ZodArray<z.ZodString>;
        requirements: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    knownRequirements: z.ZodArray<z.ZodString>;
    knownEvidenceArtifacts: z.ZodArray<z.ZodString>;
    checkerRequired: z.ZodBoolean;
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
    requests: z.ZodRecord<z.ZodString, z.ZodObject<{
        hash: z.ZodString;
        modelHash: z.ZodString;
        revision: z.ZodNumber;
        receipt: z.ZodOptional<z.ZodObject<{
            status: z.ZodLiteral<"published">;
            saved: z.ZodLiteral<true>;
            ready: z.ZodLiteral<true>;
            revision: z.ZodNumber;
            sessionPath: z.ZodString;
            paths: z.ZodArray<z.ZodString>;
            plans: z.ZodArray<z.ZodObject<{
                planId: z.ZodString;
                wave: z.ZodNumber;
                taskCount: z.ZodNumber;
                path: z.ZodString;
            }, z.core.$strip>>;
            removedPaths: z.ZodArray<z.ZodString>;
            stages: z.ZodRecord<z.ZodEnum<{
                files: "files";
                state: "state";
                routing: "routing";
                commit: "commit";
            }> & z.core.$partial, z.ZodEnum<{
                complete: "complete";
                intent: "intent";
            }>>;
            nextAction: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    legacyPublication: z.ZodOptional<z.ZodObject<{
        markerToken: z.ZodString;
    }, z.core.$strip>>;
    journal: z.ZodOptional<z.ZodObject<{
        requestId: z.ZodString;
        requestHash: z.ZodString;
        revision: z.ZodNumber;
        modelHash: z.ZodString;
        baselineMarkerToken: z.ZodString;
        files: z.ZodArray<z.ZodObject<{
            planId: z.ZodString;
            wave: z.ZodNumber;
            taskCount: z.ZodNumber;
            path: z.ZodString;
            hash: z.ZodString;
            baselineHash: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>;
        removed: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            baselineHash: z.ZodString;
        }, z.core.$strip>>;
        stages: z.ZodRecord<z.ZodEnum<{
            files: "files";
            state: "state";
            routing: "routing";
            commit: "commit";
        }> & z.core.$partial, z.ZodEnum<{
            complete: "complete";
            intent: "intent";
        }>>;
        receipt: z.ZodOptional<z.ZodObject<{
            status: z.ZodLiteral<"published">;
            saved: z.ZodLiteral<true>;
            ready: z.ZodLiteral<true>;
            revision: z.ZodNumber;
            sessionPath: z.ZodString;
            paths: z.ZodArray<z.ZodString>;
            plans: z.ZodArray<z.ZodObject<{
                planId: z.ZodString;
                wave: z.ZodNumber;
                taskCount: z.ZodNumber;
                path: z.ZodString;
            }, z.core.$strip>>;
            removedPaths: z.ZodArray<z.ZodString>;
            stages: z.ZodRecord<z.ZodEnum<{
                files: "files";
                state: "state";
                routing: "routing";
                commit: "commit";
            }> & z.core.$partial, z.ZodEnum<{
                complete: "complete";
                intent: "intent";
            }>>;
            nextAction: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PlanPortableSession = {
    selections: PortableSelection[];
    basis: PortableProviderEvidenceBasis;
    next: PortableProviderEvidenceNext;
};
export type PlanSession = Omit<z.infer<typeof schema>, "topology" | "portable" | "delivery"> & {
    topology: PhaseTopologyFingerprint;
    portable?: PlanPortableSession;
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
};
export type PlanJournal = z.infer<typeof journalSchema>;
export type PlanLocation = Awaited<ReturnType<typeof planLocation>>;
export declare function planPublicationPath(phaseDir: string, phasePrefix: string): string;
export { readPlanPublicationStatus } from "./plan-publication.js";
export declare function planLocation(args: {
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
export declare function readPlanSession(loc: PlanLocation): Promise<PlanSession | null>;
export declare function savePlanSession(loc: PlanLocation, session: PlanSession, topologyLockHeld?: boolean): Promise<void>;
export declare function withPlanSession<T>(args: {
    cwd?: string;
    phase?: string | number;
}, task: (loc: PlanLocation) => Promise<T>): Promise<T>;
export declare function initialPlanSession(loc: PlanLocation): PlanSession;
