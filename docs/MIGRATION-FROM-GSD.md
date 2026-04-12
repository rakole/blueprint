# Migration From GSD To Blueprint

## Naming And Path Translation

| GSD | Blueprint |
|---|---|
| `/gsd:<command>` or `/gsd-<command>` | `/blu-<command>` |
| `/gsd` mental model | `/blu` root router |
| `.planning/` | `.blueprint/` |
| installer-managed runtime conversion | Gemini extension installation |
| workflow markdown files plus installer copies | Gemini-native skills, agents, hooks, and MCP contracts |

## Retained Commands

All retained commands keep their upstream intent but move to Blueprint naming and `.blueprint/` storage.

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

## Important Behavioral Changes

For the runtime-level porting matrix that maps retained workflow behavior and hook surfaces into Blueprint destinations, see `docs/GSD-RUNTIME-MIGRATION.md`.

### `help`, `progress`, `next`, and `do`

These remain Gemini-native router flows. They do not depend on slash-command chaining inside the runtime.

### `config.json` and saved defaults

GSD's `.planning/config.json` and `~/.gsd/defaults.json` become Blueprint's normalized `.blueprint/config.json` and `~/.gemini/blueprint/defaults.json`. Blueprint persists the repo config in fully materialized form and keeps the same hardcoded-defaults -> user-defaults -> repo-config -> flag precedence model.

### Hook config

Upstream-style repo config hook toggles do not carry over. Blueprint hooks stay advisory and are configured only through extension-owned `hooks/hooks.json`, not through `.blueprint/config.json`.

### `update`

`/blu-update` is advisory. It prepares a safe out-of-band update plan instead of self-updating the extension from the running session.

### `reapply-patches`

`/blu-reapply-patches` operates on a global patch registry in `~/.gemini/blueprint/patches/`, not on a copied extension install tree.

### `new-workspace` and `remove-workspace`

These rely on a global registry at `~/.gemini/blueprint/workspaces.json`. Blueprint intentionally omits `list-workspaces` as a first-class v1 command.

### Worktree isolation versus workspace/workstream toggles

Blueprint keeps execution-isolation config as `workflow.use_worktrees`, aligned with GSD's executor behavior. The temporary Blueprint-only ideas `workflow.use_workspaces` and `workflow.use_workstreams` do not survive into the normalized repo config because workspace and workstream behavior is command-owned rather than global-config-owned.

### `note`

Blueprint v1 planning keeps notes project-local. The upstream global-note behavior is not planned for v1 because it conflicts with the locked global-state boundary.

### `map-codebase`

Blueprint keeps `map-codebase` as the sole brownfield-mapping command. Upstream `scan` and `intel` do not reappear as separate user commands.

## Porting Principle

Blueprint is not a transliteration of GSD's install-time conversion layer. It is a Gemini-first redesign that keeps the methodology, command vocabulary, and artifact rhythm where that still serves the user.
