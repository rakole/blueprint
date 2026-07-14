import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import type { QualityShippingProcessRunner } from "../src/mcp/quality-shipping-safety.js";
import { shouldLogMutationFailure } from "../src/mcp/mutation-failure-logging.js";
import { createToolResponseContent } from "../src/mcp/public-response.js";
import { sanitizeToolResultForPublicResponse } from "../src/mcp/response-sanitizer.js";
import { createBlueprintServer } from "../src/mcp/server-runtime.js";
import { blueprintArtifactReportWrite } from "../src/mcp/tools/artifacts.js";
import {
  blueprintUndoExecute,
  blueprintUndoPersist,
  blueprintUndoPreview as rawBlueprintUndoPreview,
  type UndoPreviewArgs,
  undoToolTestHooks
} from "../src/mcp/tools/undo.js";
import { createQualityShippingGitFixture } from "./helpers/quality-shipping-git-fixture.js";

function blueprintUndoPreview(
  args: Omit<UndoPreviewArgs, "evidencePaths"> & { evidencePaths?: string[] }
) {
  return rawBlueprintUndoPreview({
    ...args,
    evidencePaths: args.evidencePaths ?? ["README.md"]
  });
}

function isolatedRunner(
  fixture: Awaited<ReturnType<typeof createQualityShippingGitFixture>>,
  events?: string[]
): QualityShippingProcessRunner {
  return async (command, argv, cwd, env) => {
    if (argv[0] === "revert") events?.push(`git:${argv.join(" ")}`);
    return fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
  };
}

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

async function setupTarget(
  t: TestContext,
  name = "feature.txt",
  content = "feature\n",
  message = "feat: target change"
) {
  const fixture = await createQualityShippingGitFixture();
  t.after(async () => fixture.cleanup());
  undoToolTestHooks.clearApprovalsForTest();
  const restoreRunner = undoToolTestHooks.setProcessRunnerForTest(isolatedRunner(fixture));
  t.after(restoreRunner);
  const target = await fixture.commitFile(name, content, message);
  return { fixture, target };
}

test("undo preview is non-mutating, stable, path-safe, and derives only literal revert argv", async (t) => {
  const { fixture, target } = await setupTarget(t);
  const headBefore = (await fixture.runGit(["rev-parse", "HEAD"])).stdout.trim();
  const first = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: target }],
    reason: "Certify the exact target",
    evidencePaths: ["README.md"]
  });
  const second = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: target }],
    reason: "Certify the exact target",
    evidencePaths: ["README.md"]
  });

  assert.equal(first.status, "ready");
  assert.equal(second.status, "ready");
  assert.equal(first.fingerprint, second.fingerprint);
  assert.notEqual(first.operationId, second.operationId);
  assert.equal(first.packet?.repoRoot, await realpath(fixture.repoPath));
  assert.deepEqual(first.packet?.candidates[0]?.argv, ["revert", "--no-edit", target]);
  assert.match(first.packet?.candidates[0]?.sha ?? "", /^[0-9a-f]{40}$/);
  assert.match(first.packet?.gitConfigSha256 ?? "", /^[0-9a-f]{64}$/);
  assert.equal(first.packet?.report.priorExists, false);
  assert.equal(first.packet?.report.priorContentSha256, null);
  assert.equal(first.waitingState, "undo-confirmation");
  assert.equal((await fixture.runGit(["rev-parse", "HEAD"])).stdout.trim(), headBefore);
  assert.equal((await fixture.runGit(["status", "--porcelain=v1"])).stdout, "");
});

test("undo preview requires at least one authoritative evidence input", async (t) => {
  const { fixture, target } = await setupTarget(t);
  const result = await rawBlueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: target }],
    reason: "missing evidence",
    evidencePaths: []
  });
  assert.equal(result.status, "blocked");
  assert.match(result.blockers.join("\n"), /requires at least one authoritative evidence/i);
});

test("undo preview hard-stops dirt, detached HEAD, sequencer state, malformed targets, and non-ancestors", async (t) => {
  await t.test("unstaged dirt", async (t) => {
    const { fixture, target } = await setupTarget(t);
    await writeFile(path.join(fixture.repoPath, "feature.txt"), "dirty\n", "utf8");
    const result = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "test" });
    assert.equal(result.status, "blocked");
    assert.match(result.blockers.join("\n"), /working tree must be clean/i);
  });

  await t.test("staged dirt", async (t) => {
    const { fixture, target } = await setupTarget(t);
    await writeFile(path.join(fixture.repoPath, "staged.txt"), "staged\n", "utf8");
    await fixture.runGit(["add", "staged.txt"]);
    const result = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "test" });
    assert.equal(result.status, "blocked");
    assert.match(result.blockers.join("\n"), /working tree must be clean/i);
  });

  await t.test("untracked dirt", async (t) => {
    const { fixture, target } = await setupTarget(t);
    await writeFile(path.join(fixture.repoPath, "untracked.txt"), "untracked\n", "utf8");
    const result = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "test" });
    assert.equal(result.status, "blocked");
    assert.match(result.blockers.join("\n"), /working tree must be clean/i);
  });

  await t.test("detached HEAD", async (t) => {
    const { fixture, target } = await setupTarget(t);
    await fixture.runGit(["checkout", "--detach", target]);
    const result = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "test" });
    assert.equal(result.status, "blocked");
    assert.match(result.blockers.join("\n"), /detached HEAD/i);
  });

  await t.test("revert state", async (t) => {
    const { fixture, target } = await setupTarget(t);
    const markerResult = await fixture.runGit(["rev-parse", "--git-path", "REVERT_HEAD"]);
    const markerValue = markerResult.stdout.trim();
    const marker = path.isAbsolute(markerValue)
      ? markerValue
      : path.join(fixture.repoPath, markerValue);
    await mkdir(path.dirname(marker), { recursive: true });
    await writeFile(marker, `${target}\n`, "utf8");
    const result = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "test" });
    assert.equal(result.status, "blocked");
    assert.match(result.blockers.join("\n"), /operation already in progress: revert/i);
  });

  await t.test("malformed and option-shaped target", async (t) => {
    const { fixture } = await setupTarget(t);
    for (const target of ["HEAD~1", "--all", "abc123"]) {
      const result = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "test" });
      assert.equal(result.status, "blocked");
      assert.match(result.blockers.join("\n"), /canonical full commit hash/i);
    }
  });

  await t.test("non-ancestor target", async (t) => {
    const { fixture } = await setupTarget(t);
    await fixture.runGit(["checkout", "-b", "side"]);
    const sideTarget = await fixture.commitFile("side.txt", "side\n", "feat: side target");
    await fixture.runGit(["checkout", "main"]);
    await fixture.commitFile("main.txt", "main\n", "feat: main head");
    const result = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: sideTarget }], reason: "test" });
    assert.equal(result.status, "blocked");
    assert.match(result.blockers.join("\n"), /not an ancestor/i);
  });
});

test("undo preview requires merge mainline and rejects duplicate targets", async (t) => {
  const { fixture } = await setupTarget(t);
  await fixture.runGit(["checkout", "-b", "feature"]);
  await fixture.commitFile("feature-branch.txt", "feature\n", "feat: branch");
  await fixture.runGit(["checkout", "main"]);
  await fixture.commitFile("main-branch.txt", "main\n", "feat: main");
  await fixture.runGit(["merge", "--no-ff", "feature", "-m", "merge feature"]);
  const mergeSha = (await fixture.runGit(["rev-parse", "HEAD"])).stdout.trim();

  const missingMainline = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: mergeSha }],
    reason: "test merge"
  });
  assert.equal(missingMainline.status, "blocked");
  assert.match(missingMainline.blockers.join("\n"), /requires an explicit mainline/i);

  const validMainline = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: mergeSha, mainline: 1 }],
    reason: "test explicit merge mainline"
  });
  assert.equal(validMainline.status, "ready", validMainline.blockers.join("\n"));
  assert.deepEqual(validMainline.packet?.candidates[0]?.argv, [
    "revert",
    "--no-edit",
    "-m",
    "1",
    mergeSha
  ]);
  assert.deepEqual(validMainline.packet?.candidates[0]?.changedPaths, ["feature-branch.txt"]);

  const duplicate = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: mergeSha, mainline: 1 }, { sha: mergeSha, mainline: 1 }],
    reason: "test duplicate"
  });
  assert.equal(duplicate.status, "blocked");
  assert.match(duplicate.blockers.join("\n"), /duplicate undo target/i);

  const executed = await blueprintUndoExecute({
    operationId: validMainline.operationId!,
    fingerprint: validMainline.fingerprint!,
    confirmed: true
  });
  assert.equal(executed.status, "succeeded", executed.blockers.join("\n"));
  assert.equal((await fixture.runGit(["cat-file", "-e", "HEAD:feature-branch.txt"])).exitCode, 128);
});

test("undo preview blocks every supported in-progress git marker", async (t) => {
  const markers = [
    { label: "merge", path: "MERGE_HEAD", directory: false },
    { label: "rebase", path: "rebase-merge", directory: true },
    { label: "rebase", path: "rebase-apply", directory: true },
    { label: "cherry-pick", path: "CHERRY_PICK_HEAD", directory: false },
    { label: "revert", path: "REVERT_HEAD", directory: false },
    { label: "sequencer", path: "sequencer", directory: true }
  ] as const;

  for (const marker of markers) {
    await t.test(marker.path, async (t) => {
      const { fixture, target } = await setupTarget(t);
      const markerValue = (await fixture.runGit(["rev-parse", "--git-path", marker.path])).stdout.trim();
      const markerPath = path.isAbsolute(markerValue)
        ? markerValue
        : path.join(fixture.repoPath, markerValue);
      if (marker.directory) {
        await mkdir(markerPath, { recursive: true });
      } else {
        await mkdir(path.dirname(markerPath), { recursive: true });
        await writeFile(markerPath, `${target}\n`, "utf8");
      }
      const result = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: marker.label });
      assert.equal(result.status, "blocked");
      assert.match(result.blockers.join("\n"), new RegExp(marker.label));
    });
  }
});

test("undo preview blocks root, nonexistent, invalid-mainline, and incomparable targets", async (t) => {
  await t.test("root and nonexistent", async (t) => {
    const { fixture } = await setupTarget(t);
    const root = (await fixture.runGit(["rev-list", "--max-parents=0", "HEAD"])).stdout.trim().split(/\r?\n/)[0]!;
    const rootResult = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: root }], reason: "root" });
    assert.equal(rootResult.status, "blocked");
    assert.match(rootResult.blockers.join("\n"), /Root commits are not supported/i);
    const missingResult = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: "a".repeat(40) }], reason: "missing" });
    assert.equal(missingResult.status, "blocked");
    assert.match(missingResult.blockers.join("\n"), /does not resolve exactly/i);
  });

  await t.test("invalid mainline and incomparable", async (t) => {
    const { fixture } = await setupTarget(t);
    await fixture.runGit(["checkout", "-b", "left"]);
    const left = await fixture.commitFile("left.txt", "left\n", "feat: left");
    await fixture.runGit(["checkout", "main"]);
    await fixture.runGit(["checkout", "-b", "right"]);
    const right = await fixture.commitFile("right.txt", "right\n", "feat: right");
    await fixture.runGit(["checkout", "main"]);
    await fixture.runGit(["merge", "--no-ff", "left", "-m", "merge left"]);
    await fixture.runGit(["merge", "--no-ff", "right", "-m", "merge right"]);
    const head = (await fixture.runGit(["rev-parse", "HEAD"])).stdout.trim();
    const invalidMainline = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: head, mainline: 3 }], reason: "bad mainline" });
    assert.equal(invalidMainline.status, "blocked");
    assert.match(invalidMainline.blockers.join("\n"), /Invalid mainline parent 3/i);
    const incomparable = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: left }, { sha: right }], reason: "incomparable" });
    assert.equal(incomparable.status, "blocked");
    assert.match(incomparable.blockers.join("\n"), /incomparable/i);
  });
});

test("undo execute revalidates freshness before report or git mutation", async (t) => {
  const { fixture, target } = await setupTarget(t);
  const preview = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: target }],
    reason: "stale approval test"
  });
  assert.equal(preview.status, "ready");
  await fixture.commitFile("drift.txt", "drift\n", "test: advance head");

  const result = await blueprintUndoExecute({
    operationId: preview.operationId!,
    fingerprint: preview.fingerprint!,
    confirmed: true
  });
  assert.equal(result.status, "stale");
  assert.equal(result.mutationStarted, false);
  assert.equal(result.report.preMutationStatus, "not-attempted");
  assert.match(result.blockers.join("\n"), /HEAD changed after approval/i);
});

test("undo execute fails closed on evidence drift and fingerprint replay", async (t) => {
  await t.test("evidence drift", async (t) => {
    const { fixture, target } = await setupTarget(t);
    const preview = await blueprintUndoPreview({
      cwd: fixture.repoPath,
      targets: [{ sha: target }],
      reason: "evidence freshness",
      evidencePaths: ["README.md"]
    });
    await writeFile(path.join(fixture.repoPath, "README.md"), "# Drifted evidence\n", "utf8");
    const result = await blueprintUndoExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(result.status, "stale");
    assert.equal(result.mutationStarted, false);
    assert.match(result.blockers.join("\n"), /working tree changed|evidence inputs changed/i);
  });

  await t.test("fingerprint mismatch consumes the one-shot approval", async (t) => {
    const { fixture, target } = await setupTarget(t);
    const preview = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "fingerprint" });
    const mismatch = await blueprintUndoExecute({ operationId: preview.operationId!, fingerprint: "0".repeat(64), confirmed: true });
    assert.equal(mismatch.status, "stale");
    assert.equal(mismatch.mutationStarted, false);
    const retry = await blueprintUndoExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(retry.status, "stale");
    assert.match(retry.blockers.join("\n"), /one-shot/i);
  });

  await t.test("returned packet tamper is detected", async (t) => {
    const { fixture, target } = await setupTarget(t);
    const preview = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "packet tamper" });
    preview.packet!.candidates[0]!.argv = ["revert", "--no-edit", "b".repeat(40)];
    const result = await blueprintUndoExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(result.status, "stale");
    assert.equal(result.mutationStarted, false);
    assert.match(result.blockers.join("\n"), /canonical packet/i);
  });
});

test("undo rejects evidence symlink aliases and same-byte identity drift without running revert", async (t) => {
  await t.test("a regular approved file replaced by a same-byte symlink is stale", async (t) => {
    const { fixture, target } = await setupTarget(t);
    const evidenceDir = path.join(fixture.repoPath, ".blueprint/reports");
    const evidencePath = path.join(evidenceDir, "authority.md");
    await mkdir(evidenceDir, { recursive: true });
    await writeFile(evidencePath, "same authoritative bytes\n", "utf8");
    await writeFile(path.join(evidenceDir, "authority-a.md"), "same authoritative bytes\n", "utf8");
    await writeFile(path.join(evidenceDir, "authority-b.md"), "same authoritative bytes\n", "utf8");

    let revertCalls = 0;
    const restoreRunner = undoToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
      if (argv[0] === "revert") revertCalls += 1;
      return fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
    });
    t.after(restoreRunner);

    const preview = await blueprintUndoPreview({
      cwd: fixture.repoPath,
      targets: [{ sha: target }],
      reason: "bind canonical evidence identity",
      evidencePaths: [".blueprint/reports/authority.md"]
    });
    assert.equal(preview.status, "ready", preview.blockers.join("\n"));

    await rm(evidencePath);
    await symlink("authority-b.md", evidencePath);
    const result = await blueprintUndoExecute({
      operationId: preview.operationId!,
      fingerprint: preview.fingerprint!,
      confirmed: true
    });

    assert.equal(result.status, "stale");
    assert.equal(result.mutationStarted, false);
    assert.equal(result.processes.length, 0);
    assert.equal(revertCalls, 0);
    assert.match(result.blockers.join("\n"), /symlink|canonical evidence/i);
  });

  await t.test("direct same-byte symlinks remain invalid when retargeted", async (t) => {
    const { fixture, target } = await setupTarget(t);
    const evidenceDir = path.join(fixture.repoPath, ".blueprint/reports");
    const evidencePath = path.join(evidenceDir, "authority.md");
    await mkdir(evidenceDir, { recursive: true });
    await writeFile(path.join(evidenceDir, "authority-a.md"), "same authoritative bytes\n", "utf8");
    await writeFile(path.join(evidenceDir, "authority-b.md"), "same authoritative bytes\n", "utf8");
    await symlink("authority-a.md", evidencePath);

    const first = await blueprintUndoPreview({
      cwd: fixture.repoPath,
      targets: [{ sha: target }],
      reason: "reject direct evidence symlink",
      evidencePaths: [".blueprint/reports/authority.md"]
    });
    assert.equal(first.status, "blocked");
    assert.equal(first.operationId, null);
    assert.match(first.blockers.join("\n"), /symlink|canonical evidence/i);

    await rm(evidencePath);
    await symlink("authority-b.md", evidencePath);
    const second = await blueprintUndoPreview({
      cwd: fixture.repoPath,
      targets: [{ sha: target }],
      reason: "reject retargeted evidence symlink",
      evidencePaths: [".blueprint/reports/authority.md"]
    });
    assert.equal(second.status, "blocked");
    assert.equal(second.operationId, null);
    assert.match(second.blockers.join("\n"), /symlink|canonical evidence/i);
  });

  await t.test("parent symlink aliases and escapes are rejected", async (t) => {
    const { fixture, target } = await setupTarget(t);
    const blueprintDir = path.join(fixture.repoPath, ".blueprint");
    const canonicalDir = path.join(blueprintDir, "canonical-evidence");
    const externalDir = path.join(fixture.root, "external-evidence");
    await mkdir(canonicalDir, { recursive: true });
    await mkdir(externalDir, { recursive: true });
    await writeFile(path.join(canonicalDir, "review.md"), "inside\n", "utf8");
    await writeFile(path.join(externalDir, "review.md"), "outside\n", "utf8");
    await symlink("canonical-evidence", path.join(blueprintDir, "inside-alias"));
    await symlink(externalDir, path.join(blueprintDir, "outside-alias"));

    const insideAlias = await blueprintUndoPreview({
      cwd: fixture.repoPath,
      targets: [{ sha: target }],
      reason: "reject parent alias",
      evidencePaths: [".blueprint/inside-alias/review.md"]
    });
    assert.equal(insideAlias.status, "blocked");
    assert.match(insideAlias.blockers.join("\n"), /symlink|non-canonical repository alias/i);

    const outsideAlias = await blueprintUndoPreview({
      cwd: fixture.repoPath,
      targets: [{ sha: target }],
      reason: "reject parent escape",
      evidencePaths: [".blueprint/outside-alias/review.md"]
    });
    assert.equal(outsideAlias.status, "blocked");
    assert.match(outsideAlias.blockers.join("\n"), /resolves outside the repository/i);

    const missingThroughAlias = await blueprintUndoPreview({
      cwd: fixture.repoPath,
      targets: [{ sha: target }],
      reason: "reject missing evidence through parent alias",
      evidencePaths: [".blueprint/inside-alias/missing.md"]
    });
    assert.equal(missingThroughAlias.status, "blocked");
    assert.match(missingThroughAlias.blockers.join("\n"), /parent symlink|non-canonical repository alias/i);
  });
});

test("undo approval binds branch, sequencer, effective config, and prior report CAS", async (t) => {
  await t.test("branch drift", async (t) => {
    const { fixture, target } = await setupTarget(t);
    const preview = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "branch drift" });
    await fixture.runGit(["switch", "-c", "other"]);
    const result = await blueprintUndoExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(result.status, "stale");
    assert.match(result.blockers.join("\n"), /Branch changed/i);
  });

  await t.test("sequencer drift", async (t) => {
    const { fixture, target } = await setupTarget(t);
    const preview = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "sequencer drift" });
    const markerValue = (await fixture.runGit(["rev-parse", "--git-path", "sequencer"])).stdout.trim();
    await mkdir(path.isAbsolute(markerValue) ? markerValue : path.join(fixture.repoPath, markerValue), { recursive: true });
    const result = await blueprintUndoExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(result.status, "stale");
    assert.match(result.blockers.join("\n"), /sequencer state changed/i);
  });

  await t.test("git config drift", async (t) => {
    const { fixture, target } = await setupTarget(t);
    const preview = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "config drift" });
    await fixture.runGit(["config", "revert.reference", "true"]);
    const result = await blueprintUndoExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(result.status, "stale");
    assert.match(result.blockers.join("\n"), /Effective git configuration changed/i);
  });

  await t.test("ignored report drift", async (t) => {
    const { fixture, target } = await setupTarget(t);
    const reportPath = path.join(fixture.repoPath, ".blueprint/reports/undo-latest.md");
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, "old report\n", "utf8");
    const preview = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "report drift", overwriteReport: true });
    await writeFile(reportPath, "newer report\n", "utf8");
    const result = await blueprintUndoExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(result.status, "stale");
    assert.equal(result.mutationStarted, false);
    assert.match(result.blockers.join("\n"), /undo-latest existence or content changed/i);
    assert.equal(await readFile(reportPath, "utf8"), "newer report\n");
  });
});

test("post-plan drift CAS-replaces the executable plan with a truthful stale terminal report", async (t) => {
  const { fixture, target } = await setupTarget(t);
  let writes = 0;
  let revertCalls = 0;
  const restoreRunner = undoToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
    if (argv[0] === "revert") revertCalls += 1;
    return fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
  });
  t.after(restoreRunner);
  const restoreWriter = undoToolTestHooks.setReportWriterForTest(async (args) => {
    const written = await blueprintArtifactReportWrite(args);
    writes += 1;
    if (writes === 1) {
      await fixture.runGit(["config", "revert.reference", "true"]);
    }
    return written;
  });
  t.after(restoreWriter);

  const preview = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: target }],
    reason: "post-plan config drift"
  });
  const result = await blueprintUndoExecute({
    operationId: preview.operationId!,
    fingerprint: preview.fingerprint!,
    confirmed: true
  });

  assert.equal(result.status, "stale");
  assert.equal(result.mutationStatus, "not-started");
  assert.equal(result.mutationStarted, false);
  assert.equal(result.report.outcomeStatus, "updated", result.report.error ?? "unknown report error");
  assert.equal(revertCalls, 0);
  assert.equal(writes, 2);
  const saved = await readFile(
    path.join(fixture.repoPath, ".blueprint/reports/undo-latest.md"),
    "utf8"
  );
  assert.match(saved, /\*\*Revert outcome:\*\* blocked/);
  assert.match(saved, /Repository changed after the pre-mutation report was persisted/);
  assert.match(saved, /Create a fresh undo preview/);
  assert.doesNotMatch(saved, /Run the approved one-shot undo execution/);
});

test("durable report ledger prevents rerun under config-dependent revert messages", async (t) => {
  const { fixture, target } = await setupTarget(t);
  await fixture.runGit(["config", "revert.reference", "true"]);
  const preview = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "config independent ledger" });
  const result = await blueprintUndoExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
  assert.equal(result.status, "succeeded", result.blockers.join("\n"));
  const commitBody = (await fixture.runGit(["show", "-s", "--format=%B", "HEAD"])).stdout;
  assert.doesNotMatch(commitBody, new RegExp(`This reverts commit ${target}\\.`));
  const fresh = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "must stay applied", overwriteReport: true });
  assert.equal(fresh.status, "already-applied");
  assert.match(fresh.blockers.join("\n"), /durable idempotency ledger/i);

  const reportPath = path.join(fixture.repoPath, ".blueprint/reports/undo-latest.md");
  await rm(reportPath);
  const afterDeletion = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: target }],
    reason: "report loss must not reopen mutation"
  });
  assert.equal(afterDeletion.status, "already-applied");
  assert.match(afterDeletion.blockers.join("\n"), /semantic inverse patch/i);

  await writeFile(reportPath, "corrupted report without a ledger\n", "utf8");
  const afterCorruption = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: target }],
    reason: "corrupt report must not reopen mutation",
    overwriteReport: true
  });
  assert.equal(afterCorruption.status, "already-applied");
  assert.match(afterCorruption.blockers.join("\n"), /semantic inverse patch/i);
});

test("different-line inverse-looking history is ambiguous rather than already-applied or ready", async (t) => {
  const fixture = await createQualityShippingGitFixture();
  t.after(async () => fixture.cleanup());
  undoToolTestHooks.clearApprovalsForTest();
  const restoreRunner = undoToolTestHooks.setProcessRunnerForTest(isolatedRunner(fixture));
  t.after(restoreRunner);

  await fixture.commitFile("f.txt", "A\nB\n", "test: establish two equal edit positions");
  const target = await fixture.commitFile(
    "f.txt",
    "B\nB\n",
    "feat: change the first line"
  );
  await fixture.commitFile(
    "f.txt",
    "B\nA\n",
    "test: apply the inverse text at the second line"
  );

  const result = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: target }],
    reason: "position-sensitive inverse correlation"
  });
  assert.equal(result.status, "blocked");
  assert.notEqual(result.status, "already-applied");
  assert.match(result.blockers.join("\n"), /inverse-looking descendant history/i);
  assert.match(result.blockers.join("\n"), /current paths do not prove/i);
  assert.equal(await readFile(path.join(fixture.repoPath, "f.txt"), "utf8"), "B\nA\n");
});

test("inverse-looking commits merged from a pre-target side branch are not target descendants", async (t) => {
  const fixture = await createQualityShippingGitFixture();
  t.after(async () => fixture.cleanup());
  undoToolTestHooks.clearApprovalsForTest();
  const restoreRunner = undoToolTestHooks.setProcessRunnerForTest(isolatedRunner(fixture));
  t.after(restoreRunner);

  const base = await fixture.commitFile("f.txt", "A\n", "test: establish branch base");
  const branchResult = await fixture.runGit(["branch", "side-history", base]);
  assert.equal(branchResult.exitCode, 0, branchResult.stderr);
  const target = await fixture.commitFile("f.txt", "B\n", "feat: main target change");

  const switchSide = await fixture.runGit(["switch", "side-history"]);
  assert.equal(switchSide.exitCode, 0, switchSide.stderr);
  await fixture.commitFile("f.txt", "B\n", "test: side branch matching change");
  const sideInverse = await fixture.commitFile(
    "f.txt",
    "A\n",
    "test: side branch inverse-looking change"
  );
  const switchMain = await fixture.runGit(["switch", "main"]);
  assert.equal(switchMain.exitCode, 0, switchMain.stderr);
  const merge = await fixture.runGit([
    "merge",
    "--no-ff",
    "side-history",
    "-m",
    "test: merge pre-target side history"
  ]);
  assert.equal(merge.exitCode, 0, merge.stderr || merge.stdout);
  const ancestry = await fixture.runGit([
    "merge-base",
    "--is-ancestor",
    target,
    sideInverse
  ]);
  assert.equal(ancestry.exitCode, 1);
  assert.equal(await readFile(path.join(fixture.repoPath, "f.txt"), "utf8"), "B\n");

  const result = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: target }],
    reason: "ignore non-descendant side history"
  });
  assert.equal(result.status, "ready", result.blockers.join("\n"));
  assert.notEqual(result.status, "already-applied");
});

test("undo preview hard-blocks candidate overlap with undo-latest", async (t) => {
  const { fixture } = await setupTarget(t);
  const relativeReport = ".blueprint/reports/undo-latest.md";
  const reportPath = path.join(fixture.repoPath, relativeReport);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, "tracked undo report\n", "utf8");
  await fixture.runGit(["add", "-f", "--", relativeReport]);
  await fixture.runGit(["commit", "-m", "test: track undo report"]);
  const target = (await fixture.runGit(["rev-parse", "HEAD"])).stdout.trim();
  const result = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: target }],
    reason: "report overlap",
    overwriteReport: true
  });
  assert.equal(result.status, "blocked");
  assert.match(result.blockers.join("\n"), /overlaps the candidate revert patch/i);
});

test("undo execute persists the plan before exact argv, persists outcome, and rejects reruns", async (t) => {
  const { fixture, target } = await setupTarget(t);
  const temporaryTreesBefore = new Set(
    (await readdir(os.tmpdir())).filter((entry) => entry.startsWith("blueprint-undo-tree-"))
  );
  const events: string[] = [];
  const restoreRunner = undoToolTestHooks.setProcessRunnerForTest(isolatedRunner(fixture, events));
  t.after(restoreRunner);
  const restoreWriter = undoToolTestHooks.setReportWriterForTest(async (args) => {
    events.push(args.content?.includes("Structured Execution Receipt") ? "report:outcome" : "report:plan");
    return blueprintArtifactReportWrite(args);
  });
  t.after(restoreWriter);
  const preview = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: target }],
    reason: "execute target"
  });

  const result = await blueprintUndoExecute({
    operationId: preview.operationId!,
    fingerprint: preview.fingerprint!,
    confirmed: true
  });
  assert.equal(result.status, "succeeded", result.blockers.join("\n"));
  assert.equal(result.mutationStatus, "succeeded");
  assert.equal(result.reverted.length, 1);
  assert.deepEqual(events, [
    "report:plan",
    `git:revert --no-edit ${target}`,
    "report:outcome"
  ]);
  assert.match(
    await readFile(path.join(fixture.repoPath, ".blueprint/reports/undo-latest.md"), "utf8"),
    /\*\*Mutation status:\*\* succeeded/
  );
  assert.deepEqual(
    new Set(
      (await readdir(os.tmpdir())).filter((entry) => entry.startsWith("blueprint-undo-tree-"))
    ),
    temporaryTreesBefore
  );

  const replay = await blueprintUndoExecute({
    operationId: preview.operationId!,
    fingerprint: preview.fingerprint!,
    confirmed: true
  });
  assert.equal(replay.status, "already-applied");
  assert.equal(replay.mutationStarted, false);

  const fresh = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: target }],
    reason: "do not double undo",
    overwriteReport: true
  });
  assert.equal(fresh.status, "already-applied");
  assert.match(fresh.blockers.join("\n"), /durable idempotency ledger/i);
});

test("undo execute canonicalizes multiple targets newest-first and records every revert commit", async (t) => {
  const { fixture } = await setupTarget(t);
  const older = await fixture.commitFile("older.txt", "older\n", "feat: older target");
  const newer = await fixture.commitFile("newer.txt", "newer\n", "feat: newer target");
  const mutationArgv: string[][] = [];
  const restoreRunner = undoToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
    if (argv[0] === "revert") mutationArgv.push([...argv]);
    return fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
  });
  t.after(restoreRunner);
  const preview = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: older }, { sha: newer }],
    reason: "revert the bounded pair"
  });
  assert.deepEqual(preview.packet?.candidates.map((candidate) => candidate.sha), [newer, older]);

  const result = await blueprintUndoExecute({
    operationId: preview.operationId!,
    fingerprint: preview.fingerprint!,
    confirmed: true
  });
  assert.equal(result.status, "succeeded", result.blockers.join("\n"));
  assert.deepEqual(result.reverted.map((entry) => entry.target), [newer, older]);
  assert.equal(new Set(result.reverted.map((entry) => entry.revertCommit)).size, 2);
  assert.deepEqual(mutationArgv, [
    ["revert", "--no-edit", newer],
    ["revert", "--no-edit", older]
  ]);
});

test("undo success requires the exact approved direct-parent tree transition", async (t) => {
  await t.test("a real clean commit racing after git revert is never recorded as the revert", async (t) => {
    const { fixture, target } = await setupTarget(t);
    let actualRevert = "";
    let racingCommit = "";
    const restoreRunner = undoToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
      const processResult = await fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
      if (argv[0] === "revert" && processResult.exitCode === 0) {
        actualRevert = (await fixture.runGit(["rev-parse", "HEAD"])).stdout.trim();
        racingCommit = await fixture.commitFile("racing.txt", "racing\n", "test: racing clean commit");
      }
      return processResult;
    });
    t.after(restoreRunner);
    const preview = await blueprintUndoPreview({
      cwd: fixture.repoPath,
      targets: [{ sha: target }],
      reason: "reject a racing post-revert commit"
    });
    const result = await blueprintUndoExecute({
      operationId: preview.operationId!,
      fingerprint: preview.fingerprint!,
      confirmed: true
    });

    assert.equal(result.status, "outcome-unknown");
    assert.equal(result.mutationStatus, "outcome-unknown");
    assert.deepEqual(result.reverted, []);
    assert.deepEqual(result.unreverted, [target]);
    assert.equal(result.finalHead, racingCommit);
    assert.notEqual(actualRevert, racingCommit);
    assert.match(result.blockers.join("\n"), /exact approved direct-parent revert transition/i);
  });

  await t.test("an unrelated exit-zero commit cannot stand in for the approved revert", async (t) => {
    const { fixture, target } = await setupTarget(t);
    let unrelatedCommit = "";
    const restoreRunner = undoToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
      if (argv[0] === "revert") {
        unrelatedCommit = await fixture.commitFile(
          "unrelated.txt",
          "unrelated\n",
          "test: unrelated exit-zero mutation"
        );
        return {
          exitCode: 0,
          stdout: "simulated successful process\n",
          stderr: "",
          signal: null,
          timedOut: false
        };
      }
      return fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
    });
    t.after(restoreRunner);
    const preview = await blueprintUndoPreview({
      cwd: fixture.repoPath,
      targets: [{ sha: target }],
      reason: "reject an unrelated exit-zero mutation"
    });
    const result = await blueprintUndoExecute({
      operationId: preview.operationId!,
      fingerprint: preview.fingerprint!,
      confirmed: true
    });

    assert.equal(result.status, "outcome-unknown");
    assert.equal(result.mutationStatus, "outcome-unknown");
    assert.deepEqual(result.reverted, []);
    assert.deepEqual(result.unreverted, [target]);
    assert.equal(result.finalHead, unrelatedCommit);
    assert.equal(await readFile(path.join(fixture.repoPath, "feature.txt"), "utf8"), "feature\n");
  });
});

test("undo execute returns a truthful partial conflict receipt without auto-abort", async (t) => {
  const { fixture } = await setupTarget(t);
  const target = await fixture.commitFile("conflict.txt", "target\n", "feat: conflicting target");
  await fixture.commitFile("conflict.txt", "later\n", "feat: conflicting later change");
  const preview = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: target }],
    reason: "exercise conflict"
  });
  const result = await blueprintUndoExecute({
    operationId: preview.operationId!,
    fingerprint: preview.fingerprint!,
    confirmed: true
  });

  assert.equal(result.status, "partial");
  assert.equal(result.mutationStarted, true);
  assert.equal(result.reverted.length, 0);
  assert.deepEqual(result.unreverted, [target]);
  assert.ok(result.conflictedPaths.includes("conflict.txt"));
  assert.ok(result.inProgressState.some((state) => state === "revert" || state === "sequencer"));
  assert.match(result.recoveryActions.join("\n"), /git revert --continue/);
  assert.match(result.recoveryActions.join("\n"), /git revert --abort/);
  assert.equal((await fixture.runGit(["rev-parse", "--verify", "REVERT_HEAD"])).exitCode, 0);
  const savedReport = await readFile(
    path.join(fixture.repoPath, ".blueprint/reports/undo-latest.md"),
    "utf8"
  );
  assert.match(savedReport, /\*\*Working tree status:\*\* dirty/);
  assert.match(savedReport, /\*\*Merge state:\*\* revert in progress/);
  assert.match(savedReport, /\*\*Conflicted paths:\*\* conflict\.txt/);
});

test("later-step conflict preserves completed and unreverted ledgers", async (t) => {
  const { fixture } = await setupTarget(t);
  const older = await fixture.commitFile("shared.txt", "older\n", "feat: older shared change");
  const newer = await fixture.commitFile("independent.txt", "newer\n", "feat: newer independent change");
  await fixture.commitFile("shared.txt", "later\n", "feat: later conflicting change");
  const preview = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: older }, { sha: newer }],
    reason: "later conflict"
  });
  const result = await blueprintUndoExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
  assert.equal(result.status, "partial");
  assert.deepEqual(result.reverted.map((entry) => entry.target), [newer]);
  assert.deepEqual(result.unreverted, [older]);
  assert.deepEqual(result.attempted, [newer, older]);
  assert.ok(result.conflictedPaths.includes("shared.txt"));
});

test("report failures preserve causal ordering and never retry a completed revert", async (t) => {
  await t.test("pre-mutation report failure blocks git", async (t) => {
    const { fixture, target } = await setupTarget(t);
    let revertCalls = 0;
    const restoreRunner = undoToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
      if (argv[0] === "revert") revertCalls += 1;
      return fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
    });
    t.after(restoreRunner);
    const restoreWriter = undoToolTestHooks.setReportWriterForTest(async () => {
      throw new Error("injected pre-report failure");
    });
    t.after(restoreWriter);
    const preview = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "test" });
    const result = await blueprintUndoExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(result.status, "blocked");
    assert.equal(result.mutationStarted, false);
    assert.equal(revertCalls, 0);
    assert.match(result.blockers.join("\n"), /injected pre-report failure/);
  });

  await t.test("post-mutation report failure returns partial external success", async (t) => {
    const { fixture, target } = await setupTarget(t);
    let writes = 0;
    let revertCalls = 0;
    const restoreRunner = undoToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
      if (argv[0] === "revert") revertCalls += 1;
      return fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
    });
    t.after(restoreRunner);
    const restoreWriter = undoToolTestHooks.setReportWriterForTest(async (args) => {
      writes += 1;
      if (writes === 2) throw new Error("injected outcome-report failure");
      return blueprintArtifactReportWrite(args);
    });
    t.after(restoreWriter);
    const preview = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "test" });
    const result = await blueprintUndoExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(result.status, "partial");
    assert.equal(result.mutationStatus, "succeeded");
    assert.equal(result.reverted.length, 1);
    assert.equal(revertCalls, 1);
    assert.equal(result.report.outcomeStatus, "failed");
    assert.match(result.recoveryActions.join("\n"), /do not retry git revert/i);
    const recovered = await blueprintUndoPersist({
      operationId: preview.operationId!,
      fingerprint: preview.fingerprint!,
      stage: "outcome-report"
    });
    assert.equal(recovered.status, "succeeded", recovered.blockers.join("\n"));
    assert.equal(recovered.report.outcomeStatus, "updated");
    assert.equal(revertCalls, 1);
    const repeated = await blueprintUndoPersist({
      operationId: preview.operationId!,
      fingerprint: preview.fingerprint!,
      stage: "outcome-report"
    });
    assert.equal(repeated.status, "blocked");
    assert.match(repeated.blockers.join("\n"), /failed outcome-report receipt/i);
    assert.equal(revertCalls, 1);
  });
});

test("state update is attempted only after successful outcome-report persistence", async (t) => {
  const { fixture, target } = await setupTarget(t);
  const events: string[] = [];
  const restoreWriter = undoToolTestHooks.setReportWriterForTest(async (args) => {
    events.push(args.content?.includes("Structured Execution Receipt") ? "report:outcome" : "report:plan");
    return blueprintArtifactReportWrite(args);
  });
  t.after(restoreWriter);
  const restoreState = undoToolTestHooks.setStateUpdaterForTest(async () => {
    events.push("state");
    return { updated: true, updatedFields: ["nextAction"], statePath: ".blueprint/STATE.md", warnings: [] };
  });
  t.after(restoreState);
  const preview = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: target }],
    reason: "test state ordering",
    statePatch: { nextAction: "Run /blu-progress" }
  });
  const result = await blueprintUndoExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
  assert.equal(result.status, "succeeded", result.blockers.join("\n"));
  assert.equal(result.state.status, "updated");
  assert.deepEqual(events, ["report:plan", "report:outcome", "state", "report:outcome"]);
});

test("report recovery resumes an exact deferred state patch without re-entering git", async (t) => {
  const { fixture, target } = await setupTarget(t);
  const events: string[] = [];
  let reportWrites = 0;
  let revertCalls = 0;
  let stateCalls = 0;
  const restoreRunner = undoToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
    if (argv[0] === "revert") {
      revertCalls += 1;
      events.push("git:revert");
    }
    return fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
  });
  t.after(restoreRunner);
  const restoreWriter = undoToolTestHooks.setReportWriterForTest(async (args) => {
    reportWrites += 1;
    events.push(`report:${String(reportWrites)}`);
    if (reportWrites === 2) throw new Error("injected first outcome-report failure");
    return blueprintArtifactReportWrite(args);
  });
  t.after(restoreWriter);
  const restoreState = undoToolTestHooks.setStateUpdaterForTest(async () => {
    stateCalls += 1;
    events.push("state");
    return {
      updated: true,
      updatedFields: ["nextAction"],
      statePath: ".blueprint/STATE.md",
      warnings: []
    };
  });
  t.after(restoreState);
  const preview = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: target }],
    reason: "resume state only after recovering the report",
    statePatch: { nextAction: "Run /blu-progress" }
  });
  const executed = await blueprintUndoExecute({
    operationId: preview.operationId!,
    fingerprint: preview.fingerprint!,
    confirmed: true
  });
  assert.equal(executed.status, "partial");
  assert.equal(executed.mutationStatus, "succeeded");
  assert.equal(executed.report.outcomeStatus, "failed");
  assert.equal(executed.state.status, "not-attempted");
  assert.equal(stateCalls, 0);

  const reportRecovered = await blueprintUndoPersist({
    operationId: preview.operationId!,
    fingerprint: preview.fingerprint!,
    stage: "outcome-report"
  });
  assert.equal(reportRecovered.status, "partial");
  assert.equal(reportRecovered.report.outcomeStatus, "updated");
  assert.equal(reportRecovered.state.status, "not-attempted");
  assert.equal(stateCalls, 0);

  const stateRecovered = await blueprintUndoPersist({
    operationId: preview.operationId!,
    fingerprint: preview.fingerprint!,
    stage: "state"
  });
  assert.equal(stateRecovered.status, "succeeded", stateRecovered.blockers.join("\n"));
  assert.equal(stateRecovered.state.status, "updated");
  assert.equal(revertCalls, 1);
  assert.equal(stateCalls, 1);
  assert.deepEqual(events, ["report:1", "git:revert", "report:2", "report:3", "state", "report:4"]);
  assert.match(
    await readFile(path.join(fixture.repoPath, ".blueprint/reports/undo-latest.md"), "utf8"),
    /\*\*State persistence status:\*\* updated/
  );
});

test("state failure is durable and state-only recovery never re-enters git", async (t) => {
  const { fixture, target } = await setupTarget(t);
  let stateCalls = 0;
  let revertCalls = 0;
  const restoreRunner = undoToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
    if (argv[0] === "revert") revertCalls += 1;
    return fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
  });
  t.after(restoreRunner);
  const restoreState = undoToolTestHooks.setStateUpdaterForTest(async () => {
    stateCalls += 1;
    if (stateCalls === 1) throw new Error("injected state failure");
    if (stateCalls === 2) throw new Error("injected state recovery failure");
    return { updated: true, updatedFields: ["nextAction"], statePath: ".blueprint/STATE.md", warnings: [] };
  });
  t.after(restoreState);
  const preview = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: target }],
    reason: "state recovery",
    statePatch: { nextAction: "Run /blu-progress" }
  });
  const result = await blueprintUndoExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
  assert.equal(result.status, "partial");
  assert.equal(result.state.status, "failed");
  assert.match(
    await readFile(path.join(fixture.repoPath, ".blueprint/reports/undo-latest.md"), "utf8"),
    /\*\*State persistence status:\*\* failed/
  );

  const failedRecovery = await blueprintUndoPersist({
    operationId: preview.operationId!,
    fingerprint: preview.fingerprint!,
    stage: "state"
  });
  assert.equal(failedRecovery.status, "partial");
  assert.equal(failedRecovery.state.status, "failed");
  assert.match(failedRecovery.blockers.join("\n"), /State persistence recovery failed: injected state recovery failure/);
  assert.doesNotMatch(failedRecovery.blockers.join("\n"), /Git and outcome report succeeded, but state update failed:/);
  assert.deepEqual(failedRecovery.recoveryActions, ["Retry only blueprint_undo_persist stage state."]);
  assert.equal(revertCalls, 1);

  const recovered = await blueprintUndoPersist({
    operationId: preview.operationId!,
    fingerprint: preview.fingerprint!,
    stage: "state"
  });
  assert.equal(recovered.status, "succeeded", recovered.blockers.join("\n"));
  assert.equal(recovered.state.status, "updated");
  assert.deepEqual(recovered.blockers, []);
  assert.deepEqual(recovered.recoveryActions, []);
  assert.equal(revertCalls, 1);
  assert.equal(stateCalls, 3);
  assert.match(
    await readFile(path.join(fixture.repoPath, ".blueprint/reports/undo-latest.md"), "utf8"),
    /\*\*State persistence status:\*\* updated/
  );
  const repeated = await blueprintUndoPersist({
    operationId: preview.operationId!,
    fingerprint: preview.fingerprint!,
    stage: "state"
  });
  assert.equal(repeated.status, "blocked");
  assert.match(repeated.blockers.join("\n"), /failed-state receipt/i);
  assert.equal(stateCalls, 3);
});

test("persistence recovery rejects successful stages without repeating state or report writes", async (t) => {
  const { fixture, target } = await setupTarget(t);
  let stateCalls = 0;
  let reportWrites = 0;
  const restoreState = undoToolTestHooks.setStateUpdaterForTest(async () => {
    stateCalls += 1;
    return {
      updated: true,
      updatedFields: ["nextAction"],
      statePath: ".blueprint/STATE.md",
      warnings: []
    };
  });
  t.after(restoreState);
  const restoreWriter = undoToolTestHooks.setReportWriterForTest(async (args) => {
    reportWrites += 1;
    return blueprintArtifactReportWrite(args);
  });
  t.after(restoreWriter);

  const preview = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: target }],
    reason: "successful stages are not recoverable",
    statePatch: { nextAction: "Run /blu-progress" }
  });
  const executed = await blueprintUndoExecute({
    operationId: preview.operationId!,
    fingerprint: preview.fingerprint!,
    confirmed: true
  });
  assert.equal(executed.status, "succeeded", executed.blockers.join("\n"));
  assert.equal(executed.state.status, "updated");
  assert.equal(stateCalls, 1);
  assert.equal(reportWrites, 3);

  const stateRetry = await blueprintUndoPersist({
    operationId: preview.operationId!,
    fingerprint: preview.fingerprint!,
    stage: "state"
  });
  assert.equal(stateRetry.status, "blocked");
  assert.match(stateRetry.blockers.join("\n"), /failed-state receipt/i);
  assert.equal(stateCalls, 1);

  const reportRetry = await blueprintUndoPersist({
    operationId: preview.operationId!,
    fingerprint: preview.fingerprint!,
    stage: "outcome-report"
  });
  assert.equal(reportRetry.status, "blocked");
  assert.match(reportRetry.blockers.join("\n"), /failed outcome-report receipt/i);
  assert.equal(reportWrites, 3);
});

test("non-conflict process failures preserve exact exit, stdout, and stderr", async (t) => {
  const { fixture, target } = await setupTarget(t);
  const restoreRunner = undoToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
    if (argv[0] === "revert") {
      return { exitCode: 23, stdout: "exact stdout\n", stderr: "exact stderr\n", signal: null, timedOut: false };
    }
    return fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
  });
  t.after(restoreRunner);
  const preview = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "test process receipt" });
  const result = await blueprintUndoExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
  assert.equal(result.status, "partial");
  assert.equal(result.processes[0]?.result.exitCode, 23);
  assert.equal(result.processes[0]?.result.stdout, "exact stdout\n");
  assert.equal(result.processes[0]?.result.stderr, "exact stderr\n");
});

test("signal, timeout, spawn, and no-HEAD-advance outcomes stay structured", async (t) => {
  const scenarios = [
    {
      name: "signal",
      process: { exitCode: null, stdout: "signal out\n", stderr: "signal err\n", signal: "SIGTERM" as const, timedOut: false },
      expected: "outcome-unknown"
    },
    {
      name: "timeout",
      process: { exitCode: null, stdout: "timeout out\n", stderr: "timeout err\n", signal: "SIGTERM" as const, timedOut: true },
      expected: "outcome-unknown"
    },
    {
      name: "successful exit without HEAD advance",
      process: { exitCode: 0, stdout: "no mutation\n", stderr: "", signal: null, timedOut: false },
      expected: "outcome-unknown"
    }
  ] as const;

  for (const scenario of scenarios) {
    await t.test(scenario.name, async (t) => {
      const { fixture, target } = await setupTarget(t);
      const restoreRunner = undoToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
        if (argv[0] === "revert") return scenario.process;
        return fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
      });
      t.after(restoreRunner);
      const preview = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: scenario.name });
      const result = await blueprintUndoExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
      assert.equal(result.status, scenario.expected);
      assert.equal(result.processes[0]?.result.stdout, scenario.process.stdout);
      assert.equal(result.processes[0]?.result.stderr, scenario.process.stderr);
      assert.equal(result.processes[0]?.result.signal, scenario.process.signal);
      assert.equal(result.processes[0]?.result.timedOut, scenario.process.timedOut);
    });
  }

  await t.test("spawn error", async (t) => {
    const { fixture, target } = await setupTarget(t);
    const restoreRunner = undoToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
      if (argv[0] === "revert") throw new Error("spawn git ENOENT");
      return fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
    });
    t.after(restoreRunner);
    const preview = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "spawn" });
    const result = await blueprintUndoExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(result.status, "outcome-unknown");
    assert.equal(result.processes[0]?.result.exitCode, null);
    assert.equal(result.processes[0]?.result.stderr, "spawn git ENOENT");
  });
});

test("outcome-unknown dominates outcome-report failure and recovery", async (t) => {
  const { fixture, target } = await setupTarget(t);
  let reportWrites = 0;
  let revertCalls = 0;
  let processCalls = 0;
  const attemptedOutcomeReports: string[] = [];
  const mutationBlocker = "spawn git ENOENT with report failure";
  const inspectionAction =
    "Inspect the recorded process receipt and repository state before creating a fresh preview.";
  const restoreRunner = undoToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
    processCalls += 1;
    if (argv[0] === "revert") {
      revertCalls += 1;
      throw new Error("spawn git ENOENT with report failure");
    }
    return fixture.runner(command, argv, cwd, { ...env, ...fixture.env });
  });
  t.after(restoreRunner);
  const restoreWriter = undoToolTestHooks.setReportWriterForTest(async (args) => {
    reportWrites += 1;
    if (reportWrites > 1 && args.content) attemptedOutcomeReports.push(args.content);
    if (reportWrites === 2) throw new Error("injected unknown outcome-report failure");
    if (reportWrites === 3) throw new Error("injected unknown persistence-recovery failure");
    return blueprintArtifactReportWrite(args);
  });
  t.after(restoreWriter);
  const preview = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: target }],
    reason: "preserve unknown across report recovery"
  });
  const executed = await blueprintUndoExecute({
    operationId: preview.operationId!,
    fingerprint: preview.fingerprint!,
    confirmed: true
  });
  assert.equal(executed.status, "outcome-unknown");
  assert.equal(executed.mutationStatus, "outcome-unknown");
  assert.equal(executed.report.outcomeStatus, "failed");
  assert.ok(executed.blockers.includes(mutationBlocker));
  assert.ok(executed.recoveryActions.includes(inspectionAction));
  assert.match(attemptedOutcomeReports[0] ?? "", /\*\*Revert outcome:\*\* outcome-unknown/);
  assert.match(attemptedOutcomeReports[0] ?? "", /\*\*Mutation status:\*\* outcome-unknown/);
  const processCallsAfterExecute = processCalls;

  const failedRecovery = await blueprintUndoPersist({
    operationId: preview.operationId!,
    fingerprint: preview.fingerprint!,
    stage: "outcome-report"
  });
  assert.equal(failedRecovery.status, "outcome-unknown");
  assert.equal(failedRecovery.mutationStatus, "outcome-unknown");
  assert.equal(failedRecovery.report.outcomeStatus, "failed");
  assert.equal(processCalls, processCallsAfterExecute);
  assert.equal(revertCalls, 1);
  assert.ok(failedRecovery.blockers.includes(mutationBlocker));
  assert.ok(failedRecovery.recoveryActions.includes(inspectionAction));
  assert.doesNotMatch(
    failedRecovery.blockers.join("\n"),
    /Git outcome is preserved, but the actual-outcome report failed:/
  );
  assert.match(attemptedOutcomeReports[1] ?? "", /\*\*Revert outcome:\*\* outcome-unknown/);
  assert.match(attemptedOutcomeReports[1] ?? "", /\*\*Mutation status:\*\* outcome-unknown/);
  assert.match(attemptedOutcomeReports[1] ?? "", /\*\*Blockers:\*\* spawn git ENOENT with report failure/);
  assert.match(attemptedOutcomeReports[1] ?? "", new RegExp(`## Next Safe Action\\n\\n- ${inspectionAction.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.doesNotMatch(attemptedOutcomeReports[1] ?? "", /blueprint_undo_persist/);

  const recovered = await blueprintUndoPersist({
    operationId: preview.operationId!,
    fingerprint: preview.fingerprint!,
    stage: "outcome-report"
  });
  assert.equal(recovered.status, "outcome-unknown");
  assert.equal(recovered.mutationStatus, "outcome-unknown");
  assert.equal(recovered.report.outcomeStatus, "updated");
  assert.equal(processCalls, processCallsAfterExecute);
  assert.equal(revertCalls, 1);
  assert.deepEqual(recovered.blockers, [mutationBlocker]);
  assert.deepEqual(recovered.recoveryActions, [inspectionAction]);
  assert.match(attemptedOutcomeReports[2] ?? "", /\*\*Revert outcome:\*\* outcome-unknown/);
  assert.match(attemptedOutcomeReports[2] ?? "", /\*\*Mutation status:\*\* outcome-unknown/);
  const savedReport = await readFile(
    path.join(fixture.repoPath, ".blueprint/reports/undo-latest.md"),
    "utf8"
  );
  assert.match(savedReport, /\*\*Revert outcome:\*\* outcome-unknown/);
  assert.match(savedReport, /\*\*Mutation status:\*\* outcome-unknown/);
  assert.match(savedReport, /\*\*Blockers:\*\* spawn git ENOENT with report failure/);
  assert.match(
    savedReport,
    new RegExp(`## Next Safe Action\\n\\n- ${inspectionAction.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)
  );
  assert.doesNotMatch(savedReport, /blueprint_undo_persist|Persistence-only report recovery failed:/);
});

test("concurrent execute contention is structured and does not consume the blocked approval", async (t) => {
  const { fixture, target } = await setupTarget(t);
  const firstPreview = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "first" });
  const secondPreview = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "second" });
  const writerEntered = deferred();
  const releaseWriter = deferred();
  let writes = 0;
  const restoreWriter = undoToolTestHooks.setReportWriterForTest(async (args) => {
    writes += 1;
    if (writes === 1) {
      writerEntered.resolve();
      await releaseWriter.promise;
    }
    return blueprintArtifactReportWrite(args);
  });
  t.after(restoreWriter);

  const firstExecution = blueprintUndoExecute({
    operationId: firstPreview.operationId!,
    fingerprint: firstPreview.fingerprint!,
    confirmed: true
  });
  await writerEntered.promise;
  const contended = await blueprintUndoExecute({
    operationId: secondPreview.operationId!,
    fingerprint: secondPreview.fingerprint!,
    confirmed: true
  });
  assert.equal(contended.status, "blocked");
  assert.match(contended.blockers.join("\n"), /remains unconsumed/i);
  releaseWriter.resolve();
  assert.equal((await firstExecution).status, "succeeded");

  const retry = await blueprintUndoExecute({
    operationId: secondPreview.operationId!,
    fingerprint: secondPreview.fingerprint!,
    confirmed: true
  });
  assert.equal(retry.status, "stale");
  assert.match(retry.blockers.join("\n"), /HEAD changed|durable idempotency ledger|report.*changed/i);
});

test("approval retention expires, evicts, and keeps a bounded terminal replay window", async (t) => {
  const { fixture, target } = await setupTarget(t);
  let now = 1_000;
  const restoreRetention = undoToolTestHooks.setRetentionForTest({
    now: () => now,
    approvalTtlMs: 10,
    terminalReceiptTtlMs: 20,
    maxApprovals: 2
  });
  t.after(restoreRetention);

  const expired = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "expire" });
  now += 11;
  const expiredResult = await blueprintUndoExecute({ operationId: expired.operationId!, fingerprint: expired.fingerprint!, confirmed: true });
  assert.equal(expiredResult.status, "stale");
  assert.match(expiredResult.blockers.join("\n"), /missing or expired/i);

  const evicted = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "evict one" });
  await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "evict two" });
  await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "evict three" });
  const evictedResult = await blueprintUndoExecute({ operationId: evicted.operationId!, fingerprint: evicted.fingerprint!, confirmed: true });
  assert.equal(evictedResult.status, "stale");

  undoToolTestHooks.clearApprovalsForTest();
  const terminal = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "terminal" });
  const success = await blueprintUndoExecute({ operationId: terminal.operationId!, fingerprint: terminal.fingerprint!, confirmed: true });
  assert.equal(success.status, "succeeded");
  now += 19;
  assert.equal((await blueprintUndoExecute({ operationId: terminal.operationId!, fingerprint: terminal.fingerprint!, confirmed: true })).status, "already-applied");
  now += 2;
  assert.equal((await blueprintUndoExecute({ operationId: terminal.operationId!, fingerprint: terminal.fingerprint!, confirmed: true })).status, "stale");
});

test("undo failure logging and public response parity include new terminal statuses and tools", async (t) => {
  assert.equal(
    shouldLogMutationFailure("blueprint_undo_execute", { status: "outcome-unknown" }),
    true
  );
  assert.equal(
    shouldLogMutationFailure("blueprint_undo_persist", { status: "partial" }),
    true
  );

  const { fixture, target } = await setupTarget(t);
  const preview = await blueprintUndoPreview({ cwd: fixture.repoPath, targets: [{ sha: target }], reason: "public preview" });
  const execute = await blueprintUndoExecute({
    operationId: "00000000-0000-4000-8000-000000000000",
    fingerprint: "0".repeat(64),
    confirmed: true
  });
  const persist = await blueprintUndoPersist({
    operationId: "00000000-0000-4000-8000-000000000000",
    fingerprint: "0".repeat(64),
    stage: "outcome-report"
  });
  for (const [toolName, result] of [
    ["blueprint_undo_preview", preview],
    ["blueprint_undo_execute", execute],
    ["blueprint_undo_persist", persist]
  ] as const) {
    const publicResult = sanitizeToolResultForPublicResponse(toolName, result);
    const content = createToolResponseContent(toolName, result);
    assert.equal(content[0]?.type, "text");
    assert.equal(content[0]?.text, JSON.stringify(publicResult));
  }
});

test("registered MCP server returns public response parity for all undo tools", async (t) => {
  const { fixture, target } = await setupTarget(t);
  const server = createBlueprintServer();
  const client = new Client(
    { name: "blueprint-undo-public-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  t.after(async () => {
    await Promise.all([client.close(), server.close()]);
  });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const previewResponse = await client.callTool({
    name: "blueprint_undo_preview",
    arguments: {
      cwd: fixture.repoPath,
      targets: [{ sha: target }],
      reason: "registered preview",
      evidencePaths: ["README.md"]
    }
  });
  assert.ok(previewResponse.structuredContent);
  assert.equal(
    previewResponse.content[0]?.text,
    JSON.stringify(previewResponse.structuredContent)
  );
  assert.equal(previewResponse.structuredContent.status, "ready");

  const operationId = previewResponse.structuredContent.operationId;
  const fingerprint = previewResponse.structuredContent.fingerprint;
  assert.equal(typeof operationId, "string");
  assert.equal(typeof fingerprint, "string");

  const executeResponse = await client.callTool({
    name: "blueprint_undo_execute",
    arguments: { operationId, fingerprint, confirmed: true }
  });
  assert.ok(executeResponse.structuredContent);
  assert.equal(
    executeResponse.content[0]?.text,
    JSON.stringify(executeResponse.structuredContent)
  );
  assert.equal(executeResponse.structuredContent.status, "succeeded");

  const recoveryTarget = await fixture.commitFile(
    "recovery.txt",
    "recovery\n",
    "feat: persistence recovery target"
  );
  let recoveryWrites = 0;
  const restoreWriter = undoToolTestHooks.setReportWriterForTest(async (args) => {
    recoveryWrites += 1;
    if (recoveryWrites === 2) throw new Error("injected live MCP outcome-report failure");
    return blueprintArtifactReportWrite(args);
  });
  t.after(restoreWriter);
  const recoveryPreview = await blueprintUndoPreview({
    cwd: fixture.repoPath,
    targets: [{ sha: recoveryTarget }],
    reason: "authorize registered persist",
    overwriteReport: true
  });
  const recoveryExecute = await blueprintUndoExecute({
    operationId: recoveryPreview.operationId!,
    fingerprint: recoveryPreview.fingerprint!,
    confirmed: true
  });
  assert.equal(recoveryExecute.status, "partial");
  assert.equal(recoveryExecute.report.outcomeStatus, "failed");

  const persistResponse = await client.callTool({
    name: "blueprint_undo_persist",
    arguments: {
      operationId: recoveryPreview.operationId,
      fingerprint: recoveryPreview.fingerprint,
      stage: "outcome-report"
    }
  });
  assert.ok(persistResponse.structuredContent);
  assert.equal(
    persistResponse.content[0]?.text,
    JSON.stringify(persistResponse.structuredContent)
  );
  assert.equal(persistResponse.structuredContent.status, "succeeded");
  assert.equal(recoveryWrites, 3);
});
