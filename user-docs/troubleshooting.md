# Troubleshooting

Most Blueprint recovery starts with read-only commands. Use them before changing project state.

## Command Availability

If a command is missing or not recognized:

1. Confirm the host session was restarted after install or update.
2. Run `/blu-help` from inside the repo.
3. Run `/blu-progress` to see whether Blueprint recognizes project state.
4. If availability still looks wrong, run `/blu-health` and report the exact unavailable command.

Blueprint should recommend only runnable commands from the implemented catalog. If a command is unavailable, do not force it through another path.

## Optional Agents

Some commands can delegate to optional agents when configuration and host support allow it. If an optional agent is unavailable, Blueprint should say so and continue with a bounded fallback when possible.

Do not treat missing optional agents as a reason to hand-edit saved artifacts.

## Install, Update, And Host Basics

After installing or updating Blueprint:

- Restart the host session.
- Open the intended repo before running Blueprint commands.
- Run `/blu-help` to confirm the command surface loaded.
- Run `/blu-progress` to confirm Blueprint can read repo state.
- Use `/blu-update` for advisory update status when available.

## Project Status States

Common states and safe actions:

- Uninitialized fresh project: run `/blu-new-project`.
- Existing repo not mapped: run `/blu-map-codebase`.
- Mapped but not bootstrapped: run `/blu-new-project`.
- Unsure or mid-workflow: run `/blu-progress`.
- Need one next action: run `/blu-next`.
- Health or validation warnings: run `/blu-health`.

If state and user intent disagree, stop and correct the upstream artifact before executing.

## Artifact Validation

Blueprint artifacts should be written through MCP-owned commands. If a write fails validation:

1. Read the validation issue.
2. Fix the command input or upstream context.
3. Retry the owning command.
4. Use `/blu-health` when project-wide state looks inconsistent.

Do not repair validation errors by hand-editing `.blueprint/`.

## Recovery Ladder

Use this order:

1. Read state with `/blu-progress`.
2. Ask for the next safe action with `/blu-next`.
3. Check command guidance with `/blu-help`.
4. Inspect health with `/blu-health`.
5. For phase confusion, run `/blu-list-phase-assumptions <phase>`.
6. Move upstream to `/blu-spec-phase <phase>`, `/blu-discuss-phase <phase>`, or `/blu-research-phase <phase>`.
7. Re-plan with `/blu-plan-phase <phase>`.
8. Execute, review, or ship only after the corrected plan is trusted.

## High-Risk Commands

Expect explicit confirmation before commands that can mutate git, remote state, workspaces, patches, archived phase directories, or execution state:

- `/blu-execute-phase <phase>`
- `/blu-run-plan <phase> <planId>`
- `/blu-ship`
- `/blu-pr-branch`
- `/blu-undo`
- `/blu-cleanup`
- `/blu-new-workspace`
- `/blu-remove-workspace`
- `/blu-reapply-patches`

If a high-risk command is about to proceed without a clear confirmation gate, stop.

## Stop Before Mutating

Stop and read state first when:

- A command suggests an action you did not ask for.
- A saved plan, spec, research note, or context artifact seems stale.
- A command would overwrite or replace saved work.
- The repo has changed since the plan was created.
- The next step involves shipping, undo, cleanup, workspace changes, patch replay, or broad execution.

The safest recovery is usually read, correct upstream context, re-plan, then proceed.
