import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("review manifest references plan-backed peer-review tools and safe routing contract", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-review.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-review` skill/);
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(
    commandFile,
    /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/
  );
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
  assert.match(commandFile, /`update_topic` tool/);
  assert.match(commandFile, /`write_todos`/);
  assert.match(commandFile, /session-local progress tools only/i);
  assert.match(commandFile, /`ask_user`/);
  assert.match(commandFile, /one focused question per `ask_user` call/i);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_locate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_list")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_index")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_plan_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_review_record")));
  assert.match(commandFile, /artifact: "peer-review"/);
  assert.match(commandFile, /XX-REVIEWS\.md/);
  assert.match(commandFile, /reviewer-availability/i);
  assert.match(commandFile, /requested reviewers/i);
  assert.match(commandFile, /reviewer disagreement status/i);
  assert.match(commandFile, /partial fan-out results/i);
  assert.match(commandFile, /next safe action on `\/blu-review <phase>`/i);
  assert.match(commandFile, /\/blu-plan-phase/);
  assert.match(commandFile, /\/blu-execute-phase/);
  assert.match(commandFile, /\/blu-code-review/);
  assert.match(commandFile, /\/blu-progress/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-review\.md|agents\/blueprint-reviewer\.md/);
});

test("blueprint-review skill captures MCP-owned peer-review rules", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-review/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-review/);
  assert.match(skillFile, /Execution profile for `review`: `long-running-mutation`/);
  assert.match(
    skillFile,
    /In-flight status fields for `review`: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(skillFile, /### `review`/);
  assert.match(skillFile, /blueprint_phase_plan_index/);
  assert.match(skillFile, /blueprint_phase_plan_read/);
  assert.match(skillFile, /blueprint_review_record/);
  assert.match(skillFile, /XX-REVIEWS\.md/);
  assert.match(skillFile, /ask_user/);
  assert.match(skillFile, /update_topic plus `write_todos`/i);
  assert.match(skillFile, /reviewer disagreement status/i);
  assert.match(skillFile, /reviewer-availability/i);
  assert.match(skillFile, /next safe action on\s+`\/blu-review <phase>`/i);
  assert.match(skillFile, /\/blu-plan-phase <phase>/);
  assert.match(skillFile, /\/blu-execute-phase <phase>/);
  assert.match(skillFile, /\/blu-code-review <phase>/);
});

test("review docs and runtime reference describe the long-running peer-review spine", async () => {
  const [docFile, runtimeReference] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/review.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  assert.match(docFile, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(
    docFile,
    /Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    docFile,
    /In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(docFile, /shared long-running-mutation posture/i);
  assert.match(docFile, /requested reviewer set, reviewer availability, disagreement posture/i);
  assert.match(docFile, /`update_topic` tool and keep a compact peer-review checklist with `write_todos`/i);
  assert.match(docFile, /session-local visibility only/i);
  assert.match(docFile, /waiting state explicit as `reviewer-availability`/i);
  assert.match(docFile, /next-step guidance stays on `\/blu-review <phase>`/i);

  assert.match(
    runtimeReference,
    /`review`[\s\S]*Long-running-mutation profile for phase-plan peer review/i
  );
  assert.match(
    runtimeReference,
    /`review`[\s\S]*resolved scope, active stage, pending gate, execution mode, and next safe action visible/i
  );
  assert.match(
    runtimeReference,
    /`review`[\s\S]*`update_topic` and `write_todos` for non-trivial review runs/i
  );
  assert.match(
    runtimeReference,
    /`review`[\s\S]*reviewer availability, partial reviewer coverage, disagreement posture, and artifact reuse or revision status explicit/i
  );
  assert.match(
    runtimeReference,
    /`review`[\s\S]*overwrite confirmation, reviewer-availability confirmation, or the visible `reviewer-availability` waiting state/i
  );
  assert.match(
    runtimeReference,
    /`review`[\s\S]*explicit reviewer flags versus `--all` fan-out/i
  );
});
