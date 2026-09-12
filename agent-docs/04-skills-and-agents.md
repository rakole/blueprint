# Skills And Agents

Skills and agents are runtime guidance, not persistence layers.

## Skills

Skills live at `skills/<skill>/SKILL.md`. A skill usually includes:

- Frontmatter with `name`, `description`, `status`, `commands`, and
  `input_bundles`.
- Runtime self-sufficiency rules.
- Allowed MCP contracts for each command.
- Optional agent rules.
- Response and completion checks.

Use only the active command's input bundle. Do not load sibling command
references just because they share a skill.

Do:

- Keep command-specific details in `skills/<skill>/references/*.md` when they
  are too rich for the command manifest.
- Keep skill instructions executable without relying on legacy docs.
- Use skill input bundles to make the active command context explicit.

Do not:

- Treat skills as callable tools.
- Let a shared skill make all sibling commands appear implemented.
- Use generic web, browser, or shell-only agents as substitutes for required
  Blueprint agents.

## Agents

Agents live in `agents/*.md`. Each agent has frontmatter with name, kind, tools,
turn limits, and timeout, followed by a bounded contract.

Most Blueprint agents are read-only. The executor is the write-capable agent in
the metadata allowlist.

Parent commands own:

- User-visible orchestration.
- Confirmation gates.
- MCP reads and writes.
- Artifact persistence.
- State updates.
- Final validation and next-step routing.

Agents own:

- Bounded analysis or draft production.
- Returning structured handoff material.
- Stopping when supplied evidence is stale, incomplete, or outside scope.

## Agent Packet Template

Use compact packets so weaker models have enough context without needing to
rediscover the repo:

```text
Command:
Phase or target:
Allowed tools:
Read-only paths:
Write boundary, if any:
MCP result summary:
Config gates:
Evidence paths and hashes:
Expected output:
Stop conditions:
```

## Safe Agent Use

Do:

- Give agents exact paths and stop conditions.
- Keep write-capable agents on disjoint file scopes.
- Close subagents after completion.
- Verify their claims against source before changing runtime behavior.

Do not:

- Let agents persist `.blueprint/` state by hand.
- Let agents decide command routing independently of the catalog.
- Let agents widen a command's allowed tools.

## Discussion input boundary

The phase-discovery shared skill loads only the active bundle. Discuss uses its
short runtime contract and progressively loads recovery instructions on conflicts.
Sibling command call/schema/ownership rules live in `discovery-sibling-contracts.md`
and are required only by sibling bundles. Do not reintroduce primitive evidence,
checkpoint, artifact or state orchestration into the normal discuss prompt:
`blueprint_discuss_prepare` → `blueprint_discuss_record` →
`blueprint_discuss_finalize` owns it; read is recovery/view only.

## Research input boundary

Research uses `blueprint_research_prepare` → investigate →
`blueprint_research_submit`. The compact research contract is the only required
research reference; load optional researcher instructions only when delegating an
independent question. The parent owns source-policy approval and synthesis.
Prepare supplies source fingerprints and a small typed authoring schema. MCP
renders the existing research Markdown sections, so the model supplies findings,
recommendations and evidence instead of reproducing a long document template.
Record partial work at meaningful boundaries; read and field corrections are
recovery tools. Do not reintroduce separate state, catalog, checkpoint or artifact
calls into the normal research prompt.

## Planning input boundary

Plan uses `blueprint_plan_prepare` -> `blueprint_plan_submit` ->
`blueprint_plan_finalize`; read is recovery/view only. The compact candidate
schema is supplied by prepare. MCP derives numeric slots, waves and coverage
ledgers, preserving the existing phase.plan execution shape. Submit retains raw
candidates before assessment. Review verdicts bind to candidate revision/hash.
Load planning recovery guidance only for conflicts or interrupted publication.
Do not reintroduce primitive artifact/state orchestration into the normal prompt.
