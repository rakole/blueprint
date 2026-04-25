# `/blu-insert-phase` Runtime Contract

This reference is the rich behavior contract for `/blu-insert-phase`. The
command manifest should stay thin, the skill should load this file for
insert-phase runs, and all persistent state changes must stay on the Blueprint
MCP tools.

## Stage Mapping

### Resolve

- Require exactly two user-facing inputs before mutation: an existing integer
  phase number in `after` and a non-empty phase description.
- If either input is missing, stop with concise usage guidance:
  `/blu-insert-phase <afterPhaseNumber> <description>`.
- Reject decimal-looking anchors such as `2.1`, `2.0`, or `02.0`. An insertion
  anchor must be an existing integer phase.
- Treat `/blu-insert-phase` as an urgent roadmap-admin insertion, not as a
  planning, execution, code mutation, or bootstrap path.

### Read

- Call `mcp_blueprint_blueprint_roadmap_read` before any mutation.
- Use the returned `milestone`, `phases`, `warnings`, and recovery signals as
  the live roadmap baseline.
- If the roadmap is missing, malformed, or drifted beyond safe insertion, stop
  and report the returned recovery guidance instead of mutating the roadmap.
- Preview the target phase group from the read result: the integer anchor plus
  any existing decimal insertions already under that base phase.
- Do not precompute the final decimal suffix as persistence truth. The read
  result supports the user preview, but the insert MCP tool remains
  authoritative for the committed phase number.

### Decide

- Preview the requested anchor, the exact description, the active milestone,
  the next decimal candidate implied by the roadmap read, and the fact that
  later phases and dependency references will not be renumbered automatically.
- Use Gemini CLI `ask_user` for the confirmation gate before any mutation when
  available.
- Keep the waiting state explicit as `phase-insert-confirmation`.
- The confirmation question must ask whether to insert that exact urgent phase
  after the exact integer anchor, not whether to generally continue roadmap
  work.
- If the user declines, stop without mutation and route to `/blu-progress`.

### Execute

- Call `mcp_blueprint_blueprint_roadmap_insert_phase` only after confirmation.
- Pass only the confirmed integer `after` anchor and the confirmed
  `description`.
- Treat returned `afterPhaseNumber`, `phaseNumber`, `phasePrefix`, `phaseName`,
  `slug`, `phaseDir`, `roadmapPath`, `milestone`, `written`, and `warnings` as
  authoritative.
- Do not hand-build decimal numbers, slugs, phase directories, roadmap list
  lines, or Phase Details blocks from prompt logic.
- If the tool reports an invalid insertion anchor or conflicting decimal
  directory, surface the condition as `invalid-insertion-anchor` or
  `conflicting-decimal-directory` and stop for recovery instead of retrying with
  guessed paths.

### Persist

- Scaffold exactly `${phaseDir}/${phasePrefix}-CONTEXT.md` through
  `mcp_blueprint_blueprint_artifact_scaffold`.
- Treat `createdFiles`, `reusedFiles`, and scaffold warnings as authoritative.
- The inserted context file is starter scaffold only. `/blu-insert-phase` must
  not fill or finalize `XX-CONTEXT.md`.
- The `phase.context` artifact contract remains the schema and heading
  authority for the downstream `/blu-discuss-phase` authoring step. Do not copy
  or fork the context template inside this command.
- Update state through `mcp_blueprint_blueprint_state_update` after the roadmap
  insertion and scaffold are settled. Set the inserted decimal phase as current,
  set `/blu-insert-phase` as the active command, append a durable
  `roadmapEvolutionNotes` entry that records the urgent insertion after the
  integer anchor, and set the next safe implemented action to
  `/blu-discuss-phase <phase>`.

### Validate

- Confirm `mcp_blueprint_blueprint_roadmap_insert_phase` returned `written:
  true`.
- Confirm the scaffold result includes the returned context path in either
  `createdFiles` or `reusedFiles`.
- Confirm the state update reports the current phase and next action fields
  requested by the command.
- If any MCP write fails or returns validation warnings, report the exact
  successful and failed steps separately.
- Never manually rewrite `.blueprint/ROADMAP.md`, `.blueprint/STATE.md`, or the
  phase directory to repair a failed MCP call.

### Route

- End with the inserted decimal phase number, anchor phase, description,
  scaffold path, roadmap/state paths when returned, warnings or reuse notes,
  and the next safe implemented command: `/blu-discuss-phase <phase>`.
- Include a brief dependency-review note: downstream phases were not renumbered
  or rewritten, so the user may need to inspect later dependency assumptions.
- Do not route to planned-only commands or directly to planning/execution
  shortcuts.

## Required MCP Calls

- `mcp_blueprint_blueprint_roadmap_read`: controls roadmap availability, active
  milestone, current phase inventory, recovery guidance, and the preview of the
  anchor's existing decimal group.
- `mcp_blueprint_blueprint_roadmap_insert_phase`: controls the insertion
  mutation, integer-anchor enforcement, decimal suffix selection, canonical
  phase metadata, roadmap path, and roadmap warnings.
- `mcp_blueprint_blueprint_artifact_scaffold`: controls creation or reuse of the
  initial `${phaseDir}/${phasePrefix}-CONTEXT.md` scaffold.
- `mcp_blueprint_blueprint_state_update`: controls the final current phase,
  active command, durable `roadmapEvolutionNotes` entry, and next implemented
  route.

## Artifact Authoring Rules

- `/blu-insert-phase` creates or reuses scaffold only. It does not author final
  phase context, research, plans, summaries, validation, UAT, or reports.
- Do not treat scaffold text as evidence, completed discovery, or user-approved
  scope.
- Do not add insert-phase-specific reports under `.blueprint/reports/`.
- If the user supplies rich phase intent in the description, keep it in the
  roadmap title and state evolution note only; route fuller scope capture to
  `/blu-discuss-phase <phase>`.

## No-Subagent Fallback

`/blu-insert-phase` is skill-led and does not require subagents. The parent
command must complete the workflow directly from the MCP read and write results.

Do not use `blueprint-roadmapper`, `blueprint-verifier`, browser, web-search-only,
shell-only, or generic agents as substitutes for roadmap-admin insertion
analysis. If a future Blueprint-native optional agent path is introduced, it
must be capability-gated, read-only before the confirmation gate, and the parent
command must still own all MCP calls.

## Retry And Repair Behavior

- Missing inputs: stop with usage guidance and no mutation.
- Decimal or malformed anchor: stop with `invalid-insertion-anchor` guidance and
  no mutation.
- Missing target integer phase: report the invalid anchor and show valid roadmap
  phase candidates when available.
- Roadmap read warning or recovery: stop with returned recovery guidance and
  route to `/blu-health` or `/blu-progress` only when those commands are
  implemented in the catalog.
- Conflicting decimal directory: stop with `conflicting-decimal-directory`, name
  the conflicting path when returned, and ask the user to repair drift before
  retrying.
- Scaffold failure: report the exact failed context path and stop; do not write
  the context file by hand.
- State update failure: report the roadmap insertion and scaffold as completed
  if they succeeded, report the state-update failure, and route to
  `/blu-progress` for recovery. Do not rewrite `STATE.md` manually.

## Output Quality Criteria

- The user can see exactly which urgent phase was inserted, after which anchor,
  and why later phases were left untouched.
- The result distinguishes roadmap insertion, context scaffold creation or
  reuse, and state update.
- Warnings, drift, and uncertainty are reported instead of hidden.
- The scaffold path is the returned `${phaseDir}/${phasePrefix}-CONTEXT.md`
  path, not a hand-built or guessed path.
- The `roadmapEvolutionNotes` entry is mentioned so the user knows the urgent
  insertion is durable outside chat history.
- The user is clearly routed to `/blu-discuss-phase <phase>` so the scaffold
  becomes real phase context before planning.

## Completion Criteria

- `mcp_blueprint_blueprint_roadmap_read` completed and the integer anchor group
  was previewed from its result.
- The exact integer anchor and description were confirmed with `ask_user` when
  available.
- `mcp_blueprint_blueprint_roadmap_insert_phase` succeeded and returned
  `written: true`.
- `${phaseDir}/${phasePrefix}-CONTEXT.md` was created or reused through
  `mcp_blueprint_blueprint_artifact_scaffold`.
- `mcp_blueprint_blueprint_state_update` recorded the inserted decimal phase,
  durable roadmap evolution note, and `/blu-discuss-phase <phase>` route.
- No public command surface, catalog status semantics, hook ownership,
  installed-extension files, or `.planning/` runtime dependency changed.
