import {constants} from "node:fs";
import {lstat, open, realpath} from "node:fs/promises";
import path from "node:path";

export type HardenedLiteralReadReason = "missing" | "unsafe" | "too-large" | "unreadable" | "changed";

export type HardenedLiteralReadResult =
  | {readonly ok: true; readonly bytes: Uint8Array}
  | {readonly ok: false; readonly reason: HardenedLiteralReadReason};

type Identity = {
  readonly path: string;
  readonly device: number;
  readonly inode: number;
  readonly size?: number;
  readonly mtimeMs?: number;
  readonly ctimeMs?: number;
};

function sameDirectory(left: Identity, right: Identity): boolean {
  return left.path === right.path && left.device === right.device && left.inode === right.inode;
}

function sameFile(left: Identity, right: Identity): boolean {
  return sameDirectory(left, right) && left.size === right.size && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs;
}

function safeRelativePath(value: string): boolean {
  return value.length > 0 && !value.startsWith("/") && !value.includes("\\") && !/[\0-\u001f\u007f]/.test(value) &&
    !value.split("/").some(segment => !segment || segment === "." || segment === "..");
}

async function captureChain(root: string, relativePath: string): Promise<{readonly rootReal: string; readonly chain: readonly Identity[]} | null> {
  if (!safeRelativePath(relativePath)) return null;
  const absoluteRoot = path.resolve(root);
  const rootReal = await realpath(absoluteRoot).catch(() => null);
  if (!rootReal) return null;
  const pieces = relativePath.split("/").slice(0, -1);
  const chain: Identity[] = [];
  let current = absoluteRoot;
  for (let index = 0; index < pieces.length; index += 1) {
    const stat = await lstat(current).catch(() => null);
    if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) return null;
    chain.push({path: current, device: stat.dev, inode: stat.ino});
    current = path.join(current, pieces[index]!);
  }
  const parent = await lstat(current).catch(() => null);
  if (!parent || parent.isSymbolicLink() || !parent.isDirectory()) return null;
  chain.push({path: current, device: parent.dev, inode: parent.ino});
  return {rootReal, chain};
}

async function chainMatches(chain: readonly Identity[]): Promise<boolean> {
  for (const expected of chain) {
    const stat = await lstat(expected.path).catch(() => null);
    if (!stat || stat.isSymbolicLink() || !stat.isDirectory() || !sameDirectory(expected, {path: expected.path, device: stat.dev, inode: stat.ino})) return false;
  }
  return true;
}

/**
 * Read a literal regular file while binding every named ancestor and the final
 * pathname to the bytes. A descriptor identity check alone is insufficient:
 * a caller can rename an ancestor after open and replace the named path with a
 * symlink to unrelated content. This primitive therefore rechecks the whole
 * chain and final leaf after the descriptor read.
 */
export async function readHardenedLiteralFile(root: string, relativePath: string, maxBytes: number): Promise<HardenedLiteralReadResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) return {ok: false, reason: "too-large"};
  const captured = await captureChain(root, relativePath);
  if (!captured) return {ok: false, reason: "missing"};
  const absoluteRoot = path.resolve(root);
  const absolutePath = path.resolve(absoluteRoot, relativePath);
  const resolved = await realpath(absolutePath).catch(() => null);
  if (!resolved) return {ok: false, reason: "missing"};
  const resolvedRelative = path.relative(captured.rootReal, resolved);
  if (resolvedRelative.startsWith("..") || path.isAbsolute(resolvedRelative)) return {ok: false, reason: "unsafe"};
  const before = await lstat(absolutePath).catch(() => null);
  if (!before) return {ok: false, reason: "missing"};
  if (before.isSymbolicLink() || !before.isFile()) return {ok: false, reason: "unsafe"};
  const file: Identity = {path: absolutePath, device: before.dev, inode: before.ino, size: Number(before.size), mtimeMs: before.mtimeMs, ctimeMs: before.ctimeMs};
  if (file.size! > maxBytes) return {ok: false, reason: "too-large"};
  let handle;
  try {
    handle = await open(absolutePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  } catch {
    return {ok: false, reason: "unreadable"};
  }
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || !sameFile(file, {path: absolutePath, device: opened.dev, inode: opened.ino, size: Number(opened.size), mtimeMs: opened.mtimeMs, ctimeMs: opened.ctimeMs})) {
      return {ok: false, reason: "changed"};
    }
    const bytes = Buffer.alloc(file.size!);
    let offset = 0;
    while (offset < bytes.length) {
      const result = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (result.bytesRead === 0) return {ok: false, reason: "changed"};
      offset += result.bytesRead;
    }
    const after = await handle.stat();
    if (!after.isFile() || !sameFile(file, {path: absolutePath, device: after.dev, inode: after.ino, size: Number(after.size), mtimeMs: after.mtimeMs, ctimeMs: after.ctimeMs})) {
      return {ok: false, reason: "changed"};
    }
    if (!(await chainMatches(captured.chain))) return {ok: false, reason: "changed"};
    const named = await lstat(absolutePath).catch(() => null);
    if (!named || named.isSymbolicLink() || !named.isFile() || !sameFile(file, {path: absolutePath, device: named.dev, inode: named.ino, size: Number(named.size), mtimeMs: named.mtimeMs, ctimeMs: named.ctimeMs})) {
      return {ok: false, reason: "changed"};
    }
    return {ok: true, bytes: new Uint8Array(bytes)};
  } catch {
    return {ok: false, reason: "unreadable"};
  } finally {
    await handle.close().catch(() => undefined);
  }
}
