import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, readdir, rename, rm, symlink, writeFile} from "node:fs/promises";
import path from "node:path";
import {execFile as execFileCallback} from "node:child_process";
import {createHash} from "node:crypto";
import {promisify} from "node:util";

import {
  PORTABLE_OPERATION_INACTIVITY_MS,
  PORTABLE_OPERATIONS_ROOT,
  preparePortableOperation,
  portableOperationTestHooks,
  readPortableOperationExtraction,
  readPortableOperationMetadata,
  readPortableOperationReceipt,
  revalidatePortableOperation
} from "../src/mcp/codebase-index/operations.js";
import {PORTABLE_MAP_MAX_MODEL_PACKET_BYTES, serializedUtf8ByteLength} from "../src/mcp/codebase-index/contracts.js";
import {CODEBASE_DOCUMENT_IDS} from "../src/mcp/codebase-authoring.js";

const execFile = promisify(execFileCallback);

async function git(root: string, ...args: string[]): Promise<void> {
  await execFile("git", args, {cwd: root});
}

async function fixture(t: {after: (fn: () => Promise<void>) => void}, files = 180): Promise<string> {
  const root = await mkdtemp(path.join("/private/tmp", "blueprint-portable-operations-"));
  t.after(async () => rm(root, {recursive: true, force: true}));
  await git(root, "init", "--quiet");
  await git(root, "config", "user.email", "codex@example.invalid");
  await git(root, "config", "user.name", "Codex");
  await mkdir(path.join(root, "src"), {recursive: true});
  for (let index = 0; index < files; index += 1) {
    await writeFile(path.join(root, "src", `module-${String(index).padStart(4, "0")}.ts`),
      `export function run${index}(value: string): string { return value; }\n`, "utf8");
  }
  await git(root, "add", ".");
  await git(root, "commit", "--quiet", "-m", "operation fixture");
  return root;
}

test("persists a strict operation projection and reconstructs bounded packets after disk reload", async t => {
  const root = await fixture(t, 700);
  const prepared = await preparePortableOperation({repositoryRoot: root, now: "2026-09-24T00:00:00.000Z"});
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  if (!prepared.ok) throw new Error("expected prepared operation");

  const operationDirectory = path.join(root, PORTABLE_OPERATIONS_ROOT, prepared.operationId);
  const files = (await readdir(operationDirectory)).sort();
  assert.deepEqual(files, ["authority.json", "metadata.json", "operation.json", "packets.json", "provenance.json", "structural.json"]);
  const persisted = JSON.stringify({
    metadata: JSON.parse(await readFile(path.join(operationDirectory, "metadata.json"), "utf8")),
    structural: JSON.parse(await readFile(path.join(operationDirectory, "structural.json"), "utf8")),
    authority: JSON.parse(await readFile(path.join(operationDirectory, "authority.json"), "utf8")),
    provenance: JSON.parse(await readFile(path.join(operationDirectory, "provenance.json"), "utf8")),
    packets: JSON.parse(await readFile(path.join(operationDirectory, "packets.json"), "utf8"))
  });
  assert.doesNotMatch(persisted, /return value/);

  const first = await readPortableOperationReceipt({repositoryRoot: root, operationId: prepared.operationId, now: "2026-09-24T00:00:00.000Z"});
  assert.equal(first.ok, true, JSON.stringify(first));
  if (!first.ok || !first.packet) throw new Error("expected first packet");
  assert.ok(serializedUtf8ByteLength(first.packet) <= PORTABLE_MAP_MAX_MODEL_PACKET_BYTES);
  assert.ok(serializedUtf8ByteLength(first) <= PORTABLE_MAP_MAX_MODEL_PACKET_BYTES);
  assert.ok(first.packetBytes! <= prepared.metadata.packetBudgetBytes);
  assert.equal(first.packet.continuation?.hasMore, true);
  const cursor = first.packet.continuation?.cursor;
  assert.ok(cursor);

  // A second call is a disk reload in the same process and must reproduce the
  // exact packet/cursor bytes. No in-memory packet stream is consulted.
  const firstAgain = await readPortableOperationReceipt({repositoryRoot: root, operationId: prepared.operationId, now: "2026-09-24T00:00:00.000Z"});
  assert.deepEqual(firstAgain, first);
  const second = await readPortableOperationReceipt({repositoryRoot: root, operationId: prepared.operationId, cursor: cursor!, now: "2026-09-24T00:00:00.000Z"});
  assert.equal(second.ok, true, JSON.stringify(second));
  if (!second.ok || !second.packet) throw new Error("expected second packet");
  assert.notDeepEqual(second.packet, first.packet);
  assert.ok(serializedUtf8ByteLength(second.packet) <= PORTABLE_MAP_MAX_MODEL_PACKET_BYTES);
  assert.ok(serializedUtf8ByteLength(second) <= PORTABLE_MAP_MAX_MODEL_PACKET_BYTES);

  const seen = new Set<string>();
  const seenByKind = {selectedFiles: 0, selectedSymbols: 0, selectedDetails: 0, selectedImports: 0, selectedRelationships: 0};
  let page = first;
  for (;;) {
    assert.equal(page.ok, true, JSON.stringify(page));
    if (!page.ok || !page.packet) throw new Error("expected packet page");
    assert.ok(serializedUtf8ByteLength(page) <= PORTABLE_MAP_MAX_MODEL_PACKET_BYTES);
    for (const record of [
      ...page.packet.selectedFiles,
      ...page.packet.selectedSymbols,
      ...page.packet.selectedDetails,
      ...page.packet.selectedImports,
      ...page.packet.selectedRelationships
    ]) {
      assert.equal(seen.has(record.id), false, `duplicate packet record ${record.id}`);
      seen.add(record.id);
    }
    seenByKind.selectedFiles += page.packet.selectedFiles.length;
    seenByKind.selectedSymbols += page.packet.selectedSymbols.length;
    seenByKind.selectedDetails += page.packet.selectedDetails?.length ?? 0;
    seenByKind.selectedImports += page.packet.selectedImports.length;
    seenByKind.selectedRelationships += page.packet.selectedRelationships.length;
    const next = page.packet.continuation?.cursor;
    if (!next) break;
    page = await readPortableOperationReceipt({repositoryRoot: root, operationId: prepared.operationId, cursor: next, now: "2026-09-24T00:00:00.000Z"});
  }
  assert.ok(seen.size > 700, `expected all structural record kinds, saw ${seen.size}`);

  const extraction = await readPortableOperationExtraction({repositoryRoot: root, operationId: prepared.operationId});
  assert.equal(extraction.ok, true, JSON.stringify(extraction));
  if (!extraction.ok) throw new Error("expected trusted extraction access");
  assert.equal(extraction.extraction.structuralShards.reduce((sum, shard) => sum + shard.files.length, 0), 700);
  assert.deepEqual(seenByKind, {
    selectedFiles: extraction.extraction.structuralShards.reduce((sum, shard) => sum + shard.files.length, 0),
    selectedSymbols: extraction.extraction.structuralShards.reduce((sum, shard) => sum + shard.symbols.length, 0),
    selectedDetails: extraction.extraction.structuralShards.reduce((sum, shard) => sum + (shard.details?.length ?? 0), 0),
    selectedImports: extraction.extraction.structuralShards.reduce((sum, shard) => sum + shard.imports.length, 0),
    selectedRelationships: extraction.extraction.structuralShards.reduce((sum, shard) => sum + shard.relationships.length, 0)
  });
  assert.equal(extraction.extraction.sourceBasis.generationId, prepared.generationId);
});

test("rejects foreign and tampered cursors without echoing cursor material", async t => {
  const root = await fixture(t, 250);
  const first = await preparePortableOperation({repositoryRoot: root});
  const second = await preparePortableOperation({repositoryRoot: root});
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(second.ok, true, JSON.stringify(second));
  if (!first.ok || !second.ok) throw new Error("expected operations");
  const cursor = first.receipt.packet?.continuation?.cursor;
  assert.ok(cursor);
  const before = await readPortableOperationMetadata({repositoryRoot: root, operationId: first.operationId, now: "2026-09-24T00:00:00.000Z"});
  assert.equal(before.ok, true);
  const foreign = await readPortableOperationReceipt({repositoryRoot: root, operationId: second.operationId, cursor: cursor!});
  assert.equal(foreign.ok, false);
  assert.match(JSON.stringify(foreign), /invalid-cursor/);
  const tampered = await readPortableOperationReceipt({repositoryRoot: root, operationId: first.operationId, cursor: `${cursor}x`});
  assert.equal(tampered.ok, false);
  assert.match(JSON.stringify(tampered), /invalid-cursor/);
  assert.doesNotMatch(JSON.stringify(tampered), new RegExp(cursor!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const after = await readPortableOperationMetadata({repositoryRoot: root, operationId: first.operationId, now: "2026-09-24T00:00:00.000Z"});
  assert.equal(after.ok, true);
  if (before.ok && after.ok) {
    assert.equal(after.metadata.revision, before.metadata.revision);
    assert.equal(after.metadata.lastActivityAt, before.metadata.lastActivityAt);
    assert.equal(after.metadata.expiresAt, before.metadata.expiresAt);
  }
});

test("invalid operation identifiers never appear in response material", async () => {
  const sentinel = "INVALID_OPERATION_SENTINEL_21b9";
  const result = await readPortableOperationReceipt({repositoryRoot: "/private/tmp", operationId: `${sentinel} with spaces`});
  assert.doesNotMatch(JSON.stringify(result), new RegExp(sentinel));
});

test("oversized persisted receipt packets fail before touching activity state", async t => {
  const root = await fixture(t, 2);
  const prepared = await preparePortableOperation({repositoryRoot: root, now: "2026-09-24T00:00:00.000Z"});
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  if (!prepared.ok) throw new Error("expected prepared operation");
  const operationDirectory = path.join(root, PORTABLE_OPERATIONS_ROOT, prepared.operationId);
  const packetPath = path.join(operationDirectory, "packets.json");
  const packetStore = JSON.parse(await readFile(packetPath, "utf8")) as {packets: Array<Record<string, unknown>>; [key: string]: unknown};
  const packet = packetStore.packets[0]!;
  const baseFile = (packet.selectedFiles as Array<Record<string, unknown>>)[0]!;
  packet.selectedFiles = Array.from({length: 10}, (_, index) => ({
    ...baseFile,
    id: `file-oversized-${index}`,
    path: `src/${"x".repeat(4000)}-${index}.ts`
  }));
  const packetBytes = new TextEncoder().encode(`${JSON.stringify(packetStore)}\n`);
  await writeFile(packetPath, packetBytes);
  const metadataPath = path.join(operationDirectory, "metadata.json");
  const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as {files: {packets: {path: string; checksum: string; byteSize: number}}};
  metadata.files.packets = {
    path: "packets.json",
    checksum: createHash("sha256").update(packetBytes).digest("hex"),
    byteSize: packetBytes.byteLength
  };
  await writeFile(metadataPath, `${JSON.stringify(metadata)}\n`);
  const before = await readPortableOperationMetadata({repositoryRoot: root, operationId: prepared.operationId});
  const result = await readPortableOperationReceipt({repositoryRoot: root, operationId: prepared.operationId});
  const after = await readPortableOperationMetadata({repositoryRoot: root, operationId: prepared.operationId});
  assert.equal(result.ok, false);
  assert.match(JSON.stringify(result), /packet-too-large/);
  assert.equal(before.ok, true);
  assert.equal(after.ok, true);
  if (before.ok && after.ok) {
    assert.equal(after.metadata.revision, before.metadata.revision);
    assert.equal(after.metadata.lastActivityAt, before.metadata.lastActivityAt);
    assert.equal(after.metadata.expiresAt, before.metadata.expiresAt);
  }
});

test("explicit repair basis is persisted and revalidated", async t => {
  const root = await fixture(t, 2);
  const targetHashes = Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, null]));
  const prepared = await preparePortableOperation({
    repositoryRoot: root,
    repair: {authorized: true, previousIndexHash: null, targetHashes, observedMarkerHash: null}
  });
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  if (!prepared.ok) throw new Error("expected repair operation");
  assert.deepEqual(prepared.metadata.repair, {authorized: true, previousIndexHash: null, targetHashes, observedMarkerHash: null});
  const loaded = await readPortableOperationMetadata({repositoryRoot: root, operationId: prepared.operationId});
  assert.equal(loaded.ok, true, JSON.stringify(loaded));
  if (loaded.ok) assert.deepEqual(loaded.metadata.publication.repair, prepared.metadata.repair);
});

test("explicit repair binds a malformed INDEX and rejects a changed repair basis", async t => {
  const root = await fixture(t, 2);
  await mkdir(path.join(root, ".blueprint", "codebase"), {recursive: true});
  const indexPath = path.join(root, ".blueprint", "codebase", "INDEX.md");
  const malformedIndex = Buffer.from("malformed INDEX\n");
  await writeFile(indexPath, malformedIndex);
  const targetHashes = Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, null]));
  const prepared = await preparePortableOperation({
    repositoryRoot: root,
    repair: {
      authorized: true,
      previousIndexHash: createHash("sha256").update(malformedIndex).digest("hex"),
      targetHashes,
      observedMarkerHash: null
    }
  });
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  if (!prepared.ok) throw new Error("expected explicit repair operation");
  assert.equal(prepared.metadata.repair !== false, true);
  await writeFile(indexPath, "changed INDEX after repair preparation\n", "utf8");
  const changed = await revalidatePortableOperation({repositoryRoot: root, operationId: prepared.operationId});
  assert.equal(changed.ok, false);
  assert.match(JSON.stringify(changed), /stale-target/);
});

test("fresh revalidation catches source, target, and provenance changes", async t => {
  const root = await fixture(t, 20);
  const prepared = await preparePortableOperation({repositoryRoot: root});
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  if (!prepared.ok) throw new Error("expected prepared operation");
  assert.equal((await revalidatePortableOperation({repositoryRoot: root, operationId: prepared.operationId})).ok, true);

  await writeFile(path.join(root, "src", "module-0000.ts"), "export function changed(): string { return 'changed'; }\n", "utf8");
  const changed = await revalidatePortableOperation({repositoryRoot: root, operationId: prepared.operationId});
  assert.equal(changed.ok, false);
  assert.match(JSON.stringify(changed), /stale-source/);

  // New/deleted/renamed paths are all inventory changes and are not blessed
  // by the old source hash.
  await writeFile(path.join(root, "src", "new.ts"), "export const added = true;\n", "utf8");
  await rm(path.join(root, "src", "module-0001.ts"));
  const changedInventory = await revalidatePortableOperation({repositoryRoot: root, operationId: prepared.operationId});
  assert.equal(changedInventory.ok, false);
  assert.match(JSON.stringify(changedInventory), /stale-source/);
});

test("fresh revalidation catches target changes and malformed persisted provenance", async t => {
  const root = await fixture(t, 3);
  const prepared = await preparePortableOperation({repositoryRoot: root});
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  if (!prepared.ok) throw new Error("expected prepared operation");
  await writeFile(path.join(root, ".blueprint", "codebase", "STACK.md"), "externally changed target\n", "utf8");
  const targetChanged = await revalidatePortableOperation({repositoryRoot: root, operationId: prepared.operationId});
  assert.equal(targetChanged.ok, false);
  assert.match(JSON.stringify(targetChanged), /stale-target/);

  const operationDirectory = path.join(root, PORTABLE_OPERATIONS_ROOT, prepared.operationId);
  const provenancePath = path.join(operationDirectory, "provenance.json");
  const provenance = JSON.parse(await readFile(provenancePath, "utf8")) as {provenance: {runtime: {version: string}}};
  provenance.provenance.runtime.version = "tampered-provenance";
  await writeFile(provenancePath, JSON.stringify(provenance), "utf8");
  const malformed = await revalidatePortableOperation({repositoryRoot: root, operationId: prepared.operationId});
  assert.equal(malformed.ok, false);
  assert.match(JSON.stringify(malformed), /integrity-failure/);
});

test("publication target tampering cannot bless a changed live target", async t => {
  const root = await fixture(t, 3);
  const prepared = await preparePortableOperation({repositoryRoot: root});
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  if (!prepared.ok) throw new Error("expected prepared operation");
  const targetPath = path.join(root, ".blueprint", "codebase", "STACK.md");
  const changed = "changed target bytes\n";
  await writeFile(targetPath, changed, "utf8");
  const metadataPath = path.join(root, PORTABLE_OPERATIONS_ROOT, prepared.operationId, "metadata.json");
  const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as {publication: {previousTargetHashes: Record<string, string | null>}};
  metadata.publication.previousTargetHashes.stack = createHash("sha256").update(changed).digest("hex");
  await writeFile(metadataPath, `${JSON.stringify(metadata)}\n`, "utf8");
  const result = await revalidatePortableOperation({repositoryRoot: root, operationId: prepared.operationId});
  assert.equal(result.ok, false);
  assert.match(JSON.stringify(result), /integrity-failure/);
});

test("root identity ignores descendant timestamp churn but rejects replacement and symlink escape", async t => {
  const root = await fixture(t, 3);
  const prepared = await preparePortableOperation({repositoryRoot: root});
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  if (!prepared.ok) throw new Error("expected prepared operation");
  await mkdir(path.join(root, "new-directory"));
  assert.equal((await revalidatePortableOperation({repositoryRoot: root, operationId: prepared.operationId})).ok, true);

  const outside = await mkdtemp(path.join("/private/tmp", "blueprint-portable-outside-"));
  t.after(async () => rm(outside, {recursive: true, force: true}));
  const alias = `${root}-alias`;
  await symlink(root, alias);
  t.after(async () => rm(alias, {force: true}));
  const unsafe = await preparePortableOperation({repositoryRoot: alias});
  assert.equal(unsafe.ok, false);
  assert.match(JSON.stringify(unsafe), /unsafe-root/);
  assert.equal(await readFile(path.join(outside, "missing"), "utf8").catch(() => null), null);
});

test("expired operations remain readable for recovery metadata but block authoring packets", async t => {
  const root = await fixture(t, 4);
  const prepared = await preparePortableOperation({repositoryRoot: root, now: "2026-01-01T00:00:00.000Z"});
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  if (!prepared.ok) throw new Error("expected prepared operation");
  const now = new Date(new Date("2026-01-01T00:00:00.000Z").getTime() + PORTABLE_OPERATION_INACTIVITY_MS + 1).toISOString();
  const metadata = await readPortableOperationMetadata({repositoryRoot: root, operationId: prepared.operationId, now});
  assert.equal(metadata.ok, true);
  if (!metadata.ok) throw new Error("expected metadata");
  assert.equal(metadata.status, "expired");
  const receipt = await readPortableOperationReceipt({repositoryRoot: root, operationId: prepared.operationId, now});
  assert.equal(receipt.ok, false);
  assert.equal(receipt.status, "expired");
  assert.equal(await readFile(path.join(root, PORTABLE_OPERATIONS_ROOT, prepared.operationId, "metadata.json"), "utf8").then(() => true), true);
});

test("unsafe operation ancestors are rejected before lock or operation creation", async t => {
  const root = await fixture(t, 2);
  await mkdir(path.join(root, ".blueprint"), {recursive: true});
  const outside = await mkdtemp(path.join("/private/tmp", "blueprint-portable-operation-outside-"));
  t.after(async () => rm(outside, {recursive: true, force: true}));
  await symlink(outside, path.join(root, ".blueprint", "codebase-operations"));
  const result = await preparePortableOperation({repositoryRoot: root});
  assert.equal(result.ok, false);
  assert.match(JSON.stringify(result), /unsafe-root|publication-conflict/);
  assert.deepEqual(await readdir(outside), []);
});

test("operation-directory swaps are rejected before an anchored write", async t => {
  const root = await fixture(t, 2);
  const outside = await mkdtemp(path.join("/private/tmp", "blueprint-portable-operation-race-"));
  t.after(async () => rm(outside, {recursive: true, force: true}));
  let injected = false;
  portableOperationTestHooks.beforeAtomicWrite = async relative => {
    if (injected || !relative.endsWith("/metadata.json")) return;
    injected = true;
    const operationDirectory = path.join(root, path.posix.dirname(relative));
    await rm(`${operationDirectory}-original`, {recursive: true, force: true});
    await rename(operationDirectory, `${operationDirectory}-original`);
    await symlink(outside, operationDirectory);
  };
  try {
    const result = await preparePortableOperation({repositoryRoot: root});
    assert.equal(injected, true);
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.deepEqual(await readdir(outside), []);
  } finally {
    delete portableOperationTestHooks.beforeAtomicWrite;
  }
});

test("operation-directory swaps after temp creation leave no outside temporary", async t => {
  const root = await fixture(t, 2);
  const outside = await mkdtemp(path.join("/private/tmp", "blueprint-portable-operation-race-after-write-"));
  t.after(async () => rm(outside, {recursive: true, force: true}));
  let injected = false;
  portableOperationTestHooks.afterTempWrite = async relative => {
    if (injected || !relative.endsWith("/metadata.json")) return;
    injected = true;
    const operationDirectory = path.join(root, path.posix.dirname(relative));
    await rename(operationDirectory, `${operationDirectory}-original`);
    await symlink(outside, operationDirectory);
  };
  try {
    const result = await preparePortableOperation({repositoryRoot: root});
    assert.equal(injected, true);
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.deepEqual(await readdir(outside), []);
  } finally {
    delete portableOperationTestHooks.afterTempWrite;
  }
});

test("concurrent prepares keep opaque operation directories isolated", async t => {
  const root = await fixture(t, 80);
  const [first, second] = await Promise.all([
    preparePortableOperation({repositoryRoot: root}),
    preparePortableOperation({repositoryRoot: root})
  ]);
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(second.ok, true, JSON.stringify(second));
  if (!first.ok || !second.ok) throw new Error("expected concurrent preparations");
  assert.notEqual(first.operationId, second.operationId);
  assert.notEqual(first.generationId, second.generationId);
  const entries = (await readdir(path.join(root, PORTABLE_OPERATIONS_ROOT))).sort();
  assert.deepEqual(entries, [first.operationId, second.operationId].sort());
});

test("stored metadata excludes source-body and rejected authored sentinels", async t => {
  const root = await fixture(t, 1);
  const sentinel = "REJECTED_AUTHORED_SENTINEL_9e7f";
  await writeFile(path.join(root, "src", "module-0000.ts"), `export function run(): string { return "${sentinel}"; }\n`, "utf8");
  await git(root, "add", ".");
  await git(root, "commit", "--quiet", "-m", "sentinel source");
  const prepared = await preparePortableOperation({repositoryRoot: root});
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  if (!prepared.ok) throw new Error("expected prepared operation");
  const serialized = JSON.stringify(await readPortableOperationExtraction({repositoryRoot: root, operationId: prepared.operationId}));
  assert.doesNotMatch(serialized, new RegExp(sentinel));
  assert.doesNotMatch(serialized, /rejected authored/);
});
