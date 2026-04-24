# Blueprint Bootstrap Runtime Guardrails

This reference keeps `/blu-new-project` host-native, anti-legacy, and honest
about what Blueprint can and cannot do at runtime.

## Host And Tool Naming Guardrails

- `/blu-new-project` is a host CLI slash command, not a shell executable.
- Never run `/blu-new-project` in the shell.
- Treat Blueprint skills as guidance, not callable tools.
- Call Blueprint MCP tools only through runtime FQNs such as
  `mcp_blueprint_blueprint_project_init`.
- Translate shorthand `blueprint_*` ids from older docs into their
  `mcp_blueprint_*` runtime FQNs before calling them.
- Never try to invoke Blueprint MCP tools through shell wrappers such as
  `mcp use`, `blueprint-mcp`, or ad-hoc `node -e` MCP SDK scripts.
- If a required Blueprint MCP tool is unavailable, stop and report that the
  Blueprint MCP server is disconnected or undiscovered instead of improvising a
  shell fallback.
- Do not reintroduce `.planning/` as Blueprint runtime state.
- Do not promise GSD shell choreography.
- Do not generate project instruction files such as `CLAUDE.md` or `AGENTS.md`.

## Gemini-Native Coordination Helpers

- Prefer Gemini CLI's built-in `ask_user` tool for structured clarification,
  saved-default selection, workflow-preference capture, overwrite confirmation,
  and the bootstrap approval gate.
- Before using `ask_user` for approval, render the project brief and roadmap
  preview directly in the main Gemini CLI conversation. The user must be able
  to review the proposal without expanding tool, shell, or subagent panes.
- Use `update_topic` to keep the current bootstrap stage visible during long
  runs.
- Use `write_todos` to maintain a compact visible checklist for multi-stage
  bootstrap work.
- When bootstrap work develops real internal dependencies, use task-tracking
  helpers such as `tracker_create_task`, `tracker_add_dependency`,
  `tracker_update_task`, `tracker_get_task`, `tracker_list_tasks`, and
  `tracker_visualize`.
- Treat Gemini-native helpers as session-local coordination aids only; they do
  not replace Blueprint MCP persistence, `.blueprint/STATE.md`, or authored
  bootstrap artifacts.
- If you are unsure whether a Gemini-native helper exists or how it behaves,
  use `get_internal_docs` before relying on it.

## Honest Fallback Posture

- Prefer Gemini-native helpers when available, but do not pretend they ran if
  the current host does not expose them.
- When a helper is unavailable, continue with plain conversational progress
  recaps and explicit status summaries instead of inventing hidden capability.
- Keep the shared stage labels and in-flight status fields legible even when a
  helper fallback is necessary.
- Do not use shell commands such as `echo`, `cat`, `printf`, pagers, temporary
  files, or terminal renderers as a workaround for presenting approval content.
  Shell output is not a durable or reviewable Blueprint approval surface.
