import type { ToolResult } from "./tool-types.js";
export declare const MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES: number;
export declare const PLAN_MCP_JSON_RPC_ID_RESERVE_BYTES: number;
/** Backward-compatible name for the complete encoded JSON-RPC response limit. */
export declare const MAX_PLAN_MCP_MIRRORED_PAYLOAD_BYTES: number;
type JsonRpcId = string | number | null;
/** Measures the encoded response, including mirror escaping and a conservative JSON-RPC id/wrapper allowance. */
export declare function planMcpJsonRpcResponseBytes(structuredContent: ToolResult, requestId?: JsonRpcId): number;
export declare function createPublicToolResult(toolName: string, result: ToolResult, requestId?: string | number): ToolResult;
export declare function createToolResponseContent(toolName: string, result: ToolResult, requestId?: string | number): Array<{
    type: "text";
    text: string;
}>;
export declare function createToolResponse(toolName: string, result: ToolResult, requestId?: string | number): {
    content: {
        type: "text";
        text: string;
    }[];
    structuredContent: ToolResult;
};
export {};
