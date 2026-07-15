import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import {
  EXECUTE_PHASE_CLAIM_CONFIRMATION,
  blueprintPhaseExecutionPrepare,
  type PhaseExecutionControlDependencies
} from "../src/mcp/tools/phase-execution-control.js";
import {
  blueprintPhaseExecutionApply,
  blueprintPhaseExecutionFinalize,
  blueprintPhaseExecutionVerify
} from "../src/mcp/tools/phase-execution-tools.js";
import type { PhaseExecutionProcessRunner } from "../src/mcp/tools/phase-execution-runtime.js";
import { blueprintPhaseExecutionTargets } from "../src/mcp/tools/phase.js";
import { writePreparedBlueprintStateUpdate } from "../src/mcp/tools/state.js";

const execFileAsync = promisify(execFile);

async function git(repoPath: string, argv: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", argv, { cwd: repoPath });
  return stdout.trim();
}

function planContent(filesModified = "src/feature.ts"): string {
  return `---
phase: 3
plan_id: "01"
title: "Behavior proof"
wave: 1
status: planned
objective: "Prove execute-phase control."
depends_on: []
requirements:
  - EXEC-01
files_modified:
  - ${filesModified}
read_first:
  - src/feature.ts
acceptance_criteria:
  - node verify.mjs exits 0
autonomous: true
---

# Phase 03: Execute Control - Plan 01

## Goal

Prove execute-phase control.

## Scope

- Change one repo-local implementation file.

## Tasks

### Task 1: Implement the behavior

#### Read First

- src/feature.ts

#### Action

- Apply the bounded implementation change through the execution control plane.

#### Acceptance Criteria

- The hermetic verification command exits successfully.

## External Service Prerequisites

| Service | Category | Purpose | User Setup / Startup | Readiness Check | Can Agent Proceed Without It |
|---------|----------|---------|----------------------|-----------------|------------------------------|
| none | none | No external services are required. | No setup required. | Repo-local only. | yes |

## Verification

- Run \`node verify.mjs\` and require exit code 0.

## Must Haves

- Execution remains deterministic and repo-local.

## Requirement Coverage

| Requirement | Planned Coverage | Evidence |
| --- | --- | --- |
| EXEC-01 | Exercise the durable execution claim. | node verify.mjs exits 0 |

## Evidence Coverage

| Evidence | How It Will Be Produced | Owner |
| --- | --- | --- |
| Hermetic receipt | Run node verify.mjs. | Blueprint MCP |

## File / Surface Coverage

| File / Surface | Expected Change | Verification |
| --- | --- | --- |
| ${filesModified} | Bounded implementation change. | node verify.mjs exits 0 |

## Unknowns And Deferrals

| Unknown / Deferral | Handling | Follow-Up |
| --- | --- | --- |
| none | none | none |
`;
}

type Fixture = {
  repoPath: string;
  tempRoot: string;
  defaultsPath: string;
  planPath: string;
  previousGlobalHome: string | undefined;
};

async function createFixture(): Promise<Fixture> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint execute phase "));
  const repoPath = path.join(tempRoot, "repo with spaces");
  const phaseDir = path.join(repoPath, ".blueprint/phases/03-execute-control");
  const planPath = path.join(phaseDir, "03-01-PLAN.md");
  const globalHome = path.join(tempRoot, "host-global");
  const defaultsPath = path.join(globalHome, "defaults.json");
  const previousGlobalHome = process.env.BLUEPRINT_GLOBAL_HOME;

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await mkdir(phaseDir, { recursive: true });
  await mkdir(globalHome, { recursive: true });
  process.env.BLUEPRINT_GLOBAL_HOME = globalHome;
  await git(repoPath, ["init", "-b", "main"]).catch(async () => {
    await git(repoPath, ["init"]);
    await git(repoPath, ["checkout", "-b", "main"]);
  });
  await git(repoPath, ["config", "user.name", "Blueprint Behavior Tests"]);
  await git(repoPath, ["config", "user.email", "blueprint-behavior@example.com"]);

  await writeFile(path.join(repoPath, ".gitignore"), "# Intentionally do not mask execute-phase control state.\n", "utf8");
  await writeFile(path.join(repoPath, "src/feature.ts"), "export const feature = true;\n", "utf8");
  await writeFile(path.join(repoPath, "verify.mjs"), "process.exit(0);\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/PROJECT.md"), "# Project\n", "utf8");
  await writeFile(path.join(repoPath, ".blueprint/REQUIREMENTS.md"), "# Requirements\n\n- EXEC-01\n", "utf8");
  await writeFile(
    path.join(repoPath, ".blueprint/ROADMAP.md"),
    `# Roadmap: Execute Control

## Milestone

- Active milestone: v1

## Phases

- [ ] **Phase 3: Execute Control (Requirements: EXEC-01)** - Prove the execution control plane
`,
    "utf8"
  );
  await writeFile(
    path.join(repoPath, ".blueprint/STATE.md"),
    `# Blueprint State

- Project status: initialized
- Current milestone: v1
- Current phase: 3
- Active command: /blu-execute-phase
- Next action: Run execute phase 3
- Last updated: 2026-07-16T00:00:00.000Z

## Blockers

- none
`,
    "utf8"
  );
  await writeFile(path.join(repoPath, ".blueprint/config.json"), "{\n  \"version\": 2\n}\n", "utf8");
  await writeFile(defaultsPath, "{\n  \"version\": 2\n}\n", "utf8");
  await writeFile(planPath, planContent(), "utf8");
  await git(repoPath, ["add", "."]);
  await git(repoPath, ["commit", "-m", "fixture"]);

  return { repoPath, tempRoot, defaultsPath, planPath, previousGlobalHome };
}

function cleanupFixture(fixture: Fixture): Promise<void> {
  if (fixture.previousGlobalHome === undefined) {
    delete process.env.BLUEPRINT_GLOBAL_HOME;
  } else {
    process.env.BLUEPRINT_GLOBAL_HOME = fixture.previousGlobalHome;
  }
  return rm(fixture.tempRoot, { recursive: true, force: true });
}

async function preview(fixture: Fixture) {
  return blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "preview",
    phase: "3",
    defaultsPath: fixture.defaultsPath
  });
}

async function claim(fixture: Fixture, sessionId: string) {
  const candidate = await preview(fixture);
  assert.equal(candidate.status, "preview", candidate.blockers.join("\n"));
  const claimed = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "claim",
    phase: "3",
    defaultsPath: fixture.defaultsPath,
    confirmation: EXECUTE_PHASE_CLAIM_CONFIRMATION,
    previewFingerprint: candidate.fingerprint!
  }, deterministicDependencies(sessionId));
  assert.equal(claimed.status, "claimed", claimed.blockers.join("\n"));
  return claimed;
}

function deterministicDependencies(sessionId: string): Partial<PhaseExecutionControlDependencies> {
  return {
    createSessionId: () => sessionId,
    now: () => "2026-07-16T01:00:00.000Z"
  };
}

const passingRunner: PhaseExecutionProcessRunner = async () => ({
  exitCode: 0,
  signal: null,
  timedOut: false,
  stdout: "verified\n",
  stderr: ""
});

async function executeFixturePlan(fixture: Fixture, sessionId: string) {
  const claimed = await claim(fixture, sessionId);
  const beforeHash = claimed.packet!.selectedPlans[0]!.ownedFilePreimages[0]!.sha256;
  const applied = await blueprintPhaseExecutionApply({
    cwd: fixture.repoPath,
    sessionId: claimed.session!.sessionId,
    planId: "01",
    mutations: [{
      path: "src/feature.ts",
      operation: "write",
      content: `export const feature = '${sessionId}';\n`,
      expectedHash: beforeHash
    }]
  });
  assert.equal(applied.status, "mutated", applied.failure ?? "");
  const verified = await blueprintPhaseExecutionVerify({
    cwd: fixture.repoPath,
    sessionId: claimed.session!.sessionId,
    planId: "01"
  }, { processRunner: passingRunner });
  assert.equal(verified.status, "verified", verified.failure ?? "");
  return claimed;
}

test("execute-phase preview is stable in a real repo whose path contains spaces", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));

  const first = await preview(fixture);
  const second = await preview(fixture);

  assert.equal(first.status, "preview", first.blockers.join("\n"));
  assert.equal(first.ready, true);
  assert.match(first.fingerprint ?? "", /^[0-9a-f]{64}$/);
  assert.equal(second.fingerprint, first.fingerprint);
  assert.equal(first.packet?.repository.canonicalRoot, await realpath(fixture.repoPath));
  assert.deepEqual(first.packet?.selection.selectedPlanIds, ["01"]);
  assert.deepEqual(first.packet?.selectedPlans[0]?.allowedFiles, ["src/feature.ts"]);
  assert.deepEqual(first.packet?.selectedPlans[0]?.verificationCriteria, ["node verify.mjs exits 0"]);
  assert.deepEqual(first.packet?.selectedPlans[0]?.verificationCommands, ["node verify.mjs"]);
  assert.equal(first.packet?.repository.porcelainV1Z, "");
});

test("plan, config, summary, and HEAD drift each invalidate the preview fingerprint", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const baseline = await preview(fixture);
  assert.equal(baseline.ready, true, baseline.blockers.join("\n"));

  const originalPlan = await readFile(fixture.planPath, "utf8");
  await writeFile(fixture.planPath, `${originalPlan}\n<!-- drift -->\n`, "utf8");
  const planDrift = await preview(fixture);
  assert.notEqual(planDrift.fingerprint, baseline.fingerprint);
  const staleClaim = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "claim",
    phase: "3",
    defaultsPath: fixture.defaultsPath,
    confirmation: EXECUTE_PHASE_CLAIM_CONFIRMATION,
    previewFingerprint: baseline.fingerprint!
  });
  assert.equal(staleClaim.status, "stale");
  await writeFile(fixture.planPath, originalPlan, "utf8");

  const configPath = path.join(fixture.repoPath, ".blueprint/config.json");
  const originalConfig = await readFile(configPath, "utf8");
  await writeFile(configPath, `${originalConfig} `, "utf8");
  assert.notEqual((await preview(fixture)).fingerprint, baseline.fingerprint);
  await writeFile(configPath, originalConfig, "utf8");

  const summaryPath = path.join(fixture.repoPath, ".blueprint/phases/03-execute-control/03-01-SUMMARY.md");
  await writeFile(summaryPath, "# Simulated interrupted summary\n", "utf8");
  assert.notEqual((await preview(fixture)).fingerprint, baseline.fingerprint);
  await unlink(summaryPath);

  await writeFile(path.join(fixture.repoPath, "README.md"), "# New HEAD\n", "utf8");
  await git(fixture.repoPath, ["add", "README.md"]);
  await git(fixture.repoPath, ["commit", "-m", "move head"]);
  const headDrift = await preview(fixture);
  assert.notEqual(headDrift.packet?.repository.head, baseline.packet?.repository.head);
  assert.notEqual(headDrift.fingerprint, baseline.fingerprint);
});

test("same-porcelain dirty and untracked byte drift invalidates an exact preview", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const featurePath = path.join(fixture.repoPath, "src/feature.ts");
  await writeFile(featurePath, "export const feature = 'dirty one';\n", "utf8");
  const dirtyOne = await preview(fixture);
  await writeFile(featurePath, "export const feature = 'dirty two';\n", "utf8");
  const dirtyTwo = await preview(fixture);

  assert.equal(dirtyOne.packet?.repository.porcelainV1Z, dirtyTwo.packet?.repository.porcelainV1Z);
  assert.notEqual(dirtyOne.fingerprint, dirtyTwo.fingerprint);
  assert.notEqual(
    dirtyOne.packet?.selectedPlans[0]?.ownedFilePreimages[0]?.sha256,
    dirtyTwo.packet?.selectedPlans[0]?.ownedFilePreimages[0]?.sha256
  );

  const stale = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "claim",
    phase: "3",
    defaultsPath: fixture.defaultsPath,
    confirmation: EXECUTE_PHASE_CLAIM_CONFIRMATION,
    previewFingerprint: dirtyOne.fingerprint!
  });
  assert.equal(stale.status, "stale");

  const untrackedPath = path.join(fixture.repoPath, "untracked.txt");
  await writeFile(untrackedPath, "untracked one\n", "utf8");
  const untrackedOne = await preview(fixture);
  await writeFile(untrackedPath, "untracked two\n", "utf8");
  const untrackedTwo = await preview(fixture);
  assert.equal(
    untrackedOne.packet?.repository.porcelainV1Z,
    untrackedTwo.packet?.repository.porcelainV1Z
  );
  assert.notEqual(untrackedOne.fingerprint, untrackedTwo.fingerprint);
});

test("execute-phase rejects a committed lock-directory symlink before acquiring the repo lock", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const externalLocks = path.join(fixture.tempRoot, "external-locks");
  await mkdir(externalLocks);
  await symlink(externalLocks, path.join(fixture.repoPath, ".blueprint/locks"));
  await git(fixture.repoPath, ["add", ".blueprint/locks"]);
  await git(fixture.repoPath, ["commit", "-m", "add malicious lock symlink"]);

  const result = await preview(fixture);
  assert.equal(result.status, "blocked");
  assert.match(result.blockers.join("\n"), /lock storage.*real repository directory/i);
  assert.deepEqual(await readdir(externalLocks), []);
});

test("authorized files, missing-file ancestors, and control storage reject symlink escapes", async (t) => {
  const originalGlobalHome = process.env.BLUEPRINT_GLOBAL_HOME;
  const existing = await createFixture();
  const missingLeaf = await createFixture();
  const control = await createFixture();
  t.after(async () => {
    if (originalGlobalHome === undefined) delete process.env.BLUEPRINT_GLOBAL_HOME;
    else process.env.BLUEPRINT_GLOBAL_HOME = originalGlobalHome;
    await Promise.all([
      rm(existing.tempRoot, { recursive: true, force: true }),
      rm(missingLeaf.tempRoot, { recursive: true, force: true }),
      rm(control.tempRoot, { recursive: true, force: true })
    ]);
  });

  const outsideFile = path.join(existing.tempRoot, "outside.ts");
  process.env.BLUEPRINT_GLOBAL_HOME = path.dirname(existing.defaultsPath);
  await writeFile(outsideFile, "outside\n", "utf8");
  await writeFile(existing.planPath, planContent("src/link.ts"), "utf8");
  await symlink(outsideFile, path.join(existing.repoPath, "src/link.ts"));
  const existingResult = await preview(existing);
  assert.equal(existingResult.status, "blocked");
  assert.match(existingResult.blockers.join("\n"), /symbolic link/i);

  const outsideDir = path.join(missingLeaf.tempRoot, "outside-dir");
  process.env.BLUEPRINT_GLOBAL_HOME = path.dirname(missingLeaf.defaultsPath);
  await mkdir(outsideDir);
  await writeFile(missingLeaf.planPath, planContent("src/link-dir/new.ts"), "utf8");
  await symlink(outsideDir, path.join(missingLeaf.repoPath, "src/link-dir"));
  const missingResult = await preview(missingLeaf);
  assert.equal(missingResult.status, "blocked");
  assert.match(missingResult.blockers.join("\n"), /symbolic link/i);

  process.env.BLUEPRINT_GLOBAL_HOME = path.dirname(control.defaultsPath);
  const controlPreview = await preview(control);
  const externalControl = path.join(control.tempRoot, "external-control");
  await mkdir(externalControl);
  await mkdir(path.join(control.repoPath, ".blueprint/executions"), { recursive: true });
  await symlink(
    externalControl,
    path.join(control.repoPath, ".blueprint/executions/execute-phase")
  );
  const controlClaim = await blueprintPhaseExecutionPrepare({
    cwd: control.repoPath,
    mode: "claim",
    phase: "3",
    defaultsPath: control.defaultsPath,
    confirmation: EXECUTE_PHASE_CLAIM_CONFIRMATION,
    previewFingerprint: controlPreview.fingerprint!
  });
  assert.equal(controlClaim.status, "blocked");
  assert.match(controlClaim.blockers.join("\n"), /unsafe ancestor|control storage/i);
});

test("packet construction fails closed when authority changes between selector reads", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  let calls = 0;
  const targetResolver: PhaseExecutionControlDependencies["targetResolver"] = async (args) => {
    const target = await blueprintPhaseExecutionTargets(args);
    calls += 1;
    if (calls === 1) {
      await writeFile(fixture.planPath, `${await readFile(fixture.planPath, "utf8")}\n<!-- torn -->\n`, "utf8");
    }
    return target;
  };

  const result = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "preview",
    phase: "3",
    defaultsPath: fixture.defaultsPath
  }, { targetResolver });

  assert.equal(result.status, "blocked");
  assert.match(result.blockers.join("\n"), /authority changed while the preview packet was being built/i);
});

test("ignored owned-file authority drift is caught by the second full digest pass", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const generatedPath = path.join(fixture.repoPath, "src/generated.ts");
  await writeFile(fixture.planPath, planContent("src/generated.ts"), "utf8");
  await writeFile(
    path.join(fixture.repoPath, ".git/info/exclude"),
    "src/generated.ts\n",
    "utf8"
  );
  await writeFile(generatedPath, "ignored one\n", "utf8");

  const result = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "preview",
    phase: "3",
    defaultsPath: fixture.defaultsPath
  }, {
    beforeAuthorityRecheck: () => writeFile(generatedPath, "ignored two\n", "utf8")
  });

  assert.equal(result.status, "blocked");
  assert.match(result.blockers.join("\n"), /authority changed while the preview packet was being built/i);
});

test("claim is durable, idempotent for the identical fingerprint, and resumable after interruption", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const first = await preview(fixture);
  const deps = deterministicDependencies("session-one");
  const claimArgs = {
    cwd: fixture.repoPath,
    mode: "claim" as const,
    phase: "3",
    defaultsPath: fixture.defaultsPath,
    confirmation: EXECUTE_PHASE_CLAIM_CONFIRMATION,
    previewFingerprint: first.fingerprint!
  };

  const unconfirmed = await blueprintPhaseExecutionPrepare({
    ...claimArgs,
    confirmation: "yes"
  }, deps);
  assert.equal(unconfirmed.status, "blocked");
  assert.match(unconfirmed.blockers.join("\n"), /exact confirmation literal/i);

  const claimed = await blueprintPhaseExecutionPrepare(claimArgs, deps);
  const repeated = await blueprintPhaseExecutionPrepare(claimArgs, deps);
  assert.equal(claimed.status, "claimed", claimed.blockers.join("\n"));
  assert.equal(claimed.reused, false);
  assert.equal(repeated.status, "claimed", repeated.blockers.join("\n"));
  assert.equal(repeated.reused, true);
  assert.equal(repeated.session?.sessionId, claimed.session?.sessionId);

  const resumed = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "resume",
    sessionId: claimed.session!.sessionId
  }, deps);
  assert.equal(resumed.status, "resumed", resumed.blockers.join("\n"));
  assert.equal(resumed.fingerprint, claimed.fingerprint);
  assert.equal(resumed.session?.resumeCount, 1);
  assert.equal(resumed.packet?.repository.porcelainV1Z, "");
});

test("resume rejects post-claim staging drift on a baseline dirty path", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  await writeFile(
    path.join(fixture.repoPath, "src/feature.ts"),
    "export const feature = 'dirty before claim';\n",
    "utf8"
  );
  const claimed = await claim(fixture, "baseline-status-session");
  await git(fixture.repoPath, ["add", "src/feature.ts"]);

  const resumed = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "resume",
    sessionId: claimed.session!.sessionId
  });
  assert.equal(resumed.status, "stale");
  assert.match(resumed.blockers.join("\n"), /Execution session is stale/i);
});

test("verification rejects staging drift on an unreceipted baseline path after execution begins", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const baselinePath = path.join(fixture.repoPath, "baseline.txt");
  await writeFile(baselinePath, "committed\n", "utf8");
  await git(fixture.repoPath, ["add", "baseline.txt"]);
  await git(fixture.repoPath, ["commit", "-m", "add baseline file"]);
  await writeFile(baselinePath, "dirty before claim\n", "utf8");
  const claimed = await claim(fixture, "executing-baseline-status-session");
  await blueprintPhaseExecutionApply({
    cwd: fixture.repoPath,
    sessionId: claimed.session!.sessionId,
    planId: "01",
    mutations: [{
      path: "src/feature.ts",
      operation: "write",
      content: "export const feature = 'execution started';\n",
      expectedHash: claimed.packet!.selectedPlans[0]!.ownedFilePreimages[0]!.sha256
    }]
  });
  await git(fixture.repoPath, ["add", "baseline.txt"]);

  await assert.rejects(
    blueprintPhaseExecutionVerify({
      cwd: fixture.repoPath,
      sessionId: claimed.session!.sessionId,
      planId: "01"
    }, { processRunner: passingRunner }),
    /baseline Git status drifted/i
  );
});

test("verification and resume reject staging drift on a mutation-receipted owned path", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const claimed = await claim(fixture, "owned-status-session");
  await blueprintPhaseExecutionApply({
    cwd: fixture.repoPath,
    sessionId: claimed.session!.sessionId,
    planId: "01",
    mutations: [{
      path: "src/feature.ts",
      operation: "write",
      content: "export const feature = 'staged outside control';\n",
      expectedHash: claimed.packet!.selectedPlans[0]!.ownedFilePreimages[0]!.sha256
    }]
  });
  await git(fixture.repoPath, ["add", "src/feature.ts"]);

  await assert.rejects(
    blueprintPhaseExecutionVerify({
      cwd: fixture.repoPath,
      sessionId: claimed.session!.sessionId,
      planId: "01"
    }, { processRunner: passingRunner }),
    /mutation Git status drifted/i
  );

  const resumed = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "resume",
    sessionId: claimed.session!.sessionId
  });
  assert.equal(resumed.status, "stale");
  assert.match(resumed.blockers.join("\n"), /mutation Git status drifted/i);
});

test("orphaned session persistence blocks a different claim and recovers the identical claim", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const first = await preview(fixture);
  const interrupted = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "claim",
    phase: "3",
    defaultsPath: fixture.defaultsPath,
    confirmation: EXECUTE_PHASE_CLAIM_CONFIRMATION,
    previewFingerprint: first.fingerprint!
  }, {
    ...deterministicDependencies("orphan-session"),
    afterSessionPersisted: () => {
      throw new Error("injected crash after session persistence");
    }
  });
  assert.equal(interrupted.status, "blocked");
  assert.match(interrupted.blockers.join("\n"), /injected crash/i);

  const otherPreview = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "preview",
    phase: "3",
    wave: 1,
    defaultsPath: fixture.defaultsPath
  });
  const otherClaim = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "claim",
    phase: "3",
    wave: 1,
    defaultsPath: fixture.defaultsPath,
    confirmation: EXECUTE_PHASE_CLAIM_CONFIRMATION,
    previewFingerprint: otherPreview.fingerprint!
  });
  assert.equal(otherClaim.status, "blocked");
  assert.match(otherClaim.blockers.join("\n"), /different execute-phase session is already active/i);

  const recovered = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "claim",
    phase: "3",
    defaultsPath: fixture.defaultsPath,
    confirmation: EXECUTE_PHASE_CLAIM_CONFIRMATION,
    previewFingerprint: first.fingerprint!
  });
  assert.equal(recovered.status, "claimed", recovered.blockers.join("\n"));
  assert.equal(recovered.reused, true);
  assert.equal(recovered.session?.sessionId, "orphan-session");
});

test("a later orphaned claim is recovered after prior terminal session history", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const prior = await executeFixturePlan(fixture, "prior-terminal-session");
  const finalized = await blueprintPhaseExecutionFinalize({
    cwd: fixture.repoPath,
    sessionId: prior.session!.sessionId,
    planId: "01"
  }, {
    artifactValidate: async () => ({
      valid: true,
      issues: [],
      diagnostics: [],
      suggestedRepairs: [],
      warnings: []
    })
  });
  assert.equal(finalized.status, "completed");

  const phaseDir = path.dirname(fixture.planPath);
  const secondPlan = planContent("src/second.ts")
    .replace('plan_id: "01"', 'plan_id: "02"')
    .replace("Plan 01", "Plan 02");
  await writeFile(path.join(fixture.repoPath, "src/second.ts"), "export const second = true;\n", "utf8");
  await writeFile(path.join(phaseDir, "03-02-PLAN.md"), secondPlan, "utf8");
  await git(fixture.repoPath, ["add", "."]);
  await git(fixture.repoPath, ["commit", "-m", "add later pending plan"]);

  const previewed = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "preview",
    phase: "3",
    defaultsPath: fixture.defaultsPath
  });
  assert.equal(previewed.status, "preview", previewed.blockers.join("\n"));
  const claimArgs = {
    cwd: fixture.repoPath,
    mode: "claim" as const,
    phase: "3",
    defaultsPath: fixture.defaultsPath,
    confirmation: EXECUTE_PHASE_CLAIM_CONFIRMATION,
    previewFingerprint: previewed.fingerprint!
  };
  const interrupted = await blueprintPhaseExecutionPrepare(claimArgs, {
    ...deterministicDependencies("later-orphan-session"),
    afterSessionPersisted: () => {
      throw new Error("injected later-claim crash");
    }
  });
  assert.equal(interrupted.status, "blocked");
  assert.match(interrupted.blockers.join("\n"), /injected later-claim crash/i);

  const recovered = await blueprintPhaseExecutionPrepare(
    claimArgs,
    deterministicDependencies("unused-retry-session")
  );
  assert.equal(recovered.status, "claimed", recovered.blockers.join("\n"));
  assert.equal(recovered.reused, true);
  assert.equal(recovered.session?.sessionId, "later-orphan-session");
});

test("corrupt index/session relationships fail closed instead of reusing wrong authority", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const first = await preview(fixture);
  const claimArgs = {
    cwd: fixture.repoPath,
    mode: "claim" as const,
    phase: "3",
    defaultsPath: fixture.defaultsPath,
    confirmation: EXECUTE_PHASE_CLAIM_CONFIRMATION,
    previewFingerprint: first.fingerprint!
  };
  const claimed = await blueprintPhaseExecutionPrepare(
    claimArgs,
    deterministicDependencies("corrupt-session")
  );
  assert.equal(claimed.status, "claimed", claimed.blockers.join("\n"));
  const indexPath = path.join(
    fixture.repoPath,
    ".blueprint/executions/execute-phase/index.json"
  );
  const index = JSON.parse(await readFile(indexPath, "utf8")) as {
    consumedFingerprints: Record<string, string>;
  };
  index.consumedFingerprints[first.fingerprint!] = "wrong-session";
  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  const result = await blueprintPhaseExecutionPrepare(claimArgs);
  assert.equal(result.status, "blocked");
  assert.match(result.blockers.join("\n"), /dangling|mismatched|inconsistent/i);
});

test("unavailable Git status fails closed through the injectable argv-safe process boundary", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const processRunner: PhaseExecutionControlDependencies["processRunner"] =
    async (command, argv, cwd) => {
      if (argv.includes("status")) {
        return {
          exitCode: 7,
          signal: null,
          stdout: "",
          stderr: "injected status failure"
        };
      }
      try {
        const { stdout, stderr } = await execFileAsync(command, [...argv], { cwd });
        return { exitCode: 0, signal: null, stdout, stderr };
      } catch (error) {
        const failure = error as Error & { code?: number; stdout?: string; stderr?: string };
        return {
          exitCode: failure.code ?? null,
          signal: null,
          stdout: failure.stdout ?? "",
          stderr: failure.stderr ?? failure.message
        };
      }
    };

  const result = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "preview",
    phase: "3",
    defaultsPath: fixture.defaultsPath
  }, { processRunner });

  assert.equal(result.status, "blocked");
  assert.match(result.blockers.join("\n"), /Git status is unavailable.*injected status failure/i);
  assert.equal(result.fingerprint, null);
});

test("the repo lock admits only one of two different concurrent claims", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const defaultPreview = await preview(fixture);
  const wavePreview = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "preview",
    phase: "3",
    wave: 1,
    defaultsPath: fixture.defaultsPath
  });
  assert.notEqual(defaultPreview.fingerprint, wavePreview.fingerprint);
  let id = 0;
  const deps: Partial<PhaseExecutionControlDependencies> = {
    createSessionId: () => `concurrent-${++id}`,
    now: () => "2026-07-16T01:00:00.000Z"
  };

  const results = await Promise.all([
    blueprintPhaseExecutionPrepare({
      cwd: fixture.repoPath,
      mode: "claim",
      phase: "3",
      defaultsPath: fixture.defaultsPath,
      confirmation: EXECUTE_PHASE_CLAIM_CONFIRMATION,
      previewFingerprint: defaultPreview.fingerprint!
    }, deps),
    blueprintPhaseExecutionPrepare({
      cwd: fixture.repoPath,
      mode: "claim",
      phase: "3",
      wave: 1,
      defaultsPath: fixture.defaultsPath,
      confirmation: EXECUTE_PHASE_CLAIM_CONFIRMATION,
      previewFingerprint: wavePreview.fingerprint!
    }, deps)
  ]);

  assert.equal(results.filter((result) => result.status === "claimed").length, 1);
  const excluded = results.find((result) => result.status === "blocked");
  assert.ok(excluded);
  assert.match(excluded.blockers.join("\n"), /already active/i);
});

test("independent Node processes cannot create two active execute-phase claims", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const moduleUrl = pathToFileURL(
    path.join(process.cwd(), "src/mcp/tools/phase-execution-control.ts")
  ).href;
  const script = `
const control = await import(process.env.CONTROL_MODULE_URL);
const wave = process.env.CLAIM_WAVE === "default" ? undefined : 1;
const common = {
  cwd: process.env.CLAIM_REPO,
  phase: "3",
  wave,
  defaultsPath: process.env.CLAIM_DEFAULTS
};
const preview = await control.blueprintPhaseExecutionPrepare({ ...common, mode: "preview" });
const result = await control.blueprintPhaseExecutionPrepare({
  ...common,
  mode: "claim",
  confirmation: control.EXECUTE_PHASE_CLAIM_CONFIRMATION,
  previewFingerprint: preview.fingerprint
});
process.stdout.write(JSON.stringify({ status: result.status, blockers: result.blockers }));
`;
  const runChild = async (wave: "default" | "one") => {
    const { stdout } = await execFileAsync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          BLUEPRINT_GLOBAL_HOME: path.dirname(fixture.defaultsPath),
          CONTROL_MODULE_URL: moduleUrl,
          CLAIM_REPO: fixture.repoPath,
          CLAIM_DEFAULTS: fixture.defaultsPath,
          CLAIM_WAVE: wave
        }
      }
    );
    return JSON.parse(stdout) as { status: string; blockers: string[] };
  };

  const results = await Promise.all([runChild("default"), runChild("one")]);
  assert.equal(results.filter((result) => result.status === "claimed").length, 1);
  assert.equal(results.filter((result) => result.status === "blocked").length, 1);
  assert.match(
    results.find((result) => result.status === "blocked")?.blockers.join("\n") ?? "",
    /already active/i
  );
});

test("unsafe authorized paths fail closed before a session can be created", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const targetResolver: PhaseExecutionControlDependencies["targetResolver"] = async (args) => {
    const target = await blueprintPhaseExecutionTargets(args);
    return {
      ...target,
      selectedPlans: target.selectedPlans.map((plan) => ({
        ...plan,
        filesModified: ["../outside.ts"]
      }))
    };
  };

  const result = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "preview",
    phase: "3",
    defaultsPath: fixture.defaultsPath
  }, { targetResolver });

  assert.equal(result.status, "blocked");
  assert.match(result.blockers.join("\n"), /unsafe execution path/i);
  await assert.rejects(
    readFile(path.join(fixture.repoPath, ".blueprint/executions/execute-phase/index.json"), "utf8"),
    /ENOENT/
  );
});

test("execute-phase applies a claimed preimage and verifies only the packet-bound command", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const claimed = await claim(fixture, "apply-verify-session");
  const packetPlan = claimed.packet!.selectedPlans[0]!;
  const expectedHash = packetPlan.ownedFilePreimages.find(
    (entry) => entry.path === "src/feature.ts"
  )!.sha256;

  const applied = await blueprintPhaseExecutionApply({
    cwd: fixture.repoPath,
    sessionId: claimed.session!.sessionId,
    planId: "01",
    mutations: [{
      path: "src/feature.ts",
      operation: "write",
      content: "export const feature = 'executed';\n",
      expectedHash
    }]
  });
  assert.equal(applied.status, "mutated", applied.failure ?? "");
  assert.equal(applied.attempt, 1);
  assert.equal(applied.receipts[0]?.beforeHash, expectedHash);
  assert.equal(
    applied.receipts[0]?.afterHash,
    createHash("sha256").update("export const feature = 'executed';\n").digest("hex")
  );
  const resumedAfterMutation = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "resume",
    sessionId: claimed.session!.sessionId
  });
  assert.equal(
    resumedAfterMutation.status,
    "resumed",
    resumedAfterMutation.blockers.join("\n")
  );

  const invocations: Array<{ command: string; argv: readonly string[] }> = [];
  const processRunner: PhaseExecutionProcessRunner = async (command, argv) => {
    invocations.push({ command, argv });
    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      stdout: "verified\n",
      stderr: ""
    };
  };
  const verified = await blueprintPhaseExecutionVerify({
    cwd: fixture.repoPath,
    sessionId: claimed.session!.sessionId,
    planId: "01"
  }, { processRunner });
  assert.equal(verified.status, "verified", verified.failure ?? "");
  assert.deepEqual(invocations, [{ command: "/bin/sh", argv: ["-c", "node verify.mjs"] }]);

  const session = JSON.parse(await readFile(
    path.join(
      fixture.repoPath,
      `.blueprint/executions/execute-phase/sessions/${claimed.session!.sessionId}.json`
    ),
    "utf8"
  )) as { execution: { plans: { "01": { status: string; mutationReceipts: unknown[]; verificationReceipts: unknown[] } } } };
  assert.equal(session.execution.plans["01"].status, "verified");
  assert.equal(session.execution.plans["01"].mutationReceipts.length, 1);
  assert.equal(session.execution.plans["01"].verificationReceipts.length, 1);
});

test("execute-phase refuses repo mutations that do not have an MCP receipt", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const claimed = await claim(fixture, "unreceipted-session");
  const featurePath = path.join(fixture.repoPath, "src/feature.ts");
  await writeFile(featurePath, "export const feature = 'direct agent write';\n", "utf8");

  await assert.rejects(
    blueprintPhaseExecutionApply({
      cwd: fixture.repoPath,
      sessionId: claimed.session!.sessionId,
      planId: "01",
      mutations: [{
        path: "src/feature.ts",
        operation: "write",
        content: "export const feature = 'attempted overwrite';\n",
        expectedHash: claimed.packet!.selectedPlans[0]!.ownedFilePreimages[0]!.sha256
      }]
    }),
    /changes without MCP receipts|preimage drifted outside MCP ownership/i
  );
  assert.equal(await readFile(featurePath, "utf8"), "export const feature = 'direct agent write';\n");
});

test("execute-phase permits exactly one repair and blocks after the second failed verification", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const claimed = await claim(fixture, "repair-session");
  const beforeHash = claimed.packet!.selectedPlans[0]!.ownedFilePreimages[0]!.sha256;
  const firstContent = "export const feature = 'first attempt';\n";
  const repairedContent = "export const feature = 'repair attempt';\n";
  await blueprintPhaseExecutionApply({
    cwd: fixture.repoPath,
    sessionId: claimed.session!.sessionId,
    planId: "01",
    mutations: [{
      path: "src/feature.ts",
      operation: "write",
      content: firstContent,
      expectedHash: beforeHash
    }]
  });
  const failingRunner: PhaseExecutionProcessRunner = async () => ({
    exitCode: 9,
    signal: null,
    timedOut: false,
    stdout: "",
    stderr: "hermetic failure\n"
  });
  const firstFailure = await blueprintPhaseExecutionVerify({
    cwd: fixture.repoPath,
    sessionId: claimed.session!.sessionId,
    planId: "01"
  }, { processRunner: failingRunner });
  assert.equal(firstFailure.status, "awaiting-repair");
  assert.equal(firstFailure.attempt, 1);

  const repaired = await blueprintPhaseExecutionApply({
    cwd: fixture.repoPath,
    sessionId: claimed.session!.sessionId,
    planId: "01",
    mutations: [{
      path: "src/feature.ts",
      operation: "write",
      content: repairedContent,
      expectedHash: createHash("sha256").update(firstContent).digest("hex")
    }]
  });
  assert.equal(repaired.status, "mutated");
  assert.equal(repaired.attempt, 2);
  const secondFailure = await blueprintPhaseExecutionVerify({
    cwd: fixture.repoPath,
    sessionId: claimed.session!.sessionId,
    planId: "01"
  }, { processRunner: failingRunner });
  assert.equal(secondFailure.status, "blocked");
  assert.equal(secondFailure.attempt, 2);
  await assert.rejects(
    blueprintPhaseExecutionVerify({
      cwd: fixture.repoPath,
      sessionId: claimed.session!.sessionId,
      planId: "01"
    }, { processRunner: failingRunner }),
    /not active|already exhausted/i
  );
  const finalized = await blueprintPhaseExecutionFinalize({
    cwd: fixture.repoPath,
    sessionId: claimed.session!.sessionId,
    planId: "01"
  }, {
    artifactValidate: async () => ({
      valid: true,
      issues: [],
      diagnostics: [],
      suggestedRepairs: [],
      warnings: []
    })
  });
  assert.equal(finalized.status, "blocked");
  const blockedSummary = await readFile(path.join(fixture.repoPath, finalized.summaryPath), "utf8");
  assert.match(blockedSummary, /\*\*Status:\*\* BLOCKED/);
  assert.match(blockedSummary, /exit 9/i);
});

test("execute-phase binds summary overwrite approval into the preview fingerprint", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const targetResolver: PhaseExecutionControlDependencies["targetResolver"] = async (args) => {
    const target = await blueprintPhaseExecutionTargets(args);
    return {
      ...target,
      overwriteCandidatePlanIds: ["01"]
    };
  };
  const blocked = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "preview",
    phase: "3",
    defaultsPath: fixture.defaultsPath
  }, { targetResolver });
  assert.equal(blocked.status, "blocked");
  assert.match(blocked.blockers.join("\n"), /overwrite confirmation.*01/i);

  const confirmed = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "preview",
    phase: "3",
    defaultsPath: fixture.defaultsPath,
    overwriteConfirmedPlanIds: ["01"]
  }, { targetResolver });
  assert.equal(confirmed.status, "preview", confirmed.blockers.join("\n"));
  assert.notEqual(confirmed.fingerprint, blocked.fingerprint);
  assert.deepEqual(confirmed.packet?.options.overwriteConfirmedPlanIds, ["01"]);
});

test("execute-phase derives and persists a completed summary, index projection, and synced state", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const claimed = await executeFixturePlan(fixture, "finalize-session");
  const result = await blueprintPhaseExecutionFinalize({
    cwd: fixture.repoPath,
    sessionId: claimed.session!.sessionId,
    planId: "01"
  }, {
    artifactValidate: async () => ({
      valid: true,
      issues: [],
      diagnostics: [],
      suggestedRepairs: [],
      warnings: []
    })
  });

  assert.equal(result.status, "completed", result.failure ?? "");
  assert.equal(result.persistenceStage, "done");
  assert.equal(result.nextPlanId, null);
  const summary = await readFile(path.join(fixture.repoPath, result.summaryPath), "utf8");
  assert.match(summary, /\*\*Status:\*\* COMPLETED/);
  assert.match(summary, /node verify\.mjs \| pass/);
  assert.match(summary, /src\/feature\.ts/);
  const state = await readFile(path.join(fixture.repoPath, ".blueprint/STATE.md"), "utf8");
  assert.match(state, /blueprint_state_version: 1\.0/);
  assert.doesNotMatch(state, /Next action: Run execute phase 3/);
  const index = JSON.parse(await readFile(
    path.join(fixture.repoPath, ".blueprint/executions/execute-phase/index.json"),
    "utf8"
  )) as { activeSessionId: string | null };
  assert.equal(index.activeSessionId, null);
});

test("execute-phase persistence resumes idempotently after every durable stage boundary", async (t) => {
  const stages = ["summary-write", "summary-index", "artifact-validate", "state-update"] as const;
  for (const stage of stages) {
    await t.test(stage, async () => {
      const fixture = await createFixture();
      try {
        const claimed = await executeFixturePlan(fixture, `resume-${stage}`);
        let injected = false;
        await assert.rejects(
          blueprintPhaseExecutionFinalize({
            cwd: fixture.repoPath,
            sessionId: claimed.session!.sessionId,
            planId: "01"
          }, {
            artifactValidate: async () => ({
              valid: true,
              issues: [],
              diagnostics: [],
              suggestedRepairs: [],
              warnings: []
            }),
            afterStage: (observed) => {
              if (!injected && observed === stage) {
                injected = true;
                throw new Error(`injected ${stage} interruption`);
              }
            }
          }),
          new RegExp(`injected ${stage} interruption`)
        );
        const resumed = await blueprintPhaseExecutionFinalize({
          cwd: fixture.repoPath,
          sessionId: claimed.session!.sessionId,
          planId: "01"
        }, {
          artifactValidate: async () => ({
            valid: true,
            issues: [],
            diagnostics: [],
            suggestedRepairs: [],
            warnings: []
          })
        });
        assert.equal(resumed.status, "completed", resumed.failure ?? "");
        const phaseFiles = await readdir(path.join(fixture.repoPath, ".blueprint/phases/03-execute-control"));
        assert.equal(phaseFiles.filter((entry) => entry.endsWith("-SUMMARY.md")).length, 1);
      } finally {
        await cleanupFixture(fixture);
      }
    });
  }
});

test("execute-phase revalidates authority before resuming a persistence stage", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const claimed = await executeFixturePlan(fixture, "persistence-drift-session");
  await assert.rejects(
    blueprintPhaseExecutionFinalize({
      cwd: fixture.repoPath,
      sessionId: claimed.session!.sessionId,
      planId: "01"
    }, {
      artifactValidate: async () => ({
        valid: true,
        issues: [],
        diagnostics: [],
        suggestedRepairs: [],
        warnings: []
      }),
      afterStage: (stage) => {
        if (stage === "summary-write") throw new Error("injected persistence pause");
      }
    }),
    /injected persistence pause/i
  );
  await writeFile(path.join(fixture.repoPath, "unreceipted.txt"), "drift\n", "utf8");
  await assert.rejects(
    blueprintPhaseExecutionFinalize({
      cwd: fixture.repoPath,
      sessionId: claimed.session!.sessionId,
      planId: "01"
    }, {
      artifactValidate: async () => ({
        valid: true,
        issues: [],
        diagnostics: [],
        suggestedRepairs: [],
        warnings: []
      })
    }),
    /changes without MCP receipts/i
  );
});

test("execute-phase binds persistence output digests and rechecks authority between stages", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const claimed = await executeFixturePlan(fixture, "stage-tamper-session");
  let tampered = false;
  await assert.rejects(
    blueprintPhaseExecutionFinalize({
      cwd: fixture.repoPath,
      sessionId: claimed.session!.sessionId,
      planId: "01"
    }, {
      artifactValidate: async () => ({
        valid: true,
        issues: [],
        diagnostics: [],
        suggestedRepairs: [],
        warnings: []
      }),
      afterStage: async (stage) => {
        if (stage === "summary-write" && !tampered) {
          tampered = true;
          const summaryPath = path.join(
            fixture.repoPath,
            ".blueprint/phases/03-execute-control/03-01-SUMMARY.md"
          );
          await writeFile(summaryPath, `${await readFile(summaryPath, "utf8")}\n<!-- tampered -->\n`, "utf8");
        }
      }
    }),
    /persisted summary receipt drifted/i
  );
});

test("execute-phase resume rejects a drifted persisted summary receipt", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const claimed = await executeFixturePlan(fixture, "resume-summary-tamper-session");
  await assert.rejects(
    blueprintPhaseExecutionFinalize({
      cwd: fixture.repoPath,
      sessionId: claimed.session!.sessionId,
      planId: "01"
    }, {
      artifactValidate: async () => ({
        valid: true,
        issues: [],
        diagnostics: [],
        suggestedRepairs: [],
        warnings: []
      }),
      afterStage: (stage) => {
        if (stage === "summary-write") throw new Error("injected summary persistence pause");
      }
    }),
    /injected summary persistence pause/i
  );
  const summaryPath = path.join(
    fixture.repoPath,
    ".blueprint/phases/03-execute-control/03-01-SUMMARY.md"
  );
  await writeFile(summaryPath, `${await readFile(summaryPath, "utf8")}\n<!-- tampered -->\n`, "utf8");

  const resumed = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "resume",
    sessionId: claimed.session!.sessionId
  });
  assert.equal(resumed.status, "stale");
  assert.match(resumed.blockers.join("\n"), /persisted summary receipt drifted/i);
});

test("execute-phase binds synced STATE before terminal release", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const claimed = await executeFixturePlan(fixture, "state-tamper-session");
  await assert.rejects(
    blueprintPhaseExecutionFinalize({
      cwd: fixture.repoPath,
      sessionId: claimed.session!.sessionId,
      planId: "01"
    }, {
      artifactValidate: async () => ({
        valid: true,
        issues: [],
        diagnostics: [],
        suggestedRepairs: [],
        warnings: []
      }),
      afterStage: async (stage) => {
        if (stage === "state-update") {
          const statePath = path.join(fixture.repoPath, ".blueprint/STATE.md");
          await writeFile(statePath, `${await readFile(statePath, "utf8")}\n<!-- tampered -->\n`, "utf8");
        }
      }
    }),
    /persisted state receipt drifted/i
  );
});

test("execute-phase rejects STATE drift before the prepared state effect begins", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const claimed = await executeFixturePlan(fixture, "state-pre-effect-tamper-session");
  await assert.rejects(
    blueprintPhaseExecutionFinalize({
      cwd: fixture.repoPath,
      sessionId: claimed.session!.sessionId,
      planId: "01"
    }, {
      artifactValidate: async () => ({
        valid: true,
        issues: [],
        diagnostics: [],
        suggestedRepairs: [],
        warnings: []
      }),
      afterStage: (stage) => {
        if (stage === "artifact-validate") throw new Error("pause before STATE preparation");
      }
    }),
    /pause before STATE preparation/i
  );
  const statePath = path.join(fixture.repoPath, ".blueprint/STATE.md");
  await writeFile(
    statePath,
    `${await readFile(statePath, "utf8")}\n## Roadmap Evolution Notes\n\n- unreceipted edit\n`,
    "utf8"
  );

  const resumed = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "resume",
    sessionId: claimed.session!.sessionId
  });
  assert.equal(resumed.status, "stale");
  assert.match(resumed.blockers.join("\n"), /changes without MCP receipts|authority artifact drifted/i);
});

test("execute-phase rejects forged COMPLETED session state without passing bound receipts", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const claimed = await claim(fixture, "forged-completion-session");
  const sessionPath = path.join(
    fixture.repoPath,
    `.blueprint/executions/execute-phase/sessions/${claimed.session!.sessionId}.json`
  );
  const session = JSON.parse(await readFile(sessionPath, "utf8")) as {
    status: string;
    execution: { plans: { "01": { status: string; applyAttempts: number; failure: string | null } } };
  };
  session.status = "executing";
  session.execution.plans["01"].status = "verified";
  session.execution.plans["01"].applyAttempts = 1;
  session.execution.plans["01"].failure = null;
  await writeFile(sessionPath, `${JSON.stringify(session, null, 2)}\n`, "utf8");

  await assert.rejects(
    blueprintPhaseExecutionFinalize({
      cwd: fixture.repoPath,
      sessionId: claimed.session!.sessionId,
      planId: "01"
    }),
    /session is malformed/i
  );
});

test("execute-phase rejects a minimal forged passing verification receipt", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const claimed = await claim(fixture, "forged-minimal-receipt-session");
  const sessionPath = path.join(
    fixture.repoPath,
    `.blueprint/executions/execute-phase/sessions/${claimed.session!.sessionId}.json`
  );
  const session = JSON.parse(await readFile(sessionPath, "utf8")) as any;
  const owned = claimed.packet!.selectedPlans[0]!.ownedFilePreimages[0]!;
  const progress = session.execution.plans["01"];
  session.status = "executing";
  progress.status = "verified";
  progress.applyAttempts = 1;
  progress.verificationAttempts = 1;
  progress.mutationReceipts = [{
    path: owned.path,
    operation: "write",
    beforeHash: owned.sha256,
    beforeMode: owned.mode,
    afterHash: owned.sha256,
    afterMode: owned.mode,
    bytesWritten: owned.sizeBytes
  }];
  progress.verificationReceipts = [[{ command: "node verify.mjs", passed: true }]];
  progress.failure = null;
  await writeFile(sessionPath, `${JSON.stringify(session, null, 2)}\n`, "utf8");

  await assert.rejects(
    blueprintPhaseExecutionFinalize({
      cwd: fixture.repoPath,
      sessionId: claimed.session!.sessionId,
      planId: "01"
    }),
    /session is malformed/i
  );
});

test("execute-phase rejects chmod drift on a mutation-receipted path", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const claimed = await claim(fixture, "mode-drift-session");
  await blueprintPhaseExecutionApply({
    cwd: fixture.repoPath,
    sessionId: claimed.session!.sessionId,
    planId: "01",
    mutations: [{
      path: "src/feature.ts",
      operation: "write",
      content: "export const feature = 'mode bound';\n",
      expectedHash: claimed.packet!.selectedPlans[0]!.ownedFilePreimages[0]!.sha256
    }]
  });
  await chmod(path.join(fixture.repoPath, "src/feature.ts"), 0o600);
  await assert.rejects(
    blueprintPhaseExecutionVerify({
      cwd: fixture.repoPath,
      sessionId: claimed.session!.sessionId,
      planId: "01"
    }, { processRunner: passingRunner }),
    /preimage drifted outside MCP ownership/i
  );
});

test("execute-phase rejects chmod drift in an interrupted committed mutation", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const claimed = await claim(fixture, "interrupted-mode-drift-session");
  const owned = claimed.packet!.selectedPlans[0]!.ownedFilePreimages[0]!;
  const content = "export const feature = 'committed before crash';\n";
  const sessionPath = path.join(
    fixture.repoPath,
    `.blueprint/executions/execute-phase/sessions/${claimed.session!.sessionId}.json`
  );
  const session = JSON.parse(await readFile(sessionPath, "utf8")) as any;
  session.status = "executing";
  session.execution.plans["01"].status = "applying";
  session.execution.plans["01"].pendingMutations = [{
    path: owned.path,
    operation: "write",
    content,
    expectedHash: owned.sha256,
    expectedMode: owned.mode,
    expectedAfterMode: owned.mode
  }];
  await writeFile(sessionPath, `${JSON.stringify(session, null, 2)}\n`, "utf8");
  await writeFile(path.join(fixture.repoPath, owned.path), content, "utf8");
  await chmod(path.join(fixture.repoPath, owned.path), owned.mode === 0o600 ? 0o644 : 0o600);

  const resumed = await blueprintPhaseExecutionPrepare({
    cwd: fixture.repoPath,
    mode: "resume",
    sessionId: claimed.session!.sessionId
  });
  assert.equal(resumed.status, "stale");
  assert.match(resumed.blockers.join("\n"), /mixed or unknown repository postimage/i);
});

test("execute-phase durably consumes an interrupted verification attempt before any replay", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const claimed = await claim(fixture, "verification-crash-session");
  const beforeHash = claimed.packet!.selectedPlans[0]!.ownedFilePreimages[0]!.sha256;
  const firstContent = "export const feature = 'before verification crash';\n";
  await blueprintPhaseExecutionApply({
    cwd: fixture.repoPath,
    sessionId: claimed.session!.sessionId,
    planId: "01",
    mutations: [{
      path: "src/feature.ts",
      operation: "write",
      content: firstContent,
      expectedHash: beforeHash
    }]
  });
  await assert.rejects(
    blueprintPhaseExecutionVerify({
      cwd: fixture.repoPath,
      sessionId: claimed.session!.sessionId,
      planId: "01"
    }, {
      processRunner: async () => {
        throw new Error("simulated process boundary crash");
      }
    }),
    /simulated process boundary crash/i
  );
  const durable = JSON.parse(await readFile(
    path.join(
      fixture.repoPath,
      `.blueprint/executions/execute-phase/sessions/${claimed.session!.sessionId}.json`
    ),
    "utf8"
  )) as { execution: { plans: { "01": { status: string; verificationAttempts: number } } } };
  assert.equal(durable.execution.plans["01"].status, "verifying");
  assert.equal(durable.execution.plans["01"].verificationAttempts, 1);

  let replayed = false;
  const recovered = await blueprintPhaseExecutionVerify({
    cwd: fixture.repoPath,
    sessionId: claimed.session!.sessionId,
    planId: "01"
  }, {
    processRunner: async () => {
      replayed = true;
      return passingRunner("/bin/sh", [], fixture.repoPath, {}, 1);
    }
  });
  assert.equal(recovered.status, "awaiting-repair");
  assert.equal(recovered.attempt, 1);
  assert.equal(replayed, false);

  await blueprintPhaseExecutionApply({
    cwd: fixture.repoPath,
    sessionId: claimed.session!.sessionId,
    planId: "01",
    mutations: [{
      path: "src/feature.ts",
      operation: "write",
      content: "export const feature = 'after verification crash repair';\n",
      expectedHash: createHash("sha256").update(firstContent).digest("hex")
    }]
  });
  const verified = await blueprintPhaseExecutionVerify({
    cwd: fixture.repoPath,
    sessionId: claimed.session!.sessionId,
    planId: "01"
  }, { processRunner: passingRunner });
  assert.equal(verified.status, "verified");
  assert.equal(verified.attempt, 2);
});

test("execute-phase advances across two plans and recovers a second STATE write before receipt checkpoint", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const phaseDir = path.dirname(fixture.planPath);
  const secondPlan = planContent("src/second.ts")
    .replace('plan_id: "01"', 'plan_id: "02"')
    .replace("Plan 01", "Plan 02");
  await writeFile(path.join(fixture.repoPath, "src/second.ts"), "export const second = true;\n", "utf8");
  await writeFile(path.join(phaseDir, "03-02-PLAN.md"), secondPlan, "utf8");
  await git(fixture.repoPath, ["add", "."]);
  await git(fixture.repoPath, ["commit", "-m", "add second plan"]);
  const claimed = await claim(fixture, "two-plan-session");
  assert.deepEqual(claimed.packet!.selection.selectedPlanIds, ["01", "02"]);

  for (const planId of ["01", "02"] as const) {
    const packetPlan = claimed.packet!.selectedPlans.find((plan) => plan.planId === planId)!;
    const owned = packetPlan.ownedFilePreimages[0]!;
    await blueprintPhaseExecutionApply({
      cwd: fixture.repoPath,
      sessionId: claimed.session!.sessionId,
      planId,
      mutations: [{
        path: owned.path,
        operation: "write",
        content: `export const executedPlan = '${planId}';\n`,
        expectedHash: owned.sha256
      }]
    });
    await blueprintPhaseExecutionVerify({
      cwd: fixture.repoPath,
      sessionId: claimed.session!.sessionId,
      planId
    }, { processRunner: passingRunner });
    const finalizeArgs = {
      cwd: fixture.repoPath,
      sessionId: claimed.session!.sessionId,
      planId
    };
    const finalizeDependencies = {
      artifactValidate: async () => ({
        valid: true,
        issues: [],
        diagnostics: [],
        suggestedRepairs: [],
        warnings: []
      })
    };
    if (planId === "02") {
      await assert.rejects(
        blueprintPhaseExecutionFinalize(finalizeArgs, {
          ...finalizeDependencies,
          stateWrite: async (prepared) => {
            await writePreparedBlueprintStateUpdate(prepared);
            throw new Error("injected crash after second STATE write");
          }
        }),
        /injected crash after second STATE write/i
      );
      const resumed = await blueprintPhaseExecutionPrepare({
        cwd: fixture.repoPath,
        mode: "resume",
        sessionId: claimed.session!.sessionId
      });
      assert.equal(resumed.status, "resumed", resumed.blockers.join("\n"));
    }
    const finalized = await blueprintPhaseExecutionFinalize(finalizeArgs, finalizeDependencies);
    assert.equal(finalized.status, planId === "01" ? "advanced" : "completed");
    assert.equal(finalized.nextPlanId, planId === "01" ? "02" : null);
  }
  const finalSummary = await readFile(path.join(phaseDir, "03-02-SUMMARY.md"), "utf8");
  assert.match(finalSummary, /\*\*Next Safe Action:\*\* \/blu-validate-phase 3/);
});

test("execute-phase carries cumulative receipts across sequential overlapping plans", async (t) => {
  const fixture = await createFixture();
  t.after(() => cleanupFixture(fixture));
  const phaseDir = path.dirname(fixture.planPath);
  const secondPlan = planContent("src/feature.ts")
    .replace('plan_id: "01"', 'plan_id: "02"')
    .replace("Plan 01", "Plan 02");
  await writeFile(path.join(phaseDir, "03-02-PLAN.md"), secondPlan, "utf8");
  await git(fixture.repoPath, ["add", "."]);
  await git(fixture.repoPath, ["commit", "-m", "add overlapping plan"]);
  const claimed = await claim(fixture, "overlapping-plan-session");
  assert.deepEqual(claimed.packet!.selection.selectedPlanIds, ["01", "02"]);

  let expectedHash = claimed.packet!.selectedPlans[0]!.ownedFilePreimages[0]!.sha256;
  for (const planId of ["01", "02"] as const) {
    const applied = await blueprintPhaseExecutionApply({
      cwd: fixture.repoPath,
      sessionId: claimed.session!.sessionId,
      planId,
      mutations: [{
        path: "src/feature.ts",
        operation: "write",
        content: `export const overlappingPlan = '${planId}';\n`,
        expectedHash
      }]
    });
    assert.equal(applied.status, "mutated", applied.failure ?? "");
    expectedHash = applied.receipts.at(-1)!.afterHash;
    await blueprintPhaseExecutionVerify({
      cwd: fixture.repoPath,
      sessionId: claimed.session!.sessionId,
      planId
    }, { processRunner: passingRunner });
    const finalized = await blueprintPhaseExecutionFinalize({
      cwd: fixture.repoPath,
      sessionId: claimed.session!.sessionId,
      planId
    }, {
      artifactValidate: async () => ({
        valid: true,
        issues: [],
        diagnostics: [],
        suggestedRepairs: [],
        warnings: []
      })
    });
    assert.equal(finalized.status, planId === "01" ? "advanced" : "completed");
  }
});
