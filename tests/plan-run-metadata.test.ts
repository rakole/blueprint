import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { RUN_PLAN_RUNTIME_METADATA } from "../src/mcp/command-runtime-metadata.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import { BLUEPRINT_MUTATION_TOOL_NAMES, blueprintToolNames } from "../src/mcp/server.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();
const RUN_PLAN_INPUTS = [
  "commands/blu-run-plan.toml",
  "skills/blueprint-plan-run/references/run-plan-runtime-contract.md"
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripRuntimeToolFqns(markdown: string): string {
  return markdown.replace(/`mcp_blueprint_blueprint_[a-z0-9_]+`/g, "`<runtime-tool>`");
}

test("run-plan is implemented once manifest, skill, and PlanRun MCP tools are registered", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["run-plan"];

  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.requiredToolsSatisfied, true);
  assert.equal(entry.manifestPath, "commands/blu-run-plan.toml");
  assert.equal(entry.skillPath, "skills/blueprint-plan-run/SKILL.md");
  assert.equal(entry.specPath, RUN_PLAN_RUNTIME_METADATA.sourceId);
  assert.equal(entry.primarySkill, "blueprint-plan-run");
  assert.equal(entry.wave, 5);
  assert.deepEqual(entry.requiredTools, [...RUN_PLAN_RUNTIME_METADATA.requiredTools]);
  assert.deepEqual(entry.optionalAgents, []);
  assert.deepEqual(entry.availableOptionalAgents, []);
  assert.deepEqual(entry.blockedBy, []);

  for (const toolName of RUN_PLAN_RUNTIME_METADATA.requiredTools) {
    assert.ok(
      blueprintToolNames.includes(toolName),
      `run-plan depends on an unregistered MCP tool: ${toolName}`
    );
  }

  for (const toolName of [
    "blueprint_plan_run_record",
    "blueprint_plan_run_prepare",
    "blueprint_plan_run_patch_record"
  ]) {
    assert.ok(
      BLUEPRINT_MUTATION_TOOL_NAMES.has(toolName),
      `run-plan mutating tool should be covered by mutation failure logging: ${toolName}`
    );
  }
});

test("run-plan manifest locks preview-first confirmation and later-diff persistence gates", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-run-plan.toml"),
    "utf8"
  );

  assert.match(commandFile, /Use the `blueprint-plan-run` skill/);
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(commandFile, /`Resolve`, `Read`, `Decide`, `Prepare`, `Execute`, `Capture`, `Persist`, and `Route`/);
  assert.match(commandFile, /prefer the `ask_user` tool/i);
  assert.match(commandFile, /mode: "preview"[\s\S]*before any mutation/i);
  assert.match(commandFile, /mode: "prepare"/i);
  assert.match(commandFile, /plan-run-prepare-confirmation/);
  assert.match(commandFile, /authorized files/i);
  assert.match(commandFile, /verification commands/i);
  assert.match(commandFile, /planned workspacePath/i);
  assert.match(commandFile, /worktreePath/i);
  assert.match(commandFile, /recordPath/i);
  assert.doesNotMatch(commandFile, /planRunPath/);
  assert.doesNotMatch(commandFile, /authorized surfaces/i);
  assert.match(commandFile, /does not implement the plan/i);
  assert.match(commandFile, /Before patch capture, call `mcp_blueprint_blueprint_plan_run_diff`/i);
  assert.match(commandFile, /If `unauthorizedChangedFiles` is non-empty[\s\S]*do not call `mcp_blueprint_blueprint_patch_record`/i);
  assert.match(commandFile, /call `mcp_blueprint_blueprint_plan_run_patch_record`/i);
  assert.match(commandFile, /patch id `plan-run-<phase>-<planId>-<runId>`/i);
  assert.match(commandFile, /Do not call `mcp_blueprint_blueprint_phase_summary_write` or `mcp_blueprint_blueprint_state_update` in this wave/i);

  for (const toolName of RUN_PLAN_RUNTIME_METADATA.requiredTools) {
    assert.match(
      commandFile,
      new RegExp(
        escapeRegExp(`\`${blueprintRuntimeToolFqn(toolName as `blueprint_${string}`)}\``)
      ),
      `run-plan manifest should reference ${toolName} through its runtime FQN`
    );
  }

  assert.doesNotMatch(stripRuntimeToolFqns(commandFile), /`blueprint_[a-z0-9_]+`/);
});

test("run-plan skill and local contract stay docs-free and capture-bounded", async () => {
  const [skillFile, referenceFile] = await Promise.all([
    readFile(path.join(repoRoot, "skills/blueprint-plan-run/SKILL.md"), "utf8"),
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-plan-run/references/run-plan-runtime-contract.md"
      ),
      "utf8"
    )
  ]);

  assert.match(skillFile, /name: blueprint-plan-run/);
  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-run-plan/);
  assert.match(skillFile, /## Runtime Call Rules/);
  assert.match(skillFile, /`mcp_blueprint_blueprint_project_status`/);
  assert.match(skillFile, /Translate any shorthand tool ids like `blueprint_project_status`/);
  assert.match(skillFile, /Treat Blueprint skills as loaded guidance, not callable tools\./);
  assert.match(skillFile, /Never run `\/blu-\*` in the shell\./);
  assert.match(
    skillFile,
    /skills\/blueprint-plan-run\/references\/run-plan-runtime-contract\.md/
  );
  assert.match(skillFile, /Stop after PREPARED state unless implementation edits already exist/i);
  assert.match(skillFile, /mcp_blueprint_blueprint_plan_run_patch_record/);
  assert.match(skillFile, /records deterministic patch id `plan-run-<phase>-<planId>-<runId>`/i);
  assert.doesNotMatch(skillFile, /authorized surfaces/i);
  assert.doesNotMatch(skillFile, /docs\//);

  assert.match(referenceFile, /prepare behavior is preview-first/i);
  assert.match(referenceFile, /Wave 6 capture behavior records authorized implementation diffs only/i);
  assert.match(referenceFile, /plan-run-prepare-confirmation/);
  assert.match(referenceFile, /planned workspacePath/i);
  assert.match(referenceFile, /`mcp_blueprint_blueprint_plan_run_diff` must precede patch capture/i);
  assert.match(referenceFile, /`mcp_blueprint_blueprint_plan_run_patch_record` owns normal patch capture/i);
  assert.match(referenceFile, /must block without writing a\s+patch registry entry when `unauthorizedChangedFiles` is non-empty/i);
  assert.match(referenceFile, /Do not hand-write `.blueprint\/runs\/`/i);
  assert.doesNotMatch(referenceFile, /authorized surfaces/i);

  for (const toolName of RUN_PLAN_RUNTIME_METADATA.requiredTools) {
    const fqn = blueprintRuntimeToolFqn(toolName as `blueprint_${string}`);
    assert.match(
      `${skillFile}\n${referenceFile}`,
      new RegExp(escapeRegExp(`\`${fqn}\``)),
      `run-plan skill bundle should reference ${toolName} through its runtime FQN`
    );
  }
});

test("run-plan runtime contract resource is owned by runtime metadata", async () => {
  const contract = await buildBlueprintCommandRuntimeContractResource("run-plan");

  assert.equal(contract.catalog.specPath, RUN_PLAN_RUNTIME_METADATA.sourceId);
  assert.equal(contract.spec.path, RUN_PLAN_RUNTIME_METADATA.sourceId);
  assert.equal(contract.runtimeReference.path, RUN_PLAN_RUNTIME_METADATA.sourceId);
  assert.equal(
    contract.runtimeReference.commandSpecPath,
    RUN_PLAN_RUNTIME_METADATA.sourceId
  );
  assert.equal(contract.spec.primarySkill, "blueprint-plan-run");
  assert.deepEqual(contract.spec.requiredTools, [...RUN_PLAN_RUNTIME_METADATA.requiredTools]);
  assert.deepEqual(contract.runtimeReference.exactMcpDestination, [
    ...RUN_PLAN_RUNTIME_METADATA.requiredTools
  ]);
  assert.deepEqual(contract.spec.optionalSubagents, []);
  assert.deepEqual(contract.runtimeReference.optionalAgents, []);
  assert.deepEqual(contract.skillInputs.shared, []);
  assert.deepEqual(contract.skillInputs.commandSpecific, [...RUN_PLAN_INPUTS]);
  assert.deepEqual(contract.skillInputs.effective, [...RUN_PLAN_INPUTS]);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /always call blueprint_plan_run_prepare with mode: "preview" first/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /block unauthorizedChangedFiles without calling blueprint_patch_record/i
  );
  assert.match(
    contract.runtimeReference.contractNotes ?? "",
    /call blueprint_plan_run_patch_record only for authorized implementation diffs/i
  );
});

test("generated command catalog exposes run-plan as a prepare-only chooser route", async () => {
  const generatedCatalog = JSON.parse(
    await readFile(path.join(repoRoot, "generated/command-catalog.json"), "utf8")
  ) as {
    intentChooser: Array<{ intent: string; routes: string[] }>;
    commands: Array<{
      name: string;
      wave: number;
      implemented: boolean;
      status: string;
      primarySkill: string;
      requiredTools: string[];
    }>;
  };
  const entry = generatedCatalog.commands.find((command) => command.name === "run-plan");
  const executeChooser = generatedCatalog.intentChooser.find(
    (chooser) => chooser.intent === "Execute safely"
  );

  assert.ok(entry);
  assert.equal(entry.implemented, true);
  assert.equal(entry.status, "implemented");
  assert.equal(entry.wave, 5);
  assert.equal(entry.primarySkill, "blueprint-plan-run");
  assert.deepEqual(entry.requiredTools, [...RUN_PLAN_RUNTIME_METADATA.requiredTools]);
  assert.ok(executeChooser);
  assert.equal(executeChooser.routes.includes("/blu-run-plan <phase> <planId>"), false);

  const prepareChooser = generatedCatalog.intentChooser.find(
    (chooser) => chooser.intent === "Prepare isolated plan run"
  );

  assert.ok(prepareChooser);
  assert.deepEqual(prepareChooser.routes, ["/blu-run-plan <phase> <planId>"]);
});

test("repo-facing status docs include run-plan in the Wave 5 shipped surface", async () => {
  const [architecture, handoff, implementationOrder, geminiGuide] =
    await Promise.all([
      readFile(path.join(repoRoot, "docs/ARCHITECTURE.md"), "utf8"),
      readFile(path.join(repoRoot, "docs/HANDOFF.md"), "utf8"),
      readFile(path.join(repoRoot, "docs/IMPLEMENTATION-ORDER.md"), "utf8"),
      readFile(path.join(repoRoot, "GEMINI.md"), "utf8")
    ]);

  assert.match(architecture, /Wave 5 plan-run harness command, `run-plan`/);
  assert.match(handoff, /Wave 5 plan-run harness command `run-plan`/);
  assert.match(
    implementationOrder,
    /### Wave 5: Plan run, workspace, and maintenance[\s\S]*- `run-plan`[\s\S]*Shipped in this wave: `run-plan`/
  );
  assert.match(geminiGuide, /Plan run harness:\n`\/blu-run-plan`/);
});
