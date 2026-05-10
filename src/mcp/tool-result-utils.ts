import type { ToolResult } from "./tool-types.js";

export function getString(result: ToolResult, key: string): string | null {
  const value = result[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function getNextAction(result: ToolResult): string | null {
  return getString(result, "nextAction");
}

export function getBoolean(result: ToolResult, key: string): boolean | null {
  const value = result[key];
  return typeof value === "boolean" ? value : null;
}

export function getArrayCount(result: ToolResult, key: string): number | null {
  const value = result[key];
  return Array.isArray(value) ? value.length : null;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function areEquivalentJsonValues(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
