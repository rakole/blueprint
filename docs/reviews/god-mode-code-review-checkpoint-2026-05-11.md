# God Mode Code Review Checkpoint

Date: 2026-05-11

Status: design checkpoint only. No implementation has been done.

This document captures the agreed shape for a private "god mode" extension of
Blueprint's existing code-review and code-review-fix flows. It is an internal
planning artifact, not public command documentation. The hidden flags and
private MCP substrate described here should not be surfaced from `/blu`,
`/blu-help`, `/blu-progress`, public command docs, or runtime catalog output.

## Goal

Add a deliberate heavy-review path that can run deeper, multi-pass analysis
without interfering with the current Blueprint review lifecycle.

The mode should:

- run only when a hidden flag is supplied
- process one focused review group per invocation
- resume from a phase-local or report-local session JSON file
- append every review pass to one god-review Markdown report
- keep normal `XX-REVIEW.md`, `XX-REVIEW-FIX.md`, quality gates, and state routing untouched
- optionally let hidden code-review-fix mode remediate selected god-review findings later

## Hidden Command Surface

Proposed private triggers:

- `/blu-code-review <phase> --feels-like-god`
- `/blu-code-review <phase> --feels-like-god --continue`
- `/blu-code-review --feels-like-god --pr <number>`
- `/blu-code-review --feels-like-god --current-diff`
- `/blu-code-review --feels-like-god --files <repo-relative paths...>`
- `/blu-code-review-fix --feels-like-god`
- `/blu-code-review-fix --feels-like-god --finding <GOD-ID>`
- `/blu-code-review-fix --feels-like-god --severity high|medium|low`
- `/blu-code-review-fix --feels-like-god --all`

`--feels-like-god` is intentionally undocumented. Tests should prove support
exists without letting the flag appear in public docs, help output, root routing,
or command-catalog guidance.

## Non-Interference Rules

God mode must stay outside the ordinary review lifecycle.

- Do not write or update normal `XX-REVIEW.md`.
- Do not write or update normal `XX-REVIEW-FIX.md`.
- Do not route god-review findings through `blueprint_review_load_findings`.
- Do not update `STATE.md` next actions or quality-gate state.
- Do not make `/blu-progress`, `/blu-next`, or `/blu-help` recommend god mode.
- Do not auto-chain through hooks.
- Do not create commits, branches, PRs, or hidden git automation.
- Do not use the hidden mode to change public command status semantics.

Normal `/blu-code-review` should keep using the existing `review.code-review`
model contract, `blueprint_review_scope`, `blueprint_review_validate_model`, and
`blueprint_review_record`. God mode may reuse deterministic scope resolution,
but it needs separate session, report, finding, and remediation handling.

## Scope Modes

God mode should support these scope sources:

1. Phase scope: default deterministic phase scope, using the same source of
   truth as normal code review where possible.
2. PR scope: resolve files and diff context from `gh` CLI read access for a PR.
3. Current diff scope: resolve current working-tree and staged changes.
4. Explicit files: use repo-relative file paths supplied by the user.

The first run must freeze the resolved scope in session JSON. Continuation runs
must reuse that stored scope instead of rediscovering files from the current
repo or chat context. If the PR, diff, or working tree changes after the first
run, the command should warn and require an explicit refresh flag rather than
silently drifting.

## Session And Report Paths

For phase-backed runs:

- session: `.blueprint/phases/<phase-slug>/.god-review-session.json`
- report: `.blueprint/phases/<phase-slug>/XX-GOD-REVIEW.md`

For PR, diff, or non-phase runs:

- session: `.blueprint/reports/.god-review-<run-id>.json`
- report: `.blueprint/reports/god-review-<run-id>.md`

The session JSON is the continuation source of truth. The Markdown report is the
human-readable and parser-readable review record.

## Session Shape

Illustrative session JSON:

```json
{
  "schemaVersion": 1,
  "runId": "god-2026-05-11-abc123",
  "status": "in-progress",
  "scopeKind": "phase",
  "phase": 5,
  "reportPath": ".blueprint/phases/05-example/05-GOD-REVIEW.md",
  "files": ["src/example.ts", "tests/example.test.ts"],
  "scopeFingerprint": {
    "baseSha": "abc123",
    "headSha": "def456",
    "diffHash": "sha256:...",
    "prNumber": null
  },
  "groups": [
    { "id": "correctness-contracts", "status": "done" },
    { "id": "security-privacy-auth", "status": "pending" }
  ],
  "nextGroupId": "security-privacy-auth"
}
```

Continuation must trust `files`, `scopeKind`, and `scopeFingerprint` from this
session unless the user explicitly requests a scope refresh.

## Review Group Taxonomy

Each invocation should process exactly one pending group and append to the same
report.

1. Correctness and contracts
   - correctness
   - requirements alignment
   - edge cases
   - API contracts
   - backward compatibility
2. Security, privacy, and authorization
   - security
   - authorization and access control
   - privacy and compliance
   - input validation
3. Data, state, and consistency
   - data integrity
   - transactionality and consistency
   - domain modeling
   - state management
   - concurrency safety
   - async behavior
   - idempotency
4. Failure handling and reliability
   - failure handling
   - reliability
   - error handling
   - resource management
   - external dependency handling
5. Tests and verification
   - test coverage
   - test quality
   - static analysis
   - build and CI health
6. Architecture and maintainability
   - maintainability
   - readability
   - simplicity
   - modularity
   - separation of concerns
   - cohesion
   - coupling
   - encapsulation
   - abstraction design
   - dead code
   - duplication
   - technical debt
   - code ownership boundaries
7. Performance and scalability
   - performance
   - scalability
   - algorithmic complexity
   - database design
   - query efficiency
   - caching
   - cost efficiency
8. Operations, portability, and product surface
   - configuration management
   - feature flags
   - observability
   - logging
   - metrics
   - tracing
   - operational readiness
   - deployment safety
   - migration safety
   - rollback safety
   - monitoring and alerting
   - dependency management
   - documentation
   - reusability
   - extensibility
   - portability
   - environment compatibility
   - framework idioms
   - language idioms
   - accessibility
   - localization
   - analytics and instrumentation
   - developer experience
   - reviewability
   - future change risk

## Report Format

The report should be a single append-only Markdown document. Every group
section should be stable enough for hidden fix mode to parse without depending
on normal review artifacts.

Suggested section shape:

```md
## GOD-02 Security, Privacy, And Authorization

Status: completed
Scope: frozen session scope

### Findings

#### GOD-SEC-001: Missing authorization check before project mutation
- Severity: high
- Disposition: follow-up
- Files: `src/example.ts:42`
- Evidence: ...
- Impact: ...
- Recommendation: ...

### Positive Signals

- ...

### Uncertainties

- ...
```

Finding IDs should be stable and unique across the whole report. Disposition
should distinguish actionable follow-up findings from observations, blocked
items, accepted risks, and validation-only notes.

## Private MCP Substrate

Prefer private MCP tools over prompt-owned direct file writes, even though the
flags are hidden. The tools can be omitted from public docs while still giving
the hidden command branch deterministic path safety, append behavior, scope
reuse, and parsing.

Candidate private tools:

- `blueprint_god_review_start`
- `blueprint_god_review_next`
- `blueprint_god_review_append`
- `blueprint_god_review_load_findings`
- `blueprint_god_review_record_fix`

Because these tools are intentionally not public documentation surfaces, the
TypeScript implementation should include clear maintainer comments. Comments
should explain:

- the tools are private support for hidden `--feels-like-god` modes
- normal `review.code-review` and `review.review-fix` flows must not depend on them
- session JSON owns continuation scope
- continuation must not silently rediscover scope
- god-review findings must not flow through `blueprint_review_load_findings`
- fix mode defaults must exclude observations and low-severity findings unless explicit
- results must not affect quality-gate routing, `STATE.md`, or public catalogs

Suggested module-level comment:

```ts
/**
 * Private god-review substrate for hidden `--feels-like-god` review/fix modes.
 *
 * These tools are intentionally omitted from public Blueprint docs and routing
 * surfaces. They exist so the hidden command branch can get deterministic path
 * safety, session continuation, report append behavior, and finding parsing
 * without overloading the normal `review.code-review` / `XX-REVIEW.md` flow.
 *
 * Do not wire these results into quality-gate routing, `STATE.md` next actions,
 * public command catalog output, or `blueprint_review_load_findings`.
 */
```

## Fix Mode Policy

Hidden god-mode fix should read `GOD-*` findings from the god-review report and
default to a conservative selection:

- include actionable `follow-up` findings only
- prefer high and medium severity by default
- require explicit IDs, `--severity low`, or `--all` for broader remediation
- exclude observations, accepted risks, blocked review notes, and validation-only
  notes unless explicitly selected
- avoid commits, branches, PRs, and hidden automation unless separately requested
- append remediation evidence to the god-review report or a separate
  `XX-GOD-REVIEW-FIX.md` style report, but do not update normal review-fix artifacts

Fix mode should stay bounded to the frozen session scope and implicated files.
If the current code no longer matches the saved god-review evidence, it should
mark the finding stale or require explicit user confirmation before editing.

## Fresh Context Loop

Hooks should not be used for continuation.

Instead:

1. First invocation creates or reuses the session.
2. The command processes one pending group.
3. The command appends the group section to the report.
4. The command updates the session status and `nextGroupId`.
5. The command ends with the next exact hidden continuation invocation.

This creates fresh-context behavior because each run can be restarted with
`--continue`, while deterministic session state prevents the model from
inventing scope or losing progress.

## Test Expectations

Tests should lock both hidden support and non-interference.

Recommended coverage:

- hidden `--feels-like-god` branch exists for code-review and code-review-fix
- public docs, help, root router, progress, next, and command catalog do not mention the flag
- normal `/blu-code-review` still uses `review.code-review` and `XX-REVIEW.md`
- god mode writes only god-review session/report paths
- god mode does not update `STATE.md` next action or quality-gate status
- initial run records resolved scope in session JSON
- continuation reuses stored scope and does not rediscover files
- changed diff or PR fingerprint warns or blocks without explicit refresh
- one invocation appends one review group only
- report parser extracts `GOD-*` findings without requiring `XX-REVIEW.md`
- fix mode default selection includes only actionable high/medium follow-up findings
- `--all`, explicit IDs, and severity filters widen selection only when explicit
- fix mode does not create commits, branches, PRs, or normal review-fix artifacts by default
- tracked built outputs and runtime tests remain fresh after implementation

## Research Appendix

This appendix collects external research that informs the eventual god-mode
implementation. Each subsection should keep the finding actionable for
Blueprint's hidden review/fix design rather than becoming a generic literature
dump.

### Research: Skill Design And Prompt Packaging

- Treat a skill as a portable, versioned bundle rather than a giant prompt. The [Agent Skills overview](https://agentskills.io/) and [specification](https://agentskills.io/specification) frame a skill as `SKILL.md` plus optional `scripts/`, `references/`, and `assets/`, loaded through progressive disclosure: startup sees only name/description, activation loads the main instructions, and extra files load only as needed. Claude Code's [skills docs](https://code.claude.com/docs/en/skills) make the same point operationally: unlike always-on project context, a skill body loads only when used.
- The activation description is part of the prompt budget and should be engineered as carefully as the body. The Agent Skills spec requires a concise `description` that says both what the skill does and when to use it; Claude Code adds that `description`/`when_to_use` text is truncated in the skill listing, so the trigger keywords and disambiguating boundaries need to appear early.
- Keep `SKILL.md` small and navigational. Claude Code recommends keeping the body concise because invoked skill content remains in context across turns, and both Claude Code and Agent Skills recommend moving detailed material to references when the file gets large. The Agent Skills [best-practices guide](https://agentskills.io/skill-creation/best-practices) is especially blunt: every token in an activated skill competes with conversation history, system context, and other active skills.
- Scope skills like functions: one coherent unit of work with defaults, gotchas, and validation, not a menu of every possible approach. The best-practices guide recommends grounding skills in real project artifacts, preserving corrections learned from actual runs, using concrete gotchas, and favoring concise procedures plus working examples over exhaustive general advice.
- Command-scoped inputs should be explicit and structured. Claude Code supports `$ARGUMENTS`, named arguments, dynamic context injection, and forked skill execution; Google's [Gemini prompt strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies) also emphasize clear separators for role, constraints, context, task, and output format, with critical instructions at the start and specific questions after large context blocks. For Blueprint, this argues for a god-mode review prompt that receives a bounded review target, mode, evidence paths, and output contract instead of rereading broad repo state by habit.
- Tool access has to be designed, not merely listed. Anthropic's [building effective agents](https://www.anthropic.com/engineering/building-effective-agents) guidance treats tool definitions as an agent-computer interface that needs examples, edge cases, clear parameter names, and testing. Claude Code's skills docs also note that `allowed-tools` pre-approves tools while a skill is active but does not itself deny other tools; true restriction belongs in agent/tool permission configuration.
- Specialized subagents are a context-control mechanism. Claude Code's [subagent docs](https://code.claude.com/docs/en/sub-agents) recommend them when a side task would otherwise flood the main conversation with search results, logs, or file contents; each subagent can have its own prompt, context window, tools, and permissions. OpenAI's [Agents SDK docs](https://openai.github.io/openai-agents-js/guides/agents/) similarly separate specialist instructions, tools, context objects, handoffs, structured outputs, and runtime state.
- Evals should test the skill, not just the final answer. Agent Skills' [evaluation guide](https://agentskills.io/skill-creation/evaluating-skills) recommends realistic prompts, with-skill versus baseline runs, clean contexts, token/time capture, assertions, human review, and transcript analysis. OpenAI's [agent evals](https://developers.openai.com/api/docs/guides/agent-evals) and [evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices) add that agent evals should inspect traces for tool choice, tool arguments, handoffs, instruction adherence, and regressions.
- Durable state should be a first-class artifact, not an accident of chat history. The [12-factor agents](https://github.com/humanlayer/12-factor-agents) guidance to own prompts, own the context window, and unify execution state with business state maps well to Blueprint: make the review session/report data serializable, resumable, and auditable, while keeping sensitive or bulky material out of active model context unless the current step needs it.

Implications for Blueprint:

- Put only the hidden god-mode review contract, mode switch, hard constraints, and core checklist in the skill body; move taxonomy, output templates, examples, and long rationale into referenced files.
- Make the command pass a resolved scope, continuation/session id, source-of-truth artifacts, and requested mode; the skill should not silently widen scope or rediscover when continuation state exists.
- Run broad research/review passes in isolated, read-only subagent contexts with constrained tools; keep fix-mode and write-capable behavior separated by explicit user intent.
- Build regression evals around real Blueprint review misses, including trace checks for scope discipline, finding evidence, duplicate handling, output schema, and whether the skill avoided unnecessary context loading.

### Research: Code Review Agent Patterns

Current practice points toward a bounded, evidence-first review loop rather than
one giant model pass. Google's reviewer guide still provides the strongest
baseline rubric: review design, behavior, complexity, tests, naming, comments,
style, docs, and "every line" in assigned scope, while explicitly looking beyond
the diff when whole-file or system context is needed
([Google Engineering Practices](https://google.github.io/eng-practices/review/reviewer/looking-for.html)).
The same guide recommends first taking a broad view, then reviewing the main
logical files, then walking the rest in sequence; sometimes reading tests first
helps reconstruct intended behavior
([Navigating a CL](https://google.github.io/eng-practices/review/reviewer/navigate.html)).
For an LLM reviewer, that argues for separate passes with fresh context:
scope/intent reconstruction, architecture and behavior, tests, security, then
dedupe/severity normalization.

LLM-specific research reinforces that context must be deliberate and scoped.
A 2025 field study of LLM-assisted code review found traditional review pain
around context switching and insufficient context, and evaluated tools that use
semantic retrieval to assemble relevant context before review
([Adalsteinsson et al., 2025](https://arxiv.org/abs/2505.16339)).
That supports hidden review agents that receive a narrow file set plus selected
adjacent contracts, tests, docs, and prior artifacts, rather than the whole repo
or diff-only snippets. It also supports fresh-context reruns: independent passes
reduce anchoring on a previous model's explanation, while a final aggregator can
merge duplicates and resolve disagreements.

Findings should be line-grounded, dispositioned, and finite. GitHub Copilot
reviews intentionally behave as comments rather than approvals or merge-blocking
decisions, can provide suggested changes, accept feedback on individual comments,
and require explicit re-review after new pushes
([GitHub Docs](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/use-code-review)).
Qodo's product docs show a useful structure for AI review output: findings are
grouped by category and priority, include quality-impact labels, code references,
evidence, fix-assistance prompts, resolved/dismissed state, and audit history
([Qodo finding anatomy](https://docs.qodo.ai/code-review/get-started/use-qodo-in-prs/comment-anatomy)).
For Blueprint, the agent should emit only findings that include file/line,
observed evidence, impact, confidence, disposition (`BLOCKING`, `FOLLOW_UP`,
`FYI`, or `DISMISS`), and a remediation handoff payload.

False-positive control is as important as raw recall. Google's comment guidance
separates required changes from nits, optional suggestions, and FYIs, which keeps
authors from treating every comment as mandatory
([review comment severity](https://google.github.io/eng-practices/review/reviewer/comments.html)).
Recent LLM-review papers show two concrete hazards: models can overcorrect valid
code when judging requirement conformance, motivating fix-guided verification
against tests/spec-constrained checks
([Are LLMs Reliable Code Reviewers?](https://arxiv.org/abs/2603.00539)), and
security review can be biased by PR framing, with metadata redaction and explicit
debiasing instructions restoring detection in the studied cases
([Contextual Bias in LLM-Assisted Security Code Review](https://arxiv.org/abs/2603.18740)).
The hidden review should therefore demand a proof hook for serious findings:
failing or missing test, contract mismatch, reachable code path, security data
flow, runtime evidence, or a minimal counterexample. Low-confidence concerns
belong in `FYI` or should be dropped.

Security and test-quality review need their own rubric passes. OWASP emphasizes
that secure code review complements automated tools by examining application
logic, data flow, and context-specific flaws that scanners miss
([OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)).
Google's rubric treats tests as reviewable code: reviewers should ask whether
tests would fail when the implementation is broken, whether assertions are useful,
and whether test complexity is maintainable. Repair research points in the same
direction: LLM repair improves when it uses runtime/test evidence instead of only
surface failure symptoms
([NIST APR overview](https://csrc.nist.gov/pubs/journal/2025/06/can-ai-fix-buggy-code/final),
[DebugRepair](https://arxiv.org/abs/2604.19305)). A review-to-fix handoff should
therefore carry verification hints, not just prose.

Implications for Blueprint:

- Run god-mode review as multiple hidden rubric passes with fresh context and a
  final deterministic aggregation/dedupe step.
- Preserve scoped context: resolved files, adjacent contracts, tests, docs, and
  prior Blueprint artifacts should be explicit inputs and recorded in session
  metadata.
- Require every actionable finding to include file/line evidence, category,
  severity, confidence, disposition, and remediation handoff fields.
- Treat security and test quality as first-class passes, not incidental comments.
- Bias toward fewer, higher-confidence findings; classify advisory concerns as
  `FYI` or drop them when evidence is thin.
- Store enough audit trail to support continuation, re-review after code changes,
  and downstream fix-mode selection without rediscovering scope.

### Research: Production Open Source Review Tools

Production review tools converge on a few durable patterns that matter more
than any single product design:

- [PR-Agent / Qodo Merge](https://github.com/The-PR-Agent/pr-agent) treats the
  PR as the review unit, with `/describe`, `/review`, `/improve`, and `/ask`
  available through GitHub Actions, CLI, Docker, webhooks, and multiple git
  providers. Its [compression strategy](https://qodo-merge-docs.qodo.ai/core-abilities/compression_strategy/)
  is explicitly token-aware: exclude binaries/non-code, expand patch context
  for small PRs, prioritize additions over deletion-only hunks for large PRs,
  include "other modified files" metadata when patches no longer fit, and hard
  stop rather than silently pretending the whole diff was reviewed. Qodo v2 adds
  repo/PR-history/rule context and multi-agent review, while its config surface
  exposes output placement, push-trigger reruns, CI feedback, ignore rules, and
  custom issue/compliance instructions through `.pr_agent.toml`.
- Qodo's public configuration is a good noise-control reference: findings can
  be posted as summary, inline, or both; inline publication has severity
  thresholds (`action_required`, `remediation_recommended`, `informational`);
  finding overflow can collapse long result sets; push-trigger commands can
  re-run on new commits; CI feedback can update a persistent comment; and ignore
  rules can filter by title, branch, label, or author. The important lesson is
  that review automation needs first-class publication policy, not only better
  prompts.
- [reviewdog](https://github.com/reviewdog/reviewdog) is the cleanest open
  source model for "parseable diagnostics in, code-host feedback out." It can
  ingest tool-specific errorformat, checkstyle XML, SARIF, unified diff, or
  `rdjson`/`rdjsonl`; its RDFormat carries ranged locations, severity, rule
  code/URL, and code suggestions. Its filter modes (`added`, `diff_context`,
  `file`, `nofilter`) make scope explicit, and its reporter matrix documents
  where inline suggestions are possible versus where checks/annotations or
  console output are required. Blueprint should copy that honesty around host
  API limits.
- [Danger JS](https://danger.systems/js/reference) shows the value of
  repo-owned review rules over generic model taste. A typed `Dangerfile` reads
  PR metadata and git file lists, then emits `message`, `warn`, `fail`, or raw
  markdown; file/line arguments allow inline feedback when the line is inside
  the PR diff, with non-diff output falling back to the main comment. Danger's
  "ignore this exact warning/error text" convention is crude but useful: every
  suppression needs to be visible, reviewable, and tied to the emitted finding.
- [Semgrep CI](https://semgrep.dev/docs/semgrep-ci/findings-ci) has one of the
  better finding identity models: a CI finding is keyed by rule ID, file path,
  syntactic context, and an index for duplicate contexts. It also models
  lifecycle states (`OPEN`, reviewing, fixing, ignored, fixed, closed/removed),
  supports diff-aware scans, and lets teams ignore through the platform or
  `nosemgrep` comments with reasons such as false positive or accepted risk.
  Its [PR comment docs](https://semgrep.dev/docs/semgrep-appsec-platform/github-pr-comments)
  also separate Comment mode from Block mode and recommend exposing only high
  severity/high confidence rules as developer-visible comments.
- [SonarQube](https://docs.sonarsource.com/sonarqube-server/quality-standards-administration/managing-quality-gates/introduction-to-quality-gates)
  reinforces the "new code" policy pattern: PR quality gates apply conditions
  to changes relative to the target branch, can decorate PRs and fail CI, and
  should avoid making every historical issue a PR blocker. Its
  [issue lifecycle](https://docs.sonarsource.com/sonarqube-server/10.5/user-guide/issues)
  distinguishes open, accepted, fixed, and false-positive states, and supports
  primary plus secondary locations/flows for path-sensitive findings. That is a
  better mental model than a flat markdown bullet list for complex review
  evidence.
- [Aider](https://aider.chat/docs/repomap.html) is not primarily a PR-review
  bot, but its agent workflow is relevant to god-mode fix loops. It builds a
  token-budgeted repo map, lets users mark editable versus read-only files, and
  can run lint/test commands after edits; failed commands are fed back so the
  agent can repair its own changes. Its [lint/test loop](https://aider.chat/docs/usage/lint-test.html)
  and [YAML config](https://aider.chat/docs/config/aider_conf.html) point toward
  a separation Blueprint should keep: review findings are durable evidence,
  while fix mode is a controlled edit loop with explicit scope, commands, and
  acceptance checks.

Implications for Blueprint:

- Store a resolved review scope with base/head fingerprint, changed files,
  included hunks, skipped files, and token-budget omissions; continuation should
  warn or require refresh when that fingerprint changes.
- Give every god-mode finding a stable ID derived from rule/family, path, line
  or hunk anchor, and normalized summary; preserve previous IDs across reruns
  when anchors still match.
- Model findings as structured records first and markdown second: severity,
  confidence, category, evidence, locations, suggested fix, suppression state,
  source agent/tool, and machine-parseable lifecycle status.
- Separate publication policy from detection: hidden report, summary-only,
  inline-worthy, and CI-blocking findings should be configurable thresholds, not
  hardcoded prompt behavior.
- Require explicit suppressions with reasons and provenance, and carry them
  through incremental review instead of rediscovering the same accepted risk.
- Treat suggested fixes as patches tied to finding IDs and verification
  commands; fix mode should select only actionable findings by default and
  should not silently widen scope.

### Research: Frontier And Closed Source Review Products

Closed-source and frontier review products are converging on a narrow product
shape: review the PR or local diff in its real codebase context, post a small
number of prioritized findings where developers already work, and keep fixes
available but human-mediated.

- [GitHub Copilot code review](https://docs.github.com/en/copilot/concepts/agents/code-review)
  reviews PRs and IDE changes, excludes some low-value file types by default,
  uses full-project context when agentic capabilities are available, and can
  hand suggestions to Copilot cloud agent to create a separate fix PR. GitHub
  explicitly withholds model selection for the code-review product and warns
  that humans must validate the feedback.
- Copilot's
  [custom instruction support](https://docs.github.com/en/copilot/concepts/prompting/response-customization)
  is intentionally bounded: repository-wide and path-specific instructions can
  shape review, but PR review reads instructions from the base branch and only
  the first 4,000 characters of each instruction file. That is a useful precedent
  for deterministic instruction scoping and avoiding unbounded prompt stuffing.
- [Claude Code Review](https://code.claude.com/docs/en/code-review) exposes the
  strongest "god mode" analogue: multiple specialized agents review diff plus
  surrounding code, verify candidate issues, dedupe, rank by severity, and post
  inline findings plus a summary. It does not approve or block PRs. Trigger
  controls are per repo: once on PR creation, every push, or manual. `REVIEW.md`
  can recalibrate severity, cap nits, skip generated paths, require evidence,
  and define re-review convergence behavior.
- [Cursor Bugbot](https://docs.cursor.com/bugbot) reviews PR diffs on every PR
  update or by explicit comments such as `cursor review` / `bugbot run`, posts
  explanations and fix suggestions, and deep-links issues into Cursor or web
  agents. Its repo rules are simple and path-sensitive: root
  `.cursor/BUGBOT.md` always applies, and nearer `.cursor/BUGBOT.md` files are
  included while walking upward from changed files.
- [CodeRabbit](https://docs.coderabbit.ai/guides/code-review-overview) combines
  AI review with static analysis, classifies feedback as potential issues,
  refactor suggestions, or nits, assigns severity, updates incrementally on new
  commits, and supports one-click fixes. Its
  [auto-review controls](https://docs.coderabbit.ai/configuration/auto-review)
  cover branch, label, draft, title-keyword, author, and manual trigger behavior;
  its [path instructions and filters](https://docs.coderabbit.ai/configuration/path-instructions)
  separate "which files to review" from "how to review matching files."
- CodeRabbit's
  [code-guideline ingestion](https://docs.coderabbit.ai/knowledge-base/code-guidelines)
  is notable for interoperability: it auto-detects `AGENTS.md`, `CLAUDE.md`,
  `GEMINI.md`, Cursor rules, Copilot instructions, and similar files, then
  scopes each guideline file to its directory subtree. Its
  [agent integration](https://docs.coderabbit.ai/cli/cursor-integration) also
  emits structured findings with file locations, severity, and suggested
  approaches so another coding agent can implement fixes in a bounded loop.
- [Qodo Code Review](https://docs.qodo.ai/code-review) emphasizes multi-agent,
  context-aware review with low noise, pull-request history, organization
  standards, and rule enforcement. Its
  [PR review output](https://docs.qodo.ai/code-review/get-started/use-qodo-in-prs/code-review)
  includes actionability, explanation, line references, prioritized grouping,
  and agent-assisted fix prompts. Its
  [configuration model](https://docs.qodo.ai/code-review/get-started/configuration-overview)
  lets teams tune run triggers, feedback location, inline severity thresholds,
  surfaced finding counts, reviewed repositories/branches/files, and persistent
  comments through repo, wiki, organization, project, or portal settings.
- Qodo's older
  [`/improve` documentation](https://docs.qodo.ai/v1/tools/tools-list/improve)
  is still useful for fix ergonomics: suggestions have a summary, explanation,
  and before/after diff; controls include importance thresholds, "focus only on
  problems", persistent comments, more/update buttons, self-review
  acknowledgment, and disabled-by-default auto-approval.
- [Tabnine Git integrations](https://docs.tabnine.com/main/getting-started/tabnine-cli/git-integrations)
  show the prompt-driven CI variant: a headless agent runs on PR/MR events with
  access to the full repository, shell commands, platform API, organization
  context, and coaching guidelines. The included prompt fetches the diff,
  classifies change risk, audits correctness/security/performance, and posts
  inline comments, but teams can replace the prompt entirely.
- [Windsurf Quick Review](https://docs.windsurf.com/windsurf/quick-review) keeps
  review local and pre-commit: after an agent changes code, a separate review
  agent analyzes the diff in-editor. Enterprise admins control whether the
  feature and specific review models are enabled.
- Legacy [Amazon CodeGuru Reviewer](https://docs.aws.amazon.com/codeguru/latest/reviewer-ug/how-codeguru-reviewer-works.html)
  is less agentic but still instructive: it distinguished incremental PR review
  from full repository analysis, surfaced PR comments plus console findings,
  accepted developer feedback, and used
  [`aws-codeguru-reviewer.yml`](https://docs.aws.amazon.com/codeguru/latest/reviewer-ug/recommendation-suppression.html)
  to suppress generated, test, or irrelevant paths. Its 2025 availability change
  makes it precedent, not a current target.
- [Codex Security](https://openai.com/index/codex-security-now-in-research-preview/)
  points at the deeper frontier pattern for high-stakes review: build an
  editable threat model, inspect realistic attack paths, validate findings in an
  isolated environment before surfacing them, propose minimal patches, and keep
  patch application behind human review and normal PR flow.

Implications for Blueprint:

- Hidden god mode should be diff-first but not diff-only: gather plan, summary,
  saved review evidence, source context, and relevant repo instructions before
  ranking findings.
- Treat noise control as a first-class contract: severity definitions, nit caps,
  skipped paths, generated-file rules, re-review behavior, and evidence bars
  should be explicit and testable.
- Keep review and fix controls separate. Review can produce structured,
  prioritized findings; fix mode should consume selected findings, show planned
  edits, and leave staging/commit/PR actions to the user unless explicitly
  requested.
- Use repo-local instructions, but scope and bound them. Directory-sensitive
  rules and concise review-only guidance are safer than unbounded global prompt
  ingestion.
- Preserve auditability: every surfaced finding should carry file/line evidence,
  confidence or verification notes, severity/actionability, and enough fix
  guidance for an agent or human to act without re-litigating the whole review.

### Research: Adjacent Review Science And Extra Useful Inputs

External review guidance suggests god mode should be designed less like "more
comments" and more like a controlled evidence-gathering protocol.

- Security review should combine threat-specific lanes with manual judgment.
  OWASP's [Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  distinguishes baseline reviews from diff-based reviews and explicitly calls
  for human validation of automated findings, coverage-gap analysis, and metrics
  such as finding quality and manual coverage. OWASP's
  [Code Review Guide](https://owasp.org/www-project-code-review-guide/) also
  frames secure review as both process and vulnerability identification, not just
  scanner output. God mode should therefore record whether a finding came from
  manual reasoning, tool-assisted reasoning, or a contract mismatch, then require
  concrete exploitability or failure evidence before treating it as blocking.
- Security taxonomy should map to verification requirements, not only broad
  OWASP Top 10 labels. OWASP
  [ASVS](https://devguide.owasp.org/en/11-security-gap-analysis/01-guides/02-asvs/)
  is organized into verification sections such as architecture/threat modeling,
  authentication, session management, access control, validation, cryptography,
  error handling/logging, data protection, communications, malicious code,
  business logic, files/resources, APIs, and configuration. God mode can use
  Top 10 categories as triage labels, but ASVS-style requirement families are a
  better checklist for "what evidence did we inspect?"
- Reliability review needs pre-incident evidence. Google's
  [Production Readiness Review](https://sre.google/sre-book/evolving-sre-engagement-model/)
  model examines architecture, dependencies, instrumentation, metrics,
  monitoring, emergency response, capacity planning, change management,
  availability, latency, and efficiency before taking production ownership. The
  older Google
  [Launch Coordination Checklist](https://sre.google/sre-book/launch-checklist/)
  adds concrete prompts for load tests, failover, dependency death, timeout,
  retry, error handling, backups, disaster recovery, alerting, and security
  audit. God mode should turn "ops risk" into explicit evidence fields:
  observable symptom, detection path, rollback path, and likely user impact.
- API compatibility deserves its own compatibility verdict, separate from
  correctness. Microsoft's
  [.NET compatibility rules](https://learn.microsoft.com/en-us/dotnet/core/compatibility/library-change-rules)
  classify changes as allowed, disallowed, or judgment-required, while Azure's
  [API design guidance](https://learn.microsoft.com/ga-ie/azure/architecture/microservices/design/api-design)
  emphasizes backward-compatible additions, versioning for breaking changes, and
  idempotent operations. God mode findings should flag whether a change alters a
  public surface, response shape, exception behavior, event ordering,
  idempotency, or versioning promise, and should cite the affected consumer
  contract.
- Database and migration review should gate on deploy safety, not just schema
  intent. GitLab's
  [migration style guide](https://docs.gitlab.com/development/migration_style_guide/)
  highlights transaction boundaries, concurrent index operations, lock retries,
  post-deployment migrations, idempotent retryable changes, and reversibility
  comments. Its
  [database review guidelines](https://docs.gitlab.com/development/database_review/)
  add timing/performance checks and migration placement. God mode should require
  migration findings to name the rollout model, lock/contention risk, estimated
  runtime, reversibility or roll-forward story, and compatibility with old and
  new application versions.
- Human code-review research argues for context and reviewer specialization.
  Bacchelli and Bird's
  [modern code review study](https://www.microsoft.com/en-us/research/?p=164195)
  found that defect finding requires deep change understanding and that many
  review comments are code-improvement rather than defect comments. Google's
  [reviewer guide](https://google.github.io/eng-practices/review/reviewer/looking-for.html)
  tells reviewers to look beyond local diff lines into design, tests,
  concurrency, complexity, docs, full-file context, and qualified specialist
  review. Google's
  [small CL guidance](https://google.github.io/eng-practices/review/developer/small-cls.html)
  is also a warning for god mode: if a scope is too large, split it or label the
  review as partial. Hidden mode should let each lane declare reviewed files,
  skipped files, confidence, and specialist assumptions.
- Defect taxonomy should avoid flattening everything into severity. The
  fine-grained code-review concern taxonomy in
  [Concerns Identified In Code Review](https://kblincoe.github.io/publications/2022_IST_CodeReview.pdf)
  separates functional concerns from evolvability concerns and notes that review
  often catches future-maintenance risk that tests will not. God mode should
  store at least: severity, confidence, defect class, lifecycle risk
  (runtime/evolvability/operational/security), evidence type, reproducibility,
  affected contract, and suggested owner or specialist lane.
- Review-agent evaluation must measure false positives explicitly. The
  [SWE-PRBench dataset](https://huggingface.co/datasets/foundry-ai/swe-prbench)
  evaluates whether models identify human-flagged PR issues and reports that
  frontier models miss many human findings, especially as context grows.
  [CR-Bench](https://arxiv.org/abs/2603.11078) calls out the issue-resolution
  versus spurious-finding tradeoff. God mode should therefore be evaluated with
  precision, recall against seeded/human findings, duplicate rate, unsupported
  claim rate, fixability, and regression-prevention value, not raw finding count.

Implications for Blueprint:

- Add lane-level evidence records: scope reviewed, artifacts read, reasoning
  basis, confidence, and explicit "not reviewed" boundaries.
- Expand finding metadata beyond severity: defect class, lifecycle risk,
  evidence type, affected contract, safety gate, confidence, and fix target.
- Make false-positive control first-class: require reproduction, contract
  citation, or concrete failure path for blocking findings; allow lower-confidence
  observations as non-blocking notes.
- Add specialized safety gates for API compatibility, migration/deploy safety,
  observability/readiness, security verification, and rollback/idempotency.
- Build evaluation fixtures from real PR/review examples plus synthetic seeded
  defects; score missed high-signal issues, spurious findings, duplicate
  findings, and whether hidden fix mode actually resolves the reviewed evidence.

## Research Synthesis: Design Principles To Carry Forward

The research appendix points to a few decisions that should become design
constraints when god mode moves from checkpoint to implementation:

1. Freeze scope before intelligence. Every serious review system studied either
   starts from a PR/diff scope, repo instructions, and explicit filters, or
   suffers when it pretends partial context is complete. God mode should always
   record scope, fingerprint, omitted files, skipped paths, and evidence inputs
   before any lane starts.
2. Make the hidden skill small and the artifacts rich. The skill should route,
   load the right reference, and enforce boundaries. The session JSON and
   append-only report should carry the durable state, finding records, lane
   coverage, suppressions, and continuation data.
3. Prefer multiple skeptical passes over one heroic pass. Fresh-context lanes
   reduce anchoring, but they need a final dedupe/severity normalization step so
   the user sees a small set of high-signal findings rather than repeated
   commentary.
4. Treat false positives as a product failure. Blocking or fix-eligible findings
   should require concrete evidence: file/line, reachable behavior, contract
   mismatch, security flow, failing/missing test, migration/deploy risk, or a
   minimal counterexample. Thin concerns should be non-blocking observations or
   omitted.
5. Keep finding identity and lifecycle structured. Markdown can be the readable
   report, but the hidden parser needs stable `GOD-*` IDs, severity, confidence,
   disposition, category, evidence type, affected contract, suppression state,
   stale/rechecked status, and fix-target metadata.
6. Separate detection, publication, and remediation. God review can discover and
   rank findings; publication remains private by default; hidden fix mode should
   consume explicit selected findings and avoid commits, branches, PRs, and
   normal review-fix artifacts unless separately requested.
7. Evaluate traces, not just final prose. Regression tests should inspect
   whether the command used frozen scope, avoided public documentation surfaces,
   loaded bounded instructions, produced line-backed findings, avoided duplicate
   findings, selected conservative fix defaults, and preserved normal Blueprint
   state.

## Open Design Questions

- Should remediation evidence append to `XX-GOD-REVIEW.md`, write a separate
  god-review-fix report, or support both?
- Should PR and current-diff god-review reports live only under `.blueprint/reports/`,
  or should the user be able to bind them to a phase explicitly?
- Should `--refresh-scope` be allowed after partial completion, or should scope
  refresh require a new run ID?
- Should god-review findings have a fixed severity vocabulary identical to normal
  code-review, or a richer private vocabulary?
