import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  PLAN_RUN_SCHEMA_VERSION,
  assertPlanRunSchemaVersion,
  buildPlanRunDiffPath,
  buildPlanRunIndexPath,
  buildPlanRunRecordPath,
  buildPlanRunReviewPath,
  buildPlanRunRollbackPath,
  buildPlanRunRootPath,
  normalizePlanRunId,
  normalizePlanRunPhase,
  normalizePlanRunPlanId
} from "../src/mcp/tools/plan-run.js";

async function withTempProjectRoot(
  callback: (projectRoot: string) => Promise<void> | void
): Promise<void> {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-plan-run-paths-"));

  try {
    await callback(projectRoot);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
}

function relative(projectRoot: string, absolutePath: string): string {
  return path.relative(projectRoot, absolutePath).replaceAll(path.sep, "/");
}

test("normalizes phase and plan identifiers for plan-run paths", () => {
  assert.equal(normalizePlanRunPhase("03"), "3");
  assert.equal(normalizePlanRunPhase("03.0"), "3");
  assert.equal(normalizePlanRunPlanId("2"), "02");
  assert.equal(normalizePlanRunPlanId(12), "12");
});

test("rejects path traversal and absolute-looking run ids", () => {
  assert.throws(() => normalizePlanRunId("../escape"), /Plan run id/);
  assert.throws(() => normalizePlanRunId("nested/run"), /Plan run id/);
  assert.throws(() => normalizePlanRunId("/tmp/run"), /Plan run id/);
  assert.throws(() => normalizePlanRunId("Run-01"), /Plan run id/);
});

test("builds canonical plan-run paths under .blueprint/runs", async () => {
  await withTempProjectRoot((projectRoot) => {
    const runId = "run-01";

    assert.equal(
      relative(projectRoot, buildPlanRunRootPath(projectRoot, "3", "2")),
      ".blueprint/runs/phase-3/plan-02"
    );
    assert.equal(
      relative(projectRoot, buildPlanRunIndexPath(projectRoot, "3", "2")),
      ".blueprint/runs/phase-3/plan-02/RUNS.json"
    );
    assert.equal(
      relative(projectRoot, buildPlanRunRecordPath(projectRoot, "3", "2", runId)),
      ".blueprint/runs/phase-3/plan-02/run-01.json"
    );
    assert.equal(
      relative(projectRoot, buildPlanRunDiffPath(projectRoot, "3", "2", runId)),
      ".blueprint/runs/phase-3/plan-02/run-01-DIFF.md"
    );
    assert.equal(
      relative(projectRoot, buildPlanRunReviewPath(projectRoot, "3", "2", runId)),
      ".blueprint/runs/phase-3/plan-02/run-01-REVIEW.md"
    );
    assert.equal(
      relative(projectRoot, buildPlanRunRollbackPath(projectRoot, "3", "2", runId)),
      ".blueprint/runs/phase-3/plan-02/run-01-ROLLBACK.md"
    );
  });
});

test("plan-run path builders reject invalid phase and plan values", async () => {
  await withTempProjectRoot((projectRoot) => {
    assert.throws(
      () => buildPlanRunIndexPath(projectRoot, "../3", "01"),
      /numeric Blueprint phase reference/
    );
    assert.throws(
      () => buildPlanRunIndexPath(projectRoot, "3", "../01"),
      /Plan id must be numeric/
    );
    assert.throws(
      () => buildPlanRunRecordPath(projectRoot, "3", "01", "../run"),
      /Plan run id/
    );
  });
});

test("plan-run paths remain contained inside the runs root", async () => {
  await withTempProjectRoot((projectRoot) => {
    const rootPath = path.join(projectRoot, ".blueprint", "runs");
    const recordPath = buildPlanRunRecordPath(projectRoot, "3", "2", "run-01");
    const relation = path.relative(rootPath, recordPath);

    assert.equal(relation.startsWith(".."), false);
    assert.equal(path.isAbsolute(relation), false);
  });
});

test("schema version guard accepts version 1 and refuses unsupported versions", () => {
  assert.doesNotThrow(() => assertPlanRunSchemaVersion(PLAN_RUN_SCHEMA_VERSION));
  assert.throws(() => assertPlanRunSchemaVersion(2), /must equal 1/);
  assert.throws(() => assertPlanRunSchemaVersion("1"), /must equal 1/);
});
