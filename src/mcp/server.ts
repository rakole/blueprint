import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pathToFileURL } from "node:url";
import type { ZodType } from "zod/v4";

import { artifactToolDefinitions } from "./tools/artifacts.js";
import { configToolDefinitions } from "./tools/config.js";
import { phaseToolDefinitions } from "./tools/phase.js";
import { projectToolDefinitions } from "./tools/project.js";
import { reviewToolDefinitions } from "./tools/review.js";
import { stateToolDefinitions } from "./tools/state.js";

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
  ...artifactToolDefinitions
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
  "blueprint_artifact_summary_digest"
] as const;

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
  "phaseDir"
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

  if (toolName === "blueprint_review_scope") {
    return "review scope";
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

  return `${operationVerb} ${subject}${detailSuffix}.`;
}

export function createToolResponseContent(
  toolName: string,
  result: ToolResult
): Array<{ type: "text"; text: string }> {
  return [
    {
      type: "text",
      text: summarizeToolResult(toolName, result)
    }
  ];
}

export function createBlueprintServer(): McpServer {
  const server = new McpServer({
    name: "blueprint",
    version: "0.1.0"
  });

  for (const definition of TOOL_DEFINITIONS) {
    server.registerTool(
      definition.name,
      {
        description: definition.description,
        inputSchema: definition.inputSchema ?? {}
      },
      async (args: Record<string, unknown>) => {
        const result = await definition.handler(args as Record<string, unknown>);

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
