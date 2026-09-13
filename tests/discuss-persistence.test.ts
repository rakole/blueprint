import test from "node:test";
import { promises as fs } from "node:fs";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createGitRepo } from "./helpers/git-fixtures.js";
import { validPhaseContextModel } from "./helpers/context-model.js";
import {
  blueprintDiscussRecord,
  blueprintDiscussRead,
  blueprintDiscussFinalize as directFinalize,
  prepareDiscussInputBasis,
  discussFinalizeDependencies,
} from "../src/mcp/tools/discuss.js";
const blueprintDiscussFinalize = (args: Parameters<typeof directFinalize>[0]) => directFinalize({ model: validPhaseContextModel({ openQuestions: [], deferredIdeas: [] }), ...args });
const phase = "3";
const relative = ".blueprint/phases/03-discovery";
async function fixture() {
  const cwd = await createGitRepo("discuss-persist-");
  await mkdir(path.join(cwd, relative), { recursive: true });
  await writeFile(
    path.join(cwd, ".blueprint/PROJECT.md"),
    "# Project\n\nA durable discovery project.\n",
  );
  await writeFile(
    path.join(cwd, ".blueprint/REQUIREMENTS.md"),
    "# Requirements\n\n- DISC-01: Preserve discovery decisions.\n",
  );
  await writeFile(
    path.join(cwd, ".blueprint/ROADMAP.md"),
    "# Roadmap: Fixture\n\n## Milestone\n\n- Active milestone: v1\n\n## Phases\n\n- [ ] **Phase 3: Discovery** - Durable discovery\n- [ ] **Phase 4: Delivery** - Deliver result\n\n## Phase Details\n\n### Phase 3: Discovery\n**Goal**: Preserve durable discovery.\n**Requirements**: DISC-01\n\n### Phase 4: Delivery\n**Goal**: Deliver result.\n",
  );
  return cwd;
}
async function prepare(cwd: string) {
  const input = ".blueprint/PROJECT.md";
  const hash = createHash("sha256")
    .update(await readFile(path.join(cwd, input)))
    .digest("hex");
  return prepareDiscussInputBasis({
    cwd,
    phase,
    readSet: [
      { path: input, hash },
      { path: `${relative}/03-SPEC.md`, hash: null },
    ],
  });
}
async function seeded(cwd: string) {
  await blueprintDiscussRecord({
    cwd,
    phase,
    requestId: "notes",
    expectedRevision: 0,

  });
  return (await prepare(cwd)).revision!;
}
test("single deferred record preserves submitted decisions and questions; log and coverage share durable evidence", async () => {
  const cwd = await fixture();
  try {
    const original = validPhaseContextModel({ openQuestions: [] });
    await blueprintDiscussRecord({
      cwd,
      phase,
      requestId: "start",
      expectedRevision: 0,

      records: [
        {
          id: "later",
          type: "deferred",
          value: "Add export support in a later phase.",
          rationale: "The phase focuses on persistence.",
          evidence: ["User requested durable persistence first."],
        },
      ],
    });
    const revision = (await prepare(cwd)).revision!;
    const result = await blueprintDiscussFinalize({
      cwd,
      phase,
      requestId: "publish",
      expectedRevision: revision,
      includeLog: true,
    });
    assert.equal(result.status, "finalized", JSON.stringify(result));
    const content = await readFile(
      path.join(cwd, relative, "03-CONTEXT.md"),
      "utf8",
    );
    assert.match(content, /Render context Markdown from a structured model/);
    assert.match(content, /\[later\]/);
    assert.match(content, /User requested durable persistence first/);
    const log = await readFile(
      path.join(cwd, relative, "03-DISCUSSION-LOG.md"),
      "utf8",
    );
    assert.match(log, /\[later\]/);
    assert.deepEqual(result.coveredRecordIds, ["later"]);
    assert.equal(
      (
        await blueprintDiscussFinalize({
          cwd,
          phase,
          requestId: "publish",
          expectedRevision: revision,
          includeLog: true,
        })
      ).status,
      "finalized",
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
test("blocking unresolved records prevent publication; downstream owned uncertainty can publish", async () => {
  const cwd = await fixture();
  try {
    const revision = await seeded(cwd);
    const record = {
      id: "choice",
      type: "open-question" as const,
      value: "Which storage engine will meet the throughput requirement?",
      rationale: "Throughput needs measurement.",
      evidence: [] as string[],
      blocking: true,
    };
    await blueprintDiscussRecord({
      cwd,
      phase,
      requestId: "question",
      expectedRevision: revision,
      records: [record],
    });
    assert.equal(
      (
        await blueprintDiscussFinalize({
          cwd,
          phase,
          requestId: "blocked",
          expectedRevision: revision + 1,
        })
      ).status,
      "blocked",
    );
    await blueprintDiscussRecord({
      cwd,
      phase,
      requestId: "delegate",
      expectedRevision: revision + 1,
      records: [
        { ...record, blocking: false, downstreamOwner: "research-phase" },
      ],
    });
    const result = await blueprintDiscussFinalize({
      cwd,
      phase,
      requestId: "publish",
      expectedRevision: revision + 2,
    });
    assert.equal(result.status, "finalized", JSON.stringify(result));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
test("stale baseline and missing overwrite block before journaling, allowing corrected retry", async () => {
  const cwd = await fixture();
  try {
    const target = path.join(cwd, relative, "03-CONTEXT.md");
    await writeFile(target, "# Existing authored context\n");
    const revision = await seeded(cwd);
    const args = {
      cwd,
      phase,
      requestId: "publish",
      expectedRevision: revision,
    };
    assert.equal((await blueprintDiscussFinalize(args)).status, "blocked");
    assert.equal(
      (await blueprintDiscussRead({ cwd, phase })).session!.journal,
      undefined,
    );
    const result = await blueprintDiscussFinalize({ ...args, overwrite: true });
    assert.equal(result.status, "finalized", JSON.stringify(result));
    await blueprintDiscussRecord({
      cwd,
      phase,
      requestId: "revise",
      expectedRevision: revision,

    });
    await writeFile(target, "# External edit\n");
    assert.equal(
      (
        await blueprintDiscussFinalize({
          cwd,
          phase,
          requestId: "stale",
          expectedRevision: revision + 1,
          overwrite: true,
        })
      ).status,
      "stale",
    );
    assert.equal(await readFile(target, "utf8"), "# External edit\n");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
test("state failure resumes publication journal without publishing bytes again; selected phase and foreign checkpoint survive", async () => {
  const cwd = await fixture();
  const originalState = discussFinalizeDependencies.stateUpdate;
  const originalWrite = discussFinalizeDependencies.artifactWrite;
  try {
    const revision = await seeded(cwd);
    const checkpointPath = path.join(
      cwd,
      relative,
      "03-DISCUSS-CHECKPOINT.json",
    );
    const foreign = JSON.stringify({
      version: 2,
      ownerCommand: "/blu-research-phase",
      mode: "research",
    });
    await writeFile(checkpointPath, foreign);
    let writes = 0;
    discussFinalizeDependencies.artifactWrite = async (args) => {
      writes++;
      return originalWrite(args);
    };
    discussFinalizeDependencies.stateUpdate = async () => {
      throw new Error("Injected state sync failure");
    };
    const args = {
      cwd,
      phase,
      requestId: "finish",
      expectedRevision: revision,
      includeLog: true,
    };
    const partial = await blueprintDiscussFinalize(args);
    assert.equal(partial.status, "partial");
    assert.equal(writes, 2);
    discussFinalizeDependencies.stateUpdate = originalState;
    const completed = await blueprintDiscussFinalize(args);
    assert.equal(completed.status, "finalized", JSON.stringify(completed));
    assert.equal(writes, 2);
    assert.equal(await readFile(checkpointPath, "utf8"), foreign);
    assert.match(JSON.stringify(completed.warnings), /owner|mode|research/i);
    assert.equal(
      completed.nextAction,
      (completed.state as any).derivedStatus.nextAction,
    );
    assert.match(
      await readFile(path.join(cwd, ".blueprint/STATE.md"), "utf8"),
      /current_phase: '?3'?|Current phase: 3/i,
    );
  } finally {
    discussFinalizeDependencies.stateUpdate = originalState;
    discussFinalizeDependencies.artifactWrite = originalWrite;
    await rm(cwd, { recursive: true, force: true });
  }
});
test("missing optional input appearance invalidates basis; unprepared sessions cannot publish", async () => {
  const cwd = await fixture();
  try {
    await blueprintDiscussRecord({
      cwd,
      phase,
      requestId: "initial",
      expectedRevision: 0,

    });
    assert.equal(
      (
        await blueprintDiscussFinalize({
          cwd,
          phase,
          requestId: "unprepared",
          expectedRevision: 1,
        })
      ).status,
      "stale",
    );
    const revision = (await prepare(cwd)).revision!;
    await writeFile(
      path.join(cwd, relative, "03-SPEC.md"),
      "# New specification\n",
    );
    assert.equal(
      (
        await blueprintDiscussFinalize({
          cwd,
          phase,
          requestId: "stale",
          expectedRevision: revision,
        })
      ).status,
      "stale",
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
test("confirmed runtime reconciliation discards partial journal metadata and safely rebases external target", async () => {
  const cwd = await fixture();
  const original = discussFinalizeDependencies.stateUpdate;
  try {
    const revision = await seeded(cwd);
    discussFinalizeDependencies.stateUpdate = async () => {
      throw new Error("State unavailable");
    };
    assert.equal(
      (
        await blueprintDiscussFinalize({
          cwd,
          phase,
          requestId: "partial",
          expectedRevision: revision,
        })
      ).status,
      "partial",
    );
    const target = path.join(cwd, relative, "03-CONTEXT.md");
    await writeFile(target, "# User revised published context\n");
    const hash = createHash("sha256")
      .update(await readFile(target))
      .digest("hex");
    const input = ".blueprint/PROJECT.md";
    const inputHash = createHash("sha256")
      .update(await readFile(path.join(cwd, input)))
      .digest("hex");
    const reconciliation = await prepareDiscussInputBasis({
      cwd,
      phase,
      expectedRevision: revision,
      readSet: [{ path: input, hash: inputHash }],
      acknowledgeChangedInputs: true,
      reconcile: { confirmed: true, contextHash: hash, logHash: null },
    });
    assert.equal(reconciliation.status, "prepared");
    const session = (await blueprintDiscussRead({ cwd, phase })).session!;
    assert.equal(session.journal, undefined);
    assert.equal(session.history.some((event) => "journal" in event), false);
    discussFinalizeDependencies.stateUpdate = original;
    assert.equal(
      (
        await blueprintDiscussFinalize({
          cwd,
          phase,
          requestId: "reconciled",
          expectedRevision: reconciliation.revision!,
          overwrite: true,
        })
      ).status,
      "finalized",
    );
  } finally {
    discussFinalizeDependencies.stateUpdate = original;
    await rm(cwd, { recursive: true, force: true });
  }
});

test("retry after partial publication refuses changed source evidence", async () => {
  const cwd = await fixture();
  const original = discussFinalizeDependencies.stateUpdate;
  try {
    const revision = await seeded(cwd);
    discussFinalizeDependencies.stateUpdate = async () => { throw new Error("Interrupted state write"); };
    const args = { cwd, phase, requestId: "retry", expectedRevision: revision };
    assert.equal((await blueprintDiscussFinalize(args)).status, "partial");
    discussFinalizeDependencies.stateUpdate = original;
    await writeFile(path.join(cwd, ".blueprint/PROJECT.md"), "# Changed project intent\n");
    const result = await blueprintDiscussFinalize(args);
    assert.equal(result.status, "partial");
    assert.match(result.reason, /evidence changed/);
  } finally {
    discussFinalizeDependencies.stateUpdate = original;
    await rm(cwd, { recursive: true, force: true });
  }
});

test("artifact writer rejects topology drift after outer finalize check", async () => {
  const cwd = await fixture();
  const original = discussFinalizeDependencies.artifactWrite;
  try {
    const revision = await seeded(cwd);
    discussFinalizeDependencies.artifactWrite = async (args) => {
      const roadmap = path.join(cwd, ".blueprint/ROADMAP.md");
      await writeFile(roadmap, (await readFile(roadmap, "utf8")).replaceAll("Durable discovery", "Revised discovery"));
      return original(args);
    };
    const result = await blueprintDiscussFinalize({ cwd, phase, requestId: "race", expectedRevision: revision });
    assert.equal(result.status, "partial");
    assert.match(result.reason, /topology/);
    await assert.rejects(readFile(path.join(cwd, relative, "03-CONTEXT.md")), { code: "ENOENT" });
  } finally {
    discussFinalizeDependencies.artifactWrite = original;
    await rm(cwd, { recursive: true, force: true });
  }
});

test("tampered publication paths and bytes cannot resume a journal", async () => {
  const cwd = await fixture();
  const original = discussFinalizeDependencies.stateUpdate;
  try {
    const revision = await seeded(cwd);
    discussFinalizeDependencies.stateUpdate = async () => { throw new Error("Interrupted"); };
    const args = { cwd, phase, requestId: "journal", expectedRevision: revision };
    assert.equal((await blueprintDiscussFinalize(args)).status, "partial");
    const sessionPath = path.join(cwd, relative, "03-DISCUSS-SESSION.json");
    const session = JSON.parse(await readFile(sessionPath, "utf8"));
    session.journal.context.path = ".blueprint/phases/04-delivery/04-CONTEXT.md";
    await writeFile(sessionPath, JSON.stringify(session));
    await assert.rejects(blueprintDiscussFinalize(args), /journal identity or integrity/);
  } finally {
    discussFinalizeDependencies.stateUpdate = original;
    await rm(cwd, { recursive: true, force: true });
  }
});


test("session save cannot recreate a phase directory renamed before the topology lock", async (t) => {
  const cwd = await fixture();
  try {
    const revision = await seeded(cwd);
    const originalMkdir = fs.mkdir.bind(fs);
    let renamed = false;
    t.mock.method(fs, "mkdir", async (target, options) => {
      if (!renamed && String(target).endsWith("phase-topology.lock")) {
        renamed = true;
        await fs.rename(path.join(cwd, relative), path.join(cwd, ".blueprint/phases/03-renamed"));
      }
      return originalMkdir(target, options);
    });
    await assert.rejects(blueprintDiscussRecord({ cwd, phase, requestId: "race-save", expectedRevision: revision, records: [] }), /topology changed/);
    assert.equal(renamed, true);
    await assert.rejects(readFile(path.join(cwd, relative, "03-DISCUSS-SESSION.json")), { code: "ENOENT" });
    const saved = JSON.parse(await readFile(path.join(cwd, ".blueprint/phases/03-renamed/03-DISCUSS-SESSION.json"), "utf8"));
    assert.equal(saved.revision, revision);
  } finally { t.mock.restoreAll(); await rm(cwd, { recursive: true, force: true }); }
});
