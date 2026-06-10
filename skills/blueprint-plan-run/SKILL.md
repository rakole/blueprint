---
name: blueprint-plan-run
description: >
  Single-plan execution harness for isolated Blueprint worktree and branch
  preparation, PlanRun records, diff capture, and later patch or summary
  handoff.
status: implemented
commands:
  - /blu-run-plan
input_bundles:
  shared: []
  commands:
    "/blu-run-plan":
      - commands/blu-run-plan.toml
      - skills/blueprint-plan-run/references/run-plan-runtime-contract.md
---

# Blueprint Plan Run Skill

## Purpose

Prepare one saved Blueprint phase plan for isolated execution without widening
it into full phase execution. The command starts with a preview, asks for a
focused confirmation, creates or reuses the returned worktree and branch only
after approval, records a PREPARED PlanRun through MCP-owned state, and later
captures authorized implementation diffs into the patch registry.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as
  `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` into runtime
  FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI
  entrypoints, not shell executables.
- Prefer `ask_user` for the `plan-run-prepare-confirmation` gate. When the host
  does not expose `ask_user`, ask the same focused decision in prose.
- Keep all Blueprint-owned persistence on MCP rails; do not hand-write
  `.blueprint/runs/`, `.blueprint/patches/`, phase summaries, or state files.

## Local Runtime Inputs

`/blu-run-plan` resolves active runtime inputs from the structured
`input_bundles` frontmatter:

- `commands/blu-run-plan.toml`
- `skills/blueprint-plan-run/references/run-plan-runtime-contract.md`

Repository docs can explain product history, but they are not active runtime
inputs for this command.

## Required MCP Tools

- `mcp_blueprint_blueprint_project_status`
- `mcp_blueprint_blueprint_config_get`
- `mcp_blueprint_blueprint_phase_locate`
- `mcp_blueprint_blueprint_phase_plan_read`
- `mcp_blueprint_blueprint_phase_execution_targets`
- `mcp_blueprint_blueprint_plan_run_prepare`
- `mcp_blueprint_blueprint_plan_run_record`
- `mcp_blueprint_blueprint_plan_run_load`
- `mcp_blueprint_blueprint_plan_run_diff`
- `mcp_blueprint_blueprint_plan_run_patch_record`
- `mcp_blueprint_blueprint_patch_record`
- `mcp_blueprint_blueprint_phase_summary_write`
- `mcp_blueprint_blueprint_state_update`

## Workflow Rules

### `/blu-run-plan`

Load `skills/blueprint-plan-run/references/run-plan-runtime-contract.md` as the
rich command-local runtime contract. The command manifest is the thin host
entrypoint; the reference owns the preview-first gate, branch/worktree
preparation contract, and later diff-capture boundaries.

1. Resolve project readiness, effective config, phase, execution targets, and
   the selected plan through MCP before any mutation.
2. Call `mcp_blueprint_blueprint_plan_run_prepare` with `mode: "preview"` and
   show the returned plan-run preview exactly enough for the user to confirm:
   phase, planId, runId, branchName, workspaceName, planned workspacePath,
   authorized files, verification commands, blockers, and warnings.
3. Ask `plan-run-prepare-confirmation` before creating or reusing any
   branch/worktree. The confirmation must say preparation records PREPARED
   state and does not implement the plan.
4. On approval, call `mcp_blueprint_blueprint_plan_run_prepare` with
   `mode: "prepare"` using the same resolved identifiers unless the user
   explicitly changed them before confirming.
5. Treat returned MCP paths and ids as authoritative. Tell the user or agent to
   edit only inside the returned `worktreePath`.
6. Stop after PREPARED state unless implementation edits already exist in the
   returned worktree and the active flow is patch capture.
7. For capture, call `mcp_blueprint_blueprint_plan_run_diff` before persistence.
   If `unauthorizedChangedFiles` is non-empty, report those paths and do not
   call the patch registry.
8. For an authorized implementation diff, call
   `mcp_blueprint_blueprint_plan_run_patch_record` so the PlanRun wrapper
   records deterministic patch id `plan-run-<phase>-<planId>-<runId>`, writes
   the host-global patch registry entry, and persists patch metadata back onto
   the run record.
9. Do not call `mcp_blueprint_blueprint_phase_summary_write` or
   `mcp_blueprint_blueprint_state_update` during Wave 6 patch capture.

## No-Subagent Fallback

This command does not require subagents. If an implementation agent is used in
a later wave, it must work in the returned `worktreePath`, respect authorized
files, and close once its bounded work is done. The prepare and patch-capture
control path itself stays single-agent and confirmation-gated where mutation
requires user approval.

## Output Criteria

- The preview happened before mutation.
- The confirmation gate was explicit.
- The final branch, workspace, worktree, runId, and plan-run paths came from
  MCP results.
- The response says preparation happened unless the patch-capture result shows
  an authorized implementation diff was recorded.
- Any follow-up stays inside implemented Blueprint commands.
