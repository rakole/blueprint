---
phase: 01
slug: foundation-bootstrap-and-state
status: partial
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-11
---

# Phase 01 — Validation Strategy

> Reconstructed Phase 1 validation contract after execution, with gaps audited against the shipped implementation and tests.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` via `tsx --test` |
| **Config file** | none - `npm test` builds first, then runs `tsx --test tests/**/*.test.ts` |
| **Quick run command** | `npx tsx --test tests/new-project.test.ts tests/phase-01-validation.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `npx tsx --test tests/new-project.test.ts tests/phase-01-validation.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | FND-01 | — | Build emits a stable runtime entrypoint under `dist/` for the extension manifest | build | `npm run typecheck && npm test` | ✅ | ✅ green |
| 01-01-02 | 01 | 1 | FND-01 | — | Manifest and Gemini context file advertise the correct install and state contract | contract | `npm test` | ✅ | ✅ green |
| 01-01-03 | 01 | 1 | FND-02 | — | Root router reads only documented routing inputs and avoids slash-command chaining | contract | `npm test` | ✅ | ✅ green |
| 01-02-01 | 02 | 2 | FND-02 | — | MCP server exports the exact Phase 1 tool names used by the command layer | integration | `npm test` | ✅ | ✅ green |
| 01-02-02 | 02 | 2 | FND-03 | — | Project bootstrap and config layering stay deterministic and normalized to v2 | integration | `npm test` | ✅ | ✅ green |
| 01-02-03 | 02 | 2 | FND-03 | — | State and artifact helpers stay repo-relative and cannot escape `.blueprint/` | unit | `npm test` | ✅ | ✅ green |
| 01-03-01 | 03 | 3 | FND-02 | — | `/blu:new-project` stays aligned with the documented MCP flow and next-step output | contract | `npm test` | ✅ | ✅ green |
| 01-03-02 | 03 | 3 | FND-03 | — | Fresh, malformed-default, and partial-state fixtures cover happy and negative paths | integration | `npm test` | ✅ | ✅ green |
| 01-03-03 | 03 | 3 | FND-01, FND-02, FND-03 | — | Post-init status, manifest packaging, and command-to-tool wiring remain coherent | integration | `npm test` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all Phase 1 requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Install Blueprint from a GitHub URL in Gemini CLI and confirm `/blu` loads from the bundled extension | FND-01 | The repo suite proves manifest/build/install-path readiness, but it does not drive the real Gemini CLI installer or extension loader | 1. Run `npm run build`. 2. Install from the repository URL with `gemini extensions install https://github.com/<repo>`. 3. Restart Gemini CLI. 4. In a clean repo, invoke `/blu` and confirm the router loads and recommends the next safe action. |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** partial 2026-04-11

---

## Validation Audit 2026-04-11

| Metric | Count |
|--------|-------|
| Gaps found | 6 |
| Resolved | 5 |
| Escalated to manual-only | 1 |

### Notes

- Added `tests/phase-01-validation.test.ts` to close missing contract coverage for the root router, config writes, state updates, artifact reuse, and partial-state reporting.
- Validation surfaced and fixed a real defect in `src/mcp/tools/artifacts.ts`: `.blueprint/../...` paths could escape the Blueprint directory while staying inside the repo root.
- Full automated verification now passes with `npm run typecheck` and `npm test`.
