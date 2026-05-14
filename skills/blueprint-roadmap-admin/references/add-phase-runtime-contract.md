# `/blu-add-phase` Runtime Contract

This reference is the rich behavior contract for `/blu-add-phase`. The command
manifest should stay thin, the skill should load this file for add-phase runs,
and all persistent state changes must stay on the Blueprint MCP tools.

## Stage Mapping

### Resolve

- Require a non-empty phase description from the command arguments.
- If the description is missing, stop with concise usage guidance:
  `/blu-add-phase <description>`.
- Do not infer a title from chat history or roadmap gaps.
- Treat `/blu-add-phase` as a roadmap-admin workflow for initialized Blueprint
  projects, not as a `new-project` bootstrap path.

### Read

- Call `mcp_blueprint_blueprint_roadmap_read` before any mutation.
- Use the returned `milestone`, `phases`, `warnings`, and `recovery` as the
  live roadmap baseline.
- If the roadmap read returns warnings or recovery guidance that means the
  roadmap is missing, malformed, or drifted beyond safe append, stop and report
  the recovery guidance instead of appending.
- Derive the previewed next integer from the read result only: take the highest
  base phase number and ignore decimal suffixes such as `2.1` or `2.2`.
- Choose at least one durable requirement ID for the new whole-number phase.
  Plain add-phase appends must validate `requirementIds` against declared rows
  in `.blueprint/REQUIREMENTS.md` before mutation and must not proceed with
  empty requirement grounding. Keep audit-backed repair traceability separate
  through `auditBackedDetails.repairRequirementIds`.
- Capture a concrete roadmap objective and 2-5 observable success criteria for
  the new phase. Do not use `/blu-discuss-phase` placeholder wording as ROADMAP
  content.

### Decide

- Preview the exact computed phase number together with the exact description.
- Preview the durable requirement IDs, objective, and success criteria that will
  ground the new phase.
- Use Gemini CLI `ask_user` for the confirmation gate before any mutation.
- Keep the waiting state explicit as `phase-number-confirmation`.
- The confirmation question must ask whether to append that exact phase number
  and description with the selected requirement IDs, objective, and success
  criteria, not whether to generally continue roadmap work.
- If the user declines, stop without mutation and route to `/blu-progress`.

### Execute

- Call `mcp_blueprint_blueprint_roadmap_add_phase` only after confirmation.
- Pass the confirmed description and the confirmed phase number in
  `expectedPhaseNumber`.
- Pass the confirmed durable requirement IDs in `requirementIds`, the confirmed
  objective in `goal`, and the confirmed criteria in `successCriteria`. For
  audit-backed repair flows, preserve the existing
  `auditBackedDetails.repairRequirementIds` traceability path while still
  preserving concrete audit-backed goal and success criteria.
- Treat undeclared plain-append `requirementIds` as a no-write validation
  failure. Only the audit-backed repair path may carry repair IDs through
  `auditBackedDetails.repairRequirementIds`.
- Treat returned `phaseNumber`, `phasePrefix`, `phaseName`, `slug`, `phaseDir`,
  `roadmapPath`, `milestone`, and `warnings` as authoritative.
- Do not precompute slugs, directories, or artifact paths from prompt logic
  except for the follow-on scaffold path that uses returned metadata.

### Persist

- Scaffold exactly `${phaseDir}/${phasePrefix}-CONTEXT.md` through
  `mcp_blueprint_blueprint_artifact_scaffold`.
- Treat `createdFiles`, `reusedFiles`, and scaffold warnings as authoritative.
- Scaffold text is starter material only. Do not present it as finished phase
  context, and do not bypass `/blu-discuss-phase` by filling the context from
  the add-phase prompt.
- Update state through `mcp_blueprint_blueprint_state_update` after the roadmap
  append and scaffold are settled. Set the new phase as current, set
  `/blu-add-phase` as the active command, and set the next safe implemented
  action to `/blu-discuss-phase <phase>`.

### Validate

- Confirm the roadmap mutation returned `written: true`.
- Confirm plain-append requirement validation accepted the submitted
  `requirementIds` as declared `.blueprint/REQUIREMENTS.md` rows, or that the
  audit-backed repair path was used instead.
- Confirm the scaffold result includes the returned context path in either
  `createdFiles` or `reusedFiles`.
- If state update returns warnings, report them and keep the next safe action
  explicit.
- Never manually rewrite `.blueprint/ROADMAP.md`, `.blueprint/STATE.md`, or the
  phase directory to repair a failed MCP call.

### Route

- End with the new phase number and description, the scaffold path, warnings or
  reuse notes, and the next safe implemented command:
  `/blu-discuss-phase <phase>`.
- Do not route to planned-only commands or to `/blu-plan-phase` directly.

## Required MCP Calls

- `mcp_blueprint_blueprint_roadmap_read`: controls roadmap availability, active
  milestone, current phase inventory, recovery guidance, and the next integer
  preview.
- `mcp_blueprint_blueprint_roadmap_add_phase`: controls the append mutation,
  stale-confirmation guard, canonical phase metadata, roadmap path, and roadmap
  warnings.
- `mcp_blueprint_blueprint_artifact_scaffold`: controls creation or reuse of the
  initial `${phaseDir}/${phasePrefix}-CONTEXT.md` scaffold.
- `mcp_blueprint_blueprint_state_update`: controls the final current phase,
  active command, roadmap-evolution memory when included, and next implemented
  route.

## Numbering Rule

The next appended phase is the next integer after the highest base phase number
in the roadmap read result. Decimal suffixes are ignored when counting.

Examples:

- `1`, `2`, `3` -> next `4`
- `1`, `2.1`, `2.2` -> next `3`
- `1`, `2`, `2.1`, `4.1` -> next `5`

## Stale Confirmation

Use `expectedPhaseNumber` as the stale-confirmation guard. If
`blueprint_roadmap_add_phase` rejects because the live next phase no longer
matches the confirmed number, report `stale-phase-number`, re-read the roadmap,
show the new computed number, and ask for confirmation again before retrying.
Do not silently continue with the new number.

## No-Subagent Fallback

`/blu-add-phase` is skill-led and does not require subagents. The parent command
must complete the workflow directly from the MCP read and write results. This
is already the parity path: the same roadmap-read, confirmation, and MCP-write
quality applies with no isolated subagent unit to offload.

Do not use browser, web-search-only, shell-only, or generic agents as
substitutes for roadmap-admin analysis. If a future Blueprint-native optional
agent path is introduced, it must be capability-gated, read-only before the
confirmation gate, and the parent command must still own all MCP calls.

## Retry And Repair Behavior

- Missing description: stop with usage guidance and no mutation.
- Missing requirement IDs for a plain add: re-read the requirements source of
  truth, choose or ask the user to confirm at least one durable ID, and retry
  with `requirementIds`.
- Undeclared requirement IDs for a plain add: stop without mutation, ask for
  IDs already declared in `.blueprint/REQUIREMENTS.md`, or switch explicitly to
  an audit-backed repair flow that uses `auditBackedDetails.repairRequirementIds`.
- Missing objective or success criteria: re-read the roadmap context as needed,
  ask the user to confirm concrete values, and retry with `goal` plus 2-5 item
  `successCriteria`.
- Roadmap read warning or recovery: stop with the returned recovery guidance and
  route to `/blu-health` or `/blu-progress` only when those commands are
  implemented in the catalog.
- Stale phase number: re-read, re-preview, and re-confirm before retry.
- Scaffold failure: report the exact failed path and stop; do not write the
  context file by hand.
- State update failure: report the roadmap and scaffold as completed if they
  succeeded, report the state-update failure, and route the user to
  `/blu-progress` for recovery. Do not rewrite `STATE.md` manually.

## Output Quality Criteria

- The user can see exactly which phase was added and why that number was chosen.
- The user can see which requirement IDs ground the whole-number phase.
- The user can see the concrete roadmap objective and success criteria that will
  exist before `/blu-discuss-phase` authors full phase context.
- Decimal insertions ignored during numbering are called out when present.
- The result distinguishes roadmap append, scaffold creation or reuse, and
  state update.
- Warnings and uncertainty are reported instead of hidden.
- The scaffold path is the returned `${phaseDir}/${phasePrefix}-CONTEXT.md`
  path, not a hand-built or guessed path.
- The user is clearly routed to `/blu-discuss-phase <phase>` so the starter
  context becomes real phase context before planning.

## Completion Criteria

- `mcp_blueprint_blueprint_roadmap_read` completed and the next integer was
  previewed from its result.
- The exact phase number and description were confirmed with `ask_user`.
- The requirement IDs were confirmed as declared `.blueprint/REQUIREMENTS.md`
  rows and passed as `requirementIds` for plain add-phase, or the audit-backed
  repair path was used through `auditBackedDetails.repairRequirementIds`.
- The objective and 2-5 success criteria were confirmed and passed as `goal`
  and `successCriteria`.
- `mcp_blueprint_blueprint_roadmap_add_phase` succeeded with
  `expectedPhaseNumber`.
- `${phaseDir}/${phasePrefix}-CONTEXT.md` was created or reused through
  `mcp_blueprint_blueprint_artifact_scaffold`.
- `mcp_blueprint_blueprint_state_update` routed the repo to
  `/blu-discuss-phase <phase>`.
- No public command surface, catalog status semantics, hook ownership,
  installed-extension files, or `.planning/` runtime dependency changed.
