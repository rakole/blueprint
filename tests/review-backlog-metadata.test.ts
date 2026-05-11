import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import {
  getRuntimeOwnedCommandMetadata,
  REVIEW_BACKLOG_RUNTIME_METADATA
} from "../src/mcp/command-runtime-metadata.js";

const repoRoot = process.cwd();

test("review-backlog manifest references preview, promotion, backlog updates, and discuss routing", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-review-backlog.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-capture` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-capture\.md/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_promote_backlog/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /previewOnly: true/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_mutate_index/);
  assert.match(commandFile, /action: "update"/);
  assert.match(commandFile, /status: "promoted"/);
  assert.match(commandFile, /status: "archived"/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /Prefer\s+`ask_user` tool for structured promote or remove decisions/);
  assert.match(commandFile, /keep is the default safe path/i);
  assert.match(commandFile, /\/blu-discuss-phase <first promoted phase>/);
});

test("blueprint-capture skill captures review-backlog preview, promotion, and status-transition behavior", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-capture/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /\/blu-review-backlog/);
  assert.match(skillFile, /### `review-backlog`/);
  assert.match(skillFile, /Execution profile for `\/blu-note`, `\/blu-add-todo`, `\/blu-check-todos`, `\/blu-add-backlog`, `\/blu-review-backlog`, and `\/blu-explore`: `interactive-read`/);
  assert.match(skillFile, /blueprint_roadmap_promote_backlog/);
  assert.match(skillFile, /preview mode/i);
  assert.match(skillFile, /action: "update"/);
  assert.match(skillFile, /promoted/i);
  assert.match(skillFile, /archived/i);
  assert.match(skillFile, /Prefer Gemini's `ask_user` tool when a structured decision helps/);
  assert.match(skillFile, /keep is the default safe path/i);
  assert.match(skillFile, /\/blu-discuss-phase <first promoted phase>/);
});

test("review-backlog runtime contract is owned by command runtime metadata", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("review-backlog");
  const contract = await buildBlueprintCommandRuntimeContractResource("review-backlog");

  assert.deepEqual(metadata, REVIEW_BACKLOG_RUNTIME_METADATA);
  assert.equal(contract.catalog.specPath, REVIEW_BACKLOG_RUNTIME_METADATA.sourceId);
  assert.deepEqual(contract.catalog.requiredTools, [
    ...REVIEW_BACKLOG_RUNTIME_METADATA.requiredTools
  ]);
  assert.deepEqual(contract.catalog.optionalAgents, [
    ...REVIEW_BACKLOG_RUNTIME_METADATA.optionalAgents
  ]);
  assert.deepEqual(contract.spec, {
    path: REVIEW_BACKLOG_RUNTIME_METADATA.spec.path,
    title: REVIEW_BACKLOG_RUNTIME_METADATA.spec.title,
    wave: REVIEW_BACKLOG_RUNTIME_METADATA.catalog.wave,
    family: REVIEW_BACKLOG_RUNTIME_METADATA.catalog.family,
    executionProfile: REVIEW_BACKLOG_RUNTIME_METADATA.spec.executionProfile,
    rootRoutable: REVIEW_BACKLOG_RUNTIME_METADATA.spec.rootRoutable,
    purpose: REVIEW_BACKLOG_RUNTIME_METADATA.spec.purpose,
    requiredTools: [...REVIEW_BACKLOG_RUNTIME_METADATA.requiredTools],
    primarySkill: REVIEW_BACKLOG_RUNTIME_METADATA.catalog.primarySkill,
    optionalSubagents: [...REVIEW_BACKLOG_RUNTIME_METADATA.optionalAgents],
    reads: [...REVIEW_BACKLOG_RUNTIME_METADATA.spec.reads],
    writes: [...REVIEW_BACKLOG_RUNTIME_METADATA.spec.writes]
  });
  assert.equal(
    contract.runtimeReference?.path,
    REVIEW_BACKLOG_RUNTIME_METADATA.sourceId
  );
  assert.equal(
    contract.runtimeReference?.commandSpecPath,
    REVIEW_BACKLOG_RUNTIME_METADATA.sourceId
  );
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /Docless manifest\+skill-owned runtime/
  );
});
