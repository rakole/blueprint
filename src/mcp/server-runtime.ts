import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerBlueprintCommandResources } from "./command-resources.js";
import { createToolResponseContent } from "./public-response.js";
import { sanitizeToolResultForPublicResponse } from "./response-sanitizer.js";
import { TOOL_DEFINITIONS } from "./tool-definitions.js";
import { executeToolHandlerWithFailureLogging } from "./mutation-failure-logging.js";

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
        const publicResult = sanitizeToolResultForPublicResponse(definition.name, result);

        return {
          content: createToolResponseContent(definition.name, result),
          structuredContent: publicResult
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
