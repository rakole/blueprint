import {constants} from "node:fs";
import {execFile} from "node:child_process";
import {lstat, open, realpath} from "node:fs/promises";
import {promisify} from "node:util";
import path from "node:path";
import {createHash} from "node:crypto";

import type {PortableLanguage} from "./contracts.js";
import {resolveLiteralRegularFile} from "./content-boundary.js";
import {
  SOURCE_PATH_EXCLUSION_REASONS,
  sourcePathExclusionReason,
  sourcePathSafetyReason,
  sourcePathIsGenerated,
  capturePathSnapshot,
  samePathSnapshot,
  samePathIdentity,
  type PathIdentity
} from "./path-policy.js";

const execFileAsync = promisify(execFile);

export const INVENTORY_MAX_FILE_BYTES = 1 * 1024 * 1024;
export const INVENTORY_HASH_CHUNK_BYTES = 64 * 1024;

/** @internal Deterministic race seam used only by focused filesystem tests. */
export const inventoryTestHooks: {
  afterChunk?: (absolutePath: string, chunkIndex: number) => Promise<void> | void;
} = {};

export const INVENTORY_EXCLUSION_REASONS = SOURCE_PATH_EXCLUSION_REASONS;
export type InventoryExclusionReason = typeof INVENTORY_EXCLUSION_REASONS[number];

export type InventoryCoverageHint = "full" | "file";
export type InventorySupport = "supported" | "unsupported";
export type InventoryFileRole = "source" | "test" | "configuration" | "documentation" | "generated" | "unknown";

/** Metadata retained for every eligible file, including unknown languages. */
export type SourceInventoryFile = {
  path: string;
  language: PortableLanguage;
  role: InventoryFileRole;
  byteSize: number;
  contentHash: string;
  coverageHint: InventoryCoverageHint;
  support: InventorySupport;
};

export type InventoryExclusionCounts = Record<InventoryExclusionReason, number>;

export type SourceInventory = {
  files: readonly SourceInventoryFile[];
  inventoryFingerprint: string;
  /** Alias for consumers that use the shorter term. */
  fingerprint: string;
  candidateCount: number;
  includedCount: number;
  excludedCount: number;
  exclusionCounts: InventoryExclusionCounts;
  /** Fixed reasons only; paths and source values are intentionally omitted. */
  exclusions: readonly {reason: InventoryExclusionReason; count: number}[];
};

export type InventoryOptions = {
  /** Defaults to true; false is useful only for deterministic test doubles. */
  useGit?: boolean;
};

type ExclusionObservation = {
  path: string;
  reason: InventoryExclusionReason;
  byteSize: number | null;
};

type HashedFile = {
  byteSize: number;
  contentHash: string;
  binary: boolean;
};

const EXCLUSION_REASON_SET = new Set<string>(INVENTORY_EXCLUSION_REASONS);
const comparePath = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const SOURCE_EXTENSIONS = new Map<string, PortableLanguage>([
  [".js", "javascript"], [".mjs", "javascript"], [".cjs", "javascript"],
  [".jsx", "jsx"], [".ts", "typescript"], [".mts", "typescript"], [".cts", "typescript"],
  [".tsx", "tsx"], [".py", "python"], [".java", "java"]
]);
const DOCUMENT_EXTENSIONS = new Set([".md", ".mdx", ".rst", ".adoc", ".txt"]);
const CONFIG_EXTENSIONS = new Set([".json", ".jsonc", ".yaml", ".yml", ".toml", ".ini", ".xml", ".properties", ".conf"]);

function emptyExclusionCounts(): InventoryExclusionCounts {
  return Object.fromEntries(INVENTORY_EXCLUSION_REASONS.map((reason) => [reason, 0])) as InventoryExclusionCounts;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function classifyPath(relativePath: string): {language: PortableLanguage; role: InventoryFileRole; support: InventorySupport} {
  const normalized = relativePath.toLowerCase();
  const base = path.posix.basename(normalized);
  const extension = path.posix.extname(base);
  const segments = normalized.split("/");
  const language = SOURCE_EXTENSIONS.get(extension) ?? "unknown";
  const generated = sourcePathIsGenerated(relativePath);
  const test = segments.some((segment) => segment === "test" || segment === "tests" || segment === "__tests__") ||
    /(?:\.test|\.spec)\.[^.]+$/.test(base);
  const role: InventoryFileRole = generated
    ? "generated"
    : test
      ? "test"
      : DOCUMENT_EXTENSIONS.has(extension)
        ? "documentation"
        : CONFIG_EXTENSIONS.has(extension)
          ? "configuration"
          : language === "unknown" ? "unknown" : "source";
  return {language, role, support: language === "unknown" ? "unsupported" : "supported"};
}

function pathSafetyReason(relativePath: string): InventoryExclusionReason | null {
  return sourcePathSafetyReason(relativePath);
}

async function listGitFiles(rootPath: string): Promise<string[]> {
  let stdout: string | Buffer;
  try {
    const result = await execFileAsync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--"], {
      cwd: rootPath,
      encoding: "buffer",
      maxBuffer: 64 * 1024 * 1024
    });
    stdout = result.stdout;
  } catch {
    // Inventory cannot safely claim a complete source basis without Git's
    // tracked/nonignored-untracked boundary.
    throw new Error("Unable to enumerate repository files through Git.");
  }
  const bytes = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
  return [...new Set(bytes.toString("utf8").split("\0").filter((item) => item.length > 0))]
    .sort(comparePath);
}

async function hashLiteralFile(
  absolutePath: string,
  expected: PathIdentity
): Promise<HashedFile | InventoryExclusionReason> {
  let handle;
  try {
    handle = await open(absolutePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  } catch {
    return "unreadable";
  }
  const opened = await handle.stat().catch(() => null);
  if (!opened || !opened.isFile() || !samePathIdentity(expected, {
    device: opened.dev,
    inode: opened.ino,
    size: Number(opened.size),
    mtimeMs: opened.mtimeMs,
    ctimeMs: opened.ctimeMs
  })) {
    await handle.close().catch(() => undefined);
    return "changed-during-read";
  }
  const hash = createHash("sha256");
  const chunk = Buffer.allocUnsafe(INVENTORY_HASH_CHUNK_BYTES);
  let byteSize = 0;
  let chunkIndex = 0;
  let binary = false;
  let utf8Valid = true;
  const decoder = new TextDecoder("utf-8", {fatal: true});
  try {
    while (true) {
      const read = await handle.read(chunk, 0, chunk.length, byteSize);
      if (read.bytesRead === 0) break;
      const part = chunk.subarray(0, read.bytesRead);
      hash.update(part);
      byteSize += read.bytesRead;
      if (part.includes(0)) binary = true;
      if (utf8Valid) {
        try {
          decoder.decode(part, {stream: true});
        } catch {
          utf8Valid = false;
        }
      }
      await inventoryTestHooks.afterChunk?.(absolutePath, chunkIndex);
      chunkIndex += 1;
    }
  } catch {
    await handle.close().catch(() => undefined);
    return "unreadable";
  }
  const after = await handle.stat().catch(() => null);
  await handle.close().catch(() => undefined);
  if (!after || !after.isFile() || !samePathIdentity(expected, {
    device: after.dev,
    inode: after.ino,
    size: Number(after.size),
    mtimeMs: after.mtimeMs,
    ctimeMs: after.ctimeMs
  })) return "changed-during-read";
  if (utf8Valid) {
    try {
      decoder.decode();
    } catch {
      utf8Valid = false;
    }
  }
  if (!utf8Valid) binary = true;
  return {byteSize, contentHash: hash.digest("hex"), binary};
}

function makeFingerprint(
  files: readonly SourceInventoryFile[]
): string {
  const fileBasis = files.map((file) => ({
    path: file.path,
    language: file.language,
    role: file.role,
    byteSize: file.byteSize,
    contentHash: file.contentHash,
    coverageHint: file.coverageHint,
    support: file.support
  }));
  // Runtime/build/dependency/sensitive churn is diagnostic metadata, never a
  // source freshness basis. Only eligible source file bytes and classification
  // participate in the fingerprint.
  return sha256(JSON.stringify({version: 2, files: fileBasis}));
}

/**
 * Enumerate Git-tracked plus nonignored-untracked literal regular files.
 * This is metadata-only: source bodies are never returned or persisted.
 */
export async function buildSourceInventory(
  repositoryRoot: string,
  options: InventoryOptions = {}
): Promise<SourceInventory> {
  const rootPath = path.resolve(repositoryRoot);
  const rootInfo = await lstat(rootPath).catch(() => null);
  if (!rootInfo || !rootInfo.isDirectory()) throw new Error("Repository root is unavailable.");
  // Resolve once so a caller-provided repository alias cannot turn into a
  // different source boundary while the inventory is being built.
  await realpath(rootPath).catch(() => { throw new Error("Repository root is unavailable."); });

  const candidates = options.useGit === false ? [] : await listGitFiles(rootPath);
  const files: SourceInventoryFile[] = [];
  const excluded: ExclusionObservation[] = [];
  const counts = emptyExclusionCounts();
  const exclude = (relativePath: string, reason: InventoryExclusionReason, byteSize: number | null = null): void => {
    counts[reason] += 1;
    excluded.push({path: relativePath, reason, byteSize});
  };

  for (const relativePath of candidates) {
    const pathReason = pathSafetyReason(relativePath);
    if (pathReason) {
      exclude(relativePath, pathReason);
      continue;
    }
    const knownReason = sourcePathExclusionReason(relativePath);
    if (knownReason) {
      // Sensitive and runtime paths are never opened, read, hashed, or echoed.
      const stat = await lstat(path.resolve(rootPath, relativePath)).catch(() => null);
      exclude(relativePath, knownReason, stat?.isFile() ? stat.size : null);
      continue;
    }

    const resolved = await resolveLiteralRegularFile(rootPath, relativePath);
    if (!resolved.ok) {
      const reason = resolved.diagnostic.reason;
      const mapped: InventoryExclusionReason = EXCLUSION_REASON_SET.has(reason) ? reason as InventoryExclusionReason : "unsafe-path";
      exclude(relativePath, mapped);
      continue;
    }
    const hashed = await hashLiteralFile(resolved.absolutePath, {
      device: resolved.stat.dev,
      inode: resolved.stat.ino,
      size: Number(resolved.stat.size),
      mtimeMs: resolved.stat.mtimeMs,
      ctimeMs: resolved.stat.ctimeMs
    });
    if (typeof hashed === "string") {
      exclude(relativePath, hashed);
      continue;
    }
    const finalSnapshot = await capturePathSnapshot(rootPath, relativePath);
    if (!finalSnapshot || !samePathSnapshot(resolved.snapshot, finalSnapshot)) {
      exclude(relativePath, "changed-during-read");
      continue;
    }
    if (hashed.binary) {
      exclude(relativePath, "binary", hashed.byteSize);
      continue;
    }
    const classification = classifyPath(relativePath);
    files.push({
      path: relativePath,
      language: classification.language,
      role: classification.role,
      byteSize: hashed.byteSize,
      contentHash: hashed.contentHash,
      coverageHint: hashed.byteSize > INVENTORY_MAX_FILE_BYTES || classification.support === "unsupported" ? "file" : "full",
      support: classification.support
    });
  }

  files.sort((left, right) => comparePath(left.path, right.path));
  const inventoryFingerprint = makeFingerprint(files);
  const exclusions = INVENTORY_EXCLUSION_REASONS
    .filter((reason) => counts[reason] > 0)
    .map((reason) => ({reason, count: counts[reason]}));
  return {
    files,
    inventoryFingerprint,
    fingerprint: inventoryFingerprint,
    candidateCount: candidates.length,
    includedCount: files.length,
    excludedCount: excluded.length,
    exclusionCounts: counts,
    exclusions
  };
}

export const createSourceInventory = buildSourceInventory;
export const inventoryRepository = buildSourceInventory;
