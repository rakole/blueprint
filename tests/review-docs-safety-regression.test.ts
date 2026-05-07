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
    "commands/blu-code-review.toml",
    "commands/blu-review.toml",
    "commands/blu-secure-phase.toml",
    "commands/blu-ui-review.toml",
    "skills/blueprint-review/SKILL.md",
    "skills/blueprint-review/references/review-runtime-contract.md"
  ]);

  const codeReview = files["commands/blu-code-review.toml"];
  assert.match(
    codeReview,
    /runtime contract's shared review posture/i
  );
  assert.match(
    codeReview,
    /do not pass directories, wildcards, `\.blueprint\/\*\*`, or absolute filesystem paths/i
  );
  assert.match(
    codeReview,
    /do not widen it from chat memory or unstaged changes/i
  );
  assert.match(
    codeReview,
    /If explicit files were supplied, treat the returned `files` list as the exact user-selected scope/i
  );
  assert.match(
    codeReview,
    /require explicit overwrite confirmation before changing it/i
  );

  const review = files["commands/blu-review.toml"];
  assert.match(
    review,
    /Review only the selected phase plans plus directly related saved evidence/i
  );
  assert.match(
    review,
    /pending gate \(`none`, overwrite confirmation, reviewer-availability confirmation, or `reviewer-availability`\)/i
  );
  assert.match(
    review,
    /Read the saved plan set through `mcp_blueprint_blueprint_phase_plan_read`/i
  );
  assert.match(
    review,
    /Use `ask_user` for overwrite confirmation and any structured reviewer-availability confirmation/i
  );
  assert.match(
    review,
    /Read `mcp_blueprint_blueprint_artifact_contract_read` for the canonical `review\.peer-review` contract, read `mcp_blueprint_blueprint_config_get` with `scope: "effective"` before any optional reviewer decision, and read `mcp_blueprint_blueprint_review_authoring_context`/i
  );
  assert.match(
    review,
    /use the `blueprint-reviewer` subagent only for read-only packet and consensus\/disagreement analysis/i
  );
  assert.match(
    review,
    /If that subagent is unavailable or unnecessary, use the local runtime contract's no-subagent fallback/i
  );

  const reviewRuntimeContract = files["skills/blueprint-review/references/review-runtime-contract.md"];
  assert.match(
    reviewRuntimeContract,
    /contract\.modelContract.*canonical shape\s+for model authoring and MCP-rendered `XX-REVIEWS\.md`/is
  );
  assert.match(
    reviewRuntimeContract,
    /The peer-review artifact must be useful standalone review evidence, not merely\s+valid Markdown/i
  );
  assert.match(
    reviewRuntimeContract,
    /If `blueprint_review_validate_model` or `blueprint_review_record` rejects the\s+model,\s+repair all diagnostics together once against `review\.peer-review`/i
  );
  assert.match(
    reviewRuntimeContract,
    /Browser-only, web-search-only, shell-only, or generic helpers are not\s+acceptable substitutes/i
  );

  const securePhase = files["commands/blu-secure-phase.toml"];
  assert.match(
    securePhase,
    /saved phase threat model from the executed plan evidence and build the bounded threat register from the declared scope/i
  );
  assert.match(
    securePhase,
    /Use `ask_user` for overwrite confirmation and any structured verify-versus-accept decision/i
  );

  const uiReview = files["commands/blu-ui-review.toml"];
  assert.match(
    uiReview,
    /next logical implemented Blueprint action/i
  );
  assert.match(
    uiReview,
    /require explicit overwrite confirmation before changing it/i
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
    "commands/blu-code-review-fix.toml",
    "commands/blu-audit-fix.toml",
    "skills/blueprint-review/SKILL.md"
  ]);

  const codeReviewFix = files["commands/blu-code-review-fix.toml"];
  assert.match(
    codeReviewFix,
    /Read `mcp_blueprint_blueprint_review_load_findings`[\s\S]*load the saved `XX-REVIEW\.md` findings/i
  );
  assert.match(
    codeReviewFix,
    /Do not create git commits or branches automatically/i
  );
  assert.match(
    codeReviewFix,
    /Treat `--auto` as bounded automatic finding selection only/i
  );
  assert.match(
    codeReviewFix,
    /does not authorize any auto-fixer behavior, automatic commits, branch creation, or hidden iterative re-review loops/i
  );
  assert.match(
    codeReviewFix,
    /instead of recreating findings from chat memory or current git drift/i
  );
  assert.match(
    codeReviewFix,
    /Keep pending gates limited to overwrite confirmation or finding-selection confirmation/i
  );

  const auditFix = files["commands/blu-audit-fix.toml"];
  assert.match(
    auditFix,
    /Classify candidate issues only from selected saved evidence/i
  );
  assert.match(
    auditFix,
    /Do not widen or reinterpret review scope after `mcp_blueprint_blueprint_review_scope` returns; its `files` list is authoritative/i
  );
  assert.match(
    auditFix,
    /Do not classify from unstaged drift alone or chat memory/i
  );
  assert.match(
    auditFix,
    /chosen source\/severity\/max filters/i
  );
  assert.match(
    auditFix,
    /use Gemini CLI's `ask_user` for explicit confirmation when remediation is non-trivial/i
  );
  assert.match(
    auditFix,
    /require explicit overwrite confirmation before replacing it/i
  );
  assert.match(
    auditFix,
    /Treat tracker state as session-local coordination only, pair it with visible `write_todos`/i
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
    "skills/blueprint-docs/references/docs-update-runtime-contract.md",
    "skills/blueprint-docs/SKILL.md"
  ]);

  const docsUpdate = files["skills/blueprint-docs/references/docs-update-runtime-contract.md"];
  assert.match(
    docsUpdate,
    /Resolve the documentation scope before drafting or verification/i
  );
  assert.match(
    docsUpdate,
    /Treat returned `inputsUsed` as the authoritative digest scope/i
  );
  assert.match(
    docsUpdate,
    /Keep cited external truth separate from repo truth/i
  );
  assert.match(
    docsUpdate,
    /Use external web verification only when the user explicitly requested it/i
  );
  assert.match(
    docsUpdate,
    /a\s+claim depends on current external API, library, product, or standards facts/i
  );
  assert.match(
    docsUpdate,
    /If external verification was requested but unavailable, continue\s+from repo truth and say what was skipped/i
  );
  assert.match(
    docsUpdate,
    /If a broad refresh lacks the saved codebase mapping bundle, stop and route to\s+`\/blu-map-codebase`/i
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
