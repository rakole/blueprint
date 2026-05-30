import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { readArtifactContract } from "../src/mcp/artifact-contracts/index.js";
import { buildBlueprintCommandRuntimeContractResource } from "../src/mcp/command-resources.js";

const root = process.cwd();
const read = (filePath: string) => readFileSync(join(root, filePath), "utf8");

test("Blueprint runtime keeps phase context under .blueprint instead of repo-root CONTEXT.md", () => {
  const projectToolSource = read("src/mcp/tools/project.ts");
  const mapManifest = read("commands/blu-map-codebase.toml");
  const newProjectManifest = read("commands/blu-new-project.toml");
  const contextContract = readArtifactContract("phase.context");

  for (const content of [projectToolSource, mapManifest, newProjectManifest]) {
    assert.match(content, /(repo-root|repository-root)[\s\S]*CONTEXT\.md/);
  }

  assert.equal(
    contextContract.canonicalFilePattern,
    ".blueprint/phases/<phase-slug>/XX-CONTEXT.md"
  );
  assert.match(contextContract.notes.join("\n"), /phase-scoped and MCP-owned/i);
  assert.equal(contextContract.requiredHeadings.includes("Canonical References"), true);
});

test("phase context ownership stays discuss-led and runtime-contract scoped", async () => {
  const [discussContract, researchContract, planContract] = await Promise.all([
    buildBlueprintCommandRuntimeContractResource("discuss-phase"),
    buildBlueprintCommandRuntimeContractResource("research-phase"),
    buildBlueprintCommandRuntimeContractResource("plan-phase")
  ]);
  const files = [
    "commands/blu-discuss-phase.toml",
    "commands/blu-research-phase.toml",
    "commands/blu-plan-phase.toml",
    "skills/blueprint-phase-discovery/SKILL.md",
    "skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md",
    "skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md",
    "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md"
  ] as const;

  for (const file of files) {
    const content = read(file);
    assert.match(content, /\/blu-discuss-phase|XX-CONTEXT\.md/);
  }

  assert.match(read("commands/blu-research-phase.toml"), /Treat phase context as read-only/);
  assert.match(read("commands/blu-plan-phase.toml"), /Treat phase context as read-only/);
  assert.deepEqual(discussContract.skillInputs.shared, []);
  assert.equal(
    discussContract.skillInputs.effective.some((input) => input.startsWith("docs/")),
    false
  );
  assert.deepEqual(researchContract.skillInputs.commandSpecific, [
    "skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md"
  ]);
  assert.deepEqual(planContract.skillInputs.commandSpecific, [
    "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md"
  ]);
});

test("discovery and planning repair loops stop on repeated identical diagnostics", () => {
  const files = [
    "commands/blu-discuss-phase.toml",
    "commands/blu-research-phase.toml",
    "commands/blu-plan-phase.toml",
    "skills/blueprint-phase-discovery/SKILL.md",
    "skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md",
    "skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md",
    "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md"
  ] as const;

  for (const file of files) {
    const content = read(file);
    assert.match(content, /identical diagnostics|same diagnostics repeat/);
    assert.match(content, /do not inspect MCP source/i);
  }
});
