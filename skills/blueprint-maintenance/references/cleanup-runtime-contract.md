# Cleanup Runtime Contract

This reference is the detailed `/blu-cleanup` workflow contract. The command manifest stays thin, the `blueprint-maintenance` skill owns orchestration, and filesystem archival remains protected-scope, confirmation-gated, and committed only through `blueprint_cleanup_archive`.

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
- Call `mcp_blueprint_blueprint_cleanup_archive` with `mode: "preview"` and treat its selected phase directories, protected exclusions, digest inputs, destination status, waiting state, and blockers as authoritative.
- Require destructive confirmation and surface `cleanup-confirmation`.
- If creating a new archive destination needs approval, surface `archive-destination-confirmation`.
- If replacing `cleanup-latest` needs approval, surface `report-overwrite-confirmation`.

### Execute

- After confirmation, call `mcp_blueprint_blueprint_cleanup_archive` with `mode: "commit"`, `confirmed: true`, the approved destination/operation/overwrite choices, and the preview's `expectedSelectedPhaseDirs` plus `expectedProtectedPhaseDirs`.
- Never run shell `mv`, `cp`, `rm`, or direct filesystem operations from the prompt.
- Let the tool enforce current phase, active roadmap references, evidence-incomplete phase directories, destination creation approval, destination collisions, stale preview mismatches, and copy-then-delete ordering.

### Persist

- `mcp_blueprint_blueprint_cleanup_archive` owns `.blueprint/reports/cleanup-latest.md` and writes it only from the actual archive outcome.
- If cleanup changes routing, call `mcp_blueprint_blueprint_state_update` only after `mcp_blueprint_blueprint_cleanup_archive` returns `status: "archived"` with `reportWritten: true`.
- Preserve and report the runtime-written cleanup report on partial failure when `reportWritten` is true; otherwise surface the missing report as a blocker and do not claim cleanup completion.

### Validate

- Verify archived, failed, skipped, and kept directories, protected exclusions, archive destination, report path, and partial failures from the `mcp_blueprint_blueprint_cleanup_archive` result.

### Route

- Prefer `/blu-progress`, `/blu-new-milestone`, `/blu-plan-phase`, `/blu-discuss-phase`, or manual cleanup follow-up when appropriate.
- Do not present planned-only commands as runnable.

## Persistence Boundaries

- Blueprint-owned writes are limited to `.blueprint/reports/cleanup-latest.md`, the confirmed `.blueprint/archive/` destination, and `.blueprint/STATE.md` when routing changes.
- Archive destinations require existing `.blueprint/archive/` destination or explicit creation approval.
- The manifest does not read a report contract for cleanup; do not add `artifact_contract_read` to this command.

## Required MCP FQNs

- `mcp_blueprint_blueprint_project_status`
- `mcp_blueprint_blueprint_roadmap_read`
- `mcp_blueprint_blueprint_artifact_list`
- `mcp_blueprint_blueprint_artifact_summary_digest`
- `mcp_blueprint_blueprint_cleanup_archive`
- `mcp_blueprint_blueprint_state_update`
