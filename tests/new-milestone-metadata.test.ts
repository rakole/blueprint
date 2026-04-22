import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("new-milestone manifest references carry-forward seed generation and discuss-phase routing", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-new-milestone.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-roadmap-admin` skill/);
  assert.match(commandFile, /`blueprint-roadmapper` subagent/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-roadmap-admin\.md/);
  assert.doesNotMatch(commandFile, /agents\/blueprint-roadmapper\.md/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_contract_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_summary_digest/);
  assert.match(commandFile, /artifactPaths/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_scaffold/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /carry-forward as the default/i);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /missing-milestone-summary/);
  assert.match(commandFile, /carry-forward-confirmation/);
  assert.match(commandFile, /starter-doc-overwrite-confirmation/);
  assert.match(commandFile, /Do not use Gemini CLI's `update_topic`, `write_todos`, or task tracker tools/);
  assert.ok(
    commandFile.indexOf("If the milestone summary report is missing") <
      commandFile.indexOf("Build carry-forward context through `mcp_blueprint_blueprint_artifact_summary_digest`")
  );
  assert.match(commandFile, /next integer after the highest base phase number/i);
  assert.match(commandFile, /Preserve historical phase directories/i);
  assert.match(commandFile, /\.blueprint\/phases\/<NN>-<slug>\/<NN-CONTEXT\.md>/);
  assert.match(commandFile, /\/blu-discuss-phase <first phase>/);
});

test("roadmap-admin skill captures carry-forward new-milestone behavior", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-roadmap-admin/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /\/blu-new-milestone/);
  assert.match(skillFile, /report\.milestone-summary/);
  assert.match(skillFile, /phase\.context/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /carry-forward as the default/i);
  assert.match(skillFile, /Preserve historical phase directories/i);
  assert.match(skillFile, /next whole-number phase/i);
  assert.match(skillFile, /\/blu-discuss-phase <first phase>/);
  assert.match(skillFile, /ask_user/);
  assert.match(skillFile, /Execution profile for `\/blu-add-phase`, `\/blu-insert-phase`, `\/blu-remove-phase`, `\/blu-plan-milestone-gaps`, `\/blu-audit-milestone`, `\/blu-complete-milestone`, `\/blu-milestone-summary`, and `\/blu-new-milestone`: `interactive-read`/);
  assert.match(skillFile, /Do not use `update_topic`, `write_todos`, or tracker tools/i);
});

test("new-milestone docs and runtime reference align to the interactive-read carry-forward contract", async () => {
  const [docFile, runtimeFile] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/new-milestone.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8"),
  ]);

  assert.match(docFile, /\| Execution profile \| `interactive-read` \|/);
  assert.match(docFile, /shared interactive-read classification/i);
  assert.match(docFile, /missing-milestone-summary/);
  assert.match(docFile, /carry-forward-confirmation/);
  assert.match(docFile, /starter-doc-overwrite-confirmation/);
  assert.match(docFile, /does not expose the long-running progress layer/i);
  assert.match(runtimeFile, /`new-milestone` .*Interactive-read profile for bounded milestone restart:/);
});
