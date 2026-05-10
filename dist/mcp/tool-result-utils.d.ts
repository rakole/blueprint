import type { ToolResult } from "./tool-types.js";
export declare function getString(result: ToolResult, key: string): string | null;
export declare function getNextAction(result: ToolResult): string | null;
export declare function getBoolean(result: ToolResult, key: string): boolean | null;
export declare function getArrayCount(result: ToolResult, key: string): number | null;
export declare function asRecord(value: unknown): Record<string, unknown> | null;
export declare function areEquivalentJsonValues(left: unknown, right: unknown): boolean;
