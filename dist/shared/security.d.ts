export type PromptBoundaryFindingType = "prompt-injection" | "prompt-context" | "unsafe-display" | "encoded-payload" | "control-character";
export type PromptBoundaryFindingSeverity = "warning" | "error";
export type PromptBoundaryFinding = {
    type: PromptBoundaryFindingType;
    severity: PromptBoundaryFindingSeverity;
    message: string;
};
export type PromptBoundaryAnalysis = {
    sanitizedText: string;
    findings: PromptBoundaryFinding[];
    warnings: string[];
    errors: string[];
    hasWarnings: boolean;
    hasErrors: boolean;
};
type JsonParseOptions = {
    label?: string;
    maxBytes?: number;
};
type PersistencePreparationOptions = {
    label?: string;
};
type ResolvePathOptions = {
    label?: string;
};
export declare function assertNoNullBytes(value: string, label?: string): void;
export declare function ensurePathWithinRootSync(rootPath: string, candidatePath: string, options?: ResolvePathOptions): string;
export declare function isPathWithinRootSync(rootPath: string, candidatePath: string): boolean;
export declare function resolveRepoRelativeInputPathSync(rootPath: string, candidatePath: string, options?: ResolvePathOptions): string;
export declare function safeJsonParse<T = unknown>(raw: string, options?: JsonParseOptions): T;
export declare function safeJsonParseObject<T extends Record<string, unknown> = Record<string, unknown>>(raw: string, options?: JsonParseOptions): T;
export declare function validateFieldNameSegment(segment: string, label?: string): string;
export declare function normalizeBlueprintPhaseRef(value: string, label?: string): string;
export declare function formatBlueprintPhasePrefix(value: string): string;
export declare function normalizeNumericArtifactId(value: string, label?: string): string;
export declare function sanitizeForDisplay(value: string): string;
export declare function analyzePromptBoundaryText(text: string): PromptBoundaryAnalysis;
export declare function prepareTextForPersistence(text: string, options?: PersistencePreparationOptions): {
    content: string;
    warnings: string[];
};
export declare function hasSuspiciousPromptBoundarySignals(text: string): boolean;
export {};
