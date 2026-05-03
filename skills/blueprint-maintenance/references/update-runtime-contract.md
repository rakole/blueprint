# Update Runtime Contract

This reference is the detailed `/blu-update` workflow contract. The command manifest stays thin, the `blueprint-maintenance` skill owns orchestration, and update behavior remains advisory and out-of-band.

## Stage Mapping

### Resolve

- Call `mcp_blueprint_blueprint_update_check` first.
- Treat returned host, extension path, installed version, install provenance, latest-version lookup status, update availability, and warnings as authoritative.

### Read

- Keep extension-path handling read-only.
- If latest-version lookup is unavailable, keep manual fallback explicit instead of inventing a version.

### Decide

- Use a structured mode gate when available to choose saved checklist versus manual fallback.
- Surface the pending gate as `update-mode-gate` until the mode is clear.

### Execute

- Explain only out-of-band update steps, such as reinstalling from GitHub or a local path.
- Never mutate the running extension bundle in-session.

### Persist

- If the user wants a saved checklist, call `mcp_blueprint_blueprint_update_plan`.
- Pass `mode = "ask_user"` when structured gating was available and `mode = "manual"` otherwise.
- Treat returned steps, notes, `requiresRestart`, `savedPaths`, and status as authoritative.

### Validate

- Tell the user to rerun `/blu-update` or `mcp_blueprint_blueprint_update_check` after manual update.

### Route

- Always end with restart guidance because the host session will not hot-reload the updated extension.
- Do not present planned-only commands as runnable.

## Persistence Boundaries

- Blueprint-owned persistence is host-global under `~/.<host>/blueprint/updates/`.
- Do not write project-local update artifacts.
- Do not write into the installed extension directory.

## Required MCP FQNs

- `mcp_blueprint_blueprint_update_check`
- `mcp_blueprint_blueprint_update_plan`
