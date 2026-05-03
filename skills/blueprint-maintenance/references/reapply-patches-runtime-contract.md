# Reapply Patches Runtime Contract

This reference is the detailed `/blu-reapply-patches` workflow contract. The command manifest stays thin, the `blueprint-maintenance` skill owns orchestration, and patch replay remains previewed, exact-scope, and confirmation-gated.

## Stage Mapping

### Resolve

- Call `mcp_blueprint_blueprint_patch_list` first.
- Treat returned registry path, patch ids, manifest paths, patch paths, tracked files, compatibility notes, and audit paths as authoritative.
- Resolve selected patch ids, target repo, tracked files, source version, compatibility notes, and audit destination.

### Read

- Inspect git status and resolved target before mutation.
- Dirty tree, malformed patch registry, missing patch target, compatibility mismatch, or installed-extension target is a hard stop.

### Decide

- Call `mcp_blueprint_blueprint_patch_reapply` with `dryRun: true` for the exact selected patch set.
- Stop on conflicts and report them plainly.
- Preview patch ids, registry path, tracked files, compatibility notes, preview result, and exact replay scope.
- Require explicit confirmation and surface `reapply-patches-confirmation` until approved.

### Execute

- After approval, call `mcp_blueprint_blueprint_patch_reapply` with `dryRun: false` for only the previewed and confirmed patch ids.
- Never widen the replay scope after preview.
- Never mutate the installed extension directory.

### Persist

- Call `mcp_blueprint_blueprint_patch_record` after the previewed replay completes or fails cleanly after preview.
- Append a replay audit entry instead of inventing another persistence path.

### Validate

- Verify replay outcome, conflicts or compatibility warnings, registry path, and audit status.

### Route

- Prefer `/blu-progress`, manual review, or manual git follow-up.
- Do not present planned-only commands as runnable.

## Persistence Boundaries

- Patch registry and audit state are host-global under `~/.<host>/blueprint/patches/`.
- Do not create project-local `.blueprint/` runtime state for patch replay.
- Preserve the flow `preflight -> preview -> confirm -> replay -> record`.

## Required MCP FQNs

- `mcp_blueprint_blueprint_patch_list`
- `mcp_blueprint_blueprint_patch_reapply`
- `mcp_blueprint_blueprint_patch_record`
