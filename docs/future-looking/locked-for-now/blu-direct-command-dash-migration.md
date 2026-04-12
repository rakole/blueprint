# Staged `/blu:` to `/blu-` Direct Command Migration

## Summary

- Planned doc destination: `docs/future-looking/locked-for-now/blu-direct-command-dash-migration.md`; create that folder in the prep slice and store this plan there.
- Migrate only direct commands from `/blu:<command>` to `/blu-<command>`. Keep the root router `/blu` unchanged, and keep `/blu <command>` as the router-style form.
- Roll this out in three slices: prep, dual-surface release, cleanup. Keep `/blu:<command>` working for exactly one release after `/blu-<command>` ships, then remove it.

## Key Changes

- Prep slice:
  - Introduce a single command-path helper layer for root, primary direct, compatibility direct, and router forms so manifests, MCP catalog output, state next actions, skills, docs, and tests stop hardcoding `/blu:`.
  - Refactor `src/mcp/tools/project.ts` so `blueprint_command_catalog` still returns the same schema, but canonical command strings, aliases, and manifest paths come from centralized helpers instead of inline string construction.
  - Refactor `src/mcp/tools/state.ts` and any shared prompt/rendering code so next-action text can switch formats once, without another repo-wide rewrite later.
  - Add a focused install/runtime proof that Gemini resolves top-level `commands/blu-help.toml` as `/blu-help` while `commands/blu.toml` still registers `/blu`.

- Dual-surface release:
  - Keep `commands/blu.toml` as the `/blu` root router.
  - For currently shipped direct commands, add new primary manifests at `commands/blu-<command>.toml`.
  - Keep the existing `commands/blu/<command>.toml` manifests for one release as compatibility wrappers or mirrored manifests; they must redirect language and recommendations to the dash form and stay behaviorally aligned with the new primary manifest.
  - Do not create new runtime manifests for planned or blocked commands just for naming parity; update only their docs and templates so implemented-only routing remains intact.
  - Flip canonical runtime output to dash form: `blueprint_command_catalog.commands[*].command`, `manifestPath`, help/progress/next recommendations, `STATE.md` next-action text, command prompts, skill examples, and interactive help should all prefer `/blu-<command>`.
  - During the compatibility release, keep `/blu:<command>` in `aliases`, alongside `/blu <command>`.
  - Update active docs in the same slice: `README.md`, `GEMINI.md`, `AGENTS.md`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/MCP-TOOLS.md`, `docs/MIGRATION-FROM-GSD.md`, `docs/commands/*.md`, and `docs/commands/_template.md` should present `/blu-<command>` as primary and `/blu:<command>` as deprecated-for-one-release compatibility.
  - Preserve existing command status semantics and the implemented-only routing gate.

- Cleanup slice after one release:
  - Remove `/blu:<command>` manifests, alias emission, deprecated examples, and colon-specific compatibility logic.
  - Keep `blueprint_command_catalog` schema unchanged, but trim aliases down to supported non-primary forms such as `/blu <command>`.
  - Remove deprecation copy from active docs and keep only a short historical note in migration or release-history docs.
  - Update staging/install expectations so the shipped bundle and interactive help advertise only `/blu` plus `/blu-<command>`.

## Test Plan

- Prep slice:
  - Add unit tests for centralized command-path rendering, catalog alias generation, and manifest-path selection.
  - Add one install/runtime fixture proving `commands/blu-help.toml` registers `/blu-help` while `commands/blu.toml` still registers `/blu`.

- Dual-surface release:
  - Update catalog tests to expect canonical `/blu-<command>` values plus `/blu:<command>` aliases.
  - Update state, help, progress, next, and metadata tests to expect dash-form next actions and recommendations.
  - Add compatibility tests proving `/blu-<command>` and `/blu:<command>` execute the same command contract during the transition release.
  - Update install-bundle and container smoke tests to require `/blu` and `/blu-help` in interactive output, and add one explicit colon-form invocation smoke test before removal.
  - Update doc contract tests to reject stale primary `/blu:` examples outside the intentional deprecation note.

- Cleanup slice:
  - Remove colon-form compatibility coverage and add assertions that active docs, shipped bundle paths, and catalog aliases no longer expose `/blu:<command>`.

## Assumptions

- This is a punctuation migration only: `/blu` stays the product namespace and root router.
- `/blu:<command>` remains supported for exactly one release after `/blu-<command>` ships.
- Active product docs stay unchanged until the dual-surface slice lands; before that, only the locked future-looking plan doc is added.
- Planned and blocked commands get doc/template updates early, but no new live manifests until their own runtime slice ships.
