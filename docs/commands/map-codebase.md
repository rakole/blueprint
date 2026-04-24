# `/blu-map-codebase`
| Field | Value |
|---|---|
| Wave | `0` |
| Family | `Foundation` |
| Execution profile | `long-running-mutation` |
| Root-routable | Yes. The root `/blu` router may dispatch here directly. |

## Shared Runtime Contract

- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- `map-codebase` uses the shared long-running-mutation posture for read-heavy brownfield mapping: resolve the repo root and requested focus area, read project status plus the canonical codebase-bundle contract, decide reuse-versus-refresh gates before any overwrite, execute deterministic repo evidence collection and rich canonical authoring, persist the seven-document bundle through MCP only, validate the resulting bundle, and route to the next safe implemented command.
- The command reads `contract.authoringTemplate` through `blueprint_artifact_contract_read`; that template is the heading authority, while `skills/blueprint-map/references/map-runtime-contract.md` is the evidence-density and richness authority.
- Keep the in-flight mapping posture honest while the run is live:
  - resolved scope: repo root, full-repo mapping versus focused deepening, and the seven-artifact bundle target
  - active stage: the current shared stage label behind the mapping pass
  - pending gate: Blueprint initialization blocker, reuse-versus-refresh confirmation, replace confirmation, or validation blocker
  - execution mode: full-bundle mapping versus focus-area deepening, plus reuse-default versus confirmed refresh
  - next safe action: the authoritative follow-up from project status after validation, usually `/blu-progress` or the next documented discovery or planning step

## Purpose

`map-codebase` is Blueprint's command for analyzing a brownfield codebase with mapper-style passes and producing durable codebase documents. In Blueprint it stays host-native, delegates persistence to documented MCP tools, and keeps the brownfield contract explicit without reviving omitted commands such as `scan` or `intel`. When a focus area is supplied, the command deepens that subsystem while still producing the full seven-artifact bundle.

## Command Path And Examples

- CLI command path: `/blu-map-codebase`
- Root router form: `/blu map-codebase`
- Argument hint: `[optional: specific area to deepen, e.g., 'api', 'auth', or 'mcp']`
- `/blu-map-codebase auth`
- `/blu map-codebase`

## Inputs, Project State, And Prerequisite Artifacts

- Default brownfield path: run before `new-project` when the repo already contains substantive implementation or build structure and no valid codebase map exists.
- In that map-first path, `map-codebase` may be the first Blueprint write and may create only the seven `.blueprint/codebase/*.md` artifacts.
- Greenfield and scaffold-only uninitialized repos should route to `new-project` instead.
- Brownfield intent should still be explicit: do not silently replace existing codebase docs and do not hide the mapping step behind another command.
- Prefer Gemini CLI's built-in `ask_user` dialog for any reuse-versus-refresh or replace confirmation gate.

## Outputs

- User-facing result: a concise completion summary plus the next logical action when applicable.
- Repo side effects: Writes the declared Blueprint artifacts and may also mutate code or git state when the command owns that behavior.
- Existing codebase docs should be reused by default. If they are heavily edited and the user wants a refresh or replace path, use `ask_user` to confirm the choice before any overwrite.
- In-flight mapping should keep the resolved scope, active stage, pending gate, execution mode, and next safe action legible until the bundle is validated or the command stops on a confirmation gate.
- Output should be GSD-quality in practical depth while staying Blueprint-native: every artifact should include concrete repo paths, evidence-backed claims, and prescriptive guidance where future planning or execution agents need it.

## Behavior Stages

1. `Resolve`: confirm the repo root, detect an optional focus area, allow brownfield map-codebase to be the first `.blueprint/` write, and stop early only for greenfield/scaffold-only uninitialized repos or broken partial core state.
2. `Read`: inspect project status, the canonical codebase-bundle contract, any existing codebase artifacts, and deterministic repo evidence inputs before any overwrite decision.
3. `Decide`: keep reuse-versus-refresh posture explicit, default to reuse, and require `ask_user` confirmation for replace or refresh behavior when existing docs are heavily edited.
4. `Execute`: collect repo evidence and produce rich canonical, path-backed mapping drafts for the same seven-artifact bundle whether the run is full-repo or focus-area deepening.
5. `Persist`: create or reuse scaffolds and persist substantive authored content through `blueprint_codebase_artifact_write` only, repairing any artifact whose write result is `status: "invalid"` before moving on.
6. `Validate`: run `blueprint_artifact_validate` against the resulting bundle and surface warnings honestly.
7. `Route`: summarize created versus reused artifacts and end on the next safe implemented follow-up. A successful map-first brownfield pass leaves the repo `mapped-only` and routes to `/blu-new-project`.

## Blueprint And Global State Reads

- none

## Blueprint And Global State Writes

- `.blueprint/codebase/STACK.md`
- `.blueprint/codebase/ARCHITECTURE.md`
- `.blueprint/codebase/STRUCTURE.md`
- `.blueprint/codebase/CONVENTIONS.md`
- `.blueprint/codebase/TESTING.md`
- `.blueprint/codebase/INTEGRATIONS.md`
- `.blueprint/codebase/CONCERNS.md`

## Required MCP Tools

- `blueprint_project_status` -> `{initialized, currentPhase, currentMilestone, nextAction, health}`
- `blueprint_artifact_scaffold` -> `{createdFiles, reusedFiles, warnings}`
- `blueprint_artifact_list` -> `{artifacts, reports, missing}`
- `blueprint_artifact_summary_digest` -> `{digest, inputsUsed}`
- `blueprint_codebase_artifact_write` -> `{path, artifactId, written, created, overwritten, reused, status, issues, warnings}`
- `blueprint_artifact_contract_read` -> `{artifactId, contract}` or `{artifactId: null, contracts}`
- `blueprint_artifact_validate` -> `{valid, issues, suggestedRepairs, warnings}`

## Mapping Artifact Contract

- Use `blueprint_artifact_scaffold` only with the seven supported repo-relative codebase artifact paths under `.blueprint/codebase/`. Bare names and absolute paths are invalid.
- Treat scaffold output as seeding or reuse only; the authored mapping content still needs to match the real repo evidence.
- Persist substantive mapping content through `blueprint_codebase_artifact_write` using canonical codebase artifact ids instead of raw file writes.
- Read the canonical codebase-bundle contract before any scaffold or refresh decision. Use `contract.authoringTemplate` as the canonical heading authority and normalize invalid drafts back to that template before retrying a write.
- Pass only repo-relative evidence inputs to `blueprint_artifact_summary_digest`.
- Treat the returned `inputsUsed` list as the authoritative digest scope.
- Treat `skills/blueprint-map/references/map-runtime-contract.md` as the runtime-heavy local reference for rich canonical authoring, concrete repo-path evidence, capability-gated mapper delegation, the no-subagent fallback, and per-artifact repair.

## Authoring Modes

- Capability-gated subagents: if the host exposes a suitable code-analysis subagent or task mechanism, run bounded mapper lanes for tech, architecture, quality, and concerns using `blueprint-mapper`. Browser, web, generic page-inspection, or search-only agents must not be used as substitutes.
- Single-agent fallback: if code-analysis subagents are unavailable, author exactly one artifact at a time in this order: `STACK.md`, `STRUCTURE.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, `TESTING.md`, `INTEGRATIONS.md`, `CONCERNS.md`.
- After each single-agent artifact write, keep only a compact carry-forward note: file path, write status, key evidence roots, and unresolved warnings. Do not re-read or restate prior completed artifact bodies unless repair requires it.
- If `blueprint_codebase_artifact_write` returns `status: "invalid"`, repair the same artifact from returned `issues` plus `contract.authoringTemplate`, then retry that artifact before moving on.

## Skills And Subagents

- Primary skill: `blueprint-map`
- Local runtime reference:
- `skills/blueprint-map/references/map-runtime-contract.md`
- Optional subagents:
- `blueprint-mapper`

## Dependencies

- Shared contract docs:
- `docs/DECISIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/IMPLEMENTATION-ORDER.md`
- Related command docs:
- `docs/commands/new-project.md`

## External Shell Or Git Dependencies

- External dependencies:
- git
- rg

## Shell Risk Profile

- Medium: refresh mode can replace existing codebase-mapping artifacts.

## User Prompts And Confirmation Gates

- Confirm replacing heavily edited mapping docs.
- Reuse existing codebase docs by default and require explicit confirmation for replace or refresh behavior.

## Edge Cases

- The repo already contains a partial `.blueprint/` tree from an earlier attempt.
- The command is invoked from a nested directory rather than the repo root.

## Failure Modes And Recovery

- Stop with a precise repo-root or config-path error instead of guessing.
- Preserve existing Blueprint artifacts unless the user explicitly confirms replacement.

## Acceptance Criteria

- Uses only documented MCP tools for persistent state changes.
- Leaves unrelated repo files untouched.
- Creates or updates only the declared artifacts for this command.
- Produces the seven-document codebase bundle, including `STRUCTURE.md`.
- Produces evidence-density and rich canonical authoring: each artifact contains concrete repo paths and practical, evidence-backed guidance rather than terse generic summaries.
- On uninitialized brownfield repos, creates no core bootstrap artifacts and leaves the repo in `mapped-only` when validation passes.

## Test Cases

- Uninitialized brownfield fixture.
- Interrupted or invalid codebase-only fixture.
- Partially initialized Blueprint repo fixture.
- Direct `map-codebase` happy-path fixture.
