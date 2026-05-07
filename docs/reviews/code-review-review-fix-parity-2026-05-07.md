# Code Review / Review Fix Contract Parity Review

Date: 2026-05-07

Scope: `/blu-code-review`, `/blu-code-review-fix`, their generated `XX-REVIEW.md` / `XX-REVIEW-FIX.md` artifacts, the shared review MCP substrate, schemas, command manifests, runtime references, and regression coverage.

Method: orchestrated read-only review with six bounded subagent passes plus local synthesis. No source fixes were applied.

## Executive Summary

The main risk is not that `code-review` cannot write a valid review. The main risk is that it writes richer structured facts than `code-review-fix` can later recover from the persisted Markdown. `code-review` validates a JSON model with severity, disposition, location, evidence, impact, and recommendation, but `blueprint_review_load_findings` returns only `id`, `severity`, `summary`, and `sourceSection`. `code-review-fix` then builds selected remediation targets from that reduced shape.

That gap can make remediation over-broad, under-informed, or brittle:

- `observation` and `accepted-risk` findings can become fix targets.
- file/line locations are no longer structured for bounded source rereads.
- follow-up bullets can become `FU-*` fix targets even when they are validation-only or routing guidance.
- target ids are derived from parser order and deduping rather than durable saved target identity.

The second major risk is avoidable MCP write failure. Several validators are high-value and should stay, but some are stricter than the renderer or command semantics require. The sharpest examples are broad placeholder-word scanning, duplicate/overlapping line hard failures, review-fix truth-table constraints that force filler rows, and schema rejection of table pipes even though the renderer already escapes them.

## Priority Findings

### P1: Review-Fix Delegates To An Agent Without A Review-Fix Contract

Evidence:
- `commands/blu-code-review-fix.toml:5` instructs use of `blueprint-reviewer` for saved-finding reclassification.
- `skills/blueprint-review/references/code-review-fix-runtime-contract.md:122` also allows `blueprint-reviewer` as a read-only helper.
- `tests/code-review-fix-metadata.test.ts:215` asserts the reviewer agent remains code-review-focused and does not mention `/blu-code-review-fix`, selected finding ids, or fix/defer/skip behavior.

Why it matters:

The parent command can ask for review-fix reclassification and receive a code-review-shaped output contract. That is exactly the kind of agent-contract mismatch that causes LLM repair loops or invalid JSON downstream.

Recommended fix:

Choose one path:

- Add an explicit read-only review-fix reclassification contract to `agents/blueprint-reviewer.md`, including selected target ids, `fix/defer/skip`, stale evidence, and no persistence/mutation authority.
- Or remove the reviewer path from `code-review-fix` docs/runtime guidance and keep review-fix inline until a proper remediation classifier exists.

Add coverage that fails if the command advertises a subagent capability the agent contract does not describe.

### P1: Code-Review Findings Lose Disposition Before Review-Fix Selection

Evidence:
- `src/mcp/tools/review.ts:77` defines `ReviewFinding` without disposition.
- `src/mcp/tools/review.ts:4241` renders code-review findings with `[severity][disposition]`.
- `src/mcp/tools/review.ts:4007` parses persisted review Markdown into `ReviewFinding[]`, but only infers severity and summary.
- `src/mcp/tools/review.ts:1525` turns every parsed finding into a review-fix target.

Why it matters:

The code-review schema allows dispositions: `follow-up`, `observation`, `blocked`, and `accepted-risk`. Only some of these are remediation targets. Today, `--all` or bounded `--auto` can treat an observation or accepted risk as something to fix.

Recommended fix:

Extend `ReviewFinding` to preserve `disposition`. Parse canonical code-review bullets into `id`, `severity`, `disposition`, `location`, and summary/evidence fields. Then have review-fix include only remediation-worthy dispositions by default:

- `follow-up`: selectable by default.
- `blocked`: selectable or routed to blocked repair flow, depending on policy.
- `observation`: exclude or auto-defer unless explicitly selected.
- `accepted-risk`: exclude unless explicitly selected.

### P1: Code-Review Finding Location Is Not Structured For Remediation

Evidence:
- `src/mcp/artifact-contracts/schemas/review.code-review.model.schema.json:157` requires each finding to include `location`.
- `src/mcp/tools/review.ts:4241` renders the location into a Markdown bullet.
- `src/mcp/tools/review.ts:4007` reloads findings without a structured `location`.
- `skills/blueprint-review/references/code-review-fix-runtime-contract.md:53` requires rereading implicated source files before edits.

Why it matters:

`code-review-fix` is supposed to stay bounded to saved review evidence and implicated files. Without structured file/line, the LLM has to scrape prose from the summary or reread too broadly.

Recommended fix:

Parse canonical code-review findings into a structured location object:

- `location`
- `file`
- `startLine`
- `endLine`

Expose those fields in `blueprint_review_load_findings` and `ReviewFixAuthoringContext.targets`.

### P1: Review-Fix Target IDs Are Not Durable Enough

Evidence:
- `src/mcp/tools/review.ts:3678` strips visible `F-*` / `FU-*` ids from summaries.
- `src/mcp/tools/review.ts:4007` dedupes findings by summary or visible target id.
- `src/mcp/tools/review.ts:1525` builds review-fix targets from parsed findings and follow-ups.

Why it matters:

For canonical rendered code-review artifacts this is mostly stable, but legacy or edited Markdown can drift:

- visible ids not starting at `F-01` may be renumbered,
- duplicate follow-up text can collapse,
- selected `targetIds` can refer to parser order rather than durable saved identity.

Recommended fix:

Preserve visible ids when present. Avoid deduping target inventory for review-fix selection. For legacy items without visible ids, use deterministic hash fallback ids or clearly mark them as legacy-derived.

### P2: Every Code-Review Follow-Up Becomes A Review-Fix Target

Evidence:
- `src/mcp/artifact-contracts/schemas/review.code-review.model.schema.json:85` describes follow-ups as fix, test, validation, or explicit no-follow-up statements.
- `src/mcp/tools/review.ts:1533` converts every substantive follow-up into `FU-*`.
- `commands/blu-code-review-fix.toml:21` treats returned findings and follow-ups as remediation baseline.

Why it matters:

A PASS review can still have a concrete validation next step. A review can also include test or verification guidance that belongs in `/blu-validate-phase` or `/blu-add-tests`, not bounded source remediation. Treating every follow-up as a fix target can send users into code-review-fix when no code defect exists.

Recommended fix:

Classify follow-up targets before exposing them to review-fix:

- fixable code defect,
- test gap,
- validation-only,
- routing / process note,
- no-op sentinel.

Only expose fixable or explicitly selected test-gap follow-ups as review-fix targets by default. Route validation-only follow-ups to validation/progress.

### P2: Invalid Record Writes Lose Structured Diagnostics

Evidence:
- `docs/commands/code-review.md:154` and `skills/blueprint-review/references/code-review-runtime-contract.md:195` say record rejections should be repaired against returned diagnostics.
- `src/mcp/tools/review.ts:97` defines `ReviewRecordResult` without `diagnostics`, `diagnosticCounts`, or `taskSchema`.
- `src/mcp/tools/review.ts:8746` flattens validation diagnostics into formatted warning strings.

Why it matters:

When `blueprint_review_record` replays validation and fails, the LLM receives less actionable structure than it gets from `blueprint_review_validate_model`. That makes retry repair harder, especially when evidence or scope changed between validate and record.

Recommended fix:

For `status: "invalid"` model-only record results, return structured validation details:

- `diagnostics`
- `diagnosticCounts`
- `taskSchema`
- optionally `normalizedModel`

Keep human-readable warnings, but do not make them the only repair surface.

### P2: Explicit Scope Provenance Can Be Misstated

Evidence:
- `src/mcp/tools/review.ts:674` makes `scopeSource` optional.
- `src/mcp/tools/review.ts:8607` can drop validation files when omitted/non-explicit source matches the current implicit scope.
- `commands/blu-code-review.toml:32` says explicit `--files` must persist as `scopeSource: "explicit-files"`.

Why it matters:

If `/blu-code-review --files ...` forgets `scopeSource`, and the explicit file set happens to equal the implicit set, the persisted review can render `Scope source: phase-evidence` even though the user explicitly selected files.

Recommended fix:

Require `scopeSource` for code-review model writes, or carry an opaque scope token from `blueprint_review_scope` through validation and record. Add a regression where explicit files equal implicit files.

### P2: Code-Review Repair Guidance Points At Markdown Template

Evidence:
- `skills/blueprint-review/references/code-review-runtime-contract.md:15` says `authoringTemplate` is Markdown shape reference only.
- `skills/blueprint-review/references/code-review-runtime-contract.md:66` says to treat `authoringTemplate` as the shape to repair toward.
- `commands/blu-code-review.toml:30` says to author only JSON model fields.

Why it matters:

The command is model-only. Telling the LLM to repair toward Markdown shape can cause it to add rendered headings or `content`, which `blueprint_review_record` rejects.

Recommended fix:

Change repair wording to use:

- `contract.modelContract`,
- `contract.modelContract.jsonSchema`,
- `blueprint_review_scope.authoringContext.taskSchema`,
- returned diagnostics.

Keep `authoringTemplate` as renderer preview/reference only.

### P2: Review-Fix JSON Wording Suggests Rendered Heading Keys

Evidence:
- `commands/blu-code-review-fix.toml:32` says to include rendered heading evidence for `Remediation Summary`, `Findings Addressed`, etc.
- `src/mcp/artifact-contracts/schemas/review.review-fix.model.schema.json:7` has `additionalProperties: false`.
- `src/mcp/artifact-contracts/schemas/review.review-fix.model.schema.json:36` uses camelCase fields such as `remediationSummary`.
- `src/mcp/artifact-contracts/index.ts:1586` forbids rendered headings/provenance keys in JSON.

Why it matters:

The wording may prompt literal rendered heading keys in JSON, producing avoidable schema failure.

Recommended fix:

Reword to: populate the schema fields that render those headings. Explicitly forbid literal rendered heading keys and locked marker keys in the JSON model.

### P2: Review-Fix State Update Guidance Is Underspecified

Evidence:
- `commands/blu-code-review-fix.toml:36` says to call `blueprint_state_update` with `base: "synced"` so state records the command and next action.
- The review found the tool changes `activeCommand` / `nextAction` only when present in `patch`; otherwise synced state can preserve or derive other values.

Why it matters:

The command may complete remediation and still leave `STATE.md` pointing to the prior command or a derived route.

Recommended fix:

Make the command contract specify:

```json
{
  "base": "synced",
  "patch": {
    "activeCommand": "/blu-code-review-fix",
    "currentPhase": "<phase>",
    "nextAction": "<chosen implemented action>"
  }
}
```

Or soften the claim if derived state is intentional.

### P3: Next-Action Priority Conflicts With Remaining Findings

Evidence:
- `commands/blu-code-review.toml:35` says prefer `/blu-secure-phase` when security is missing before considering findings.
- `src/mcp/tools/review.ts:6148` only rejects `/blu-progress` when follow-up findings remain, not `/blu-secure-phase`.

Why it matters:

A `FOLLOW_UP` code review can persist with `/blu-secure-phase` as next action while concrete code-review fixes remain. That may be intentional if security should always precede remediation, but it contradicts the “recommend code-review-fix only when concrete follow-up findings remain” posture.

Recommended fix:

Clarify priority:

- If findings route first, enforce `/blu-code-review-fix <phase>` for `FOLLOW_UP` findings.
- If security routes first, add a secondary recommendation field or rendered note so fixes are not hidden behind the security route.

### P3: Runtime Reference Source Of Truth Is Ambiguous

Evidence:
- `docs/RUNTIME-REFERENCE.md:135` lists `docs/commands/code-review.md` and `docs/commands/code-review-fix.md` as command specs.
- Metadata tests say these commands are source-owned / docs-free with spec paths under `src/mcp/command-runtime-metadata.ts`.

Why it matters:

Future audits may repair the wrong source of truth.

Recommended fix:

Update runtime-reference rows to the source-owned metadata paths, or change metadata/tests if docs are intended to be active runtime specs.

## Validation And Schema Improvements

### Keep These High-Value Validations

These gates materially reduce bad writes and should stay:

- Explicit review scope normalization: repo-relative files only; no directories, wildcards, absolute paths, or `.blueprint/**`; invalid explicit scope fails closed (`src/mcp/tools/review.ts:7413`).
- Model-only persistence for `code-review` and `review-fix`; Markdown fallback rejection (`src/mcp/tools/review.ts:8675`).
- Exact selected `targetIds` narrowing for review-fix (`src/mcp/tools/review.ts:1684`, `src/mcp/tools/review.ts:6607`).
- Existing file and line-range validation for code-review finding locations (`src/mcp/tools/review.ts:5988`).
- Implemented-only next-action validation, provided catalog-unavailable cases are treated as infrastructure failures rather than model-quality failures (`src/mcp/tools/review.ts:968`).

### Reduce Or Soften These Validators

#### Placeholder Word Scanning Is Too Broad

Evidence:
- `src/mcp/tools/review.ts:923` flags any string containing `todo`, `tbd`, `fill in`, or `coming soon`.
- `src/mcp/tools/review.ts:5868` scans all code-review model strings.
- `src/mcp/tools/review.ts:6403` scans all review-fix model strings.

False failure example:

A valid code-review finding might cite a real `TODO`, placeholder UI copy, or “coming soon” product text.

Recommendation:

Make this warning-level unless the value exactly matches scaffold/template language, or restrict hard failures to known placeholder-only fields and `exampleLeakageSignals`.

#### Evidence Coverage Is Validated Too Many Times

Evidence:
- Task schema requires exact evidence keys (`src/mcp/tools/review.ts:1073`).
- Residual diagnostics re-check missing/unknown keys (`src/mcp/tools/review.ts:5905`).
- Render validation scans Markdown for the same paths (`src/mcp/tools/review.ts:8393`).
- Record validation scans again (`src/mcp/tools/review.ts:8788`).

Risk:

More places to produce noisy or stale failures if artifact inventory changes between validation and record.

Recommendation:

Keep schema as the hard gate. Keep residual diagnostics only if they provide friendlier repair guidance. Move rendered evidence scanning to renderer regression tests or downgrade to warnings unless schema passed but renderer omitted a known key.

#### Duplicate / Overlapping Code-Review Locations Should Not Always Fail

Evidence:
- `src/mcp/tools/review.ts:6050` rejects duplicate locations.
- `src/mcp/tools/review.ts:6071` rejects overlapping ranges.

False failure example:

Two distinct issues can share a line in config, chained calls, validation branches, or auth checks.

Recommendation:

Keep path existence and line existence as hard gates. Downgrade duplicate/overlap to a warning unless severity, disposition, evidence, and recommendation are materially identical.

#### Review-Fix PARTIAL Truth Table Forces Filler

Evidence:
- `src/mcp/artifact-contracts/schemas/review.review-fix.model.schema.json:195` requires `PARTIAL` to include manual/deferred work, gap routes, follow-ups, and either deferred/skipped findings or non-pass verification.

False failure examples:

- all selected findings fixed and verification passed, but a dependency plan remains pending;
- a failed verification alone explains partiality, but schema also forces gap/manual rows.

Recommendation:

Require one concrete remaining-work signal across findings, verification, dependency plans, manual/deferred work, or gap routes instead of requiring all categories.

#### COMPLETED Review-Fix Always Requires A Changed File

Evidence:
- `src/mcp/artifact-contracts/schemas/review.review-fix.model.schema.json:152` requires a real `changeRow` for `COMPLETED`.

False failure example:

A selected follow-up target may be “rerun focused validation” and complete with command evidence but no repo file change.

Recommendation:

Allow the exact no-change sentinel when all selected targets are follow-ups or completion is verification-only.

#### Review-Fix Rejects Pipes And Newlines Even Though Renderer Escapes Tables

Evidence:
- `src/mcp/artifact-contracts/schemas/review.review-fix.model.schema.json:500` rejects pipes and line breaks in table cells.
- `src/mcp/tools/review.ts:4422` already escapes pipes and collapses newlines via `markdownTableCell`.

False failure example:

`npm test | tee review.log` is a normal command but invalid table cell content.

Recommendation:

Let the renderer own table safety, or create a command-specific field type that allows shell pipelines while still normalizing newlines.

#### Code-Review Multiline Strings Can Inject Markdown

Evidence:
- `src/mcp/artifact-contracts/schemas/review.code-review.model.schema.json:108` only requires `minLength`.
- `src/mcp/tools/review.ts:881` renders bullets from raw strings.
- `src/mcp/tools/review.ts:4241` interpolates finding fields directly into Markdown.

Risk:

`finding.evidence` or `followUps[0]` with a newline can inject extra list items or headings before render validation.

Recommendation:

Either constrain code-review scalar strings to single-line values or add a shared Markdown scalar renderer that collapses newlines and escapes hazardous list/table syntax.

#### Path Regexes Are Not Centralized

Evidence:
- `src/mcp/tools/review.ts:1022` builds a task schema from exact scope files.
- `src/mcp/tools/artifacts.ts:5931` and `src/mcp/tools/artifacts.ts:5979` use narrower regexes for rendered scope/file:line extraction.

False failure example:

A scoped file with spaces can validate against the exact task schema but fail downstream rendered Markdown parsing.

Recommendation:

Centralize repo path and `file:line` parsing. Prefer comparing file portions against `scopeFiles` over hand-maintaining multiple regex variants.

## Test Gaps To Add

Recommended high-value tests:

1. `blueprint_review_load_findings_preserves_code_review_location_and_disposition`
   - Record a code-review model with `follow-up` and `observation` findings.
   - Assert `blueprint_review_load_findings` exposes exact `id`, `severity`, `disposition`, `location`, and summary/evidence.

2. `review_fix_authoring_context_classifies_findings_and_followups`
   - Assert `authoringContext.targets` distinguishes `source: "finding"` from `source: "follow-up"` and preserves severity for findings.

3. `review_fix_record_rejects_target_id_drift_after_subset_validation`
   - Validate a model with `targetIds: ["F-01"]`.
   - Record without `targetIds` or with mismatched ids.
   - Assert `status: "invalid"`, `written: false`, and repairable diagnostics/warnings.

4. `review_fix_record_surfaces_structured_validation_diagnostics_before_persistence`
   - Record an invalid structured model.
   - Assert no file write and structured diagnostics are returned, not just generic failure strings.

5. `blueprint_review_record_preserves_phase_summaries_and_phase_plans_scope_source`
   - Cover summary-only and plan-only provenance.
   - Assert rendered `Scope source` does not collapse to `phase-evidence` or `explicit-files`.

6. `blueprint_review_validate_model_rejects_fluffy_code_review_reasoning`
   - Valid location but vague evidence/impact/recommendation should fail with a quality diagnostic.
   - Concrete terse findings should remain valid.

7. `blueprint_review_validate_model_allows_distinct_findings_same_line`
   - Two findings on the same line with different evidence/recommendation should warn or pass depending on final policy.

8. `review_fix_allows_pipeline_commands_in_verification`
   - `npm test | tee review.log` should persist safely after renderer escaping if the schema is relaxed.

9. `code_review_render_sanitizes_multiline_scalar_fields`
   - Newlines in model strings should be normalized or rejected consistently before Markdown render.

10. `code_review_explicit_scope_equal_to_implicit_keeps_explicit_source`
    - Explicit files equal implicit files, but rendered source remains `explicit-files`.

## Suggested Repair Order

1. Fix the `blueprint-reviewer` contract mismatch for review-fix.
2. Preserve structured code-review finding fields through `blueprint_review_load_findings`.
3. Add target classification and non-remediation disposition filtering before review-fix selection.
4. Return structured diagnostics from invalid `blueprint_review_record` results.
5. Require or token-bind `scopeSource` for code-review record writes.
6. Clarify JSON-vs-rendered-heading wording in command/runtime docs.
7. Relax or downgrade noisy validators while keeping scope, model-only persistence, target-id, file-existence, and implemented-command gates.
8. Add parity regression tests before further review-family command expansion.

## Planning Checkpoint - 2026-05-07

Status: discovery and clarification only. Do not implement source fixes until the user answers the questions in this section and gives explicit go-ahead.

### Discovery Agent Report - Runtime Findings And Targets

- `code-review` persists richer finding structure than the shared loader preserves. The renderer writes `[severity][disposition]`, visible `F-*` ids, and structured ``file:line`` locations into canonical bullets (`src/mcp/tools/review.ts:4241-4246`), but `ReviewFinding` and `parseFindingsFromArtifact()` keep only `id`, `severity`, `summary`, and `sourceSection` (`src/mcp/tools/review.ts:77-82, 4007-4047`). `tests/code-review-slice.test.ts:1285-1349` confirms the round-trip assertions stop there. Planning implication: any repair should preserve disposition and parsed location before changing review-fix behavior, or later target filtering/reread narrowing will still be working from flattened prose.

- `blueprint_review_load_findings` gives only conditional target-id durability. Canonical rendered findings keep visible `F-*` ids, but legacy code-review bullets without ids are renumbered by parser order (`tests/code-review-slice.test.ts:1352-1392`), and dedupe is keyed by visible review-fix id or normalized summary (`src/mcp/tools/review.ts:3678-3691, 4007-4037, 8942-9027`). That means duplicate summaries collapse and edited/legacy artifacts can change selected target identity even before review-fix narrowing runs. Planning implication: preserve saved visible ids when present and decide a stable fallback identity scheme for legacy/manual markdown before relying on `targetIds` as durable user-facing selectors.

- Review-fix target construction is broad, but narrowing/validation is strong once the inventory exists. `reviewFixTargetsFromFindings()` turns every loaded finding plus every substantive follow-up into a target; follow-ups always become synthetic `FU-*` rows with `unknown` severity (`src/mcp/tools/review.ts:1525-1542`). `resolveReviewFixSelectedTargetIds()` then defaults to all targets or exact requested ids (`src/mcp/tools/review.ts:1544-1563`), and the task schema plus residual diagnostics enforce exact alignment across authoring, validate, and record (`src/mcp/tools/review.ts:1662-1697, 1953-1978, 6607-6653`; `tests/code-review-fix-slice.test.ts:610-850`). Planning implication: keep the exact target-id coordination diagnostics, but insert disposition/follow-up classification before building the baseline inventory so `observation`, `accepted-risk`, and validation-only follow-ups do not silently become remediation targets.

- Persisted review-fix artifacts cannot recover lost source-review structure, and invalid record writes flatten repair data. `renderReviewFixModelContent()` reuses the loaded target summary for each `findingId` (`src/mcp/tools/review.ts:4436-4450`), so once code-review loading has dropped disposition/location there is no structured way to carry that context into `XX-REVIEW-FIX.md`. Separately, `blueprint_review_record()` replays full validation, but on invalid model writes it returns formatted warning strings instead of the structured `diagnostics`/`diagnosticCounts` that `blueprint_review_validate_model()` already computed (`src/mcp/tools/review.ts:4160-4185, 8188-8580, 8736-8755`; `tests/code-review-slice.test.ts:1542-1609`). Planning implication: the main runtime risk is not target selection mechanics; it is lossy recovery plus weaker retry ergonomics at record time.

### Discovery Agent Report - Schema And Validator Policy

- Verified safe cleanups:
  - Placeholder scanning claim is accurate: `hasPlaceholderLanguage()` hard-fails any string containing `todo|tbd|placeholder|replace me|fill in|insert here|coming soon`, and both code-review/review-fix walk every model string (`src/mcp/tools/review.ts:923-925`, `src/mcp/tools/review.ts:5861-5903`, `src/mcp/tools/review.ts:6400-6438`). This is broader than scaffold/example leakage and can reject legitimate quoted evidence. Safe direction: keep `exampleLeakageSignals` hard, downgrade generic token hits or narrow them to placeholder-only fields. Current coverage only proves the broad behavior via `"todo"` (`tests/code-review-slice.test.ts:1629-1678`).
  - Evidence revalidation claim is accurate: code-review evidence inventory is enforced in the task schema (`src/mcp/tools/review.ts:1073-1085`), re-checked as residual diagnostics (`src/mcp/tools/review.ts:5905-5942`), re-scanned on rendered preview (`src/mcp/tools/review.ts:8383-8403`), and re-scanned again before write (`src/mcp/tools/review.ts:8785-8828`). Consolidating the hard gate to schema plus record-time live inventory would be low-risk.
  - Pipe/newline rejection claim is accurate for review-fix tables: schema rejects pipes/CRLF in `tableCellString`, `evidenceSourceString`, and `commandEvidenceString` (`src/mcp/artifact-contracts/schemas/review.review-fix.model.schema.json:500-526`), but the renderer already escapes pipes and collapses newlines (`src/mcp/tools/review.ts:4422-4433`, `src/mcp/tools/review.ts:4470-4523`). Allowing pipes looks safe; newline policy is broader because code-review bullets still render raw.
  - Multiline markdown injection claim is accurate for code-review: base strings are only `minLength: 1` (`src/mcp/artifact-contracts/schemas/review.code-review.model.schema.json:108-111`), while bullets and finding rows interpolate raw text (`src/mcp/tools/review.ts:881-889`, `src/mcp/tools/review.ts:4241-4245`). No direct regression covers this today.
- Needs policy decisions:
  - Duplicate/overlap locations are real hard failures today (`src/mcp/tools/review.ts:6050-6093`), but there is no test proving that same-line distinct findings must be invalid. Relaxing this is a product call, not just cleanup.
  - The review-fix `PARTIAL` truth table is genuinely strict policy: it requires manual/deferred work, a gap route, a non-`none` follow-up, and either deferred/skipped findings or non-pass verification (`src/mcp/artifact-contracts/schemas/review.review-fix.model.schema.json:195-302`). Existing valid `PARTIAL` coverage mirrors that fully-populated shape (`tests/code-review-fix-slice.test.ts:1163-1221`).
  - `COMPLETED` genuinely requires all selected rows `fixed` and at least one real `changeRow` (`src/mcp/artifact-contracts/schemas/review.review-fix.model.schema.json:131-191`), even though `changesMade` already supports a `none` sentinel and residual file checks skip it (`src/mcp/artifact-contracts/schemas/review.review-fix.model.schema.json:52-66`, `src/mcp/artifact-contracts/schemas/review.review-fix.model.schema.json:576-590`, `src/mcp/tools/review.ts:6476-6489`, `src/mcp/tools/review.ts:6535-6538`). Allowing verification-only/FU-only completion is feasible, but it changes remediation semantics.
  - Path parsing mismatch is real: scoped task schemas can allow exact `scopeFiles` literals (`src/mcp/tools/review.ts:1022-1038`), while the base schema and residual parser only accept `[A-Za-z0-9._-/]` style file tokens (`src/mcp/artifact-contracts/schemas/review.code-review.model.schema.json:149-153`, `src/mcp/tools/review.ts:768-769`, `src/mcp/tools/review.ts:5755-5774`). Current tests cover root and extensionless files only, not spaces/richer names (`tests/code-review-slice.test.ts:1453-1539`).
- Shared-memory check: the review doc's parity concern still stands because `blueprint_review_load_findings` keeps only `id`, `severity`, `summary`, and `sourceSection`, with dedupe by summary/visible id (`src/mcp/tools/review.ts:4007-4047`). Any policy change that depends on disposition/location should ideally land with richer parsed finding shape first.
- High-value regression gaps:
  - quoted real `TODO`/`coming soon` evidence should not trip placeholder failure;
  - code-review multiline scalar normalization/rejection before render;
  - same-line/same-range distinct findings behavior per final policy;
  - `PARTIAL` with only dependency-plan debt;
  - `COMPLETED` with `changesMade: none` for FU-only completion if allowed;
  - scoped filenames with spaces to catch schema/parser drift;
  - review-fix verification commands containing shell pipes.

### Discovery Agent Report - Contracts And Routing

- `blueprint-reviewer` reuse for `/blu-code-review-fix` is still implicit rather than contracted. The review-fix manifest/doc/skill all authorize read-only reclassification (`commands/blu-code-review-fix.toml:5`, `docs/commands/code-review-fix.md:84`, `skills/blueprint-review/SKILL.md:213-216`), but the agent itself says any non-code-review reuse must provide an explicit output shape (`agents/blueprint-reviewer.md:37-39`, `agents/blueprint-reviewer.md:142-144`). The metadata test currently locks that gap in place by asserting the agent does not mention `/blu-code-review-fix`, `fix/defer/skip`, or selected finding ids (`tests/code-review-fix-metadata.test.ts:215-226`). Implementation implication: either add an explicit review-fix reuse contract to the agent and update metadata/tests, or remove `blueprint-reviewer` from review-fix routing surfaces until that contract exists.

- Code-review repair guidance is split between schema-first and rendered-template-first wording. The manifest and command doc are model-first (`commands/blu-code-review.toml:30-32`, `docs/commands/code-review.md:82`, `docs/commands/code-review.md:154`), but the local runtime contract still says `authoringTemplate` is Markdown-only and then says to repair toward it (`skills/blueprint-review/references/code-review-runtime-contract.md:15-17`, `skills/blueprint-review/references/code-review-runtime-contract.md:63-67`). Implementation implication: make one authority explicit, preferably `modelContract` + narrowed `taskSchema`, then update the runtime contract and its metadata assertions to stop suggesting rendered-heading repair for `review.code-review`.

- Review-fix JSON wording still blurs schema fields with rendered headings. The manifest says "Author a `review.review-fix` JSON model only" but then asks for "rendered heading evidence" (`commands/blu-code-review-fix.toml:32-34`); the command doc says to use rendered headings from authoring context and "keep the rendered `XX-REVIEW-FIX.md` structure intact" (`docs/commands/code-review-fix.md:74-79`); the runtime-reference row repeats the rendered section names as if they are part of the authoring contract (`docs/RUNTIME-REFERENCE.md:136`). Tests currently assert those phrases rather than a stricter schema-only wording (`tests/code-review-fix-metadata.test.ts:186-201`). Implementation implication: decide whether rendered headings are output-only labels or authorable keys; if output-only, reword all three surfaces and add a negative test that literal heading keys are not treated as valid JSON inputs.

- Review-fix state-update guidance is stronger in the manifest than in the surrounding contracts. The manifest promises that `base: "synced"` makes `STATE.md` record `/blu-code-review-fix` as the active command and the next safe action (`commands/blu-code-review-fix.toml:36`), but the runtime contract and shared skill only require a state update plus follow-up routing preference (`skills/blueprint-review/references/code-review-fix-runtime-contract.md:98-103`, `skills/blueprint-review/SKILL.md:253-256`). Metadata tests only check that `blueprint_state_update` is mentioned, not what patch must be sent (`tests/code-review-fix-metadata.test.ts:94`, `tests/code-review-fix-metadata.test.ts:140`). Implementation implication: either lock an explicit patch contract in source/docs/tests, or soften the manifest wording so it does not over-promise exact state fields.

- Next-action priority is currently security-first, not finding-first. `/blu-code-review` and the shared review skill both prefer `/blu-secure-phase <phase>` before `/blu-code-review-fix <phase>` (`commands/blu-code-review.toml:35-38`, `skills/blueprint-review/SKILL.md:177-180`), and quality-gate routing tests codify that missing security outranks saved review-fix follow-up (`tests/quality-gate-routing.test.ts:880-896`). If the intended UX is "fix review findings first whenever they exist," that is a policy change, not a doc typo. Implementation implication: user decision needed on whether to preserve security-first routing and expose remediation as a secondary recommendation, or flip the priority and update command wording plus routing tests together.

- Runtime-reference source of truth is ambiguous for these two commands. Live metadata and runtime-resource tests treat both commands as source-owned/docs-free with spec/runtime-reference paths in `src/mcp/command-runtime-metadata.ts` (`src/mcp/command-runtime-metadata.ts:1756-1833`, `tests/code-review-metadata.test.ts:127-171`, `tests/code-review-fix-metadata.test.ts:13-55`, `tests/review-runtime-contract-resource.test.ts:57-83`), but `docs/RUNTIME-REFERENCE.md` still lists `docs/commands/code-review.md` and `docs/commands/code-review-fix.md` in the command-spec column and marks both rows `docs-aligned` (`docs/RUNTIME-REFERENCE.md:135-136`). The same runtime-reference doc also says the runtime-contract resource mirrors the runtime-reference row (`docs/RUNTIME-REFERENCE.md:56-59`). Implementation implication: pick one truth model. Either update the runtime-reference rows/evidence tags to `source-owned`, or explicitly downgrade the row to historical/documentary status and stop describing the live resource as mirroring it.

User-policy choices surfaced by this pass: whether review-fix should keep `blueprint-reviewer` as an optional agent before it has an explicit remediation contract; whether rendered headings are authoring guidance or renderer-only output labels; whether `/blu-code-review-fix` must guarantee exact synced-state fields; and whether missing security should continue to outrank saved code-review remediation in next-step routing.

### Grey Area Analysis

1. **Finding shape is shared, but the highest-risk use is code-review -> review-fix.** `ReviewFinding` is used by code-review, review-fix, security, UI review, and peer review loaders. Adding optional `disposition`, `location`, `file`, `startLine`, and `endLine` fields is low-risk if existing consumers remain compatible, but changing dedupe or id semantics globally can affect non-code-review artifacts. Preferred implementation should make code-review canonical parsing richer first, then consciously decide whether security/UI/peer parsers should populate the new optional fields later.

2. **Target inventory and default target selection are separate decisions.** The runtime can expose every saved target with classification metadata while defaulting review-fix selection to only remediation-worthy items. This avoids hiding observations or accepted risks from advanced/manual runs while preventing `--all` and bounded `--auto` from treating every saved note as a code defect.

3. **`blocked` disposition is semantically mixed.** In the reviewer contract, `blocked` can mean missing evidence, invalid scope, likely bug, unsafe behavior, or regression risk. Some blocked findings should route to validation/planning instead of source remediation. Treating `blocked` as explicit-only unless it has a clear code-fix classification is safer than fixing it by default.

4. **Legacy/manual Markdown cannot have perfect target durability without a visible-id or hash policy.** Canonical rendered artifacts have visible `F-*` / `FU-*` ids, but old or edited Markdown without ids currently gets order-derived ids. Preserving visible ids is obvious; the gray area is whether to introduce hash-style ids for legacy rows or continue order ids with explicit `legacyDerived` warnings.

5. **Validator relaxation has different blast radii.** Structured diagnostics, disposition/location parsing, docs wording, and source-of-truth cleanup are straightforward parity fixes. Relaxing truth tables, allowing no-change `COMPLETED`, allowing table pipes, downgrading placeholder terms, and changing duplicate/overlap severity all alter what models can persist, so they need explicit policy.

6. **Security-first next action may be intentional.** Current contracts and routing tests prefer `/blu-secure-phase` before `/blu-code-review-fix` when security evidence is missing. That can hide remediation urgency, but flipping the order changes an existing quality-gate policy. A safer compromise is to keep security-first as primary and render/return code-review-fix as a secondary recommendation while findings remain.

7. **Docs-free/source-owned status should not erase useful command docs.** Runtime metadata is already source-owned for these commands, while command docs remain control-plane/spec history. The repair should make `docs/RUNTIME-REFERENCE.md` honest about live source ownership without deleting or devaluing `docs/commands/code-review*.md`.

### Ambiguity Analysis

Resolved by discovery:

- `blueprint_review_load_findings` does drop canonical code-review disposition and location.
- `reviewFixTargetsFromFindings()` defaults every parsed finding and every substantive follow-up into the review-fix baseline.
- Review-fix target-id coordination is already strong once the baseline exists; the weak point is what enters the baseline.
- Invalid model-only `blueprint_review_record()` returns flattened warnings instead of structured diagnostics.
- `blueprint-reviewer` is advertised for review-fix but lacks an explicit review-fix output contract.
- The review-fix schema rejects pipes even though the renderer escapes them.
- Code-review strings can inject Markdown because they are rendered raw from scalar model fields.

Ambiguous until user chooses:

- Whether `blocked` findings should be default remediation targets, explicit-only targets, or route away from review-fix.
- Whether test-gap follow-ups belong in code-review-fix by default or should route to `/blu-add-tests` unless explicitly selected.
- Whether legacy no-visible-id findings should get hash-derived ids or keep order-derived ids with warnings.
- Whether validator relaxations should be broad in this pass or limited to low-risk P1/P2 runtime fixes.
- Whether `/blu-code-review` should keep security-first next action priority.
- Whether `/blu-code-review-fix` should lock an exact `blueprint_state_update` patch contract or soften the wording.

### Questions For User

Please select one choice for each question before implementation starts.

1. **Reviewer Subagent Contract**
   - A (Recommended): Add an explicit read-only `/blu-code-review-fix` reclassification section to `agents/blueprint-reviewer.md`, covering selected target ids, `fix/defer/skip`, stale evidence, and no mutation/persistence authority.(user ok with this, but make sure the fallback same agent implementation also has same information available when subagents are not working or are available)
   - B: Remove `blueprint-reviewer` from code-review-fix manifests/docs/metadata until a dedicated remediation classifier exists.
   - C: Leave the current implicit reuse wording in place.

2. **Default Finding Disposition Policy**
   - A (Recommended): Expose all parsed findings in authoring context, but default review-fix selection to `follow-up` only; make `blocked`, `observation`, and `accepted-risk` explicit-only unless a later classifier marks them fixable. (user ok with this)
   - B: Default `follow-up` and `blocked`; make `observation` and `accepted-risk` explicit-only.
   - C: Only expose `follow-up` findings at all; hide the rest from review-fix target inventory.

3. **Follow-Up Target Policy**
   - A (Recommended): Classify follow-ups as `fixable`, `test-gap`, `validation-only`, `routing-note`, or `no-op`; default only `fixable`, allow explicit `test-gap`, and route validation-only/process notes away from review-fix. (user ok with this)
   - B: Default `fixable` and `test-gap`; exclude validation-only/process/no-op.
   - C: Keep all substantive follow-ups as targets, but add classification metadata.

4. **Legacy Target ID Policy**
   - A (Recommended): Preserve visible `F-*` / `FU-*` ids; for legacy bullets without visible ids, generate deterministic hash ids and mark them `legacyDerived`. (user ok with this)
   - B: Preserve visible ids; keep order-derived `F-01` / `FU-01` fallback for legacy bullets but return warnings and `legacyDerived`.
   - C: Preserve current order-derived behavior only.

5. **Scope Provenance**
   - A (Recommended): Require `scopeSource` for code-review record writes when `scopeFiles` are provided; reject missing provenance with structured diagnostics. (user ok with this)
   - B: Carry an opaque scope token from `blueprint_review_scope` through validate/record and reject mismatches.
   - C: Keep the current heuristic and only update docs/tests around explicit-file equality.

6. **Validator Relaxation Level**
   - A (Recommended): Balanced relaxation: keep scope, model-only, target-id, existing-file/line, and implemented-action gates hard; soften generic placeholder tokens, duplicate/overlap locations, and rendered evidence rescans to warnings where structured schema already passed; allow table pipes through renderer escaping; reject or normalize code-review newlines before render; centralize path parsing. (user ok with this)
   - B: Conservative pass: only fix P1/P2 data-loss, diagnostics, and docs wording now; leave validator policy unchanged except new tests that document current behavior.
   - C: Broad permissive pass: relax all listed validator concerns, including no-change completed review-fix and partial truth-table rules, in this implementation loop.

7. **Review-Fix Truth Table And No-Change Completion**
   - A (Recommended): Relax `PARTIAL` to require at least one concrete remaining-work signal across findings, verification, dependency plans, manual/deferred work, gap routes, or follow-ups; allow `COMPLETED` with the exact no-change sentinel only when all selected targets are follow-up/verification-only and verification passed. (user ok with this)
   - B: Relax `PARTIAL` only; keep `COMPLETED` requiring a real changed file.
   - C: Keep both truth tables as-is.

8. **Next-Action Priority From Code Review**
   - A (Recommended): Keep security-first primary routing when `XX-SECURITY.md` is missing, but make remaining review-fix findings a secondary rendered/returned recommendation so they are not hidden. (user ok with this)
   - B: Findings-first: route to `/blu-code-review-fix <phase>` whenever concrete follow-up findings remain, then security.
   - C: Leave current security-first behavior and wording unchanged.

9. **Review-Fix State Update Contract**
   - A (Recommended): Lock the command contract to call `blueprint_state_update` with `base: "synced"` plus explicit `patch.activeCommand`, `patch.currentPhase`, and `patch.nextAction`. (user ok with this)
   - B: Soften the command wording so `base: "synced"` does not promise exact state fields unless the patch includes them.
   - C: Leave current wording and behavior unchanged.

10. **Runtime Reference Source Of Truth**
    - A (Recommended): Update `docs/RUNTIME-REFERENCE.md` rows for `code-review` and `code-review-fix` to source-owned metadata paths and evidence tags, while keeping command docs as control-plane history. (user ok with this)
    - B: Change runtime metadata/tests back to docs-aligned command specs.
    - C: Leave the ambiguity in place for now.

### Subagent handling instructions for orchestrator
- Each subagent to be GPT-5.4 high
- close agent as soon as the execution is finished
- run upto 3 subagents at a time
- split the subagent work to allow narrow focused fixes
- Once the agent has finished its work, you can review it at high level, if needed dispatch new agent to fix your finding
- keep going utill all review comments are fixed


### Proposed Implementation Plan

Assumption: after the user answers these questions and gives go-ahead, create a fresh implementation worktree, run `npm ci` there before build/typecheck/test, and let all implementation agents work only in that worktree. Keep at most three subagents active at once and close each as soon as it finishes.

#### Phase 0 - Worktree And Baseline

Dependencies: user selections.

- Main orchestrator: create `codex/review-fix-parity-implementation` worktree from `main`, copy/bring this review doc if still staged-only, run `npm ci`, inspect baseline `git status`, and assign non-overlapping file ownership.
- Verification baseline: do not run full tests until dependencies are installed; prefer focused review tests first after each wave.

#### Wave 1 - Contracts And Low-Risk Metadata

Can run in parallel after Phase 0.

- Agent 1, Contracts: update `agents/blueprint-reviewer.md`, `commands/blu-code-review-fix.toml`, `docs/commands/code-review-fix.md`, `skills/blueprint-review/SKILL.md`, `skills/blueprint-review/references/code-review-fix-runtime-contract.md`, and metadata tests according to Question 1 and Question 9.
- Agent 2, Runtime Reference: update `docs/RUNTIME-REFERENCE.md`, command metadata/resource assertions, and source-of-truth tests according to Question 10.
- Agent 3, Code-Review Wording: update code-review runtime guidance so repair authority is `modelContract` + narrowed `taskSchema`, not rendered `authoringTemplate`; adjust metadata tests.

Dependency note: Wave 1 should not touch `src/mcp/tools/review.ts` except metadata constants if needed.

#### Wave 2 - Rich Finding Loader And Target Inventory

Depends on Wave 1 contracts being directionally settled.

- Agent 1, Loader Runtime: extend `ReviewFinding` and canonical code-review parsing to preserve visible ids, disposition, location, parsed file/start/end, evidence/impact/recommendation where possible, and legacy-derived warnings per Question 4.
- Agent 2, Review-Fix Targets: extend `ReviewFixTarget` / authoring context with source, disposition, location, classification, default eligibility, and selected-target rules per Questions 2 and 3.
- Agent 3, Tests: add or update regression tests for load-findings round trip, target classification, non-remediation disposition filtering, follow-up classification, and target-id drift.

Dependency note: target classification should build on the richer loader; if both agents run simultaneously, Agent 2 should code against agreed type additions and avoid parser edits.

#### Wave 3 - Diagnostics, Scope Provenance, And State Patch

Depends on Wave 2 type shape.

- Agent 1, Structured Diagnostics: extend `ReviewRecordResult` invalid returns with `diagnostics`, `diagnosticCounts`, `taskSchema`, and optionally `normalizedModel`; preserve `warnings` for compatibility.
- Agent 2, Scope Provenance: implement Question 5 choice and add explicit-files-equal-implicit regression coverage.
- Agent 3, State Patch: implement or soften state-update contract per Question 9, with metadata coverage.

#### Wave 4 - Validator Policy

Depends on user choices 6 and 7.

- Agent 1, Code-Review Validator Safety: multiline scalar handling, placeholder severity changes, duplicate/overlap behavior, path parser centralization tests.
- Agent 2, Review-Fix Schema: table pipe/newline policy, PARTIAL truth-table/no-change completion policy, schema updates, generated dist schema parity if build regenerates it.
- Agent 3, Evidence Revalidation: consolidate/downgrade duplicate evidence checks without weakening schema-owned evidence coverage.

Dependency note: if user chooses conservative validator policy, Wave 4 becomes mostly tests/documentation of current behavior plus pipe/newline or multiline hardening only.

#### Wave 5 - Routing And Integration

Depends on Waves 1-4.

- Agent 1, Next Action: implement Question 8 in command/runtime docs, MCP residual validation/rendering if needed, and routing tests.
- Agent 2, Integration Tests: add end-to-end-ish review -> load -> authoring-context -> review-fix validation tests covering selected ids and classification.
- Main orchestrator: run focused tests (`npm test -- tests/code-review-slice.test.ts tests/code-review-fix-slice.test.ts tests/code-review-metadata.test.ts tests/code-review-fix-metadata.test.ts tests/command-catalog.test.ts`), then `npm run typecheck`, `npm run build`, and broader `npm test` if focused tests pass.

#### Wave 6 - Review, Repair, And Ship Prep

Depends on all implementation waves.

- Main orchestrator: high-level review of subagent diffs, dispatch at most one corrective agent per isolated finding if needed, rerun focused verification after each repair, then final typecheck/build/test.
- Only after verification: summarize changed files, stage/commit/push/PR/merge/pull main per repo guardrail if the user asks to carry through shipping.
