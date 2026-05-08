---
status: completed
created: 2026-05-08
branch: codex/simplify-secure-validation
---

# Simplify Secure Validation Diagnostics

## Task

Make `/blu-secure-phase` model validation easier to repair on the first retry by returning path-specific `blueprint_review_validate_model` diagnostics, reducing noisy security-only validation warnings, and keeping secure-phase guidance focused on actionable fixes.

## Scope

- Improve review model diagnostics so schema errors name the exact model path, expected values, received values, and repair guidance.
- Add a compact repair summary to review model validation and invalid record responses.
- Include review validation details in MCP rich text responses without dumping ceremony-heavy schema blocks.
- Reduce secure-phase validation noise that does not block a correct security artifact.
- Update focused tests and docs/contracts for the adjusted diagnostics.

## Verification

- `npm run build`
- `npm run typecheck`
- `npm test`
- Focused secure-phase/review/server summary tests

## Notes

- Work is running in fresh worktree `/Users/rhishi/dev/repositories/blueprint-secure-validation-simplify`.
- The installed `gsd-sdk` no longer supports the local `gsd-sdk query init.quick` workflow surface, so this quick task is recorded manually before source edits.
