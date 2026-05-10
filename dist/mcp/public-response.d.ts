import type { ToolResult } from "./tool-types.js";
export declare function createToolResponseContent(toolName: string, result: ToolResult): Array<{
    type: "text";
    text: string;
}>;
