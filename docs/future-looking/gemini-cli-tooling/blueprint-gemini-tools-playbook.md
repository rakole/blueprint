# Blueprint Gemini Tools Playbook

## Purpose

This playbook defines how Blueprint should use Gemini CLI tools in docs, skills, and agent prompts. It stays within the locked Blueprint runtime model: MCP owns persistence, hooks stay advisory, and implemented-only exposure is preserved.

## Shared Boundaries

- Use these rules as guidance for prompt text and doc contracts, not as a request to add new runtime behavior.
- Keep any fallback wording honest: when a Gemini-only tool or host capability is unavailable, describe the lower-fidelity path instead of pretending the richer tool still exists.
- Do not use this playbook to widen routed command surfaces or to make planned commands look implemented.

## Tool Guidance

### `ask_user`

- Use for structured decisions, overwrite confirmations, destructive gates, and review/skip/stop checkpoints.
- Prefer one question at a time with short labeled options when the choice is narrow.
- Use freeform input only when the answer genuinely needs user-written detail.
- When the host cannot offer `ask_user`, fall back to a plain-language confirmation request that preserves the same decision boundary.

### `write_todos`

- Use to make visible, user-facing progress for long-running work and multi-step follow-through.
- Keep todos aligned with the current stage and next safe action.
- Do not use todos as project state storage or as a substitute for MCP-backed persistence.
- When the host lacks todos, summarize the same progress in the command output instead of inventing a new tracker.

### `update_topic`

- Use to keep the current topic or stage visible during long-running work.
- Pair it with `write_todos` when a command needs both in-flight progress and user-facing follow-through.
- Do not use it to store authoritative project data.
- When the host lacks topic updates, surface the active stage in prose rather than introducing hidden state.

### Tracker tools

- Use tracker tools for branchy work with real dependency graphs, especially when a command needs internal coordination separate from user-facing todos.
- Keep trackers session-local and ephemeral.
- Do not use trackers as a persistence layer, as a cross-session memory store, or as a replacement for MCP artifacts.
- When tracker tools are unavailable, keep the workflow linear and report the next safe step explicitly.

### `get_internal_docs`

- Use when command or skill behavior depends on Gemini-specific or experimental semantics.
- Treat it as the grounded source for host behavior questions, not as a place to infer runtime policy from memory.
- Do not use it for repo facts that should come from local Blueprint docs or MCP state.
- When the host cannot provide internal docs, state the limitation and fall back to locked repo docs.

### Web tools

- Use `google_web_search` and `web_fetch` only for external truth that cannot come from local Blueprint files or MCP state.
- Keep web-derived facts separate from repo-derived facts in the resulting artifact or report.
- Prefer citation-backed notes when web tools are part of the workflow.
- When web tools are unavailable, continue with repo truth only and note that external verification was skipped.

### MCP resource tools

- Use `list_mcp_resources` and `read_mcp_resource` for read-heavy Blueprint context once the needed resources exist.
- Prefer resources for discovery-style reads instead of repeating file crawls or duplicating prompt instructions.
- Treat resources as read-only discovery surfaces, not as persistence or write channels.
- When resource tools are unavailable, read the underlying local docs or MCP tools directly.

### Shell

- Use shell only where the command contract explicitly allows it, such as bounded executor, maintenance, or debug flows.
- Keep mutating or shell-capable behavior limited to the allowed host paths for that command family.
- Do not rely on shell as the primary persistence path for Blueprint state.
- When shell access is unavailable, keep the command on its MCP-backed or docs-only path and report the fallback clearly.

## Host Fallback Behavior

- If the host is missing a Gemini-only tool, use the nearest lower-fidelity path that keeps the workflow honest.
- If a tool normally helps with visibility, preserve the same user-facing status in prose, todos, or reports.
- If a tool normally helps with grounding, fall back to locked Blueprint docs, local repo files, or MCP state before improvising.
- If a tool normally helps with persistence, do not replace MCP writes with prompt-only memory.

## Constraint Check

- MCP remains the only authoritative persistence layer.
- Hooks remain advisory rather than state-owning.
- Implemented-only command exposure is unchanged by this playbook.
- This playbook defines usage boundaries only; it does not introduce new runtime surfaces.
