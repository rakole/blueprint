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
type RelativePathReader = (relativePath: string) => Promise<string | null>;

type BuildBlueprintCommandRuntimeContractResourceOptions = {
  readRelativePath?: RelativePathReader;
};

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

function buildCommandRuntimeContractUri(commandName: string): string {
  return `blueprint://commands/${encodeURIComponent(commandName)}/runtime-contract`;
}

const BLUEPRINT_COMMAND_RUNTIME_CONTRACT_DESCRIPTION =
  "Read-only projection of one implemented Blueprint command's catalog metadata, command spec, and runtime-reference row.";

function buildNonImplementedRuntimeContractErrorMessage(commandName: string): string {
  return `Blueprint runtime-contract resources are available only for implemented commands: ${commandName}`;
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

function runtimeOwnedMetadataToCommandSpec(
  metadata: RuntimeOwnedCommandMetadata
): BlueprintCommandSpecResource {
  return {
    path: metadata.spec.path,
    title: metadata.spec.title,
    wave: metadata.catalog.wave,
    family: metadata.catalog.family,
    executionProfile: metadata.spec.executionProfile,
    rootRoutable: metadata.spec.rootRoutable,
    purpose: metadata.spec.purpose,
    requiredTools: [...metadata.requiredTools],
    primarySkill: metadata.catalog.primarySkill,
    optionalSubagents: [...metadata.optionalAgents],
    reads: [...metadata.spec.reads],
    writes: [...metadata.spec.writes]
  };
}

function getImplementedRuntimeOwnedContractMetadata(
  commandName: string,
  entry: CommandCatalogEntry | undefined
): RuntimeOwnedCommandMetadata | null {
  if (!entry || !isExposedRuntimeContractCatalogEntry(entry)) {
    return null;
  }

  return (
    getRuntimeOwnedCommandMetadataBySourceId(entry.specPath) ??
    getRuntimeOwnedCommandMetadata(commandName) ??
    null
  );
}

export async function buildBlueprintCommandCatalogResource(): Promise<CommandCatalogResult> {
  return blueprintCommandCatalog();
}

export async function listBlueprintCommandRuntimeContractCommands(): Promise<string[]> {
  const catalog = await blueprintCommandCatalog();
  return Object.entries(catalog.commands)
    .filter(([commandName, entry]) =>
      getImplementedRuntimeOwnedContractMetadata(commandName, entry) !== null
    )
    .map(([commandName]) => commandName)
    .sort();
}

export async function buildBlueprintCommandRuntimeContractResource(
  commandName: string,
  options: BuildBlueprintCommandRuntimeContractResourceOptions = {}
): Promise<BlueprintCommandRuntimeContractResource> {
  const readRelativePath = options.readRelativePath ?? readBundledFile;
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands[commandName];
  const runtimeMetadata = getImplementedRuntimeOwnedContractMetadata(commandName, entry);

  if (!entry) {
    throw new Error(`Unknown Blueprint command: ${commandName}`);
  }

  if (!runtimeMetadata) {
    throw new Error(buildNonImplementedRuntimeContractErrorMessage(commandName));
  }

  const skillInputs = await loadBlueprintSkillInputs(
    entry.primarySkill,
    entry.command,
    readRelativePath,
    entry.skillPath
  );

  return {
    command: commandName,
    uri: buildCommandRuntimeContractUri(commandName),
    catalog: entry,
    spec: runtimeOwnedMetadataToCommandSpec(runtimeMetadata),
    runtimeReference: runtimeOwnedMetadataToRuntimeReferenceRow(runtimeMetadata),
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
