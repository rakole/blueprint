import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  discoverTestFiles,
  runTestFiles,
  withCheckoutHygiene
} from "../scripts/run-tests.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();

test("canonical discovery includes root and nested tests while excluding fixtures", async () => {
  const discovered = await discoverTestFiles(repoRoot);

  assert.equal(discovered.length, 151);
  assert.ok(discovered.includes("tests/test-verification-spine.test.ts"));
  assert.ok(discovered.includes("tests/prompt-eval/lightweight-command-contracts.test.ts"));
  assert.equal(
    discovered.includes("tests/fixtures/map-codebase/brownfield-repo/tests/runtime.test.ts"),
    false
  );
  assert.equal(new Set(discovered).size, discovered.length);
});

test("discovery is identical when invoked without caller-shell glob expansion", async () => {
  const scriptPath = path.join(repoRoot, "scripts", "run-tests.mjs");
  const { stdout } = await execFileAsync(process.execPath, [scriptPath, "--list"], {
    cwd: repoRoot
  });

  assert.deepEqual(stdout.trim().split("\n"), await discoverTestFiles(repoRoot));
});

test("production security audit is production-only and separate from canonical tests", async () => {
  const packageJson = JSON.parse(
    await readFile(path.join(repoRoot, "package.json"), "utf8")
  ) as {
    scripts?: Record<string, string>;
  };
  const productionAudit = packageJson.scripts?.["audit:production"];

  assert.equal(
    productionAudit,
    "npm audit --omit=dev --audit-level=moderate",
    "the production audit should preserve npm output and fail on moderate or higher advisories"
  );
  assert.doesNotMatch(
    packageJson.scripts?.test ?? "",
    /audit/i,
    "canonical tests should not depend on advisory-network availability"
  );
});

test("test execution propagates a real failing test exit", async (t) => {
  const childEnv = { ...process.env };
  delete childEnv.NODE_TEST_CONTEXT;

  assert.notEqual(
    await runTestFiles(["tests/runner-fixtures/intentional-failure.fixture.ts"], {
      cwd: repoRoot,
      env: childEnv,
      stdio: "ignore"
    }),
    0
  );
});

test("checkout hygiene restores tracked and untracked state after success or failure", async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-test-hygiene-"));
  t.after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  await execFileAsync("git", ["init", "--quiet"], { cwd: tempRoot });
  await writeFile(path.join(tempRoot, ".gitignore"), "ignored/\n", "utf8");
  await writeFile(path.join(tempRoot, "tracked.txt"), "tracked\n", "utf8");
  await writeFile(path.join(tempRoot, "existing-untracked.txt"), "existing\n", "utf8");
  await mkdir(path.join(tempRoot, "ignored"), { recursive: true });
  await mkdir(path.join(tempRoot, "ignored", "empty-before"), { recursive: true });
  await writeFile(path.join(tempRoot, "ignored", "existing.txt"), "ignored existing\n", "utf8");
  await execFileAsync("git", ["add", ".gitignore", "tracked.txt"], { cwd: tempRoot });
  await execFileAsync(
    "git",
    ["-c", "user.name=Blueprint Tests", "-c", "user.email=tests@example.invalid", "commit", "--quiet", "-m", "fixture"],
    { cwd: tempRoot }
  );

  for (const workExitCode of [0, 1]) {
    const failureLog = path.join(tempRoot, ".blueprint", "mcp-write-failures.ndjson");
    const generatedReport = path.join(tempRoot, "generated", "report.md");
    const ignoredResidue = path.join(tempRoot, "ignored", "residue.txt");
    const newEmptyDirectory = path.join(tempRoot, "ignored", "empty-after");
    const result = await withCheckoutHygiene(tempRoot, async () => {
      await mkdir(path.dirname(failureLog), { recursive: true });
      await mkdir(path.dirname(generatedReport), { recursive: true });
      await writeFile(failureLog, "fixture residue\n", "utf8");
      await writeFile(generatedReport, "generated residue\n", "utf8");
      await writeFile(ignoredResidue, "ignored residue\n", "utf8");
      await mkdir(newEmptyDirectory, { recursive: true });
      await writeFile(path.join(tempRoot, "tracked.txt"), "modified by test\n", "utf8");
      await writeFile(path.join(tempRoot, "existing-untracked.txt"), "modified by test\n", "utf8");
      await writeFile(path.join(tempRoot, "ignored", "existing.txt"), "modified by test\n", "utf8");
      return workExitCode;
    });

    assert.equal(result, workExitCode);
    assert.equal(await readFile(path.join(tempRoot, "tracked.txt"), "utf8"), "tracked\n");
    assert.equal(
      await readFile(path.join(tempRoot, "existing-untracked.txt"), "utf8"),
      "existing\n"
    );
    assert.equal(
      await readFile(path.join(tempRoot, "ignored", "existing.txt"), "utf8"),
      "ignored existing\n"
    );
    await assert.rejects(readFile(failureLog, "utf8"), { code: "ENOENT" });
    await assert.rejects(readFile(generatedReport, "utf8"), { code: "ENOENT" });
    await assert.rejects(readFile(ignoredResidue, "utf8"), { code: "ENOENT" });
    await access(path.join(tempRoot, "ignored", "empty-before"));
    await assert.rejects(access(newEmptyDirectory), { code: "ENOENT" });
  }
});
