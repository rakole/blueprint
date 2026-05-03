import { promises as fs } from "node:fs";

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  getRuntimeOwnedCommandMetadata,
  getRuntimeOwnedCommandMetadataBySourceId,
  listRuntimeOwnedCommandMetadata,
  type RuntimeOwnedCommandMetadata
} from "./command-runtime-metadata.js";
import { loadBlueprintSkillInputs, type BlueprintSkillResolvedInputs } from "./skill-metadata.js";
import { blueprintCommandCatalog } from "./tools/project.js";

export const BLUEPRINT_COMMAND_CATALOG_RESOURCE_URI =
  "blueprint://commands/catalog";
export const BLUEPRINT_COMMAND_RUNTIME_CONTRACT_URI_TEMPLATE =
  "blueprint://commands/{command}/runtime-contract";

type CommandCatalogResult = Awaited<ReturnType<typeof blueprintCommandCatalog>>;
type CommandCatalogEntry = CommandCatalogResult["commands"][string];

export type BlueprintCommandSpecResource = {
  path: string;
  title: string | null;
  wave: number | null;
  family: string | null;
  executionProfile: string | null;
  rootRoutable: boolean | null;
  purpose: string | null;
  requiredTools: string[];
  primarySkill: string | null;
  optionalSubagents: string[];
  reads: string[];
  writes: string[];
};

export type BlueprintRuntimeReferenceRowResource = {
  path: string;
  wave: number | null;
  waveTitle: string | null;
  command: string;
  commandSpecPath: string | null;
  primarySkill: string | null;
  exactMcpDestination: string[];
  optionalAgents: string[];
  hookInvolvement: string[];
  contractNotes: string | null;
  evidenceState: string[];
};

export type BlueprintCommandRuntimeContractResource = {
  command: string;
  uri: string;
  catalog: CommandCatalogEntry;
  spec: BlueprintCommandSpecResource | null;
  runtimeReference: BlueprintRuntimeReferenceRowResource | null;
  skillInputs: BlueprintSkillResolvedInputs;
};

function bundledUrl(relativePath: string): URL {
  return new URL(`../../${relativePath}`, import.meta.url);
}

async function readBundledFile(relativePath: string): Promise<string | null> {
  try {
    return await fs.readFile(bundledUrl(relativePath), "utf8");
  } catch {
    return null;
  }
}

function extractMarkdownSection(markdown: string, heading: string): string {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(
    new RegExp(`(?:^|\\n)## ${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`)
  );

  return match?.[1]?.trim() ?? "";
}

function collapseMarkdownText(markdown: string): string | null {
  const normalized = markdown
    .replace(/`/g, "")
    .replace(/\[(.*?)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length > 0 ? normalized : null;
}

function parseRequiredTools(markdown: string): string[] {
  return [...markdown.matchAll(/`(blueprint_[a-z0-9_]+)`/g)].map((match) => match[1]);
}

function parseBulletSection(markdown: string): string[] {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((line) => line.length > 0 && line.toLowerCase() !== "none");
}

function parseOptionalSubagents(markdown: string): string[] {
  const section = extractMarkdownSection(markdown, "Skills And Subagents");
  const match = section.match(/- Optional subagents:\s*(.+)/);

  if (!match || /\bnone\b/i.test(match[1])) {
    return [];
  }

  return [...match[1].matchAll(/`([a-z0-9-]+)`/g)].map((result) => result[1]);
}

function parsePrimarySkill(markdown: string): string | null {
  const section = extractMarkdownSection(markdown, "Skills And Subagents");
  const match = section.match(/- Primary skill:\s*`([^`]+)`/);
  return match?.[1] ?? null;
}

function parseCommandSpec(markdown: string, specPath: string): BlueprintCommandSpecResource {
  const headingMatch = markdown.match(/^#\s+(.+)$/m);
  const waveMatch = markdown.match(/\| Wave \| `([^`]+)` \|/);
  const familyMatch = markdown.match(/\| Family \| `([^`]+)` \|/);
  const executionProfileMatch = markdown.match(/\| Execution profile \| `([^`]+)` \|/);
  const rootRoutableMatch = markdown.match(/\| Root-routable \| (.+?) \|/);

  return {
    path: specPath,
    title: headingMatch?.[1]?.trim() ?? null,
    wave: waveMatch ? Number.parseInt(waveMatch[1], 10) : null,
    family: familyMatch?.[1] ?? null,
    executionProfile: executionProfileMatch?.[1] ?? null,
    rootRoutable: rootRoutableMatch
      ? rootRoutableMatch[1].trim().toLowerCase().startsWith("yes")
      : null,
    purpose: collapseMarkdownText(extractMarkdownSection(markdown, "Purpose")),
    requiredTools: parseRequiredTools(extractMarkdownSection(markdown, "Required MCP Tools")),
    primarySkill: parsePrimarySkill(markdown),
    optionalSubagents: parseOptionalSubagents(markdown),
    reads: parseBulletSection(extractMarkdownSection(markdown, "Blueprint And Global State Reads")),
    writes: parseBulletSection(
      extractMarkdownSection(markdown, "Blueprint And Global State Writes")
    )
  };
}

function parseInlineList(cell: string): string[] {
  const normalized = cell
    .replaceAll("<br>", "\n")
    .replace(/`/g, "")
    .trim();

  if (normalized.length === 0 || normalized.toLowerCase() === "none") {
    return [];
  }

  return normalized
    .split(/\n|;\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && entry.toLowerCase() !== "none");
}

function parseRuntimeReferenceRows(
  markdown: string
): Map<string, BlueprintRuntimeReferenceRowResource> {
  const rows = new Map<string, BlueprintRuntimeReferenceRowResource>();
  let currentWaveTitle: string | null = null;
  let currentWaveNumber: number | null = null;

  for (const line of markdown.split("\n")) {
    const waveHeaderMatch = line.match(/^### Wave ([0-9]+):\s+(.+)$/);

    if (waveHeaderMatch) {
      currentWaveNumber = Number.parseInt(waveHeaderMatch[1], 10);
      currentWaveTitle = waveHeaderMatch[2].trim();
      continue;
    }

    const trimmed = line.trim();

    if (!trimmed.startsWith("| `") || trimmed.startsWith("|---")) {
      continue;
    }

    const cells = trimmed
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length < 8) {
      continue;
    }

    const command = cells[0].replaceAll("`", "");

    rows.set(command, {
      path: "docs/RUNTIME-REFERENCE.md",
      wave: currentWaveNumber,
      waveTitle: currentWaveTitle,
      command,
      commandSpecPath: cells[1].replaceAll("`", "") || null,
      primarySkill: cells[2].replaceAll("`", "") || null,
      exactMcpDestination: parseInlineList(cells[3]),
      optionalAgents: parseInlineList(cells[4]),
      hookInvolvement: parseInlineList(cells[5]),
      contractNotes: collapseMarkdownText(cells[6]),
      evidenceState: parseInlineList(cells[7])
    });
  }

  return rows;
}

function buildCommandRuntimeContractUri(commandName: string): string {
  return `blueprint://commands/${encodeURIComponent(commandName)}/runtime-contract`;
}

const BLUEPRINT_COMMAND_RUNTIME_CONTRACT_EXCLUSIONS = new Set(["review"]);
const BLUEPRINT_COMMAND_RUNTIME_CONTRACT_DESCRIPTION =
  "Read-only projection of one implemented Blueprint command's catalog metadata, command spec, and runtime-reference row; `review` is intentionally excluded.";

function buildNonImplementedRuntimeContractErrorMessage(commandName: string): string {
  return `Blueprint runtime-contract resources are available only for implemented commands: ${commandName}`;
}

function buildExcludedRuntimeContractErrorMessage(commandName: string): string {
  return `Blueprint runtime-contract resources intentionally exclude this command today: ${commandName}`;
}

function isExposedRuntimeContractCatalogEntry(entry: CommandCatalogEntry): boolean {
  return entry.status === "implemented" && entry.implemented;
}

function runtimeOwnedMetadataToRuntimeReferenceRow(
  metadata: RuntimeOwnedCommandMetadata
): BlueprintRuntimeReferenceRowResource {
  return {
    path: metadata.runtimeReference.path,
    wave: metadata.catalog.wave,
    waveTitle: metadata.runtimeReference.waveTitle,
    command: metadata.runtimeReference.command,
    commandSpecPath: metadata.sourceId,
    primarySkill: metadata.runtimeReference.primarySkill,
    exactMcpDestination: [...metadata.runtimeReference.exactMcpDestination],
    optionalAgents: [...metadata.runtimeReference.optionalAgents],
    hookInvolvement: [...metadata.runtimeReference.hookInvolvement],
    contractNotes: metadata.runtimeReference.contractNotes,
    evidenceState: [...metadata.runtimeReference.evidenceState]
  };
}

async function readBlueprintRuntimeReferenceRows(): Promise<
  Map<string, BlueprintRuntimeReferenceRowResource>
> {
  const runtimeReferenceMarkdown = await readBundledFile("docs/RUNTIME-REFERENCE.md");
  const rows = runtimeReferenceMarkdown
    ? parseRuntimeReferenceRows(runtimeReferenceMarkdown)
    : new Map<string, BlueprintRuntimeReferenceRowResource>();

  for (const metadata of listRuntimeOwnedCommandMetadata()) {
    rows.set(metadata.commandName, runtimeOwnedMetadataToRuntimeReferenceRow(metadata));
  }

  return rows;
}

async function readBundledCommandSpec(
  entry: CommandCatalogEntry
): Promise<BlueprintCommandSpecResource | null> {
  const runtimeMetadata = getRuntimeOwnedCommandMetadataBySourceId(entry.specPath);

  if (runtimeMetadata) {
    return {
      path: runtimeMetadata.spec.path,
      title: runtimeMetadata.spec.title,
      wave: runtimeMetadata.catalog.wave,
      family: runtimeMetadata.catalog.family,
      executionProfile: runtimeMetadata.spec.executionProfile,
      rootRoutable: runtimeMetadata.spec.rootRoutable,
      purpose: runtimeMetadata.spec.purpose,
      requiredTools: [...runtimeMetadata.requiredTools],
      primarySkill: runtimeMetadata.catalog.primarySkill,
      optionalSubagents: [...runtimeMetadata.optionalAgents],
      reads: [...runtimeMetadata.spec.reads],
      writes: [...runtimeMetadata.spec.writes]
    };
  }

  if (!entry.specPath) {
    return null;
  }

  const specMarkdown = await readBundledFile(entry.specPath);

  return specMarkdown ? parseCommandSpec(specMarkdown, entry.specPath) : null;
}

export async function buildBlueprintCommandCatalogResource(): Promise<CommandCatalogResult> {
  return blueprintCommandCatalog();
}

export async function listBlueprintCommandRuntimeContractCommands(): Promise<string[]> {
  const catalog = await blueprintCommandCatalog();
  const runtimeReferenceRows = await readBlueprintRuntimeReferenceRows();
  const commands = await Promise.all(
    Object.entries(catalog.commands).map(async ([commandName, entry]) => {
      if (BLUEPRINT_COMMAND_RUNTIME_CONTRACT_EXCLUSIONS.has(commandName)) {
        return null;
      }

      if (!isExposedRuntimeContractCatalogEntry(entry)) {
        return null;
      }

      const spec = await readBundledCommandSpec(entry);

      return spec && runtimeReferenceRows.has(commandName) ? commandName : null;
    })
  );

  return commands
    .filter((commandName): commandName is string => commandName !== null)
    .sort();
}

export async function buildBlueprintCommandRuntimeContractResource(
  commandName: string
): Promise<BlueprintCommandRuntimeContractResource> {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands[commandName];

  if (!entry) {
    throw new Error(`Unknown Blueprint command: ${commandName}`);
  }

  if (BLUEPRINT_COMMAND_RUNTIME_CONTRACT_EXCLUSIONS.has(commandName)) {
    throw new Error(buildExcludedRuntimeContractErrorMessage(commandName));
  }

  if (!isExposedRuntimeContractCatalogEntry(entry)) {
    throw new Error(buildNonImplementedRuntimeContractErrorMessage(commandName));
  }

  const [spec, runtimeReferenceRows] = await Promise.all([
    readBundledCommandSpec(entry),
    readBlueprintRuntimeReferenceRows()
  ]);
  const runtimeReference = runtimeReferenceRows.get(commandName);
  const skillInputs = await loadBlueprintSkillInputs(
    entry.primarySkill,
    entry.command,
    readBundledFile,
    entry.skillPath
  );

  if (!spec || !entry.specPath) {
    throw new Error(`Missing locked command spec for Blueprint command: ${commandName}`);
  }

  if (!runtimeReference) {
    throw new Error(`Missing runtime reference row for Blueprint command: ${commandName}`);
  }

  return {
    command: commandName,
    uri: buildCommandRuntimeContractUri(commandName),
    catalog: entry,
    spec,
    runtimeReference,
    skillInputs
  };
}

function buildJsonResourceContents(uri: string, payload: unknown) {
  return [
    {
      uri,
      mimeType: "application/json",
      text: `${JSON.stringify(payload, null, 2)}\n`
    }
  ];
}

export function registerBlueprintCommandResources(server: McpServer): void {
  server.registerResource(
    "blueprint-command-catalog",
    BLUEPRINT_COMMAND_CATALOG_RESOURCE_URI,
    {
      title: "Blueprint Command Catalog",
      description:
        "Read-only projection of the retained Blueprint command catalog and runtime availability metadata.",
      mimeType: "application/json"
    },
    async (uri) => ({
      contents: buildJsonResourceContents(
        uri.toString(),
        await buildBlueprintCommandCatalogResource()
      )
    })
  );

  server.registerResource(
    "blueprint-command-runtime-contract",
    new ResourceTemplate(BLUEPRINT_COMMAND_RUNTIME_CONTRACT_URI_TEMPLATE, {
      list: async () => {
        const commands = await listBlueprintCommandRuntimeContractCommands();

        return {
          resources: commands
            .map((command) => ({
              uri: buildCommandRuntimeContractUri(command),
              name: `blueprint-${command}-runtime-contract`,
              title: `${command} runtime contract`,
              description: BLUEPRINT_COMMAND_RUNTIME_CONTRACT_DESCRIPTION,
              mimeType: "application/json"
            }))
        };
      },
      complete: {
        command: async (value) => {
          const commands = await listBlueprintCommandRuntimeContractCommands();

          return commands.filter((command) => command.startsWith(value));
        }
      }
    }),
    {
      title: "Blueprint Command Runtime Contract",
      description: BLUEPRINT_COMMAND_RUNTIME_CONTRACT_DESCRIPTION,
      mimeType: "application/json"
    },
    async (uri, variables) => {
      const commandName = String(variables.command ?? "").trim();

      return {
        contents: buildJsonResourceContents(
          uri.toString(),
          await buildBlueprintCommandRuntimeContractResource(commandName)
        )
      };
    }
  );
}
