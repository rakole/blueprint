import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ZodType } from "zod/v4";

import { artifactToolDefinitions } from "./tools/artifacts.js";
import { configToolDefinitions } from "./tools/config.js";
import { projectToolDefinitions } from "./tools/project.js";
import { stateToolDefinitions } from "./tools/state.js";

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema?: Record<string, ZodType>;
  handler: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

const TOOL_DEFINITIONS: ToolDefinition[] = [
  ...projectToolDefinitions,
  ...configToolDefinitions,
  ...stateToolDefinitions,
  ...artifactToolDefinitions
];

export const blueprintToolRegistry = Object.fromEntries(
  TOOL_DEFINITIONS.map((definition) => [definition.name, definition])
);

export const blueprintToolNames = TOOL_DEFINITIONS.map(
  (definition) => definition.name
);

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
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ],
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
  import.meta.url === new URL(entrypoint, "file:").href;

if (isEntrypoint) {
  startServer().catch((error) => {
    console.error("Blueprint MCP server error:", error);
    process.exit(1);
  });
}
