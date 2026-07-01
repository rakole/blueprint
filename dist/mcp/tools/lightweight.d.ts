import * as z from "zod/v4";
import { type LightweightMode, type ScopeClassification } from "../lightweight-classifier.js";
import { blueprintProjectStatus } from "./project.js";
type LightweightPreflightArgs = {
    cwd?: string;
    mode: LightweightMode;
    taskText: string;
    flags?: string[];
};
type LightweightPreflightRoute = ScopeClassification["route"] | "map-codebase" | "progress";
type LightweightPreflightClassification = Omit<ScopeClassification, "route"> & {
    route: LightweightPreflightRoute;
};
type LightweightPreflightProjectStatus = {
    initialized: boolean;
    health: "healthy" | "unhealthy" | Exclude<Awaited<ReturnType<typeof blueprintProjectStatus>>["status"], "initialized">;
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
    classification: LightweightPreflightClassification;
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
        healthGate: "pass" | "route-health" | "route-new-project" | "route-map-codebase" | "route-progress";
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
