# Contract Drift And Consistency Audit

Date: 2026-05-04

Scope: README, AGENTS.md, docs, command catalog, command manifests, skills, agents, MCP tools, artifact contracts, generated schema assets, and tests.

Mode: discovery only. No source fixes were made.

## Executive Summary

The core command substrate is mostly aligned: the live `blueprint_command_catalog` reports 54 retained catalog entries, with 53 implemented and only `/blu-do` non-routable (`planned` in docs, runtime `repairing` because `commands/blu-do.toml` is missing). A scan of `commands/*.toml` found no mismatch between manifest MCP FQNs and live catalog `requiredTools`, and a scan of docs/skills found no unknown `blueprint_*` tool references relative to `src/mcp/server.ts`.

The remaining drift is still worth hardening because it appears in user-facing or maintainer-facing control-plane docs: stale "planned" wording for already implemented maintenance commands, inconsistent risk ratings between `docs/COMMAND-CATALOG.md` and `PROGRESS.md`, missing structured-schema inventory in `docs/ARTIFACT-SCHEMA.md`, stale verification-queue wording for implemented high-risk commands, and one README runtime path that points to a nonexistent skill file.

## Evidence Commands

- `npx tsx -e 'import { blueprintCommandCatalog } ...'` returned `count: 54`, `byStatus: { implemented: 53, repairing: 1 }`, and the only non-implemented entry was `/blu-do` blocked by missing `commands/blu-do.toml`.
- Manifest/catalog scan over `commands/*.toml` found `[]` differences between manifest `mcp_blueprint_blueprint_*` FQNs and catalog `requiredTools`.
- Registered tool scan from `src/mcp/server.ts` found all `blueprint_*` tokens in `README.md`, `AGENTS.md`, `docs/`, `commands/`, and `skills/` were known live tool names.
- Artifact model-contract scan found schema-backed contracts for `review.review-fix` and `report.audit-fix` that are not named in the structured-schema inventory paragraph in `docs/ARTIFACT-SCHEMA.md`.

## Findings

### P1: Some runtime guidance still calls implemented commands planned

Evidence:
- `commands/blu-remove-workspace.toml:17` says not to present "planned-only commands such as `/blu-update` or `/blu-workstreams` as runnable."
- The live catalog reports both `update` and `workstreams` as implemented.
- `PROGRESS.md:82-83` lists `workstreams` and `update` as implemented.
- `docs/COMMAND-CATALOG.md:57` and `docs/COMMAND-CATALOG.md:60` also list `update` and `workstreams` as implemented.
- `skills/blueprint-maintenance/SKILL.md:210` tells `/blu-pr-branch` to give manual PR guidance "when later shipping commands are still planned", but `/blu-ship` is implemented in `docs/COMMAND-CATALOG.md:53` and `PROGRESS.md:78`.
- `docs/GSD-RUNTIME-MIGRATION.md:59` still calls `new-workspace`, `remove-workspace`, and `reapply-patches` planned flows; all three are implemented in `PROGRESS.md:80-85` and `docs/COMMAND-CATALOG.md:34`, `45`, and `43`.

Impact:
- This can suppress safe implemented follow-ups from high-risk maintenance flows or train future prompt edits to keep obsolete planned-command guardrails.

Recommended hardening:
- Add a stale-planned-reference test that fails when prose says "planned" or "not routable" near a command whose live catalog entry is `implemented`, with an allowlist only for historical docs explicitly marked archived.
- Update maintenance prompts and migration docs to say "use catalog status" rather than naming currently implemented commands as planned examples.

### P1: Risk ratings drift between command catalog and progress docs

Evidence from a parsed comparison of `docs/COMMAND-CATALOG.md` and `PROGRESS.md`:
- `verify-work`: catalog risk `Medium` at `docs/COMMAND-CATALOG.md:59`; progress risk `Low` at `PROGRESS.md:49`.
- `fast`: catalog risk `Medium` at `docs/COMMAND-CATALOG.md:24`; progress risk `High` at `PROGRESS.md:59`.
- `explore`: catalog risk `Medium` at `docs/COMMAND-CATALOG.md:23`; progress risk `Low` at `PROGRESS.md:67`.

Impact:
- Risk is used to prioritize rollout, route caution, and decide confirmation posture. Divergence makes the control plane harder to trust and can cause future auditors to chase the wrong commands.

Recommended hardening:
- Make `PROGRESS.md` derive risk from the same source as the runtime catalog, or add a regression that checks command/status/risk parity across `docs/COMMAND-CATALOG.md`, `PROGRESS.md`, and live catalog metadata.

### P2: Structured artifact schema inventory omits shipped model schemas

Evidence:
- `docs/ARTIFACT-SCHEMA.md:61` lists schema-backed model contracts but omits `review.review-fix` and `report.audit-fix`.
- Source defines `review.review-fix` schema metadata at `src/mcp/artifact-contracts/index.ts:1439-1447` and the file exists at `src/mcp/artifact-contracts/schemas/review.review-fix.model.schema.json`.
- Source defines `report.audit-fix` schema metadata at `src/mcp/artifact-contracts/index.ts:2909-2917` and the file exists at `src/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`.
- The command docs already depend on these structured flows: `docs/commands/code-review-fix.md` names schema-first `review.review-fix`; `docs/commands/audit-fix.md` names `report.audit-fix` validation and persistence.

Impact:
- Maintainers using `docs/ARTIFACT-SCHEMA.md` as the schema inventory can miss two important schema-first contracts and under-update tests, generated assets, or report validators.

Recommended hardening:
- Generate the "Structured Model Schema Assets" inventory from `listArtifactContracts().filter(c => c.modelContract?.schemaPath)`.
- Add a doc test that every `modelContract.schemaPath` appears in `docs/ARTIFACT-SCHEMA.md`.

### P2: Runtime reference verification queue uses pre-implementation wording

Evidence:
- `docs/RUNTIME-REFERENCE.md:181-186` keeps `ship`, `undo`, and `remove-workspace` in the "Highest-value behavior audits" queue.
- The same lines say `undo` should be verified "before implementation deepens" and `remove-workspace` should be confirmed "before implementation", even though both are implemented in the live catalog and `PROGRESS.md:79` and `PROGRESS.md:81`.
- Their runtime-reference rows mark them `locked`; `source-owned`; `needs-behavior-audit`, which is a valid evidence state, but the queue wording reads like they are still pre-ship.

Impact:
- The intended message is "implemented but needs behavior audit"; the current wording can be misread as "not implemented yet" and conflicts with the catalog.

Recommended hardening:
- Reword the queue to "implemented; behavior audit still pending" and keep "before implementation" language only for truly non-implemented commands.
- Consider making `needs-behavior-audit` a first-class progress dimension separate from command implementation status.

### P3: README runtime layout includes a nonexistent skill path

Evidence:
- `README.md:34` lists `skills/blueprint-router.md`.
- Actual skill bundles are directory-based (`docs/SKILLS-AND-AGENTS.md` says implemented skills live at `skills/<name>/SKILL.md`), and `rg --files skills | rg 'blueprint-router'` returns `skills/blueprint-router/SKILL.md`.

Impact:
- Low runtime risk because the list is labeled representative, but it is a public onboarding path and contradicts the documented skill bundle convention.

Recommended hardening:
- Replace the README entry with `skills/blueprint-router/SKILL.md`.
- Add a lightweight README path-existence test for backticked repo paths in "Current Runtime Layout".

### P3: High-risk command claims are mostly contract-tested, not behavior-tested

Evidence:
- `tests/ship-metadata.test.ts:14-100` checks that the ship manifest, docs, skill, and runtime resource contain required guardrail text. `tests/ship-metadata.test.ts:102-160` checks report contract shape.
- `tests/undo-metadata.test.ts:14-116` similarly checks text/resource presence; `tests/undo-metadata.test.ts:118-160` checks report contract shape.
- `tests/maintenance-regression.test.ts:16-113` asserts maintenance manifest guardrail strings for high-risk flows, and `tests/maintenance-regression.test.ts:162-195` asserts runtime resource metadata.
- `docs/RUNTIME-REFERENCE.md:181-186` independently acknowledges behavior audits remain pending for several implemented high-risk commands.

Impact:
- The product says these commands are implemented, confirmation-gated, and safe around git/remote/workspace mutation. Current tests strongly protect prompt contracts and report schemas, but they do not prove the LLM-orchestrated command behavior against realistic git/gh/workspace flows.

Recommended hardening:
- Add harness-level behavior simulations for `ship`, `undo`, `pr-branch`, `new-workspace`, `remove-workspace`, and `reapply-patches` that assert preflight stops, confirmation gates, report-before-mutate ordering, and post-mutation report overwrite behavior.
- Keep metadata tests, but label them contract tests so they are not mistaken for end-to-end behavior coverage.

## Positive Alignment Checks

- Live catalog and command manifests are aligned on required MCP tools. The manifest FQN diff returned no missing or extra MCP tool references for cataloged commands.
- Optional agents declared in the live catalog all resolve to available `agents/*.md` definitions.
- All `blueprint_*` tool references in scanned docs, commands, and skills resolve to currently registered tool names.
- README mentions every implemented direct `/blu-*` command; its only non-implemented direct command mention is `/blu-do`, explicitly labeled planned/non-routable.
- Source and dist JSON schema files under `src/mcp/artifact-contracts/schemas/*.json` and `dist/mcp/artifact-contracts/schemas/*.json` compare equal in the current checkout.

## Recommended Hardening Plan

1. Add generated drift checks:
   - catalog/status/risk parity across `docs/COMMAND-CATALOG.md`, `PROGRESS.md`, and live `blueprint_command_catalog`
   - artifact model schema inventory parity between `docs/ARTIFACT-SCHEMA.md` and `listArtifactContracts()`
   - README runtime path existence for listed source paths

2. Add stale-status prose checks:
   - fail on "planned", "not routable", or "not implemented" within a small window of an implemented command name unless the file is historical/archived or the statement explicitly says "previously".

3. Separate implementation from behavior-audit state:
   - keep command status as `implemented`
   - track `needs-behavior-audit` in a separate matrix so progress docs do not regress into pre-implementation language

4. Upgrade high-risk command verification:
   - simulate dirty-tree stops, missing base branch, missing `gh`, report overwrite gates, confirmation denial, successful report-before-mutate, and post-mutation report overwrite for ship/undo/pr-branch/workspace/patch commands.

## Uncertainty

- I did not execute full `npm test` because this task was discovery/reporting only and the strongest evidence needed here came from static contract comparison plus targeted runtime-catalog imports.
- Historical docs such as `docs/GSD-RUNTIME-MIGRATION.md` may intentionally preserve old rollout state, but they are not clearly marked archive-only and are still referenced by tests/docs as contract history, so stale implemented/planned wording is reported as drift.
