export type PhaseCheckpointFreshness = {
    status: "fresh" | "stale" | "unknown" | "not-applicable";
    stalePaths: string[];
    unknownPaths: string[];
    warnings: string[];
};
/** Legacy or virtual read-set entries remain readable evidence, never verified inputs. */
export declare function evaluateCheckpointFreshness(projectRoot: string, checkpoint: Record<string, unknown>): Promise<PhaseCheckpointFreshness>;
