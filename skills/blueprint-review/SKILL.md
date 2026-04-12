---
name: blueprint-review
description: >
  Review, security, UI-audit, and peer-review orchestration for Blueprint. Use
  this skill to keep phase-scoped review artifacts MCP-owned, grounded in saved
  repo evidence, and explicit about follow-up risk.
status: implemented
commands:
  - /blu:secure-phase
  - /blu:code-review
  - /blu:code-review-fix
  - /blu:audit-fix
  - /blu:ui-review
  - /blu:review
---

# Blueprint Review Skill

## Purpose

Orchestrate Blueprint's review-family commands so durable review artifacts are
phase-scoped, evidence-backed, and persisted only through MCP tools.

## Parity Goal

Carry forward the useful upstream review intent while preserving Blueprint
deltas:

- review outputs are durable artifacts, not prompt-only summaries
- security, code-review, UI-review, and peer-review results stay phase-scoped
- persistent writes remain MCP-owned instead of script-owned
- optional bounded agents analyze evidence, but commands own routing and
  confirmation language
- follow-up risks stay explicit in artifacts instead of disappearing into chat
- implemented-only routing remains the source of truth for next-step guidance

Today, `secure-phase` is the shipped review-family command. Other review-family
commands remain documented but non-routable until their extra MCP substrate
lands.

## Required Inputs

- `docs/commands/secure-phase.md`
- `docs/COMMAND-CATALOG.md`
- `docs/SKILLS-AND-AGENTS.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/GSD-RUNTIME-MIGRATION.md`
- `docs/PHASE-LIFECYCLE.md`
- saved phase artifacts for the target phase, especially execution summaries

## Required MCP Tools

- `blueprint_phase_locate`
- `blueprint_artifact_list`
- `blueprint_review_record`

## Optional Agents

- `blueprint-security-auditor`

## Workflow Rules

### `secure-phase`

1. Resolve the target phase and require saved execution evidence before the
   audit begins.
2. Read the existing Blueprint artifact inventory first so the audit can cite
   summaries, validation, and UAT artifacts when they exist.
3. Inspect any existing `XX-SECURITY.md` before proposing replacement and
   default to reuse unless the user explicitly asks for an update.
4. Keep the audit grounded in saved repo evidence, phase goals, and the actual
   implementation surface under review.
5. Use `blueprint-security-auditor` when the phase spans multiple plans,
   touches risky surfaces, or needs a higher-confidence mitigation review.
6. Persist finished security evidence through `blueprint_review_record` with the
   `security` artifact.
7. Keep next-step guidance inside implemented Blueprint commands only. Prefer
   `/blu:validate-phase`, then `/blu:verify-work`, and otherwise `/blu:progress`
   depending on which lifecycle artifacts already exist.

## Non-Negotiables

- All persistent writes must go through MCP tools only.
- Do not mutate arbitrary repo files from review commands.
- Do not present planned-only review commands as runnable just because they are
  documented.
- Keep the artifact explicit about pass signals, findings, and follow-up risk.
