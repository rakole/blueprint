# `/blu-update`
| Field | Value |
|---|---|
| Wave | `5` |
| Family | `Workspace And Maintenance` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |
| Execution profile | `interactive-read` |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `update` uses the shared interactive-read classification only to keep the command metadata aligned; it performs read-only install discovery plus a bounded host-global checklist write, keeps extension-path handling read-only, and does not adopt tracker-backed branching or long-running progress tools.
- Keep the waiting state explicit as `update-mode-gate` while the command is choosing between a saved checklist and a manual fallback view.

## Purpose

`update` is Blueprint's advisory maintenance command for inspecting the installed Blueprint extension and preparing a safe out-of-band update checklist. In Blueprint it remains host-native and non-self-mutating: it reads the active host and install provenance, checks whether a newer version appears available, persists only host-global update metadata under `~/.<host>/blueprint/updates/`, and always leaves restart guidance explicit because the running host session will not hot-reload a new extension bundle.

## Command Path And Examples

- CLI command path: `/blu-update`
- Root router form: `/blu update`
- Argument hint: `none`
- `/blu-update`
- `/blu update`

## Inputs, Project State, And Prerequisite Artifacts

- No project-local Blueprint state is required.
- The active host runtime should provide the installed extension path through Blueprint's launch environment.
- Latest-version lookup may be unavailable when the install provenance is ambiguous, the remote source is unsupported, or network access is unavailable.
- The saved checklist versus manual-fallback mode gate should stay explicit before Blueprint persists host-global update metadata.

## Outputs

- User-facing result: a concise advisory summary plus a saved checklist path or manual fallback guidance when applicable.
- Repo side effects: none.
- Host-global side effects: may write advisory update metadata and a human-readable checklist under `~/.<host>/blueprint/updates/`.
- In-flight posture: keep the resolved scope, active stage, pending gate, execution mode, and next safe action legible while the command is still deciding whether to persist the checklist.

## Blueprint And Global State Reads

- installed extension path and host identity from runtime launch context
- host-specific extension manifest and package metadata when present
- install provenance from the installed extension's git metadata when present
- latest-version lookup source when supported by the install provenance

## Blueprint And Global State Writes

- `~/.<host>/blueprint/updates/update-plan-latest.json`
- `~/.<host>/blueprint/updates/update-plan-latest.md`

## Required MCP Tools

- `blueprint_update_check` -> `{host, extensionPath, extensionManifestPath, installedVersion, installProvenance, latestVersionLookupStatus, latestVersion, latestVersionSource, updateAvailable, warnings}`
- `blueprint_update_plan` -> `{mode, steps, notes, requiresRestart, savedPaths, status}`

## Update Discovery And Persistence Contract

- Always call `blueprint_update_check` first and treat its returned host, extension path, installed version, install provenance, latest-version lookup status, update availability, and warnings as authoritative.
- Keep extension-path handling read-only. `/blu-update` must never write into the installed extension directory or mutate the running extension bundle in-session.
- Persist advisory checklist data only through `blueprint_update_plan`, and keep every Blueprint-owned write under `~/.<host>/blueprint/updates/`.
- Treat the returned `savedPaths.updatesDir`, `savedPaths.metadataPath`, and `savedPaths.checklistPath` as authoritative saved locations.
- Latest-version lookup failure is not a command failure by itself. The fallback contract is to keep the manual update path explicit and still provide a deterministic checklist or summary.

## In-Flight Progress Contract

- Keep the shared stage vocabulary visible only for the stages the update run actually reaches.
- Keep the waiting state explicit whenever update planning is blocked before persistence: the saved-checklist versus manual-fallback choice should surface as `update-mode-gate`.
- Keep that visible progress aligned to the resolved host, extension path, installed version, install provenance, latest-version lookup status, execution mode, saved-path posture, and next safe action while the run moves from discovery through the mode gate, checklist persistence, validation guidance, and restart routing.
- Execution mode should distinguish manual-fallback-only guidance from a saved checklist run.

## Skills And Subagents

- Primary skill: `blueprint-maintenance`
- Optional subagents: none

## Dependencies

- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/GEMINI-CONSTRAINTS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- none

## External Shell Or Git Dependencies

- External dependencies:
- network access for latest-version lookup when the install provenance supports it
- read-only git metadata inspection when the installed extension lives in a git checkout

## Shell Risk Profile

- Low: advisory only; no in-session self-update.

## Risk Notes

- Host extension updates happen outside the running interactive session, so `/blu-update` must remain advisory rather than self-mutating.
- The command should never write into the installed extension directory or assume a writable installation target.
- Host-global persistence must stay limited to `~/.<host>/blueprint/updates/`; do not create repo-local update artifacts under `.blueprint/`.
- The command should keep manual fallback guidance explicit when the latest-version lookup cannot prove a current remote version.
- Any saved update checklist should end with restart guidance because extension changes load on the next session start.

## User Prompts And Confirmation Gates

- Prefer Gemini CLI's built-in `ask_user` dialog for the saved-checklist versus manual-fallback mode gate when a structured choice helps.
- When `ask_user` is unavailable, keep the same mode gate explicit in prose instead of implying the structured helper ran.
- Keep the mode-gate waiting state visible as `update-mode-gate` until the user explicitly chooses saved checklist versus manual fallback when the intent is not already clear.

## Edge Cases

- Blueprint may be installed from GitHub, a local path, or a non-GitHub git remote, so update advice must reflect the actual install source.
- Latest-version lookup may be unavailable offline, against an unsupported remote, or when the installed extension has no usable provenance metadata.
- The installed extension path may be missing, unreadable, or no longer present on disk.
- Installed and latest versions may not both be semver-shaped, in which case update availability should stay explicit as unknown.

## Failure Modes And Recovery

- Stop claiming version precision when install provenance or remote lookup is unavailable; switch to the manual fallback path instead.
- Do not mutate the installed extension directory.
- Do not invent repo-local update artifacts or writes outside `~/.<host>/blueprint/updates/`.
- If the host-global checklist write fails, report the blocker honestly and still return the manual update steps without pretending the checklist was saved.

## Acceptance Criteria

- Reads the active host, extension path, installed version, install provenance, latest-version lookup status, update availability, and warnings through `blueprint_update_check`.
- Persists only the intended host-global update metadata and checklist under `~/.<host>/blueprint/updates/`.
- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Keeps the `interactive-read` execution profile, shared stage vocabulary, and in-flight status fields visible when the run is active or waiting.
- Uses Gemini-native `ask_user` only as a saved-checklist versus manual-fallback mode gate and states the prose fallback when `ask_user` is unavailable.
- Keeps the manual fallback explicit whenever latest-version lookup is unavailable.
- Always includes restart guidance after the out-of-band update path.
- Never mutates the installed extension directory from inside the running host session.

## Test Cases

- Installed-extension fixture with readable manifest metadata.
- Manual-fallback fixture where latest-version lookup is unavailable.
- Host-global persistence fixture that writes only under `~/.<host>/blueprint/updates/`.
- Direct `update` happy-path fixture that returns saved-path metadata plus restart guidance.
