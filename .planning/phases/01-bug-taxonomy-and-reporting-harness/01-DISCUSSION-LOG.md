# Phase 1: Bug Taxonomy And Reporting Harness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 1-Bug Taxonomy And Reporting Harness
**Areas discussed:** Template shape, Index depth, Status vocabulary, Evidence layout

---

## Template shape

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated template | Keep `docs/bugs/TEMPLATE.md` as the canonical schema and let `INDEX.md` stay focused on inventory and vocabulary. | |
| Index-embedded | Put the full template guidance inside `docs/bugs/INDEX.md` so everything lives in one file. | |
| Template plus example | Keep a canonical template file and also seed one example bug doc to make the standard concrete. | ✓ |

**User's choice:** Template plus example
**Notes:** User explicitly wanted a canonical template file and a seeded example.

---

## Index depth

| Option | Description | Selected |
|--------|-------------|----------|
| Lean ledger | One table row per bug with the locked core fields only. | |
| Rich triage board | Keep a richer inventory with inline triage context. | ✓ |
| Layered index | Use a master table plus grouped thematic sections. | |

**User's choice:** Rich triage board
**Notes:** User accepted the default richer row content: id, title, severity,
confidence, surface, status, discovery phase, short impact summary, likely
cause summary, and link.

---

## Status vocabulary

| Option | Description | Selected |
|--------|-------------|----------|
| Discovery-only | Minimal discovery states such as open, duplicate, or needs more evidence. | |
| Triage-heavy | Intake and repair-readiness states without a full fix lifecycle. | |
| Full lifecycle | Full durable lifecycle including planning, fixing, verification, closure, and duplicate handling. | ✓ |

**User's choice:** Full lifecycle
**Notes:** User accepted the default exact set: `new`, `triaged`, `planned`,
`in-progress`, `fixed`, `verified`, `closed`, `duplicate`, `closed-invalid`.
This is a durable vocabulary choice, not permission to perform fixes in this
milestone.

---

## Evidence layout

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated evidence section | Narrative sections plus a standalone evidence section. | |
| Inline evidence | Evidence stays embedded inside the narrative only. | |
| Both | Cite evidence inline and also provide a final consolidated evidence section. | ✓ |

**User's choice:** Both
**Notes:** User wanted inline evidence for local context plus a final evidence
section for quick scanning by later repair work.

---

## the agent's Discretion

- The exact Markdown headings can align with existing Blueprint report style so
  long as the locked bug fields remain present.
- The fake example bug can be any plausible Blueprint defect scenario if it is
  clearly illustrative rather than a real finding.

## Deferred Ideas

None.
