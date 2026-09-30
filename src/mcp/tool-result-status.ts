const NON_SUCCESS_STATUS_VALUES = [
  "reconciliation_required",
  "needs_revision",
  "reread_required",
  "evidence_limit",
  "fallback",
  "invalid",
  "project_missing",
  "not_found",
  "not-found",
  "blocked",
  "rejected",
  "stale",
  "refused",
  "partial",
  "failed",
  "error",
  "outcome-unknown"
] as const;

export type NonSuccessToolStatus = typeof NON_SUCCESS_STATUS_VALUES[number];

/**
 * Result statuses that represent a stopped, rejected, or incomplete tool call.
 * Logging, public summaries, and metadata-only failure projection must share
 * this classification so a new failure status cannot appear successful on one
 * surface while being ignored by another.
 */
export const NON_SUCCESS_TOOL_STATUSES: ReadonlySet<string> = new Set(
  NON_SUCCESS_STATUS_VALUES
);

export function isNonSuccessToolStatus(value: unknown): value is NonSuccessToolStatus {
  return typeof value === "string" && NON_SUCCESS_TOOL_STATUSES.has(value);
}
