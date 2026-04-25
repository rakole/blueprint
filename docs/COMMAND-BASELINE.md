# Blueprint Command Baseline

## Naming And Path Translation

| Blueprint surface | Runtime destination |
|---|---|
| root router | `/blu` |
| direct command entrypoint | `/blu-<command>` |
| project state directory | `.blueprint/` |
| global operational state | `~/.<host>/blueprint/` |
| workflow contracts | host-native skills, agents, hooks, and MCP tools |

In shared docs, `~/.<host>/blueprint/` means `~/.gemini/blueprint/` on Gemini CLI and `~/.tabnine/blueprint/` on Tabnine CLI.

## Retained Commands

These commands are in scope for Blueprint v1 planning and documentation:

- `add-backlog`, `add-phase`, `add-tests`, `add-todo`
- `audit-fix`, `audit-milestone`
- `check-todos`, `cleanup`
- `code-review`, `code-review-fix`, `complete-milestone`
- `debug`, `discuss-phase`, `do`, `docs-update`
- `execute-phase`, `explore`, `fast`
- `health`, `help`
- `insert-phase`
- `list-phase-assumptions`
- `map-codebase`, `milestone-summary`
- `new-milestone`, `new-project`, `new-workspace`, `next`, `note`
- `pause-work`, `plan-milestone-gaps`, `plan-phase`, `pr-branch`, `progress`, `quick`
- `reapply-patches`, `remove-phase`, `remove-workspace`, `research-phase`, `resume-work`, `review`, `review-backlog`
- `secure-phase`, `set-profile`, `settings`, `ship`
- `ui-phase`, `ui-review`, `undo`, `update`
- `validate-phase`, `verify-work`, `workstreams`

## Intentionally Added Commands

These commands are not part of the original 53-command retained baseline, but
they are explicitly approved Blueprint additions rather than silently revived
legacy omissions:

- `impact`: advisory blast-radius analysis for proposed or actual changes,
  planned as `/blu-impact` in Wave 4 `Quality And Shipping`.

`impact` does not weaken the strict omit policy. It is a new Blueprint-native
advisory workflow for evidence-backed review confidence, not an omitted legacy
command returning under a different name.

## Removed Or Omitted Commands

### Explicitly removed

- `eval-review`

### Omitted from Blueprint v1 planning

- `analyze-dependencies`
- `audit-uat`
- `autonomous`
- `forensics`
- `import`
- `intel`
- `join-discord`
- `list-workspaces`
- `manager`
- `plant-seed`
- `profile-user`
- `scan`
- `session-report`
- `stats`
- `thread`

## Important Runtime Boundaries

For the runtime-level command matrix and hook coverage, see `docs/RUNTIME-REFERENCE.md`.

### `help`, `progress`, `next`, and `do`

These remain host-native router flows. They do not depend on slash-command chaining inside the runtime.

### `config.json` and saved defaults

Blueprint stores normalized repo config in `.blueprint/config.json` and user defaults in `~/.<host>/blueprint/defaults.json`. It persists repo config in fully materialized form and keeps the same hardcoded-defaults -> user-defaults -> repo-config -> flag precedence model.

The shared config contract also reserves these effectiveness-spine keys and enum values ahead of runtime support:
- `ux.progress_mode`: `quiet | stage | checklist`
- `ux.structured_confirmations`: `auto | required`
- `ux.user_checkpoints`: `off | phase | plan`
- `orchestration.task_tracker`: `off | auto`
- `research.external_sources`: `off | ask | auto`

Those keys stay host-portable. `S8.1` locked the names and enum values, and `S8.2` adds runtime normalization, defaults precedence, and persistence through the existing config MCP path without changing hook ownership or command-routing boundaries.

### Hook config

Repo config does not own hook toggles. Blueprint hooks stay advisory and are configured only through extension-owned `hooks/hooks.json`, not through `.blueprint/config.json`.

### `update`

`/blu-update` is advisory. It prepares a safe out-of-band update plan instead of self-updating the extension from the running session.

### `reapply-patches`

`/blu-reapply-patches` operates on a global patch registry in `~/.<host>/blueprint/patches/`, not on a copied extension install tree.

### `new-workspace` and `remove-workspace`

These rely on a global registry at `~/.<host>/blueprint/workspaces.json`. Blueprint intentionally omits `list-workspaces` as a first-class v1 command.

### Worktree isolation versus workspace/workstream toggles

Blueprint keeps execution-isolation config as `workflow.use_worktrees`. The temporary Blueprint-only ideas `workflow.use_workspaces` and `workflow.use_workstreams` do not survive into the normalized repo config because workspace and workstream behavior is command-owned rather than global-config-owned.

### `note`

Blueprint v1 planning keeps notes project-local. Global note capture is out of scope because it conflicts with the locked global-state boundary.

### `map-codebase`

Blueprint keeps `map-codebase` as the sole brownfield-mapping command. `scan` and `intel` do not reappear as separate user commands.

## Porting Principle

Blueprint is a dual-host redesign that keeps the methodology, command vocabulary, and artifact rhythm where that still serves the user.
