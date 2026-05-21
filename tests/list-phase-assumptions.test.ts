import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";
import { getRuntimeOwnedCommandMetadata } from "../src/mcp/command-runtime-metadata.js";
import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import {
  blueprintRuntimeToolFqn,
  resolveBlueprintSkillPath
} from "../src/mcp/runtime-vocabulary.js";

const repoRoot = process.cwd();
const commandCatalogDocPath = path.join(repoRoot, "docs/COMMAND-CATALOG.md");
const manifestPath = path.join(repoRoot, "commands/blu-list-phase-assumptions.toml");
const commandDocPath = path.join(repoRoot, "docs/commands/list-phase-assumptions.md");
const runtimeReferencePath = path.join(repoRoot, "docs/RUNTIME-REFERENCE.md");
const discoverableSkillPath = path.join(
  repoRoot,
  "skills/blueprint-phase-discovery/SKILL.md"
);
const assumptionsRuntimeContractPath = path.join(
  repoRoot,
  "skills/blueprint-phase-discovery/references/list-phase-assumptions-runtime-contract.md"
);

async function pathExists(relativePath: string): Promise<boolean> {
  try {
    await access(relativePath);
    return true;
  } catch {
    return false;
  }
}

test("list-phase-assumptions manifest references only registered read-oriented discovery tools", async () => {
  const raw = await readFile(manifestPath, "utf8");
  const expectedTools = [
    "blueprint_phase_locate",
    "blueprint_phase_context",
    "blueprint_roadmap_read",
    "blueprint_project_status",
    "blueprint_config_get"
  ] as const;

  for (const toolName of expectedTools) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
    assert.match(raw, new RegExp(blueprintRuntimeToolFqn(toolName)));
  }

  assert.doesNotMatch(
    raw,
    /blueprint_phase_artifact_write|blueprint_artifact_scaffold|blueprint_state_update|blueprint_config_set/
  );
});

test("list-phase-assumptions manifest preserves the read-only assumptions review contract", async () => {
  const [raw, skillFile] = await Promise.all([
    readFile(manifestPath, "utf8"),
    readFile(discoverableSkillPath, "utf8")
  ]);

  assert.match(raw, /Use the `blueprint-phase-discovery` skill/);
  assert.match(raw, /same-named Gemini CLI agent tool `blueprint-researcher`/);
  assert.match(raw, /bounded assumptions task packet/);
  assert.match(raw, /five areas/);
  assert.match(raw, /What do you think\?/);
  assert.match(raw, /Do not mutate files, config, roadmap entries, or phase artifacts/);
  assert.match(raw, /Do not guess a nearest replacement phase/);
  assert.match(raw, /Execution profile: `interactive-read`/);
  assert.match(raw, /name that waiting state plainly/i);
  assert.match(raw, /Do not use\s+`update_topic`, `write_todos`, or task tracker tools for `\/blu-list-phase-assumptions`\./);
  assert.match(raw, /Do not turn `\/blu-list-phase-assumptions` into a long-running progress flow with stage narration, visible todos, or tracker-backed branching\./);
  assert.match(raw, /do not present planned or blocked commands as runnable/i);
  assert.doesNotMatch(raw, /skills\/blueprint-phase-discovery\.md|agents\/blueprint-researcher\.md/);

  assert.match(skillFile, /Execution profile for `\/blu-list-phase-assumptions`: `interactive-read`\./);
  assert.match(skillFile, /Do not use `update_topic`, `write_todos`, or task tracker tools for `\/blu-list-phase-assumptions`/);
  assert.match(skillFile, /Treat `\/blu-list-phase-assumptions` as an `interactive-read` summary/i);
  assert.match(skillFile, /name the waiting state plainly/i);
  assert.match(skillFile, /next safe implemented follow-up/i);
  const contract = await buildBlueprintCommandRuntimeContractResource("list-phase-assumptions");
  const metadata = getRuntimeOwnedCommandMetadata("list-phase-assumptions");

  assert.ok(metadata);
  assert.equal(contract.catalog.specPath, metadata.sourceId);
  assert.equal(contract.spec?.path, metadata.sourceId);
  assert.equal(contract.runtimeReference?.path, metadata.sourceId);
  assert.equal(contract.runtimeReference?.commandSpecPath, metadata.sourceId);
  assert.deepEqual(contract.runtimeReference?.exactMcpDestination, [
    ...metadata.requiredTools
  ]);
  assert.deepEqual(contract.skillInputs.shared, []);
  assert.deepEqual(contract.skillInputs.commandSpecific, [
    "skills/blueprint-phase-discovery/references/list-phase-assumptions-runtime-contract.md"
  ]);
  assert.deepEqual(contract.skillInputs.effective, [
    "skills/blueprint-phase-discovery/references/list-phase-assumptions-runtime-contract.md"
  ]);
  assert.equal(contract.skillInputs.effective.some((input) => input.startsWith("docs/")), false);
  assert.equal(
    contract.skillInputs.effective.includes("docs/commands/discuss-phase.md"),
    false
  );
  assert.equal(
    contract.skillInputs.effective.includes("docs/commands/research-phase.md"),
    false
  );
  assert.equal(contract.skillInputs.effective.includes("docs/commands/ui-phase.md"), false);
});

test("list-phase-assumptions runtime contract preserves the locked five assumption areas", async () => {
  const contract = await readFile(assumptionsRuntimeContractPath, "utf8");
  const areaMatches = [
    ...contract.matchAll(/^- ([A-Za-z ]+):/gm)
  ].map((match) => match[1]);

  assert.deepEqual(areaMatches, [
    "Technical approach",
    "Implementation order",
    "Scope boundaries",
    "Risk areas",
    "Dependencies"
  ]);
});

test("list-phase-assumptions runtime contract includes effective config for optional agent policy", async () => {
  const contract = await readFile(assumptionsRuntimeContractPath, "utf8");

  assert.match(contract, /`blueprint_config_get`/);
  assert.match(contract, /scope: "effective"/);
  assert.match(contract, /optional researcher/i);
});

test("list-phase-assumptions remains implemented in the live command catalog", async () => {
  const [catalogDoc, catalog, manifestExists, commandDocExists, skillExists, skillResolution] =
    await Promise.all([
    readFile(commandCatalogDocPath, "utf8"),
    blueprintCommandCatalog(),
    pathExists("commands/blu-list-phase-assumptions.toml"),
    pathExists("docs/commands/list-phase-assumptions.md"),
    pathExists("skills/blueprint-phase-discovery/SKILL.md"),
    resolveBlueprintSkillPath("blueprint-phase-discovery", pathExists)
  ]);
  const entry = catalog.commands["list-phase-assumptions"];

  assert.equal(manifestExists, true);
  assert.equal(commandDocExists, true);
  assert.equal(skillExists, true);
  assert.match(
    catalogDoc,
    /\| `list-phase-assumptions` \| 2 \| `Roadmap And Milestone` \| `blueprint-phase-discovery` \| `implemented` \| `none` \| `Low: read-only analysis\.` \|/
  );
  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.manifestPath, "commands/blu-list-phase-assumptions.toml");
  assert.equal(skillResolution.resolution, "discoverable");
  assert.equal(entry.skillPath, skillResolution.canonicalPath);
  assert.equal(
    entry.specPath,
    "src/mcp/command-runtime-metadata.ts#list-phase-assumptions"
  );
  assert.deepEqual(entry.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_phase_context",
    "blueprint_roadmap_read",
    "blueprint_project_status",
    "blueprint_config_get"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-researcher"]);
  assert.deepEqual(entry.blockedBy, []);
});

test("list-phase-assumptions runtime metadata keeps effective config in the read contract", () => {
  const metadata = getRuntimeOwnedCommandMetadata("list-phase-assumptions");

  assert.ok(metadata);
  assert.match(metadata.spec.reads.join("\n"), /effective config/i);
  assert.match(metadata.runtimeReference.contractNotes, /blueprint_config_get/);
  assert.match(metadata.runtimeReference.contractNotes, /scope: "effective"/);
});

test("list-phase-assumptions docs and runtime reference align to the interactive-read discovery contract", async () => {
  const [commandDoc, runtimeReference] = await Promise.all([
    readFile(commandDocPath, "utf8"),
    readFile(runtimeReferencePath, "utf8")
  ]);

  assert.match(commandDoc, /\| Execution profile \| `interactive-read` \|/);
  assert.match(commandDoc, /## Shared Runtime Contract/);
  assert.match(commandDoc, /shared interactive-read classification/i);
  assert.match(commandDoc, /waiting state plainly/i);
  assert.match(commandDoc, /In-flight posture: none beyond an inline read-only summary/i);
  assert.match(commandDoc, /No durable artifact writes are planned\./);
  assert.equal(await pathExists(path.relative(repoRoot, discoverableSkillPath)), true);
  assert.match(
    runtimeReference,
    /`list-phase-assumptions`[\s\S]*Interactive-read profile for read-only pre-planning synthesis[\s\S]*waiting state[\s\S]*next safe implemented follow-up/i
  );
});
