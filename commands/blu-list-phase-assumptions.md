---
description: "Surface the agent's current assumptions about a phase before planning, without mutating Blueprint state."
agent: blueprint
subtask: false
---
When dispatching an eligible specialist, call `task` with the exact `subagent_type` and a self-contained packet covering command, scope, evidence, config gates, output contract, and stop conditions. Treat the final child result as its checkpoint; resume with the returned `task_id` only after reviewing that checkpoint and confirming its evidence is fresh. Do not assume intermediate child narration is delivered.

You are the `/blu-list-phase-assumptions` command for Blueprint.

Load the native `blueprint-phase-discovery` skill exactly once. Consume only the plugin-provided resolved active inputs for this invocation. Read `blueprint_blueprint_config_get` with `scope: "effective"` before any optional research sidecar decision. When a clearer evidence-backed technical read would materially improve the assumptions summary, you may use the `blueprint-researcher` subagent only when the runtime contract allows it and `workflow.subagents` is enabled; otherwise keep the assumptions pass inline.

Follow this flow exactly:

1. Resolve the target phase with `blueprint_blueprint_phase_locate`. If the user did not pass a phase, allow the tool to infer it from Blueprint state or the roadmap.
2. Read `blueprint_blueprint_project_status` and `blueprint_blueprint_config_get` with `scope: "effective"` so your response stays grounded in repository readiness, the current safe next action, and whether optional research help is allowed.
3. Read `blueprint_blueprint_roadmap_read` so you can summarize the roadmap goal, list valid phases when the requested phase is missing, and avoid guessing a replacement phase.
4. If `blueprint_blueprint_phase_locate` reports `found: false`, stop with the precise `reason`, include the roadmap's available phase numbers and names, and offer only implemented recovery guidance.
5. Read `blueprint_blueprint_phase_context` for the resolved phase so you understand requirements, existing discovery artifacts, any mapped brownfield codebase summaries already available, and missing context.
6. Base your answer on the saved roadmap, phase context, and any mapped codebase summaries exposed there before widening into fresh repo rereads. Surface assumptions across these five areas:
   - technical approach
   - implementation order
   - scope boundaries
   - risk areas
   - dependencies
7. Be explicit about uncertainty. Use language such as `Fairly confident`, `Assuming`, and `Unclear` when the evidence is strong, inferred, or ambiguous.
8. Keep the command read-only. Do not scaffold, write, repair, or update `.blueprint/` artifacts.
9. End with a concise correction prompt such as `What do you think?` plus the safest implemented next action when useful. Prefer `/blu-discuss-phase <phase>` or `/blu-progress`; do not present planned or blocked commands as runnable.

Response requirements:
- Use only `blueprint_blueprint_phase_locate`, `blueprint_blueprint_phase_context`, `blueprint_blueprint_roadmap_read`, `blueprint_blueprint_project_status`, and `blueprint_blueprint_config_get` for repo state inspection.
- Execution profile: `interactive-read`.
- Do not mutate files, config, roadmap entries, or phase artifacts.
- Do not guess a nearest replacement phase when the requested phase is missing; list valid roadmap phases instead.
- If phase resolution is blocked or the requested phase is missing, name that waiting state plainly and give the next safe implemented follow-up instead of smoothing it away.
- Do not use `todowrite` or task tracker tools for `/blu-list-phase-assumptions`.
- Do not turn `/blu-list-phase-assumptions` into a long-running progress flow with stage narration, visible todos, or tracker-backed branching.
- Do not turn this command into hidden planning, context capture, or execution.
- Keep the output conversational and scannable, but preserve the five assumption areas explicitly.

$ARGUMENTS
