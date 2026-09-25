import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {cp, mkdtemp, readFile, readdir, rm, symlink, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {
  createPortableStudyWorkspace,
  PortableStudyWorkspaceError,
  STUDY_ARMS
} from "../scripts/portable-map-study-workspace.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pilotSource = path.join(repoRoot, "tests/fixtures/portable-map-pilot/repository");
const pilotBundle = path.join(repoRoot, "tests/fixtures/portable-map-pilot/bundle");
const evaluationSource = path.join(repoRoot, "tests/fixtures/portable-map-evaluation/sources/python-library");
const evaluationBundle = path.join(repoRoot, "tests/fixtures/portable-map-evaluation/maps/python-library/bundle");

async function sourceManifest(root: string) {
  const files: {path: string; bytes: number; sha256: string}[] = [];
  async function walk(current: string) {
    const entries = await readdir(current, {withFileTypes: true});
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
      if (entry.name === ".git" || entry.name === ".blueprint" || entry.name === "node_modules") continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else {
        const bytes = await readFile(absolute);
        files.push({
          path: path.relative(root, absolute).split(path.sep).join("/"),
          bytes: bytes.byteLength,
          sha256: createHash("sha256").update(bytes).digest("hex")
        });
      }
    }
  }
  await walk(root);
  return {files};
}

test("materializes isolated arm layouts and retains declared source bytes", async t => {
  const expectedManifest = await sourceManifest(pilotSource);
  const workspaces = [];
  t.after(async () => Promise.all(workspaces.map(workspace => workspace.dispose())));

  for (const arm of Object.values(STUDY_ARMS)) {
    const workspace = await createPortableStudyWorkspace({
      sourceRoot: pilotSource,
      expectedManifest,
      mapBundleDir: pilotBundle,
      arm,
      originalExtensionPath: repoRoot,
      currentExtensionPath: repoRoot,
      opaqueLabel: "opaque-arm-label",
      autoBootstrap: false
    });
    workspaces.push(workspace);
    assert.match(path.basename(workspace.workspaceRoot), /^portable-study-workspace-/u);
    assert.doesNotMatch(workspace.workspaceRoot, /opaque-arm-label/u);
    assert.equal(await readFile(path.join(workspace.workspaceRoot, "AGENTS.md"), "utf8"), await readFile(path.join(pilotSource, "AGENTS.md"), "utf8"));
    assert.equal(await readFile(path.join(workspace.workspaceRoot, "python/rates.py"), "utf8"), await readFile(path.join(pilotSource, "python/rates.py"), "utf8"));
    if (arm === STUDY_ARMS.standaloneSource) {
      await assert.rejects(() => readFile(path.join(workspace.workspaceRoot, ".blueprint")));
    }
    if (arm === STUDY_ARMS.standalonePortable) {
      const pointer = await readFile(path.join(workspace.workspaceRoot, "AGENTS.md"), "utf8");
      assert.match(pointer, /\.blueprint\/codebase\/INDEX\.md/u);
      assert.match(pointer, /blueprint:portable-codebase-index:start/u);
      assert.equal(await readFile(path.join(workspace.workspaceRoot, ".blueprint/codebase/INDEX.md"), "utf8"), await readFile(path.join(pilotBundle, "INDEX.md"), "utf8"));
      await assert.rejects(() => readFile(path.join(workspace.workspaceRoot, ".blueprint/codebase/ARCHITECTURE.md")));
      await assert.rejects(() => readFile(path.join(workspace.workspaceRoot, ".blueprint/phases")));
    }
    if (arm === STUDY_ARMS.blueprintLegacy || arm === STUDY_ARMS.blueprintCompact) assert.equal(workspace.copied.mapFiles.length, 7);
    if (arm === STUDY_ARMS.blueprintPortable) {
      assert.ok(workspace.copied.mapFiles.includes(".blueprint/codebase/INDEX.md"));
      assert.match(await readFile(path.join(workspace.workspaceRoot, "AGENTS.md"), "utf8"), /blueprint:portable-codebase-index:start/u);
    }
  }
});

test("rejects changed, extra, and symlinked frozen source inputs", async t => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "portable-study-workspace-source-"));
  t.after(() => rm(parent, {recursive: true, force: true}));
  const source = path.join(parent, "source");
  await writeFile(path.join(parent, "manifest.json"), "{}", "utf8");
  await writeFile(path.join(parent, "sentinel.txt"), "frozen\n", "utf8");
  await (await import("node:fs/promises")).mkdir(source, {recursive: true});
  await writeFile(path.join(source, "README.md"), "frozen\n", "utf8");
  const manifest = await sourceManifest(source);
  await assert.rejects(
    () => createPortableStudyWorkspace({sourceRoot: source, expectedManifest: {...manifest, sourceManifestSha256: "0".repeat(64)}, arm: STUDY_ARMS.standaloneSource, autoBootstrap: false}),
    (error: unknown) => error instanceof PortableStudyWorkspaceError && error.code === "source-manifest-mismatch"
  );
  await writeFile(path.join(source, "README.md"), "changed\n", "utf8");
  await assert.rejects(
    () => createPortableStudyWorkspace({sourceRoot: source, expectedManifest: manifest, arm: STUDY_ARMS.standaloneSource, autoBootstrap: false}),
    (error: unknown) => error instanceof PortableStudyWorkspaceError && error.code === "source-checksum-mismatch"
  );
  await writeFile(path.join(source, "README.md"), "frozen\n", "utf8");
  await writeFile(path.join(source, "extra.txt"), "unexpected\n", "utf8");
  await assert.rejects(
    () => createPortableStudyWorkspace({sourceRoot: source, expectedManifest: manifest, arm: STUDY_ARMS.standaloneSource, autoBootstrap: false}),
    (error: unknown) => error instanceof PortableStudyWorkspaceError && error.code === "source-manifest-mismatch"
  );
  await rm(path.join(source, "extra.txt"));
  await symlink(path.join(source, "README.md"), path.join(source, "linked.md"));
  await assert.rejects(
    () => createPortableStudyWorkspace({sourceRoot: source, expectedManifest: manifest, arm: STUDY_ARMS.standaloneSource, autoBootstrap: false}),
    (error: unknown) => error instanceof PortableStudyWorkspaceError && error.code === "symlink"
  );
});

test("rejects undeclared portable generation files before transfer", async t => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "portable-study-map-seal-"));
  t.after(() => rm(parent, {recursive: true, force: true}));
  const mapCopy = path.join(parent, "bundle");
  await cp(pilotBundle, mapCopy, {recursive: true});
  await writeFile(path.join(mapCopy, "generations/gen-001/answer.txt"), "private answer\n");
  const expectedManifest = await sourceManifest(pilotSource);
  await assert.rejects(
    () => createPortableStudyWorkspace({sourceRoot: pilotSource, expectedManifest, mapBundleDir: mapCopy, arm: STUDY_ARMS.standalonePortable, autoBootstrap: false}),
    (error: unknown) => error instanceof PortableStudyWorkspaceError && error.code === "unsealed-generation"
  );
});

test("runs actual public synthetic bootstrap and preserves native preparation statuses", async t => {
  const expectedManifest = await sourceManifest(evaluationSource);
  const workspace = await createPortableStudyWorkspace({
    sourceRoot: evaluationSource,
    expectedManifest,
    mapBundleDir: evaluationBundle,
    arm: STUDY_ARMS.blueprintPortable,
    currentExtensionPath: repoRoot,
    opaqueLabel: "native-preflight",
    autoBootstrap: true
  });
  t.after(() => workspace.dispose());

  assert.equal(workspace.bootstrapResult?.status, "prepared");
  assert.equal(workspace.bootstrapResult?.prepare.payload?.status, "ready");
  assert.ok(workspace.bootstrapResult?.init.payload?.createdPaths.includes(".blueprint/PROJECT.md"));
  assert.ok(workspace.bootstrapResult?.init.payload?.createdPaths.includes(".blueprint/config.json"));
  assert.ok(workspace.bootstrapResult?.actions.actions.some(action => action.tool === "blueprint_project_prepare"));
  assert.ok(workspace.bootstrapResult?.actions.actions.some(action => action.tool === "blueprint_project_init"));

  const implementation = await workspace.prepareNative({taskClass: "implementation"});
  assert.equal(implementation.status, "prepared");
  assert.equal(implementation.preparations[0]?.taskClass, "implementation");
  assert.equal(implementation.preparations[0]?.result.provenance.tool, "blueprint_phase_context");
  assert.equal(implementation.preparations[0]?.result.provenance.status, "ok");

  const review = await workspace.prepareNative({taskClass: "review"});
  assert.equal(review.preparations[0]?.result.payload?.status, "invalid");
  assert.match(String(review.preparations[0]?.result.payload?.reason), /explicit --files|reviewable repo files/iu);
});

test("preflights original086 and current compact public servers with frozen compatibility views", async t => {
  const expectedManifest = await sourceManifest(evaluationSource);
  const workspaces = [];
  t.after(async () => Promise.all(workspaces.map(workspace => workspace.dispose())));
  const configured = String(process.env.PORTABLE_MAP_STUDY_BASELINES ?? "").split(path.delimiter).filter(Boolean);
  for (const [arm, extension] of [
    [STUDY_ARMS.blueprintLegacy, {originalExtensionPath: configured[0] ?? repoRoot}],
    [STUDY_ARMS.blueprintCompact, {currentExtensionPath: configured[1] ?? repoRoot}]
  ] as const) {
    const workspace = await createPortableStudyWorkspace({
      sourceRoot: evaluationSource,
      expectedManifest,
      mapBundleDir: evaluationBundle,
      arm,
      ...extension,
      opaqueLabel: "baseline-current-preflight"
    });
    workspaces.push(workspace);
    assert.equal(workspace.bootstrapResult?.status, "prepared");
    assert.equal(workspace.bootstrapResult?.prepare.payload?.status, "ready");
    const preparation = await workspace.prepareNative({taskClass: "implementation"});
    assert.equal(preparation.preparations[0]?.result.provenance.tool, "blueprint_phase_context");
    assert.equal(preparation.preparations[0]?.result.provenance.status, "ok");
  }
});

test("standalone arms never create MCP bootstrap or adapter state", async t => {
  const expectedManifest = await sourceManifest(pilotSource);
  const source = await createPortableStudyWorkspace({sourceRoot: pilotSource, expectedManifest, arm: STUDY_ARMS.standaloneSource, autoBootstrap: true});
  t.after(() => source.dispose());
  assert.equal(source.bootstrapResult, null);
  await assert.rejects(() => source.prepareNative(), (error: unknown) => error instanceof PortableStudyWorkspaceError && error.code === "standalone-arm");
});

test("dispose remains bound to the factory-owned root and runtime sibling", async t => {
  const expectedManifest = await sourceManifest(pilotSource);
  const workspace = await createPortableStudyWorkspace({
    sourceRoot: pilotSource,
    expectedManifest,
    mapBundleDir: pilotBundle,
    arm: STUDY_ARMS.blueprintPortable,
    currentExtensionPath: repoRoot,
    autoBootstrap: false
  });
  const unrelated = await mkdtemp(path.join(os.tmpdir(), "portable-study-unrelated-"));
  const originalRoot = workspace.workspaceRoot;
  t.after(async () => { await rm(unrelated, {recursive: true, force: true}); await workspace.dispose(); });
  await writeFile(path.join(unrelated, "sentinel"), "keep\n");
  try { (workspace as {workspaceRoot: string}).workspaceRoot = unrelated; } catch { /* read-only public path */ }
  await workspace.dispose();
  await assert.rejects(() => readFile(path.join(originalRoot, "AGENTS.md")));
  assert.equal(await readFile(path.join(unrelated, "sentinel"), "utf8"), "keep\n");
  assert.equal(workspace.runtimeEnvironment?.BLUEPRINT_GLOBAL_HOME !== undefined, true);
});

test("native preparation forwards route controls and rejects dropped wrapper keys", async t => {
  const expectedManifest = await sourceManifest(evaluationSource);
  const workspace = await createPortableStudyWorkspace({
    sourceRoot: evaluationSource,
    expectedManifest,
    mapBundleDir: evaluationBundle,
    arm: STUDY_ARMS.blueprintPortable,
    currentExtensionPath: repoRoot,
    autoBootstrap: false
  });
  t.after(() => workspace.dispose());
  await assert.rejects(() => workspace.prepareNative({taskClass: "research", unsupportedControl: true}), (error: unknown) => error instanceof PortableStudyWorkspaceError && error.code === "unknown-option");
});
