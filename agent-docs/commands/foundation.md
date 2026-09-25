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
`blueprint_map_submit`, with the same two tools serving ordinary compatibility
output and explicit portable format v1. Prepare captures evidence and target
freshness, readiness, effective config, existing bundle status, and the actual
authoring schema/example. Select evidence paths before prepare and read their
contents afterward; expand the prepared selection before using additional
evidence. Ordinary valid maps are reused without generation by default. Portable
mode requires an explicit `formatVersion: 1` request and does not silently upgrade
legacy maps. Its prepare receipt carries an opaque operation id, bounded packet,
and continuation cursor; the complete seven-document plus semantic model is
submitted through the same parent-owned finalizer. Explicit refresh/upgrade/focus
authority controls replacement; do not add manual-edit detection or a routine
reuse/refresh question.

The parent owns publication; optional mapper lanes are read-only and require
effective subagent config plus an independent analysis benefit. No scaffold,
digest, seven separate writes, multipart tool, or final validation call belongs in
the normal path. The raw portable authored model is capped at 48 KiB; richer
requests must be narrowed or reported unsupported, with no silent omissions.
Rejected content stays out of persistence and logs. Interrupted accepted portable
publication retries the exact operation/model and lets the owning tool finish
committed cleanup; stale evidence or target requires reprepare, and unknown
markers stop recovery. Portable `INDEX.md` generation validity and root-seven
compatibility completeness are separate; root-seven views are not independently
mutated while portable mode is active. If inputs changed or the model is
unavailable, use the owning tool's fresh prepare/repair guidance and submit a
complete model. Rejection leaves canonical files intact. The owning tools scrub
legacy mapping payloads from the failure log while preserving unrelated entries;
no map draft session exists.

Portable transfer is `INDEX.md` plus its referenced complete immutable generation
with relative paths; root-seven views are optional. Sessions, receipts, operation
state, keys, and rejected diagnostics are excluded. Generic readers use ordinary
file read/search, verify selected claims against live source, and treat the map as
generated from a baseline with current-tree freshness unverified. Consumption never
regenerates the map and administrative commands do not require map reads. Optional
instruction linking is explicit, owning-tool-managed, hash/CAS guarded, byte and
newline preserving, and symlink safe. Do not add consumer-skill pointers here.

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
