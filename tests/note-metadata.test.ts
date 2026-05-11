import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import {
  getRuntimeOwnedCommandMetadata,
  NOTE_RUNTIME_METADATA
} from "../src/mcp/command-runtime-metadata.js";

const repoRoot = process.cwd();

test("note manifest uses runtime skill and capture MCP identities", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-note.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-capture` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-capture\.md/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_mutate_index/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /\/blu-new-project/);
  assert.match(commandFile, /status: "duplicate"/);
  assert.match(commandFile, /project-local note capture/i);
  assert.match(commandFile, /Do not use\s+`update_topic`, `write_todos`, or task tracker tools/);
  assert.match(commandFile, /Do not reintroduce global-note behavior/);
});

test("blueprint-capture skill captures shipped note behavior", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-capture/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /### `note`/);
  assert.match(skillFile, /Execution profile for `\/blu-note`, `\/blu-add-todo`, `\/blu-check-todos`, `\/blu-add-backlog`, `\/blu-review-backlog`, and `\/blu-explore`: `interactive-read`/);
  assert.match(skillFile, /target: "note"/);
  assert.match(skillFile, /Do not reintroduce global-note behavior/i);
  assert.match(skillFile, /Do not use `update_topic`, `write_todos`, or tracker tools/);
  assert.match(skillFile, /implemented commands only/i);
  assert.doesNotMatch(
    skillFile,
    /`note`, `add-todo`, `check-todos`, and `review-backlog` stay documented contracts/
  );
});

test("note runtime contract is owned by command runtime metadata", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("note");
  const contract = await buildBlueprintCommandRuntimeContractResource("note");

  assert.deepEqual(metadata, NOTE_RUNTIME_METADATA);
  assert.equal(contract.catalog.specPath, NOTE_RUNTIME_METADATA.sourceId);
  assert.deepEqual(contract.catalog.requiredTools, [
    ...NOTE_RUNTIME_METADATA.requiredTools
  ]);
  assert.deepEqual(contract.catalog.optionalAgents, [
    ...NOTE_RUNTIME_METADATA.optionalAgents
  ]);
  assert.deepEqual(contract.spec, {
    path: NOTE_RUNTIME_METADATA.spec.path,
    title: NOTE_RUNTIME_METADATA.spec.title,
    wave: NOTE_RUNTIME_METADATA.catalog.wave,
    family: NOTE_RUNTIME_METADATA.catalog.family,
    executionProfile: NOTE_RUNTIME_METADATA.spec.executionProfile,
    rootRoutable: NOTE_RUNTIME_METADATA.spec.rootRoutable,
    purpose: NOTE_RUNTIME_METADATA.spec.purpose,
    requiredTools: [...NOTE_RUNTIME_METADATA.requiredTools],
    primarySkill: NOTE_RUNTIME_METADATA.catalog.primarySkill,
    optionalSubagents: [...NOTE_RUNTIME_METADATA.optionalAgents],
    reads: [...NOTE_RUNTIME_METADATA.spec.reads],
    writes: [...NOTE_RUNTIME_METADATA.spec.writes]
  });
  assert.equal(contract.runtimeReference?.path, NOTE_RUNTIME_METADATA.sourceId);
  assert.equal(
    contract.runtimeReference?.commandSpecPath,
    NOTE_RUNTIME_METADATA.sourceId
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /Docless manifest\+skill-owned runtime/
  );
});
