import { createHash } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const LOCK_RETRY_DELAY_MS = 50;
const LOCK_TIMEOUT_MS = 30_000;
const BUILT_ASSET_LOCK_DIR = path.join(
  os.tmpdir(),
  `blueprint-built-assets-${createHash("sha1").update(process.cwd()).digest("hex")}.lock`
);

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function acquireBuiltAssetLock(): Promise<void> {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (true) {
    try {
      await mkdir(BUILT_ASSET_LOCK_DIR);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }

      if (Date.now() >= deadline) {
        throw new Error(
          `Timed out waiting for built-asset test lock: ${BUILT_ASSET_LOCK_DIR}`
        );
      }

      await sleep(LOCK_RETRY_DELAY_MS);
    }
  }
}

async function releaseBuiltAssetLock(): Promise<void> {
  await rm(BUILT_ASSET_LOCK_DIR, { recursive: true, force: true });
}

export async function withBuiltAssetLock<T>(work: () => Promise<T>): Promise<T> {
  await acquireBuiltAssetLock();

  try {
    return await work();
  } finally {
    await releaseBuiltAssetLock();
  }
}
