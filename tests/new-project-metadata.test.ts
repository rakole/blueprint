import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("new-project manifest encodes the richer bootstrap flow without reviving GSD runtime assumptions", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-new-project.toml"),
    "utf8"
  );

  assert.match(commandFile, /Use the `blueprint-bootstrap` skill/);
  assert.match(commandFile, /skills\/blueprint-bootstrap\/references\/questioning\.md/);
  assert.match(commandFile, /thread-following questions|thread-following project questioning/i);
  assert.match(commandFile, /workflow preferences/i);
  assert.match(commandFile, /revision loop/i);
  assert.match(commandFile, /`blueprint-project-researcher`/);
  assert.match(commandFile, /`blueprint-roadmapper`/);
  assert.match(commandFile, /project instruction files such as `CLAUDE\.md` or `AGENTS\.md`/);
  assert.match(commandFile, /Do not claim auto-advance chaining/i);

  for (const toolName of [
    "blueprint_project_init",
    "blueprint_project_status",
    "blueprint_config_get",
    "blueprint_config_set",
    "blueprint_state_update",
    "blueprint_artifact_scaffold"
  ] as const) {
    assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn(toolName)));
  }

  assert.doesNotMatch(commandFile, /\/gsd-/);
});

test("blueprint-bootstrap skill and questioning reference capture Gemini-native deep bootstrap guidance", async () => {
  const [skillFile, questioningRef] = await Promise.all([
    readFile(path.join(repoRoot, "skills/blueprint-bootstrap/SKILL.md"), "utf8"),
    readFile(
      path.join(repoRoot, "skills/blueprint-bootstrap/references/questioning.md"),
      "utf8"
    )
  ]);

  assert.match(skillFile, /name: blueprint-bootstrap/);
  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /references\/questioning\.md/);
  assert.match(skillFile, /mode/i);
  assert.match(skillFile, /granularity/i);
  assert.match(skillFile, /revision loop/i);
  assert.match(skillFile, /blueprint_config_set/);
  assert.match(skillFile, /blueprint-project-researcher/);
  assert.match(skillFile, /blueprint-roadmapper/);
  assert.match(skillFile, /next safe implemented command/i);
  assert.match(questioningRef, /thinking partner/i);
  assert.match(questioningRef, /Follow the thread/i);
  assert.match(questioningRef, /Freeform Rule/);
  assert.match(questioningRef, /Decision Gate/);
  assert.match(questioningRef, /Anti-Patterns/);
});
