export declare const MCP_WRITE_FAILURE_LOG_PATH = ".blueprint/mcp-write-failures.ndjson";
type ToolResult = Record<string, unknown>;
export declare function logRejectedMutationResult(toolName: string, args: Record<string, unknown>, result: ToolResult): Promise<string | null>;
export declare function logThrownMutationError(toolName: string, args: Record<string, unknown>, error: unknown): Promise<string | null>;
export {};
