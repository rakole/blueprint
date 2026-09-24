import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import {execFile as execFileCallback} from "node:child_process";
import {promisify} from "node:util";

import {blueprintMapPrepare, blueprintMapSubmit} from "../src/mcp/tools/map.js";
import {readPortableOperationExtraction} from "../src/mcp/codebase-index/operations.js";
import {portableOperationTestHooks, readPortableOperationAcceptance, revalidatePortableOperation} from "../src/mcp/codebase-index/operations.js";
import {portablePublicationTestHooks} from "../src/mcp/codebase-index/publication.js";
import {CODEBASE_DOCUMENT_IDS} from "../src/mcp/codebase-authoring.js";
import {createToolResponseContent} from "../src/mcp/public-response.js";
import {sanitizeToolResultForPublicResponse} from "../src/mcp/response-sanitizer.js";

const execFile = promisify(execFileCallback);

async function git(root: string, ...args: string[]): Promise<void> {
  await execFile("git", args, {cwd: root});
}

async function fixture(t: {after: (fn: () => Promise<void>) => void}, fileCount = 80): Promise<string> {
  const root = await mkdtemp(path.join("/private/tmp", "blueprint-portable-tools-"));
  t.after(async () => rm(root, {recursive: true, force: true}));
  await git(root, "init", "--quiet");
  await git(root, "config", "user.email", "codex@example.invalid");
  await git(root, "config", "user.name", "Codex");
  await mkdir(path.join(root, "src"), {recursive: true});
  for (let index = 0; index < fileCount; index += 1) {
    await writeFile(path.join(root, "src", `module-${index}.ts`), `export function run${index}(value: string): string { return value; }\n`);
  }
  await git(root, "add", ".");
  await git(root, "commit", "--quiet", "-m", "portable map fixture");
  return root;
}

async function completeModel(root: string, operationId: string, generationId: string, summary = "Observed repository behavior from prepared source evidence.") {
  const extracted = await readPortableOperationExtraction({repositoryRoot: root, operationId});
  assert.equal(extracted.ok, true, JSON.stringify(extracted));
  if (!extracted.ok) throw new Error("expected extraction");
  const evidencePath = extracted.extraction.sourceBasis.files[0]!.path;
  return {
    formatVersion: 1,
    generationId,
    documents: Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, {summary, evidencePaths: [evidencePath]}])),
    semantic: {capabilities: [], claims: [], aliases: []}
  };
}

test("portable prepare returns a bounded public receipt and reloadable continuation", async t => {
  const root = await fixture(t, 700);
  const prepared = await blueprintMapPrepare({cwd: root, formatVersion: 1});
  assert.equal(prepared.status, "ready", JSON.stringify(prepared));
  assert.ok(prepared.operationId);
  assert.equal(prepared.authoring.schemaResource, "blueprint://commands/map-codebase/runtime-contract");
  assert.equal(prepared.authoring.schema.type, "object");
  const serialized = createToolResponseContent("blueprint_map_prepare", prepared)[0]!.text;
  assert.ok(Buffer.byteLength(serialized, "utf8") <= 48 * 1024);
  const structured = sanitizeToolResultForPublicResponse("blueprint_map_prepare", prepared);
  assert.ok(Buffer.byteLength(JSON.stringify(structured), "utf8") <= 48 * 1024);
  assert.deepEqual(JSON.parse(serialized), structured);
  assert.equal(prepared.receipt.packet.operationId, prepared.operationId);
  const cursor = prepared.receipt.continuation.cursor;
  assert.ok(cursor);
  const seen = new Set<string>();
  let continuation = await blueprintMapPrepare({cwd: root, formatVersion: 1, operationId: prepared.operationId, cursor});
  for (;;) {
    assert.equal(continuation.status, "ready", JSON.stringify(continuation));
    assert.equal(continuation.receipt.packet.operationId, prepared.operationId);
    assert.ok(Buffer.byteLength(createToolResponseContent("blueprint_map_prepare", continuation)[0]!.text, "utf8") <= 48 * 1024);
    for (const record of [...continuation.receipt.packet.selectedFiles, ...continuation.receipt.packet.selectedSymbols, ...continuation.receipt.packet.selectedDetails,
      ...continuation.receipt.packet.selectedImports, ...continuation.receipt.packet.selectedRelationships]) {
      assert.equal(seen.has(record.id), false, `duplicate public packet record ${record.id}`);
      seen.add(record.id);
    }
    const next = continuation.receipt.continuation.cursor;
    if (!next) break;
    continuation = await blueprintMapPrepare({cwd: root, formatVersion: 1, operationId: prepared.operationId, cursor: next});
  }
  assert.ok(seen.size > 700);
});

test("portable submit publishes, retries exactly, and rejects changed model identity", async t => {
  const root = await fixture(t, 12);
  const prepared = await blueprintMapPrepare({cwd: root, formatVersion: 1});
  assert.equal(prepared.status, "ready", JSON.stringify(prepared));
  const model = await completeModel(root, prepared.operationId, prepared.generationId);
  const published = await blueprintMapSubmit({cwd: root, formatVersion: 1, operationId: prepared.operationId, model});
  assert.equal(published.status, "published", JSON.stringify(published));
  assert.equal(published.committed, true);
  assert.match(await readFile(path.join(root, ".blueprint", "codebase", "INDEX.md"), "utf8"), /blueprint:portable-root-descriptor/);

  const retry = await blueprintMapSubmit({cwd: root, formatVersion: 1, operationId: prepared.operationId, model});
  assert.equal(retry.status, "reused", JSON.stringify(retry));
  assert.equal(retry.committed, true);
  const changed = await blueprintMapSubmit({cwd: root, formatVersion: 1, operationId: prepared.operationId,
    model: await completeModel(root, prepared.operationId, prepared.generationId, "Changed model identity.")});
  assert.equal(changed.status, "conflict", JSON.stringify(changed));
  assert.doesNotMatch(JSON.stringify(changed), /Changed model identity/);
});

test("portable rejected input returns fixed diagnostics without echoing sentinels", async t => {
  const root = await fixture(t, 4);
  const sentinel = "portable-rejected-secret-sentinel";
  const result = await blueprintMapSubmit({cwd: root, formatVersion: 1, operationId: "bad id", model: {formatVersion: 1, generationId: sentinel, documents: {}, semantic: {capabilities: [], claims: [], aliases: []}}});
  assert.equal(result.status, "invalid");
  assert.doesNotMatch(JSON.stringify(result), new RegExp(sentinel));
  assert.doesNotMatch(JSON.stringify(result), /bad id/);
});

test("portable prepare preserves unknown publication markers as a hard stop", async t => {
  const root = await fixture(t, 3);
  await mkdir(path.join(root, ".blueprint", "codebase"), {recursive: true});
  await writeFile(path.join(root, ".blueprint", "codebase", ".publication.json"), '{"version":999,"marker":"opaque"}\n');
  const result = await blueprintMapPrepare({cwd: root, formatVersion: 1});
  assert.equal(result.status, "conflict", JSON.stringify(result));
  assert.match(JSON.stringify(result), /unknown-marker/);
});

test("portable submit applies an explicitly requested instruction link after publication", async t => {
  const root = await fixture(t, 3);
  await writeFile(path.join(root, "AGENTS.md"), "# Repository instructions\n");
  const prepared = await blueprintMapPrepare({cwd: root, formatVersion: 1});
  assert.equal(prepared.status, "ready", JSON.stringify(prepared));
  const model = await completeModel(root, prepared.operationId, prepared.generationId);
  const result = await blueprintMapSubmit({cwd: root, formatVersion: 1, operationId: prepared.operationId, model, linkInstructions: true, instructionPath: "AGENTS.md"});
  assert.equal(result.committed, true, JSON.stringify(result));
  assert.equal(result.instructionLink.status, "applied");
  assert.match(await readFile(path.join(root, "AGENTS.md"), "utf8"), /blueprint:portable-codebase-index:start/);
});

test("concurrent different models have one deterministic accepted winner", async t => {
  const root = await fixture(t, 6);
  const prepared = await blueprintMapPrepare({cwd: root, formatVersion: 1});
  assert.equal(prepared.status, "ready", JSON.stringify(prepared));
  const firstModel = await completeModel(root, prepared.operationId, prepared.generationId, "First concurrent model.");
  const secondModel = await completeModel(root, prepared.operationId, prepared.generationId, "Second concurrent model.");
  let entered = 0;
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  portableOperationTestHooks.beforeAtomicWrite = async relative => {
    if (relative.endsWith("/accepted.json")) {
      entered += 1;
      if (entered === 1) await barrier;
    }
  };
  try {
    const first = blueprintMapSubmit({cwd: root, formatVersion: 1, operationId: prepared.operationId, model: firstModel});
    while (entered < 1) await new Promise<void>(resolve => setImmediate(resolve));
    const second = blueprintMapSubmit({cwd: root, formatVersion: 1, operationId: prepared.operationId, model: secondModel});
    await new Promise<void>(resolve => setImmediate(resolve));
    release();
    const results = await Promise.all([first, second]);
    assert.equal(results.filter(result => result.status === "published").length, 1, JSON.stringify(results));
    assert.equal(results.filter(result => result.status === "conflict").length, 1, JSON.stringify(results));
    const accepted = await readPortableOperationAcceptance({repositoryRoot: root, operationId: prepared.operationId});
    assert.ok(accepted);
    assert.equal(accepted?.operationId, prepared.operationId);
  } finally {
    delete portableOperationTestHooks.beforeAtomicWrite;
    release();
  }
});

test("publication receipt and continuation revalidation keep a consistent lock order", async t => {
  const root = await fixture(t, 6);
  const prepared = await blueprintMapPrepare({cwd: root, formatVersion: 1});
  assert.equal(prepared.status, "ready", JSON.stringify(prepared));
  const model = await completeModel(root, prepared.operationId, prepared.generationId);
  let entered = false;
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  portablePublicationTestHooks.beforeIndexCommit = async () => {
    entered = true;
    await barrier;
  };
  try {
    const submit = blueprintMapSubmit({cwd: root, formatVersion: 1, operationId: prepared.operationId, model});
    while (!entered) await new Promise<void>(resolve => setImmediate(resolve));
    const revalidate = revalidatePortableOperation({repositoryRoot: root, operationId: prepared.operationId});
    await new Promise<void>(resolve => setImmediate(resolve));
    release();
    const settled = await Promise.race([
      Promise.allSettled([submit, revalidate]),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("publication/revalidation lock-order timeout")), 5_000))
    ]);
    assert.equal(settled.length, 2);
  } finally {
    delete portablePublicationTestHooks.beforeIndexCommit;
    release();
  }
});
