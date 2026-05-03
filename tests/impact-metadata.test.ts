import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  buildBlueprintCommandRuntimeContractResource,
  listBlueprintCommandRuntimeContractCommands
} from "../src/mcp/command-resources.js";
import {
  getRuntimeOwnedCommandMetadata,
  IMPACT_RUNTIME_METADATA
} from "../src/mcp/command-runtime-metadata.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import { resolveBlueprintSkillInputsFromContent } from "../src/mcp/skill-metadata.js";

const repoRoot = process.cwd();
const IMPACT_TOOL_NAMES = [
  "blueprint_impact_config_get",
  "blueprint_impact_scope_resolve",
  "blueprint_impact_context_load",
  "blueprint_impact_analyze",
  "blueprint_impact_report_write",
  "blueprint_impact_output_render"
] as const;
const IMPACT_SKILL_INPUTS = [
  "commands/blu-impact.toml",
  "skills/blueprint-impact/references/impact-runtime-contract.md"
] as const;

async function readRepoFile(relativePath: string): Promise<string> {
  return fs.readFile(path.join(repoRoot, relativePath), "utf8");
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

test("impact skill uses docs-free input bundles and local runtime contract rules", async () => {
  const [skillFile, runtimeContract] = await Promise.all([
    readRepoFile("skills/blueprint-impact/SKILL.md"),
    readRepoFile("skills/blueprint-impact/references/impact-runtime-contract.md")
  ]);
  const resolvedInputs = resolveBlueprintSkillInputsFromContent(
    "blueprint-impact",
    "/blu-impact",
    skillFile
  );

  assert.match(skillFile, /status: implemented/);
  assert.match(skillFile, /\/blu-impact/);
  assert.match(skillFile, /input_bundles:/);
  assert.match(skillFile, /shared: \[\]/);
  assert.match(skillFile, /commands\/blu-impact\.toml/);
  assert.match(skillFile, /references\/impact-runtime-contract\.md/);
  assert.match(
    skillFile,
    /Command-specific inputs come from the structured `input_bundles` frontmatter/
  );
  assert.match(skillFile, /Runtime use is docs-free/);
  assert.match(skillFile, /MCP tools, MCP resources, artifact\s+contracts, and live repo context provide the structured truth/);
  assert.doesNotMatch(skillFile, /## Required Inputs/);
  assert.doesNotMatch(skillFile, /- `docs\//);
  assert.deepEqual(resolvedInputs.shared, []);
  assert.deepEqual(resolvedInputs.commandSpecific, [...IMPACT_SKILL_INPUTS]);
  assert.deepEqual(resolvedInputs.effective, [...IMPACT_SKILL_INPUTS]);
  assert.equal(resolvedInputs.effective.some((input) => input.startsWith("docs/")), false);
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

test("impact runtime-owned metadata is canonical and docs are not runtime inputs", () => {
  const metadata = getRuntimeOwnedCommandMetadata("impact");

  assert.equal(metadata, IMPACT_RUNTIME_METADATA);
  assert.equal(IMPACT_RUNTIME_METADATA.sourceId, "src/mcp/command-runtime-metadata.ts#impact");
  assert.equal(IMPACT_RUNTIME_METADATA.spec.path, IMPACT_RUNTIME_METADATA.sourceId);
  assert.equal(
    IMPACT_RUNTIME_METADATA.runtimeReference.path,
    IMPACT_RUNTIME_METADATA.sourceId
  );
  assert.deepEqual(IMPACT_RUNTIME_METADATA.requiredInputPaths, [
    "skills/blueprint-impact/references/impact-runtime-contract.md"
  ]);
  assert.deepEqual(IMPACT_RUNTIME_METADATA.requiredTools, [...IMPACT_TOOL_NAMES]);
  assert.deepEqual(IMPACT_RUNTIME_METADATA.optionalAgents, []);
  assert.deepEqual(IMPACT_RUNTIME_METADATA.runtimeReference.evidenceState, [
    "locked",
    "runtime-owned",
    "behavior-audited"
  ]);
});

test("impact runtime-contract resource is exposed from implemented catalog truth", async () => {
  const advertisedCommands = await listBlueprintCommandRuntimeContractCommands();
  const contract = await buildBlueprintCommandRuntimeContractResource("impact");
  const contractJson = JSON.stringify(contract);

  assert.ok(advertisedCommands.includes("impact"));
  assert.equal(contract.command, "impact");
  assert.equal(contract.catalog.status, "implemented");
  assert.equal(contract.catalog.implemented, true);
  assert.equal(contract.catalog.requiredToolsSatisfied, true);
  assert.deepEqual(contract.catalog.blockedBy, []);
  assert.equal(contract.catalog.manifestPath, "commands/blu-impact.toml");
  assert.equal(contract.catalog.skillPath, "skills/blueprint-impact/SKILL.md");
  assert.equal(contract.catalog.specPath, IMPACT_RUNTIME_METADATA.sourceId);
  assert.equal(contract.spec.path, IMPACT_RUNTIME_METADATA.sourceId);
  assert.equal(contract.spec.primarySkill, IMPACT_RUNTIME_METADATA.catalog.primarySkill);
  assert.equal(contract.runtimeReference.path, IMPACT_RUNTIME_METADATA.sourceId);
  assert.equal(contract.runtimeReference.commandSpecPath, IMPACT_RUNTIME_METADATA.sourceId);
  assert.deepEqual(contract.runtimeReference.evidenceState, [
    "locked",
    "runtime-owned",
    "behavior-audited"
  ]);
  assert.deepEqual(contract.catalog.requiredTools, [...IMPACT_RUNTIME_METADATA.requiredTools]);
  assert.deepEqual(contract.spec.requiredTools, [...IMPACT_RUNTIME_METADATA.requiredTools]);
  assert.deepEqual(contract.runtimeReference.exactMcpDestination, [
    ...IMPACT_RUNTIME_METADATA.requiredTools
  ]);
  assert.deepEqual(contract.spec.optionalSubagents, []);
  assert.deepEqual(contract.runtimeReference.optionalAgents, []);
  assert.deepEqual(contract.skillInputs, {
    skill: "blueprint-impact",
    shared: [],
    commandSpecific: [...IMPACT_SKILL_INPUTS],
    effective: [...IMPACT_SKILL_INPUTS]
  });
  assert.equal(contract.skillInputs.effective.some((input) => input.startsWith("docs/")), false);
  assert.doesNotMatch(contractJson, /docs\/commands\/impact\.md/);
  assert.doesNotMatch(contractJson, /docs\/COMMAND-CATALOG\.md/);
  assert.doesNotMatch(contractJson, /docs\/RUNTIME-REFERENCE\.md/);
  assert.doesNotMatch(contractJson, /docs\/MCP-TOOLS\.md/);
  assert.doesNotMatch(contractJson, /docs\/ARTIFACT-SCHEMA\.md/);
  assert.doesNotMatch(contractJson, /docs\/SKILLS-AND-AGENTS\.md/);
});

test("impact remains implemented from runtime-owned metadata when docs are unavailable", async (t) => {
  const realReadFile = fs.readFile.bind(fs);

  t.mock.method(fs, "readFile", async (filePath, options) => {
    const normalizedPath =
      filePath instanceof URL ? filePath.pathname : path.resolve(String(filePath));

    if (
      normalizedPath.endsWith("/docs/COMMAND-CATALOG.md") ||
      normalizedPath.endsWith("/docs/RUNTIME-REFERENCE.md") ||
      normalizedPath.includes("/docs/commands/")
    ) {
      const error = new Error("simulated docs absence") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    }

    return realReadFile(
      filePath as Parameters<typeof fs.readFile>[0],
      options as Parameters<typeof fs.readFile>[1]
    );
  });

  const advertisedCommands = await listBlueprintCommandRuntimeContractCommands();
  const contract = await buildBlueprintCommandRuntimeContractResource("impact", {
    readRelativePath: async (relativePath) => {
      if (relativePath.startsWith("docs/")) {
        return null;
      }

      return readRepoFile(relativePath);
    }
  });
  const contractJson = JSON.stringify(contract);

  assert.ok(advertisedCommands.includes("impact"));
  assert.equal(contract.catalog.status, "implemented");
  assert.equal(contract.catalog.implemented, true);
  assert.equal(contract.catalog.specPath, IMPACT_RUNTIME_METADATA.sourceId);
  assert.equal(contract.spec.path, IMPACT_RUNTIME_METADATA.sourceId);
  assert.deepEqual(contract.skillInputs.effective, [
    ...IMPACT_SKILL_INPUTS
  ]);
  assert.equal(contract.skillInputs.effective.some((input) => input.startsWith("docs/")), false);
  assert.doesNotMatch(contractJson, /docs\/commands\/impact\.md/);
  assert.doesNotMatch(contractJson, /docs\/COMMAND-CATALOG\.md/);
  assert.doesNotMatch(contractJson, /docs\/RUNTIME-REFERENCE\.md/);
});
