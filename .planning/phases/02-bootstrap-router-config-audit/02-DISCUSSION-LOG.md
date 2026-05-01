# Phase 2: Bootstrap Router Config Audit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `02-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 2-Bootstrap Router Config Audit
**Areas discussed:** Implemented-only routing defect rules, Audit ordering and evidence threshold, Map-first readiness

---

## Implemented-Only Routing (Defect Definition)

| Option | Description | Selected |
|--------|-------------|----------|
| Only user-facing routing violations | File bugs when `/blu`, `/blu-help`, `/blu-progress`, `/blu-next`, or direct commands expose non-implemented entries (or hide implemented ones). Doc drift without routing impact is a separate docs-drift bug only if material. | ✓ |
| Any contract drift counts | File bugs whenever docs/manifests/skills/tools/tests disagree about implemented status, even if routing still behaves safely. | |
| Conservative: require a repro | Only file as bug when we can show a concrete repro (test failure or observable behavior), otherwise record as a note to investigate later. | |

**User's choice:** Only user-facing routing violations.
**Notes:** Routing-safe hiding does not excuse a broken "implemented means shipped" contract; later answers further clarified that missing substrate should still produce a bug.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, file a bug | If `implemented` is declared but runtime substrate is missing, it's still a defect even if routing hides it. | ✓ |
| Only file if users would notice | File only if `/blu*` surfaces contradict themselves or break an explicit doc promise beyond the catalog row. | |
| No, treat as later-phase drift | Don’t file unless it directly changes what `/blu*` recommends. | |

**User's choice:** Yes, file a bug.
**Notes:** Treat declared-implemented-but-unroutable as a contract defect even when routing is conservative.

| Option | Description | Selected |
|--------|-------------|----------|
| File docs-drift bug if material | If drift doesn't change routing output, still file a docs-drift bug when it could mislead users or maintainers. | ✓ |
| Only note it as a lead | Record in notes, but don’t open a BPBUG unless routing/help output is affected. | |
| Ignore unless it breaks tests | Only record if there’s a failing test or it blocks a future slice. | |

**User's choice:** File docs-drift bug if material.
**Notes:** "Material" is interpreted as user-visible or maintainer-misleading.

| Option | Description | Selected |
|--------|-------------|----------|
| Catalog status defect | "Implemented" declaration is wrong/misleading; file primary BPBUG against status contract, cite missing substrate as evidence. | ✓ |
| Missing substrate defect | Command should be considered implemented; defect is missing manifest/skill/tool wiring. | |
| Split into two bugs | One for wrong status, one for missing substrate; cross-link. | |

**User's choice:** Catalog status defect.
**Notes:** Missing substrate remains critical evidence but not the primary label.

---

## Audit Ordering And Evidence Threshold

| Option | Description | Selected |
|--------|-------------|----------|
| Start from user-facing outputs | Treat `/blu*` routing/help output as actual, then trace into catalog logic, manifests, skills, tools, and tests. | ✓ |
| Start from declared contracts | Start at docs + manifests, then verify runtime routing matches. | |
| Start from runtime substrates | Start from runtime availability checks, then check routing/help uses that list correctly. | |

**User's choice:** Start from user-facing outputs.
**Notes:** Use router output as primary "actual" and explain deviations with traced evidence.

| Option | Description | Selected |
|--------|-------------|----------|
| Confirmed=repro; Likely=strong static contradiction | Confirmed requires repro; Likely can be strong file-evidence contradiction; avoid weak Suspected unless high-impact. | ✓ |
| Everything needs a repro | No repro means no BPBUG. | |
| Static evidence is enough for Confirmed | Contract/code mismatch can be Confirmed without running anything. | |

**User's choice:** Confirmed=repro; Likely=strong static contradiction.
**Notes:** "Suspected" should be rare and evidence-seeking should be preferred.

| Option | Description | Selected |
|--------|-------------|----------|
| Tests first | Prefer citing an existing test failure; avoid adding new tests during discovery unless explicitly permitted. | ✓ |
| Direct CLI behavior | Prefer running the extension entrypoints or a local harness and citing output. | |
| Static-only by default | Only run anything if evidence is ambiguous. | |

**User's choice:** Tests first.
**Notes:** Discovery should lean on existing regression suite as deterministic evidence.

| Option | Description | Selected |
|--------|-------------|----------|
| Dig until Likely or drop | Don’t write Suspected unless high-impact; gather one more objective evidence point or drop. | ✓ |
| File Suspected early | Capture quickly with uncertainty flagged and move on. | |
| Defer to Phase 8 | Note now, but only open BPBUG in cross-cut drift phase. | |

**User's choice:** Dig until Likely or drop.
**Notes:** Keep bug inventory high-signal and evidence-backed.

---

## Map-First Readiness

| Option | Description | Selected |
|--------|-------------|----------|
| Hard gate | Map-first is a correctness contract: `/blu*` must prefer `/blu-map-codebase` in unmapped/mapping-incomplete states. | ✓ |
| Soft gate | Map-first is guidance; misrouting isn’t necessarily a defect if still safe/read-only. | |
| Case-by-case | Bug only if misroute would cause writes beyond codebase docs or risks partial state. | |

**User's choice:** Hard gate.
**Notes:** Treat misrouting away from map-codebase in these states as a defect.

| Option | Description | Selected |
|--------|-------------|----------|
| Always explicit | Name the exact state and next command (`uninitialized brownfield`, `mapping-incomplete` -> `/blu-map-codebase`). | ✓ |
| Brief hint ok | Suggest `/blu-map-codebase` without explaining why. | |
| Ask user instead | Ask the user whether brownfield/greenfield rather than assert waiting state. | |

**User's choice:** Always explicit.
**Notes:** Waiting state and next action should be legible and deterministic.

| Option | Description | Selected |
|--------|-------------|----------|
| Fail safe to map-codebase | If ambiguous, prefer `/blu-map-codebase` as safest first step. | ✓ |
| Ask a clarifier | Ask the user one question to classify the repo. | |
| Default to new-project | Prefer `/blu-new-project` unless strong brownfield evidence. | |

**User's choice:** Fail safe to map-codebase.
**Notes:** Prefer safety and evidence capture when uncertain.

| Option | Description | Selected |
|--------|-------------|----------|
| Route to /blu-new-project | `mapped-only` means codebase bundle exists and bootstrap should proceed via new-project. | ✓ |
| Either is fine | Recommending map-codebase again is acceptable; only warn about overwriting edits. | |
| Stay read-only | Avoid recommending new-project from `/blu*` in mapped-only unless explicitly asked. | |

**User's choice:** Route to /blu-new-project.
**Notes:** Map-first is satisfied; bootstrap can proceed without re-mapping.

---

## the agent's Discretion

None.

## Deferred Ideas

None.

