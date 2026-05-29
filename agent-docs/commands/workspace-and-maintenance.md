# Workspace And Maintenance Commands

Workspace and maintenance commands manage workspaces, workstreams, updates,
cleanup, and patch replay.

Commands:

- `/blu-new-workspace`
- `/blu-remove-workspace`
- `/blu-workstreams`
- `/blu-update`
- `/blu-cleanup`
- `/blu-reapply-patches`

## Source Surfaces

- Maintenance skill and command-specific runtime references.
- Workspace, update, state, patch, and artifact report MCP tools.
- Runtime host helpers for host-global paths.
- Git-related helpers and tests.

## Invariants

Do:

- Require explicit confirmation for workspace creation/removal, cleanup, and
  patch replay when the command contract requires it.
- Keep `update` advisory and non-self-mutating.
- Keep workspace registry and patch registry writes inside owning MCP tools.
- Report selected paths, registry paths, patch ids, and skipped blockers.
- Use `gh` or plain `git` for repository write operations.
- Keep named waiting states visible, such as `clean-working-tree`,
  `remove-workspace-confirmation`, `workstream-switch-confirmation`,
  `cleanup-confirmation`, and `update-mode-gate`.

Do not:

- Delete workspaces or archived phases without a confirmed target.
- Mutate installed extension directories.
- Write host-global registry files by hand.
- Replay patches across ambiguous or dirty state.
- Invent new registries: workspace registry is host-global, workstreams are
  project-local, and patch replay owns host-global patch registry state.

## Maintenance Pitfalls

- Workspace creation must reject installed-extension paths, dirty source repos,
  and target conflicts.
- Workspace removal must verify manifests, registry state, and member
  cleanliness before deleting.
- Cleanup must protect the current phase and active roadmap references.
- Patch replay must dry-run before confirmed replay.
- Update writes update plans only and requires restart guidance for real
  extension changes.

## Verification

Use focused tests such as:

- `tests/workspace-tools.test.ts`
- `tests/workstream-tools.test.ts`
- `tests/workstreams-metadata.test.ts`
- `tests/new-workspace-metadata.test.ts`
- `tests/remove-workspace-metadata.test.ts`
- `tests/update-tools.test.ts`
- `tests/update-metadata.test.ts`
- `tests/cleanup-tools.test.ts`
- `tests/cleanup-behavior.test.ts`
- `tests/reapply-patches-metadata.test.ts`
- `tests/patch-tools.test.ts`
