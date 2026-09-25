import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdtemp, mkdir, readFile, rename, rm, symlink, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  DEFAULT_PARSER_SOURCE_MAX_BYTES,
  PARSER_SOURCE_READ_CHUNK_BYTES,
  parserSourceTestHooks,
  withParserSource,
  type ParserSourceBasis
} from "../src/mcp/codebase-index/parser-source.js";

function hash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function fixture(t: {after: (fn: () => Promise<void>) => void}): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "blueprint-parser-source-"));
  t.after(async () => rm(root, {recursive: true, force: true}));
  await mkdir(path.join(root, "src"), {recursive: true});
  return root;
}

async function basisFor(root: string, relativePath: string): Promise<ParserSourceBasis> {
  const bytes = await readFile(path.join(root, relativePath));
  return {path: relativePath, byteSize: bytes.byteLength, contentHash: hash(bytes)};
}

test("reads exact inventory bytes, preserving BOM, CRLF, and astral UTF-8", async (t) => {
  const root = await fixture(t);
  const bytes = Buffer.from("\uFEFFexport const smile = '🙂';\r\n", "utf8");
  await writeFile(path.join(root, "src", "exact.ts"), bytes);
  const basis = await basisFor(root, "src/exact.ts");
  let seen: Uint8Array | undefined;
  const result = await withParserSource(root, basis, source => {
    seen = source;
    return {sameLength: source.byteLength, sameBytes: Buffer.from(source).equals(bytes)};
  });
  assert.deepEqual(result, {
    ok: true,
    status: "accepted",
    result: {sameLength: bytes.byteLength, sameBytes: true},
    metadata: basis
  });
  assert.ok(seen);
  assert.equal(seen!.every(byte => byte === 0), true);
});

test("rejects stale size and hash without invoking the callback", async (t) => {
  const root = await fixture(t);
  const file = path.join(root, "src", "stale.ts");
  await writeFile(file, "export const value = 1;\n", "utf8");
  const basis = await basisFor(root, "src/stale.ts");
  await writeFile(file, "export const value = 999;\n", "utf8");
  let calls = 0;
  const staleSize = await withParserSource(root, basis, () => { calls += 1; });
  assert.equal(staleSize.ok, false);
  if (!staleSize.ok) assert.equal(staleSize.diagnostic.reason, "size-mismatch");
  assert.equal(calls, 0);

  const freshBasis = await basisFor(root, "src/stale.ts");
  const staleHash = {...freshBasis, contentHash: "0".repeat(64)};
  const hashResult = await withParserSource(root, staleHash, () => { calls += 1; });
  assert.equal(hashResult.ok, false);
  if (!hashResult.ok) assert.equal(hashResult.diagnostic.reason, "hash-mismatch");
  assert.equal(calls, 0);
});

test("rejects target and ancestor symlinks, nonregular, and missing paths", async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, "src", "regular.ts"), "export const regular = true;\n", "utf8");
  const regular = await basisFor(root, "src/regular.ts");
  await symlink(path.join(root, "src", "regular.ts"), path.join(root, "src", "target-link.ts"));
  const targetLink = await withParserSource(root, {...regular, path: "src/target-link.ts"}, () => true);
  assert.equal(targetLink.ok, false);
  if (!targetLink.ok) assert.equal(targetLink.diagnostic.reason, "symlink");

  await symlink(path.join(root, "src"), path.join(root, "linked"));
  const ancestorLink = await withParserSource(root, {...regular, path: "linked/regular.ts"}, () => true);
  assert.equal(ancestorLink.ok, false);
  if (!ancestorLink.ok) assert.equal(ancestorLink.diagnostic.reason, "symlink");

  const directoryBasis = {...regular, path: "src"};
  const directory = await withParserSource(root, directoryBasis, () => true);
  assert.equal(directory.ok, false);
  if (!directory.ok) assert.equal(directory.diagnostic.reason, "not-a-regular-file");
  const missing = await withParserSource(root, {...regular, path: "src/missing.ts"}, () => true);
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.diagnostic.reason, "missing");
});

test("rejects large, binary, and invalid UTF-8 input before callback", async (t) => {
  const root = await fixture(t);
  const large = Buffer.alloc(DEFAULT_PARSER_SOURCE_MAX_BYTES + 1, 0x61);
  await writeFile(path.join(root, "src", "large.ts"), large);
  const largeResult = await withParserSource(root, await basisFor(root, "src/large.ts"), () => true);
  assert.equal(largeResult.ok, false);
  if (!largeResult.ok) assert.equal(largeResult.diagnostic.reason, "too-large");

  const binary = Buffer.from([0x65, 0x78, 0x00, 0x70]);
  await writeFile(path.join(root, "src", "binary.ts"), binary);
  const binaryResult = await withParserSource(root, await basisFor(root, "src/binary.ts"), () => true);
  assert.equal(binaryResult.ok, false);
  if (!binaryResult.ok) assert.equal(binaryResult.diagnostic.reason, "binary");

  const invalid = Buffer.from([0x65, 0x78, 0xff, 0x70]);
  await writeFile(path.join(root, "src", "invalid.ts"), invalid);
  const invalidResult = await withParserSource(root, await basisFor(root, "src/invalid.ts"), () => true);
  assert.equal(invalidResult.ok, false);
  if (!invalidResult.ok) assert.equal(invalidResult.diagnostic.reason, "invalid-utf8");
});

test("rejects malformed metadata and a cap above the fixed default", async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, "src", "metadata.ts"), "export const ok = true;\n", "utf8");
  const basis = await basisFor(root, "src/metadata.ts");
  let calls = 0;
  const malformed = await withParserSource(root, {...basis, contentHash: "not-a-hash"}, () => { calls += 1; });
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.diagnostic.reason, "invalid-metadata");
  const cap = await withParserSource(root, basis, () => { calls += 1; }, {maxBytes: DEFAULT_PARSER_SOURCE_MAX_BYTES + 1});
  assert.equal(cap.ok, false);
  if (!cap.ok) assert.equal(cap.diagnostic.reason, "invalid-metadata");
  assert.equal(calls, 0);
});

test("honors a lower cap and never opens excluded source locations", async (t) => {
  const root = await fixture(t);
  const bytes = Buffer.from("export const small = true;\n", "utf8");
  await writeFile(path.join(root, "src", "small.ts"), bytes);
  const basis = await basisFor(root, "src/small.ts");
  const frozenBasis = Object.freeze({...basis});
  const frozenOptions = Object.freeze({maxBytes: bytes.byteLength});
  const accepted = await withParserSource(root, frozenBasis, source => Buffer.from(source).equals(bytes), frozenOptions);
  assert.equal(accepted.ok, true);
  assert.deepEqual(frozenBasis, basis);
  assert.deepEqual(frozenOptions, {maxBytes: bytes.byteLength});

  const tooSmall = await withParserSource(root, basis, () => true, {maxBytes: bytes.byteLength - 1});
  assert.equal(tooSmall.ok, false);
  if (!tooSmall.ok) assert.equal(tooSmall.diagnostic.reason, "too-large");

  await writeFile(path.join(root, ".env.local"), bytes);
  await mkdir(path.join(root, ".blueprint"), {recursive: true});
  await writeFile(path.join(root, ".blueprint", "state.ts"), bytes);
  await mkdir(path.join(root, "node_modules", "pkg"), {recursive: true});
  await writeFile(path.join(root, "node_modules", "pkg", "index.ts"), bytes);
  await mkdir(path.join(root, "dist"), {recursive: true});
  await writeFile(path.join(root, "dist", "bundle.ts"), bytes);
  for (const excludedPath of [".env.local", ".blueprint/state.ts", "node_modules/pkg/index.ts", "dist/bundle.ts"]) {
    const excluded = await withParserSource(root, {...basis, path: excludedPath}, () => true);
    assert.equal(excluded.ok, false);
    if (!excluded.ok) assert.equal(excluded.diagnostic.reason, "unsafe-path");
  }
});

test("rejects deterministic replacement, in-place mutation, and root changes during read", async (t) => {
  const root = await fixture(t);
  const original = Buffer.alloc(PARSER_SOURCE_READ_CHUNK_BYTES * 2, 0x61);
  const file = path.join(root, "src", "race.ts");
  await writeFile(file, original);
  const basis = await basisFor(root, "src/race.ts");
  t.after(async () => { parserSourceTestHooks.afterChunk = undefined; });

  parserSourceTestHooks.afterChunk = async (_absolutePath, chunkIndex) => {
    if (chunkIndex !== 0) return;
    await writeFile(file, Buffer.alloc(original.byteLength, 0x62));
    parserSourceTestHooks.afterChunk = undefined;
  };
  let calls = 0;
  const mutation = await withParserSource(root, basis, () => { calls += 1; });
  assert.equal(mutation.ok, false);
  if (!mutation.ok) assert.equal(mutation.diagnostic.reason, "changed-during-read");
  assert.equal(calls, 0);

  await writeFile(file, original);
  parserSourceTestHooks.afterChunk = async (_absolutePath, chunkIndex) => {
    if (chunkIndex !== 0) return;
    const replacement = path.join(root, "src", "replacement.ts");
    await writeFile(replacement, original);
    await rename(replacement, file);
    parserSourceTestHooks.afterChunk = undefined;
  };
  const replacement = await withParserSource(root, basis, () => { calls += 1; });
  assert.equal(replacement.ok, false);
  if (!replacement.ok) assert.equal(replacement.diagnostic.reason, "changed-during-read");
  assert.equal(calls, 0);

  await writeFile(file, original);
  parserSourceTestHooks.afterChunk = async (_absolutePath, chunkIndex) => {
    if (chunkIndex !== 0) return;
    await rename(path.join(root, "src"), path.join(root, "src-old"));
    parserSourceTestHooks.afterChunk = undefined;
  };
  const rootChange = await withParserSource(root, basis, () => { calls += 1; });
  assert.equal(rootChange.ok, false);
  if (!rootChange.ok) assert.equal(rootChange.diagnostic.reason, "changed-during-read");
  assert.equal(calls, 0);
});

test("returns fixed callback failure and zeroes the transient bytes", async (t) => {
  const root = await fixture(t);
  const bytes = Buffer.from("export const callback = true;\n", "utf8");
  await writeFile(path.join(root, "src", "callback.ts"), bytes);
  const basis = await basisFor(root, "src/callback.ts");
  let retained: Uint8Array | undefined;
  const result = await withParserSource(root, basis, source => {
    retained = source;
    throw new Error(`raw source must not echo: ${Buffer.from(source).toString("utf8")}`);
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.diagnostic.reason, "callback-failed");
    assert.equal(result.diagnostic.message, "The parser extraction callback failed.");
    assert.doesNotMatch(JSON.stringify(result), /callback must not echo/);
    assert.doesNotMatch(JSON.stringify(result), /export const callback/);
  }
  assert.ok(retained);
  assert.equal(retained!.every(byte => byte === 0), true);
});
