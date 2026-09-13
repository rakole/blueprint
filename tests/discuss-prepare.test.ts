import { validatePhaseArtifactContent } from "../src/mcp/tools/artifacts.js";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import * as z from "zod/v4";
import { createGitRepo } from "./helpers/git-fixtures.js";
import { validPhaseContextModel } from "./helpers/context-model.js";
import {
  blueprintDiscussPrepare,
  blueprintDiscussRecord,
  blueprintDiscussRead,
  blueprintDiscussFinalize as directFinalize,
  discussToolDefinitions,
} from "../src/mcp/tools/discuss.js";
import { blueprintPhaseArtifactRead } from "../src/mcp/tools/phase-artifacts.js";
import { BLUEPRINT_MUTATION_TOOL_NAMES } from "../src/mcp/mutation-failure-logging.js";
const blueprintDiscussFinalize = (args: Parameters<typeof directFinalize>[0]) => directFinalize({ model: validPhaseContextModel({ openQuestions: [], deferredIdeas: [] }), ...args });
const relative = ".blueprint/phases/03-discovery";
async function fixture(seed = true) {
  const cwd = await createGitRepo("discuss-prepare-");
  await mkdir(path.join(cwd, seed ? relative : ".blueprint"), {
    recursive: true,
  });
  await writeFile(
    path.join(cwd, ".blueprint/PROJECT.md"),
    "# Project\nDurable context for a small product.\n",
  );
  await writeFile(
    path.join(cwd, ".blueprint/REQUIREMENTS.md"),
    "# Requirements\n- DISC-01: Save decisions.\n",
  );
  await writeFile(
    path.join(cwd, ".blueprint/ROADMAP.md"),
    "# Roadmap: Fixture\n\n## Phases\n\n- [x] **Phase 1: Unrelated** - Other work\n- [x] **Phase 2: Foundation** - Shared work\n- [ ] **Phase 3: Discovery** - Durable discovery\n\n## Phase Details\n\n### Phase 1: Unrelated\n**Requirements**: OTHER-01\n\n### Phase 2: Foundation\n**Requirements**: DISC-01\n\n### Phase 3: Discovery\n**Goal**: Save durable context.\n**Requirements**: DISC-01\n",
  );
  for (const [number, name] of [
    ["01", "unrelated"],
    ["02", "foundation"],
  ]) {
    await mkdir(path.join(cwd, `.blueprint/phases/${number}-${name}`), {
      recursive: true,
    });
    await writeFile(
      path.join(
        cwd,
        `.blueprint/phases/${number}-${name}/${number}-CONTEXT.md`,
      ),
      `# Prior ${number}\nPrior evidence ${name}.\n`,
    );
  }
  return cwd;
}
test("prepare resolves, bounds prior evidence, reuses revision, and sparse typed model finalizes through downstream reader", async () => {
  const cwd = await fixture();
  try {
    const first = await blueprintDiscussPrepare({ cwd, phase: "3" });
    assert.equal(first.status, "prepared");
    assert.equal(first.packet.selectedPhase.phaseNumber, "3");
    assert.deepEqual(first.packet.priorContextPaths, [
      ".blueprint/phases/02-foundation/02-CONTEXT.md",
    ]);
    assert.ok(
      !first.readSet.some((i) =>
        /STATE|SESSION|CHECKPOINT|01-unrelated/.test(i.path),
      ),
    );
    assert.equal(
      (await blueprintDiscussPrepare({ cwd, phase: "3" })).revision,
      first.revision,
    );
    const model = validPhaseContextModel({
      openQuestions: [],
      deferredIdeas: [],
    }) as any;
    delete model.specificIdeas;
    delete model.existingCodeInsights;
    delete model.implementationDecisions;
    delete model.dependencies.requiredFollowUpReads;
    model.discoveryGrounding.workflowPosture =
      "There are no deferred risks that block this phase.";
    const recorded = await blueprintDiscussRecord({
      cwd,
      phase: "3",
      requestId: "answer",
      expectedRevision: first.revision!,
      records: [],
    });
    assert.equal(recorded.status, "recorded");
    const finalized = await blueprintDiscussFinalize({
      cwd,
      phase: "3",
      requestId: "publish",
      expectedRevision: recorded.revision!,
      model,
    });
    assert.equal(finalized.status, "finalized", JSON.stringify(finalized));
    assert.equal(
      finalized.nextAction,
      finalized.state.derivedStatus.nextAction,
    );
    const downstream = await blueprintPhaseArtifactRead({
      cwd,
      phase: "3",
      artifact: "context",
    });
    assert.equal(downstream.found, true);
    assert.equal(
      validatePhaseArtifactContent(downstream.content!, "context").valid,
      true,
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
test("optional spec appearance and plan inventory invalidate publication and require explicit input review", async () => {
  const cwd = await fixture();
  try {
    let prepared = await blueprintDiscussPrepare({ cwd, phase: "3" });
    const record = await blueprintDiscussRecord({
      cwd,
      phase: "3",
      requestId: "draft",
      expectedRevision: prepared.revision!,

      records: [
        {
          id: "choice",
          type: "decision",
          value: "Use durable context",
          rationale: "Preserves reviewed choices",
          evidence: [".blueprint/PROJECT.md"],
        },
      ],
    });
    await writeFile(
      path.join(cwd, `${relative}/03-SPEC.md`),
      "# Spec\nNew intent.\n",
    );
    assert.equal(
      (
        await blueprintDiscussFinalize({
          cwd,
          phase: "3",
          requestId: "stale-publish",
          expectedRevision: record.revision!,
        })
      ).status,
      "stale",
    );
    prepared = await blueprintDiscussPrepare({ cwd, phase: "3" });
    assert.equal(prepared.status, "reconciliation_required");
    assert.deepEqual(prepared.affectedRecordIds, ["choice"]);
    assert.equal(prepared.session.revision, record.revision);
    prepared = await blueprintDiscussPrepare({
      cwd,
      phase: "3",
      expectedRevision: record.revision,
      acknowledgeChangedInputs: true,
    });
    assert.equal(prepared.status, "prepared");
    await writeFile(
      path.join(cwd, `${relative}/03-01-PLAN.md`),
      "# Existing plan\n",
    );
    assert.equal(
      (await blueprintDiscussPrepare({ cwd, phase: "3" })).status,
      "reconciliation_required",
    );
    assert.ok(
      (await blueprintDiscussPrepare({ cwd, phase: "3" })).packet.warnings.some(
        (w) => w.includes("plans"),
      ),
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
test("planned missing directory is seeded through scaffold, unknown and ambiguous phases remain blocked", async () => {
  const cwd = await fixture(false);
  try {
    assert.equal(
      (await blueprintDiscussPrepare({ cwd, phase: "3" })).status,
      "prepared",
    );
    const context = await readFile(
      path.join(cwd, `${relative}/03-CONTEXT.md`),
      "utf8",
    );
    assert.ok(context.includes("Phase"));
    assert.equal(
      (await blueprintDiscussPrepare({ cwd, phase: "99" })).status,
      "blocked",
    );
    await mkdir(path.join(cwd, ".blueprint/phases/03-duplicate"));
    assert.equal(
      (await blueprintDiscussPrepare({ cwd, phase: "3" })).status,
      "blocked",
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
test("effective host defaults changes invalidate prepared basis even without project config changes", async () => {
  const cwd = await fixture();
  const previous = process.env.BLUEPRINT_GLOBAL_HOME;
  process.env.BLUEPRINT_GLOBAL_HOME = path.join(cwd, "fixture-global");
  try {
    await mkdir(process.env.BLUEPRINT_GLOBAL_HOME, { recursive: true });
    const defaults = path.join(
      process.env.BLUEPRINT_GLOBAL_HOME,
      "defaults.json",
    );
    await writeFile(
      defaults,
      JSON.stringify({ workflow: { subagents: true } }),
    );
    const first = await blueprintDiscussPrepare({ cwd, phase: "3" });
    assert.equal(first.packet.config.config.workflow.subagents, true);
    await writeFile(
      defaults,
      JSON.stringify({ workflow: { subagents: false } }),
    );
    const next = await blueprintDiscussPrepare({ cwd, phase: "3" });
    assert.equal(next.status, "reconciliation_required");
    assert.ok(next.changedPaths.includes("@discuss/effective-config"));
    assert.equal(next.packet.config.config.workflow.subagents, false);
  } finally {
    if (previous === undefined) delete process.env.BLUEPRINT_GLOBAL_HOME;
    else process.env.BLUEPRINT_GLOBAL_HOME = previous;
    await rm(cwd, { recursive: true, force: true });
  }
});

test("prepare retains source evidence by default and explicitly removed evidence requires review", async () => {
  const cwd = await fixture();
  try {
    await writeFile(path.join(cwd, "engine.ts"), "export const engine = 1;\n");
    const first = await blueprintDiscussPrepare({ cwd, phase: 3, evidencePaths: ["engine.ts"] });
    const reused = await blueprintDiscussPrepare({ cwd, phase: 3 });
    assert.equal(reused.revision, first.revision);
    assert.ok(reused.readSet.some((item) => item.path === "engine.ts"));
    await writeFile(path.join(cwd, "engine.ts"), "export const engine = 2;\n");
    const changed = await blueprintDiscussPrepare({ cwd, phase: 3 });
    assert.equal(changed.status, "reconciliation_required");
    assert.ok(changed.changedPaths.includes("engine.ts"));
    const removed = await blueprintDiscussPrepare({ cwd, phase: 3, evidencePaths: [] });
    assert.equal(removed.status, "reconciliation_required");
    assert.ok(removed.changedPaths.includes("engine.ts"));
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

test("appearance of a previously absent prior phase invalidates prepared inputs", async () => {
  const cwd = await fixture();
  try {
    const prior = path.join(cwd, ".blueprint/phases/02-foundation");
    await rm(prior, { recursive: true });
    const prepared = await blueprintDiscussPrepare({ cwd, phase: 3 });
    const record = await blueprintDiscussRecord({ cwd, phase: 3, requestId: "notes", expectedRevision: prepared.revision!, records: [] });
    await mkdir(prior);
    await writeFile(path.join(prior, "02-CONTEXT.md"), "# Newly available dependency\n");
    const result = await blueprintDiscussFinalize({ cwd, phase: 3, requestId: "publish", expectedRevision: record.revision! });
    assert.equal(result.status, "stale");
    assert.ok(result.freshness.stalePaths.includes("@discuss/prior/2"));
  } finally { await rm(cwd, { recursive: true, force: true }); }
});

test("renamed same-number session remains readable and explicitly reconcilable", async () => {
  const cwd = await fixture();
  try {
    const first = await blueprintDiscussPrepare({ cwd, phase: 3 });
    const { rename } = await import("node:fs/promises");
    await rename(path.join(cwd, relative), path.join(cwd, ".blueprint/phases/03-renamed"));
    assert.equal((await blueprintDiscussRead({ cwd, phase: 3 })).session!.revision, first.revision);
    const next = await blueprintDiscussPrepare({ cwd, phase: 3, expectedRevision: first.revision, acknowledgeChangedInputs: true, reconcile: { confirmed: true, contextHash: null, logHash: null } });
    assert.equal(next.status, "prepared");
    assert.equal((await blueprintDiscussRead({ cwd, phase: 3 })).session!.topology.phaseDir, ".blueprint/phases/03-renamed");
  } finally { await rm(cwd, { recursive: true, force: true }); }
});
