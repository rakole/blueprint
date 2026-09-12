import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createGitRepo } from "./helpers/git-fixtures.js";
import { validPhaseContextModel } from "./helpers/context-model.js";
import { blueprintConfigSet } from "../src/mcp/tools/config.js";
import { blueprintPhaseArtifactWrite } from "../src/mcp/tools/phase-artifacts.js";
import { compilePlanCandidate } from "../src/mcp/tools/plan-model.js";
import { renderPhasePlanModelContent } from "../src/mcp/tools/phase-plan-rendering.js";
import { readPlanPublicationStatus } from "../src/mcp/tools/plan-publication.js";
import { blueprintStateLoad } from "../src/mcp/tools/state.js";

const phaseDir = ".blueprint/phases/01-publication";
const planPath = `${phaseDir}/01-01-PLAN.md`;
const markerPath = `${phaseDir}/01-PLAN-PUBLICATION.json`;
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
function marker(overrides: Record<string, unknown> = {}) {
  return {
    version: 1, status: "committed", requestId: "publish-1", revision: 1,
    files: [{ path: planPath, hash: "a".repeat(64) }], removedPaths: [],
    ...overrides,
  };
}
async function fixture(t: TestContext): Promise<string> {
  const cwd = await createGitRepo("blueprint-plan-publication-");
  t.after(() => rm(path.dirname(cwd), { recursive: true, force: true }));
  await mkdir(path.join(cwd, phaseDir), { recursive: true });
  return cwd;
}
async function writeMarker(cwd: string, value: unknown): Promise<void> {
  await writeFile(path.join(cwd, markerPath), JSON.stringify(value));
}
const readStatus = (cwd: string) => readPlanPublicationStatus(cwd, phaseDir, "01");

async function routingFixture(t: TestContext): Promise<string> {
  const cwd = await fixture(t);
  await mkdir(path.join(cwd, "src"), { recursive: true });
  await mkdir(path.join(cwd, ".blueprint/codebase"), { recursive: true });
  for (const artifact of ["STACK", "ARCHITECTURE", "STRUCTURE", "CONVENTIONS", "TESTING", "INTEGRATIONS", "CONCERNS"]) {
    await writeFile(path.join(cwd, ".blueprint/codebase", `${artifact}.md`), `# ${artifact}\n\nThe fixture uses a local backend service in src/feature.ts.\n`);
  }
  await writeFile(path.join(cwd, "README.md"), "# Publication fixture\n");
  await writeFile(path.join(cwd, "src/feature.ts"), "export const feature = true;\n");
  await writeFile(path.join(cwd, ".blueprint/PROJECT.md"), "# Project\n\nPreserve complete planning candidates for a small backend service.\n");
  await writeFile(path.join(cwd, ".blueprint/REQUIREMENTS.md"), "# Requirements\n\n- PUB-01: Publish a complete executable plan.\n");
  await writeFile(path.join(cwd, ".blueprint/ROADMAP.md"), `# Roadmap: Publication

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 1: Publication** - Preserve complete planning.

## Phase Details

### Phase 1: Publication
**Goal**: Publish a complete executable plan.
**Requirements**: PUB-01
`);
  await writeFile(path.join(cwd, ".blueprint/STATE.md"), `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 1
- Active command: /blu-progress
- Next action: Run /blu-progress
- Last updated: 2026-09-12T00:00:00.000Z
`);
  await blueprintConfigSet({ cwd, patch: { workflow: { research: false, ui_phase: false, plan_check: false } } });
  const context = await blueprintPhaseArtifactWrite({ cwd, phase: "1", artifact: "context", model: validPhaseContextModel({ phaseLabel: "phase 1", openQuestions: [], deferredIdeas: [] }) });
  assert.notEqual(context.status, "invalid", JSON.stringify(context));
  const compiled = compilePlanCandidate({ plans: [{
    key: "feature", title: "Publish feature behavior", goal: "Deliver the feature through the existing backend service.",
    scope: ["Implement src/feature.ts and verify its exported behavior."], dependsOn: [],
    tasks: [{ id: "T1", title: "Implement the service feature", readFirst: ["README.md"], filesModified: ["src/feature.ts"], requirements: ["PUB-01"],
      action: ["Export the feature implementation from src/feature.ts."], acceptanceCriteria: ["src/feature.ts exports feature and npm test exits 0."] }],
    mustHaves: ["The service exposes the feature to its callers."],
  }] }, { knownRequirements: ["PUB-01"], knownEvidenceArtifacts: [`${phaseDir}/01-CONTEXT.md`], existingPlans: [], mode: "add", targetPlanIds: [] });
  assert.equal(compiled.valid, true, JSON.stringify(compiled.diagnostics));
  const content = renderPhasePlanModelContent(compiled.models[0].model, { phaseNumber: "1", phasePrefix: "01", phaseName: "Publication" }, "01");
  await writeFile(path.join(cwd, planPath), content);
  await writeMarker(cwd, marker({ files: [{ path: planPath, hash: hash(content) }] }));
  return cwd;
}

test("publication status distinguishes absent, pending and committed with stable content tokens", async t => {
  const cwd = await fixture(t);
  assert.deepEqual(await readStatus(cwd), { status: "absent", token: "missing", reason: null });
  const pending = marker({ status: "pending" });
  await writeMarker(cwd, pending);
  const first = await readStatus(cwd);
  assert.equal(first.status, "pending");
  assert.equal(first.token, hash(JSON.stringify(pending)));
  assert.match(first.reason ?? "", /publication is incomplete/i);
  assert.deepEqual(await readStatus(cwd), first);
  await writeMarker(cwd, marker());
  const committed = await readStatus(cwd);
  assert.equal(committed.status, "committed");
  assert.equal(committed.reason, null);
  assert.notEqual(committed.token, first.token);
});

test("malformed JSON and invalid publication field types fail closed", async t => {
  const cwd = await fixture(t);
  await writeFile(path.join(cwd, markerPath), '{"version":1,');
  const malformed = await readStatus(cwd);
  assert.equal(malformed.status, "invalid");
  assert.match(malformed.reason ?? "", /malformed/i);
  assert.equal(malformed.token, hash('{"version":1,'));
  for (const invalid of [
    null, [], 1, "pending", {},
    marker({ version: 2 }), marker({ status: "finished" }), marker({ status: ["pending"] }),
    marker({ status: ["committed"] }), marker({ requestId: "../publish" }), marker({ requestId: "" }),
    marker({ revision: -1 }), marker({ revision: 1.5 }), marker({ revision: "1" }),
    marker({ files: {} }), marker({ files: [null] }),
    marker({ files: [{ path: planPath, hash: ["a".repeat(64)] }] }),
    marker({ files: [{ path: planPath, hash: "invalid" }] }), marker({ removedPaths: {} }),
  ]) {
    await writeMarker(cwd, invalid);
    const result = await readStatus(cwd);
    assert.equal(result.status, "invalid", JSON.stringify(invalid));
    assert.ok(result.reason, JSON.stringify(invalid));
  }
});

test("publication files and removals must belong to the exact canonical phase scope", async t => {
  const cwd = await fixture(t);
  for (const outside of [
    "/tmp/01-01-PLAN.md", "../01-01-PLAN.md", ".blueprint/phases/02-other/01-01-PLAN.md",
    `${phaseDir}/../../01-01-PLAN.md`, `${phaseDir}/02-01-PLAN.md`, `${phaseDir}/nested/01-01-PLAN.md`,
    `${phaseDir}/01-01-SUMMARY.md`, `${phaseDir}/01-one-PLAN.md`,
  ]) {
    for (const field of ["files", "removedPaths"] as const) {
      await writeMarker(cwd, marker(field === "files" ? { files: [{ path: outside, hash: "a".repeat(64) }] } : { removedPaths: [outside] }));
      assert.equal((await readStatus(cwd)).status, "invalid", `${field}: ${outside}`);
    }
  }
  await writeMarker(cwd, marker({ removedPaths: [`${phaseDir}/01-02-PLAN.md`] }));
  assert.equal((await readStatus(cwd)).status, "committed");
});

test("invalid helper scope and phase prefixes never resolve an arbitrary marker", async t => {
  const cwd = await fixture(t);
  for (const [directory, prefix] of [
    ["/tmp/phase", "01"], ["../phase", "01"], [".blueprint/phases/..", "01"],
    [".blueprint/phases/.", "01"], [".blueprint/phases/a/nested", "01"],
    [phaseDir, "../01"], [phaseDir, "01/02"], [phaseDir, "phase-01"],
  ]) {
    assert.equal((await readPlanPublicationStatus(cwd, directory, prefix)).status, "invalid", `${directory}: ${prefix}`);
  }
});

test("symlink markers, directory markers and oversized files are not usable publication records", async t => {
  const cwd = await fixture(t), absoluteMarker = path.join(cwd, markerPath);
  const outsideFile = path.join(path.dirname(cwd), "external-publication.json");
  await writeFile(outsideFile, JSON.stringify(marker()));
  await symlink(outsideFile, absoluteMarker);
  assert.equal((await readStatus(cwd)).status, "invalid");
  await rm(absoluteMarker);
  await mkdir(absoluteMarker);
  assert.equal((await readStatus(cwd)).status, "invalid");
  await rm(absoluteMarker, { recursive: true });
  await writeFile(absoluteMarker, " ".repeat(1024 * 1024 + 1));
  assert.equal((await readStatus(cwd)).status, "invalid");
});

test("a phase-directory symlink cannot read a publication marker outside its repository", async t => {
  const cwd = await fixture(t);
  const outsideDirectory = path.join(path.dirname(cwd), "external-phase");
  await mkdir(outsideDirectory);
  await writeFile(path.join(outsideDirectory, "01-PLAN-PUBLICATION.json"), JSON.stringify(marker()));
  await rm(path.join(cwd, phaseDir), { recursive: true });
  await symlink(outsideDirectory, path.join(cwd, phaseDir));
  const result = await readStatus(cwd);
  assert.equal(result.status, "invalid");
  assert.match(result.reason ?? "", /escapes the repository/i);
});

test("state routes pending and invalid publications back to planning instead of claiming execution readiness", async t => {
  const cwd = await routingFixture(t);
  const baseline = await blueprintStateLoad({ cwd });
  assert.match(baseline.derivedStatus.nextAction, /\/blu-execute-phase 1/, JSON.stringify(baseline));
  for (const status of ["pending", ["pending"], "invalid"]) {
    await writeMarker(cwd, marker({ status }));
    const state = await blueprintStateLoad({ cwd });
    assert.match(state.derivedStatus.nextAction, /\/blu-plan-phase 1/, JSON.stringify(state));
    assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-execute-phase/);
    assert.match(state.warnings?.join("\n") ?? "", /publication/i);
  }
});

test("state rejects a publication generation change that happens while inventory is being captured", async t => {
  const cwd = await routingFixture(t);
  const originalReaddir = fs.readdir;
  const originalReadFile = fs.readFile;
  let markerReads = 0;
  let changed = false;
  t.mock.method(fs, "readFile", async (...args: Parameters<typeof fs.readFile>) => {
    const content = await originalReadFile(...args);
    if (String(args[0]) === path.join(cwd, markerPath)) markerReads += 1;
    return content;
  });
  t.mock.method(fs, "readdir", async (...args: Parameters<typeof fs.readdir>) => {
    const stack = new Error().stack ?? "";
    const entries = await originalReaddir(...args);
    // Ignore bootstrap scans. Mutate only the first phase inventory after the
    // state reader has captured its publication-before token. Matching the
    // direct caller prevents a later summary scan from satisfying this race.
    const stateInventory = /at (?:async )?listPhaseArtifacts[^\n]*\n\s+at (?:async )?inspectCurrentPhaseArtifacts\b/.test(stack);
    if (!changed && markerReads > 0 && stateInventory && String(args[0]) === path.join(cwd, phaseDir)) {
      changed = true;
      await writeMarker(cwd, marker({ requestId: "publish-2", revision: 2 }));
    }
    return entries;
  });
  const state = await blueprintStateLoad({ cwd });
  assert.equal(changed, true, "The deterministic race must occur inside the guarded inventory read.");
  assert.match(state.derivedStatus.nextAction, /\/blu-plan-phase 1/, JSON.stringify(state));
  assert.doesNotMatch(state.derivedStatus.nextAction, /\/blu-execute-phase/);
  assert.match(state.warnings?.join("\n") ?? "", /publication changed during state inspection/i);
  assert.equal((await readStatus(cwd)).status, "committed", "A completed replacement still invalidates the older read generation.");
});
