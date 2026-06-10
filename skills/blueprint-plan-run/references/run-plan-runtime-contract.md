# `/blu-run-plan` Runtime Contract

This reference is the command-local contract for preparing one saved Blueprint
phase plan for isolated execution and capturing its authorized implementation
diff into the patch registry. It is loaded with
`commands/blu-run-plan.toml` through the `blueprint-plan-run` skill's structured
`input_bundles` frontmatter.

## Scope

- `/blu-run-plan` is a plan-to-PR harness entrypoint, not full phase execution.
- The prepare behavior is preview-first and confirmation-gated.
- The Wave 6 capture behavior records authorized implementation diffs only.
- It prepares one phase plus planId pair, creates or reuses the returned
  branch/worktree after confirmation, and records PREPARED PlanRun state.
- It must not claim implementation, verification, review, patch persistence,
  phase summary persistence, or state sync before those steps have real
  evidence.
- It must not persist a patch registry entry when `unauthorizedChangedFiles` is
  non-empty.

## MCP Tool Contract

Use runtime FQNs in command prompts and host calls:

- `mcp_blueprint_blueprint_project_status`
- `mcp_blueprint_blueprint_config_get`
- `mcp_blueprint_blueprint_phase_locate`
- `mcp_blueprint_blueprint_phase_execution_targets`
- `mcp_blueprint_blueprint_phase_plan_read`
- `mcp_blueprint_blueprint_plan_run_prepare`
- `mcp_blueprint_blueprint_plan_run_record`
- `mcp_blueprint_blueprint_plan_run_load`
- `mcp_blueprint_blueprint_plan_run_diff`
- `mcp_blueprint_blueprint_plan_run_patch_record`
- `mcp_blueprint_blueprint_patch_record`
- `mcp_blueprint_blueprint_phase_summary_write`
- `mcp_blueprint_blueprint_state_update`

## Stage Contract

- Resolve: read project status, effective config, phase resolution, execution
  targets, and the saved plan.
- Read: inspect plan metadata, authorized files, verification commands,
  blockers, and base git state through MCP results.
- Decide: call `mcp_blueprint_blueprint_plan_run_prepare` with
  `mode: "preview"` and present the planned branch/worktree/run details.
- Prepare: after `plan-run-prepare-confirmation`, call
  `mcp_blueprint_blueprint_plan_run_prepare` with `mode: "prepare"`.
- Execute: implementation work must happen inside the returned `worktreePath`.
- Capture: call `mcp_blueprint_blueprint_plan_run_diff` after source edits
  exist; the command `cwd` remains the source repo, and the recorded
  `worktreePath` remains authoritative for the diff target.
- Persist: when the diff is authorized, call
  `mcp_blueprint_blueprint_plan_run_patch_record` to persist patch id
  `plan-run-<phase>-<planId>-<runId>`, label `Plan run <phase>/<planId>`,
  tracked files from the diff, `sourceVersion` from baseHead, and patch content
  equivalent to `git diff --binary <baseHead>` from the prepared
  registry-backed worktree.
- Persist: keep `mcp_blueprint_blueprint_phase_summary_write` and
  `mcp_blueprint_blueprint_state_update` deferred until a later summary flow.
- Route: follow-up instructions must use implemented commands only.

## Confirmation Gate

Always call preview before prepare. The preview response must show:

- phase
- planId
- runId
- branchName
- workspaceName
- planned workspacePath
- baseHead
- authorized files
- verification commands
- blockers
- warnings

Then ask for `plan-run-prepare-confirmation`. The question must say that
prepare mode creates or reuses the returned branch/worktree and records a
PREPARED PlanRun, but does not implement the plan.

## Persistence Boundaries

- `mcp_blueprint_blueprint_plan_run_prepare` owns worktree/branch preparation
  and PREPARED record creation for this command.
- `mcp_blueprint_blueprint_plan_run_load` is read-only and useful for resuming
  or inspecting existing runs.
- `mcp_blueprint_blueprint_plan_run_diff` must precede patch capture.
- `mcp_blueprint_blueprint_plan_run_patch_record` owns normal patch capture and
  must not run until an authorized implementation diff exists in the prepared
  registry-backed worktree.
- `mcp_blueprint_blueprint_patch_record` is reserved for explicit manual repair
  flows; normal run-plan capture uses the PlanRun wrapper.
- `mcp_blueprint_blueprint_plan_run_patch_record` must block without writing a
  patch registry entry when `unauthorizedChangedFiles` is non-empty.
- `mcp_blueprint_blueprint_phase_summary_write` and
  `mcp_blueprint_blueprint_state_update` are forbidden during prepare and Wave
  6 patch-capture operation.
- Do not hand-write `.blueprint/runs/`, patch records, phase summaries, or
  state files.

## Output Criteria

- Say "prepared" or "ready for implementation" after prepare; say
  "patch recorded" only when the patch-capture result is `recorded`.
- Name the MCP-returned `worktreePath` as the only place where source edits
  should happen next.
- Include blockers and warnings without flattening them into success.
- Keep follow-up routing inside implemented Blueprint commands surfaced by the
  current project-status guidance.
