/**
 * Extract bounded, public observations from one explicitly named Codex session.
 *
 * This module is intentionally metadata-only.  It never searches a session
 * directory, follows session aliases, keeps hidden messages/reasoning, or
 * treats a search result as a source read.  It is suitable for development
 * study accounting, not for reconstructing a model context or billing.
 */

import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

export const OBSERVED_SESSION_SCHEMA_VERSION = "v1";

export class PortableMapStudyObservationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PortableMapStudyObservationError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

const TOKEN_FIELDS = Object.freeze([
  "input_tokens",
  "cached_input_tokens",
  "cache_write_input_tokens",
  "output_tokens",
  "reasoning_output_tokens",
  "total_tokens"
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function utf8Bytes(value) {
  return Buffer.byteLength(String(value ?? ""), "utf8");
}

function sha256(value) {
  return createHash("sha256").update(Buffer.isBuffer(value) ? value : Buffer.from(String(value ?? ""), "utf8")).digest("hex");
}

function stamp(row, sequence) {
  return {
    sequence,
    ...(typeof row?.timestamp === "string" ? { timestamp: row.timestamp } : {})
  };
}

function requireExactOption(value, name) {
  if (!hasText(value)) {
    throw new PortableMapStudyObservationError("missing-option", `${name} is required and must be an exact non-empty string.`, { name });
  }
  return value;
}

function assertKnownOptions(options) {
  const allowed = new Set([
    "sessionFile",
    "sessionFiles",
    "parentId",
    "agentPath",
    "agentPaths",
    "workspaceRoot",
    "sourceManifestSha256",
    "sourceBytes",
    "frozenSource",
    "sourceSnapshots"
  ]);
  const unknown = Object.keys(options).filter((key) => !allowed.has(key)).sort();
  if (unknown.length > 0) {
    throw new PortableMapStudyObservationError("unknown-option", `Unsupported observation option(s): ${unknown.join(", ")}.`, { unknown });
  }
}

function normalizeSingleOptions(options) {
  if (!isRecord(options)) {
    throw new PortableMapStudyObservationError("invalid-options", "Observation options must be an object.");
  }
  assertKnownOptions(options);
  const sessionFile = requireExactOption(options.sessionFile, "sessionFile");
  const parentId = requireExactOption(options.parentId, "parentId");
  const agentPath = requireExactOption(options.agentPath, "agentPath");
  const sourceSnapshots = normalizeSourceSnapshots(options.sourceSnapshots ?? (isRecord(options.sourceBytes) ? options.sourceBytes : undefined));
  return {
    ...options,
    sessionFile: path.resolve(sessionFile),
    parentId,
    agentPath,
    ...(options.workspaceRoot === undefined ? {} : { workspaceRoot: path.resolve(requireExactOption(options.workspaceRoot, "workspaceRoot")) }),
    sourceSnapshots
  };
}

function normalizeSourceSnapshots(value) {
  if (value === undefined) return new Map();
  if (!isRecord(value)) throw new PortableMapStudyObservationError("invalid-option", "sourceSnapshots must be an object keyed by repository-relative path.");
  const snapshots = new Map();
  for (const [rawPath, entry] of Object.entries(value)) {
    if (!hasText(rawPath) || path.isAbsolute(rawPath) || rawPath.includes("\\") || rawPath.split("/").some((part) => !part || part === "." || part === "..")) {
      throw new PortableMapStudyObservationError("invalid-option", `Unsafe source snapshot path: ${rawPath}`);
    }
    if (!isRecord(entry) || !/^[a-f0-9]{64}$/u.test(String(entry.sha256 ?? ""))) {
      throw new PortableMapStudyObservationError("invalid-option", `Source snapshot ${rawPath} must provide a lowercase SHA-256 hash.`);
    }
    const content = typeof entry.content === "string" ? Buffer.from(entry.content, "utf8") : Buffer.isBuffer(entry.bytes) ? entry.bytes : null;
    if (content) {
      const actual = sha256(content);
      if (actual !== entry.sha256) throw new PortableMapStudyObservationError("source-snapshot-mismatch", `Source snapshot hash mismatch: ${rawPath}`);
      snapshots.set(rawPath, Object.freeze({sha256: entry.sha256, bytes: content.byteLength, content}));
    } else if (Number.isSafeInteger(entry.bytes) && entry.bytes >= 0) {
      snapshots.set(rawPath, Object.freeze({sha256: entry.sha256, bytes: entry.bytes, content: null, version: entry.version ?? null}));
    } else {
      throw new PortableMapStudyObservationError("invalid-option", `Source snapshot ${rawPath} must provide bytes/content or a verified byte count.`);
    }
  }
  return snapshots;
}

function getPayload(row) {
  return isRecord(row?.payload) ? row.payload : null;
}

function lineageFromFirstRow(first) {
  const payload = getPayload(first);
  const source = isRecord(payload?.source) ? payload.source : null;
  const subagent = isRecord(source?.subagent) ? source.subagent : null;
  const spawn = isRecord(subagent?.thread_spawn) ? subagent.thread_spawn : null;
  return {
    sessionId: hasText(payload?.id) ? payload.id : (hasText(payload?.session_id) ? payload.session_id : null),
    parentId: hasText(spawn?.parent_thread_id) ? spawn.parent_thread_id : null,
    agentPath: hasText(spawn?.agent_path) ? spawn.agent_path : null
  };
}

function validateLineage(first, options) {
  const actual = lineageFromFirstRow(first);
  const mismatches = [];
  if (actual.parentId !== options.parentId) mismatches.push({ field: "parentId", expected: options.parentId, actual: actual.parentId });
  if (actual.agentPath !== options.agentPath) mismatches.push({ field: "agentPath", expected: options.agentPath, actual: actual.agentPath });
  if (mismatches.length > 0) {
    throw new PortableMapStudyObservationError(
      "lineage-mismatch",
      "The explicitly named session does not belong to the requested parent and agent.",
      { sessionFile: options.sessionFile, ...actual, mismatches }
    );
  }
  return actual;
}

function copyCounters(raw) {
  if (!isRecord(raw)) return null;
  const result = {};
  for (const field of TOKEN_FIELDS) {
    if (Object.hasOwn(raw, field)) result[field] = raw[field];
  }
  return result;
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function inspectTokenUsage(tokenRows, truncated) {
  const samples = [];
  const issues = [];
  const duplicates = [];
  let previous = null;
  let complete = true;

  for (const { row, sequence } of tokenRows) {
    const info = getPayload(row)?.info;
    const total = isRecord(info) ? info.total_token_usage : null;
    const counters = copyCounters(total);
    const sample = { ...stamp(row, sequence), counters };
    if (!counters) {
      complete = false;
      issues.push({ code: "missing-cumulative-counters", sequence });
      samples.push(sample);
      continue;
    }
    const missing = TOKEN_FIELDS.filter((field) => !Object.hasOwn(counters, field));
    const invalid = TOKEN_FIELDS.filter((field) => Object.hasOwn(counters, field) && !isNonNegativeInteger(counters[field]));
    if (missing.length > 0) {
      complete = false;
      issues.push({ code: "missing-counter-field", sequence, fields: missing });
    }
    if (invalid.length > 0) {
      complete = false;
      issues.push({ code: "invalid-counter-field", sequence, fields: invalid });
    }
    if (isNonNegativeInteger(counters.input_tokens) &&
        isNonNegativeInteger(counters.output_tokens) &&
        isNonNegativeInteger(counters.total_tokens) &&
        counters.total_tokens !== counters.input_tokens + counters.output_tokens) {
      complete = false;
      issues.push({ code: "counter-total-mismatch", sequence });
    }
    if (isNonNegativeInteger(counters.input_tokens) &&
        isNonNegativeInteger(counters.cached_input_tokens) &&
        counters.cached_input_tokens > counters.input_tokens) {
      complete = false;
      issues.push({ code: "cached-input-not-subset", sequence });
    }
    if (isNonNegativeInteger(counters.output_tokens) &&
        isNonNegativeInteger(counters.reasoning_output_tokens) &&
        counters.reasoning_output_tokens > counters.output_tokens) {
      complete = false;
      issues.push({ code: "reasoning-output-not-subset", sequence });
    }
    if (previous && TOKEN_FIELDS.every((field) => counters[field] === previous[field])) {
      duplicates.push(sequence);
      issues.push({ code: "duplicate-cumulative-counters", sequence });
    } else if (previous) {
      const decreased = TOKEN_FIELDS.filter((field) =>
        isNonNegativeInteger(counters[field]) && isNonNegativeInteger(previous[field]) && counters[field] < previous[field]);
      if (decreased.length > 0) {
        complete = false;
        issues.push({ code: "decreasing-cumulative-counter", sequence, fields: decreased });
      }
    }
    if (Object.hasOwn(info ?? {}, "last_token_usage") && !isRecord(info.last_token_usage)) {
      complete = false;
      issues.push({ code: "invalid-last-usage", sequence });
    }
    samples.push(sample);
    if (TOKEN_FIELDS.every((field) => isNonNegativeInteger(counters[field]))) previous = counters;
  }

  if (tokenRows.length === 0) {
    complete = false;
    issues.push({ code: "missing-token-count" });
  }
  if (truncated) {
    complete = false;
    issues.push({ code: "truncated-session" });
  }

  const latest = samples.at(-1)?.counters;
  const usage = complete && latest
    ? {
        inputTokens: latest.input_tokens,
        cachedInputTokens: latest.cached_input_tokens,
        outputTokens: latest.output_tokens,
        reasoningOutputTokens: latest.reasoning_output_tokens,
        totalTokens: latest.total_tokens,
        monetaryCost: null
      }
    : null;
  return Object.freeze({
    usage,
    complete,
    latest: latest ?? null,
    samples,
    duplicates,
    issues
  });
}

function readQuoted(text, start) {
  const quote = text[start];
  if (!["'", "\"", "`"].includes(quote)) return null;
  let value = "";
  for (let index = start + 1; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\\") {
      const next = text[index + 1];
      if (next === undefined) return null;
      const escapes = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", "\\": "\\", "'": "'", '"': '"', "`": "`" };
      value += escapes[next] ?? next;
      index += 1;
      continue;
    }
    if (char === quote) return { value, end: index + 1 };
    value += char;
  }
  return null;
}

function parseCallInput(payload) {
  const raw = payload?.arguments ?? payload?.input;
  if (isRecord(raw)) return { object: raw, raw: JSON.stringify(raw), wrapper: false };
  if (typeof raw !== "string") return { object: null, raw: null, wrapper: false };
  try {
    const parsed = JSON.parse(raw);
    if (isRecord(parsed)) return { object: parsed, raw, wrapper: false };
  } catch {
    // Codex custom_tool_call inputs are frequently raw JavaScript wrappers.
  }
  const invocationCount = (raw.match(/\bexec_command\s*\(/g) ?? []).length;
  if (invocationCount !== 1) return { object: null, raw, wrapper: true, reason: invocationCount > 1 ? "multiple-exec-commands" : "unparseable-exec-wrapper" };
  const prefix = /^\s*const\s+r\s*=\s*await\s+tools\.exec_command\s*\(\s*\{/u.exec(raw);
  if (!prefix) return { object: null, raw, wrapper: true, reason: "unparseable-exec-wrapper" };
  let index = prefix[0].length;
  const skip = () => { while (/\s/u.test(raw[index] ?? "")) index += 1; };
  const readField = (name) => {
    skip();
    const field = new RegExp(`${name}\\s*:`).exec(raw.slice(index));
    if (!field || field.index !== 0) return null;
    index += field[0].length;
    skip();
    const value = readQuoted(raw, index);
    if (!value) return null;
    index = value.end;
    return value.value;
  };
  const command = readField("cmd") ?? readField("command");
  if (command === null) return { object: null, raw, wrapper: true, reason: "unparseable-exec-wrapper" };
  skip();
  let workdir;
  if (raw[index] === ",") {
    index += 1;
    workdir = readField("workdir") ?? readField("cwd");
    if (workdir === null) return { object: null, raw, wrapper: true, reason: "unparseable-exec-wrapper" };
    skip();
  }
  if (raw[index] !== "}" || !/^\}\s*\)\s*;\s*text\s*\(\s*r(?:\.output)?\s*\)\s*;\s*$/u.test(raw.slice(index))) {
    return { object: null, raw, wrapper: true, reason: "unparseable-output-forwarding" };
  }
  const outputMode = /text\s*\(\s*r\.output\s*\)/u.test(raw) ? "r.output" : "r";
  return {object: {cmd: command, ...(workdir === undefined ? {} : {workdir})}, raw, wrapper: true, outputMode};
}

function shellTokens(command) {
  if (!hasText(command)) return { tokens: [], reason: "empty-command" };
  const tokens = [];
  let current = "";
  let quote = null;
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (quote) {
      if (char === "\\" && quote !== "'") {
        current += command[index + 1] ?? "";
        index += 1;
      } else if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (["'", '"'].includes(char)) {
      quote = char;
    } else if (/\s/.test(char)) {
      if (current) tokens.push(current);
      current = "";
    } else if ([";", "|", "&", ">", "<", "(", ")"].includes(char)) {
      return { tokens: [], reason: "shell-composition" };
    } else {
      current += char;
    }
  }
  if (quote) return { tokens: [], reason: "unterminated-shell-quote" };
  if (current) tokens.push(current);
  return { tokens, reason: null };
}

function classifyCommand(command) {
  const parsed = shellTokens(command);
  if (parsed.reason) return { kind: "unclassifiable", reason: parsed.reason };
  const [program, ...args] = parsed.tokens;
  if (!program) return { kind: "unclassifiable", reason: "empty-command" };
  if (program === "rg" || program === "grep" || program === "find") {
    return { kind: "candidate-search", program };
  }
  if (program === "cat") {
    const files = args[0] === "--" ? args.slice(1) : args;
    if (files.length !== 1 || files[0].startsWith("-")) return { kind: "unclassifiable", reason: "cat-not-single-file" };
    return { kind: "source-read", program, path: files[0], lineStart: 1, lineEnd: null };
  }
  if (program === "sed") {
    if (args.length !== 3 || args[0] !== "-n") return { kind: "unclassifiable", reason: "sed-not-single-range" };
    const range = /^(\d+)(?:,(\d+|\$))?p$/.exec(args[1]);
    if (!range) return { kind: "unclassifiable", reason: "sed-range-unknown" };
    return {
      kind: "source-read",
      program,
      path: args[2],
      lineStart: Number(range[1]),
      lineEnd: range[2] === undefined || range[2] === "$" ? (range[2] === "$" ? null : Number(range[1])) : Number(range[2])
    };
  }
  return { kind: "unclassifiable", reason: "unsupported-command", program };
}

function extractTextBlocks(value, { visibleOnly = false } = {}) {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.flatMap((block) => {
    if (typeof block === "string") return [block];
    if (!isRecord(block)) return [];
    if (visibleOnly && ["reasoning", "thinking", "tool_call", "tool_result"].includes(block.type)) return [];
    return typeof block.text === "string" ? [block.text] : [];
  });
}

function unwrapToolOutput(payload, outputMode) {
  if (payload?.isError || payload?.error || payload?.status === "error" || payload?.exit_code !== undefined && payload.exit_code !== 0 || payload?.exitCode !== undefined && payload.exitCode !== 0) {
    return { text: null, metadata: "failed-tool-result", truncated: false };
  }
  const raw = payload?.output;
  const blocks = extractTextBlocks(raw);
  if (blocks.length === 0) return { text: null, metadata: "missing-tool-output", truncated: false };
  let actualBlocks = [...blocks];
  let truncated = Boolean(payload?.truncated || payload?.is_truncated || payload?.metadata?.truncated);
  const markerIndex = actualBlocks.findIndex((block) => block.includes("\nOutput:\n"));
  if (markerIndex >= 0) {
    const first = actualBlocks[markerIndex];
    if (/truncat/i.test(first)) truncated = true;
    actualBlocks = [first.slice(first.indexOf("\nOutput:\n") + "\nOutput:\n".length), ...actualBlocks.slice(markerIndex + 1)];
  } else if (actualBlocks[0]?.includes("Script completed") && !actualBlocks[0].includes("\nOutput:\n")) {
    return { text: null, metadata: "missing-output-envelope", truncated };
  }
  const text = actualBlocks.join("");
  if (/Warning:\s*truncated output|output\s+truncated/i.test(text)) truncated = true;
  if (outputMode === "r") {
    try {
      const parsed = JSON.parse(text);
      if (parsed?.isError || parsed?.error || parsed?.status === "error" || parsed?.exit_code !== undefined && parsed.exit_code !== 0 || parsed?.exitCode !== undefined && parsed.exitCode !== 0) return { text: null, metadata: "failed-tool-result", truncated };
      if (typeof parsed?.output === "string") return { text: parsed.output, metadata: null, truncated };
      if (typeof parsed?.output === "undefined") return { text: null, metadata: "wrapper-result-has-no-output", truncated };
      return { text: JSON.stringify(parsed.output), metadata: null, truncated };
    } catch {
      return { text: null, metadata: "wrapper-result-not-json", truncated };
    }
  }
  if (outputMode === "r.output") {
    try {
      const parsed = JSON.parse(text);
      if (parsed?.isError || parsed?.error || parsed?.status === "error" || parsed?.exit_code !== undefined && parsed.exit_code !== 0 || parsed?.exitCode !== undefined && parsed.exitCode !== 0) return {text: null, metadata: "failed-tool-result", truncated};
      if (typeof parsed?.output === "string") return {text: parsed.output, metadata: null, truncated};
    } catch {
      // A plain r.output envelope is also valid when the harness returns raw text.
    }
  }
  if (/^(?:cat|sed):\s+[^\n]*(?:no such file|cannot open|error)/iu.test(text.trim()) || /(?:^|\n)(?:cat|sed): .*?(?:no such file|cannot open|error)/iu.test(text)) return {text: null, metadata: "failed-tool-result", truncated};
  return { text, metadata: null, truncated };
}

function normalizeSourcePath(rawPath, workdir, workspaceRoot) {
  if (!hasText(rawPath)) return { path: null, reason: "empty-source-path" };
  const base = workdir ? path.resolve(workdir) : (workspaceRoot ?? null);
  if (path.isAbsolute(rawPath)) {
    const absolute = path.normalize(rawPath);
    if (workspaceRoot && !isWithin(workspaceRoot, absolute)) return { path: null, reason: "source-path-outside-workspace" };
    return { path: workspaceRoot ? path.relative(workspaceRoot, absolute) : absolute, absolute };
  }
  if (!base) return { path: rawPath, absolute: null, unresolved: true };
  const absolute = path.resolve(base, rawPath);
  if (workspaceRoot && !isWithin(workspaceRoot, absolute)) return { path: null, reason: "source-path-escape" };
  return { path: workspaceRoot ? path.relative(workspaceRoot, absolute) : rawPath, absolute };
}

function expectedRangeBytes(snapshot, lineStart, lineEnd) {
  const text = snapshot.content.toString("utf8");
  if (lineStart === 1 && lineEnd === null) return snapshot.content;
  const lines = text.split(/(?<=\n)/u);
  const start = Math.max(1, lineStart);
  const end = lineEnd === null ? lines.length : Math.min(lines.length, lineEnd);
  return Buffer.from(lines.slice(start - 1, end).join(""), "utf8");
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function sourceReadFromPair(call, result, options) {
  const command = classifyCommand(call.command);
  if (result?.truncated) {
    return {
      unclassifiable: { sequence: call.sequence, resultSequence: result.sequence, reason: "truncated-tool-output", callId: call.callId },
      truncated: { sequence: call.sequence, resultSequence: result.sequence, reason: "truncated-tool-output", callId: call.callId }
    };
  }
  if (command.kind === "candidate-search") {
    return { candidateSearch: { sequence: call.sequence, resultSequence: result?.sequence ?? null, program: command.program, commandHash: call.argumentHash } };
  }
  if (command.kind !== "source-read") {
    return { unclassifiable: { sequence: call.sequence, resultSequence: result?.sequence ?? null, reason: command.reason ?? "unclassifiable-command", callId: call.callId } };
  }
  if (!result) return { unclassifiable: { sequence: call.sequence, resultSequence: null, reason: "missing-tool-result", callId: call.callId } };
  const output = unwrapToolOutput(result.payload, call.outputMode);
  if (output.metadata) return { unclassifiable: { sequence: call.sequence, resultSequence: result.sequence, reason: output.metadata, callId: call.callId } };
  if (output.truncated) return { truncated: { sequence: call.sequence, resultSequence: result.sequence, reason: "truncated-tool-output", callId: call.callId } };
  const normalized = normalizeSourcePath(command.path, call.workdir, options.workspaceRoot);
  if (!normalized.path) return { unclassifiable: { sequence: call.sequence, resultSequence: result.sequence, reason: normalized.reason, callId: call.callId } };
  const snapshot = options.sourceSnapshots?.get(normalized.path);
  const outputBytes = Buffer.from(output.text, "utf8");
  let coverageBytes = null;
  let coverage = "delivered-span-unverified";
  let snapshotSha256 = null;
  if (snapshot?.content) {
    const expected = expectedRangeBytes(snapshot, command.lineStart, command.lineEnd);
    if (!expected.equals(outputBytes)) {
      return {unclassifiable: {sequence: call.sequence, resultSequence: result.sequence, reason: "source-output-mismatch", callId: call.callId}};
    }
    coverageBytes = expected.byteLength;
    coverage = "verified-delivered-source-span";
    snapshotSha256 = snapshot.sha256;
  } else if (snapshot) {
    coverage = "source-snapshot-version-unverified";
    snapshotSha256 = snapshot.sha256;
  }
  return {
    sourceRead: {
      path: normalized.path,
      pathResolution: normalized.unresolved ? "unresolved" : "workspace-relative",
      command: command.program,
      lineStart: command.lineStart,
      lineEnd: command.lineEnd,
      callId: call.callId,
      callSequence: call.sequence,
      resultSequence: result.sequence,
      outputSha256: sha256(output.text),
      outputUtf8Bytes: utf8Bytes(output.text),
      coverageBytes,
      coverage,
      ...(snapshotSha256 ? {sourceSnapshotSha256: snapshotSha256} : {}),
      exactOutput: true
    }
  };
}

function visibleAssistantText(payload) {
  if (payload?.role !== "assistant" || payload?.type !== "message") return null;
  if (payload.phase !== "final") return null;
  const blocks = extractTextBlocks(payload.content, { visibleOnly: true });
  if (blocks.length === 0 && typeof payload.text === "string") return payload.text;
  return blocks.length > 0 ? blocks.join("") : null;
}

function evidenceRefs(text) {
  if (!hasText(text)) return [];
  const refs = new Set();
  const pattern = /(?:^|[\s`([{"'])([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+)(?::\d+(?:-\d+)?)?/g;
  for (const match of text.matchAll(pattern)) refs.add(match[1]);
  return [...refs].sort();
}

function detectTruncation(row, payload) {
  return Boolean(
    payload?.truncated || payload?.is_truncated || payload?.metadata?.truncated ||
    row?.truncated || row?.metadata?.truncated
  );
}

function checkRegularSessionFile(sessionFile) {
  return lstat(sessionFile).then((stat) => {
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new PortableMapStudyObservationError("invalid-session-file", "sessionFile must name a regular non-symlink file.", { sessionFile });
    }
  }).catch((error) => {
    if (error instanceof PortableMapStudyObservationError) throw error;
    throw new PortableMapStudyObservationError("session-file-unavailable", `Unable to read the exact sessionFile: ${sessionFile}.`, { sessionFile }, error);
  });
}

function parseSessionText(text, sessionFile) {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  const rows = [];
  const issues = [];
  let truncated = false;
  let malformed = false;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() === "") {
      issues.push({ code: "invalid-json-line", sequence: index });
      malformed = true;
      continue;
    }
    try {
      rows.push({ row: JSON.parse(lines[index]), sequence: index });
    } catch (error) {
      const trailing = index === lines.length - 1;
      issues.push({ code: trailing ? "truncated-json-line" : "invalid-json-line", sequence: index });
      if (trailing) truncated = true;
      malformed = true;
    }
  }
  if (rows.length === 0) {
    throw new PortableMapStudyObservationError("invalid-session", "The exact sessionFile contains no parseable JSON event.", { sessionFile, issues });
  }
  return { rows, issues, truncated, malformed };
}

function freezeResult(value) {
  return Object.freeze(value);
}

/** Extract one explicitly named session. No directory discovery is performed. */
export async function extractObservedSession(options) {
  const normalized = normalizeSingleOptions(options);
  await checkRegularSessionFile(normalized.sessionFile);
  const text = await readFile(normalized.sessionFile, "utf8");
  const parsed = parseSessionText(text, normalized.sessionFile);
  if (parsed.rows[0].sequence !== 0) {
    throw new PortableMapStudyObservationError(
      "invalid-session",
      "The exact sessionFile does not begin with a parseable lineage header.",
      { sessionFile: normalized.sessionFile, parseIssues: parsed.issues }
    );
  }
  const first = parsed.rows[0].row;
  const lineage = validateLineage(first, normalized);
  const tokenRows = [];
  const completionEvents = [];
  const calls = [];
  const results = [];
  const finals = [];
  const orderedToolEvents = [];
  const parseIssues = [...parsed.issues];

  for (const entry of parsed.rows) {
    const payload = getPayload(entry.row);
    if (!payload) {
      parseIssues.push({ code: "missing-payload", sequence: entry.sequence });
      continue;
    }
    if (entry.row.type === "turn_context") {
      // A top-level turn_context is metadata in some session versions.
      continue;
    }
    if (payload.type === "token_count" && entry.row.type === "event_msg") tokenRows.push(entry);
    if (payload.type === "task_complete" && entry.row.type === "event_msg") completionEvents.push(stamp(entry.row, entry.sequence));
    if (entry.row.type !== "response_item") continue;

    const eventType = payload.type;
    if (eventType === "function_call" || eventType === "custom_tool_call") {
      const parsedInput = parseCallInput(payload);
      const command = parsedInput.object?.cmd ?? parsedInput.object?.command ?? null;
      const call = {
        ...stamp(entry.row, entry.sequence),
        kind: "call",
        name: hasText(payload.name) ? payload.name : null,
        callId: hasText(payload.call_id) ? payload.call_id : null,
        argumentHash: parsedInput.raw === null ? null : sha256(parsedInput.raw),
        argumentUtf8Bytes: parsedInput.raw === null ? null : utf8Bytes(parsedInput.raw),
        command: typeof command === "string" ? command : null,
        workdir: typeof parsedInput.object?.workdir === "string" ? parsedInput.object.workdir : null,
        outputMode: parsedInput.outputMode ?? null,
        parseIssue: parsedInput.reason ?? null
      };
      calls.push(call);
      orderedToolEvents.push({ ...stamp(entry.row, entry.sequence), kind: "call", callId: call.callId, name: call.name });
    } else if (eventType === "function_call_output" || eventType === "custom_tool_call_output") {
      const rawOutput = payload.output;
      const outputText = extractTextBlocks(rawOutput).join("");
      const result = {
        ...stamp(entry.row, entry.sequence),
        kind: "result",
        callId: hasText(payload.call_id) ? payload.call_id : null,
        outputSha256: outputText ? sha256(outputText) : null,
        outputUtf8Bytes: outputText ? utf8Bytes(outputText) : null,
        truncated: detectTruncation(entry.row, payload),
        payload
      };
      results.push(result);
      orderedToolEvents.push({ ...stamp(entry.row, entry.sequence), kind: "result", callId: result.callId });
    }

    const finalText = visibleAssistantText(payload);
    if (finalText !== null) {
      finals.push({
        ...stamp(entry.row, entry.sequence),
        sha256: sha256(finalText),
        utf8Bytes: utf8Bytes(finalText),
        evidenceRefs: evidenceRefs(finalText)
      });
    }
  }

  const pairingIssues = [];
  const callsById = new Map();
  for (const call of calls) {
    if (!call.callId) {
      pairingIssues.push({sequence: call.sequence, resultSequence: null, reason: "missing-call-id", callId: null});
      continue;
    }
    const previous = callsById.get(call.callId);
    if (previous) pairingIssues.push({sequence: call.sequence, resultSequence: null, reason: "duplicate-tool-call", callId: call.callId});
    else callsById.set(call.callId, call);
  }
  const resultsById = new Map();
  for (const result of results) {
    if (!result.callId) {
      pairingIssues.push({sequence: null, resultSequence: result.sequence, reason: "unpaired-tool-result", callId: null});
      continue;
    }
    if (!resultsById.has(result.callId)) resultsById.set(result.callId, []);
    resultsById.get(result.callId).push(result);
  }
  const resultByCallId = new Map();
  for (const [callId, call] of callsById) {
    const subsequent = (resultsById.get(callId) ?? []).filter((result) => result.sequence > call.sequence);
    const prior = (resultsById.get(callId) ?? []).filter((result) => result.sequence <= call.sequence);
    if (prior.length > 0) pairingIssues.push({sequence: call.sequence, resultSequence: prior[0].sequence, reason: "result-before-call", callId});
    if (subsequent.length === 0) {
      pairingIssues.push({sequence: call.sequence, resultSequence: null, reason: "missing-tool-result", callId});
    } else if (subsequent.length > 1) {
      pairingIssues.push({sequence: call.sequence, resultSequence: subsequent[1].sequence, reason: "duplicate-tool-result", callId});
    } else if (prior.length > 0) {
      // Any result before its call invalidates the pair even if a later result exists.
    } else {
      resultByCallId.set(callId, subsequent[0]);
    }
  }
  for (const [callId, resultList] of resultsById) {
    if (!callsById.has(callId)) {
      for (const result of resultList) pairingIssues.push({sequence: null, resultSequence: result.sequence, reason: "unpaired-tool-result", callId});
    }
  }
  const sourceReads = [];
  const candidateSearches = [];
  const unclassifiable = [];
  const truncatedReads = [];
  for (const call of calls) {
    if (call.parseIssue) {
      unclassifiable.push({ sequence: call.sequence, resultSequence: null, reason: call.parseIssue, callId: call.callId });
      continue;
    }
    const result = resultByCallId.get(call.callId);
    const classified = sourceReadFromPair(call, result, normalized);
    if (classified.sourceRead) sourceReads.push(classified.sourceRead);
    if (classified.candidateSearch) candidateSearches.push(classified.candidateSearch);
    if (classified.unclassifiable) unclassifiable.push(classified.unclassifiable);
    if (classified.truncated) truncatedReads.push(classified.truncated);
  }
  unclassifiable.push(...pairingIssues);
  const tokenUsage = inspectTokenUsage(tokenRows, parsed.truncated || parsed.malformed);
  const observedReadPaths = new Set(sourceReads.map((read) => read.path));
  const citedPaths = new Set(finals.flatMap((entry) => entry.evidenceRefs.map((ref) => ref.split(":")[0])));
  const overlapPaths = [...citedPaths].filter((ref) => observedReadPaths.has(ref)).sort();
  const verifiedRangeOverlap = finals.flatMap((entry) => entry.evidenceRefs.map((ref) => {
    const match = /^(.*?):(\d+)(?:-(\d+))?$/u.exec(ref);
    if (!match) return null;
    const start = Number(match[2]);
    const end = Number(match[3] ?? match[2]);
    const read = sourceReads.find((candidate) => candidate.path === match[1] && candidate.coverage === "verified-delivered-source-span" && candidate.lineStart <= start && (candidate.lineEnd === null || candidate.lineEnd >= end));
    return read ? {path: match[1], lineStart: start, lineEnd: end} : null;
  }).filter(Boolean));
  const explicitFinalMarker = finals.some((entry) => entry.sequence > 0);
  const completionStatus = completionEvents.length > 0 && explicitFinalMarker && !parsed.malformed ? "completed" : "incomplete";
  const provenance = {
    ...(normalized.sourceManifestSha256 ? { sourceManifestSha256: normalized.sourceManifestSha256 } : {}),
    ...(normalized.sourceBytes !== undefined ? { sourceBytes: normalized.sourceBytes } : {}),
    ...(normalized.frozenSource !== undefined ? { frozenSource: normalized.frozenSource } : {})
  };
  const output = {
    schemaVersion: OBSERVED_SESSION_SCHEMA_VERSION,
    lineage: freezeResult({
      sessionFile: normalized.sessionFile,
      sessionId: lineage.sessionId,
      parentId: normalized.parentId,
      agentPath: normalized.agentPath,
      ...(normalized.workspaceRoot ? { workspaceRoot: normalized.workspaceRoot } : {})
    }),
    provenance,
    completionStatus,
    completionEvents,
    completionEvidence: {explicitFinalMarker, taskCompleteEvent: completionEvents.length > 0, parseComplete: !parsed.malformed},
    turnContexts: parsed.rows
      .filter(({ row }) => row.type === "turn_context")
      .map(({ row, sequence }) => ({ ...stamp(row, sequence), model: row.payload?.model ?? null, effort: row.payload?.effort ?? null })),
    usage: tokenUsage.usage,
    usageMetadata: tokenUsage,
    assistantFinals: finals,
    orderedToolEvents,
    toolCalls: calls.map(({ payload, command, workdir, outputMode, ...call }) => call),
    toolResults: results.map(({ payload, ...result }) => result),
    sourceReads,
    candidateSearches,
    unclassifiableEvents: [...unclassifiable, ...truncatedReads],
    truncated: parsed.truncated || parsed.malformed || tokenUsage.issues.some((issue) => issue.code === "truncated-session") || results.some((result) => result.truncated),
    parseIssues,
    retentionProxy: {
      finalCount: finals.length,
      citedPaths: [...citedPaths].sort(),
      observedReadPaths: [...observedReadPaths].sort(),
      overlapPaths,
      pathCitationOverlap: overlapPaths,
      verifiedRangeOverlap,
      overlapCount: overlapPaths.length,
      unknownReadMetrics: {status: "unavailable", reason: "The session does not prove reads that were not explicitly paired with delivered output."},
      interpretation: "Path citations are retained separately from verified source-range overlap; neither is a model-memory measure."
    },
    limitations: [
      "Only the explicitly named regular session file was inspected.",
      "Hidden reasoning and message payloads are not retained.",
      "Search results, backend scans, and unclassifiable or truncated outputs are not source reads.",
      "Tokenizer and monetary cost are unavailable; monetaryCost remains null."
    ]
  };
  return freezeResult(output);
}

/** Extract several exact files; every file still requires explicit lineage. */
export async function extractObservedSessions(options) {
  if (!isRecord(options)) throw new PortableMapStudyObservationError("invalid-options", "Observation options must be an object.");
  assertKnownOptions(options);
  if (!Array.isArray(options.sessionFiles) || options.sessionFiles.length === 0) {
    throw new PortableMapStudyObservationError("missing-option", "sessionFiles must be a non-empty explicit array.");
  }
  if (Object.hasOwn(options, "sessionFile")) {
    throw new PortableMapStudyObservationError("ambiguous-option", "Use sessionFile or sessionFiles, not both.");
  }
  const agentPaths = options.agentPaths ?? options.sessionFiles.map(() => options.agentPath);
  if (!Array.isArray(agentPaths) || agentPaths.length !== options.sessionFiles.length) {
    throw new PortableMapStudyObservationError("invalid-option", "agentPaths must align one-for-one with sessionFiles.");
  }
  return Promise.all(options.sessionFiles.map((sessionFile, index) => extractObservedSession({
    ...options,
    sessionFile,
    agentPath: agentPaths[index],
    sessionFiles: undefined,
    agentPaths: undefined
  })));
}

export const extractSessionObservation = extractObservedSession;
export const extractSessionObservations = extractObservedSessions;
