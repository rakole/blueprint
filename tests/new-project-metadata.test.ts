import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("new-project manifest encodes the richer bootstrap flow without reviving GSD runtime assumptions", async () => {
  const [commandFile, docFile] = await Promise.all([
    readFile(path.join(repoRoot, "commands/blu-new-project.toml"), "utf8"),
    readFile(path.join(repoRoot, "docs/commands/new-project.md"), "utf8")
  ]);

  assert.match(commandFile, /Use the `blueprint-bootstrap` skill/);
  assert.match(commandFile, /skills\/blueprint-bootstrap\/references\/questioning\.md/);
  assert.match(commandFile, /thread-following questions|thread-following project questioning/i);
  assert.match(commandFile, /`ask_user`/);
  assert.match(commandFile, /`write_todos`/);
  assert.match(commandFile, /`update_topic`/);
  assert.match(commandFile, /`tracker_create_task`/);
  assert.match(commandFile, /`get_internal_docs`/);
  assert.match(commandFile, /one focused question per `ask_user` call/i);
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(
    commandFile,
    /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/
  );
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
  assert.match(commandFile, /workflow preferences/i);
  assert.match(commandFile, /bootstrap artifact contracts/i);
  assert.match(commandFile, /revision loop/i);
  assert.match(commandFile, /`blueprint-project-researcher`/);
  assert.match(commandFile, /`blueprint-roadmapper`/);
  assert.match(commandFile, /project instruction files such as `CLAUDE\.md` or `AGENTS\.md`/);
  assert.match(commandFile, /Do not claim auto-advance chaining/i);
  assert.match(docFile, /## Gemini-Native Internal Tool Guidance/);
  assert.match(docFile, /`write_todos`/);
  assert.match(docFile, /`update_topic`/);
  assert.match(docFile, /`tracker_create_task`/);
  assert.match(docFile, /`get_internal_docs`/);
  assert.match(docFile, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(docFile, /## Shared Runtime Contract/);
  assert.match(
    docFile,
    /Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    docFile,
    /In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(docFile, /resolved scope:/i);
  assert.match(docFile, /active stage:/i);
  assert.match(docFile, /pending gate:/i);
  assert.match(docFile, /execution mode:/i);
  assert.match(docFile, /next safe action:/i);
  assert.match(docFile, /1\. `Resolve`:/);
  assert.match(docFile, /2\. `Read`:/);
  assert.match(docFile, /3\. `Decide`:/);
  assert.match(docFile, /4\. `Execute`:/);
  assert.match(docFile, /5\. `Persist`:/);
  assert.match(docFile, /6\. `Validate`:/);
  assert.match(docFile, /7\. `Route`:/);

  for (const toolName of [
    "blueprint_project_init",
    "blueprint_project_status",
    "blueprint_config_get",
    "blueprint_config_set",
    "blueprint_state_update",
    "blueprint_artifact_contract_read",
    "blueprint_artifact_validate",
    "blueprint_artifact_scaffold"
  ] as const) {
    assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn(toolName)));
  }

  assert.doesNotMatch(commandFile, /\/gsd-/);
});

test("blueprint-bootstrap skill and questioning reference capture Gemini-native deep bootstrap guidance", async () => {
  const [skillFile, questioningRef, runtimeReference] = await Promise.all([
    readFile(path.join(repoRoot, "skills/blueprint-bootstrap/SKILL.md"), "utf8"),
    readFile(
      path.join(repoRoot, "skills/blueprint-bootstrap/references/questioning.md"),
      "utf8"
    ),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  assert.match(skillFile, /name: blueprint-bootstrap/);
  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /references\/questioning\.md/);
  assert.match(skillFile, /`ask_user`/);
  assert.match(skillFile, /`write_todos`/);
  assert.match(skillFile, /`update_topic`/);
  assert.match(skillFile, /`tracker_create_task`/);
  assert.match(skillFile, /`get_internal_docs`/);
  assert.match(skillFile, /Execution profile: `long-running-mutation`/);
  assert.match(
    skillFile,
    /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/
  );
  assert.match(
    skillFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
  assert.match(skillFile, /mode/i);
  assert.match(skillFile, /granularity/i);
  assert.match(skillFile, /bootstrap contracts/i);
  assert.match(skillFile, /revision loop/i);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /blueprint_artifact_validate/);
  assert.match(skillFile, /blueprint_config_set/);
  assert.match(skillFile, /blueprint-project-researcher/);
  assert.match(skillFile, /blueprint-roadmapper/);
  assert.match(skillFile, /next safe implemented command/i);
  assert.match(questioningRef, /thinking partner/i);
  assert.match(questioningRef, /Follow the thread/i);
  assert.match(questioningRef, /Ask User Dialog Rule/);
  assert.match(questioningRef, /one question at a time/i);
  assert.match(questioningRef, /Freeform Rule/);
  assert.match(questioningRef, /Session Rhythm/);
  assert.match(questioningRef, /`update_topic`/);
  assert.match(questioningRef, /`write_todos`/);
  assert.match(questioningRef, /Decision Gate/);
  assert.match(questioningRef, /Anti-Patterns/);
  assert.match(runtimeReference, /Long-running-mutation profile for Gemini-native bootstrap/i);
  assert.match(runtimeReference, /`Resolve`\/`Read`\/`Decide`\/`Execute`\/`Persist`\/`Validate`\/`Route`/);
  assert.match(runtimeReference, /resolved scope, active stage, pending gate, execution mode, and next safe action/i);
  assert.match(runtimeReference, /Gemini-native topic and todo coordination/i);
  assert.match(runtimeReference, /`get_internal_docs` self-correction/i);
});
