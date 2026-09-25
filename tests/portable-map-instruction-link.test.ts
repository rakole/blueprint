import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {promises as fs} from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import {syncBuiltinESMExports} from "node:module";
import os from "node:os";
import path from "node:path";

import {
  applyInstructionLink,
  CODEBASE_INDEX_INSTRUCTION_END,
  CODEBASE_INDEX_INSTRUCTION_LEGACY_SNIPPET,
  CODEBASE_INDEX_INSTRUCTION_SNIPPET,
  CODEBASE_INDEX_INSTRUCTION_START,
  instructionLinkTestHooks,
  prepareInstructionLink
} from "../src/mcp/codebase-index/instruction-link.js";
import {atomicDescriptorWrite} from "../src/mcp/codebase-index/descriptor-mutation.js";

const hash = (value: Buffer | string): string =>
  createHash("sha256").update(value).digest("hex");

async function repository(t: { after: (callback: () => Promise<void>) => void }): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "blueprint-instruction-link-"));
  t.after(async () => rm(root, { recursive: true, force: true }));
  return root;
}

function block(newline = "\n"): string {
  return [
    CODEBASE_INDEX_INSTRUCTION_START,
    CODEBASE_INDEX_INSTRUCTION_SNIPPET,
    CODEBASE_INDEX_INSTRUCTION_END
  ].join(newline);
}

function legacyBlock(newline = "\n"): string {
  return [
    CODEBASE_INDEX_INSTRUCTION_START,
    CODEBASE_INDEX_INSTRUCTION_LEGACY_SNIPPET,
    CODEBASE_INDEX_INSTRUCTION_END
  ].join(newline);
}

test("descriptor replacement enforces an inode-only expectation", async t => {
  const root = await repository(t);
  const target = path.join(root, "AGENTS.md");
  await writeFile(target, "original\n", "utf8");
  const before = await lstat(target);
  const result = await atomicDescriptorWrite({
    root,
    relative: "AGENTS.md",
    bytes: Buffer.from("replacement\n"),
    overwrite: true,
    expected: {device: before.dev, inode: before.ino + 1}
  });
  assert.equal(result, "conflict");
  assert.equal(await readFile(target, "utf8"), "original\n");
});

test("auto-selection returns a snippet, one candidate, or explicit choices", async (t) => {
  const emptyRoot = await repository(t);
  const noCandidate = await prepareInstructionLink({ repositoryRoot: emptyRoot });
  assert.equal(noCandidate.status, "snippet");
  if (noCandidate.status === "snippet") {
    assert.equal(noCandidate.snippet, CODEBASE_INDEX_INSTRUCTION_SNIPPET);
    assert.match(noCandidate.action, /never creates/i);
  }

  const oneRoot = await repository(t);
  await writeFile(path.join(oneRoot, "AGENTS.md"), "# Guidance\n", "utf8");
  const oneCandidate = await prepareInstructionLink({ repositoryRoot: oneRoot });
  assert.equal(oneCandidate.status, "ready");
  if (oneCandidate.status === "ready") {
    assert.equal(oneCandidate.instructionPath, "AGENTS.md");
    assert.equal(oneCandidate.currentStatus, "missing-block");
    assert.equal(oneCandidate.expectedHash, hash("# Guidance\n"));
  }

  const manyRoot = await repository(t);
  await writeFile(path.join(manyRoot, "AGENTS.md"), "agents\n", "utf8");
  await writeFile(path.join(manyRoot, "GEMINI.md"), "gemini\n", "utf8");
  const manyCandidates = await prepareInstructionLink({ repositoryRoot: manyRoot });
  assert.deepEqual(manyCandidates, {
    status: "choices",
    choices: ["AGENTS.md", "GEMINI.md"],
    snippet: CODEBASE_INDEX_INSTRUCTION_SNIPPET,
    message: "More than one supported root instruction file exists.",
    action: "Choose one existing file and invoke linking with its repository-relative path."
  });
});

test("explicit existing paths work and unsafe or missing paths are rejected", async (t) => {
  const root = await repository(t);
  await mkdir(path.join(root, "docs"));
  await writeFile(path.join(root, "docs", "agent.md"), "guidance", "utf8");
  const explicit = await prepareInstructionLink({
    repositoryRoot: root,
    instructionPath: "docs/agent.md"
  });
  assert.equal(explicit.status, "ready");
  if (explicit.status === "ready") {
    assert.equal(explicit.instructionPath, "docs/agent.md");
  }

  for (const instructionPath of ["../agent.md", "/tmp/agent.md", "docs/../agent.md", "docs\\agent.md"]) {
    const result = await prepareInstructionLink({ repositoryRoot: root, instructionPath });
    assert.equal(result.status, "failure");
    if (result.status === "failure") assert.equal(result.code, "unsafe-path");
  }
  await mkdir(path.join(root, ".blueprint", "codebase"), {recursive: true});
  await writeFile(path.join(root, ".blueprint", "codebase", "INDEX.md"), "index\n", "utf8");
  await writeFile(path.join(root, ".gitignore"), "*.tmp\n", "utf8");
  for (const instructionPath of [
    ".blueprint/codebase/INDEX.md",
    ".git/config",
    ".gitignore",
    "nested/.blueprint/codebase/INDEX.md",
    "nested/.git/config",
    "nested/.gitignore"
  ]) {
    const result = await prepareInstructionLink({repositoryRoot: root, instructionPath});
    assert.equal(result.status, "failure");
    if (result.status === "failure") assert.equal(result.code, "unsafe-target");
  }
  const missing = await prepareInstructionLink({
    repositoryRoot: root,
    instructionPath: "docs/missing.md"
  });
  assert.equal(missing.status, "failure");
  if (missing.status === "failure") assert.equal(missing.code, "missing-target");
});

test("symlink targets and ancestors are rejected without following them", async (t) => {
  const root = await repository(t);
  const outside = await mkdtemp(path.join(os.tmpdir(), "blueprint-instruction-outside-"));
  t.after(async () => rm(outside, { recursive: true, force: true }));
  await writeFile(path.join(outside, "agent.md"), "outside\n", "utf8");
  await symlink(path.join(outside, "agent.md"), path.join(root, "agent.md"));
  const direct = await prepareInstructionLink({ repositoryRoot: root, instructionPath: "agent.md" });
  assert.equal(direct.status, "failure");
  if (direct.status === "failure") assert.equal(direct.code, "unsafe-target");

  await mkdir(path.join(root, "real"));
  await writeFile(path.join(root, "real", "agent.md"), "inside\n", "utf8");
  await symlink(path.join(root, "real"), path.join(root, "alias"));
  const ancestor = await prepareInstructionLink({ repositoryRoot: root, instructionPath: "alias/agent.md" });
  assert.equal(ancestor.status, "failure");
  if (ancestor.status === "failure") assert.equal(ancestor.code, "unsafe-target");
});

test("apply preserves outside bytes, newline style, BOM, no-final-newline, and mode", async (t) => {
  const root = await repository(t);
  const target = path.join(root, "AGENTS.md");
  const original = Buffer.from("\uFEFF# Guidance\r\nKeep this byte exact\r\nNo final newline", "utf8");
  await writeFile(target, original);
  // 0664 loses group-write under the usual 022 umask unless the owned temp
  // descriptor restores the captured mode before the atomic rename.
  await chmod(target, 0o664);
  const prepared = await prepareInstructionLink({ repositoryRoot: root });
  assert.equal(prepared.status, "ready");
  if (prepared.status !== "ready") return;
  assert.equal(prepared.proposedBlock, block("\r\n"));

  const applied = await applyInstructionLink({
    repositoryRoot: root,
    instructionPath: prepared.instructionPath,
    expectedHash: prepared.expectedHash
  });
  assert.equal(applied.status, "applied");
  const updated = await readFile(target);
  const expected = Buffer.concat([original, Buffer.from("\r\n", "utf8"), Buffer.from(block("\r\n"), "utf8")]);
  assert.deepEqual(updated, expected);
  assert.equal(updated.subarray(0, original.length).equals(original), true);
  assert.equal((await lstat(target)).mode & 0o7777, 0o664);
  assert.equal(applied.status === "applied" ? applied.beforeHash : "", hash(original));
  assert.equal(applied.status === "applied" ? applied.afterHash : "", hash(expected));
});

test("LF files with a final newline are linked idempotently", async (t) => {
  const root = await repository(t);
  const target = path.join(root, "AGENTS.md");
  await writeFile(target, "# Guidance\n", "utf8");
  const prepared = await prepareInstructionLink({ repositoryRoot: root });
  assert.equal(prepared.status, "ready");
  if (prepared.status !== "ready") return;
  const first = await applyInstructionLink({
    repositoryRoot: root,
    instructionPath: prepared.instructionPath,
    expectedHash: prepared.expectedHash
  });
  assert.equal(first.status, "applied");
  const afterFirst = await readFile(target);
  assert.equal(afterFirst.toString("utf8"), `# Guidance\n${block()}\n`);

  const secondPrepare = await prepareInstructionLink({
    repositoryRoot: root,
    instructionPath: "AGENTS.md"
  });
  assert.equal(secondPrepare.status, "ready");
  if (secondPrepare.status !== "ready") return;
  assert.equal(secondPrepare.currentStatus, "already-linked");
  const second = await applyInstructionLink({
    repositoryRoot: root,
    instructionPath: "AGENTS.md",
    expectedHash: secondPrepare.expectedHash
  });
  assert.deepEqual(second, {
    status: "already-linked",
    instructionPath: "AGENTS.md",
    beforeHash: hash(afterFirst),
    afterHash: hash(afterFirst),
    changed: false
  });
  assert.deepEqual(await readFile(target), afterFirst);
});

test("a BOM-first owned prior block is updated in place with exact bytes preserved", async (t) => {
  const root = await repository(t);
  const target = path.join(root, "AGENTS.md");
  const original = Buffer.from(`\uFEFF${legacyBlock("\r\n")}\r\ntrailing\r\n`, "utf8");
  await writeFile(target, original);
  const prepared = await prepareInstructionLink({repositoryRoot: root, instructionPath: "AGENTS.md"});
  assert.equal(prepared.status, "ready");
  if (prepared.status !== "ready") return;
  assert.equal(prepared.currentStatus, "missing-block");
  const applied = await applyInstructionLink({
    repositoryRoot: root,
    instructionPath: "AGENTS.md",
    expectedHash: prepared.expectedHash
  });
  assert.equal(applied.status, "applied");
  const updated = await readFile(target);
  assert.equal(updated.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), true);
  assert.equal(updated.toString("utf8").includes(CODEBASE_INDEX_INSTRUCTION_LEGACY_SNIPPET), false);
  assert.equal(updated.toString("utf8").includes(CODEBASE_INDEX_INSTRUCTION_SNIPPET), true);
  assert.equal(updated.toString("utf8").endsWith("trailing\r\n"), true);
});

test("duplicate and malformed managed blocks fail without changing bytes", async (t) => {
  const root = await repository(t);
  const target = path.join(root, "AGENTS.md");
  const duplicate = `${block()}\n${block()}\n`;
  await writeFile(target, duplicate, "utf8");
  const duplicateResult = await prepareInstructionLink({ repositoryRoot: root });
  assert.equal(duplicateResult.status, "failure");
  if (duplicateResult.status === "failure") assert.equal(duplicateResult.code, "malformed-block");
  assert.equal((await readFile(target)).toString("utf8"), duplicate);

  const malformed = `${CODEBASE_INDEX_INSTRUCTION_START}\nchanged\n${CODEBASE_INDEX_INSTRUCTION_END}\n`;
  await writeFile(target, malformed, "utf8");
  const malformedResult = await prepareInstructionLink({ repositoryRoot: root });
  assert.equal(malformedResult.status, "failure");
  if (malformedResult.status === "failure") assert.equal(malformedResult.code, "malformed-block");
  const applyMalformed = await applyInstructionLink({
    repositoryRoot: root,
    instructionPath: "AGENTS.md",
    expectedHash: hash(malformed)
  });
  assert.equal(applyMalformed.status, "failure");
  if (applyMalformed.status === "failure") assert.equal(applyMalformed.code, "malformed-block");
});

test("stale and concurrent target changes produce actionable hash conflicts", async (t) => {
  const root = await repository(t);
  const target = path.join(root, "AGENTS.md");
  await writeFile(target, "original\n", "utf8");
  const prepared = await prepareInstructionLink({ repositoryRoot: root });
  assert.equal(prepared.status, "ready");
  if (prepared.status !== "ready") return;
  await writeFile(target, "changed after prepare\n", "utf8");
  const stale = await applyInstructionLink({
    repositoryRoot: root,
    instructionPath: prepared.instructionPath,
    expectedHash: prepared.expectedHash
  });
  assert.equal(stale.status, "failure");
  if (stale.status === "failure") {
    assert.equal(stale.code, "hash-conflict");
    assert.match(stale.action, /prepare.*again/i);
  }

});

async function swapDirectoryKeepingTarget(
  root: string,
  relativeDirectory: string,
  relativeTarget: string,
  t: {after: (callback: () => Promise<void>) => void}
): Promise<string> {
  const original = path.join(root, relativeDirectory);
  const oldPath = `${original}.old`;
  await rename(original, oldPath);
  t.after(async () => rm(oldPath, {recursive: true, force: true}));
  const replacementDirectory = path.join(root, relativeDirectory);
  await mkdir(replacementDirectory, {recursive: true});
  const replacementTarget = path.join(replacementDirectory, relativeTarget);
  await writeFile(replacementTarget, "original\n", "utf8");
  return replacementTarget;
}

test("root replacement before temp creation is rejected and leaves the external target untouched", async (t) => {
  const root = await repository(t);
  const target = path.join(root, "AGENTS.md");
  await writeFile(target, "original\n", "utf8");
  const prepared = await prepareInstructionLink({repositoryRoot: root});
  assert.equal(prepared.status, "ready");
  if (prepared.status !== "ready") return;
  t.after(async () => { instructionLinkTestHooks.beforeTempCreate = undefined; });
  let swapped = false;
  instructionLinkTestHooks.beforeTempCreate = async (repositoryRoot) => {
    if (swapped) return;
    swapped = true;
    await swapDirectoryKeepingTarget(repositoryRoot, ".", "AGENTS.md", t);
  };
  const result = await applyInstructionLink({
    repositoryRoot: root,
    instructionPath: prepared.instructionPath,
    expectedHash: prepared.expectedHash
  });
  assert.equal(result.status, "failure");
  if (result.status === "failure") assert.equal(result.code, "hash-conflict");
  assert.equal((await readFile(target)).toString("utf8"), "original\n");
  assert.doesNotMatch((await readFile(target)).toString("utf8"), /portable-codebase-index/);
});

test("an ancestor exchanged during root realpath cannot redirect a descriptor write", async (t) => {
  const container = await repository(t);
  const root = path.join(container, "repository");
  await mkdir(root);
  await writeFile(path.join(root, "AGENTS.md"), "original\n", "utf8");
  const outside = await repository(t);
  await mkdir(path.join(outside, "repository"));
  const outsideTarget = path.join(outside, "repository", "AGENTS.md");
  await writeFile(outsideTarget, "outside\n", "utf8");
  const prepared = await prepareInstructionLink({repositoryRoot: root});
  assert.equal(prepared.status, "ready");
  if (prepared.status !== "ready") return;

  const originalRealpath = fs.realpath;
  const oldContainer = `${container}.original`;
  let swapped = false;
  fs.realpath = async function(target: Parameters<typeof fs.realpath>[0], ...args: Parameters<typeof fs.realpath> extends [unknown, ...infer Rest] ? Rest : never) {
    if (!swapped && path.resolve(String(target)) === root) {
      swapped = true;
      await rename(container, oldContainer);
      await symlink(outside, container);
    }
    return Reflect.apply(originalRealpath, fs, [target, ...args] as Parameters<typeof fs.realpath>);
  } as typeof fs.realpath;
  syncBuiltinESMExports();
  try {
    const result = await applyInstructionLink({repositoryRoot: root, instructionPath: prepared.instructionPath, expectedHash: prepared.expectedHash});
    assert.equal(swapped, true);
    assert.equal(result.status, "failure");
    assert.deepEqual(await readFile(outsideTarget), Buffer.from("outside\n"));
  } finally {
    fs.realpath = originalRealpath;
    syncBuiltinESMExports();
    await rm(oldContainer, {recursive: true, force: true});
  }
});

test("ancestor replacement before final recheck is rejected and leaves the external target untouched", async (t) => {
  const root = await repository(t);
  const directory = path.join(root, "docs");
  await mkdir(directory);
  const target = path.join(directory, "AGENTS.md");
  await writeFile(target, "original\n", "utf8");
  const prepared = await prepareInstructionLink({repositoryRoot: root, instructionPath: "docs/AGENTS.md"});
  assert.equal(prepared.status, "ready");
  if (prepared.status !== "ready") return;
  t.after(async () => { instructionLinkTestHooks.beforeFinalRecheck = undefined; });
  let swapped = false;
  instructionLinkTestHooks.beforeFinalRecheck = async (repositoryRoot) => {
    if (swapped) return;
    swapped = true;
    await swapDirectoryKeepingTarget(repositoryRoot, "docs", "AGENTS.md", t);
  };
  const result = await applyInstructionLink({
    repositoryRoot: root,
    instructionPath: prepared.instructionPath,
    expectedHash: prepared.expectedHash
  });
  assert.equal(result.status, "failure");
  if (result.status === "failure") assert.equal(result.code, "hash-conflict");
  assert.equal((await readFile(path.join(root, "docs", "AGENTS.md"))).toString("utf8"), "original\n");
  assert.doesNotMatch((await readFile(path.join(root, "docs", "AGENTS.md"))).toString("utf8"), /portable-codebase-index/);
});
