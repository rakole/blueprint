# Cleanup Runtime Contract

This reference is the detailed `/blu-cleanup` workflow contract. The command manifest stays thin, the `blueprint-maintenance` skill owns orchestration, and filesystem archival remains protected-scope and confirmation-gated.

## Stage Mapping

### Resolve

- Call `mcp_blueprint_blueprint_project_status` first. Route to `/blu-new-project` when uninitialized and `/blu-health` when partial or unhealthy.
- Call `mcp_blueprint_blueprint_roadmap_read` before proposing archive scope.
- Resolve current phase, active roadmap references, candidate phase directories, protected exclusions, archive destination, and whether the operation is move or copy-then-delete.

### Read

- Inspect git status and `.blueprint/phases/` before mutation.
- Dirty tree, missing phase root, or inconsistent phase layout is a hard stop.
- Call `mcp_blueprint_blueprint_artifact_list` for milestone completion, milestone summary, audit, and candidate phase evidence.
- Call `mcp_blueprint_blueprint_artifact_summary_digest` with explicit `artifactPaths`.

### Decide

- Only propose phase directories from completed milestones that are no longer referenced by the active roadmap and are not current.
- Keep protected exclusions visible: current phase, active roadmap references, evidence-incomplete directories, and final kept directories.
- Require destructive confirmation and surface `cleanup-confirmation`.
- If creating a new archive destination needs approval, surface `archive-destination-confirmation`.
- If replacing `cleanup-latest` needs approval, surface `report-overwrite-confirmation`.

### Execute

- Run only approved filesystem operations.
- If using copy-then-delete, delete originals only after archive copy succeeds cleanly.
- Never archive the current phase, active roadmap references, or evidence-incomplete phase directories.

### Persist

- Persist the approved cleanup plan before filesystem mutation through `mcp_blueprint_blueprint_artifact_report_write` with bare `reportName: "cleanup-latest"`.
- If cleanup changes routing, call `mcp_blueprint_blueprint_state_update` only after report write and successful filesystem work.
- Preserve the cleanup report even if archival partially fails after report persistence.

### Validate

- Verify archived directories, protected exclusions, archive destination, report path, and partial failures.

### Route

- Prefer `/blu-progress`, `/blu-new-milestone`, `/blu-plan-phase`, `/blu-discuss-phase`, or manual cleanup follow-up when appropriate.
- Do not present planned-only commands as runnable.

## Persistence Boundaries

- Blueprint-owned writes are limited to `.blueprint/reports/cleanup-latest.md` and `.blueprint/STATE.md` when routing changes.
- Archive destinations inside `.blueprint/` require existing destination or explicit creation approval.
- The manifest does not read a report contract for cleanup; do not add `artifact_contract_read` to this command.

## Required MCP FQNs

- `mcp_blueprint_blueprint_project_status`
- `mcp_blueprint_blueprint_roadmap_read`
- `mcp_blueprint_blueprint_artifact_list`
- `mcp_blueprint_blueprint_artifact_summary_digest`
- `mcp_blueprint_blueprint_artifact_report_write`
- `mcp_blueprint_blueprint_state_update`
