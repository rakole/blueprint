# God Mode Code Review Checkpoint

Date: 2026-05-11

Status: design checkpoint only. No implementation has been done.

This is an internal planning artifact for a private "god mode" extension of
Blueprint's existing code-review and code-review-fix flows. It is not public
command documentation. Hidden flags, private MCP tools, session files, and
god-review findings must not appear in `/blu`, `/blu-help`, `/blu-progress`,
public command docs, or runtime catalog guidance.

## Implementation Decision Brief

Agreed direction:

- Add hidden god-mode branches to code review and code-review-fix, triggered only
  by `--feels-like-god`.
- Run one focused review group per invocation, append that pass to one durable
  god-review report, then stop with the next exact continuation command.
- Record hidden fix-mode remediation back into the same god-review report as an
  append-only remediation log. Do not create a separate god-review-fix artifact
  in the MVP.
- Resolve scope once on the first run and persist it in session JSON. Later runs
  reuse that saved scope; if the scope fingerprint changes, the run stops and
  the user starts a new run.
- Maintain a separate temporary human-readable god-mode state file. Do not write
  to normal Blueprint `STATE.md`, and do not use it as god-mode continuation or
  progress state.
- Delete the temporary human-readable state file and JSON tracker after all
  review groups are terminal and a hidden god-mode fix pass has also reached a
  terminal outcome. The durable god-review report remains.
- Support phase, PR, current-diff, and explicit-files scopes.
- Keep PR and current-diff runs report-scoped only; they do not bind to a phase
  in the MVP.
- Keep god mode private and non-interfering: no normal `XX-REVIEW.md`,
  `XX-REVIEW-FIX.md`, `STATE.md`, quality gates, public routing, commits,
  branches, PRs, or hook chaining by default.
- Add a hard activation guard: if the god-mode skill is triggered without an
  active `/blu-code-review` or `/blu-code-review-fix` invocation containing
  `--feels-like-god`, it must stop immediately with a short witty refusal and
  perform no MCP calls, repo reads, or writes.
- Add a private MCP substrate for deterministic path safety, scope reuse, report
  append behavior, finding parsing, and fix evidence recording.
- Normalize findings to Blueprint review vocabulary:
  - severity: `critical|high|medium|low|unknown`
  - disposition: `follow-up|observation|blocked|accepted-risk`
- Default hidden fix mode to actionable `follow-up` findings with `high` or
  `medium` severity. Explicit IDs, `--all`, or severity filters can widen the
  set. Fix mode still does not create commits, branches, PRs, or normal
  review-fix artifacts unless separately requested.

Implementation should first add private substrate and regression coverage, then
wire the hidden command branches. Do not change public review lifecycle behavior
while landing this mode.

## Agreed Design

God mode exists for deliberate heavy review: deeper, multi-pass analysis that
can outlive a single model context while staying outside Blueprint's normal
quality-gate lifecycle.

Private triggers:

- `/blu-code-review <phase> --feels-like-god`
- `/blu-code-review <phase> --feels-like-god --continue`
- `/blu-code-review --feels-like-god --pr <number>`
- `/blu-code-review --feels-like-god --current-diff`
- `/blu-code-review --feels-like-god --files <repo-relative paths...>`
- `/blu-code-review-fix --feels-like-god`
- `/blu-code-review-fix --feels-like-god --finding <GOD-ID>`
- `/blu-code-review-fix --feels-like-god --severity critical|high|medium|low|unknown`
- `/blu-code-review-fix --feels-like-god --all`

`--feels-like-god` is intentionally undocumented. Tests should prove it works
without letting the flag appear in public docs, root routing, help, progress,
next-step guidance, or command-catalog output.

Activation guard: the god-mode skill must inspect active invocation context
before any MCP call, repo read, or file write. It may continue only when the
active command is `/blu-code-review` or `/blu-code-review-fix` and the hidden
`--feels-like-god` flag is present. If triggered accidentally by model routing,
it should stop with a brief human-facing refusal such as:

> God mode only wakes during special `occassions`. 
> This is a mistaken skill invocation, reach out to blueprint admin for help.
> No `thunderbolt` today.

Normal `/blu-code-review` continues to use the existing `review.code-review`
model contract, `blueprint_review_scope`, `blueprint_review_validate_model`, and
`blueprint_review_record`. God mode may reuse deterministic scope resolution,
but it needs separate session, report, finding, and remediation handling.

## Constraints And Non-Interference

God mode must stay outside the ordinary review lifecycle.

- Do not write or update normal `XX-REVIEW.md`.
- Do not write or update normal `XX-REVIEW-FIX.md`.
- Do not route god-review findings through `blueprint_review_load_findings`.
- Do not update `STATE.md` next actions or quality-gate state.
- Do not make `/blu-progress`, `/blu-next`, `/blu-help`, or `/blu` recommend
  god mode.
- Do not auto-chain through hooks.
- Do not create commits, branches, PRs, staging changes, or hidden git
  automation.
- Do not change public command status semantics.
- Do not mutate installed extension directories or host-global Blueprint state.

The hidden mode can use private MCP tools, internal maintainer comments, and
tests. It should not become a public command surface.

## Artifact And Session Model

### Scope Sources

God mode supports four scope kinds:

- Phase scope: default deterministic phase scope, using the same source of truth
  as normal code review where possible.
- PR scope: resolve files and diff context from `gh` CLI read access for a PR.
- Current diff scope: resolve staged and working-tree changes.
- Explicit files: use repo-relative paths supplied by the user.

PR and current-diff runs do not bind to a phase in the MVP. They always use the
report-local session/report paths below, even if the user mentions a phase for
context. Phase-backed runs are only for the deterministic phase scope.

The first run records resolved files and fingerprints in session JSON. Later
continuations trust `files`, `scopeKind`, and `scopeFingerprint` from the
session. If a PR, diff, or working tree changes after the first run, the command
stops and asks the user to start a new run instead of silently reviewing a
different target. Continuation must not mutate the stored scope. A future
`--refresh-scope` can be considered only as convenience for creating a new
linked run with a new `runId` and `parentRunId`; it must not rewrite the
existing session or reinterpret completed review groups.

### Paths

For phase-backed runs:

- session: `.blueprint/phases/<phase-slug>/.god-review-session.json`
- report: `.blueprint/phases/<phase-slug>/<phase-prefix>-GOD-REVIEW.md`

For PR, current-diff, or explicit-files runs not bound to a phase:

- session: `.blueprint/reports/.god-review-<run-id>.json`
- report: `.blueprint/reports/god-review-<run-id>.md`

The session JSON is the continuation source of truth. The Markdown report is the
human-readable and parser-readable review record.

### Session Shape

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

### Review Group Taxonomy

Each invocation processes exactly one pending group and appends to the same
report.

1. Correctness and contracts: correctness, requirements alignment, edge cases,
   API contracts, backward compatibility.
2. Security, privacy, and authorization: security, authorization and access
   control, privacy and compliance, input validation.
3. Data, state, and consistency: data integrity, transactionality, consistency,
   domain modeling, state management, concurrency safety, async behavior,
   idempotency.
4. Failure handling and reliability: failure handling, reliability, error
   handling, resource management, external dependency handling.
5. Tests and verification: test coverage, test quality, static analysis, build
   and CI health.
6. Architecture and maintainability: maintainability, readability, simplicity,
   modularity, separation of concerns, cohesion, coupling, encapsulation,
   abstraction design, dead code, duplication, technical debt, code ownership
   boundaries.
7. Performance and scalability: performance, scalability, algorithmic
   complexity, database design, query efficiency, caching, cost efficiency.
8. Operations, portability, and product surface: configuration management,
   feature flags, observability, logging, metrics, tracing, operational
   readiness, deployment safety, migration safety, rollback safety, monitoring
   and alerting, dependency management, documentation, reusability,
   extensibility, portability, environment compatibility, framework idioms,
   language idioms, accessibility, localization, analytics and instrumentation,
   developer experience, reviewability, future change risk.

### Report Format

The report is append-only Markdown. Each group section must be stable enough for
hidden fix mode to parse without normal review artifacts.

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

Finding IDs must be stable and unique across the report. Actionable findings
should carry file/line evidence, impact, confidence or uncertainty notes, and a
remediation handoff. If a reliable line cannot be named, the finding must say
why and should normally use `severity: unknown` or `disposition: observation`.

## Private Contract Lock

This is the implementation contract for the hidden god-mode substrate. Later
implementation can rename internal helper functions, but behavior should not
drift without updating this section first.

### Activation Contract

God-mode execution is invalid unless all of these are true:

- active command is `/blu-code-review` or `/blu-code-review-fix`
- raw invocation includes `--feels-like-god`
- invocation is handled through the hidden branch of the matching command
- no MCP call, repo read, or file write has happened before this check passes

Invalid activation returns only the short refusal message and no side effects.
It must not inspect `.blueprint/`, call `blueprint_state_load`, read repo files,
or try to infer intent from `STATE.md.activeCommand`.

### Session JSON Contract

Session files are private Blueprint runtime state. They use `schemaVersion: 1`
and must remain JSON objects, not Markdown. The minimum session shape is:

```json
{
  "schemaVersion": 1,
  "runId": "god-2026-05-11-abc123",
  "parentRunId": null,
  "status": "in-progress",
  "createdAt": "2026-05-11T00:00:00.000Z",
  "updatedAt": "2026-05-11T00:00:00.000Z",
  "activeCommand": "/blu-code-review",
  "scopeKind": "phase",
  "phase": 5,
  "sessionPath": ".blueprint/phases/05-example/.god-review-session.json",
  "humanStatePath": ".blueprint/phases/05-example/.god-review-state.md",
  "reportPath": ".blueprint/phases/05-example/05-GOD-REVIEW.md",
  "files": ["src/example.ts", "tests/example.test.ts"],
  "skippedFiles": [],
  "scopeFingerprint": {
    "baseSha": "abc123",
    "headSha": "def456",
    "diffHash": "sha256:...",
    "fileSetHash": "sha256:...",
    "prNumber": null
  },
  "groups": [
    {
      "id": "correctness-contracts",
      "prefix": "COR",
      "status": "completed",
      "findingIds": ["GOD-COR-001"]
    },
    {
      "id": "security-privacy-auth",
      "prefix": "SEC",
      "status": "pending",
      "findingIds": []
    }
  ],
  "nextGroupId": "security-privacy-auth",
  "cleanup": {
    "reviewTerminal": false,
    "godFixTerminal": false,
    "eligible": false
  }
}
```

Locked invariants:

- `runId` is unique per report. A linked refresh creates a new `runId` and sets
  `parentRunId`; it does not rewrite the existing session scope.
- `phase` is present only when `scopeKind: "phase"`.
- PR and current-diff sessions always write under `.blueprint/reports/`.
- `humanStatePath` points to a temporary god-mode state file, not normal
  `.blueprint/STATE.md`.
- `files` are repo-relative file paths only. No directories, globs, absolute
  paths, or `.blueprint/**` entries.
- `skippedFiles` records files omitted because of size, unsupported type, scope
  filters, or safety policy.
- `groups[*].status` is `pending|in-progress|completed|blocked`.
- Completion means every group is `completed` or `blocked`; blocked groups must
  have a report section explaining the missing evidence or unsafe scope.
- `cleanup.eligible` becomes true only after review is terminal and a hidden
  god-mode fix pass has also reached a terminal result. A no-op fix pass with no
  eligible findings counts as terminal only when invoked through
  `/blu-code-review-fix --feels-like-god`.

### God-Mode State Contract

God mode owns a temporary human-readable state file beside the private session
JSON:

- phase scope: `.blueprint/phases/<phase-slug>/.god-review-state.md`
- PR, current-diff, and explicit-files scopes:
  `.blueprint/reports/<run-id>.god-review-state.md`

This state file is a user-facing progress aid for hidden god-mode runs. It is
not Blueprint workflow state.

State file invariants:

- private MCP tools may update `.god-review-state.md`, but they must not update
  normal `.blueprint/STATE.md`
- after valid activation, private MCP tools may read ordinary phase/review
  artifacts for scope evidence, but `STATE.md` is not the source of truth for
  god-mode progress or continuation
- normal progress, next-action, lifecycle, and quality-gate routing must ignore
  `.god-review-state.md`
- the file records only god-mode progress: run ID, scope summary, current/next
  group, review terminal status, hidden fix terminal status, stale-scope status,
  and the next exact hidden command
- the file must not become the source of truth for continuation; session JSON is
  the machine tracker until cleanup
- when `cleanup.eligible` is true, the private tool deletes both
  `.god-review-state.md` and `.god-review-session.json`
- cleanup must preserve the durable god-review report and its remediation log
- cleanup must not delete normal review, review-fix, phase, or Blueprint state
  artifacts

### Scope Fingerprint Contract

Continuation compares the stored fingerprint to current repo/PR/diff state.
On mismatch, review continuation stops and preserves the existing session/report
unchanged. Hidden fix mode also blocks source edits on mismatch; it may append a
no-edit `stale` remediation entry only through the remediation-log contract.

Fingerprint fields:

- `baseSha`: merge-base, PR base, or previous comparison SHA when available
- `headSha`: reviewed HEAD SHA
- `diffHash`: normalized diff hash for PR and current-diff scopes; `null` for
  pure phase/explicit-files runs when no diff scope exists
- `fileSetHash`: hash of sorted `files` plus `skippedFiles`
- `prNumber`: PR number for PR scope, otherwise `null`

The exact hash algorithm can be implementation-local, but it must be
deterministic, stable across process restarts, and insensitive to file ordering.

### Report Contract

Every god-review report starts with stable run metadata:

```md
# God Review: <runId>

Status: in-progress|completed|blocked|stale
Scope Kind: phase|pr|current-diff|explicit-files
Session: `.blueprint/.../.god-review-session.json`
Scope Fingerprint: `<short fingerprint summary>`
```

Each review group appends exactly one top-level group section:

```md
## GOD-02 Security, Privacy, And Authorization

Status: completed|blocked
Group ID: security-privacy-auth
Scope: frozen session scope
Files Reviewed:
- `src/example.ts`
Evidence Reviewed:
- `.blueprint/phases/05-example/05-01-SUMMARY.md`

### Findings

#### GOD-SEC-001: Missing authorization check before project mutation
- Severity: high
- Disposition: follow-up
- Confidence: high|medium|low
- Files: `src/example.ts:42`
- Evidence: ...
- Impact: ...
- Recommendation: ...
- Fix Eligibility: eligible|needs-confirmation|not-eligible

### Positive Signals

- ...

### Uncertainties

- ...
```

Report invariants:

- group section order follows the session `groups` order
- a continuation may append the next group but must not rewrite completed group
  sections except through an explicit future repair command
- every finding heading starts with one stable `GOD-*` ID
- findings use severity `critical|high|medium|low|unknown`
- findings use disposition `follow-up|observation|blocked|accepted-risk`
- actionable findings must include `Files`, `Evidence`, `Impact`, and
  `Recommendation`

### Finding ID Contract

Finding IDs are stable within one report:

- format: `GOD-<GROUP_PREFIX>-<NNN>`
- group prefixes:
  - `COR`: correctness and contracts
  - `SEC`: security, privacy, and authorization
  - `DAT`: data, state, and consistency
  - `REL`: failure handling and reliability
  - `TST`: tests and verification
  - `ARC`: architecture and maintainability
  - `PER`: performance and scalability
  - `OPS`: operations, portability, and product surface
- numbering starts at `001` per group prefix
- IDs are never renumbered after being written
- duplicate findings should be deduped before append; if two lanes find the same
  issue, keep the first ID and reference it from later notes

### Remediation Log Contract

MVP hidden fix mode writes remediation evidence into the same god-review report.
It does not create `XX-GOD-REVIEW-FIX.md`.

The report has at most one remediation log section:

```md
## Remediation Log

### GOD-FIX-001: GOD-SEC-001
- Status: fixed|skipped|deferred|stale|blocked
- Finding: GOD-SEC-001
- Selected By: default|explicit-id|severity-filter|all
- Files Changed: `src/example.ts`
- Verification: `npm test -- tests/example.test.ts` - passed
- Evidence: ...
- Follow-Up: none|...
```

Remediation entry invariants:

- remediation IDs use `GOD-FIX-<NNN>` and are never renumbered
- each entry targets exactly one `GOD-*` finding
- multiple remediation attempts for one finding append multiple log entries
- entries must not claim a normal `XX-REVIEW-FIX.md` write
- entries must not claim commits, branches, PRs, or staging unless the user
  explicitly requested those actions outside god mode

### Fix Selection Contract

Default hidden fix selection includes only findings that satisfy all of:

- `Disposition: follow-up`
- `Severity: high` or `Severity: medium`
- `Fix Eligibility: eligible`
- current scope fingerprint matches the session fingerprint
- referenced files still exist and the cited evidence is not stale

Widening rules:

- explicit `--finding <GOD-ID>` selects the named finding if it exists
- explicit `--severity <level>` selects matching actionable `follow-up` findings
- explicit `--all` selects all non-stale `follow-up` findings, including `low`
  and `unknown`
- `observation`, `accepted-risk`, and `blocked` findings are not selected unless
  explicitly named by ID, and even then may only produce `skipped`, `deferred`,
  or `blocked` remediation entries unless the user confirms code edits

### Stale Evidence Contract

Before editing, hidden fix mode revalidates:

- session fingerprint still matches current scope
- target finding ID exists in the report
- cited files still exist
- cited line or nearby evidence still matches closely enough to act

If any check fails, fix mode writes or proposes a no-edit `stale` remediation
entry and does not edit code unless the user explicitly confirms a fresh review
or a new linked run.

## Private MCP Substrate

Prefer private MCP tools over prompt-owned direct file writes, even though the
mode is hidden. The tools can be omitted from public docs while still giving the
hidden command branch deterministic path safety, append behavior, scope reuse,
and parsing.

### Private MCP Visibility Contract

MCP tools are generally discoverable by clients after registration. In the MVP,
`private MCP` is therefore not a true invisibility or security boundary.

Private means:

- undocumented in public command docs, user help, root routing, progress, next,
  and public catalog guidance
- not used by normal `/blu-code-review` or `/blu-code-review-fix` branches
- not routable from public command branches or public router recommendations
- not part of normal review lifecycle state, `STATE.md`, quality gates, or
  review-fix handoff
- intended only for hidden command branches that pass the activation contract
- covered by regression tests so hidden support exists without leaking into
  public surfaces

If Blueprint later needs true non-discoverability, that is a separate design:
add a hidden-tool registration or client-filtering layer before registering
these tools. Do not imply that undocumented MCP tools are invisible.

### Hidden Instruction Placement Contract

Do not add a new command-specific skill input, manifest reference, resource
input, or runtime-contract entry whose path/name exposes god mode. Public runtime
contract resources currently surface command `skillInputs`, so a new hidden
instruction file can become public even when help/catalog text stays clean.

MVP hidden instructions must either:

- live inside already-public command/skill inputs without adding public-facing
  path names that mention god mode, or
- be loaded through an implementation-local path that is explicitly filtered out
  of public runtime-contract resources before exposure.

Tests must assert public runtime-contract resources for `/blu-code-review` and
`/blu-code-review-fix` do not expose `--feels-like-god`, god-review file names,
private tool IDs, hidden instruction paths, or hidden branch names.

Candidate private tools:

- `blueprint_god_review_start`
- `blueprint_god_review_next`
- `blueprint_god_review_append`
- `blueprint_god_review_load_findings`
- `blueprint_god_review_record_fix`
- `blueprint_god_review_cleanup`

Tool behavior is locked to the private contracts above:

- `blueprint_god_review_start`: validates activation context, resolves/fingerprints
  scope, creates or reuses session/report metadata, and returns the next group.
- `blueprint_god_review_next`: loads a session, checks fingerprint freshness,
  and returns the next pending group without rediscovering scope.
- `blueprint_god_review_append`: appends one group section and advances group
  status. It rejects attempts to append two groups in one call.
- `blueprint_god_review_load_findings`: parses `GOD-*` findings and the
  remediation log from the god-review report only. It never falls back to normal
  `XX-REVIEW.md`.
- `blueprint_god_review_record_fix`: appends one remediation log entry for one
  finding, after stale-evidence checks and explicit selection rules.
- `blueprint_god_review_cleanup`: deletes only the temporary god-mode session
  JSON and human-readable state file after review and hidden fix both reach
  terminal states. It preserves the god-review report.

The TypeScript implementation should include maintainer comments explaining:

- the tools are private support for hidden `--feels-like-god` review/fix modes
- normal `review.code-review` and `review.review-fix` flows must not depend on
  them
- session JSON owns continuation scope
- `.god-review-state.md` is a human-readable progress aid, not Blueprint
  workflow state
- continuation must not silently rediscover scope
- god-review findings must not flow through `blueprint_review_load_findings`
- fix mode defaults exclude observations, `low`, and `unknown` findings unless
  explicit selection widens scope
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
 * MCP registration may make these tools discoverable to clients; privacy here
 * means undocumented and hidden-branch-only, not invisible.
 *
 * Do not wire these results into quality-gate routing, `STATE.md` next actions,
 * public command catalog output, or `blueprint_review_load_findings`. The
 * temporary `.god-review-state.md` file is a god-mode progress aid only.
 */
```

## Review And Fix Policy

### Review Policy

God-mode review should favor fewer, stronger findings over broad commentary.
Every actionable `follow-up` finding needs concrete evidence: file/line,
reachable behavior, contract mismatch, security flow, failing or missing test,
migration/deploy risk, runtime evidence, or a minimal counterexample.

Thin concerns should be `observation` or omitted. Stalled items use `blocked`.
Explicitly accepted risks use `accepted-risk`. External research and products
may use terms such as `FYI`, `DISMISS`, or `BLOCKING`; translate those into
Blueprint dispositions instead of introducing new vocabulary.

The fresh-context loop is:

1. First invocation creates or reuses the session.
2. The command processes one pending group.
3. The command appends the group section to the report.
4. The command updates the session status and `nextGroupId`.
5. The command ends with the next exact hidden continuation invocation.

Hooks should not drive continuation.

### Fix Mode Policy

Hidden god-mode fix reads `GOD-*` findings from the god-review report and
defaults to conservative selection:

- include actionable `follow-up` findings only
- include `high` and `medium` severity by default
- require explicit IDs, `--all`, or `--severity critical|high|medium|low|unknown`
  for broader remediation
- exclude `observation`, `accepted-risk`, `blocked`, `low`, and `unknown`
  findings unless explicitly selected
- stay bounded to the frozen session scope and implicated files
- avoid commits, branches, PRs, staging, and hidden automation unless separately
  requested
- append remediation evidence to the same god-review report's `Remediation Log`
- do not create a separate `XX-GOD-REVIEW-FIX.md` artifact in the MVP
- do not update normal review-fix artifacts

If current code no longer matches saved evidence, fix mode should mark the
finding stale or ask for explicit user confirmation before editing.

## Test Expectations

Tests should lock hidden support, deterministic artifacts, and non-interference.
Implementation-oriented coverage:

- hidden `--feels-like-god` branches exist for code-review and code-review-fix
- public docs, help, root router, progress, next, and command catalog do not
  mention the flag
- private MCP tools are treated as undocumented/internal, while tests do not
  assume MCP registration makes them truly invisible to clients
- normal `/blu-code-review` still uses `review.code-review` and `XX-REVIEW.md`
- god mode writes only god-review session, temporary state, and report paths
- god mode does not update `STATE.md`, next actions, quality-gate status, normal
  review artifacts, or normal review-fix artifacts
- normal progress/next/lifecycle routing ignores the temporary god-mode state file
- accidental god-mode skill activation without the hidden flag stops before MCP
  calls, repo reads, or writes
- phase, PR, current-diff, and explicit-files scope modes resolve and persist
  the expected session metadata
- PR and current-diff sessions use `.blueprint/reports/` paths and do not bind
  to phase directories
- initial run records resolved scope and fingerprint in session JSON
- continuation reuses stored scope and does not rediscover files
- changed diff or PR fingerprint blocks continuation and preserves the existing
  session; future refresh support creates a linked run instead of mutating scope
- one invocation appends exactly one review group
- report parser extracts `GOD-*` findings without requiring `XX-REVIEW.md`
- severity and disposition validation accepts only Blueprint vocabularies
- report parser extracts remediation log entries from the same god-review report
- cleanup deletes temporary god-mode state and session JSON only after review is
  terminal and hidden fix has also reached a terminal result
- cleanup preserves the durable god-review report and remediation log
- fix mode default selection includes only actionable high/medium `follow-up`
  findings
- explicit IDs, `--all`, and severity filters widen selection only when explicit
- fix mode handles stale evidence before editing
- fix mode does not create commits, branches, PRs, staging changes, or normal
  review-fix artifacts by default
- fix mode does not create `XX-GOD-REVIEW-FIX.md` in the MVP
- tracked built outputs and runtime tests remain fresh after implementation

## Codebase Mapping Notes

These notes map the checkpoint design to current Blueprint code. They are
read-only implementation reconnaissance, not an approved implementation plan.

### Mapping: Command And Skill Activation

- Entry points are the existing manifests, not a new command:
  `commands/blu-code-review.toml:3-55` and
  `commands/blu-code-review-fix.toml:3-56`. The hidden branch should be an
  early guarded mode inside those prompts.
- Reuse the per-command bundle pattern in
  `skills/blueprint-review/SKILL.md:15-35,69-75,132-260`: keep
  `input_bundles.shared` empty, attach any god-mode reference only to the
  `/blu-code-review` and `/blu-code-review-fix` command-specific bundles, and
  avoid sibling review-family commands.
- Watch public projection seams. `src/mcp/skill-metadata.ts:264-353` and
  `src/mcp/command-resources.ts:332-381` project skill bundles into runtime
  contract resources, so a private reference path can become visible unless it
  stays inside already-loaded files or is explicitly filtered.
- Runtime-owned command metadata for these commands lives in
  `src/mcp/command-runtime-metadata.ts:394-410,702-705,768-769,1751-1829`.
  Extra required tools or input paths would affect implemented/repairing status
  through `src/mcp/tools/project.ts:937-965`, so keep public metadata stable.
- Preserve public surfaces: keep `docs/COMMAND-CATALOG.md:15-16` unchanged, add
  no `god-review` row, and preserve implemented-only exposure through
  `blueprintCommandCatalog()` and `blueprint://commands/{command}/runtime-contract`.
- Existing tests already lock most of this contract:
  `tests/code-review-metadata.test.ts`, `tests/code-review-fix-metadata.test.ts`,
  `tests/skill-metadata.test.ts:305-333`,
  `tests/review-runtime-contract-resource.test.ts:57-83`,
  `tests/command-catalog.test.ts:1526-1669`, and
  `tests/extension-runtime-contracts.test.ts:241-270`.
- Activation guard risk: `STATE.md.activeCommand` is too stale for the hard
  guard. `/blu-code-review` does not update state in its manifest, while
  `/blu-code-review-fix` writes `activeCommand` only after remediation completes
  (`commands/blu-code-review-fix.toml:36-40`; downstream routing override in
  `src/mcp/tools/state.ts:2411-2480`). The guard likely needs host invocation
  context or a private helper checked before any MCP write.
- Recommended first slice: add the hidden guarded branch/refusal language in
  the two manifests plus `skills/blueprint-review/SKILL.md`, prove normal public
  inputs/catalog/resources stay stable, then add any private guard/tool metadata.

### Mapping: Private MCP Substrate And Artifact Helpers

- A private `src/mcp/tools/god-review.ts` module would sit beside `review.ts`
  and register through `src/mcp/tool-definitions.ts:1-22`. The runtime auto-loads
  `TOOL_DEFINITIONS` in `src/mcp/server-runtime.ts:10-35`.
- If a god-review tool writes files, add it to `BLUEPRINT_MUTATION_TOOL_NAMES` in
  `src/mcp/mutation-failure-logging.ts:8-37`. If it returns bulky session/report
  payloads, mirror trimming patterns in `src/mcp/response-sanitizer.ts:834-1046`.
- Reuse phase/review substrate first: phase resolution and artifact path helpers
  live in `src/mcp/tools/phase.ts:6109-6220` and
  `src/mcp/tools/phase-locations.ts:97-245`; deterministic review scope is in
  `src/mcp/tools/review.ts:8361-9045`; finding/follow-up parsing and counting
  patterns are around `src/mcp/tools/review.ts:3887` and `4569-4825`.
- Shared safety/write seams are centralized in
  `src/mcp/tools/artifacts.ts:2330-2463` (`ensureRepoRoot`,
  `resolveBlueprintPath`, `writeTextFile`), with review/report validators in
  `src/mcp/tools/artifacts.ts:5997-6238`.
- Established persistence shape is validate -> render -> reuse/overwrite ->
  write, as in `src/mcp/tools/review.ts:9593-9935` and
  `src/mcp/tools/artifacts.ts:13178-13440`.
- Pitfalls: review scope normalization rejects absolute paths, globs,
  directories, missing files, and `.blueprint/**` explicit inputs
  (`src/mcp/tools/review.ts:8361-8441`); write paths should reuse unchanged
  content and reject overwrite unless explicitly confirmed.
- Recommended first slice: keep v1 private and mostly substrate-focused. Build
  session/scope/finding loaders around existing scope and parser helpers before
  inventing a full persisted god-review report contract. If persistence follows,
  phase-scoped output should resemble `blueprint_review_record`; non-phase
  reports should copy the artifact-report authoring-context/validate/write split.
- Initial regression coverage should cluster near
  `tests/code-review-slice.test.ts:799-1031`,
  `tests/code-review-fix-slice.test.ts:12-260`,
  `tests/secure-phase-slice.test.ts:474-528`,
  `tests/audit-milestone-tools.test.ts:963-1103`, and
  `tests/built-assets-smoke.test.ts:282-313`.

### Mapping: Tests, Runtime Metadata, And Dist Outputs

- Extend existing review slices before adding broad new suites:
  `tests/code-review-slice.test.ts` already covers phase-scoped review scope,
  catalog/resource fallback, validation, persistence, and state follow-up;
  `tests/code-review-fix-slice.test.ts` covers saved-finding parsing,
  review-fix persistence, and routing.
- Hidden behavior cases should cover activation guard, session/report-only
  writes, frozen-scope continuation, fingerprint mismatch refusal, and proof
  that normal `XX-REVIEW.md`, `XX-REVIEW-FIX.md`, `STATE.md`, and quality-gate
  paths stay untouched.
- Public-surface invisibility should extend `tests/code-review-metadata.test.ts`,
  `tests/code-review-fix-metadata.test.ts`, `tests/help-metadata.test.ts`,
  `tests/next.test.ts`, `tests/command-catalog.test.ts`, and
  `tests/review-docs-safety-regression.test.ts`. Assert `--feels-like-god`,
  god-review report paths, and private tool ids do not appear in public docs,
  runtime-contract resources, help/next guidance, catalog output, or unrelated
  review skill bundles.
- Public runtime metadata source is `src/mcp/command-runtime-metadata.ts:1751-1828`;
  hidden support should leave declared public write surfaces and notes unchanged.
- MCP/runtime boundary checks should extend `tests/mcp-server-summary.test.ts`
  and possibly `tests/built-assets-smoke.test.ts`: if private tools are
  registered, assert response shaping is intentional while catalog/resources
  remain public-only. If private tools stay out of the public registry, add
  negative assertions at the registry/resource layer.
- Build/dist freshness is enforced by `package.json:10-15`,
  `tests/built-assets-smoke.test.ts:255-356`, and
  `tests/extension-runtime-contracts.test.ts:185-239`.
- Recommended verification order after implementation: focused `tsx --test` on
  review slice plus metadata/router suites; then
  `tsx --test tests/mcp-server-summary.test.ts tests/built-assets-smoke.test.ts tests/extension-runtime-contracts.test.ts`;
  then `npm run typecheck`; then full `npm test` so built outputs and bundled
  runtime stay in sync.

## Implementation Slices

These slices are ordered for sequential implementation. Each slice should keep
the normal review and review-fix lifecycle green before the next slice starts.

### S01: Public Surface Leak Guardrails

- Depends: none.
- Deliverables: add or extend regression assertions that public command docs,
  root routing, help, progress, next guidance, runtime catalog output, and
  public runtime-contract resources do not mention `--feels-like-god`,
  god-review report paths, god-review state paths, or private god-review tool
  IDs.
- Tests: focused metadata/router/doc safety tests for `/blu-code-review`,
  `/blu-code-review-fix`, `/blu`, `/blu-help`, `/blu-progress`, and
  `/blu-next`.
- Non-goals: do not add hidden branches, private tools, report writers, or
  public catalog metadata in this slice.

### S02: Hidden Activation Branch Skeleton

- Depends: S01.
- Deliverables: add the hidden branch entry points for `/blu-code-review` and
  `/blu-code-review-fix` only when the raw invocation includes
  `--feels-like-god`; add the hard refusal path for accidental god-mode skill
  activation before any MCP call, repo read, or file write.
- Tests: activation tests that prove valid invocations enter the hidden branch
  and invalid activation returns only the short refusal with no side effects.
  Assert public runtime-contract resources do not expose hidden instruction
  paths, hidden branch names, private tool IDs, or the hidden flag. Re-run S01
  leak tests.
- Non-goals: do not register private MCP tools, resolve scope, create session
  files, or change normal command metadata/status.

### S03: Private MCP Substrate Scaffolding

- Depends: S02.
- Deliverables: add an internal god-review tool module with schemas, typed result
  shapes, path helpers, parser/renderer helper shells, private maintainer
  comments, and mutation-failure logging integration points for future mutating
  tools. Keep the module unregistered until each tool has minimally
  contract-complete behavior.
- Tests: direct helper/schema tests plus registry assertions that no private
  god-review MCP tool is discoverable yet, and S01 public leak tests still pass.
- Non-goals: do not register callable MCP stubs, do not expose private tool IDs
  to clients, and do not imply private MCP tools are invisible once registered.

### S04: Scope Resolution And Session Start

- Depends: S03.
- Deliverables: implement `blueprint_god_review_start` for phase, PR,
  current-diff, and explicit-files scopes; resolve repo-relative files once;
  reject directories, globs, absolute paths, missing files, and `.blueprint/**`;
  register `blueprint_god_review_start` only when that behavior is present; write
  schema-versioned session JSON, initial report metadata, and temporary
  `.god-review-state.md` without touching normal `STATE.md`.
- Tests: one start test per scope kind, path safety tests, PR/current-diff
  report-scoped path tests, explicit-files rejection tests, and assertions that
  normal `XX-REVIEW.md`, `XX-REVIEW-FIX.md`, and `STATE.md` are unchanged.
  Exercise `/blu-progress`, `/blu-next`, and lifecycle/quality-gate evaluation
  against a repo containing `.god-review-state.md` and session JSON, and assert
  they ignore those files.
- Non-goals: do not append review groups, parse findings, run fix mode, or add a
  refresh-scope feature.

### S05: Frozen Continuation And Stale Scope Detection

- Depends: S04.
- Deliverables: implement `blueprint_god_review_next` to load the saved session,
  register `blueprint_god_review_next` only when that behavior is present, reuse
  stored `files` and `scopeFingerprint`, return the next pending group, and stop
  on fingerprint mismatch while preserving the existing session and report.
- Tests: continuation does not rediscover scope, changed PR/diff/file-set
  fingerprints block continuation, and stale review continuation preserves the
  existing session and durable report unchanged.
- Non-goals: do not mutate the frozen scope, do not create linked refresh runs,
  and do not use `STATE.md` as continuation state.

### S06: One-Group Report Append

- Depends: S05.
- Deliverables: implement `blueprint_god_review_append` to append exactly one
  group section in session order, register `blueprint_god_review_append` only
  when that behavior is present, validate group status, normalize severity and
  disposition vocabulary, assign stable `GOD-<PREFIX>-<NNN>` finding IDs, update
  `groups[*].status`, `findingIds`, `nextGroupId`, and the temporary human state
  file.
- Tests: one-call-one-group enforcement, group order enforcement, ID stability,
  validation failures for unsupported severities/dispositions, and no rewrite of
  completed group sections.
- Non-goals: do not record remediation entries, do not create normal review
  artifacts, and do not advance quality gates or next actions.

### S07: God-Review Finding And Remediation Parser

- Depends: S06.
- Deliverables: implement `blueprint_god_review_load_findings` to parse only the
  durable god-review report for `GOD-*` findings and the optional
  `Remediation Log`; register `blueprint_god_review_load_findings` only when that
  behavior is present; return structured severity, disposition, confidence,
  files, fix eligibility, stale/remediated status, and remediation attempts.
- Tests: parser extracts findings without `XX-REVIEW.md`, ignores normal review
  artifacts, rejects malformed duplicate IDs, parses multiple remediation
  attempts, and preserves accepted-risk/observation/blocked dispositions.
- Non-goals: do not select fixes, edit code, or bridge god-review findings into
  `blueprint_review_load_findings`.

### S08: Hidden Review Orchestration

- Depends: S06 and S07.
- Deliverables: wire the hidden `/blu-code-review --feels-like-god` branch to
  start or continue the private session, process exactly one pending review
  group, append the group section, update the temporary state, and end with the
  next exact hidden continuation command or terminal review status.
- Tests: fresh run creates session/report/state, continuation appends only the
  next group, terminal review is reported only after all groups are completed or
  blocked, and normal `/blu-code-review` still writes normal `XX-REVIEW.md`.
- Non-goals: do not run hidden fix mode, do not auto-chain via hooks, and do not
  create commits, branches, PRs, or staging changes.

### S09: Hidden Fix Selection And Evidence Checks

- Depends: S07.
- Deliverables: wire `/blu-code-review-fix --feels-like-god` selection logic so
  the default target set is only high/medium actionable `follow-up` findings
  with `Fix Eligibility: eligible`; implement explicit widening through
  `--finding`, `--severity`, and `--all`; revalidate scope fingerprint, target
  finding existence, referenced files, and nearby evidence before edits.
- Tests: default selection excludes low, unknown, observation, accepted-risk, and
  blocked findings; explicit selectors widen only as specified; stale evidence
  prevents edits and produces a no-edit stale outcome.
- Non-goals: do not create `XX-GOD-REVIEW-FIX.md`, normal `XX-REVIEW-FIX.md`,
  commits, branches, PRs, staging changes, or public routing behavior.

### S10: Remediation Log Recording

- Depends: S09.
- Deliverables: implement `blueprint_god_review_record_fix` to append exactly one
  `GOD-FIX-<NNN>` remediation entry per finding attempt into the same durable
  god-review report; register `blueprint_god_review_record_fix` only when that
  behavior is present; include selected-by reason, status, changed files,
  verification, evidence, and follow-up.
- Tests: repeated remediation attempts append new IDs without renumbering,
  entries target exactly one finding, stale/skipped/deferred/blocked entries are
  represented without claiming code edits, and the report remains the only MVP
  remediation artifact.
- Non-goals: do not write normal review-fix artifacts, do not mark quality gates
  fixed, and do not claim git operations unless separately requested outside
  god mode.

### S11: Cleanup Gate

- Depends: S08 and S10.
- Deliverables: implement `blueprint_god_review_cleanup` so it deletes only the
  temporary session JSON and `.god-review-state.md` after both review terminal
  status and hidden fix terminal status are true; register
  `blueprint_god_review_cleanup` only when that behavior is present; preserve the
  durable god-review report and remediation log.
- Tests: cleanup is blocked before terminal review, blocked before terminal
  hidden fix, succeeds after a no-op terminal hidden fix with no eligible
  findings, preserves reports, and never deletes normal review, review-fix,
  phase, or Blueprint state artifacts.
- Non-goals: do not archive reports, do not update normal `STATE.md`, and do not
  introduce lifecycle routing for god mode.

### S12: Built Runtime And End-To-End Regression Pass

- Depends: S01 through S11.
- Deliverables: rebuild tracked runtime outputs, refresh only expected dist
  files, and run the focused review/god-mode suites before the broader
  typecheck/full-test pass.
- Tests: focused `tsx --test` suites for review, review-fix, metadata, router,
  MCP response shaping, built-assets smoke, and extension runtime contracts;
  then `npm run typecheck`; then full `npm test` where feasible.
- Non-goals: do not broaden public documentation, change command status
  semantics, or use god mode as a normal review quality gate.

## Goal Execution Plan

This section turns the slice plan into a Codex `/goal` run. It follows the
OpenAI Codex guidance to use a goal only when the work has one durable objective,
an explicit stopping condition, known inputs, validation artifacts, checkpoints,
and compact progress reports:
https://developers.openai.com/codex/use-cases/follow-goals

### Recommended Goal Prompt

Use this exact prompt when starting the implementation run:

```text
/goal Implement the hidden Blueprint god-mode code-review and code-review-fix MVP described in docs/reviews/god-mode-code-review-checkpoint-2026-05-11.md, completing S01 through S12 one slice at a time without stopping until every slice is merged to origin/main, local main is fast-forwarded, temporary worktrees/branches are cleaned up, tracked dist outputs are fresh, required focused verification has passed for each slice, final typecheck/full-test verification has passed or has a concrete environment-blocker note, and the checkpoint doc's locked private contract remains satisfied. Treat /Users/rhishi/dev/repositories/blueprint as the authoritative checkout; use any planning worktree only as read-only context, and create every implementation worktree from the authoritative main checkout. Read the checkpoint doc, AGENTS.md, docs/DECISIONS.md, docs/ARCHITECTURE.md, docs/ARTIFACT-SCHEMA.md, docs/GEMINI-CONSTRAINTS.md, docs/MCP-TOOLS.md, docs/COMMAND-CATALOG.md, docs/PHASE-LIFECYCLE.md, docs/SKILLS-AND-AGENTS.md, docs/commands/code-review.md, docs/commands/code-review-fix.md, commands/blu-code-review.toml, commands/blu-code-review-fix.toml, skills/blueprint-review/SKILL.md, src/mcp/tools/review.ts, src/mcp/tools/project.ts, src/mcp/tools/state.ts, src/mcp/server.ts, src/mcp/command-resources.ts, src/mcp/command-runtime-metadata.ts, src/mcp/skill-metadata.ts, and the named review/metadata/router/runtime-contract/MCP/built-assets tests before editing. Work in checkpoints, one implementation slice per PR unless a smaller rollback-safe split is needed. For each slice, create a fresh worktree, run npm ci before build/typecheck/test commands, make only the slice's scoped changes, run the slice's focused tests plus leak/non-interference tests, rebuild dist whenever runtime source changes, push a branch, open and merge a PR with gh, fast-forward /Users/rhishi/dev/repositories/blueprint main, delete the temporary branch/worktree, then continue to the next slice. Keep public docs/help/catalog/progress/next/runtime-contract resources free of --feels-like-god and hidden paths/tool IDs, keep normal STATE.md/XX-REVIEW.md/XX-REVIEW-FIX.md/quality-gate behavior untouched, and pause only for a real blocker or a contract ambiguity that cannot be resolved from the checkpoint.
```

### Goal Inputs

Read these before the first edit:

- this checkpoint doc, especially `Private Contract Lock`, `Private MCP
  Substrate`, `Goal Execution Plan`, and `Implementation Slices`
- repo instructions in `AGENTS.md`
- architecture and command contracts in `docs/DECISIONS.md`,
  `docs/ARCHITECTURE.md`, `docs/ARTIFACT-SCHEMA.md`,
  `docs/GEMINI-CONSTRAINTS.md`, `docs/MCP-TOOLS.md`,
  `docs/COMMAND-CATALOG.md`, `docs/PHASE-LIFECYCLE.md`, and
  `docs/SKILLS-AND-AGENTS.md`
- command specs and manifests for `/blu-code-review` and
  `/blu-code-review-fix`
- current review substrate in `src/mcp/tools/review.ts`,
  `src/mcp/tools/project.ts`, `src/mcp/tools/state.ts`, `src/mcp/server.ts`,
  `src/mcp/command-resources.ts`, `src/mcp/command-runtime-metadata.ts`, and
  `src/mcp/skill-metadata.ts`
- exact leak, metadata, and runtime tests already named in the mapping notes:
  `tests/code-review-metadata.test.ts`,
  `tests/code-review-fix-metadata.test.ts`, `tests/help-metadata.test.ts`,
  `tests/next.test.ts`, `tests/command-catalog.test.ts`,
  `tests/review-docs-safety-regression.test.ts`,
  `tests/skill-metadata.test.ts`,
  `tests/review-runtime-contract-resource.test.ts`,
  `tests/mcp-server-summary.test.ts`, `tests/built-assets-smoke.test.ts`, and
  `tests/extension-runtime-contracts.test.ts`

### Goal Loop

The goal should run one implementation slice at a time.

Per-slice loop:

1. Start from clean, fast-forwarded `main` in
   `/Users/rhishi/dev/repositories/blueprint`.
2. Create a fresh `codex/` worktree branch for the slice.
3. Run `npm ci` in that worktree before any build, typecheck, or test command.
4. Implement only the current slice's deliverables and tests.
5. Run the focused tests named by the slice plus public leak and
   non-interference tests affected by the slice.
6. Rebuild tracked `dist/` outputs whenever runtime source changes.
7. Run `npm run typecheck` when TypeScript/runtime source changes.
8. Run broader `npm test` at S12, and earlier whenever shared behavior changes
   enough to justify it.
9. Commit, push, open a PR, merge with `gh`, fast-forward the original main
   checkout, remove the slice worktree, and delete the branch.
10. Record a compact checkpoint summary, then continue to the next slice.

### Checkpoint Progress Format

Each goal checkpoint report should be short and concrete:

```text
Checkpoint: S0X <slice name>
Status: completed|in-progress|blocked
Merged PR: <url or none yet>
Verification: <focused commands and results>
Public leak status: clean|blocked
Normal lifecycle status: untouched|blocked
Next slice: S0Y <slice name>
Blockers: none|<specific decision needed>
```

### Stopping Condition

The goal is complete only when all of these are true:

- S01 through S12 are implemented and merged to `origin/main`
- local `/Users/rhishi/dev/repositories/blueprint` main is fast-forwarded to the
  final merge commit
- temporary goal worktrees and branches are cleaned up
- tracked `dist/` outputs match runtime source
- focused review/god-mode/metadata/router/runtime-contract/MCP/built-assets
  tests have passed for the slices that touched them
- `npm run typecheck` passes after runtime source changes
- final `npm test` has passed, or any skipped portion is explicitly justified
  with a concrete environment blocker
- public surfaces still do not expose `--feels-like-god`, god-review paths,
  hidden instruction paths, or private god-review tool IDs
- normal `STATE.md`, quality gates, `XX-REVIEW.md`, `XX-REVIEW-FIX.md`,
  progress/next routing, and normal review-fix handoff remain unchanged by god
  mode
- god-mode temporary state/session cleanup preserves the durable god-review
  report and remediation log

### Pause Or Block Conditions

Pause the goal instead of guessing when:

- the locked private contract conflicts with current runtime architecture
- a hidden instruction path would leak through public runtime-contract resources
  without a clear filtering strategy
- private MCP registration would expose callable but contract-incomplete tools
- a test failure suggests normal review/review-fix lifecycle behavior regressed
- a migration or destructive git action is needed beyond the repo instructions
- GitHub, npm, or environment failures prevent reliable verification after a
  retry and there is no safe local substitute

Do not pause for ordinary implementation uncertainty, local refactoring choices,
or failing tests that can be diagnosed and fixed inside the current slice.

### Goal Non-Goals

- Do not change public command names, command status semantics, or root routing.
- Do not document `--feels-like-god` in public docs, help, progress, next,
  catalog, or public runtime-contract resources.
- Do not turn god mode into a normal lifecycle gate.
- Do not use hooks for continuation.
- Do not create `XX-GOD-REVIEW-FIX.md` in the MVP.
- Do not update normal review or review-fix artifacts from god mode.
- Do not leave private MCP tools registered before their slice has minimally
  contract-complete behavior.

## Research-Backed Principles

These are the implementation principles carried forward from the research
appendix:

1. Scope before intelligence. Record review target, fingerprint, included files,
   skipped paths, omissions, and evidence inputs before any review group starts.
2. Keep instructions small and artifacts rich. The hidden skill should route and
   enforce boundaries; session JSON and reports should own durable state,
   findings, suppressions, and continuation metadata.
3. Use multiple skeptical passes. Fresh-context review groups reduce anchoring;
   a final parser or aggregation step should dedupe and normalize severity.
4. Treat false positives as a product failure. Fix-eligible findings need
   concrete evidence; weak concerns should be non-blocking observations or be
   dropped.
5. Structure finding identity and lifecycle. Markdown is readable output, but
   hidden tools need stable IDs, severity, disposition, confidence, category,
   evidence type, affected contract, suppression state, stale/rechecked status,
   and fix-target metadata.
6. Separate detection, publication, and remediation. God review discovers and
   ranks findings; publication stays private by default; fix mode consumes
   selected findings without normal review-fix side effects.
7. Evaluate traces, not just prose. Tests should inspect scope reuse, public
   surface avoidance, bounded instruction loading, evidence quality, duplicate
   handling, conservative fix defaults, and normal Blueprint state preservation.

## Research Appendix

This appendix preserves the external research used to inform the design. The
notes are compressed to keep the checkpoint usable as an implementation brief.

### Skill Design And Prompt Packaging

Portable skill systems argue for small active instructions and richer referenced
artifacts. The [Agent Skills overview](https://agentskills.io/) and
[specification](https://agentskills.io/specification) frame a skill as
`SKILL.md` plus optional `scripts/`, `references/`, and `assets/`, loaded through
progressive disclosure. Claude Code's
[skills docs](https://code.claude.com/docs/en/skills) make the same operational
point: unlike always-on project context, skill bodies load only when used.

Design notes:

- The activation description is part of the prompt budget. Agent Skills requires
  concise trigger guidance, and Claude Code truncates listing text, so trigger
  words and boundaries need to appear early.
- Keep `SKILL.md` concise and navigational; move long taxonomies, examples, and
  rationale into referenced files. See Agent Skills
  [best practices](https://agentskills.io/skill-creation/best-practices).
- Command inputs should be explicit and structured. Claude Code supports
  `$ARGUMENTS`, named arguments, dynamic context injection, and forked skill
  execution; Google's
  [Gemini prompt strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies)
  emphasize separators, early critical instructions, and specific questions
  after large context blocks.
- Tool access must be designed and tested. Anthropic's
  [building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
  guidance treats tool definitions as the agent-computer interface; allowed tool
  lists are not a substitute for permission boundaries.
- Specialized subagents are useful for context control. Claude Code's
  [subagent docs](https://code.claude.com/docs/en/sub-agents) and OpenAI's
  [Agents SDK docs](https://openai.github.io/openai-agents-js/guides/agents/)
  both support specialist instructions, tools, runtime state, handoffs, and
  structured outputs.
- Evals should test the skill path. Agent Skills'
  [evaluation guide](https://agentskills.io/skill-creation/evaluating-skills),
  OpenAI [agent evals](https://developers.openai.com/api/docs/guides/agent-evals),
  and OpenAI
  [evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)
  recommend realistic prompts, clean contexts, trace inspection, tool argument
  checks, and regression analysis.
- Durable state should be explicit. The
  [12-factor agents](https://github.com/humanlayer/12-factor-agents) guidance to
  own prompts, own context, and unify execution state with business state maps
  directly to Blueprint's session/report model.

Blueprint implication: keep the hidden skill small, pass resolved scope and
session identity explicitly, run broad review lanes in bounded read-only
contexts, and evaluate traces for scope discipline and unnecessary context
loading.

### Code Review Agent Patterns

General review guidance supports a bounded, evidence-first loop. Google's
reviewer guide asks reviewers to inspect design, behavior, complexity, tests,
naming, comments, style, docs, and every assigned line, while looking beyond the
diff when whole-file or system context is needed
([what to look for](https://google.github.io/eng-practices/review/reviewer/looking-for.html)).
Its [navigation guidance](https://google.github.io/eng-practices/review/reviewer/navigate.html)
recommends a broad pass, then main logical files, then the rest in sequence;
tests may be read first to reconstruct intended behavior.

LLM-specific research reinforces scoped context. A 2025 field study found code
review pain around context switching and insufficient context, and evaluated
semantic retrieval for relevant review context
([Adalsteinsson et al., 2025](https://arxiv.org/abs/2505.16339)). This supports
narrow file sets plus selected contracts, tests, docs, and prior artifacts, not
whole-repo prompt stuffing.

Product patterns:

- GitHub Copilot code review behaves as comments rather than approvals or
  merge-blocking decisions, can provide suggested changes, accepts feedback on
  individual comments, and requires explicit re-review after new pushes
  ([GitHub Docs](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/use-code-review)).
- Qodo's finding anatomy groups findings by category and priority and includes
  quality-impact labels, code references, evidence, fix-assistance prompts,
  resolved/dismissed state, and audit history
  ([Qodo finding anatomy](https://docs.qodo.ai/code-review/get-started/use-qodo-in-prs/comment-anatomy)).

False-positive control is a design requirement. Google's
[comment guidance](https://google.github.io/eng-practices/review/reviewer/comments.html)
separates required changes from nits, optional suggestions, and informational
notes. LLM-review papers show that models can overcorrect valid code when
judging requirements
([Are LLMs Reliable Code Reviewers?](https://arxiv.org/abs/2603.00539)) and can
be biased by PR framing in security review
([Contextual Bias in LLM-Assisted Security Code Review](https://arxiv.org/abs/2603.18740)).

Security and test review need distinct passes. OWASP says secure review
complements automated tools by examining application logic, data flow, and
context-specific flaws
([OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)).
Repair research similarly favors runtime/test evidence over surface symptoms
([NIST APR overview](https://csrc.nist.gov/pubs/journal/2025/06/can-ai-fix-buggy-code/final),
[DebugRepair](https://arxiv.org/abs/2604.19305)).

Blueprint implication: use multiple rubric passes, require evidence for
actionable findings, preserve selected context in session metadata, and carry
verification hints into fix mode.

### Production Open Source Review Tools

Open source review tools converge on structured scope, parseable findings, and
clear publication policy:

- [PR-Agent / Qodo Merge](https://github.com/The-PR-Agent/pr-agent) treats a PR
  as the review unit and exposes review/improve/ask flows through multiple
  hosts. Its
  [compression strategy](https://qodo-merge-docs.qodo.ai/core-abilities/compression_strategy/)
  excludes low-value files, expands patch context when possible, includes
  metadata when patches no longer fit, and stops rather than pretending an
  oversized diff was reviewed.
- Qodo configuration separates output placement, inline severity thresholds,
  finding overflow, push-trigger reruns, CI feedback, ignore rules, and custom
  instructions. The lesson is that publication policy is separate from detection.
- [reviewdog](https://github.com/reviewdog/reviewdog) models parseable
  diagnostics with ranged locations, severity, rule code/URL, suggestions,
  explicit filter modes, and reporter-specific limits.
- [Danger JS](https://danger.systems/js/reference) shows repo-owned review rules:
  a typed `Dangerfile` reads PR metadata and git file lists, then emits message,
  warning, failure, or markdown outputs with optional file/line anchoring.
- [Semgrep CI](https://semgrep.dev/docs/semgrep-ci/findings-ci) keys findings by
  rule ID, file path, syntactic context, and duplicate index, and models states
  such as open, reviewing, fixing, ignored, fixed, and removed. Its
  [PR comment docs](https://semgrep.dev/docs/semgrep-appsec-platform/github-pr-comments)
  separate comment mode from block mode and recommend high-severity,
  high-confidence developer-visible comments.
- [SonarQube quality gates](https://docs.sonarsource.com/sonarqube-server/quality-standards-administration/managing-quality-gates/introduction-to-quality-gates)
  reinforce "new code" policy for PRs; its
  [issue lifecycle](https://docs.sonarsource.com/sonarqube-server/10.5/user-guide/issues)
  distinguishes open, accepted, fixed, and false-positive states with primary
  and secondary locations.
- [Aider repo maps](https://aider.chat/docs/repomap.html) and its
  [lint/test loop](https://aider.chat/docs/usage/lint-test.html) show a useful
  fix-loop split: mark editable versus read-only files, run commands after
  edits, and feed failures back. Its
  [YAML config](https://aider.chat/docs/config/aider_conf.html) reinforces
  explicit scope and command configuration.

Blueprint implication: store resolved scope and fingerprints, use stable finding
IDs, model findings structurally before markdown rendering, keep publication
private by default, and require explicit suppressions or accepted risks with
reasons and provenance.

### Frontier And Closed Source Review Products

Commercial review products review PRs or local diffs in context, post a small
number of prioritized findings, and keep fixes human-mediated:

- [GitHub Copilot code review](https://docs.github.com/en/copilot/concepts/agents/code-review)
  reviews PRs and IDE changes, excludes low-value file types, can use full
  project context, and may hand suggestions to a cloud agent to create a
  separate fix PR. GitHub says humans must validate feedback.
- Copilot
  [custom instructions](https://docs.github.com/en/copilot/concepts/prompting/response-customization)
  are repository-wide or path-specific, read from the base branch for PR review,
  and bounded to the first 4,000 characters of each instruction file.
- [Claude Code Review](https://code.claude.com/docs/en/code-review) is the
  closest god-mode analogue: specialized agents inspect diff plus surrounding
  code, verify candidate issues, dedupe, rank severity, and post inline findings
  plus summary. It does not approve or block PRs. Repo `REVIEW.md` can tune
  severity, nit caps, skipped paths, evidence requirements, and re-review
  behavior.
- [Cursor Bugbot](https://docs.cursor.com/bugbot) reviews PR diffs on updates or
  explicit comments, posts explanations and fix suggestions, and scopes rules
  through root and nearer `.cursor/BUGBOT.md` files.
- [CodeRabbit](https://docs.coderabbit.ai/guides/code-review-overview) combines
  AI review with static analysis, classifies feedback, assigns severity,
  updates incrementally, and supports one-click fixes. Its
  [auto-review controls](https://docs.coderabbit.ai/configuration/auto-review)
  and
  [path instructions and filters](https://docs.coderabbit.ai/configuration/path-instructions)
  separate trigger policy, file selection, and review instructions.
- CodeRabbit
  [guideline ingestion](https://docs.coderabbit.ai/knowledge-base/code-guidelines)
  detects files such as `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, Cursor rules, and
  Copilot instructions, scoped to directory subtrees. Its
  [agent integration](https://docs.coderabbit.ai/cli/cursor-integration) emits
  structured findings with locations, severity, and suggested approaches.
- [Qodo Code Review](https://docs.qodo.ai/code-review) emphasizes multi-agent,
  context-aware review, low noise, history, standards, and rule enforcement. Its
  [PR review output](https://docs.qodo.ai/code-review/get-started/use-qodo-in-prs/code-review)
  and
  [configuration model](https://docs.qodo.ai/code-review/get-started/configuration-overview)
  cover actionability, explanation, line references, prioritized grouping,
  feedback location, inline thresholds, surfaced finding counts, and persistent
  comments.
- Qodo's older
  [`/improve` docs](https://docs.qodo.ai/v1/tools/tools-list/improve) remain
  useful for fix ergonomics: suggestions include summary, explanation, and
  before/after diff; auto-approval is disabled by default.
- [Tabnine Git integrations](https://docs.tabnine.com/main/getting-started/tabnine-cli/git-integrations)
  show a prompt-driven CI variant with repository, shell, platform API,
  organization context, and coaching guideline access.
- [Windsurf Quick Review](https://docs.windsurf.com/windsurf/quick-review) keeps
  review local and pre-commit: after an agent changes code, a separate review
  agent analyzes the diff in-editor.
- [Amazon CodeGuru Reviewer](https://docs.aws.amazon.com/codeguru/latest/reviewer-ug/how-codeguru-reviewer-works.html)
  is precedent rather than a current target; it distinguished incremental PR
  review from full repository analysis and used
  [`aws-codeguru-reviewer.yml`](https://docs.aws.amazon.com/codeguru/latest/reviewer-ug/recommendation-suppression.html)
  for path suppression.
- [Codex Security](https://openai.com/index/codex-security-now-in-research-preview/)
  points at a high-stakes pattern: threat modeling, realistic attack-path
  inspection, isolated validation before surfacing findings, minimal patches,
  and human-controlled PR flow.

Blueprint implication: be diff-first but not diff-only, scope repo-local
instructions, make noise controls explicit, preserve auditability, and keep
review/fix controls separated.

### Adjacent Review Science And Extra Inputs

Additional review domains sharpen the evidence model:

- OWASP's
  [Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  and [Code Review Guide](https://owasp.org/www-project-code-review-guide/)
  frame secure review as manual validation, coverage-gap analysis, and
  vulnerability identification.
- OWASP
  [ASVS](https://devguide.owasp.org/en/11-security-gap-analysis/01-guides/02-asvs/)
  organizes verification across architecture, authentication, session
  management, access control, validation, cryptography, logging, data
  protection, communications, malicious code, business logic, files/resources,
  APIs, and configuration.
- Google's
  [Production Readiness Review](https://sre.google/sre-book/evolving-sre-engagement-model/)
  and
  [Launch Coordination Checklist](https://sre.google/sre-book/launch-checklist/)
  turn operations risk into evidence about dependencies, instrumentation,
  capacity, failover, retries, backups, disaster recovery, alerting, security,
  and rollback.
- Microsoft's
  [.NET compatibility rules](https://learn.microsoft.com/en-us/dotnet/core/compatibility/library-change-rules)
  and Azure
  [API design guidance](https://learn.microsoft.com/ga-ie/azure/architecture/microservices/design/api-design)
  support explicit compatibility verdicts for public surfaces, response shapes,
  exception behavior, ordering, idempotency, and versioning.
- GitLab's
  [migration style guide](https://docs.gitlab.com/development/migration_style_guide/)
  and
  [database review guidelines](https://docs.gitlab.com/development/database_review/)
  highlight transaction boundaries, concurrent index operations, lock retries,
  post-deployment migrations, idempotent retryable changes, reversibility,
  timing, and placement.
- Human review research by
  [Bacchelli and Bird](https://www.microsoft.com/en-us/research/?p=164195)
  found that defect finding requires deep change understanding and that many
  comments are improvement-oriented. Google's reviewer guide and
  [small CL guidance](https://google.github.io/eng-practices/review/developer/small-cls.html)
  both support splitting oversized scopes or labeling partial review.
- The taxonomy in
  [Concerns Identified In Code Review](https://kblincoe.github.io/publications/2022_IST_CodeReview.pdf)
  separates functional concerns from evolvability concerns.
- Review-agent evaluation should measure false positives and missed findings.
  [SWE-PRBench](https://huggingface.co/datasets/foundry-ai/swe-prbench) and
  [CR-Bench](https://arxiv.org/abs/2603.11078) both highlight the tradeoff
  between issue resolution and spurious findings as context grows.

Blueprint implication: include lane-level evidence records, expand metadata
beyond severity, add safety gates for compatibility/migration/operations/security
risk, and evaluate missed high-signal issues, unsupported claims, duplicate
findings, and fix-mode outcomes.

## MVP Contract Status

The private contract is locked for MVP implementation. New implementation
discoveries should be recorded as contract amendments before changing behavior.
