# Phase 6: Workspace Maintenance Audit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-02
**Phase:** 6-Workspace Maintenance Audit
**Areas discussed:** Host-global registry atomicity, destructive workspace and cleanup gates, workstream snapshot integrity, advisory update and patch replay boundaries

---

## Area Selection

The structured `AskUserQuestion`/`request_user_input` UI was unavailable in the current Codex default mode. Per the workflow adapter's execute-mode fallback, the recommended option was selected and all four gray areas were discussed through conservative defaults.

| Option | Description | Selected |
|--------|-------------|----------|
| All four | Cover registry atomicity, destructive confirmations, workstream integrity, and update/patch boundaries. | yes |
| Registry + cleanup | Focus on host-global registry safety, workspace creation/removal, and cleanup archiving. | |
| Streams + patches | Focus on workstream snapshots/resume behavior plus advisory update and patch replay. | |

**User's choice:** Fallback-selected recommended option: all four.
**Notes:** The discussion stayed within the roadmap-defined Phase 6 boundary.

---

## Host-Global Registry Atomicity

| Option | Description | Selected |
|--------|-------------|----------|
| Strict registry audit | Treat workspace/update/patch registries as first-class safety boundaries, including locks, rollback, stale state, and host path provenance. | yes |
| Happy-path registry audit | Check normal read/write behavior and rely on existing tests for failure cases. | |
| Minimal drift audit | Only compare command docs/manifests to registered MCP tools. | |

**User's choice:** Fallback-selected strict registry audit.
**Notes:** This follows prior phase decisions favoring concrete evidence and mutation-boundary scrutiny for high-risk maintenance flows.

---

## Destructive Workspace And Cleanup Gates

| Option | Description | Selected |
|--------|-------------|----------|
| Preflight-preview-confirm-mutate-validate | Require explicit evidence for dirty-tree blockers, target resolution, protected exclusions, report-before-mutate behavior, and validation after mutation. | yes |
| Confirmation-only | Focus primarily on whether command prompts ask for confirmation before deletion or archive operations. | |
| Static docs only | Audit command specs and manifests without inspecting tool behavior deeply. | |

**User's choice:** Fallback-selected preflight-preview-confirm-mutate-validate.
**Notes:** Official Git worktree behavior reinforces strict clean-worktree and linked metadata checks for workspace removal.

---

## Workstream Snapshot Integrity

| Option | Description | Selected |
|--------|-------------|----------|
| State-integrity audit | Check project-local state ownership, snapshot availability, waiting states, corrupt indexes, and bounded `STATE.md` restoration. | yes |
| Read-only posture audit | Focus on list/status/progress outputs and skip mutation edge cases unless tests already expose them. | |
| Routing-only audit | Check only follow-up guidance and implemented-command routing. | |

**User's choice:** Fallback-selected state-integrity audit.
**Notes:** Workstreams differ from workspaces: the correct boundary is project-local `.blueprint/workstreams/`, not host-global registry state.

---

## Advisory Update And Patch Replay Boundaries

| Option | Description | Selected |
|--------|-------------|----------|
| Boundary and preview audit | Keep update advisory-only, verify installed-extension read-only behavior, and require patch preview/compatibility/conflict evidence before replay. | yes |
| Patch-focused audit | Spend most of the slice on patch registry and replay behavior; treat update as simple metadata. | |
| Update-focused audit | Spend most of the slice on installed-version/provenance lookup; treat patch replay through metadata tests. | |

**User's choice:** Fallback-selected boundary and preview audit.
**Notes:** Official Git apply behavior supports preview-first replay and treating partial application or unsafe paths as material concerns.

---

## the agent's Discretion

- The researcher and planner may choose exact plan slicing, but should make the four discussed areas explicit.
- The planner may group `new-workspace` and `remove-workspace` because they share the host-global registry substrate.
- The planner may choose targeted metadata/tool tests per slice and reserve broad test runs or disposable probes for unresolved material ambiguities.

## Deferred Ideas

None.
