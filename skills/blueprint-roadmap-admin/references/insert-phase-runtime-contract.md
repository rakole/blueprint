# `/blu-insert-phase` Runtime Contract

This reference is the rich behavior contract for `/blu-insert-phase`. The
command manifest should stay thin, the skill should load this file for
insert-phase runs, and all persistent state changes must stay on the Blueprint
MCP tools.

## Stage Mapping

### Resolve

- Require an existing integer phase number in `after`, a non-empty phase
  description, a concrete roadmap objective, 2-5 observable success criteria,
  and at least one confirmed durable requirement ID declared in
  `.blueprint/REQUIREMENTS.md` before mutation.
- If either input is missing, stop with concise usage guidance:
  `/blu-insert-phase <afterPhaseNumber> <description>`.
- Reject decimal-looking anchors such as `2.1`, `2.0`, or `02.0`. An insertion
  anchor must be an existing integer phase.
- Treat `/blu-insert-phase` as an urgent roadmap-admin insertion, not as a
  planning, execution, code mutation, or bootstrap path.
- Do not accept `none yet`, placeholder text, blank values, or IDs that are not
  declared in `.blueprint/REQUIREMENTS.md` as requirement mappings.

### Read

- Call `mcp_blueprint_blueprint_roadmap_read` before any mutation.
- Use the returned `milestone`, `phases`, `warnings`, and recovery signals as
  the live roadmap baseline.
- If the roadmap is missing, malformed, or drifted beyond safe insertion, stop
  and report the returned recovery guidance instead of mutating the roadmap.
- Preview the target phase group from the read result: the integer anchor plus
  any existing decimal insertions already under that base phase.
- Capture the durable requirement IDs declared in `.blueprint/REQUIREMENTS.md`
  that ground the urgent decimal insertion. Requirement IDs are mandatory for
  inserted phases and must not be omitted or replaced with `none yet`.
- Treat requirement IDs that are already mapped to another roadmap phase as
  invalid for insertion. Inserted phases need their own traceability mapping
  before mutation.
- Do not precompute the final decimal suffix as persistence truth. The read
  result supports the user preview, but the insert MCP tool remains
  authoritative for the committed phase number.

### Decide

- Preview the requested anchor, the exact description, the active milestone,
  the next decimal candidate implied by the roadmap read, the objective, the
  success criteria, confirmed durable requirement IDs from
  `.blueprint/REQUIREMENTS.md`, and the fact that later phases and dependency
  references will not be renumbered automatically.
- Use Gemini CLI `ask_user` for the confirmation gate before any mutation when
  available.
- Keep the waiting state explicit as `phase-insert-confirmation`.
- The confirmation question must ask whether to insert that exact urgent phase
  after the exact integer anchor, not whether to generally continue roadmap
  work.
- If the user declines, stop without mutation and route to `/blu-progress`.

### Execute

- Call `mcp_blueprint_blueprint_roadmap_insert_phase` only after confirmation.
- Pass the confirmed integer `after` anchor, confirmed `description`, confirmed
  `goal`, confirmed `successCriteria`, and confirmed durable `requirementIds`
  declared in `.blueprint/REQUIREMENTS.md`.
- Require requirement validation before mutation: the confirmed IDs must be
  declared in `.blueprint/REQUIREMENTS.md`, must not be `none yet` or
  placeholders, and must not already be mapped to another roadmap phase.
- Treat returned `afterPhaseNumber`, `phaseNumber`, `phasePrefix`, `phaseName`,
  `slug`, `phaseDir`, `roadmapPath`, `milestone`, `written`, and `warnings` as
  authoritative.
- The tool owns both the ROADMAP mutation and the `.blueprint/REQUIREMENTS.md`
  traceability note update for those confirmed IDs; do not hand-edit either
  artifact around the tool call.
- Do not hand-build decimal numbers, slugs, phase directories, roadmap list
  lines, or Phase Details blocks from prompt logic. The tool writes concrete
  roadmap intent and creates `## Phase Details` only when needed by the existing
  ROADMAP shape.
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
- Confirm requirement validation accepted the submitted `requirementIds` as
  declared, non-placeholder rows that were not already mapped to another
  roadmap phase.
- Confirm the scaffold result includes the returned context path in either
  `createdFiles` or `reusedFiles`.
- Confirm the state update reports the current phase and next action fields
  requested by the command.
- If any MCP write fails or returns validation warnings, report the exact
  successful and failed steps separately.
- Never manually rewrite `.blueprint/ROADMAP.md`, `.blueprint/REQUIREMENTS.md`,
  `.blueprint/STATE.md`, or the phase directory to repair a failed MCP call.

### Route

- End with the inserted decimal phase number, anchor phase, description,
  scaffold path, roadmap/state paths when returned, warnings or reuse notes,
  and the next safe implemented command: `/blu-discuss-phase <phase>`.
- Before that route instruction, include a compact starter handoff block for
  `/blu-discuss-phase` with the decimal phase number and title, anchor phase,
  declared requirement IDs, the no-renumbering and dependency-review note, the
  roadmap evolution note summary, and the open risks plus dependency questions
  that still need discuss-phase review.
- Keep the handoff compact starter seed only. Do not treat it as final
  `XX-CONTEXT.md`, and do not route directly to `/blu-plan-phase` or
  `/blu-execute-phase`.
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
  phase metadata, `.blueprint/REQUIREMENTS.md` traceability mapping, roadmap
  path, and roadmap warnings.
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
This is already the parity path: the same roadmap-read, anchor-confirmation,
and MCP-write quality applies with no isolated subagent unit to offload.

Do not use `blueprint-roadmapper`, `blueprint-verifier`, browser, web-search-only,
shell-only, or generic agents as substitutes for roadmap-admin insertion
analysis. If a future Blueprint-native optional agent path is introduced, it
must be capability-gated, read-only before the confirmation gate, and the parent
command must still own all MCP calls.

## Retry And Repair Behavior

- Missing inputs: stop with usage guidance and no mutation.
- Missing objective or success criteria: ask for concrete roadmap intent and
  retry with `goal` plus 2-5 item `successCriteria`.
- Missing durable requirement IDs, `none yet` mappings, placeholder mappings,
  blank mappings, or undeclared IDs: ask for confirmed requirement IDs from
  `.blueprint/REQUIREMENTS.md` and do not mutate until they are supplied.
- Requirement IDs already mapped to another roadmap phase: stop without
  mutation, surface the conflicting phase mapping, and ask for requirement IDs
  that are declared but not already assigned elsewhere.
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
  which roadmap objective, success criteria, and durable requirement IDs were
  recorded, and why later phases were left untouched.
- The result distinguishes roadmap insertion, context scaffold creation or
  reuse, and state update.
- The user can see the compact starter handoff fields that discuss-phase should
  carry forward instead of starting cold.
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
- The objective and 2-5 success criteria were confirmed and passed as `goal`
  and `successCriteria`.
- At least one durable requirement ID from `.blueprint/REQUIREMENTS.md` was
  confirmed and passed as `requirementIds`; `none yet` requirement mappings were
  not accepted.
- Requirement validation rejected IDs already mapped to another roadmap phase,
  so inserted-phase traceability stayed unique before mutation.
- `mcp_blueprint_blueprint_roadmap_insert_phase` succeeded and returned
  `written: true`.
- `${phaseDir}/${phasePrefix}-CONTEXT.md` was created or reused through
  `mcp_blueprint_blueprint_artifact_scaffold`.
- `mcp_blueprint_blueprint_state_update` recorded the inserted decimal phase,
  durable roadmap evolution note, and `/blu-discuss-phase <phase>` route.
- No public command surface, catalog status semantics, hook ownership,
  installed-extension files, or `.planning/` runtime dependency changed.
