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
  assert.match(agents, /Phase 2\.1 drift recovery and Phase 2\.2 future-contract drift repair both completed on 2026-04-11/);
  assert.match(agents, /Phase 3 discovery is unblocked for implementation work/);
  assert.match(readme, /Wave 0 shipped commands/);
  assert.match(readme, /Phase 2\.1 and Phase 2\.2 both closed on 2026-04-11/);
  assert.match(readme, /next implementation slice is Phase 3 Phase Discovery/);
  assert.match(gemini, /Phase 3 discovery is now the next implementation slice/);
  assert.match(gemini, /\/blu:map-codebase/);
  assert.match(handoff, /Phase 2\.1 drift recovery and Phase 2\.2 future-contract drift repair both completed on 2026-04-11/i);
  assert.match(
    memory,
    /Current milestone: Phase 3 Phase Discovery|Current milestone: Phase 4 Plan, Execute, and Verify/
  );
  assert.match(roadmap, /Phase 2\.1: Drift Recovery Gate/);
  assert.match(roadmap, /Phase 2\.2: Urgent Drift-Repair Follow-Up/);
  assert.match(state, /Phase: 03|Phase: 04/);
  assert.match(
    state,
    /Phase 2\.2 closed; ready to start Phase 3|Executing Phase 03|Phase 03 complete/
  );
  assert.match(drift, /Checkpoint: Phase 2\.2 future-contract drift repair/);
  assert.match(drift, /State: closed on 2026-04-11/);
  assert.match(drift, /Phase 3 discovery is unblocked for implementation work/);
});

test("drift-repair docs capture the status vocabulary and the repaired future-command ownership metadata", async () => {
  const [catalog, artifactSchema, drift, skills] = await Promise.all([
    readRepoFile("docs/COMMAND-CATALOG.md"),
    readRepoFile("docs/ARTIFACT-SCHEMA.md"),
    readRepoFile("docs/DRIFT.MD"),
    readRepoFile("docs/SKILLS-AND-AGENTS.md")
  ]);

  assert.match(catalog, /\| Command \| Wave \| Family \| Primary Skill \| Status \| Key Writes \| Risk \|/);
  assert.match(catalog, /`map-codebase` \| 0 \| `Foundation` \| `blueprint-map` \| `implemented`/);
  assert.match(catalog, /`next` \| 1 \| `Core Lifecycle` \| `blueprint-router` \| `blocked`/);
  assert.match(catalog, /`do` \| 3 \| `Capture And Lightweight Execution` \| `blueprint-router` \| `blocked`/);
  assert.match(catalog, /`pause-work` \| 1 \| `Core Lifecycle` \| `blueprint-governance` \| `planned`/);
  assert.match(catalog, /`resume-work` \| 1 \| `Core Lifecycle` \| `blueprint-governance` \| `planned`/);
  assert.match(catalog, /`plan-milestone-gaps` \| 2 \| `Roadmap And Milestone` \| `blueprint-roadmap-admin` \| `planned`/);
  assert.match(catalog, /STRUCTURE\.md/);
  assert.match(artifactSchema, /`STRUCTURE\.md`/);
  assert.match(skills, /`blueprint-router` .* `next`, `do`/);
  assert.match(skills, /`blueprint-governance` .* `pause-work`, `resume-work`/);
  assert.match(skills, /`blueprint-roadmap-admin` .* `plan-milestone-gaps`/);
  assert.match(drift, /`implemented`: manifest, primary skill, and required MCP tools are all present/);
  assert.match(drift, /`DRIFT-01` through `DRIFT-07`/);
});

test("drift requirements are backfilled and phase-mapped across roadmap and state docs", async () => {
  const [requirements, roadmap, state] = await Promise.all([
    readRepoFile(".planning/REQUIREMENTS.md"),
    readRepoFile(".planning/ROADMAP.md"),
    readRepoFile(".planning/STATE.md")
  ]);

  for (const requirementId of [
    "DRIFT-01",
    "DRIFT-02",
    "DRIFT-03",
    "DRIFT-04",
    "DRIFT-05",
    "DRIFT-06",
    "DRIFT-07"
  ]) {
    assert.match(requirements, new RegExp(requirementId));
  }

  assert.match(requirements, /\[x\] \*\*FND-04\*\*/);
  assert.match(requirements, /\[x\] \*\*FND-05\*\*/);
  assert.match(requirements, /\[x\] \*\*FND-06\*\*/);
  assert.match(requirements, /\| DRIFT-01 \| Phase 2\.1 \| Complete \|/);
  assert.match(requirements, /\| DRIFT-07 \| Phase 2\.2 \| Complete \|/);
  assert.match(roadmap, /\*\*Requirements\*\*: DRIFT-01, DRIFT-02, DRIFT-03, DRIFT-04/);
  assert.match(roadmap, /\*\*Requirements\*\*: DRIFT-05, DRIFT-06, DRIFT-07/);
  assert.match(roadmap, /\| 2\.2\. Urgent Drift-Repair Follow-Up \| 4\/4 \| Complete \| 2026-04-11 \|/);
  assert.match(state, /Phase 2\.2 is complete: control docs and planning state are truth-synced/);
  assert.match(state, /Phase 2\.2 is complete: .*Phase 3 is unblocked/);
});
