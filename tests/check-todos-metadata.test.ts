import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import {
  CHECK_TODOS_RUNTIME_METADATA,
  getRuntimeOwnedCommandMetadata
} from "../src/mcp/command-runtime-metadata.js";

const repoRoot = process.cwd();

test("check-todos manifest uses runtime skill and todo-status MCP identities", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-check-todos.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-capture` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-capture\.md/);
  assert.match(commandFile, /mcp_blueprint_blueprint_project_status/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_mutate_index/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /action: "list"/);
  assert.match(commandFile, /action: "update"/);
  assert.match(commandFile, /\/blu-new-project/);
  assert.match(commandFile, /\/blu-health/);
  assert.match(commandFile, /\/blu-add-todo/);
  assert.match(commandFile, /\/blu-progress/);
  assert.match(commandFile, /Prefer Gemini CLI's built-in `ask_user` tool for status-change confirmation/);
});

test("blueprint-capture skill captures shipped check-todos behavior", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-capture/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /\/blu-check-todos/);
  assert.match(skillFile, /### `check-todos`/);
  assert.match(skillFile, /Execution profile for `\/blu-note`, `\/blu-add-todo`, `\/blu-check-todos`, `\/blu-add-backlog`, `\/blu-review-backlog`, and `\/blu-explore`: `interactive-read`/);
  assert.match(skillFile, /blueprint_project_status/);
  assert.match(skillFile, /action: "list"/);
  assert.match(skillFile, /action: "update"/);
  assert.match(skillFile, /active` or `completed/);
  assert.match(skillFile, /Prefer Gemini's `ask_user` tool when a structured confirmation helps/);
  assert.doesNotMatch(
    skillFile,
    /`check-todos` and `review-backlog` stay documented contracts/
  );
});

test("check-todos runtime contract is owned by command runtime metadata", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("check-todos");
  const contract = await buildBlueprintCommandRuntimeContractResource("check-todos");

  assert.deepEqual(metadata, CHECK_TODOS_RUNTIME_METADATA);
  assert.equal(contract.catalog.specPath, CHECK_TODOS_RUNTIME_METADATA.sourceId);
  assert.deepEqual(contract.catalog.requiredTools, [
    ...CHECK_TODOS_RUNTIME_METADATA.requiredTools
  ]);
  assert.deepEqual(contract.catalog.optionalAgents, [
    ...CHECK_TODOS_RUNTIME_METADATA.optionalAgents
  ]);
  assert.deepEqual(contract.spec, {
    path: CHECK_TODOS_RUNTIME_METADATA.spec.path,
    title: CHECK_TODOS_RUNTIME_METADATA.spec.title,
    wave: CHECK_TODOS_RUNTIME_METADATA.catalog.wave,
    family: CHECK_TODOS_RUNTIME_METADATA.catalog.family,
    executionProfile: CHECK_TODOS_RUNTIME_METADATA.spec.executionProfile,
    rootRoutable: CHECK_TODOS_RUNTIME_METADATA.spec.rootRoutable,
    purpose: CHECK_TODOS_RUNTIME_METADATA.spec.purpose,
    requiredTools: [...CHECK_TODOS_RUNTIME_METADATA.requiredTools],
    primarySkill: CHECK_TODOS_RUNTIME_METADATA.catalog.primarySkill,
    optionalSubagents: [...CHECK_TODOS_RUNTIME_METADATA.optionalAgents],
    reads: [...CHECK_TODOS_RUNTIME_METADATA.spec.reads],
    writes: [...CHECK_TODOS_RUNTIME_METADATA.spec.writes]
  });
  assert.equal(
    contract.runtimeReference?.path,
    CHECK_TODOS_RUNTIME_METADATA.sourceId
  );
  assert.equal(
    contract.runtimeReference?.commandSpecPath,
    CHECK_TODOS_RUNTIME_METADATA.sourceId
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /Docless manifest\+skill-owned runtime/
  );
});
