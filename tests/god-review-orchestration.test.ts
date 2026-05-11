import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  GOD_REVIEW_GROUPS,
  blueprintGodReviewAppend,
  blueprintGodReviewNext,
  blueprintGodReviewStart,
  godReviewSessionSchema
} from "../src/mcp/tools/god-review.js";
import {
  createCommittedGitRepo,
  runGit
} from "./helpers/git-fixtures.js";

const repoRoot = process.cwd();

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function writeOrchestrationRepo(): Promise<string> {
  const repoPath = await createCommittedGitRepo("blueprint-god-review-orchestration-");

  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await writeFile(
    path.join(repoPath, "src/feature.ts"),
    "export const featureValue = 1;\n",
    "utf8"
  );
  await runGit(["add", "."], repoPath);
  await runGit(["commit", "-m", "feature"], repoPath);

  return repoPath;
}

async function readRelative(repoPath: string, relativePath: string): Promise<string> {
  return readFile(path.join(repoPath, relativePath), "utf8");
}

test("hidden code-review dispatcher defers start next and append orchestration to private skill", async () => {
  const manifest = await readRepoFile("commands/blu-code-review.toml");
  const publicSkill = await readRepoFile("skills/blueprint-review/SKILL.md");
  const privateSkill = await readRepoFile("skills/blueprint-god-review/SKILL.md");

  assert.match(manifest, /Follow `skills\/blueprint-god-review\/SKILL\.md`/);
  for (const privateTool of [
    /mcp_blueprint_blueprint_god_review_start/,
    /mcp_blueprint_blueprint_god_review_next/,
    /mcp_blueprint_blueprint_god_review_append/
  ]) {
    assert.doesNotMatch(manifest, privateTool);
    assert.doesNotMatch(publicSkill, privateTool);
    assert.match(privateSkill, privateTool);
  }

  assert.match(privateSkill, /one-group-at-a-time/);
  assert.match(privateSkill, /Review exactly one returned pending group per invocation/);
  assert.match(privateSkill, /terminal review status/);
  assert.match(manifest, /mcp_blueprint_blueprint_review_record/);
  assert.match(manifest, /XX-REVIEW\.md/);
});

test("hidden review tool chain starts, continues one group, and reaches terminal review state", async () => {
  const repoPath = await writeOrchestrationRepo();
  const start = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --files src/feature.ts",
    scopeKind: "explicit-files",
    files: ["src/feature.ts"],
    runId: "god-orchestration"
  });
  assert.equal(start.status, "started");
  assert.equal(start.nextGroupId, "correctness-contracts");

  const firstAppend = await blueprintGodReviewAppend({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --run-id god-orchestration --continue",
    runId: "god-orchestration",
    groupId: "correctness-contracts",
    status: "completed",
    findings: [
      {
        title: "Concrete first group finding",
        severity: "medium",
        disposition: "follow-up",
        files: ["src/feature.ts:1"],
        evidence: "The first group found a concrete issue."
      }
    ]
  });
  assert.equal(firstAppend.status, "appended");
  assert.equal(firstAppend.nextGroupId, "security-privacy-auth");

  const continuation = await blueprintGodReviewNext({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --run-id god-orchestration --continue",
    runId: "god-orchestration"
  });
  assert.equal(continuation.status, "ready");
  assert.equal(continuation.nextGroup?.id, "security-privacy-auth");
  assert.deepEqual(continuation.files, ["src/feature.ts"]);

  const secondAppend = await blueprintGodReviewAppend({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --run-id god-orchestration --continue",
    runId: "god-orchestration",
    groupId: "security-privacy-auth",
    status: "completed",
    findings: []
  });
  assert.equal(secondAppend.status, "appended");
  assert.equal(secondAppend.nextGroupId, "data-state-consistency");

  const reportAfterTwo = await readRelative(repoPath, start.reportPath!);
  assert.match(reportAfterTwo, /## GOD-COR Correctness And Contracts/);
  assert.match(reportAfterTwo, /## GOD-SEC Security, Privacy, And Authorization/);
  assert.doesNotMatch(reportAfterTwo, /## GOD-DAT Data, State, And Consistency/);

  let nextGroupId = secondAppend.nextGroupId;

  while (nextGroupId !== null) {
    const group = GOD_REVIEW_GROUPS.find((candidate) => candidate.id === nextGroupId);
    assert.ok(group);
    const append = await blueprintGodReviewAppend({
      cwd: repoPath,
      activeCommand: "/blu-code-review",
      rawInvocation:
        "/blu-code-review --feels-like-god --run-id god-orchestration --continue",
      runId: "god-orchestration",
      groupId: nextGroupId,
      status: "completed",
      findings: []
    });

    assert.equal(append.status, "appended");
    nextGroupId = append.nextGroupId;
  }

  const terminal = await blueprintGodReviewNext({
    cwd: repoPath,
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review --feels-like-god --run-id god-orchestration --continue",
    runId: "god-orchestration"
  });
  assert.equal(terminal.status, "complete");
  assert.equal(terminal.nextGroupId, null);
  const session = godReviewSessionSchema.parse(
    JSON.parse(await readRelative(repoPath, start.sessionPath!))
  );
  assert.equal(session.status, "completed");
  assert.equal(session.cleanup.reviewTerminal, true);
  assert.match(await readRelative(repoPath, start.humanStatePath!), /Review terminal: yes/);
});
