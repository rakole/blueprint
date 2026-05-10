import type { ToolResult } from "./tool-types.js";
import { sanitizeToolResultForPublicResponse } from "./response-sanitizer.js";

export function createToolResponseContent(
  toolName: string,
  result: ToolResult
): Array<{ type: "text"; text: string }> {
  const publicResult = sanitizeToolResultForPublicResponse(toolName, result);

  return [
    {
      type: "text",
      text: JSON.stringify(publicResult)
    }
  ];
}
