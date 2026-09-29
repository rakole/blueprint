import type { ToolResult } from "./tool-types.js";
import { sanitizeToolResultForPublicResponse } from "./response-sanitizer.js";

export const MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES = 512 * 1024;
export const PLAN_MCP_JSON_RPC_ID_RESERVE_BYTES = 16 * 1024;
/** Backward-compatible name for the complete encoded JSON-RPC response limit. */
export const MAX_PLAN_MCP_MIRRORED_PAYLOAD_BYTES = MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES;
const BOUNDED_PLAN_TOOLS = new Set(["blueprint_plan_prepare", "blueprint_plan_submit", "blueprint_plan_read"]);
const RESERVED_JSON_RPC_ID = "x".repeat(PLAN_MCP_JSON_RPC_ID_RESERVE_BYTES);

type JsonRpcId = string | number | null;

function responseFor(structuredContent: ToolResult) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
    structuredContent
  };
}

/** Measures the encoded response, including mirror escaping and a conservative JSON-RPC id/wrapper allowance. */
export function planMcpJsonRpcResponseBytes(structuredContent: ToolResult, requestId: JsonRpcId = RESERVED_JSON_RPC_ID): number {
  return Buffer.byteLength(`${JSON.stringify({
    jsonrpc: "2.0",
    id: requestId,
    result: responseFor(structuredContent)
  })}\n`, "utf8");
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function boundedContinuation(value: unknown, kind: "evidence" | "plan"): Record<string, unknown> | null {
  const cursor = record(value);
  const hash = /^[a-f0-9]{64}$/;
  if (!cursor || !Number.isSafeInteger(cursor.offsetBytes) || !Number.isSafeInteger(cursor.totalBytes) ||
      (cursor.offsetBytes as number) < 0 || (cursor.totalBytes as number) <= 0 ||
      (cursor.offsetBytes as number) >= (cursor.totalBytes as number) ||
      typeof cursor.seal !== "string" || !hash.test(cursor.seal)) return null;
  if (kind === "evidence" && (typeof cursor.path !== "string" || typeof cursor.hash !== "string" ||
      !hash.test(cursor.hash) || typeof cursor.basisHash !== "string" || !hash.test(cursor.basisHash) ||
      !Number.isSafeInteger(cursor.revision) || (cursor.revision as number) < 0)) return null;
  if (kind === "plan" && (typeof cursor.planId !== "string" || typeof cursor.planHash !== "string" ||
      !hash.test(cursor.planHash) || typeof cursor.publicationToken !== "string" || cursor.publicationToken.length > 128 ||
      typeof cursor.filterHash !== "string" || !hash.test(cursor.filterHash))) return null;
  return Buffer.byteLength(JSON.stringify(cursor), "utf8") <= 8 * 1024 ? cursor : null;
}

function boundedSessionProjection(value: unknown): Record<string, unknown> | null {
  const session = record(value);
  if (!session) return null;
  const projection: Record<string, unknown> = {};
  for (const key of ["version", "phase", "revision", "prepared", "needsIntent", "publicationOwned", "mode", "checkerRequired"] as const) {
    const item = session[key];
    if (typeof item === "number" && Number.isSafeInteger(item) || typeof item === "boolean") projection[key] = item;
    else if (typeof item === "string" && item.length <= 128) projection[key] = item;
  }
  const counts = record(session.counts);
  if (counts) projection.counts = Object.fromEntries(Object.entries(counts).flatMap(([key, item]) =>
    key.length <= 64 && typeof item === "number" && Number.isSafeInteger(item) && item >= 0 ? [[key, item]] : []));
  const scope = record(session.metadataScope);
  if (scope) projection.metadataScope = {
    filtered: scope.filtered === true,
    truncated: scope.truncated === true,
    planIds: Array.isArray(scope.planIds)
      ? scope.planIds.filter(item => typeof item === "string" && /^\d+$/.test(item)).slice(0, 20)
      : []
  };
  return Object.keys(projection).length ? projection : null;
}

function responseLimitFallback(toolName: string, publicResult: ToolResult): ToolResult {
  const recovery = Object.fromEntries(
    ["revision", "sessionPath", "ready", "saved", "persistenceStatus"]
      .filter(key => ["string", "number", "boolean"].includes(typeof publicResult[key]))
      .map(key => [key, publicResult[key]])
  );
  const fallback: ToolResult = {
    status: "response_limit",
    ...(typeof publicResult.status === "string" ? { originalStatus: publicResult.status } : {}),
    ...recovery,
    reason: `The encoded public ${toolName} JSON-RPC response exceeded ${MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES} bytes.`
  };
  const session = record(publicResult.session);
  if (fallback.revision === undefined && typeof session?.revision === "number") fallback.revision = session.revision;
  if (toolName === "blueprint_plan_prepare") {
    const ordinary = record(record(publicResult.evidenceBudget)?.ordinary);
    const continuation = Array.isArray(ordinary?.continuations)
      ? ordinary.continuations.map(item => boundedContinuation(item, "evidence")).find(Boolean) ?? null
      : null;
    if (continuation) {
      fallback.evidenceContinuation = continuation;
      fallback.nextAction = "Retry blueprint_plan_prepare with this evidenceContinuation in evidenceDelivery.continuations and the returned revision as expectedRevision.";
    } else {
      fallback.nextAction = "Reduce evidencePaths or portableSelections, then retry blueprint_plan_prepare.";
    }
  } else if (toolName === "blueprint_plan_read") {
    const nextCursor = boundedContinuation(record(publicResult.bodyPage)?.nextCursor, "plan");
    if (nextCursor) {
      fallback.bodyCursor = nextCursor;
      fallback.nextAction = "Retry blueprint_plan_read with this bodyCursor and the same planIds filter.";
    } else {
      const session = record(publicResult.session);
      const availablePlanIds = [...new Set([
        ...(Array.isArray(publicResult.published)
          ? publicResult.published.flatMap(item => {
            const pathValue = typeof record(item)?.path === "string" ? record(item)!.path as string : "";
            const id = pathValue.match(/-(\d+)-PLAN\.md$/)?.[1];
            return id ? [id] : [];
          })
          : []),
        ...(Array.isArray(session?.existingPlans)
          ? session.existingPlans.flatMap(item => {
            const id = record(item)?.planId;
            return typeof id === "string" && /^\d+$/.test(id) ? [id] : [];
          })
          : []),
        ...(Array.isArray(session?.targetPlanIds)
          ? session.targetPlanIds.filter((item): item is string => typeof item === "string" && /^\d+$/.test(item))
          : [])
      ])].slice(0, 100);
      if (availablePlanIds.length) fallback.availablePlanIds = availablePlanIds;
      const projection = boundedSessionProjection(publicResult.session);
      if (projection) fallback.metadataProjection = projection;
      fallback.nextAction = availablePlanIds.length > 1
        ? "Retry blueprint_plan_read with bodyMode=metadata and planIds set to a smaller subset of availablePlanIds."
        : availablePlanIds.length === 1
          ? "Use metadataProjection for the bounded session state, or request a body page for the single availablePlanId."
        : "Retry blueprint_plan_read with explicit planIds to reduce the metadata scope.";
    }
    const publication = record(publicResult.publication);
    if (publication && typeof publication.status === "string" && typeof publication.token === "string" && publication.token.length <= 128) {
      fallback.publication = { status: publication.status, token: publication.token };
    }
  } else {
    fallback.nextAction = "Retry the same idempotent blueprint_plan_submit request to recover its bounded receipt.";
  }
  return fallback;
}

export function createPublicToolResult(toolName: string, result: ToolResult, requestId?: string | number): ToolResult {
  const publicResult = sanitizeToolResultForPublicResponse(toolName, result);
  if (!BOUNDED_PLAN_TOOLS.has(toolName) || planMcpJsonRpcResponseBytes(publicResult, requestId) <= MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES) return publicResult;
  const fallback = responseLimitFallback(toolName, publicResult);
  if (planMcpJsonRpcResponseBytes(fallback, requestId) <= MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES) return fallback;
  return {
    status: "response_limit",
    reason: "The encoded public planning response exceeded the fixed JSON-RPC response limit.",
    nextAction: "Retry with metadata-only or reduced evidence scope."
  };
}

export function createToolResponseContent(
  toolName: string,
  result: ToolResult,
  requestId?: string | number
): Array<{ type: "text"; text: string }> {
  return responseFor(createPublicToolResult(toolName, result, requestId)).content;
}

export function createToolResponse(toolName: string, result: ToolResult, requestId?: string | number) {
  return responseFor(createPublicToolResult(toolName, result, requestId));
}
