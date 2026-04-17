import { promises as fs } from "node:fs";
import path from "node:path";

import {
  ensureRepoRoot,
  toRepoRelativePath
} from "./tools/artifacts.js";

const BLUEPRINT_DIR = ".blueprint";
export const MCP_WRITE_FAILURE_LOG_PATH = `${BLUEPRINT_DIR}/mcp-write-failures.ndjson`;
const LOG_SCHEMA_VERSION = 1;
const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 25;
const MAX_STRING_LENGTH = 800;
const MAX_STACK_LENGTH = 4000;

type ToolResult = Record<string, unknown>;

type MutationFailureKind = "rejected" | "exception";

type MutationFailureEntry = {
  schemaVersion: number;
  timestamp: string;
  toolName: string;
  failureKind: MutationFailureKind;
  cwd: string | null;
  projectRoot: string;
  request: unknown;
  result?: unknown;
  error?: {
    name: string;
    message: string;
    stack: string | null;
  };
};

function truncateString(value: string, maxLength = MAX_STRING_LENGTH): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}… [truncated ${value.length - maxLength} chars]`;
}

function sanitizeForLog(
  value: unknown,
  depth = 0,
  key: string | null = null
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/\r\n/g, "\n");

    if (key === "content" || key === "currentState" || key === "contextNotes") {
      return {
        length: normalized.length,
        preview: truncateString(normalized)
      };
    }

    return truncateString(normalized);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) {
      return `[truncated array depth ${depth}]`;
    }

    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((entry) => sanitizeForLog(entry, depth + 1, key));

    if (value.length > MAX_ARRAY_ITEMS) {
      items.push(`[truncated ${value.length - MAX_ARRAY_ITEMS} more items]`);
    }

    return items;
  }

  if (typeof value === "object") {
    if (depth >= MAX_DEPTH) {
      return `[truncated object depth ${depth}]`;
    }

    const record = value as Record<string, unknown>;
    const sanitized = Object.fromEntries(
      Object.entries(record)
        .slice(0, MAX_OBJECT_KEYS)
        .map(([entryKey, entryValue]) => [
          entryKey,
          sanitizeForLog(entryValue, depth + 1, entryKey)
        ])
    );

    if (Object.keys(record).length > MAX_OBJECT_KEYS) {
      sanitized.__truncatedKeys = Object.keys(record).length - MAX_OBJECT_KEYS;
    }

    return sanitized;
  }

  return String(value);
}

function toLoggedError(error: unknown): MutationFailureEntry["error"] {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack:
        typeof error.stack === "string"
          ? truncateString(error.stack, MAX_STACK_LENGTH)
          : null
    };
  }

  return {
    name: "NonErrorThrow",
    message:
      typeof error === "string" ? truncateString(error) : JSON.stringify(sanitizeForLog(error)),
    stack: null
  };
}

async function appendFailureEntry(
  cwd: string | undefined,
  entry: Omit<MutationFailureEntry, "projectRoot">
): Promise<string | null> {
  try {
    const projectRoot = await ensureRepoRoot(cwd);
    const absoluteLogPath = path.join(projectRoot, MCP_WRITE_FAILURE_LOG_PATH);

    await fs.mkdir(path.dirname(absoluteLogPath), { recursive: true });
    await fs.appendFile(
      absoluteLogPath,
      `${JSON.stringify({
        ...entry,
        projectRoot
      })}\n`,
      "utf8"
    );

    return toRepoRelativePath(projectRoot, absoluteLogPath);
  } catch {
    return null;
  }
}

export async function logRejectedMutationResult(
  toolName: string,
  args: Record<string, unknown>,
  result: ToolResult
): Promise<string | null> {
  return appendFailureEntry(typeof args.cwd === "string" ? args.cwd : undefined, {
    schemaVersion: LOG_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    toolName,
    failureKind: "rejected",
    cwd: typeof args.cwd === "string" ? args.cwd : null,
    request: sanitizeForLog(args),
    result: sanitizeForLog(result)
  });
}

export async function logThrownMutationError(
  toolName: string,
  args: Record<string, unknown>,
  error: unknown
): Promise<string | null> {
  return appendFailureEntry(typeof args.cwd === "string" ? args.cwd : undefined, {
    schemaVersion: LOG_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    toolName,
    failureKind: "exception",
    cwd: typeof args.cwd === "string" ? args.cwd : null,
    request: sanitizeForLog(args),
    error: toLoggedError(error)
  });
}
