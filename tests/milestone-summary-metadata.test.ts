import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

test("milestone-summary manifest references saved report evidence and new-milestone routing", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-milestone-summary.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-roadmap-admin` skill/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-roadmap-admin\.md/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_list/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_contract_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_summary_digest/);
  assert.match(commandFile, /artifactPaths/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_report_write/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /contract\.authoringTemplate/);
  assert.match(commandFile, /explicit overwrite confirmation/i);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /missing-milestone-audit/);
  assert.match(commandFile, /missing-milestone-complete/);
  assert.match(commandFile, /milestone-summary-overwrite-confirmation/);
  assert.match(commandFile, /Do not use Gemini CLI's `update_topic`, `write_todos`, or task tracker tools/);
  assert.match(commandFile, /milestone-summary-<milestone>/);
  assert.match(commandFile, /\/blu-new-milestone/);
  assert.doesNotMatch(commandFile, /blueprint-doc-writer/);
});

test("roadmap-admin skill keeps milestone-summary skill-led and Wave 2 local", async () => {
  const skillFile = await readFile(
    path.join(repoRoot, "skills/blueprint-roadmap-admin/SKILL.md"),
    "utf8"
  );

  assert.match(skillFile, /\/blu-milestone-summary/);
  assert.match(skillFile, /report\.milestone-summary/);
  assert.match(skillFile, /blueprint_artifact_report_write/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /contract\.authoringTemplate/);
  assert.match(skillFile, /Do not pull in `blueprint-doc-writer`/);
  assert.match(skillFile, /\/blu-new-milestone/);
  assert.match(skillFile, /ask_user/);
  assert.match(skillFile, /Execution profile for `\/blu-add-phase`, `\/blu-insert-phase`, `\/blu-remove-phase`, `\/blu-plan-milestone-gaps`, `\/blu-audit-milestone`, `\/blu-complete-milestone`, `\/blu-milestone-summary`, and `\/blu-new-milestone`: `interactive-read`/);
  assert.match(skillFile, /Do not use `update_topic`, `write_todos`, or tracker tools/i);
});

test("milestone-summary docs and runtime reference align to the interactive-read summary contract", async () => {
  const [docFile, runtimeFile] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/milestone-summary.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8"),
  ]);

  assert.match(docFile, /\| Execution profile \| `interactive-read` \|/);
  assert.match(docFile, /shared interactive-read classification/i);
  assert.match(docFile, /missing-milestone-audit/);
  assert.match(docFile, /missing-milestone-complete/);
  assert.match(docFile, /milestone-summary-overwrite-confirmation/);
  assert.match(docFile, /does not expose the long-running progress layer/i);
  assert.match(runtimeFile, /`milestone-summary` .*Interactive-read profile for bounded milestone summarization:/);
});
