import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();

function headingSection(markdown: string, heading: string): string {
  const marker = `## ${heading}`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `Missing section: ${marker}`);
  const next = markdown.indexOf("\n## ", start + marker.length);
  return markdown.slice(start, next === -1 ? undefined : next);
}

function subheadingSection(markdown: string, heading: string): string {
  const marker = `#### ${heading}`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `Missing section: ${marker}`);
  const next = markdown.indexOf("\n#### ", start + marker.length);
  return markdown.slice(start, next === -1 ? undefined : next);
}

test("verify-work manifest stays thin while advertising tool-owned writes and routing surfaces", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-verify-work.toml"), "utf8");

  assert.match(commandFile, /Use the `blueprint-phase-validation` skill/);
  assert.match(commandFile, /`blueprint-verifier` subagent/);
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
  const [skillFile, runtimeReference, runtimeContract] = await Promise.all([
    readFile(path.join(repoRoot, "skills/blueprint-phase-validation/SKILL.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8"),
    readFile(
      path.join(
        repoRoot,
        "skills/blueprint-phase-validation/references/verify-work-runtime-contract.md"
      ),
      "utf8"
    )
  ]);
  const requiredInputs = headingSection(skillFile, "Required Inputs");
  const verifyInputs = subheadingSection(requiredInputs, "`verify-work`");

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
  assert.match(requiredInputs, /### Shared validation inputs/);
  assert.match(requiredInputs, /### Command-specific inputs/);
  assert.match(verifyInputs, /verify-work-runtime-contract\.md/);
  assert.match(verifyInputs, /docs\/commands\/verify-work\.md/);
  assert.doesNotMatch(verifyInputs, /add-tests-runtime-contract|validate-phase-runtime-contract/);
  assert.match(runtimeContract, /Build a concrete UAT queue before asking the user anything/i);
  assert.match(runtimeContract, /Present one test at a time/i);
  assert.match(runtimeContract, /use `ask_user` for the first-pass result on each test/i);
  assert.match(runtimeContract, /structured `modelContract` authority/);
  assert.match(runtimeContract, /phase\.uat\.modelContract/);
  assert.match(runtimeContract, /blueprint_phase_validation_validate_model/);
  assert.match(runtimeContract, /status: "valid"/i);
  assert.match(
    runtimeReference,
    /`verify-work`[\s\S]*Long-running-mutation profile; keep Resolve\/Read\/Decide\/Execute\/Persist\/Validate\/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible/i
  );
  assert.match(runtimeReference, /verify-work-runtime-contract\.md/i);
  assert.match(runtimeReference, /concrete user-observable UAT test queue/i);
  assert.match(runtimeReference, /pass\/skipped\/blocked\/issue/i);
  assert.match(runtimeReference, /read the `phase\.uat` model contract/i);
  assert.match(runtimeReference, /authoringMode: "model-only"/i);
});

test("verify-work docs and supporting contracts keep roadmap-sync risk and resumable UAT behavior explicit", async () => {
  const [commandDoc, schemaDoc, agentFile] = await Promise.all([
    readFile(path.join(repoRoot, "docs/commands/verify-work.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/ARTIFACT-SCHEMA.md"), "utf8"),
    readFile(path.join(repoRoot, "agents/blueprint-verifier.md"), "utf8")
  ]);

  assert.match(
    commandDoc,
    /updates `?\.blueprint\/ROADMAP\.md`? when valid execution, verification, and UAT evidence make completion durable/i
  );
  assert.match(commandDoc, /## Shell Risk Profile[\s\S]*Medium: writes UAT evidence, can sync `\.blueprint\/ROADMAP\.md` completion state, and updates follow-up state\./i);
  assert.match(commandDoc, /validate the final structured UAT payload through `blueprint_phase_validation_validate_model`/i);
  assert.match(commandDoc, /modelContract` JSON Schema, quality rules, context bindings, rendered headings, and example leakage signals/i);
  assert.match(commandDoc, /phase\.uat\.modelContract/i);
  assert.match(commandDoc, /validates the written artifact before updating state/i);
  assert.match(commandDoc, /next safe action stays on `\/blu-verify-work <phase>`/i);
  assert.match(commandDoc, /Use Gemini CLI `ask_user` for each user-observable UAT prompt/i);
  assert.match(schemaDoc, /`\*\*Resume State:\*\* RESUMED\|NEW\|CONTINUED`/);
  assert.match(schemaDoc, /`\*\*Checkpoint:\*\* <current checkpoint label or none>`/);
  assert.match(schemaDoc, /`## Session State`/);
  assert.match(schemaDoc, /`## Test Matrix`/);
  assert.match(schemaDoc, /`## Result Summary`/);
  assert.match(schemaDoc, /`## Structured Gaps`/);
  assert.match(schemaDoc, /should be normalized to the canonical `phase\.uat` authoring template before persistence/i);
  assert.match(schemaDoc, /should be validated after write so schema drift or heading drift is caught before the next state update/i);
  assert.match(agentFile, /phase\.uat` contract returned by `blueprint_artifact_contract_read`/);
  assert.match(agentFile, /only[\s\S]*heading and locked-marker authority for `XX-UAT\.md`/i);
  assert.match(
    agentFile,
    /prepare queue rows and pending-state scaffold content without inventing[\s\S]*observed behavior/i
  );
  assert.match(agentFile, /leave result counts and questions-asked sections for the parent to fill/i);
  assert.match(agentFile, /separate confirmation before persistence/i);
});
