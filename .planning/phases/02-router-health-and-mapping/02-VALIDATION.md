---
phase: 02
slug: router-health-and-mapping
status: ready
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 02 - Validation Strategy

> Pre-execution validation contract for the remaining Wave 0 command surface.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` via `tsx --test` |
| **Config file** | none - `npm test` builds first, then runs `tsx --test tests/**/*.test.ts` |
| **Quick run command** | `npx tsx --test tests/settings-profile.test.ts tests/help-progress-health.test.ts tests/map-codebase.test.ts` |
| **Full suite command** | `npm test` |
| **Type safety command** | `npm run typecheck` |
| **Build command** | `npm run build` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- After every task-sized change: run the nearest focused test file for that plan.
- After every plan wave: run `npm test`.
- Before `/gsd-execute-phase 2`: run `npm run typecheck`, `npm run build`, and `npm test`.
- Max feedback latency: 10 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | FND-04 | - | Config mutation stays inside normalized v2 project/defaults boundaries and rejects removed repo keys | unit | `npm test` | planned | pending |
| 02-01-02 | 01 | 1 | FND-04 | - | `settings` and `set-profile` reference only documented config/project tool flows | contract | `npm test` | planned | pending |
| 02-01-03 | 01 | 1 | FND-04 | - | Profile-only changes leave saved defaults untouched and legacy config migrates safely | integration | `npm test` | planned | pending |
| 02-02-01 | 02 | 2 | FND-05 | - | Shared read-path tools distinguish uninitialized, partial, and initialized repos without guessing | unit | `npm test` | planned | pending |
| 02-02-02 | 02 | 2 | FND-05 | - | `help`, `progress`, and `health` stay read-only unless repair is explicitly requested | contract | `npm test` | planned | pending |
| 02-02-03 | 02 | 2 | FND-05 | - | Repair mode normalizes config/state only through explicit tool calls and confirms the change set first | integration | `npm test` | planned | pending |
| 02-03-01 | 03 | 3 | FND-06 | - | Codebase artifact helpers create and validate the locked six-file bundle under `.blueprint/codebase/` | unit | `npm test` | planned | pending |
| 02-03-02 | 03 | 3 | FND-06 | - | `map-codebase` references only documented artifact/project tool names and explicit overwrite handling | contract | `npm test` | planned | pending |
| 02-03-03 | 03 | 3 | FND-06 | - | Brownfield fixtures produce deterministic mapping docs and warn before replacing edited outputs | integration | `npm test` | planned | pending |

*Status: pending = planned but not yet executed*

---

## Wave 0 Requirements

| Requirement | Covered By | Planned Evidence |
|-------------|------------|------------------|
| FND-04 | 02-01-01, 02-01-02, 02-01-03 | `tests/settings-profile.test.ts`, command TOML contract assertions, normalized config writes |
| FND-05 | 02-02-01, 02-02-02, 02-02-03 | `tests/help-progress-health.test.ts`, status/repair assertions, runtime-doc alignment checks |
| FND-06 | 02-03-01, 02-03-02, 02-03-03 | `tests/map-codebase.test.ts`, codebase bundle assertions, overwrite/reuse behavior |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Run `/blu:settings`, `/blu:set-profile`, `/blu:progress`, and `/blu:health --repair` inside a real Gemini CLI session | FND-04, FND-05 | The repo suite proves tool behavior and command contracts, but not the final interactive Gemini prompt quality or confirmation UX | 1. Run `npm run build`. 2. Install the extension from the repo. 3. In a temp repo, run `/blu:new-project`, then exercise the four commands and confirm the wording matches the command specs. |
| Run `/blu:map-codebase` against a real brownfield repo with existing docs | FND-06 | Automated fixtures can prove deterministic output and overwrite detection, but not whether the summaries are genuinely useful to a human reader | 1. Initialize Blueprint in a representative repo. 2. Run `/blu:map-codebase`. 3. Inspect the six generated `.blueprint/codebase/*.md` files and confirm they reflect the repo's stack, conventions, tests, integrations, and concerns. |

---

## Validation Sign-Off

- [x] Every planned task has an automated verification command.
- [x] Every Phase 2 requirement is mapped to planned evidence.
- [x] No plan relies on watch-mode or non-deterministic test behavior.
- [ ] Automated checks are green.
- [ ] Manual-only checks are complete.
- [ ] `nyquist_compliant: true` is justified after execution and verification.

**Approval:** ready 2026-04-11
