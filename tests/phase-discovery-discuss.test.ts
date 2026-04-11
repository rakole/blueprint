import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import {
  blueprintArtifactScaffold,
  blueprintArtifactList
} from "../src/mcp/tools/artifacts.js";
import { blueprintPhaseContext } from "../src/mcp/tools/phase.js";

const repoRoot = process.cwd();

async function createPhaseRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-discuss-phase-"));
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

test("discuss-phase command references only registered phase-discovery tool names", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu/discuss-phase.toml"),
    "utf8"
  );
  const requiredTools = [
    "blueprint_phase_locate",
    "blueprint_phase_context",
    "blueprint_roadmap_read",
    "blueprint_artifact_list",
    "blueprint_artifact_scaffold",
    "blueprint_state_update"
  ];

  for (const toolName of requiredTools) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
    assert.match(commandFile, new RegExp(toolName));
  }

  assert.match(commandFile, /explicit overwrite confirmation/i);
  assert.match(commandFile, /\/blu:progress/);
});

test("phase artifact scaffolding creates and reuses discuss-phase artifacts deterministically", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const first = await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [
      ".blueprint/phases/03-phase-discovery/03-CONTEXT.md",
      ".blueprint/phases/03-phase-discovery/03-DISCUSSION-LOG.md"
    ]
  });
  const second = await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [
      ".blueprint/phases/03-phase-discovery/03-CONTEXT.md",
      ".blueprint/phases/03-phase-discovery/03-DISCUSSION-LOG.md"
    ]
  });
  const context = await blueprintPhaseContext({ cwd: repoPath, phase: "3" });
  const listed = await blueprintArtifactList({ cwd: repoPath });
  const contextBody = await readFile(
    path.join(repoPath, ".blueprint/phases/03-phase-discovery/03-CONTEXT.md"),
    "utf8"
  );

  assert.deepEqual(first.createdFiles.sort(), [
    ".blueprint/phases/03-phase-discovery/03-CONTEXT.md",
    ".blueprint/phases/03-phase-discovery/03-DISCUSSION-LOG.md"
  ]);
  assert.deepEqual(second.reusedFiles.sort(), [
    ".blueprint/phases/03-phase-discovery/03-CONTEXT.md",
    ".blueprint/phases/03-phase-discovery/03-DISCUSSION-LOG.md"
  ]);
  assert.equal(
    context.phase?.artifacts.discussionLog,
    ".blueprint/phases/03-phase-discovery/03-DISCUSSION-LOG.md"
  );
  assert.ok(
    listed.artifacts.phases.includes(".blueprint/phases/03-phase-discovery/03-CONTEXT.md")
  );
  assert.match(contextBody, /Phase 03: Phase Discovery - Context/);
});
