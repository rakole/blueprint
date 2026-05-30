---
id: BPBUG-006
title: New-project catalog status ignored bundled bootstrap runtime inputs
severity: medium
confidence: confirmed
surface: command
status: fixed
discovery_phase: 10
reported: 2026-05-30
---

# BPBUG-006: New-project catalog status ignored bundled bootstrap runtime inputs

## Classification

- Severity: `medium`
- Confidence: `confirmed`
- Surface: `command`
- Status: `fixed`

## Summary

`/blu-new-project` is a source-owned command whose manifest and runtime contract
depend on three bundled bootstrap reference files. The live command catalog only
checks `requiredInputPaths` from `NEW_PROJECT_RUNTIME_METADATA`, but that
metadata did not list the bootstrap inputs. As a result, `new-project` could
remain `implemented` and expose its runtime-contract resource even if a required
bootstrap runtime input disappeared from the shipped extension bundle.

## Expected Behavior

Every bundled local input required by the `new-project` manifest, bootstrap
skill input bundle, and runtime-contract resource should be listed in
`NEW_PROJECT_RUNTIME_METADATA.requiredInputPaths`. If one of those files is
missing, `blueprint_command_catalog` should downgrade `new-project` out of the
implemented surface and the runtime-contract resource should not be exposed.

## Actual Behavior

`commands/blu-new-project.toml` named `questioning.md`,
`bootstrap-runtime-contract.md`, and `runtime-guardrails.md` as runtime contract
references. `tests/new-project-metadata.test.ts` also expected those same files
as the runtime-contract resource's effective skill inputs. But
`NEW_PROJECT_RUNTIME_METADATA` had no `requiredInputPaths`, so
`src/mcp/tools/project.ts` had no bundled input paths to check before leaving
the command implemented.

## Impact

A Git-installed Blueprint extension could advertise `/blu-new-project` as
implemented while omitting one of the local bootstrap files that defines its
deep questioning, approval, guardrail, or runtime behavior. That weakens the
implemented-only routing guarantee for a foundational project bootstrap command
and makes missing bundle inputs show up later as poorer command guidance instead
of a catalog substrate failure.

## Affected Files

- `commands/blu-new-project.toml`
- `skills/blueprint-bootstrap/SKILL.md`
- `skills/blueprint-bootstrap/references/questioning.md`
- `skills/blueprint-bootstrap/references/bootstrap-runtime-contract.md`
- `skills/blueprint-bootstrap/references/runtime-guardrails.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/project.ts`
- `src/mcp/command-resources.ts`
- `tests/new-project-metadata.test.ts`

## Evidence

| Source | Evidence | Why It Matters |
|--------|----------|----------------|
| `commands/blu-new-project.toml` | The manifest lists three runtime contract references under `skills/blueprint-bootstrap/references/`. | The command declares these bundled files as active local runtime inputs. |
| `tests/new-project-metadata.test.ts` | `newProjectRuntimeInputBundle` contains the same three bootstrap reference paths and the runtime-contract resource expected them as effective skill inputs. | Tests proved the files were runtime inputs, but did not require the catalog substrate to check them. |
| `src/mcp/command-runtime-metadata.ts` | `NEW_PROJECT_RUNTIME_METADATA` listed required tools and optional agents, but had no `requiredInputPaths`. | The live catalog could not detect missing bootstrap reference files for this command. |
| `src/mcp/tools/project.ts` | `buildCommandCatalogEntry()` checks only `runtimeMetadata?.requiredInputPaths ?? []` for missing runtime inputs. | Missing local inputs are only substrate blockers when metadata declares them. |
| `src/mcp/command-resources.ts` | Runtime-contract resources are exposed only when the catalog entry is implemented. | If the catalog stayed implemented, the resource could still be advertised despite missing bootstrap files. |
| `npx tsx --test tests/new-project-metadata.test.ts` | The new regression simulates a missing bootstrap runtime input and verifies `new-project` becomes `repairing` with no runtime-contract resource. | Confirms the repair locks the intended implemented-only behavior. |

## Verification Steps

1. Inspect `commands/blu-new-project.toml`; confirm the command names
   `questioning.md`, `bootstrap-runtime-contract.md`, and
   `runtime-guardrails.md` as runtime contract references.
2. Inspect `src/mcp/command-runtime-metadata.ts`; confirm
   `NEW_PROJECT_RUNTIME_METADATA.requiredInputPaths` contains those same three
   bundled bootstrap paths.
3. Run `npx tsx --test tests/new-project-metadata.test.ts`; confirm the missing
   runtime input regression passes and the command is downgraded to `repairing`.
4. Run `npm run typecheck` and `npm run build --silent`; confirm typecheck and
   generated runtime assets stay current.

## Likely Cause

`new-project` was migrated to a thin manifest plus source-owned metadata and
skill-package inputs, but the catalog substrate guard was not updated to include
the three local bootstrap reference files as required runtime inputs.

## Suggested Fix Direction

Declare the bootstrap reference bundle in
`NEW_PROJECT_RUNTIME_METADATA.requiredInputPaths` and add a focused regression
that simulates one missing bundled input, proving the catalog no longer reports
`new-project` as implemented and the runtime-contract resource rejects.

## Uncertainty

None known. The defect was confirmed by manifest/source inspection and a focused
runtime metadata regression.

## Related Bugs

Root-cause cluster: `cross-layer contract synchronization gaps`. This is related
to earlier docs/runtime synchronization issues, but it has a distinct repair path
because it affects runtime substrate gating rather than control-plane prose.

## Repair Outcome - 2026-05-30

Status: `fixed`.

Repair branch:

- `codex/new-project-runtime-inputs`

Files changed:

- `src/mcp/command-runtime-metadata.ts`
- `tests/new-project-metadata.test.ts`
- `dist/mcp/command-runtime-metadata.d.ts`
- `dist/mcp/server.js`
- `dist/mcp/server.js.map`

Verification:

- `npx tsx --test tests/new-project-metadata.test.ts` - pass, `4/4`.
- `npm run typecheck` - pass.
- `npm run build --silent` - pass.

Residual note:

- The metadata intentionally duplicates the bootstrap input bundle so the live
  command catalog can check shipped file availability before exposing
  `new-project` as implemented. Future bootstrap input changes should update
  both the skill input bundle and `NEW_PROJECT_RUNTIME_METADATA.requiredInputPaths`.
