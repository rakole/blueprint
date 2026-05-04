---
name: blueprint-governance
description: >
  Blueprint governance, config, and handoff specialist. Use this skill when
  `settings`, `set-profile`, `health`, `pause-work`, or `resume-work` need
  explicit state inspection, confirmation-gated repair behavior, or durable
  handoff handling. Example scenarios: updating normalized repo settings,
  changing the active model profile, diagnosing config drift, writing a pause
  handoff, and restoring work from the canonical pause state.
status: implemented
commands:
  - /blu-settings
  - /blu-set-profile
  - /blu-health
  - /blu-pause-work
  - /blu-resume-work
input_bundles:
  shared: []
  commands:
    "/blu-settings":
      - skills/blueprint-governance/references/settings-runtime-contract.md
    "/blu-set-profile":
      - skills/blueprint-governance/references/set-profile-runtime-contract.md
    "/blu-health":
      - skills/blueprint-governance/references/health-runtime-contract.md
    "/blu-pause-work":
      - skills/blueprint-governance/references/pause-work-runtime-contract.md
    "/blu-resume-work":
      - skills/blueprint-governance/references/resume-work-runtime-contract.md
---

# Blueprint Governance Skill

## Purpose

Handle config, profile, and health flows with explicit state inspection and confirmation-gated repair behavior.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Only invoke optional subagents when the current command contract explicitly allows them.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.
- for any interaction or confirmation required from user, make use of `ask_user`. Do not dump question / confirmation in plain text.

## Parity Goal

Stay close to the locked governance contracts for settings, profile selection, and health validation while preserving Blueprint config and hook boundaries.

## Runtime Inputs

Load only the active command's structured `input_bundles.commands[...]` reference:

- `/blu-settings`: `skills/blueprint-governance/references/settings-runtime-contract.md`
- `/blu-set-profile`: `skills/blueprint-governance/references/set-profile-runtime-contract.md`
- `/blu-health`: `skills/blueprint-governance/references/health-runtime-contract.md`
- `/blu-pause-work`: `skills/blueprint-governance/references/pause-work-runtime-contract.md`
- `/blu-resume-work`: `skills/blueprint-governance/references/resume-work-runtime-contract.md`

## Required MCP Tools

- `blueprint_project_status`
- `blueprint_config_get`
- `blueprint_config_set`
- `blueprint_config_set_profile`
- `blueprint_state_load`
- `blueprint_pause_handoff_get`
- `blueprint_pause_handoff_write`
- `blueprint_state_update`
- `blueprint_state_sync`
- `blueprint_artifact_list`
- `blueprint_artifact_validate`

## Shared MCP Contracts

- `blueprint_config_get`: `scope` defaults to `effective`. Use `scope: "defaults"` only when the user wants to inspect or compare the host-global saved defaults file.
- `blueprint_config_set`: `scope` defaults to `project`, and `patch` must be a JSON object. Use `scope: "defaults"` only after explicit user approval to change saved defaults.
- `blueprint_config_set_profile`: use this dedicated tool instead of a general config patch when only `model_profile` should change.
- `blueprint_pause_handoff_write`: `currentState` is required, list fields are optional and normalized, and omitting `nextAction` lets the tool derive the safest current follow-up. Use returned `handoff` and `path` as authoritative.

## Workflow Rules

1. Diagnose before mutating.
2. Never reintroduce repo-level `hooks.*`, `workflow.use_workspaces`, or `workflow.use_workstreams`.
3. `set-profile` changes only project-local `model_profile`.
4. `health --repair` must explain exact writes before it performs them.
5. If Blueprint is uninitialized, route to `/blu-new-project` instead of pretending repair equals bootstrap.
6. Keep all config persistence in MCP.
7. `pause-work` must persist a single durable handoff in `.blueprint/reports/` through MCP and require explicit confirmation before replacing it.
8. `pause-work` should preserve resumable context without silently creating a git commit; keep the next implemented follow-up on `/blu-resume-work`.
9. `resume-work` must restore the canonical pause handoff context, clear an active pause condition through `blueprint_state_update`, and then re-anchor `STATE.md` on the live next safe implemented action.

## Completion Self-Check

Before claiming completion, verify:

- The active `/blu-settings`, `/blu-set-profile`, `/blu-health`, `/blu-pause-work`, or `/blu-resume-work` reference from `input_bundles.commands[...]` was loaded and used as the authority; sibling governance references were not treated as active input.
- Required MCP calls from the active reference ran in order through `mcp_blueprint_*` runtime FQNs, including any required post-write `project_status` or `state_load` reload before final routing.
- Persistence, when allowed, happened only through the owning MCP tools: config writes through `config_set` or `config_set_profile`, health repair through `config_set` or `state_sync`, pause through `pause_handoff_write` then `state_update`, and resume through `state_update` only.
- Returned MCP fields were treated as authoritative evidence: `status`, `configPath`, `path`, `handoff`, `updatedKeys`, validation issues, `suggestedRepairs`, warnings, blockers, and reasons determined success, no-write status, or stoppage.
- Any required `ask_user` confirmation was satisfied before broad resets, saved-defaults writes, `health --repair` writes, or pause handoff replacement; without confirmation, the command reported a no-write result.
- Validation failures, tool rejections, partial or uninitialized project status, missing config or handoff, skipped repairs, and blockers were repaired only through the active contract's MCP path or reported honestly, not described as successful completion.
- The command stayed inside its write boundary: no direct `.blueprint/` edits, no roadmap, phase, code, runtime, installed-extension, hidden-state, or planned-only surface mutations, and no defaults write except `/blu-settings` explicit opt-in.
- Final routing named only implemented Blueprint commands; use `/blu-progress` when the safe next action is ambiguous, read-only, or not implemented.
- The final response reported concrete returned artifact/config/state paths or no-write status, warnings/blockers, and the next safe implemented action required by the active contract.
