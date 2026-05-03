import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import {
  ADD_BACKLOG_RUNTIME_METADATA,
  getRuntimeOwnedCommandMetadata
} from "../src/mcp/command-runtime-metadata.js";

const repoRoot = process.cwd();

test("add-backlog manifest uses runtime skill and capture MCP identities", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-add-backlog.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-capture` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-capture\.md/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_mutate_index/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_scaffold/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /\/blu-new-project/);
  assert.match(commandFile, /status: "duplicate"/);
  assert.match(commandFile, /999\.x/);
  assert.match(commandFile, /\/blu-add-phase/);
  assert.match(commandFile, /Do not use Gemini CLI's `update_topic`, `write_todos`, or task tracker tools/);
});

test("blueprint-capture skill captures backlog parking-lot behavior", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-capture/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /name: blueprint-capture/);
  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-add-backlog/);
  assert.match(skillFile, /Execution profile for `\/blu-note`, `\/blu-add-todo`, `\/blu-check-todos`, `\/blu-add-backlog`, `\/blu-review-backlog`, and `\/blu-explore`: `interactive-read`/);
  assert.match(skillFile, /blueprint_artifact_mutate_index/);
  assert.match(skillFile, /blueprint_artifact_scaffold/);
  assert.match(skillFile, /reserve a `999\.x` phase stub/i);
  assert.match(skillFile, /Prefer Gemini's `ask_user` tool when a structured confirmation helps/);
  assert.match(skillFile, /implemented commands only/i);
});

test("add-backlog runtime contract is owned by command runtime metadata", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("add-backlog");
  const contract = await buildBlueprintCommandRuntimeContractResource("add-backlog");

  assert.deepEqual(metadata, ADD_BACKLOG_RUNTIME_METADATA);
  assert.equal(contract.catalog.specPath, ADD_BACKLOG_RUNTIME_METADATA.sourceId);
  assert.deepEqual(contract.catalog.requiredTools, [
    ...ADD_BACKLOG_RUNTIME_METADATA.requiredTools
  ]);
  assert.deepEqual(contract.catalog.optionalAgents, [
    ...ADD_BACKLOG_RUNTIME_METADATA.optionalAgents
  ]);
  assert.deepEqual(contract.spec, {
    path: ADD_BACKLOG_RUNTIME_METADATA.spec.path,
    title: ADD_BACKLOG_RUNTIME_METADATA.spec.title,
    wave: ADD_BACKLOG_RUNTIME_METADATA.catalog.wave,
    family: ADD_BACKLOG_RUNTIME_METADATA.catalog.family,
    executionProfile: ADD_BACKLOG_RUNTIME_METADATA.spec.executionProfile,
    rootRoutable: ADD_BACKLOG_RUNTIME_METADATA.spec.rootRoutable,
    purpose: ADD_BACKLOG_RUNTIME_METADATA.spec.purpose,
    requiredTools: [...ADD_BACKLOG_RUNTIME_METADATA.requiredTools],
    primarySkill: ADD_BACKLOG_RUNTIME_METADATA.catalog.primarySkill,
    optionalSubagents: [...ADD_BACKLOG_RUNTIME_METADATA.optionalAgents],
    reads: [...ADD_BACKLOG_RUNTIME_METADATA.spec.reads],
    writes: [...ADD_BACKLOG_RUNTIME_METADATA.spec.writes]
  });
  assert.equal(
    contract.runtimeReference?.path,
    ADD_BACKLOG_RUNTIME_METADATA.sourceId
  );
  assert.equal(
    contract.runtimeReference?.commandSpecPath,
    ADD_BACKLOG_RUNTIME_METADATA.sourceId
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /Docless manifest\+skill-owned runtime/
  );
});
