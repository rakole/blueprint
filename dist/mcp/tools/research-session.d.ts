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
    content: z.ZodString;
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
    stages: z.ZodRecord<z.ZodEnum<{
        cleanup: "cleanup";
        provenance: "provenance";
        state: "state";
        artifact: "artifact";
        routing: "routing";
    }> & z.core.$partial, z.ZodEnum<{
        complete: "complete";
        intent: "intent";
    }>>;
    receipt: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
declare const sessionSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
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
    candidate: z.ZodOptional<z.ZodUnknown>;
    notes: z.ZodArray<z.ZodString>;
    history: z.ZodArray<z.ZodObject<{
        revision: z.ZodNumber;
        kind: z.ZodString;
        candidate: z.ZodOptional<z.ZodUnknown>;
        journal: z.ZodOptional<z.ZodObject<{
            requestId: z.ZodString;
            requestHash: z.ZodString;
            revision: z.ZodNumber;
            content: z.ZodString;
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
            stages: z.ZodRecord<z.ZodEnum<{
                cleanup: "cleanup";
                provenance: "provenance";
                state: "state";
                artifact: "artifact";
                routing: "routing";
            }> & z.core.$partial, z.ZodEnum<{
                complete: "complete";
                intent: "intent";
            }>>;
            receipt: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    requests: z.ZodRecord<z.ZodString, z.ZodObject<{
        hash: z.ZodString;
        revision: z.ZodNumber;
        operation: z.ZodEnum<{
            record: "record";
            submit: "submit";
        }>;
        receipt: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
    journal: z.ZodOptional<z.ZodObject<{
        requestId: z.ZodString;
        requestHash: z.ZodString;
        revision: z.ZodNumber;
        content: z.ZodString;
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
        stages: z.ZodRecord<z.ZodEnum<{
            cleanup: "cleanup";
            provenance: "provenance";
            state: "state";
            artifact: "artifact";
            routing: "routing";
        }> & z.core.$partial, z.ZodEnum<{
            complete: "complete";
            intent: "intent";
        }>>;
        receipt: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
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
export declare function checkedResearchPayload(value: unknown): unknown;
export declare function readResearchSession(loc: ResearchLocation): Promise<ResearchSession | null>;
export declare function saveResearchSession(loc: ResearchLocation, session: ResearchSession): Promise<void>;
export declare function withResearchSession<T>(args: {
    cwd?: string;
    phase?: string | number;
}, task: (loc: ResearchLocation) => Promise<T>): Promise<T>;
export declare function initialResearchSession(loc: ResearchLocation): ResearchSession;
export {};
