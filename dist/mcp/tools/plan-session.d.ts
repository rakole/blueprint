import * as z from "zod/v4";
import { type PhaseTopologyFingerprint } from "./phase-topology-lock.js";
import { checkedResearchPayload } from "./research-session.js";
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
    candidateHash: z.ZodString;
    baselineMarker: z.ZodNullable<z.ZodString>;
    review: z.ZodOptional<z.ZodObject<{
        revision: z.ZodNumber;
        candidateHash: z.ZodString;
        verdict: z.ZodEnum<{
            revise: "revise";
            accept: "accept";
        }>;
        summary: z.ZodString;
    }, z.core.$strip>>;
    files: z.ZodArray<z.ZodObject<{
        planId: z.ZodString;
        title: z.ZodString;
        wave: z.ZodNumber;
        taskCount: z.ZodNumber;
        path: z.ZodString;
        hash: z.ZodString;
        content: z.ZodString;
        baselineHash: z.ZodNullable<z.ZodString>;
        backup: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    removed: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        baselineHash: z.ZodString;
        backup: z.ZodString;
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
    receipt: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
declare const schema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    phase: z.ZodString;
    topology: z.ZodCustom<PhaseTopologyFingerprint, PhaseTopologyFingerprint>;
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
    candidate: z.ZodOptional<z.ZodUnknown>;
    candidateHash: z.ZodNullable<z.ZodString>;
    history: z.ZodArray<z.ZodObject<{
        revision: z.ZodNumber;
        kind: z.ZodString;
        candidate: z.ZodOptional<z.ZodUnknown>;
        readSet: z.ZodOptional<z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            hash: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>>;
        targets: z.ZodOptional<z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            hash: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>>;
        journal: z.ZodOptional<z.ZodObject<{
            requestId: z.ZodString;
            requestHash: z.ZodString;
            revision: z.ZodNumber;
            candidateHash: z.ZodString;
            baselineMarker: z.ZodNullable<z.ZodString>;
            review: z.ZodOptional<z.ZodObject<{
                revision: z.ZodNumber;
                candidateHash: z.ZodString;
                verdict: z.ZodEnum<{
                    revise: "revise";
                    accept: "accept";
                }>;
                summary: z.ZodString;
            }, z.core.$strip>>;
            files: z.ZodArray<z.ZodObject<{
                planId: z.ZodString;
                title: z.ZodString;
                wave: z.ZodNumber;
                taskCount: z.ZodNumber;
                path: z.ZodString;
                hash: z.ZodString;
                content: z.ZodString;
                baselineHash: z.ZodNullable<z.ZodString>;
                backup: z.ZodNullable<z.ZodString>;
            }, z.core.$strip>>;
            removed: z.ZodArray<z.ZodObject<{
                path: z.ZodString;
                baselineHash: z.ZodString;
                backup: z.ZodString;
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
            receipt: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    requests: z.ZodRecord<z.ZodString, z.ZodObject<{
        hash: z.ZodString;
        operation: z.ZodEnum<{
            submit: "submit";
            finalize: "finalize";
        }>;
        revision: z.ZodNumber;
        receipt: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
    journal: z.ZodOptional<z.ZodObject<{
        requestId: z.ZodString;
        requestHash: z.ZodString;
        revision: z.ZodNumber;
        candidateHash: z.ZodString;
        baselineMarker: z.ZodNullable<z.ZodString>;
        review: z.ZodOptional<z.ZodObject<{
            revision: z.ZodNumber;
            candidateHash: z.ZodString;
            verdict: z.ZodEnum<{
                revise: "revise";
                accept: "accept";
            }>;
            summary: z.ZodString;
        }, z.core.$strip>>;
        files: z.ZodArray<z.ZodObject<{
            planId: z.ZodString;
            title: z.ZodString;
            wave: z.ZodNumber;
            taskCount: z.ZodNumber;
            path: z.ZodString;
            hash: z.ZodString;
            content: z.ZodString;
            baselineHash: z.ZodNullable<z.ZodString>;
            backup: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>;
        removed: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            baselineHash: z.ZodString;
            backup: z.ZodString;
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
        receipt: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PlanSession = z.infer<typeof schema>;
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
