import type { HookInput, HookOutput } from "./shared.js";
import {
  advisoryReason,
  getTargetPath,
  isBlueprintPath,
  isExistingPath,
  isWriteTool,
  noop,
  wasTargetRead
} from "./shared.js";
import { runHook } from "./run-hook.js";

export async function evaluateReadBeforeEdit(input: HookInput): Promise<HookOutput> {
  if (!isWriteTool(input.tool_name)) {
    return noop();
  }

  const targetPath = getTargetPath(input);
  if (!targetPath) {
    return noop();
  }

  const cwd = input.cwd ?? process.cwd();
  if (!isExistingPath(targetPath) || isBlueprintPath(cwd, targetPath)) {
    return noop();
  }

  if (await wasTargetRead(input, targetPath)) {
    return noop();
  }

  return advisoryReason(
    targetPath,
    "Blueprint advisory: read the file before editing it so the existing content stays intact"
  );
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  await runHook(evaluateReadBeforeEdit);
}
