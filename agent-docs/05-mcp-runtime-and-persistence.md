# MCP Runtime And Persistence

Blueprint's MCP server is the deterministic runtime surface for structured
reads and writes.

## Server Shape

- `src/mcp/server.ts` is the thin entrypoint.
- `src/mcp/server-runtime.ts` assembles the MCP server, registers command
  resources, registers tools, wraps mutation handlers, sanitizes results, and
  returns public response content.
- `src/mcp/tool-definitions.ts` assembles every domain `*ToolDefinitions`
  array into one registry.

Tool text content and `structuredContent` intentionally mirror the same
sanitized public payload; tests rely on that public response shape.

## Tool Definition Pattern

Each tool definition has:

```text
name
description
inputSchema
handler(args)
```

Tool modules should colocate:

- Typed argument and result shapes.
- Zod input validation.
- Pure helpers for parsing and normalization.
- Handler logic.
- `*ToolDefinitions` export.

When adding a tool:

- Put it in the owning domain module.
- Add it to the owning `*ToolDefinitions` array.
- Ensure `src/mcp/tool-definitions.ts` imports that array through the existing
  domain export.
- Add it to `BLUEPRINT_MUTATION_TOOL_NAMES` if it writes state.
- Add focused tests.

## Tool Names And FQNs

Source metadata uses internal names such as:

```text
blueprint_project_status
blueprint_state_update
```

Command prompts call runtime FQNs such as:

```text
mcp_blueprint_blueprint_project_status
mcp_blueprint_blueprint_state_update
```

Do not mix these forms.

## Structured Results

Tool responses should include explicit, machine-readable status data:

- `status`
- `warnings`
- `issues`
- `diagnostics`
- `path` or `paths`
- `created`, `updated`, `overwritten`, or `reused`
- `nextAction` or equivalent routing signal when the tool owns it

The returned path is authoritative. Do not reconstruct paths in command text
when the tool already returned one.

## Mutation Failure Logging

Mutating tools that throw or return failure statuses are logged through the
central wrapper. The log path is `.blueprint/mcp-write-failures.ndjson`.

When adding a mutating tool:

- Register the tool name in `BLUEPRINT_MUTATION_TOOL_NAMES`.
- Return a failure `status` from the known failure vocabulary when rejecting a
  write.
- Preserve sanitized, bounded logging.

## Public Responses

Handler results are not sent raw. Public responses are sanitized and summarized
before the host sees them.

Do:

- Keep structured content useful.
- Avoid leaking oversized payloads.
- Keep diagnostics clear enough for command prompts to report blockers.

Do not:

- Depend on raw handler object formatting for user-facing behavior.
- Hide write failure details in unstructured strings only.
- Change public MCP payload trimming in individual handlers; keep that behavior
  centralized in the response sanitizer.

## Read-Only Resources

Blueprint exposes read-only command resources:

- `blueprint://commands/catalog`
- `blueprint://commands/{command}/runtime-contract`

Runtime-contract resources are exposed only for commands whose catalog entry is
implemented. They are projections, not a second status authority.
