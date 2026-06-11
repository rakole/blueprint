import * as z from "zod/v4";
import { type LightweightMode, type ScopeClassification } from "../lightweight-classifier.js";
type LightweightPreflightArgs = {
    cwd?: string;
    mode: LightweightMode;
    taskText: string;
    flags?: string[];
};
type LightweightPreflightProjectStatus = {
    initialized: boolean;
    health: "healthy" | "partial" | "uninitialized" | "unhealthy";
    currentPhase?: string | null;
    currentMilestone?: string | null;
    nextAction?: string | null;
};
type LightweightPreflightEffectiveConfig = {
    workflow?: {
        subagents?: boolean;
        no_uat?: boolean;
        quick?: unknown;
    };
    provenance?: unknown;
    warnings?: string[];
};
type LightweightPreflightResult = {
    mode: LightweightMode;
    classification: ScopeClassification;
    projectStatus: LightweightPreflightProjectStatus;
    effectiveConfig?: LightweightPreflightEffectiveConfig;
    implementedRoutes: string[];
    quickReport?: {
        name: "quick-run-latest";
        exists: boolean;
        path?: string;
        updatedAt?: string;
    };
    gates: {
        healthGate: "pass" | "route-health" | "route-new-project";
        overwriteGate?: "none" | "requires-confirmation" | "force-bypassed";
        clarityGate: "pass" | "requires-clarification";
    };
    nextSafeAction: string;
    warnings: string[];
};
export declare function blueprintLightweightPreflight(args: LightweightPreflightArgs): Promise<LightweightPreflightResult>;
export declare const lightweightToolDefinitions: readonly [{
    readonly name: "blueprint_lightweight_preflight";
    readonly description: "Read-only deterministic preflight for /blu-fast and /blu-quick scope, health, routing, config, and overwrite gates.";
    readonly inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        mode: z.ZodEnum<{
            quick: "quick";
            fast: "fast";
        }>;
        taskText: z.ZodString;
        flags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    };
    readonly handler: (args: Record<string, unknown>) => Promise<LightweightPreflightResult>;
}];
export {};
