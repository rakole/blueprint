import type { PhaseCheckpointDeleteArgs, PhaseCheckpointDeleteResult, PhaseCheckpointGetArgs, PhaseCheckpointGetResult, PhaseCheckpointPutArgs, PhaseCheckpointPutResult } from "./phase-tool-types.js";
export declare function blueprintPhaseCheckpointGet(args?: PhaseCheckpointGetArgs): Promise<PhaseCheckpointGetResult>;
export declare function blueprintPhaseCheckpointPut(args: PhaseCheckpointPutArgs): Promise<PhaseCheckpointPutResult>;
export declare function blueprintPhaseCheckpointDelete(args?: PhaseCheckpointDeleteArgs): Promise<PhaseCheckpointDeleteResult>;
