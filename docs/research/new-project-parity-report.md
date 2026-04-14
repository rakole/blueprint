# New-Project Parity Audit And Status Update

## Status

- Original audit date: 2026-04-11
- Last status update: 2026-04-13
- Target command: `/blu-new-project`
- Purpose: preserve the original parity findings while recording which gaps are now closed and which still separate Blueprint from the richer bootstrap flow

## Historical Baseline

The original 2026-04-11 audit was correct about the main risk at that time: Blueprint had a solid deterministic bootstrap substrate, but it still lagged the richer bootstrap flow in questioning depth, project-level research, approval loops, and authored bootstrap quality.

That baseline is still useful as historical context, but it is no longer an accurate description of the current runtime without the updates below.

## What Has Landed Since The Audit

The highest-value gaps called out in the original report are now closed:

- `blueprint_project_init` and the bootstrap artifact renderers now produce substantive `PROJECT.md`, `REQUIREMENTS.md`, and `ROADMAP.md` drafts instead of placeholder-only shells.
- Brownfield bootstrap is now deterministic: the runtime detects brownfield repos, marks the roadmap provisional when needed, and routes the next action to `/blu-map-codebase` until mapping exists.
- Bootstrap traceability is now enforced in practice: requirement IDs and roadmap references are authored into the generated artifacts, and the test suite verifies that they are not left as placeholders.
- Advisory hooks now ship under `src/hooks/` with `hooks/hooks.json`, so hook coverage is no longer a docs-only claim.
- The command and tool tests now cover substantive artifact generation, saved-default provenance, malformed-default fallback, explicit bootstrap seeds, and brownfield routing.
- The Blueprint `new-project` manifest and `blueprint-bootstrap` skill now encode a much richer bootstrap contract: deep questioning, saved-default-aware workflow preference capture, requirement and roadmap revision loops, and host-safe questioning guidance through a local `questioning.md` reference pack.
- The bounded `blueprint-project-researcher` and `blueprint-roadmapper` contracts now carry stronger bootstrap-specific expectations for uncertainty surfacing, requirement-shaping notes, and roadmap-preserving revisions.

## Current Assessment

Blueprint `new-project` is now a real MCP-owned bootstrap flow, not just a safe scaffold initializer.

Current strengths:

- deterministic `.blueprint/` initialization
- normalized config seeding with provenance
- substantive bootstrap artifact generation
- prompt-level deep questioning guidance aligned to host-native interaction
- explicit requirements and roadmap revision-loop expectations before first-write persistence
- explicit brownfield routing and provisional-roadmap signaling
- test coverage for the current bootstrap contract

Current limitations versus the richer earlier workflow:

- no shipped project-level research fan-out or synthesis stage
- bounded bootstrap agents are still lighter contracts than the fully staged researcher and roadmapper workflow stack
- the richer interaction contract is now documented and tested at the prompt/skill layer, but end-to-end conversational fidelity still depends on runtime behavior audits

## Remaining Gaps

The main parity gaps that still matter are now narrower and more behavioral:

1. Project-level research orchestration
   Optional bootstrap agents exist, but the runtime does not yet require a dedicated multi-agent research and synthesis pass before roadmap authoring.

2. Stronger bounded agent contracts
   `blueprint-project-researcher` and `blueprint-roadmapper` are stronger now, but they are still lighter-weight than the fully staged earlier roles they replace.

3. Broader parity-oriented tests
   The current suite proves the deterministic runtime contract well. It does not yet prove the same conversational depth or approval-loop fidelity.

## Recommended Follow-Up

If `new-project` is revisited, the next repair slice should focus on behavior, not substrate:

- consider whether Blueprint needs a real project-level bootstrap research bundle instead of relying on stronger in-memory synthesis
- keep strengthening the project-researcher and roadmapper contracts without widening into shell-owned behavior
- add acceptance tests for richer conversational fidelity and revision-loop behavior
- keep the current authored bootstrap artifacts, brownfield routing, and implemented-only exposure guarantees intact

## Bottom Line

The original audit's core conclusion has changed.

`/blu-new-project` is no longer just a safe bootstrap substrate. It now carries a materially richer host-native bootstrap contract at the command, skill, and reference-pack layers. The remaining distance is mostly in optional research depth and end-to-end runtime behavior verification, not in artifact quality, brownfield routing, or missing runtime substrate.
