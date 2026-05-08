import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pathToFileURL } from "node:url";
import type { ZodType } from "zod/v4";

import {
  logRejectedMutationResult,
  logThrownMutationError
} from "./write-failure-log.js";
import { registerBlueprintCommandResources } from "./command-resources.js";
import { artifactToolDefinitions } from "./tools/artifacts.js";
import { configToolDefinitions } from "./tools/config.js";
import { impactToolDefinitions } from "./tools/impact.js";
import { phaseToolDefinitions } from "./tools/phase.js";
import { projectToolDefinitions } from "./tools/project.js";
import { reviewToolDefinitions } from "./tools/review.js";
import { stateToolDefinitions } from "./tools/state.js";
import { updateToolDefinitions } from "./tools/update.js";
import { workspaceToolDefinitions } from "./tools/workspace.js";

type ToolResult = Record<string, unknown>;
type ToolDefinition = {
  name: string;
  description: string;
  inputSchema?: Record<string, ZodType>;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
};

const TOOL_DEFINITIONS: ToolDefinition[] = [
  ...projectToolDefinitions,
  ...configToolDefinitions,
  ...stateToolDefinitions,
  ...phaseToolDefinitions,
  ...reviewToolDefinitions,
  ...artifactToolDefinitions,
  ...impactToolDefinitions,
  ...updateToolDefinitions,
  ...workspaceToolDefinitions
];

const REQUIRED_CONFIG_TOOL_NAMES = [
  "blueprint_config_get",
  "blueprint_config_set",
  "blueprint_config_set_profile"
] as const;
const REQUIRED_READ_PATH_TOOL_NAMES = [
  "blueprint_project_status",
  "blueprint_state_load",
  "blueprint_state_sync",
  "blueprint_artifact_list",
  "blueprint_artifact_validate"
] as const;
const REQUIRED_MAPPING_TOOL_NAMES = [
  "blueprint_artifact_summary_digest",
  "blueprint_codebase_artifact_write"
] as const;
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
  "blueprint_impact_report_write",
  "blueprint_update_plan",
  "blueprint_workspace_create",
  "blueprint_workspace_remove",
  "blueprint_workstream_mutate",
  "blueprint_patch_record",
  "blueprint_patch_reapply"
]);
const MUTATION_FAILURE_STATUSES = new Set([
  "invalid",
  "project_missing",
  "not_found",
  "blocked",
  "rejected",
  "error"
]);
const DIAGNOSTIC_SUMMARY_LIMIT = 3;
const MAX_DIAGNOSTIC_SUMMARY_LENGTH = 1000;

for (const toolName of REQUIRED_CONFIG_TOOL_NAMES) {
  if (!TOOL_DEFINITIONS.some((definition) => definition.name === toolName)) {
    throw new Error(`Missing required config tool registration: ${toolName}`);
  }
}

for (const toolName of REQUIRED_READ_PATH_TOOL_NAMES) {
  if (!TOOL_DEFINITIONS.some((definition) => definition.name === toolName)) {
    throw new Error(`Missing required read-path tool registration: ${toolName}`);
  }
}

for (const toolName of REQUIRED_MAPPING_TOOL_NAMES) {
  if (!TOOL_DEFINITIONS.some((definition) => definition.name === toolName)) {
    throw new Error(`Missing required mapping tool registration: ${toolName}`);
  }
}

export const blueprintToolRegistry = Object.fromEntries(
  TOOL_DEFINITIONS.map((definition) => [definition.name, definition])
);

export const blueprintToolNames = TOOL_DEFINITIONS.map(
  (definition) => definition.name
);

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

function getString(result: ToolResult, key: string): string | null {
  const value = result[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getNextAction(result: ToolResult): string | null {
  return getString(result, "nextAction");
}

function getBoolean(result: ToolResult, key: string): boolean | null {
  const value = result[key];
  return typeof value === "boolean" ? value : null;
}

function getArrayCount(result: ToolResult, key: string): number | null {
  const value = result[key];
  return Array.isArray(value) ? value.length : null;
}

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

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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

function buildMutationFlags(result: ToolResult): string[] {
  const flags: string[] = [];

  for (const key of ["created", "written", "updated", "deleted", "overwritten"] as const) {
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
  const mutationFlags = buildMutationFlags(result);
  const countSummary = buildCountSummary(result);
  const operationVerb = summarizeMutationOutcome(toolName, result) ?? getOperationVerb(toolName);

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

const STRUCTURED_CONTENT_HEAVY_TOOL_NAMES = new Set([
  "blueprint_artifact_validate",
  "blueprint_artifact_contract_read",
  "blueprint_phase_plan_authoring_context",
  "blueprint_phase_plan_validate_model",
  "blueprint_phase_plan_write",
  "blueprint_phase_validation_authoring_context",
  "blueprint_phase_validation_validate_model",
  "blueprint_phase_summary_read",
  "blueprint_phase_summary_authoring_context",
  "blueprint_phase_summary_validate_model",
  "blueprint_phase_validation_read",
  "blueprint_review_authoring_context",
  "blueprint_review_validate_model",
  "blueprint_review_record",
  "blueprint_artifact_report_authoring_context",
  "blueprint_artifact_report_validate_model"
]);

function getStructuredContentNote(toolName: string): string {
  return STRUCTURED_CONTENT_HEAVY_TOOL_NAMES.has(toolName)
    ? "Detailed data is available in structuredContent."
    : "";
}

function formatToolResponseText(toolName: string, summary: string): string {
  const note = getStructuredContentNote(toolName);
  return note.length > 0 ? `${summary} ${note}` : summary;
}

export function createToolResponseContent(
  toolName: string,
  result: ToolResult
): Array<{ type: "text"; text: string }> {
  const summary = summarizeToolResult(toolName, result);

  return [
    {
      type: "text",
      text: formatToolResponseText(toolName, summary)
    }
  ];
}

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

export function createBlueprintServer(): McpServer {
  const server = new McpServer({
    name: "blueprint",
    version: "0.1.0"
  });

  registerBlueprintCommandResources(server);

  for (const definition of TOOL_DEFINITIONS) {
    server.registerTool(
      definition.name,
      {
        description: definition.description,
        inputSchema: definition.inputSchema ?? {}
      },
      async (args: Record<string, unknown>) => {
        const result = await executeToolHandlerWithFailureLogging(definition, args);

        return {
          content: createToolResponseContent(definition.name, result),
          structuredContent: result
        };
      }
    );
  }

  return server;
}

export async function startServer(): Promise<void> {
  const transport = new StdioServerTransport();
  const server = createBlueprintServer();

  await server.connect(transport);
}

const entrypoint = process.argv[1];
const isEntrypoint =
  typeof entrypoint === "string" &&
  import.meta.url === pathToFileURL(entrypoint).href;

if (isEntrypoint) {
  startServer().catch((error) => {
    console.error("Blueprint MCP server error:", error);
    process.exit(1);
  });
}
