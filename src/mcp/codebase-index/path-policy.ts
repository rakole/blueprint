import path from "node:path";
import {lstat} from "node:fs/promises";

/** Exclusion labels shared by inventory and transient source reads. */
export const SOURCE_PATH_EXCLUSION_REASONS = [
  "runtime-state",
  "git-metadata",
  "dependency",
  "vendor",
  "build-output",
  "binary",
  "sensitive-path",
  "unsafe-path",
  "symlink",
  "missing",
  "not-a-regular-file",
  "unreadable",
  "changed-during-read"
] as const;
export type SourcePathExclusionReason = typeof SOURCE_PATH_EXCLUSION_REASONS[number];

const GENERATED_SEGMENTS = new Set(["dist", "build", "out", "target", "coverage", ".next", ".cache"]);
const DEPENDENCY_SEGMENTS = new Set(["node_modules", "bower_components", "vendor", "third_party", "external"]);
const RUNTIME_SEGMENTS = new Set([".git", ".blueprint", ".blueprint-improver-memory", ".planning"]);
const SENSITIVE_BASENAMES = new Set([
  ".env", ".npmrc", ".pypirc", "credentials", "credential", "secrets", "secret", "password", "passwd", "token",
  "id_rsa", "id_dsa", "id_ecdsa", "id_ed25519", "private_key", "private-key"
]);
const SENSITIVE_EXTENSIONS = new Set([".pem", ".key", ".p12", ".pfx", ".jks", ".keystore", ".crt", ".cer", ".der"]);
const SENSITIVE_CONTAINER_STEMS = new Set([
  "credentials", "credential", "secrets", "secret", "password", "passwd", "token",
  "service-account", "service_account", "serviceaccount", "private-key", "private_key"
]);
const SENSITIVE_CONTAINER_EXTENSIONS = new Set([".json", ".yaml", ".yml", ".toml", ".ini", ".conf", ".properties"]);

export function sourcePathSafetyReason(relativePath: string): "unsafe-path" | null {
  if (relativePath.length === 0 || relativePath.length > 4096 || relativePath.includes("\0") ||
      /[\u0000-\u001f\u007f]/.test(relativePath) || relativePath.includes("\\") ||
      relativePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(relativePath) ||
      relativePath.split("/").some(segment => segment.length === 0 || segment === "." || segment === "..")) {
    return "unsafe-path";
  }
  return null;
}

/**
 * Return the shared source eligibility decision without opening the path.
 * Exact sensitive names are bounded deliberately: `tokenizer.ts` and
 * `password.ts` are legitimate source files, while `.env.*` is always state.
 */
export function sourcePathExclusionReason(relativePath: string): SourcePathExclusionReason | null {
  const safety = sourcePathSafetyReason(relativePath);
  if (safety) return safety;
  const normalized = relativePath.toLowerCase();
  const segments = normalized.split("/");
  const base = segments.at(-1) ?? "";
  if (segments.some(segment => RUNTIME_SEGMENTS.has(segment))) {
    return segments.includes(".git") ? "git-metadata" : "runtime-state";
  }
  if (segments.some(segment => DEPENDENCY_SEGMENTS.has(segment))) {
    return segments.includes("vendor") ? "vendor" : "dependency";
  }
  if (segments.some(segment => GENERATED_SEGMENTS.has(segment)) || /\.generated\.[^.]+$/.test(base)) {
    return "build-output";
  }
  const extension = path.posix.extname(base);
  const stem = extension.length > 0 ? base.slice(0, -extension.length) : base;
  if (base === ".env" || base.startsWith(".env.") || SENSITIVE_BASENAMES.has(base) ||
      (SENSITIVE_CONTAINER_STEMS.has(stem) && SENSITIVE_CONTAINER_EXTENSIONS.has(extension)) ||
      segments.some(segment => segment === ".ssh" || segment === ".aws")) {
    return "sensitive-path";
  }
  if (SENSITIVE_EXTENSIONS.has(extension)) return "sensitive-path";
  return null;
}

export function sourcePathIsGenerated(relativePath: string): boolean {
  const normalized = relativePath.toLowerCase();
  const segments = normalized.split("/");
  const base = segments.at(-1) ?? "";
  return segments.some(segment => GENERATED_SEGMENTS.has(segment)) || /\.generated\.[^.]+$/.test(base);
}

export type PathIdentity = {
  device: number;
  inode: number;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
};

export type PathSnapshot = {
  root: PathIdentity;
  ancestors: readonly PathIdentity[];
  target: PathIdentity;
};

export function pathIdentity(stat: {
  dev: number;
  ino: number;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
}): PathIdentity {
  return {
    device: stat.dev,
    inode: stat.ino,
    size: Number(stat.size),
    mtimeMs: stat.mtimeMs,
    ctimeMs: stat.ctimeMs
  };
}

export function samePathIdentity(left: PathIdentity, right: PathIdentity): boolean {
  return left.device === right.device && left.inode === right.inode && left.size === right.size &&
    left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs;
}

export function samePathSnapshot(left: PathSnapshot, right: PathSnapshot): boolean {
  const sameLocation = left.root.device === right.root.device && left.root.inode === right.root.inode &&
    left.ancestors.length === right.ancestors.length &&
    left.ancestors.every((entry, index) => entry.device === right.ancestors[index]!.device && entry.inode === right.ancestors[index]!.inode);
  return sameLocation &&
    samePathIdentity(left.target, right.target);
}

/** Capture the literal root, parent chain, and target identity before opening. */
export async function capturePathSnapshot(rootPath: string, relativePath: string): Promise<PathSnapshot | null> {
  if (sourcePathSafetyReason(relativePath)) return null;
  const absoluteRoot = path.resolve(rootPath);
  const paths = [absoluteRoot, ...relativePath.split("/").map((segment, index, segments) =>
    path.join(absoluteRoot, ...segments.slice(0, index + 1))
  )];
  const stats = [];
  for (const [index, candidate] of paths.entries()) {
    const stat = await lstat(candidate).catch(() => null);
    if (!stat) return null;
    if (index < paths.length - 1 && !stat.isDirectory()) return null;
    stats.push(stat);
  }
  return {
    root: pathIdentity(stats[0]!),
    ancestors: stats.slice(1, -1).map(pathIdentity),
    target: pathIdentity(stats.at(-1)!)
  };
}
