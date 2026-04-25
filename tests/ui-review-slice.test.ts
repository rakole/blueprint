import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import { readArtifactContract } from "../src/mcp/artifact-contracts/index.js";
import { blueprintArtifactList } from "../src/mcp/tools/artifacts.js";
import { blueprintCommandCatalog } from "../src/mcp/tools/project.js";
import { blueprintReviewRecord } from "../src/mcp/tools/review.js";

const repoRoot = process.cwd();

async function createUiReviewRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-ui-review-"));
  const repoPath = path.join(tempRoot, "repo");
  const phaseDir = path.join(repoPath, ".blueprint/phases/06-ui-audit");

  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: UI Review Fixture

## Milestone

- Active milestone: v4

## Phases

- [x] **Phase 6: UI Audit** - Completed frontend implementation ready for UI review

## Phase Details

### Phase 6: UI Audit
**Goal**: Capture a durable UI audit for the completed frontend phase.
**Requirements**: UI-01
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v4
- Current phase: 6
- Active command: /blu-execute-phase
- Next action: Run /blu-ui-review 6
- Last updated: 2026-04-13T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");
  await writeFile(
    path.join(phaseDir, "06-01-SUMMARY.md"),
    `# Phase 06: UI Audit - Summary 01

## Result

- Refined the dashboard UI and responsive behavior.
`,
    "utf8"
  );
  await writeFile(
    path.join(phaseDir, "06-UI-SPEC.md"),
    `# Phase 06: UI Audit - UI Spec

## Outcome Mode

- UI Contract

## Contract

- Desktop and mobile layouts must both preserve hierarchy.
`,
    "utf8"
  );

  return repoPath;
}

test("ui-review docs and catalog metadata promote the UI audit slice to implemented", async () => {
  const [catalogMarkdown, skillsMarkdown, commandDoc, runtimeReference] = await Promise.all([
    readFile(path.join(repoRoot, "docs/COMMAND-CATALOG.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/SKILLS-AND-AGENTS.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/commands/ui-review.md"), "utf8"),
    readFile(path.join(repoRoot, "docs/RUNTIME-REFERENCE.md"), "utf8")
  ]);

  assert.match(
    catalogMarkdown,
    /\| `ui-review` \| 4 \| `Quality And Shipping` \| `blueprint-review` \| `implemented` \| `phase XX-UI-REVIEW\.md` \| `Low: review artifact only\.` \|/
  );
  assert.match(
    skillsMarkdown,
    /\| `blueprint-ui-auditor` \| `implemented` \| Perform retroactive six-pillar UI audits \|/
  );
  assert.match(commandDoc, /\| Execution profile \| `long-running-mutation` \|/);
  assert.match(commandDoc, /## Shared Runtime Contract/);
  assert.match(commandDoc, /## In-Flight Progress Contract/);
  assert.match(
    commandDoc,
    /saved execution and UI-spec coverage, pending gate, execution mode, whether the existing `XX-UI-REVIEW\.md` artifact is being created, reused, or revised, overall score or main findings\/pass signals, and next safe action/i
  );
  assert.match(commandDoc, /`update_topic` tool and keep a compact UI-review checklist with `write_todos`/i);
  assert.match(commandDoc, /actual frontend surface under review/i);
  assert.match(commandDoc, /created, reused, or revised/i);
  assert.match(commandDoc, /ui-review-runtime-contract\.md/);
  assert.match(commandDoc, /`blueprint_artifact_contract_read` ->/);
  assert.match(commandDoc, /contract\.authoringTemplate/);
  assert.match(commandDoc, /overall score out of 24/i);
  assert.match(commandDoc, /Copywriting, Visual Hierarchy, Color, Typography, Spacing, and Experience Design/);
  assert.match(commandDoc, /no-subagent fallback/i);
  assert.match(commandDoc, /browser-only, web-search-only, shell-only, or generic helpers/i);
  assert.match(commandDoc, /retry once through MCP/i);
  assert.match(
    runtimeReference,
    /`ui-review`[\s\S]*Long-running-mutation profile for phase-scoped UI audit/i
  );
  assert.match(
    runtimeReference,
    /`ui-review`[\s\S]*`blueprint_artifact_contract_read`[\s\S]*`blueprint_review_record`/i
  );
  assert.match(
    runtimeReference,
    /`ui-review`[\s\S]*`update_topic` and `write_todos` for non-trivial ui-review runs/i
  );
  assert.match(runtimeReference, /ui-review-runtime-contract\.md/i);
  assert.match(runtimeReference, /scored six-pillar evidence with overall `\/24`/i);
  assert.match(
    runtimeReference,
    /`ui-review`[\s\S]*saved `XX-UI-SPEC\.md` coverage and the actual frontend surface explicit/i
  );
  assert.match(
    runtimeReference,
    /`ui-review`[\s\S]*inline versus capability-gated `blueprint-ui-auditor`-assisted analysis/i
  );
  assert.match(
    runtimeReference,
    /`ui-review`[\s\S]*artifact create\/reuse\/revise status plus findings-or-pass posture explicit/i
  );
});

test("review.ui-review contract template carries rich scoring guidance without changing path ownership", () => {
  const contract = readArtifactContract("review.ui-review");

  assert.equal(contract.ownerTool, "blueprint_review_record");
  assert.equal(contract.pathOwner, "blueprint_review_record");
  assert.deepEqual(contract.requiredHeadings, [
    "UI Review Summary",
    "Evidence Reviewed",
    "Findings",
    "Follow-Ups",
    "Next Safe Action"
  ]);
  assert.match(contract.authoringTemplate, /## Pillar Scores/);
  assert.match(contract.authoringTemplate, /## Priority Fixes/);
  assert.match(contract.authoringTemplate, /## Audit Trail/);
  assert.match(contract.authoringTemplate, /Copywriting/);
  assert.match(contract.authoringTemplate, /Experience Design/);
  assert.match(contract.notes.join("\n"), /scored six-pillar evidence/);
});

test("blueprint_review_record writes a phase-scoped UI review artifact with follow-up counts", async (t) => {
  const repoPath = await createUiReviewRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const content = `# Phase 06: UI Audit - UI Review

**Verdict:** FOLLOW_UP

## UI Review Summary

- The shipped dashboard honors the saved UI contract, but mobile empty states still need polish.

## Evidence Reviewed

- .blueprint/phases/06-ui-audit/06-01-SUMMARY.md
- .blueprint/phases/06-ui-audit/06-UI-SPEC.md

## Pillar Scores

| Pillar | Score | Evidence | Key Finding |
|---|---:|---|---|
| Copywriting | 3/4 | .blueprint/phases/06-ui-audit/06-01-SUMMARY.md | Copy is mostly clear. |
| Visual Hierarchy | 3/4 | .blueprint/phases/06-ui-audit/06-UI-SPEC.md | Desktop hierarchy matches the contract. |
| Color | 4/4 | .blueprint/phases/06-ui-audit/06-UI-SPEC.md | No color drift found. |
| Typography | 3/4 | .blueprint/phases/06-ui-audit/06-UI-SPEC.md | Type scale is consistent. |
| Spacing | 2/4 | .blueprint/phases/06-ui-audit/06-UI-SPEC.md | Mobile empty-state spacing needs polish. |
| Experience Design | 3/4 | .blueprint/phases/06-ui-audit/06-01-SUMMARY.md | Responsive behavior is implemented with one follow-up. |

## Priority Fixes

1. Mobile empty-state spacing is weak - affects scanability - tighten spacing and affordance copy.

## Findings

- Mobile empty-state hierarchy is weaker than the desktop contract.

## Follow-Ups

- Tighten mobile empty-state spacing and affordance copy.

## Audit Trail

- Audit date: 2026-04-13; execution mode: inline; screenshots: not supplied; score check: 18/24.

## Next Safe Action

- Run /blu-validate-phase 6 if verification is still pending.
`;

  const written = await blueprintReviewRecord({
    cwd: repoPath,
    phase: "6",
    artifact: "ui-review",
    content
  });

  assert.equal(written.status, "created");
  assert.equal(written.reportPath, ".blueprint/phases/06-ui-audit/06-UI-REVIEW.md");
  assert.equal(written.counts.findings, 1);
  assert.equal(written.counts.followUps, 1);
  assert.deepEqual(written.followUps, [
    "Tighten mobile empty-state spacing and affordance copy."
  ]);

  const saved = await readFile(path.join(repoPath, written.reportPath), "utf8");
  assert.match(saved, /\*\*Verdict:\*\* FOLLOW_UP/);

  await assert.rejects(
    () =>
      blueprintReviewRecord({
        cwd: repoPath,
        phase: "6",
        artifact: "ui-review",
        content: content.replace("FOLLOW_UP", "PASS")
      }),
    /explicit overwrite confirmation/
  );

  const artifactList = await blueprintArtifactList({ cwd: repoPath });
  assert.ok(
    artifactList.artifacts.phases.includes(".blueprint/phases/06-ui-audit/06-UI-REVIEW.md")
  );
});

test("ui-review is exposed as an implemented review command with the registered review tool", async () => {
  const catalog = await blueprintCommandCatalog();
  const entry = catalog.commands["ui-review"];

  assert.ok(blueprintToolNames.includes("blueprint_review_record"));
  assert.equal(entry.declaredStatus, "implemented");
  assert.equal(entry.status, "implemented");
  assert.equal(entry.implemented, true);
  assert.equal(entry.manifestPath, "commands/blu-ui-review.toml");
  assert.deepEqual(entry.requiredTools, [
    "blueprint_phase_locate",
    "blueprint_artifact_list",
    "blueprint_artifact_contract_read",
    "blueprint_review_record"
  ]);
  assert.deepEqual(entry.availableOptionalAgents, ["blueprint-ui-auditor"]);
});
