# Blueprint Code Review Runtime Contract

This reference is the runtime-heavy contract for `/blu-code-review`.

Use it with `skills/blueprint-review/SKILL.md` and
`agents/blueprint-reviewer.md` so code review output is useful engineering
evidence, not merely valid markdown.

## Contract Authority

- `mcp_blueprint_blueprint_artifact_contract_read` is the heading and schema
  authority for `review.code-review`.
- The returned `contract.authoringTemplate` is the canonical shape for
  `XX-REVIEW.md` before drafting, repair, or persistence.
- This reference is the output-quality authority: it defines scope handling,
  review depth, finding anatomy, fallback behavior, and write repair.
- Do not add new public command names, `.planning/` runtime dependencies, shell
  persistence, hook-owned state, or direct writes to `XX-REVIEW.md`.

## Shared Runtime Contract

- Execution profile: `long-running-mutation`.
- Shared stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`,
  `Validate`, `Route`.
- In-flight status fields: resolved scope, active stage, pending gate,
  execution mode, next safe action.

Map `/blu-code-review` to those stages:

1. `Resolve`: locate the target phase, parse `--depth`, parse optional
   `--files`, and resolve the effective review posture through
   `blueprint_review_scope`.
2. `Read`: load the canonical `review.code-review` contract, saved execution
   summaries, matching plans when present, validation or UAT evidence when
   present, any existing review findings, and the scoped repo files.
3. `Decide`: decide whether the command is enabled, whether scope is valid,
   whether a broad/deep scope needs confirmation, whether an existing review is
   reused or overwritten, and whether to use `blueprint-reviewer`.
4. `Execute`: perform depth-appropriate review over only the resolved file set
   and saved evidence.
5. `Persist`: call `mcp_blueprint_blueprint_review_record` with the full final
   markdown body and `artifact: "code-review"`.
6. `Validate`: inspect the returned status, counts, follow-ups, warnings, and
   any invalid result before concluding.
7. `Route`: summarize findings or pass evidence and end with the next safe
   implemented command.

## Required MCP Calls

Call these tools in this order unless the command must stop early:

1. `mcp_blueprint_blueprint_phase_locate`
   - Controls target phase, phase directory, phase prefix, and missing-phase
     recovery.
   - Stop on unresolved phase and surface the tool reason.
2. `mcp_blueprint_blueprint_artifact_contract_read` for
   `review.code-review`
   - Controls the required headings, locked markers, and authoring template.
   - Treat the returned `authoringTemplate` as the shape to repair toward.
3. `mcp_blueprint_blueprint_review_scope`
   - Controls whether review is enabled, the exact repo files, scope source,
     effective review depth, saved evidence inventory, and scope warnings.
   - Explicit `files` must be repo-relative file paths only, and any invalid
     explicit entry must fail the whole explicit scope.
   - Do not add siblings, generated files, `.blueprint/**`, directories,
     wildcards, absolute paths, git drift, or chat-memory files after this call.
4. `mcp_blueprint_blueprint_review_load_findings` when an existing
   `XX-REVIEW.md` is present
   - Controls structured baseline findings, follow-ups, severity counts, and
     the saved review path before overwrite decisions.
   - Use read-only repo file access only if full-body comparison is needed.
5. `mcp_blueprint_blueprint_review_record`
   - Controls the final filename, create/update/reuse status, counts,
     follow-ups, warnings, and validation failures.
   - Never write `XX-REVIEW.md` directly.

## Artifact Authoring Rules

Use the canonical `review.code-review` authoring template as the section
authority and fill it with substantive, evidence-backed content.

The final artifact must include:

- `**Verdict:** PASS`, `FOLLOW_UP`, or `BLOCKED`.
- `Review Summary` with phase, depth, scope source, file count, and severity
  counts.
- `Scope Reviewed` with every reviewed repo-relative file, one per bullet or
  table row.
- `Evidence Reviewed` with saved summaries, plans, validation, UAT, existing
  review, or security artifacts that influenced the result.
- `Positive Signals` with concrete pass evidence or `none`.
- `Severity Summary` with critical, high, medium, low, and unknown counts.
- `Findings` with one entry per material issue. Each entry must include
  severity, disposition, file and line or line range, evidence, impact, and a
  concrete fix or verification suggestion.
- `Follow-Ups` with actionable follow-up fixes, test gaps, validation steps, or
  `none`.
- `Next Safe Action` using only implemented Blueprint commands.

Do not persist placeholder examples, generic "reviewed code" prose, or findings
without file evidence. If no issue is found, explain which files and saved
evidence were checked and why that supports `PASS`.

## Depth Semantics

Use the effective depth from `blueprint_review_scope.reviewMode.depth`.

- `quick`: scan for high-signal anti-patterns and security footguns. Include
  exact file and line evidence for every hit. Do not claim deep cross-file
  confidence.
- `standard`: read every scoped file in full, check behavior in context, apply
  language-aware correctness/security/test-coverage checks, and cite concrete
  file lines.
- `deep`: do the standard pass plus cross-file import/export, call-chain,
  boundary-type, error-propagation, and shared-state consistency checks across
  the scoped files. If the resolved scope is too broad for a credible deep
  pass, require scope confirmation or recommend narrowing.

## Capability-Gated Subagent Path

Use `blueprint-reviewer` only when a suitable code-analysis subagent is
available and the command scope benefits from bounded deep work:

- multiple plans or many files
- `--depth=deep`
- risky config, auth, persistence, security, or orchestration surfaces
- revising an existing `XX-REVIEW.md`

Pass the subagent only:

- the exact `blueprint_review_scope.files` list
- selected saved phase artifacts needed as evidence
- the effective depth
- the canonical authoring requirements from this contract

The subagent returns findings and an artifact draft. The parent command owns all
confirmation, user-facing progress, MCP writes, validation, and routing.

Browser, web-search-only, shell-only, or generic page-inspection helpers are not
acceptable substitutes for `blueprint-reviewer`.

## No-Subagent Fallback

If `blueprint-reviewer` is unavailable or unnecessary, continue sequentially in
the parent session.

1. Read saved evidence first: summaries, plans, validation or UAT artifacts,
   security artifact, and any existing review.
2. Group the scoped files by file type and risk surface.
3. Review one file group at a time at the selected depth.
4. After each group, compress carry-forward context to a short note with:
   checked files, confirmed findings, open uncertainties, and remaining risk.
5. Build the final artifact from the accumulated findings and pass evidence.
6. Run one final consistency pass: every finding has file evidence and every
   severity count matches the `Findings` section.

Do not replace the missing subagent with browser/web/search-only analysis.

## Retry And Repair

- If `blueprint_review_scope` returns `status: "invalid"`, stop and surface
  the exact `reason` and useful warnings. If implicit scope is missing saved
  execution evidence, route to `/blu-execute-phase <phase>` or ask for explicit
  `--files`.
- If a broad, multi-plan, or deep scope needs confirmation, pause before
  writing and keep the waiting state visible as `scope-confirmation`.
- If `XX-REVIEW.md` already exists and the new body differs, require explicit
  overwrite confirmation before passing `overwrite: true`.
- If `blueprint_review_record` returns `status: "invalid"`, repair the authored
  markdown against `contract.authoringTemplate` and the returned warnings, then
  retry once through `blueprint_review_record`.
- If the retry is still invalid, stop with the invalid reasons and do not
  hand-edit `.blueprint/`.
- If the record call throws because overwrite was not confirmed, surface the
  overwrite gate and wait instead of forcing persistence.

## Output Quality Criteria

The review is strong enough to persist only when:

- the resolved phase, depth, scope source, file count, and pending gate are
  visible before persistence
- every reviewed file appears in `Scope Reviewed`
- every saved artifact that influenced the review appears in `Evidence Reviewed`
- each material finding has severity, disposition, file:line evidence, impact,
  and fix or verification guidance
- test gaps are called out only when behavior changed and coverage evidence is
  missing or thin
- uncertainty is stated plainly instead of upgraded into false certainty
- severity counts match the findings
- next-step guidance names only implemented Blueprint commands

## Completion Criteria

Complete the command only after:

1. scope is ready or a precise invalid-scope recovery is reported
2. any required confirmation gate has cleared
3. review analysis has run at the effective depth
4. `XX-REVIEW.md` content satisfies the canonical contract and this reference
5. `blueprint_review_record` returns `created`, `updated`, or `reused`
6. the final response reports phase, depth, scope source, artifact status,
   severity/follow-up posture, warnings, and next safe implemented action
