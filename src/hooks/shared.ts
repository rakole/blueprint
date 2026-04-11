import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export interface HookInput {
  cwd?: string;
  hook_event_name?: string;
  session_id?: string;
  timestamp?: string;
  transcript_path?: string;
  tool_input?: Record<string, unknown>;
  tool_name?: string;
  [key: string]: unknown;
}

export interface HookOutput {
  continue?: boolean;
  decision?: "allow" | "deny" | "block";
  hookSpecificOutput?: Record<string, unknown>;
  reason?: string;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
}

type AnyRecord = Record<string, unknown>;

const WRITE_TOOL_NAMES = new Set(["write_file", "replace"]);
const PROMPT_INJECTION_PATTERNS = [
  /ignore (?:all )?previous instructions/i,
  /forget (?:all )?previous instructions/i,
  /system prompt/i,
  /developer message/i,
  /prompt injection/i,
  /jailbreak/i,
  /override the rules/i
];

export function isWriteTool(toolName: unknown): toolName is string {
  return typeof toolName === "string" && WRITE_TOOL_NAMES.has(toolName);
}

export function cwdOrProcess(input: HookInput): string {
  return input.cwd ?? process.cwd();
}

export function resolveCandidatePath(cwd: string, candidate: unknown): string | null {
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    return null;
  }

  return path.resolve(cwd, candidate);
}

export function isBlueprintPath(cwd: string, targetPath: string): boolean {
  const blueprintRoot = path.resolve(cwd, ".blueprint");
  return targetPath === blueprintRoot || targetPath.startsWith(`${blueprintRoot}${path.sep}`);
}

export function isExistingPath(targetPath: string): boolean {
  return existsSync(targetPath);
}

export function makeAdvisory(systemMessage: string): HookOutput {
  return {
    decision: "allow",
    systemMessage
  };
}

export function noop(): HookOutput {
  return {};
}

export async function readHookInput(): Promise<HookInput> {
  let raw = "";

  for await (const chunk of process.stdin) {
    raw += String(chunk);
  }

  if (raw.trim().length === 0) {
    return {};
  }

  const parsed = JSON.parse(raw);
  if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as HookInput;
  }

  return {};
}

export async function readTranscript(transcriptPath: string | undefined): Promise<unknown> {
  if (!transcriptPath || !existsSync(transcriptPath)) {
    return null;
  }

  const transcript = await readFile(transcriptPath, "utf8");
  if (transcript.trim().length === 0) {
    return null;
  }

  return JSON.parse(transcript);
}

export async function readTranscriptForCwd(
  cwd: string,
  transcriptPath: string | undefined
): Promise<unknown> {
  if (!transcriptPath) {
    return null;
  }

  const absoluteTranscriptPath = path.isAbsolute(transcriptPath)
    ? transcriptPath
    : path.resolve(cwd, transcriptPath);

  return await readTranscript(absoluteTranscriptPath);
}

export function getTargetPath(input: HookInput): string | null {
  const cwd = cwdOrProcess(input);
  const toolInput = input.tool_input;

  if (toolInput && typeof toolInput === "object" && !Array.isArray(toolInput)) {
    const record = toolInput as AnyRecord;
    for (const key of ["file_path", "filePath", "path", "target"]) {
      const resolved = resolveCandidatePath(cwd, record[key]);
      if (resolved) {
        return resolved;
      }
    }
  }

  return null;
}

function collectToolRecords(value: unknown, out: Array<{ toolName: string; toolInput: AnyRecord }>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectToolRecords(item, out);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const record = value as AnyRecord;
  const toolName = record.tool_name;
  const toolInput = record.tool_input;

  if (
    typeof toolName === "string" &&
    toolInput &&
    typeof toolInput === "object" &&
    !Array.isArray(toolInput)
  ) {
    out.push({ toolName, toolInput: toolInput as AnyRecord });
  }

  for (const nestedValue of Object.values(record)) {
    collectToolRecords(nestedValue, out);
  }
}

function collectPathCandidates(value: unknown, cwd: string): string[] {
  if (typeof value === "string") {
    const resolved = resolveCandidatePath(cwd, value);
    return resolved ? [resolved] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectPathCandidates(item, cwd));
  }

  return [];
}

function pathValuesFromToolInput(toolInput: AnyRecord, cwd: string): string[] {
  const candidates: string[] = [];

  for (const key of ["file_path", "filePath", "path", "target", "files", "paths", "file_paths"]) {
    candidates.push(...collectPathCandidates(toolInput[key], cwd));
  }

  return candidates;
}

export async function wasTargetRead(input: HookInput, targetPath: string): Promise<boolean> {
  const transcript = await readTranscriptForCwd(cwdOrProcess(input), input.transcript_path);
  if (!transcript) {
    return false;
  }

  const records: Array<{ toolName: string; toolInput: AnyRecord }> = [];
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

export function contentFromToolInput(input: HookInput): string | null {
  const toolInput = input.tool_input;
  if (!toolInput || typeof toolInput !== "object" || Array.isArray(toolInput)) {
    return null;
  }

  const record = toolInput as AnyRecord;
  const content = record.content;
  return typeof content === "string" ? content : null;
}

export function hasPromptInjectionSignals(content: string): boolean {
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(content));
}

export function isResearchArtifactPath(targetPath: string): boolean {
  return /(?:^|[\\/])\d{2}-RESEARCH\.md$/i.test(targetPath);
}

export function hasResearchArtifactMarkers(content: string): boolean {
  return /^\s*#\s+/m.test(content) && /^\s*##\s+(?:Sources|References|Evidence|Recommendations)\b/im.test(content);
}

export function advisoryReason(targetPath: string, message: string): HookOutput {
  const displayPath = targetPath.replaceAll(path.sep, "/");
  return makeAdvisory(`${message} (${displayPath})`);
}
