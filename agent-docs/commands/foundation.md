# Foundation Commands

Foundation commands initialize, inspect, configure, and route Blueprint.

Commands:

- `/blu`
- `/blu-help`
- `/blu-progress`
- `/blu-next`
- `/blu-new-project`
- `/blu-map-codebase`
- `/blu-health`
- `/blu-settings`
- `/blu-set-profile`

## Source Surfaces

- Root and direct command manifests in `commands`.
- Router, bootstrap, governance, and map skills under `skills`.
- Project, config, state, artifact, and command catalog tools under `src/mcp`.
- Runtime metadata for router and bootstrap commands.
- Help, progress, health, map, settings, and catalog tests.

## Invariants

Do:

- Keep `/blu`, help, progress, and next implemented-only.
- Route brownfield repositories through map-first behavior when required.
- Use MCP tools for config, state, project status, and artifact writes.
- Keep `/blu-new-project` map-aware and `.blueprint/codebase` preserving.

Do not:

- Recommend planned commands as runnable.
- Treat README command lists as availability truth.
- Repair state through raw file writes when an MCP tool owns the repair.

## Verification

Use focused tests such as:

- `tests/command-catalog.test.ts`
- `tests/help-progress-health.test.ts`
- `tests/router-pilot-regression.test.ts`
- `tests/new-project.test.ts`
- `tests/new-project-metadata.test.ts`
- `tests/map-codebase.test.ts`
- `tests/settings-profile.test.ts`
- `tests/config-contract-metadata.test.ts`
