import type { ToolDefinition, ToolResult } from "./tool-types.js";
import { getArrayCount, getBoolean, getString } from "./tool-result-utils.js";
import {
  logRejectedMutationResult,
  logThrownMutationError
} from "./write-failure-log.js";

export const BLUEPRINT_MUTATION_TOOL_NAMES = new Set([
  "blueprint_project_init",
  "blueprint_config_set",
  "blueprint_config_set_profile",
  "blueprint_state_update",
  "blueprint_pause_handoff_write",
  "blueprint_state_sync",
  "blueprint_roadmap_add_phase",
  "blueprint_roadmap_insert_phase",
  "blueprint_roadmap_remove_phase",
  "blueprint_roadmap_promote_backlog",
  "blueprint_phase_artifact_scaffold",
  "blueprint_phase_artifact_write",
  "blueprint_phase_ui_skip_write",
  "blueprint_phase_plan_write",
  "blueprint_phase_summary_write",
  "blueprint_phase_validation_write",
  "blueprint_phase_checkpoint_put",
  "blueprint_phase_checkpoint_delete",
  "blueprint_phase_execution_prepare",
  "blueprint_phase_execution_apply",
  "blueprint_phase_execution_verify",
  "blueprint_phase_execution_finalize",
  "blueprint_plan_run_record",
  "blueprint_plan_run_prepare",
  "blueprint_plan_run_patch_record",
  "blueprint_artifact_scaffold",
  "blueprint_codebase_artifact_write",
  "blueprint_artifact_mutate_index",
  "blueprint_artifact_report_write",
  "blueprint_pr_branch_execute",
  "blueprint_pr_branch_persist",
  "blueprint_ship_execute",
  "blueprint_ship_persist",
  "blueprint_undo_execute",
  "blueprint_undo_persist",
  "blueprint_cleanup_archive",
  "blueprint_review_record",
  "blueprint_god_review_start",
  "blueprint_god_review_append",
  "blueprint_god_review_record_fix",
  "blueprint_god_review_cleanup",
  "blueprint_impact_report_write",
  "blueprint_update_plan",
  "blueprint_workspace_create",
  "blueprint_workspace_remove",
  "blueprint_workstream_mutate",
  "blueprint_patch_record",
  "blueprint_patch_reapply"
]);
// These statuses mean a mutating tool either rejected a write attempt or stopped
// before side effects because its write preconditions were not satisfied.
export const MUTATION_FAILURE_STATUSES = new Set([
  "invalid",
  "project_missing",
  "not_found",
  "blocked",
  "rejected",
  "stale",
  "refused",
  "partial",
  "failed",
  "error",
  "outcome-unknown"
]);

export function isMutationTool(toolName: string): boolean {
  return BLUEPRINT_MUTATION_TOOL_NAMES.has(toolName);
}

function isReadOnlyPreviewInvocation(
  toolName: string,
  args: Record<string, unknown>
): boolean {
  if (toolName === "blueprint_cleanup_archive") {
    return (args.mode ?? "preview") === "preview";
  }

  if (toolName === "blueprint_plan_run_prepare") {
    return (args.mode ?? "preview") === "preview";
  }

  if (toolName === "blueprint_phase_execution_prepare") {
    return (args.mode ?? "preview") === "preview";
  }

  if (toolName === "blueprint_undo_execute") {
    return false;
  }

  if (toolName === "blueprint_ship_execute") {
    return false;
  }

  if (toolName === "blueprint_roadmap_promote_backlog") {
    const backlogIds = Array.isArray(args.backlogIds)
      ? args.backlogIds.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0
        )
      : [];

    return args.previewOnly === true || backlogIds.length === 0;
  }

  if (toolName === "blueprint_artifact_mutate_index") {
    return args.action === "list";
  }

  return toolName === "blueprint_patch_reapply" && args.dryRun === true;
}

export function shouldLogMutationFailure(
  toolName: string,
  result: ToolResult,
  args: Record<string, unknown> = {}
): boolean {
  if (!isMutationTool(toolName)) {
    return false;
  }

  if (
    isReadOnlyPreviewInvocation(toolName, args) ||
    (toolName === "blueprint_patch_reapply" && getBoolean(result, "preview") === true)
  ) {
    return false;
  }

  if (
    toolName === "blueprint_update_plan" &&
    getString(result, "persistenceStatus") === "not_saved"
  ) {
    return true;
  }

  if (
    toolName === "blueprint_cleanup_archive" &&
    getString(result, "mode") === "commit" &&
    getString(result, "reportPath") &&
    getBoolean(result, "reportWritten") === false
  ) {
    return true;
  }

  if (
    toolName === "blueprint_patch_reapply" &&
    ((getArrayCount(result, "conflicts") ?? 0) > 0 ||
      (getArrayCount(result, "skippedPatches") ?? 0) > 0)
  ) {
    return true;
  }

  const status = getString(result, "status");

  if (status && MUTATION_FAILURE_STATUSES.has(status)) {
    return true;
  }

  if (toolName.endsWith("_delete")) {
    return getBoolean(result, "deleted") === false;
  }

  return false;
}

export async function executeToolHandlerWithFailureLogging(
  definition: ToolDefinition,
  args: Record<string, unknown>
): Promise<ToolResult> {
  try {
    const result = await definition.handler(args as Record<string, unknown>);

    if (shouldLogMutationFailure(definition.name, result, args)) {
      await logRejectedMutationResult(definition.name, args, result);
    }

    return result;
  } catch (error) {
    if (
      isMutationTool(definition.name) &&
      !isReadOnlyPreviewInvocation(definition.name, args)
    ) {
      await logThrownMutationError(definition.name, args, error);
    }

    throw error;
  }
}
