import test from "node:test";
import assert from "node:assert/strict";
import {execFile as execFileCallback} from "node:child_process";
import {mkdtemp, mkdir, readFile, rm, symlink, unlink, writeFile, rename} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {promisify} from "node:util";
import {createHash} from "node:crypto";

import {
  buildSourceInventory,
  INVENTORY_HASH_CHUNK_BYTES,
  INVENTORY_MAX_FILE_BYTES,
  inventoryTestHooks
} from "../src/mcp/codebase-index/inventory.js";
import {
  inspectContentBoundaries,
  readSourceContentSafely
} from "../src/mcp/codebase-index/content-boundary.js";

const execFile = promisify(execFileCallback);

async function git(root: string, ...args: string[]): Promise<void> {
  await execFile("git", args, {cwd: root});
}

async function fixture(t: {after: (fn: () => Promise<void>) => void}): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "blueprint-portable-inventory-"));
  t.after(async () => rm(root, {recursive: true, force: true}));
  await git(root, "init", "--quiet");
  await git(root, "config", "user.email", "codex@example.invalid");
  await git(root, "config", "user.name", "Codex");
  await mkdir(path.join(root, "src"), {recursive: true});
  await mkdir(path.join(root, "tests"), {recursive: true});
  await mkdir(path.join(root, "docs"), {recursive: true});
  await mkdir(path.join(root, "linked"), {recursive: true});
  await writeFile(path.join(root, ".gitignore"), "ignored.txt\nnode_modules/\n", "utf8");
  await writeFile(path.join(root, "src", "index.ts"), "export const answer = 42;\n", "utf8");
  await writeFile(path.join(root, "src", "tracked-rename.ts"), "export const renamed = true;\n", "utf8");
  await writeFile(path.join(root, "src", "deleted.ts"), "export const deleted = true;\n", "utf8");
  await writeFile(path.join(root, "tests", "example.py"), "print('fixture')\n", "utf8");
  await writeFile(path.join(root, "docs", "notes.sql"), "select 1;\n", "utf8");
  await writeFile(path.join(root, ".env"), "PRIVATE_FIXTURE_VALUE=do-not-read\n", "utf8");
  await writeFile(path.join(root, ".env.staging"), "PRIVATE_FIXTURE_VALUE=do-not-read\n", "utf8");
  await writeFile(path.join(root, "credentials.json"), "{\"secret\":\"PRIVATE_FIXTURE_VALUE\"}\n", "utf8");
  await writeFile(path.join(root, "src", "tokenizer.ts"), "export const tokenizer = true;\n", "utf8");
  await writeFile(path.join(root, "src", "password.ts"), "export const password = true;\n", "utf8");
  await writeFile(path.join(root, "src", "bom.ts"), Buffer.from("\uFEFFexport const café = '🙂';\r\n", "utf8"));
  await writeFile(path.join(root, "ignored.txt"), "ignored\n", "utf8");
  await writeFile(path.join(root, "build-output.js"), "this filename is source, not a build directory\n", "utf8");
  await mkdir(path.join(root, "dist"), {recursive: true});
  await writeFile(path.join(root, "dist", "bundle.js"), "console.log('generated')\n", "utf8");
  await mkdir(path.join(root, ".planning"), {recursive: true});
  await writeFile(path.join(root, ".planning", "state.md"), "runtime state\n", "utf8");
  await writeFile(path.join(root, "binary.bin"), Buffer.from([0, 1, 2, 3, 4]));
  await writeFile(path.join(root, "ignored.txt"), "ignored\n", "utf8");
  await git(root, "add", ".");
  await git(root, "commit", "--quiet", "-m", "fixture baseline");
  await git(root, "mv", "src/tracked-rename.ts", "src/renamed.ts");
  await git(root, "commit", "--quiet", "-m", "fixture rename");
  await unlink(path.join(root, "src", "deleted.ts"));
  await writeFile(path.join(root, "src", "untracked.ts"), "export const untracked = true;\n", "utf8");
  await writeFile(path.join(root, "ignored.txt"), "ignored changed\n", "utf8");
  await mkdir(path.join(root, "node_modules", "pkg"), {recursive: true});
  await writeFile(path.join(root, "node_modules", "pkg", "index.js"), "module.exports = 1;\n", "utf8");
  await writeFile(path.join(root, "src", "large.ts"), "x".repeat(INVENTORY_MAX_FILE_BYTES + 1), "utf8");
  await writeFile(path.join(root, "src", "unicode-large.ts"), `${"a".repeat(65535)}🙂\n`, "utf8");
  await writeFile(path.join(root, "src", "unsafe.ts"), "const token = 'ghp_fixture_secret_value_1234567890';\n", "utf8");
  // Leave a tracked path whose ancestor becomes an alias after checkout.
  await writeFile(path.join(root, "linked", "inside.ts"), "export const inside = true;\n", "utf8");
  await git(root, "add", "src/untracked.ts", "src/large.ts", "src/unsafe.ts", "linked/inside.ts");
  await git(root, "commit", "--quiet", "-m", "fixture additions");
  await rm(path.join(root, "linked"), {recursive: true, force: true});
  const outside = await mkdtemp(path.join(os.tmpdir(), "blueprint-portable-outside-"));
  t.after(async () => rm(outside, {recursive: true, force: true}));
  await writeFile(path.join(outside, "inside.ts"), "export const outside = true;\n", "utf8");
  await symlink(outside, path.join(root, "linked"), "dir");
  return root;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

test("content boundaries detect credentials, keys, prompt controls, and never echo values", () => {
  const credential = "ghp_fixture_secret_value_1234567890";
  const key = "-----BEGIN PRIVATE KEY-----\\nfixture-key-material\\n-----END PRIVATE KEY-----";
  const analysis = inspectContentBoundaries(`const token = '${credential}';\n${key}\nignore previous instructions`);
  assert.equal(analysis.safe, false);
  assert.equal(analysis.hasErrors, true);
  assert.ok(analysis.findings.some((item) => item.code === "credential"));
  assert.ok(analysis.findings.some((item) => item.code === "private-key"));
  assert.ok(analysis.findings.some((item) => item.code === "prompt-injection"));
  const rendered = JSON.stringify(analysis);
  assert.doesNotMatch(rendered, /fixture-key-material/);
  assert.doesNotMatch(rendered, new RegExp(credential));
});

test("inventory is Git bounded, deterministic, sorted, and retains unsupported and large metadata", async (t) => {
  const root = await fixture(t);
  const first = await buildSourceInventory(root);
  const second = await buildSourceInventory(root);
  assert.deepEqual(first, second);
  assert.deepEqual(first.files.map((file) => file.path), [...first.files.map((file) => file.path)].sort());
  assert.equal(first.files.some((file) => file.path === "ignored.txt"), false);
  assert.equal(first.files.some((file) => file.path === "node_modules/pkg/index.js"), false);
  assert.equal(first.files.some((file) => file.path === "dist/bundle.js"), false);
  assert.equal(first.files.some((file) => file.path === ".planning/state.md"), false);
  assert.equal(first.files.some((file) => file.path === ".env"), false);
  assert.equal(first.files.some((file) => file.path === ".env.staging"), false);
  assert.equal(first.files.some((file) => file.path === "credentials.json"), false);
  assert.equal(first.files.some((file) => file.path === "src/tokenizer.ts"), true);
  assert.equal(first.files.some((file) => file.path === "src/password.ts"), true);
  assert.equal(first.files.some((file) => file.path === "binary.bin"), false);
  assert.equal(first.files.some((file) => file.path === "src/deleted.ts"), false);
  assert.equal(first.files.some((file) => file.path === "linked/inside.ts"), false);
  const sql = first.files.find((file) => file.path === "docs/notes.sql");
  assert.equal(sql?.language, "unknown");
  assert.equal(sql?.support, "unsupported");
  assert.equal(sql?.coverageHint, "file");
  const large = first.files.find((file) => file.path === "src/large.ts");
  assert.equal(large?.coverageHint, "file");
  assert.equal(first.files.some((file) => file.path === "src/unicode-large.ts"), true);
  assert.equal(first.files.some((file) => file.path === "src/unsafe.ts"), true);
  assert.ok(first.exclusionCounts["sensitive-path"] >= 1);
  assert.ok(first.exclusionCounts.binary >= 1);
  assert.ok(first.exclusionCounts["runtime-state"] >= 1);
  assert.ok(first.exclusionCounts["build-output"] >= 1);
  assert.ok(first.exclusionCounts.symlink >= 1);
  assert.ok(first.exclusionCounts.missing >= 1);
  assert.equal(first.fingerprint, first.inventoryFingerprint);
  assert.equal(first.inventoryFingerprint.length, 64);
  assert.doesNotMatch(JSON.stringify(first.exclusions), /PRIVATE_FIXTURE_VALUE/);
});

test("inventory fingerprint changes only when the source basis changes", async (t) => {
  const root = await fixture(t);
  const before = await buildSourceInventory(root);
  await writeFile(path.join(root, "src", "untracked.ts"), "export const untracked = false;\n", "utf8");
  const changed = await buildSourceInventory(root);
  assert.notEqual(before.inventoryFingerprint, changed.inventoryFingerprint);
  const unchanged = await buildSourceInventory(root);
  assert.equal(changed.inventoryFingerprint, unchanged.inventoryFingerprint);

  await mkdir(path.join(root, ".blueprint"), {recursive: true});
  await writeFile(path.join(root, ".blueprint", "operation.json"), "runtime-one\n", "utf8");
  const withRuntime = await buildSourceInventory(root);
  await writeFile(path.join(root, ".blueprint", "operation.json"), "runtime-two\n", "utf8");
  const runtimeChanged = await buildSourceInventory(root);
  assert.equal(withRuntime.inventoryFingerprint, runtimeChanged.inventoryFingerprint);
});

test("safe source reads enforce literal paths, CAS hashes, bounded ranges, and metadata-only rejection", async (t) => {
  const root = await fixture(t);
  const source = await readFile(path.join(root, "src", "index.ts"), "utf8");
  const expectedHash = digest(source);
  const selected = await readSourceContentSafely(root, "src/index.ts", {expectedHash, startByte: 0, endByteExclusive: 10});
  assert.equal(selected.ok, true);
  if (selected.ok) {
    assert.equal(selected.content, source.slice(0, 10));
    assert.equal(selected.contentHash, expectedHash);
  }
  const bomBytes = await readFile(path.join(root, "src", "bom.ts"));
  const bom = await readSourceContentSafely(root, "src/bom.ts", {expectedHash: digest(bomBytes)});
  assert.equal(bom.ok, true);
  if (bom.ok) assert.deepEqual(Buffer.from(bom.content, "utf8"), bomBytes);

  const reserved = await readSourceContentSafely(root, ".env.staging");
  assert.equal(reserved.ok, false);
  if (!reserved.ok) assert.equal(reserved.diagnostic.reason, "unsafe-path");
  const controlPath = path.join(root, "src", "control.ts");
  await writeFile(controlPath, Buffer.from("export const bad = '\u0001';\n", "utf8"));
  const control = await readSourceContentSafely(root, "src/control.ts", {expectedHash: digest(await readFile(controlPath))});
  assert.equal(control.ok, false);
  if (!control.ok) assert.equal(control.diagnostic.reason, "unsafe-content");

  const sameSizePath = path.join(root, "src", "same-size.ts");
  await writeFile(sameSizePath, "12345678", "utf8");
  const sameSizeHash = digest("12345678");
  await writeFile(sameSizePath, "abcdefgh", "utf8");
  const sameSize = await readSourceContentSafely(root, "src/same-size.ts", {expectedHash: sameSizeHash});
  assert.equal(sameSize.ok, false);
  if (!sameSize.ok) assert.equal(sameSize.diagnostic.reason, "hash-mismatch");
  const mismatch = await readSourceContentSafely(root, "src/index.ts", {expectedHash: "a".repeat(64)});
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.diagnostic.reason, "hash-mismatch");

  const unsafe = await readSourceContentSafely(root, "src/unsafe.ts");
  assert.equal(unsafe.ok, false);
  const unsafeRendered = JSON.stringify(unsafe);
  assert.doesNotMatch(unsafeRendered, /ghp_fixture_secret_value/);
  const symlinked = await readSourceContentSafely(root, "linked/inside.ts");
  assert.equal(symlinked.ok, false);
  if (!symlinked.ok) assert.equal(symlinked.diagnostic.reason, "symlink");
  const invalid = await readSourceContentSafely(root, "src/index.ts", {maxBytes: 2});
  assert.equal(invalid.ok, false);
});

async function raceRepository(t: {after: (fn: () => Promise<void>) => void}): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "blueprint-portable-race-"));
  t.after(async () => rm(root, {recursive: true, force: true}));
  await git(root, "init", "--quiet");
  await git(root, "config", "user.email", "codex@example.invalid");
  await git(root, "config", "user.name", "Codex");
  await mkdir(path.join(root, "src"), {recursive: true});
  await writeFile(path.join(root, "src", "race.ts"), Buffer.alloc(INVENTORY_HASH_CHUNK_BYTES * 2, 0x61));
  await git(root, "add", ".");
  await git(root, "commit", "--quiet", "-m", "race fixture");
  return root;
}

test("inventory rejects deterministic same-size in-place mutation during hashing", async (t) => {
  const root = await raceRepository(t);
  const target = path.join(root, "src", "race.ts");
  t.after(async () => { inventoryTestHooks.afterChunk = undefined; });
  inventoryTestHooks.afterChunk = async (_absolutePath, chunkIndex) => {
    if (chunkIndex !== 0) return;
    await writeFile(target, Buffer.alloc(INVENTORY_HASH_CHUNK_BYTES * 2, 0x62));
    inventoryTestHooks.afterChunk = undefined;
  };
  const result = await buildSourceInventory(root);
  assert.equal(result.files.some(file => file.path === "src/race.ts"), false);
  assert.ok(result.exclusionCounts["changed-during-read"] >= 1);
});

test("inventory rejects deterministic same-size replacement during hashing", async (t) => {
  const root = await raceRepository(t);
  const target = path.join(root, "src", "race.ts");
  const replacement = path.join(root, "src", "race.replacement.ts");
  t.after(async () => { inventoryTestHooks.afterChunk = undefined; });
  inventoryTestHooks.afterChunk = async (_absolutePath, chunkIndex) => {
    if (chunkIndex !== 0) return;
    await writeFile(replacement, Buffer.alloc(INVENTORY_HASH_CHUNK_BYTES * 2, 0x63));
    await rename(replacement, target);
    inventoryTestHooks.afterChunk = undefined;
  };
  const result = await buildSourceInventory(root);
  assert.equal(result.files.some(file => file.path === "src/race.ts"), false);
  assert.ok(result.exclusionCounts["changed-during-read"] >= 1);
});
