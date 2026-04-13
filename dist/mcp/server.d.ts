import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodType } from "zod/v4";
type ToolDefinition = {
    name: string;
    description: string;
    inputSchema?: Record<string, ZodType>;
    handler: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
};
export declare const blueprintToolRegistry: {
    [k: string]: ToolDefinition;
};
export declare const blueprintToolNames: string[];
export declare function createBlueprintServer(): McpServer;
export declare function startServer(): Promise<void>;
export {};
