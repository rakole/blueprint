import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const DIRECTORY_LOCK_OWNER_FILE = "owner";
const DIRECTORY_LOCK_LEASE_FILE = "lease";
const DIRECTORY_LOCK_RECOVERY_GUARD_PREFIX = "owner.";

export type DirectoryLockTiming = {
  retryMs: number;
  staleMs: number;
  heartbeatMs: number;
};

export type DirectoryLockRecoveryHooksForTest = {
  beforeStaleRecoveryClaim?(lockPath: string): Promise<void> | void;
  beforeStaleLockQuarantine?(lockPath: string): Promise<void> | void;
  afterRecoveryGuardRelease?(lockPath: string): Promise<void> | void;
};

type DirectoryLockOptions = {
  lockPath: string;
  timing: DirectoryLockTiming;
  recoveryHooks?: DirectoryLockRecoveryHooksForTest;
};

type DirectoryLockHandle = {
  lockPath: string;
  ownerPath: string;
  leasePath: string;
  token: string;
};

type DirectoryLockRecoveryGuardHandle = {
  lockPath: string;
  recoveryPath: string;
  ownerPath: string;
  token: string;
  staleMs: number;
};

function createDirectoryLockToken(): string {
  return `${process.pid}-${Date.now()}-${randomUUID()}`;
}

function directoryLockOwnerPath(lockPath: string): string {
  return path.join(lockPath, DIRECTORY_LOCK_OWNER_FILE);
}

function directoryLockLeasePath(lockPath: string): string {
  return path.join(lockPath, DIRECTORY_LOCK_LEASE_FILE);
}

function directoryLockRecoveryPath(lockPath: string): string {
  return `${lockPath}.recovery`;
}

function directoryLockRecoveryGuardOwnerPath(
  recoveryPath: string,
  token: string
): string {
  return path.join(recoveryPath, `${DIRECTORY_LOCK_RECOVERY_GUARD_PREFIX}${token}`);
}

function directoryLockQuarantinePath(targetPath: string): string {
  return path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.${randomUUID()}.stale`
  );
}

async function writeDirectoryLockFile(filePath: string, contents: string): Promise<void> {
  await fs.writeFile(filePath, `${contents}\n`, "utf8");
}

async function readDirectoryLockOwner(
  lockHandle: DirectoryLockHandle
): Promise<string | null> {
  return readDirectoryLockOwnerAtPath(lockHandle.ownerPath);
}

async function readDirectoryLockOwnerAtPath(
  ownerPath: string
): Promise<string | null> {
  try {
    return (await fs.readFile(ownerPath, "utf8")).trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function refreshDirectoryLockLease(
  lockHandle: DirectoryLockHandle
): Promise<boolean> {
  const ownerToken = await readDirectoryLockOwner(lockHandle);

  if (ownerToken !== lockHandle.token) {
    return false;
  }

  await writeDirectoryLockFile(lockHandle.leasePath, lockHandle.token);
  return true;
}

async function getDirectoryLockPathAgeMs(targetPath: string): Promise<number | null> {
  try {
    const stats = await fs.stat(targetPath);
    return Date.now() - stats.mtimeMs;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function getDirectoryLockRecoveryGuardAgeMs(
  recoveryPath: string
): Promise<number | null> {
  let entries: string[];

  try {
    entries = await fs.readdir(recoveryPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }

  let newestOwnerMtimeMs: number | null = null;

  for (const entry of entries) {
    if (!entry.startsWith(DIRECTORY_LOCK_RECOVERY_GUARD_PREFIX)) {
      continue;
    }

    try {
      const stats = await fs.stat(path.join(recoveryPath, entry));
      newestOwnerMtimeMs = Math.max(newestOwnerMtimeMs ?? stats.mtimeMs, stats.mtimeMs);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  if (newestOwnerMtimeMs !== null) {
    return Date.now() - newestOwnerMtimeMs;
  }

  return getDirectoryLockPathAgeMs(recoveryPath);
}

async function getDirectoryLockAgeMs(lockPath: string): Promise<number | null> {
  const leasePath = directoryLockLeasePath(lockPath);

  try {
    const stats = await fs.stat(leasePath);
    return Date.now() - stats.mtimeMs;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return getDirectoryLockPathAgeMs(lockPath);
}

async function assertDirectoryLockPathIsDirectory(lockPath: string): Promise<boolean> {
  try {
    const stats = await fs.lstat(lockPath);

    if (!stats.isDirectory()) {
      throw new Error(
        `Cannot acquire directory lock at ${JSON.stringify(lockPath)}: the lock path exists but is not a directory. Move or remove the obstructing path and retry; Blueprint will not replace it automatically.`
      );
    }

    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function readDirectoryLockOwnerForPath(lockPath: string): Promise<string | null> {
  return readDirectoryLockOwnerAtPath(directoryLockOwnerPath(lockPath));
}

async function createDirectoryLockRecoveryGuardHandle(
  lockPath: string,
  recoveryPath: string,
  staleMs: number
): Promise<DirectoryLockRecoveryGuardHandle> {
  const token = createDirectoryLockToken();
  const recoveryGuard: DirectoryLockRecoveryGuardHandle = {
    lockPath,
    recoveryPath,
    ownerPath: directoryLockRecoveryGuardOwnerPath(recoveryPath, token),
    token,
    staleMs
  };

  try {
    await writeDirectoryLockFile(recoveryGuard.ownerPath, token);
  } catch (error) {
    await fs.rmdir(recoveryPath).catch(() => undefined);
    throw error;
  }

  return recoveryGuard;
}

async function refreshOwnedDirectoryLockRecoveryGuard(
  recoveryGuard: DirectoryLockRecoveryGuardHandle
): Promise<boolean> {
  let stats;

  try {
    stats = await fs.stat(recoveryGuard.ownerPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }

  if (Date.now() - stats.mtimeMs > recoveryGuard.staleMs) {
    return false;
  }

  try {
    const now = new Date();
    await fs.utimes(recoveryGuard.ownerPath, now, now);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }

  return true;
}

async function releaseDirectoryLockRecoveryGuard(
  recoveryGuard: DirectoryLockRecoveryGuardHandle
): Promise<void> {
  if (!(await refreshOwnedDirectoryLockRecoveryGuard(recoveryGuard))) {
    return;
  }

  try {
    await fs.unlink(recoveryGuard.ownerPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }

    throw error;
  }

  await fs.rmdir(recoveryGuard.recoveryPath).catch(() => undefined);
}

async function createDirectoryLockHandle(lockPath: string): Promise<DirectoryLockHandle> {
  const token = createDirectoryLockToken();
  const lockHandle: DirectoryLockHandle = {
    lockPath,
    ownerPath: directoryLockOwnerPath(lockPath),
    leasePath: directoryLockLeasePath(lockPath),
    token
  };

  try {
    await writeDirectoryLockFile(lockHandle.ownerPath, token);
    await writeDirectoryLockFile(lockHandle.leasePath, token);
  } catch (error) {
    await fs.rm(lockPath, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }

  return lockHandle;
}

async function reclaimStaleDirectoryLockRecoveryGuard(
  recoveryPath: string,
  staleMs: number
): Promise<boolean> {
  const ageMs = await getDirectoryLockRecoveryGuardAgeMs(recoveryPath);

  if (ageMs === null) {
    return true;
  }

  if (ageMs <= staleMs) {
    return false;
  }

  const quarantinePath = directoryLockQuarantinePath(recoveryPath);

  try {
    await fs.rename(recoveryPath, quarantinePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return true;
    }

    throw error;
  }

  await fs.rm(quarantinePath, { recursive: true, force: true });
  return true;
}

async function tryAcquireDirectoryLockRecoveryGuard(
  lockPath: string,
  staleMs: number
): Promise<DirectoryLockRecoveryGuardHandle | null> {
  const recoveryPath = directoryLockRecoveryPath(lockPath);

  for (;;) {
    try {
      await fs.mkdir(recoveryPath);
      return createDirectoryLockRecoveryGuardHandle(lockPath, recoveryPath, staleMs);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }

      if (await reclaimStaleDirectoryLockRecoveryGuard(recoveryPath, staleMs)) {
        continue;
      }

      return null;
    }
  }
}

async function recoverStaleDirectoryLock(
  options: DirectoryLockOptions
): Promise<boolean> {
  const recoveryGuard = await tryAcquireDirectoryLockRecoveryGuard(
    options.lockPath,
    options.timing.staleMs
  );

  if (recoveryGuard === null) {
    return false;
  }

  try {
    const ageMs = await getDirectoryLockAgeMs(options.lockPath);

    if (ageMs === null) {
      return true;
    }

    if (ageMs <= options.timing.staleMs) {
      return false;
    }

    const observedOwner = await readDirectoryLockOwnerForPath(options.lockPath);

    await options.recoveryHooks?.beforeStaleLockQuarantine?.(options.lockPath);

    if (!(await refreshOwnedDirectoryLockRecoveryGuard(recoveryGuard))) {
      return false;
    }

    const currentAgeMs = await getDirectoryLockAgeMs(options.lockPath);

    if (currentAgeMs === null) {
      return true;
    }

    if (currentAgeMs <= options.timing.staleMs) {
      return false;
    }

    const currentOwner = await readDirectoryLockOwnerForPath(options.lockPath);

    if (currentOwner !== observedOwner) {
      return false;
    }

    const quarantinePath = directoryLockQuarantinePath(options.lockPath);

    try {
      await fs.rename(options.lockPath, quarantinePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return true;
      }

      throw error;
    }

    await fs.rm(quarantinePath, { recursive: true, force: true });
    return true;
  } finally {
    await releaseDirectoryLockRecoveryGuard(recoveryGuard).catch(() => undefined);
    await options.recoveryHooks?.afterRecoveryGuardRelease?.(options.lockPath);
  }
}

async function acquireDirectoryLock(
  options: DirectoryLockOptions
): Promise<DirectoryLockHandle> {
  await fs.mkdir(path.dirname(options.lockPath), { recursive: true });

  for (;;) {
    try {
      await fs.mkdir(options.lockPath);
      return createDirectoryLockHandle(options.lockPath);
    } catch (error) {
      const lockError = error as NodeJS.ErrnoException;

      if (lockError.code !== "EEXIST") {
        throw error;
      }

      if (!(await assertDirectoryLockPathIsDirectory(options.lockPath))) {
        continue;
      }

      try {
        const ageMs = await getDirectoryLockAgeMs(options.lockPath);

        if (ageMs !== null && ageMs > options.timing.staleMs) {
          await options.recoveryHooks?.beforeStaleRecoveryClaim?.(options.lockPath);

          if (await recoverStaleDirectoryLock(options)) {
            continue;
          }
        }
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code === "ENOENT") {
          continue;
        }

        throw statError;
      }

      await new Promise((resolve) => setTimeout(resolve, options.timing.retryMs));
    }
  }
}

function startDirectoryLockHeartbeat(
  lockHandle: DirectoryLockHandle,
  heartbeatMs: number
): () => void {
  const timer = setInterval(() => {
    void refreshDirectoryLockLease(lockHandle)
      .then((refreshed) => {
        if (!refreshed) {
          clearInterval(timer);
        }
      })
      .catch(() => {
        clearInterval(timer);
      });
  }, heartbeatMs);

  timer.unref?.();

  return () => {
    clearInterval(timer);
  };
}

async function releaseDirectoryLock(lockHandle: DirectoryLockHandle): Promise<void> {
  const ownerToken = await readDirectoryLockOwner(lockHandle).catch(() => null);

  if (ownerToken !== lockHandle.token) {
    return;
  }

  await fs.rm(lockHandle.lockPath, { recursive: true, force: true }).catch(() => undefined);
}

export async function withDirectoryLock<T>(
  options: DirectoryLockOptions,
  callback: () => Promise<T>
): Promise<T> {
  const lockHandle = await acquireDirectoryLock(options);
  const stopHeartbeat = startDirectoryLockHeartbeat(lockHandle, options.timing.heartbeatMs);

  try {
    return await callback();
  } finally {
    stopHeartbeat();
    await releaseDirectoryLock(lockHandle);
  }
}
