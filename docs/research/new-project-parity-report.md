# New-Project Parity Audit And Status Update

## Status

- Original audit date: 2026-04-11
- Last status update: 2026-04-12
- Target command: `/blu:new-project`
- Purpose: preserve the original parity findings while recording which gaps are now closed and which still separate Blueprint from the richer upstream GSD bootstrap flow

## Historical Baseline

The original 2026-04-11 audit was correct about the main risk at that time: Blueprint had a solid deterministic bootstrap substrate, but it still lagged upstream GSD in questioning depth, project-level research, approval loops, and authored bootstrap quality.

That baseline is still useful as historical context, but it is no longer an accurate description of the current runtime without the updates below.

## What Has Landed Since The Audit

The highest-value gaps called out in the original report are now closed:

- `blueprint_project_init` and the bootstrap artifact renderers now produce substantive `PROJECT.md`, `REQUIREMENTS.md`, and `ROADMAP.md` drafts instead of placeholder-only shells.
- Brownfield bootstrap is now deterministic: the runtime detects brownfield repos, marks the roadmap provisional when needed, and routes the next action to `/blu:map-codebase` until mapping exists.
- Bootstrap traceability is now enforced in practice: requirement IDs and roadmap references are authored into the generated artifacts, and the test suite verifies that they are not left as placeholders.
- Advisory hooks now ship under `src/hooks/` with `hooks/hooks.json`, so hook coverage is no longer a docs-only claim.
- The command and tool tests now cover substantive artifact generation, saved-default provenance, malformed-default fallback, explicit bootstrap seeds, and brownfield routing.

## Current Assessment

Blueprint `new-project` is now a real MCP-owned bootstrap flow, not just a safe scaffold initializer.

Current strengths:

- deterministic `.blueprint/` initialization
- normalized config seeding with provenance
- substantive bootstrap artifact generation
- explicit brownfield routing and provisional-roadmap signaling
- test coverage for the current bootstrap contract

Current limitations versus upstream GSD:

- less interactive questioning depth
- no shipped project-level research fan-out or synthesis stage
- no approval-loop-heavy roadmap authoring flow
- bounded bootstrap agents are still lighter contracts than the upstream researcher and roadmapper workflow stack

## Remaining Gaps Versus GSD

The main parity gaps that still matter are now narrower and more behavioral:

1. Deep bootstrap questioning
   Blueprint still relies more on deterministic drafting and less on the richer interview-style discovery flow that upstream GSD can run during project initialization.

2. Project-level research orchestration
   Optional bootstrap agents exist, but the runtime does not yet require a dedicated multi-agent research and synthesis pass before roadmap authoring.

3. Approval and revision loops
   Upstream GSD spends more interaction budget on revising requirements and roadmap structure before treating bootstrap output as settled.

4. Stronger bounded agent contracts
   `blueprint-project-researcher` and `blueprint-roadmapper` are useful, but they are still lighter-weight than the fully staged upstream roles they replace.

5. Broader parity-oriented tests
   The current suite proves the deterministic runtime contract well. It does not yet prove GSD-level conversational depth or approval-loop fidelity.

## Recommended Follow-Up

If `new-project` is revisited, the next repair slice should focus on behavior, not substrate:

- deepen the questioning and defaults UX without weakening MCP ownership
- strengthen the project-researcher and roadmapper contracts
- add acceptance tests for richer brownfield and approval-loop behavior
- keep the current authored bootstrap artifacts, brownfield routing, and implemented-only exposure guarantees intact

## Bottom Line

The original audit's core conclusion has changed.

`/blu:new-project` is no longer just a safe bootstrap substrate. It is now a substantive deterministic bootstrap command. The remaining distance to upstream GSD is primarily in conversational depth and orchestration richness, not in artifact quality, brownfield routing, or missing runtime substrate.
