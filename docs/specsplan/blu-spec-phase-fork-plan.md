# `/blu-spec-phase` Fork Plan

## Purpose

This plan describes how to fork GSD's `spec-phase` command into Blueprint as
`/blu-spec-phase`.

The intent is deliberately different from most earlier Blueprint migrations.
For this command, the first implementation should import the GSD command,
workflow, and template almost as-is, then translate only the runtime surface:
names, paths, host syntax, and lifecycle integration. It should not turn
`SPEC.md` into a heavy schema-first MCP artifact. The experiment is to preserve
the GSD-style Socratic flow and Markdown template while making it safe and
useful inside Blueprint.

## Source Material

Import from upstream GSD:

- `commands/gsd/spec-phase.md`
- `get-shit-done/workflows/spec-phase.md`
- `get-shit-done/templates/spec.md`

Also inspect the directly related GSD downstream surfaces:

- `get-shit-done/workflows/discuss-phase.md`
- `get-shit-done/workflows/discuss-phase/templates/context.md`

Those downstream files matter because GSD's `spec-phase` is only useful when
`discuss-phase` sees `SPEC.md`, counts locked requirements, excludes
`AI-SPEC.md`, and treats requirements, boundaries, and acceptance criteria as
locked input.

## Product Decision

Add `/blu-spec-phase` as an optional pre-discussion command that becomes
authoritative when present.

The lifecycle shape becomes:

```text
/blu-spec-phase <phase>     optional ambiguity/requirements gate
/blu-discuss-phase <phase>  required phase context and implementation decisions
/blu-research-phase <phase> config-gated implementation research
/blu-ui-phase <phase>       config-gated UI contract or skip rationale
/blu-plan-phase <phase>     execution-ready plans
```

`SPEC.md` owns WHAT, WHY, boundaries, constraints, and pass/fail acceptance
criteria. `CONTEXT.md` still owns implementation decisions, tradeoffs, reuse,
risks, and downstream handoff. `RESEARCH.md` still owns technical evidence,
dependency/tool evaluation, and planner-ready recommendations. `PLAN.md` still
owns execution tasks and requirement coverage.

Do not make `/blu-spec-phase` mandatory for every phase. Instead:

- If `XX-SPEC.md` exists, downstream commands must read it and treat it as
  upstream intent.
- If a phase is vague and no `XX-SPEC.md` exists, `/blu-discuss-phase`,
  `/blu-progress`, or `/blu-next` may recommend `/blu-spec-phase`.
- Missing `XX-SPEC.md` should not block `/blu-discuss-phase`,
  `/blu-research-phase`, or `/blu-plan-phase` by default.
- If later discovery shows the spec is wrong, route back to
  `/blu-spec-phase <phase>` update instead of silently overriding it in
  context, research, or plan.

## Non-Goals

- Do not create a strict JSON model schema for `phase.spec` in v1.
- Do not build new scoring MCP tools.
- Do not add a dedicated `blueprint_phase_spec_*` tool family in v1.
- Do not require `SPEC.md` for all phases.
- Do not make `SPEC.md` replace `XX-CONTEXT.md`.
- Do not port GSD's git commit step as command behavior.
- Do not import GSD's `.planning/` state model or `gsd-tools.cjs`.

## Desired User Experience

Example command:

```text
/blu-spec-phase 3
```

The command should:

1. Resolve the selected Blueprint phase.
2. Read the roadmap phase entry, requirements grounding, current state, saved
   codebase summaries, and targeted live repo evidence.
3. Check for existing `XX-SPEC.md`, excluding `AI-SPEC.md`.
4. If a spec exists, ask whether to view, update, or skip.
5. Score ambiguity across four dimensions.
6. Ask 2-3 focused questions per round, rotating GSD's perspectives.
7. Stop once the ambiguity gate passes, or when the user explicitly chooses to
   write despite gaps.
8. Write `.blueprint/phases/<phase>/<XX>-SPEC.md`.
9. Update `.blueprint/STATE.md` only enough to route next to
   `/blu-discuss-phase <phase>` or `/blu-progress`.

The workflow should preserve GSD's core scoring model:

```text
ambiguity = 1 - (0.35 * goal + 0.25 * boundary + 0.20 * constraint + 0.20 * acceptance)
```

Gate:

- ambiguity <= 0.20
- goal clarity >= 0.75
- boundary clarity >= 0.70
- constraint clarity >= 0.65
- acceptance criteria >= 0.70

## Imported Behavior To Preserve

Preserve these GSD behaviors closely:

- Codebase scout before asking the first question.
- Initial ambiguity assessment from roadmap and requirements only.
- Six normal interview rounds.
- 2-3 questions per round.
- Perspective rotation:
  - Researcher
  - Simplifier
  - Boundary Keeper
  - Failure Analyst
  - Seed Closer
- `--auto` mode that logs auto-selected decisions and unresolved dimensions.
- `--text` mode for plain numbered prompts when rich UI choices are unavailable.
- Existing-spec gate: update, view, or skip.
- Falsifiable requirements with Current, Target, and Acceptance fields.
- Explicit In Scope and Out Of Scope lists.
- Pass/fail checkbox acceptance criteria.
- Ambiguity Report.
- Interview Log.

Adapt these behaviors:

- `$gsd-spec-phase` becomes `/blu-spec-phase`.
- `$gsd-discuss-phase` becomes `/blu-discuss-phase`.
- `.planning/phases/...` becomes `.blueprint/phases/...`.
- `AskUserQuestion` becomes Gemini-native `ask_user` guidance.
- `Read`, `Write`, `Grep`, and `Bash` tool references become Blueprint/Gemini
  command wording.
- `gsd-tools.cjs init phase-op` becomes Blueprint phase resolution through
  existing MCP reads.
- GSD's "commit SPEC.md" step becomes "do not commit; report artifact path."

## Artifact Shape

Persist:

```text
.blueprint/phases/<phase-slug>/<XX>-SPEC.md
```

Use the imported GSD `spec.md` template as the starting template, with Blueprint
name/path changes only.

Recommended v1 headings:

```markdown
# Phase [X]: [Name] - Specification

**Created:** [date]
**Ambiguity score:** [score] (gate: <= 0.20)
**Requirements:** [N] locked

## Goal
## Background
## Requirements
## Boundaries
## Constraints
## Acceptance Criteria
## Ambiguity Report
## Interview Log
```

Do not add Blueprint locked markers in v1 unless the implementation needs them
for existing artifact scanners. The goal is a readable Markdown artifact with a
strong prompt contract, not a schema-rendered document.

## Minimal MCP Integration

Use existing MCP surfaces where possible. The v1 command can stay light if
Blueprint adds only one new artifact enum and a simple path mapping.

Required or likely needed:

- Extend phase artifact enum in `src/mcp/tools/phase.ts`:
  - add `spec` beside `context`, `discussion-log`, `research`, `ui-spec`
  - map `spec` to `XX-SPEC.md`
  - ensure `AI-SPEC.md` is not treated as the phase spec
- Let `blueprint_phase_artifact_read` read `artifact: "spec"`.
- Let `blueprint_phase_artifact_write` write `artifact: "spec"` as freehand
  Markdown content.
- Let `blueprint_phase_context` include `spec` in `phase.artifacts` when present.
- Let artifact inventory/listing surface `XX-SPEC.md`.
- Add a simple `phase.spec` artifact contract only if needed to provide a
  canonical authoring template. If added, keep it Markdown-first and warning
  light.

Avoid:

- model-only `phase.spec`
- `blueprint_phase_spec_validate_model`
- strict JSON schema validation
- new spec-specific MCP tool family
- checkpoint machinery unless v1 testing proves long runs need resumability

## Command And Skill Changes

### New Command Manifest

Add:

```text
commands/blu-spec-phase.toml
```

This should be a thin launcher, similar in spirit to GSD's command file:

- identity: `/blu-spec-phase`
- argument hint: `<phase> [--auto] [--text]`
- execution profile: `long-running-mutation`
- primary skill: `blueprint-phase-discovery`
- runtime contract: `skills/blueprint-phase-discovery/references/spec-phase-runtime-contract.md`
- allowed MCP tools:
  - `mcp_blueprint_blueprint_phase_locate`
  - `mcp_blueprint_blueprint_phase_context`
  - `mcp_blueprint_blueprint_roadmap_read`
  - `mcp_blueprint_blueprint_artifact_list`
  - `mcp_blueprint_blueprint_config_get`
  - `mcp_blueprint_blueprint_phase_artifact_read`
  - `mcp_blueprint_blueprint_phase_artifact_write`
  - `mcp_blueprint_blueprint_artifact_contract_read` if `phase.spec` exists
  - `mcp_blueprint_blueprint_state_load`
  - `mcp_blueprint_blueprint_state_update`
  - `mcp_blueprint_blueprint_command_catalog`

Use shell only for targeted repo scouting if existing Blueprint command policy
allows it. Prefer saved `.blueprint/codebase/` summaries plus scoped `rg`
searches.

### Skill Update

Update:

```text
skills/blueprint-phase-discovery/SKILL.md
```

Add `/blu-spec-phase` to:

- frontmatter `commands`
- `input_bundles.commands`
- execution profile list
- command-scoped MCP tool list
- workflow rules

Do not mix the full spec workflow into the shared skill body. Point to:

```text
skills/blueprint-phase-discovery/references/spec-phase-runtime-contract.md
```

### Runtime Contract

Add:

```text
skills/blueprint-phase-discovery/references/spec-phase-runtime-contract.md
```

Structure it as a direct Blueprint adaptation of GSD
`get-shit-done/workflows/spec-phase.md`.

Sections to include:

- Purpose
- Ambiguity Model
- Interview Perspectives
- Resolve
- Existing Spec Gate
- Codebase Scout
- First Ambiguity Assessment
- Socratic Interview Loop
- SPEC.md Generation
- Persistence
- Route
- Critical Rules
- Success Criteria

Keep the runtime contract prompt-first. It should teach the model how to
interview and score; it should not delegate the scoring to MCP.

### Template

Add either:

```text
skills/blueprint-phase-discovery/templates/spec.md
```

or, if this repo prefers reference colocation:

```text
skills/blueprint-phase-discovery/references/spec-template.md
```

Start from GSD `get-shit-done/templates/spec.md` and apply only Blueprint
renames and path changes.

## Downstream Workflow Changes

### `/blu-discuss-phase`

Discuss must make `XX-SPEC.md` useful. Without this, `/blu-spec-phase` becomes
ceremony.

Changes:

- Read `XX-SPEC.md` during the selected-phase read packet if present.
- Exclude `AI-SPEC.md` from phase-spec detection.
- Count locked numbered requirements for the opening posture.
- Treat `Goal`, `Requirements`, `Boundaries`, `Constraints`, and
  `Acceptance Criteria` as locked WHAT/WHY input.
- Stop asking generic "what should this phase deliver?" questions when the spec
  already answers them.
- Focus questions on implementation choices:
  - reuse
  - approach
  - tradeoffs
  - sequencing
  - safety posture
  - deferred ideas
  - research handoff
  - plan handoff
- Map spec substance into the existing `phase.context` model fields.
- Add a `spec basis` entry in the saved context using existing fields:
  - spec path
  - requirement count
  - ambiguity score
  - notable out-of-scope boundaries
  - unresolved below-minimum dimensions, if any
- If discussion reveals the spec is wrong, ask whether to route back to
  `/blu-spec-phase <phase>` update. Do not silently contradict the spec in
  `XX-CONTEXT.md`.
- Preserve current context ownership: `/blu-discuss-phase` remains the only
  owner of `XX-CONTEXT.md`.

Files:

- `commands/blu-discuss-phase.toml`
- `docs/commands/discuss-phase.md`
- `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md`
- `src/mcp/command-runtime-metadata.ts`
- tests covering spec-aware discuss behavior

### `/blu-research-phase`

Research should use `SPEC.md` as intent and constraint evidence, but should not
depend on it.

Changes:

- Read `XX-SPEC.md` when present after usable context is confirmed.
- Missing spec is nonblocking.
- If spec exists and context contradicts it, stop and route to
  `/blu-discuss-phase <phase>` or `/blu-spec-phase <phase>` update depending on
  which artifact is stale.
- Tie research strands to spec requirements and constraints when possible.
- For framework/library/service/tool choices, use the existing dependency/tool
  evaluation behavior and cite the spec requirement or constraint that made the
  choice planner-critical.
- Include spec path and requirement IDs/labels in the Recommendation Handoff
  when relevant.

Files:

- `commands/blu-research-phase.toml`
- `docs/commands/research-phase.md`
- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
- `src/mcp/command-runtime-metadata.ts`
- tests covering spec as optional research evidence

### `/blu-plan-phase`

Planning must account for `SPEC.md` when present, without making it a universal
hard gate.

Changes:

- Include `XX-SPEC.md` in `blueprint_phase_plan_readiness` evidence when
  present.
- Include spec in read-set freshness metadata so plan writes can detect stale
  spec evidence.
- Include spec excerpts or summaries in `blueprint_phase_plan_authoring_context`.
- Require plan investigation to mention whether spec requirements/boundaries
  were used.
- Require `evidenceCoverage` or equivalent plan metadata to account for
  `XX-SPEC.md` when present.
- Add warning diagnostics when a plan contradicts explicit out-of-scope spec
  boundaries.
- Do not allow spec to bypass missing/invalid context, research, or UI gates.

Files:

- `commands/blu-plan-phase.toml`
- `docs/commands/plan-phase.md`
- `skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md`
- `src/mcp/tools/phase.ts`
- `src/mcp/command-runtime-metadata.ts`
- planning tests for spec evidence and freshness

## Router And Catalog Changes

Add `spec-phase` to runtime catalog only after all implemented requirements are
true:

- `commands/blu-spec-phase.toml` exists
- primary skill includes `/blu-spec-phase`
- required MCP tools are registered
- docs/catalog entry exists
- runtime metadata exists if this command family requires source-owned metadata

Docs to update:

- `docs/COMMAND-CATALOG.md`
- `docs/IMPLEMENTATION-ORDER.md`
- `docs/PHASE-LIFECYCLE.md`
- `docs/RUNTIME-REFERENCE.md`
- `docs/MCP-TOOLS.md`
- `docs/commands/spec-phase.md`
- `docs/commands/discuss-phase.md`
- `docs/commands/research-phase.md`
- `docs/commands/plan-phase.md`

Routing guidance:

- `/blu-help` may list `/blu-spec-phase` after implemented.
- `/blu-progress` and `/blu-next` should recommend `/blu-spec-phase` only when:
  - the user asks for spec-first planning,
  - context is missing and the roadmap phase appears ambiguous, or
  - the saved spec is stale/contradictory and downstream commands cannot safely
    proceed.
- Missing spec should not make the normal lifecycle appear blocked.

## Implementation Waves

### Wave 0: Import Plan And Fixtures

Goal: preserve the GSD source before adapting it.

Tasks:

1. Copy GSD source files into a temporary implementation reference location,
   such as `docs/specsplan/imported-gsd/`, or cite them in the implementation
   plan if direct copy is not desired.
2. Identify all exact text replacements:
   - `$gsd-spec-phase` -> `/blu-spec-phase`
   - `$gsd-discuss-phase` -> `/blu-discuss-phase`
   - `.planning` -> `.blueprint`
   - Claude/Copilot wording -> Gemini/Blueprint wording
   - `AskUserQuestion` -> `ask_user`
3. Decide final template location.
4. Confirm whether `phase.spec` artifact contract is needed for template reads.

Done when:

- Imported behavior is preserved in an auditable source note.
- No runtime behavior has changed yet.

### Wave 1: Command Skeleton

Goal: make `/blu-spec-phase` visible as a planned/implemented candidate without
changing downstream behavior.

Tasks:

1. Add `commands/blu-spec-phase.toml`.
2. Add `docs/commands/spec-phase.md`.
3. Add `spec-phase` command metadata.
4. Add `/blu-spec-phase` to `blueprint-phase-discovery` skill bundle.
5. Add `spec-phase-runtime-contract.md`.
6. Add spec template.
7. Keep catalog status non-routable until the artifact read/write path works.

Done when:

- command catalog tests prove it is not accidentally routable before substrate
  completion.

### Wave 2: Thin Artifact Support

Goal: support reading and writing `XX-SPEC.md` through existing phase artifact
tools.

Tasks:

1. Add `spec` to phase artifact read/write enums.
2. Map `spec` to `XX-SPEC.md`.
3. Ensure `AI-SPEC.md` is excluded from `spec` detection.
4. Add optional Markdown-first `phase.spec` contract only if needed for template
   access.
5. Add artifact inventory support.
6. Add `blueprint_phase_context.phase.artifacts.spec`.

Done when:

- `blueprint_phase_artifact_write({ artifact: "spec" })` writes Markdown
  content to the correct path.
- `blueprint_phase_artifact_read({ artifact: "spec" })` reads it.
- Missing spec is represented as optional/advisory.

### Wave 3: Spec Command Behavior

Goal: implement the actual GSD-like flow.

Tasks:

1. Adapt the GSD ambiguity model and interview loop into
   `spec-phase-runtime-contract.md`.
2. Teach existing spec view/update/skip behavior.
3. Teach codebase scouting with Blueprint evidence sources:
   - roadmap phase
   - requirements grounding
   - state
   - saved codebase summaries
   - scoped live repo search
4. Teach `--auto`.
5. Teach `--text`.
6. Persist final Markdown through phase artifact write.
7. Update state and route to `/blu-discuss-phase <phase>`.

Done when:

- a temp repo can run the modeled command path and produce a non-placeholder
  `XX-SPEC.md` with the imported template shape.

### Wave 4: Discuss Integration

Goal: make spec authoritative for downstream discovery.

Tasks:

1. Add spec read to discuss selected-phase read packet.
2. Add spec lock behavior to discuss runtime contract.
3. Map spec content into `phase.context` fields without adding new context
   schema fields unless needed.
4. Add contradiction handling: route back to spec update instead of overriding.
5. Add tests proving discuss does not re-ask WHAT/WHY already locked in spec.

Done when:

- `XX-CONTEXT.md` generated after a spec reflects spec requirements and
  boundaries.
- saved context still owns implementation decisions.

### Wave 5: Research And Plan Integration

Goal: ensure spec survives into technical research and executable plans.

Research tasks:

1. Read spec as optional evidence after context is usable.
2. Tie research strands and recommendations to spec requirements when relevant.
3. Preserve missing spec as nonblocking.

Planning tasks:

1. Include spec in readiness evidence/read-set when present.
2. Include spec in authoring context.
3. Require plan evidence coverage to account for spec when present.
4. Warn on explicit plan/spec boundary contradictions.

Done when:

- planning readiness includes spec in evidence when present.
- plan writes detect stale spec read-set changes.
- plans do not ignore a saved spec.

### Wave 6: Router, Docs, And Regression Closure

Goal: make `/blu-spec-phase` properly implemented and routable.

Tasks:

1. Flip catalog status to `implemented` only when manifest, skill, metadata, and
   MCP tool substrate are aligned.
2. Update lifecycle docs.
3. Update help/progress/next routing expectations.
4. Add end-to-end simulation docs or tests.
5. Run focused tests, then typecheck/build.

Done when:

- `/blu`, `/blu-help`, `/blu-progress`, and `/blu-next` surface spec only as an
  implemented command.
- missing spec does not block ordinary phases.
- present spec is never ignored by discuss/research/plan.

## Test Plan

Focused tests for later implementation:

- command catalog includes `spec-phase` only when implemented substrates exist.
- discovery skill metadata includes `/blu-spec-phase`.
- phase artifact read/write supports `spec`.
- `AI-SPEC.md` is not mistaken for `XX-SPEC.md`.
- existing spec view/update/skip flow is represented in command contract tests.
- generated spec has required headings and no template placeholders.
- discuss reads spec and folds locked requirements into context.
- discuss routes to spec update on contradiction.
- research reads spec as optional evidence, missing spec nonblocking.
- plan readiness includes spec in evidence/read-set when present.
- plan validation or authoring warnings catch plans that violate explicit
  out-of-scope spec boundaries.
- help/progress/next recommend spec only when implemented and appropriate.

Suggested focused commands after implementation:

```bash
npx tsx --test tests/command-catalog.test.ts
npx tsx --test tests/skill-metadata.test.ts
npx tsx --test tests/phase-discovery-tools.test.ts
npx tsx --test tests/phase-discovery-discuss.test.ts
npx tsx --test tests/phase-planning-tools.test.ts
npm run typecheck
npm run build
git diff --check
```

## Open Decisions

1. Should `phase.spec` be a formal artifact contract, or should the runtime
   contract point directly at a skill-local template file?
   - Recommendation: use a skill-local template first; add `phase.spec` only if
     existing MCP template reads are needed.

2. Should spec runs checkpoint progress?
   - Recommendation: no for v1. Preserve GSD behavior and keep the command
     simpler.

3. Should `/blu-discuss-phase` automatically route to `/blu-spec-phase` when
   phase ambiguity looks high?
   - Recommendation: recommend but do not hard-block in v1.

4. Should roadmap success criteria be rewritten from `SPEC.md`?
   - Recommendation: no. `SPEC.md` is phase-local clarification. Roadmap edits
     need a separate roadmap-admin path, eventually `/blu-edit-phase`.

5. Should `/blu-spec-phase --auto` be allowed?
   - Recommendation: yes, but require visible auto-decision notes in Interview
     Log and ambiguity report.

## Risks

- If downstream commands do not read `XX-SPEC.md`, the new command becomes
  ceremony.
- If spec becomes mandatory, it may slow down crisp phases.
- If spec gets heavy schema validation, it will no longer test the GSD-style
  lightweight workflow the user wants to try.
- If discuss silently contradicts spec, users lose trust in the artifact.
- If plan ignores spec boundaries, the false-confidence problem is worse than
  not having spec at all.

## Implementation Principle

Start with the GSD flow and resist over-Blueprinting it.

The minimum viable Blueprint adaptation is:

- command name and paths changed,
- Gemini-native prompt syntax,
- `.blueprint/` state boundaries,
- thin MCP-owned path-safe persistence,
- downstream commands always read spec when present,
- no heavy schema/model validation.

That is enough to learn whether the `spec-phase` product idea improves
Blueprint's lifecycle without prematurely turning it into another large
artifact subsystem.
