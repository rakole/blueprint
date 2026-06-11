export type LightweightMode = "fast" | "quick";
export type LightweightRoute = "fast" | "quick" | "debug" | "plan-phase" | "execute-phase" | "health" | "new-project" | "clarify";
export type ValidationBudget = "none" | "cheap" | "ask" | "route";
export type ScopeConfidence = "high" | "medium" | "low";
export type ScopeClassification = {
    route: LightweightRoute;
    confidence: ScopeConfidence;
    reasons: string[];
    allowedWrites: string[];
    requiredGates: string[];
    validationBudget: ValidationBudget;
};
export type LightweightClassifierFlags = {
    discuss?: boolean;
    research?: boolean;
    validate?: boolean;
    full?: boolean;
};
export type ClassifyLightweightScopeArgs = {
    mode: LightweightMode;
    taskText: string;
    flags?: LightweightClassifierFlags;
};
export declare function classifyLightweightScope({ mode, taskText, flags, }: ClassifyLightweightScopeArgs): ScopeClassification;
