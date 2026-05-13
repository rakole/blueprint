import type { ToolDefinition, ToolResult } from "./tool-types.js";
import { getBoolean, getString } from "./tool-result-utils.js";
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
  "blueprint_phase_plan_write",
  "blueprint_phase_summary_write",
  "blueprint_phase_validation_write",
  "blueprint_phase_checkpoint_put",
  "blueprint_phase_checkpoint_delete",
  "blueprint_artifact_scaffold",
  "blueprint_codebase_artifact_write",
  "blueprint_artifact_mutate_index",
  "blueprint_artifact_report_write",
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
export const MUTATION_FAILURE_STATUSES = new Set([
  "invalid",
  "project_missing",
  "not_found",
  "blocked",
  "rejected",
  "error"
]);

export function isMutationTool(toolName: string): boolean {
  return BLUEPRINT_MUTATION_TOOL_NAMES.has(toolName);
}

export function shouldLogMutationFailure(
  toolName: string,
  result: ToolResult
): boolean {
  if (!isMutationTool(toolName)) {
    return false;
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

    if (shouldLogMutationFailure(definition.name, result)) {
      await logRejectedMutationResult(definition.name, args, result);
    }

    return result;
  } catch (error) {
    if (isMutationTool(definition.name)) {
      await logThrownMutationError(definition.name, args, error);
    }

    throw error;
  }
}
