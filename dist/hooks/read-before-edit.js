// src/hooks/shared.ts
import { existsSync as existsSync2 } from "node:fs";
import { readFile } from "node:fs/promises";
import path2 from "node:path";

// src/shared/security.ts
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
var DEFAULT_MAX_JSON_BYTES = 512 * 1024;
var INVISIBLE_OR_CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
function isExistingPath(targetPath) {
  return existsSync2(targetPath);
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
async function readTranscript(transcriptPath) {
  if (!transcriptPath || !existsSync2(transcriptPath)) {
    return null;
  }
  const transcript = await readFile(transcriptPath, "utf8");
  if (transcript.trim().length === 0) {
    return null;
  }
  return safeJsonParse(transcript, {
    label: "hook transcript",
    maxBytes: 2 * 1024 * 1024
  });
}
async function readTranscriptForCwd(cwd, transcriptPath) {
  if (!transcriptPath) {
    return null;
  }
  const absoluteTranscriptPath = path2.isAbsolute(transcriptPath) ? transcriptPath : path2.resolve(cwd, transcriptPath);
  return await readTranscript(absoluteTranscriptPath);
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
function collectToolRecords(value, out) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectToolRecords(item, out);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  const record = value;
  const toolName = record.tool_name;
  const toolInput = record.tool_input;
  if (typeof toolName === "string" && toolInput && typeof toolInput === "object" && !Array.isArray(toolInput)) {
    out.push({ toolName, toolInput });
  }
  for (const nestedValue of Object.values(record)) {
    collectToolRecords(nestedValue, out);
  }
}
function collectPathCandidates(value, cwd) {
  if (typeof value === "string") {
    const resolved = resolveCandidatePath(cwd, value);
    return resolved ? [resolved] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectPathCandidates(item, cwd));
  }
  return [];
}
function pathValuesFromToolInput(toolInput, cwd) {
  const candidates = [];
  for (const key of ["file_path", "filePath", "path", "target", "files", "paths", "file_paths"]) {
    candidates.push(...collectPathCandidates(toolInput[key], cwd));
  }
  return candidates;
}
async function wasTargetRead(input, targetPath) {
  const transcript = await readTranscriptForCwd(cwdOrProcess(input), input.transcript_path);
  if (!transcript) {
    return false;
  }
  const records = [];
  collectToolRecords(transcript, records);
  const cwd = cwdOrProcess(input);
  for (const record of records) {
    if (record.toolName !== "read_file" && record.toolName !== "read_many_files") {
      continue;
    }
    const readTargets = pathValuesFromToolInput(record.toolInput, cwd);
    if (readTargets.some((candidate) => candidate === targetPath)) {
      return true;
    }
  }
  return false;
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

// src/hooks/read-before-edit.ts
async function evaluateReadBeforeEdit(input) {
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
export {
  evaluateReadBeforeEdit
};
//# sourceMappingURL=read-before-edit.js.map
