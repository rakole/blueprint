import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

async function readRepoFiles(paths: string[]): Promise<Record<string, string>> {
  const entries = await Promise.all(
    paths.map(async (relativePath) => [
      relativePath,
      await readFile(path.join(repoRoot, relativePath), "utf8")
    ])
  );

  return Object.fromEntries(entries);
}

test("review-family contracts keep overwrite and scope boundaries explicit", async () => {
  const files = await readRepoFiles([
    "docs/commands/code-review.md",
    "docs/commands/review.md",
    "docs/commands/secure-phase.md",
    "docs/commands/ui-review.md",
    "skills/blueprint-review/SKILL.md",
    "skills/blueprint-review/references/review-runtime-contract.md"
  ]);

  const codeReview = files["docs/commands/code-review.md"];
  assert.match(
    codeReview,
    /shared review posture from the runtime contract/i
  );
  assert.match(
    codeReview,
    /Directories, wildcards, `\.blueprint\/\*\*`, and absolute paths are invalid review-scope inputs/i
  );
  assert.match(
    codeReview,
    /treat the returned `files` list as authoritative instead of widening scope from chat memory or git drift/i
  );
  assert.match(
    codeReview,
    /If explicit files were supplied, review only those exact repo-relative paths/i
  );
  assert.match(
    codeReview,
    /Require explicit overwrite confirmation before replacing an existing `XX-REVIEW\.md`/i
  );

  const review = files["docs/commands/review.md"];
  assert.match(
    review,
    /resolved scope must stay tied to the saved phase plan set/i
  );
  assert.match(
    review,
    /pending gates stay limited to overwrite confirmation, reviewer-availability confirmation, or the visible `reviewer-availability` waiting state/i
  );
  assert.match(
    review,
    /Read only the selected phase plans through `blueprint_phase_plan_read`; do not widen peer-review scope from unrelated repo drift/i
  );
  assert.match(
    review,
    /Use Gemini CLI's `ask_user` tool for overwrite confirmation before replacing an existing `XX-REVIEWS\.md`/i
  );
  assert.match(
    review,
    /Read `review\.peer-review` through `blueprint_artifact_contract_read` before drafting or repairing the artifact/i
  );
  assert.match(
    review,
    /Optional subagents: `blueprint-reviewer`/i
  );
  assert.match(
    review,
    /When no suitable subagent is available, the command continues sequentially/i
  );

  const reviewRuntimeContract = files["skills/blueprint-review/references/review-runtime-contract.md"];
  assert.match(
    reviewRuntimeContract,
    /contract\.authoringTemplate.*canonical shape for `XX-REVIEWS\.md`/is
  );
  assert.match(
    reviewRuntimeContract,
    /The peer-review artifact must be useful standalone review evidence, not merely\s+valid Markdown/i
  );
  assert.match(
    reviewRuntimeContract,
    /If `blueprint_review_record` rejects the body or reports missing headings,\s+repair once against `review\.peer-review`/i
  );
  assert.match(
    reviewRuntimeContract,
    /Browser-only, web-search-only, shell-only, or generic helpers are not\s+acceptable substitutes/i
  );

  const securePhase = files["docs/commands/secure-phase.md"];
  assert.match(
    securePhase,
    /use saved plan evidence only to define the declared threats and mitigations, then audit against that register instead of widening into a generic security scan/i
  );
  assert.match(
    securePhase,
    /Use Gemini CLI's `ask_user` tool for overwrite confirmation before replacing an existing `XX-SECURITY\.md`/i
  );

  const uiReview = files["docs/commands/ui-review.md"];
  assert.match(
    uiReview,
    /route to the next safe implemented follow-up without widening beyond the selected phase/i
  );
  assert.match(
    uiReview,
    /Overwrite remains explicit confirmation when a prior `XX-UI-REVIEW\.md` already exists/i
  );

  const reviewSkill = files["skills/blueprint-review/SKILL.md"];
  assert.match(
    reviewSkill,
    /explicit `files` must be repo-relative file paths\. Directories, wildcards, absolute paths, and `\.blueprint\/\*\*` paths are invalid or skipped/i
  );
  assert.match(
    reviewSkill,
    /Keep the scope confirmation gate explicit when\s+`blueprint_review_scope\.confirmationRecommended`\s+says the resolved review\s+crossed deterministic thresholds/i
  );
  assert.match(
    reviewSkill,
    /`blueprint_phase_plan_read`; do not guess the review scope from unstaged repo\s+drift/i
  );
});

test("review remediation contracts stay bounded to saved evidence and approved selection", async () => {
  const files = await readRepoFiles([
    "docs/commands/code-review-fix.md",
    "docs/commands/audit-fix.md",
    "skills/blueprint-review/SKILL.md"
  ]);

  const codeReviewFix = files["docs/commands/code-review-fix.md"];
  assert.match(
    codeReviewFix,
    /loads the saved findings first, narrows the fix set to explicitly selected or high-confidence auto-selected findings/i
  );
  assert.match(
    codeReviewFix,
    /It does not currently imply atomic git commits, branch creation, or a separate fixer-agent loop/i
  );
  assert.match(
    codeReviewFix,
    /`--auto` is a bounded finding-selection shortcut only/i
  );
  assert.match(
    codeReviewFix,
    /it does not authorize automatic commits, automatic PR creation, or capped re-review loops/i
  );
  assert.match(
    codeReviewFix,
    /Do not recreate finding ids or severity from chat memory, current branch drift, or a second prompt-only review/i
  );
  assert.match(
    codeReviewFix,
    /Keep pending gates limited to overwrite confirmation and finding-selection confirmation; broader repair planning should route to another implemented command instead of widening this command in place/i
  );

  const auditFix = files["docs/commands/audit-fix.md"];
  assert.match(
    auditFix,
    /starts from saved evidence instead of chat memory/i
  );
  assert.match(
    auditFix,
    /treat the returned `files` list as authoritative instead of widening scope from git drift or chat memory/i
  );
  assert.match(
    auditFix,
    /Do not classify from unstaged drift or prompt memory alone/i
  );
  assert.match(
    auditFix,
    /Apply `--severity` and `--max` after classification, keep remediation bounded to that capped candidate set, and stop on first failed fix attempt or failed required verification/i
  );
  assert.match(
    auditFix,
    /Use Gemini CLI `ask_user` for non-trivial mutation confirmation before editing files/i
  );
  assert.match(
    auditFix,
    /Use Gemini CLI `ask_user` for report overwrite confirmation/i
  );
  assert.match(
    auditFix,
    /Tracker use is session-local coordination only and must be paired with visible `write_todos`; it does not replace Blueprint MCP persistence/i
  );

  const reviewSkill = files["skills/blueprint-review/SKILL.md"];
  assert.match(
    reviewSkill,
    /Treat `--auto` as bounded finding selection only\./i
  );
  assert.match(
    reviewSkill,
    /does\s+not authorize automatic commits, branch creation, or iterative re-review\s+loops/i
  );
  assert.match(
    reviewSkill,
    /Do not guess review scope from unstaged repo drift when saved phase evidence/i
  );
  assert.match(
    reviewSkill,
    /Keep repo mutation tightly bounded to the resolved review scope and capped/i
  );
});

test("docs contracts keep repo truth authoritative and external verification opt-in", async () => {
  const files = await readRepoFiles([
    "docs/commands/docs-update.md",
    "skills/blueprint-docs/SKILL.md"
  ]);

  const docsUpdate = files["docs/commands/docs-update.md"];
  assert.match(
    docsUpdate,
    /resolved scope must stay tied to the selected doc files plus the digest `inputsUsed`/i
  );
  assert.match(
    docsUpdate,
    /Treat the returned `inputsUsed` list as the authoritative digest scope instead of re-describing or widening the evidence set afterward/i
  );
  assert.match(
    docsUpdate,
    /repo truth must stay distinct from cited external truth whenever the run actually uses outside sources/i
  );
  assert.match(
    docsUpdate,
    /treats external source checks as optional cited evidence instead of a substitute for repo truth/i
  );
  assert.match(
    docsUpdate,
    /When external verification is genuinely needed, keep cited external truth separate in the report instead of flattening it into the same evidence claim/i
  );
  assert.match(
    docsUpdate,
    /Continue with repo truth only and report that external verification was skipped when web tools are unavailable/i
  );
  assert.match(
    docsUpdate,
    /Route broad evidence-light refreshes to `\/blu-map-codebase` instead of improvising documentation from chat memory/i
  );

  const docsSkill = files["skills/blueprint-docs/SKILL.md"];
  assert.match(
    docsSkill,
    /Use external web tools only when the user\s+explicitly asked for outside verification/i
  );
  assert.match(
    docsSkill,
    /Keep cited external truth separate from repo truth/i
  );
  assert.match(
    docsSkill,
    /Treat `--verify-only` as read-only for repo docs/i
  );
  assert.match(
    docsSkill,
    /Keep repo mutations scoped to the selected documentation files only/i
  );
});

test("review and docs agents stay read-only with parent-owned confirmation and persistence", async () => {
  const files = await readRepoFiles([
    "agents/blueprint-reviewer.md",
    "agents/blueprint-verifier.md",
    "agents/blueprint-security-auditor.md",
    "agents/blueprint-ui-auditor.md",
    "agents/blueprint-doc-writer.md",
    "agents/blueprint-doc-verifier.md"
  ]);

  const sharedAgentChecks: Array<[string, RegExp[]]> = [
    [
      files["agents/blueprint-reviewer.md"],
      [
        /## Parent-Owned Responsibilities/,
        /`update_topic`, `write_todos`, and `ask_user`/,
        /The parent command owns `blueprint_review_validate_model`,\s+`blueprint_review_record`, and every other MCP-backed validation or\s+persistence step/i,
        /The parent command owns any non-code-review reuse contract/i,
        /Remain read-only; the parent command owns MCP persistence and any repo\s+mutation/i,
        /Do not invent shell commands, external reviewers, web research, or manual\s+persistence paths/i
      ]
    ],
    [
      files["agents/blueprint-verifier.md"],
      [
        /## Parent-Owned Responsibilities/,
        /The parent command owns validation-state writes, report persistence, and\s+every other MCP-backed persistence step/i,
        /Remain read-only; the parent command owns MCP persistence and any repo\s+mutation/i,
        /Do not invent shell commands, external reviewers, web research, or a second\s+persistence path/i
      ]
    ],
    [
      files["agents/blueprint-security-auditor.md"],
      [
        /## Parent-Owned Responsibilities/,
        /explicit user-approved exceptions or known follow-up constraints/i,
        /Remain read-only; the parent command owns MCP persistence and any repo\s+mutation/i,
        /Do not invent shell commands, external reviewers, web research, or manual\s+persistence paths/i
      ]
    ],
    [
      files["agents/blueprint-ui-auditor.md"],
      [
        /## Parent-Owned Responsibilities/,
        /Remain read-only; the parent command owns MCP persistence and any repo\s+mutation/i,
        /do not invent screenshots, shell-driven visual checks, outside\s+reviewers, or web truth/i,
        /Do not invent shell commands, external reviewers, web research, or manual\s+persistence paths/i
      ]
    ],
    [
      files["agents/blueprint-doc-writer.md"],
      [
        /## Parent-Owned Responsibilities/,
        /The parent command owns doc-scope selection, broad-scope or overwrite\s+confirmation, any external-verification decision, and final routing/i,
        /any optional external sources explicitly supplied or approved by the parent/i,
        /Stay read-only; the parent command owns file mutation and report\s+persistence/i,
        /Do not widen beyond the parent-selected doc files, digest scope, or approved\s+external sources/i
      ]
    ],
    [
      files["agents/blueprint-doc-verifier.md"],
      [
        /## Parent-Owned Responsibilities/,
        /The parent command owns doc-scope selection, broad-scope or overwrite\s+confirmation, any external-verification decision, and final routing/i,
        /any optional external sources explicitly supplied or approved by the parent/i,
        /Stay read-only; the parent command owns repo edits and MCP\s+persistence/i,
        /Do not invent shell commands, external reviewers, web research outside the\s+approved scope, or a second persistence path/i
      ]
    ]
  ];

  for (const [agentFile, patterns] of sharedAgentChecks) {
    for (const pattern of patterns) {
      assert.match(agentFile, pattern);
    }
  }
});
