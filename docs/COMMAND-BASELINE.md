# Blueprint Command Baseline

## Naming And Path Translation

| Blueprint surface | Runtime destination |
|---|---|
| root router | `/blu` |
| direct command entrypoint | `/blu-<command>` |
| project state directory | `.blueprint/` |
| global operational state | `~/.gemini/blueprint/` |
| workflow contracts | Gemini-native skills, agents, hooks, and MCP tools |

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

These remain Gemini-native router flows. They do not depend on slash-command chaining inside the runtime.

### `config.json` and saved defaults

Blueprint stores normalized repo config in `.blueprint/config.json` and user defaults in `~/.gemini/blueprint/defaults.json`. It persists repo config in fully materialized form and keeps the same hardcoded-defaults -> user-defaults -> repo-config -> flag precedence model.

### Hook config

Repo config does not own hook toggles. Blueprint hooks stay advisory and are configured only through extension-owned `hooks/hooks.json`, not through `.blueprint/config.json`.

### `update`

`/blu-update` is advisory. It prepares a safe out-of-band update plan instead of self-updating the extension from the running session.

### `reapply-patches`

`/blu-reapply-patches` operates on a global patch registry in `~/.gemini/blueprint/patches/`, not on a copied extension install tree.

### `new-workspace` and `remove-workspace`

These rely on a global registry at `~/.gemini/blueprint/workspaces.json`. Blueprint intentionally omits `list-workspaces` as a first-class v1 command.

### Worktree isolation versus workspace/workstream toggles

Blueprint keeps execution-isolation config as `workflow.use_worktrees`. The temporary Blueprint-only ideas `workflow.use_workspaces` and `workflow.use_workstreams` do not survive into the normalized repo config because workspace and workstream behavior is command-owned rather than global-config-owned.

### `note`

Blueprint v1 planning keeps notes project-local. Global note capture is out of scope because it conflicts with the locked global-state boundary.

### `map-codebase`

Blueprint keeps `map-codebase` as the sole brownfield-mapping command. `scan` and `intel` do not reappear as separate user commands.

## Porting Principle

Blueprint is a Gemini-first redesign that keeps the methodology, command vocabulary, and artifact rhythm where that still serves the user.
