import * as z from "zod/v4";
export declare const BLUEPRINT_DIR = ".blueprint";
export declare const BLUEPRINT_STATE_PATH = ".blueprint/STATE.md";
export declare const BLUEPRINT_CONFIG_PATH = ".blueprint/config.json";
export declare const BLUEPRINT_PHASES_PATH = ".blueprint/phases";
export declare const BLUEPRINT_REPORTS_PATH = ".blueprint/reports";
export declare const BLUEPRINT_CODEBASE_PATH = ".blueprint/codebase";
export declare const BLUEPRINT_BACKLOG_PATH = ".blueprint/backlog";
export declare const BLUEPRINT_TODOS_PATH = ".blueprint/todos";
export declare const BLUEPRINT_NOTES_PATH = ".blueprint/notes";
export declare const BLUEPRINT_BACKLOG_INDEX_PATH = ".blueprint/backlog/BACKLOG.md";
export declare const BLUEPRINT_TODO_INDEX_PATH = ".blueprint/todos/TODO.md";
export declare const BLUEPRINT_NOTES_INDEX_PATH = ".blueprint/notes/NOTES.md";
export declare const SUPPORTED_BOOTSTRAP_ARTIFACTS: readonly [".blueprint/PROJECT.md", ".blueprint/REQUIREMENTS.md", ".blueprint/ROADMAP.md", ".blueprint/phases/"];
export declare const CORE_PROJECT_ARTIFACTS: readonly [".blueprint/PROJECT.md", ".blueprint/REQUIREMENTS.md", ".blueprint/ROADMAP.md", ".blueprint/STATE.md", ".blueprint/config.json", ".blueprint/phases/"];
export declare const CODEBASE_ARTIFACTS: readonly [".blueprint/codebase/STACK.md", ".blueprint/codebase/ARCHITECTURE.md", ".blueprint/codebase/STRUCTURE.md", ".blueprint/codebase/CONVENTIONS.md", ".blueprint/codebase/TESTING.md", ".blueprint/codebase/INTEGRATIONS.md", ".blueprint/codebase/CONCERNS.md"];
export declare const SUPPORTED_SCAFFOLD_ARTIFACTS: readonly [".blueprint/PROJECT.md", ".blueprint/REQUIREMENTS.md", ".blueprint/ROADMAP.md", ".blueprint/phases/", ".blueprint/codebase/STACK.md", ".blueprint/codebase/ARCHITECTURE.md", ".blueprint/codebase/STRUCTURE.md", ".blueprint/codebase/CONVENTIONS.md", ".blueprint/codebase/TESTING.md", ".blueprint/codebase/INTEGRATIONS.md", ".blueprint/codebase/CONCERNS.md"];
export type SupportedScaffoldArtifact = (typeof SUPPORTED_SCAFFOLD_ARTIFACTS)[number];
export type BlueprintReadiness = "uninitialized" | "partial" | "initialized";
export type BootstrapRepoShape = "greenfield" | "scaffold-only" | "brownfield";
export type BootstrapRequirementRow = {
    id: string;
    requirement: string;
    status: string;
    notes: string;
};
export type BootstrapRoadmapPhase = {
    phase: string;
    title: string;
    status?: "planned" | "in_progress" | "done";
    objective: string;
    requirementIds?: string[];
    notes?: string[];
};
export type BootstrapSeed = {
    vision?: string;
    audience?: {
        primary?: string[];
        secondary?: string[];
    };
    constraints?: string[];
    currentMilestone?: string;
    nonGoals?: string[];
    requirements?: BootstrapRequirementRow[];
    roadmapPhases?: BootstrapRoadmapPhase[];
    brownfieldMode?: BootstrapRepoShape;
    assumptions?: string[];
};
export type BootstrapAssessment = {
    repoShape: BootstrapRepoShape;
    codebaseMapped: boolean;
    provisionalRoadmap: boolean;
    recommendedNextAction: string;
    reasons: string[];
};
export type BootstrapArtifactDiagnostics = {
    placeholderArtifacts: string[];
    traceabilityWarnings: string[];
    brownfield: BootstrapAssessment;
};
type ArtifactScaffoldArgs = {
    cwd?: string;
    artifacts?: string[];
    overwrite?: boolean;
    projectName?: string;
    bootstrapSeed?: BootstrapSeed;
};
type ArtifactListArgs = {
    cwd?: string;
};
type ArtifactMutateIndexTarget = "backlog" | "todo" | "note";
type ArtifactMutateIndexAction = "append" | "list" | "update";
type ArtifactMutateIndexUpdate = {
    id: string;
    status?: string;
    description?: string;
    reservedPhase?: string | null;
};
type ArtifactMutateIndexArgs = {
    cwd?: string;
    target: ArtifactMutateIndexTarget;
    action?: ArtifactMutateIndexAction;
    entry?: {
        text: string;
        status?: string;
        addedAt?: string;
        reservePhaseStub?: boolean;
    };
    filter?: {
        query?: string;
        ids?: string[];
        statuses?: string[];
        limit?: number;
    };
    match?: {
        id?: string;
        text?: string;
    };
    update?: {
        status?: string;
    };
    updates?: ArtifactMutateIndexUpdate[];
};
type ArtifactScaffoldResult = {
    createdFiles: string[];
    reusedFiles: string[];
    warnings: string[];
};
type ArtifactListResult = {
    artifacts: {
        core: string[];
        phases: string[];
        codebase: string[];
    };
    reports: string[];
    missing: string[];
    warnings: string[];
};
type ArtifactMutateIndexReservedPhase = {
    phaseNumber: string;
    phasePrefix: string;
    phaseDir: string;
    artifactPaths: string[];
};
type ArtifactMutateIndexResult = {
    status: "created" | "updated" | "duplicate" | "listed" | "not_found" | "project_missing" | "invalid";
    targetPath: string;
    createdEntryIds: string[];
    duplicateEntryIds: string[];
    matchedEntryIds: string[];
    updatedCounts: {
        added: number;
        updated: number;
        duplicates: number;
        preserved: number;
    };
    reservedPhase: ArtifactMutateIndexReservedPhase | null;
    entries: CaptureIndexRow[];
    summary: {
        total: number;
        matched: number;
        open: number;
        active: number;
        completed: number;
        other: number;
    };
    warnings: string[];
};
type ArtifactValidateArgs = {
    cwd?: string;
};
type ArtifactValidateResult = {
    valid: boolean;
    issues: string[];
    suggestedRepairs: string[];
    warnings: string[];
};
type ArtifactSummaryDigestArgs = {
    cwd?: string;
    focusArea?: string;
    packageJsonPath?: string;
    readmePath?: string;
    sourceFiles?: string[];
    testFiles?: string[];
    docFiles?: string[];
    trackedFiles?: string[];
    artifactPaths?: string[];
};
type ArtifactReportWriteArgs = {
    cwd?: string;
    reportName: string;
    content: string;
    overwrite?: boolean;
};
type ArtifactSummaryDigestSection = {
    artifact: string;
    title: string;
    summary: string;
    evidence: string[];
};
type ArtifactSummaryDigestResult = {
    digest: ArtifactSummaryDigestSection[];
    inputsUsed: string[];
};
type ArtifactReportWriteResult = {
    path: string;
    written: boolean;
    created: boolean;
    overwritten: boolean;
    status: "created" | "updated" | "reused" | "invalid";
    warnings: string[];
};
type TextWriteOptions = {
    label?: string;
    enforcePromptBoundary?: boolean;
};
export type CaptureIndexRow = {
    id: string;
    added: string;
    status: string | null;
    description: string;
    reservedPhase: string | null;
};
export type PlanArtifactMetadata = {
    phase: string | null;
    planId: string | null;
    title: string | null;
    wave: number | null;
    status: string | null;
    objective: string | null;
    dependsOn: string[];
    requirements: string[];
    filesModified: string[];
    readFirst: string[];
    acceptanceCriteria: string[];
    autonomous: boolean | null;
};
export declare function parseCaptureIndexDocument(content: string, target: ArtifactMutateIndexTarget): {
    rows: CaptureIndexRow[];
    malformed: boolean;
    recoveryContent: string | null;
};
export declare function normalizeReportSlug(value: string): string;
export declare function buildBlueprintReportPath(reportName: string): string;
export declare function toPosixPath(relativePath: string): string;
export declare function getProjectRoot(cwd?: string): string;
export declare function getBlueprintRoot(cwd?: string): string;
export declare function blueprintPathExists(targetPath: string): Promise<boolean>;
export declare function ensureRepoRoot(cwd?: string): Promise<string>;
export declare function toRepoRelativePath(projectRoot: string, absolutePath: string): string;
export declare function resolveRepoRelativePath(projectRoot: string, relativePath: string): string;
export declare function resolveBlueprintPath(projectRoot: string, relativePath: string): string;
export declare function ensureParentDirectory(targetPath: string): Promise<void>;
export declare function readJsonIfPresent(filePath: string): Promise<Record<string, unknown> | null>;
export declare function writeJsonFile(filePath: string, value: Record<string, unknown>): Promise<void>;
export declare function writeTextFile(filePath: string, value: string, options?: TextWriteOptions): Promise<string[]>;
export declare function validateResearchArtifactContent(content: string): {
    valid: boolean;
    issues: string[];
    warnings: string[];
};
export declare function validateVerificationArtifactContent(content: string, summaryPaths?: string[]): {
    valid: boolean;
    issues: string[];
    warnings: string[];
};
export declare function validateUatArtifactContent(content: string, summaryPaths?: string[]): {
    valid: boolean;
    issues: string[];
    warnings: string[];
};
export declare function validatePlanArtifactContent(content: string, expectedPhase?: string): {
    valid: boolean;
    issues: string[];
    warnings: string[];
    metadata: PlanArtifactMetadata;
};
export declare function inspectBlueprintArtifacts(projectRoot: string): Promise<{
    readiness: BlueprintReadiness;
    blueprintRootExists: boolean;
    core: {
        present: string[];
        missing: string[];
    };
    phases: string[];
    reports: string[];
    codebase: {
        present: string[];
        missing: string[];
    };
}>;
export declare function inspectBootstrapArtifacts(projectRoot: string): Promise<BootstrapArtifactDiagnostics>;
export declare function blueprintArtifactScaffold(args?: ArtifactScaffoldArgs): Promise<ArtifactScaffoldResult>;
export declare function blueprintArtifactList(args?: ArtifactListArgs): Promise<ArtifactListResult>;
export declare function blueprintArtifactMutateIndex(args: ArtifactMutateIndexArgs): Promise<ArtifactMutateIndexResult>;
export declare function blueprintArtifactValidate(args?: ArtifactValidateArgs): Promise<ArtifactValidateResult>;
export declare function blueprintArtifactSummaryDigest(args?: ArtifactSummaryDigestArgs): Promise<ArtifactSummaryDigestResult>;
export declare function blueprintArtifactReportWrite(args: ArtifactReportWriteArgs): Promise<ArtifactReportWriteResult>;
export declare const artifactToolDefinitions: ({
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        projectName: z.ZodOptional<z.ZodString>;
        overwrite: z.ZodOptional<z.ZodBoolean>;
        artifacts: z.ZodOptional<z.ZodArray<z.ZodString>>;
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
    handler: (args: Record<string, unknown>) => Promise<ArtifactScaffoldResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
    };
    handler: (args: Record<string, unknown>) => Promise<ArtifactListResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        target: z.ZodEnum<{
            backlog: "backlog";
            todo: "todo";
            note: "note";
        }>;
        action: z.ZodOptional<z.ZodEnum<{
            append: "append";
            list: "list";
            update: "update";
        }>>;
        entry: z.ZodOptional<z.ZodObject<{
            text: z.ZodString;
            status: z.ZodOptional<z.ZodString>;
            addedAt: z.ZodOptional<z.ZodString>;
            reservePhaseStub: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
        filter: z.ZodOptional<z.ZodObject<{
            query: z.ZodOptional<z.ZodString>;
            ids: z.ZodOptional<z.ZodArray<z.ZodString>>;
            statuses: z.ZodOptional<z.ZodArray<z.ZodString>>;
            limit: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        match: z.ZodOptional<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            text: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        update: z.ZodOptional<z.ZodObject<{
            status: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        updates: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            status: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            reservedPhase: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>>>;
    };
    handler: (args: Record<string, unknown>) => Promise<ArtifactMutateIndexResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
    };
    handler: (args: Record<string, unknown>) => Promise<ArtifactValidateResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        focusArea: z.ZodOptional<z.ZodString>;
        packageJsonPath: z.ZodOptional<z.ZodString>;
        readmePath: z.ZodOptional<z.ZodString>;
        sourceFiles: z.ZodOptional<z.ZodArray<z.ZodString>>;
        testFiles: z.ZodOptional<z.ZodArray<z.ZodString>>;
        docFiles: z.ZodOptional<z.ZodArray<z.ZodString>>;
        trackedFiles: z.ZodOptional<z.ZodArray<z.ZodString>>;
        artifactPaths: z.ZodOptional<z.ZodArray<z.ZodString>>;
    };
    handler: (args: Record<string, unknown>) => Promise<ArtifactSummaryDigestResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        reportName: z.ZodString;
        content: z.ZodString;
        overwrite: z.ZodOptional<z.ZodBoolean>;
    };
    handler: (args: Record<string, unknown>) => Promise<ArtifactReportWriteResult>;
})[];
export {};
