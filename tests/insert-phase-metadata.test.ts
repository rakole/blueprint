import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("insert-phase manifest references roadmap insertion tools, confirmation gate, and discuss-phase routing", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-insert-phase.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-roadmap-admin` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-roadmap-admin\.md/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_insert_phase/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_scaffold/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /roadmapEvolutionNotes/);
  assert.match(commandFile, /confirmed integer phase number/);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /phase-insert-confirmation/);
  assert.match(commandFile, /invalid-insertion-anchor/);
  assert.match(commandFile, /conflicting-decimal-directory/);
  assert.match(commandFile, /Do not use Gemini CLI's `update_topic`, `write_todos`, or task tracker tools/);
  assert.match(commandFile, /Do not accept decimal insertion targets/i);
  assert.match(commandFile, /\/blu-discuss-phase <phase>/);
});

test("roadmap-admin skill captures insert-phase numbering, drift, and discuss-phase follow-up", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-roadmap-admin/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /\/blu-insert-phase/);
  assert.match(skillFile, /blueprint_roadmap_insert_phase/);
  assert.match(skillFile, /reject decimal targets/i);
  assert.match(skillFile, /roadmap-driven/i);
  assert.match(skillFile, /conflicting decimal directory/i);
  assert.match(skillFile, /roadmapEvolutionNotes/);
  assert.match(skillFile, /ask_user/);
  assert.match(skillFile, /Execution profile for `\/blu-add-phase`, `\/blu-insert-phase`, `\/blu-remove-phase`, `\/blu-plan-milestone-gaps`, `\/blu-audit-milestone`, `\/blu-complete-milestone`, `\/blu-milestone-summary`, and `\/blu-new-milestone`: `interactive-read`/);
  assert.match(skillFile, /Do not use `update_topic`, `write_todos`, or tracker tools/i);
  assert.match(skillFile, /\$\{phaseDir\}\/\$\{phasePrefix\}-CONTEXT\.md/);
  assert.match(skillFile, /\/blu-discuss-phase <phase>/);
});

test("insert-phase docs and MCP reference use numeric after anchors and phasePrefix-backed scaffolding", async () => {
  const commandDoc = await readFile(
    path.join(repoRoot, "docs/commands/insert-phase.md"),
    "utf8"
  );
  const schemaDoc = await readFile(
    path.join(repoRoot, "docs/ARTIFACT-SCHEMA.md"),
    "utf8"
  );
  const mcpDocs = await readFile(path.join(repoRoot, "docs/MCP-TOOLS.md"), "utf8");
  const runtimeDocs = await readFile(
    path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"),
    "utf8"
  );

  assert.match(commandDoc, /<afterPhaseNumber> <description>/);
  assert.match(commandDoc, /\| Execution profile \| `interactive-read` \|/);
  assert.match(commandDoc, /shared interactive-read classification/i);
  assert.match(commandDoc, /phase-insert-confirmation/);
  assert.match(commandDoc, /does not expose the long-running progress layer/i);
  assert.match(commandDoc, /phasePrefix/);
  assert.match(commandDoc, /roadmapEvolutionNotes/);
  assert.match(commandDoc, /Inserted: yes/);
  assert.match(schemaDoc, /optional inserted marker/);
  assert.match(schemaDoc, /Inserted: yes/);
  assert.doesNotMatch(commandDoc, /may also mutate code or git state/i);
  assert.match(mcpDocs, /`blueprint_roadmap_insert_phase` accepts an integer anchor in `after` plus `description`/);
  assert.match(mcpDocs, /`afterPhaseNumber`, `phaseNumber`, `phasePrefix`, and `phaseDir`/);
  assert.match(runtimeDocs, /Interactive-read profile for bounded roadmap insertion:/);
  assert.match(runtimeDocs, /returned `phasePrefix`/);
  assert.match(runtimeDocs, /roadmapEvolutionNotes/);
  assert.doesNotMatch(runtimeDocs, /roadmap-evolution marker/i);
});
