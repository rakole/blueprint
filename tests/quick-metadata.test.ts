import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

test("quick manifest references the execution skill, bounded depth agents, and report-backed MCP tools", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-quick.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-phase-execution` skill/);
  assert.match(
    commandFile,
    /`blueprint-researcher`, `blueprint-planner`, `blueprint-executor`, and `blueprint-verifier` subagents/
  );
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-execution\.md/);
  assert.doesNotMatch(
    commandFile,
    /agents\/blueprint-(researcher|planner|executor|verifier)\.md/
  );
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_lightweight_preflight")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_report_write")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_update")));
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(commandFile, /`Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route`/);
  assert.match(commandFile, /resolved scope, active stage, pending gate, execution mode, and next safe action/i);
  assert.match(commandFile, /`update_topic` tool to keep the active stage visible and `write_todos`/);
  assert.match(commandFile, /tracker-eligible/i);
  assert.match(commandFile, /session-local progress tools only/i);
  assert.match(commandFile, /session-local, pair it with visible `write_todos`/i);
  assert.match(commandFile, /When the host lacks them, preserve the same progress in prose/i);
  assert.match(commandFile, /When tracker support is unavailable, keep the same bounded quick flow linear/i);
  assert.match(commandFile, /`--discuss`/);
  assert.match(commandFile, /`--research`/);
  assert.match(commandFile, /`--validate`/);
  assert.match(commandFile, /`--full`/);
  assert.match(commandFile, /`--force`/);
  assert.match(commandFile, /pre-authorization for (?:a )?bounded non-destructive/i);
  assert.match(commandFile, /For code mutation, run cheap validation by default/i);
  assert.match(commandFile, /validation evidence or skipped reason/i);
  assert.match(commandFile, /use `blueprint-researcher`[^\n]+`workflow\.subagents` is enabled/);
  assert.match(commandFile, /use `blueprint-planner`[^\n]+`workflow\.subagents` is enabled/);
  assert.match(commandFile, /use `blueprint-executor`[^\n]+`workflow\.subagents` is enabled/);
  assert.match(commandFile, /use `blueprint-verifier`[^\n]+`workflow\.subagents` is enabled/);
  assert.match(commandFile, /quick-run-latest/);
  assert.match(commandFile, /\/blu-plan-phase/);
  assert.match(commandFile, /\/blu-execute-phase/);
  assert.match(commandFile, /\/blu-progress/);
});

test("execution skill and local quick contract capture visibility, tracker eligibility, and report persistence", async () => {
  const [skillFile, quickRuntimeContract] = await Promise.all([
    readFile(path.join(repoRoot, "skills/blueprint-phase-execution/SKILL.md"), "utf8"),
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-phase-execution/references/quick-runtime-contract.md"
      ),
      "utf8"
    )
  ]);

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-quick/);
  assert.match(
    skillFile,
    /skills\/blueprint-phase-execution\/references\/quick-runtime-contract\.md/
  );
  assert.match(
    skillFile,
    /skills\/blueprint-phase-execution\/references\/long-running-execution-profile\.md/
  );
  assert.match(
    skillFile,
    /### `\/blu-quick`[\s\S]*blueprint_lightweight_preflight[\s\S]*blueprint_artifact_report_write[\s\S]*blueprint_state_update/
  );

  assert.match(quickRuntimeContract, /mcp_blueprint_blueprint_lightweight_preflight/);
  assert.match(quickRuntimeContract, /effective\s+subagent config/);
  assert.match(quickRuntimeContract, /quick-run-latest/);
  assert.match(quickRuntimeContract, /tracker-backed branching is allowed only as session-local coordination/i);
  assert.match(quickRuntimeContract, /saved phase plan,\s+multi-wave execution/i);
  assert.match(quickRuntimeContract, /--discuss`, `--research`, `--validate`, and `--full`/);
  assert.match(quickRuntimeContract, /pre-authorization\s+for bounded non-destructive depth branches/i);
  assert.match(quickRuntimeContract, /run cheap validation by default/i);
  assert.match(quickRuntimeContract, /blueprint-researcher/);
  assert.match(quickRuntimeContract, /blueprint-planner/);
  assert.match(quickRuntimeContract, /blueprint-executor/);
  assert.match(quickRuntimeContract, /blueprint-verifier/);
  assert.match(quickRuntimeContract, /\/blu-progress/);
});

test("quick runtime contract resource is owned by runtime metadata, not docs", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("quick");

  assert.ok(metadata);
  assert.deepEqual(metadata.requiredInputPaths, [
    "skills/blueprint-phase-execution/references/quick-runtime-contract.md",
    "skills/blueprint-phase-execution/references/long-running-execution-profile.md"
  ]);

  const contract = await buildBlueprintCommandRuntimeContractResource("quick");

  assert.equal(contract.catalog.specPath, metadata.sourceId);
  assert.equal(contract.spec.path, metadata.sourceId);
  assert.equal(contract.runtimeReference.path, metadata.sourceId);
  assert.equal(contract.runtimeReference.commandSpecPath, metadata.sourceId);
  assert.equal(contract.spec.primarySkill, "blueprint-phase-execution");
  assert.deepEqual(contract.spec.requiredTools, [...metadata.requiredTools]);
  assert.deepEqual(contract.runtimeReference.exactMcpDestination, [
    ...metadata.requiredTools
  ]);
  assert.deepEqual(contract.spec.optionalSubagents, [
    "blueprint-researcher",
    "blueprint-planner",
    "blueprint-executor",
    "blueprint-verifier"
  ]);
  assert.deepEqual(contract.runtimeReference.optionalAgents, [
    "blueprint-researcher",
    "blueprint-planner",
    "blueprint-executor",
    "blueprint-verifier"
  ]);
  assert.deepEqual(contract.skillInputs.shared, []);
  assert.deepEqual(contract.skillInputs.commandSpecific, [
    "commands/blu-quick.toml",
    "skills/blueprint-phase-execution/references/quick-runtime-contract.md",
    "skills/blueprint-phase-execution/references/long-running-execution-profile.md"
  ]);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /Long-running-mutation profile for non-trivial bounded quick runs/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /use blueprint_lightweight_preflight as the common read path/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /bounded non-destructive depth preauthorization/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /run cheap validation for code mutation when discoverable/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /tracker-eligible session-local coordination paired with visible todos/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /do not let quick impersonate saved planning or broad lifecycle execution/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /skills\/blueprint-phase-execution\/references\/quick-runtime-contract\.md/i
  );
});

test("quick public docs use concrete task examples and avoid capture/planned-command drift", async () => {
  const docsFile = await readFile(path.join(repoRoot, "docs/commands/quick.md"), "utf8");

  assert.match(
    docsFile,
    /\/blu-quick "Rename BLUEPRINT_API_ENV references and update focused tests" --validate/
  );
  assert.match(
    docsFile,
    /\/blu quick "Update the quick command docs to clarify report overwrite handling" --research/
  );
  assert.match(docsFile, /blueprint_lightweight_preflight/);
  assert.match(docsFile, /pre-authorization for bounded non-destructive depth branches/i);
  assert.match(docsFile, /cheap validation evidence by default/i);
  assert.match(docsFile, /`quick-run-latest` through `blueprint_artifact_report_write`/);
  assert.match(docsFile, /routes to `\/blu-new-project`/);
  assert.doesNotMatch(docsFile, /\/blu quick$/m);
  assert.doesNotMatch(docsFile, /\/blu-quick --full/);
  assert.doesNotMatch(docsFile, /docs\/commands\/do\.md/);
  assert.doesNotMatch(docsFile, /note, todo, backlog/i);
  assert.doesNotMatch(docsFile, /promoted, completed, or archived/i);
  assert.doesNotMatch(docsFile, /malformed index files/i);
  assert.doesNotMatch(docsFile, /remove copied capture boilerplate/i);
});
