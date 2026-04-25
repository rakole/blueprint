import * as z from "zod/v4";
import { blueprintConfigGet } from "./config.js";
import { blueprintRoadmapRead } from "./phase.js";
import { listArtifactContracts } from "../artifact-contracts/index.js";
type ImpactStatus = "PASS" | "WARN" | "BLOCK";
type ImpactRiskLevel = "low" | "medium" | "high" | "critical" | "unknown";
type ImpactConfidenceLevel = "low" | "medium" | "high";
type ImpactOutputMode = "human" | "json" | "markdown" | "pr-comment" | "summary";
type ImpactScopeMode = NonNullable<ImpactScopeResolveArgs["mode"]>;
type ImpactScopeKind = Exclude<ImpactScopeMode, "auto"> | "unresolved";
type ImpactConfigStatus = "ok" | "invalid";
type ImpactScopeStatus = "resolved" | "unresolved";
type ImpactConfigGetArgs = {
    cwd?: string;
    configPath?: string;
    strictConfig?: boolean;
    overrides?: Record<string, unknown>;
};
type ImpactScopeResolveArgs = {
    cwd?: string;
    mode?: "auto" | "staged" | "working-tree" | "range" | "base-head" | "files" | "diff-file" | "description";
    description?: string;
    range?: string;
    base?: string;
    head?: string;
    files?: string[];
    diffFile?: string;
    phase?: string | number;
    roadmapItem?: string;
    seedFile?: string;
    meta?: Record<string, string>;
};
type ImpactContextLoadArgs = {
    cwd?: string;
    phase?: string | number;
    roadmapItem?: string;
    includeRuntime?: boolean;
    includeCatalog?: boolean;
    includeArtifacts?: boolean;
};
type ImpactAnalyzeArgs = {
    cwd?: string;
    changedFiles?: string[];
    files?: string[];
    scope?: Record<string, unknown>;
    context?: Record<string, unknown>;
    config?: Record<string, unknown>;
};
type ImpactReportWriteArgs = {
    cwd?: string;
    impactId?: string;
    report?: Record<string, unknown>;
    overwrite?: boolean;
    writeEvidenceLog?: boolean;
};
type ImpactOutputRenderArgs = {
    cwd?: string;
    mode?: ImpactOutputMode;
    impactId?: string;
    report?: Record<string, unknown>;
    verbosity?: "compact" | "normal" | "detailed";
};
type ImpactConfidence = {
    score: number;
    level: ImpactConfidenceLevel;
    reasons: string[];
};
type ImpactRisk = {
    level: ImpactRiskLevel;
    reasons: string[];
};
type ImpactScopeSummary = {
    kind: ImpactScopeKind;
    description: string | null;
    files: string[];
    source: string;
};
type ImpactConfig = {
    schemaVersion: typeof IMPACT_SCHEMA_VERSION;
    baseBranches: string[];
    paths: {
        include: string[];
        ignore: string[];
        generated: string[];
        docs: string[];
        tests: string[];
    };
    ownership: {
        sources: string[];
        requiredOwnerMatch: boolean;
        fallbackReviewers: string[];
    };
    dependencyGraph: {
        sources: string[];
        customGraphFiles: string[];
        requireReverseDepsFor: string[];
    };
    risk: {
        blockOnCritical: boolean;
        blockOnBreakingContract: boolean;
        blockOnSensitiveUnknownOwner: boolean;
        warnBelowConfidence: number;
        blockBelowConfidenceForSensitiveAreas: number;
    };
    reporting: {
        defaultVerbosity: "compact" | "normal" | "detailed";
        writeEvidenceLog: boolean;
        redactPathPatterns: string[];
    };
};
type ImpactConfigGetResult = {
    status: ImpactConfigStatus;
    config: ImpactConfig;
    provenance: {
        layersApplied: string[];
        defaultsPath: string | null;
        projectPath: string | null;
        invocationPath: string | null;
    };
    warnings: string[];
    errors: string[];
    configHash: string;
};
type ImpactScopeResolveResult = {
    status: ImpactScopeStatus;
    scope: ImpactScopeSummary;
    changedFiles: string[];
    git: {
        mode: ImpactScopeMode;
        range: string | null;
        base: string | null;
        head: string | null;
    };
    diffStats: {
        filesChanged: number;
        additions: number | null;
        deletions: number | null;
    };
    patchHash: string | null;
    scopeFingerprint: string;
    confidence: ImpactConfidence;
    warnings: string[];
};
type ImpactSurface = "secret-sensitive" | "env-config" | "command-catalog" | "command-manifest" | "command-doc" | "mcp-server" | "mcp-tool" | "mcp-resource" | "artifact-contract" | "skill" | "agent" | "extension-manifest" | "hook" | "package-runtime" | "build-config" | "test" | "docs" | "generated" | "config" | "source" | "repo-root" | "unknown";
type ImpactSurfaceRecord = {
    path: string;
    surfaces: ImpactSurface[];
    primarySurface: ImpactSurface;
    area: string;
    reasons: string[];
};
type ImpactSummaryRecord = {
    name: string;
    files: string[];
    count: number;
};
type ImpactRuntimeContext = {
    registeredImpactTools: string[];
    implementationPhase: number;
    readOnly: boolean;
    includeRuntime: boolean;
    includeCatalog: boolean;
    includeArtifacts: boolean;
};
type ImpactRepoHints = {
    cwdAccepted: boolean;
    packageMetadataLoaded: boolean;
    packageJsonPath: string | null;
    packageName: string | null;
    packageVersion: string | null;
    packageScripts: string[];
    packageManager: string | null;
    testPaths: string[];
    docsPaths: string[];
    sourceRoots: string[];
    artifactContractsLoaded: boolean;
};
type ImpactCommandAssets = {
    commandCount: number;
    implementedCommands: string[];
    nonRoutableCommands: string[];
    manifestPaths: string[];
    specPaths: string[];
    skillPaths: string[];
    missingAssetCount: number;
    impact: unknown;
};
type ImpactPhaseContextEntry = {
    phaseNumber: string;
    phaseName: string | null;
    requestedBy: string[];
    context: unknown;
    warnings: string[];
};
type ImpactContextLoadResult = {
    status: "loaded" | "partial";
    project: unknown | null;
    config: Awaited<ReturnType<typeof blueprintConfigGet>> | null;
    roadmap: Awaited<ReturnType<typeof blueprintRoadmapRead>> | null;
    phases: ImpactPhaseContextEntry[];
    catalog?: unknown;
    commandAssets?: ImpactCommandAssets;
    artifactContracts?: ReturnType<typeof listArtifactContracts>;
    runtime?: ImpactRuntimeContext;
    repoHints: ImpactRepoHints;
    warnings: string[];
};
type ImpactAnalysisReport = Record<string, unknown> & {
    schemaVersion: "blueprint.impact.report.v1";
    impactId: string;
    status: ImpactStatus;
    surfaces: ImpactSurfaceRecord[];
    areaSummary: ImpactSummaryRecord[];
    surfaceSummary: ImpactSummaryRecord[];
};
type ImpactAnalyzeResult = {
    phaseStatus: "classified";
    impactId: string;
    status: ImpactStatus;
    impactStatus: ImpactStatus;
    risk: ImpactRisk;
    confidence: ImpactConfidence;
    surfaces: ImpactSurfaceRecord[];
    areaSummary: ImpactSummaryRecord[];
    surfaceSummary: ImpactSummaryRecord[];
    findings: unknown[];
    obligations: unknown[];
    unknowns: string[];
    evidence: unknown[];
    report: ImpactAnalysisReport;
    warnings: string[];
};
type ImpactReportWriteResult = {
    status: "disabled";
    impactId: string;
    impactDir: string;
    paths: {
        impactMarkdown: string | null;
        impactJson: string | null;
        summaryJson: string | null;
        evidenceJsonl: string | null;
        reviewChecklist: string | null;
        questions: string | null;
    };
    written: false;
    warnings: string[];
};
type ImpactOutputRenderResult = {
    phaseStatus: "placeholder";
    mode: ImpactOutputMode;
    status: ImpactStatus;
    impactStatus: ImpactStatus;
    content: string;
    impactId: string;
    warnings: string[];
};
declare const IMPACT_SCHEMA_VERSION = "blueprint.impact.config.v1";
export declare function blueprintImpactConfigGet(args?: ImpactConfigGetArgs): Promise<ImpactConfigGetResult>;
export declare function blueprintImpactScopeResolve(args?: ImpactScopeResolveArgs): Promise<ImpactScopeResolveResult>;
export declare function blueprintImpactContextLoad(args?: ImpactContextLoadArgs): Promise<ImpactContextLoadResult>;
export declare function blueprintImpactAnalyze(args?: ImpactAnalyzeArgs): Promise<ImpactAnalyzeResult>;
export declare function blueprintImpactReportWrite(args?: ImpactReportWriteArgs): Promise<ImpactReportWriteResult>;
export declare function blueprintImpactOutputRender(args?: ImpactOutputRenderArgs): Promise<ImpactOutputRenderResult>;
export declare const impactToolDefinitions: ({
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        configPath: z.ZodOptional<z.ZodString>;
        strictConfig: z.ZodOptional<z.ZodBoolean>;
        overrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    };
    handler: (args: Record<string, unknown>) => Promise<ImpactConfigGetResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        mode: z.ZodOptional<z.ZodEnum<{
            files: "files";
            description: "description";
            auto: "auto";
            staged: "staged";
            "working-tree": "working-tree";
            range: "range";
            "base-head": "base-head";
            "diff-file": "diff-file";
        }>>;
        description: z.ZodOptional<z.ZodString>;
        range: z.ZodOptional<z.ZodString>;
        base: z.ZodOptional<z.ZodString>;
        head: z.ZodOptional<z.ZodString>;
        files: z.ZodOptional<z.ZodArray<z.ZodString>>;
        diffFile: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        roadmapItem: z.ZodOptional<z.ZodString>;
        seedFile: z.ZodOptional<z.ZodString>;
        meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    };
    handler: (args: Record<string, unknown>) => Promise<ImpactScopeResolveResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        phase: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        roadmapItem: z.ZodOptional<z.ZodString>;
        includeRuntime: z.ZodOptional<z.ZodBoolean>;
        includeCatalog: z.ZodOptional<z.ZodBoolean>;
        includeArtifacts: z.ZodOptional<z.ZodBoolean>;
    };
    handler: (args: Record<string, unknown>) => Promise<ImpactContextLoadResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        changedFiles: z.ZodOptional<z.ZodArray<z.ZodString>>;
        files: z.ZodOptional<z.ZodArray<z.ZodString>>;
        scope: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    };
    handler: (args: Record<string, unknown>) => Promise<ImpactAnalyzeResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        impactId: z.ZodOptional<z.ZodString>;
        report: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        overwrite: z.ZodOptional<z.ZodBoolean>;
        writeEvidenceLog: z.ZodOptional<z.ZodBoolean>;
    };
    handler: (args: Record<string, unknown>) => Promise<ImpactReportWriteResult>;
} | {
    name: string;
    description: string;
    inputSchema: {
        cwd: z.ZodOptional<z.ZodString>;
        mode: z.ZodOptional<z.ZodEnum<{
            summary: "summary";
            human: "human";
            json: "json";
            markdown: "markdown";
            "pr-comment": "pr-comment";
        }>>;
        impactId: z.ZodOptional<z.ZodString>;
        report: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        verbosity: z.ZodOptional<z.ZodEnum<{
            compact: "compact";
            normal: "normal";
            detailed: "detailed";
        }>>;
    };
    handler: (args: Record<string, unknown>) => Promise<ImpactOutputRenderResult>;
})[];
export {};
