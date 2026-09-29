import { pathToFileURL } from "node:url";

import { startServer } from "./server-runtime.js";

export {
  BoundedStdioServerTransport,
  MAX_MCP_JSON_RPC_ID_BYTES,
  MAX_MCP_JSON_RPC_REQUEST_BYTES
} from "./bounded-stdio-transport.js";

export {
  BLUEPRINT_MUTATION_TOOL_NAMES,
  executeToolHandlerWithFailureLogging,
  isMutationTool,
  shouldLogMutationFailure
} from "./mutation-failure-logging.js";
export {
  createPublicToolResult,
  createToolResponse,
  createToolResponseContent,
  MAX_PLAN_MCP_JSON_RPC_RESPONSE_BYTES,
  MAX_PLAN_MCP_MIRRORED_PAYLOAD_BYTES,
  PLAN_MCP_JSON_RPC_ID_RESERVE_BYTES,
  planMcpJsonRpcResponseBytes
} from "./public-response.js";
export { sanitizeToolResultForPublicResponse } from "./response-sanitizer.js";
export { createBlueprintServer, startServer } from "./server-runtime.js";
export { summarizeToolResult } from "./tool-result-summary.js";
export { blueprintToolNames, blueprintToolRegistry } from "./tool-definitions.js";

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
