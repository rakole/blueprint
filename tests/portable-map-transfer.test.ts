import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {createProviderMap} from "./helpers/portable-provider-fixture.js";
import {runLexicalBaseline} from "../scripts/portable-map-pilot.mjs";

type PortableDescriptor = {
  version: number;
  generationId: string;
  manifest: {path: string; sha256: string};
  entry: {path: string; sha256: string};
};

type PortableManifest = {
  generationId: string;
  inventoryShards: Array<{path: string}>;
  checksums: {pages: Array<{path: string}>; compatibility: Record<string, string>};
};

type TransferNavigation =
  | {status: "ok"; sourcePath: string; source: string; mapPath: string}
  | {status: "fallback"; reason: "absent" | "malformed" | "stale" | "missing-source" | "no-match"; path?: string};

const MAP_ROOT = path.join(".blueprint", "codebase");
const POINTER = "When locating code, understanding repository responsibilities or constraints, or finding related tests, read `.blueprint/codebase/INDEX.md` if present and follow its guidance. Reuse it within the task; read an already-known target directly.\n";

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function filesUnder(root: string, relative = ""): Promise<string[]> {
  const current = path.join(root, relative);
  const result: string[] = [];
  for (const entry of await readdir(current, {withFileTypes: true})) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(root, child));
    else if (entry.isFile()) result.push(child.split(path.sep).join("/"));
  }
  return result.sort();
}

async function copyFiles(sourceRoot: string, destinationRoot: string, relativePaths: readonly string[]): Promise<void> {
  for (const relativePath of relativePaths) {
    const destination = path.join(destinationRoot, relativePath);
    await mkdir(path.dirname(destination), {recursive: true});
    await writeFile(destination, await readFile(path.join(sourceRoot, relativePath)));
  }
}

async function writeRenderedFiles(destinationRoot: string, files: Readonly<Record<string, Uint8Array>>, relativePaths: readonly string[]): Promise<void> {
  for (const relativePath of relativePaths) {
    const destination = path.join(destinationRoot, relativePath);
    await mkdir(path.dirname(destination), {recursive: true});
    await writeFile(destination, files[relativePath]!);
  }
}

function descriptorFromIndex(index: string): PortableDescriptor | null {
  const line = index.split(/\r?\n/).find(item => item.includes("blueprint:portable-root-descriptor"));
  const match = line?.match(/^<!-- blueprint:portable-root-descriptor (.+) -->$/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[1]!) as PortableDescriptor;
    return value.version === 1 && typeof value.generationId === "string" ? value : null;
  } catch {
    return null;
  }
}

async function installProviderSources(root: string, files: Array<{path: string; bytes: Uint8Array}>): Promise<void> {
  for (const file of files) {
    const target = path.join(root, file.path);
    await mkdir(path.dirname(target), {recursive: true});
    await writeFile(target, file.bytes);
  }
}

async function createTransferFixture(t: {after: (fn: () => Promise<void>) => void}) {
  const sourceRoot = await mkdtemp(path.join(os.tmpdir(), "portable-map-transfer-source-"));
  const destinationRoot = await mkdtemp(path.join(os.tmpdir(), "portable-map-transfer-destination-"));
  t.after(async () => Promise.all([
    rm(sourceRoot, {recursive: true, force: true}),
    rm(destinationRoot, {recursive: true, force: true})
  ]));

  // This uses the product renderer and mixed-language adapters to produce the
  // transfer bytes. Consumption below intentionally uses only filesystem APIs.
  const map = await createProviderMap("gen-001");
  await installProviderSources(sourceRoot, map.files);
  await writeFile(path.join(sourceRoot, "AGENTS.md"), POINTER, "utf8");
  const renderedPaths = Object.keys(map.rendered.files).filter(relativePath =>
    relativePath === "INDEX.md" || relativePath.startsWith("generations/gen-001/")
  );
  await writeRenderedFiles(path.join(sourceRoot, MAP_ROOT), map.rendered.files, renderedPaths);
  // These harmless sentinels model state deliberately outside the portable
  // transfer unit. The root compatibility view and unreferenced generation
  // must also stay behind when only the selected generation is copied.
  await mkdir(path.join(sourceRoot, ".blueprint", "sessions"), {recursive: true});
  await mkdir(path.join(sourceRoot, ".blueprint", "receipts"), {recursive: true});
  await mkdir(path.join(sourceRoot, ".blueprint", "journals"), {recursive: true});
  await mkdir(path.join(sourceRoot, ".blueprint", "keys"), {recursive: true});
  await writeFile(path.join(sourceRoot, ".blueprint", "sessions", "transfer-sentinel.json"), "harmless session sentinel\n", "utf8");
  await writeFile(path.join(sourceRoot, ".blueprint", "receipts", "transfer-sentinel.json"), "harmless receipt sentinel\n", "utf8");
  await writeFile(path.join(sourceRoot, ".blueprint", "journals", "transfer-sentinel.json"), "harmless journal sentinel\n", "utf8");
  await writeFile(path.join(sourceRoot, ".blueprint", "keys", "transfer-sentinel.txt"), "harmless key-shaped sentinel\n", "utf8");
  await writeFile(path.join(sourceRoot, MAP_ROOT, "STACK.md"), "root compatibility view sentinel\n", "utf8");
  await mkdir(path.join(sourceRoot, MAP_ROOT, "generations", "gen-unused"), {recursive: true});
  await writeFile(path.join(sourceRoot, MAP_ROOT, "generations", "gen-unused", "ENTRY.md"), "unreferenced generation sentinel\n", "utf8");

  const index = await readFile(path.join(sourceRoot, MAP_ROOT, "INDEX.md"), "utf8");
  const descriptor = descriptorFromIndex(index);
  assert.ok(descriptor, "renderer output must carry one portable root descriptor");
  assert.equal(descriptor!.manifest.path, `generations/${descriptor!.generationId}/manifest.json`);
  assert.equal(descriptor!.entry.path, `generations/${descriptor!.generationId}/ENTRY.md`);
  const manifest = JSON.parse(await readFile(path.join(sourceRoot, MAP_ROOT, descriptor!.manifest.path), "utf8")) as PortableManifest;
  assert.equal(manifest.generationId, descriptor!.generationId);

  const sourceMapFiles = await filesUnder(path.join(sourceRoot, MAP_ROOT));
  const generationPrefix = `generations/${descriptor!.generationId}/`;
  assert.equal(sourceMapFiles.includes("INDEX.md"), true);
  assert.equal(sourceMapFiles.includes("STACK.md"), true);
  assert.equal(sourceMapFiles.includes("generations/gen-unused/ENTRY.md"), true);
  const expectedGenerationFiles = new Set([
    descriptor!.entry.path,
    descriptor!.manifest.path,
    ...manifest.inventoryShards.map(shard => shard.path),
    ...manifest.checksums.pages.map(page => page.path),
    ...Object.keys(manifest.checksums.compatibility).map(id => `${generationPrefix}compatibility/${id.toUpperCase()}.md`)
  ]);
  for (const relativePath of expectedGenerationFiles) assert.equal(sourceMapFiles.includes(relativePath), true, relativePath);

  // The deliberate copy starts with the same source and pointer, then copies
  // only INDEX plus the complete referenced generation subtree.
  await installProviderSources(destinationRoot, map.files);
  await writeFile(path.join(destinationRoot, "AGENTS.md"), POINTER, "utf8");
  const transferPaths = sourceMapFiles.filter(relativePath => relativePath === "INDEX.md" || relativePath.startsWith(generationPrefix));
  await copyFiles(path.join(sourceRoot, MAP_ROOT), path.join(destinationRoot, MAP_ROOT), transferPaths);
  return {sourceRoot, destinationRoot, mapRoot: path.join(destinationRoot, MAP_ROOT), descriptor: descriptor!, manifest};
}

async function readInventoryRecords(mapRoot: string, descriptor: PortableDescriptor, manifest: PortableManifest): Promise<Array<Record<string, unknown>>> {
  const records: Array<Record<string, unknown>> = [];
  for (const shard of manifest.inventoryShards) {
    const relative = shard.path.slice(`generations/${descriptor.generationId}/`.length);
    const body = JSON.parse(await readFile(path.join(mapRoot, `generations/${descriptor.generationId}`, relative), "utf8")) as {records?: unknown[]};
    for (const record of body.records ?? []) {
      if (record && typeof record === "object") records.push(record as Record<string, unknown>);
    }
  }
  return records;
}

async function navigatePortableTransfer(root: string, term: string): Promise<TransferNavigation> {
  const mapRoot = path.join(root, MAP_ROOT);
  let descriptor: PortableDescriptor | null;
  let manifest: PortableManifest;
  try {
    descriptor = descriptorFromIndex(await readFile(path.join(mapRoot, "INDEX.md"), "utf8"));
    if (!descriptor) return {status: "fallback", reason: "malformed"};
    manifest = JSON.parse(await readFile(path.join(mapRoot, descriptor.manifest.path), "utf8")) as PortableManifest;
    await readFile(path.join(mapRoot, descriptor.entry.path), "utf8");
  } catch (error) {
    return {status: "fallback", reason: (error as NodeJS.ErrnoException).code === "ENOENT" ? "absent" : "malformed"};
  }

  const searchRoot = path.join(mapRoot, `generations/${descriptor.generationId}/search`);
  for (const relativePath of await filesUnder(searchRoot)) {
    const mapPath = path.join(searchRoot, relativePath);
    for (const line of (await readFile(mapPath, "utf8")).split(/\r?\n/)) {
      if (!line.toLocaleLowerCase("en").includes(term.toLocaleLowerCase("en"))) continue;
      const sourceMatch = line.match(/(?:^| \| )source: ([^ |]+)/);
      const sourceWithRange = sourceMatch?.[1];
      const sourcePath = sourceWithRange?.replace(/:\d+(?:-\d+)?$/, "");
      if (!sourcePath) continue;
      let records: Array<Record<string, unknown>>;
      try {
        records = await readInventoryRecords(mapRoot, descriptor, manifest);
      } catch {
        return {status: "fallback", reason: "malformed"};
      }
      const files = records.filter(record =>
        typeof record.id === "string" &&
        typeof record.path === "string" &&
        typeof record.byteSize === "number" &&
        typeof record.contentHash === "string"
      );
      const selected = files.find(record => record.path === sourcePath);
      if (!selected) return {status: "fallback", reason: "stale", path: sourcePath};
      const selectedIds = new Set([selected.id as string]);
      for (const record of records) {
        if (record.sourceFileId === selected.id && typeof record.targetFileId === "string") selectedIds.add(record.targetFileId);
      }
      for (const file of files.filter(record => selectedIds.has(record.id as string))) {
        const filePath = file.path as string;
        const source = path.join(root, filePath);
        let bytes: Buffer;
        try {
          bytes = await readFile(source);
        } catch (error) {
          return {status: "fallback", reason: (error as NodeJS.ErrnoException).code === "ENOENT" ? "missing-source" : "stale", path: filePath};
        }
        if (bytes.byteLength !== file.byteSize || digest(bytes) !== file.contentHash) return {status: "fallback", reason: "stale", path: filePath};
      }
      try {
        return {status: "ok", sourcePath, source: await readFile(path.join(root, sourcePath), "utf8"), mapPath: path.relative(root, mapPath)};
      } catch {
        return {status: "fallback", reason: "missing-source", path: sourcePath};
      }
    }
  }
  return {status: "fallback", reason: "no-match"};
}

test("copies the complete descriptor generation and navigates it with ordinary file/search reads", async t => {
  const fixture = await createTransferFixture(t);
  const sourceMapFiles = await filesUnder(path.join(fixture.sourceRoot, MAP_ROOT));
  const destinationMapFiles = await filesUnder(fixture.mapRoot);
  const expectedTransferred = sourceMapFiles.filter(relativePath => relativePath === "INDEX.md" || relativePath.startsWith(`generations/${fixture.descriptor.generationId}/`));
  assert.deepEqual(destinationMapFiles, expectedTransferred);
  const sourceBlueprintFiles = await filesUnder(path.join(fixture.sourceRoot, ".blueprint"));
  assert.equal(sourceBlueprintFiles.some(file => /(?:sessions|receipts|journals|keys)\/transfer-sentinel/i.test(file)), true);
  for (const relativePath of expectedTransferred) {
    assert.deepEqual(
      await readFile(path.join(fixture.mapRoot, relativePath)),
      await readFile(path.join(fixture.sourceRoot, MAP_ROOT, relativePath)),
      relativePath
    );
  }
  assert.deepEqual(await readdir(fixture.mapRoot), ["INDEX.md", "generations"]);
  assert.equal(await stat(path.join(fixture.destinationRoot, "AGENTS.md")).then(result => result.isFile()), true);
  assert.equal(await readFile(path.join(fixture.destinationRoot, "AGENTS.md"), "utf8"), POINTER);
  const destinationBlueprintFiles = await filesUnder(path.join(fixture.destinationRoot, ".blueprint"));
  assert.equal(destinationBlueprintFiles.some(file => /(?:sessions|receipts|operations|journals|hmac|keys)/i.test(file)), false);
  assert.equal(destinationMapFiles.includes("STACK.md"), false);
  assert.equal(destinationMapFiles.some(file => file.includes("generations/gen-unused/")), false);

  const navigation = await navigatePortableTransfer(fixture.destinationRoot, "Service.fetch");
  assert.equal(navigation.status, "ok");
  if (navigation.status !== "ok") return;
  assert.equal(navigation.sourcePath, "src/service.ts");
  assert.match(navigation.source, /export class Service/);
  assert.match(navigation.mapPath, /generations\/gen-001\/search\//);

  const unrelatedDrift = await createTransferFixture(t);
  await writeFile(path.join(unrelatedDrift.destinationRoot, "src/main.ts"), `${await readFile(path.join(unrelatedDrift.destinationRoot, "src/main.ts"), "utf8")}// unrelated drift\n`, "utf8");
  const stillNavigable = await navigatePortableTransfer(unrelatedDrift.destinationRoot, "Service.fetch");
  assert.equal(stillNavigable.status, "ok");
});

test("falls back for changed or missing source and for legacy/no-INDEX repositories", async t => {
  const changed = await createTransferFixture(t);
  const sourcePath = path.join(changed.destinationRoot, "src/service.ts");
  await writeFile(sourcePath, `${await readFile(sourcePath, "utf8")}\n// destination drift\n`, "utf8");
  assert.deepEqual(await navigatePortableTransfer(changed.destinationRoot, "Service.fetch"), {status: "fallback", reason: "stale", path: "src/service.ts"});

  const missing = await createTransferFixture(t);
  await rm(path.join(missing.destinationRoot, "src/service.ts"));
  assert.deepEqual(await navigatePortableTransfer(missing.destinationRoot, "Service.fetch"), {status: "fallback", reason: "missing-source", path: "src/service.ts"});

  const legacy = await createTransferFixture(t);
  await rm(path.join(legacy.destinationRoot, MAP_ROOT, "INDEX.md"));
  await writeFile(path.join(legacy.destinationRoot, MAP_ROOT, "STACK.md"), "legacy compatibility view\n", "utf8");
  assert.deepEqual(await navigatePortableTransfer(legacy.destinationRoot, "Service.fetch"), {status: "fallback", reason: "absent"});
  const ordinary = await runLexicalBaseline(legacy.destinationRoot, {
    id: "legacy-service-search",
    knownTarget: false,
    searchTerm: "service",
    gold: {paths: ["src/service.ts"]},
    evidence: {required: [{path: "src/service.ts", role: "direct source"}]}
  });
  assert.equal(ordinary.sufficientEvidence, true);
  assert.equal(ordinary.firstUsefulSourceRead?.path, "src/service.ts");
});
