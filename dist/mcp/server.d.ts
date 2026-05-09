import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodType } from "zod/v4";
type ToolResult = Record<string, unknown>;
type ToolDefinition = {
    name: string;
    description: string;
    inputSchema?: Record<string, ZodType>;
    handler: (args: Record<string, unknown>) => Promise<ToolResult>;
};
export declare const BLUEPRINT_MUTATION_TOOL_NAMES: Set<string>;
export declare const blueprintToolRegistry: {
    [k: string]: ToolDefinition;
};
export declare const blueprintToolNames: string[];
export declare function summarizeToolResult(toolName: string, result: ToolResult): string;
export declare function createToolResponseContent(toolName: string, result: ToolResult): Array<{
    type: "text";
    text: string;
}>;
export declare function sanitizeToolResultForPublicResponse(toolName: string, result: ToolResult): ToolResult;
export declare function isMutationTool(toolName: string): boolean;
export declare function shouldLogMutationFailure(toolName: string, result: ToolResult): boolean;
export declare function executeToolHandlerWithFailureLogging(definition: ToolDefinition, args: Record<string, unknown>): Promise<ToolResult>;
export declare function createBlueprintServer(): McpServer;
export declare function startServer(): Promise<void>;
export {};
