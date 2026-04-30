import * as z from "zod/v4";
import { blueprintConfigGet } from "./config.js";
import { blueprintRoadmapRead } from "./phase.js";
import { listArtifactContracts } from "../artifact-contracts/index.js";
type ImpactStatus = "PASS" | "WARN" | "BLOCK";
type ImpactRiskLevel = "low" | "medium" | "high" | "critical" | "unknown";
type ImpactConfidenceLevel = "low" | "medium" | "high";
type ImpactSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
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
    expectedScopeFingerprint?: string;
    expectedScopeSource?: string | null;
    expectedScopeDescription?: string | null;
    expectedFiles?: string[];
    expectedEvidenceIds?: string[];
    expectedEvidencePathsById?: Record<string, string[]>;
    expectedFindingIds?: string[];
    expectedBlockingFindingIds?: string[];
    expectedWarningFindingIds?: string[];
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
type ImpactSurface = "secret-sensitive" | "env-config" | "command-catalog" | "command-manifest" | "command-doc" | "runtime-reference" | "mcp-server" | "mcp-tool" | "mcp-resource" | "artifact-contract" | "skill" | "agent" | "extension-manifest" | "hook" | "package-runtime" | "build-config" | "test" | "docs" | "generated" | "config" | "source" | "repo-root" | "unknown";
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
    registeredTools: string[];
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
    impactStatus: ImpactStatus;
    summary: string;
    scope: ImpactReportScope;
    files: string[];
    risk: ImpactRisk;
    confidence: ImpactConfidence;
    scoring: ImpactScoringSummary;
    topImpactedAreas: ImpactSummaryRecord[];
    requiredReviewers: string[];
    requiredTests: string[];
    requiredActions: string[];
    blockingFindings: ImpactFindingRecord[];
    warningFindings: ImpactFindingRecord[];
    surfaces: ImpactSurfaceRecord[];
    areaSummary: ImpactSummaryRecord[];
    surfaceSummary: ImpactSummaryRecord[];
    ownership: ImpactOwnershipAnalysis;
    dependencyGraph: ImpactDependencyAnalysis;
    findings: ImpactFindingRecord[];
    obligations: ImpactObligationRecord[];
    unknowns: ImpactUnknownRecord[];
    evidence: ImpactEvidenceRecord[];
};
type ImpactAnalyzeResult = {
    phaseStatus: "scored-report-modeled";
    impactId: string;
    status: ImpactStatus;
    impactStatus: ImpactStatus;
    risk: ImpactRisk;
    confidence: ImpactConfidence;
    surfaces: ImpactSurfaceRecord[];
    areaSummary: ImpactSummaryRecord[];
    surfaceSummary: ImpactSummaryRecord[];
    ownership: ImpactOwnershipAnalysis;
    dependencyGraph: ImpactDependencyAnalysis;
    findings: ImpactFindingRecord[];
    obligations: ImpactObligationRecord[];
    unknowns: ImpactUnknownRecord[];
    evidence: ImpactEvidenceRecord[];
    report: ImpactAnalysisReport;
    warnings: string[];
};
type ImpactReportScope = {
    kind: string;
    source: string | null;
    description: string | null;
    fingerprint: string;
    confidence: ImpactConfidence;
};
type ImpactScoringSummary = {
    status: ImpactStatus;
    riskLevel: ImpactRiskLevel;
    confidenceScore: number;
    confidenceLevel: ImpactConfidenceLevel;
    maxSeverity: ImpactSeverity | null;
    blocking: boolean;
    drivers: string[];
    reducers: string[];
    policy: {
        blockOnCritical: boolean;
        blockOnBreakingContract: boolean;
        blockOnSensitiveUnknownOwner: boolean;
        warnBelowConfidence: number;
        blockBelowConfidenceForSensitiveAreas: number;
    };
};
type ImpactEvidenceRecord = {
    id: string;
    kind: "scope" | "surface" | "ownership" | "dependency" | "metadata" | "config" | "contract" | "obligation" | "build";
    source: string;
    summary: string;
    paths: string[];
    data?: Record<string, unknown>;
};
type ImpactUnknownCategory = "scope" | "ownership" | "dependency" | "contract" | "obligation";
type ImpactUnknownRecord = {
    id: string;
    category: ImpactUnknownCategory;
    title: string;
    severity: ImpactSeverity;
    impactedFiles: string[];
    reason: string;
    resolution: string;
    evidenceRefs: string[];
};
type ImpactFindingRecord = {
    id: string;
    checkId: string;
    title: string;
    severity: ImpactSeverity;
    status: ImpactStatus;
    confidence: number;
    impactedFiles: string[];
    impactedAreas: string[];
    owners: string[];
    requiredActions: string[];
    evidenceRefs: string[];
};
type ImpactObligationCategory = "contract-review" | "docs" | "tests" | "release" | "migration" | "security" | "deployment" | "build";
type ImpactObligationRecord = {
    id: string;
    category: ImpactObligationCategory;
    title: string;
    severity: ImpactSeverity;
    status: ImpactStatus;
    impactedFiles: string[];
    sourceSurfaces: ImpactSurface[];
    requiredActions: string[];
    evidenceRefs: string[];
};
type ImpactOwnershipRule = {
    source: "codeowners" | "metadata";
    sourcePath: string;
    pattern: string;
    owners: string[];
    sensitive: boolean;
    line: number | null;
    order: number;
};
type ImpactOwnershipMatch = {
    path: string;
    owners: string[];
    matchedRules: ImpactOwnershipRule[];
    fallbackReviewers: string[];
    fallbackUsed: boolean;
    sensitive: boolean;
    ownerMissing: boolean;
    evidenceRefs: string[];
};
type ImpactOwnershipCoverage = {
    status: "none" | "partial" | "complete";
    sourcesConfigured: string[];
    sourcesUsed: string[];
    fallbackReviewers: string[];
    filesWithOwners: number;
    filesMissingOwners: number;
    gaps: string[];
};
type ImpactOwnershipAnalysis = {
    coverage: ImpactOwnershipCoverage;
    codeownersPath: string | null;
    metadataPaths: string[];
    rules: ImpactOwnershipRule[];
    matches: ImpactOwnershipMatch[];
};
type ImpactDependencyNode = {
    id: string;
    path: string | null;
    kind: "package" | "workspace" | "file" | "external" | "custom";
    source: string;
};
type ImpactDependencyEdge = {
    from: string;
    to: string;
    type: string;
    source: string;
};
type ImpactDependencyCoverage = {
    status: "none" | "partial" | "complete-ish";
    sourcesConfigured: string[];
    sourcesUsed: string[];
    filesCovered: string[];
    filesUncovered: string[];
    gaps: string[];
};
type ImpactDependencyAnalysis = {
    coverage: ImpactDependencyCoverage;
    nodes: ImpactDependencyNode[];
    edges: ImpactDependencyEdge[];
    reverseDependentsByPath: Record<string, string[]>;
};
type ImpactReportWriteResult = {
    status: "written" | "reused" | "overwritten" | "invalid";
    impactId: string;
    impactDir: string;
    paths: {
        impactMarkdown: string;
        impactJson: string;
        summaryJson: string;
        evidenceJsonl: string | null;
        reviewChecklist: string | null;
        questions: string | null;
    };
    written: boolean;
    errors: string[];
    warnings: string[];
};
type ImpactOutputRenderResult = {
    phaseStatus: "rendered";
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
        expectedScopeFingerprint: z.ZodOptional<z.ZodString>;
        expectedScopeSource: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>;
        expectedScopeDescription: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNull]>>;
        expectedFiles: z.ZodOptional<z.ZodArray<z.ZodString>>;
        expectedEvidenceIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        expectedEvidencePathsById: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>;
        expectedFindingIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        expectedBlockingFindingIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        expectedWarningFindingIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
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
            markdown: "markdown";
            human: "human";
            json: "json";
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
