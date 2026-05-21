# `/blu-spec-phase` Runtime Contract

Use `/blu-spec-phase` to clarify what a phase should deliver before
`/blu-discuss-phase` moves into implementation decisions. The command runs a
Blueprint-native Socratic requirements loop, scores ambiguity quantitatively,
and produces a phase-scoped `XX-SPEC.md` only through the shared phase artifact
substrate.

## Purpose

- Lock falsifiable phase requirements in a Blueprint-native `XX-SPEC.md`.
- Clarify what and why without drifting into how to implement.
- Give downstream commands a durable requirements artifact that narrows later
  planning and discussion work.

## Ambiguity Model

Score each dimension from `0.00` to `1.00`:

- `goal`: how specific and measurable the outcome is
- `boundary`: how clearly in-scope and out-of-scope work are separated
- `constraint`: how clearly technical, workflow, dependency, or safety limits
  are defined
- `acceptance`: how clearly pass/fail completion checks are defined

Use this formula exactly:

`ambiguity = 1 - (0.35 * goal + 0.25 * boundary + 0.20 * constraint + 0.20 * acceptance)`

Write readiness requires all of these gates:

- `ambiguity <= 0.20`
- `goal >= 0.75`
- `boundary >= 0.70`
- `constraint >= 0.65`
- `acceptance >= 0.70`

If the overall ambiguity gate passes but one or more dimension minimums fail,
the command must treat the phase as not yet clear enough to write unless the
user explicitly chooses to write with gaps or `--auto` reaches its forced-write
path after the interview cap.

## Interview Perspectives

Use these perspectives in order so each round closes a different kind of gap:

- `Researcher`: ground the conversation in current repo and workflow reality
- `Researcher + Simplifier`: isolate the irreducible core and strip away nice
  to haves
- `Boundary Keeper`: lock in-scope and out-of-scope edges
- `Failure Analyst`: find requirement gaps that would create incorrect or
  unverifiable output
- `Seed Closer`: close the remaining lowest-scoring dimensions and lock final
  decisions

## Resolve

1. Resolve the selected phase through `blueprint_phase_context`.
2. Use `blueprint_phase_locate` only if the selected-phase packet is incomplete
   or phase recovery is required.
3. Read the phase packet, roadmap entry, requirements, state, artifact
   inventory, effective config, any existing spec artifact, and the live
   `phase.spec` contract before drafting.
4. If required spec behavior depends on a tool or schema outside the command's
   Blueprint MCP allowlist, stop and report the blocker instead of inventing a
   side channel.

## Existing Spec Gate

Check whether a phase-local `XX-SPEC.md` already exists.

- `--auto`: choose update immediately and log `[auto] SPEC.md exists - updating.`
- Interactive mode: ask the user to choose `Update`, `View`, or `Skip`
- `View`: show the current spec, then ask again whether to `Update` or `Skip`
- `Skip`: exit without writing and route to `/blu-discuss-phase <phase>` or
  `/blu-progress`
- `Update`: load the existing spec and continue through the workflow

When structured choices are not suitable, `--text` must present the same
decisions as plain numbered prompts.

## Codebase Scout

Ground the first round before asking questions, but keep the scout narrow.

- Prefer `phase_context.codebase` summaries first.
- Use targeted repo search only when the phase packet does not answer a needed
  question.
- Read only the minimum repo evidence needed to ask precise questions.
- Do not broad-read the repository before the first question.

The scout should produce an internal baseline for current state, missing
behavior, and likely scope edges without turning into a full repo audit.

## First Ambiguity Assessment

Before asking the first round of questions, score the phase using only the
resolved Blueprint context:

- roadmap phase intent
- requirements
- saved state and prior artifacts
- existing spec, if present
- narrow codebase scout evidence

Display all four dimension scores plus the computed ambiguity score.

If `--auto` starts with all gates already satisfied, skip the interview and log
that the existing context was sufficient to generate `SPEC.md`.

## Socratic Interview Loop

- Run at most six rounds before the forced-write or stop decision.
- Ask `2-3` questions per round.
- Use these rounds in order:
  - Round 1: `Researcher`
  - Round 2: `Researcher + Simplifier`
  - Round 3: `Boundary Keeper`
  - Round 4: `Failure Analyst`
  - Rounds 5-6: `Seed Closer`, focused on the lowest-scoring dimensions
- After each round:
  - rescore `goal`, `boundary`, `constraint`, and `acceptance`
  - recompute ambiguity
  - show the updated scores and whether each minimum is met

When the gates pass:

- Interactive mode: ask whether to write now or take one more round
- `--auto`: do not ask; proceed with the recommended write path

When six rounds finish without passing the gates:

- Interactive mode: ask whether to write with flagged gaps, continue talking,
  or exit without writing
- `--auto`: do not ask; write the spec and mark unresolved dimensions in the
  Ambiguity Report

Throughout `--auto`:

- never call `ask_user`
- record auto-selected decisions in the Interview Log
- record unresolved dimensions in the Ambiguity Report when any remain below
  minimum

Throughout `--text`:

- use plain numbered prompts when structured choices are not suitable
- preserve the same decision branches as interactive mode

## SPEC.md Generation

Generate a Blueprint-native spec that matches the live `phase.spec` contract.

Required structure:

- H1 phase title
- `Created`
- `Ambiguity score`
- `Requirements locked`
- `Goal`
- `Background`
- `Requirements`
- `Boundaries`
- `Constraints`
- `Acceptance Criteria`
- `Ambiguity Report`
- `Interview Log`

Every requirement must include:

- `Current`
- `Target`
- `Acceptance`

Additional generation rules:

- keep requirements specific, testable, and falsifiable
- keep `In scope` and `Out of scope` as explicit lists
- make acceptance criteria pass/fail checkbox bullets
- keep unresolved dimensions visible in `Ambiguity Report`
- keep the artifact Blueprint-native and phase-scoped

## Persistence

- Persist only through `blueprint_phase_artifact_write` with `artifact: "spec"`.
- Do not write raw files under `.blueprint/`.
- Do not write through prompt-local scratch output.
- Do not commit as part of this command.
- Use the live `phase.spec` contract as the validation authority for structure
  and placeholder removal.

## Route

After a successful write, update state only through Blueprint MCP state tools
so the current phase, active command, and next safe action stay in sync.

Routing rules:

- prove the next command through `blueprint_command_catalog`
- prefer `/blu-discuss-phase <phase>` when it is implemented and safe
- fall back to `/blu-progress` when the intended next action is missing,
  blocked, or not provably implemented
- if the user skipped an existing spec update, exit without writing and still
  return the next safe implemented action

## Critical Rules

- Use only the Blueprint MCP allowlist available to this command.
- Keep all behavior Blueprint-native; do not reference non-Blueprint workflow
  systems or toolchains.
- Do not ask how to implement; that belongs to `/blu-discuss-phase`.
- Do not broad-read the repo before the first question.
- Keep questions grounded, narrow, and tied to the current lowest-confidence
  dimensions.
- Never write when the user explicitly exits without writing.
- Never invent a persistence path, commit step, or routing result that was not
  proven through the shared Blueprint tools.

## Success Criteria

- The phase resolves from Blueprint context without relying on side channels.
- The initial scout is grounded but narrow.
- All four ambiguity dimensions are scored before writing and after each round.
- The interview uses the required perspectives and does not exceed six rounds
  before the forced decision point.
- `SPEC.md` matches the live `phase.spec` contract and contains only falsifiable
  requirements.
- Persistence happens only through `blueprint_phase_artifact_write`.
- The final recommendation points to the next safe implemented action proven by
  `blueprint_command_catalog`.

## Completion Receipt

End with a concise receipt that reports:

- phase
- artifact path
- ambiguity score
- locked requirement count
- unresolved dimensions
- state/routing status
- next safe implemented action
