#!/usr/bin/env tsx

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import {
  getRuntimeOwnedCommandMetadata,
  listRuntimeOwnedCommandMetadata
} from "../src/mcp/command-runtime-metadata.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

type CommandCatalog = Awaited<ReturnType<typeof blueprintCommandCatalog>>;
type CommandCatalogEntry = CommandCatalog["commands"][string];
type RuntimeContract = Awaited<ReturnType<typeof buildBlueprintCommandRuntimeContractResource>>;

type IntentChooserEntry = {
  intent: string;
  commands: string[];
};

type GeneratedIntentChooserEntry = {
  intent: string;
  routes: string[];
};

type GeneratedCommandRegistryEntry = {
  name: string;
  command: string;
  route: string;
  wave: number;
  family: string;
  primarySkill: string;
  declaredStatus: string;
  status: string;
  implemented: boolean;
  runnable: boolean;
  blockedBy: string[];
  manifestPath: string | null;
  skillPath: string | null;
  specPath: string | null;
  sourceId: string | null;
  executionProfile: string | null;
  rootRoutable: boolean | null;
  purpose: string | null;
  reads: string[];
  writes: string[];
  risk: string;
  requiredTools: string[];
  requiredToolsSatisfied: boolean;
  optionalAgents: string[];
  availableOptionalAgents: string[];
  runtimeReference: {
    path: string;
    waveTitle: string;
    command: string;
    primarySkill: string;
    exactMcpDestination: string[];
    optionalAgents: string[];
    hookInvolvement: string[];
    contractNotes: string;
    evidenceState: string[];
  } | null;
};

export type GeneratedCommandRegistry = {
  schemaVersion: 1;
  generatedBy: string;
  source: {
    metadata: string;
    liveCatalogBuilder: string;
  };
  rootRouter: {
    command: "/blu";
    manifestPath: "commands/blu.toml";
    primarySkill: "blueprint-router";
    requiredTools: string[];
    contractNotes: string;
  };
  counts: {
    total: number;
    implemented: number;
    nonRunnable: number;
  };
  intentChooser: GeneratedIntentChooserEntry[];
  commands: GeneratedCommandRegistryEntry[];
};

type GeneratedCommandSurfaces = {
  registry: GeneratedCommandRegistry;
  registryJson: string;
  readmeChooserBlock: string;
  readmeRuntimeLayoutBlock: string;
  readmeWorkflowBlock: string;
  readmeNonPublicBlock: string;
  userDocsIntentBlock: string;
  userDocsLifecycleBlock: string;
  userDocsCommandReference: string;
};

const REGISTRY_PATH = "generated/command-catalog.json";
const README_PATH = "README.md";
const USER_DOCS_QUICKSTART_PATH = "user-docs/quickstart.md";
const USER_DOCS_LIFECYCLE_PATH = "user-docs/lifecycle.md";
const USER_DOCS_COMMAND_REFERENCE_PATH = "user-docs/reference/commands.md";
const ROOT_ROUTER_PATH = "commands/blu.toml";
const GENERATED_BY =
  "scripts/generate-command-registry.ts";
const SOURCE_METADATA =
  "src/mcp/command-runtime-metadata.ts";
const LIVE_CATALOG_BUILDER =
  "src/mcp/tools/project.ts#blueprintCommandCatalog";

const ROOT_ROUTER_REQUIRED_TOOLS = [
  "blueprint_command_catalog",
  "blueprint_project_status",
  "blueprint_config_get"
];

const ROOT_ROUTER_CONTRACT_NOTES =
  "Host-native root router. Read project status and the live command catalog first, then keep every recommendation inside implemented commands only; explain blocked or waiting states instead of routing to planned, blocked, or repairing commands.";

const INTENT_CHOOSER: IntentChooserEntry[] = [
  { intent: "Start fresh", commands: ["new-project"] },
  { intent: "Understand an existing repo", commands: ["map-codebase"] },
  { intent: "Decide next safe action", commands: ["next"] },
  { intent: "Plan implementation", commands: ["plan-phase"] },
  { intent: "Execute safely", commands: ["execute-phase"] },
  { intent: "Prepare isolated plan run", commands: ["run-plan"] },
  { intent: "Review/fix code", commands: ["code-review", "code-review-fix"] },
  { intent: "Ship", commands: ["ship"] }
];

const README_CHOOSER_START = "<!-- command-registry:readme-chooser:start -->";
const README_CHOOSER_END = "<!-- command-registry:readme-chooser:end -->";
const README_RUNTIME_LAYOUT_START = "<!-- command-registry:readme-runtime-layout:start -->";
const README_RUNTIME_LAYOUT_END = "<!-- command-registry:readme-runtime-layout:end -->";
const README_WORKFLOW_START = "<!-- command-registry:readme-workflow:start -->";
const README_WORKFLOW_END = "<!-- command-registry:readme-workflow:end -->";
const README_NON_PUBLIC_START = "<!-- command-registry:readme-non-public:start -->";
const README_NON_PUBLIC_END = "<!-- command-registry:readme-non-public:end -->";
const USER_DOCS_INTENTS_START = "<!-- command-registry:user-docs-intents:start -->";
const USER_DOCS_INTENTS_END = "<!-- command-registry:user-docs-intents:end -->";
const USER_DOCS_LIFECYCLE_START = "<!-- command-registry:user-docs-lifecycle:start -->";
const USER_DOCS_LIFECYCLE_END = "<!-- command-registry:user-docs-lifecycle:end -->";
function sortCommands(
  left: GeneratedCommandRegistryEntry,
  right: GeneratedCommandRegistryEntry
): number {
  return (
    left.wave - right.wave ||
    left.family.localeCompare(right.family) ||
    left.name.localeCompare(right.name)
  );
}

function sortCatalogEntries(
  left: [string, CommandCatalogEntry],
  right: [string, CommandCatalogEntry]
): number {
  return (
    left[1].wave - right[1].wave ||
    left[1].family.localeCompare(right[1].family) ||
    left[0].localeCompare(right[0])
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function inlineCode(value: string): string {
  return `\`${value.replace(/`/g, "'")}\``;
}

function markdownList(values: string[]): string {
  if (values.length === 0) {
    return "none";
  }

  return values.map(inlineCode).join("<br>");
}

function sentence(value: string | null): string {
  const normalized = value?.trim() ?? "";

  if (normalized.length === 0) {
    return "No summary available.";
  }

  const firstSentence = normalized.match(/^.*?(?:\.|$)(?=\s|$)/)?.[0]?.trim();

  return firstSentence && firstSentence.length > 0 ? firstSentence : normalized;
}

function directCommandPlaceholder(command: GeneratedCommandRegistryEntry): string {
  if (command.name === "run-plan") {
    return `${command.command} <phase> <planId>`;
  }

  if (
    [
      "add-tests",
      "audit-fix",
      "code-review",
      "code-review-fix",
      "discuss-phase",
      "execute-phase",
      "list-phase-assumptions",
      "plan-phase",
      "research-phase",
      "review",
      "secure-phase",
      "spec-phase",
      "ui-phase",
      "ui-review",
      "validate-phase",
      "verify-work"
    ].includes(command.name)
  ) {
    return `${command.command} <phase>`;
  }

  return command.command;
}

function plural(count: number, singular: string, pluralValue = `${singular}s`): string {
  return count === 1 ? singular : pluralValue;
}

function getImplementedCommand(
  registry: GeneratedCommandRegistry,
  commandName: string
): GeneratedCommandRegistryEntry {
  const command = registry.commands.find((entry) => entry.name === commandName);

  if (!command) {
    throw new Error(`Intent chooser references unknown command: ${commandName}`);
  }

  if (!command.implemented || !command.runnable) {
    throw new Error(
      `Intent chooser cannot expose non-runnable command ${commandName} (${command.status})`
    );
  }

  return command;
}

function buildIntentChooser(
  commands: GeneratedCommandRegistryEntry[]
): GeneratedIntentChooserEntry[] {
  const registry = {
    commands
  } as GeneratedCommandRegistry;

  return INTENT_CHOOSER.map((entry) => ({
    intent: entry.intent,
    routes: entry.commands.map((commandName) =>
      directCommandPlaceholder(getImplementedCommand(registry, commandName))
    )
  }));
}

function commandWithMetadata(
  commandName: string,
  entry: CommandCatalogEntry,
  contract: RuntimeContract | null
): GeneratedCommandRegistryEntry {
  const metadata = getRuntimeOwnedCommandMetadata(commandName);

  return {
    name: commandName,
    command: entry.command,
    route: entry.route,
    wave: entry.wave,
    family: entry.family,
    primarySkill: entry.primarySkill,
    declaredStatus: entry.declaredStatus,
    status: entry.status,
    implemented: entry.implemented,
    runnable: entry.implemented,
    blockedBy: [...entry.blockedBy],
    manifestPath: entry.manifestPath,
    skillPath: entry.skillPath,
    specPath: entry.specPath,
    sourceId: metadata?.sourceId ?? null,
    executionProfile: metadata?.spec.executionProfile ?? null,
    rootRoutable: metadata?.spec.rootRoutable ?? null,
    purpose: metadata?.spec.purpose ?? null,
    reads: metadata ? [...metadata.spec.reads] : [],
    writes: metadata ? [...metadata.spec.writes] : [],
    risk: entry.risk,
    requiredTools: [...entry.requiredTools],
    requiredToolsSatisfied: entry.requiredToolsSatisfied,
    optionalAgents: [...entry.optionalAgents],
    availableOptionalAgents: [...entry.availableOptionalAgents],
    runtimeReference: contract?.runtimeReference
      ? {
          path: contract.runtimeReference.path,
          waveTitle: contract.runtimeReference.waveTitle ?? entry.family,
          command: contract.runtimeReference.command,
          primarySkill: contract.runtimeReference.primarySkill ?? entry.primarySkill,
          exactMcpDestination: [...contract.runtimeReference.exactMcpDestination],
          optionalAgents: [...contract.runtimeReference.optionalAgents],
          hookInvolvement: [...contract.runtimeReference.hookInvolvement],
          contractNotes: contract.runtimeReference.contractNotes ?? "",
          evidenceState: [...contract.runtimeReference.evidenceState]
        }
      : null
  };
}

async function buildGeneratedCommand(
  commandName: string,
  entry: CommandCatalogEntry
): Promise<GeneratedCommandRegistryEntry> {
  const contract = entry.implemented
    ? await buildBlueprintCommandRuntimeContractResource(commandName)
    : null;

  return commandWithMetadata(commandName, entry, contract);
}

export async function buildGeneratedCommandRegistry(): Promise<GeneratedCommandRegistry> {
  const catalog = await blueprintCommandCatalog();
  const commands = await Promise.all(
    Object.entries(catalog.commands)
      .sort(sortCatalogEntries)
      .map(([commandName, entry]) => buildGeneratedCommand(commandName, entry))
  );
  const implemented = commands.filter((entry) => entry.implemented);

  for (const metadata of listRuntimeOwnedCommandMetadata()) {
    const command = commands.find((entry) => entry.name === metadata.commandName);

    if (!command) {
      throw new Error(`Runtime metadata is missing from generated catalog: ${metadata.commandName}`);
    }
  }

  return {
    schemaVersion: 1,
    generatedBy: GENERATED_BY,
    source: {
      metadata: SOURCE_METADATA,
      liveCatalogBuilder: LIVE_CATALOG_BUILDER
    },
    rootRouter: {
      command: "/blu",
      manifestPath: ROOT_ROUTER_PATH,
      primarySkill: "blueprint-router",
      requiredTools: ROOT_ROUTER_REQUIRED_TOOLS,
      contractNotes: ROOT_ROUTER_CONTRACT_NOTES
    },
    counts: {
      total: commands.length,
      implemented: implemented.length,
      nonRunnable: commands.length - implemented.length
    },
    intentChooser: buildIntentChooser(commands),
    commands
  };
}

export function renderRegistryJson(registry: GeneratedCommandRegistry): string {
  return `${JSON.stringify(registry, null, 2)}\n`;
}

export function renderReadmeCommandChooser(registry: GeneratedCommandRegistry): string {
  const lines = [
    README_CHOOSER_START,
    "## Command Chooser",
    "",
    "I want to...",
    ...registry.intentChooser.map((entry) => {
      const routes = entry.routes.join(", ");

      return `- ${entry.intent} → ${routes}`;
    }),
    "",
    `This chooser is generated from ${inlineCode(REGISTRY_PATH)}. ${registry.counts.implemented} direct ${plural(registry.counts.implemented, "command")} are runnable now; ${registry.counts.nonRunnable} retained ${plural(registry.counts.nonRunnable, "command")} ${registry.counts.nonRunnable === 1 ? "is" : "are"} kept out of runnable help until the live catalog marks ${registry.counts.nonRunnable === 1 ? "it" : "them"} implemented.`,
    README_CHOOSER_END
  ];

  return lines.join("\n");
}

export function renderReadmeRuntimeLayout(registry: GeneratedCommandRegistry): string {
  const implemented = registry.commands.filter((entry) => entry.implemented);
  const manifestPaths = implemented
    .map((entry) => entry.manifestPath)
    .filter((value): value is string => value !== null)
    .sort();
  const skillPaths = [
    ...new Set(
      implemented
        .map((entry) => entry.skillPath)
        .filter((value): value is string => value !== null)
    )
  ].sort();
  const lines = [
    README_RUNTIME_LAYOUT_START,
    `The active command map is generated from ${inlineCode(SOURCE_METADATA)} into ${inlineCode(REGISTRY_PATH)}. Runtime availability still comes from the live ${inlineCode("blueprint_command_catalog")} check, so missing manifests, skills, MCP tools, or required runtime inputs downgrade commands before they can be recommended.`,
    "",
    "- Root router manifest: `commands/blu.toml`",
    `- Runnable direct command manifests: ${implemented.length}`,
    `- Non-runnable retained ${plural(registry.counts.nonRunnable, "command")}: ${registry.counts.nonRunnable}`,
    "",
    "Runnable command manifests:",
    ...manifestPaths.map((manifestPath) => `- ${inlineCode(manifestPath)}`),
    "",
    "Runtime skill bundles used by runnable commands:",
    ...skillPaths.map((skillPath) => `- ${inlineCode(skillPath)}`),
    README_RUNTIME_LAYOUT_END
  ];

  return lines.join("\n");
}

export function renderReadmeWorkflow(registry: GeneratedCommandRegistry): string {
  const implemented = registry.commands.filter((entry) => entry.implemented).sort(sortCommands);
  const byFamily = new Map<string, GeneratedCommandRegistryEntry[]>();

  for (const command of implemented) {
    const family = command.family;

    byFamily.set(family, [...(byFamily.get(family) ?? []), command]);
  }

  const lines = [
    README_WORKFLOW_START,
    `The runnable command groups below are generated from the same registry as ${inlineCode(REGISTRY_PATH)} and stay aligned with \`/blu-help\`.`,
    "",
    "### Foundation",
    "",
    "- `/blu`: root router for safe command selection and next-step guidance"
  ];

  for (const [family, commands] of byFamily) {
    if (family !== "Foundation") {
      lines.push("", `### ${family}`, "");
    }

    for (const command of commands) {
      lines.push(`- ${inlineCode(command.command)}: ${sentence(command.purpose)}`);
    }
  }

  lines.push(README_WORKFLOW_END);

  return lines.join("\n");
}

export function renderReadmeNonPublic(registry: GeneratedCommandRegistry): string {
  const nonRunnable = registry.commands.filter((entry) => !entry.implemented);
  const lines = [
    README_NON_PUBLIC_START,
    "The retained entries below are not public runnable commands in the current runtime. `/blu`, `/blu-help`, `/blu-progress`, and `/blu-next` must not advertise them until the live catalog marks them `implemented`.",
    ""
  ];

  if (nonRunnable.length === 0) {
    lines.push("- None.");
  } else {
    for (const command of nonRunnable) {
      const blockedBy = command.blockedBy.length > 0
        ? ` Blocked by: ${command.blockedBy.join("; ")}.`
        : "";

      lines.push(
        `- ${inlineCode(command.name)}: runtime status ${inlineCode(command.status)}, declared ${inlineCode(command.declaredStatus)}.${blockedBy}`
      );
    }
  }

  lines.push(README_NON_PUBLIC_END);

  return lines.join("\n");
}

function runnableCommandsByFamily(
  registry: GeneratedCommandRegistry
): Map<string, GeneratedCommandRegistryEntry[]> {
  const byFamily = new Map<string, GeneratedCommandRegistryEntry[]>();
  const runnable = registry.commands.filter((entry) => entry.runnable).sort(sortCommands);

  for (const command of runnable) {
    byFamily.set(command.family, [...(byFamily.get(command.family) ?? []), command]);
  }

  return byFamily;
}

export function renderUserDocsIntentBlock(registry: GeneratedCommandRegistry): string {
  const lines = [
    USER_DOCS_INTENTS_START,
    "Use these runnable commands when the intent matches your current need:",
    "",
    "| Intent | Runnable command |",
    "| --- | --- |",
    ...registry.intentChooser.map((entry) =>
      `| ${escapeMarkdownTableCell(entry.intent)} | ${entry.routes.map(inlineCode).join(", ")} |`
    ),
    "",
    `Generated from ${inlineCode(REGISTRY_PATH)}. Only commands whose live catalog status is ${inlineCode("implemented")} appear here as runnable routes.`,
    USER_DOCS_INTENTS_END
  ];

  return lines.join("\n");
}

export function renderUserDocsLifecycleBlock(registry: GeneratedCommandRegistry): string {
  const lines = [
    USER_DOCS_LIFECYCLE_START,
    "The runnable command families below come from the live command registry:",
    ""
  ];

  for (const [family, commands] of runnableCommandsByFamily(registry)) {
    const routes = commands.map((command) => inlineCode(directCommandPlaceholder(command)));

    lines.push(`- ${family}: ${routes.join(", ")}`);
  }

  lines.push(
    "",
    `Generated from ${inlineCode(REGISTRY_PATH)}. Retained non-runnable commands are intentionally excluded from this lifecycle map.`,
    USER_DOCS_LIFECYCLE_END
  );

  return lines.join("\n");
}

export function renderUserDocsCommandReference(registry: GeneratedCommandRegistry): string {
  const lines = [
    "# Blueprint Command Reference",
    "",
    `> Generated by ${inlineCode(GENERATED_BY)} from ${inlineCode(REGISTRY_PATH)}. Do not edit this reference by hand; rerun the generator instead.`,
    "",
    "## Command Counts",
    "",
    `- Runnable direct commands: ${registry.counts.implemented}`,
    `- Retained non-runnable commands: ${registry.counts.nonRunnable}`,
    "",
    "## Intent Chooser",
    "",
    "| Intent | Runnable command |",
    "| --- | --- |",
    ...registry.intentChooser.map((entry) =>
      `| ${escapeMarkdownTableCell(entry.intent)} | ${entry.routes.map(inlineCode).join(", ")} |`
    ),
    "",
    "## Runnable Commands",
    "",
    "These commands are runnable because the live catalog marks them `implemented`.",
    ""
  ];

  for (const [family, commands] of runnableCommandsByFamily(registry)) {
    lines.push(`### ${family}`, "", "| Command | Purpose | Risk | Execution profile |", "| --- | --- | --- | --- |");

    for (const command of commands) {
      lines.push(
        [
          inlineCode(directCommandPlaceholder(command)),
          escapeMarkdownTableCell(sentence(command.purpose)),
          escapeMarkdownTableCell(command.risk),
          inlineCode(command.executionProfile ?? "unknown")
        ].join(" | ").replace(/^/, "| ").replace(/$/, " |")
      );
    }

    lines.push("");
  }

  lines.push(
    "## Unavailable Retained Commands",
    "",
    "The commands below are retained in the registry, but they are not runnable in the current runtime and must not be recommended as executable `/blu-*` commands.",
    ""
  );

  const nonRunnable = registry.commands.filter((entry) => !entry.runnable).sort(sortCommands);

  if (nonRunnable.length === 0) {
    lines.push("- None.");
  } else {
    lines.push("| Command | Status | Why not runnable |", "| --- | --- | --- |");

    for (const command of nonRunnable) {
      const blockedBy = command.blockedBy.length > 0
        ? command.blockedBy.join("; ")
        : "The live catalog does not mark this command implemented.";

      lines.push(
        `| ${inlineCode(command.command)} | ${inlineCode(command.status)} | Not runnable: ${escapeMarkdownTableCell(blockedBy)} |`
      );
    }
  }

  lines.push("");

  return lines.join("\n");
}

export async function buildGeneratedCommandSurfaces(): Promise<GeneratedCommandSurfaces> {
  const registry = await buildGeneratedCommandRegistry();

  return {
    registry,
    registryJson: renderRegistryJson(registry),
    readmeChooserBlock: renderReadmeCommandChooser(registry),
    readmeRuntimeLayoutBlock: renderReadmeRuntimeLayout(registry),
    readmeWorkflowBlock: renderReadmeWorkflow(registry),
    readmeNonPublicBlock: renderReadmeNonPublic(registry),
    userDocsIntentBlock: renderUserDocsIntentBlock(registry),
    userDocsLifecycleBlock: renderUserDocsLifecycleBlock(registry),
    userDocsCommandReference: renderUserDocsCommandReference(registry)
  };
}

function replaceOrInsertBlock(args: {
  content: string;
  startMarker: string;
  endMarker: string;
  replacement: string;
  insertAfter?: string;
  insertBefore?: string;
  trailingNewlines?: number;
}): string {
  const trailingPattern = args.trailingNewlines === undefined ? "" : "\\n*";
  const blockPattern = new RegExp(
    `${escapeRegExp(args.startMarker)}[\\s\\S]*?${escapeRegExp(args.endMarker)}${trailingPattern}`
  );
  const replacement =
    args.trailingNewlines === undefined
      ? args.replacement
      : `${args.replacement}${"\n".repeat(args.trailingNewlines)}`;

  if (blockPattern.test(args.content)) {
    return args.content.replace(blockPattern, replacement);
  }

  if (args.insertAfter) {
    const index = args.content.indexOf(args.insertAfter);

    if (index === -1) {
      throw new Error(`Cannot find insertion anchor: ${args.insertAfter}`);
    }

    const insertAt = index + args.insertAfter.length;

    return `${args.content.slice(0, insertAt)}\n\n${replacement}${args.content.slice(insertAt)}`;
  }

  if (args.insertBefore) {
    const index = args.content.indexOf(args.insertBefore);

    if (index === -1) {
      throw new Error(`Cannot find insertion anchor: ${args.insertBefore}`);
    }

    return `${args.content.slice(0, index)}${replacement}\n\n${args.content.slice(index)}`;
  }

  throw new Error(`No insertion strategy for ${args.startMarker}`);
}

function replaceHeadingSection(args: {
  content: string;
  heading: string;
  nextHeading: string;
  replacementBody: string;
}): string {
  const start = args.content.indexOf(args.heading);
  const end = args.content.indexOf(args.nextHeading, start + args.heading.length);

  if (start === -1 || end === -1) {
    throw new Error(`Cannot replace section ${args.heading}`);
  }

  return `${args.content.slice(0, start)}${args.heading}\n\n${args.replacementBody}\n\n${args.content.slice(end)}`;
}

async function writeFileIfChanged(relativePath: string, content: string): Promise<void> {
  const absolutePath = path.join(process.cwd(), relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });

  let existing: string | null = null;
  try {
    existing = await fs.readFile(absolutePath, "utf8");
  } catch {
    existing = null;
  }

  if (existing !== content) {
    await fs.writeFile(absolutePath, content);
  }
}

async function readRepoFile(relativePath: string): Promise<string> {
  return fs.readFile(path.join(process.cwd(), relativePath), "utf8");
}

async function readRepoFileIfExists(relativePath: string): Promise<string | null> {
  try {
    return await readRepoFile(relativePath);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

export async function renderUpdatedReadme(
  currentReadme: string,
  surfaces: GeneratedCommandSurfaces
): Promise<string> {
  let readme = replaceOrInsertBlock({
    content: currentReadme,
    startMarker: README_CHOOSER_START,
    endMarker: README_CHOOSER_END,
    replacement: surfaces.readmeChooserBlock,
    insertBefore: "## Current Runtime Layout"
  });

  readme = replaceHeadingSection({
    content: readme,
    heading: "## Current Runtime Layout",
    nextHeading: "## What Blueprint Gives You",
    replacementBody: surfaces.readmeRuntimeLayoutBlock
  });
  readme = replaceHeadingSection({
    content: readme,
    heading: "## How The Workflow Fits Together",
    nextHeading: "## Common Workflows",
    replacementBody: surfaces.readmeWorkflowBlock
  });
  readme = replaceHeadingSection({
    content: readme,
    heading: "## Commands Not Public Yet",
    nextHeading: "## Troubleshooting",
    replacementBody: surfaces.readmeNonPublicBlock
  });

  return readme;
}

function replaceBlockWhenPresent(args: {
  content: string;
  startMarker: string;
  endMarker: string;
  replacement: string;
}): string {
  const hasStart = args.content.includes(args.startMarker);
  const hasEnd = args.content.includes(args.endMarker);

  if (!hasStart && !hasEnd) {
    return args.content;
  }

  if (hasStart !== hasEnd) {
    throw new Error(`Mismatched generated block markers: ${args.startMarker}`);
  }

  return replaceOrInsertBlock({
    content: args.content,
    startMarker: args.startMarker,
    endMarker: args.endMarker,
    replacement: args.replacement
  });
}

export function renderUpdatedUserDocs(
  currentQuickstart: string | null,
  currentLifecycle: string | null,
  surfaces: GeneratedCommandSurfaces
): {
  quickstart: string | null;
  lifecycle: string | null;
} {
  return {
    quickstart: currentQuickstart === null
      ? null
      : replaceBlockWhenPresent({
          content: currentQuickstart,
          startMarker: USER_DOCS_INTENTS_START,
          endMarker: USER_DOCS_INTENTS_END,
          replacement: surfaces.userDocsIntentBlock
        }),
    lifecycle: currentLifecycle === null
      ? null
      : replaceBlockWhenPresent({
          content: currentLifecycle,
          startMarker: USER_DOCS_LIFECYCLE_START,
          endMarker: USER_DOCS_LIFECYCLE_END,
          replacement: surfaces.userDocsLifecycleBlock
        })
  };
}

async function writeGeneratedCommandSurfaces(): Promise<void> {
  const surfaces = await buildGeneratedCommandSurfaces();
  const readme = await renderUpdatedReadme(await readRepoFile(README_PATH), surfaces);
  const userDocs = renderUpdatedUserDocs(
    await readRepoFileIfExists(USER_DOCS_QUICKSTART_PATH),
    await readRepoFileIfExists(USER_DOCS_LIFECYCLE_PATH),
    surfaces
  );

  await writeFileIfChanged(REGISTRY_PATH, surfaces.registryJson);
  await writeFileIfChanged(README_PATH, readme);
  await writeFileIfChanged(USER_DOCS_COMMAND_REFERENCE_PATH, surfaces.userDocsCommandReference);

  if (userDocs.quickstart !== null) {
    await writeFileIfChanged(USER_DOCS_QUICKSTART_PATH, userDocs.quickstart);
  }

  if (userDocs.lifecycle !== null) {
    await writeFileIfChanged(USER_DOCS_LIFECYCLE_PATH, userDocs.lifecycle);
  }
}

function isEntrypoint(): boolean {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isEntrypoint()) {
  writeGeneratedCommandSurfaces().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
