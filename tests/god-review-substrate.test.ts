import test from "node:test";
import assert from "node:assert/strict";

import { BLUEPRINT_MUTATION_TOOL_NAMES } from "../src/mcp/mutation-failure-logging.js";
import { blueprintToolNames } from "../src/mcp/server.js";
import {
  GOD_REVIEW_GROUPS,
  GOD_REVIEW_MUTATION_TOOL_NAMES,
  GOD_REVIEW_PRIVATE_TOOL_NAMES,
  buildGodReviewPhasePaths,
  buildGodReviewReportPaths,
  buildInitialGodReviewGroups,
  evaluateGodReviewActivation,
  godReviewSessionSchema,
  hashGodReviewFileSet,
  isGodReviewPrivateToolName,
  normalizeGodReviewRepoRelativeFilePath,
  parseGodReviewReportShell,
  renderGodReviewHumanState,
  renderGodReviewReportHeader
} from "../src/mcp/tools/god-review.js";

test("god-review activation helper validates only hidden code-review command invocations", () => {
  assert.deepEqual(
    evaluateGodReviewActivation({
      activeCommand: "/blu-code-review",
      rawInvocation: "/blu-code-review 5 --feels-like-god"
    }),
    {
      status: "valid",
      activeCommand: "/blu-code-review",
      mode: "review",
      hiddenFlag: true
    }
  );
  assert.deepEqual(
    evaluateGodReviewActivation({
      activeCommand: "/blu-code-review-fix",
      rawInvocation: "/blu-code-review-fix --feels-like-god --all"
    }),
    {
      status: "valid",
      activeCommand: "/blu-code-review-fix",
      mode: "fix",
      hiddenFlag: true
    }
  );

  const missingFlag = evaluateGodReviewActivation({
    activeCommand: "/blu-code-review",
    rawInvocation: "/blu-code-review 5"
  });
  const wrongCommand = evaluateGodReviewActivation({
    activeCommand: "/blu-progress",
    rawInvocation: "/blu-progress --feels-like-god"
  });

  assert.equal(missingFlag.status, "refused");
  assert.equal(wrongCommand.status, "refused");
  assert.equal(missingFlag.sideEffectsAllowed, false);
  assert.match(missingFlag.refusal, /No `thunderbolt` today\./);
});

test("god-review scope path helper accepts only repo-relative source files", () => {
  assert.deepEqual(normalizeGodReviewRepoRelativeFilePath("src/../src/app.ts"), {
    valid: true,
    path: "src/app.ts"
  });
  assert.equal(normalizeGodReviewRepoRelativeFilePath("/tmp/app.ts").valid, false);
  assert.equal(normalizeGodReviewRepoRelativeFilePath("../app.ts").valid, false);
  assert.equal(normalizeGodReviewRepoRelativeFilePath("src/*.ts").valid, false);
  assert.equal(normalizeGodReviewRepoRelativeFilePath("src/").valid, false);
  assert.equal(
    normalizeGodReviewRepoRelativeFilePath(".blueprint/phases/05/05-REVIEW.md").valid,
    false
  );
});

test("god-review path builders keep phase and report scopes separate", () => {
  assert.deepEqual(
    buildGodReviewPhasePaths({
      phaseDir: ".blueprint/phases/05-review",
      phasePrefix: "05"
    }),
    {
      sessionPath: ".blueprint/phases/05-review/.god-review-session.json",
      humanStatePath: ".blueprint/phases/05-review/.god-review-state.md",
      reportPath: ".blueprint/phases/05-review/05-GOD-REVIEW.md"
    }
  );
  assert.deepEqual(buildGodReviewReportPaths({ runId: "god-2026-05-11-abc123" }), {
    sessionPath: ".blueprint/reports/.god-review-god-2026-05-11-abc123.json",
    humanStatePath: ".blueprint/reports/god-2026-05-11-abc123.god-review-state.md",
    reportPath: ".blueprint/reports/god-review-god-2026-05-11-abc123.md"
  });
});

test("god-review group taxonomy and file-set fingerprints are deterministic", () => {
  assert.deepEqual(
    GOD_REVIEW_GROUPS.map((group) => group.prefix),
    ["COR", "SEC", "DAT", "REL", "TST", "ARC", "PER", "OPS"]
  );
  assert.deepEqual(
    buildInitialGodReviewGroups().map((group) => [group.id, group.status, group.findingIds]),
    GOD_REVIEW_GROUPS.map((group) => [group.id, "pending", []])
  );
  assert.equal(
    hashGodReviewFileSet({ files: ["b.ts", "a.ts"], skippedFiles: ["z.bin"] }),
    hashGodReviewFileSet({ files: ["a.ts", "b.ts"], skippedFiles: ["z.bin"] })
  );
});

test("god-review session schema enforces scope-kind phase invariants", () => {
  const validSession = {
    schemaVersion: 1,
    runId: "god-2026-05-11-abc123",
    parentRunId: null,
    status: "in-progress",
    createdAt: "2026-05-11T00:00:00.000Z",
    updatedAt: "2026-05-11T00:00:00.000Z",
    activeCommand: "/blu-code-review",
    scopeKind: "phase",
    phase: 5,
    sessionPath: ".blueprint/phases/05-review/.god-review-session.json",
    humanStatePath: ".blueprint/phases/05-review/.god-review-state.md",
    reportPath: ".blueprint/phases/05-review/05-GOD-REVIEW.md",
    files: ["src/app.ts"],
    skippedFiles: [],
    scopeFingerprint: {
      baseSha: "abc123",
      headSha: "def456",
      diffHash: null,
      fileSetHash: "sha256:test",
      prNumber: null
    },
    groups: buildInitialGodReviewGroups(),
    nextGroupId: "correctness-contracts",
    cleanup: {
      reviewTerminal: false,
      godFixTerminal: false,
      eligible: false
    }
  };

  assert.equal(godReviewSessionSchema.safeParse(validSession).success, true);
  assert.equal(
    godReviewSessionSchema.safeParse({ ...validSession, scopeKind: "pr" }).success,
    false
  );
  assert.equal(
    godReviewSessionSchema.safeParse({
      ...validSession,
      scopeKind: "phase",
      phase: undefined
    }).success,
    false
  );
});

test("god-review renderer and parser shells preserve stable report identifiers", () => {
  const header = renderGodReviewReportHeader({
    runId: "god-2026-05-11-abc123",
    status: "in-progress",
    scopeKind: "phase",
    sessionPath: ".blueprint/phases/05-review/.god-review-session.json",
    scopeFingerprintSummary: "sha256:test"
  });
  const state = renderGodReviewHumanState({
    runId: "god-2026-05-11-abc123",
    scopeKind: "phase",
    fileCount: 2,
    currentGroupId: "correctness-contracts",
    nextGroupId: "security-privacy-auth",
    reviewTerminal: false,
    godFixTerminal: false,
    stale: false,
    nextCommand: "/blu-code-review 5 --feels-like-god --continue"
  });
  const parsed = parseGodReviewReportShell(`${header}
## GOD-01 Correctness And Contracts

Status: completed
Group ID: correctness-contracts
Scope: frozen session scope

### Findings

#### GOD-COR-001: Missing guard before mutation
- Severity: high
- Disposition: follow-up
- Confidence: high
- Files: \`src/app.ts:42\`
- Evidence: Mutation accepts invalid state.
- Impact: Invalid state can persist.
- Recommendation: Add validation before mutation.
- Fix Eligibility: eligible

## Remediation Log

### GOD-FIX-001: GOD-COR-001
- Status: fixed
- Finding: GOD-COR-001
- Selected By: default
- Files Changed: \`src/app.ts\`
- Verification: \`npm test -- tests/app.test.ts\` - passed
- Evidence: Focused test passed.
- Follow-Up: none
`);

  assert.match(header, /# God Review: god-2026-05-11-abc123/);
  assert.match(state, /Next hidden command: \/blu-code-review 5 --feels-like-god --continue/);
  assert.deepEqual(parsed.warnings, []);
  assert.equal(parsed.findings[0].id, "GOD-COR-001");
  assert.equal(parsed.findings[0].severity, "high");
  assert.equal(parsed.findings[0].disposition, "follow-up");
  assert.equal(parsed.findings[0].fixEligibility, "eligible");
  assert.equal(parsed.remediations[0].id, "GOD-FIX-001");
  assert.equal(parsed.remediations[0].findingId, "GOD-COR-001");
  assert.equal(parsed.remediations[0].status, "fixed");
});

test("only implemented god-review private tools are registered as callable MCP tools", () => {
  for (const toolName of GOD_REVIEW_PRIVATE_TOOL_NAMES) {
    assert.equal(isGodReviewPrivateToolName(toolName), true);
    assert.equal(
      blueprintToolNames.includes(toolName),
      toolName === "blueprint_god_review_start" ||
        toolName === "blueprint_god_review_next" ||
        toolName === "blueprint_god_review_append"
    );
  }

  for (const toolName of GOD_REVIEW_MUTATION_TOOL_NAMES) {
    assert.equal(
      BLUEPRINT_MUTATION_TOOL_NAMES.has(toolName),
      toolName === "blueprint_god_review_start" ||
        toolName === "blueprint_god_review_append"
    );
  }
});
