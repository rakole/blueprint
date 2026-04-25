# Quick Task 260425-jpp: Improve New Project To Phase 1 Diagram

**Date:** 2026-04-25
**Status:** Complete

## Goal

Improve `docs/diagrams/new-project-to-phase1.drawio` visually and
content-wise so it can showcase the Blueprint workflow from `/blu-new-project`
through Phase 1 completion.

## Scope

- Replace the tall text-heavy swimlane with a clearer presentation-grade
  journey map.
- Preserve the diagram as editable draw.io XML.
- Show user-facing commands, MCP state ownership, written artifacts, gates,
  optional detours, and closeout evidence.
- Avoid changing runtime behavior or command catalog semantics.

## Tasks

1. Re-layout the workflow into left-to-right stages from bootstrap through
   Phase 1 closeout.
2. Add lanes for commands, MCP tools, artifact evidence, gates, and conclusion.
3. Clarify optional research/UI paths, brownfield mapping, recovery loops, and
   readiness gates.
4. Validate the draw.io XML and review the resulting diff.

## Verification

- `xmllint --noout docs/diagrams/new-project-to-phase1.drawio`
- `git diff --stat`
