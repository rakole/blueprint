# Long-Running Execution Profile

This shared profile applies to `/blu-execute-phase` and non-trivial
`/blu-quick` runs that use the `long-running-mutation` execution profile.
Command-specific runtime contracts own behavior details; this file owns the
repeated stage, status, and session-local helper guidance.

## Stage Vocabulary

Use these stage labels when a non-trivial execution run needs visible progress:

- `Resolve`: identify the target phase or bounded quick scope and stop early on
  ambiguity, unhealthy Blueprint state, or missing prerequisites.
- `Read`: gather the saved plans, summaries, config, contract templates,
  command-catalog data, and state needed before mutation.
- `Decide`: make overwrite gates, depth gates, lower-wave blockers, boundedness
  limits, and execution-mode choices explicit before branching.
- `Execute`: work through the selected plan, wave, bounded task, or confirmed
  branch.
- `Persist`: save only the command's declared Blueprint summaries, reports, or
  state updates through MCP tools.
- `Validate`: run the command's required verification, repair, and post-write
  checks before claiming completion.
- `Route`: report the refreshed next safe implemented action or fall back to
  `/blu-progress` when routing is uncertain.

## In-Flight Status

Keep these fields legible during branchy execution runs:

- resolved scope
- active stage
- pending gate
- execution mode
- next safe action

For `/blu-execute-phase`, useful pending gates include lower-wave blockers,
overwrite confirmation, overlap or conflict review, interactive checkpoint
choice, and verification blockers.

For `/blu-quick`, useful pending gates include missing task clarity, optional
depth confirmation, quick-report overwrite approval, and rerouting when the
scope no longer qualifies as bounded quick work.

## Session-Local Visibility Helpers

On Gemini hosts that expose `update_topic` and `write_todos`, use them only as
session-local visibility aids during non-trivial runs. They do not replace
MCP-backed summaries, reports, or `STATE.md`.

When those helpers are unavailable, keep the same stage and next-safe-action
visibility in concise progress recaps plus MCP-backed persistence. Do not claim
helper calls were made when the host did not expose them.

Use host-supported structured choices for focused interactive decisions such as
overwrite confirmation, retry or skip choices, and optional-depth gates. Avoid
hardcoding host tool schemas in command prompts unless a source schema is
discoverable in the repository.
