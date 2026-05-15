# `/blu-new-project` Simulation Results

## Scope

Workflow simulated: `/blu-new-project`

Simulation focus: realistic first-write bootstrap artifact generation through the real MCP save path, including retries when generated data fails validation.

Investigation grounding:
- Command: `commands/blu-new-project.toml`
- Skill: `skills/blueprint-bootstrap/SKILL.md`
- Skill references: `skills/blueprint-bootstrap/references/questioning.md`, `skills/blueprint-bootstrap/references/bootstrap-runtime-contract.md`, `skills/blueprint-bootstrap/references/runtime-guardrails.md`
- Save path: `blueprintProjectInit` in `src/mcp/tools/project.ts`
- Validation path: `blueprintArtifactValidate` in `src/mcp/tools/artifacts.ts`
- Artifact contracts: `bootstrap.project`, `bootstrap.requirements`, `bootstrap.roadmap` in `src/mcp/artifact-contracts/index.ts`

Artifacts involved:
- `.blueprint/PROJECT.md`
- `.blueprint/REQUIREMENTS.md`
- `.blueprint/ROADMAP.md`
- `.blueprint/phases/<phase-prefix>-<slug>/<phase-prefix>-CONTEXT.md`
- `.blueprint/STATE.md`
- `.blueprint/config.json`

## Simulation Summary

Three independent agents ran realistic bootstrap simulations against temporary repos using real Blueprint runtime functions. All three eventually produced valid bootstrap artifacts within three attempts. The recurring retry drivers were not Markdown rendering failures; they were mismatches between the visible authoring guidance and the stricter `bootstrapSeed` shape required before `blueprint_project_init` will perform the first write.

| Agent | Attempts | Final Result | Main Retry Drivers |
| --- | ---: | --- | --- |
| GPT-5.5 high | 2 | Valid bootstrap and `blueprint_artifact_validate` green | Generic success criterion |
| GPT-5.4 high | 3 | Valid bootstrap and `blueprint_artifact_validate` green | Missing explicit phase mappings, generic criteria |
| GPT-5.2 high | 2 | Valid bootstrap and `blueprint_artifact_validate` green | Missing/invalid phase criteria, undeclared refs, over-mapped requirement |

Common successful save response:
- `createdPaths` included `.blueprint/PROJECT.md`, `.blueprint/REQUIREMENTS.md`, `.blueprint/ROADMAP.md`, `.blueprint/phases/`, first phase `*-CONTEXT.md`, `.blueprint/STATE.md`, and `.blueprint/config.json`.
- `nextAction` was `Run /blu-discuss-phase 1`.
- `blueprint_artifact_validate` returned `valid: true` after a successful write.

## Findings

### High: Visible bootstrap guidance underspecifies the required seed shape (FIXME:)

The runtime save gate requires a richer `bootstrapSeed` than the command/skill guidance makes obvious. Simulations that produced plausible project brief, requirements, and roadmap content still failed before the first write when phase `requirementIds`, phase `successCriteria`, or requirement row fields were missing.

Observed failures:
- `Phase 1 must include explicit requirementIds before the first write.`
- `Phase 1 must include explicit successCriteria before the first write.`
- Zod schema errors such as `Invalid input: expected string, received undefined` when required `status` or `notes` fields were omitted from `bootstrapSeed.requirements[]`.

Evidence:
- `bootstrapSeed` input schema requires requirement `status` and `notes`: `src/mcp/tools/project.ts:177`.
- Explicit phase gap diagnostics require `requirementIds` and `successCriteria`: `src/mcp/tools/project.ts:667`.
- Preflight runs before writes in `blueprintProjectInit`: `src/mcp/tools/project.ts:1253`.
- Skill guidance tells the model to craft a `bootstrapSeed`, but does not clearly enumerate every required field: `skills/blueprint-bootstrap/references/bootstrap-runtime-contract.md:229`.

Why it matters: the first persistent write is blocked until the model satisfies hidden structured input requirements. This causes avoidable retries even when the intended Markdown artifacts are substantively good.

### High: Pre-bootstrap status returns conflicting routing signals 

One simulation observed that an uninitialized greenfield repo returned a correct top-level `nextAction` of `Run /blu-new-project`, while nested `bootstrap.recommendedNextAction` pointed to `Run /blu-progress`.

Evidence:
- Top-level uninitialized routing is set in `src/mcp/tools/project.ts:1381`.
- Bootstrap assessment fallback recommends progress in `src/mcp/tools/artifacts.ts:8484`.

Why it matters: an LLM following the nested field could route away from bootstrap even though `/blu-new-project` is the correct next action.

### Medium: Generic success-criterion validation causes wording retries (FIXME: remove validation for successCriterion completely, let us trust the llm to do right thing here, its too restrictive and too many things get tripped up here, make sure it is removed from schema validation and markdown verifier and any other place we validate this for this particular doc)

All simulations found the success-criteria gate useful in principle but somewhat aggressive in practice. Clear throwaway text like `Complete phase.` should fail, but one realistic contract-adjacent sentence, `Keep requirement IDs traceable into later roadmap artifacts.`, also failed as generic.

Evidence:
- Generic success criterion patterns live in `src/mcp/tools/project.ts:458`.
- Preflight diagnostics report `seed_success_criterion_generic` from `src/mcp/tools/project.ts:502`.

Why it matters: this can force ceremonial rewrites where the underlying project plan is not materially improved, only restated in more concrete wording.

### Medium: Post-failure artifact validation is not actionable for preflight failures

When `blueprint_project_init` rejected the first write, subsequent `blueprint_artifact_validate` only reported missing `.blueprint/` workflow artifacts. It did not carry forward the seed-specific diagnostics that explain how to repair the next attempt.

Observed response:
- `Missing .blueprint/ workflow artifacts.`

Evidence:
- Missing-core validation behavior starts in `src/mcp/tools/artifacts.ts:9638`.

Why it matters: the documented rhythm encourages validation after save attempts, but after a preflight rejection the validator adds no useful repair signal. The useful diagnostics are only in the failed `blueprint_project_init` response.

### Medium: Committed requirements must map to exactly one phase

One realistic seed mapped `RQ-01` to two phases and failed with:

`Committed requirement RQ-01 must be mapped to exactly one roadmap phase before the first write; found 2.`

Evidence:
- Requirement coverage preflight diagnostics are in `src/mcp/tools/project.ts:502`.

Why it matters: the rule is actionable and may be a valid product choice, but it is a strong constraint for early roadmap drafting. LLMs can naturally map a broad requirement to discovery and implementation phases, so this rule is a likely retry driver.

### Medium: Duplicate phase requirement refs are silently normalized (FIXME:)

One probe passed `requirementIds: ["CI-01", "CI-02", "CI-02"]`. The save succeeded and post-write validation passed even though there is a diagnostic intended for duplicate phase requirement refs.

Evidence:
- Duplicate requirement ref diagnostic exists in `src/mcp/tools/project.ts:581`.
- Default seed construction de-duplicates IDs before that diagnostic can fire: `src/mcp/tools/artifacts.ts:897`.

Why it matters: this is contract/runtime drift. Either duplicates should be accepted and normalized intentionally, or the preflight diagnostic should run before normalization.

### Medium: `bootstrap.requirements` contract and runtime differ on conditional sections (FIXME:)

The contract language expects substantive committed, deferred, and out-of-scope sections, while runtime/test coverage accepts committed-only bootstrap and omits deferred/out-of-scope sections.

Evidence:
- Contract text: `src/mcp/artifact-contracts/index.ts:3750`.
- Committed-only runtime acceptance is covered in `tests/new-project.test.ts:1129`.

Why it matters: this mismatch can make models overproduce placeholder deferred/out-of-scope content to satisfy a contract that the runtime does not actually require.

### Low: Overlapping diagnostics add noise

One invalid seed produced both success-criteria count and generic-criterion messages for the same phase. Both were true, but the generic check is not useful until the count issue is repaired.

Evidence:
- Count and generic criterion diagnostics come from the same preflight pass in `src/mcp/tools/project.ts:502`.

Why it matters: this is not blocking, but it increases the amount of failure text a model must triage in the first retry.

### Low: Roadmap contract mixes schema-first and Markdown-template signals

The roadmap contract has schema-first guidance but also exposes rendered Markdown template headings such as `## Phase Details`, which are not all required headings.

Evidence:
- Roadmap contract definition: `src/mcp/artifact-contracts/index.ts:3775`.
- Required headings are defined around `src/mcp/artifact-contracts/index.ts:3783`.
- Model contract handling was observed around `src/mcp/artifact-contracts/index.ts:343`.

Why it matters: it did not break these simulations, but it increases authoring ambiguity.

### Low: `bootstrap.roadmap` model contract lacks a visible id

One simulation observed `readArtifactContract("bootstrap.roadmap")` returning a model contract with `modelContract.id` undefined.

Evidence:
- Contract projection path: `src/mcp/artifact-contracts/index.ts:5173`.

Why it matters: this is minor, but it can make model-contract diagnostics harder to reference if schema validation fails.

## Deduplication Notes

The three agents independently reproduced the same core theme: `blueprint_project_init` invalid responses are generally actionable, but the first-write seed requirements are more exact than the visible authoring contract makes obvious. Findings about missing explicit `requirementIds`, missing/weak `successCriteria`, over-mapped requirements, and generic wording were merged into the seed-shape and success-criterion findings above.

The post-write path was stable once the seed passed preflight: all successful simulations produced valid artifacts and correct routing to `/blu-discuss-phase 1`.
