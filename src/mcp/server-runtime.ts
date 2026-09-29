import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { BoundedStdioServerTransport } from "./bounded-stdio-transport.js";
import { registerBlueprintCommandResources } from "./command-resources.js";
import { createToolResponse } from "./public-response.js";
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
      async (args: Record<string, unknown>, extra) => {
        const result = await executeToolHandlerWithFailureLogging(definition, args);
        return createToolResponse(definition.name, result, extra.requestId);
      }
    );
  }

  return server;
}

export async function startServer(): Promise<void> {
  const transport = new BoundedStdioServerTransport();
  const server = createBlueprintServer();

  await server.connect(transport);
}
