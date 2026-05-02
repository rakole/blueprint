---
phase: 7
slug: host-packaging-build-hooks-audit
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-02
---

# Phase 7 - Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Node test runner via `tsx --test`; package scripts through npm |
| Config file | `package.json`, `tsconfig.json` |
| Quick run command | `npx tsx --test tests/extension-runtime-contracts.test.ts tests/built-assets-smoke.test.ts tests/built-schema-assets.test.ts tests/hooks.test.ts tests/security-hardening.test.ts tests/security-docs.test.ts tests/gemini-clean-home-smoke.test.ts` |
| Full suite command | `npm test` |
| Integration command | `npm run test:integration:extension` |
| Estimated runtime | Not recorded. Plans should record actual pass/fail, skip, or environment blockers. |

## Sampling Rate

- After every plan: run the targeted command named in that plan when dependencies and environment are available.
- Before Phase 7 UAT: run at least the Phase 7 quick command above or document the blocker.
- Max feedback latency: one targeted manifest/build/hook/install command, one targeted grep/read audit, or one focused smoke probe before writing a bug report.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | COV-06, NFIX-01, NFIX-02, NFIX-03 | T-01 | Host manifests and shared host metadata are audited without mutating installed extension state. | contract/read audit | `npx tsx --test tests/extension-runtime-contracts.test.ts` | yes | covered |
| 7-02-01 | 02 | 1 | COV-06, NFIX-01, NFIX-02, NFIX-03 | T-02 | Build and generated-asset defects are documented during discovery and repaired by a generated `dist/` refresh after BPBUG-004 triage. | build/smoke audit | `npx tsx --test tests/built-assets-smoke.test.ts tests/built-schema-assets.test.ts` | yes | covered |
| 7-03-01 | 03 | 2 | COV-06, NFIX-01, NFIX-02, NFIX-03 | T-03 | Hook defects are documented while hooks remain advisory and non-state-owning. | regression/read audit | `npx tsx --test tests/hooks.test.ts tests/security-hardening.test.ts tests/security-docs.test.ts` | yes | covered |
| 7-04-01 | 04 | 3 | COV-06, NFIX-01, NFIX-02, NFIX-03 | T-04 | Install and smoke defects are documented using disposable staging roots, clean homes, containers, or fake CLIs. | smoke/integration audit | `npx tsx --test tests/gemini-clean-home-smoke.test.ts` and, when available, `npm run test:integration:extension` | yes | covered |
| 7-05-01 | 05 | 4 | COV-06, NFIX-01, NFIX-02, NFIX-03 | T-05 | Phase 7 closeout reconciles bug docs and confirms no-fix boundaries. | status/index audit | `rg -n "Phase 7|packaging|build|hooks|install|smoke|dist|manifest" docs/bugs/INDEX.md` plus `git status --short` | yes | covered |

## Wave 0 Requirements

Targeted infrastructure covers all Phase 7 validation requirements.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Host CLI integration skips | COV-06, NFIX-02 | Docker, Tabnine CLI install command, and Gemini API auth may be absent in the local environment. | Run available fake or container tests. Record missing Docker, `BLUEPRINT_TABNINE_CLI_INSTALL_COMMAND`, or `GEMINI_API_KEY` as environment blockers unless manifest or script behavior itself is defective. |
| Advisory-only hook posture | COV-06 | Hook tests can assert selected outputs, but the audit must compare docs, config, and implementation boundaries. | Verify every hook either returns `{}` or `decision: "allow"` and that enforcement remains in MCP/shared security docs rather than hooks. |
| Repair boundary | NFIX-01, NFIX-03 | Requires inspecting local git status and separating generated repair output from workflow bookkeeping. | Run `git status --short`; verify implementation changes are limited to generated `dist/` outputs plus GSD validation artifacts. |

## Validation Audit 2026-05-02

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 1 |
| Generated test files | 1 |

| Evidence | Count |
|----------|-------|
| Phase-7 targeted test files executed | 7 |
| Phase-7 targeted test cases executed | 27 |
| Targeted test failures | 1 |

Recheck (2026-05-02): the existing Phase 7 validation draft was stale. It still marked the phase `planned`, claimed `nyquist_compliant: true`, and treated Plan 02 as fully covered even though `BPBUG-004` explicitly recorded that the tracked `dist` bundle was missing `dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json` and no automated test asserted schema-inventory parity.

That gap was closed at the validation-surface level by `tests/built-schema-assets.test.ts`, which compares every source artifact-contract schema under `src/mcp/artifact-contracts/schemas/` against the checked-in `dist/mcp/artifact-contracts/schemas/` bundle and also requires each copied schema file to be Git-tracked. Before the BPBUG-004 repair, this gave Plan 02 a real automated regression that failed against the known product defect.

The initial targeted validation run exited with 26 passing tests and 1 failing test under `npx tsx --test tests/extension-runtime-contracts.test.ts tests/built-assets-smoke.test.ts tests/built-schema-assets.test.ts tests/hooks.test.ts tests/security-hardening.test.ts tests/security-docs.test.ts tests/gemini-clean-home-smoke.test.ts`. The only failure was `tests/built-schema-assets.test.ts`, which reported that `dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json` was missing even though the matching source schema existed. The repair rerun below supersedes this partial result.

Bug-index validation still passes: `BPBUG-004` remains the only real `discovery_phase: 7` bug report and is indexed in `docs/bugs/INDEX.md`. At validation time, `git status --short` is limited to this validation update plus `tests/built-schema-assets.test.ts`; implementation files remain untouched.

## Validation Sign-Off Checklist

- [x] All planned tasks have an automated or grep/status verification command.
- [x] Sampling continuity: each plan has at least one targeted verification probe.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** partial validation recorded on 2026-05-02 and superseded by the BPBUG-004 repair rerun below

**Manual sign-off:** BPBUG-004 repair and Phase 7 targeted rerun completed on 2026-05-02

## Validation Audit 2026-05-02 - BPBUG-004 Repair Rerun

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 1 |
| Escalated | 0 |
| Generated test files | 0 |

| Evidence | Count |
|----------|-------|
| Phase-7 targeted test files executed | 7 |
| Phase-7 targeted test cases executed | 27 |
| Targeted test failures | 0 |

Repair commit `350e87a` refreshed the tracked `dist/` bundle generated by `npm run build`, including `dist/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`. The first targeted rerun after the build still failed because the schema asset existed in the worktree but was not yet staged, and `tests/built-schema-assets.test.ts` checks Git tracking through `git ls-files`. After staging the generated `dist/` outputs, the full Phase 7 targeted subset passed:

```bash
npx tsx --test tests/extension-runtime-contracts.test.ts tests/built-assets-smoke.test.ts tests/built-schema-assets.test.ts tests/hooks.test.ts tests/security-hardening.test.ts tests/security-docs.test.ts tests/gemini-clean-home-smoke.test.ts
```

Result: 27 passing tests, 0 failures.

Plan 02 is now covered because the tracked schema inventory mirrors the source artifact-contract schemas and the built MCP smoke still starts successfully. Docker remains unavailable for `npm run test:integration:extension`, but that is an environment-only integration blocker already captured in the Phase 7 manual-only section and does not block Nyquist compliance for the targeted Phase 7 validation subset.

## Validation Sign-Off Update

- [x] `nyquist_compliant: true` set in frontmatter after BPBUG-004 repair.

**Approval:** Phase 7 Nyquist validation passed on 2026-05-02 after BPBUG-004 repair.
