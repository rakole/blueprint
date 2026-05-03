# Workstreams Runtime Contract

This reference is the detailed `/blu-workstreams` workflow contract. The command manifest stays thin, the `blueprint-maintenance` skill owns orchestration, and workstream persistence stays project-local and MCP-owned.

## Stage Mapping

### Resolve

- Call `mcp_blueprint_blueprint_workstream_list` first.
- Resolve operation and target explicitly. Use structured interaction when available; in headless mode require an explicit operation and target.
- Treat returned `rootPath`, `indexPath`, `active`, `workstreams`, `summary`, `waitingState`, and `reason` as authoritative.

### Read

- Keep `list`, `status`, and `progress` read-only on `mcp_blueprint_blueprint_workstream_list`.
- Stop on `project_missing`, `invalid`, `corrupt-workstream-index`, `missing-workstream`, `missing-resume-snapshot`, or dirty active-stream transitions.

### Decide

- For `create`, confirm the new workstream name without switching active streams implicitly.
- For `switch`, preview current active stream, selected target, and saved snapshot state; require `workstream-switch-confirmation`.
- For `resume`, require a saved snapshot and preview the returned state patch.
- For active-stream `complete`, require `workstream-archive-confirmation`.

### Execute

- Persist workstream changes only through `mcp_blueprint_blueprint_workstream_mutate`.
- Use operations exactly as resolved: `create`, `switch`, `resume`, or `complete`.

### Persist

- Treat returned `active`, `workstreams`, `affectedPaths`, `waitingState`, `nextAction`, and `statePatch` as authoritative.
- If `resume` returns `statePatch`, pass only that patch to `mcp_blueprint_blueprint_state_update`; do not add `lastUpdated`.

### Validate

- Verify active workstream, selected target, affected paths, returned waiting state, and whether a resume patch was applied.

### Route

- Prefer `/blu-progress`, `/blu-workstreams`, or manual repo work.
- Do not widen resume into `/blu-resume-work`.
- Do not present planned-only commands as runnable.

## Persistence Boundaries

- Workstream state is project-local under `.blueprint/workstreams/`.
- `mcp_blueprint_blueprint_workstream_mutate` owns `WORKSTREAMS.md` regeneration and per-stream `state.json` writes.
- Do not create host-global workstream registries or config toggles such as `workflow.use_workstreams`.

## Required MCP FQNs

- `mcp_blueprint_blueprint_workstream_list`
- `mcp_blueprint_blueprint_workstream_mutate`
- `mcp_blueprint_blueprint_state_update`
