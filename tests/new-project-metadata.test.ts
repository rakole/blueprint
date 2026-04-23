import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("new-project manifest stays thin while delegating runtime depth to the bootstrap skill package", async () => {
  const [commandFile, docFile] = await Promise.all([
    readFile(path.join(repoRoot, "commands/blu-new-project.toml"), "utf8"),
    readFile(path.join(repoRoot, "docs/commands/new-project.md"), "utf8")
  ]);

  assert.ok(
    commandFile.split("\n").length < 70,
    "new-project manifest should stay thin after moving the heavy contract into the skill package"
  );
  assert.match(commandFile, /thin command envelope/i);
  assert.match(commandFile, /Use the `blueprint-bootstrap` skill/);
  assert.match(commandFile, /skills\/blueprint-bootstrap\/references\/questioning\.md/);
  assert.match(commandFile, /skills\/blueprint-bootstrap\/references\/bootstrap-runtime-contract\.md/);
  assert.match(commandFile, /skills\/blueprint-bootstrap\/references\/runtime-guardrails\.md/);
  assert.match(commandFile, /`ask_user`/);
  assert.match(commandFile, /`write_todos`/);
  assert.match(commandFile, /`update_topic`/);
  assert.match(commandFile, /task-tracker tools/i);
  assert.match(commandFile, /`get_internal_docs`/);
  assert.match(commandFile, /`blueprint-project-researcher`/);
  assert.match(commandFile, /`blueprint-roadmapper`/);
  assert.match(commandFile, /Blueprint MCP server is disconnected or undiscovered/i);
  assert.match(commandFile, /project instruction files such as `CLAUDE\.md` or `AGENTS\.md`/);
  assert.match(commandFile, /invented auto-advance chaining|slash-command self-invocation/i);
  assert.match(commandFile, /Do not require `docs\/commands\/new-project\.md`/);
  assert.match(commandFile, /`--auto`/);
  assert.doesNotMatch(commandFile, /Follow this flow exactly:/i);
  assert.match(docFile, /## Gemini-Native Internal Tool Guidance/);
  assert.match(docFile, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(docFile, /## Shared Runtime Contract/);
  assert.match(docFile, /## Runtime Packaging/);
  assert.match(docFile, /manifest is intentionally thin/i);
  assert.match(docFile, /canonical external truth/i);
  assert.match(docFile, /skills\/blueprint-bootstrap\/references\/bootstrap-runtime-contract\.md/);
  assert.match(docFile, /skills\/blueprint-bootstrap\/references\/runtime-guardrails\.md/);
  assert.match(
    docFile,
    /Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`/
  );
  assert.match(
    docFile,
    /In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action/
  );
  assert.match(docFile, /resolved scope:/i);
  assert.match(docFile, /active stage:/i);
  assert.match(docFile, /pending gate:/i);
  assert.match(docFile, /execution mode:/i);
  assert.match(docFile, /next safe action:/i);
  assert.match(docFile, /1\. `Resolve`:/);
  assert.match(docFile, /2\. `Read`:/);
  assert.match(docFile, /3\. `Decide`:/);
  assert.match(docFile, /4\. `Execute`:/);
  assert.match(docFile, /5\. `Persist`:/);
  assert.match(docFile, /6\. `Validate`:/);
  assert.match(docFile, /7\. `Route`:/);

  for (const toolName of [
    "blueprint_project_init",
    "blueprint_project_status",
    "blueprint_config_get",
    "blueprint_config_set",
    "blueprint_state_update",
    "blueprint_artifact_contract_read",
    "blueprint_artifact_validate",
    "blueprint_artifact_scaffold"
  ] as const) {
    assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn(toolName)));
  }

  assert.doesNotMatch(commandFile, /\/gsd-/);
});

test("blueprint-bootstrap skill and questioning reference capture Gemini-native deep bootstrap guidance", async () => {
  const [skillFile, questioningRef, contractRef, guardrailsRef, runtimeReference] = await Promise.all([
    readFile(path.join(repoRoot, "skills/blueprint-bootstrap/SKILL.md"), "utf8"),
    readFile(
      path.join(repoRoot, "skills/blueprint-bootstrap/references/questioning.md"),
      "utf8"
    ),
    readFile(
      path.join(repoRoot, "skills/blueprint-bootstrap/references/bootstrap-runtime-contract.md"),
      "utf8"
    ),
    readFile(
      path.join(repoRoot, "skills/blueprint-bootstrap/references/runtime-guardrails.md"),
      "utf8"
    ),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  assert.match(skillFile, /name: blueprint-bootstrap/);
  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /## Runtime Self-Sufficiency/);
  assert.doesNotMatch(skillFile, /## Required Inputs/);
  assert.match(skillFile, /references\/questioning\.md/);
  assert.match(skillFile, /references\/bootstrap-runtime-contract\.md/);
  assert.match(skillFile, /references\/runtime-guardrails\.md/);
  assert.match(skillFile, /`ask_user`/);
  assert.match(skillFile, /`write_todos`/);
  assert.match(skillFile, /`update_topic`/);
  assert.match(skillFile, /`tracker_create_task`/);
  assert.match(skillFile, /`get_internal_docs`/);
  assert.match(skillFile, /Execution profile: `long-running-mutation`/);
  assert.match(
    skillFile,
    /shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/
  );
  assert.match(
    skillFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
  assert.match(skillFile, /mode/i);
  assert.match(skillFile, /granularity/i);
  assert.match(skillFile, /bootstrap contracts/i);
  assert.match(skillFile, /revision loop/i);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /blueprint_artifact_validate/);
  assert.match(skillFile, /blueprint_config_set/);
  assert.match(skillFile, /blueprint-project-researcher/);
  assert.match(skillFile, /blueprint-roadmapper/);
  assert.match(skillFile, /next safe implemented command/i);

  assert.ok(
    contractRef.split("\n").length > skillFile.split("\n").length,
    "the heavy runtime contract should now live in the local bootstrap reference"
  );
  assert.match(contractRef, /Execution profile: `long-running-mutation`/);
  assert.match(
    contractRef,
    /Shared stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`,\s*`Validate`, `Route`/
  );
  assert.match(
    contractRef,
    /In-flight status fields: resolved scope, active stage, pending gate,\s*execution mode, next safe action/
  );
  assert.match(contractRef, /deep discovery loop/i);
  assert.match(contractRef, /saved defaults and workflow preferences/i);
  assert.match(contractRef, /defaults provenance/i);
  assert.match(contractRef, /approval gate and revision loop/i);
  assert.match(contractRef, /`--auto`/);
  assert.match(contractRef, /`bootstrapSeed`/);
  assert.match(contractRef, /`mcp_blueprint_blueprint_artifact_contract_read`/);
  assert.match(contractRef, /`bootstrap\.project`,\s*`bootstrap\.requirements`, and `bootstrap\.roadmap`/);
  assert.match(contractRef, /`mcp_blueprint_blueprint_artifact_validate`/);
  assert.match(contractRef, /`mcp_blueprint_blueprint_config_set`/);
  assert.match(contractRef, /`mcp_blueprint_blueprint_project_status`/);
  assert.match(contractRef, /returned `createdPaths`, `configPath`, and `nextAction` as authoritative/i);
  assert.match(contractRef, /`overwrite: true`/);
  assert.match(contractRef, /supported repo-relative Blueprint artifact paths/i);
  assert.match(contractRef, /JSON-object `patch`/i);
  assert.match(contractRef, /written bootstrap artifacts/i);
  assert.match(contractRef, /greenfield, scaffold-only, or brownfield/i);
  assert.match(contractRef, /\/blu-map-codebase/);
  assert.match(contractRef, /next safe action/i);
  assert.match(contractRef, /blueprint-project-researcher/);
  assert.match(contractRef, /blueprint-roadmapper/);

  assert.match(guardrailsRef, /host CLI slash command, not a shell executable/i);
  assert.match(guardrailsRef, /Never run `\/blu-new-project` in the shell/i);
  assert.match(guardrailsRef, /runtime FQNs such as\s+`mcp_blueprint_blueprint_project_init`/i);
  assert.match(guardrailsRef, /`mcp use`, `blueprint-mcp`, or ad-hoc `node -e` MCP SDK scripts/i);
  assert.match(guardrailsRef, /`ask_user`/);
  assert.match(guardrailsRef, /`update_topic`/);
  assert.match(guardrailsRef, /`write_todos`/);
  assert.match(guardrailsRef, /`tracker_create_task`/);
  assert.match(guardrailsRef, /`get_internal_docs`/);
  assert.match(guardrailsRef, /do not pretend they ran/i);
  assert.match(guardrailsRef, /Do not reintroduce `?\.planning\/`?/i);
  assert.match(guardrailsRef, /Do not promise GSD shell choreography/i);
  assert.match(guardrailsRef, /Do not generate project instruction files such as `CLAUDE\.md` or `AGENTS\.md`/i);

  assert.match(questioningRef, /thinking partner/i);
  assert.match(questioningRef, /Follow the thread/i);
  assert.match(questioningRef, /Ask User Dialog Rule/);
  assert.match(questioningRef, /one question at a time/i);
  assert.match(questioningRef, /Freeform Rule/);
  assert.match(questioningRef, /Session Rhythm/);
  assert.match(questioningRef, /`update_topic`/);
  assert.match(questioningRef, /`write_todos`/);
  assert.match(questioningRef, /Decision Gate/);
  assert.match(questioningRef, /Discovery Boundaries/);
  assert.match(questioningRef, /Anti-Patterns/);
  assert.match(runtimeReference, /Long-running-mutation profile for Gemini-native bootstrap/i);
  assert.match(runtimeReference, /`Resolve`\/`Read`\/`Decide`\/`Execute`\/`Persist`\/`Validate`\/`Route`/);
  assert.match(runtimeReference, /resolved scope, active stage, pending gate, execution mode, and next safe action/i);
  assert.match(runtimeReference, /Gemini-native topic and todo coordination/i);
  assert.match(runtimeReference, /`get_internal_docs` self-correction/i);
  assert.match(runtimeReference, /manifest stays thin while the self-sufficient runtime contract lives under `skills\/blueprint-bootstrap\/references\/`/i);
});
