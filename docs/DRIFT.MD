# Blueprint Drift Ledger

## Checkpoint: Phase 2.2 future-contract drift repair

State: closed on 2026-04-11

## Purpose

Capture the closed drift-repair checkpoint that repaired discovery parity gaps,
locked the runtime status vocabulary, and kept later documented commands from
becoming routable before their manifest, primary skill, and MCP substrate all
ship together.

## Status Vocabulary

- `implemented`: manifest, primary skill, and required MCP tools are all present
- `repairing`: partially shipped and under active drift repair
- `blocked`: not safe to expose because required runtime pieces are missing
- `planned`: documented but not yet shipped

## Closed Drift Set

This ledger tracks `DRIFT-01` through `DRIFT-07`.

- `DRIFT-01`: restore implementation-aware routing so `/blu`, `/blu:help`, and
  `/blu:progress` surface only implemented commands
- `DRIFT-02`: repair bootstrap and mapping docs so Wave 0 matches the live
  Gemini extension runtime
- `DRIFT-03`: repair discovery parity gaps and lock the current Phase 3 command
  surface
- `DRIFT-04`: restore lifecycle artifact ownership for planning, execution, and
  validation
- `DRIFT-05`: restore governance handoff and resume ownership on MCP-backed
  state
- `DRIFT-06`: repair future-command ownership metadata so `next`, `do`,
  `pause-work`, `resume-work`, and `plan-milestone-gaps` stay assigned to the
  right primary skills
- `DRIFT-07`: keep later documented commands blocked until their runtime
  manifest, skill, and required MCP tools truly exist

## Outcome

- the checkpoint repairs discovery parity gaps without reopening locked
  architecture decisions
- runtime routing remains limited to implemented commands
- later commands stay documented but non-routable until their actual runtime
  substrate ships
- future-command ownership must stay aligned across
  `docs/COMMAND-CATALOG.md`, `docs/SKILLS-AND-AGENTS.md`,
  `docs/GSD-RUNTIME-MIGRATION.md`, and `docs/commands/*.md`
