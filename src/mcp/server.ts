import { pathToFileURL } from "node:url";

import { startServer } from "./server-runtime.js";

export {
  BLUEPRINT_MUTATION_TOOL_NAMES,
  executeToolHandlerWithFailureLogging,
  isMutationTool,
  shouldLogMutationFailure
} from "./mutation-failure-logging.js";
export { createToolResponseContent } from "./public-response.js";
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
