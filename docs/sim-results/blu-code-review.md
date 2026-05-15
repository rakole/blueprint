---
status: implemented
---

# `/blu-code-review` Simulation Results

## Scope

`status`: `implemented`

Workflow simulated: `/blu-code-review`

Simulation focus: realistic `XX-REVIEW.md` generation through the real review scope derivation, narrowed model schema,
model validation, canonical render, and record/write path.

Investigation grounding:

- Command: `commands/blu-code-review.toml`
- Skill: `skills/blueprint-review/SKILL.md`
- Runtime contract: `skills/blueprint-review/references/code-review-runtime-contract.md`
- Optional reviewer agent: `agents/blueprint-reviewer.md`
- Command spec: `docs/commands/code-review.md`
- Contract/model source: `src/mcp/artifact-contracts/index.ts`
- Base model schema: `src/mcp/artifact-contracts/schemas/review.code-review.model.schema.json`
- Scope, validation, rendering, and record path: `src/mcp/tools/review.ts`
- Rendered Markdown validation: `src/mcp/tools/artifacts.ts`
- Later quality-gate routing: `src/mcp/tools/quality-gates.ts`

Artifacts involved:

- `.blueprint/phases/<phase-slug>/<phase-prefix>-REVIEW.md`

Normal `/blu-code-review` does not update `.blueprint/STATE.md`; later routing reads the saved review artifact through
quality-gate logic.

## Simulation Summary

Two independent agents ran real simulations against temporary repos using live Blueprint handlers. Both reached a
persisted `XX-REVIEW.md` within three attempts. The core protections worked: scoped file citations were enforced,
invalid next actions were detected in some cases, Markdown fallback was not used, and valid structured models rendered
canonical review artifacts. The repeated friction was concentrated in noisy evidence diagnostics and a second-stage
`scopeSource` requirement that can fail after model validation succeeds.

| Agent        | Attempts | Final Result                                     | Main Retry Drivers                                                              |
|--------------|---------:|--------------------------------------------------|---------------------------------------------------------------------------------|
| GPT-5.5 high |        3 | `XX-REVIEW.md` created from phase-evidence scope | 18 first-pass diagnostics, exhaustive evidence keys, late missing `scopeSource` |
| GPT-5.4 high |        3 | `XX-REVIEW.md` created from explicit-files scope | Noisy `evidenceCoverage`, secondary route accepted, late missing `scopeSource`  |

Both simulations exercised `blueprint_review_scope`, `blueprint_review_validate_model`, and `blueprint_review_record`.
One simulation also confirmed that the live checkout without `.blueprint/ROADMAP.md` correctly stops before authoring,
so temp fixtures were required to exercise the save path without mutating repo runtime state.

## Findings

### High: `evidenceCoverage` failures are overly noisy for a single authoring slip (FIXME:)

Both simulations hit a common mistake: missing, invented, or incomplete evidence keys. The narrowed task schema already
requires exact known evidence keys and bans extras, but residual validation reports missing and unknown evidence again.
One simulation saw eight evidence-related diagnostics from one root issue, and another saw awkward paths such as
`model.evidenceCoverage..blueprint/...`.

Evidence:

- Task schema requires exact known evidence artifacts and disallows extras: `src/mcp/tools/review.ts:1293`.
- Residual evidence checks add missing/unknown diagnostics again: `src/mcp/tools/review.ts:6750`.
- Task schema narrows evidence, location, and next action: `src/mcp/tools/review.ts:1272`.
- Code-review command docs require exact evidence keys: `docs/commands/code-review.md:93`.

Why it matters: exact evidence coverage is valuable, but duplicated schema/residual messages make the first repair pass
harder than necessary. The model needs one canonical “use these exact keys” repair message, not a cascade.

### High: Code-review can validate a secondary fix route before security exists

One simulation changed a valid model’s `nextSafeAction` to `/blu-code-review-fix 5`, and validation still passed even
though the command contract says `/blu-secure-phase` should remain primary until `XX-SECURITY.md` exists, with
code-review-fix only secondary.

Evidence:

- Command contract gives security priority: `commands/blu-code-review.toml:40`.
- Allowed next-action construction includes candidate routes without narrowing to the preferred route:
  `src/mcp/tools/review.ts:852`, `src/mcp/tools/review.ts:1219`, `src/mcp/tools/review.ts:1272`, and
  `src/mcp/tools/review.ts:1341`.

Why it matters: this can persist a review artifact whose next action short-circuits the intended post-review security
gate. That is more than authoring friction; it is a route-contract mismatch.

### Medium: A model can validate cleanly and still fail record because `scopeSource` is outside the model (FIXME:)

Both simulations produced a valid structured review model, then failed `blueprint_review_record` because `scopeFiles`
was supplied without `scopeSource`. The field must be copied from `blueprint_review_scope.reviewMode.source`, but it is
not part of the validated model.

Evidence:

- Record rejects scoped code-review writes without `scopeSource`: `src/mcp/tools/review.ts:9700`.
- Command docs tell the orchestrator to carry `scopeSource`: `commands/blu-code-review.toml:37`.
- Runtime contract also documents the handoff: `skills/blueprint-review/references/code-review-runtime-contract.md:93`.
- Observed diagnostic: `scope.source_required: Code-review record writes with scopeFiles must also provide scopeSource.`

Why it matters: this is a sharp second-stage gotcha. The model can pass validation and still be unrecordable because a
required persistence argument lives outside the model validation surface.

### Medium: Exhaustive evidence coverage can encourage filler (FIXME:)

The task schema requires a model-authored `evidenceCoverage` entry for every known evidence artifact. In small fixtures
this was manageable; in larger phases this can push the model to write rationales for artifacts it barely used.

Evidence:

- `buildCodeReviewTaskSchema` sets all known evidence artifacts as required: `src/mcp/tools/review.ts:1293`.
- Residual validation repeats evidence coverage requirements: `src/mcp/tools/review.ts:6750`.

Why it matters: full traceability is good, but forcing model-authored prose for every artifact risks ceremonial filler.
MCP already knows the inventory and could render untouched evidence as not-reviewed or irrelevant.

### Medium: First-pass diagnostics duplicate schema and residual failures (FIXME:)

One plausible first-pass model generated 18 diagnostics. Several root issues appeared twice: `schema.required` plus
`residual.evidence_missing`, `schema.pattern` plus `residual.location_out_of_scope`, and `schema.enum` plus
`residual.next_action_unimplemented`.

Evidence:

- Residual checks layer on top of schema checks: `src/mcp/tools/review.ts:7061`.
- Base schema and narrowed task schema already constrain scalar shape, locations, evidence, and actions:
  `src/mcp/artifact-contracts/schemas/review.code-review.model.schema.json` and `src/mcp/tools/review.ts:1272`.

Why it matters: the checks are mostly correct, but duplicate reporting makes the repair loop look worse than the actual
problem.

### Medium: Plan-shape warnings leak into successful review generation (FIXME: take a look at warnings, i think we should get rid of them)

One simulation used plan frontmatter that was sufficient for scope derivation, but `blueprint_review_scope`, validation,
and record carried a long warning list about missing full plan sections. The warnings did not affect review artifact
creation.

Evidence:

- Plan-scope derivation validates more of the plan shape than it needs for `files_modified`:
  `src/mcp/tools/review.ts:8625`.

Why it matters: a review simulation or real command can appear unhealthy even when the scope is usable and the review
artifact is valid.

### Low: Live-repo simulation stops before authoring when `.blueprint/ROADMAP.md` is absent

One simulation first probed this checkout and found the real `blueprint_review_scope` path stops because the repo lacks
`.blueprint/ROADMAP.md`. The save path required a temp fixture.

Evidence:

- Implicit review scope requires saved phase evidence when no explicit files are supplied:
  `src/mcp/tools/review.ts:8959`.

Why it matters: this is likely correct production behavior, not a defect. It does mean future simulation work needs a
small fixture or helper to avoid spending the first attempt on environment setup.

### Low: Some diagnostics are crisp and worth preserving

The `scope.source_required` record failure was clear and repairable, and `scope.files_required` is targeted when saved
evidence cannot derive review files.

Evidence:

- `scopeSource` record guard: `src/mcp/tools/review.ts:9700`.
- `scope.files_required` validation logic: `src/mcp/tools/review.ts:9161`.

Why it matters: these are good examples for improving noisier diagnostics elsewhere.

## Deduplication Notes

Both simulations found the same high-signal authoring-cost pattern: the review path’s correctness checks are mostly
valuable, but the repair interface is noisy and split across validation and record. The final report groups duplicate
issues into:

- noisy, duplicated `evidenceCoverage` diagnostics;
- late `scopeSource` persistence failure after clean validation;
- route-preference mismatch for code-review-fix before security;
- nonblocking plan-shape warnings bleeding into a valid review save.

The simulations did not find unsafe overwrite behavior or Markdown fallback. Valid model-only writes persisted canonical
`XX-REVIEW.md` artifacts.
