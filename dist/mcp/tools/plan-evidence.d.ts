import { type PlanLocation, type PlanSession } from "./plan-session.js";
import { type ResearchReadSet } from "./research-evidence.js";
import { type PortableProviderEvidenceBasis } from "../codebase-index/provider-evidence.js";
export declare function planInputHash(root: string, relative: string, phase: string): Promise<string | null>;
export declare function planBasisFreshness(root: string, phase: string, readSet: ResearchReadSet, portableBases?: readonly PortableProviderEvidenceBasis[]): Promise<{
    status: string;
    stalePaths: string[];
    unknownPaths: string[];
}>;
export type CapturePlanEvidenceOptions = {
    skipCodebaseArtifacts?: boolean;
};
export declare function capturePlanEvidence(loc: PlanLocation, selectedPaths: string[], options?: CapturePlanEvidenceOptions): Promise<{
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
export type PlanOrdinaryDeliveryArgs = {
    readonly mode?: "full" | "delta" | "register";
    readonly readTimeEvidence?: readonly {
        path: string;
        hash?: string;
        bytes?: string;
    }[];
};
type PlanOrdinaryEvidenceInput = {
    readonly path: string;
    readonly hash: string | null;
    readonly content: string | null;
};
export declare function shapePlanOrdinaryEvidence(inputs: readonly PlanOrdinaryEvidenceInput[], args: PlanOrdinaryDeliveryArgs | undefined, delivery: PlanSession["delivery"]): {
    status: "reread_required";
    paths: string[];
    evidence?: undefined;
    delivery?: undefined;
} | {
    status: "ok";
    evidence: (PlanOrdinaryEvidenceInput | {
        path: string;
        hash: string;
    })[];
    delivery: {
        delivered: {
            path: string;
            hash: string;
        }[];
        registered: {
            path: string;
            hash: string;
        }[];
    };
    paths?: undefined;
};
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
export {};
