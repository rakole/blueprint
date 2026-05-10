import type { ToolDefinition, ToolResult } from "./tool-types.js";
export declare const BLUEPRINT_MUTATION_TOOL_NAMES: Set<string>;
export declare const MUTATION_FAILURE_STATUSES: Set<string>;
export declare function isMutationTool(toolName: string): boolean;
export declare function shouldLogMutationFailure(toolName: string, result: ToolResult): boolean;
export declare function executeToolHandlerWithFailureLogging(definition: ToolDefinition, args: Record<string, unknown>): Promise<ToolResult>;
