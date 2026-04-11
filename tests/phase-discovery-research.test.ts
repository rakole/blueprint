import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import {
  blueprintPhaseArtifactRead,
  blueprintPhaseArtifactWrite,
  blueprintPhaseResearchStatus
} from "../src/mcp/tools/phase.js";

const repoRoot = process.cwd();

async function createPhaseRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-research-phase-"));
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

test("research-phase command references only registered tool names and safe routing text", async () => {
  const commandFile = await readFile(
    path.join(repoRoot, "commands/blu/research-phase.toml"),
    "utf8"
  );
  const requiredTools = [
    "blueprint_phase_locate",
    "blueprint_phase_context",
    "blueprint_phase_research_status",
    "blueprint_phase_artifact_read",
    "blueprint_phase_artifact_write",
    "blueprint_artifact_scaffold",
    "blueprint_state_update"
  ];

  for (const toolName of requiredTools) {
    assert.ok(blueprintToolNames.includes(toolName), `${toolName} should be registered`);
    assert.match(commandFile, new RegExp(toolName));
  }

  assert.match(commandFile, /overwrite confirmation/i);
  assert.match(commandFile, /\/blu:progress/);
  assert.doesNotMatch(commandFile, /\/blu:plan-phase/);
});

test("phase research status reports substantive context, research, and UI-spec artifact permutations", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const empty = await blueprintPhaseResearchStatus({ cwd: repoPath, phase: "3" });

  await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "context",
    content: `# Phase 03 Context

## Decisions
- Research is required before planning because the implementation surface is still uncertain.
`
  });
  const contextOnly = await blueprintPhaseResearchStatus({ cwd: repoPath, phase: "03" });

  const researchWrite = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "03",
    artifact: "research",
    content: `# Phase 03 Research

## Findings
- Dedicated phase-artifact writes remove dependence on scaffold placeholders.

## Recommendations
- Preserve overwrite confirmation when replacing substantive research.
`
  });
  const withResearch = await blueprintPhaseResearchStatus({ cwd: repoPath, phase: "3" });

  await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "ui-spec",
    content: `# Phase 03 UI Spec

## Outcome Mode
- Skip rationale
`
  });
  const withUi = await blueprintPhaseResearchStatus({ cwd: repoPath, phase: "3" });
  const researchBody = await blueprintPhaseArtifactRead({
    cwd: repoPath,
    phase: "03",
    artifact: "research"
  });

  assert.equal(empty.hasContext, false);
  assert.equal(empty.hasResearch, false);
  assert.equal(empty.hasUiSpec, false);
  assert.equal(contextOnly.hasContext, true);
  assert.equal(contextOnly.hasResearch, false);
  assert.equal(contextOnly.hasUiSpec, false);
  assert.equal(researchWrite.written, true);
  assert.equal(withResearch.hasResearch, true);
  assert.equal(withResearch.researchPath, ".blueprint/phases/03-phase-discovery/03-RESEARCH.md");
  assert.equal(withUi.hasUiSpec, true);
  assert.equal(researchBody.found, true);
  assert.match(researchBody.content ?? "", /Recommendations/);

  await assert.rejects(
    blueprintPhaseArtifactWrite({
      cwd: repoPath,
      phase: "3",
      artifact: "research",
      content: "# Replaced\n"
    }),
    /overwrite confirmation/i
  );
});
