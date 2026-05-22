# Root Routing Implemented-Only Parity Audit

Date: 2026-05-22
Scope: `/blu`, `/blu-help`, `/blu-progress`, `/blu-next`, `blueprint_command_catalog`, `blueprint://commands/*/runtime-contract`, and the state-derived next-action path

## Verdict

No confirmed defect was found in the audited implemented-only routing surface.

I could not prove a live break in:

- implemented-only routing for `/blu`, `/blu-help`, `/blu-progress`, or `/blu-next`
- waiting-state reporting through `blueprintProjectStatus -> blueprintStateLoad -> deriveNextAction`
- runtime-contract exposure gating for `blueprint://commands/*/runtime-contract`
- planned-command suppression for `do`
- docs-absent fallback for the router/runtime-contract surfaces

Given the current source and focused test evidence, no stronger defect claim is defensible.

## Audited Surfaces

- `src/mcp/tools/project.ts`
  - `buildCommandCatalogEntry` lines 1163-1288
  - `blueprintCommandCatalog` lines 1488-1489
  - `blueprintProjectStatus` lines 1662-1745
- `src/mcp/tools/state.ts`
  - `getImplementedCommandNames` lines 1352-1373
  - `implementedReviewNextSafeAction` lines 1402-1422
  - `implementedBlockingUatNextSafeAction` lines 1424-1444
  - `resolvePhaseQualityGateNextAction` lines 1446-1482
  - `deriveNextAction` lines 2500-2961
  - `buildSyncedState` lines 2963-3222
  - `blueprintStateLoad` lines 3344-3431
- `src/mcp/command-resources.ts`
  - `isExposedRuntimeContractCatalogEntry` lines 231-233
  - `listBlueprintCommandRuntimeContractCommands` lines 312-330
  - `buildBlueprintCommandRuntimeContractResource` lines 332-383
- `src/mcp/command-runtime-metadata.ts`
  - `HELP_RUNTIME_METADATA` lines 1145-1182
  - `PROGRESS_RUNTIME_METADATA` lines 1184-1221
  - `NEXT_RUNTIME_METADATA` lines 1223-1261
- Command manifests
  - `commands/blu.toml`
  - `commands/blu-help.toml`
  - `commands/blu-progress.toml`
  - `commands/blu-next.toml`
- Focused tests read and/or executed
  - `tests/router-pilot-regression.test.ts`
  - `tests/help-metadata.test.ts`
  - `tests/next.test.ts`
  - `tests/command-catalog.test.ts`
  - `tests/help-progress-health.test.ts`
  - `tests/quality-gate-routing.test.ts`
  - focused resource assertions in `tests/mcp-server-summary.test.ts`

## Evidence

### Live snapshot: catalog routing state

Read-only `tsx` snapshot of `blueprintCommandCatalog()` returned:

- `help`: declared `implemented`, runtime `implemented`, `blockedBy: []`
- `progress`: declared `implemented`, runtime `implemented`, `blockedBy: []`
- `next`: declared `implemented`, runtime `implemented`, `blockedBy: []`
- `review`: declared `implemented`, runtime `implemented`, `blockedBy: []`
- `spec-phase`: declared `implemented`, runtime `implemented`, `blockedBy: []`
- `do`: declared `planned`, runtime `repairing`, `implemented: false`, blocker `Missing command manifest: commands/blu-do.toml`

Proof step:

```sh
npx tsx --eval 'import { blueprintCommandCatalog } from "./src/mcp/tools/project.ts"; void (async () => { const catalog = await blueprintCommandCatalog(); const pick = ["help","progress","next","do","review","spec-phase"].map((name) => ({ name, declaredStatus: catalog.commands[name]?.declaredStatus, status: catalog.commands[name]?.status, implemented: catalog.commands[name]?.implemented, blockedBy: catalog.commands[name]?.blockedBy })); console.log(JSON.stringify(pick, null, 2)); })();'
```

### Live snapshot: runtime-contract exposure

Read-only `tsx` snapshot of `listBlueprintCommandRuntimeContractCommands()` returned 54 commands, including `help`, `progress`, `next`, `review`, and `spec-phase`, and excluding `do`.

Proof step:

```sh
npx tsx --eval 'import { listBlueprintCommandRuntimeContractCommands } from "./src/mcp/command-resources.ts"; void (async () => { const commands = await listBlueprintCommandRuntimeContractCommands(); console.log(JSON.stringify({ count: commands.length, commands }, null, 2)); })();'
```

### Focused tests executed

All targeted suites passed:

```sh
npx tsx --test tests/router-pilot-regression.test.ts tests/help-metadata.test.ts tests/next.test.ts
npx tsx --test tests/command-catalog.test.ts
npx tsx --test tests/help-progress-health.test.ts tests/quality-gate-routing.test.ts
npx tsx --test --test-name-pattern "server exposes read-only command resources without changing tool summaries|command catalog live MCP response trims only the public boundary while the direct handler keeps waves" tests/mcp-server-summary.test.ts
```

Observed result:

- 13/13 pass in router/help/next coverage
- 69/69 pass in command-catalog coverage
- 73/73 pass in help-progress-health plus quality-gate routing coverage
- 2/2 pass in focused MCP resource exposure coverage

### Exact behaviors re-proved by focused tests

- Implemented-only router metadata and waiting-state wording stay aligned across manifests, runtime metadata, and runtime-reference surfaces.
  - Evidence: `tests/router-pilot-regression.test.ts`, `tests/help-metadata.test.ts`, `tests/next.test.ts`
- Planned `do` remains non-routable and non-exposed through runtime-contract resources, including docs-absent fallback.
  - Evidence: `tests/command-catalog.test.ts`
- `blueprintProjectStatus` and `blueprintStateLoad` agree on bootstrap routing for uninitialized, mapping-incomplete, mapped-only, partial, and initialized repos.
  - Evidence: `tests/help-progress-health.test.ts`
- State-derived next-action routing keeps planned roadmap-only phases on `/blu-discuss-phase` and keeps missing or ambiguous completed-phase directories on `/blu-health`.
  - Evidence: `tests/help-progress-health.test.ts`
- Safer-command fallback after verification/UAT/review debt stays inside implemented commands and does not regress to stale `/blu-progress` guidance when stronger implemented follow-ups exist.
  - Evidence: `tests/quality-gate-routing.test.ts`
- Resource listing and resource reads expose runtime contracts only for implemented commands and reject `blueprint://commands/do/runtime-contract`.
  - Evidence: focused `tests/mcp-server-summary.test.ts`

## Residual Risks

1. `getImplementedCommandNames()` caches the implemented-command set per process in `src/mcp/tools/state.ts` lines 1352-1373.
   Current evidence shows the cache is correct for the shipped stable catalog and for docs-absent fallback, but I did not find evidence of same-process cache invalidation after live substrate mutation. That is a coverage limitation, not a proven defect, because the extension treats manifests, skills, and tool registration as effectively static during a running process.

2. Saved review, verification, UAT, and milestone artifacts are re-routed by extracting embedded `/blu-*` commands from prose.
   Current evidence shows valid saved artifacts route correctly and malformed actions fall back safely to derived state, but I did not find a failing minimal repro where a malformed saved action escapes the implemented-command filter.

3. Runtime-contract exposure depends on both the live command catalog and readable spec/runtime-reference material.
   Current evidence shows router/runtime-owned commands remain exposed even when docs-backed command specs are unavailable, and planned `do` stays excluded. I did not find a contradictory resource exposure path.

## Why No Stronger Claim Is Defensible

- Every source path named in scope was read directly.
- The live catalog snapshot matched the intended implemented-only behavior.
- The live runtime-contract listing matched implemented command exposure and excluded planned `do`.
- The focused test surface the goal asked for passed cleanly without narrowing due to unrelated failures.
- I did not produce a minimal repro that contradicts the current source or the passing focused tests.

Because there is no failing source-backed repro, the strongest evidence-backed conclusion is a no-defect report for the scoped surface.
