import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("control-plane docs describe the shipped Wave 0 runtime instead of a docs-only state", async () => {
  const [agents, readme, gemini, handoff, memory, roadmap, state, drift] =
    await Promise.all([
      readRepoFile("AGENTS.md"),
      readRepoFile("README.md"),
      readRepoFile("GEMINI.md"),
      readRepoFile("docs/HANDOFF.md"),
      readRepoFile("MEMORY.md"),
      readRepoFile(".planning/ROADMAP.md"),
      readRepoFile(".planning/STATE.md"),
      readRepoFile("docs/DRIFT.MD")
    ]);

  assert.doesNotMatch(agents, /No Gemini extension runtime has been implemented yet/);
  assert.doesNotMatch(handoff, /No runtime code or Gemini extension scaffolding has been created yet/);
  assert.match(agents, /Phase 2\.1 drift-repair checkpoint/);
  assert.match(readme, /Wave 0 shipped commands/);
  assert.match(gemini, /\/blu:map-codebase/);
  assert.match(memory, /runtime-aware/);
  assert.match(roadmap, /Phase 2\.1: Drift Recovery Gate/);
  assert.match(state, /Phase: 02\.1/);
  assert.match(drift, /map-codebase/);
});

test("drift-repair docs capture the status vocabulary and the restored map-codebase scope", async () => {
  const [catalog, artifactSchema, drift] = await Promise.all([
    readRepoFile("docs/COMMAND-CATALOG.md"),
    readRepoFile("docs/ARTIFACT-SCHEMA.md"),
    readRepoFile("docs/DRIFT.MD")
  ]);

  assert.match(catalog, /\| Command \| Wave \| Family \| Primary Skill \| Status \| Key Writes \| Risk \|/);
  assert.match(catalog, /`map-codebase` \| 0 \| `Foundation` \| `blueprint-map` \| `implemented`/);
  assert.match(catalog, /STRUCTURE\.md/);
  assert.match(artifactSchema, /`STRUCTURE\.md`/);
  assert.match(drift, /`implemented`: manifest, primary skill, and required MCP tools are all present/);
});
