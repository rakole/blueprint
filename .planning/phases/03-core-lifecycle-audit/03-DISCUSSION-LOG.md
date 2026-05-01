# Phase 3: Core Lifecycle Audit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 3-Core Lifecycle Audit
**Areas discussed:** Lifecycle Slice Order, Probe Depth, Defect Threshold, Boundary Handling

---

## Lifecycle Slice Order

| Option | Description | Selected |
|--------|-------------|----------|
| Command-flow first | Audit `/blu-discuss-phase` through `/blu-add-tests` in user workflow order. | yes |
| MCP layer first | Audit `phase.ts`, `artifacts.ts`, schemas, checkpoints, summaries, and validation tools first, then commands. | |
| Tests-first | Start with existing lifecycle regression suites, then inspect code/docs where tests reveal gaps. | |
| Hybrid | Command-flow order, with each slice checking docs, manifest/skill, MCP tools, and tests before moving on. | |

**User's choice:** Command-flow first.
**Notes:** The audit should read like the lifecycle user journey and split the phase by command flow.

---

## Probe Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Static + targeted tests | Inspect contracts and code, run existing focused test suites, and use temp repos only when ambiguity remains. | yes |
| Static only unless obvious | Avoid runtime probes unless there is already a strong likely defect. | |
| Temp-repo probes allowed broadly | Create disposable `.blueprint/` fixtures to exercise lifecycle tools and remove them afterward. | |
| Full lifecycle dry runs | Simulate end-to-end phase flows where feasible, even if slower. | |

**User's choice:** Static + targeted tests.
**Notes:** Temporary probes are allowed only to resolve material ambiguity and must be cleaned up.

---

## Defect Threshold

| Option | Description | Selected |
|--------|-------------|----------|
| User-impact or lifecycle-state risk | File bugs when drift can misroute commands, lose evidence, corrupt lifecycle state, hide blockers, or mislead downstream agents. | yes |
| Any material contract drift | File a bug for every docs/source/test mismatch, even if runtime behavior appears safe. | |
| Runtime defects only | Docs drift becomes a note unless it changes observed behavior. | |
| High-confidence only | File only confirmed defects; likely defects are deferred for Phase 8. | |

**User's choice:** User-impact or lifecycle-state risk.
**Notes:** This keeps Phase 3 focused on meaningful lifecycle defects while avoiding low-impact drift noise.

---

## Boundary Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Strict but practical | No source/manifest/test fixes; temp probe files only in disposable temp dirs or `.planning/` when needed; clean them up; never touch installed extensions or host-global `~/.gemini/blueprint/`. | yes |
| Ultra-strict | No temp repos, no runtime probes, no generated output changes; only inspect existing files and run read-only commands. | |
| Probe-friendly | Temp repos and generated local artifacts are okay if documented and cleaned before closeout. | |
| Fast audit | Prioritize finding likely bugs, with cleanup verified only at phase end. | |

**User's choice:** Strict but practical.
**Notes:** Discovery can be evidence-rich without mutating source/runtime behavior or host-global state.

## the agent's Discretion

- Exact plan count and command grouping may be chosen during planning as long as command-flow order is preserved.
- Targeted test command selection is left to the researcher/planner, guided by existing lifecycle suites.

## Deferred Ideas

None.
