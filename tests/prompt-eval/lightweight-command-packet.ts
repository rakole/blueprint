import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildBlueprintCommandRuntimeContractResource,
  type BlueprintCommandRuntimeContractResource
} from "../../src/mcp/command-resources.js";
import {
  getRuntimeOwnedCommandMetadata,
  type RuntimeOwnedCommandMetadata
} from "../../src/mcp/command-runtime-metadata.js";
import type { BlueprintSkillResolvedInputs } from "../../src/mcp/skill-metadata.js";

const repoRoot = process.cwd();

export const LIGHTWEIGHT_COMMANDS = ["fast", "quick"] as const;

export type LightweightCommandName = (typeof LIGHTWEIGHT_COMMANDS)[number];

export type LightweightCommandGolden = {
  command: LightweightCommandName;
  primarySkill: string;
  executionProfile: string;
  requiredTools: string[];
  optionalAgents: string[];
  inputBundlePaths: string[];
  allowedPersistenceTools: string[];
  forbiddenPersistencePatterns: string[];
  confirmationGates: string[];
  routingBoundaries: string[];
  finalResponseRequirements: string[];
};

export type LightweightCommandPacket = {
  command: LightweightCommandName;
  manifestPath: string;
  manifestPrompt: string;
  primarySkill: string;
  skillPath: string | null;
  skillInputBundles: BlueprintSkillResolvedInputs;
  inputBundlePaths: string[];
  activeInputTexts: Record<string, string>;
  promptSurfaceText: string;
  commandSpecificRuntimeReferencePath: string | null;
  commandSpecificRuntimeReferenceText: string | null;
  runtimeMetadata: RuntimeOwnedCommandMetadata;
  runtimeContractResource: BlueprintCommandRuntimeContractResource;
  requiredTools: string[];
  optionalAgents: string[];
  executionProfile: string;
  allowedPersistenceTools: string[];
  forbiddenPersistencePatterns: string[];
  confirmationGates: string[];
  routingBoundaries: string[];
  finalResponseRequirements: string[];
  siblingCommandInputLeaks: string[];
  golden: LightweightCommandGolden;
};

type LightweightRuleSet = Omit<
  LightweightCommandGolden,
  "command" | "primarySkill" | "executionProfile" | "requiredTools" | "optionalAgents" | "inputBundlePaths"
>;

const READ_ONLY_TOOLS = new Set(["blueprint_lightweight_preflight"]);

const COMMAND_RULES: Record<LightweightCommandName, LightweightRuleSet> = {
  fast: {
    allowedPersistenceTools: ["blueprint_state_update"],
    forbiddenPersistencePatterns: [
      "no quick-run reports",
      "no phase summaries or artifacts",
      "no ad hoc Blueprint persistence",
      "no tracker or visible-progress tools"
    ],
    confirmationGates: [],
    routingBoundaries: [
      "partial or unhealthy Blueprint routes to /blu-health before persistence",
      "larger work routes to /blu-quick or /blu-plan-phase",
      "follow-up recommendations stay implemented-only"
    ],
    finalResponseRequirements: [
      "explain why the task qualified as fast",
      "state whether Blueprint state was updated",
      "include warnings or reroutes",
      "include the next safe implemented action when applicable"
    ]
  },
  quick: {
    allowedPersistenceTools: [
      "blueprint_artifact_report_write",
      "blueprint_state_update"
    ],
    forbiddenPersistencePatterns: [
      "do not hand-address .blueprint/reports/quick-run-latest.md",
      "do not pass Markdown report content",
      "session-local progress tools never replace MCP persistence",
      "do not invent phase, research, or validation artifacts"
    ],
    confirmationGates: [
      "quick-run report overwrite unless --force",
      "external-service or runtime dependencies",
      "destructive operations outside the bounded task",
      "scope expansion beyond quick"
    ],
    routingBoundaries: [
      "uninitialized Blueprint routes to /blu-new-project",
      "partial or unhealthy Blueprint routes to /blu-health",
      "saved phase plan or multi-wave work routes to /blu-plan-phase or /blu-execute-phase",
      "follow-up recommendations stay implemented-only"
    ],
    finalResponseRequirements: [
      "include only the bounded task outcome",
      "include validation outcome with skipped or repair-attempt detail when relevant",
      "include authoritative quick-run report status and path",
      "include the next safe implemented action",
      "leave gates, risks, tracker detail, and deferred work in the durable report unless blocking"
    ]
  }
};

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function extractTripleQuotedTomlValue(content: string, key: string): string {
  const match = content.match(new RegExp(`${key}\\s*=\\s*\"\"\"([\\s\\S]*?)\"\"\"`));

  assert.ok(match, `Missing triple-quoted TOML value for ${key}`);
  return match[1].trim();
}

function commandManifestPath(command: LightweightCommandName): string {
  return `commands/blu-${command}.toml`;
}

function commandSpecificRuntimeReferencePath(
  inputBundlePaths: string[]
): string | null {
  return (
    inputBundlePaths.find(
      (relativePath) =>
        relativePath.includes("/references/") &&
        relativePath.endsWith("runtime-contract.md")
    ) ?? null
  );
}

function allowedPersistenceTools(requiredTools: readonly string[]): string[] {
  return requiredTools.filter(
    (toolName) =>
      !READ_ONLY_TOOLS.has(toolName) &&
      /(write|update|mutate|record|set|remove|add|scaffold)/.test(toolName)
  );
}

function siblingCommandInputLeaks(
  command: LightweightCommandName,
  inputBundlePaths: string[]
): string[] {
  const siblingNeedles = LIGHTWEIGHT_COMMANDS.flatMap((candidate) =>
    candidate === command
      ? []
      : [
          `commands/blu-${candidate}.toml`,
          `skills/blueprint-phase-execution/references/${candidate}-runtime-contract.md`
        ]
  ).concat([
    "commands/blu-execute-phase.toml",
    "skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md"
  ]);

  return inputBundlePaths.filter((relativePath) =>
    siblingNeedles.some((needle) => relativePath === needle)
  );
}

export async function buildLightweightCommandPacket(
  command: LightweightCommandName
): Promise<LightweightCommandPacket> {
  const [manifestFile, runtimeContractResource] = await Promise.all([
    readRepoFile(commandManifestPath(command)),
    buildBlueprintCommandRuntimeContractResource(command)
  ]);
  const runtimeMetadata = getRuntimeOwnedCommandMetadata(command);

  assert.ok(runtimeMetadata, `Missing runtime metadata for ${command}`);

  const manifestPrompt = extractTripleQuotedTomlValue(manifestFile, "prompt");
  const inputBundlePaths = [...runtimeContractResource.skillInputs.effective];
  const activeInputTexts = Object.fromEntries(
    await Promise.all(
      inputBundlePaths.map(async (relativePath) => [relativePath, await readRepoFile(relativePath)])
    )
  );
  const commandSpecificReferencePath =
    commandSpecificRuntimeReferencePath(inputBundlePaths);
  const commandSpecificReferenceText = commandSpecificReferencePath
    ? activeInputTexts[commandSpecificReferencePath]
    : null;
  const requiredTools = [...runtimeMetadata.requiredTools];
  const optionalAgents = [...runtimeMetadata.optionalAgents];
  const executionProfile = runtimeMetadata.spec.executionProfile;
  const allowedPersistence = allowedPersistenceTools(requiredTools);
  const siblingLeaks = siblingCommandInputLeaks(command, inputBundlePaths);
  const rules = COMMAND_RULES[command];
  const golden: LightweightCommandGolden = {
    command,
    primarySkill: runtimeMetadata.catalog.primarySkill,
    executionProfile,
    requiredTools,
    optionalAgents,
    inputBundlePaths,
    allowedPersistenceTools: allowedPersistence,
    forbiddenPersistencePatterns: [...rules.forbiddenPersistencePatterns],
    confirmationGates: [...rules.confirmationGates],
    routingBoundaries: [...rules.routingBoundaries],
    finalResponseRequirements: [...rules.finalResponseRequirements]
  };

  return {
    command,
    manifestPath: commandManifestPath(command),
    manifestPrompt,
    primarySkill: runtimeMetadata.catalog.primarySkill,
    skillPath: runtimeContractResource.catalog.skillPath,
    skillInputBundles: runtimeContractResource.skillInputs,
    inputBundlePaths,
    activeInputTexts,
    promptSurfaceText: inputBundlePaths
      .map((relativePath) => activeInputTexts[relativePath])
      .join("\n\n"),
    commandSpecificRuntimeReferencePath: commandSpecificReferencePath,
    commandSpecificRuntimeReferenceText: commandSpecificReferenceText,
    runtimeMetadata,
    runtimeContractResource,
    requiredTools,
    optionalAgents,
    executionProfile,
    allowedPersistenceTools: [...allowedPersistence],
    forbiddenPersistencePatterns: [...rules.forbiddenPersistencePatterns],
    confirmationGates: [...rules.confirmationGates],
    routingBoundaries: [...rules.routingBoundaries],
    finalResponseRequirements: [...rules.finalResponseRequirements],
    siblingCommandInputLeaks: siblingLeaks,
    golden
  };
}
