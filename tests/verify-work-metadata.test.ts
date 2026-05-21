import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";

const repoRoot = process.cwd();

function headingSection(markdown: string, heading: string): string {
  const marker = `## ${heading}`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `Missing section: ${marker}`);
  const next = markdown.indexOf("\n## ", start + marker.length);
  return markdown.slice(start, next === -1 ? undefined : next);
}

test("verify-work manifest stays thin while advertising tool-owned writes and routing surfaces", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-verify-work.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-phase-validation` skill/);
  assert.match(commandFile, /same-named Gemini CLI agent tool `blueprint-verifier`/);
  assert.match(commandFile, /bounded UAT-prep task packet/);
  assert.match(commandFile, /verify-work-runtime-contract\.md/);
  assert.match(commandFile, /Execution profile: `long-running-mutation`/);
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_locate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_summary_index")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_summary_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_validation_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_validation_authoring_context")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_validation_validate_model")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_validation_render")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_phase_validation_write")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_contract_read")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_config_get")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_artifact_validate")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_load")));
  assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn("blueprint_state_update")));
  assert.match(commandFile, /workflow\.verifier/);
  assert.match(commandFile, /workflow\.nyquist_validation/);
  assert.match(commandFile, /XX-UAT\.md/);
  assert.match(commandFile, /artifact: "uat"/);
  assert.match(commandFile, /\.blueprint\/ROADMAP\.md/);
  assert.match(commandFile, /completion evidence closes or reopens the phase/);
  assert.match(commandFile, /\.blueprint\/STATE\.md/);
  assert.match(commandFile, /ask_user/);
  assert.match(commandFile, /initial `view` \/ `resume` \/ `update` UAT choice/i);
  assert.match(commandFile, /per-test UAT feedback prompt/i);
  assert.match(commandFile, /Use `ask_user` for the initial view\/resume\/update choice, per-test UAT feedback/i);
  assert.match(commandFile, /next safe action on `\/blu-verify-work <phase>`/i);
  assert.match(commandFile, /modelContract` as the structured payload schema authority/);
  assert.doesNotMatch(commandFile, /Follow this flow exactly:/);
  assert.doesNotMatch(commandFile, /Build a concrete UAT test queue/i);
  assert.doesNotMatch(commandFile, /Present one expected behavior at a time/i);
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-validation\.md|agents\/blueprint-verifier\.md/);
});

test("verify-work skill scopes required inputs to the active command and keeps detailed UAT rules in the runtime contract", async () => {
  const [skillFile, runtimeContractFile] = await Promise.all([
    readFile(path.join(repoRoot, "skills/blueprint-phase-validation/SKILL.md"), "utf8"),
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-phase-validation/references/verify-work-runtime-contract.md"
      ),
      "utf8"
    )
  ]);
  const metadata = getRuntimeOwnedCommandMetadata("verify-work");
  const catalog = await blueprintCommandCatalog();
  const runtimeContract = await buildBlueprintCommandRuntimeContractResource("verify-work");
  const runtimeContractPath =
    "skills/blueprint-phase-validation/references/verify-work-runtime-contract.md";
  const requiredInputs = headingSection(skillFile, "Required Inputs");

  assert.ok(metadata);
  assert.equal(metadata.sourceId, "src/mcp/command-runtime-metadata.ts#verify-work");
  assert.deepEqual(metadata.requiredInputPaths, [runtimeContractPath]);
  assert.equal(catalog.commands["verify-work"].specPath, metadata.sourceId);
  assert.deepEqual(catalog.commands["verify-work"].requiredTools, [
    ...metadata.requiredTools
  ]);
  assert.equal(runtimeContract.catalog.specPath, metadata.sourceId);
  assert.equal(runtimeContract.spec?.path, metadata.sourceId);
  assert.equal(runtimeContract.runtimeReference?.path, metadata.sourceId);
  assert.equal(runtimeContract.runtimeReference?.commandSpecPath, metadata.sourceId);
  assert.deepEqual(runtimeContract.runtimeReference?.exactMcpDestination, [
    ...metadata.requiredTools
  ]);
  assert.deepEqual(runtimeContract.skillInputs, {
    skill: "blueprint-phase-validation",
    shared: [],
    commandSpecific: [runtimeContractPath],
    effective: [runtimeContractPath]
  });
  assert.equal(
    runtimeContract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
  assert.doesNotMatch(JSON.stringify(runtimeContract), /docs\//);
  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-verify-work/);
  assert.match(skillFile, /conversational UAT is resumable/i);
  assert.match(skillFile, /verify-work-runtime-contract\.md/);
  assert.match(skillFile, /blueprint-verifier/);
  assert.match(skillFile, /blueprint_phase_validation_write/);
  assert.match(skillFile, /blueprint_phase_validation_authoring_context/);
  assert.match(skillFile, /blueprint_phase_validation_validate_model/);
  assert.match(skillFile, /blueprint_phase_validation_render/);
  assert.match(skillFile, /blueprint_artifact_contract_read/);
  assert.match(skillFile, /workflow\.verifier/);
  assert.match(skillFile, /workflow\.nyquist_validation/);
  assert.match(skillFile, /blueprint_artifact_validate/);
  assert.match(skillFile, /ask_user/);
  assert.match(skillFile, /per-test UAT prompts/i);
  assert.match(skillFile, /using `ask_user` for the per-test result when the host supports interactive questioning/i);
  assert.match(skillFile, /next safe action on `\/blu-verify-work <phase>`/i);
  assert.match(skillFile, /follow-up-fix capture/i);
  assert.match(requiredInputs, /Runtime input resolution is structured and command-scoped/i);
  assert.match(requiredInputs, /input_bundles\.commands/);
  assert.match(requiredInputs, /shared validation bundle is intentionally empty/i);
  assert.match(requiredInputs, /active local runtime contract as the only skill-authored input bundle file/i);
  assert.match(requiredInputs, /command runtime metadata\/catalog/i);
  assert.match(requiredInputs, /blueprint:\/\/commands\/\{command\}\/runtime-contract/);
  assert.match(requiredInputs, /artifact contracts read through MCP/i);
  assert.doesNotMatch(requiredInputs, /docs\//);
  assert.doesNotMatch(requiredInputs, /add-tests-runtime-contract|validate-phase-runtime-contract/);
  assert.match(runtimeContractFile, /## Visible UAT Progress/);
  assert.match(
    runtimeContractFile,
    /resolve UAT phase[\s\S]*read UAT prerequisites[\s\S]*choose UAT path[\s\S]*run current UAT test[\s\S]*persist UAT checkpoint[\s\S]*reread and validate saved UAT[\s\S]*sync state and route/i
  );
  assert.match(
    runtimeContractFile,
    /Gemini-native progress helpers are presentation mirrors only[\s\S]*do not\s+expand the MCP tool allowlist, persistence authority, verifier authority,\s+UAT-result authority, checkpoint authority, state-sync authority, routing\s+authority, or user confirmation authority/i
  );
  assert.match(
    runtimeContractFile,
    /Emit exceptional updates for\s+missing summaries, missing or not-ready verification, malformed saved UAT,\s+view\/resume\/update waits/i
  );
  assert.match(runtimeContractFile, /Build a concrete UAT queue before asking the user anything/i);
  assert.match(runtimeContractFile, /Present one test at a time/i);
  assert.match(runtimeContractFile, /use `ask_user` for the first-pass result on each test/i);
  assert.match(runtimeContractFile, /structured `modelContract` authority/);
  assert.match(runtimeContractFile, /phase\.uat\.modelContract/);
  assert.match(runtimeContractFile, /Do not expect a public `contract\.authoringTemplate`/);
  assert.match(runtimeContractFile, /blueprint_phase_validation_validate_model/);
  assert.match(runtimeContractFile, /status: "valid"/i);
  assert.doesNotMatch(runtimeContractFile, /authoring-template, and structured `modelContract` authority/);
});

test("verify-work artifact and agent contracts keep resumable UAT behavior explicit", async () => {
  const [contractSource, agentFile] = await Promise.all([
    readFile(path.join(repoRoot, "src/mcp/artifact-contracts/index.ts"), "utf8"),
    readFile(path.join(repoRoot, "agents/blueprint-verifier.md"), "utf8")
  ]);

  assert.match(contractSource, /"phase\.uat": \{/);
  assert.match(contractSource, /PHASE_UAT_MODEL_CONTRACT/);
  assert.match(contractSource, /\*\*Resume State:\*\* RESUMED\|NEW\|CONTINUED/);
  assert.match(contractSource, /\*\*Checkpoint:\*\* <current checkpoint label or none>/);
  assert.match(contractSource, /"Session State"/);
  assert.match(contractSource, /"Test Matrix"/);
  assert.match(contractSource, /"Result Summary"/);
  assert.match(contractSource, /"Structured Gaps"/);
  assert.match(agentFile, /phase\.uat` contract returned by `blueprint_artifact_contract_read`/);
  assert.match(agentFile, /only[\s\S]*heading and locked-marker authority for `XX-UAT\.md`/i);
  assert.match(
    agentFile,
    /prepare queue rows and pending-state scaffold content without inventing[\s\S]*observed behavior/i
  );
  assert.match(agentFile, /leave result counts and questions-asked sections for the parent to fill/i);
  assert.match(agentFile, /separate confirmation before persistence/i);
});
