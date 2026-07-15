import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  applyPhaseExecutionMutations,
  observePhaseExecutionGitState,
  runPhaseExecutionVerification,
  type PhaseExecutionProcessRunner
} from "../src/mcp/tools/phase-execution-runtime.js";

const execFileAsync = promisify(execFile);

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function createRuntimeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "blueprint execute runtime "));
  await mkdir(path.join(root, "src"), { recursive: true });
  return root;
}

async function git(root: string, argv: string[]): Promise<void> {
  await execFileAsync("git", argv, { cwd: root });
}

test("execute-phase applies only preimage-bound owned mutations and records exact hashes", async (t) => {
  const root = await createRuntimeRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "src/keep.ts"), "old\n", "utf8");
  await writeFile(path.join(root, "src/delete.ts"), "remove\n", "utf8");

  const result = await applyPhaseExecutionMutations({
    projectRoot: root,
    authorizedFiles: ["src/keep.ts", "src/delete.ts", "src/new.ts"],
    mutations: [
      {
        path: "src/keep.ts",
        operation: "write",
        content: "new\n",
        expectedHash: sha256("old\n")
      },
      {
        path: "src/delete.ts",
        operation: "delete",
        expectedHash: sha256("remove\n")
      },
      {
        path: "src/new.ts",
        operation: "write",
        content: "created\n",
        expectedHash: null
      }
    ]
  });

  assert.equal(await readFile(path.join(root, "src/keep.ts"), "utf8"), "new\n");
  assert.equal(await readFile(path.join(root, "src/new.ts"), "utf8"), "created\n");
  await assert.rejects(readFile(path.join(root, "src/delete.ts"), "utf8"), /ENOENT/);
  assert.equal(result.status, "committed");
  assert.deepEqual(result.cleanupPaths, []);
  assert.deepEqual(result.receipts, [
    {
      path: "src/keep.ts",
      operation: "write",
      beforeHash: sha256("old\n"),
      beforeMode: 0o644,
      afterHash: sha256("new\n"),
      afterMode: 0o644,
      bytesWritten: 4
    },
    {
      path: "src/delete.ts",
      operation: "delete",
      beforeHash: sha256("remove\n"),
      beforeMode: 0o644,
      afterHash: null,
      afterMode: null,
      bytesWritten: 0
    },
    {
      path: "src/new.ts",
      operation: "write",
      beforeHash: null,
      beforeMode: null,
      afterHash: sha256("created\n"),
      afterMode: 0o644,
      bytesWritten: 8
    }
  ]);
});

test("execute-phase mutation rejects stale, unowned, Blueprint, traversal, and symlink paths", async (t) => {
  const root = await createRuntimeRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "src/owned.ts"), "old\n", "utf8");
  await mkdir(path.join(root, "outside"), { recursive: true });
  await symlink(path.join(root, "outside"), path.join(root, "src/link"));

  const base = {
    projectRoot: root,
    authorizedFiles: ["src/owned.ts", "src/link/escape.ts"]
  };

  await assert.rejects(
    applyPhaseExecutionMutations({
      ...base,
      mutations: [{
        path: "src/owned.ts",
        operation: "write",
        content: "new\n",
        expectedHash: sha256("not the preimage")
      }]
    }),
    /preimage is stale/i
  );
  await assert.rejects(
    applyPhaseExecutionMutations({
      ...base,
      mutations: [{
        path: "src/unowned.ts",
        operation: "write",
        content: "new\n",
        expectedHash: null
      }]
    }),
    /outside the selected plan ownership/i
  );

  for (const unsafePath of ["../escape.ts", ".blueprint/STATE.md", ".git/config"]) {
    await assert.rejects(
      applyPhaseExecutionMutations({
        projectRoot: root,
        authorizedFiles: [unsafePath],
        mutations: [{
          path: unsafePath,
          operation: "write",
          content: "unsafe\n",
          expectedHash: null
        }]
      }),
      /canonical repo-relative path|Git or Blueprint-owned state/i
    );
  }

  await assert.rejects(
    applyPhaseExecutionMutations({
      ...base,
      mutations: [{
        path: "src/link/escape.ts",
        operation: "write",
        content: "unsafe\n",
        expectedHash: null
      }]
    }),
    /symbolic link/i
  );
  assert.equal(await readFile(path.join(root, "src/owned.ts"), "utf8"), "old\n");
});

test("execute-phase pinned parent workers prevent a concurrent symlink substitution from redirecting writes", async (t) => {
  const root = await createRuntimeRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const external = await mkdtemp(path.join(os.tmpdir(), "blueprint external target "));
  t.after(() => rm(external, { recursive: true, force: true }));
  await writeFile(path.join(root, "src/owned.ts"), "repo old\n", "utf8");
  await writeFile(path.join(external, "owned.ts"), "external untouched\n", "utf8");

  const result = await applyPhaseExecutionMutations({
      projectRoot: root,
      authorizedFiles: ["src/owned.ts"],
      mutations: [{
        path: "src/owned.ts",
        operation: "write",
        content: "repo new\n",
        expectedHash: sha256("repo old\n")
      }],
      runtimeHooks: {
        afterParentsPinned: async () => {
          await fs.rename(path.join(root, "src"), path.join(root, "src-original"));
          await symlink(external, path.join(root, "src"));
        }
      }
    });

  assert.equal(result.status, "rolled-back");
  assert.match(result.failure ?? "", /parent identity changed during commit/i);

  assert.equal(
    await readFile(path.join(external, "owned.ts"), "utf8"),
    "external untouched\n"
  );
  assert.equal(
    await readFile(path.join(root, "src-original/owned.ts"), "utf8"),
    "repo old\n"
  );
});

test("execute-phase mutation rolls the whole batch back after an injected commit failure", async (t) => {
  const root = await createRuntimeRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "src/one.ts"), "one\n", "utf8");
  await writeFile(path.join(root, "src/two.ts"), "two\n", "utf8");
  let renameCalls = 0;
  const injectedFileSystem = {
    ...fs,
    rename: async (oldPath: string, newPath: string): Promise<void> => {
      renameCalls += 1;
      if (renameCalls === 4) {
        throw new Error("injected second-file commit failure");
      }
      await fs.rename(oldPath, newPath);
    }
  };

  await assert.rejects(
    applyPhaseExecutionMutations({
      projectRoot: root,
      authorizedFiles: ["src/one.ts", "src/two.ts"],
      mutations: [
        {
          path: "src/one.ts",
          operation: "write",
          content: "changed one\n",
          expectedHash: sha256("one\n")
        },
        {
          path: "src/two.ts",
          operation: "write",
          content: "changed two\n",
          expectedHash: sha256("two\n")
        }
      ],
      fileSystem: injectedFileSystem
    }),
    /injected second-file commit failure/i
  );

  assert.equal(await readFile(path.join(root, "src/one.ts"), "utf8"), "one\n");
  assert.equal(await readFile(path.join(root, "src/two.ts"), "utf8"), "two\n");
  assert.deepEqual(
    (await fs.readdir(path.join(root, "src"))).sort(),
    ["one.ts", "two.ts"]
  );
});

test("execute-phase mutation returns explicit recovery state for cleanup or rollback failure", async (t) => {
  const cleanupRoot = await createRuntimeRoot();
  const rollbackRoot = await createRuntimeRoot();
  t.after(() => Promise.all([
    rm(cleanupRoot, { recursive: true, force: true }),
    rm(rollbackRoot, { recursive: true, force: true })
  ]));
  await writeFile(path.join(cleanupRoot, "src/owned.ts"), "old\n", "utf8");
  const cleanupFs = {
    ...fs,
    rm: async (target: string | Buffer | URL, options?: Parameters<typeof fs.rm>[1]): Promise<void> => {
      if (String(target).includes("blueprint-execute-backup")) {
        throw new Error("injected backup cleanup failure");
      }
      await fs.rm(target, options);
    }
  };
  const cleanup = await applyPhaseExecutionMutations({
    projectRoot: cleanupRoot,
    authorizedFiles: ["src/owned.ts"],
    mutations: [{
      path: "src/owned.ts",
      operation: "write",
      content: "new\n",
      expectedHash: sha256("old\n")
    }],
    fileSystem: cleanupFs
  });
  assert.equal(cleanup.status, "committed-cleanup-required");
  assert.equal(await readFile(path.join(cleanupRoot, "src/owned.ts"), "utf8"), "new\n");
  assert.equal(cleanup.cleanupPaths.length, 1);

  await writeFile(path.join(rollbackRoot, "src/one.ts"), "one\n", "utf8");
  await writeFile(path.join(rollbackRoot, "src/two.ts"), "two\n", "utf8");
  let renameCalls = 0;
  const rollbackFs = {
    ...fs,
    rename: async (oldPath: string, newPath: string): Promise<void> => {
      renameCalls += 1;
      if (renameCalls === 4 || renameCalls === 6) {
        throw new Error(
          renameCalls === 4
            ? "injected commit failure"
            : "injected rollback restore failure"
        );
      }
      await fs.rename(oldPath, newPath);
    }
  };
  const rollback = await applyPhaseExecutionMutations({
    projectRoot: rollbackRoot,
    authorizedFiles: ["src/one.ts", "src/two.ts"],
    mutations: [
      {
        path: "src/one.ts",
        operation: "write",
        content: "changed one\n",
        expectedHash: sha256("one\n")
      },
      {
        path: "src/two.ts",
        operation: "write",
        content: "changed two\n",
        expectedHash: sha256("two\n")
      }
    ],
    fileSystem: rollbackFs
  });
  assert.equal(rollback.status, "rollback-failed");
  assert.match(rollback.failure ?? "", /injected commit failure/i);
  assert.match(rollback.rollbackFailures.join("\n"), /restore preimage failed/i);
  assert.equal(rollback.cleanupPaths.length, 1);
});

test("execute-phase verification uses exact bound argv, keeps receipts, and stops on failure", async () => {
  const invocations: Array<{ command: string; argv: readonly string[]; timeoutMs: number }> = [];
  const runner: PhaseExecutionProcessRunner = async (command, argv, _cwd, _env, timeoutMs) => {
    invocations.push({ command, argv, timeoutMs });
    return argv[1] === "node fail.mjs"
      ? {
          exitCode: 9,
          signal: null,
          timedOut: false,
          stdout: "partial stdout\n",
          stderr: "failure stderr\n"
        }
      : {
          exitCode: 0,
          signal: null,
          timedOut: false,
          stdout: "pass stdout\n",
          stderr: ""
        };
  };

  const receipts = await runPhaseExecutionVerification({
    projectRoot: "/repo with spaces",
    commands: ["node pass.mjs", "node fail.mjs", "node must-not-run.mjs"],
    processRunner: runner,
    timeoutMs: 1_234
  });

  assert.deepEqual(invocations, [
    { command: "/bin/sh", argv: ["-c", "node pass.mjs"], timeoutMs: 1_234 },
    { command: "/bin/sh", argv: ["-c", "node fail.mjs"], timeoutMs: 1_234 }
  ]);
  assert.equal(receipts.length, 2);
  assert.equal(receipts[0]?.passed, true);
  assert.equal(receipts[1]?.passed, false);
  assert.equal(receipts[1]?.exitCode, 9);
  assert.equal(receipts[1]?.stdoutHash, sha256("partial stdout\n"));
  assert.equal(receipts[1]?.stderrHash, sha256("failure stderr\n"));
});

test("execute-phase timeout kills the verification process group before a descendant can mutate", async (t) => {
  const root = await createRuntimeRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const survivedPath = path.join(root, "survived.txt");
  const shellPath = survivedPath.replaceAll("'", "'\\''");
  const [receipt] = await runPhaseExecutionVerification({
    projectRoot: root,
    commands: [
      `(trap '' TERM HUP; sleep 0.4; printf survived > '${shellPath}') >/dev/null 2>&1 & exit 0`
    ],
    timeoutMs: 40
  });

  assert.equal(receipt?.passed, false);
  assert.equal(receipt?.timedOut, true);
  await new Promise((resolve) => setTimeout(resolve, 550));
  await assert.rejects(readFile(survivedPath, "utf8"), /ENOENT/);
});

test("execute-phase caps subprocess output and records overflow as a failed check", async (t) => {
  const root = await createRuntimeRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const [receipt] = await runPhaseExecutionVerification({
    projectRoot: root,
    commands: ["node -e 'process.stdout.write(\"x\".repeat(20 * 1024 * 1024))'"],
    timeoutMs: 5_000
  });

  assert.equal(receipt?.passed, false);
  assert.equal(receipt?.outputLimitExceeded, true);
  assert.ok((receipt?.stdoutBytes ?? Infinity) <= 16 * 1024 * 1024);
});

test("execute-phase never rejects after commit solely because final receipt observation fails", async (t) => {
  const root = await createRuntimeRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "src/owned.ts"), "old\n", "utf8");
  let ownedReads = 0;
  const injectedFileSystem = {
    ...fs,
    readFile: async (...args: Parameters<typeof fs.readFile>): ReturnType<typeof fs.readFile> => {
      if (String(args[0]).endsWith("src/owned.ts")) {
        ownedReads += 1;
        if (ownedReads === 3) throw new Error("injected final observation failure");
      }
      return fs.readFile(...args);
    }
  };

  const result = await applyPhaseExecutionMutations({
    projectRoot: root,
    authorizedFiles: ["src/owned.ts"],
    mutations: [{
      path: "src/owned.ts",
      operation: "write",
      content: "new\n",
      expectedHash: sha256("old\n")
    }],
    fileSystem: injectedFileSystem
  });

  assert.equal(result.status, "postimage-diverged");
  assert.match(result.failure ?? "", /could not be observed/i);
  assert.equal(result.receipts[0]?.afterHash, sha256("new\n"));
  assert.equal(await readFile(path.join(root, "src/owned.ts"), "utf8"), "new\n");
});

test("execute-phase production workers roll back and report cleanup when final observation cannot read a replaced target", async (t) => {
  const root = await createRuntimeRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, "src/owned.ts");
  await writeFile(target, "old\n", "utf8");

  const result = await applyPhaseExecutionMutations({
    projectRoot: root,
    authorizedFiles: ["src/owned.ts"],
    mutations: [{
      path: "src/owned.ts",
      operation: "write",
      content: "new\n",
      expectedHash: sha256("old\n")
    }],
    runtimeHooks: {
      beforeFinalObservation: async () => {
        await rm(target);
        await mkdir(target);
      }
    }
  });

  assert.equal(result.status, "rolled-back");
  assert.match(result.failure ?? "", /could not be observed/i);
  assert.equal(result.rollbackFailures.length, 0);
  assert.equal(result.cleanupPaths.length, 1);
  assert.equal(await readFile(target, "utf8"), "old\n");
  const residue = (await fs.readdir(path.join(root, "src")))
    .filter((entry) => entry.includes("blueprint-execute"));
  assert.deepEqual(
    residue,
    result.cleanupPaths.map((entry) => path.basename(entry))
  );
  assert.ok((await fs.lstat(result.cleanupPaths[0]!)).isDirectory());
});

test("execute-phase production delete rolls back and reports a concurrently recreated target", async (t) => {
  const root = await createRuntimeRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, "src/owned.ts");
  await writeFile(target, "old\n", "utf8");

  const result = await applyPhaseExecutionMutations({
    projectRoot: root,
    authorizedFiles: ["src/owned.ts"],
    mutations: [{
      path: "src/owned.ts",
      operation: "delete",
      expectedHash: sha256("old\n")
    }],
    runtimeHooks: {
      beforeFinalObservation: () => writeFile(target, "raced\n", "utf8")
    }
  });

  assert.equal(result.status, "rolled-back");
  assert.match(result.failure ?? "", /postimage diverged/i);
  assert.equal(result.rollbackFailures.length, 0);
  assert.equal(result.cleanupPaths.length, 1);
  assert.equal(await readFile(target, "utf8"), "old\n");
  assert.equal(await readFile(result.cleanupPaths[0]!, "utf8"), "raced\n");
  const residue = (await fs.readdir(path.join(root, "src")))
    .filter((entry) => entry.includes("blueprint-execute"));
  assert.deepEqual(
    residue,
    result.cleanupPaths.map((entry) => path.basename(entry))
  );
});

test("execute-phase production commit-worker death returns an explicit ambiguous recovery result", async (t) => {
  const root = await createRuntimeRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, "src/owned.ts");
  await writeFile(target, "old\n", "utf8");

  const result = await applyPhaseExecutionMutations({
    projectRoot: root,
    authorizedFiles: ["src/owned.ts"],
    mutations: [{
      path: "src/owned.ts",
      operation: "write",
      content: "new\n",
      expectedHash: sha256("old\n")
    }],
    runtimeHooks: { crashWorkerAfterCommit: true }
  });

  assert.equal(result.status, "rollback-failed");
  assert.match(result.failure ?? "", /commit worker failed/i);
  assert.match(result.rollbackFailures.join("\n"), /outcome is unknown/i);
  const residue = (await fs.readdir(path.join(root, "src")))
    .filter((entry) => entry.includes("blueprint-execute"));
  assert.ok(residue.length > 0);
  assert.ok(residue.every((entry) =>
    result.cleanupPaths.some((candidate) => path.basename(candidate) === entry)
  ));
});

test("execute-phase sealed commit survives production cleanup-worker death with explicit debt", async (t) => {
  const root = await createRuntimeRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, "src/owned.ts");
  await writeFile(target, "old\n", "utf8");

  const result = await applyPhaseExecutionMutations({
    projectRoot: root,
    authorizedFiles: ["src/owned.ts"],
    mutations: [{
      path: "src/owned.ts",
      operation: "write",
      content: "new\n",
      expectedHash: sha256("old\n")
    }],
    runtimeHooks: { crashWorkerDuringCleanup: true }
  });

  assert.equal(result.status, "committed-cleanup-required");
  assert.match(result.failure ?? "", /cleanup worker failed/i);
  assert.equal(result.receipts[0]?.afterHash, sha256("new\n"));
  assert.equal(await readFile(target, "utf8"), "new\n");
  const residue = (await fs.readdir(path.join(root, "src")))
    .filter((entry) => entry.includes("blueprint-execute"));
  assert.ok(residue.length > 0);
  assert.ok(residue.every((entry) =>
    result.cleanupPaths.some((candidate) => path.basename(candidate) === entry)
  ));
});

test("execute-phase times out a stopped post-commit worker into explicit ambiguous recovery", async (t) => {
  const root = await createRuntimeRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, "src/owned.ts");
  await writeFile(target, "old\n", "utf8");

  const result = await applyPhaseExecutionMutations({
    projectRoot: root,
    authorizedFiles: ["src/owned.ts"],
    mutations: [{
      path: "src/owned.ts",
      operation: "write",
      content: "new\n",
      expectedHash: sha256("old\n")
    }],
    runtimeHooks: {
      stopWorkerAfterCommit: true,
      pinnedWorkerTimeoutMs: 75
    }
  });

  assert.equal(result.status, "rollback-failed");
  assert.match(result.failure ?? "", /timed out/i);
  assert.match(result.rollbackFailures.join("\n"), /outcome is unknown/i);
  assert.ok(result.cleanupPaths.length >= 3);
});

test("execute-phase times out a stopped post-seal cleanup worker without rolling back the commit", async (t) => {
  const root = await createRuntimeRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, "src/owned.ts");
  await writeFile(target, "old\n", "utf8");

  const result = await applyPhaseExecutionMutations({
    projectRoot: root,
    authorizedFiles: ["src/owned.ts"],
    mutations: [{
      path: "src/owned.ts",
      operation: "write",
      content: "new\n",
      expectedHash: sha256("old\n")
    }],
    runtimeHooks: {
      stopWorkerDuringCleanup: true,
      pinnedWorkerTimeoutMs: 75
    }
  });

  assert.equal(result.status, "committed-cleanup-required");
  assert.match(result.failure ?? "", /timed out/i);
  assert.equal(await readFile(target, "utf8"), "new\n");
  assert.equal(result.receipts[0]?.afterHash, sha256("new\n"));
  assert.ok(result.cleanupPaths.length >= 3);
});

test("execute-phase close deadline resolves even when the worker exit signal is withheld", async (t) => {
  const root = await createRuntimeRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "src/owned.ts"), "old\n", "utf8");
  const startedAt = Date.now();

  const result = await applyPhaseExecutionMutations({
    projectRoot: root,
    authorizedFiles: ["src/owned.ts"],
    mutations: [{
      path: "src/owned.ts",
      operation: "write",
      content: "new\n",
      expectedHash: sha256("old\n")
    }],
    runtimeHooks: {
      pinnedWorkerTimeoutMs: 75,
      withholdCloseExitSignalForTest: true
    }
  });

  assert.equal(result.status, "committed");
  assert.ok(Date.now() - startedAt >= 50);
  assert.ok(Date.now() - startedAt < 1_000);
});

test("execute-phase Git observation is argv-safe and rejects changes outside cumulative ownership", async (t) => {
  const root = await createRuntimeRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  await git(root, ["init", "-b", "main"]);
  await git(root, ["config", "user.name", "Blueprint Runtime Tests"]);
  await git(root, ["config", "user.email", "blueprint-runtime@example.com"]);
  await writeFile(path.join(root, "src/owned.ts"), "old\n", "utf8");
  await writeFile(path.join(root, "README.md"), "old\n", "utf8");
  await git(root, ["add", "."]);
  await git(root, ["commit", "-m", "fixture"]);
  await writeFile(path.join(root, "src/owned.ts"), "new\n", "utf8");
  await writeFile(path.join(root, "README.md"), "new\n", "utf8");
  await mkdir(path.join(root, ".blueprint/executions/execute-phase"), { recursive: true });
  await writeFile(path.join(root, ".blueprint/executions/execute-phase/session.json"), "{}\n", "utf8");

  const observation = await observePhaseExecutionGitState({
    projectRoot: root,
    authorizedFiles: ["src/owned.ts"]
  });

  assert.match(observation.head, /^[0-9a-f]{40}$/);
  assert.deepEqual(observation.changedPaths, ["README.md", "src/owned.ts"]);
  assert.deepEqual(observation.unauthorizedChangedPaths, ["README.md"]);
});

test("execute-phase Git observation retains both staged rename endpoints and paths with spaces", async (t) => {
  const root = await createRuntimeRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  await git(root, ["init", "-b", "main"]);
  await git(root, ["config", "user.name", "Blueprint Runtime Tests"]);
  await git(root, ["config", "user.email", "blueprint-runtime@example.com"]);
  await writeFile(path.join(root, "unowned source.txt"), "same\n", "utf8");
  await git(root, ["add", "."]);
  await git(root, ["commit", "-m", "fixture"]);
  await fs.rename(
    path.join(root, "unowned source.txt"),
    path.join(root, "src/owned destination.txt")
  );
  await git(root, ["add", "-A"]);

  const observation = await observePhaseExecutionGitState({
    projectRoot: root,
    authorizedFiles: ["src/owned destination.txt"]
  });

  assert.deepEqual(observation.changedPaths, [
    "src/owned destination.txt",
    "unowned source.txt"
  ]);
  assert.deepEqual(observation.unauthorizedChangedPaths, ["unowned source.txt"]);
});

test("execute-phase Git observation rejects literal backslash aliases on POSIX", async (t) => {
  if (process.platform === "win32") return;
  const root = await createRuntimeRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  await git(root, ["init", "-b", "main"]);
  await git(root, ["config", "user.name", "Blueprint Runtime Tests"]);
  await git(root, ["config", "user.email", "blueprint-runtime@example.com"]);
  await writeFile(path.join(root, "src\\owned.ts"), "old\n", "utf8");
  await git(root, ["add", "."]);
  await git(root, ["commit", "-m", "fixture"]);
  await writeFile(path.join(root, "src\\owned.ts"), "new\n", "utf8");

  await assert.rejects(
    observePhaseExecutionGitState({
      projectRoot: root,
      authorizedFiles: ["src/owned.ts"]
    }),
    /canonical repo-relative path/i
  );
});
