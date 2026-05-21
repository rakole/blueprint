import { type NumericInput } from "./phase-numbering.js";
import { type ParsedRoadmapPhase } from "./phase-roadmap-parser.js";
export type PhaseArtifactKind = "context" | "discussion-log" | "research" | "spec" | "ui-spec";
export type PhaseValidationArtifactKind = "verification" | "uat";
export type ParsedRoadmap = {
    path: string;
    milestone: string | null;
    phases: ParsedRoadmapPhase[];
};
export type PhasePathLocation = {
    phaseDir: string;
    phasePrefix: string;
};
export declare function pathExists(targetPath: string): Promise<boolean>;
export declare function materializePhaseDirectory(projectRoot: string, phaseDir: string): Promise<{
    phaseDirPath: string;
    created: boolean;
    warnings: string[];
}>;
export declare function listPhaseArtifacts(rootPath: string, projectRoot: string): Promise<string[]>;
export declare function findPhaseDirectory(projectRoot: string, phaseNumber: string): Promise<{
    phaseDir: string | null;
    reason: "missing" | "ambiguous" | null;
}>;
export declare function readRoadmap(projectRoot: string): Promise<ParsedRoadmap>;
export declare function readMarkdownDocument(projectRoot: string, relativePath: string): Promise<string | null>;
export declare function resolveRequestedPhase(projectRoot: string, requestedPhase: NumericInput | undefined, phases: ParsedRoadmapPhase[]): Promise<{
    phaseNumber: string | null;
    resolvedFrom: "explicit" | "state" | "roadmap";
}>;
export declare function buildArtifactPath(phaseDir: string, phasePrefix: string, suffix: string): string;
export declare function findArtifact(artifacts: string[], suffix: string): string | null;
export declare function findPhaseSpecArtifact(artifacts: string[], phaseDir: string, phasePrefix: string): string | null;
export declare function artifactPathFor(located: PhasePathLocation, artifact: PhaseArtifactKind): string;
export declare function validationArtifactPathFor(located: PhasePathLocation, artifact: PhaseValidationArtifactKind): string;
export declare function checkpointPathFor(located: PhasePathLocation): string;
