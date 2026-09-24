import test, {afterEach, type TestContext} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {access, mkdir, mkdtemp, readFile, rm, symlink, writeFile} from "node:fs/promises";
import path from "node:path";

import {CODEBASE_DOCUMENT_IDS} from "../src/mcp/codebase-authoring.js";
import {validatePortableMapModel} from "../src/mcp/codebase-index/model-validation.js";
import {renderPortableMap, type PortableRenderSuccess} from "../src/mcp/codebase-index/render.js";
import {
  capturePortablePublicationPreflight,
  PORTABLE_PUBLICATION_MARKER,
  portablePublicationTestHooks,
  publishPortableMap,
  type PortablePublicationPreflight
} from "../src/mcp/codebase-index/publication.js";
import {
  CODEBASE_ARTIFACTS,
  blueprintArtifactScaffold,
  blueprintArtifactValidate,
  blueprintCodebaseArtifactWrite,
  assertBlueprintRepoLockParentSafe,
  assertCodebasePublicationComplete,
  inspectBlueprintArtifacts,
  inspectBootstrapArtifacts,
  inspectCodebaseWriteGuard
} from "../src/mcp/tools/artifacts.js";
import {readResearchEvidence} from "../src/mcp/tools/research-evidence.js";
import {blueprintProjectInit, blueprintProjectPrepare, blueprintProjectStatus} from "../src/mcp/tools/project.js";
import {blueprintMapPrepare} from "../src/mcp/tools/map.js";
import {createGitRepo, initializeGitRepo} from "./helpers/git-fixtures.js";

const digest = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");

function publicationBasis(generationId: string) {
  return {
    rootHash: digest(`root:${generationId}`),
    inventoryHash: digest(`inventory:${generationId}`),
    evidenceHash: digest(`evidence:${generationId}`)
  };
}

function renderFixture(generationId: string): PortableRenderSuccess {
  const sourceHash = digest(`source:${generationId}`);
  const shards = [{
    generationId,
    shardId: "source_1",
    files: [{
      id: "file_1", path: "src/index.ts", language: "typescript" as const, role: "source" as const,
      byteSize: 24, contentHash: sourceHash, parseStatus: "parsed" as const, coverageStatus: "full" as const
    }],
    symbols: [], imports: [], relationships: []
  }];
  const model = {
    formatVersion: 1 as const,
    generationId,
    documents: Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, {
      summary: `${id} is grounded in src/index.ts.`,
      sections: [{heading: "Observed", content: `The ${id} view is source-backed.`}],
      evidencePaths: ["src/index.ts"]
    }])),
    semantic: {capabilities: [], claims: [], aliases: []}
  };
  const basis = {
    generationId,
    files: [{path: "src/index.ts", byteSize: 24, contentHash: sourceHash}],
    records: [{kind: "file" as const, recordId: "file_1", path: "src/index.ts", contentHash: sourceHash}]
  };
  const validated = validatePortableMapModel(shards, model, basis);
  assert.equal(validated.ok, true, validated.ok ? undefined : JSON.stringify(validated.diagnostics));
  if (!validated.ok) throw new Error("portable fixture did not validate");
  const rendered = renderPortableMap(validated.data, {
    generationId,
    generatedAt: "2026-09-24T10:00:00+00:00",
    gitCommit: null,
    inventoryFingerprint: digest(`inventory:${generationId}`),
    parserAssets: []
  });
  assert.equal(rendered.ok, true, rendered.ok ? undefined : JSON.stringify(rendered.diagnostics));
  if (!rendered.ok) throw new Error("portable fixture did not render");
  return rendered;
}

async function installBundle(
  root: string,
  rendered: PortableRenderSuccess,
  include: (filePath: string) => boolean
): Promise<void> {
  for (const [filePath, bytes] of Object.entries(rendered.files)) {
    if (!include(filePath)) continue;
    const target = path.join(root, ".blueprint", "codebase", filePath);
    await mkdir(path.dirname(target), {recursive: true});
    await writeFile(target, bytes);
  }
}

async function brownfieldRepo(t: TestContext): Promise<string> {
  const root = await createGitRepo("blueprint-portable-guards-");
  t.after(() => rm(path.dirname(root), {recursive: true, force: true}));
  await mkdir(path.join(root, "src"), {recursive: true});
  await writeFile(path.join(root, "src", "index.ts"), "export const entry = 1;\n", "utf8");
  return root;
}

function bootstrapSeed() {
  return {
    vision: "Help teams understand their codebase.",
    currentMilestone: "v1",
    requirements: [{
      id: "RQ-01", scope: "committed" as const, group: "Mapping",
      requirement: "Bootstrap a mapped codebase.", status: "Pending", notes: ""
    }],
    roadmapPhases: [{
      phase: "1", title: "Mapped baseline", objective: "Use the mapped baseline.",
      requirementIds: ["RQ-01"], successCriteria: ["A mapped project can start its first phase."]
    }]
  };
}

test("portable INDEX plus complete generation bootstraps without recreating root seven", async t => {
  const root = await brownfieldRepo(t);
  const rendered = renderFixture("generation_transfer");
  await installBundle(root, rendered, filePath => filePath === "INDEX.md" || filePath.startsWith("generations/generation_transfer/"));
  await mkdir(path.join(root, ".blueprint", "codebase-operations"), {recursive: true});
  await writeFile(path.join(root, ".blueprint", "codebase-operations", "trace.json"), "{}\n", "utf8");

  const inspection = await inspectBlueprintArtifacts(root);
  assert.equal(inspection.readiness, "mapped-only");
  assert.equal(inspection.codebase.mapped, true);
  assert.equal(inspection.codebase.portable.status, "valid");
  assert.equal(inspection.codebase.portable.compatibility, "absent");
  assert.equal(inspection.codebase.missing.length, CODEBASE_ARTIFACTS.length);
  assert.equal(inspection.workflowArtifactFiles.includes(".blueprint/codebase-operations/trace.json"), false);

  const bootstrap = await inspectBootstrapArtifacts(root);
  assert.equal(bootstrap.brownfield.codebaseMapped, true);
  assert.equal(bootstrap.traceabilityWarnings.some(warning => /mapping|incomplete/i.test(warning)), false);
  const prepared = await blueprintProjectPrepare({cwd: root, auto: true});
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.evidence.codebaseMapped, true);

  const initialized = await blueprintProjectInit({
    cwd: root,
    bootstrapSeed: bootstrapSeed(),
    clarification: "The first release starts from the transferred map.",
    savedDefaultsPolicy: "skip"
  });
  assert.equal("status" in initialized, false, JSON.stringify(initialized));
  for (const artifact of CODEBASE_ARTIFACTS) {
    await assert.rejects(access(path.join(root, artifact)));
  }
  assert.equal((await blueprintProjectStatus({cwd: root})).status, "initialized");
  assert.equal((await blueprintArtifactValidate({cwd: root})).valid, true);
});

test("any INDEX or unknown marker blocks legacy mutation while preserving exact no-op reuse", async t => {
  const root = await brownfieldRepo(t);
  const rendered = renderFixture("generation_index_guard");
  await installBundle(root, rendered, filePath => filePath === "INDEX.md" || filePath.startsWith("generations/generation_index_guard/"));
  const guard = await inspectCodebaseWriteGuard(root);
  assert.equal(guard.allowed, false);
  assert.equal(guard.noOpReuseAllowed, true);
  assert.match(guard.reason ?? "", /INDEX|portable/i);

  const template = "# Existing stack\n\n*Generated by `blueprint_artifact_scaffold`*\n";
  const stackPath = path.join(root, ".blueprint", "codebase", "STACK.md");
  await mkdir(path.dirname(stackPath), {recursive: true});
  await writeFile(stackPath, template, "utf8");
  const reused = await blueprintCodebaseArtifactWrite({cwd: root, artifactId: "codebase.stack", content: template});
  assert.equal(reused.status, "reused");
  await assert.rejects(
    blueprintCodebaseArtifactWrite({cwd: root, artifactId: "codebase.architecture", content: template}),
    /INDEX|portable|mutable/i
  );
  const scaffoldReuse = await blueprintArtifactScaffold({cwd: root, artifacts: [".blueprint/codebase/STACK.md"]});
  assert.deepEqual(scaffoldReuse.createdFiles, []);
  assert.deepEqual(scaffoldReuse.reusedFiles, [".blueprint/codebase/STACK.md"]);
  await assert.rejects(
    blueprintArtifactScaffold({cwd: root, artifacts: [".blueprint/codebase/ARCHITECTURE.md"], overwrite: true}),
    /INDEX|portable|mutable/i
  );

  const map = await blueprintMapPrepare({cwd: root, inputs: ["src/index.ts"]});
  assert.equal(map.status, "blocked");
  assert.equal(map.nextAction, null);
});

test("malformed marker is a conservative hard stop and cannot invent readiness", async t => {
  const root = await brownfieldRepo(t);
  const markerPath = path.join(root, PORTABLE_PUBLICATION_MARKER);
  await mkdir(path.dirname(markerPath), {recursive: true});
  await writeFile(markerPath, "{broken metadata", "utf8");
  await writeFile(path.join(root, ".blueprint", "codebase", "INDEX.md"), "not a portable index\n", "utf8");

  const inspection = await inspectBlueprintArtifacts(root);
  assert.equal(inspection.readiness, "mapping-incomplete");
  assert.equal(inspection.codebase.mapped, false);
  assert.equal(inspection.codebase.portable.marker, "unknown");
  assert.equal(inspection.codebase.portable.status, "invalid");
  const bootstrap = await inspectBootstrapArtifacts(root);
  assert.equal(bootstrap.brownfield.codebaseMapped, false);
  assert.match(bootstrap.brownfield.recommendedNextAction, /map-codebase/i);
  const map = await blueprintMapPrepare({cwd: root, inputs: ["src/index.ts"], restart: true});
  assert.equal(map.status, "blocked");
  await assert.rejects(
    blueprintArtifactScaffold({cwd: root, artifacts: [".blueprint/codebase/STACK.md"]}),
    /unknown|malformed|portable/i
  );
});

test("recognized v2 publication marker guards mutable views while immutable generation remains readable", async t => {
  const root = await mkdtemp(path.join("/private/tmp", "blueprint-portable-v2-"));
  t.after(() => rm(root, {recursive: true, force: true}));
  const rendered = renderFixture("generation_v2_guard");
  const input = {
    repositoryRoot: root,
    operationId: "op_generation_v2_guard",
    transactionId: "tx_generation_v2_guard",
    generationId: "generation_v2_guard",
    sourceBasis: publicationBasis("generation_v2_guard"),
    rendered,
    verifyFreshness: async () => true
  };
  const preflight = await capturePortablePublicationPreflight(input);
  assert.ok("operationId" in preflight, `${root}: ${JSON.stringify(preflight)}`);
  portablePublicationTestHooks.afterIndexCommit = () => { throw new Error("leave recognized marker"); };
  portablePublicationTestHooks.beforeCleanup = () => { throw new Error("leave cleanup marker"); };
  const result = await publishPortableMap({...input, preflight: preflight as PortablePublicationPreflight});
  assert.equal(result.committed, true);
  await initializeGitRepo(root);
  await mkdir(path.join(root, "src"), {recursive: true});
  await writeFile(path.join(root, "src", "index.ts"), "export const entry = 1;\n", "utf8");
  const inspection = await inspectBlueprintArtifacts(root);
  assert.equal(inspection.codebase.portable.marker, "v2");
  assert.equal(inspection.codebase.portable.status, "valid");
  assert.equal(inspection.codebase.portable.compatibility, "guarded");
  assert.equal(inspection.codebase.portable.guard, "blocked");
  assert.equal(inspection.codebase.valid.length, 0);
  assert.equal((await inspectCodebaseWriteGuard(root)).allowed, false);
  const immutableIndex = await readFile(path.join(root, ".blueprint", "codebase", "INDEX.md"), "utf8");
  assert.match(immutableIndex, /generation_v2_guard/);
  await assert.rejects(
    blueprintCodebaseArtifactWrite({cwd: root, artifactId: "codebase.stack", content: `${immutableIndex}\n`}),
    /guarded|portable|mutable/i
  );
});

test("staged generation without INDEX is not portable readiness evidence", async t => {
  const root = await brownfieldRepo(t);
  const rendered = renderFixture("generation_staged");
  await installBundle(root, rendered, filePath => filePath.startsWith("generations/generation_staged/"));
  const inspection = await inspectBlueprintArtifacts(root);
  assert.equal(inspection.codebase.portable.status, "absent");
  assert.equal(inspection.codebase.mapped, false);
  assert.equal(inspection.readiness, "mapping-incomplete");
});

test("sealed generation membership rejects unlisted evidence children", async t => {
  const root = await brownfieldRepo(t);
  const rendered = renderFixture("generation_membership_guard");
  await installBundle(root, rendered, filePath => filePath === "INDEX.md" || filePath.startsWith("generations/generation_membership_guard/"));
  const unsealed = ".blueprint/codebase/generations/generation_membership_guard/unsealed.md";
  await writeFile(path.join(root, unsealed), "UNSEALED_EVIDENCE_SENTINEL\n", "utf8");
  await assert.rejects(assertCodebasePublicationComplete(root, unsealed), /verified committed generation/i);
  await assert.rejects(readResearchEvidence(root, unsealed), /verified committed generation/i);
});

test("shared repository locking preserves a symlinked checkout root", async t => {
  const root = await brownfieldRepo(t);
  const alias = `${root}-alias`;
  await symlink(root, alias);
  t.after(() => rm(alias, {force: true}));
  await assertBlueprintRepoLockParentSafe(alias);
});

afterEach(async () => {
  for (const key of Object.keys(portablePublicationTestHooks) as Array<keyof typeof portablePublicationTestHooks>) {
    delete portablePublicationTestHooks[key];
  }
});
