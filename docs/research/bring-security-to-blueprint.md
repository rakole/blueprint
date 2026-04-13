# Bringing Security To Blueprint

## Status

- Date: 2026-04-13
- Type: active implementation roadmap
- Scope: runtime hardening, artifact safety, and maintenance integrity for Blueprint's shipped and planned surfaces
- Reference: earlier security-module audit notes

## Recommendation In One Paragraph

Blueprint should still avoid a file-for-file port of the earlier security module, but the useful intent now has a concrete home in the runtime: a shared `src/shared/security.ts` layer, MCP-first enforcement, advisory hooks that reuse the same detectors, and tighter maintenance-flow preflights. The security work is now staged in waves. Wave 1 hardens shared path, parsing, and identifier validation. Wave 2 adds prompt-boundary and artifact-boundary protections. Wave 3 aligns high-risk maintenance flows around shared preflight rules. Wave 4 keeps `secure-phase` as the user-visible security surface, but grounds its evidence model in the earlier hardening taxonomy.

## Current Baseline

Blueprint already ships:

- repo-relative and `.blueprint/`-scoped path helpers in MCP tools
- advisory hooks for read-before-edit, `.blueprint` writes, and workflow drift
- a phase-scoped `secure-phase` review flow through `blueprint_review_record`
- report-backed high-risk maintenance contracts for `pr-branch`, `ship`, and `cleanup`

That means the remaining problem is not "add security from scratch." It is "replace narrow local checks with a shared hardening layer and apply it consistently without widening the public command surface."

## Architecture Constraints

- MCP tools remain the hard enforcement boundary for persistence and validation.
- Hooks remain advisory and must not become a second hidden state engine.
- The security rollout must not make planned commands routable by implication.
- Early waves should keep command names, MCP tool names, manifests, and public routing stable.
- High-risk maintenance flows need the same integrity checks even when some commands are still docs-only.

## Implemented Foundation

The current runtime now includes a shared `src/shared/security.ts` module that owns:

- symlink-aware path containment checks
- null-byte rejection
- safe JSON parsing with size limits and object-shape enforcement
- shared phase-ref, numeric artifact id, and field-name validation
- prompt-boundary analysis for instruction-override text, hidden control characters, role markers, and suspicious encoded payloads
- persistence-time sanitization of hidden control characters

The MCP layer now routes its core path and persistence helpers through that shared module, and the shipped advisory hooks reuse the same prompt-boundary detectors for consistency.

## Wave Plan

### Wave 0: Planning Pack

- Keep the security roadmap in `docs/` plus `MEMORY.md`; do not create extension-repo `.blueprint/` planning state.
- Lock the decisions that shared security lives at the MCP boundary, hooks remain advisory, security hardening does not expand routing, and high-risk maintenance flows share preflight integrity checks.
- Keep `docs/COMMAND-CATALOG.md`, manifests, and command status untouched unless a later wave changes the real runtime contract.

### Wave 1: Shared Runtime Guardrails

- Centralize repo-root and `.blueprint/` path containment under the shared security layer.
- Reject path traversal, absolute-path misuse for repo-relative inputs, null bytes, and symlink escapes.
- Replace raw JSON parsing in config, project bootstrap, and phase checkpoint paths with size-limited safe parsing.
- Reuse shared phase-ref, artifact-id, and field-name validators instead of duplicate local helpers.

### Wave 2: Prompt And Artifact Boundary Hardening

- Treat reports, review artifacts, security artifacts, pause handoffs, phase artifacts, and capture indexes as prompt-boundary-sensitive persistence points.
- Sanitize hidden control characters before persistence.
- Reject instruction-override text and suspicious encoded payloads at MCP write boundaries.
- Warn on contextual prompt metadata and unsafe display markers through the shared advisory hook detectors.

### Wave 3: High-Risk Maintenance Hardening

- Align `pr-branch`, `ship`, and `cleanup` around shared preflight expectations: dirty-tree checks, resolved-target validation, evidence-backed scope, and report-before-mutate behavior.
- Push the same preflight model into the documented future contracts for `undo`, `new-workspace`, `remove-workspace`, and `reapply-patches` before those commands ship.
- Keep global maintenance state transactional and provenance-aware instead of allowing ad hoc registry writes.

### Wave 4: Security Evidence And Review Alignment

- Keep `secure-phase` as the user-visible security surface.
- Clarify that `XX-SECURITY.md` should distinguish confirmed mitigations, missing or partial controls, suspicious artifact content, and follow-up hardening work.
- Keep review evidence grounded in saved phase artifacts, direct repo references, and explicit next safe actions.

## What Not To Port Directly

- do not port shell-specific validation everywhere if Blueprint is not invoking shell behavior at that boundary
- do not move state authority from MCP tools into hooks or skills
- do not invent a second persistence path outside MCP tools
- do not widen the routable command surface just because shared security helpers exist
- do not make `secure-phase` the foundation of runtime safety; it is the reporting surface, not the enforcement layer

## Concrete Follow-Through

1. Keep new MCP write paths on the shared security helpers instead of reintroducing local path or JSON parsing.
2. Expand tests whenever a new persistence boundary is added: path escape, malformed JSON, prompt-boundary rejection, and advisory-hook alignment.
3. Keep maintenance command specs and the maintenance skill explicit about shared preflight requirements as those commands evolve.
4. Tighten `secure-phase` guidance only when the persisted evidence contract really changes.

## Exit Criteria

- shared security helpers remain the default path for repo-relative resolution, JSON parsing, and prompt-boundary checks
- MCP writes reject unsafe prompt-boundary content and symlink escapes consistently
- hooks stay advisory but use the same detectors as MCP enforcement
- maintenance docs and skill contracts reflect shared integrity preflights
- security reporting stays phase-scoped and evidence-backed without changing the command surface
