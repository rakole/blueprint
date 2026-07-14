import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdir, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  tryAcquireQualityShippingOperationLock,
  type QualityShippingProcessResult,
  type QualityShippingProcessRunner
} from "../src/mcp/quality-shipping-safety.js";
import { blueprintArtifactReportWrite } from "../src/mcp/tools/artifacts.js";
import { blueprintConfigGet } from "../src/mcp/tools/config.js";
import {
  blueprintPrBranchExecute,
  blueprintPrBranchPersist,
  blueprintPrBranchPreview,
  prBranchToolDefinitions,
  prBranchToolTestHooks
} from "../src/mcp/tools/pr-branch.js";
import { createQualityShippingGitFixture } from "./helpers/quality-shipping-git-fixture.js";

type Fixture = Awaited<ReturnType<typeof createQualityShippingGitFixture>>;

function processFailure(exitCode: number, stderr: string) {
  return { exitCode, stdout: "", stderr, signal: null, timedOut: false } as const;
}

const refInspectionFailures: Array<[string, QualityShippingProcessResult]> = [
  ["exit 2", { exitCode: 2, stdout: "", stderr: "show-ref inspection failed", signal: null, timedOut: false }],
  ["null exit", { exitCode: null, stdout: "", stderr: "show-ref outcome unknown", signal: null, timedOut: false }],
  ["signal", { exitCode: 1, stdout: "", stderr: "show-ref signaled", signal: "SIGTERM", timedOut: false }],
  ["timeout", { exitCode: 1, stdout: "", stderr: "show-ref timed out", signal: null, timedOut: true }]
];

function isLocalBranchProbe(argv: readonly string[], branch: string): boolean {
  return argv[0] === "show-ref" && argv.includes(`refs/heads/${branch}`);
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

function isolatedRunner(fixture: Fixture, events?: string[]): QualityShippingProcessRunner {
  return async (command, argv, cwd, env) => {
    events?.push(`${command}:${argv.join("\u0001")}`);
    return fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
  };
}

async function setup(t: TestContext) {
  const fixture = await createQualityShippingGitFixture();
  t.after(() => fixture.cleanup());
  prBranchToolTestHooks.clearApprovalsForTest();
  const restore = prBranchToolTestHooks.setProcessRunnerForTest(isolatedRunner(fixture));
  t.after(restore);
  const restoreConfig = prBranchToolTestHooks.setEffectiveConfigReaderForTest((args) =>
    blueprintConfigGet({ cwd: args.cwd, scope: "project" })
  );
  t.after(restoreConfig);
  const base = (await fixture.runGit(["rev-parse", "HEAD"])).stdout.trim();
  assert.equal((await fixture.runGit(["switch", "-c", "feature/source"])).exitCode, 0);
  return { fixture, base };
}

async function commitPaths(fixture: Fixture, entries: Record<string, string>, message: string): Promise<string> {
  for (const [relative, content] of Object.entries(entries)) {
    const absolute = path.join(fixture.repoPath, relative);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, content, "utf8");
  }
  assert.equal((await fixture.runGit(["add", "--", ...Object.keys(entries)])).exitCode, 0);
  const committed = await fixture.runGit(["commit", "-m", message]);
  assert.equal(committed.exitCode, 0, committed.stderr);
  return (await fixture.runGit(["rev-parse", "HEAD"])).stdout.trim();
}

function preview(fixture: Fixture, baseRef: string, reviewBranch = "review/clean") {
  return blueprintPrBranchPreview({
    cwd: fixture.repoPath,
    baseRef,
    reviewBranch,
    blueprintPolicy: "exclude",
    evidencePaths: ["README.md"]
  });
}

async function assertReportMatchesReceipt(
  fixture: Fixture,
  result: Awaited<ReturnType<typeof blueprintPrBranchExecute>>
) {
  const report = await readFile(path.join(fixture.repoPath, ".blueprint/reports/pr-branch-latest.md"), "utf8");
  for (const blocker of result.blockers) assert.ok(report.includes(blocker), `report omitted blocker: ${blocker}`);
  for (const recovery of result.recoveryActions) assert.ok(report.includes(recovery), `report omitted recovery: ${recovery}`);
}

test("pr-branch preview binds canonical state and execute replays ordered real commits while filtering only Blueprint delta", async (t) => {
  const { fixture, base } = await setup(t);
  const codeOnly = await commitPaths(fixture, { "src/one.ts": "one\n" }, "feat: code one");
  const blueprintOnly = await commitPaths(fixture, { ".blueprint/STATE.md": "blueprint only\n" }, "chore: blueprint only");
  const mixed = await commitPaths(fixture, {
    "src/two.ts": "two\n",
    ".blueprint/STATE.md": "mixed blueprint delta\n"
  }, "feat: mixed two");
  const sourceHead = (await fixture.runGit(["rev-parse", "HEAD"])).stdout.trim();

  const planned = await preview(fixture, base);
  const secondPlan = await preview(fixture, base);
  assert.equal(planned.status, "ready", planned.blockers.join("\n"));
  assert.equal(secondPlan.fingerprint, planned.fingerprint);
  assert.notEqual(secondPlan.operationId, planned.operationId);
  assert.match(planned.fingerprint ?? "", /^[0-9a-f]{64}$/);
  assert.equal(planned.packet?.sourceHead, sourceHead);
  assert.equal(planned.packet?.baseOid, base);
  assert.equal(planned.packet?.mergeBase, base);
  assert.match(planned.packet?.commits[0]?.author ?? "", /^Blueprint Tests <blueprint-tests@example\.com> \d+ [+-]\d{4}$/);
  assert.equal(planned.packet?.commits[0]?.message, "feat: code one\n");
  assert.match(planned.packet?.commits[0]?.filteredDeltaSha256 ?? "", /^[0-9a-f]{64}$/);
  assert.deepEqual(planned.packet?.commits.map((entry) => [entry.sourceCommit, entry.classification, entry.action]), [
    [codeOnly, "code-only", "include"],
    [blueprintOnly, "blueprint-only", "exclude"],
    [mixed, "mixed", "include"]
  ]);
  assert.ok(planned.packet?.executionPlan.every((entry) => !["reset", "clean", "branch", "rebase"].includes(entry.argv[0] ?? "") && !entry.argv.includes("--force")));

  const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
  assert.equal(result.status, "succeeded", result.blockers.join("\n"));
  assert.equal(result.source.preserved, true);
  assert.equal(result.source.restored, true);
  assert.equal(result.review.disposition, "complete");
  assert.deepEqual(result.mapping.map((entry) => entry.sourceCommit), [codeOnly, blueprintOnly, mixed]);
  assert.deepEqual(result.mapping.map((entry) => entry.outcome), ["replayed", "excluded", "replayed"]);
  assert.deepEqual(result.validation.retainedPaths.sort(), ["src/one.ts", "src/two.ts"]);
  assert.deepEqual(result.validation.excludedPathsFound, []);
  assert.equal(result.validation.retainedCommitCount, 2);
  assert.equal(result.validation.finalClean, true);
  assert.equal(result.validation.currentBranch, "feature/source");
  assert.equal(result.validation.currentHead, sourceHead);
  assert.equal((await fixture.runGit(["symbolic-ref", "--short", "HEAD"])).stdout.trim(), "feature/source");
  assert.equal((await fixture.runGit(["rev-parse", "feature/source"])).stdout.trim(), sourceHead);
  assert.equal((await fixture.runGit(["cat-file", "-e", "review/clean:src/two.ts"])).exitCode, 0);
  assert.equal((await fixture.runGit(["show", `review/clean:.blueprint/STATE.md`])).stdout.includes("mixed blueprint delta"), false);
  const messages = (await fixture.runGit(["log", "--reverse", "--format=%s", `${base}..review/clean`])).stdout.trim().split(/\r?\n/);
  assert.deepEqual(messages, ["feat: code one", "feat: mixed two"]);
  assert.match(await readFile(path.join(fixture.repoPath, ".blueprint/reports/pr-branch-latest.md"), "utf8"), /Clean review branch status: clean/);
});

test("pr-branch evidence inputs require canonical in-repository files", async (t) => {
  await t.test("ordinary in-repository evidence is accepted", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "src/one.ts": "one\n", "evidence/review.md": "reviewed\n" }, "feat: reviewed code");
    const result = await blueprintPrBranchPreview({
      cwd: fixture.repoPath,
      baseRef: base,
      reviewBranch: "review/safe-evidence",
      blueprintPolicy: "exclude",
      evidencePaths: ["evidence/review.md"]
    });
    assert.equal(result.status, "ready", result.blockers.join("\n"));
    assert.match(result.packet?.evidence[0]?.contentSha256 ?? "", /^[0-9a-f]{64}$/);
  });

  await t.test("a non-canonical missing-path alias is rejected instead of receiving an ENOENT receipt", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "src/one.ts": "one\n" }, "feat: code");
    const result = await blueprintPrBranchPreview({
      cwd: fixture.repoPath,
      baseRef: base,
      reviewBranch: "review/noncanonical-evidence",
      blueprintPolicy: "exclude",
      evidencePaths: ["evidence//missing.md"]
    });
    assert.equal(result.status, "invalid");
    assert.match(result.blockers.join("\n"), /non-canonical repository alias/i);
  });

  await t.test("tracked symlink to an external readable file is rejected", async (t) => {
    const { fixture, base } = await setup(t);
    const external = path.join(fixture.root, "external evidence.md");
    await writeFile(external, "external review\n", "utf8");
    try {
      await symlink(external, path.join(fixture.repoPath, "evidence-link"));
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes((error as NodeJS.ErrnoException).code ?? "")) {
        t.skip(`platform denied symlink creation: ${(error as NodeJS.ErrnoException).code}`);
        return;
      }
      throw error;
    }
    assert.equal((await fixture.runGit(["add", "--", "evidence-link"])).exitCode, 0);
    assert.equal((await fixture.runGit(["commit", "-m", "test: add external evidence symlink"])).exitCode, 0);
    await commitPaths(fixture, { "src/one.ts": "one\n" }, "feat: code after symlink");
    const result = await blueprintPrBranchPreview({
      cwd: fixture.repoPath,
      baseRef: base,
      reviewBranch: "review/external-evidence",
      blueprintPolicy: "exclude",
      evidencePaths: ["evidence-link"]
    });
    assert.equal(result.status, "invalid");
    assert.match(result.blockers.join("\n"), /resolves outside the canonical repository/i);
  });
});

test("pr-branch creates no branch when filtering removes the entire candidate ledger", async (t) => {
  const { fixture, base } = await setup(t);
  await commitPaths(fixture, { ".blueprint/STATE.md": "only blueprint\n" }, "chore: blueprint only");
  const result = await preview(fixture, base, "review/empty");
  assert.equal(result.status, "blocked");
  assert.match(result.blockers.join("\n"), /no retained commits/i);
  assert.notEqual((await fixture.runGit(["show-ref", "--verify", "--quiet", "refs/heads/review/empty"])).exitCode, 0);
});

test("pr-branch creates no branch for a net-zero retained history", async (t) => {
  const { fixture, base } = await setup(t);
  await commitPaths(fixture, { "temporary.txt": "temporary\n" }, "feat: temporary");
  await rm(path.join(fixture.repoPath, "temporary.txt"));
  assert.equal((await fixture.runGit(["add", "-A"])).exitCode, 0);
  assert.equal((await fixture.runGit(["commit", "-m", "revert: remove temporary"])).exitCode, 0);
  const result = await preview(fixture, base, "review/net-zero");
  assert.equal(result.status, "blocked");
  assert.match(result.blockers.join("\n"), /no final retained content/i);
  assert.notEqual((await fixture.runGit(["show-ref", "--verify", "--quiet", "refs/heads/review/net-zero"])).exitCode, 0);
});

test("pr-branch filtering handles Blueprint add, modify, delete, and rename without changing the base Blueprint tree", async (t) => {
  const { fixture, base } = await setup(t);
  await writeFile(path.join(fixture.repoPath, ".blueprint/STATE.md"), "modified\n", "utf8");
  await writeFile(path.join(fixture.repoPath, ".blueprint/ADDED.md"), "added\n", "utf8");
  await rm(path.join(fixture.repoPath, ".blueprint/REQUIREMENTS.md"));
  await rename(path.join(fixture.repoPath, ".blueprint/PROJECT.md"), path.join(fixture.repoPath, ".blueprint/PROJECT-RENAMED.md"));
  await writeFile(path.join(fixture.repoPath, "retained.txt"), "retained\n", "utf8");
  assert.equal((await fixture.runGit(["add", "-A"])).exitCode, 0);
  assert.equal((await fixture.runGit(["commit", "-m", "feat: every blueprint path action"])).exitCode, 0);
  const planned = await preview(fixture, base, "review/path-actions");
  assert.equal(planned.status, "ready", planned.blockers.join("\n"));
  const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
  assert.equal(result.status, "succeeded", result.blockers.join("\n"));
  assert.deepEqual(result.validation.retainedPaths, ["retained.txt"]);
  assert.equal((await fixture.runGit(["rev-parse", `${base}:.blueprint`])).stdout.trim(), (await fixture.runGit(["rev-parse", "review/path-actions:.blueprint"])).stdout.trim());
});

test("pr-branch owns unique patch temp directories and never removes a pre-existing predictable sentinel", async (t) => {
  const { fixture, base } = await setup(t);
  const mixed = await commitPaths(fixture, {
    "retained.txt": "retained\n",
    ".blueprint/STATE.md": "mixed\n"
  }, "feat: mixed sentinel case");
  const commonRaw = (await fixture.runGit(["rev-parse", "--git-common-dir"])).stdout.trim();
  const common = path.resolve(fixture.repoPath, commonRaw);
  const sentinel = path.join(common, `blueprint-pr-branch-${mixed}.patch`);
  await writeFile(sentinel, "do not remove\n", "utf8");
  const planned = await preview(fixture, base, "review/temp-owner");
  const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
  assert.equal(result.status, "succeeded", result.blockers.join("\n"));
  assert.equal(await readFile(sentinel, "utf8"), "do not remove\n");
  const entries = await import("node:fs/promises").then((fs) => fs.readdir(common));
  assert.deepEqual(entries.filter((entry) => entry.startsWith("blueprint-pr-branch-") && entry !== path.basename(sentinel)), []);
});

test("pr-branch hard-stops unsafe repository and ref states without mutation", async (t) => {
  await t.test("dirty tree", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "safe.txt": "safe\n" }, "feat: safe");
    await writeFile(path.join(fixture.repoPath, "dirty.txt"), "dirty\n", "utf8");
    const result = await preview(fixture, base);
    assert.equal(result.status, "blocked");
    assert.match(result.blockers.join("\n"), /clean/i);
  });
  await t.test("tracked and staged dirt", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "safe.txt": "safe\n" }, "feat: safe");
    await writeFile(path.join(fixture.repoPath, "safe.txt"), "tracked dirt\n", "utf8");
    assert.equal((await preview(fixture, base)).status, "blocked");
    assert.equal((await fixture.runGit(["add", "safe.txt"])).exitCode, 0);
    assert.equal((await preview(fixture, base)).status, "blocked");
  });
  await t.test("detached and sequencer", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "safe.txt": "safe\n" }, "feat: safe");
    assert.equal((await fixture.runGit(["switch", "--detach"])).exitCode, 0);
    const detached = await preview(fixture, base);
    assert.equal(detached.status, "blocked");
    assert.match(detached.blockers.join("\n"), /detached/i);
  });
  await t.test("option-shaped and invalid refs", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "safe.txt": "safe\n" }, "feat: safe");
    for (const [baseRef, branch] of [["--all", "review/safe"], [base, "--force"], [base, "bad..branch"], [base, "@{-1}"]]) {
      const result = await preview(fixture, baseRef, branch);
      assert.ok(result.status === "invalid" || result.status === "blocked");
    }
  });
  await t.test("real sequencer marker and unsafe current branch", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "safe.txt": "safe\n" }, "feat: safe");
    const common = (await fixture.runGit(["rev-parse", "--git-common-dir"])).stdout.trim();
    const commonPath = path.resolve(fixture.repoPath, common);
    await mkdir(path.join(commonPath, "sequencer"), { recursive: true });
    const sequencer = await preview(fixture, base);
    assert.equal(sequencer.status, "blocked");
    assert.match(sequencer.blockers.join("\n"), /sequencer/i);
    await rm(path.join(commonPath, "sequencer"), { recursive: true, force: true });
    assert.equal((await fixture.runGit(["update-ref", "refs/heads/--detach", "HEAD"])).exitCode, 0);
    assert.equal((await fixture.runGit(["symbolic-ref", "HEAD", "refs/heads/--detach"])).exitCode, 0);
    const unsafeSource = await preview(fixture, base);
    assert.equal(unsafeSource.status, "blocked");
    assert.match(unsafeSource.blockers.join("\n"), /source branch name is unsafe/i);
  });
});

test("pr-branch blocks missing, non-ancestor, merge-ledger, and cross-worktree candidate states", async (t) => {
  await t.test("source on base", async (t) => {
    const { fixture } = await setup(t);
    assert.equal((await fixture.runGit(["switch", "main"])).exitCode, 0);
    const result = await preview(fixture, "main", "review/source-on-base");
    assert.equal(result.status, "blocked");
    assert.match(result.blockers.join("\n"), /no commits ahead|no final retained content/i);
  });
  await t.test("missing and non-ancestor base", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "feature.txt": "feature\n" }, "feat: source");
    const missing = await preview(fixture, "refs/heads/missing");
    assert.equal(missing.status, "invalid");
    assert.equal((await fixture.runGit(["branch", "side", base])).exitCode, 0);
    assert.equal((await fixture.runGit(["switch", "side"])).exitCode, 0);
    await commitPaths(fixture, { "side.txt": "side\n" }, "feat: side");
    assert.equal((await fixture.runGit(["switch", "feature/source"])).exitCode, 0);
    const nonAncestor = await preview(fixture, "side");
    assert.equal(nonAncestor.status, "blocked");
    assert.match(nonAncestor.blockers.join("\n"), /ancestor/i);
  });
  await t.test("unexpected merge", async (t) => {
    const { fixture, base } = await setup(t);
    assert.equal((await fixture.runGit(["switch", "-c", "merge-child"])).exitCode, 0);
    await commitPaths(fixture, { "child.txt": "child\n" }, "feat: child");
    assert.equal((await fixture.runGit(["switch", "feature/source"])).exitCode, 0);
    await commitPaths(fixture, { "source.txt": "source\n" }, "feat: source");
    assert.equal((await fixture.runGit(["merge", "--no-ff", "merge-child", "-m", "merge child"])).exitCode, 0);
    const merged = await preview(fixture, base);
    assert.equal(merged.status, "invalid");
    assert.match(merged.blockers.join("\n"), /Merge commit .* unsupported/i);
  });
  await t.test("cross-worktree candidate collision", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "source.txt": "source\n" }, "feat: source");
    const other = path.join(fixture.root, "other review worktree");
    assert.equal((await fixture.runGit(["worktree", "add", "-b", "review/in-other-worktree", other, base])).exitCode, 0);
    const collision = await preview(fixture, base, "review/in-other-worktree");
    assert.equal(collision.status, "divergent");
    assert.match(collision.blockers.join("\n"), /will not be deleted or overwritten/i);
  });
  await t.test("shallow repository", async (t) => {
    const { fixture } = await setup(t);
    await commitPaths(fixture, { "source.txt": "source\n" }, "feat: source");
    const shallow = path.join(fixture.root, "shallow clone");
    const cloned = await fixture.runner("git", ["clone", "--depth", "2", "--branch", "feature/source", `file://${fixture.repoPath}`, shallow], fixture.root, fixture.env);
    assert.equal(cloned.exitCode, 0, cloned.stderr);
    const result = await blueprintPrBranchPreview({ cwd: shallow, baseRef: "HEAD~1", reviewBranch: "review/shallow", blueprintPolicy: "exclude", evidencePaths: ["README.md"] });
    assert.equal(result.status, "blocked");
    assert.match(result.blockers.join("\n"), /Shallow/i);
  });
});

test("pr-branch revalidates HEAD, evidence, config, report CAS, and post-report drift before branch creation", async (t) => {
  await t.test("HEAD drift", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
    const planned = await preview(fixture, base);
    await commitPaths(fixture, { "drift.txt": "drift\n" }, "test: drift");
    const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
    assert.equal(result.status, "stale");
    assert.equal(result.mutationStarted, false);
    assert.equal(result.report.preMutationStatus, "not-attempted");
  });
  await t.test("evidence drift", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
    const planned = await preview(fixture, base, "review/evidence-drift");
    await writeFile(path.join(fixture.repoPath, "README.md"), "# changed evidence\n", "utf8");
    const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
    assert.equal(result.status, "stale");
    assert.equal(result.mutationStarted, false);
    assert.match(result.blockers.join("\n"), /evidence/i);
  });
  await t.test("base ref drift", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
    const planned = await preview(fixture, "main", "review/base-drift");
    assert.equal((await fixture.runGit(["update-ref", "refs/heads/main", "feature/source", base])).exitCode, 0);
    const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
    assert.equal(result.status, "stale");
    assert.equal(result.mutationStarted, false);
    assert.match(result.blockers.join("\n"), /base ref/i);
  });
  await t.test("ignored report CAS drift", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
    const reportPath = path.join(fixture.repoPath, ".blueprint/reports/pr-branch-latest.md");
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, "old\n", "utf8");
    const planned = await blueprintPrBranchPreview({ cwd: fixture.repoPath, baseRef: base, reviewBranch: "review/cas", blueprintPolicy: "exclude", evidencePaths: ["README.md"], overwriteReport: true });
    await writeFile(reportPath, "new\n", "utf8");
    const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
    assert.equal(result.status, "stale");
    assert.equal(result.mutationStarted, false);
    assert.equal(await readFile(reportPath, "utf8"), "new\n");
  });
  await t.test("post-plan config drift", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
    const planned = await preview(fixture, base, "review/post-report-drift");
    let writes = 0;
    const restore = prBranchToolTestHooks.setReportWriterForTest(async (args) => {
      const written = await blueprintArtifactReportWrite(args);
      writes += 1;
      if (writes === 1) await fixture.runGit(["config", "commit.cleanup", "strip"]);
      return written;
    });
    t.after(restore);
    const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
    assert.equal(result.status, "stale");
    assert.equal(result.mutationStarted, false);
    assert.match(result.blockers.join("\n"), /after pre-mutation report/i);
    assert.notEqual((await fixture.runGit(["show-ref", "--verify", "--quiet", "refs/heads/review/post-report-drift"])).exitCode, 0);
  });
  await t.test("effective Blueprint project config drift", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
    const planned = await preview(fixture, base, "review/blueprint-config-drift");
    assert.equal((await fixture.runGit(["update-index", "--assume-unchanged", ".blueprint/config.json"])).exitCode, 0);
    await writeFile(path.join(fixture.repoPath, ".blueprint/config.json"), "{\n  \"version\": 2,\n  \"planning\": { \"commit_docs\": false }\n}\n", "utf8");
    assert.equal((await fixture.runGit(["status", "--porcelain=v1"])).stdout, "");
    const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
    assert.equal(result.status, "stale");
    assert.equal(result.mutationStarted, false);
    assert.match(result.blockers.join("\n"), /effective Blueprint config/i);
  });
  await t.test("candidate ledger drift during pre-report persistence", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
    const planned = await preview(fixture, base, "review/post-report-ledger-drift");
    let writes = 0;
    const restoreWriter = prBranchToolTestHooks.setReportWriterForTest(async (args) => {
      const written = await blueprintArtifactReportWrite(args);
      writes += 1;
      if (writes === 1) await commitPaths(fixture, { "late.txt": "late\n" }, "test: late ledger drift");
      return written;
    });
    t.after(restoreWriter);
    const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
    assert.equal(result.status, "stale");
    assert.equal(result.mutationStarted, false);
    assert.match(result.blockers.join("\n"), /after pre-mutation report persistence.*source HEAD/i);
  });
});

test("pr-branch pre-mutation report cannot dirty a repository into branch mutation", async (t) => {
  const { fixture, base } = await setup(t);
  await commitPaths(fixture, {
    ".gitignore": ".blueprint/locks/\n.blueprint/mcp-write-failures.ndjson\n",
    "one.txt": "one\n"
  }, "test: make runtime report visible");
  const planned = await preview(fixture, base, "review/report-dirt");
  assert.equal(planned.status, "ready", planned.blockers.join("\n"));
  const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
  assert.equal(result.status, "stale");
  assert.equal(result.mutationStarted, false);
  assert.match(result.blockers.join("\n"), /after pre-mutation report persistence.*working tree/i);
  assert.notEqual((await fixture.runGit(["show-ref", "--verify", "--quiet", "refs/heads/review/report-dirt"])).exitCode, 0);
});

test("pr-branch conflict after a retained prefix preserves source and returns exact partial receipts", async (t) => {
  const { fixture, base } = await setup(t);
  const first = await commitPaths(fixture, { "one.txt": "one\n" }, "feat: prefix");
  const mixedOne = await commitPaths(fixture, {
    "two.txt": "two\n",
    ".blueprint/STATE.md": "intermediate blueprint state\n"
  }, "feat: first mixed");
  const mixedTwo = await commitPaths(fixture, {
    "three.txt": "three\n",
    ".blueprint/STATE.md": "dependent blueprint state\n"
  }, "feat: dependent mixed");
  const sourceHead = (await fixture.runGit(["rev-parse", "HEAD"])).stdout.trim();
  const planned = await preview(fixture, base, "review/conflict");
  assert.equal(planned.status, "ready", planned.blockers.join("\n"));
  let mixedCommitFinished = false;
  let injected = false;
  const restoreConflictRunner = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
    const processResult = await fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
    if (processResult.exitCode === 0 && argv[0] === "commit" && argv.at(-1) === mixedOne) mixedCommitFinished = true;
    if (!injected && mixedCommitFinished && processResult.exitCode === 0 && argv[0] === "diff" && argv[1] === "--binary" && !argv.some((arg) => arg.startsWith("--output="))) {
      injected = true;
      await writeFile(path.join(fixture.repoPath, "three.txt"), "external competing content\n", "utf8");
      await fixture.runner("git", ["add", "--", "three.txt"], fixture.repoPath, fixture.env);
      await fixture.runner("git", ["commit", "-m", "test: concurrent review-branch drift"], fixture.repoPath, fixture.env);
    }
    return processResult;
  });
  t.after(restoreConflictRunner);
  const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
  assert.equal(result.status, "partial");
  assert.equal(result.source.preserved, true);
  assert.equal((await fixture.runGit(["rev-parse", "feature/source"])).stdout.trim(), sourceHead);
  assert.deepEqual(result.mapping.map((entry) => entry.sourceCommit), [first, mixedOne, mixedTwo]);
  assert.equal(result.mapping.at(-1)?.outcome, "failed");
  assert.ok(result.processes.some((entry) => entry.stage === `replay:${mixedTwo}` && entry.result.exitCode !== 0));
  assert.ok(result.recoveryActions.some((entry) => /do not delete or overwrite/i.test(entry)));
  assert.equal((await fixture.runGit(["show-ref", "--verify", "--quiet", "refs/heads/review/conflict"])).exitCode, 0);
  await assertReportMatchesReceipt(fixture, result);
});

test("pr-branch validates exact final checkout posture instead of inferring stay-on-review success", async (t) => {
  const { fixture, base } = await setup(t);
  await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
  const sourceHead = (await fixture.runGit(["rev-parse", "HEAD"])).stdout.trim();
  const planned = await blueprintPrBranchPreview({
    cwd: fixture.repoPath,
    baseRef: base,
    reviewBranch: "review/final-posture",
    blueprintPolicy: "exclude",
    evidencePaths: ["README.md"],
    stayOnReviewBranch: true
  });
  assert.equal(planned.status, "ready", planned.blockers.join("\n"));
  let injected = false;
  const restore = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
    const processResult = await fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
    if (!injected && processResult.exitCode === 0 && argv[0] === "rev-parse" && argv.at(-1) === "refs/heads/review/final-posture") {
      injected = true;
      const switched = await fixture.runner("git", ["switch", "--", "feature/source"], fixture.repoPath, fixture.env);
      assert.equal(switched.exitCode, 0, switched.stderr);
    }
    return processResult;
  });
  t.after(restore);
  const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
  assert.equal(result.status, "partial");
  assert.equal(result.review.disposition, "partial");
  assert.equal(result.validation.currentBranch, "feature/source");
  assert.equal(result.validation.currentHead, sourceHead);
  assert.match(result.blockers.join("\n"), /Final checkout posture mismatch.*review\/final-posture.*observed feature\/source/i);
  const report = await readFile(path.join(fixture.repoPath, ".blueprint/reports/pr-branch-latest.md"), "utf8");
  assert.match(report, /Current branch after run: feature\/source/);
  assert.match(report, new RegExp(`Current HEAD after run: ${sourceHead}`));
  assert.ok(report.includes(result.blockers.at(-1)!));
});

test("pr-branch detects real post-checkout hook dirt created while restoring the source branch", async (t) => {
  const { fixture, base } = await setup(t);
  await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
  const planned = await preview(fixture, base, "review/post-checkout-hook");
  assert.equal(planned.status, "ready", planned.blockers.join("\n"));
  const hookPath = path.join(fixture.repoPath, ".git/hooks/post-checkout");
  await mkdir(path.dirname(hookPath), { recursive: true });
  await writeFile(hookPath, `#!/bin/sh
branch=$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)
if [ "$branch" = "feature/source" ]; then
  printf 'hook dirt\\n' > hook-dirt.txt
fi
`, "utf8");
  await chmod(hookPath, 0o755);
  const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
  assert.equal(result.status, "partial");
  assert.equal(result.review.disposition, "partial");
  assert.equal(result.validation.clean, true);
  assert.equal(result.validation.finalClean, false);
  assert.equal(result.validation.currentBranch, "feature/source");
  assert.match(result.blockers.join("\n"), /Final checkout is not clean/i);
  const finalStatus = result.processes.find((entry) => entry.stage === "validate-final-status");
  assert.equal(finalStatus?.result.exitCode, 0);
  assert.match(finalStatus?.result.stdout ?? "", /\?\? hook-dirt\.txt/);
  const report = await readFile(path.join(fixture.repoPath, ".blueprint/reports/pr-branch-latest.md"), "utf8");
  assert.match(report, /Clean review branch status: clean/);
  assert.match(report, /Clean final checkout status: dirty/);
  assert.match(report, /"stage":"validate-final-status"/);
  assert.match(report, /hook-dirt\.txt\\u0000/);
});

test("pr-branch detects final status drift while staying on the review branch", async (t) => {
  const { fixture, base } = await setup(t);
  await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
  const planned = await blueprintPrBranchPreview({
    cwd: fixture.repoPath,
    baseRef: base,
    reviewBranch: "review/final-status-drift",
    blueprintPolicy: "exclude",
    evidencePaths: ["README.md"],
    stayOnReviewBranch: true
  });
  assert.equal(planned.status, "ready", planned.blockers.join("\n"));
  let sawFinalBranch = false;
  let injected = false;
  const restore = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
    const processResult = await fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
    if (!injected && argv[0] === "symbolic-ref" && processResult.stdout.trim() === "review/final-status-drift") {
      sawFinalBranch = true;
    } else if (!injected && sawFinalBranch && argv[0] === "rev-parse" && argv.at(-1) === "HEAD") {
      injected = true;
      await writeFile(path.join(fixture.repoPath, "stay-review-dirt.txt"), "external dirt\n", "utf8");
    }
    return processResult;
  });
  t.after(restore);
  const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
  assert.equal(result.status, "partial");
  assert.equal(result.validation.clean, true);
  assert.equal(result.validation.finalClean, false);
  assert.equal(result.validation.currentBranch, "review/final-status-drift");
  assert.equal(result.validation.currentHead, result.review.oid);
  assert.match(result.blockers.join("\n"), /Final checkout is not clean/i);
});

test("pr-branch detects an exit-zero replay amended to a forged commit message", async (t) => {
  const { fixture, base } = await setup(t);
  const sourceCommit = await commitPaths(fixture, { "one.txt": "one\n" }, "feat: approved source message");
  const planned = await preview(fixture, base, "review/forged-message");
  assert.equal(planned.status, "ready", planned.blockers.join("\n"));
  let injected = false;
  const restore = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
    const processResult = await fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
    if (!injected && processResult.exitCode === 0 && argv[0] === "cherry-pick") {
      injected = true;
      const amended = await fixture.runner("git", ["commit", "--amend", "-m", "forged review message"], fixture.repoPath, fixture.env);
      assert.equal(amended.exitCode, 0, amended.stderr);
    }
    return processResult;
  });
  t.after(restore);
  const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
  assert.equal(result.status, "partial");
  assert.equal(result.review.disposition, "partial");
  assert.equal(result.mapping[0]?.sourceCommit, sourceCommit);
  assert.equal(result.mapping[0]?.outcome, "failed");
  assert.equal(result.mapping[0]?.verification, "mismatch");
  assert.equal(result.mapping[0]?.observedSubject, "forged review message");
  assert.match(result.blockers.join("\n"), /Replay verification mismatch.*message=mismatch/i);
  const report = await readFile(path.join(fixture.repoPath, ".blueprint/reports/pr-branch-latest.md"), "utf8");
  assert.match(report, /feat: approved source message.*forged review message.*mismatch/);
});

test("pr-branch rejects exit-zero no-op replay and failed validation reads without false success", async (t) => {
  await t.test("cherry-pick exit zero without HEAD advance", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
    const planned = await preview(fixture, base, "review/noop-replay");
    const restore = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
      if (argv[0] === "cherry-pick") return { exitCode: 0, stdout: "simulated no-op\n", stderr: "", signal: null, timedOut: false };
      return fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
    });
    t.after(restore);
    const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
    assert.equal(result.status, "outcome-unknown");
    assert.notEqual(result.review.disposition, "complete");
    assert.match(result.blockers.join("\n"), /without a verifiable HEAD advance/i);
  });
  await t.test("validation diff exits 2", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
    const planned = await preview(fixture, base, "review/validation-fail");
    const restore = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
      if (argv[0] === "diff" && argv[1] === "--name-only" && argv.some((arg) => arg.endsWith("..review/validation-fail"))) return processFailure(2, "simulated validation read failure");
      return fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
    });
    t.after(restore);
    const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
    assert.equal(result.status, "outcome-unknown");
    assert.notEqual(result.review.disposition, "complete");
    assert.match(result.blockers.join("\n"), /path validation failed/i);
  });
});

test("pr-branch create, apply, commit, and restore failures remain distinguishable and truthful", async (t) => {
  await t.test("create failure", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
    const planned = await preview(fixture, base, "review/create-fail");
    const restore = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) =>
      argv[0] === "switch" && argv[1] === "-c" ? processFailure(42, "create failed") : fixture.runner(command, argv, cwd, { ...env, ...fixture.env })
    );
    t.after(restore);
    const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
    assert.equal(result.status, "failed");
    assert.equal(result.review.disposition, "absent");
    await assertReportMatchesReceipt(fixture, result);
  });
  await t.test("mixed apply failure", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n", ".blueprint/STATE.md": "mixed\n" }, "feat: mixed");
    const planned = await preview(fixture, base, "review/apply-fail");
    const restore = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) =>
      argv[0] === "apply" ? processFailure(42, "apply failed") : fixture.runner(command, argv, cwd, { ...env, ...fixture.env })
    );
    t.after(restore);
    const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
    assert.equal(result.status, "partial");
    assert.match(result.blockers.join("\n"), /Replay failed/i);
    await assertReportMatchesReceipt(fixture, result);
  });
  await t.test("mixed filter-diff failure", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n", ".blueprint/STATE.md": "mixed\n" }, "feat: mixed");
    const planned = await preview(fixture, base, "review/filter-diff-fail");
    const restore = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) =>
      argv[0] === "diff" && argv[1] === "--binary" ? processFailure(42, "filter diff failed") : fixture.runner(command, argv, cwd, { ...env, ...fixture.env })
    );
    t.after(restore);
    const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
    assert.equal(result.status, "partial");
    assert.match(result.blockers.join("\n"), /patch construction failed/i);
    await assertReportMatchesReceipt(fixture, result);
  });
  await t.test("mixed commit failure", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n", ".blueprint/STATE.md": "mixed\n" }, "feat: mixed");
    const planned = await preview(fixture, base, "review/commit-fail");
    const restore = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) =>
      argv[0] === "commit" && argv.includes("-C") ? processFailure(42, "commit failed") : fixture.runner(command, argv, cwd, { ...env, ...fixture.env })
    );
    t.after(restore);
    const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
    assert.equal(result.status, "partial");
    assert.equal(result.validation.clean, false);
    assert.match(result.blockers.join("\n"), /commit creation failed/i);
    await assertReportMatchesReceipt(fixture, result);
  });
  await t.test("restore failure", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
    const planned = await preview(fixture, base, "review/restore-fail");
    const restore = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) =>
      argv[0] === "switch" && argv[1] === "--" && argv[2] === "feature/source" ? processFailure(42, "restore failed") : fixture.runner(command, argv, cwd, { ...env, ...fixture.env })
    );
    t.after(restore);
    const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
    assert.equal(result.status, "partial");
    assert.equal(result.source.restored, false);
    assert.match(result.blockers.join("\n"), /did not restore the exact approved source/i);
    await assertReportMatchesReceipt(fixture, result);
  });
  await t.test("real first code-only cherry-pick conflict after external review-branch drift", async (t) => {
    const { fixture, base } = await setup(t);
    await writeFile(path.join(fixture.repoPath, "README.md"), "source version\n", "utf8");
    assert.equal((await fixture.runGit(["add", "README.md"])).exitCode, 0);
    assert.equal((await fixture.runGit(["commit", "-m", "feat: source readme"])).exitCode, 0);
    const planned = await preview(fixture, base, "review/first-conflict");
    let created = false;
    let injected = false;
    const restore = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
      const processResult = await fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
      if (processResult.exitCode === 0 && argv[0] === "switch" && argv[1] === "-c") created = true;
      if (!injected && created && processResult.exitCode === 0 && argv[0] === "rev-parse" && argv.at(-1) === "HEAD") {
        injected = true;
        await writeFile(path.join(fixture.repoPath, "README.md"), "external review version\n", "utf8");
        await fixture.runner("git", ["add", "README.md"], fixture.repoPath, fixture.env);
        await fixture.runner("git", ["commit", "-m", "test: external review drift"], fixture.repoPath, fixture.env);
      }
      return processResult;
    });
    t.after(restore);
    const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
    assert.equal(result.status, "partial");
    assert.match(result.blockers.join("\n"), /Replay failed/i);
    assert.ok(result.processes.some((entry) => entry.stage === "abort-cherry-pick"));
    await assertReportMatchesReceipt(fixture, result);
  });
});

test("pr-branch persists the same finalized recovery posture returned after replay exit 42", async (t) => {
  const { fixture, base } = await setup(t);
  await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
  const planned = await preview(fixture, base, "review/replay-42");
  const renderedReports: string[] = [];
  const restoreWriter = prBranchToolTestHooks.setReportWriterForTest(async (args) => {
    renderedReports.push(args.content ?? "");
    return blueprintArtifactReportWrite(args);
  });
  t.after(restoreWriter);
  const restore = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) =>
    argv[0] === "cherry-pick" ? processFailure(42, "replay failed") : fixture.runner(command, argv, cwd, { ...env, ...fixture.env })
  );
  t.after(restore);
  const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
  assert.equal(result.status, "partial");
  const recovery = result.recoveryActions[0]!;
  assert.match(recovery, /Inspect review\/replay-42/);
  const report = await readFile(path.join(fixture.repoPath, ".blueprint/reports/pr-branch-latest.md"), "utf8");
  assert.match(renderedReports[0] ?? "", /preview-only pre-mutation intent/);
  assert.match(renderedReports[0] ?? "", /no execution process receipts exist yet/);
  assert.doesNotMatch(renderedReports[0] ?? "", /"exitCode":/);
  assert.ok(report.includes(recovery));
  assert.ok(report.includes(result.blockers[0]!));
  assert.match(report, /"stage":"replay:[0-9a-f]+"/);
  assert.match(report, /"argv":\["cherry-pick","[0-9a-f]+"\]/);
  assert.match(report, /"exitCode":42/);
  assert.match(report, /"stderr":\{"text":"replay failed","truncated":false/);
});

test("post-mutation report failure is partial and persistence recovery never re-enters git", async (t) => {
  const { fixture, base } = await setup(t);
  await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
  const planned = await preview(fixture, base, "review/recover-report");
  let writes = 0;
  let mutations = 0;
  const restoreRunner = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
    if (["switch", "cherry-pick", "commit", "restore"].includes(argv[0] ?? "")) mutations += 1;
    return fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
  });
  t.after(restoreRunner);
  const restoreWriter = prBranchToolTestHooks.setReportWriterForTest(async (args) => {
    writes += 1;
    if (writes === 2) throw new Error("simulated outcome report failure");
    return blueprintArtifactReportWrite(args);
  });
  t.after(restoreWriter);
  const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
  assert.equal(result.status, "partial");
  assert.equal(result.review.disposition, "complete");
  assert.equal(result.report.outcomeStatus, "failed");
  const beforeRecovery = mutations;
  const writesBeforeRecovery = writes;
  const releaseForeignLock = tryAcquireQualityShippingOperationLock("ship", planned.packet!.gitCommonDir);
  assert.ok(releaseForeignLock);
  const blocked = await blueprintPrBranchPersist({ operationId: planned.operationId!, fingerprint: planned.fingerprint! });
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.report.outcomeStatus, "failed");
  assert.match(blocked.blockers.join("\n"), /Another Quality Shipping operation.*terminal receipt was retained/i);
  assert.equal(writes, writesBeforeRecovery, "lock contention must not enter the recovery writer");
  releaseForeignLock();
  releaseForeignLock();
  const recovered = await blueprintPrBranchPersist({ operationId: planned.operationId!, fingerprint: planned.fingerprint! });
  assert.equal(recovered.status, "succeeded", recovered.report.error ?? "report recovery failed");
  assert.equal(recovered.report.outcomeStatus, "updated");
  assert.equal(writes, writesBeforeRecovery + 1);
  assert.equal(mutations, beforeRecovery);
  const refused = await blueprintPrBranchPersist({ operationId: planned.operationId!, fingerprint: planned.fingerprint! });
  assert.equal(refused.status, "blocked");
});

test("pr-branch preserves outcome-unknown through failed and successful report-only recovery without replay", async (t) => {
  const { fixture, base } = await setup(t);
  await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
  const planned = await preview(fixture, base, "review/unknown-report-recovery");
  let writes = 0;
  const processArgv: string[][] = [];
  const restoreRunner = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
    processArgv.push([...argv]);
    if (argv[0] === "cherry-pick") {
      return { exitCode: null, stdout: "", stderr: "replay outcome unknown", signal: null, timedOut: false };
    }
    return fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
  });
  t.after(restoreRunner);
  const restoreWriter = prBranchToolTestHooks.setReportWriterForTest(async (args) => {
    writes += 1;
    if (writes === 2 || writes === 3) throw new Error("simulated outcome report persistence failure");
    return blueprintArtifactReportWrite(args);
  });
  t.after(restoreWriter);

  const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
  assert.equal(result.status, "outcome-unknown");
  assert.equal(result.stage, "outcome-report");
  assert.equal(result.mutationStarted, true);
  assert.equal(result.report.outcomeStatus, "failed");
  const replayReceipts = result.processes.filter((entry) => entry.argv[0] === "cherry-pick");
  assert.equal(replayReceipts.length, 1);
  assert.equal(replayReceipts[0]?.result.exitCode, null);
  assert.match(result.recoveryActions.join("\n"), /Retry only blueprint_pr_branch_persist/);
  const processCountBeforeRecovery = processArgv.length;

  const failedRecovery = await blueprintPrBranchPersist({ operationId: planned.operationId!, fingerprint: planned.fingerprint! });
  assert.equal(failedRecovery.status, "outcome-unknown");
  assert.equal(failedRecovery.stage, "persistence-recovery");
  assert.equal(failedRecovery.report.outcomeStatus, "failed");
  assert.equal(writes, 3);
  assert.equal(processArgv.length, processCountBeforeRecovery, "persistence recovery must not invoke any git process");

  const recovered = await blueprintPrBranchPersist({ operationId: planned.operationId!, fingerprint: planned.fingerprint! });
  assert.equal(recovered.status, "outcome-unknown");
  assert.equal(recovered.stage, "persistence-recovery");
  assert.equal(recovered.report.outcomeStatus, "updated");
  assert.equal(recovered.report.error, null);
  assert.doesNotMatch(recovered.recoveryActions.join("\n"), /blueprint_pr_branch_persist/);
  assert.equal(writes, 4);
  assert.equal(processArgv.length, processCountBeforeRecovery, "successful persistence recovery must not replay git mutation");
  assert.equal(processArgv.filter((argv) => argv[0] === "cherry-pick").length, 1);
});

test("pr-branch completed, partial, and divergent reruns are explicit and never overwrite a branch", async (t) => {
  const { fixture, base } = await setup(t);
  await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
  const planned = await preview(fixture, base, "review/rerun");
  const completed = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
  assert.equal(completed.status, "succeeded", completed.blockers.join("\n"));
  const reviewOid = (await fixture.runGit(["rev-parse", "review/rerun"])).stdout.trim();
  const replayedApproval = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
  assert.equal(replayedApproval.status, "blocked");
  assert.equal(replayedApproval.mutationStarted, false);
  assert.match(replayedApproval.blockers.join("\n"), /one-shot/i);
  assert.equal((await fixture.runGit(["rev-parse", "review/rerun"])).stdout.trim(), reviewOid);
  const rerun = await blueprintPrBranchPreview({ cwd: fixture.repoPath, baseRef: base, reviewBranch: "review/rerun", blueprintPolicy: "exclude", evidencePaths: ["README.md"], overwriteReport: true });
  assert.equal(rerun.status, "already-complete");
  assert.equal((await fixture.runGit(["rev-parse", "review/rerun"])).stdout.trim(), reviewOid);
  const changedRequest = await blueprintPrBranchPreview({ cwd: fixture.repoPath, baseRef: base, reviewBranch: "review/rerun", blueprintPolicy: "include", evidencePaths: ["README.md"], overwriteReport: true });
  assert.notEqual(changedRequest.status, "already-complete");

  assert.equal((await fixture.runGit(["branch", "review/divergent", base])).exitCode, 0);
  const divergent = await preview(fixture, base, "review/divergent");
  assert.equal(divergent.status, "divergent");
  assert.equal((await fixture.runGit(["rev-parse", "review/divergent"])).stdout.trim(), base);
});

test("pr-branch approvals are canonical, expiring, one-shot, and lock-before-consume", async (t) => {
  await t.test("returned packet tamper cannot alter canonical execution", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
    const planned = await preview(fixture, base, "review/canonical");
    planned.packet!.reviewBranch = "review/tampered";
    const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
    assert.equal(result.status, "succeeded", result.blockers.join("\n"));
    assert.equal((await fixture.runGit(["show-ref", "--verify", "--quiet", "refs/heads/review/canonical"])).exitCode, 0);
    assert.notEqual((await fixture.runGit(["show-ref", "--verify", "--quiet", "refs/heads/review/tampered"])).exitCode, 0);
  });
  await t.test("TTL expiry", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
    let now = 1_000;
    const restoreRetention = prBranchToolTestHooks.setRetentionForTest({ now: () => now, approvalTtlMs: 5 });
    t.after(restoreRetention);
    const planned = await preview(fixture, base, "review/expired");
    now += 6;
    const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
    assert.equal(result.status, "blocked");
    assert.match(result.blockers.join("\n"), /missing or expired|expired/i);
  });
  await t.test("stored packet and exact argv corruption fail before report or process entry", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
    let processEntries = 0;
    let reportEntries = 0;
    const first = await preview(fixture, base, "review/corrupt-packet");
    const second = await preview(fixture, base, "review/corrupt-plan");
    const restoreRunner = prBranchToolTestHooks.setProcessRunnerForTest(async () => {
      processEntries += 1;
      throw new Error("process runner must not be entered for corrupted approvals");
    });
    const restoreWriter = prBranchToolTestHooks.setReportWriterForTest(async () => {
      reportEntries += 1;
      throw new Error("report writer must not be entered for corrupted approvals");
    });
    t.after(restoreRunner);
    t.after(restoreWriter);

    prBranchToolTestHooks.mutateApprovalForTest(first.operationId!, (packet) => {
      packet.reviewBranch = "review/internally-corrupted";
    });
    const corruptPacket = await blueprintPrBranchExecute({ operationId: first.operationId!, fingerprint: first.fingerprint!, confirmed: true });
    assert.equal(corruptPacket.status, "stale");
    assert.match(corruptPacket.blockers.join("\n"), /canonical bound fields/i);

    const rebound = prBranchToolTestHooks.mutateApprovalForTest(second.operationId!, (packet) => {
      packet.executionPlan[0]!.argv = ["switch", "-c", "review/forged", packet.baseOid];
    }, true);
    assert.match(rebound ?? "", /^[0-9a-f]{64}$/);
    const corruptPlan = await blueprintPrBranchExecute({ operationId: second.operationId!, fingerprint: rebound!, confirmed: true });
    assert.equal(corruptPlan.status, "stale");
    assert.match(corruptPlan.blockers.join("\n"), /canonical exact-argv plan/i);
    assert.equal(processEntries, 0);
    assert.equal(reportEntries, 0);
  });
  await t.test("bounded approval retention", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
    let now = 1_000;
    const restoreRetention = prBranchToolTestHooks.setRetentionForTest({ now: () => now++, maxApprovals: 1 });
    t.after(restoreRetention);
    const evicted = await preview(fixture, base, "review/evicted");
    const retained = await preview(fixture, base, "review/retained");
    assert.equal(retained.status, "ready");
    const result = await blueprintPrBranchExecute({ operationId: evicted.operationId!, fingerprint: evicted.fingerprint!, confirmed: true });
    assert.equal(result.status, "blocked");
    assert.match(result.blockers.join("\n"), /missing or expired/i);
  });
  await t.test("concurrent operation lock does not consume the second approval", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
    const first = await preview(fixture, base, "review/lock-a");
    const second = await preview(fixture, base, "review/lock-b");
    const entered = deferred();
    const releaseWrite = deferred();
    let writes = 0;
    const restoreWriter = prBranchToolTestHooks.setReportWriterForTest(async (args) => {
      writes += 1;
      if (writes === 1) { entered.resolve(); await releaseWrite.promise; }
      return blueprintArtifactReportWrite(args);
    });
    t.after(restoreWriter);
    const firstRun = blueprintPrBranchExecute({ operationId: first.operationId!, fingerprint: first.fingerprint!, confirmed: true });
    await entered.promise;
    let blocked: Awaited<ReturnType<typeof blueprintPrBranchExecute>>;
    try {
      blocked = await blueprintPrBranchExecute({ operationId: second.operationId!, fingerprint: second.fingerprint!, confirmed: true });
    } finally {
      releaseWrite.resolve();
    }
    assert.equal(blocked.status, "blocked");
    assert.match(blocked.blockers.join("\n"), /is active/i);
    const completed = await firstRun;
    assert.equal(completed.status, "succeeded", completed.blockers.join("\n"));
    const retry = await blueprintPrBranchExecute({ operationId: second.operationId!, fingerprint: second.fingerprint!, confirmed: true });
    assert.equal(retry.status, "stale");
    assert.doesNotMatch(retry.blockers.join("\n"), /one-shot/i);
  });
});

test("pr-branch local branch inspection distinguishes authoritative absence from inspection failure", async (t) => {
  for (const [label, failure] of refInspectionFailures) {
    await t.test(`preview fails closed on ${label}`, async (t) => {
      const { fixture, base } = await setup(t);
      await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
      const branch = `review/preview-${label.replaceAll(" ", "-")}`;
      const restore = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) =>
        isLocalBranchProbe(argv, branch) ? { ...failure } : fixture.runner(command, argv, cwd, { ...env, ...fixture.env })
      );
      t.after(restore);
      const result = await preview(fixture, base, branch);
      assert.equal(result.status, "invalid");
      assert.equal(result.operationId, null);
      assert.match(result.blockers.join("\n"), /Local branch inspection failed/i);
    });
  }
  await t.test("exit 1 is authoritative absent", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
    const branch = "review/authoritative-absent";
    const restore = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) =>
      isLocalBranchProbe(argv, branch) ? processFailure(1, "") : fixture.runner(command, argv, cwd, { ...env, ...fixture.env })
    );
    t.after(restore);
    const result = await preview(fixture, base, branch);
    assert.equal(result.status, "ready", result.blockers.join("\n"));
  });
  await t.test("exit 0 is authoritative exists", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
    const branch = "review/authoritative-exists";
    const restore = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) =>
      isLocalBranchProbe(argv, branch)
        ? { exitCode: 0, stdout: "", stderr: "", signal: null, timedOut: false }
        : fixture.runner(command, argv, cwd, { ...env, ...fixture.env })
    );
    t.after(restore);
    const result = await preview(fixture, base, branch);
    assert.equal(result.status, "divergent");
    assert.match(result.blockers.join("\n"), /already exists/i);
  });
});

test("pr-branch execute freshness fails closed on local branch inspection uncertainty", async (t) => {
  for (const [label, failure] of refInspectionFailures) {
    await t.test(`pre-report freshness blocks on ${label}`, async (t) => {
      const { fixture, base } = await setup(t);
      await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
      const branch = `review/execute-${label.replaceAll(" ", "-")}`;
      const planned = await preview(fixture, base, branch);
      assert.equal(planned.status, "ready", planned.blockers.join("\n"));
      const restore = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) =>
        isLocalBranchProbe(argv, branch) ? { ...failure } : fixture.runner(command, argv, cwd, { ...env, ...fixture.env })
      );
      t.after(restore);
      const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
      assert.equal(result.status, "failed");
      assert.equal(result.stage, "revalidate");
      assert.equal(result.mutationStarted, false);
      assert.equal(result.report.preMutationStatus, "not-attempted");
      assert.match(result.blockers.join("\n"), /Pre-mutation revalidation failed closed.*Local branch inspection failed/i);
      assert.notEqual((await fixture.runGit(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`])).exitCode, 0);
    });
  }
  await t.test("post-report freshness blocks before mutation", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
    const branch = "review/post-report-ref-inspection";
    const planned = await preview(fixture, base, branch);
    let probes = 0;
    const restore = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
      if (isLocalBranchProbe(argv, branch)) {
        probes += 1;
        return probes === 1 ? processFailure(1, "") : processFailure(2, "post-report show-ref failed");
      }
      return fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
    });
    t.after(restore);
    const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
    assert.equal(result.status, "failed");
    assert.equal(result.stage, "revalidate");
    assert.equal(result.mutationStarted, false);
    assert.notEqual(result.report.preMutationStatus, "not-attempted");
    assert.equal(result.report.outcomeStatus, "not-attempted");
    assert.match(result.blockers.join("\n"), /Post-report pre-mutation revalidation failed closed.*Local branch inspection failed/i);
    assert.notEqual((await fixture.runGit(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`])).exitCode, 0);
  });
  await t.test("authoritative exit 1 remains executable", async (t) => {
    const { fixture, base } = await setup(t);
    await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
    const branch = "review/execute-authoritative-absent";
    const planned = await preview(fixture, base, branch);
    const restore = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) =>
      isLocalBranchProbe(argv, branch) ? processFailure(1, "") : fixture.runner(command, argv, cwd, { ...env, ...fixture.env })
    );
    t.after(restore);
    const result = await blueprintPrBranchExecute({ operationId: planned.operationId!, fingerprint: planned.fingerprint!, confirmed: true });
    assert.equal(result.status, "succeeded", result.blockers.join("\n"));
  });
});

test("pr-branch fails closed when symbolic base classification cannot be inspected", async (t) => {
  const { fixture, base } = await setup(t);
  await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
  assert.equal((await fixture.runGit(["update-ref", "refs/remotes/origin/main", base])).exitCode, 0);
  const restore = prBranchToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) =>
    argv[0] === "rev-parse" && argv[1] === "--symbolic-full-name" && argv.at(-1) === "origin/main"
      ? processFailure(2, "symbolic classification failed")
      : fixture.runner(command, argv, cwd, { ...env, ...fixture.env })
  );
  t.after(restore);
  const result = await preview(fixture, "origin/main", "review/symbolic-base-failure");
  assert.equal(result.status, "invalid");
  assert.match(result.blockers.join("\n"), /Base ref symbolic classification failed.*exit=2/i);
  assert.doesNotMatch(result.blockers.join("\n"), /Remote-tracking base refs are unsupported/i);
});

test("pr-branch rejects remote-tracking base authority instead of omitting remote identity from approval", async (t) => {
  const { fixture, base } = await setup(t);
  await commitPaths(fixture, { "one.txt": "one\n" }, "feat: one");
  assert.equal((await fixture.runGit(["update-ref", "refs/remotes/origin/main", base])).exitCode, 0);
  const result = await preview(fixture, "origin/main", "review/remote-base");
  assert.equal(result.status, "blocked");
  assert.match(result.blockers.join("\n"), /Remote-tracking base refs are unsupported/i);
});

test("pr-branch tools are registered as preview, one-shot executor, and persistence-only recovery", () => {
  assert.deepEqual(prBranchToolDefinitions.map((entry) => entry.name), [
    "blueprint_pr_branch_preview",
    "blueprint_pr_branch_execute",
    "blueprint_pr_branch_persist"
  ]);
});
