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

## Mapping Boundary

Map uses `blueprint_map_prepare` → read selected evidence and author →
`blueprint_map_submit`. Prepare captures evidence and target freshness, readiness,
effective config, existing bundle status, and the actual authoring schema/example.
Select evidence paths before prepare and read their contents afterward; expand
the prepared selection before using additional evidence. Submit compiles canonical
titles/headings, validates the full new/reused bundle before writes, and preserves
the seven `.blueprint/codebase/*.md` consumers. A valid complete map is reused
without generation by default. Explicit refresh already authorizes overwrite;
do not add manual-edit detection or a routine reuse/refresh question.

The parent owns publication; optional mapper lanes are read-only and require
effective subagent config plus an independent analysis benefit. No scaffold,
digest, seven separate writes, or final validation call belongs in the normal
path. Rejected content stays out of persistence and logs. Interrupted accepted
publication uses a metadata-only marker and retries the same snapshot/model.
If inputs changed or the model is unavailable, prepare with restart:true and
submit a complete fresh bundle with overwrite:true. Rejection leaves canonical
files intact. The owning tools scrub legacy mapping payloads from the failure
log while preserving unrelated entries; no map draft session exists.

Missing summary/evidence, placeholders, unsafe content, invalid references,
stale source/target hashes, and unauthorized replacement remain blocking.
Optional sections and short answers need no filler. Heading whitespace/case,
line endings, nested headings and incomplete fences/comments are normalized.
Legacy concise format is advisory, consistently across inspection and consumers.
Do not add failed-draft archives or change downstream canonical artifact paths.

## Verification

Use focused tests such as:

- `tests/command-catalog.test.ts`
- `tests/help-progress-health.test.ts`
- `tests/router-pilot-regression.test.ts`
- `tests/new-project.test.ts`
- `tests/new-project-metadata.test.ts`
- `tests/map-codebase.test.ts`
- `tests/map-publication.test.ts`
- `tests/codebase-authoring.test.ts`
- `tests/map-failure-privacy.test.ts`
- `tests/settings-profile.test.ts`
- `tests/config-contract-metadata.test.ts`
