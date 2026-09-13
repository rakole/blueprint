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

// Discussion documents must never be retained by the diagnostic side channel.
// Select by invocation, including models rejected for an incorrect artifact kind.
function metadataOnlyInvocation(toolName: string, args: Record<string, unknown>): boolean {
  return toolName.startsWith("blueprint_discuss_") ||
    (toolName === "blueprint_phase_artifact_write" &&
      (args.artifact === "context" || args.artifact === "discussion-log" || args.model !== undefined));
}

function failureMetadata(value: Record<string, unknown>, depth = 0): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  const statuses = new Set(["invalid", "blocked", "rejected", "stale", "partial", "failed", "error", "reconciliation_required", "not_found", "project_missing", "needs_revision", "refused", "outcome-unknown"]);
  if (typeof value.status === "string" && statuses.has(value.status)) metadata.status = value.status;
  if (["rejected-not-saved", "saved-but-state-incomplete", "complete"].includes(value.outcome as string)) metadata.outcome = value.outcome;
  const knownCodes = new Set([
    "schema.missing", "schema.type", "schema.required", "schema.additionalProperties",
    "schema.pattern", "schema.minLength", "schema.maxLength", "schema.minItems",
    "schema.maxItems", "schema.enum", "schema.const", "schema.anyOf", "schema.oneOf",
    "context.missing_essential_intent", "context.missing_required_section",
    "markdown.placeholder_text", "markdown.missing_h1", "markdown.no_populated_contract_sections",
    "markdown.invalid_render", "markdown.empty",
    "write.exactly_one_input", "write.unsupported_model", "write.model_only", "write.invalid",
  ]);
  if (Array.isArray(value.diagnostics)) metadata.diagnosticCodes = [...new Set(value.diagnostics.slice(0, MAX_ARRAY_ITEMS).flatMap((item) => {
    const code = item && typeof item === "object" ? (item as Record<string, unknown>).code : undefined;
    return typeof code === "string" && knownCodes.has(code) ? [code] : [];
  }))];
  for (const key of ["revision", "expectedRevision", "recordCount", "valid", "written", "saved", "overwrite", "includeLog"]) {
    if (typeof value[key] === "boolean" || (typeof value[key] === "number" && Number.isFinite(value[key]))) metadata[key] = value[key];
  }
  for (const key of ["records", "issues", "warnings", "diagnostics"]) {
    if (Array.isArray(value[key])) metadata[`${key}Count`] = value[key].length;
  }
  if (depth < MAX_DEPTH && value.validation && typeof value.validation === "object") {
    metadata.validation = failureMetadata(value.validation as Record<string, unknown>, depth + 1);
  }
  if (value.model !== undefined) metadata.modelSupplied = true;
  if (value.candidate !== undefined) metadata.candidateSupplied = true;
  if (typeof value.content === "string") metadata.contentLength = value.content.length;
  if (["context", "discussion-log"].includes(value.artifact as string)) metadata.artifact = value.artifact;
  return metadata;
}

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
    request: metadataOnlyInvocation(toolName, args) ? failureMetadata(args) : sanitizeForLog(args),
    result: metadataOnlyInvocation(toolName, args) ? failureMetadata(result) : sanitizeForLog(result)
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
    request: metadataOnlyInvocation(toolName, args) ? failureMetadata(args) : sanitizeForLog(args),
    error: metadataOnlyInvocation(toolName, args)
      ? { name: "MutationError", message: "Content omitted", stack: null }
      : toLoggedError(error)
  });
}
