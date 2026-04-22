import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintArtifactList } from "../src/mcp/tools/artifacts.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import { blueprintReviewRecord } from "../src/mcp/tools/review.js";

const repoRoot = process.cwd();

async function createPeerReviewRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-peer-review-"));
  const repoPath = path.join(tempRoot, "repo");
  const phaseDir = path.join(repoPath, ".blueprint/phases/03-review-phase");

  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Peer Review Fixture

## Milestone

- Active milestone: v2

## Phases

- [ ] **Phase 3: Review Phase** - Finalize the saved plan set before execution

## Phase Details

### Phase 3: Review Phase
**Goal**: Collect cross-CLI peer review of the saved phase plans.
**Requirements**: REV-01
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v2
- Current phase: 3
- Active command: /blu-plan-phase
- Next action: Run /blu-review 3
- Last updated: 2026-04-13T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");
  await writeFile(
    path.join(phaseDir, "03-01-PLAN.md"),
    `---
phase: 3
plan_id: "01"
title: "Peer Review Plan"
wave: 1
status: planned
objective: "Finalize the saved plan set before execution."
depends_on: []
requirements: ["REV-01"]
files_modified: ["src/mcp/tools/project.ts"]
read_first: ["docs/commands/plan-phase.md"]
acceptance_criteria: ["Peer review feedback is persisted visibly."]
autonomous: true
---

# Phase 03: Review Phase - Plan 01

## Goal

Capture cross-CLI peer review for the saved plan.
`,
    "utf8"
  );

  return repoPath;
}

test("review docs and catalog metadata promote the peer-review slice to implemented", async () => {
  const [catalogMarkdown, implementationOrder, commandDoc, runtimeReference] = await Promise.all([
    readFile(path.join(repoRoot, "docs/COMMAND-CATALOG.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/IMPLEMENTATION-ORDER.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/commands/review.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  assert.match(
    catalogMarkdown,
    /\| `review` \| 4 \| `Quality And Shipping` \| `blueprint-review` \| `implemented` \| `phase XX-REVIEWS\.md` \| `Medium: external reviewer orchestration without default repo mutation\.` \|/
  );
  assert.match(
    implementationOrder,
    /Shipped in this wave: `code-review`, `code-review-fix`, `audit-fix`, `secure-phase`, `review`, `ui-review`, `docs-update`, `add-tests`, `pr-branch`, `ship`, and `undo`\./
  );
  assert.match(commandDoc, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(commandDoc, /## Shared Runtime Contract/);
  assert.match(commandDoc, /## In-Flight Progress Contract/);
  assert.match(
    commandDoc,
    /requested reviewer set, reviewer availability, disagreement posture, pending gate, execution mode, artifact status, and next safe action/i
  );
  assert.match(commandDoc, /`update_topic` tool and keep a compact peer-review checklist with `write_todos`/i);
  assert.match(commandDoc, /`reviewer-availability`/i);
  assert.match(commandDoc, /next-step guidance stays on `\/blu-review <phase>`/i);
  assert.match(
    runtimeReference,
    /`review`[\s\S]*Long-running-mutation profile for phase-plan peer review/i
  );
  assert.match(
    runtimeReference,
    /`review`[\s\S]*`update_topic` and `write_todos` for non-trivial review runs/i
  );
  assert.match(
    runtimeReference,
    /`review`[\s\S]*reviewer availability, partial reviewer coverage, disagreement posture, and artifact reuse or revision status explicit/i
  );
  assert.match(
    runtimeReference,
    /`review`[\s\S]*`reviewer-availability` waiting state/i
  );
});

test("blueprint_review_record writes a phase-scoped peer-review artifact with follow-up counts", async (t) => {
  const repoPath = await createPeerReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const content = `# Phase 03: Review Phase - Peer Reviews

**Reviewers:** codex, claude

## Review Summary

- Codex approved the phase direction, but reviewer availability still needs to be explicit before execution.

## Reviewer Results

- codex: requested a clearer fallback path when a requested reviewer CLI is unavailable.
- claude: unavailable in this environment, so no second opinion was captured in this run.

## Findings

- The plan needs a clearer fallback path when a requested reviewer CLI is unavailable.

## Disagreements

- none

## Follow-Ups

- Revise the plan so reviewer availability is recorded explicitly before execution.

## Next Safe Action

- Run /blu-plan-phase 3 to tighten the saved plan before execution.
`;

  const written = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "3",
    artifact: "peer-review",
    content
  });

  assert.equal(written.status, "created");
  assert.equal(written.reportPath, ".blueprint/phases/03-review-phase/03-REVIEWS.md");
  assert.equal(written.counts.findings, 1);
  assert.equal(written.counts.followUps, 1);
  assert.deepEqual(written.followUps, [
    "Revise the plan so reviewer availability is recorded explicitly before execution."
  ]);

  const saved = await readFile(path.join(repoPath, written.reportPath), "utf8");
  assert.match(saved, /\*\*Reviewers:\*\* codex, claude/);

  await assert.rejects(
    () =>
      blueprintReviewRecord({
        cwd: repoPath,
        phase: "3",
        artifact: "peer-review",
        content: content.replace(
          "requested a clearer fallback path",
          "requested a documented reviewer fallback path"
        )
      }),
    /explicit overwrite confirmation/
  );

  const artifactList = await blueprintArtifactList({ cwd: repoPath });
  assert.ok(
    artifactList.artifacts.phases.includes(".blueprint/phases/03-review-phase/03-REVIEWS.md")
  );
});

test("review is exposed as an implemented peer-review command with the registered review tool", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["review"];

  assert.ok(blueprintToolNames.includes("blueprint_review_record"));
  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.manifestPath, "commands/blu-review.toml");
  assert.deepEqual(entry.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_artifact_list",
    "blueprint_phase_plan_index",
    "blueprint_phase_plan_read",
    "blueprint_review_record"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, []);
});
