import { type PlanLocation, type PlanSession } from "./plan-session.js";
import { type ResearchReadSet } from "./research-evidence.js";
export declare function planInputHash(root: string, relative: string, phase: string): Promise<string | null>;
export declare function planBasisFreshness(root: string, phase: string, readSet: ResearchReadSet): Promise<{
    status: string;
    stalePaths: string[];
    unknownPaths: string[];
}>;
export declare function capturePlanEvidence(loc: PlanLocation, selectedPaths: string[]): Promise<{
    inputs: ({
        path: string;
        hash: string;
        content: string;
    } | {
        path: string;
        hash: null;
        content: null;
    })[];
    readSet: ResearchReadSet;
    evidencePaths: string[];
}>;
export declare function readPlanTargetHashes(loc: PlanLocation): Promise<{
    path: string;
    hash: string | null;
}[]>;
export declare function planTargetFreshness(loc: PlanLocation, session: PlanSession): Promise<{
    fresh: boolean;
    targets: {
        path: string;
        hash: string | null;
    }[];
}>;
