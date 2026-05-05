import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("Blueprint docs reject repo-root CONTEXT.md as managed state", () => {
  const schema = read("docs/ARTIFACT-SCHEMA.md");
  const mcpTools = read("docs/MCP-TOOLS.md");
  const mapManifest = read("commands/blu-map-codebase.toml");
  const newProjectManifest = read("commands/blu-new-project.toml");

  for (const content of [schema, mcpTools, mapManifest, newProjectManifest]) {
    assert.match(content, /(repo-root|repository-root) `CONTEXT\.md`/);
  }

  assert.match(schema, /\.blueprint\/codebase\/\*\.md/);
  assert.match(schema, /\.blueprint\/phases\/<phase>\/<XX>-CONTEXT\.md/);
});

test("phase context ownership is discuss-only across docs, manifests, and skills", () => {
  const files = [
    "docs/MCP-TOOLS.md",
    "docs/commands/discuss-phase.md",
    "docs/commands/research-phase.md",
    "docs/commands/plan-phase.md",
    "commands/blu-discuss-phase.toml",
    "commands/blu-research-phase.toml",
    "commands/blu-plan-phase.toml",
    "skills/blueprint-phase-discovery/SKILL.md",
    "skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md",
    "skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md",
    "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md",
  ];

  for (const file of files) {
    const content = read(file);
    assert.match(content, /\/blu-discuss-phase/);
    assert.match(content, /XX-CONTEXT\.md/);
  }

  assert.match(read("docs/MCP-TOOLS.md"), /must not repair, overwrite, or synthesize context/);
  assert.match(read("commands/blu-research-phase.toml"), /Treat phase context as read-only/);
  assert.match(read("commands/blu-plan-phase.toml"), /Treat phase context as read-only/);
});

test("validation repair loops stop on repeated identical diagnostics", () => {
  const files = [
    "docs/MCP-TOOLS.md",
    "docs/commands/discuss-phase.md",
    "docs/commands/research-phase.md",
    "docs/commands/plan-phase.md",
    "commands/blu-discuss-phase.toml",
    "commands/blu-research-phase.toml",
    "commands/blu-plan-phase.toml",
    "skills/blueprint-phase-discovery/SKILL.md",
    "skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md",
    "skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md",
    "skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md",
  ];

  for (const file of files) {
    const content = read(file);
    assert.match(content, /identical diagnostics|same diagnostics repeat/);
    assert.match(content, /do not inspect MCP source/i);
  }
});
