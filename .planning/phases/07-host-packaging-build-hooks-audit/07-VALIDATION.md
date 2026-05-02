---
phase: 7
slug: host-packaging-build-hooks-audit
status: planned
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
| Quick run command | `npx tsx --test tests/extension-runtime-contracts.test.ts tests/built-assets-smoke.test.ts tests/hooks.test.ts tests/security-hardening.test.ts tests/security-docs.test.ts tests/gemini-clean-home-smoke.test.ts` |
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
| 7-02-01 | 02 | 1 | COV-06, NFIX-01, NFIX-02, NFIX-03 | T-02 | Build and generated-asset defects are documented without committing generated fixes. | build/smoke audit | `npm run build` plus `npx tsx --test tests/built-assets-smoke.test.ts` | yes | covered |
| 7-03-01 | 03 | 2 | COV-06, NFIX-01, NFIX-02, NFIX-03 | T-03 | Hook defects are documented while hooks remain advisory and non-state-owning. | regression/read audit | `npx tsx --test tests/hooks.test.ts tests/security-hardening.test.ts tests/security-docs.test.ts` | yes | covered |
| 7-04-01 | 04 | 3 | COV-06, NFIX-01, NFIX-02, NFIX-03 | T-04 | Install and smoke defects are documented using disposable staging roots, clean homes, containers, or fake CLIs. | smoke/integration audit | `npx tsx --test tests/gemini-clean-home-smoke.test.ts` and, when available, `npm run test:integration:extension` | yes | covered |
| 7-05-01 | 05 | 4 | COV-06, NFIX-01, NFIX-02, NFIX-03 | T-05 | Phase 7 closeout reconciles bug docs and confirms no-fix boundaries. | status/index audit | `rg -n "Phase 7|packaging|build|hooks|install|smoke|dist|manifest" docs/bugs/INDEX.md` plus `git status --short` | yes | covered |

## Wave 0 Requirements

Targeted infrastructure covers all Phase 7 validation requirements.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Generated asset freshness | COV-06, NFIX-01 | Tests can prove built assets run, but the audit must decide whether source-to-dist drift is a defect without preserving generated fixes. | Run `npm run build`, inspect `git status --short`, and document any generated diff as evidence only. Do not commit generated asset changes during this discovery phase. |
| Host CLI integration skips | COV-06, NFIX-02 | Docker, Tabnine CLI install command, and Gemini API auth may be absent in the local environment. | Run available fake or container tests. Record missing Docker, `BLUEPRINT_TABNINE_CLI_INSTALL_COMMAND`, or `GEMINI_API_KEY` as environment blockers unless manifest or script behavior itself is defective. |
| Advisory-only hook posture | COV-06 | Hook tests can assert selected outputs, but the audit must compare docs, config, and implementation boundaries. | Verify every hook either returns `{}` or `decision: "allow"` and that enforcement remains in MCP/shared security docs rather than hooks. |
| Discovery-only boundary | NFIX-01, NFIX-03 | Requires inspecting local git status and separating unrelated changes. | Run `git status --short`; verify intentional changes are limited to `docs/bugs/` and `.planning/phases/07-host-packaging-build-hooks-audit/`. |

## Validation Sign-Off Checklist

- [x] All planned tasks have an automated or grep/status verification command.
- [x] Sampling continuity: each plan has at least one targeted verification probe.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] `nyquist_compliant: true` set in frontmatter.

