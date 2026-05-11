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

## Open Design Questions

- Should remediation evidence append to `XX-GOD-REVIEW.md`, write a separate
  god-review-fix report, or support both?
- Should PR and current-diff god-review reports live only under `.blueprint/reports/`,
  or should the user be able to bind them to a phase explicitly?
- Should `--refresh-scope` be allowed after partial completion, or should scope
  refresh require a new run ID?
- Should god-review findings have a fixed severity vocabulary identical to normal
  code-review, or a richer private vocabulary?
