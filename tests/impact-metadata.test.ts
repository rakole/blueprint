import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildBlueprintCommandRuntimeContractResource,
  listBlueprintCommandRuntimeContractCommands
} from "../src/mcp/command-resources.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();
const IMPACT_TOOL_NAMES = [
  "blueprint_impact_config_get",
  "blueprint_impact_scope_resolve",
  "blueprint_impact_context_load",
  "blueprint_impact_analyze",
  "blueprint_impact_report_write",
  "blueprint_impact_output_render"
] as const;

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function stripRuntimeToolFqns(markdown: string): string {
  return markdown.replace(/`mcp_blueprint_blueprint_[a-z0-9_]+`/g, "`<runtime-tool>`");
}

test("impact manifest is thin, runtime-FQN based, and preserves advisory safety gates", async () => {
  const commandFile = await readRepoFile("commands/blu-impact.toml");

  assert.match(commandFile, /Use the `blueprint-impact` skill/);
  assert.match(commandFile, /impact-runtime-contract\.md/);
  assert.match(commandFile, /Execution profile:[\s\S]*`long-running-mutation`/);
  assert.match(commandFile, /Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route/);
  assert.match(
    commandFile,
    /resolved scope, active stage, pending gate, execution mode, and next safe action/i
  );
  assert.match(commandFile, /impact-report-overwrite-confirmation/);
  assert.match(commandFile, /Treat `BLOCK` as an advisory impact status/);
  assert.match(commandFile, /Do not invent deterministic findings outside the MCP result/);
  assert.match(commandFile, /Route only to implemented commands/);
  assert.match(commandFile, /Never mutate source files, roadmap state, phase state, command-catalog state, PR state, deployment state, or the installed extension directory/);

  for (const toolName of IMPACT_TOOL_NAMES) {
    assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn(toolName)));
  }

  assert.doesNotMatch(
    stripRuntimeToolFqns(commandFile),
    /`blueprint_[a-z0-9_]+`/,
    "impact manifest should use runtime FQNs instead of raw internal tool ids"
  );
  assert.doesNotMatch(commandFile, /skills\/blueprint-impact\.md|agents\/blueprint-impact\.md/);
});

test("impact skill and local runtime contract encode uncertainty and no-subagent rules", async () => {
  const [skillFile, runtimeContract] = await Promise.all([
    readRepoFile("skills/blueprint-impact/SKILL.md"),
    readRepoFile("skills/blueprint-impact/references/impact-runtime-contract.md")
  ]);

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-impact/);
  assert.match(skillFile, /references\/impact-runtime-contract\.md/);
  assert.match(skillFile, /mcp_blueprint_blueprint_project_status/);
  assert.match(skillFile, /Translate any shorthand tool ids like `blueprint_project_status`/);
  assert.match(skillFile, /Treat Blueprint skills as loaded guidance, not callable tools\./);
  assert.match(skillFile, /Never run `\/blu-\*` in the shell\./);
  assert.match(skillFile, /## Required MCP Tools/);
  assert.match(skillFile, /## Optional Agents[\s\S]*none/);
  assert.match(skillFile, /Description-only runs are allowed, but they stay low confidence/);
  assert.match(skillFile, /Missing metadata is surfaced as unknown or warning, not as safety/);
  assert.match(skillFile, /Do not use subagents for V1 impact analysis/);
  assert.match(skillFile, /## Self-Check/);

  for (const heading of [
    "## Stage Mapping",
    "## Required MCP Calls",
    "## Scope Rules",
    "## Report Quality Rules",
    "## No-Subagent Contract",
    "## Retry And Repair Behavior",
    "## Output Quality Criteria",
    "## Completion Criteria"
  ]) {
    assert.match(runtimeContract, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const toolName of IMPACT_TOOL_NAMES) {
    assert.match(runtimeContract, new RegExp(blueprintRuntimeToolFqn(toolName)));
  }

  assert.match(runtimeContract, /Missing ownership, reverse dependency, compliance, test, or optional context/);
  assert.match(runtimeContract, /High risk with low confidence is valid/);
  assert.match(runtimeContract, /V1 has no optional subagent path/);
  assert.match(runtimeContract, /Existing changed report bundle: ask for overwrite confirmation/);
});

test("impact docs, catalog, MCP docs, and artifact contract agree on implemented status", async () => {
  const [
    catalog,
    commandDoc,
    skillsAndAgents,
    mcpTools,
    runtimeReference,
    artifactSchema,
    artifactContracts,
    readme,
    progress,
    memory
  ] = await Promise.all([
    readRepoFile("docs/COMMAND-CATALOG.md"),
    readRepoFile("docs/commands/impact.md"),
    readRepoFile("docs/SKILLS-AND-AGENTS.md"),
    readRepoFile("docs/MCP-TOOLS.md"),
    readRepoFile("docs/RUNTIME-REFERENCE.md"),
    readRepoFile("docs/ARTIFACT-SCHEMA.md"),
    readRepoFile("src/mcp/artifact-contracts/index.ts"),
    readRepoFile("README.md"),
    readRepoFile("PROGRESS.md"),
    readRepoFile("MEMORY.md")
  ]);

  assert.match(
    catalog,
    /\| `impact` \| 4 \| `Quality And Shipping` \| `blueprint-impact` \| `implemented` \|/
  );
  assert.match(commandDoc, /impact-runtime-contract\.md/);
  assert.match(commandDoc, /Live catalog marks `impact` as `implemented`/);
  assert.match(
    skillsAndAgents,
    /\| `blueprint-impact` \| `implemented` \| Advisory blast-radius analysis and impact report orchestration \| `impact` \|/
  );
  assert.doesNotMatch(skillsAndAgents, /\| `blueprint-impact` \| `planned` \|/);
  assert.match(mcpTools, /implemented additive `\/blu-impact` command/);
  assert.match(mcpTools, /skills\/blueprint-impact\/references\/impact-runtime-contract\.md/);
  assert.match(
    runtimeReference,
    /\| `impact` \| `docs\/commands\/impact\.md` \| `blueprint-impact` \| `blueprint_impact_config_get`<br>`blueprint_impact_scope_resolve`<br>`blueprint_impact_context_load`<br>`blueprint_impact_analyze`<br>`blueprint_impact_report_write`<br>`blueprint_impact_output_render` \| none \|/
  );
  assert.match(runtimeReference, /impact-runtime-contract\.md/);
  assert.match(runtimeReference, /`behavior-audited`: final hardening/);
  assert.match(
    runtimeReference,
    /\| `impact` \|[\s\S]*\| `locked`; `docs-aligned`; `behavior-audited` \|/
  );
  assert.match(artifactSchema, /durable blast-radius report bundle for implemented `\/blu-impact`/);
  assert.match(artifactContracts, /\/blu-impact is implemented as an advisory command/);
  assert.match(readme, /\/blu-impact`: compute an evidence-backed blast-radius report/);
  assert.doesNotMatch(readme, /## Commands Not Public Yet[\s\S]*\/blu-impact/);
  assert.match(progress, /\| 42 \| `impact` \| ✅ \| `implemented` \| 4 \| `Quality And Shipping` \| Low \|/);
  assert.match(memory, /`impact`[\s\S]*are implemented/);
});

test("impact runtime-contract resource is exposed from implemented catalog truth", async () => {
  const advertisedCommands = await listBlueprintCommandRuntimeContractCommands();
  const contract = await buildBlueprintCommandRuntimeContractResource("impact");

  assert.ok(advertisedCommands.includes("impact"));
  assert.equal(contract.command, "impact");
  assert.equal(contract.catalog.status, "implemented");
  assert.equal(contract.catalog.implemented, true);
  assert.equal(contract.catalog.requiredToolsSatisfied, true);
  assert.deepEqual(contract.catalog.blockedBy, []);
  assert.equal(contract.catalog.manifestPath, "commands/blu-impact.toml");
  assert.equal(contract.catalog.skillPath, "skills/blueprint-impact/SKILL.md");
  assert.equal(contract.spec.path, "docs/commands/impact.md");
  assert.equal(contract.spec.primarySkill, "blueprint-impact");
  assert.deepEqual(contract.runtimeReference.evidenceState, [
    "locked",
    "docs-aligned",
    "behavior-audited"
  ]);
  assert.deepEqual(contract.spec.requiredTools, [...IMPACT_TOOL_NAMES]);
  assert.deepEqual(contract.runtimeReference.exactMcpDestination, [...IMPACT_TOOL_NAMES]);
  assert.deepEqual(contract.runtimeReference.optionalAgents, []);
  assert.deepEqual(contract.skillInputs.effective, [
    "docs/commands/impact.md",
    "docs/COMMAND-CATALOG.md",
    "docs/SKILLS-AND-AGENTS.md",
    "docs/ARTIFACT-SCHEMA.md",
    "docs/MCP-TOOLS.md",
    "docs/RUNTIME-REFERENCE.md",
    "skills/blueprint-impact/references/impact-runtime-contract.md"
  ]);
});
