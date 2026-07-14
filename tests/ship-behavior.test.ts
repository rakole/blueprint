import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  blueprintShipExecute,
  blueprintShipPersist,
  blueprintShipPreview,
  shipToolTestHooks,
  type ShipPreviewArgs
} from "../src/mcp/tools/ship.js";
import { blueprintArtifactReportWrite, validateReportArtifactContent } from "../src/mcp/tools/artifacts.js";
import { blueprintConfigGet } from "../src/mcp/tools/config.js";
import type {
  QualityShippingProcessResult,
  QualityShippingProcessRunner
} from "../src/mcp/quality-shipping-safety.js";
import { qualityShippingSha256 } from "../src/mcp/quality-shipping-safety.js";
import { blueprintToolNames } from "../src/mcp/tool-definitions.js";
import { shouldLogMutationFailure } from "../src/mcp/mutation-failure-logging.js";
import { createToolResponseContent } from "../src/mcp/public-response.js";
import { sanitizeToolResultForPublicResponse } from "../src/mcp/response-sanitizer.js";
import {
  createQualityShippingGitFixture,
  type QualityShippingGitFixture
} from "./helpers/quality-shipping-git-fixture.js";

function result(exitCode: number | null, stdout = "", stderr = ""): QualityShippingProcessResult {
  return { exitCode, stdout, stderr, signal: null, timedOut: false };
}

type FakePr = {
  url: string;
  headRefName: string;
  baseRefName: string;
  isDraft: boolean;
  state: "OPEN";
  headRefOid: string;
};

type ShipFixture = {
  fixture: QualityShippingGitFixture;
  remotePath: string;
  baseOid: string;
  head: string;
  branch: string;
  calls: Array<{ command: string; argv: string[] }>;
  setPrFailure(value: QualityShippingProcessResult | null): void;
  setViewFailure(value: QualityShippingProcessResult | null): void;
  setPr(value: FakePr | null): void;
  runner: QualityShippingProcessRunner;
  previewArgs(overrides?: Partial<ShipPreviewArgs>): ShipPreviewArgs;
  writeEvidence(kind: "review" | "security", outcome?: "approved" | "blocking", head?: string, base?: string): Promise<string>;
  cleanup(): Promise<void>;
};

async function requireGit(fixture: QualityShippingGitFixture, argv: string[], cwd?: string): Promise<string> {
  const receipt = await fixture.runGit(argv, cwd);
  assert.equal(receipt.exitCode, 0, `${argv.join(" ")}: ${receipt.stderr}`);
  return receipt.stdout.trim();
}

async function createShipFixture(options: { pushCurrentHead?: boolean; secondRemote?: boolean; blueprintOnly?: boolean; codeReview?: boolean; securePhase?: boolean } = {}): Promise<ShipFixture> {
  const fixture = await createQualityShippingGitFixture("blueprint ship behavior ");
  if (options.codeReview !== undefined || options.securePhase !== undefined) {
    await fixture.commitFile(".blueprint/config.json", `${JSON.stringify({ version: 2, workflow: {
      ...(options.codeReview !== undefined ? { code_review: options.codeReview } : {}),
      ...(options.securePhase !== undefined ? { secure_phase: options.securePhase } : {})
    } }, null, 2)}\n`, "test: configure shipping gates");
  }
  const remotePath = path.join(fixture.root, "bare remote with spaces.git");
  await requireGit(fixture, ["init", "--bare", remotePath]);
  await requireGit(fixture, ["remote", "add", "origin", remotePath]);
  await requireGit(fixture, ["push", "origin", "main:refs/heads/main"]);
  const baseOid = await requireGit(fixture, ["rev-parse", "main"]);
  const branch = "codex/ship-fixture";
  await requireGit(fixture, ["checkout", "-b", branch]);
  await fixture.commitFile(options.blueprintOnly ? ".blueprint/notes/first.md" : "src/first.ts", "first\n", "feat: first shipping commit");
  await requireGit(fixture, ["push", "-u", "origin", `${branch}:refs/heads/${branch}`]);
  let head = await fixture.commitFile(options.blueprintOnly ? ".blueprint/notes/second.md" : "src/second.ts", "second\n", "feat: second shipping commit");
  if (options.pushCurrentHead) await requireGit(fixture, ["push", "origin", `${head}:refs/heads/${branch}`]);
  if (options.secondRemote) {
    const second = path.join(fixture.root, "another remote.git");
    await requireGit(fixture, ["init", "--bare", second]);
    await requireGit(fixture, ["remote", "add", "backup", second]);
  }
  const calls: ShipFixture["calls"] = [];
  let pr: FakePr | null = null;
  let prFailure: QualityShippingProcessResult | null = null;
  let viewFailure: QualityShippingProcessResult | null = null;
  const runner: QualityShippingProcessRunner = async (command, argv, cwd) => {
    calls.push({ command, argv: [...argv] });
    if (command === "git") return fixture.runner(command, argv, cwd, fixture.env);
    if (argv[0] === "--version") return result(0, "gh version 9.9.9\n");
    if (argv[0] === "auth" && argv[1] === "status") return result(0, "authenticated\n");
    if (argv[0] === "repo" && argv[1] === "view") return result(0, `${JSON.stringify({ nameWithOwner: "blueprint/tests", url: "https://example.test/blueprint/tests" })}\n`);
    if (argv[0] === "pr" && argv[1] === "view") {
      if (viewFailure) return viewFailure;
      return pr ? result(0, `${JSON.stringify(pr)}\n`) : result(1, "", "no pull requests found");
    }
    if (argv[0] === "pr" && argv[1] === "create") {
      if (prFailure) return prFailure;
      pr = { url: "https://example.test/pull/17", headRefName: branch, baseRefName: "main",
        isDraft: argv.includes("--draft"), state: "OPEN", headRefOid: head };
      return result(0, `${pr.url}\n`);
    }
    return result(2, "", `unexpected gh argv ${JSON.stringify(argv)}`);
  };
  const phaseDir = ".blueprint/phases/01-test";
  const review = `${phaseDir}/01-REVIEW.md`;
  const security = `${phaseDir}/01-SECURITY.md`;
  const verification = `${phaseDir}/01-VERIFICATION.md`;
  const summary = `${phaseDir}/01-01-SUMMARY.md`;
  const plan = `${phaseDir}/01-01-PLAN.md`;
  const prBranch = ".blueprint/reports/pr-branch-latest.md";
  await mkdir(path.join(fixture.repoPath, phaseDir), { recursive: true });
  await mkdir(path.join(fixture.repoPath, ".blueprint/reports"), { recursive: true });
  await writeFile(path.join(fixture.repoPath, ".git/info/exclude"), ".blueprint/phases/\n", { flag: "a" });
  await writeFile(path.join(fixture.repoPath, summary), `# Phase 01: Test - Summary\n\n**Status:** COMPLETED\n\n## Changes Made\n\n- \`${options.blueprintOnly ? ".blueprint/notes/first.md" : "src/first.ts"}\`\n- \`${options.blueprintOnly ? ".blueprint/notes/second.md" : "src/second.ts"}\`\n`, "utf8");
  await writeFile(path.join(fixture.repoPath, plan), `# Phase 01 Plan 01: Test\n\n## Objective\n\n- Exercise deterministic shipping.\n\n## Files Modified\n\n- \`${options.blueprintOnly ? ".blueprint/notes/first.md" : "src/first.ts"}\`\n- \`${options.blueprintOnly ? ".blueprint/notes/second.md" : "src/second.ts"}\`\n`, "utf8");
  const reviewContent = (pass = true) => `# Phase 01: Test - Code Review

**Verdict:** ${pass ? "PASS" : "BLOCKED"}

## Review Summary

- Severity summary: critical 0, high 0, medium 0, low 0, unknown 0.

## Scope Reviewed

${options.blueprintOnly ? "- .blueprint/notes/first.md\n- .blueprint/notes/second.md" : "- src/first.ts\n- src/second.ts"}

## Evidence Reviewed

- ${summary}

## Positive Signals

- Current scope is clean and reviewable.

## Severity Summary

- critical: 0
- high: 0
- medium: 0
- low: 0
- unknown: 0

## Findings

- none

## Follow-Ups

- none

## Next Safe Action

- /blu-progress
`;
  const securityContent = (pass = true) => `# Phase 01: Test - Security

**Status:** ${pass ? "COMPLETED" : "BLOCKED"}
**Readiness:** ${pass ? "ready-for-routing" : "blocked"}
**Completion State:** ${pass ? "complete" : "blocked"}
**Next Safe Action:** /blu-verify-work 1

## Security Summary

- Security review completed without open threat debt.

## Evidence Reviewed

| Evidence | Status | Rationale |
|----------|--------|-----------|
| ${summary} | used | Saved implementation evidence was reviewed. |
| ${review} | used | The code review gate passed. |

## Threat Register

| Threat ID | Source Plan | Category | Component | Disposition | Mitigation | Status | Evidence | Verifier Note |
|-----------|-------------|----------|-----------|-------------|------------|--------|----------|---------------|
| none | none | none | none | none | none | NONE | none | none |

## Accepted Risks

| Threat ID | Rationale | Accepted By | Accepted At | Evidence |
|-----------|-----------|-------------|-------------|----------|
| none | none | none | none | none |

## Findings

| Kind | Severity | Threat ID | Status | Evidence | Recommendation |
|------|----------|-----------|--------|----------|----------------|
| none | none | none | NONE | none | none |

## Manual / Deferred Work

| Item | Reason | Follow-Up | Status |
|------|--------|-----------|--------|
| none | none | none | NONE |

## Gap / Repair Routes

| Gap | Evidence | Repair | Status |
|-----|----------|--------|--------|
| none | none | none | NONE |

## Follow-Ups

- none

## Security Audit Trail

- Audit date: 2026-07-14
- Execution mode: inline
- Overwrite gate: not-needed
- Verify-or-accept decision: verified
- Pending-open-threat status: none
- Verifier note: no open security follow-up remains.

## Next Safe Action

- /blu-verify-work 1
`;
  const verificationContent = `# Phase 01: Test - Verification

**Coverage:** Reviewed \`01-01-SUMMARY.md\` for completed shipping evidence.
**Gate State:** PASS
**Sign-off:** test verifier

## Validation Summary

- Saved execution evidence passes validation.

## Requirement / Task Coverage

| Requirement | Task or Check | Evidence | Coverage State | Notes |
|-------------|---------------|----------|----------------|-------|
| SHIP-01 | Verify shipping fixture | ${summary} | PASS | Saved summary backs this row. |

## Evidence Reviewed

- ${summary}

## Test Infrastructure / Evidence Metadata

- Harness: node:test
- Commands: npm run test:focused
- Evidence type: saved execution summary
- Test infrastructure status: available

## Manual-Only or Deferred Coverage

| Item | Why manual or deferred | Follow-Up | Status |
|------|------------------------|-----------|--------|
| none | none | none | NONE |

## Gate State

- Gate: PASS
- Sign-off: test verifier
- Readiness: ready for UAT

## Gap Classification

| Gap class | Scope | Evidence | Repair |
|-----------|-------|----------|--------|
| none | none | none | none |

## Gaps Found

- none

## Suggested Repairs

- none

## Next Safe Action

- /blu-verify-work 1
`;
  const refreshPrReceipt = async () => {
    const evidence = [review, security, verification];
    const digests = await Promise.all(evidence.map(async (evidencePath) => `${evidencePath}:${qualityShippingSha256(await readFile(path.join(fixture.repoPath, evidencePath), "utf8"))}`));
    await writeFile(path.join(fixture.repoPath, prBranch), `# PR Branch Report

## Source Branch

- Base branch: main (${baseOid})
- Source branch: ${branch}
- Source HEAD: ${head}

## Review Branch

- Candidate branch: ${branch}
- Created branch: ${branch} (${head})
- Current branch after run: ${branch}
- Current HEAD after run: ${head}
- Execution mode: confirmed-replay actual outcome

## Filtered Scope

- Digest inputs used: ${digests.join(", ")}

## Verification

- Clean review branch status: clean
- Clean final checkout status: clean
- Recovery or blocker: blockers=none; recovery=none
`, "utf8");
  };
  await writeFile(path.join(fixture.repoPath, review), reviewContent(), "utf8");
  await writeFile(path.join(fixture.repoPath, security), securityContent(), "utf8");
  await writeFile(path.join(fixture.repoPath, verification), verificationContent, "utf8");
  await refreshPrReceipt();
  const writeEvidence = async (kind: "review" | "security", outcome: "approved" | "blocking" = "approved", evidenceHead = head, evidenceBase = baseOid) => {
    const relative = kind === "review" ? review : security;
    const valid = outcome === "approved" && evidenceHead === head && evidenceBase === baseOid;
    await writeFile(path.join(fixture.repoPath, relative), kind === "review" ? reviewContent(valid) : securityContent(valid), "utf8");
    await refreshPrReceipt();
    return relative;
  };
  const evidenceInputs: ShipPreviewArgs["evidence"] = [
    { path: review, kind: "review" }, { path: security, kind: "security" },
    { path: verification, kind: "verification" }, { path: prBranch, kind: "pr-branch" }
  ];
  return {
    fixture, remotePath, baseOid, head, branch, calls, runner,
    setPrFailure(value) { prFailure = value; },
    setViewFailure(value) { viewFailure = value; },
    setPr(value) { pr = value; },
    previewArgs(overrides = {}) {
      return { cwd: fixture.repoPath, baseBranch: "main", remoteName: "origin", ghRepository: "example.test/blueprint/tests", posture: "draft", push: true,
        createPr: true, title: "Ship fixture", body: "Body grounded in evidence", evidence: evidenceInputs,
        overwriteReport: true, ...overrides };
    },
    writeEvidence,
    cleanup: fixture.cleanup
  };
}

async function withShipFixture(
  fn: (ship: ShipFixture) => Promise<void>,
  options?: Parameters<typeof createShipFixture>[0]
): Promise<void> {
  const ship = await createShipFixture(options);
  const restore = shipToolTestHooks.setProcessRunnerForTest(ship.runner);
  const restoreResolver = shipToolTestHooks.setRemoteSelectorResolverForTest((remoteUrl) => remoteUrl === ship.remotePath ? "example.test/blueprint/tests" : null);
  shipToolTestHooks.clearApprovalsForTest();
  try { await fn(ship); } finally { restoreResolver(); restore(); shipToolTestHooks.clearApprovalsForTest(); await ship.cleanup(); }
}

async function advanceRemoteHead(ship: ShipFixture): Promise<string> {
  const remoteLine = await requireGit(ship.fixture, ["ls-remote", "origin", `refs/heads/${ship.branch}`]);
  const parent = remoteLine.split(/\s+/, 1)[0]!;
  const tree = await requireGit(ship.fixture, ["rev-parse", `${ship.head}^{tree}`]);
  const advanced = await requireGit(ship.fixture, ["commit-tree", tree, "-p", parent, "-m", "remote advance"]);
  await requireGit(ship.fixture, ["push", "origin", `${advanced}:refs/heads/${ship.branch}`]);
  return advanced;
}

test("ship preview binds canonical repo, config, evidence, remote, report CAS, and exact argv; execute pushes then creates and verifies PR", async () => {
  await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs());
    assert.equal(preview.status, "ready", preview.blockers.join("\n"));
    assert.equal(preview.packet?.repoRoot, await realpath(ship.fixture.repoPath));
    assert.equal(preview.packet?.head, ship.head);
    assert.equal(preview.packet?.baseOid, ship.baseOid);
    assert.equal(preview.packet?.remote.fetchUrl, ship.remotePath);
    assert.equal(preview.packet?.remote.pushUrl, ship.remotePath);
    assert.equal(preview.packet?.upstream, `origin/${ship.branch}`);
    assert.ok(preview.packet?.blueprintConfig.sha256);
    assert.ok(preview.packet?.evidence[0]?.contentSha256);
    assert.deepEqual(preview.packet?.reviewablePaths, ["src/first.ts", "src/second.ts"]);
    assert.deepEqual(preview.packet?.executionPlan.map((entry) => entry.stage), ["push", "pr-create"]);
    assert.deepEqual(preview.packet?.executionPlan[0]?.argv, ["push", "--porcelain", "--", ship.remotePath, `${ship.head}:refs/heads/${ship.branch}`]);
    assert.deepEqual(preview.packet?.ghRepository, { selector: "example.test/blueprint/tests", url: "https://example.test/blueprint/tests" });
    assert.ok(preview.packet?.executionPlan[1]?.argv.includes("--repo"));

    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(executed.status, "succeeded", executed.blockers.join("\n"));
    assert.equal(executed.push.status, "pushed");
    assert.equal(executed.push.remoteHeadAfter, ship.head);
    assert.equal(executed.pr.status, "created");
    assert.equal(executed.pr.url, "https://example.test/pull/17");
    assert.deepEqual(executed.processes.map((entry) => entry.stage), ["push", "pr-create"]);
    assert.equal(await requireGit(ship.fixture, ["ls-remote", "origin", `refs/heads/${ship.branch}`]), `${ship.head}\trefs/heads/${ship.branch}`);
    const report = await import("node:fs/promises").then(({ readFile }) => readFile(path.join(ship.fixture.repoPath, ".blueprint/reports/ship-latest.md"), "utf8"));
    assert.match(report, /\*\*Push outcome:\*\* success/);
    assert.match(report, /\*\*PR outcome:\*\* created/);
    assert.match(report, /https:\/\/example\.test\/pull\/17/);
    assert.doesNotMatch(report, /push --force|git reset|&&/);
    assert.equal(validateReportArtifactContent(report, "ship-latest").valid, true);
  });
});

test("ship ready gate follows effective config matrix and exact current HEAD/base evidence", async () => {
  for (const item of [
    { review: false, secure: false },
    { review: false, secure: true },
    { review: true, secure: false },
    { review: true, secure: true }
  ]) {
    await withShipFixture(async (ship) => {
      const preview = await blueprintShipPreview(ship.previewArgs({ posture: "ready" }));
      assert.equal(preview.status, "ready", `${String(item.review)}/${String(item.secure)}: ${preview.blockers.join("\n")}`);
    }, { codeReview: item.review, securePhase: item.secure });
  }
  await withShipFixture(async (ship) => {
    const review = await ship.writeEvidence("review");
    const security = await ship.writeEvidence("security");
    const good = await blueprintShipPreview(ship.previewArgs({ posture: "ready" }));
    assert.equal(good.status, "ready", good.blockers.join("\n"));
    shipToolTestHooks.clearApprovalsForTest();
    const staleReview = await ship.writeEvidence("review", "approved", ship.baseOid, ship.baseOid);
    const stale = await blueprintShipPreview(ship.previewArgs({ posture: "ready" }));
    assert.equal(stale.status, "blocked");
    assert.match(stale.blockers.join("\n"), /review evidence|review scope|quality gates/i);
  }, { codeReview: true, securePhase: true });
  await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs({ posture: "ready" }));
    assert.equal(preview.status, "ready", preview.blockers.join("\n"));
    assert.deepEqual(preview.packet?.reviewablePaths, []);
    assert.equal(preview.packet?.gate.reviewRequired, false);
    assert.equal(preview.packet?.gate.securityRequired, false);
  }, { blueprintOnly: true });
});

test("ship hard-stops dirty, detached, missing base, wrong upstream, ambiguous remote, and config base mismatch", async () => {
  await withShipFixture(async (ship) => {
    await writeFile(path.join(ship.fixture.repoPath, "dirty.txt"), "dirty\n", "utf8");
    assert.equal((await blueprintShipPreview(ship.previewArgs())).status, "blocked");
    await requireGit(ship.fixture, ["clean", "-f", "--", "dirty.txt"]);
    await requireGit(ship.fixture, ["checkout", "--detach"]);
    assert.match((await blueprintShipPreview(ship.previewArgs())).blockers.join("\n"), /Detached HEAD/);
    await requireGit(ship.fixture, ["checkout", ship.branch]);
    assert.equal((await blueprintShipPreview(ship.previewArgs({ baseBranch: "missing" }))).status, "invalid");
    await requireGit(ship.fixture, ["branch", "--unset-upstream"]);
    assert.match((await blueprintShipPreview(ship.previewArgs())).blockers.join("\n"), /no exact upstream/);
  });
  await withShipFixture(async (ship) => {
    assert.match((await blueprintShipPreview(ship.previewArgs({ remoteName: undefined }))).blockers.join("\n"), /ambiguous/i);
  }, { secondRemote: true });
  await withShipFixture(async (ship) => {
    const baseConfig = await blueprintConfigGet({ cwd: ship.fixture.repoPath, scope: "effective" });
    const restore = shipToolTestHooks.setConfigReaderForTest(async () => ({ ...baseConfig, config: { ...baseConfig.config,
      git: { ...baseConfig.config.git, base_branch: "release" } } }));
    const preview = await blueprintShipPreview(ship.previewArgs());
    assert.equal(preview.status, "ready", preview.blockers.join("\n"));
    assert.match(preview.warnings.join("\n"), /overrides effective git\.base_branch=release/);
    restore();
  });
  const unbound = await createShipFixture();
  const restoreRunner = shipToolTestHooks.setProcessRunnerForTest(unbound.runner);
  try {
    const preview = await blueprintShipPreview(unbound.previewArgs());
    assert.equal(preview.status, "blocked");
    assert.match(preview.blockers.join("\n"), /cannot be resolved to one GitHub repository selector/);
  } finally {
    restoreRunner();
    shipToolTestHooks.clearApprovalsForTest();
    await unbound.cleanup();
  }
});

test("ship approval tamper, expiry, and HEAD/evidence/remote drift fail before push", async () => {
  await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs());
    const tampered = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: "0".repeat(64), confirmed: true });
    assert.equal(tampered.status, "stale");
    assert.equal(ship.calls.filter((call) => call.command === "git" && call.argv[0] === "push").length, 0);
    const evidencePath = preview.packet!.evidence[0]!.path;
    await writeFile(path.join(ship.fixture.repoPath, evidencePath), "changed\n", "utf8");
    const stale = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(stale.status, "stale");
    assert.match(stale.blockers.join("\n"), /evidence/);
  });
  await withShipFixture(async (ship) => {
    let now = 1;
    const restore = shipToolTestHooks.setRetentionForTest({ now: () => now, approvalTtlMs: 1 });
    const preview = await blueprintShipPreview(ship.previewArgs()); now = 3;
    const expired = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(expired.status, "stale"); restore();
  });
  await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs());
    await ship.fixture.commitFile("src/drift.ts", "export const drift = 1;\n", "feat: drift");
    const stale = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(stale.status, "stale"); assert.match(stale.blockers.join("\n"), /HEAD/);
  });
  await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs());
    await requireGit(ship.fixture, ["remote", "set-url", "origin", path.join(ship.fixture.root, "different.git")]);
    const stale = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(stale.status, "stale"); assert.match(stale.blockers.join("\n"), /remote (?:fetch |push )?URL/);
  });
});

test("ship execute recomputes the stored packet fingerprint and exact argv plan before report or mutation", async () => {
  await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs());
    shipToolTestHooks.mutateApprovalForTest(preview.operationId!, (packet) => { packet.remote.pushUrl = "https://forged.example/owner/repo.git"; });
    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(executed.status, "stale");
    assert.match(executed.blockers.join("\n"), /Stored ship approval packet fingerprint/);
    assert.equal(executed.report.preMutationStatus, "not-attempted");
    assert.equal(executed.processes.length, 0);
  });
  await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs());
    const rebound = shipToolTestHooks.mutateApprovalForTest(preview.operationId!, (packet) => {
      packet.executionPlan[0]!.argv = ["push", "--porcelain", "wrong-remote", `${packet.head}:${packet.remote.headRef}`];
    }, true);
    assert.ok(rebound);
    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: rebound!, confirmed: true });
    assert.equal(executed.status, "stale");
    assert.match(executed.blockers.join("\n"), /canonical exact-argv plan/);
    assert.equal(executed.report.preMutationStatus, "not-attempted");
    assert.equal(executed.processes.length, 0);
  });
});

test("ship rejects forged evidence symlinks that resolve outside the canonical repository", async () => {
  await withShipFixture(async (ship) => {
    const external = path.join(ship.fixture.root, "forged external review.md");
    await writeFile(external, `- **Ship Head OID:** ${ship.head}\n- **Ship Base OID:** ${ship.baseOid}\n- **Ship Outcome:** approved\n`, "utf8");
    const evidencePath = ".blueprint/phases/02-test/02-REVIEW.md";
    await mkdir(path.dirname(path.join(ship.fixture.repoPath, evidencePath)), { recursive: true });
    await symlink(external, path.join(ship.fixture.repoPath, evidencePath));
    const preview = await blueprintShipPreview(ship.previewArgs({ evidence: [{ path: evidencePath, kind: "review" }] }));
    assert.equal(preview.status, "invalid");
    assert.match(preview.blockers.join("\n"), /resolves outside the canonical repository|symlink/i);
    assert.equal(ship.calls.filter((call) => call.command === "git" && call.argv[0] === "push").length, 0);
  });
});

test("ship push rejection prevents gh and produces an exact failed process receipt", async () => {
  await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs());
    const original = ship.runner;
    const restore = shipToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
      if (command === "git" && argv[0] === "push") return result(1, "", "! [rejected] non-fast-forward\n");
      return original(command, argv, cwd, env);
    });
    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    restore();
    assert.equal(executed.status, "failed");
    assert.equal(executed.push.status, "failed");
    assert.equal(executed.pr.status, "not-attempted");
    assert.match(executed.blockers.join("\n"), /non-fast-forward|remote-advanced/);
    assert.equal(executed.processes[0]?.result.exitCode, 1);
  });
});

test("ship durable process receipts bound ASCII and multibyte output by rendered UTF-8 bytes while returned receipts stay exact", async () => {
  for (const output of ["\n\"\\\t".repeat(5_000), "🙂\n".repeat(6_000)]) {
    await withShipFixture(async (ship) => {
      const preview = await blueprintShipPreview(ship.previewArgs({ createPr: false }));
      const original = ship.runner;
      const restore = shipToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
        if (command === "git" && argv[0] === "push") return result(1, output, "bounded failure");
        return original(command, argv, cwd, env);
      });
      const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
      restore();
      assert.equal(executed.processes[0]?.result.stdout, output);
      const report = await readFile(path.join(ship.fixture.repoPath, ".blueprint/reports/ship-latest.md"), "utf8");
      const rendered = report.match(/stdout=("(?:\\.|[^"\\])*") stderr=/)?.[1];
      assert.ok(rendered, "durable report should contain one JSON-rendered stdout field");
      assert.ok(Buffer.byteLength(rendered, "utf8") <= 8_192, `rendered field was ${String(Buffer.byteLength(rendered, "utf8"))} bytes`);
      assert.match(JSON.parse(rendered) as string, /truncated \d+ UTF-8 bytes/);
    });
  }
});

test("ship pre-report failure blocks all external mutation and remote advancement invalidates approval", async () => {
  await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs());
    const restoreWriter = shipToolTestHooks.setReportWriterForTest(async () => { throw new Error("pre-report unavailable"); });
    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    restoreWriter();
    assert.equal(executed.status, "blocked");
    assert.equal(executed.report.preMutationStatus, "failed");
    assert.equal(executed.processes.length, 0);
    assert.equal(ship.calls.filter((call) => call.argv[0] === "push" || (call.command === "gh" && call.argv[0] === "pr" && call.argv[1] === "create")).length, 0);
  });
  await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs());
    await advanceRemoteHead(ship);
    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(executed.status, "stale");
    assert.match(executed.blockers.join("\n"), /remote head ref/);
    assert.equal(executed.processes.length, 0);
  });
  await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs());
    const restoreWriter = shipToolTestHooks.setReportWriterForTest(async (args) => {
      const written = await blueprintArtifactReportWrite(args);
      await advanceRemoteHead(ship);
      return written;
    });
    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    restoreWriter();
    assert.equal(executed.status, "stale");
    assert.equal(executed.processes.length, 0);
    assert.match(executed.blockers.join("\n"), /remote head ref/);
  });
});

test("ship successful push plus gh auth/create failure is truthful partial with fresh-preview recovery", async () => {
  await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs());
    ship.setPrFailure(result(4, "", "authentication failed: gh auth login"));
    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(executed.status, "partial");
    assert.equal(executed.push.status, "pushed");
    assert.equal(executed.pr.status, "failed");
    assert.match(executed.blockers.join("\n"), /authentication failed/);
    assert.match(executed.recoveryActions[0] ?? "", /fresh preview.*push:false.*createPr:true/i);
    assert.equal(executed.gh.status, "gh-unauthenticated");
    assert.match(executed.recoveryActions.join("\n"), /do not push again/i);
    const pushCalls = executed.processes.filter((entry) => entry.stage === "push");
    assert.equal(pushCalls.length, 1);
  });
});

test("ship distinguishes gh spawn/auth drift after push and PR-create nonzero without repeating push", async () => {
  for (const scenario of [
    { label: "spawn", receipt: result(null, "", "ENOENT") },
    { label: "auth", receipt: result(4, "", "not logged into any hosts") }
  ]) {
    await withShipFixture(async (ship) => {
      const preview = await blueprintShipPreview(ship.previewArgs());
      const original = ship.runner;
      let pushed = false;
      const restore = shipToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
        if (command === "git" && argv[0] === "push") { const receipt = await original(command, argv, cwd, env); pushed = true; return receipt; }
        if (pushed && command === "gh" && ((scenario.label === "spawn" && argv[0] === "--version") || (scenario.label === "auth" && argv[0] === "auth"))) return scenario.receipt;
        return original(command, argv, cwd, env);
      });
      const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
      restore();
      assert.equal(executed.status, "partial");
      assert.equal(executed.push.status, "pushed");
      assert.equal(executed.pr.status, "not-attempted");
      assert.doesNotMatch(executed.recoveryActions.join("\n"), /^gh /m);
      assert.match(executed.recoveryActions.join("\n"), /new preview|no-PR inspection/i);
      assert.match(executed.recoveryActions.join("\n"), /do not push again/i);
    });
  }
});

test("ship post-push evidence drift preserves push but never emits stale manual PR argv", async () => {
  await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs());
    const original = ship.runner;
    let changed = false;
    const restore = shipToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
      const receipt = await original(command, argv, cwd, env);
      if (!changed && command === "git" && argv[0] === "push") {
        changed = true;
        await writeFile(path.join(ship.fixture.repoPath, preview.packet!.evidence[0]!.path), "post-push evidence drift\n", "utf8");
      }
      return receipt;
    });
    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    restore();
    assert.equal(executed.status, "partial");
    assert.equal(executed.push.status, "pushed");
    assert.equal(executed.pr.status, "not-attempted");
    assert.match(executed.blockers.join("\n"), /evidence/);
    assert.doesNotMatch(executed.recoveryActions.join("\n"), /^gh /m);
    assert.match(executed.recoveryActions.join("\n"), /stale approved argv|new preview/i);
  });
});

test("ship fresh rerun after push-success PR-failure skips push and creates only the missing PR", async () => {
  await withShipFixture(async (ship) => {
    const first = await blueprintShipPreview(ship.previewArgs());
    ship.setPrFailure(result(1, "", "GraphQL create failed"));
    const partial = await blueprintShipExecute({ operationId: first.operationId!, fingerprint: first.fingerprint!, confirmed: true });
    assert.equal(partial.push.status, "pushed");
    assert.equal(partial.pr.status, "failed");
    ship.setPrFailure(null);
    const rerun = await blueprintShipPreview(ship.previewArgs({ overwriteReport: true }));
    assert.equal(rerun.status, "ready", rerun.blockers.join("\n"));
    assert.deepEqual(rerun.packet?.executionPlan.map((entry) => entry.stage), ["pr-create"]);
    const completed = await blueprintShipExecute({ operationId: rerun.operationId!, fingerprint: rerun.fingerprint!, confirmed: true });
    assert.equal(completed.status, "succeeded", completed.blockers.join("\n"));
    assert.equal(completed.push.status, "reused");
    assert.equal(completed.pr.status, "created");
    assert.equal(completed.processes.filter((entry) => entry.stage === "push").length, 0);
  });
});

test("ship never duplicates a PR when post-push inspection is unavailable or a racing exact PR appears", async () => {
  await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs());
    let viewCount = 0;
    const original = ship.runner;
    const restore = shipToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
      if (command === "gh" && argv[0] === "pr" && argv[1] === "view") {
        viewCount += 1;
        if (viewCount > 2) return result(1, "", "network transport failure");
      }
      return original(command, argv, cwd, env);
    });
    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    restore();
    assert.equal(executed.status, "partial");
    assert.equal(executed.push.status, "pushed");
    assert.equal(executed.pr.status, "failed");
    assert.equal(executed.gh.status, "pr-view-unavailable");
    assert.equal(executed.processes.filter((entry) => entry.stage === "pr-create").length, 0);
  });
  await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs());
    const original = ship.runner;
    let afterPush = false;
    const restore = shipToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
      if (command === "git" && argv[0] === "push") { const receipt = await original(command, argv, cwd, env); afterPush = true; return receipt; }
      if (afterPush && command === "gh" && argv[0] === "pr" && argv[1] === "view") {
        return result(0, `${JSON.stringify({ url: "https://example.test/pull/19", headRefName: ship.branch, baseRefName: "main", isDraft: true, state: "OPEN", headRefOid: ship.head })}\n`);
      }
      return original(command, argv, cwd, env);
    });
    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    restore();
    assert.equal(executed.status, "succeeded", executed.blockers.join("\n"));
    assert.equal(executed.pr.status, "reused");
    assert.equal(executed.processes.filter((entry) => entry.stage === "pr-create").length, 0);
  });
});

test("ship classifies nonzero push with exact observed remote as reused-by-observation", async () => {
  await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs({ createPr: false }));
    const original = ship.runner;
    const restore = shipToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
      if (command === "git" && argv[0] === "push") {
        const actual = await original(command, argv, cwd, env);
        assert.equal(actual.exitCode, 0);
        return result(1, "", "transport closed after receive");
      }
      return original(command, argv, cwd, env);
    });
    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    restore();
    assert.equal(executed.status, "succeeded", executed.blockers.join("\n"));
    assert.equal(executed.push.status, "reused");
    assert.match(executed.warnings.join("\n"), /reused-by-observation/);
    assert.equal(executed.processes[0]?.result.exitCode, 1);
  });
});

test("ship PR create exit zero with mismatched verification is outcome-unknown", async () => {
  await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs());
    const original = ship.runner;
    let created = false;
    const restore = shipToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
      if (command === "gh" && argv[0] === "pr" && argv[1] === "create") { const receipt = await original(command, argv, cwd, env); created = true; return receipt; }
      if (created && command === "gh" && argv[0] === "pr" && argv[1] === "view") {
        return result(0, `${JSON.stringify({ url: "https://example.test/pull/17", headRefName: ship.branch, baseRefName: "wrong", isDraft: true, state: "OPEN", headRefOid: ship.head })}\n`);
      }
      return original(command, argv, cwd, env);
    });
    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    restore();
    assert.equal(executed.status, "outcome-unknown");
    assert.equal(executed.pr.status, "outcome-unknown");
    assert.match(executed.blockers.join("\n"), /no exact PR|authoritative inspection/);
    const durable = await readFile(path.join(ship.fixture.repoPath, ".blueprint/reports/ship-latest.md"), "utf8");
    assert.match(durable, /\*\*PR outcome:\*\* outcome-unknown/);
    assert.match(durable, /\*\*Outcome blockers:\*\* .*(?:no exact PR|authoritative inspection)/i);
  });
});

test("ship PR create nonzero with exact observed PR is reused-by-observation", async () => {
  await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs());
    const original = ship.runner;
    const restore = shipToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
      if (command === "gh" && argv[0] === "pr" && argv[1] === "create") {
        const actual = await original(command, argv, cwd, env);
        assert.equal(actual.exitCode, 0);
        return result(1, "", "transport closed after server create");
      }
      return original(command, argv, cwd, env);
    });
    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    restore();
    assert.equal(executed.status, "succeeded", executed.blockers.join("\n"));
    assert.equal(executed.pr.status, "reused");
    assert.match(executed.warnings.join("\n"), /reused-by-observation/);
    assert.equal(executed.processes.find((entry) => entry.stage === "pr-create")?.result.exitCode, 1);
  });
});

test("ship PR-only rerun reuses exact remote push and exact PR without duplicate mutation", async () => {
  await withShipFixture(async (ship) => {
    ship.setPr({ url: "https://example.test/pull/17", headRefName: ship.branch, baseRefName: "main", isDraft: true, state: "OPEN", headRefOid: ship.head });
    const preview = await blueprintShipPreview(ship.previewArgs({ push: false }));
    assert.equal(preview.status, "ready", preview.blockers.join("\n"));
    assert.deepEqual(preview.packet?.executionPlan, []);
    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(executed.status, "succeeded", executed.blockers.join("\n"));
    assert.equal(executed.push.status, "not-requested");
    assert.equal(executed.pr.status, "reused");
    assert.equal(executed.processes.length, 0);
  }, { pushCurrentHead: true });
});

test("ship outcome-report and state failures preserve external success and recover without external re-entry", async () => {
  await withShipFixture(async (ship) => {
    let writes = 0;
    const restoreWriter = shipToolTestHooks.setReportWriterForTest(async (args) => {
      writes += 1;
      if (writes === 2) throw new Error("simulated outcome report failure");
      return blueprintArtifactReportWrite(args);
    });
    const preview = await blueprintShipPreview(ship.previewArgs());
    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(executed.status, "partial");
    assert.equal(executed.push.status, "pushed");
    assert.equal(executed.pr.status, "created");
    assert.equal(executed.report.outcomeStatus, "failed");
    restoreWriter();
    const externalCallsBefore = ship.calls.filter((call) => call.argv[0] === "push" || (call.command === "gh" && call.argv[0] === "pr" && call.argv[1] === "create")).length;
    const recovered = await blueprintShipPersist({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, stage: "outcome-report" });
    assert.equal(recovered.status, "succeeded", recovered.blockers.join("\n"));
    assert.notEqual(recovered.report.outcomeStatus, "failed");
    const externalCallsAfter = ship.calls.filter((call) => call.argv[0] === "push" || (call.command === "gh" && call.argv[0] === "pr" && call.argv[1] === "create")).length;
    assert.equal(externalCallsAfter, externalCallsBefore);
  });
});

test("ship outcome-report recovery preserves external failure blockers and resumes requested state after external success", async () => {
  await withShipFixture(async (ship) => {
    let writes = 0;
    const restoreWriter = shipToolTestHooks.setReportWriterForTest(async (args) => {
      writes += 1;
      if (writes === 2) throw new Error("simulated failed-outcome report failure");
      return blueprintArtifactReportWrite(args);
    });
    const preview = await blueprintShipPreview(ship.previewArgs({ createPr: false }));
    const original = ship.runner;
    const restoreRunner = shipToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
      if (command === "git" && argv[0] === "push") return result(1, "", "! [rejected] non-fast-forward\n");
      return original(command, argv, cwd, env);
    });
    const failed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    restoreRunner();
    assert.equal(failed.report.outcomeStatus, "failed");
    assert.equal(failed.push.status, "failed");
    const originalBlockers = [...failed.blockers];
    restoreWriter();
    const recovered = await blueprintShipPersist({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, stage: "outcome-report" });
    assert.notEqual(recovered.status, "succeeded");
    assert.equal(recovered.push.status, "failed");
    for (const blocker of originalBlockers) assert.ok(recovered.blockers.includes(blocker));
    assert.match(recovered.blockers.join("\n"), /non-fast-forward|remote-advanced/);
  });

  await withShipFixture(async (ship) => {
    let writes = 0;
    const restoreWriter = shipToolTestHooks.setReportWriterForTest(async (args) => {
      writes += 1;
      if (writes === 2) throw new Error("simulated successful-outcome report failure");
      return blueprintArtifactReportWrite(args);
    });
    const preview = await blueprintShipPreview(ship.previewArgs({ statePatch: { nextAction: "Run /blu-progress" } }));
    const partial = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(partial.status, "partial");
    assert.equal(partial.push.status, "pushed");
    assert.equal(partial.pr.status, "created");
    assert.equal(partial.state.status, "not-attempted");
    restoreWriter();
    const reportRecovered = await blueprintShipPersist({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, stage: "outcome-report" });
    assert.equal(reportRecovered.status, "partial");
    assert.equal(reportRecovered.state.status, "not-attempted");
    assert.match(reportRecovered.recoveryActions.join("\n"), /stage state/);
    const stateRecovered = await blueprintShipPersist({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, stage: "state" });
    assert.equal(stateRecovered.status, "succeeded", stateRecovered.blockers.join("\n"));
    assert.ok(["updated", "unchanged"].includes(stateRecovered.state.status));
  });
});

test("ship outcome-unknown remains terminal through outcome-report failure and successful persistence recovery", async () => {
  await withShipFixture(async (ship) => {
    let writes = 0;
    const restoreWriter = shipToolTestHooks.setReportWriterForTest(async (args) => {
      writes += 1;
      if (writes === 2) throw new Error("simulated unknown-outcome report failure");
      return blueprintArtifactReportWrite(args);
    });
    const preview = await blueprintShipPreview(ship.previewArgs({ createPr: false }));
    const original = ship.runner;
    const restoreRunner = shipToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
      if (command === "git" && argv[0] === "push") return { exitCode: null, stdout: "", stderr: "spawn observation lost", signal: null, timedOut: false };
      return original(command, argv, cwd, env);
    });
    const unknown = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    restoreRunner();
    assert.equal(unknown.status, "outcome-unknown");
    assert.equal(unknown.push.status, "outcome-unknown");
    assert.equal(unknown.report.outcomeStatus, "failed");
    const externalBlocker = unknown.blockers.find((blocker) => /outcome is unknown/i.test(blocker));
    assert.ok(externalBlocker);
    restoreWriter();
    const recovered = await blueprintShipPersist({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, stage: "outcome-report" });
    assert.equal(recovered.status, "outcome-unknown");
    assert.equal(recovered.push.status, "outcome-unknown");
    assert.notEqual(recovered.report.outcomeStatus, "failed");
    assert.ok(recovered.blockers.includes(externalBlocker!));
    assert.equal(recovered.processes.length, 1);
  });
});

test("ship state runs only after confirmed external outcomes and final report; state-only recovery refreshes final receipt", async () => {
  await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs({ statePatch: { nextAction: "Run /blu-progress" } }));
    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(executed.status, "succeeded", executed.blockers.join("\n"));
    assert.ok(["updated", "unchanged"].includes(executed.state.status));
    const report = await import("node:fs/promises").then(({ readFile }) => readFile(path.join(ship.fixture.repoPath, ".blueprint/reports/ship-latest.md"), "utf8"));
    assert.match(report, /State persistence: (updated|unchanged)/);
  });
  await withShipFixture(async (ship) => {
    let failState = true;
    const restoreState = shipToolTestHooks.setStateUpdaterForTest(async (args) => {
      if (failState) throw new Error("simulated state failure");
      const { blueprintStateUpdate } = await import("../src/mcp/tools/state.js");
      return blueprintStateUpdate(args);
    });
    const preview = await blueprintShipPreview(ship.previewArgs({ statePatch: { nextAction: "Run /blu-progress" } }));
    const partial = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(partial.status, "partial");
    assert.equal(partial.state.status, "failed");
    failState = false;
    const externalBefore = partial.processes.length;
    const recovered = await blueprintShipPersist({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, stage: "state" });
    restoreState();
    assert.equal(recovered.status, "succeeded", recovered.blockers.join("\n"));
    assert.ok(["updated", "unchanged"].includes(recovered.state.status));
    assert.equal(recovered.processes.length, externalBefore);
    const report = await import("node:fs/promises").then(({ readFile }) => readFile(path.join(ship.fixture.repoPath, ".blueprint/reports/ship-latest.md"), "utf8"));
    assert.match(report, /State persistence: (updated|unchanged)/);
  });
});

test("ship binds and mutates only the single effective push URL when fetch and push destinations diverge", async () => {
  await withShipFixture(async (ship) => {
    const pushTarget = path.join(ship.fixture.root, "dedicated push target.git");
    await requireGit(ship.fixture, ["init", "--bare", pushTarget]);
    await requireGit(ship.fixture, ["push", pushTarget, `main:refs/heads/main`]);
    const priorHead = await requireGit(ship.fixture, ["rev-parse", `${ship.head}^`]);
    await requireGit(ship.fixture, ["push", pushTarget, `${priorHead}:refs/heads/${ship.branch}`]);
    await requireGit(ship.fixture, ["remote", "set-url", "--push", "origin", pushTarget]);
    const restoreResolver = shipToolTestHooks.setRemoteSelectorResolverForTest((remoteUrl) => remoteUrl === pushTarget ? "example.test/blueprint/tests" : null);
    const preview = await blueprintShipPreview(ship.previewArgs());
    assert.equal(preview.status, "ready", preview.blockers.join("\n"));
    assert.equal(preview.packet?.remote.fetchUrl, ship.remotePath);
    assert.equal(preview.packet?.remote.pushUrl, pushTarget);
    assert.deepEqual(preview.packet?.executionPlan[0]?.argv, ["push", "--porcelain", "--", pushTarget, `${ship.head}:refs/heads/${ship.branch}`]);
    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    restoreResolver();
    assert.equal(executed.status, "succeeded", executed.blockers.join("\n"));
    assert.equal(await requireGit(ship.fixture, ["ls-remote", pushTarget, `refs/heads/${ship.branch}`]), `${ship.head}\trefs/heads/${ship.branch}`);
    assert.equal(await requireGit(ship.fixture, ["ls-remote", ship.remotePath, `refs/heads/${ship.branch}`]), `${priorHead}\trefs/heads/${ship.branch}`);
  });
});

test("ship resolves pushInsteadOf, blocks multiple effective push URLs, and detects push URL drift", async () => {
  await withShipFixture(async (ship) => {
    const rewritten = path.join(ship.fixture.root, "rewritten target.git");
    await requireGit(ship.fixture, ["init", "--bare", rewritten]);
    await requireGit(ship.fixture, ["push", rewritten, `main:refs/heads/main`]);
    const priorHead = await requireGit(ship.fixture, ["rev-parse", `${ship.head}^`]);
    await requireGit(ship.fixture, ["push", rewritten, `${priorHead}:refs/heads/${ship.branch}`]);
    await requireGit(ship.fixture, ["config", `url.${rewritten}.pushInsteadOf`, "ship-alias:"]);
    await requireGit(ship.fixture, ["remote", "set-url", "origin", "ship-alias:"]);
    const restoreResolver = shipToolTestHooks.setRemoteSelectorResolverForTest((remoteUrl) => remoteUrl === rewritten ? "example.test/blueprint/tests" : null);
    const preview = await blueprintShipPreview(ship.previewArgs());
    assert.equal(preview.status, "ready", preview.blockers.join("\n"));
    assert.equal(preview.packet?.remote.pushUrl, rewritten);
    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    restoreResolver();
    assert.equal(executed.status, "succeeded", executed.blockers.join("\n"));
    assert.equal(await requireGit(ship.fixture, ["ls-remote", rewritten, `refs/heads/${ship.branch}`]), `${ship.head}\trefs/heads/${ship.branch}`);
    assert.equal(await requireGit(ship.fixture, ["ls-remote", ship.remotePath, `refs/heads/${ship.branch}`]), `${priorHead}\trefs/heads/${ship.branch}`);
  });
  await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs());
    await requireGit(ship.fixture, ["remote", "set-url", "--push", "origin", path.join(ship.fixture.root, "drift.git")]);
    const stale = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.equal(stale.status, "stale");
    assert.match(stale.blockers.join("\n"), /effective remote push URL|effective git config/);
  });
  await withShipFixture(async (ship) => {
    await requireGit(ship.fixture, ["remote", "set-url", "--add", "--push", "origin", ship.remotePath]);
    await requireGit(ship.fixture, ["remote", "set-url", "--add", "--push", "origin", path.join(ship.fixture.root, "other.git")]);
    const preview = await blueprintShipPreview(ship.previewArgs());
    assert.equal(preview.status, "invalid");
    assert.match(preview.blockers.join("\n"), /exactly one effective push URL/);
  });
  await withShipFixture(async (ship) => {
    const first = path.join(ship.fixture.root, "first rewrite.git");
    const second = path.join(ship.fixture.root, "second rewrite.git");
    await requireGit(ship.fixture, ["init", "--bare", second]);
    await requireGit(ship.fixture, ["push", second, `main:refs/heads/main`]);
    const priorHead = await requireGit(ship.fixture, ["rev-parse", `${ship.head}^`]);
    await requireGit(ship.fixture, ["push", second, `${priorHead}:refs/heads/${ship.branch}`]);
    await requireGit(ship.fixture, ["config", `url.${first}.pushInsteadOf`, "chain-alias:"]);
    await requireGit(ship.fixture, ["config", `url.${second}.insteadOf`, first]);
    await requireGit(ship.fixture, ["remote", "set-url", "origin", "chain-alias:"]);
    const preview = await blueprintShipPreview(ship.previewArgs());
    assert.equal(preview.status, "invalid");
    assert.match(preview.blockers.join("\n"), /recursive endpoint rewriting is ambiguous/i);
  });
});

test("ship durably classifies a successful push followed by ref deletion or advance as outcome-unknown", async () => {
  for (const race of ["deletion", "advance"] as const) await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs({ createPr: false }));
    const original = ship.runner;
    const restoreRunner = shipToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
      const receipt = await original(command, argv, cwd, env);
      if (command === "git" && argv[0] === "push" && receipt.exitCode === 0) {
        if (race === "deletion") await requireGit(ship.fixture, ["push", ship.remotePath, `:refs/heads/${ship.branch}`]);
        else await advanceRemoteHead(ship);
      }
      return receipt;
    });
    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    restoreRunner();
    assert.equal(executed.status, "outcome-unknown");
    assert.equal(executed.push.status, "outcome-unknown");
    assert.equal(executed.processes[0]?.result.exitCode, 0);
    assert.match(executed.blockers.join("\n"), /exited successfully.*subsequently observed/i);
    const durable = await readFile(path.join(ship.fixture.repoPath, ".blueprint/reports/ship-latest.md"), "utf8");
    assert.match(durable, /\*\*Push outcome:\*\* outcome-unknown/);
    assert.match(durable, /\*\*Outcome blockers:\*\* .*exited successfully.*subsequently observed/i);
  });
});

test("ship persists PR-only final-inspection failure and recovers a failed outcome write without creating a PR", async () => {
  await withShipFixture(async (ship) => {
    const preview = await blueprintShipPreview(ship.previewArgs({ push: false }));
    const original = ship.runner;
    let executeViews = 0;
    const restoreRunner = shipToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
      if (command === "gh" && argv[0] === "pr" && argv[1] === "view") {
        executeViews += 1;
        if (executeViews >= 3) return result(1, "", "network transport failure");
      }
      return original(command, argv, cwd, env);
    });
    let writes = 0;
    const restoreWriter = shipToolTestHooks.setReportWriterForTest(async (args) => {
      writes += 1;
      if (writes === 2) throw new Error("outcome write unavailable");
      return blueprintArtifactReportWrite(args);
    });
    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    restoreRunner();
    assert.equal(executed.status, "failed");
    assert.equal(executed.pr.status, "failed");
    assert.equal(executed.gh.status, "pr-view-unavailable");
    assert.equal(executed.report.preMutationStatus === "created" || executed.report.preMutationStatus === "updated" || executed.report.preMutationStatus === "reused", true);
    assert.equal(executed.report.outcomeStatus, "failed");
    assert.equal(executed.processes.filter((entry) => entry.stage === "pr-create").length, 0);
    restoreWriter();
    const recovered = await blueprintShipPersist({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, stage: "outcome-report" });
    assert.equal(recovered.status, "failed");
    assert.notEqual(recovered.report.outcomeStatus, "failed");
    assert.equal(recovered.gh.status, "pr-view-unavailable");
    assert.match(recovered.recoveryActions.join("\n"), /fresh preview.*push:false.*createPr:true/i);
  }, { pushCurrentHead: true });
});

test("ship derives canonical evidence roles and rejects ad hoc, duplicate, or stale pr-branch linkage", async () => {
  await withShipFixture(async (ship) => {
    const adHoc = await blueprintShipPreview(ship.previewArgs({ evidence: [{ path: ".blueprint/reports/review.md", kind: "review" }] }));
    assert.equal(adHoc.status, "invalid");
    assert.match(adHoc.blockers.join("\n"), /not a canonical phase quality artifact/);
    const defaults = ship.previewArgs().evidence;
    const duplicate = await blueprintShipPreview(ship.previewArgs({ evidence: [...defaults, defaults[0]!] }));
    assert.equal(duplicate.status, "invalid");
    assert.match(duplicate.blockers.join("\n"), /only once/);
    const wrongKind = await blueprintShipPreview(ship.previewArgs({ evidence: defaults.map((entry, index) => index === 0 ? { ...entry, kind: "security" as const } : entry) }));
    assert.equal(wrongKind.status, "invalid");
    assert.match(wrongKind.blockers.join("\n"), /does not match the canonical review role/);
    await writeFile(path.join(ship.fixture.repoPath, ".blueprint/reports/pr-branch-latest.md"), "# forged stale receipt\n", "utf8");
    const stale = await blueprintShipPreview(ship.previewArgs());
    assert.equal(stale.status, "blocked");
    assert.match(stale.blockers.join("\n"), /pr-branch-latest|Digest inputs/);
  });
  await withShipFixture(async (ship) => {
    const reviewPath = ".blueprint/phases/01-test/01-REVIEW.md";
    const securityPath = ".blueprint/phases/01-test/01-SECURITY.md";
    await writeFile(path.join(ship.fixture.repoPath, securityPath), await readFile(path.join(ship.fixture.repoPath, reviewPath), "utf8"), "utf8");
    const duplicateDigest = await blueprintShipPreview(ship.previewArgs());
    assert.equal(duplicateDigest.status, "blocked");
    assert.match(duplicateDigest.blockers.join("\n"), /pairwise-distinct content digests/);
  });
  await withShipFixture(async (ship) => {
    const receiptPath = path.join(ship.fixture.repoPath, ".blueprint/reports/pr-branch-latest.md");
    const receipt = await readFile(receiptPath, "utf8");
    await writeFile(receiptPath, receipt.replace(`- Base branch: main (${ship.baseOid})`, `- Base branch: release (${ship.baseOid})`), "utf8");
    const wrongBaseName = await blueprintShipPreview(ship.previewArgs());
    assert.equal(wrongBaseName.status, "blocked");
    assert.match(wrongBaseName.blockers.join("\n"), /current branch\/HEAD\/base/);
  });
});

test("ship blocks completed-looking security evidence with OPEN threat and finding debt", async () => {
  await withShipFixture(async (ship) => {
    const securityPath = ".blueprint/phases/01-test/01-SECURITY.md";
    const absoluteSecurity = path.join(ship.fixture.repoPath, securityPath);
    const original = await readFile(absoluteSecurity, "utf8");
    const opened = original
      .replace("| none | none | none | none | none | none | NONE | none | none |",
        "| T-OPEN | 01-01-PLAN.md | auth | src/first.ts | mitigate | Add guard | OPEN | missing | unresolved |")
      .replace("| none | none | none | NONE | none | none |",
        "| open-threat | high | T-OPEN | OPEN | Missing mitigation evidence. | Verify before shipping. |");
    await writeFile(absoluteSecurity, opened, "utf8");
    const receiptPath = path.join(ship.fixture.repoPath, ".blueprint/reports/pr-branch-latest.md");
    const receipt = await readFile(receiptPath, "utf8");
    await writeFile(receiptPath, receipt.replace(
      `${securityPath}:${qualityShippingSha256(original)}`,
      `${securityPath}:${qualityShippingSha256(opened)}`
    ), "utf8");
    const preview = await blueprintShipPreview(ship.previewArgs({ posture: "ready" }));
    assert.equal(preview.status, "blocked");
    assert.match(preview.blockers.join("\n"), /quality gates are not satisfied.*(?:blocked|incomplete)|security evidence/i);
  }, { codeReview: true, securePhase: true });
});

test("ship requires quality artifacts to share the exact canonical parent phase directory", async () => {
  await withShipFixture(async (ship) => {
    const originalPath = ".blueprint/phases/01-test/01-SECURITY.md";
    const otherPath = ".blueprint/phases/01-other/01-SECURITY.md";
    await mkdir(path.dirname(path.join(ship.fixture.repoPath, otherPath)), { recursive: true });
    await writeFile(path.join(ship.fixture.repoPath, otherPath), await readFile(path.join(ship.fixture.repoPath, originalPath), "utf8"), "utf8");
    const evidence = ship.previewArgs().evidence.map((entry) => entry.kind === "security" ? { ...entry, path: otherPath } : entry);
    const preview = await blueprintShipPreview(ship.previewArgs({ evidence }));
    assert.equal(preview.status, "blocked");
    assert.match(preview.blockers.join("\n"), /exact same canonical phase directory/);
  });
});

test("ship requires the phase directory prefix to match every canonical artifact prefix and accepts decimal identities", async () => {
  assert.deepEqual(
    shipToolTestHooks.canonicalEvidenceRoleForTest(".blueprint/phases/1.2-test/1.2-VERIFICATION.md"),
    { kind: "verification", phasePrefix: "1.2", phaseDir: ".blueprint/phases/1.2-test" }
  );
  assert.equal(shipToolTestHooks.canonicalEvidenceRoleForTest(".blueprint/phases/99-other/01-REVIEW.md"), null);

  await withShipFixture(async (ship) => {
    const sourceDir = ".blueprint/phases/01-test";
    const wrongDir = ".blueprint/phases/99-other";
    await mkdir(path.join(ship.fixture.repoPath, wrongDir), { recursive: true });
    for (const name of ["01-REVIEW.md", "01-SECURITY.md", "01-VERIFICATION.md"]) {
      await writeFile(
        path.join(ship.fixture.repoPath, wrongDir, name),
        await readFile(path.join(ship.fixture.repoPath, sourceDir, name))
      );
    }
    const evidence = ship.previewArgs().evidence.map((entry) => entry.kind === "pr-branch"
      ? entry
      : { ...entry, path: entry.path.replace(sourceDir, wrongDir) });
    const preview = await blueprintShipPreview(ship.previewArgs({ evidence }));
    assert.equal(preview.status, "invalid");
    assert.match(preview.blockers.join("\n"), /not a canonical phase quality artifact/);
  });
});

test("ship binds every regular phase quality input and detects summary or plan byte drift", async () => {
  for (const relativePath of [".blueprint/phases/01-test/01-01-SUMMARY.md", ".blueprint/phases/01-test/01-01-PLAN.md"]) {
    await withShipFixture(async (ship) => {
      const preview = await blueprintShipPreview(ship.previewArgs());
      assert.equal(preview.status, "ready", preview.blockers.join("\n"));
      assert.ok(preview.packet?.qualityGateInventory.entries.some((entry) => entry.path === relativePath));
      await writeFile(path.join(ship.fixture.repoPath, relativePath), `${await readFile(path.join(ship.fixture.repoPath, relativePath), "utf8")}\n- drift without changing the evidence path\n`, "utf8");
      const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
      assert.equal(executed.status, "stale");
      assert.match(executed.blockers.join("\n"), /phase quality-gate inventory|evidence/);
      assert.equal(executed.processes.length, 0);
    });
  }
});

test("ship hashes raw authority bytes and rejects malformed UTF-8 before preview or mutation", async () => {
  assert.notEqual(qualityShippingSha256(Buffer.from([0x80])), qualityShippingSha256(Buffer.from([0x81])));

  await withShipFixture(async (ship) => {
    const extra = ".blueprint/phases/01-test/byte-bound.md";
    await writeFile(path.join(ship.fixture.repoPath, extra), Buffer.from("valid inventory input\n", "utf8"));
    const preview = await blueprintShipPreview(ship.previewArgs());
    assert.equal(preview.status, "ready", preview.blockers.join("\n"));
    const bound = preview.packet?.qualityGateInventory.entries.find((entry) => entry.path === extra);
    assert.equal(bound?.contentSha256, qualityShippingSha256(Buffer.from("valid inventory input\n", "utf8")));

    await writeFile(path.join(ship.fixture.repoPath, extra), Buffer.from([0x80]));
    const mutationCallsBefore = ship.calls.filter((call) =>
      (call.command === "git" && call.argv[0] === "push") || (call.command === "gh" && call.argv[0] === "pr" && call.argv[1] === "create")).length;
    const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
    assert.match(executed.blockers.join("\n"), /not valid UTF-8.*replacement decoding is forbidden/i);
    assert.equal(executed.externalMutationStarted, false);
    assert.equal(executed.processes.length, 0);
    assert.equal(ship.calls.filter((call) =>
      (call.command === "git" && call.argv[0] === "push") || (call.command === "gh" && call.argv[0] === "pr" && call.argv[1] === "create")).length, mutationCallsBefore);
  });

  await withShipFixture(async (ship) => {
    const extra = ".blueprint/phases/01-test/malformed.md";
    await writeFile(path.join(ship.fixture.repoPath, extra), Buffer.from([0x81]));
    const preview = await blueprintShipPreview(ship.previewArgs());
    assert.equal(preview.status, "invalid");
    assert.match(preview.blockers.join("\n"), /Canonical Markdown authority .*malformed\.md is not valid UTF-8.*replacement decoding is forbidden/i);
  });
});

test("ship types initial and post-report PR-view freshness failures without mutation", async () => {
  for (const timing of ["initial", "after-report"] as const) {
    for (const remoteAlreadyExact of [false, true]) await withShipFixture(async (ship) => {
      const preview = await blueprintShipPreview(ship.previewArgs());
      assert.equal(preview.packet?.executionPlan.some((entry) => entry.stage === "push"), !remoteAlreadyExact);
      const original = ship.runner;
      let executeViews = 0;
      const restoreRunner = shipToolTestHooks.setProcessRunnerForTest(async (command, argv, cwd, env) => {
        if (command === "gh" && argv[0] === "pr" && argv[1] === "view") {
          executeViews += 1;
          if ((timing === "initial" && executeViews === 1) || (timing === "after-report" && executeViews === 2)) {
            return result(1, "", `${timing} PR view transport failure`);
          }
        }
        return original(command, argv, cwd, env);
      });
      const executed = await blueprintShipExecute({ operationId: preview.operationId!, fingerprint: preview.fingerprint!, confirmed: true });
      restoreRunner();
      assert.equal(executed.status, "stale");
      assert.equal(executed.gh.status, "pr-view-unavailable");
      assert.match(executed.gh.detail ?? "", /PR view transport failure|Existing PR inspection failed/);
      if (remoteAlreadyExact) {
        assert.match(executed.recoveryActions.join("\n"), /fresh preview.*push:false.*createPr:true/i);
      } else {
        assert.match(executed.recoveryActions.join("\n"), /completely fresh preview preserving the original push:true and createPr:true intent/i);
        assert.doesNotMatch(executed.recoveryActions.join("\n"), /push:false/);
      }
      assert.equal(executed.processes.length, 0);
      assert.equal(executed.push.status, "not-attempted");
      assert.equal(executed.pr.status, "not-attempted");
      if (timing === "initial") {
        assert.equal(executed.report.preMutationStatus, "not-attempted");
        assert.equal(executed.report.outcomeStatus, "not-attempted");
      } else {
        assert.ok(["created", "updated", "reused"].includes(executed.report.preMutationStatus));
        assert.notEqual(executed.report.outcomeStatus, "not-attempted");
        const durable = await readFile(path.join(ship.fixture.repoPath, ".blueprint/reports/ship-latest.md"), "utf8");
        assert.match(durable, /\*\*gh availability and auth:\*\* pr-view-unavailable/);
        assert.match(durable, /\*\*gh detail:\*\* .*PR view transport failure/i);
        if (remoteAlreadyExact) {
          assert.match(durable, /\*\*gh fallback notes:\*\* Restore gh .*fresh preview with push:false and createPr:true/i);
          assert.match(durable, /\*\*Outcome recovery:\*\* Restore gh .*fresh preview with push:false and createPr:true/i);
        } else {
          assert.match(durable, /\*\*gh fallback notes:\*\* Restore gh .*completely fresh preview preserving the original push:true and createPr:true intent/i);
          assert.match(durable, /\*\*Outcome recovery:\*\* Restore gh .*completely fresh preview preserving the original push:true and createPr:true intent/i);
          assert.doesNotMatch(durable, /gh fallback notes:.*push:false/i);
        }
        assert.match(durable, /gh status: pr-view-unavailable/);
      }
    }, { pushCurrentHead: remoteAlreadyExact });
  }
});

test("ship operation lock blocks a concurrent approval without consuming it and approvals are one-shot", async () => {
  await withShipFixture(async (ship) => {
    const first = await blueprintShipPreview(ship.previewArgs());
    const second = await blueprintShipPreview(ship.previewArgs());
    let releaseWrite!: () => void;
    const wait = new Promise<void>((resolve) => { releaseWrite = resolve; });
    let entered!: () => void;
    const enteredPromise = new Promise<void>((resolve) => { entered = resolve; });
    const restoreWriter = shipToolTestHooks.setReportWriterForTest(async (args) => { entered(); await wait; return blueprintArtifactReportWrite(args); });
    const running = blueprintShipExecute({ operationId: first.operationId!, fingerprint: first.fingerprint!, confirmed: true });
    await enteredPromise;
    const blocked = await blueprintShipExecute({ operationId: second.operationId!, fingerprint: second.fingerprint!, confirmed: true });
    assert.equal(blocked.status, "blocked");
    assert.match(blocked.blockers.join("\n"), /operation is active/);
    releaseWrite();
    const completed = await running;
    restoreWriter();
    assert.equal(completed.status, "succeeded", completed.blockers.join("\n"));
    const replay = await blueprintShipExecute({ operationId: first.operationId!, fingerprint: first.fingerprint!, confirmed: true });
    assert.deepEqual(replay, completed);
    const secondAfter = await blueprintShipExecute({ operationId: second.operationId!, fingerprint: second.fingerprint!, confirmed: true });
    assert.equal(secondAfter.status, "stale");
  });
});

test("ship tool registration, mutation logging, and public response parity include all three boundaries", async () => {
  assert.ok(blueprintToolNames.includes("blueprint_ship_preview"));
  assert.ok(blueprintToolNames.includes("blueprint_ship_execute"));
  assert.ok(blueprintToolNames.includes("blueprint_ship_persist"));
  assert.equal(shouldLogMutationFailure("blueprint_ship_execute", { status: "outcome-unknown" }), true);
  assert.equal(shouldLogMutationFailure("blueprint_ship_persist", { status: "partial" }), true);
  const execute = await blueprintShipExecute({ operationId: "00000000-0000-4000-8000-000000000000", fingerprint: "0".repeat(64), confirmed: true });
  const persist = await blueprintShipPersist({ operationId: "00000000-0000-4000-8000-000000000000", fingerprint: "0".repeat(64), stage: "outcome-report" });
  for (const [name, value] of [["blueprint_ship_execute", execute], ["blueprint_ship_persist", persist]] as const) {
    const publicValue = sanitizeToolResultForPublicResponse(name, value);
    const content = createToolResponseContent(name, value);
    assert.equal(content[0]?.type, "text");
    assert.equal(content[0]?.text, JSON.stringify(publicValue));
  }
});
