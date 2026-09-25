import {execFile as execFileCallback} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdtemp, readFile, realpath, rm, stat, symlink, unlink, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {promisify} from "node:util";
import assert from "node:assert/strict";
import test from "node:test";

import {blueprintPortableMapPrepare} from "../src/mcp/codebase-index/map-coordinator.js";
import {portableOperationTestHooks} from "../src/mcp/codebase-index/operations.js";

const execFile = promisify(execFileCallback);
const CACHE_FILE = ".blueprint/codebase-incremental/cache.json";

async function git(root: string, ...args: string[]): Promise<void> {
  await execFile("git", args, {cwd: root});
}

async function fixture(t: {after: (fn: () => Promise<void>) => void}): Promise<string> {
  const tempRoot = await realpath(os.tmpdir());
  const root = await mkdtemp(path.join(tempRoot, "blueprint-portable-public-incremental-"));
  t.after(async () => rm(root, {recursive: true, force: true}));
  await git(root, "init", "--quiet");
  await git(root, "config", "user.email", "codex@example.invalid");
  await git(root, "config", "user.name", "Codex");
  await writeFile(path.join(root, "app.ts"), 'import {value} from "./target"; export function run() { return value; }\n');
  await writeFile(path.join(root, "target.ts"), 'export const value = "REJECTED_AUTHORED_SENTINEL";\n');
  await git(root, "add", ".");
  await git(root, "commit", "--quiet", "-m", "public incremental fixture");
  return root;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

async function childRefresh(root: string): Promise<{calls: number; reason: string; parsed: number; reused: number}> {
  const moduleUrl = new URL("../src/mcp/codebase-index/map-coordinator.ts", import.meta.url).href;
  const extractionUrl = new URL("../src/mcp/codebase-index/extraction.ts", import.meta.url).href;
  const script = `
    const {blueprintPortableMapPrepare} = await import(${JSON.stringify(moduleUrl)});
    const {extractionTestHooks} = await import(${JSON.stringify(extractionUrl)});
    extractionTestHooks.adapterCalls = 0;
    const result = await blueprintPortableMapPrepare({cwd: process.argv[1], formatVersion: 1});
    console.log(JSON.stringify({calls: extractionTestHooks.adapterCalls, reason: result.incremental?.reason, parsed: result.incremental?.counters?.filesParsed, reused: result.incremental?.counters?.filesReused}));
  `;
  const {stdout} = await execFile(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", script, root], {cwd: path.resolve(".")});
  const line = stdout.trim().split(/\r?\n/).at(-1);
  assert.ok(line);
  return JSON.parse(line!) as {calls: number; reason: string; parsed: number; reused: number};
}

test("public prepare persists authenticated cache and reuses it after a fresh process", async t => {
  const root = await fixture(t);
  const first = await blueprintPortableMapPrepare({cwd: root, formatVersion: 1});
  assert.equal(first.status, "ready", JSON.stringify(first));
  assert.equal(first.incremental.reason, "no-cache");
  assert.equal(first.incremental.counters.cacheAccepted, false);
  const refreshed = await childRefresh(root);
  assert.equal(refreshed.reason, "unchanged");
  assert.equal(refreshed.calls, 0);
  assert.equal(refreshed.parsed, 0);
  assert.equal(refreshed.reused, 2);
});

test("recomputed cache hashes without the runtime authentication tag force cold extraction", async t => {
  const root = await fixture(t);
  const first = await blueprintPortableMapPrepare({cwd: root, formatVersion: 1});
  assert.equal(first.status, "ready", JSON.stringify(first));
  const cachePath = path.join(root, CACHE_FILE);
  const envelope = JSON.parse(await readFile(cachePath, "utf8")) as {cache: Record<string, unknown>; authTag: string};
  const cache = envelope.cache;
  cache.structuralShards = (cache.structuralShards as Array<Record<string, unknown>>).map(shard => ({...shard, symbols: [], imports: [], relationships: [], details: []}));
  const {cacheHash: _ignored, ...payload} = cache as Record<string, unknown>;
  cache.cacheHash = sha256(payload);
  await writeFile(cachePath, `${JSON.stringify(envelope)}\n`, "utf8");
  const refreshed = await childRefresh(root);
  assert.equal(refreshed.calls, 2);
  assert.equal(refreshed.parsed, 2);
  assert.equal(refreshed.reused, 0);
});

test("operational cache omits source bodies and authored rejection content", async t => {
  const root = await fixture(t);
  const result = await blueprintPortableMapPrepare({cwd: root, formatVersion: 1});
  assert.equal(result.status, "ready", JSON.stringify(result));
  const persisted = await readFile(path.join(root, CACHE_FILE), "utf8");
  assert.doesNotMatch(persisted, /REJECTED_AUTHORED_SENTINEL/);
});

test("cache key stays owner-only across concurrent writers", async t => {
  const root = await fixture(t);
  const results = await Promise.all([
    blueprintPortableMapPrepare({cwd: root, formatVersion: 1}),
    blueprintPortableMapPrepare({cwd: root, formatVersion: 1})
  ]);
  assert.equal(results.every(result => result.status === "ready"), true, JSON.stringify(results));
  const key = await stat(path.join(root, ".blueprint", "codebase-incremental", "key.json"));
  assert.equal(key.mode & 0o077, 0);
});

test("cache key replacement cannot chmod an outside file", async t => {
  const root = await fixture(t);
  const outside = await mkdtemp(path.join(await realpath(os.tmpdir()), "blueprint-cache-outside-"));
  t.after(async () => rm(outside, {recursive: true, force: true}));
  const target = path.join(outside, "untouched.txt");
  await writeFile(target, "outside mode must remain unchanged\n", {mode: 0o644});
  let swapped = false;
  portableOperationTestHooks.afterAtomicWrite = async relative => {
    if (!swapped && relative.endsWith("/codebase-incremental/key.json")) {
      swapped = true;
      const keyPath = path.join(root, relative);
      await unlink(keyPath);
      await symlink(target, keyPath);
    }
  };
  try {
    const result = await blueprintPortableMapPrepare({cwd: root, formatVersion: 1});
    assert.equal(result.status, "ready", JSON.stringify(result));
    assert.equal(swapped, true);
    const outsideStat = await stat(target);
    assert.equal(outsideStat.mode & 0o777, 0o644);
    assert.equal(await readFile(target, "utf8"), "outside mode must remain unchanged\n");
  } finally {
    delete portableOperationTestHooks.afterAtomicWrite;
  }
});
