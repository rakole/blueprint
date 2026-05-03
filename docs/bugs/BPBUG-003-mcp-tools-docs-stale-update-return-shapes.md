---
id: BPBUG-003
title: MCP tool docs advertise stale return shapes for update tools
severity: low
confidence: confirmed
surface: docs
status: new
discovery_phase: 6
reported: 2026-05-02
---

# BPBUG-003: MCP tool docs advertise stale return shapes for update tools

## Classification

- Severity: `low`
- Confidence: `confirmed`
- Surface: `docs`
- Status: `new`

## Summary

Blueprint's shared MCP tool reference still documents older, narrower return shapes for `blueprint_update_check` and `blueprint_update_plan`, even though the command contract, runtime types, and focused tool tests all expect a richer result. The runtime works, but `docs/MCP-TOOLS.md` now misstates the keys that update callers should read.

## Expected Behavior

`docs/MCP-TOOLS.md` should describe the same update-tool result fields that the command docs, runtime types, and focused tests treat as authoritative, including install provenance, latest-version lookup status, update availability, restart guidance, and the structured saved-path metadata returned by `blueprint_update_plan`.

## Actual Behavior

The update command docs and implementation expose detailed result shapes, but `docs/MCP-TOOLS.md` still lists older fields such as `installSource`, `jsonPath`, and `markdownPath` while omitting live fields like `host`, `extensionManifestPath`, `installProvenance`, `latestVersionLookupStatus`, `latestVersionSource`, `updateAvailable`, `steps`, `notes`, `requiresRestart`, `savedPaths`, and `path`.

## Impact

`docs/MCP-TOOLS.md` is the shared tool reference for Blueprint orchestration. When it advertises the wrong update-tool schema, future prompt contracts, maintainers, or model-driven flows can read missing or renamed keys, lose restart or persistence context, or underuse the tool's actual safety signals.

## Affected Files

- `docs/MCP-TOOLS.md`
- `docs/commands/update.md`
- `src/mcp/tools/update.ts`
- `tests/update-tools.test.ts`

## Evidence

| Source | Evidence | Why It Matters |
|--------|----------|----------------|
| `docs/MCP-TOOLS.md:136-137` | The shared MCP docs say `blueprint_update_check` returns `{status, installedVersion, latestVersion, installSource, extensionPath, warnings}` and `blueprint_update_plan` returns `{status, jsonPath, markdownPath, mode, warnings}`. | These are the shared documented tool contracts and they are now stale. |
| `docs/commands/update.md:56-64` | The command contract expects `blueprint_update_check` to return `host`, `extensionManifestPath`, `installProvenance`, `latestVersionLookupStatus`, `latestVersionSource`, and `updateAvailable`, and expects `blueprint_update_plan` to return `steps`, `notes`, `requiresRestart`, and `savedPaths`. | The shipped command docs already rely on a richer result shape than the shared MCP docs advertise. |
| `src/mcp/tools/update.ts:70-95` | `UpdateCheckResult` and `UpdatePlanResult` define the live return types, including `host`, `extensionManifestPath`, `installProvenance`, `latestVersionLookupStatus`, `latestVersionSource`, `updateAvailable`, `steps`, `notes`, `requiresRestart`, `savedPaths`, and `path`. | The implementation confirms the richer runtime schema is real, not just aspirational docs text. |
| `src/mcp/tools/update.ts:1020-1033` | `blueprintUpdatePlan()` returns the full `UpdatePlanResult`, including `steps`, `notes`, `requiresRestart`, `savedPaths`, `path`, and `status`. | The persisted plan API does not match the abbreviated `jsonPath`/`markdownPath` shape in `docs/MCP-TOOLS.md`. |
| `tests/update-tools.test.ts:145-155` | The focused update-check tests assert `host`, `extensionManifestPath`, `installProvenance`, `latestVersionLookupStatus`, `latestVersionSource`, and `updateAvailable`. | The test suite already treats the richer update-check shape as canonical. |
| `tests/update-tools.test.ts:249-258` | The focused update-plan tests assert `requiresRestart`, `savedPaths.updatesDir`, `savedPaths.metadataPath`, `savedPaths.checklistPath`, `path`, `steps`, and `notes`. | The test suite already treats the richer update-plan shape as canonical. |

## Verification Steps

1. Inspect `docs/MCP-TOOLS.md:136-137`; note the stale update-tool return fields (`status`, `installSource`, `jsonPath`, `markdownPath`).
2. Inspect `docs/commands/update.md:56-64`; note the richer result fields required by the shipped command contract.
3. Inspect `src/mcp/tools/update.ts:70-95` and `src/mcp/tools/update.ts:1020-1033`; confirm the runtime types and returned object include the richer fields from the command docs.
4. Run `npx tsx --test tests/update-metadata.test.ts tests/update-tools.test.ts`; observe that the suite passes while asserting the richer update result shape, which confirms the runtime and tests are aligned but the shared MCP docs are stale.

## Likely Cause

The update tool implementation and tests evolved after the initial advisory tool-family documentation was written, but `docs/MCP-TOOLS.md` kept an older summary row instead of being updated alongside the live return types.

## Suggested Fix Direction

Update the `docs/MCP-TOOLS.md` maintenance table so the `blueprint_update_check` and `blueprint_update_plan` rows match the live result keys, then add or extend a metadata regression that cross-checks those rows against the actual runtime types or focused tool tests.

## Uncertainty

None known. The mismatch is confirmed by direct comparison of the shared MCP docs, command docs, runtime types, and focused update tool tests.

## Related Bugs

- Root-cause cluster: `docs/runtime synchronization`. This bug remains the anchor for the shared-tool-doc drift cluster; no duplicate or same-repair-path peer is currently known.

## No Fix Applied

No source, manifest, skill, test, generated asset, or runtime behavior fix was applied during this discovery milestone.

## Repair Plan - 2026-05-03

### Inspection Findings

- Bug report evidence confirms `docs/MCP-TOOLS.md` is stale while command docs, runtime types, and focused tests already use the richer update-tool shapes.
- `docs/MCP-TOOLS.md` maintenance rows still advertise stale `installSource`, `jsonPath`, and `markdownPath` fields.
- `docs/commands/update.md` already expects richer check/plan fields and authoritative `savedPaths`.
- `src/mcp/tools/update.ts` defines `UpdateCheckResult` and `UpdatePlanResult`; the check result returns host/provenance/latest-version/update-availability fields, and the plan result returns `steps`, `notes`, `requiresRestart`, `savedPaths`, `path`, and `status`.
- `commands/blu-update.toml` already calls `mcp_blueprint_blueprint_update_check` first and `mcp_blueprint_blueprint_update_plan` only after the mode gate.
- `tests/update-tools.test.ts` already asserts the richer runtime shape.
- `tests/update-metadata.test.ts` checks update tool names and command summary, but not the documented return shapes.

### Official Gemini CLI Research

- Gemini CLI MCP server docs say MCP servers let Gemini CLI discover tools, execute them with defined arguments, and receive structured responses: <https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md>. Impact: Blueprint's shared MCP return docs are model-facing contract material, so stale field names can mislead callers.
- The same docs state MCP tools receive JSON arguments and results are processed for model context plus user display, often as JSON. Impact: the return-shape table should match runtime fields the model can actually consume.
- Gemini CLI assigns MCP tools FQNs like `mcp_{serverName}_{toolName}`. Impact: `commands/blu-update.toml` already uses the correct `mcp_blueprint_blueprint_update_*` placement; no FQN change is needed.
- Gemini CLI extension reference documents extension management commands and that management changes take effect after restarting the CLI session: <https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md>. Impact: keep `/blu-update` advisory, restart-oriented, and non-self-mutating; fields like `requiresRestart`, `host`, and `extensionManifestPath` are appropriate to document.

### Minimal Implementation Plan

1. Update only `docs/MCP-TOOLS.md` maintenance rows:
   - `blueprint_update_check` returns `{host, extensionPath, extensionManifestPath, installedVersion, installProvenance, latestVersionLookupStatus, latestVersion, latestVersionSource, updateAvailable, warnings}`.
   - `blueprint_update_plan` returns all `blueprint_update_check` fields plus `{mode, steps, notes, requiresRestart, savedPaths: {updatesDir, metadataPath, checklistPath}, path, status}`.
   - Remove stale `installSource`, `jsonPath`, and `markdownPath`.
2. Add row-level regression coverage in `tests/update-metadata.test.ts`:
   - Extract the two `docs/MCP-TOOLS.md` table rows.
   - Assert live field names are present.
   - Assert stale field names are absent.
3. Do not change `src/mcp/tools/update.ts` or command runtime behavior.
4. Do not change `commands/blu-update.toml` or skill routing unless review asks for additional wording; the current tool placement is already correct.

### Tests To Add/Run

- Add/update `tests/update-metadata.test.ts` with precise return-shape assertions.
- Targeted verification:
  - `npm run typecheck`.
  - `npm run build --silent`.
  - `npx tsx --test tests/update-metadata.test.ts tests/update-tools.test.ts tests/command-contract-docs.test.ts`.
- Optional final confidence: `npm test`.

### Gemini CLI Tool Usage Placement

No placement change recommended. Keep:

- `mcp_blueprint_blueprint_update_check` first in `commands/blu-update.toml`.
- `ask_user` only for the saved-checklist versus manual-fallback gate.
- `mcp_blueprint_blueprint_update_plan` only after that gate when a saved checklist is desired.
- Restart guidance at the end of the command flow.

### Waves

- Wave 1, docs: `docs/MCP-TOOLS.md` only. No dependency.
- Wave 2, tests: `tests/update-metadata.test.ts`. Depends on the final exact row wording from Wave 1.
- Wave 3, verification: targeted tests above. Depends on Waves 1-2.

### DoD Checklist

- `docs/MCP-TOOLS.md` update rows match runtime fields.
- No stale `installSource`, `jsonPath`, or `markdownPath` remains in the live MCP tool docs rows.
- Regression test fails on old rows and passes on updated rows.
- No runtime, command manifest, skill, global state, installed extension, or `.blueprint/` state changes.
- Targeted tests and typecheck pass.

### Risks / Uncertainty

- `UpdatePlanResult` extends `UpdateCheckResult`; documenting it as "all check fields plus ..." is clearer and less brittle than duplicating a very long full object.
- Runtime type aliases are not exported, so the regression should stay doc-row based rather than attempting TypeScript type introspection.
- Avoid network-dependent update tests; current fixture-based tests already cover runtime shape without live remote lookup.
