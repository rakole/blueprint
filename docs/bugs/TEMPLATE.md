# Blueprint Bug Report Template

## Purpose

Use this template for every real Blueprint defect report written during the
Blueprint Defect Discovery Milestone. Blueprint is a Gemini-native CLI
extension, not GSD, and every report must preserve that product boundary.

## Filename and ID

Real bug files must use `BPBUG-###-short-slug.md`.

- Real bug ids start at `BPBUG-001`.
- `BPBUG-000` is reserved for the illustrative non-real example.
- Write one file per defect unless the finding is a duplicate of a canonical bug.

## Frontmatter Example

```yaml
id: BPBUG-001
title: Short defect title
severity: medium
confidence: likely
surface: command
status: new
discovery_phase: 2
reported: 2026-05-01
```

## Blueprint Boundary

- Blueprint is a Gemini-native CLI extension.
- Blueprint runtime state is `.blueprint/`.
- `.planning/` is local audit bookkeeping.
- Treat Blueprint as a Gemini-native product, not GSD or a legacy slash-command port.

## Classification

- Severity values: `critical`, `high`, `medium`, `low`, `info`.
- Confidence values: `confirmed`, `likely`, `suspected`.
- Affected surface values: `command`, `skill`, `MCP tool`, `hook`, `docs`, `tests`, `build`, `generated assets`, `state artifacts`, `host behavior`, `cross-cutting`.
- Status values: `new`, `triaged`, `planned`, `in-progress`, `fixed`, `verified`, `closed`, `duplicate`, `closed-invalid`.

## Summary

State the defect in one short paragraph using Blueprint-specific language.

## Expected Behavior

Describe the expected Blueprint behavior, contract, or artifact state.

## Actual Behavior

Describe the observed behavior with exact evidence-backed detail.

## Impact

Summarize who or what is affected and why the defect matters.

## Affected Files

List the exact files, commands, manifests, tests, generated assets, or runtime
surfaces involved.

## Evidence

Use a consolidated evidence table with these columns:

| Source | Evidence | Why It Matters |
|--------|----------|----------------|
| `path/or/command` | Exact observation | Why the observation supports the claim |

Also cite evidence inline where it improves readability.

## Verification Steps

Use numbered reproduction or verification steps and state the expected
observable outcome for each step.

1. Run or inspect the relevant Blueprint surface.
2. Capture the exact output, file content, or contract mismatch.
3. Note the expected observable outcome and how the actual result differs.

## Likely Cause

Describe the most plausible root cause grounded in cited evidence.

## Suggested Fix Direction

Describe a repair direction without applying the fix during this milestone.

## Uncertainty

State uncertainty explicitly for every report. Use `None known` only when direct
source, test, command, or contract evidence supports `confidence: confirmed`.

## Related Bugs

Link duplicates, related findings, or broader root-cause clusters. If this is a
duplicate, point to the canonical bug instead of repeating the defect as a new
finding.

## No Fix Applied

No source, manifest, skill, test, generated asset, or runtime behavior fix was applied during this discovery milestone.

## Authoring Rules

- Cite exact files, commands, tests, lines, or contract mismatches whenever possible.
- Distinguish `.blueprint/` runtime defects from `.planning/` bookkeeping notes.
- If temporary probe files are used, remove the temporary probe files before
  finishing the phase and document that cleanup in the report.
- Keep the report discovery-only. Document the bug and repair direction, but do
  not change source, manifests, skills, tests, generated assets, runtime state,
  or host-global Blueprint state as part of the finding.
