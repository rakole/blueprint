import { type PhaseValidationRenderArgs } from "./phase-validation-rendering.js";
import type { PhaseSummaryIndexResult, PhaseValidationAuthoringContextArgs, PhaseValidationAuthoringContextResult, PhaseValidationReadArgs, PhaseValidationReadResult, PhaseValidationRenderResult, PhaseValidationStandaloneValidateModelResult, PhaseValidationValidateModelArgs, PhaseValidationValidateModelResult, PhaseValidationWriteArgs, PhaseValidationWriteResult, PlanIndexArgs, ResolvedPhaseLocation } from "./phase-tool-types.js";
export type PhaseValidationToolRuntimeDependencies = {
    readSummaryIndex: (args: PlanIndexArgs) => Promise<PhaseSummaryIndexResult>;
    syncRoadmapPhaseCompletion: (projectRoot: string, resolved: ResolvedPhaseLocation, options?: {
        noUat?: boolean;
    }) => Promise<string[]>;
};
export declare function trimPhaseValidationStandaloneValidateModelResult(validation: PhaseValidationValidateModelResult): PhaseValidationStandaloneValidateModelResult;
export declare function blueprintPhaseValidationAuthoringContext(args: PhaseValidationAuthoringContextArgs, deps: PhaseValidationToolRuntimeDependencies): Promise<PhaseValidationAuthoringContextResult>;
export declare function blueprintPhaseValidationValidateModel(args: PhaseValidationValidateModelArgs, deps: PhaseValidationToolRuntimeDependencies): Promise<PhaseValidationValidateModelResult>;
export declare function blueprintPhaseValidationRender(args: PhaseValidationRenderArgs, deps: PhaseValidationToolRuntimeDependencies): Promise<PhaseValidationRenderResult>;
export declare function blueprintPhaseValidationRead(args: PhaseValidationReadArgs, deps: PhaseValidationToolRuntimeDependencies): Promise<PhaseValidationReadResult>;
export declare function blueprintPhaseValidationWrite(args: PhaseValidationWriteArgs, deps: PhaseValidationToolRuntimeDependencies): Promise<PhaseValidationWriteResult>;
