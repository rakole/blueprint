// src/hooks/shared.ts
import path2 from "node:path";

// src/shared/security.ts
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
var DEFAULT_MAX_JSON_BYTES = 512 * 1024;
var STRONG_PROMPT_INJECTION_PATTERNS = [
  /ignore (?:all )?previous instructions/i,
  /forget (?:all )?previous instructions/i,
  /override the rules/i,
  /disregard (?:all )?(?:earlier|previous) instructions/i,
  /follow (?:only|these) instructions instead/i
];
var CONTEXTUAL_PROMPT_MARKER_PATTERNS = [
  /system prompt/i,
  /developer message/i,
  /prompt injection/i,
  /jailbreak/i
];
var UNSAFE_DISPLAY_MARKER_PATTERNS = [
  /<\s*system\b[^>]*>/i,
  /<\s*developer\b[^>]*>/i,
  /<\s*assistant\b[^>]*>/i,
  /<\s*tool\b[^>]*>/i,
  /<<\s*sys\s*>>/i
];
var INVISIBLE_OR_CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function shannonEntropy(value) {
  if (value.length === 0) {
    return 0;
  }
  const counts = /* @__PURE__ */ new Map();
  for (const character of value) {
    counts.set(character, (counts.get(character) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / value.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}
function resolveRealishPathSync(targetPath) {
  const absoluteTarget = path.resolve(targetPath);
  if (existsSync(absoluteTarget)) {
    return realpathSync.native(absoluteTarget);
  }
  const pendingSegments = [];
  let current = absoluteTarget;
  while (!existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) {
      return absoluteTarget;
    }
    pendingSegments.unshift(path.basename(current));
    current = parent;
  }
  const realExistingPath = realpathSync.native(current);
  return path.join(realExistingPath, ...pendingSegments);
}
function isEscapingRoot(rootPath, candidatePath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative.startsWith("..") || path.isAbsolute(relative);
}
function findSuspiciousEncodedPayload(text) {
  const tokens = text.match(/[A-Za-z0-9+/=]{128,}|[A-Fa-f0-9]{128,}/g) ?? [];
  for (const token of tokens) {
    const entropy = shannonEntropy(token);
    if (entropy >= 4.4) {
      return token.slice(0, 24);
    }
  }
  return null;
}
function assertNoNullBytes(value, label = "Value") {
  if (value.includes("\0")) {
    throw new Error(`${label} must not contain null bytes.`);
  }
}
function ensurePathWithinRootSync(rootPath, candidatePath, options = {}) {
  const label = options.label ?? "Path";
  assertNoNullBytes(rootPath, "Root path");
  assertNoNullBytes(candidatePath, label);
  const resolvedRoot = resolveRealishPathSync(rootPath);
  const resolvedCandidate = resolveRealishPathSync(candidatePath);
  if (isEscapingRoot(resolvedRoot, resolvedCandidate)) {
    throw new Error(`${label} escapes the allowed root: ${candidatePath}`);
  }
  return path.resolve(candidatePath);
}
function isPathWithinRootSync(rootPath, candidatePath) {
  try {
    ensurePathWithinRootSync(rootPath, candidatePath, { label: "Path" });
    return true;
  } catch {
    return false;
  }
}
function safeJsonParse(raw, options = {}) {
  const label = options.label ?? "JSON";
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BYTES;
  const size = Buffer.byteLength(raw, "utf8");
  if (size > maxBytes) {
    throw new Error(`${label} exceeds the ${maxBytes} byte safety limit.`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown parse error";
    throw new Error(`${label} is not valid JSON: ${reason}`);
  }
}
function safeJsonParseObject(raw, options = {}) {
  const label = options.label ?? "JSON object";
  const parsed = safeJsonParse(raw, options);
  if (!isPlainObject(parsed)) {
    throw new Error(`${label} must contain a JSON object.`);
  }
  return parsed;
}
function sanitizeForDisplay(value) {
  return value.replace(INVISIBLE_OR_CONTROL_CHARACTERS, "");
}
function analyzePromptBoundaryText(text) {
  const findings = [];
  const warnings = [];
  const errors = [];
  let sanitizedText = text.replace(/\r\n/g, "\n");
  const removedCharacters = sanitizedText.match(INVISIBLE_OR_CONTROL_CHARACTERS)?.length ?? 0;
  if (removedCharacters > 0) {
    sanitizedText = sanitizedText.replace(INVISIBLE_OR_CONTROL_CHARACTERS, "");
    const message = `Removed ${removedCharacters} invisible or control character(s) before persistence.`;
    findings.push({
      type: "control-character",
      severity: "warning",
      message
    });
    warnings.push(message);
  }
  for (const pattern of STRONG_PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(sanitizedText)) {
      const message = "Content contains instruction-override language that is unsafe to persist inside Blueprint-managed artifacts.";
      findings.push({
        type: "prompt-injection",
        severity: "error",
        message
      });
      errors.push(message);
      break;
    }
  }
  for (const pattern of CONTEXTUAL_PROMPT_MARKER_PATTERNS) {
    if (pattern.test(sanitizedText)) {
      const message = "Content references prompt-boundary metadata and should be reviewed before reuse in model context.";
      findings.push({
        type: "prompt-context",
        severity: "warning",
        message
      });
      warnings.push(message);
      break;
    }
  }
  for (const pattern of UNSAFE_DISPLAY_MARKER_PATTERNS) {
    if (pattern.test(sanitizedText)) {
      const message = "Content includes protocol-style role markers that can confuse prompt or display boundaries.";
      findings.push({
        type: "unsafe-display",
        severity: "warning",
        message
      });
      warnings.push(message);
      break;
    }
  }
  const suspiciousPayload = findSuspiciousEncodedPayload(sanitizedText);
  if (suspiciousPayload) {
    const message = `Content includes a suspicious high-entropy payload (${suspiciousPayload}...) that is unsafe to persist without review.`;
    findings.push({
      type: "encoded-payload",
      severity: "error",
      message
    });
    errors.push(message);
  }
  return {
    sanitizedText,
    findings,
    warnings: [...new Set(warnings)],
    errors: [...new Set(errors)],
    hasWarnings: warnings.length > 0,
    hasErrors: errors.length > 0
  };
}

// src/hooks/shared.ts
var WRITE_TOOL_NAMES = /* @__PURE__ */ new Set(["write_file", "replace"]);
function isWriteTool(toolName) {
  return typeof toolName === "string" && WRITE_TOOL_NAMES.has(toolName);
}
function cwdOrProcess(input) {
  return input.cwd ?? process.cwd();
}
function resolveCandidatePath(cwd, candidate) {
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    return null;
  }
  return path2.resolve(cwd, candidate);
}
function isBlueprintPath(cwd, targetPath) {
  const blueprintRoot = path2.resolve(cwd, ".blueprint");
  return isPathWithinRootSync(blueprintRoot, targetPath);
}
function makeAdvisory(systemMessage) {
  return {
    decision: "allow",
    systemMessage
  };
}
function noop() {
  return {};
}
async function readHookInput() {
  let raw = "";
  for await (const chunk of process.stdin) {
    raw += String(chunk);
  }
  if (raw.trim().length === 0) {
    return {};
  }
  const parsed = safeJsonParseObject(raw, {
    label: "hook input",
    maxBytes: 512 * 1024
  });
  if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed;
  }
  return {};
}
function getTargetPath(input) {
  const cwd = cwdOrProcess(input);
  const toolInput = input.tool_input;
  if (toolInput && typeof toolInput === "object" && !Array.isArray(toolInput)) {
    const record = toolInput;
    for (const key of ["file_path", "filePath", "path", "target"]) {
      const resolved = resolveCandidatePath(cwd, record[key]);
      if (resolved) {
        return resolved;
      }
    }
  }
  return null;
}
function contentFromToolInput(input) {
  const toolInput = input.tool_input;
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput)) {
    return null;
  }
  const record = toolInput;
  const content = record.content;
  return typeof content === "string" ? content : null;
}
function hasResearchArtifactMarkers(content) {
  return /^\s*#\s+/m.test(content) && /^\s*##\s+(?:Sources|References|Evidence|Recommendations)\b/im.test(content);
}
function advisoryReason(targetPath, message) {
  const displayPath = sanitizeForDisplay(targetPath.replaceAll(path2.sep, "/"));
  return makeAdvisory(`${message} (${displayPath})`);
}

// src/hooks/run-hook.ts
async function readAllInput() {
  try {
    return await readHookInput();
  } catch (error) {
    console.error(
      `blueprint hook: unable to parse stdin JSON${error instanceof Error ? `: ${error.message}` : ""}`
    );
    return {};
  }
}
async function runHook(handler) {
  const input = await readAllInput();
  try {
    const output = await handler(input);
    process.stdout.write(`${JSON.stringify(output ?? {})}
`);
  } catch (error) {
    console.error(
      `blueprint hook: unexpected failure${error instanceof Error ? `: ${error.message}` : ""}`
    );
    process.stdout.write("{}\n");
  }
}

// src/hooks/blueprint-write-guard.ts
async function evaluateBlueprintWriteGuard(input) {
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
  const promptBoundaryAnalysis = analyzePromptBoundaryText(content);
  const suspiciousReason = promptBoundaryAnalysis.findings.length > 0 ? "Blueprint advisory: `.blueprint` content looks like prompt injection, hidden control text, or instruction override text" : null;
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
export {
  evaluateBlueprintWriteGuard
};
//# sourceMappingURL=blueprint-write-guard.js.map
