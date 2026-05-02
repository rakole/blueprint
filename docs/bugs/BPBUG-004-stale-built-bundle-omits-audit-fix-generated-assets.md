---
id: BPBUG-004
title: Tracked built bundle is stale and omits audit-fix generated assets
severity: high
confidence: confirmed
surface: generated assets
status: new
discovery_phase: 7
reported: 2026-05-02
---

# BPBUG-004: Tracked built bundle is stale and omits audit-fix generated assets

## Classification

- Severity: `high`
- Confidence: `confirmed`
- Surface: `generated assets`
- Status: `new`

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

None known.

## No Fix Applied

No source, manifest, skill, test, generated asset, or runtime behavior fix was applied during this discovery milestone.
