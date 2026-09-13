export type ResearchReadSet = Array<{
    path: string;
    hash: string | null;
}>;
export declare const researchDigest: (value: string | Buffer) => string;
export declare const stableResearchValue: (value: unknown) => string;
export declare function canonicalResearchEvidencePath(root: string, relative: string): string;
export declare function readResearchEvidence(root: string, relative: string, maxBytes?: number): Promise<{
    path: string;
    hash: string;
    content: string;
} | {
    path: string;
    hash: null;
    content: null;
}>;
export declare function researchInputHash(root: string, relative: string): Promise<string | null>;
export declare function researchBasisFreshness(root: string, readSet: ResearchReadSet): Promise<{
    status: "unknown" | "stale" | "fresh";
    stalePaths: string[];
    unknownPaths: string[];
}>;
export declare function researchProvenancePath(researchPath: string): string;
export type ResearchProvenance = {
    version: 1;
    researchHash: string;
    readSet: ResearchReadSet;
    publishedAt: string;
    planningReady?: boolean;
};
export declare function readPublishedResearchFreshness(root: string, researchPath: string): Promise<{
    status: "fresh" | "stale" | "unknown";
    stalePaths: string[];
    unknownPaths: string[];
    reason: string | null;
    planningReady?: boolean;
}>;
