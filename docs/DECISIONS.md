# Blueprint Decisions

This file records the product and architecture decisions that are locked for the docs-first phase.

## Locked Decisions

1. `BP-001` Brand and namespace
   Blueprint replaces GSD naming. User-facing command names are `/blu` and `/blu:<command>`.

2. `BP-002` Project state directory
   `.planning/` becomes `.blueprint/` in every Blueprint-managed repository.

3. `BP-003` Install model
   Blueprint is installed as a Gemini CLI extension from GitHub, not by a custom npm installer.

4. `BP-004` Delivery strategy
   The current milestone is documentation only. No runtime conversion or extension scaffolding is created in this pass.

5. `BP-005` Hybrid command surface
   Every retained command gets a direct `/blu:<name>` entry, and the root `/blu` router can route to all of them.

6. `BP-006` Retained command set
   Only the 53 retained commands listed in `README.md` and `docs/MIGRATION-FROM-GSD.md` are in scope for Blueprint v1 planning.

7. `BP-007` Strict omit policy
   Omitted upstream commands are not exposed as first-class Blueprint commands in v1 planning.

8. `BP-008` `eval-review` removal
   `eval-review` is explicitly removed from the retained-command plan.

9. `BP-009` State engine boundary
   Stateful operations are owned by an extension-bundled MCP server. Commands, skills, and agents orchestrate; they do not own persistence logic.

10. `BP-010` Global state boundary
    Global mutable state is allowed only under `~/.gemini/blueprint/` and only for non-project concerns such as workspace registry, update metadata, and patch registry.

11. `BP-011` Project-state ownership
    Project concerns live in `.blueprint/`, including roadmap, state, phases, reports, backlog, todos, notes, codebase mapping, and workstreams.

12. `BP-012` VCS default
    `.blueprint/` is committed by default unless a repo intentionally opts into private planning later.

13. `BP-013` Hook policy
    Only advisory hooks are planned for v1: read-before-edit, `.blueprint` write guard, and workflow advisory.

14. `BP-014` No statusline dependency
    Blueprint will not depend on statusline injection, context-bridge files, or settings mutation for a status bar.

15. `BP-015` No extension self-mutation
    Blueprint commands do not rewrite the installed extension from inside Gemini.

16. `BP-016` `update` behavior
    `/blu:update` is an advisor/checklist command because Gemini extension updates happen outside the active CLI session.

17. `BP-017` `reapply-patches` behavior
    `/blu:reapply-patches` uses a global patch registry in `~/.gemini/blueprint/patches/`; it does not patch the installed extension copy directly.

18. `BP-018` Workspace strategy
    `new-workspace` and `remove-workspace` remain supported without `list-workspaces`. The default workspace root is `~/blueprint-workspaces/<name>`, backed by `~/.gemini/blueprint/workspaces.json`.

19. `BP-019` Workstream scope
    `workstreams` is project-local and stores its state under `.blueprint/workstreams/`.

20. `BP-020` Brownfield mapping scope
    `map-codebase` is the only planned brownfield-mapping command. Omitted `scan` and `intel` are not folded into new user-visible commands.

21. `BP-021` Review portability
    `review` remains first-class and supports optional external-CLI reviewers with graceful degradation when peer CLIs are unavailable.

22. `BP-022` GitHub shipping
    `ship` may rely on `gh` if available and authenticated, but must define a safe fallback when GitHub CLI access is missing.

23. `BP-023` Router behavior
    Router-style commands such as `help`, `progress`, `next`, and `do` are planned as inline Gemini-native routers, not as slash-command chain callers.

24. `BP-024` Docs as implementation contract
    Every retained command must have its own spec in `docs/commands/<name>.md` before code work starts on that command.

25. `BP-025` Config layering and defaults
    `.blueprint/config.json` is the canonical repo-level Blueprint config and is stored in normalized full form. Optional user defaults live only in `~/.gemini/blueprint/defaults.json`, with effective config precedence of hardcoded defaults, then user defaults, then repo config, then command flags.

26. `BP-026` Hook config boundary
    Repo config does not enable or disable Blueprint hooks. Hook configuration lives in `hooks/hooks.json`, while `.blueprint/config.json` carries only project workflow, git, safety, and maintenance settings.
