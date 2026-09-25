import {execFile as execFileCallback} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdtemp, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {promisify} from "node:util";
import assert from "node:assert/strict";
import test from "node:test";

import {
  extractionTestHooks,
  extractPortableRepository
} from "../src/mcp/codebase-index/extraction.js";
import {
  createPortableIncrementalCache,
  extractPortableRepositoryIncremental,
  incrementalTestHooks,
  invalidatePortableSemanticModel,
  parsePortableIncrementalCache
} from "../src/mcp/codebase-index/incremental.js";
import type {PortableAcceptedSemanticModel} from "../src/mcp/codebase-index/contracts.js";

const execFile = promisify(execFileCallback);

async function git(root: string, ...args: string[]): Promise<void> {
  await execFile("git", args, {cwd: root});
}

async function fixture(t: {after: (fn: () => Promise<void>) => void}): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "blueprint-portable-incremental-"));
  t.after(async () => rm(root, {recursive: true, force: true}));
  await git(root, "init", "--quiet");
  await git(root, "config", "user.email", "codex@example.invalid");
  await git(root, "config", "user.name", "Codex");
  await writeFile(path.join(root, "app.ts"), 'import {value} from "./target"; export function run() { return value; }\n', "utf8");
  await writeFile(path.join(root, "target.ts"), "export const value = 1;\n", "utf8");
  await git(root, "add", ".");
  await git(root, "commit", "--quiet", "-m", "initial incremental fixture");
  return root;
}

async function commit(root: string, message: string): Promise<void> {
  await git(root, "add", ".");
  await git(root, "commit", "--quiet", "-m", message);
}

function structuralWithoutGeneration(value: {structuralShards: readonly unknown[]; sourceBasis: unknown}): string {
  const shards = value.structuralShards.map(shard => {
    const copy = structuredClone(shard) as {generationId?: string};
    delete copy.generationId;
    return copy;
  });
  const source = structuredClone(value.sourceBasis) as {generationId?: string};
  delete source.generationId;
  return JSON.stringify({shards, source});
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

test("unchanged refresh reuses records and makes zero adapter calls", async t => {
  const root = await fixture(t);
  extractionTestHooks.adapterCalls = 0;
  const cold = await extractPortableRepository({repositoryRoot: root, generationId: "cold"});
  assert.equal(cold.ok, true);
  if (!cold.ok) throw new Error("cold extraction failed");
  const cache = createPortableIncrementalCache(cold);

  extractionTestHooks.adapterCalls = 0;
  const refreshed = await extractPortableRepositoryIncremental({repositoryRoot: root, generationId: "warm", previous: cache});
  assert.equal(refreshed.ok, true);
  if (!refreshed.ok) throw new Error("incremental extraction failed");
  assert.equal(refreshed.incremental.reason, "unchanged");
  assert.equal(refreshed.incremental.counters.filesReused, 2);
  assert.equal(refreshed.incremental.counters.filesParsed, 0);
  assert.equal(extractionTestHooks.adapterCalls, 0);
  assert.equal(structuralWithoutGeneration(cold), structuralWithoutGeneration(refreshed));
});

test("changed source reparses only the changed file and remains cold-equivalent", async t => {
  const root = await fixture(t);
  const cold = await extractPortableRepository({repositoryRoot: root, generationId: "before"});
  assert.equal(cold.ok, true);
  if (!cold.ok) throw new Error("cold extraction failed");
  await writeFile(path.join(root, "target.ts"), "export const value = 2;\n", "utf8");
  await commit(root, "change target");
  extractionTestHooks.adapterCalls = 0;
  const refreshed = await extractPortableRepositoryIncremental({
    repositoryRoot: root,
    generationId: "after",
    previous: createPortableIncrementalCache(cold)
  });
  assert.equal(refreshed.ok, true);
  if (!refreshed.ok) throw new Error("incremental extraction failed");
  assert.equal(refreshed.incremental.reason, "source-changed");
  assert.equal(refreshed.incremental.counters.filesChanged, 1);
  assert.equal(refreshed.incremental.counters.filesReused, 1);
  assert.equal(extractionTestHooks.adapterCalls, 1);
  const full = await extractPortableRepository({repositoryRoot: root, generationId: "full"});
  assert.equal(full.ok, true);
  if (!full.ok) throw new Error("cold refresh failed");
  assert.equal(structuralWithoutGeneration(full), structuralWithoutGeneration(refreshed));
});

test("new and deleted targets reparse importers and never retain dangling target ids", async t => {
  const root = await fixture(t);
  await rm(path.join(root, "target.ts"));
  await commit(root, "remove target");
  const before = await extractPortableRepository({repositoryRoot: root, generationId: "missing"});
  assert.equal(before.ok, true);
  if (!before.ok) throw new Error("cold extraction failed");
  const missing = before.structuralShards.flatMap(shard => shard.imports).find(item => item.sourcePath === "app.ts" && item.specifier === "./target");
  assert.equal(missing?.resolutionStatus, "unresolved");

  await writeFile(path.join(root, "target.ts"), "export const value = 3;\n", "utf8");
  await commit(root, "restore target");
  extractionTestHooks.adapterCalls = 0;
  const restored = await extractPortableRepositoryIncremental({repositoryRoot: root, generationId: "resolved", previous: createPortableIncrementalCache(before)});
  assert.equal(restored.ok, true);
  if (!restored.ok) throw new Error("incremental extraction failed");
  assert.equal(restored.incremental.reason, "inventory-scope-changed");
  assert.ok(restored.incremental.counters.importerFilesReparsed >= 1);
  assert.equal(extractionTestHooks.adapterCalls, 2);
  const imported = restored.structuralShards.flatMap(shard => shard.imports).find(item => item.sourcePath === "app.ts" && item.specifier === "./target");
  assert.equal(imported?.resolutionStatus, "resolved");
  assert.ok(imported?.targetFileId);
  assert.equal(imported?.targetFileId, restored.structuralShards.flatMap(shard => shard.files).find(file => file.path === "target.ts")?.id);
});

test("renamed targets rebind importer relationships to the new file identity", async t => {
  const root = await fixture(t);
  const cold = await extractPortableRepository({repositoryRoot: root, generationId: "before-rename"});
  assert.equal(cold.ok, true);
  if (!cold.ok) throw new Error("cold extraction failed");
  await git(root, "mv", "target.ts", "renamed.ts");
  await writeFile(path.join(root, "app.ts"), 'import {value} from "./renamed"; export function run() { return value; }\n', "utf8");
  await commit(root, "rename target");
  const result = await extractPortableRepositoryIncremental({repositoryRoot: root, generationId: "after-rename", previous: createPortableIncrementalCache(cold)});
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("rename refresh failed");
  const imported = result.structuralShards.flatMap(shard => shard.imports).find(item => item.sourcePath === "app.ts" && item.specifier === "./renamed");
  const target = result.structuralShards.flatMap(shard => shard.files).find(item => item.path === "renamed.ts");
  assert.equal(imported?.resolutionStatus, "resolved");
  assert.equal(imported?.targetFileId, target?.id);
  assert.equal(result.structuralShards.flatMap(shard => shard.files).some(item => item.path === "target.ts"), false);
});

test("invalid cache falls back to a cold extraction with fixed reason", async t => {
  const root = await fixture(t);
  const cold = await extractPortableRepository({repositoryRoot: root, generationId: "cold"});
  assert.equal(cold.ok, true);
  if (!cold.ok) throw new Error("cold extraction failed");
  const cache = createPortableIncrementalCache(cold);
  const corrupt = {...cache, provenanceHash: "0".repeat(64)};
  assert.equal(parsePortableIncrementalCache(corrupt), null);
  extractionTestHooks.adapterCalls = 0;
  const result = await extractPortableRepositoryIncremental({repositoryRoot: root, generationId: "fallback", previous: corrupt});
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("fallback extraction failed");
  assert.equal(result.incremental.reason, "invalid-cache");
  assert.equal(result.incremental.counters.cacheAccepted, false);
  assert.equal(result.incremental.counters.filesReused, 0);
  assert.equal(extractionTestHooks.adapterCalls, 2);
});

test("a recomputed cache checksum cannot authorize fabricated structural records", async t => {
  const root = await fixture(t);
  const cold = await extractPortableRepository({repositoryRoot: root, generationId: "cold"});
  assert.equal(cold.ok, true);
  if (!cold.ok) throw new Error("cold extraction failed");
  const cache = createPortableIncrementalCache(cold);
  const forgedPayload = structuredClone(cache) as Record<string, unknown>;
  forgedPayload.structuralShards = (forgedPayload.structuralShards as Array<Record<string, unknown>>).map(shard => ({
    ...shard,
    symbols: [], imports: [], relationships: [], details: []
  }));
  delete forgedPayload.cacheHash;
  const forged = {...forgedPayload, cacheHash: createHash("sha256").update(canonical(forgedPayload), "utf8").digest("hex")};
  assert.equal(parsePortableIncrementalCache(forged), null);
  extractionTestHooks.adapterCalls = 0;
  const result = await extractPortableRepositoryIncremental({repositoryRoot: root, generationId: "forged", previous: forged});
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("forged cache fallback failed");
  assert.equal(result.incremental.reason, "invalid-cache");
  assert.equal(result.incremental.counters.cacheAccepted, false);
  assert.equal(result.incremental.counters.filesReused, 0);
  assert.equal(extractionTestHooks.adapterCalls, 2);
});

test("provenance drift disables reuse even when source bytes are unchanged", async t => {
  const root = await fixture(t);
  const cold = await extractPortableRepository({repositoryRoot: root, generationId: "cold"});
  assert.equal(cold.ok, true);
  if (!cold.ok) throw new Error("cold extraction failed");
  incrementalTestHooks.provenanceOverride = {
    ...cold.provenance,
    runtime: {...cold.provenance.runtime, version: `${cold.provenance.runtime.version}-drift`}
  };
  extractionTestHooks.adapterCalls = 0;
  try {
    const result = await extractPortableRepositoryIncremental({repositoryRoot: root, generationId: "drift", previous: createPortableIncrementalCache(cold)});
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error("provenance fallback failed");
    assert.equal(result.incremental.reason, "provenance-drift");
    assert.equal(result.incremental.counters.filesReused, 0);
    assert.equal(extractionTestHooks.adapterCalls, 2);
  } finally {
    incrementalTestHooks.provenanceOverride = undefined;
  }
});

test("unsupported and oversized files stay file-level without a parser call", async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, "notes.sql"), "select 1;\n", "utf8");
  await writeFile(path.join(root, "large.ts"), "a".repeat(1_048_577), "utf8");
  await commit(root, "add file-level sources");
  const cold = await extractPortableRepository({repositoryRoot: root, generationId: "cold"});
  assert.equal(cold.ok, true);
  if (!cold.ok) throw new Error("cold extraction failed");
  await writeFile(path.join(root, "large.ts"), "b".repeat(1_048_577), "utf8");
  await commit(root, "change oversized source");
  extractionTestHooks.adapterCalls = 0;
  const result = await extractPortableRepositoryIncremental({repositoryRoot: root, generationId: "large", previous: createPortableIncrementalCache(cold)});
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("incremental extraction failed");
  assert.equal(result.incremental.counters.filesParsed, 0);
  assert.equal(extractionTestHooks.adapterCalls, 0);
  const files = result.structuralShards.flatMap(shard => shard.files);
  assert.deepEqual(files.find(file => file.path === "notes.sql") && [files.find(file => file.path === "notes.sql")!.parseStatus, files.find(file => file.path === "notes.sql")!.limitationReason], ["unsupported", "unsupported-language"]);
  assert.deepEqual(files.find(file => file.path === "large.ts") && [files.find(file => file.path === "large.ts")!.parseStatus, files.find(file => file.path === "large.ts")!.limitationReason], ["skipped", "too-large"]);
});

test("semantic invalidation closes evidence, claim, capability, and alias dependencies", () => {
  const model: PortableAcceptedSemanticModel = {
    claims: [{id: "claim-a", basis: "observed", statement: "A", evidence: [{kind: "file", path: "app.ts", recordId: "file-app", contentHash: "a".repeat(64)}]}],
    capabilities: [{id: "cap-a", name: "A", summary: "A", claimIds: ["claim-a"], evidence: [{kind: "file", path: "app.ts", recordId: "file-app", contentHash: "a".repeat(64)}]}],
    aliases: [{id: "alias-a", alias: "A", targetKind: "capability", targetId: "cap-a", evidence: [{kind: "file", path: "app.ts", recordId: "file-app", contentHash: "a".repeat(64)}]}]
  };
  const invalidated = invalidatePortableSemanticModel(model, {changedPaths: new Set(["app.ts"])});
  assert.deepEqual(invalidated.invalidatedClaimIds, ["claim-a"]);
  assert.deepEqual(invalidated.invalidatedCapabilityIds, ["cap-a"]);
  assert.deepEqual(invalidated.invalidatedAliasIds, ["alias-a"]);
  assert.deepEqual(invalidated.model, {claims: [], capabilities: [], aliases: []});
  assert.ok(invalidated.reasons.includes("evidence-changed"));
  assert.ok(invalidated.reasons.includes("dependency-closure"));
});

test("a reused file changed during incremental work is rejected by final inventory verification", async t => {
  const root = await fixture(t);
  const cold = await extractPortableRepository({repositoryRoot: root, generationId: "cold"});
  assert.equal(cold.ok, true);
  if (!cold.ok) throw new Error("cold extraction failed");
  await writeFile(path.join(root, "target.ts"), "export const value = 4;\n", "utf8");
  await commit(root, "change target for race");
  extractionTestHooks.beforeAdapter = async sourcePath => {
    if (sourcePath === "target.ts") await writeFile(path.join(root, "app.ts"), 'import {value} from "./target"; export function run() { return value + 1; }\n', "utf8");
  };
  try {
    const result = await extractPortableRepositoryIncremental({repositoryRoot: root, generationId: "race", previous: createPortableIncrementalCache(cold)});
    assert.equal(result.ok, false);
    if (result.ok) throw new Error("expected source race failure");
    assert.equal(result.diagnostics[0]?.code, "source-mismatch");
  } finally {
    extractionTestHooks.beforeAdapter = undefined;
  }
});

test("inventory scope changes conservatively invalidate semantic records", async t => {
  const root = await fixture(t);
  const cold = await extractPortableRepository({repositoryRoot: root, generationId: "cold"});
  assert.equal(cold.ok, true);
  if (!cold.ok) throw new Error("cold extraction failed");
  const file = cold.structuralShards.flatMap(shard => shard.files).find(item => item.path === "app.ts");
  assert.ok(file);
  const semantic: PortableAcceptedSemanticModel = {
    claims: [{id: "claim-scope", basis: "unknown", statement: "scope", evidence: [{kind: "file", path: "app.ts", recordId: file!.id, contentHash: file!.contentHash}]}],
    capabilities: [{id: "cap-scope", name: "Scope", summary: "Scope", claimIds: ["claim-scope"], evidence: [{kind: "file", path: "app.ts", recordId: file!.id, contentHash: file!.contentHash}]}],
    aliases: []
  };
  await writeFile(path.join(root, "new.ts"), "export const added = true;\n", "utf8");
  await commit(root, "add scope file");
  const result = await extractPortableRepositoryIncremental({repositoryRoot: root, generationId: "scope", previous: createPortableIncrementalCache(cold, semantic)});
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("incremental extraction failed");
  assert.ok(result.incremental.semantic.reasons.includes("inventory-scope"));
  assert.deepEqual(result.incremental.semantic.invalidatedCapabilityIds, ["cap-scope"]);
});
