import * as z from "zod/v4";
import { type BlueprintRuntimeHost } from "../runtime-host.js";
declare const UPDATE_STAGE_ORDER: readonly ["Resolve", "Read", "Decide", "Execute", "Persist", "Validate", "Route"];
declare const UPDATE_PLAN_MODES: readonly ["ask_user", "manual"];
type UpdateStage = (typeof UPDATE_STAGE_ORDER)[number];
type UpdatePlanMode = (typeof UPDATE_PLAN_MODES)[number];
type InstallProvenanceKind = "github-remote" | "git-remote" | "local-path" | "extension-path-only" | "unknown";
type LatestVersionLookupStatus = "available" | "manual_only" | "lookup_failed" | "not_installed";
type UpdateCheckArgs = {
    cwd?: string;
};
type UpdatePlanArgs = {
    cwd?: string;
    mode?: UpdatePlanMode;
};
type InstallProvenance = {
    kind: InstallProvenanceKind;
    source: string | null;
    branch: string | null;
    head: string | null;
};
type UpdateChecklistStep = {
    stage: UpdateStage;
    title: string;
    detail: string;
};
type UpdateCheckResult = {
    host: BlueprintRuntimeHost["host"];
    extensionPath: string | null;
    extensionManifestPath: string | null;
    installedVersion: string | null;
    installProvenance: InstallProvenance;
    latestVersionLookupStatus: LatestVersionLookupStatus;
    latestVersion: string | null;
    latestVersionSource: string | null;
    updateAvailable: boolean | null;
    warnings: string[];
};
type UpdatePlanResult = UpdateCheckResult & {
    mode: UpdatePlanMode;
    steps: UpdateChecklistStep[];
    notes: string[];
    requiresRestart: boolean;
    savedPaths: {
        updatesDir: string;
        metadataPath: string;
        checklistPath: string;
    };
    path: string;
    status: "created" | "updated";
};
export declare function blueprintUpdateCheck(args?: UpdateCheckArgs, env?: NodeJS.ProcessEnv): Promise<UpdateCheckResult>;
export declare function blueprintUpdatePlan(args?: UpdatePlanArgs, env?: NodeJS.ProcessEnv): Promise<UpdatePlanResult>;
export declare const updateToolDefinitions: readonly [{
    readonly name: "blueprint_update_check";
    readonly description: "Inspect the installed Blueprint extension, install provenance, latest-version lookup status, and update availability without mutating the install.";
    readonly inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
    };
    readonly handler: (args: Record<string, unknown>) => Promise<UpdateCheckResult>;
}, {
    readonly name: "blueprint_update_plan";
    readonly description: "Build and persist an advisory Blueprint update checklist under the host-global updates directory without writing into the installed extension.";
    readonly inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        mode: z.ZodOptional<z.ZodEnum<{
            ask_user: "ask_user";
            manual: "manual";
        }>>;
    };
    readonly handler: (args: Record<string, unknown>) => Promise<UpdatePlanResult>;
}];
export {};
