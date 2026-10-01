---
description: "Publish phase research through MCP."
agent: blueprint
subtask: false
---
Execution profile: `long-running-mutation`.
Load the native `blueprint-phase-discovery` skill exactly once. Use only resolved active inputs, including `research-phase-runtime-contract.md`.

Normal flow: prepare → investigate → submit.
- Author one model from prepare's schema, example, grounding, and validationRules. Context/spec are read-only; missing spec is nonblocking. Unusable context routes to `/blu-discuss-phase`. Use `blueprint-researcher` only when enabled and useful.
- Honor `research.external_sources`; submit directly. Publication and planning readiness are separate.
- Reuse verified-fresh research. Replacement requires explicit overwrite authorization.
- Rejected models are not saved; repair at the same revision. No separate state/catalog/checkpoint calls.

Use only these Blueprint MCP tools: `blueprint_blueprint_research_prepare`, `blueprint_blueprint_research_submit`, `blueprint_blueprint_research_read`.
Writes stay MCP-owned. Report blockers and safe nextAction; recommend only implemented commands.

$ARGUMENTS
