import type { ToolResult } from "./tool-types.js";
import { MUTATION_FAILURE_STATUSES } from "./mutation-failure-logging.js";
import {
  asRecord,
  getArrayCount,
  getBoolean,
  getNextAction,
  getString
} from "./tool-result-utils.js";

const SUMMARY_PATH_KEYS = [
  "path",
  "reportPath",
  "configPath",
  "statePath",
  "roadmapPath",
  "linkedPlanPath",
  "sourcePath",
  "targetPath",
  "phaseDir",
  "metadataPath",
  "checklistPath"
] as const;

const SUMMARY_COUNT_KEYS = [
  ["commands", "commands"],
  ["phases", "phases"],
  ["plans", "plans"],
  ["waves", "waves"],
  ["summaries", "summaries"],
  ["completedPlans", "completed plans"],
  ["pendingPlans", "pending plans"],
  ["artifacts", "artifacts"],
  ["reports", "reports"],
  ["files", "files"],
  ["steps", "steps"],
  ["notes", "notes"],
  ["findings", "findings"],
  ["followUps", "follow-ups"],
  ["entries", "entries"],
  ["backlogItems", "backlog items"],
  ["selectedBacklogIds", "selected backlog items"],
  ["promotedItems", "promoted items"],
  ["missingPlans", "missing plans"],
  ["createdFiles", "created files"],
  ["reusedFiles", "reused files"],
  ["updatedKeys", "updated keys"],
  ["syncedFields", "synced fields"],
  ["updatedFields", "updated fields"],
  ["createdEntryIds", "created entries"],
  ["matchedEntryIds", "matched entries"],
  ["duplicateEntryIds", "duplicates"],
  ["renumberedPhases", "renumbered phases"],
  ["createdPhaseDirs", "phase directories"],
  ["summaryPaths", "summary links"],
  ["warnings", "warnings"],
  ["issues", "issues"],
  ["suggestedRepairs", "repairs"]
] as const satisfies ReadonlyArray<readonly [string, string]>;

const DIAGNOSTIC_SUMMARY_LIMIT = 3;
const MAX_DIAGNOSTIC_SUMMARY_LENGTH = 1500;
const NON_SUCCESS_SUMMARY_STATUSES = new Set(MUTATION_FAILURE_STATUSES);

function findSummaryPath(result: ToolResult): string | null {
  for (const key of SUMMARY_PATH_KEYS) {
    const value = getString(result, key);
    if (value) {
      return value;
    }
  }

  return null;
}

function humanizeIdentifier(value: string): string {
  return value.replace(/[_-]+/g, " ").trim();
}

function formatByteCount(byteCount: number): string {
  if (byteCount < 1024) {
    return `${byteCount} B`;
  }

  if (byteCount < 1024 * 1024) {
    return `${(byteCount / 1024).toFixed(1)} KB`;
  }

  return `${(byteCount / (1024 * 1024)).toFixed(1)} MB`;
}

function cleanSentenceFragment(value: string): string {
  return value.trim().replace(/[.!\s]+$/u, "");
}

function truncateDiagnosticSummary(value: string): string {
  if (value.length <= MAX_DIAGNOSTIC_SUMMARY_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_DIAGNOSTIC_SUMMARY_LENGTH - 3).trimEnd()}...`;
}

function collectStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function addDiagnosticMessage(messages: string[], value: unknown): void {
  if (typeof value !== "string") {
    return;
  }

  const normalized = cleanSentenceFragment(value.replace(/\s+/g, " "));

  if (normalized.length > 0 && !messages.includes(normalized)) {
    messages.push(truncateDiagnosticSummary(normalized));
  }
}

function collectResultDiagnostics(result: ToolResult): string[] {
  const messages: string[] = [];
  const validation = asRecord(result.validation);

  for (const issue of collectStringArray(validation?.issues)) {
    addDiagnosticMessage(messages, issue);
  }

  for (const issue of collectStringArray(result.issues)) {
    addDiagnosticMessage(messages, issue);
  }

  if (Array.isArray(result.diagnostics)) {
    for (const diagnostic of result.diagnostics) {
      if (typeof diagnostic === "string") {
        addDiagnosticMessage(messages, diagnostic);
      } else {
        addDiagnosticMessage(messages, asRecord(diagnostic)?.message);
      }
    }
  }

  return messages;
}

function buildDiagnosticSuffix(status: string | null, result: ToolResult): string {
  if (!status || !MUTATION_FAILURE_STATUSES.has(status)) {
    return "";
  }

  const diagnostics = collectResultDiagnostics(result);

  if (diagnostics.length === 0) {
    return "";
  }

  const visibleDiagnostics = diagnostics.slice(0, DIAGNOSTIC_SUMMARY_LIMIT);
  const remainingCount = diagnostics.length - visibleDiagnostics.length;
  const remainingSuffix = remainingCount > 0 ? ` (+${remainingCount} more)` : "";

  return ` Diagnostics: ${visibleDiagnostics.join("; ")}${remainingSuffix}.`;
}

function buildSubject(toolName: string, result: ToolResult): string {
  const phaseNumber = getString(result, "phaseNumber");
  const artifact = getString(result, "artifact");
  const planId = getString(result, "planId");
  const scope = getString(result, "scope");

  if (phaseNumber && artifact) {
    return `Phase ${phaseNumber} ${artifact.toLowerCase()}`;
  }

  if (phaseNumber && planId) {
    return `Phase ${phaseNumber} plan ${planId}`;
  }

  if (phaseNumber) {
    return `Phase ${phaseNumber}`;
  }

  if (scope && toolName.startsWith("blueprint_config_")) {
    return `${scope} config`;
  }

  if (toolName === "blueprint_command_catalog") {
    return "command catalog";
  }

  if (toolName === "blueprint_project_status") {
    return "project status";
  }

  if (toolName === "blueprint_artifact_list") {
    return "artifact inventory";
  }

  if (toolName === "blueprint_codebase_artifact_write") {
    return "codebase artifact";
  }

  if (toolName === "blueprint_review_scope") {
    return "review scope";
  }

  if (toolName === "blueprint_update_check") {
    return "Blueprint update status";
  }

  if (toolName === "blueprint_update_plan") {
    return "Blueprint update plan";
  }

  if (toolName === "blueprint_workstream_list") {
    return "workstreams";
  }

  if (toolName === "blueprint_workstream_mutate") {
    return "workstream state";
  }

  return humanizeIdentifier(toolName.replace(/^blueprint_/, ""));
}

function buildCountSummary(result: ToolResult): string[] {
  const fragments: string[] = [];

  for (const [key, label] of SUMMARY_COUNT_KEYS) {
    const count = getArrayCount(result, key);
    if (count && count > 0) {
      fragments.push(`${count} ${label}`);
    }

    if (fragments.length === 2) {
      break;
    }
  }

  return fragments;
}

function buildUpdatePlanNotSavedCountSummary(result: ToolResult): string[] {
  const fragments: string[] = [];

  for (const [key, label] of [
    ["steps", "steps"],
    ["notes", "notes"],
    ["warnings", "warnings"]
  ] as const) {
    const count = getArrayCount(result, key);

    if (count && count > 0) {
      fragments.push(`${count} ${label}`);
    }
  }

  return fragments;
}

function formatPositiveCount(result: ToolResult, key: string, label: string): string | null {
  const count = getArrayCount(result, key);

  return count && count > 0 ? `${count} ${label}` : null;
}

function buildPatchReapplySummary(result: ToolResult): string {
  const status = getString(result, "status");
  const preview = getBoolean(result, "preview") === true;
  const conflictCount = getArrayCount(result, "conflicts") ?? 0;
  const skippedCount = getArrayCount(result, "skippedPatches") ?? 0;
  const rollback = asRecord(result.rollback);
  const rollbackAttempted = rollback ? getBoolean(rollback, "attempted") === true : false;
  const rollbackSucceeded = rollback ? getBoolean(rollback, "succeeded") === true : false;
  const details = [
    status ? `status: ${status}` : null,
    formatPositiveCount(result, "appliedPatches", "applied patches"),
    formatPositiveCount(result, "skippedPatches", "skipped patches"),
    rollbackAttempted ? `rollback ${rollbackSucceeded ? "succeeded" : "incomplete"}` : null,
    formatPositiveCount(result, "conflicts", "conflicts")
  ].filter((detail): detail is string => detail !== null);
  const suffix = details.length > 0 ? ` (${details.join(", ")})` : "";

  if (status === "partial") {
    return `Patch replay failed after partially mutating the working tree${suffix}.`;
  }

  if (status === "failed" && rollbackAttempted && rollbackSucceeded) {
    return `Patch replay failed after mutation and rolled back affected files${suffix}.`;
  }

  if (conflictCount > 0 || skippedCount > 0 || status === "blocked" || status === "failed") {
    return preview
      ? `Patch replay preview did not apply recorded patches${suffix}.`
      : `Did not reapply recorded patches${suffix}.`;
  }

  if (preview || status === "preview") {
    return `Previewed recorded patches${suffix}.`;
  }

  if (status === "skipped") {
    return `Skipped patch reapply${suffix}.`;
  }

  return `Reapplied recorded patches${suffix}.`;
}

function buildCleanupReportNotWrittenSummary(result: ToolResult): string {
  const status = getString(result, "status");
  const reportPath = getString(result, "reportPath");
  const reason = getString(result, "reason");
  const details = [
    status ? `status: ${status}` : null,
    formatPositiveCount(result, "archivedPhaseDirs", "archived phase directories"),
    formatPositiveCount(result, "failedPhaseDirs", "failed phase directories"),
    formatPositiveCount(result, "skippedPhaseDirs", "skipped phase directories"),
    formatPositiveCount(result, "keptPhaseDirs", "kept phase directories"),
    formatPositiveCount(result, "issues", "issues")
  ].filter((detail): detail is string => detail !== null);
  const location = reportPath ? ` at \`${reportPath}\`` : "";
  const detailSuffix = details.length > 0 ? ` (${details.join(", ")})` : "";
  const reasonSuffix = reason ? ` Reason: ${cleanSentenceFragment(reason)}.` : "";

  return `Cleanup archive report was not written${location}${detailSuffix}.${reasonSuffix}`;
}

function getNonSuccessSummaryVerb(status: string, preferredVerb?: string | null): string {
  if (status === "invalid" && preferredVerb) {
    return preferredVerb;
  }

  switch (status) {
    case "invalid":
      return "Invalid";
    case "project_missing":
      return "Project missing";
    case "not_found":
      return "Not found";
    case "blocked":
      return "Blocked";
    case "refused":
      return "Refused";
    case "rejected":
      return "Rejected";
    case "failed":
    case "error":
      return "Failed";
    case "partial":
      return "Partially completed";
    case "stale":
    default:
      return "Did not complete";
  }
}

function buildNonSuccessStatusSummary(
  toolName: string,
  subject: string,
  status: string,
  result: ToolResult,
  preferredVerb?: string | null
): string {
  const reason = getString(result, "reason");
  const waitingState = getString(result, "waitingState");
  const path = findSummaryPath(result);
  const content = getString(result, "content");
  const mutationFlags = buildMutationFlags(toolName, result);
  const countSummary = buildCountSummary(result);
  const details: string[] = [];

  if (path) {
    details.push(`at \`${path}\``);
  }

  if (content) {
    details.push(`(${formatByteCount(Buffer.byteLength(content, "utf8"))})`);
  }

  if (mutationFlags.length > 0) {
    details.push(`(${mutationFlags.join(", ")})`);
  }

  details.push(`status: ${status}`);

  if (waitingState) {
    details.push(`waitingState: ${waitingState}`);
  }

  if (reason) {
    details.push(`reason: ${cleanSentenceFragment(reason)}`);
  }

  if (countSummary.length > 0) {
    details.push(`(${countSummary.join(", ")})`);
  }

  const detailSuffix = details.length > 0 ? ` ${details.join(" ")}` : "";
  const diagnosticSuffix = buildDiagnosticSuffix(status, result);

  return `${getNonSuccessSummaryVerb(status, preferredVerb)} ${subject}${detailSuffix}.${diagnosticSuffix}`;
}

function buildStateNoopSummary(toolName: string, result: ToolResult): string | null {
  const updated = getBoolean(result, "updated");
  const synced = getBoolean(result, "synced");
  const updatedFieldCount = getArrayCount(result, "updatedFields");
  const syncedFieldCount = getArrayCount(result, "syncedFields");
  const path = findSummaryPath(result);
  const location = path ? ` at \`${path}\`` : "";

  if (
    toolName === "blueprint_state_update" &&
    (updated === false || updatedFieldCount === 0)
  ) {
    return `No state changes${location}.`;
  }

  if (
    toolName === "blueprint_state_sync" &&
    (synced === false || syncedFieldCount === 0)
  ) {
    return `State already synchronized${location}.`;
  }

  return null;
}

function buildMutationFlags(toolName: string, result: ToolResult): string[] {
  const flags: string[] = [];

  for (const key of ["created", "written", "updated", "deleted", "overwritten"] as const) {
    if (toolName === "blueprint_state_update" && key === "updated") {
      continue;
    }

    if (getBoolean(result, key)) {
      flags.push(key);
    }
  }

  return flags;
}

function getOperationVerb(toolName: string): string {
  if (toolName.endsWith("_read") || toolName.endsWith("_get") || toolName.endsWith("_load")) {
    return "Loaded";
  }

  if (toolName.endsWith("_write") || toolName.endsWith("_put")) {
    return "Saved";
  }

  if (toolName.endsWith("_set") || toolName.endsWith("_update")) {
    return "Updated";
  }

  if (toolName.endsWith("_list")) {
    return "Listed";
  }

  if (toolName.endsWith("_index")) {
    return "Indexed";
  }

  if (toolName.endsWith("_validate")) {
    return "Validated";
  }

  if (toolName.endsWith("_status")) {
    return "Checked";
  }

  if (toolName.endsWith("_check")) {
    return "Checked";
  }

  if (toolName.endsWith("_plan")) {
    return "Prepared";
  }

  return "Completed";
}

function summarizeMutationOutcome(toolName: string, result: ToolResult): string | null {
  const status = getString(result, "status");
  const written = getBoolean(result, "written");
  const updated = getBoolean(result, "updated");
  const deleted = getBoolean(result, "deleted");

  if (toolName.endsWith("_write") || toolName.endsWith("_put")) {
    if (status === "reused" || written === false) {
      if (status === "reused") {
        return "Reused existing";
      }

      if (status === "invalid") {
        return "Did not save";
      }
    }
  }

  if (toolName.endsWith("_set") || toolName.endsWith("_update")) {
    if (status === "reused" || updated === false) {
      if (status === "reused") {
        return "Reused existing";
      }

      if (status === "invalid") {
        return "Did not update";
      }
    }
  }

  if (toolName.endsWith("_delete") && deleted === false && status === "invalid") {
    return "Did not delete";
  }

  return null;
}

export function summarizeToolResult(toolName: string, result: ToolResult): string {
  const subject = buildSubject(toolName, result);
  const reason = getString(result, "reason");
  const path = findSummaryPath(result);
  const nextAction = getNextAction(result);
  const found = getBoolean(result, "found");
  const phaseFound = getBoolean(result, "phaseFound");
  const content = getString(result, "content");
  const status = getString(result, "status");
  const mutationFlags = buildMutationFlags(toolName, result);
  const countSummary = buildCountSummary(result);
  const mutationOutcomeVerb = summarizeMutationOutcome(toolName, result);
  const operationVerb = mutationOutcomeVerb ?? getOperationVerb(toolName);

  if (toolName === "blueprint_patch_reapply") {
    return buildPatchReapplySummary(result);
  }

  const stateNoopSummary = buildStateNoopSummary(toolName, result);

  if (stateNoopSummary !== null) {
    return stateNoopSummary;
  }

  if (
    toolName === "blueprint_update_plan" &&
    getString(result, "persistenceStatus") === "not_saved"
  ) {
    const savedPaths = asRecord(result.savedPaths);
    const intendedPath = getString(result, "intendedPath") ??
      (savedPaths ? getString(savedPaths, "metadataPath") : null);
    const notSavedCountSummary = buildUpdatePlanNotSavedCountSummary(result);
    const notSavedDetails = [
      intendedPath ? `intended path \`${intendedPath}\`` : null,
      notSavedCountSummary.length > 0
        ? `(${notSavedCountSummary.join(", ")})`
        : null
    ].filter((detail): detail is string => detail !== null);
    const notSavedSuffix = notSavedDetails.length > 0
      ? `; ${notSavedDetails.join(" ")}`
      : "";

    return `Did not save ${subject}${notSavedSuffix}.`;
  }

  if (status && NON_SUCCESS_SUMMARY_STATUSES.has(status)) {
    return buildNonSuccessStatusSummary(toolName, subject, status, result, mutationOutcomeVerb);
  }

  if (
    toolName === "blueprint_cleanup_archive" &&
    getString(result, "mode") === "commit" &&
    getString(result, "reportPath") &&
    getBoolean(result, "reportWritten") === false
  ) {
    return buildCleanupReportNotWrittenSummary(result);
  }

  if (phaseFound === false) {
    return reason
      ? `Phase lookup failed for ${subject}: ${cleanSentenceFragment(reason)}.`
      : `Phase lookup failed for ${subject}.`;
  }

  if (found === false) {
    return reason
      ? `No ${subject} found: ${cleanSentenceFragment(reason)}.`
      : `No ${subject} found.`;
  }

  const details: string[] = [];

  if (path) {
    details.push(`at \`${path}\``);
  }

  if (content) {
    details.push(`(${formatByteCount(Buffer.byteLength(content, "utf8"))})`);
  }

  if (mutationFlags.length > 0) {
    details.push(`(${mutationFlags.join(", ")})`);
  }

  if (status && status !== "ok" && status !== "success") {
    details.push(`status: ${status}`);
  }

  if (countSummary.length > 0) {
    details.push(`(${countSummary.join(", ")})`);
  }

  const detailSuffix = details.length > 0 ? ` ${details.join(" ")}` : "";
  const guidanceSuffix =
    nextAction && (toolName === "blueprint_project_init" || toolName === "blueprint_project_status")
      ? ` Next action: ${cleanSentenceFragment(nextAction)}.`
      : "";
  const diagnosticSuffix = buildDiagnosticSuffix(status, result);

  return `${operationVerb} ${subject}${detailSuffix}.${diagnosticSuffix}${guidanceSuffix}`;
}
