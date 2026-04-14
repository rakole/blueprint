import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintRuntimeToolFqn } from "../src/mcp/runtime-vocabulary.js";
import {
  blueprintPhaseArtifactRead,
  blueprintPhaseArtifactWrite,
  blueprintPhaseResearchStatus
} from "../src/mcp/tools/phase.js";

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
- Active command: /blu-progress
- Next action: Run /blu-progress
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
  const commandFile = await readFile(path.join(repoRoot, "commands/blu-ui-phase.toml"), "utf8");
  const requiredTools = [
    "blueprint_phase_locate",
    "blueprint_phase_research_status",
    "blueprint_config_get",
    "blueprint_phase_artifact_read",
    "blueprint_phase_artifact_write",
    "blueprint_artifact_scaffold",
    "blueprint_state_update"
  ] as const;

  for (const toolName of requiredTools) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
    assert.match(commandFile, new RegExp(blueprintRuntimeToolFqn(toolName)));
  }

  assert.match(commandFile, /Use the `blueprint-phase-discovery` skill/);
  assert.match(commandFile, /`blueprint-ui-designer` subagent/);
  assert.match(commandFile, /`ask_user`/);
  assert.match(commandFile, /workflow\.ui_phase/);
  assert.match(commandFile, /workflow\.ui_safety_gate/);
  assert.match(commandFile, /XX-UI-SPEC\.md/);
  assert.doesNotMatch(commandFile, /UI-SKIP/);
  assert.doesNotMatch(commandFile, /skills\/blueprint-phase-discovery\.md|agents\/blueprint-ui-designer\.md/);
});

test("ui-phase keeps UI output in a single reusable file for either contract or skip rationale", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const first = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "ui-spec",
    content: `# Phase 03 UI Spec

## Outcome Mode
- UI contract

## Constraints
- Keep a single durable file for either outcome.
`
  });
  const second = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "03",
    artifact: "ui-spec",
    content: `# Phase 03 UI Spec

## Outcome Mode
- UI contract

## Constraints
- Keep a single durable file for either outcome.
`
  });
  const replaced = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "ui-spec",
    content: `# Phase 03 UI Spec

## Outcome Mode
- Explicit skip rationale

## Rationale
- No frontend surface changes are in scope for this phase.
`,
    overwrite: true
  });
  const status = await blueprintPhaseResearchStatus({ cwd: repoPath, phase: "3" });
  const body = await blueprintPhaseArtifactRead({
    cwd: repoPath,
    phase: "03",
    artifact: "ui-spec"
  });

  assert.equal(first.written, true);
  assert.equal(first.path, ".blueprint/phases/03-phase-discovery/03-UI-SPEC.md");
  assert.equal(second.written, false);
  assert.match(second.warnings.join("\n"), /content was unchanged/i);
  assert.equal(replaced.overwritten, true);
  assert.equal(status.hasUiSpec, true);
  assert.equal(body.found, true);
  assert.match(body.content ?? "", /Outcome Mode/);
  assert.match(body.content ?? "", /Explicit skip rationale/i);
});
