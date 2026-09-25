import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  ARMS,
  ARM_NAMES,
  BUDGETS,
  evaluateQuery,
  runNavigation,
  scoreNavigation
} from "../scripts/portable-map-evaluation.mjs";
import { CODEBASE_DOCUMENT_IDS } from "../src/mcp/codebase-authoring.js";
import { adaptJavaScriptFile } from "../src/mcp/codebase-index/adapters/javascript.js";
import { validatePortableMapModel } from "../src/mcp/codebase-index/model-validation.js";
import { renderPortableMap } from "../src/mcp/codebase-index/render.js";

const fixtureRoot = path.join(process.cwd(), "tests", "fixtures", "portable-map-evaluation", "development", "project");

async function cloneFixture(t: { after: (fn: () => Promise<void>) => void }): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "portable-map-evaluation-"));
  t.after(async () => rm(root, { recursive: true, force: true }));
  await cp(fixtureRoot, root, { recursive: true });
  return root;
}

function policyQuery(overrides: Record<string, unknown> = {}) {
  return {
    id: "policy",
    searchTerm: "applyOrderPolicy",
    evidence: {
      required: [{ path: "src/order.ts", range: [3, 5], symbol: "applyOrderPolicy" }],
      supporting: [
        { path: "src/api.ts", range: [3, 5], symbol: "createOrder" },
        { path: "tests/order.test.ts", range: [3, 6] }
      ],
      alternatives: [[{ path: "src/order.ts", range: [3, 5], symbol: "applyOrderPolicy" }]]
    },
    ...overrides
  };
}

const digest = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

async function renderAliasTargetFixture() {
  const generationId = "actual-alias-generation";
  const sources = [
    {id: "file-alias", path: "src/alias.ts", source: "export const aliasOnly = true;\n"},
    {id: "file-target", path: "src/target.ts", source: "export function targetOnly() { return true; }\n"},
    {id: "file-claim", path: "src/claim.ts", source: "export const claimOnly = true;\n"}
  ];
  const knownFiles = sources.map(row => ({
    id: row.id,
    path: row.path,
    language: "typescript",
    role: "source",
    byteSize: Buffer.byteLength(row.source),
    contentHash: digest(row.source),
    parseStatus: "parsed",
    coverageStatus: "full"
  }));
  const extracted = [];
  for (const row of sources) {
    const output = await adaptJavaScriptFile({
      file: knownFiles.find(file => file.path === row.path),
      source: Buffer.from(row.source),
      knownFiles
    } as any);
    assert.equal(output.ok, true, JSON.stringify(output));
    extracted.push(output);
  }
  const structuralShards = extracted.map((output, index) => ({
    generationId,
    shardId: `shard-${index}`,
    files: [output.file],
    symbols: output.symbols,
    imports: output.imports,
    relationships: output.relationships,
    details: output.details
  }));
  const evidenceFor = (output: any) => ({
    kind: "file",
    recordId: output.file.id,
    path: output.file.path,
    contentHash: output.file.contentHash,
    coordinate: output.file.coordinate
  });
  const aliasEvidence = evidenceFor(extracted[0]);
  const targetEvidence = evidenceFor(extracted[1]);
  const claimEvidence = evidenceFor(extracted[2]);
  const documents = Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id, {
    summary: "The rendered alias target fixture has separate alias and target source files.",
    sections: [{heading: "Sources", content: "Alias wording intentionally differs from the target capability and claim."}],
    evidencePaths: sources.map(row => row.path)
  }]));
  const submission = {
    formatVersion: 1,
    generationId,
    documents,
    semantic: {
      capabilities: [{id: "target-capability", name: "Target implementation", summary: "Evidence lives only in the target source.", claimIds: ["target-claim"], evidence: [targetEvidence]}],
      claims: [{id: "target-claim", basis: "observed", statement: "The target implementation is source-backed.", evidence: [claimEvidence]}],
      aliases: [{id: "different-alias", alias: "strange lookup", targetKind: "capability", targetId: "target-capability", evidence: [aliasEvidence]}]
    }
  };
  const records = extracted.flatMap(output => [
    {kind: "file", recordId: output.file.id, path: output.file.path, contentHash: output.file.contentHash, coordinate: output.file.coordinate},
    ...output.symbols.map((record: any) => ({kind: "symbol", recordId: record.id, path: record.path, contentHash: record.contentHash, coordinate: record.coordinate})),
    ...output.imports.map((record: any) => ({kind: "import", recordId: record.id, path: record.sourcePath, contentHash: record.contentHash, coordinate: record.coordinate})),
    ...output.relationships.map((record: any) => ({kind: "relationship", recordId: record.id, path: record.sourcePath, contentHash: record.contentHash, coordinate: record.coordinate})),
    ...output.details.map((record: any) => ({kind: "detail", recordId: record.id, path: record.path, contentHash: record.contentHash, coordinate: record.coordinate}))
  ]);
  const validated = validatePortableMapModel(structuralShards, submission as any, {
    generationId,
    files: knownFiles.map(file => ({path: file.path, byteSize: file.byteSize, contentHash: file.contentHash})),
    records
  });
  assert.equal(validated.ok, true, JSON.stringify(validated));
  if (!validated.ok) throw new Error("alias target fixture validation failed");
  const rendered = renderPortableMap(validated.data, {
    generationId,
    generatedAt: "2026-09-25T00:00:00.000Z",
    gitCommit: null,
    inventoryFingerprint: digest("actual-alias-inventory"),
    parserAssets: []
  });
  assert.equal(rendered.ok, true, JSON.stringify(rendered));
  if (!rendered.ok) throw new Error("alias target fixture render failed");
  return {sources, rendered};
}

test("runs the four separated arms at each visible-text budget", async (t) => {
  const root = await cloneFixture(t);
  const mapRoot = path.join(root, ".blueprint", "codebase");
  const report = await evaluateQuery({ repositoryRoot: root, mapRoot, query: policyQuery() });

  assert.deepEqual(ARM_NAMES, [
    "ordinary-lexical", "compatibility-seven", "structural-only", "semantic-portable-map"
  ]);
  assert.deepEqual(BUDGETS, [4096, 8192, 12288]);
  assert.equal(report.results.length, 12);

  for (const arm of ARM_NAMES) {
    for (const budget of BUDGETS) {
      const result = report.results.find((candidate) => candidate.navigation.arm === arm && candidate.navigation.budgetBytes === budget)!;
      assert.equal(result.navigation.budgetBytes, budget);
      assert.ok(result.navigation.bytesUsed <= budget);
      assert.equal(result.score.bytesAreTokens, false);
      assert.equal(result.score.tokens, null);
    }
  }

  const lexical = report.results.find((candidate) => candidate.navigation.arm === ARMS.lexical && candidate.navigation.budgetBytes === 12288)!.navigation;
  assert.equal(lexical.actions.some((action) => action.kind === "map-index-read"), false);
  assert.ok(lexical.actions.some((action) => action.kind === "search-output"));
  assert.ok(lexical.actions.some((action) => action.kind === "source-read"));

  const structural = report.results.find((candidate) => candidate.navigation.arm === ARMS.structural && candidate.navigation.budgetBytes === 12288)!.navigation;
  assert.equal(structural.semanticCapabilitiesConsumed, false);
  assert.equal(structural.actions.some((action) => action.kind === "semantic-record-read"), false);
  assert.equal(structural.actions.some((action) => action.path.includes("semantic")), false);

  const semantic = report.results.find((candidate) => candidate.navigation.arm === ARMS.semantic && candidate.navigation.budgetBytes === 12288)!.navigation;
  assert.equal(semantic.semanticCapabilitiesConsumed, true);
  assert.ok(semantic.mapOutputBytes > 0);
  assert.ok(semantic.searchOutputBytes > 0);
  assert.ok(semantic.sourceBytes > 0);

  const compatibility = report.results.find((candidate) => candidate.navigation.arm === ARMS.compatibility && candidate.navigation.budgetBytes === 12288)!.navigation;
  assert.equal(compatibility.actions.filter((action) => action.kind === "compatibility-view-read").length, 7);
});

test("route actions are gold invariant and search hits are distinct from source reads", async (t) => {
  const root = await cloneFixture(t);
  const options = { repositoryRoot: root, mapRoot: path.join(root, ".blueprint", "codebase"), arm: ARMS.semantic, budgetBytes: 12288 } as const;
  const original = await runNavigation({ ...options, query: policyQuery() });
  const changedGold = await runNavigation({
    ...options,
    query: policyQuery({ evidence: { required: [{ path: "db/schema.sql" }], supporting: [], alternatives: [] }, gold: { paths: ["db/schema.sql"] } })
  });
  assert.deepEqual(changedGold.actions, original.actions);
  assert.ok(original.actions.some((action) => action.kind === "search-output"));
  assert.ok(original.actions.some((action) => action.kind === "source-read"));
  assert.equal(original.actions.filter((action) => action.kind === "search-output").some((action) => action.path.endsWith("order.ts")), false);
});

test("runs the seven-view comparator without inventing a portable index", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "portable-seven-view-"));
  t.after(async () => rm(root, {recursive: true, force: true}));
  await mkdir(path.join(root, "src"), {recursive: true});
  await writeFile(path.join(root, "src", "order.ts"), "export const orderPolicy = true;\n", "utf8");
  const mapRoot = path.join(root, ".blueprint", "codebase");
  await mkdir(mapRoot, {recursive: true});
  for (const view of ["ARCHITECTURE", "CONCERNS", "CONVENTIONS", "INTEGRATIONS", "STACK", "STRUCTURE", "TESTING"]) {
    await writeFile(path.join(mapRoot, `${view}.md`), `# ${view}\n\nSource: src/order.ts\n`, "utf8");
  }
  const navigation = await runNavigation({
    repositoryRoot: root,
    mapRoot,
    query: {searchTerm: "order"},
    arm: ARMS.compatibility,
    budgetBytes: 12288
  });
  assert.equal(navigation.fallbackUsed, false);
  assert.equal(navigation.actions.some(action => action.kind === "map-index-read"), false);
  assert.equal(navigation.actions.filter(action => action.kind === "compatibility-view-read").length, 7);
  assert.ok(navigation.actions.some(action => action.kind === "source-read" && action.path === "src/order.ts"));
});

test("consumes actual rendered alias targets and falls back on a tampered seal", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "portable-rendered-evaluation-"));
  t.after(async () => rm(root, {recursive: true, force: true}));
  const {sources, rendered} = await renderAliasTargetFixture();
  const mapRoot = path.join(root, ".blueprint", "codebase");
  for (const source of sources) {
    const target = path.join(root, source.path);
    await mkdir(path.dirname(target), {recursive: true});
    await writeFile(target, source.source, "utf8");
  }
  for (const [relativePath, bytes] of Object.entries(rendered.files)) {
    const target = path.join(mapRoot, relativePath);
    await mkdir(path.dirname(target), {recursive: true});
    await writeFile(target, bytes);
  }
  const aliasNavigation = await runNavigation({
    repositoryRoot: root,
    mapRoot,
    query: {searchTerm: "strange lookup"},
    arm: ARMS.semantic,
    budgetBytes: 12288
  });
  assert.equal(aliasNavigation.fallbackUsed, false);
  assert.ok(aliasNavigation.actions.some(action => action.kind === "semantic-record-read"));
  assert.ok(aliasNavigation.actions.some(action => action.kind === "source-read" && action.path === "src/target.ts"));
  assert.ok(aliasNavigation.actions.some(action => action.kind === "source-read" && action.path === "src/alias.ts"));
  assert.ok(aliasNavigation.actions.some(action => action.kind === "source-read" && action.path === "src/claim.ts"));
  for (const budgetBytes of BUDGETS) {
    const bounded = await runNavigation({repositoryRoot: root, mapRoot, query: {searchTerm: "strange lookup"}, arm: ARMS.semantic, budgetBytes});
    assert.ok(bounded.bytesUsed <= budgetBytes);
    assert.equal(bounded.actions.some(action => action.kind === "semantic-record-read"), true);
  }
  await writeFile(path.join(mapRoot, "generations", "actual-alias-generation", "ENTRY.md"), "tampered\n", "utf8");
  const tampered = await runNavigation({
    repositoryRoot: root,
    mapRoot,
    query: {searchTerm: "strange lookup"},
    arm: ARMS.semantic,
    budgetBytes: 12288
  });
  assert.equal(tampered.fallbackUsed, true);
  assert.equal(tampered.fallbackReason, "tampered-map-seal");
});

test("scores required, supporting, alternatives, duplicate reads and retained evidence", () => {
  const navigation = {
    bytesUsed: 70,
    actions: [
      { kind: "map-index-read", path: "INDEX.md", bytes: 10 },
      { kind: "search-output", path: ".search", bytes: 20 },
      { kind: "source-read", path: "src/irrelevant.ts", bytes: 12, range: { startLine: 1, endLine: 2 } },
      { kind: "source-read", path: "src/order.ts", bytes: 15, range: { startLine: 3, endLine: 5 }, symbol: "applyOrderPolicy" },
      { kind: "source-read", path: "src/order.ts", bytes: 15, range: { startLine: 3, endLine: 5 }, symbol: "applyOrderPolicy" },
      { kind: "source-read", path: "tests/order.test.ts", bytes: 8, range: { startLine: 3, endLine: 6 } }
    ]
  };
  const score = scoreNavigation(navigation, policyQuery());

  assert.equal(score.sufficientContext, true);
  assert.equal(score.requiredEvidence.length, 1);
  assert.equal(score.supportingEvidence.length, 1);
  assert.equal(score.alternativeEvidence.length, 1);
  assert.equal(score.firstUsefulSourceRead?.path, "src/order.ts");
  assert.equal(score.fileHitAt[1], false);
  assert.equal(score.fileHitAt[3], true);
  assert.equal(score.symbolHitAt[3], true);
  assert.equal(score.redundancy, 1 / 4);
  assert.equal(score.retainedEvidence.length, 3);
  assert.equal(score.tokens, null);
  assert.equal(score.bytesAreTokens, false);
});

test("records actual truncated source ranges and reports budget exhaustion", async (t) => {
  const root = await cloneFixture(t);
  const navigation = await runNavigation({
    repositoryRoot: root,
    mapRoot: path.join(root, ".blueprint", "codebase"),
    query: { id: "known-truncated", knownTarget: true, targetPath: "src/order.ts", evidence: { required: [{ path: "src/order.ts", range: [3, 5] }] } },
    arm: ARMS.semantic,
    budgetBytes: 24
  });
  const read = navigation.actions.find((action) => action.kind === "known-target-source-read")!;
  assert.equal(read.truncated, true);
  assert.ok(read.bytes <= 24);
  assert.ok(read.range);
  assert.ok(read.range.endLine <= 3);
  assert.equal(navigation.budgetExhausted, true);
  assert.equal(scoreNavigation(navigation, { evidence: { required: [{ path: "src/order.ts", range: [3, 5] }] } }).sufficientContext, false);
});

test("uses bounded live fallback for stale, renamed, new, unsupported and negative cases", async (t) => {
  const staleRoot = await cloneFixture(t);
  await writeFile(path.join(staleRoot, "src", "order.ts"), `${await readFile(path.join(staleRoot, "src", "order.ts"), "utf8")}\n// drift\n`, "utf8");
  const stale = await runNavigation({ repositoryRoot: staleRoot, mapRoot: path.join(staleRoot, ".blueprint", "codebase"), query: policyQuery({ searchTerm: "order policy" }), arm: ARMS.semantic, budgetBytes: 12288 });
  assert.equal(stale.fallbackUsed, true);
  assert.equal(stale.fallbackReason, "stale-map");
  assert.equal(stale.absenceProven, false);

  const renamedRoot = await cloneFixture(t);
  await rename(path.join(renamedRoot, "src", "order.ts"), path.join(renamedRoot, "src", "order-renamed.ts"));
  const renamed = await runNavigation({ repositoryRoot: renamedRoot, mapRoot: path.join(renamedRoot, ".blueprint", "codebase"), query: policyQuery({ searchTerm: "order policy" }), arm: ARMS.semantic, budgetBytes: 12288 });
  assert.equal(renamed.fallbackUsed, true);
  assert.equal(renamed.fallbackReason, "stale-map");
  assert.ok(renamed.actions.some((action) => action.kind === "fallback-source-read" && action.path === "src/order-renamed.ts"));

  const newRoot = await cloneFixture(t);
  await writeFile(path.join(newRoot, "src", "new-feature.ts"), "export function newFeature() { return true; }\n", "utf8");
  const added = await runNavigation({ repositoryRoot: newRoot, mapRoot: path.join(newRoot, ".blueprint", "codebase"), query: { id: "new", searchTerm: "newFeature" }, arm: ARMS.semantic, budgetBytes: 12288 });
  assert.equal(added.fallbackUsed, true);
  assert.equal(added.absenceProven, false);
  assert.ok(added.actions.some((action) => action.kind === "fallback-source-read" && action.path === "src/new-feature.ts"));

  const unsupported = await runNavigation({ repositoryRoot: newRoot, mapRoot: path.join(newRoot, ".blueprint", "codebase"), query: { id: "unsupported", knownTarget: true, targetPath: "config/default.toml", evidence: { required: [{ path: "config/default.toml" }] } }, arm: ARMS.structural, budgetBytes: 12288 });
  assert.equal(unsupported.actions[0].kind, "known-target-source-read");
  assert.equal(unsupported.actions[0].path, "config/default.toml");

  const negative = await runNavigation({ repositoryRoot: newRoot, mapRoot: path.join(newRoot, ".blueprint", "codebase"), query: { id: "negative", searchTerm: "unknown-widget" }, arm: ARMS.semantic, budgetBytes: 12288 });
  assert.equal(negative.fallbackUsed, true);
  assert.equal(negative.absenceProven, false);
});

test("rejects traversal and symlink source reads while keeping every action contained", async (t) => {
  const root = await cloneFixture(t);
  const outside = path.join(path.dirname(root), "outside-secret.ts");
  await writeFile(outside, "export const secret = true;\n", "utf8");
  t.after(async () => rm(outside, { force: true }));
  const traversal = await runNavigation({
    repositoryRoot: root,
    mapRoot: path.join(root, ".blueprint", "codebase"),
    query: { id: "traversal", knownTarget: true, targetPath: "../outside-secret.ts" },
    arm: ARMS.lexical,
    budgetBytes: 4096
  });
  assert.equal(traversal.actions.some((action) => action.path.includes("outside-secret")), false);

  const link = path.join(root, "src", "linked.ts");
  await symlink(path.join(root, "src", "api.ts"), link);
  const linked = await runNavigation({
    repositoryRoot: root,
    mapRoot: path.join(root, ".blueprint", "codebase"),
    query: { id: "symlink", knownTarget: true, targetPath: "src/linked.ts" },
    arm: ARMS.lexical,
    budgetBytes: 4096
  });
  assert.ok(linked.actions.some((action) => action.kind === "source-read-rejected" && action.reason === "unsafe-path"));
});

test("uses complete-range unions and the earliest sufficient alternative", () => {
  const partial = scoreNavigation({actions: [{kind: "source-read", path: "src/a.ts", bytes: 4, range: {startLine: 1, endLine: 1}}]}, {
    evidence: {required: [{path: "src/a.ts", range: [1, 20]}]}
  });
  assert.equal(partial.sufficientContext, false);
  assert.equal(partial.requiredRecall, 0);
  assert.deepEqual(partial.retainedEvidence, []);

  const disjoint = scoreNavigation({actions: [
    {kind: "source-read", path: "src/a.ts", bytes: 4, completeRange: {startLine: 1, endLine: 2}},
    {kind: "source-read", path: "src/a.ts", bytes: 4, completeRange: {startLine: 3, endLine: 4}}
  ]}, {evidence: {required: [{path: "src/a.ts", range: [1, 4]}]}});
  assert.equal(disjoint.sufficientContext, true);
  assert.equal(disjoint.requiredRecall, 1);
  assert.deepEqual(disjoint.retainedEvidence[0]?.ranges, [{startLine: 1, endLine: 4}]);
  assert.equal(disjoint.retainedEvidence[0]?.bytes, 8);

  const gapped = scoreNavigation({actions: [
    {kind: "source-read", path: "src/a.ts", bytes: 4, completeRange: {startLine: 1, endLine: 1}},
    {kind: "source-read", path: "src/a.ts", bytes: 4, completeRange: {startLine: 3, endLine: 3}}
  ]}, {evidence: {required: [{path: "src/a.ts", range: [1, 3]}]}});
  assert.equal(gapped.sufficientContext, false);
  assert.equal(gapped.requiredRecall, 0);

  const pathOnly = scoreNavigation({actions: [{kind: "source-read", path: "src/a.ts", bytes: 4, range: {startLine: 9, endLine: 10}}]}, {
    evidence: {required: [{path: "src/a.ts", range: [1, 2]}]}
  });
  assert.equal(pathOnly.fileHitAt[1], true);
  assert.equal(pathOnly.requiredRecall, 0);

  const alternative = scoreNavigation({actions: [
    {kind: "source-read", path: "src/alternative.ts", bytes: 4, range: {startLine: 1, endLine: 2}},
    {kind: "source-read", path: "src/required.ts", bytes: 4, range: {startLine: 1, endLine: 1}}
  ]}, {evidence: {
    required: [{path: "src/required.ts", range: [1, 20]}, {path: "src/other.ts", range: [1, 2]}],
    alternatives: [[{path: "src/alternative.ts", range: [1, 2]}]]
  }});
  assert.equal(alternative.sufficientContext, true);
  assert.equal(alternative.actionsToSufficient, 1);
});

test("does not manufacture symbols, and ordinary reads can hit a symbol from a complete coordinate", () => {
  const unread = scoreNavigation({actions: [{kind: "source-read", path: "src/a.ts", bytes: 8, range: {startLine: 1, endLine: 2}}]}, {
    evidence: {required: [{path: "src/a.ts", symbol: "neverReadAtAll"}]}
  });
  assert.equal(unread.sufficientContext, false);
  assert.equal(unread.symbolHitAt[1], false);
  assert.deepEqual(unread.retainedEvidence, []);

  const lexical = scoreNavigation({actions: [{kind: "source-read", path: "src/a.ts", bytes: 20, completeRange: {startLine: 1, endLine: 5}}]}, {
    evidence: {required: [{path: "src/a.ts", range: [2, 2], symbol: "observedDeclaration"}]}
  });
  assert.equal(lexical.sufficientContext, true);
  assert.equal(lexical.symbolHitAt[1], true);
  assert.deepEqual(lexical.firstUsefulSourceRead?.range, {startLine: 1, endLine: 5});
});

test("keeps supporting-only and explicit negative evidence from becoming sufficient", () => {
  const supportingOnly = scoreNavigation({actions: [{kind: "source-read", path: "tests/a.ts", bytes: 12, range: {startLine: 1, endLine: 4}}]}, {
    evidence: {supporting: [{path: "tests/a.ts", range: [1, 4]}]}
  });
  assert.equal(supportingOnly.sufficientContext, false);
  const negative = scoreNavigation({actions: []}, {negative: true, evidence: {required: []}});
  assert.equal(negative.sufficientContext, false);
  assert.equal(negative.absenceProven, false);
});

test("does not split a multibyte source character at a one-byte budget", async (t) => {
  const root = await cloneFixture(t);
  await writeFile(path.join(root, "src", "utf8.ts"), "évidence\nsecond line\n", "utf8");
  const navigation = await runNavigation({
    repositoryRoot: root,
    mapRoot: path.join(root, ".blueprint", "codebase"),
    query: {knownTarget: true, targetPath: "src/utf8.ts"},
    arm: ARMS.lexical,
    budgetBytes: 1
  });
  const read = navigation.actions.find((action) => action.kind === "known-target-source-read")!;
  assert.equal(read.bytes, 0);
  assert.equal(read.completeRange, null);

  await writeFile(path.join(root, "src", "two-lines.ts"), "a\nsecond line\n", "utf8");
  const asciiNavigation = await runNavigation({
    repositoryRoot: root,
    mapRoot: path.join(root, ".blueprint", "codebase"),
    query: {knownTarget: true, targetPath: "src/two-lines.ts", evidence: {required: [{path: "src/two-lines.ts", range: [2, 2]}]}},
    arm: ARMS.lexical,
    budgetBytes: 1
  });
  const asciiRead = asciiNavigation.actions.find((action) => action.kind === "known-target-source-read")!;
  assert.deepEqual(asciiRead.range, {startLine: 1, endLine: 1});
  assert.equal(scoreNavigation(asciiNavigation, {evidence: {required: [{path: "src/two-lines.ts", range: [2, 2]}]}}).sufficientContext, false);
});
