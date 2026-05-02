---
id: BPBUG-004
title: Tracked built bundle is stale and omits audit-fix generated assets
severity: high
confidence: confirmed
surface: generated assets
status: verified
discovery_phase: 7
reported: 2026-05-02
---

# BPBUG-004: Tracked built bundle is stale and omits audit-fix generated assets

## Classification

- Severity: `high`
- Confidence: `confirmed`
- Surface: `generated assets`
- Status: `verified`

## Current Status

This defect was discovered during the Phase 7 audit and documented here as a
real generated-asset freshness bug. It was later repaired by quick task
`260502-bpbug-004-dist-refresh`, which recorded commit `350e87a` after
refreshing the tracked `dist/` bundle. The Phase 7 validation rerun then passed
its targeted subset with `27 passing tests, 0 failures`, so this report now
stays in the inventory as verified repaired/history evidence rather than an
active repair candidate. The 2026-05-02 BPBUG-004 pickup confirmed the bundle
was already fresh and added regression hardening around installed schema/docs
assets, committed-dist freshness, and unauthenticated Gemini install smoke
behavior.

## Summary

Blueprint ships Git-installed host bundles from tracked `dist/`, but the checked-in built bundle on `main` is stale relative to the current source tree. A clean `npm run build` regenerates `dist/mcp/server.js`, `dist/mcp/tools/artifacts.d.ts`, `dist/mcp/tools/project.d.ts`, and a previously untracked `dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`, which means installed hosts can launch a runtime bundle that does not fully match the implemented `audit-fix` contract documented elsewhere in the repo.

## Expected Behavior

Tracked build outputs under `dist/` should match the current source tree and include every generated runtime asset that an implemented command needs at host runtime, including `report.audit-fix` contract code and copied schema assets.

## Actual Behavior

The source tree, command catalog, runtime reference, and tests all treat `audit-fix` as implemented and depend on the `report.audit-fix` artifact contract, but the tracked built bundle in the repo does not contain the generated schema file and differs materially from a clean rebuild. After `npm ci` and `npm run build`, Git reports modifications to tracked built outputs plus a new untracked `dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`.

## Impact

Git-installed Blueprint hosts launch `dist/mcp/server.js` directly from the repository bundle. When that tracked bundle is stale, installed Gemini or Tabnine hosts can run a runtime that lags the implemented source contract. In this case the stale bundle omits `report.audit-fix` generated assets even though `/blu-audit-fix` is declared implemented, which can break or undercut remediation flows in installed environments while local source-based tests still look healthy after rebuilding.

## Affected Files

- `dist/mcp/server.js`
- `dist/mcp/server.js.map`
- `dist/mcp/tools/artifacts.d.ts`
- `dist/mcp/tools/project.d.ts`
- `dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`
- `src/mcp/artifact-contracts/index.ts`
- `src/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`
- `commands/blu-audit-fix.toml`
- `docs/COMMAND-CATALOG.md`
- `docs/RUNTIME-REFERENCE.md`
- `tests/extension-runtime-contracts.test.ts`
- `tests/built-assets-smoke.test.ts`

## Evidence

| Source | Evidence | Why It Matters |
|--------|----------|----------------|
| `docs/COMMAND-CATALOG.md:11` | `audit-fix` is listed as `implemented`. | The runtime bundle is expected to support this command in shipped installs. |
| `docs/RUNTIME-REFERENCE.md:134` | The `audit-fix` runtime contract explicitly requires `report.audit-fix`, `auditFixContext`, and the report authoring/validation/write tool flow. | The built runtime must include the generated contract and schema support for this implemented command. |
| `src/mcp/artifact-contracts/index.ts:2854-2877` | Source defines `AUDIT_FIX_REPORT_MODEL_SCHEMA_FILE`, the `report.audit-fix` model contract, and uses `readJsonSchemaAsset("report.audit-fix.model.schema.json")`. | The source tree expects a copied schema asset at runtime. |
| `src/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json` | The source schema file exists in the repo. | The build should copy this schema into `dist/mcp/artifact-contracts/schemas/`. |
| `git ls-files dist/mcp/artifact-contracts/schemas` (before rebuild) | The tracked built schema list omits `dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`. | Confirms the shipped bundle does not currently track the generated audit-fix schema file. |
| `npm run build` | A clean build exits 0 and generates `dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json` plus changes to tracked built outputs. | Confirms the current tracked `dist/` is stale relative to source, not blocked by environment failure. |
| `git status --short` after rebuild | Git reports `M dist/mcp/server.js`, `M dist/mcp/server.js.map`, `M dist/mcp/tools/artifacts.d.ts`, `M dist/mcp/tools/project.d.ts`, and `?? dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`. | Shows exact generated-asset drift introduced by a clean rebuild. |
| `git diff -- dist/mcp/tools/artifacts.d.ts` | The rebuilt declarations add `AuditFixReport*` types and `auditFixContext` support that are absent from the tracked file. | Confirms the stale bundle lags the implemented `audit-fix` source contract. |
| `rg -n 'report\\.audit-fix\\.model\\.schema\\.json|renderAuditFixTemplate|report\\.audit-fix' dist/mcp/server.js dist/mcp/tools/artifacts.d.ts dist/mcp/artifact-contracts/schemas` in the checked-in bundle | The tracked bundle lacks the copied schema file and older generated outputs do not fully reflect the source-side `audit-fix` contract. | Demonstrates the mismatch in the shipped build outputs themselves. |
| `npx tsx --test tests/built-assets-smoke.test.ts` after rebuild | The built-assets smoke passes once `dist/` is regenerated. | Indicates the build pipeline can produce a healthy bundle, but the tracked bundle in git was not fresh before rebuilding. |
| `tests/extension-runtime-contracts.test.ts:190-205` and `tests/built-assets-smoke.test.ts:169-198` | Current packaging smoke asserts the presence of core built files and MCP startup, but not generated-asset freshness or the audit-fix schema copy. | Explains why stale generated assets can slip through green packaging tests. |

## Verification Steps

1. Inspect `docs/COMMAND-CATALOG.md:11` and `docs/RUNTIME-REFERENCE.md:134`; confirm `audit-fix` is routed as implemented and depends on the `report.audit-fix` contract.
2. Inspect `src/mcp/artifact-contracts/index.ts:2854-2877` and `src/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`; confirm the source runtime expects a copied audit-fix schema asset.
3. Run `git ls-files dist/mcp/artifact-contracts/schemas`; observe that the tracked built schema list omits `report.audit-fix.model.schema.json`.
4. Run `npm ci` in a fresh worktree, then `npm run build`; observe that the build succeeds and produces generated output for the audit-fix contract.
5. Run `git status --short`; observe modifications to tracked built files and the new untracked `dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`.
6. Run `git diff -- dist/mcp/tools/artifacts.d.ts`; observe newly generated `AuditFixReport*` declarations and `auditFixContext` support absent from the tracked build.
7. Run `npx tsx --test tests/built-assets-smoke.test.ts`; observe that the rebuilt bundle passes smoke, which confirms the defect is stale tracked assets rather than an inability to build them.

## Likely Cause

The source-side `audit-fix` contract and schema landed after the last committed `dist/` refresh, but the generated bundle and copied schema assets were not rebuilt and committed alongside those source changes. Existing packaging tests verify that a built bundle can start and that key files are present, but they do not assert freshness against source or require the copied `report.audit-fix` schema file in the tracked install bundle.

## Suggested Fix Direction

Refresh and commit the generated `dist/` outputs so the shipped bundle matches source, including the copied `report.audit-fix` schema file. Then extend packaging regression coverage so stale generated assets cannot slip through again, for example by asserting the tracked schema inventory for implemented report contracts or by adding a freshness check that fails when `npm run build` leaves a diff in tracked built outputs.

## Uncertainty

None known. The stale-built-bundle defect is confirmed by direct comparison of implemented source/runtime docs against the checked-in `dist/` bundle, a clean rebuild, and the resulting generated diff.

## Related Bugs

- Root-cause cluster: `generated-asset freshness`. This bug remains the anchor for the tracked-bundle freshness cluster; no duplicate or same-repair-path peer is currently known.

## No Fix Applied

No source, manifest, skill, test, generated asset, or runtime behavior fix was
applied during the original Phase 7 discovery plan itself. The later quick
repair is recorded separately in `260502-bpbug-004-dist-refresh` and the Phase 7
validation rerun history.

## Repair Plan (2026-05-02)

### Current Repo Note

This worktree already appears to contain the historical repair evidence:
`dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json` is
tracked, source/dist schema contents match, and `git status --short -- dist` is
clean. Treat this plan as the minimal implementation plan for the stale-baseline
repair or for reviewing that the existing repair is complete.

### Official Gemini CLI Grounding

Official Gemini CLI extension docs say `gemini extensions install <source>`
installs from a GitHub URL or local path, creates a copy of the extension, and
requires `gemini extensions update` to pull source changes:
[Extension reference](https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md).

The same docs define `gemini-extension.json` `mcpServers` and recommend
`${extensionPath}` for portable paths inside the installed extension directory:
[Extension reference](https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md).

Official Gemini CLI tools docs list `ask_user`, `write_todos`, tracker tools,
and `update_topic`; these support the existing `/blu-audit-fix` command
contract but should remain session-local UX/progress tools, not persistence:
[Tools reference](https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/tools.md).

### Minimal Fix Scope

Do not change `audit-fix` behavior, command routing, MCP semantics, or schemas
unless a fresh diff proves they are still wrong. The source-side contract already
expects `report.audit-fix` via `src/mcp/artifact-contracts/index.ts`,
`src/mcp/tools/artifacts.ts`, `commands/blu-audit-fix.toml`, and
`skills/blueprint-review`.

Required generated asset refresh:

- `dist/mcp/server.js`
- `dist/mcp/server.js.map`
- `dist/mcp/tools/artifacts.d.ts`
- `dist/mcp/tools/project.d.ts`
- `dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`

Required test/docs scope:

- Add or keep `tests/built-schema-assets.test.ts`.
- Optionally update `tests/extension-install.integration.ts`
  `requiredInstalledPaths` to include
  `dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`.
- Append repair evidence/status only in
  `docs/bugs/BPBUG-004-stale-built-bundle-omits-audit-fix-generated-assets.md`;
  update `docs/bugs/INDEX.md` only if status is changing.

### Wave 1: Refresh Tracked `dist`

Change: run `npm ci`, then `npm run build`, and commit only the generated
`dist` outputs listed above.

Files in scope: generated `dist/**` files only.

Tests in scope: no test edits in this wave.

Dependencies: must happen after source contract is final.

Parallelizable: yes with Wave 2 test authoring, because write scopes are
disjoint; final verification depends on both.

### Wave 2: Add Generated Schema Parity Guard

Change: add a focused test that enumerates
`src/mcp/artifact-contracts/schemas/*.json`, asserts each file exists under
`dist/mcp/artifact-contracts/schemas/`, and asserts each dist schema is tracked
with `git ls-files --error-unmatch`.

Files in scope: `tests/built-schema-assets.test.ts`.

Tests in scope: new test should specifically catch an omitted
`dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`
without hard-coding only that schema.

Dependencies: none for authoring; meaningful pass requires Wave 1.

Parallelizable: yes with Wave 1.

### Wave 3: Installed Bundle Assertion

Change: add
`dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json` to
installed-bundle required paths, or document why `tests/built-schema-assets.test.ts`
plus staged tracked-file copying is enough.

Files in scope: `tests/extension-install.integration.ts`.

Tests in scope: integration test remains Docker-dependent; do not make it the
only regression guard.

Dependencies: Wave 1 asset must exist.

Parallelizable: yes, but final pass depends on Wave 1.

### Relevant Gemini CLI Tool Usage

Installed Gemini hosts launch `node ${extensionPath}/dist/mcp/server.js` from
`gemini-extension.json`; Tabnine local evidence mirrors that in
`tabnine-extension.json`. Therefore the checked-in `dist` bundle must include
the built MCP server and copied schema assets; installed hosts should not need
`npm install` or `npm run build`.

Inside `/blu-audit-fix`, keep `ask_user` only for non-trivial mutation, report
overwrite, and todo persistence confirmation. Keep `write_todos`,
`update_topic`, and tracker tools as session-local progress aids only. Durable
state must still flow through
`mcp_blueprint_blueprint_artifact_contract_read`,
`mcp_blueprint_blueprint_artifact_report_authoring_context`,
`mcp_blueprint_blueprint_artifact_report_validate_model`,
`mcp_blueprint_blueprint_artifact_report_write`, optional
`mcp_blueprint_blueprint_artifact_mutate_index`, and
`mcp_blueprint_blueprint_state_update`.

### Verification

Run:

```sh
npm ci
npm run build
git status --short -- dist
git ls-files --error-unmatch dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json
diff -u src/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json
npx tsx --test tests/built-schema-assets.test.ts tests/built-assets-smoke.test.ts tests/extension-runtime-contracts.test.ts tests/artifact-contracts.test.ts tests/audit-fix-metadata.test.ts tests/audit-fix-slice.test.ts
npm run typecheck
```

Run `npm test` for closeout if time allows. Run
`npm run test:integration:extension` only when Docker is available; otherwise
record it as environment-blocked.

### DOD Reviewer Instructions

Review the diff first. It should be limited to generated `dist` files, the
schema parity test, optional install integration required-path update, and
BPBUG-004 docs/status evidence.

Confirm `gemini-extension.json` still launches
`${extensionPath}/dist/mcp/server.js` and no command/skill/MCP behavior was
refactored.

After checkout, run `npm ci && npm run build`, then verify
`git status --short -- dist` is clean. This is the direct freshness check for
Git-installed host bundles.

Confirm the new schema parity test would fail if the audit-fix dist schema were
deleted or untracked, and that the built MCP smoke still starts from
`dist/mcp/server.js`.

## Review Reports (2026-05-02)

### DOD Reviewer Report

Verdict: PASS.

Plan adherence:

- Wave 1 (dist refresh): not needed; `main` already contains
  `dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`, and
  `git status --short -- dist` is clean after build.
- Wave 2 (schema parity guard): already present as
  `tests/built-schema-assets.test.ts`, which enumerates source schema files and
  asserts corresponding dist schemas exist and are tracked.
- Wave 3 (installed bundle assertion): implemented in commit `9c18792` by
  adding the audit-fix schema path to `requiredInstalledPaths` in
  `tests/extension-install.integration.ts`.

Verification evidence:

- Diff vs `main...HEAD` is one implementation line:
  `tests/extension-install.integration.ts` adds
  `dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json` to
  `requiredInstalledPaths`.
- `git ls-files` resolves the audit-fix dist schema.
- `diff -u src/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`
  shows no diff.
- `gemini-extension.json` still launches
  `${extensionPath}/dist/mcp/server.js`; no routing or behavior refactor was
  introduced by the implementation commit.

Risks and follow-ups:

- MEDIUM: `npm run test:integration:extension` is not currently runnable in an
  unauthenticated environment. In the reviewer attempt,
  `gemini --debug --list-extensions` exited with code `41` and printed only an
  auth error, so the expected extension path assertion could not be reached.
  This appears pre-existing, but reduces the practical value of the new required
  path assertion unless the integration test becomes auth-optional or CI
  provides credentials.
- LOW: the bug doc had uncommitted local changes for the appended repair plan;
  this is expected because the orchestrator is recording the plan and review
  reports in this same document.

No CRITICAL or HIGH blocking issue was found with the one-line
`requiredInstalledPaths` implementation change.

### Code Reviewer Report

Findings:

- LOW: the initial repair-plan text said `git status --short` was clean, which
  became misleading once the bug doc itself was edited. The wording was tightened
  to `git status --short -- dist` in this document before closeout.

Review notes:

- The new integration assertion is correct and stable in context:
  `requiredInstalledPaths` is checked by the in-container
  `bundleAssertionScript()` with `pathExists(path.join(bundleRoot, relativePath))`,
  and the staged bundle is constructed from tracked shipped paths that already
  include `dist/`. Adding
  `dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`
  directly guards the regression BPBUG-004 describes.
- No regression was apparent from the implementation change itself; it is an
  additive presence check.

Residual risks and test gaps:

- The Docker-based install integration test primarily asserts presence, not
  contents. Schema content parity and trackedness are covered separately by
  `tests/built-schema-assets.test.ts`, so the combined coverage is appropriate
  for BPBUG-004.
- If other non-schema generated assets become required at runtime later, they
  could still be omitted from `requiredInstalledPaths` unless another test covers
  that asset family.

### Bug Finder Report

CRITICAL:

- Installed hosts still ship an incomplete runtime bundle because `docs/` is
  omitted from the staged install bundle even though the runtime depends on docs
  for routing, progressive disclosure, and prompt grounding.
  Evidence cited:
  `tests/extension-install.integration.ts` stages manifests, contexts,
  `commands/`, `skills/`, `agents/`, `hooks/`, `dist/`, and `package.json`, but
  not `docs/`; `src/mcp/tools/project.ts` reads `docs/COMMAND-CATALOG.md` and
  falls back to a one-command catalog when missing;
  `src/mcp/command-resources.ts` reads `docs/RUNTIME-REFERENCE.md` and
  `docs/commands/*.md`; `/blu`, `/blu-help`, `/blu-progress`, and `/blu-next`
  require implemented-only catalog behavior; and skills reference doc-backed
  context. The bug finder reproduced an install-like staged bundle with no
  `docs/` directory where `blueprint_command_catalog` returned only
  `["new-project"]`.

HIGH:

- None found beyond the critical installed-bundle issue above.

MEDIUM:

- The current verification path can still miss stale checked-in `dist/` content,
  so BPBUG-004 can recur even with green tests. Evidence cited:
  `package.json` test scripts build first; `scripts/build.mjs` wipes and
  regenerates `dist/`; the install smoke copies working-tree contents after
  selecting tracked path names with `git ls-files`; and the schema guard checks
  presence/tracking rather than committed-content freshness.

LOW / residual:

- No additional low-severity packaging/generated-asset defect was separated from
  the issues above.

## Follow-up Implementation Results (2026-05-02)

Implementation commits:

- `9c18792` (`test: require audit-fix schema in installed bundle`) added
  `dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json` to
  the containerized install test's `requiredInstalledPaths`.
- `c4b259b` (`test: harden installed bundle coverage`) added doc-backed runtime
  assets to the staged install bundle contract, required
  `docs/COMMAND-CATALOG.md`, `docs/RUNTIME-REFERENCE.md`, and
  `docs/commands/audit-fix.md` in installed bundles, preserved tracked symlinks
  while staging install bundles, made the Gemini debug-list path assertion
  auth-optional only for the known unauthenticated exit-41 case, and added a
  `dist`-only committed-freshness guard.

Final verification:

- `npm ci`: passed.
- `npm run build`: passed.
- `git status --short -- dist`: clean after build.
- `git ls-files --error-unmatch dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`:
  passed.
- `diff -u src/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`:
  no diff.
- `npx tsx --test tests/built-schema-assets.test.ts tests/built-assets-smoke.test.ts tests/extension-runtime-contracts.test.ts tests/artifact-contracts.test.ts tests/audit-fix-metadata.test.ts tests/audit-fix-slice.test.ts`:
  passed with `27` tests.
- `npm run typecheck`: passed.
- `npx tsx --test --test-reporter=tap tests/extension-install.integration.ts`:
  the unauthenticated Gemini link-mode subtest passed, proving the previously
  flagged debug-list auth path is no longer blocking that assertion. The full
  Docker-backed integration run did not complete in the local environment after
  several minutes of no additional output and was interrupted; leftover
  testcontainers were removed.

Remaining risk:

- No CRITICAL, HIGH, or MEDIUM implementation issues remain from the review
  reports. The only residual caveat is that the full Docker-backed
  `tests/extension-install.integration.ts` suite remains long-running and was
  not observed end to end locally.
