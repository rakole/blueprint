import test from "node:test";
import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { withDirectoryLock } from "../src/mcp/directory-lock.js";

const TEST_LOCK_TIMING = {
  retryMs: 5,
  staleMs: 20,
  heartbeatMs: 5
};

test("withDirectoryLock rejects and preserves non-directory lock paths", async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-directory-lock-"));
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  const regularFileLockPath = path.join(tempRoot, "regular.lock");
  const symlinkTargetPath = path.join(tempRoot, "symlink-target.txt");
  const symlinkLockPath = path.join(tempRoot, "symlink.lock");
  await writeFile(regularFileLockPath, "regular user data\n", "utf8");
  await writeFile(symlinkTargetPath, "symlink target data\n", "utf8");
  await symlink(symlinkTargetPath, symlinkLockPath);

  for (const lockPath of [regularFileLockPath, symlinkLockPath]) {
    let callbackRan = false;

    await assert.rejects(
      withDirectoryLock(
        { lockPath, timing: TEST_LOCK_TIMING },
        async () => {
          callbackRan = true;
        }
      ),
      (error: Error) => {
        assert.match(error.message, /cannot acquire directory lock/i);
        assert.match(error.message, /lock path exists but is not a directory/i);
        assert.match(error.message, /move or remove the obstructing path and retry/i);
        assert.doesNotMatch(error.message, /ENOTDIR/);
        return true;
      }
    );

    assert.equal(callbackRan, false);
  }

  assert.equal(await readFile(regularFileLockPath, "utf8"), "regular user data\n");
  assert.equal((await lstat(symlinkLockPath)).isSymbolicLink(), true);
  assert.equal(await readFile(symlinkTargetPath, "utf8"), "symlink target data\n");
});
