import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";

const repoRoot = process.cwd();

test("insert-phase manifest references roadmap insertion tools, confirmation gate, and discuss-phase routing", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu-insert-phase.toml"),
    "utf8"
  );

  assert.match(commandFile, /`blueprint-roadmap-admin` skill/);
  assert.match(commandFile, /insert-phase-runtime-contract\.md/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-roadmap-admin\.md/);
  assert.match(commandFile, /Execution profile: `interactive-read`/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_read/);
  assert.match(commandFile, /mcp_blueprint_blueprint_roadmap_insert_phase/);
  assert.match(commandFile, /mcp_blueprint_blueprint_artifact_scaffold/);
  assert.match(commandFile, /mcp_blueprint_blueprint_state_update/);
  assert.match(commandFile, /roadmapEvolutionNotes/);
  assert.match(commandFile, /confirmed integer phase number/);
  assert.match(commandFile, /confirmed durable IDs from `\.blueprint\/REQUIREMENTS\.md` in `requirementIds`/);
  assert.match(commandFile, /Do not accept `none yet`, placeholder text, blank values, or undeclared requirement mappings/);
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
  assert.match(skillFile, /insert-phase-runtime-contract\.md/);
  assert.match(skillFile, /blueprint_roadmap_insert_phase/);
  assert.match(skillFile, /confirmed durable `requirementIds` declared in `\.blueprint\/REQUIREMENTS\.md`/);
  assert.match(skillFile, /Reject `none yet`, placeholder text, blank values, or requirement IDs not declared in `\.blueprint\/REQUIREMENTS\.md`/);
  assert.match(skillFile, /reject decimal targets/i);
  assert.match(skillFile, /roadmap-driven/i);
  assert.match(skillFile, /conflicting decimal directory/i);
  assert.match(skillFile, /roadmapEvolutionNotes/);
  assert.match(skillFile, /ask_user/);
  assert.match(skillFile, /Execution profile for `\/blu-add-phase`, `\/blu-insert-phase`, `\/blu-remove-phase`, `\/blu-plan-milestone-gaps`, `\/blu-audit-milestone`, `\/blu-complete-milestone`, `\/blu-milestone-summary`, and `\/blu-new-milestone`: `interactive-read`/);
  assert.match(skillFile, /Do not use `update_topic`, `write_todos`, or tracker tools/i);
  assert.match(skillFile, /\$\{phaseDir\}\/\$\{phasePrefix\}-CONTEXT\.md/);
  assert.match(skillFile, /\/blu-discuss-phase <phase>/);
  assert.match(skillFile, /There is no insert-phase subagent path/);
  assert.match(skillFile, /phase\.context/);
});

test("insert-phase runtime contract locks stage mapping, fallback, repair, and completion behavior", async () => {
  const contract = await readFile(
    path.join(
      repoRoot,
      "skills/blueprint-roadmap-admin/references/insert-phase-runtime-contract.md"
    ),
    "utf8"
  );

  for (const heading of [
    "### Resolve",
    "### Read",
    "### Decide",
    "### Execute",
    "### Persist",
    "### Validate",
    "### Route"
  ]) {
    assert.match(contract, new RegExp(heading));
  }

  assert.match(contract, /mcp_blueprint_blueprint_roadmap_read/);
  assert.match(contract, /mcp_blueprint_blueprint_roadmap_insert_phase/);
  assert.match(contract, /mcp_blueprint_blueprint_artifact_scaffold/);
  assert.match(contract, /mcp_blueprint_blueprint_state_update/);
  assert.match(contract, /at least one confirmed durable requirement ID declared in\s*`\.blueprint\/REQUIREMENTS\.md`/);
  assert.match(contract, /Do not accept `none yet`, placeholder text, blank values, or IDs that are not\s*declared in `\.blueprint\/REQUIREMENTS\.md`/);
  assert.match(contract, /passed as `requirementIds`; `none yet` requirement mappings were\s*not accepted/);
  assert.match(contract, /phase-insert-confirmation/);
  assert.match(contract, /invalid-insertion-anchor/);
  assert.match(contract, /conflicting-decimal-directory/);
  assert.match(contract, /phase\.context/);
  assert.match(contract, /starter scaffold only/);
  assert.match(contract, /No-Subagent Fallback/);
  assert.match(contract, /Do not use `blueprint-roadmapper`, `blueprint-verifier`, browser, web-search-only,\s*shell-only, or generic agents as substitutes/);
  assert.match(contract, /Retry And Repair Behavior/);
  assert.match(contract, /State update failure/);
  assert.match(contract, /Output Quality Criteria/);
  assert.match(contract, /Completion Criteria/);
  assert.match(contract, /No public command surface, catalog status semantics, hook ownership,\s*installed-extension files, or `\.planning\/` runtime dependency changed/);
});

test("insert-phase runtime-owned metadata uses numeric after anchors and phasePrefix-backed scaffolding", async () => {
  const metadata = getRuntimeOwnedCommandMetadata("insert-phase");
  const contract = await buildBlueprintCommandRuntimeContractResource("insert-phase");

  assert.ok(metadata);
  assert.equal(contract.spec?.path, metadata.sourceId);
  assert.equal(contract.spec?.executionProfile, "interactive-read");
  assert.deepEqual(contract.spec?.requiredTools, [...metadata.requiredTools]);
  assert.deepEqual(contract.spec?.optionalSubagents, []);
  assert.match(contract.spec?.reads.join("\n") ?? "", /\.blueprint\/REQUIREMENTS\.md durable requirement ID declarations/);
  assert.match(contract.spec?.writes.join("\n") ?? "", /\.blueprint\/REQUIREMENTS\.md/);
  assert.equal(contract.runtimeReference?.path, metadata.sourceId);
  assert.equal(contract.runtimeReference?.commandSpecPath, metadata.sourceId);
  assert.match(
    contract.runtimeReference?.contractNotes ?? "",
    /insert-phase-runtime-contract\.md[\s\S]*confirmed integer anchor[\s\S]*durable requirementIds declared in \.blueprint\/REQUIREMENTS\.md[\s\S]*reject none yet[\s\S]*phasePrefix[\s\S]*roadmapEvolutionNotes/
  );
  assert.deepEqual(contract.skillInputs.effective, [
    "skills/blueprint-roadmap-admin/references/insert-phase-runtime-contract.md"
  ]);
  assert.equal(
    contract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
});

test("roadmap-admin agent contracts retain insert-phase output-quality expectations", async () => {
  const roadmapperAgent = await readFile(
    path.join(repoRoot, "agents/blueprint-roadmapper.md"),
    "utf8"
  );
  const verifierAgent = await readFile(
    path.join(repoRoot, "agents/blueprint-verifier.md"),
    "utf8"
  );

  assert.match(roadmapperAgent, /## Required Output Contract/);
  assert.match(roadmapperAgent, /dependency warnings/);
  assert.match(roadmapperAgent, /Do not rewrite `\.blueprint\/ROADMAP\.md`/);
  assert.match(verifierAgent, /## Required Output Contract/);
  assert.match(verifierAgent, /Separate findings by gap classification and tie each one to concrete evidence/);
});
