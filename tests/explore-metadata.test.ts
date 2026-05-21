import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import {
  EXPLORE_RUNTIME_METADATA,
  getRuntimeOwnedCommandMetadata
} from "../src/mcp/command-runtime-metadata.js";

const repoRoot = process.cwd();

test("explore manifest references capture skill, ideation-routing tools, and confirmation gates", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-explore.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-capture` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-capture\.md/);
  assert.match(commandFile, /mcp_blueprint_blueprint_project_status/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_mutate_index/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_add_phase/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_scaffold/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /route to `\/blu-quick` or `\/blu-plan-phase`/);
  assert.match(commandFile, /require explicit confirmation before writing anything/i);
  assert.match(commandFile, /Prefer Gemini CLI's built-in `ask_user` tool for the final routing confirmation/);
  assert.match(commandFile, /\/blu-new-project/);
  assert.match(commandFile, /\/blu-health/);
  assert.match(commandFile, /\/blu-check-todos/);
  assert.match(commandFile, /\/blu-review-backlog/);
  assert.match(commandFile, /\/blu-discuss-phase <phase>/);
});

test("blueprint-capture skill captures explore classification and confirmation behavior", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-capture/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /\/blu-explore/);
  assert.match(skillFile, /### `explore`/);
  assert.match(skillFile, /Execution profile for `\/blu-note`, `\/blu-add-todo`, `\/blu-check-todos`, `\/blu-add-backlog`, `\/blu-review-backlog`, and `\/blu-explore`: `interactive-read`/);
  assert.match(skillFile, /blueprint_project_status/);
  assert.match(skillFile, /blueprint_artifact_mutate_index/);
  assert.match(skillFile, /blueprint_roadmap_add_phase/);
  assert.match(skillFile, /blueprint_artifact_scaffold/);
  assert.match(skillFile, /`note`, `todo`, `backlog`, `roadmap`, or `no-write`/);
  assert.match(skillFile, /Confirm the final routing target and normalized text before any write/);
  assert.match(skillFile, /Gemini's `ask_user` tool is preferred when a structured confirmation helps/);
  assert.match(skillFile, /\/blu-check-todos/);
  assert.match(skillFile, /\/blu-review-backlog/);
  assert.match(skillFile, /\/blu-discuss-phase <phase>/);
  assert.match(skillFile, /same-named Gemini CLI agent tool `blueprint-researcher`/);
  assert.match(skillFile, /active `\/blu-explore` command contract permits `blueprint-researcher`/);
  assert.match(skillFile, /same-named Gemini agent tool is available/i);
  assert.match(skillFile, /bounded idea\s+classification packet/i);
  assert.match(skillFile, /no-subagent fallback below/i);
  assert.doesNotMatch(skillFile, /subagent_type/i);
  assert.doesNotMatch(skillFile, /agent definition/i);
  assert.doesNotMatch(skillFile, /agents\/blueprint-researcher/i);
  assert.doesNotMatch(skillFile, /explore stays documented until its own manifest/i);
});

test("explore runtime contract is owned by command runtime metadata", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("explore");
  const contract = await buildBlueprintCommandRuntimeContractResource("explore");

  assert.deepEqual(metadata, EXPLORE_RUNTIME_METADATA);
  assert.equal(contract.catalog.specPath, EXPLORE_RUNTIME_METADATA.sourceId);
  assert.deepEqual(contract.catalog.requiredTools, [
    ...EXPLORE_RUNTIME_METADATA.requiredTools
  ]);
  assert.deepEqual(contract.catalog.optionalAgents, [
    ...EXPLORE_RUNTIME_METADATA.optionalAgents
  ]);
  assert.deepEqual(contract.spec, {
    path: EXPLORE_RUNTIME_METADATA.spec.path,
    title: EXPLORE_RUNTIME_METADATA.spec.title,
    wave: EXPLORE_RUNTIME_METADATA.catalog.wave,
    family: EXPLORE_RUNTIME_METADATA.catalog.family,
    executionProfile: EXPLORE_RUNTIME_METADATA.spec.executionProfile,
    rootRoutable: EXPLORE_RUNTIME_METADATA.spec.rootRoutable,
    purpose: EXPLORE_RUNTIME_METADATA.spec.purpose,
    requiredTools: [...EXPLORE_RUNTIME_METADATA.requiredTools],
    primarySkill: EXPLORE_RUNTIME_METADATA.catalog.primarySkill,
    optionalSubagents: [...EXPLORE_RUNTIME_METADATA.optionalAgents],
    reads: [...EXPLORE_RUNTIME_METADATA.spec.reads],
    writes: [...EXPLORE_RUNTIME_METADATA.spec.writes]
  });
  assert.equal(contract.runtimeReference?.path, EXPLORE_RUNTIME_METADATA.sourceId);
  assert.equal(
    contract.runtimeReference?.commandSpecPath,
    EXPLORE_RUNTIME_METADATA.sourceId
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /Docless manifest\+skill-owned runtime/
  );
});
