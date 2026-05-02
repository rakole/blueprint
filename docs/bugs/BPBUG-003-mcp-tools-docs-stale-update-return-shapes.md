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
