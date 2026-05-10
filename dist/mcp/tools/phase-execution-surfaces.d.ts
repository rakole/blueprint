export type ExecutionSurfaceKind = "files_modified" | "read_first" | "generated_artifact" | "other";
export type PhaseExecutionTargetConflictSurface = {
    value: string;
    kinds: ExecutionSurfaceKind[];
};
type PhaseExecutionSurfacePlan = {
    filesModified: string[];
    readFirst: string[];
};
export declare function normalizeExecutionSurfacePath(value: string): string;
export declare function uniqueSortedStrings(values: string[]): string[];
export declare function sharedExecutionSurfaces(left: PhaseExecutionSurfacePlan, right: PhaseExecutionSurfacePlan): PhaseExecutionTargetConflictSurface[];
export {};
