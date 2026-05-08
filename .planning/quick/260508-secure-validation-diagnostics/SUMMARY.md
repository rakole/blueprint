---
status: completed
completed: 2026-05-08
branch: codex/simplify-secure-validation
commit: pending
---

# Simplify Secure Validation Diagnostics Summary

## Outcome

Secure-phase review validation now returns more repairable model diagnostics and less non-blocking noise. Schema errors include exact model paths, allowed values, received/expected metadata, repair text, and a compact `repairSummary` so a model can make one focused repair pass.

## Changes

- Added structured repair metadata to `blueprint_review_validate_model` and invalid `blueprint_review_record` responses.
- Expanded MCP rich text for review authoring, validation, and record tools so text-only hosts expose task schemas, evidenceCoverage key inventory, allowed next actions, diagnostics, and repair summaries.
- Removed warning-only secure-phase validations that asked for ceremonial lexical/bookkeeping perfection after the model already proved concrete coverage.
- Updated `/blu-secure-phase` manifest, review skill, runtime reference, command docs, and MCP tool docs to steer agents toward exact-path repairs instead of rereading large schemas by default.
- Added regression coverage for review MCP text, evidenceCoverage exact paths, repair summaries, and the no-truncation path around allowed next actions.

## Verification

- `npm run typecheck`
- `npm run build`
- `npm test` (986 passing)
