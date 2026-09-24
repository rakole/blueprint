import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {constants as fsConstants} from "node:fs";
import {promises as fs} from "node:fs";
import {mkdir, mkdtemp, readFile, readdir, rm, writeFile} from "node:fs/promises";
import {syncBuiltinESMExports} from "node:module";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";

import {CODEBASE_DOCUMENT_IDS} from "../src/mcp/codebase-authoring.js";
import {portableSourceCoordinateSchema, type PortableSourceCoordinate} from "../src/mcp/codebase-index/contracts.js";
import {renderPortableMap} from "../src/mcp/codebase-index/render.js";
import {validatePortableMapModel, type PortableAuthoritativeSourceBasis} from "../src/mcp/codebase-index/model-validation.js";
import {resolveConsumerEvidence} from "../src/mcp/codebase-index/consumer-evidence.js";
import {issuePortablePinReceipt, restorePortablePinReceipt, verifyPortablePinHandoff} from "../src/mcp/codebase-index/resolver.js";

const digest = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
const source = "\uFEFFexport function café() {\r\n  return \"é🚀\";\r\n}\r\n";

function positionAt(bytes: Uint8Array, offset: number): {line: number; column: number} {
  let line = 1;
  let column = 0;
  for (let index = 0; index < offset; index += 1) {
    if (bytes[index] === 0x0a) {
      line += 1;
      column = 0;
    } else column += 1;
  }
  return {line, column};
}

function coordinateFor(value: string, from: string, to: string): PortableSourceCoordinate {
  const bytes = new TextEncoder().encode(value);
  const start = value.indexOf(from);
  const end = start + from.length;
  const startByte = Buffer.byteLength(value.slice(0, start), "utf8");
  const endByte = Buffer.byteLength(value.slice(0, end), "utf8");
  const coordinate = {
    start: {...positionAt(bytes, startByte), byte: startByte},
    end: {...positionAt(bytes, endByte), byte: endByte}
  };
  const parsed = portableSourceCoordinateSchema.safeParse(coordinate);
  assert.equal(parsed.success, true);
  return coordinate;
}

function modelFixture(generationId: string, predecessorPublicationProof?: {generationId: string; manifest: {path: string; checksum: string}; entry: {path: string; checksum: string}; committedIndexHash: string}) {
  const sourceBytes = new TextEncoder().encode(source);
  const sourceHash = digest(sourceBytes);
  const coordinate = coordinateFor(source, "export function café()", "export function café() {");
  const rangeBytes = sourceBytes.slice(coordinate.start.byte, coordinate.end.byte);
  const files = [{
    id: "file_entry", path: "src/entry.ts", language: "typescript" as const, role: "source" as const,
    byteSize: sourceBytes.byteLength, contentHash: sourceHash, parseStatus: "parsed" as const,
    coverageStatus: "full" as const
  }];
  const symbols = [
    {id: "symbol_entry", fileId: "file_entry", path: "src/entry.ts", qualifiedName: "café", kind: "function" as const, signature: "function café()", coordinate, contentHash: digest(rangeBytes), lexicalParentId: null, exported: true},
    {id: "symbol_neighbor", fileId: "file_entry", path: "src/entry.ts", qualifiedName: "neighbor", kind: "function" as const, signature: "function neighbor()", coordinate: coordinateFor(source, "return", "return \""), contentHash: digest(sourceBytes.slice(coordinateFor(source, "return", "return \"").start.byte, coordinateFor(source, "return", "return \"").end.byte)), lexicalParentId: null, exported: false}
  ];
  const documents = Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, {
    summary: `${id} is grounded in the entry source.`,
    sections: [{heading: "Observed", content: "The entry function is the selected implementation boundary."}],
    evidencePaths: ["src/entry.ts"]
  }]));
  const model = {
    formatVersion: 1 as const,
    generationId,
    documents,
    semantic: {
      capabilities: [{id: "cap_entry", name: "Entry flow", summary: "Coordinates the entry flow.", claimIds: ["claim_entry"], evidence: [{kind: "symbol" as const, path: "src/entry.ts", recordId: "symbol_entry", contentHash: digest(rangeBytes), coordinate}]}],
      claims: [{id: "claim_entry", basis: "observed" as const, statement: "The entry function is exported.", evidence: [{kind: "symbol" as const, path: "src/entry.ts", recordId: "symbol_entry", contentHash: digest(rangeBytes), coordinate}]}],
      aliases: [{id: "alias_start", alias: "start", targetKind: "capability" as const, targetId: "cap_entry", evidence: [{kind: "file" as const, path: "src/entry.ts", recordId: "file_entry", contentHash: sourceHash}]}]
    }
  };
  const basis: PortableAuthoritativeSourceBasis = {
    generationId,
    files: [{path: "src/entry.ts", byteSize: sourceBytes.byteLength, contentHash: sourceHash}],
    records: [
      {kind: "file", recordId: "file_entry", path: "src/entry.ts", contentHash: sourceHash},
      ...symbols.map(symbol => ({kind: "symbol" as const, recordId: symbol.id, path: symbol.path, contentHash: symbol.contentHash, coordinate: symbol.coordinate}))
    ]
  };
  const validated = validatePortableMapModel([{generationId, shardId: "source_1", files, symbols, imports: [], relationships: []}], model, basis);
  assert.equal(validated.ok, true, validated.ok ? undefined : JSON.stringify(validated.diagnostics));
  if (!validated.ok) throw new Error("fixture should validate");
  const rendered = renderPortableMap(validated.data, {
    generationId,
    generatedAt: "2026-09-24T10:00:00+00:00",
    gitCommit: null,
    inventoryFingerprint: digest(`${generationId}:inventory`),
    parserAssets: [],
    ...(predecessorPublicationProof ? {predecessorPublicationProof} : {})
  });
  assert.equal(rendered.ok, true, rendered.ok ? undefined : JSON.stringify(rendered.diagnostics));
  if (!rendered.ok) throw new Error("fixture should render");
  return {rendered, sourceHash, coordinate, rangeBytes};
}

async function installBundle(root: string, rendered: {files: Readonly<Record<string, Uint8Array>>}, include: (filePath: string) => boolean = () => true): Promise<void> {
  for (const [filePath, bytes] of Object.entries(rendered.files)) {
    if (!include(filePath)) continue;
    const target = path.join(root, ".blueprint", "codebase", filePath);
    await mkdir(path.dirname(target), {recursive: true});
    await writeFile(target, bytes);
  }
}

async function temporaryRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "blueprint-consumer-evidence-"));
}

function priorFrom(result: Extract<Awaited<ReturnType<typeof resolveConsumerEvidence>>, {status: "ok"}>): {binding: typeof result.binding; delivered: typeof result.binding.identities} {
  return {binding: result.binding, delivered: result.binding.identities};
}

test("full, delta, and register share one immutable ENTRY and bounded range identity", async () => {
  const root = await temporaryRoot();
  try {
    const fixture = modelFixture("generation_a");
    await installBundle(root, fixture.rendered);
    await mkdir(path.join(root, "src"), {recursive: true});
    await writeFile(path.join(root, "src", "entry.ts"), source);
    const full = await resolveConsumerEvidence({root, selection: {kind: "alias", recordId: "alias_start"}, mode: "full"});
    assert.equal(full.status, "ok", JSON.stringify(full));
    if (full.status !== "ok") return;
    assert.equal(full.packet.entries.filter(entry => entry.path.endsWith("/ENTRY.md")).length, 1);
    assert.equal(full.packet.entries.some(entry => entry.path.endsWith("/INDEX.md")), false);
    assert.equal(full.packet.entries.some(entry => entry.path.startsWith("@codebase/source-range/")), true);
    assert.equal(full.packet.entries.some(entry => entry.path === "src/entry.ts"), true, "the alias file evidence remains a full-source read");
    assert.equal(full.packet.entries.find(entry => entry.path.startsWith("@codebase/source-range/"))?.content, Buffer.from(fixture.rangeBytes).toString("utf8"));

    const delta = await resolveConsumerEvidence({root, selection: {kind: "alias", recordId: "alias_start"}, mode: "delta", prior: priorFrom(full)});
    assert.equal(delta.status, "ok", JSON.stringify(delta));
    if (delta.status !== "ok") return;
    assert.equal(delta.packet.entries.every(entry => entry.content === undefined), true);
    assert.deepEqual(delta.packet.entries.map(entry => entry.path), full.packet.entries.map(entry => entry.path));

    const register = await resolveConsumerEvidence({root, selection: {kind: "alias", recordId: "alias_start"}, mode: "register", readTimeEvidence: [{path: "src/entry.ts", hash: fixture.sourceHash}]});
    assert.equal(register.status, "ok", JSON.stringify(register));
    if (register.status !== "ok") return;
    assert.equal(register.packet.entries.filter(entry => entry.path === "src/entry.ts" || entry.path.startsWith("@codebase/source-range/")).every(entry => entry.content === undefined), true);
    assert.ok(register.readSet.some(item => item.path === "src/entry.ts" && item.rangeHash));
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("fresh literal page and source tampering fail without retaining body text", async () => {
  const root = await temporaryRoot();
  try {
    const fixture = modelFixture("generation_a");
    await installBundle(root, fixture.rendered);
    await mkdir(path.join(root, "src"), {recursive: true});
    await writeFile(path.join(root, "src", "entry.ts"), source);
    await writeFile(path.join(root, ".blueprint", "codebase", "generations", "generation_a", "ENTRY.md"), "tampered-entry-sentinel");
    const entry = await resolveConsumerEvidence({root, selection: {kind: "alias", recordId: "alias_start"}, mode: "full"});
    assert.notEqual(entry.status, "ok");
    assert.doesNotMatch(JSON.stringify(entry), /tampered-entry-sentinel/);

    await installBundle(root, fixture.rendered);
    await writeFile(path.join(root, "src", "entry.ts"), `${source}changed-source-secret-sentinel`);
    const sourceResult = await resolveConsumerEvidence({root, selection: {kind: "alias", recordId: "alias_start"}, mode: "full"});
    assert.equal(sourceResult.status, "reread_required");
    if (sourceResult.status !== "ok") assert.equal(sourceResult.code, "source_tampered");
    assert.doesNotMatch(JSON.stringify(sourceResult), /changed-source-secret-sentinel/);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("discovery pages and absent or legacy maps use fallback without evidence", async () => {
  const root = await temporaryRoot();
  try {
    const absent = await resolveConsumerEvidence({root, selection: {kind: "alias", recordId: "missing"}, mode: "full"});
    assert.equal(absent.status, "fallback");
    await mkdir(path.join(root, ".blueprint", "codebase"), {recursive: true});
    await writeFile(path.join(root, ".blueprint", "codebase", "STACK.md"), "legacy");
    const legacy = await resolveConsumerEvidence({root, selection: {kind: "alias", recordId: "missing"}, mode: "full"});
    assert.equal(legacy.status, "fallback");
    assert.equal(JSON.stringify(legacy).includes("legacy"), false);
    const fixture = modelFixture("generation_a");
    await installBundle(root, fixture.rendered);
    const routePath = Object.keys(fixture.rendered.files).find(item => item.includes("/routes/"))!;
    const discovery = await resolveConsumerEvidence({root, selection: {kind: "page", path: routePath, mode: "discovery"}, mode: "full"});
    assert.equal(discovery.status, "invalid");
    if (discovery.status !== "ok") assert.equal(discovery.code, "discovery_only");
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("exact ranges preserve BOM, CRLF, Unicode coordinates and count limits", async () => {
  const root = await temporaryRoot();
  try {
    const fixture = modelFixture("generation_a");
    await installBundle(root, fixture.rendered);
    await mkdir(path.join(root, "src"), {recursive: true});
    await writeFile(path.join(root, "src", "entry.ts"), source);
    const limited = await resolveConsumerEvidence({root, selection: {kind: "symbol", recordId: "symbol_entry"}, mode: "full", limits: {maxPacketBytes: 200, maxReadSetCount: 1}});
    assert.equal(limited.status, "evidence_limit");
    if (limited.status !== "ok") assert.equal(limited.code, "delivery_failure");
    const ok = await resolveConsumerEvidence({root, selection: {kind: "symbol", recordId: "symbol_entry"}, mode: "full", limits: {maxPacketBytes: 48 * 1024, maxReadSetCount: 10}});
    assert.equal(ok.status, "ok", JSON.stringify(ok));
    if (ok.status !== "ok") return;
    const range = ok.packet.entries.find(entry => entry.path.startsWith("@codebase/source-range/"));
    assert.equal(range?.content, Buffer.from(fixture.rangeBytes).toString("utf8"));
    assert.ok(ok.readSet.some(item => item.path === "src/entry.ts" && item.fullFileHash === fixture.sourceHash));
    for (const limits of [
      {maxPacketBytes: null},
      {maxSourceCount: Number.NaN},
      {maxReadSetCount: Number.POSITIVE_INFINITY},
      {maxPacketBytes: 0}
    ] as unknown as Array<Record<string, number | null>>) {
      const invalid = await resolveConsumerEvidence({root, selection: {kind: "symbol", recordId: "symbol_entry"}, mode: "full", limits});
      assert.equal(invalid.status, "invalid", `malformed limits must be rejected: ${JSON.stringify(limits)}`);
    }
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("a pinned generation remains handoff-verifiable after unrelated INDEX advancement and rejects unpublished ids", async () => {
  const root = await temporaryRoot();
  try {
    const first = modelFixture("generation_a");
    await installBundle(root, first.rendered);
    await mkdir(path.join(root, "src"), {recursive: true});
    await writeFile(path.join(root, "src", "entry.ts"), source);
    const baseline = await resolveConsumerEvidence({root, selection: {kind: "symbol", recordId: "symbol_entry"}, mode: "full"});
    assert.equal(baseline.status, "ok", JSON.stringify(baseline));
    if (baseline.status !== "ok") return;
    let priorRendered = first.rendered;
    for (let index = 0; index < 34; index += 1) {
      const id = `generation_${String(index + 2).padStart(2, "0")}`;
      const next = modelFixture(id, {
        generationId: priorRendered.sealedGeneration.generationId,
        manifest: priorRendered.sealedGeneration.manifest,
        entry: priorRendered.sealedGeneration.entry,
        committedIndexHash: priorRendered.rootIndexHash
      });
      await installBundle(root, next.rendered, filePath => filePath === "INDEX.md" || filePath.startsWith(`generations/${id}/`));
      priorRendered = next.rendered;
    }
    const handoff = await verifyPortablePinHandoff(root, baseline.snapshot ? {
      generationId: baseline.snapshot.generationId,
      entry: {path: baseline.snapshot.entry.path, sha256: baseline.snapshot.entry.sha256},
      manifest: {path: baseline.snapshot.manifest.path, sha256: baseline.snapshot.manifest.sha256}
    } : {generationId: "missing", entry: {path: "generations/missing/ENTRY.md", sha256: digest("x")}, manifest: {path: "generations/missing/manifest.json", sha256: digest("x")}});
    assert.equal(handoff.status, "ok", JSON.stringify(handoff));
    if (handoff.status !== "ok") return;
    assert.ok(handoff.handoff, "successful handoff verification issues an owner capability");
    const bridged = await resolveConsumerEvidence({root, selection: {kind: "symbol", recordId: "symbol_entry"}, mode: "delta", prior: priorFrom(baseline), pinHandoff: handoff.handoff});
    assert.equal(bridged.status, "ok", JSON.stringify(bridged));
    await installBundle(root, modelFixture("unpublished").rendered, filePath => filePath.startsWith("generations/unpublished/"));
    const unpublished = await resolveConsumerEvidence({root, generationId: "unpublished", selection: {kind: "symbol", recordId: "symbol_entry"}, mode: "full"});
    assert.notEqual(unpublished.status, "ok");
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test("owner-authenticated pin receipts survive restart and skip missing intermediate generations", async () => {
  const root = await temporaryRoot();
  const otherRoot = await temporaryRoot();
  try {
    const first = modelFixture("generation_a");
    await installBundle(root, first.rendered);
    await mkdir(path.join(root, "src"), {recursive: true});
    await writeFile(path.join(root, "src", "entry.ts"), source);
    const baseline = await resolveConsumerEvidence({root, selection: {kind: "symbol", recordId: "symbol_entry"}, mode: "full"});
    assert.equal(baseline.status, "ok", JSON.stringify(baseline));
    if (baseline.status !== "ok") return;
    const issued = await issuePortablePinReceipt(root, {
      generationId: baseline.snapshot.generationId,
      entry: baseline.snapshot.entry,
      manifest: baseline.snapshot.manifest
    });
    assert.equal(issued.status, "ok", JSON.stringify(issued));
    if (issued.status !== "ok") return;
    const serializedReceipt = JSON.parse(JSON.stringify(issued.receipt)) as typeof issued.receipt;

    let previous = first.rendered;
    for (let index = 0; index < 40; index += 1) {
      const id = `generation_${String(index + 2).padStart(2, "0")}`;
      const next = modelFixture(id, {
        generationId: previous.sealedGeneration.generationId,
        manifest: previous.sealedGeneration.manifest,
        entry: previous.sealedGeneration.entry,
        committedIndexHash: previous.rootIndexHash
      });
      await installBundle(root, next.rendered, filePath => filePath === "INDEX.md" || filePath.startsWith(`generations/${id}/`));
      previous = next.rendered;
    }
    for (let index = 2; index <= 40; index += 1) {
      await rm(path.join(root, ".blueprint", "codebase", "generations", `generation_${String(index).padStart(2, "0")}`), {recursive: true, force: true});
    }

    // A query import creates a fresh consumer module instance. The receipt and
    // owner key are the only authority state retained on disk; a child-process
    // restart is covered by the parent integration probe.
    const freshConsumer = await import(`${pathToFileURL(path.resolve("src/mcp/codebase-index/consumer-evidence.ts")).href}?fresh=${Date.now()}-${Math.random()}`);
    const restored = await freshConsumer.resolveConsumerEvidence({
      root,
      selection: {kind: "symbol", recordId: "symbol_entry"},
      mode: "full",
      pinReceipt: serializedReceipt
    });
    assert.equal(restored.status, "ok", JSON.stringify(restored));

    const forged = {...serializedReceipt, authentication: "0".repeat(64)};
    const forgedResult = await freshConsumer.resolveConsumerEvidence({root, selection: {kind: "symbol", recordId: "symbol_entry"}, mode: "full", pinReceipt: forged});
    assert.equal(forgedResult.status, "invalid");
    const crossRoot = await freshConsumer.resolveConsumerEvidence({root: otherRoot, selection: {kind: "symbol", recordId: "symbol_entry"}, mode: "full", pinReceipt: serializedReceipt});
    assert.equal(crossRoot.status, "invalid");
    assert.deepEqual(await readdir(otherRoot), [], "restore must not provision a key or receipt directories in another root");

    await writeFile(path.join(root, ".blueprint", "codebase", "generations", "generation_a", "ENTRY.md"), "tampered");
    const tamperedTarget = await freshConsumer.resolveConsumerEvidence({root, selection: {kind: "symbol", recordId: "symbol_entry"}, mode: "full", pinReceipt: serializedReceipt});
    assert.equal(tamperedTarget.status, "invalid");

    await installBundle(root, first.rendered, filePath => filePath.startsWith("generations/generation_a/"));
    await writeFile(path.join(root, "src", "entry.ts"), `${source}changed`);
    const tamperedSource = await freshConsumer.resolveConsumerEvidence({root, selection: {kind: "symbol", recordId: "symbol_entry"}, mode: "full", pinReceipt: serializedReceipt});
    assert.equal(tamperedSource.status, "reread_required");
  } finally {
    await rm(root, {recursive: true, force: true});
    await rm(otherRoot, {recursive: true, force: true});
  }
});

test("pin receipt and owner-key writes reject parent swaps and clean raced files", async () => {
  const keyRoot = await temporaryRoot();
  const keyOutside = await temporaryRoot();
  const receiptRoot = await temporaryRoot();
  const receiptOutside = await temporaryRoot();
  try {
    const fixture = modelFixture("generation_a");
    const install = async (root: string): Promise<void> => {
      await installBundle(root, fixture.rendered);
      await mkdir(path.join(root, "src"), {recursive: true});
      await writeFile(path.join(root, "src", "entry.ts"), source);
    };
    await install(keyRoot);
    const originalOpen = fs.open;
    let injected = false;
    fs.open = async function(file: Parameters<typeof fs.open>[0], ...args: Parameters<typeof fs.open> extends [unknown, ...infer Rest] ? Rest : never) {
      const flags = args[0];
      const target = String(file);
      if (!injected && typeof flags === "number" && (flags & fsConstants.O_CREAT) !== 0 && target.endsWith("/owner.key")) {
        injected = true;
        const parent = path.join(keyRoot, ".blueprint/codebase-operations/pin-authority");
        await fs.rename(parent, `${parent}-original`);
        await fs.symlink(keyOutside, parent);
      }
      return Reflect.apply(originalOpen, fs, [file, ...args] as Parameters<typeof fs.open>);
    } as typeof fs.open;
    syncBuiltinESMExports();
    try {
      const result = await issuePortablePinReceipt(keyRoot, {
        generationId: fixture.rendered.sealedGeneration.generationId,
        entry: {path: fixture.rendered.sealedGeneration.entry.path, sha256: fixture.rendered.sealedGeneration.entry.checksum},
        manifest: {path: fixture.rendered.sealedGeneration.manifest.path, sha256: fixture.rendered.sealedGeneration.manifest.checksum}
      });
      assert.equal(result.status, "invalid");
      assert.deepEqual(await readdir(keyOutside), [], "a raced owner-key create must be cleaned outside the root");
    } finally {
      fs.open = originalOpen;
      syncBuiltinESMExports();
    }

    await install(receiptRoot);
    const initial = await issuePortablePinReceipt(receiptRoot, {
      generationId: fixture.rendered.sealedGeneration.generationId,
      entry: {path: fixture.rendered.sealedGeneration.entry.path, sha256: fixture.rendered.sealedGeneration.entry.checksum},
      manifest: {path: fixture.rendered.sealedGeneration.manifest.path, sha256: fixture.rendered.sealedGeneration.manifest.checksum}
    });
    assert.equal(initial.status, "ok", JSON.stringify(initial));
    const originalReceiptOpen = fs.open;
    injected = false;
    fs.open = async function(file: Parameters<typeof fs.open>[0], ...args: Parameters<typeof fs.open> extends [unknown, ...infer Rest] ? Rest : never) {
      const flags = args[0];
      const target = String(file);
      if (!injected && typeof flags === "number" && (flags & fsConstants.O_CREAT) !== 0 && target.includes("/pin-authority/receipts/") && target.endsWith(".json")) {
        injected = true;
        const parent = path.join(receiptRoot, ".blueprint/codebase-operations/pin-authority/receipts");
        await fs.rename(parent, `${parent}-original`);
        await fs.symlink(receiptOutside, parent);
      }
      return Reflect.apply(originalReceiptOpen, fs, [file, ...args] as Parameters<typeof fs.open>);
    } as typeof fs.open;
    syncBuiltinESMExports();
    try {
      assert.equal((await issuePortablePinReceipt(receiptRoot, initial.status === "ok" ? initial.receipt.pin : {generationId: "missing", entry: {path: "generations/missing/ENTRY.md", sha256: "0".repeat(64)}, manifest: {path: "generations/missing/manifest.json", sha256: "0".repeat(64)}})).status, "invalid");
      assert.deepEqual(await readdir(receiptOutside), [], "a raced receipt create must be cleaned outside the root");
    } finally {
      fs.open = originalReceiptOpen;
      syncBuiltinESMExports();
    }

    const emptyRoot = await temporaryRoot();
    try {
      assert.equal((await restorePortablePinReceipt(emptyRoot, initial.status === "ok" ? initial.receipt : {})).status, "invalid");
      assert.deepEqual(await readdir(emptyRoot), [], "restore must be read-only for an unrelated root");
    } finally {
      await rm(emptyRoot, {recursive: true, force: true});
    }
  } finally {
    await rm(keyRoot, {recursive: true, force: true});
    await rm(keyOutside, {recursive: true, force: true});
    await rm(receiptRoot, {recursive: true, force: true});
    await rm(receiptOutside, {recursive: true, force: true});
  }
});
