# Research: Defect Discovery Pitfalls

**Date:** 2026-05-01
**Scope:** Risks to avoid while auditing Blueprint

## Pitfall 1: Confusing Blueprint With GSD

**Risk:** The audit reports a defect because Blueprint does not behave like GSD, even though Blueprint intentionally uses a Gemini-native MCP extension architecture.

**Warning signs:**
- Expected behavior references `.planning/` as runtime state.
- Expected behavior references legacy slash-command surfaces.
- Expected behavior assumes scripts own persistence.

**Prevention:**
- Use Blueprint docs and source as the baseline.
- Treat GSD only as the workflow driver for this planning session.
- Document any ambiguity as a question rather than a defect.

## Pitfall 2: Fixing While Finding

**Risk:** A tempting small source fix sneaks into the discovery milestone, mixing audit evidence with implementation changes.

**Warning signs:**
- Changes appear under `src/`, `commands/`, `skills/`, `tests/`, `dist/`, or extension manifests during audit phases.
- A bug doc says "fixed by this change".

**Prevention:**
- Limit writes to `.planning/` and `docs/bugs/`.
- If a reproduction requires a temporary probe, remove it before committing and document the probe command.
- Use `git status --short` at phase boundaries.

## Pitfall 3: Vague Bug Reports

**Risk:** The milestone ends with high-level notes that cannot drive repairs.

**Warning signs:**
- Bug docs lack file paths, reproduction steps, expected/actual behavior, or severity.
- Multiple unrelated defects are grouped into one report.

**Prevention:**
- Use the bug template for every finding.
- Keep one report per defect or tightly related cluster.
- Update the bug index after each report.

## Pitfall 4: Treating Docs As Infallible

**Risk:** A docs/source mismatch is automatically labelled a runtime bug when the docs may be stale.

**Warning signs:**
- Evidence comes from one outdated document only.
- The runtime has tests proving a different intended behavior.

**Prevention:**
- Classify as `contract-drift` when source and docs disagree.
- Cite all conflicting sources.
- Set confidence to `likely` or `suspected` until runtime behavior is verified.

## Pitfall 5: Under-Auditing Generated Assets

**Risk:** Source is correct but generated `dist/` or packaged assets are stale, causing installed extension behavior to differ.

**Warning signs:**
- Tests pass against source but install smoke behavior differs.
- Generated `dist` omits a command, schema, hook, or asset.

**Prevention:**
- Include packaging/build/dist as a dedicated slice.
- Compare `scripts/build.mjs`, package files, manifests, and generated assets where needed.

## Pitfall 6: Over-Using Broad Test Runs

**Risk:** Full test runs consume time and hide slice-specific evidence.

**Warning signs:**
- Tests are run without knowing what defect they verify.
- Failures are unrelated to the current slice and distract the audit.

**Prevention:**
- Run targeted tests first.
- Use full typecheck/build only at cross-cut checkpoints or when investigating build/package defects.
- In a fresh worktree, run `npm ci` before any `npm run build`, `npm run typecheck`, or `npm test`.

## Pitfall 7: Missing High-Risk Maintenance Confirmation Bugs

**Risk:** Confirmation-gated workflows are assumed safe because docs say so, but manifests or skills may skip gates.

**Warning signs:**
- `undo`, `ship`, `new-workspace`, `remove-workspace`, `cleanup`, or `reapply-patches` has direct mutation instructions before preview/report/confirmation.

**Prevention:**
- Audit high-risk commands as their own slice.
- Compare command manifests, skills, runtime reference, and MCP tool surfaces.

## Pitfall 8: Duplicate Bug Explosion

**Risk:** The same root cause appears in many command slices and creates noisy duplicate reports.

**Warning signs:**
- Multiple reports share identical likely cause and fix direction.
- The index has several similar titles.

**Prevention:**
- Link related bugs.
- Prefer one root-cause report with affected surfaces listed when the defect is truly shared.
- Mark duplicates explicitly when discovered later.
