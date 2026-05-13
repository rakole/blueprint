# Long-Running Phase Discovery Profile

This shared profile applies to phase-discovery commands that use the
`long-running-mutation` execution profile. Command-specific runtime contracts
own behavior details; this file owns the repeated stage, status, and
session-local helper guidance.

## Stage Vocabulary

Use these stage labels when a non-trivial discovery run needs visible progress:

- `Resolve`: identify the target phase and stop early on ambiguity or missing
  Blueprint prerequisites.
- `Read`: build the prior-context packet from Blueprint state, saved artifacts,
  roadmap context, effective config, checkpoint state, and relevant indexes.
- `Decide`: make the active gate explicit before branching.
- `Execute`: work through the selected discovery area, question, evidence pass,
  or analysis branch.
- `Persist`: save only the command's declared Blueprint artifacts, checkpoints,
  reports, or state updates through MCP tools.
- `Validate`: normalize against canonical contracts and repair validation
  failures before claiming completion.
- `Route`: report the refreshed next safe implemented action or fall back to
  `/blu-progress` when routing is uncertain.

## In-Flight Status

Keep these fields legible during branchy discovery runs:

- resolved scope
- active stage
- pending gate
- execution mode
- next safe action

For `/blu-discuss-phase`, useful pending gates include phase ambiguity,
resume-versus-discard checkpoint choice, gray-area selection, overwrite
confirmation, and validation blockers.

For `/blu-research-phase`, useful pending gates include checkpoint
resume-versus-discard, valid-research view/skip/update, external-source
confirmation, sidecar availability, strand blocker, validation repair, and
state-sync or route-refresh failure.

## Session-Local Visibility Helpers

On Gemini hosts that expose `update_topic` and `write_todos`, use them only as
session-local visibility aids during non-trivial multi-area discovery. They do
not replace MCP-backed artifacts, checkpoints, reports, or `STATE.md`.

When those helpers are unavailable, keep the same stage and next-safe-action
visibility in normal progress recaps plus MCP-backed checkpoints and `STATE.md`.
Do not claim helper calls were made when the host did not expose them.

For `/blu-research-phase`, the compact fallback recap should include the active
strand and pending gate, for example:

`Stage: Execute | Scope: Phase 3 Phase Discovery | Mode: parent-only |
Completed: S1 context-lock, S2 repo-map | Active: S3 stack-and-dependencies |
Pending gate: external-source confirmation | Next safe action: checkpoint or
resume /blu-research-phase 3`

Use host-supported structured choices for focused interactive decisions such as
overwrite confirmation, resume-versus-discard, and next-area selection. Avoid
hardcoding host tool schemas in command prompts unless a source schema is
discoverable in the repository.

## Fallback Progress Format

When `update_topic` and `write_todos` are unavailable, use this fixed
one-line status format for progress recaps:

```
Progress: phase=<resolved phase> stage=<Resolve|Read|Decide|Execute|Persist|Validate|Route>
gate=<pending gate or none> mode=<discuss|assumptions|skip-discuss>/<fresh|resumed>
areas=<decided>/<total> active=<areaId or none> next=<next safe action or next question>
```

Helper state mirrors the MCP checkpoint. If helper state and checkpoint
state disagree, report the checkpoint state and refresh the helper display.
The MCP checkpoint remains authoritative.
