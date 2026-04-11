import type { HookInput, HookOutput } from "./shared.js";
import { advisoryReason, getTargetPath, isBlueprintPath, isWriteTool, noop } from "./shared.js";
import { runHook } from "./run-hook.js";

export async function evaluateWorkflowAdvisory(input: HookInput): Promise<HookOutput> {
  if (!isWriteTool(input.tool_name)) {
    return noop();
  }

  const targetPath = getTargetPath(input);
  if (!targetPath) {
    return noop();
  }

  const cwd = input.cwd ?? process.cwd();
  if (isBlueprintPath(cwd, targetPath)) {
    return noop();
  }

  return advisoryReason(
    targetPath,
    "Blueprint advisory: prefer the managed Blueprint command flow for repo edits in this workspace"
  );
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  await runHook(evaluateWorkflowAdvisory);
}
