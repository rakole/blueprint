# Research-Phase Parity Audit And Status Update

## Status

- Original audit date: 2026-04-11
- Last status update: 2026-04-12
- Target command: `/blu-research-phase`
- Purpose: record the original parity concerns, note what has since shipped, and clarify the remaining gaps that still matter

## Historical Baseline

The original audit correctly identified the biggest early weakness: the first shipped `research-phase` slice was too close to scaffold-only discovery and not yet strong enough to serve as a trustworthy planner-facing research contract.

That is no longer the live runtime state.

## What Has Landed Since The Audit

The largest substrate and contract gaps are now closed:

- `blueprint_phase_artifact_write` and `blueprint_phase_artifact_read` now provide an MCP-owned read/write path for substantive phase research.
- Research artifacts are validated against a planner-shaped contract, including `**Confidence:**`, required sections, recommendations, and sources.
- The runtime supports explicit existing-research handling through reuse and overwrite-aware write semantics instead of relying only on first-write scaffolding.
- Advisory hooks now ship under `src/hooks/` with `hooks/hooks.json`, and hook fixture tests cover `read-before-edit`, `.blueprint` write guard, and workflow advisory behavior.
- The research-phase test suite now covers populated research content, validation failures, and substantive artifact persistence rather than only wiring and placeholder behavior.
- Control-plane docs no longer need to describe the command as a scaffold-only Phase 3 experiment.

## Current Assessment

`/blu-research-phase` is now a real MCP-backed research artifact command.

Current strengths:

- deterministic phase resolution and placement
- planner-shaped `XX-RESEARCH.md` schema
- overwrite-aware MCP persistence
- research validation with confidence and source checks
- shipped advisory hook coverage
- behavior-oriented tests for real research content

Current limitations versus upstream GSD:

- less emphasis on multi-stage research orchestration
- lighter bounded-agent workflow than the upstream dedicated researcher path
- less explicit continuation and revision UX around existing research
- parity is stronger at the artifact-contract level than at the deeper conversational-workflow level

## Remaining Gaps Versus GSD

1. Richer bounded research orchestration
   Blueprint has the right artifact contract now, but the workflow is still lighter than the upstream staged researcher experience.

2. Existing-research UX depth
   Reuse and overwrite paths exist, but the surrounding interaction model is still thinner than a fully conversational view/update/skip workflow with more revision context.

3. Broader failure-mode coverage
   The current suite validates substantive content well, but there is still room to deepen coverage for ambiguous phase selection, more varied recovery paths, and longer continuation flows.

4. Upstream parity verification
   The current Blueprint behavior is internally coherent and materially better than the original audit described, but deeper one-to-one parity against upstream GSD runtime behavior is still not fully audited.

## Recommended Follow-Up

If `research-phase` is revisited, the next work should improve workflow depth rather than rebuild substrate:

- strengthen the parent-command orchestration around the shipped research artifact tools
- deepen the bounded researcher contract only where it materially improves output quality
- add more continuation and recovery tests
- preserve the current MCP-owned persistence, research schema, hook coverage, and implemented-only routing guarantees

## Bottom Line

The original parity-gap plan is now mostly historical.

`/blu-research-phase` is no longer a scaffold-only placeholder path. It now ships substantive research persistence, schema validation, hook coverage, and behavior tests. The remaining distance to upstream GSD is mostly about orchestration depth and further parity verification, not about missing core runtime pieces.
