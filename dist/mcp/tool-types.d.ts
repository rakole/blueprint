import type { ZodType } from "zod/v4";
export type ToolResult = Record<string, unknown>;
export type ToolDefinition = {
    name: string;
    description: string;
    inputSchema?: Record<string, ZodType>;
    handler: (args: Record<string, unknown>) => Promise<ToolResult>;
};
