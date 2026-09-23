import {constants} from "node:fs";
import {lstat, open, realpath} from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";

import {analyzePromptBoundaryText} from "../../shared/security.js";
import {
  capturePathSnapshot,
  samePathIdentity,
  samePathSnapshot,
  sourcePathExclusionReason,
  sourcePathSafetyReason,
  type PathSnapshot
} from "./path-policy.js";

/** The maximum transient source payload retained by a source read. */
export const DEFAULT_SAFE_SOURCE_READ_BYTES = 1 * 1024 * 1024;
export const SAFE_SOURCE_CHUNK_BYTES = 64 * 1024;

export const CONTENT_BOUNDARY_CODES = [
  "private-key",
  "credential",
  "prompt-injection",
  "prompt-context",
  "unsafe-display",
  "encoded-payload",
  "control-character"
] as const;
export type ContentBoundaryCode = typeof CONTENT_BOUNDARY_CODES[number];
export type ContentBoundarySeverity = "warning" | "error";

/**
 * A fixed, metadata-only finding.  The source text, key material, and parser
 * or regex error are deliberately absent from this public shape.
 */
export type ContentBoundaryFinding = {
  code: ContentBoundaryCode;
  severity: ContentBoundarySeverity;
  message: string;
};

export type ContentBoundaryAnalysis = {
  safe: boolean;
  hasWarnings: boolean;
  hasErrors: boolean;
  findings: readonly ContentBoundaryFinding[];
  warnings: readonly string[];
  errors: readonly string[];
};

export type SafeSourceFailureReason =
  | "unsafe-path"
  | "symlink"
  | "missing"
  | "not-a-regular-file"
  | "unreadable"
  | "binary"
  | "too-large"
  | "changed-during-read"
  | "hash-mismatch"
  | "unsafe-content"
  | "invalid-range";

export type SafeSourceDiagnostic = {
  reason: SafeSourceFailureReason;
  message: string;
};

export type SafeSourceReadOptions = {
  /** Full-file expected hash used as a compare-and-swap basis. */
  expectedHash?: string;
  /** Maximum source bytes retained in memory; hashing remains streaming. */
  maxBytes?: number;
  /** Optional UTF-8 byte range for selected bounded evidence. */
  startByte?: number;
  endByteExclusive?: number;
};

export type SafeSourceReadSuccess = {
  ok: true;
  content: string;
  contentHash: string;
  byteSize: number;
  startByte: number;
  endByteExclusive: number;
  warnings: readonly string[];
};

export type SafeSourceReadFailure = {
  ok: false;
  diagnostic: SafeSourceDiagnostic;
};

export type SafeSourceReadResult = SafeSourceReadSuccess | SafeSourceReadFailure;

const PRIVATE_KEY_PATTERN = /-----BEGIN(?: [A-Z0-9]+)* PRIVATE KEY-----/;
const CREDENTIAL_PATTERNS = [
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bASIA[0-9A-Z]{16}\b/,
  /\b(?:gh[pousr]|xox[baprs])_[A-Za-z0-9_-]{16,}\b/,
  /\b(?:sk_(?:live|test)_|sk-[A-Za-z0-9]|npm_|AIza)[A-Za-z0-9_\-]{12,}\b/,
  /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\b/,
  /\b(?:password|passwd|secret|token|api[-_ ]?key|access[-_ ]?key)\s*[:=]\s*["'`][^"'`\r\n]{8,}["'`]/i,
  /\b(?:password|passwd|secret|token|api[-_ ]?key|access[-_ ]?key)\s*[:=]\s*[A-Za-z0-9+/=_-]{16,}/i
] as const;
const UNSAFE_CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/;

const FIXED_MESSAGES: Record<ContentBoundaryCode, string> = {
  "private-key": "Source content contains private-key material.",
  credential: "Source content contains credential-shaped material.",
  "prompt-injection": "Source content contains instruction-override language.",
  "prompt-context": "Source content references prompt-boundary metadata.",
  "unsafe-display": "Source content contains protocol-style role markers.",
  "encoded-payload": "Source content contains a suspicious encoded payload.",
  "control-character": "Source content contains invisible or control characters."
};

function finding(code: ContentBoundaryCode, severity: ContentBoundarySeverity): ContentBoundaryFinding {
  return {code, severity, message: FIXED_MESSAGES[code]};
}

function uniqueFindings(findings: ContentBoundaryFinding[]): ContentBoundaryFinding[] {
  const byCode = new Map<ContentBoundaryCode, ContentBoundaryFinding>();
  for (const item of findings) {
    const previous = byCode.get(item.code);
    if (!previous || (previous.severity === "warning" && item.severity === "error")) {
      byCode.set(item.code, item);
    }
  }
  return CONTENT_BOUNDARY_CODES.flatMap((code) => {
    const item = byCode.get(code);
    return item ? [item] : [];
  });
}

/**
 * Apply the shared prompt boundary checks and deterministic secret-shaped
 * checks without returning source text or regex captures in diagnostics.
 */
export function inspectContentBoundaries(text: string): ContentBoundaryAnalysis {
  // A leading UTF-8 BOM is source framing, not unsafe content. Preserve it in
  // the returned bytes while excluding only that one framing character from
  // prompt/control checks.
  const boundaryText = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const prompt = analyzePromptBoundaryText(boundaryText);
  const findings: ContentBoundaryFinding[] = prompt.findings.map((item) => {
    const code = item.type as ContentBoundaryCode;
    return finding(code, item.severity);
  });

  if (PRIVATE_KEY_PATTERN.test(text)) findings.push(finding("private-key", "error"));
  if (CREDENTIAL_PATTERNS.some((pattern) => pattern.test(text))) findings.push(finding("credential", "error"));
  // CR/LF/TAB remain valid source whitespace; every other C0/DEL and the
  // invisible formatting controls are rejected rather than sanitized.
  if (UNSAFE_CONTROL_CHARACTER_PATTERN.test(boundaryText)) findings.push(finding("control-character", "error"));

  const ordered = uniqueFindings(findings);
  const errors = ordered.filter((item) => item.severity === "error").map((item) => item.message);
  const warnings = ordered.filter((item) => item.severity === "warning").map((item) => item.message);
  return {
    safe: errors.length === 0,
    hasWarnings: warnings.length > 0,
    hasErrors: errors.length > 0,
    findings: ordered,
    warnings,
    errors
  };
}

/** Stable aliases for callers that describe the same boundary operation differently. */
export const analyzeContentBoundaries = inspectContentBoundaries;
export const checkContentBoundaries = inspectContentBoundaries;

export function isSafeContent(text: string): boolean {
  return inspectContentBoundaries(text).safe;
}

function unsafeDiagnostic(reason: SafeSourceFailureReason): SafeSourceReadFailure {
  const messages: Record<SafeSourceFailureReason, string> = {
    "unsafe-path": "The source path is outside the permitted repository boundary.",
    symlink: "Symlinked source paths are not accepted.",
    missing: "The source file is unavailable.",
    "not-a-regular-file": "The source path is not a regular file.",
    unreadable: "The source file could not be read.",
    binary: "Binary source content is not eligible for text extraction.",
    "too-large": "The selected source region exceeds the transient read limit.",
    "changed-during-read": "The source changed while it was being read.",
    "hash-mismatch": "The source no longer matches its expected content hash.",
    "unsafe-content": "Source content crossed a content boundary and was omitted.",
    "invalid-range": "The requested source range is invalid."
  };
  return {ok: false, diagnostic: {reason, message: messages[reason]}};
}

function isWithin(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function validateRelativePath(relativePath: string): boolean {
  return relativePath.length > 0 &&
    relativePath.length <= 4096 &&
    !relativePath.includes("\0") &&
    !relativePath.includes("\\") &&
    !relativePath.startsWith("/") &&
    !/^[A-Za-z]:[\\/]/.test(relativePath) &&
    !relativePath.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..");
}

/** Resolve and inspect every literal path component; aliases are rejected. */
type LiteralFileStat = {
  size: number;
  dev: number;
  ino: number;
  mtimeMs: number;
  ctimeMs: number;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
};

export async function resolveLiteralRegularFile(rootPath: string, relativePath: string): Promise<
  {ok: true; absolutePath: string; stat: LiteralFileStat; snapshot: PathSnapshot} | SafeSourceReadFailure
> {
  if (!validateRelativePath(relativePath) || sourcePathSafetyReason(relativePath) || sourcePathExclusionReason(relativePath)) {
    return unsafeDiagnostic("unsafe-path");
  }
  const absoluteRoot = path.resolve(rootPath);
  const absolutePath = path.resolve(absoluteRoot, relativePath);
  if (!isWithin(absoluteRoot, absolutePath)) return unsafeDiagnostic("unsafe-path");

  let rootReal: string;
  try {
    rootReal = await realpath(absoluteRoot);
  } catch {
    return unsafeDiagnostic("missing");
  }

  let current = absoluteRoot;
  const segments = relativePath.split("/");
  for (let index = 0; index <= segments.length; index += 1) {
    const info = await lstat(current).catch(() => null);
    if (!info) return unsafeDiagnostic("missing");
    // The repository root may itself be a symlink supplied by the caller. Its
    // descendants must still be literal entries within the resolved root.
    if (index > 0 && info.isSymbolicLink()) return unsafeDiagnostic("symlink");
    if (index < segments.length && !info.isDirectory()) return unsafeDiagnostic("not-a-regular-file");
    if (index < segments.length) current = path.join(current, segments[index]!);
  }

  const stat = await lstat(absolutePath).catch(() => null);
  if (!stat) return unsafeDiagnostic("missing");
  if (stat.isSymbolicLink()) return unsafeDiagnostic("symlink");
  if (!stat.isFile()) return unsafeDiagnostic("not-a-regular-file");
  const resolvedCandidate = await realpath(absolutePath).catch(() => null);
  if (!resolvedCandidate || !isWithin(rootReal, resolvedCandidate)) return unsafeDiagnostic("unsafe-path");
  const snapshot = await capturePathSnapshot(absoluteRoot, relativePath);
  if (!snapshot) return unsafeDiagnostic("changed-during-read");
  return {ok: true, absolutePath, stat: stat as LiteralFileStat, snapshot};
}

function decodeUtf8(buffer: Buffer): string | null {
  try {
    return new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(buffer);
  } catch {
    return null;
  }
}

/**
 * Read a bounded, literal source file transiently. The full-file hash is
 * computed while streaming, so callers can use an expected hash as a CAS
 * check even when only a selected range is returned.
 */
export async function readSourceContentSafely(
  rootPath: string,
  relativePath: string,
  options: SafeSourceReadOptions = {}
): Promise<SafeSourceReadResult> {
  const resolved = await resolveLiteralRegularFile(rootPath, relativePath);
  if (!resolved.ok) return resolved;
  const maxBytes = options.maxBytes ?? DEFAULT_SAFE_SOURCE_READ_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) return unsafeDiagnostic("invalid-range");

  const startByte = options.startByte ?? 0;
  const fileSize = Number(resolved.stat.size);
  const endByteExclusive = options.endByteExclusive ?? fileSize;
  if (!Number.isSafeInteger(startByte) || !Number.isSafeInteger(endByteExclusive) ||
      startByte < 0 || endByteExclusive < startByte || endByteExclusive > fileSize ||
      endByteExclusive - startByte > maxBytes) {
    return endByteExclusive - startByte > maxBytes
      ? unsafeDiagnostic("too-large")
      : unsafeDiagnostic("invalid-range");
  }

  let handle;
  try {
    handle = await open(resolved.absolutePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  } catch {
    return unsafeDiagnostic("unreadable");
  }

  const openedStat = await handle.stat().catch(() => null);
  if (!openedStat || !openedStat.isFile() || !samePathIdentity(resolved.snapshot.target, {
    device: openedStat.dev,
    inode: openedStat.ino,
    size: Number(openedStat.size),
    mtimeMs: openedStat.mtimeMs,
    ctimeMs: openedStat.ctimeMs
  })) {
    await handle.close().catch(() => undefined);
    return unsafeDiagnostic("changed-during-read");
  }

  const digest = createHash("sha256");
  const selected = Buffer.allocUnsafe(endByteExclusive - startByte);
  let selectedOffset = 0;
  let offset = 0;
  let binary = false;
  let byteSize = 0;
  try {
    const chunk = Buffer.allocUnsafe(SAFE_SOURCE_CHUNK_BYTES);
    while (true) {
      const read = await handle.read(chunk, 0, chunk.length, offset);
      if (read.bytesRead === 0) break;
      const part = chunk.subarray(0, read.bytesRead);
      digest.update(part);
      byteSize += read.bytesRead;
      if (part.includes(0)) binary = true;
      const overlapStart = Math.max(offset, startByte);
      const overlapEnd = Math.min(offset + read.bytesRead, endByteExclusive);
      if (overlapEnd > overlapStart) {
        const from = overlapStart - offset;
        const length = overlapEnd - overlapStart;
        part.copy(selected, selectedOffset, from, from + length);
        selectedOffset += length;
      }
      offset += read.bytesRead;
    }
  } catch {
    await handle.close().catch(() => undefined);
    return unsafeDiagnostic("unreadable");
  }

  const hash = digest.digest("hex");
  const after = await handle.stat().catch(() => null);
  await handle.close().catch(() => undefined);
  if (!after || !after.isFile() || !samePathIdentity(resolved.snapshot.target, {
    device: after.dev,
    inode: after.ino,
    size: Number(after.size),
    mtimeMs: after.mtimeMs,
    ctimeMs: after.ctimeMs
  }) || byteSize !== fileSize) {
    return unsafeDiagnostic("changed-during-read");
  }
  const finalSnapshot = await capturePathSnapshot(rootPath, relativePath);
  if (!finalSnapshot || !samePathSnapshot(resolved.snapshot, finalSnapshot)) {
    return unsafeDiagnostic("changed-during-read");
  }
  if (options.expectedHash && !/^[a-f0-9]{64}$/.test(options.expectedHash)) {
    return unsafeDiagnostic("hash-mismatch");
  }
  if (options.expectedHash && options.expectedHash !== hash) return unsafeDiagnostic("hash-mismatch");
  if (binary) return unsafeDiagnostic("binary");

  const content = decodeUtf8(selected);
  if (content === null) return unsafeDiagnostic("binary");
  const boundary = inspectContentBoundaries(content);
  if (!boundary.safe) return unsafeDiagnostic("unsafe-content");

  return {
    ok: true,
    content,
    contentHash: hash,
    byteSize,
    startByte,
    endByteExclusive,
    warnings: boundary.warnings
  };
}

export const readSafeSourceContent = readSourceContentSafely;
export const readSourceFileSafely = readSourceContentSafely;
