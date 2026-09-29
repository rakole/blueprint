import { execFile } from "node:child_process";
import { constants as fsConstants, promises as fs } from "node:fs";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { promisify } from "node:util";

import { readHardenedLiteralFile } from "../codebase-index/literal-read.js";
import { unlinkDescriptorLeaf } from "../codebase-index/descriptor-mutation.js";
import { withDirectoryLock, type DirectoryLockTiming } from "../directory-lock.js";

/** Legacy repository-visible location, retained only for safe one-time cleanup. */
export const PLAN_CURSOR_AUTHORITY_ROOT = ".blueprint/plan-operations";
export const PLAN_CURSOR_AUTHORITY_KEY_FILE = "cursor.key";
export const PLAN_CURSOR_GIT_AUTHORITY_ROOT = "blueprint";
export const PLAN_CURSOR_GIT_AUTHORITY_KEY_FILE = "plan-cursor.key";

const KEY_BYTES = 32;
const SEAL = /^[a-f0-9]{64}$/;
const PRIVATE_KEY_LOCK_FILE = "plan-cursor-key.lock";
const PRIVATE_KEY_LOCK_TIMING: DirectoryLockTiming = {
  retryMs: 10,
  staleMs: 30_000,
  heartbeatMs: 5_000
};
const execFileAsync = promisify(execFile);

type AuthorityLocation = {
  readonly keyDirectory: string;
  readonly keyPath: string;
  readonly repositoryBinding: string;
};

async function authorityLocation(root: string): Promise<AuthorityLocation | null> {
  const absoluteRoot = path.resolve(root);
  const [rootReal, rootStat, gitResult] = await Promise.all([
    fs.realpath(absoluteRoot).catch(() => null),
    fs.lstat(absoluteRoot).catch(() => null),
    execFileAsync("git", ["rev-parse", "--absolute-git-dir"], {
      cwd: absoluteRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024
    }).catch(() => null)
  ]);
  const gitPath = gitResult?.stdout.trim();
  if (!rootReal || !rootStat?.isDirectory() || rootStat.isSymbolicLink() || !gitPath || !path.isAbsolute(gitPath)) return null;
  const gitReal = await fs.realpath(gitPath).catch(() => null);
  const gitStat = await fs.lstat(gitPath).catch(() => null);
  if (!gitReal || !gitStat?.isDirectory() || gitStat.isSymbolicLink()) return null;
  const keyDirectory = path.join(gitReal, PLAN_CURSOR_GIT_AUTHORITY_ROOT);
  return {
    keyDirectory,
    keyPath: path.join(keyDirectory, PLAN_CURSOR_GIT_AUTHORITY_KEY_FILE),
    repositoryBinding: JSON.stringify({
      version: 1,
      root: { path: rootReal, device: rootStat.dev, inode: rootStat.ino },
      git: { path: gitReal, device: gitStat.dev, inode: gitStat.ino }
    })
  };
}

async function ensurePrivateDirectory(location: AuthorityLocation, provision: boolean): Promise<boolean> {
  let stat = await fs.lstat(location.keyDirectory).catch(() => null);
  if (!stat && provision) {
    await fs.mkdir(location.keyDirectory, { mode: 0o700 }).catch(error => {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    });
    stat = await fs.lstat(location.keyDirectory).catch(() => null);
  }
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) return false;
  if ((stat.mode & 0o077) !== 0) {
    await fs.chmod(location.keyDirectory, 0o700).catch(() => undefined);
    const repaired = await fs.lstat(location.keyDirectory).catch(() => null);
    if (!repaired || repaired.isSymbolicLink() || !repaired.isDirectory() ||
        repaired.dev !== stat.dev || repaired.ino !== stat.ino || (repaired.mode & 0o077) !== 0) return false;
  }
  return true;
}

async function readPrivateKey(keyPath: string, repairPermissions: boolean): Promise<Uint8Array | null> {
  const before = await fs.lstat(keyPath).catch(() => null);
  if (!before || before.isSymbolicLink() || !before.isFile()) return null;
  const noFollow = fsConstants.O_NOFOLLOW ?? 0;
  const handle = await fs.open(keyPath, fsConstants.O_RDONLY | noFollow).catch(() => null);
  if (!handle) return null;
  try {
    let opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || Number(opened.size) !== KEY_BYTES) return null;
    if ((opened.mode & 0o077) !== 0) {
      if (!repairPermissions) return null;
      await handle.chmod(0o600);
      opened = await handle.stat();
      if ((opened.mode & 0o077) !== 0) return null;
    }
    const bytes = Buffer.alloc(KEY_BYTES);
    let offset = 0;
    while (offset < bytes.length) {
      const result = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!result.bytesRead) return null;
      offset += result.bytesRead;
    }
    const after = await fs.lstat(keyPath).catch(() => null);
    if (!after || after.isSymbolicLink() || !after.isFile() || after.dev !== opened.dev || after.ino !== opened.ino || Number(after.size) !== KEY_BYTES) return null;
    return new Uint8Array(bytes);
  } finally {
    await handle.close().catch(() => undefined);
  }
}

async function removeLegacyKey(root: string): Promise<void> {
  const relative = `${PLAN_CURSOR_AUTHORITY_ROOT}/${PLAN_CURSOR_AUTHORITY_KEY_FILE}`;
  const read = await readHardenedLiteralFile(root, relative, KEY_BYTES);
  if (!read.ok) return;
  try {
    const sha256 = createHash("sha256").update(read.bytes).digest("hex");
    await unlinkDescriptorLeaf(root, relative, { sha256 });
  } finally {
    read.bytes.fill(0);
  }
}

async function createPrivateKeyExclusive(location: AuthorityLocation, bytes: Uint8Array): Promise<"created" | "exists" | "failed"> {
  const temporary = path.join(location.keyDirectory, `.${PLAN_CURSOR_GIT_AUTHORITY_KEY_FILE}.${randomBytes(12).toString("hex")}.tmp`);
  const noFollow = fsConstants.O_NOFOLLOW ?? 0;
  let handle: Awaited<ReturnType<typeof fs.open>> | null = null;
  try {
    handle = await fs.open(temporary, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | noFollow, 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.chmod(0o600);
    await handle.close();
    handle = null;
    try {
      await fs.link(temporary, location.keyPath);
      return "created";
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "EEXIST" ? "exists" : "failed";
    }
  } catch (error) {
    return "failed";
  } finally {
    await handle?.close().catch(() => undefined);
    await fs.unlink(temporary).catch(() => undefined);
  }
}

async function discardInvalidPrivateKey(location: AuthorityLocation): Promise<boolean> {
  const before = await fs.lstat(location.keyPath).catch(error =>
    (error as NodeJS.ErrnoException).code === "ENOENT" ? null : Promise.reject(error));
  if (!before) return true;
  if (before.isSymbolicLink() || !before.isFile()) return false;
  const quarantine = path.join(location.keyDirectory, `.${PLAN_CURSOR_GIT_AUTHORITY_KEY_FILE}.${randomBytes(12).toString("hex")}.invalid`);
  try {
    await fs.rename(location.keyPath, quarantine);
    const moved = await fs.lstat(quarantine).catch(() => null);
    if (!moved || moved.isSymbolicLink() || !moved.isFile() || moved.dev !== before.dev || moved.ino !== before.ino) {
      if (!(await fs.lstat(location.keyPath).catch(() => null))) await fs.rename(quarantine, location.keyPath).catch(() => undefined);
      return false;
    }
    await fs.unlink(quarantine);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    return false;
  }
}

async function provisionPrivateKey(location: AuthorityLocation): Promise<Uint8Array | null> {
  return withDirectoryLock({
    lockPath: path.join(location.keyDirectory, PRIVATE_KEY_LOCK_FILE),
    timing: PRIVATE_KEY_LOCK_TIMING
  }, async () => {
    const existing = await readPrivateKey(location.keyPath, true);
    if (existing) return existing;
    if (!(await discardInvalidPrivateKey(location))) return null;

    const seed = randomBytes(KEY_BYTES);
    try {
      const created = await createPrivateKeyExclusive(location, seed);
      if (created === "failed") return null;
      return readPrivateKey(location.keyPath, true);
    } finally {
      seed.fill(0);
    }
  });
}

function bindKeyToRepository(rawKey: Uint8Array, repositoryBinding: string): Uint8Array {
  return createHmac("sha256", rawKey)
    .update("blueprint-plan-cursor-repository-v1\0", "utf8")
    .update(repositoryBinding, "utf8")
    .digest();
}

export async function loadPlanCursorAuthorityKey(root: string, provision: boolean): Promise<Uint8Array | null> {
  const location = await authorityLocation(root);
  if (!location || !(await ensurePrivateDirectory(location, provision))) return null;
  let rawKey = await readPrivateKey(location.keyPath, true);
  if (!rawKey && provision) rawKey = await provisionPrivateKey(location);
  if (rawKey) await removeLegacyKey(root);
  return rawKey ? bindKeyToRepository(rawKey, location.repositoryBinding) : null;
}

export function sealPlanCursor(key: Uint8Array, kind: "evidence" | "plan", payload: unknown): string {
  return createHmac("sha256", key).update(`${kind}\u0000${JSON.stringify(payload)}`, "utf8").digest("hex");
}

export function verifyPlanCursorSeal(key: Uint8Array, kind: "evidence" | "plan", payload: unknown, seal: string): boolean {
  if (!SEAL.test(seal)) return false;
  const expected = Buffer.from(sealPlanCursor(key, kind, payload), "utf8");
  const actual = Buffer.from(seal, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
