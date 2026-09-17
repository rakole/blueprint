import * as z from "zod/v4";
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
export type ResearchSession = Omit<z.infer<typeof sessionSchema>, "topology"> & {
    topology: import("./phase-topology-lock.js").PhaseTopologyFingerprint;
};
export type ResearchJournal = z.infer<typeof journalSchema>;
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
