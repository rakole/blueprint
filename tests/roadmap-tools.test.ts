import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames } from "../src/mcp/server.js";
import { blueprintRoadmapAddPhase, blueprintRoadmapRead } from "../src/mcp/tools/phase.js";

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function createRoadmapRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-roadmap-tools-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(path.join(repoPath, ".blueprint/phases/01-foundation"), {
    recursive: true
  });
  await mkdir(path.join(repoPath, ".blueprint/phases/02.1-planning-drift-recovery"), {
    recursive: true
  });
  await mkdir(path.join(repoPath, ".blueprint/phases/02.2-validation-parity"), {
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

- [x] **Phase 1: Foundation** - Baseline initialization
- [ ] **Phase 2.1: Planning Drift Recovery** - Repair roadmap drift
- [ ] **Phase 2.2: Validation Parity** - Close validation gaps

## Phase Details

### Phase 1: Foundation
**Goal**: Baseline initialization.
**Requirements**: RQ-01

### Phase 2.1: Planning Drift Recovery
**Goal**: Repair roadmap drift.
**Requirements**: RQ-02

### Phase 2.2: Validation Parity
**Goal**: Close validation gaps.
**Requirements**: RQ-03
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 2.2
- Active command: /blu:progress
- Next action: Run /blu:progress
- Last updated: 2026-04-11T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/config.json"),
    JSON.stringify({ version: 2 }, null, 2),
    "utf8"
  );

  return repoPath;
}

test("roadmap tools register blueprint_roadmap_add_phase", () => {
  assert.ok(
    blueprintToolNames.includes("blueprint_roadmap_add_phase"),
    "blueprint_roadmap_add_phase should be registered"
  );
});

test("blueprint_roadmap_add_phase appends the next integer phase and slugged directory", async (t) => {
  const repoPath = await createRoadmapRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const before = await blueprintRoadmapRead({ cwd: repoPath });
  const result = await blueprintRoadmapAddPhase({
    cwd: repoPath,
    description: "Notifications Flow"
  });
  const after = await blueprintRoadmapRead({ cwd: repoPath });
  const roadmapBody = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");

  assert.deepEqual(before.phases.map((phase) => phase.phaseNumber), ["1", "2.1", "2.2"]);
  assert.equal(after.roadmap.phaseCount, before.roadmap.phaseCount + 1);
  assert.equal(result.phaseNumber, "3");
  assert.equal(result.phasePrefix, "03");
  assert.equal(result.phaseName, "Notifications Flow");
  assert.equal(result.slug, "notifications-flow");
  assert.equal(result.phaseDir, ".blueprint/phases/03-notifications-flow");
  assert.equal(result.roadmapPath, ".blueprint/ROADMAP.md");
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/03-notifications-flow")),
    true
  );
  assert.equal(after.phases.at(-1)?.phaseNumber, "3");
  assert.equal(after.phases.at(-1)?.phasePrefix, "03");
  assert.equal(after.phases.at(-1)?.phaseName, "Notifications Flow");
  assert.equal(after.phases.at(-1)?.phaseDir, ".blueprint/phases/03-notifications-flow");
  assert.match(roadmapBody, /- \[ \] \*\*Phase 3: Notifications Flow\*\*/);
  assert.match(roadmapBody, /### Phase 3: Notifications Flow/);
});
