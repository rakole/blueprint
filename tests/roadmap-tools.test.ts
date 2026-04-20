import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";

import { blueprintToolNames, blueprintToolRegistry } from "../src/mcp/server.js";
import {
  blueprintRoadmapAddPhase,
  blueprintRoadmapInsertPhase,
  blueprintRoadmapPromoteBacklog,
  blueprintRoadmapRead,
  blueprintRoadmapRemovePhase
} from "../src/mcp/tools/phase.js";

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function createRoadmapRepo(currentPhase = "2.2"): Promise<string> {
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
- Current phase: ${currentPhase}
- Active command: /blu-progress
- Next action: Run /blu-progress
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

async function createInsertRoadmapRepo(): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-insert-roadmap-tools-"));
  const repoPath = path.join(tempRoot, "repo");

  await mkdir(path.join(repoPath, ".blueprint/phases/01-foundation"), {
    recursive: true
  });
  await mkdir(path.join(repoPath, ".blueprint/phases/02-core-runtime"), {
    recursive: true
  });
  await mkdir(path.join(repoPath, ".blueprint/phases/04-release-hardening"), {
    recursive: true
  });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Insert Fixture

## Milestone

- Active milestone: v2

## Phases

- [x] **Phase 1: Foundation** - Baseline initialization
- [ ] **Phase 2: Core Runtime** - Finish the main lifecycle slice
- [ ] **Phase 4: Release Hardening** - Package the extension for public release

## Phase Details

### Phase 1: Foundation
**Goal**: Baseline initialization.
**Requirements**: RQ-01

### Phase 2: Core Runtime
**Goal**: Finish the main lifecycle slice.
**Requirements**: RQ-02

### Phase 4: Release Hardening
**Goal**: Package the extension for public release.
**Requirements**: RQ-04
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v2
- Current phase: 2
- Active command: /blu-progress
- Next action: Run /blu-progress
- Last updated: 2026-04-12T00:00:00.000Z

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

test("roadmap tools register blueprint_roadmap_remove_phase", () => {
  assert.ok(
    blueprintToolNames.includes("blueprint_roadmap_remove_phase"),
    "blueprint_roadmap_remove_phase should be registered"
  );
});

test("blueprint_roadmap_remove_phase input schema accepts numeric phase ids and force overrides", () => {
  const definition = blueprintToolRegistry.blueprint_roadmap_remove_phase;

  assert.equal(
    definition.inputSchema.phase.safeParse(2).success,
    true,
    "blueprint_roadmap_remove_phase should accept integer numeric phase ids"
  );
  assert.equal(
    definition.inputSchema.phase.safeParse(2.1).success,
    true,
    "blueprint_roadmap_remove_phase should accept decimal numeric phase ids"
  );
  assert.equal(
    definition.inputSchema.force.safeParse(true).success,
    true,
    "blueprint_roadmap_remove_phase should accept an explicit force override"
  );
});

test("roadmap tools register blueprint_roadmap_insert_phase", () => {
  assert.ok(
    blueprintToolNames.includes("blueprint_roadmap_insert_phase"),
    "blueprint_roadmap_insert_phase should be registered"
  );
});

test("roadmap tools register blueprint_roadmap_promote_backlog", () => {
  assert.ok(
    blueprintToolNames.includes("blueprint_roadmap_promote_backlog"),
    "blueprint_roadmap_promote_backlog should be registered"
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

test("blueprint_roadmap_insert_phase inserts the first decimal phase after an integer target without renumbering later phases", async (t) => {
  const repoPath = await createInsertRoadmapRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await blueprintRoadmapInsertPhase({
    cwd: repoPath,
    after: 2,
    description: "API Stabilization"
  });
  const after = await blueprintRoadmapRead({ cwd: repoPath });
  const roadmapBody = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");

  assert.equal(result.afterPhaseNumber, "2");
  assert.equal(result.phaseNumber, "2.1");
  assert.equal(result.phasePrefix, "02.1");
  assert.equal(result.phaseName, "API Stabilization");
  assert.equal(result.slug, "api-stabilization");
  assert.equal(result.phaseDir, ".blueprint/phases/02.1-api-stabilization");
  assert.deepEqual(after.phases.map((phase) => phase.phaseNumber), ["1", "2", "2.1", "4"]);
  assert.equal(after.phases[2]?.phaseDir, ".blueprint/phases/02.1-api-stabilization");
  assert.equal(after.phases[3]?.phaseNumber, "4");
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/02.1-api-stabilization")),
    true
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/04-release-hardening")),
    true
  );
  assert.match(roadmapBody, /\*\*Inserted\*\*: yes/);
  assert.match(
    roadmapBody,
    /Phase 2: Core Runtime[\s\S]*Phase 2\.1: API Stabilization[\s\S]*Phase 4: Release Hardening/
  );
  assert.match(
    roadmapBody,
    /### Phase 2: Core Runtime[\s\S]*### Phase 2\.1: API Stabilization[\s\S]*### Phase 4: Release Hardening/
  );
  assert.match(roadmapBody, /\*\*Depends on\*\*: Phase 2/);
});

test("blueprint_roadmap_insert_phase increments the decimal suffix from roadmap state on repeated inserts", async (t) => {
  const repoPath = await createInsertRoadmapRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintRoadmapInsertPhase({
    cwd: repoPath,
    after: "2",
    description: "API Stabilization"
  });
  const second = await blueprintRoadmapInsertPhase({
    cwd: repoPath,
    after: "2",
    description: "Validation Sweep"
  });
  const after = await blueprintRoadmapRead({ cwd: repoPath });
  const roadmapBody = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");

  assert.equal(second.phaseNumber, "2.2");
  assert.equal(second.phasePrefix, "02.2");
  assert.equal(second.phaseDir, ".blueprint/phases/02.2-validation-sweep");
  assert.deepEqual(after.phases.map((phase) => phase.phaseNumber), ["1", "2", "2.1", "2.2", "4"]);
  assert.match(
    roadmapBody,
    /Phase 2: Core Runtime[\s\S]*Phase 2\.1: API Stabilization[\s\S]*Phase 2\.2: Validation Sweep[\s\S]*Phase 4: Release Hardening/
  );
});

test("blueprint_roadmap_promote_backlog previews backlog items and promotes confirmed entries into appended phases", async (t) => {
  const repoPath = await createRoadmapRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await mkdir(path.join(repoPath, ".blueprint/backlog"), {
    recursive: true
  });
  await writeFile(
    path.join(repoPath, ".blueprint/backlog/BACKLOG.md"),
    `# Backlog

## Parking Lot

### BACKLOG-001
- Added: 2026-04-12
- Status: backlog
- Reserved Phase: 999.1
- Description: Offline mode

### BACKLOG-002
- Added: 2026-04-12
- Status: backlog
- Description: Export telemetry report
`,
    "utf8"
  );
  await mkdir(path.join(repoPath, ".blueprint/phases/999.1-offline-mode"), {
    recursive: true
  });
  await writeFile(
    path.join(repoPath, ".blueprint/phases/999.1-offline-mode/999.1-CONTEXT.md"),
    "# Context\n",
    "utf8"
  );

  const preview = await blueprintRoadmapPromoteBacklog({
    cwd: repoPath,
    previewOnly: true
  });
  const result = await blueprintRoadmapPromoteBacklog({
    cwd: repoPath,
    backlogIds: ["BACKLOG-001", "BACKLOG-002"]
  });
  const roadmapBody = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");

  assert.equal(preview.status, "preview");
  assert.deepEqual(preview.backlogItems.map((item) => item.backlogId), [
    "BACKLOG-001",
    "BACKLOG-002"
  ]);
  assert.equal(result.status, "updated");
  assert.deepEqual(result.selectedBacklogIds, ["BACKLOG-001", "BACKLOG-002"]);
  assert.deepEqual(result.promotedItems.map((item) => item.phaseNumber), ["3", "4"]);
  assert.deepEqual(result.createdPhaseDirs, [
    ".blueprint/phases/03-offline-mode",
    ".blueprint/phases/04-export-telemetry-report"
  ]);
  assert.equal(result.promotedItems[0]?.reusedReservedPhaseDir, true);
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/03-offline-mode/03-CONTEXT.md")),
    true
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/999.1-offline-mode")),
    false
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/04-export-telemetry-report")),
    true
  );
  assert.match(roadmapBody, /Phase 3: Offline mode/);
  assert.match(roadmapBody, /Phase 4: Export telemetry report/);
});

test("blueprint_roadmap_remove_phase removes a future phase and renumbers later directories plus artifacts", async (t) => {
  const repoPath = await createRoadmapRepo("1");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(
      repoPath,
      ".blueprint/phases/02.2-validation-parity/02.2-CONTEXT.md"
    ),
    "# Context\n",
    "utf8"
  );
  await writeFile(
    path.join(
      repoPath,
      ".blueprint/phases/02.2-validation-parity/02.2-01-PLAN.md"
    ),
    "# Plan\n",
    "utf8"
  );
  const result = await blueprintRoadmapRemovePhase({
    cwd: repoPath,
    phase: "2.1"
  });
  const after = await blueprintRoadmapRead({ cwd: repoPath });
  const roadmapBody = await readFile(path.join(repoPath, ".blueprint/ROADMAP.md"), "utf8");

  assert.equal(result.removedPhase.phaseNumber, "2.1");
  assert.equal(result.removedPhase.phaseDir, ".blueprint/phases/02.1-planning-drift-recovery");
  assert.deepEqual(
    result.renumberedPhases.map((phase) => [
      phase.previousPhaseNumber,
      phase.newPhaseNumber,
      phase.newPhaseDir
    ]),
    [["2.2", "2.1", ".blueprint/phases/02.1-validation-parity"]]
  );
  assert.deepEqual(after.phases.map((phase) => phase.phaseNumber), ["1", "2.1"]);
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/02.1-planning-drift-recovery")),
    false
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/02.1-validation-parity")),
    true
  );
  assert.equal(
    await pathExists(
      path.join(repoPath, ".blueprint/phases/02.1-validation-parity/02.1-CONTEXT.md")
    ),
    true
  );
  assert.equal(
    await pathExists(
      path.join(repoPath, ".blueprint/phases/02.1-validation-parity/02.1-01-PLAN.md")
    ),
    true
  );
  assert.match(roadmapBody, /- \[ \] \*\*Phase 2\.1: Validation Parity\*\*/);
  assert.doesNotMatch(roadmapBody, /Planning Drift Recovery/);
});

test("blueprint_roadmap_insert_phase rejects decimal insertion targets", async (t) => {
  const repoPath = await createInsertRoadmapRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await assert.rejects(
    () =>
      blueprintRoadmapInsertPhase({
        cwd: repoPath,
        after: "2.1",
        description: "Emergency follow-up"
      }),
    /not a valid Blueprint integer phase number|cannot be used as an insertion target/
  );
});

test("blueprint_roadmap_insert_phase rejects decimal-looking integer anchors before normalization", async (t) => {
  const repoPath = await createInsertRoadmapRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  for (const after of ["2.0", "02.0"]) {
    await assert.rejects(
      () =>
        blueprintRoadmapInsertPhase({
          cwd: repoPath,
          after,
          description: "Emergency follow-up"
        }),
      /not a valid Blueprint integer phase number|cannot be used as an insertion target/
    );
  }
});

test("blueprint_roadmap_insert_phase rejects malformed free-text insertion anchors", async (t) => {
  const repoPath = await createInsertRoadmapRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await assert.rejects(
    () =>
      blueprintRoadmapInsertPhase({
        cwd: repoPath,
        after: "phase 2 please",
        description: "Emergency follow-up"
      }),
    /not a valid Blueprint integer phase number/
  );
});

test("blueprint_roadmap_insert_phase rejects missing integer targets", async (t) => {
  const repoPath = await createInsertRoadmapRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await assert.rejects(
    () =>
      blueprintRoadmapInsertPhase({
        cwd: repoPath,
        after: "3",
        description: "Emergency follow-up"
      }),
    /does not exist/
  );
});

test("blueprint_roadmap_insert_phase rejects conflicting decimal directory drift", async (t) => {
  const repoPath = await createInsertRoadmapRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await mkdir(path.join(repoPath, ".blueprint/phases/02.1-old-emergency-slice"), {
    recursive: true
  });

  await assert.rejects(
    () =>
      blueprintRoadmapInsertPhase({
        cwd: repoPath,
        after: "2",
        description: "API Stabilization"
      }),
    /conflicting directory/
  );
});

test("blueprint_roadmap_remove_phase rejects current or past phases", async (t) => {
  const repoPath = await createRoadmapRepo("2.2");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await assert.rejects(
    () =>
      blueprintRoadmapRemovePhase({
        cwd: repoPath,
        phase: 2.1
      }),
    /Only future phases can be removed/
  );
});

test("blueprint_roadmap_remove_phase reports recovery candidates when the target phase is missing", async (t) => {
  const repoPath = await createRoadmapRepo("1");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await assert.rejects(
    () =>
      blueprintRoadmapRemovePhase({
        cwd: repoPath,
        phase: 9
      }),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);

      assert.match(message, /Phase 9 does not exist in \.blueprint\/ROADMAP\.md\./);
      assert.match(message, /Nearest valid phase candidate/);
      assert.match(message, /Active milestone candidate: v1/);
      assert.match(message, /\/blu-progress/);

      return true;
    }
  );
});

test("blueprint_roadmap_remove_phase requires force before removing phases with execution evidence", async (t) => {
  const repoPath = await createRoadmapRepo("1");
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await writeFile(
    path.join(
      repoPath,
      ".blueprint/phases/02.1-planning-drift-recovery/02.1-01-SUMMARY.md"
    ),
    "# Summary\n",
    "utf8"
  );

  await assert.rejects(
    () =>
      blueprintRoadmapRemovePhase({
        cwd: repoPath,
        phase: 2.1
      }),
    /already has execution evidence/
  );

  const result = await blueprintRoadmapRemovePhase({
    cwd: repoPath,
    phase: 2.1,
    force: true
  });
  const after = await blueprintRoadmapRead({ cwd: repoPath });

  assert.equal(result.removedPhase.phaseNumber, "2.1");
  assert.ok(
    result.warnings.some((warning) => warning.includes("explicit force confirmation")),
    "force removal should report that execution evidence was bypassed explicitly"
  );
  assert.deepEqual(after.phases.map((phase) => phase.phaseNumber), ["1", "2.1"]);
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/02.1-planning-drift-recovery")),
    false
  );
  assert.equal(
    await pathExists(path.join(repoPath, ".blueprint/phases/02.1-validation-parity")),
    true
  );
});
