import * as z from "zod/v4";
import { type BootstrapArtifactDiagnostics, type BootstrapAssessment, type BootstrapSeed } from "./artifacts.js";
type CommandStatus = "planned" | "implemented" | "blocked" | "repairing";
type CommandCatalogEntry = {
    command: string;
    route: string;
    wave: number;
    family: string;
    risk: string;
    primarySkill: string;
    declaredStatus: CommandStatus;
    status: CommandStatus;
    implemented: boolean;
    blockedBy: string[];
    manifestPath: string | null;
    skillPath: string | null;
    specPath: string | null;
    requiredTools: string[];
    requiredToolsSatisfied: boolean;
    optionalAgents: string[];
    availableOptionalAgents: string[];
};
type CommandCatalogResult = {
    commands: Record<string, CommandCatalogEntry>;
    waves: Record<string, string[]>;
    aliases: Record<string, string[]>;
};
type ProjectInitArgs = {
    cwd?: string;
    defaultsPath?: string;
    overwrite?: boolean;
    projectName?: string;
    bootstrapMode?: "interactive" | "auto";
    bootstrapSeed?: BootstrapSeed;
};
type ProjectInitResult = {
    projectRoot: string;
    createdPaths: string[];
    seededState: {
        updatedFields: string[];
        statePath: string;
    };
    configPath: string;
    configProvenance: {
        layersApplied: string[];
        defaultsPath: string | null;
        projectPath: string | null;
        defaultsApplied: boolean;
        projectApplied: boolean;
    };
    brownfield: BootstrapAssessment;
    bootstrapDiagnostics: BootstrapArtifactDiagnostics;
    nextAction: string;
    warnings: string[];
};
type ProjectStatusArgs = {
    cwd?: string;
};
type ProjectStatusResult = {
    status: "uninitialized" | "mapping-incomplete" | "mapped-only" | "partial" | "initialized";
    initialized: boolean;
    currentPhase: string | null;
    currentMilestone: string | null;
    nextAction: string;
    bootstrap: {
        repoShape: BootstrapAssessment["repoShape"];
        brownfieldDetected: boolean;
        codebaseMapped: boolean;
        placeholderArtifacts: string[];
        traceabilityWarnings: string[];
        recommendedNextAction: string;
    };
    health: {
        missingArtifacts: string[];
        warnings: string[];
    };
};
export declare function blueprintRuntimeOwnedCommandCatalog(): Promise<CommandCatalogResult>;
export declare function blueprintCommandCatalog(): Promise<CommandCatalogResult>;
export declare function blueprintProjectInit(args?: ProjectInitArgs): Promise<ProjectInitResult>;
export declare function blueprintProjectStatus(args?: ProjectStatusArgs): Promise<ProjectStatusResult>;
export declare const projectToolDefinitions: ({
    name: string;
    description: string;
    inputSchema: {};
    handler: () => Promise<CommandCatalogResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        defaultsPath: z.ZodOptional<z.ZodString>;
        overwrite: z.ZodOptional<z.ZodBoolean>;
        projectName: z.ZodOptional<z.ZodString>;
        bootstrapMode: z.ZodOptional<z.ZodEnum<{
            auto: "auto";
            interactive: "interactive";
        }>>;
        bootstrapSeed: z.ZodOptional<z.ZodObject<{
            vision: z.ZodOptional<z.ZodString>;
            audience: z.ZodOptional<z.ZodObject<{
                primary: z.ZodOptional<z.ZodArray<z.ZodString>>;
                secondary: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            constraints: z.ZodOptional<z.ZodArray<z.ZodString>>;
            currentMilestone: z.ZodOptional<z.ZodString>;
            nonGoals: z.ZodOptional<z.ZodArray<z.ZodString>>;
            requirements: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                scope: z.ZodOptional<z.ZodEnum<{
                    deferred: "deferred";
                    committed: "committed";
                    out_of_scope: "out_of_scope";
                }>>;
                group: z.ZodOptional<z.ZodString>;
                requirement: z.ZodString;
                status: z.ZodString;
                notes: z.ZodString;
            }, z.core.$strip>>>;
            roadmapPhases: z.ZodOptional<z.ZodArray<z.ZodObject<{
                phase: z.ZodString;
                title: z.ZodString;
                status: z.ZodOptional<z.ZodEnum<{
                    done: "done";
                    planned: "planned";
                    in_progress: "in_progress";
                }>>;
                objective: z.ZodString;
                requirementIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
                successCriteria: z.ZodOptional<z.ZodArray<z.ZodString>>;
                notes: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>>;
            brownfieldMode: z.ZodOptional<z.ZodEnum<{
                greenfield: "greenfield";
                "scaffold-only": "scaffold-only";
                brownfield: "brownfield";
            }>>;
            assumptions: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
    };
    handler: (args: Record<string, unknown>) => Promise<ProjectInitResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
    };
    handler: (args: Record<string, unknown>) => Promise<ProjectStatusResult>;
})[];
export {};
