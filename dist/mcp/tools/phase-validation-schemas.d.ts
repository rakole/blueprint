import { type ArtifactContractReadResult } from "../artifact-contracts/index.js";
export declare function phaseVerificationModelSchemas(args: {
    contract: ArtifactContractReadResult;
    phaseNumber: string;
    summaryPaths: string[];
}): Promise<{
    schemaPath: string;
    baseSchema: Record<string, unknown>;
    taskSchema: Record<string, unknown>;
}>;
export declare function phaseUatModelSchemas(args: {
    contract: ArtifactContractReadResult;
    phaseNumber: string;
    summaryPaths: string[];
    verificationPath: string | null;
}): Promise<{
    schemaPath: string;
    baseSchema: Record<string, unknown>;
    taskSchema: Record<string, unknown>;
}>;
