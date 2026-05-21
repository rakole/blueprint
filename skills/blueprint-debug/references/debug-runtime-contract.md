# Debug Runtime Contract

This is the command-local runtime contract for `/blu-debug`. It is loaded with
`commands/blu-debug.toml` through the `blueprint-debug` skill's structured
`input_bundles` frontmatter. Repository docs may describe history, but they are
not active runtime inputs for this command.

## Scope Gate

- Require a concrete issue statement before deep investigation. Ask for the
  failing behavior, expected behavior, and repro hint when the request is too
  vague.
- Read `blueprint_project_status` before promising durable Blueprint
  persistence. If the repo is not initialized, degrade to suggestion mode and
  route to `/blu-new-project` instead of writing `.blueprint/` artifacts.
- Treat `--diagnose` as a hard diagnose-only boundary. Do not attempt source
  changes, patch generation, broad refactors, or direct fixes unless the user
  explicitly confirms a fix attempt after the diagnosis.
- Keep `/blu-debug` investigative. A bounded fix routes to `/blu-quick`; a
  broader saved-plan rollout routes to `/blu-plan-phase`; saved verification
  evidence routes to `/blu-validate-phase`; ambiguous next steps route to
  `/blu-progress`.

## Stage Contract

Use the `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and
`Route` stage vocabulary for non-trivial investigations.

- Resolve: restate the concrete symptom, scope, diagnose-only status, and
  evidence source.
- Read: inspect local files, prior `.blueprint/reports/debug-latest.md`
  content when continuation matters, command outputs, and targeted logs.
- Decide: separate confirmed causes, hypotheses, and next experiments.
- Execute: run only investigation commands, reproductions, and tests needed to
  support the diagnosis. Shell commands and test runs are allowed when scoped to
  the issue.
- Persist: write the durable report through `blueprint_artifact_report_write`
  using the bare report name `debug-latest`.
- Validate: record which evidence was confirmed, which tests or reproductions
  passed or failed, and what uncertainty remains.
- Route: stop at an explicit follow-up gate before todo capture or fix
  attempts.

## Session-Local Visibility

- Use Gemini CLI `update_topic` to surface the active stage only for
  non-trivial investigations.
- Use Gemini CLI `write_todos` only for a compact visible checklist during
  non-trivial investigations.
- `update_topic` and `write_todos` are session-local visibility only and do
  not replace Blueprint MCP persistence or explicit todo capture.
- Do not use hidden state, chat memory, tracker tools, or visible checklists as
  a substitute for the saved `debug-latest` report.

## MCP Persistence

- `blueprint_artifact_report_write` owns the durable report write. Pass the
  bare canonical report name `debug-latest`, not
  `.blueprint/reports/debug-latest.md`, and treat the returned `path` as
  authoritative.
- If an existing report would be overwritten, require explicit confirmation
  before replacing it. When the user wants continuation instead, read the prior
  report and incorporate it into the new diagnosis.
- `blueprint_artifact_mutate_index` may create a persisted todo only after an
  explicit user ask or confirmation. Use returned `createdEntryIds`,
  `duplicateEntryIds`, or related ids as authoritative; never synthesize todo
  ids manually.
- `blueprint_state_update` records the next safe implemented action after the
  report or confirmed todo capture. Keep follow-up routing implemented-only.
- Returned paths and ids from MCP tools are authoritative. Do not infer a
  saved path or id from a prompt-local guess.

## Follow-Up Gate

After diagnosis and report persistence, present the narrow gate:

- report-only
- capture a todo only after explicit user ask or confirmation
- route to `/blu-quick`
- route to `/blu-plan-phase`
- route to `/blu-validate-phase`
- defer to `/blu-progress`

Do not silently create a todo. Do not convert every finding into persisted work
without consent. Do not broaden the debug run into direct large fixes, hidden
planning, or unrelated repo changes.

## Optional Agent

Gemini CLI exposes an enabled delegated agent as a same-named tool. Do not read,
inline, or load any separate agent source before delegation. Call the
same-named `blueprint-debugger` Gemini agent tool with a bounded diagnosis
packet only when the active `/blu-debug` command contract permits it, effective
config does not disable `workflow.subagents`, the tool is available in the
current host session, and the investigation benefits from bounded hypothesis
testing, reproduction, log review, or confidence-rated diagnosis. Do not
substitute browser-only, web-search-only, shell-only, or generic helper agents
for this Blueprint debugging role.

## No-Subagent Fallback

When `blueprint-debugger` is unavailable, unnecessary, or unsafe, continue
single-agent with parity:

1. Work one hypothesis, reproduction, log slice, or targeted test at a time
   where the agent path could have isolated investigation.
2. Keep the same evidence depth and diagnosis quality bar as the delegated
   path.
3. After each completed unit, compress compact carry-forward context:
   confirmed evidence, rejected hypotheses, open questions, confidence shift,
   and the next bounded experiment.
4. Persist the same `debug-latest` report through MCP before ending or
   handing off follow-up routing.
5. Call out reduced confidence only when the missing agent actually prevented a
   bounded verification step, not as a generic disclaimer.

## Output Criteria

- Summarize the symptom, evidence, diagnosis, and confidence plainly.
- Separate confirmed causes from hypotheses and likely next experiments.
- State whether the run stayed diagnose-only or crossed into a confirmed fix
  attempt.
- State whether in-flight visibility stayed session-local only.
- State whether a persisted todo follow-up was explicitly approved.
- Name the saved `debug-latest` report using the MCP-returned path.
- End on the safest implemented next action.
