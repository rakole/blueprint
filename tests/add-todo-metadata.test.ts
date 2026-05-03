import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import {
  ADD_TODO_RUNTIME_METADATA,
  getRuntimeOwnedCommandMetadata
} from "../src/mcp/command-runtime-metadata.js";

const repoRoot = process.cwd();

test("add-todo manifest uses runtime skill and capture MCP identities", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-add-todo.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-capture` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-capture\.md/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_mutate_index/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /target: "todo"/);
  assert.match(commandFile, /\/blu-new-project/);
  assert.match(commandFile, /status: "duplicate"/);
  assert.match(commandFile, /Do not use Gemini CLI's `update_topic`, `write_todos`, or task tracker tools/);
  assert.match(commandFile, /\/blu-progress/);
});

test("blueprint-capture skill captures todo append behavior", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-capture/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /name: blueprint-capture/);
  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-add-todo/);
  assert.match(skillFile, /### `add-todo`/);
  assert.match(skillFile, /Execution profile for `\/blu-note`, `\/blu-add-todo`, `\/blu-check-todos`, `\/blu-add-backlog`, `\/blu-review-backlog`, and `\/blu-explore`: `interactive-read`/);
  assert.match(skillFile, /target: "todo"/);
  assert.match(skillFile, /duplicate todo descriptions/i);
  assert.match(skillFile, /Do not use `update_topic`, `write_todos`, or tracker tools/);
  assert.match(skillFile, /implemented commands only/i);
  assert.doesNotMatch(
    skillFile,
    /`note`, `add-todo`, `check-todos`, and `review-backlog` stay documented contracts/
  );
});

test("add-todo runtime contract is owned by command runtime metadata", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("add-todo");
  const contract = await buildBlueprintCommandRuntimeContractResource("add-todo");

  assert.deepEqual(metadata, ADD_TODO_RUNTIME_METADATA);
  assert.equal(contract.catalog.specPath, ADD_TODO_RUNTIME_METADATA.sourceId);
  assert.deepEqual(contract.catalog.requiredTools, [
    ...ADD_TODO_RUNTIME_METADATA.requiredTools
  ]);
  assert.deepEqual(contract.catalog.optionalAgents, [
    ...ADD_TODO_RUNTIME_METADATA.optionalAgents
  ]);
  assert.deepEqual(contract.spec, {
    path: ADD_TODO_RUNTIME_METADATA.spec.path,
    title: ADD_TODO_RUNTIME_METADATA.spec.title,
    wave: ADD_TODO_RUNTIME_METADATA.catalog.wave,
    family: ADD_TODO_RUNTIME_METADATA.catalog.family,
    executionProfile: ADD_TODO_RUNTIME_METADATA.spec.executionProfile,
    rootRoutable: ADD_TODO_RUNTIME_METADATA.spec.rootRoutable,
    purpose: ADD_TODO_RUNTIME_METADATA.spec.purpose,
    requiredTools: [...ADD_TODO_RUNTIME_METADATA.requiredTools],
    primarySkill: ADD_TODO_RUNTIME_METADATA.catalog.primarySkill,
    optionalSubagents: [...ADD_TODO_RUNTIME_METADATA.optionalAgents],
    reads: [...ADD_TODO_RUNTIME_METADATA.spec.reads],
    writes: [...ADD_TODO_RUNTIME_METADATA.spec.writes]
  });
  assert.equal(contract.runtimeReference?.path, ADD_TODO_RUNTIME_METADATA.sourceId);
  assert.equal(
    contract.runtimeReference?.commandSpecPath,
    ADD_TODO_RUNTIME_METADATA.sourceId
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /Docless manifest\+skill-owned runtime/
  );
});
