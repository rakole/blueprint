import test, {afterEach} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdtemp, mkdir, readFile, readdir, rename, rm, symlink, writeFile} from "node:fs/promises";
import path from "node:path";

import {CODEBASE_DOCUMENT_IDS} from "../src/mcp/codebase-authoring.js";
import {validatePortableMapModel} from "../src/mcp/codebase-index/model-validation.js";
import {renderPortableMap, type PortableRenderSuccess} from "../src/mcp/codebase-index/render.js";
import {
  capturePortablePublicationPreflight,
  PORTABLE_PUBLICATION_MARKER,
  portablePublicationTestHooks,
  publishPortableMap,
  recoverPortableMap,
  type PortablePublicationPreflight
} from "../src/mcp/codebase-index/publication.js";

const hash = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
const roots: string[] = [];

function publicationBasis(generationId: string) {
  return {rootHash: hash(`root:${generationId}`), inventoryHash: hash(`inventory:${generationId}`), evidenceHash: hash(`evidence:${generationId}`)};
}

function authoritativeBasis(generationId: string) {
  const sourceHash = hash(`source:${generationId}`);
  return {
    generationId,
    files: [{path: "src/index.ts", byteSize: 24, contentHash: sourceHash}],
    records: [{kind: "file" as const, recordId: "file_1", path: "src/index.ts", contentHash: sourceHash}]
  };
}

function renderFixture(generationId: string): PortableRenderSuccess {
  const sourceHash = hash(`source:${generationId}`);
  const input = {
    shards: [{
      generationId,
      shardId: "shard_1",
      files: [{
        id: "file_1", path: "src/index.ts", language: "typescript" as const, role: "source" as const,
        byteSize: 24, contentHash: sourceHash, parseStatus: "parsed" as const, coverageStatus: "full" as const
      }],
      symbols: [], imports: [], relationships: []
    }],
    model: {
      formatVersion: 1 as const,
      generationId,
      documents: Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, {
        summary: `${id} is grounded in src/index.ts.`,
        sections: [{heading: "Observed", content: `The ${id} view is source-backed.`}],
        evidencePaths: ["src/index.ts"]
      }])),
      semantic: {capabilities: [], claims: [], aliases: []}
    },
    basis: authoritativeBasis(generationId)
  };
  const validated = validatePortableMapModel(input.shards, input.model, input.basis);
  assert.equal(validated.ok, true, validated.ok ? undefined : JSON.stringify(validated.diagnostics));
  if (!validated.ok) throw new Error("fixture did not validate");
  const rendered = renderPortableMap(validated.data, {
    generationId,
    generatedAt: "2026-09-24T10:00:00+00:00",
    gitCommit: null,
    inventoryFingerprint: hash(`inventory:${generationId}`),
    parserAssets: [],
    predecessorGenerationId: null
  });
  assert.equal(rendered.ok, true, rendered.ok ? undefined : JSON.stringify(rendered.diagnostics));
  if (!rendered.ok) throw new Error("fixture did not render");
  return rendered;
}

async function tempRoot(label: string): Promise<string> {
  const root = await mkdtemp(path.join("/private/tmp", `portable-publication-${label}-`));
  roots.push(root);
  return root;
}

function baseInput(root: string, generationId: string, rendered: PortableRenderSuccess) {
  return {
    repositoryRoot: root,
    operationId: `op_${generationId}`,
    transactionId: `tx_${generationId}`,
    generationId,
    sourceBasis: publicationBasis(generationId),
    rendered,
    verifyFreshness: async () => true
  };
}

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, {recursive: true, force: true});
  for (const key of Object.keys(portablePublicationTestHooks) as Array<keyof typeof portablePublicationTestHooks>) delete portablePublicationTestHooks[key];
});

test("publishes exact bytes, verifies a sealed generation, and reports retained generations", async () => {
  const root = await tempRoot("first");
  const rendered = renderFixture("gen_first");
  const input = baseInput(root, "gen_first", rendered);
  const preflight = await capturePortablePublicationPreflight(input);
  assert.ok("operationId" in preflight);
  const result = await publishPortableMap({...input, preflight: preflight as PortablePublicationPreflight});
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.status, "published");
  assert.equal(result.committed, true);
  assert.equal(result.retainedGenerations, 1);
  assert.deepEqual(await readFile(path.join(root, ".blueprint/codebase/INDEX.md")), Buffer.from(rendered.rootIndexBytes));
  assert.deepEqual(await readFile(path.join(root, ".blueprint/codebase/STACK.md")), Buffer.from(rendered.rootViewBytes["STACK.md"]!));
  await assert.rejects(readFile(path.join(root, PORTABLE_PUBLICATION_MARKER)));
  assert.equal(result.retainedBytes > 0, true);
  const retry = await publishPortableMap({...input, preflight: preflight as PortablePublicationPreflight});
  assert.equal(retry.ok, true);
  assert.equal(retry.status, "reused");
  assert.equal(retry.committed, true);
});

test("a competing prepared operation loses by target and INDEX compare-and-swap", async () => {
  const root = await tempRoot("cas");
  const first = renderFixture("gen_cas_a");
  const second = renderFixture("gen_cas_b");
  const firstInput = baseInput(root, "gen_cas_a", first);
  const secondInput = baseInput(root, "gen_cas_b", second);
  const firstPreflight = await capturePortablePublicationPreflight(firstInput);
  const secondPreflight = await capturePortablePublicationPreflight(secondInput);
  assert.ok("operationId" in firstPreflight && "operationId" in secondPreflight);
  assert.equal((await publishPortableMap({...firstInput, preflight: firstPreflight as PortablePublicationPreflight})).ok, true);
  const loser = await publishPortableMap({...secondInput, preflight: secondPreflight as PortablePublicationPreflight});
  assert.equal(loser.status, "conflict");
  assert.equal(loser.committed, false);
});

test("post-commit failure is recovered from actual INDEX and sealed generation", async () => {
  const root = await tempRoot("postcommit");
  const rendered = renderFixture("gen_postcommit");
  const input = baseInput(root, "gen_postcommit", rendered);
  const preflight = await capturePortablePublicationPreflight(input);
  portablePublicationTestHooks.afterIndexCommit = () => { throw new Error("simulated crash after INDEX rename"); };
  assert.ok("operationId" in preflight);
  portablePublicationTestHooks.beforeCleanup = () => { throw new Error("simulated cleanup crash"); };
  const committed = await publishPortableMap({...input, preflight: preflight as PortablePublicationPreflight});
  assert.equal(committed.committed, true);
  assert.equal(committed.cleanupPending, true);
  const markerBytes = await readFile(path.join(root, PORTABLE_PUBLICATION_MARKER));
  const recovered = await recoverPortableMap({repositoryRoot: root, observedMarker: hash(markerBytes)});
  assert.equal(recovered.ok, true, JSON.stringify(recovered));
  assert.equal(recovered.status, "recovered");
  await assert.rejects(readFile(path.join(root, PORTABLE_PUBLICATION_MARKER)));
});

test("post-commit cleanup preserves a divergent compatibility view as cleanup debt", async () => {
  const root = await tempRoot("postcommit-divergence");
  const rendered = renderFixture("gen_postcommit_divergence");
  const input = baseInput(root, "gen_postcommit_divergence", rendered);
  const preflight = await capturePortablePublicationPreflight(input);
  assert.ok("operationId" in preflight);
  portablePublicationTestHooks.afterIndexCommit = () => { throw new Error("simulated post-commit crash"); };
  portablePublicationTestHooks.beforeCleanup = () => { throw new Error("simulated cleanup crash"); };
  const committed = await publishPortableMap({...input, preflight: preflight as PortablePublicationPreflight});
  assert.equal(committed.committed, true);
  for (const key of Object.keys(portablePublicationTestHooks) as Array<keyof typeof portablePublicationTestHooks>) delete portablePublicationTestHooks[key];

  const markerBytes = await readFile(path.join(root, PORTABLE_PUBLICATION_MARKER));
  const external = "postcommit external compatibility edit\n";
  await writeFile(path.join(root, ".blueprint/codebase/STACK.md"), external, "utf8");
  let freshnessCalls = 0;
  const recovered = await publishPortableMap({
    ...input,
    preflight: preflight as PortablePublicationPreflight,
    verifyFreshness: () => { freshnessCalls++; return false; }
  });
  assert.equal(recovered.committed, true);
  assert.equal(recovered.cleanupPending, true);
  assert.equal(freshnessCalls, 0);
  assert.equal(await readFile(path.join(root, ".blueprint/codebase/STACK.md"), "utf8"), external);
  assert.deepEqual(await readFile(path.join(root, PORTABLE_PUBLICATION_MARKER)), markerBytes);
});

test("unchanged post-commit cleanup is callback-free and idempotent", async () => {
  const root = await tempRoot("postcommit-cleanup");
  const rendered = renderFixture("gen_postcommit_cleanup");
  const input = baseInput(root, "gen_postcommit_cleanup", rendered);
  const preflight = await capturePortablePublicationPreflight(input);
  assert.ok("operationId" in preflight);
  portablePublicationTestHooks.afterIndexCommit = () => { throw new Error("simulated post-commit crash"); };
  portablePublicationTestHooks.beforeCleanup = () => { throw new Error("simulated cleanup crash"); };
  const committed = await publishPortableMap({...input, preflight: preflight as PortablePublicationPreflight});
  assert.equal(committed.committed, true);
  for (const key of Object.keys(portablePublicationTestHooks) as Array<keyof typeof portablePublicationTestHooks>) delete portablePublicationTestHooks[key];

  const markerBytes = await readFile(path.join(root, PORTABLE_PUBLICATION_MARKER));
  let freshnessCalls = 0;
  const recovered = await recoverPortableMap({
    repositoryRoot: root,
    observedMarker: hash(markerBytes),
    verifyFreshness: () => { freshnessCalls++; return false; }
  });
  assert.equal(recovered.committed, true);
  assert.equal(recovered.cleanupPending, undefined);
  assert.equal(freshnessCalls, 0);
  await assert.rejects(readFile(path.join(root, PORTABLE_PUBLICATION_MARKER)));
});

test("markerless committed retry reports compatibility divergence without freshness or a marker", async () => {
  const root = await tempRoot("markerless-divergence");
  const rendered = renderFixture("gen_markerless_divergence");
  const input = baseInput(root, "gen_markerless_divergence", rendered);
  const preflight = await capturePortablePublicationPreflight(input);
  assert.ok("operationId" in preflight);
  const first = await publishPortableMap({...input, preflight: preflight as PortablePublicationPreflight});
  assert.equal(first.committed, true);
  await assert.rejects(readFile(path.join(root, PORTABLE_PUBLICATION_MARKER)));

  const indexPath = path.join(root, ".blueprint/codebase/INDEX.md");
  const externalStack = "after clean commit external edit\n";
  await writeFile(path.join(root, ".blueprint/codebase/STACK.md"), externalStack, "utf8");
  let freshnessCalls = 0;
  const verifyFreshness = () => { freshnessCalls++; return false; };
  const withPreflight = await publishPortableMap({...input, preflight: preflight as PortablePublicationPreflight, verifyFreshness});
  assert.equal(withPreflight.status, "committed");
  assert.equal(withPreflight.committed, true);
  assert.equal(withPreflight.cleanupPending, undefined);
  assert.equal(withPreflight.diagnostics[0]?.code, "compatibility-divergence");
  assert.equal(freshnessCalls, 0);
  assert.equal(await readFile(path.join(root, ".blueprint/codebase/STACK.md"), "utf8"), externalStack);
  assert.deepEqual(await readFile(indexPath), Buffer.from(rendered.rootIndexBytes));
  await assert.rejects(readFile(path.join(root, PORTABLE_PUBLICATION_MARKER)));

  await writeFile(path.join(root, ".blueprint/codebase/CONCERNS.md"), "second external edit\n", "utf8");
  const withoutPreflight = await publishPortableMap({...input, verifyFreshness});
  assert.equal(withoutPreflight.status, "committed");
  assert.equal(withoutPreflight.committed, true);
  assert.equal(withoutPreflight.diagnostics[0]?.code, "compatibility-divergence");
  assert.equal(freshnessCalls, 0);
  await assert.rejects(readFile(path.join(root, PORTABLE_PUBLICATION_MARKER)));
});

test("legacy CRLF views are exact-byte restored after a pre-commit failure", async () => {
  const root = await tempRoot("legacy");
  const old = renderFixture("gen_legacy_source");
  await mkdir(path.join(root, ".blueprint", "codebase", "generations"), {recursive: true});
  const oldBytes: Record<string, Buffer> = {};
  for (const id of CODEBASE_DOCUMENT_IDS) {
    const name = `${id.toUpperCase()}.md`;
    const crlf = Buffer.from(new TextDecoder().decode(old.rootViewBytes[name as keyof typeof old.rootViewBytes]).replace(/\n/g, "\r\n"), "utf8");
    oldBytes[name] = crlf;
    await writeFile(path.join(root, ".blueprint", "codebase", name), crlf);
  }
  const rendered = renderFixture("gen_legacy_upgrade");
  const input = baseInput(root, "gen_legacy_upgrade", rendered);
  const preflight = await capturePortablePublicationPreflight(input);
  assert.ok("operationId" in preflight);
  portablePublicationTestHooks.beforeIndexCommit = () => { throw new Error("simulated pre-commit crash"); };
  const failed = await publishPortableMap({...input, preflight: preflight as PortablePublicationPreflight});
  assert.equal(failed.committed, false);
  for (const id of CODEBASE_DOCUMENT_IDS) {
    const name = `${id.toUpperCase()}.md`;
    assert.deepEqual(await readFile(path.join(root, ".blueprint", "codebase", name)), oldBytes[name]);
  }
});

test("an interrupted first publication removes only its staged views and remains retryable", async () => {
  const root = await tempRoot("first-repair");
  const rendered = renderFixture("gen_first_repair");
  const input = baseInput(root, "gen_first_repair", rendered);
  const preflight = await capturePortablePublicationPreflight(input);
  assert.ok("operationId" in preflight);
  portablePublicationTestHooks.beforeIndexCommit = () => { throw new Error("simulated first-publication interruption"); };
  const interrupted = await publishPortableMap({...input, preflight: preflight as PortablePublicationPreflight});
  assert.equal(interrupted.committed, false);
  for (const id of CODEBASE_DOCUMENT_IDS) {
    await assert.rejects(readFile(path.join(root, ".blueprint", "codebase", `${id.toUpperCase()}.md`)));
  }
  await assert.rejects(readFile(path.join(root, PORTABLE_PUBLICATION_MARKER)));
  for (const key of Object.keys(portablePublicationTestHooks) as Array<keyof typeof portablePublicationTestHooks>) delete portablePublicationTestHooks[key];
  const retried = await publishPortableMap({...input, preflight: preflight as PortablePublicationPreflight});
  assert.equal(retried.ok, true, JSON.stringify(retried));
  assert.equal(retried.committed, true);
});

test("external target edits are detected at the final CAS and are never overwritten by rollback", async () => {
  const root = await tempRoot("external");
  const rendered = renderFixture("gen_external");
  const input = baseInput(root, "gen_external", rendered);
  const preflight = await capturePortablePublicationPreflight(input);
  assert.ok("operationId" in preflight);
  portablePublicationTestHooks.beforeIndexCommit = async () => {
    await writeFile(path.join(root, ".blueprint", "codebase", "STACK.md"), "external edit\n", "utf8");
  };
  const failed = await publishPortableMap({...input, preflight: preflight as PortablePublicationPreflight});
  assert.equal(failed.committed, false);
  assert.equal(await readFile(path.join(root, ".blueprint", "codebase", "STACK.md"), "utf8"), "external edit\n");
  assert.equal(failed.cleanupPending, true);
});

test("unknown marker and lock ancestor symlink fail with fixed diagnostics", async () => {
  const root = await tempRoot("safety");
  await mkdir(path.join(root, ".blueprint", "codebase"), {recursive: true});
  await writeFile(path.join(root, ".blueprint", "codebase", ".publication.json"), "not a recognized marker\n", "utf8");
  const rendered = renderFixture("gen_unknown");
  const input = baseInput(root, "gen_unknown", rendered);
  const unknown = await capturePortablePublicationPreflight(input);
  assert.equal((unknown as {diagnostics?: Array<{code: string}>}).diagnostics?.[0]?.code, "unknown-marker");

  const symlinkRoot = await tempRoot("locksymlink");
  await mkdir(path.join(symlinkRoot, ".blueprint", "codebase"), {recursive: true});
  const target = await mkdtemp(path.join("/private/tmp", "portable-lock-target-"));
  roots.push(target);
  await symlink(target, path.join(symlinkRoot, ".blueprint", "locks"));
  const rejected = await capturePortablePublicationPreflight(baseInput(symlinkRoot, "gen_symlink", renderFixture("gen_symlink")));
  assert.equal((rejected as {diagnostics?: Array<{code: string}>}).diagnostics?.[0]?.code, "unsafe-root");
});

test("root replacement during server freshness verification is rejected before any publication write", async () => {
  const root = await tempRoot("root-replace");
  const moved = `${root}-moved`;
  const rendered = renderFixture("gen_root_replace");
  const input = baseInput(root, "gen_root_replace", rendered);
  input.verifyFreshness = async () => {
    await rename(root, moved);
    roots.push(moved);
    await mkdir(root, {recursive: true});
    await mkdir(path.join(root, ".blueprint", "locks"), {recursive: true});
    await mkdir(path.join(root, ".blueprint", "codebase"), {recursive: true});
    return true;
  };
  const rejected = await capturePortablePublicationPreflight(input);
  assert.equal((rejected as {diagnostics?: Array<{code: string}>}).diagnostics?.[0]?.code, "unsafe-root");
});

test("unrelated shared-ancestor directory metadata does not stale a prepared publication", async () => {
  const root = await tempRoot("ancestor-metadata");
  const rendered = renderFixture("gen_ancestor_metadata");
  const input = baseInput(root, "gen_ancestor_metadata", rendered);
  const preflight = await capturePortablePublicationPreflight(input);
  assert.ok("operationId" in preflight);

  const sibling = await mkdtemp(path.join(path.dirname(root), "portable-publication-unrelated-sibling-"));
  roots.push(sibling);

  const published = await publishPortableMap({...input, preflight: preflight as PortablePublicationPreflight});
  assert.equal(published.committed, true, JSON.stringify(published));
  assert.equal(published.diagnostics.length, 0, JSON.stringify(published));
});

test("requires a freshness authority for capture and never follows a generations ancestor symlink", async () => {
  const root = await tempRoot("freshness-and-generation-symlink");
  const outside = await mkdtemp(path.join("/private/tmp", "portable-generation-target-"));
  roots.push(outside);
  const rendered = renderFixture("gen_symlink_generation");
  const withoutFreshness = baseInput(root, "gen_symlink_generation", rendered);
  delete (withoutFreshness as {verifyFreshness?: unknown}).verifyFreshness;
  const stale = await capturePortablePublicationPreflight(withoutFreshness);
  assert.equal((stale as {diagnostics?: Array<{code: string}>}).diagnostics?.[0]?.code, "stale-source");

  await mkdir(path.join(root, ".blueprint", "codebase"), {recursive: true});
  await symlink(outside, path.join(root, ".blueprint", "codebase", "generations"));
  const input = baseInput(root, "gen_symlink_generation", rendered);
  const preflight = await capturePortablePublicationPreflight(input);
  assert.ok("operationId" in preflight);
  const result = await publishPortableMap({...input, preflight: preflight as PortablePublicationPreflight});
  assert.equal(result.diagnostics[0]?.code, "unsafe-target");
  assert.deepEqual(await readdir(outside), []);
});

test("explicit fresh repair replaces a malformed INDEX and binds the observed CAS basis", async () => {
  const root = await tempRoot("repair-malformed-index");
  const first = renderFixture("gen_repair_original");
  const firstInput = baseInput(root, "gen_repair_original", first);
  const firstPreflight = await capturePortablePublicationPreflight(firstInput);
  assert.equal((await publishPortableMap({...firstInput, preflight: firstPreflight as PortablePublicationPreflight})).committed, true);
  const malformed = Buffer.from("damaged INDEX\n");
  await writeFile(path.join(root, ".blueprint", "codebase", "INDEX.md"), malformed);
  const replacement = renderFixture("gen_repair_replacement");
  const repairInput = {...baseInput(root, "gen_repair_replacement", replacement), repair: {authorized: true as const}};
  const repairPreflight = await capturePortablePublicationPreflight(repairInput);
  assert.ok("operationId" in repairPreflight);
  assert.equal(repairPreflight.repair, true);
  assert.equal(repairPreflight.previousIndexHash, hash(malformed));
  const published = await publishPortableMap({...repairInput, preflight: repairPreflight as PortablePublicationPreflight});
  assert.equal(published.committed, true, JSON.stringify(published));
  assert.deepEqual(await readFile(path.join(root, ".blueprint", "codebase", "INDEX.md")), Buffer.from(replacement.rootIndexBytes));
});

test("fresh repair remains strict when its observed marker or target changes", async () => {
  const root = await tempRoot("repair-concurrent");
  const rendered = renderFixture("gen_repair_partial");
  const input = baseInput(root, "gen_repair_partial", rendered);
  const preflight = await capturePortablePublicationPreflight(input);
  assert.ok("operationId" in preflight);
  portablePublicationTestHooks.beforeIndexCommit = async () => {
    await writeFile(path.join(root, ".blueprint", "codebase", "STACK.md"), "external edit\n", "utf8");
    throw new Error("controlled partial");
  };
  const interrupted = await publishPortableMap({...input, preflight: preflight as PortablePublicationPreflight});
  assert.equal(interrupted.committed, false);
  for (const key of Object.keys(portablePublicationTestHooks) as Array<keyof typeof portablePublicationTestHooks>) delete portablePublicationTestHooks[key];
  const replacement = renderFixture("gen_repair_after_partial");
  const repairInput = {...baseInput(root, "gen_repair_after_partial", replacement), repair: {authorized: true as const}};
  const repairPreflight = await capturePortablePublicationPreflight(repairInput);
  assert.ok("operationId" in repairPreflight);
  const observedMarkerBytes = await readFile(path.join(root, PORTABLE_PUBLICATION_MARKER));
  portablePublicationTestHooks.beforeMarkerWrite = async () => {
    await writeFile(path.join(root, PORTABLE_PUBLICATION_MARKER), "changed during staging\n", "utf8");
  };
  const changedMarker = await publishPortableMap({...repairInput, preflight: repairPreflight as PortablePublicationPreflight});
  assert.equal(changedMarker.diagnostics[0]?.code, "unknown-marker");
  for (const key of Object.keys(portablePublicationTestHooks) as Array<keyof typeof portablePublicationTestHooks>) delete portablePublicationTestHooks[key];
  await writeFile(path.join(root, PORTABLE_PUBLICATION_MARKER), observedMarkerBytes);
  await writeFile(path.join(root, ".blueprint", "codebase", "STACK.md"), "changed after repair preflight\n", "utf8");
  const staleTarget = await publishPortableMap({...repairInput, preflight: repairPreflight as PortablePublicationPreflight});
  assert.equal(staleTarget.diagnostics[0]?.code, "stale-target");
  await writeFile(path.join(root, PORTABLE_PUBLICATION_MARKER), "unknown marker\n", "utf8");
  const unknown = await capturePortablePublicationPreflight(repairInput);
  assert.equal((unknown as {diagnostics?: Array<{code: string}>}).diagnostics?.[0]?.code, "unknown-marker");
});

test("missing freshness blocks pre-commit recovery while committed cleanup stays callback-free", async () => {
  const root = await tempRoot("freshness-recovery");
  const rendered = renderFixture("gen_freshness_recovery");
  const input = baseInput(root, "gen_freshness_recovery", rendered);
  const preflight = await capturePortablePublicationPreflight(input);
  assert.ok("operationId" in preflight);
  portablePublicationTestHooks.afterMarkerWrite = () => { throw new Error("marker interruption"); };
  const failed = await publishPortableMap({...input, preflight: preflight as PortablePublicationPreflight});
  assert.equal(failed.committed, false);
  assert.equal(failed.status, "partial");
  assert.deepEqual(await readFile(path.join(root, PORTABLE_PUBLICATION_MARKER)).then(() => true), true);
  for (const key of Object.keys(portablePublicationTestHooks) as Array<keyof typeof portablePublicationTestHooks>) delete portablePublicationTestHooks[key];
  const markerBytes = await readFile(path.join(root, PORTABLE_PUBLICATION_MARKER));
  const blocked = await recoverPortableMap({repositoryRoot: root, observedMarker: hash(markerBytes)});
  assert.equal(blocked.diagnostics[0]?.code, "stale-source");
});
