import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {promises as fs} from "node:fs";
import os from "node:os";
import path from "node:path";

import {createGitRepo} from "./helpers/git-fixtures.js";
import {CODEBASE_DOCUMENT_IDS} from "../src/mcp/codebase-authoring.js";
import {validatePortableMapModel, type PortableAuthoritativeSourceBasis} from "../src/mcp/codebase-index/model-validation.js";
import {renderPortableMap} from "../src/mcp/codebase-index/render.js";
import {blueprintPhaseContext} from "../src/mcp/tools/phase-context-tools.js";
import {blueprintDiscussPrepare, blueprintDiscussRead} from "../src/mcp/tools/discuss.js";
import {blueprintResearchPrepare} from "../src/mcp/tools/research.js";
import {blueprintPlanPrepare} from "../src/mcp/tools/plan.js";
import {blueprintStateLoad} from "../src/mcp/tools/state.js";
import {
  countPublicString,
  createProviderFixture,
  installProviderSuccessor,
  portablePackets,
  providerLookup,
} from "./helpers/portable-provider-fixture.js";

const source = "export function entry() { return \"entry\"; }\n";
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

function mapFixture() {
  const bytes = new TextEncoder().encode(source);
  const fileHash = hash(bytes);
  const coordinate = {
    start: {line: 1, column: 0, byte: 0},
    end: {line: 1, column: 23, byte: 23},
  };
  const rangeHash = hash(bytes.slice(0, 23));
  const files = [{
    id: "file_entry", path: "src/entry.ts", language: "typescript" as const,
    role: "source" as const, byteSize: bytes.byteLength, contentHash: fileHash,
    parseStatus: "parsed" as const, coverageStatus: "full" as const,
  }];
  const symbols = [{
    id: "symbol_entry", fileId: "file_entry", path: "src/entry.ts", qualifiedName: "entry",
    kind: "function" as const, signature: "function entry()", coordinate,
    contentHash: rangeHash, lexicalParentId: null, exported: true,
  }];
  const evidence = [{kind: "symbol" as const, path: "src/entry.ts", recordId: "symbol_entry", contentHash: rangeHash, coordinate}];
  const documents = Object.fromEntries(CODEBASE_DOCUMENT_IDS.map((id) => [id, {
    summary: `${id} summary`,
    sections: [{heading: "Observed", content: "The selected entry is source-backed."}],
    evidencePaths: ["src/entry.ts"],
  }]));
  const model = {
    formatVersion: 1 as const,
    generationId: "generation_discuss",
    documents,
    semantic: {
      capabilities: [{id: "cap_entry", name: "Entry", summary: "Entry capability.", claimIds: ["claim_entry"], evidence}],
      claims: [{id: "claim_entry", basis: "observed" as const, statement: "The entry function is exported.", evidence}],
      aliases: [{id: "alias_entry", alias: "start entry", targetKind: "capability" as const, targetId: "cap_entry", evidence: [{kind: "file" as const, path: "src/entry.ts", recordId: "file_entry", contentHash: fileHash}]}],
    },
  };
  const basis: PortableAuthoritativeSourceBasis = {
    generationId: "generation_discuss",
    files: [{path: "src/entry.ts", byteSize: bytes.byteLength, contentHash: fileHash}],
    records: [
      {kind: "file", recordId: "file_entry", path: "src/entry.ts", contentHash: fileHash},
      {kind: "symbol", recordId: "symbol_entry", path: "src/entry.ts", contentHash: rangeHash, coordinate},
    ],
  };
  const checked = validatePortableMapModel([{generationId: "generation_discuss", shardId: "source", files, symbols, imports: [], relationships: []}], model, basis);
  assert.equal(checked.ok, true, checked.ok ? undefined : JSON.stringify(checked.diagnostics));
  if (!checked.ok) throw new Error("portable discuss fixture did not validate");
  const rendered = renderPortableMap(checked.data, {
    generationId: "generation_discuss", generatedAt: "2026-09-24T00:00:00.000Z", gitCommit: null,
    inventoryFingerprint: hash("inventory"), parserAssets: [],
  });
  assert.equal(rendered.ok, true, rendered.ok ? undefined : JSON.stringify(rendered.diagnostics));
  if (!rendered.ok) throw new Error("portable discuss fixture did not render");
  return {rendered, fileHash};
}

async function fixture() {
  const root = await createGitRepo("portable-discuss-provider-");
  const built = mapFixture();
  for (const [relative, bytes] of Object.entries(built.rendered.files)) {
    if (/^(?:ARCHITECTURE|STRUCTURE|STACK|INTEGRATIONS|CONVENTIONS|TESTING|CONCERNS)\.md$/.test(relative)) continue;
    const target = path.join(root, ".blueprint", "codebase", relative);
    await fs.mkdir(path.dirname(target), {recursive: true});
    await fs.writeFile(target, bytes);
  }
  await fs.mkdir(path.join(root, "src"), {recursive: true});
  await fs.writeFile(path.join(root, "src", "entry.ts"), source);
  await fs.writeFile(path.join(root, ".blueprint", "PROJECT.md"), "# Portable discuss fixture\n\nPreserve selected source evidence.\n");
  await fs.writeFile(path.join(root, ".blueprint", "REQUIREMENTS.md"), "# Requirements\n\n- R-1: Preserve source freshness.\n");
  await fs.writeFile(path.join(root, ".blueprint", "ROADMAP.md"), "# Roadmap\n\n## Phases\n\n- [ ] **Phase 1: Discuss** - Preserve selected evidence\n\n## Phase Details\n\n### Phase 1: Discuss\n**Goal**: Preserve selected evidence.\n**Requirements**: R-1\n**Success Criteria**:\n1. Changed source becomes stale.\n");
  await fs.mkdir(path.join(root, ".blueprint", "phases", "01-discuss"), {recursive: true});
  return {root, fileHash: built.fileHash, cleanup: () => fs.rm(path.dirname(root), {recursive: true, force: true})};
}

test("phase context delivers one compact portable ENTRY without compatibility digests", async () => {
  const state = await fixture();
  try {
    const entry = await fs.readFile(path.join(state.root, ".blueprint", "codebase", "generations", "generation_discuss", "ENTRY.md"), "utf8");
    const result: any = await blueprintPhaseContext({cwd: state.root, phase: 1});
    assert.equal(result.codebase.digest.length, 0);
    assert.deepEqual(result.codebase.missingArtifacts, []);
    assert.ok(result.codebase.artifacts.some((item: string) => item.endsWith("/ENTRY.md")));
    assert.equal(result.codebase.portable?.entry.content, entry);
  } finally {
    await state.cleanup();
  }
});

test("phase context preserves partial-state blockers for portable-only and compatibility layouts", async () => {
  for (const portableOnly of [true, false]) {
    const state = await createProviderFixture({portableOnly});
    try {
      await fs.writeFile(path.join(state.root, ".blueprint", "ROADMAP.md"), "# malformed roadmap\n", "utf8");
      await fs.rm(path.join(state.root, ".blueprint", "STATE.md"), {force: true});
      const expected: any = await blueprintStateLoad({cwd: state.root});
      const context: any = await blueprintPhaseContext({cwd: state.root, phase: 1});
      assert.equal(context.workflowPosture.projectStatus, expected.derivedStatus.projectStatus, `${portableOnly ? "portable-only" : "compatibility"} status`);
      assert.equal(context.workflowPosture.nextAction, expected.derivedStatus.nextAction, `${portableOnly ? "portable-only" : "compatibility"} next action`);
      assert.deepEqual(context.workflowPosture.blockers, expected.blockers, `${portableOnly ? "portable-only" : "compatibility"} blockers`);
      assert.equal(context.workflowPosture.activeCommand, expected.state.activeCommand);
    } finally {
      await state.cleanup();
    }
  }
});

test("discuss persists portable metadata only and supports full, delta, register, and stale selected source", async () => {
  const state = await fixture();
  try {
    const selection = {kind: "symbol" as const, recordId: "symbol_entry"};
    const full: any = await blueprintDiscussPrepare({cwd: state.root, phase: 1, portableSelections: [selection]});
    assert.equal(full.status, "prepared", JSON.stringify(full));
    assert.ok(full.packet.portableEvidence.entries.some((entry: any) => entry.content !== undefined));
    const delta: any = await blueprintDiscussPrepare({cwd: state.root, phase: 1, portableSelections: [selection], expectedRevision: full.revision, evidenceDelivery: {mode: "delta"}});
    assert.equal(delta.status, "prepared", JSON.stringify(delta));
    assert.ok(delta.packet.portableEvidence.entries.every((entry: any) => entry.content === undefined));
    const registered: any = await blueprintDiscussPrepare({cwd: state.root, phase: 1, portableSelections: [selection], expectedRevision: delta.revision, evidenceDelivery: {mode: "register"}});
    assert.equal(registered.status, "prepared", JSON.stringify(registered));
    assert.ok(registered.packet.portableEvidence.entries.every((entry: any) => entry.content === undefined));
    const session: any = (await blueprintDiscussRead({cwd: state.root, phase: 1})).session;
    const sessionText = await fs.readFile(path.join(state.root, ".blueprint", "phases", "01-discuss", "01-DISCUSS-SESSION.json"), "utf8");
    assert.ok(session.basis.portable);
    assert.doesNotMatch(sessionText, /# Portable Codebase Map Entry/);
    assert.doesNotMatch(sessionText, /export function entry/);
    const changedSelection: any = await blueprintDiscussPrepare({cwd: state.root, phase: 1, portableSelections: [{kind: "capability", recordId: "cap_entry"}], expectedRevision: registered.revision, evidenceDelivery: {mode: "delta"}});
    assert.equal(changedSelection.status, "reconciliation_required", JSON.stringify(changedSelection));
    assert.ok(changedSelection.changedPaths.includes("@discuss/portable"));
    await fs.appendFile(path.join(state.root, "src", "entry.ts"), "// changed\n");
    const stale: any = await blueprintDiscussPrepare({cwd: state.root, phase: 1, portableSelections: [selection], expectedRevision: registered.revision, evidenceDelivery: {mode: "delta"}});
    assert.notEqual(stale.status, "prepared", JSON.stringify(stale));
  } finally {
    await state.cleanup();
  }
});

test("ordinary evidencePaths use delivery metadata and resend a newly selected source", async () => {
  const state = await fixture();
  try {
    await fs.writeFile(path.join(state.root, "README.md"), "# Ordinary evidence\n");
    const selection = {kind: "symbol" as const, recordId: "symbol_entry"};
    const full: any = await blueprintDiscussPrepare({cwd: state.root, phase: 1, evidencePaths: ["src/entry.ts"], portableSelections: [selection]});
    assert.equal(full.status, "prepared", JSON.stringify(full));
    assert.equal(full.packet.sources.find((item: any) => item.path === "src/entry.ts")?.content, source);
    const delta: any = await blueprintDiscussPrepare({cwd: state.root, phase: 1, evidencePaths: ["src/entry.ts"], portableSelections: [selection], expectedRevision: full.revision, evidenceDelivery: {mode: "delta"}});
    assert.equal(delta.status, "prepared", JSON.stringify(delta));
    assert.equal(delta.packet.sources.find((item: any) => item.path === "src/entry.ts")?.content, undefined);
    const extended: any = await blueprintDiscussPrepare({cwd: state.root, phase: 1, evidencePaths: ["src/entry.ts", "README.md"], portableSelections: [selection], expectedRevision: delta.revision, acknowledgeChangedInputs: true, evidenceDelivery: {mode: "delta"}});
    assert.equal(extended.status, "prepared", JSON.stringify(extended));
    assert.equal(extended.packet.sources.find((item: any) => item.path === "src/entry.ts")?.content, undefined);
    assert.equal(extended.packet.sources.find((item: any) => item.path === "README.md")?.content, "# Ordinary evidence\n");
  } finally {
    await state.cleanup();
  }
});

test("all providers prefer a valid default map and fall back to bounded ordinary evidence", async () => {
  const providers = [
    ["discuss", blueprintDiscussPrepare],
    ["research", blueprintResearchPrepare],
    ["plan", blueprintPlanPrepare],
  ] as const;
  for (const [name, prepare] of providers) {
    const valid = await createProviderFixture({portableOnly: true});
    try {
      const sourceText = await fs.readFile(path.join(valid.root, "src/service.ts"), "utf8");
      const prepared: any = await prepare({...providerLookup(valid.root), evidencePaths: ["src/service.ts"]} as any);
      assert.equal(prepared.status, "prepared", `${name}: ${JSON.stringify(prepared)}`);
      assert.equal(countPublicString(`blueprint_${name}_prepare`, prepared, sourceText), 1);
    } finally {
      await valid.cleanup();
    }
    for (const variant of ["broken", "unknown-version"] as const) {
      const fallback = await createProviderFixture({portableOnly: true});
      try {
        const index = path.join(fallback.root, ".blueprint/codebase/INDEX.md");
        const original = await fs.readFile(index, "utf8");
        if (variant === "broken") await fs.writeFile(index, "# Incomplete portable map\n");
        else {
          const replaced = original.replace(/"version":1/, '"version":99');
          assert.notEqual(replaced, original, "fixture descriptor must expose a version field");
          await fs.writeFile(index, replaced);
        }
        const sourceText = await fs.readFile(path.join(fallback.root, "src/service.ts"), "utf8");
        const prepared: any = await prepare({...providerLookup(fallback.root), evidencePaths: ["src/service.ts"]} as any);
        assert.equal(prepared.status, "prepared", `${name}/${variant}: ${JSON.stringify(prepared)}`);
        assert.equal(countPublicString(`blueprint_${name}_prepare`, prepared, sourceText), 1);
      } finally {
        await fallback.cleanup();
      }
    }
    const absent = await createProviderFixture({portableOnly: true});
    try {
      await fs.rm(path.join(absent.root, ".blueprint/codebase"), {recursive: true, force: true});
      const sourceText = await fs.readFile(path.join(absent.root, "src/service.ts"), "utf8");
      const prepared: any = await prepare({...providerLookup(absent.root), evidencePaths: ["src/service.ts"]} as any);
      assert.equal(prepared.status, "prepared", `${name}/absent: ${JSON.stringify(prepared)}`);
      assert.equal(countPublicString(`blueprint_${name}_prepare`, prepared, sourceText), 1);
    } finally {
      await absent.cleanup();
    }
  }
});

test("discuss acknowledged source refresh accepts a successor map while ordinary retry stays pinned", async () => {
  const state = await createProviderFixture({portableOnly: true});
  try {
    const args: any = {...providerLookup(state.root), portableSelections: [state.selectionServiceSymbol]};
    const first: any = await blueprintDiscussPrepare(args);
    assert.equal(first.status, "prepared", JSON.stringify(first));
    const successor = await installProviderSuccessor(state.root, state.map, "provider-next", true);
    const retry: any = await blueprintDiscussPrepare({...args, expectedRevision: first.revision, evidenceDelivery: {mode: "delta"}});
    assert.notEqual(retry.status, "prepared", JSON.stringify(retry));
    const refreshed: any = await blueprintDiscussPrepare({...args, expectedRevision: first.revision, acknowledgeChangedInputs: true, evidenceDelivery: {mode: "full"}});
    assert.equal(refreshed.status, "prepared", JSON.stringify(refreshed));
    assert.equal(portablePackets(refreshed)[0]?.pinnedGeneration, successor.rendered.sealedGeneration.generationId);
  } finally {
    await state.cleanup();
  }
});

test("acknowledging an unrelated ordinary file does not expand a private portable range", async () => {
  const providers = [
    ["discuss", blueprintDiscussPrepare],
    ["research", blueprintResearchPrepare],
    ["plan", blueprintPlanPrepare],
  ] as const;
  for (const [name, prepare] of providers) {
    const state = await createProviderFixture({portableOnly: true});
    try {
      const sourceText = await fs.readFile(path.join(state.root, "src/service.ts"), "utf8");
      const args: any = {...providerLookup(state.root), portableSelections: [state.selectionServiceSymbol]};
      const first: any = await prepare(args);
      assert.equal(first.status, "prepared", `${name}: ${JSON.stringify(first)}`);
      assert.equal(countPublicString(`blueprint_${name}_prepare`, first, sourceText), 0);
      const expanded: any = await prepare({...args, evidencePaths: ["README.md"], expectedRevision: first.revision, acknowledgeChangedInputs: true, evidenceDelivery: {mode: "delta"}});
      assert.equal(expanded.status, "prepared", `${name} expanded: ${JSON.stringify(expanded)}`);
      assert.equal(countPublicString(`blueprint_${name}_prepare`, expanded, sourceText), 0);
      const sessionText = await fs.readFile(path.join(state.root, `.blueprint/phases/01-service/01-${name.toUpperCase()}-SESSION.json`), "utf8");
      assert.doesNotMatch(sessionText, /privateBodyPayload/);
    } finally {
      await state.cleanup();
    }
  }
});
