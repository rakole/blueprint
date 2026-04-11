import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintArtifactScaffold } from "../src/mcp/tools/artifacts.js";

const repoRoot = process.cwd();

async function createPhaseRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-ui-phase-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(path.join(repoPath, ".blueprint/phases/03-phase-discovery"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Fixture

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 3: Phase Discovery**
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 3
- Active command: /blu:progress
- Next action: Run /blu:progress
- Last updated: 2026-04-11T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");

  return repoPath;
}

test("ui-phase command references registered tools and single-artifact UI handling", async () => {
  const commandFile = await readFile(path.join(repoRoot, "commands/blu/ui-phase.toml"), "utf8");
  const requiredTools = [
    "blueprint_phase_locate",
    "blueprint_phase_research_status",
    "blueprint_config_get",
    "blueprint_artifact_scaffold",
    "blueprint_state_update"
  ];

  for (const toolName of requiredTools) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
    assert.match(commandFile, new RegExp(toolName));
  }

  assert.match(commandFile, /workflow\.ui_phase/);
  assert.match(commandFile, /workflow\.ui_safety_gate/);
  assert.match(commandFile, /XX-UI-SPEC\.md/);
  assert.doesNotMatch(commandFile, /UI-SKIP/);
});

test("phase artifact scaffolding keeps UI output in a single reusable file", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const first = await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-UI-SPEC.md"]
  });
  const second = await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-UI-SPEC.md"]
  });
  const body = await readFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-UI-SPEC.md"),
    "utf8"
  );

  assert.deepEqual(first.createdFiles, [".blueprint/phases/03-phase-discovery/03-UI-SPEC.md"]);
  assert.deepEqual(second.reusedFiles, [".blueprint/phases/03-phase-discovery/03-UI-SPEC.md"]);
  assert.match(body, /Outcome Mode/);
  assert.match(body, /UI contract or explicit skip rationale/i);
});
