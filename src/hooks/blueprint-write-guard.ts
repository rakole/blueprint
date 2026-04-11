import type { HookInput, HookOutput } from "./shared.js";
import {
  advisoryReason,
  contentFromToolInput,
  getTargetPath,
  hasPromptInjectionSignals,
  hasResearchArtifactMarkers,
  isBlueprintPath,
  isWriteTool,
  noop
} from "./shared.js";
import { runHook } from "./run-hook.js";

export async function evaluateBlueprintWriteGuard(input: HookInput): Promise<HookOutput> {
  if (!isWriteTool(input.tool_name)) {
    return noop();
  }

  const targetPath = getTargetPath(input);
  if (!targetPath) {
    return noop();
  }

  const cwd = input.cwd ?? process.cwd();
  if (!isBlueprintPath(cwd, targetPath)) {
    return noop();
  }

  const content = contentFromToolInput(input);
  if (typeof content !== "string" || content.trim().length === 0) {
    return noop();
  }

  const suspiciousReason = hasPromptInjectionSignals(content)
    ? "Blueprint advisory: `.blueprint` content looks like prompt injection or instruction override text"
    : null;

  if (suspiciousReason) {
    return advisoryReason(targetPath, suspiciousReason);
  }

  const researchArtifact = hasResearchArtifactMarkers(content) || /(?:^|[\\/])\d{2}-RESEARCH\.md$/i.test(targetPath);
  if (researchArtifact && !hasResearchArtifactMarkers(content)) {
    return advisoryReason(
      targetPath,
      "Blueprint advisory: research artifacts should include headings and evidence or recommendations sections"
    );
  }

  return noop();
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  await runHook(evaluateBlueprintWriteGuard);
}
