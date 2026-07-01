import { type PhaseArtifactValidationDiagnostic, validatePhaseArtifactContent } from "./artifacts.js";
import type { PhaseArtifactKind } from "./phase-locations.js";
import type { PhaseArtifactReadArgs, PhaseArtifactReadResult, PhaseArtifactRetryPlan, PhaseArtifactScaffoldArgs, PhaseArtifactScaffoldResult, PhaseArtifactWriteArgs, PhaseArtifactWriteResult, PhaseUiSkipWriteArgs, ResolvedPhaseLocation } from "./phase-tool-types.js";
export declare function isScaffoldGeneratedPhaseArtifact(content: string): boolean;
export declare function blueprintPhaseArtifactRead(args: PhaseArtifactReadArgs): Promise<PhaseArtifactReadResult>;
export declare function blueprintPhaseArtifactScaffold(args: PhaseArtifactScaffoldArgs): Promise<PhaseArtifactScaffoldResult>;
export declare function phaseArtifactSuggestedRepairs(artifact: PhaseArtifactKind, diagnostics: readonly PhaseArtifactValidationDiagnostic[]): string[];
export declare function phaseArtifactRetryPlan(artifact: PhaseArtifactKind, diagnostics: readonly PhaseArtifactValidationDiagnostic[]): PhaseArtifactRetryPlan;
export declare function invalidPhaseArtifactWriteResult(args: {
    resolved: ResolvedPhaseLocation;
    artifact: PhaseArtifactKind;
    path: string;
    validation: ReturnType<typeof validatePhaseArtifactContent>;
    warnings: string[];
}): PhaseArtifactWriteResult;
export declare function renderExplicitUiSkipArtifact(resolved: Pick<ResolvedPhaseLocation, "phasePrefix" | "phaseName">, skipRationale: string): string;
export declare function blueprintPhaseArtifactWrite(args: PhaseArtifactWriteArgs): Promise<PhaseArtifactWriteResult>;
export declare function blueprintPhaseUiSkipWrite(args: PhaseUiSkipWriteArgs): Promise<PhaseArtifactWriteResult>;
