# Skills And Agents

Skills and agents are runtime guidance, not persistence layers.

## Skills

Blueprint has 17 exact native skills at `skills/<skill>/SKILL.md`. Each has
strict YAML frontmatter including:

- Frontmatter with `name`, `description`, `status`, `commands`, and
  `input_bundles`.
- Runtime self-sufficiency rules.
- Allowed MCP contracts for each command.
- Optional agent rules.
- Response and completion checks.

Load the primary skill exactly once. Then read only the manifest-resolved
effective inputs: these exclude the supplied active command and inactive sibling
bundles. The package manifest still hashes the full shipped reference closure.

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

`agents/blueprint.md` is the required primary. Fifteen optional specialists use
`mode: subagent`, positive native `steps`, and static `permission` maps. Invalid
optional agents are omitted with diagnostics and an inline workflow fallback.

Fourteen specialists are read-only. The executor adds semantic `edit: allow`
and narrowly approval-controlled `bash: ask`; control-plane and nested-task
routes stay denied. Native `steps` is a step limit, not a wall-clock deadline.
Static permissions are not a per-assignment filesystem sandbox, so every packet
still defines exact scope, paths, evidence, output, and stop conditions.

The primary receives a narrow `external_directory` mapping for validated
installed skill directories and effective-reference parent directories only,
expressed as `<absolute-dir>/*` with the wildcard default denied. Caller
ask/deny restrictions are intersected afterward and can remove these grants.
Specialists retain the canonical external-directory denial; arbitrary sibling
or customer-external roots are never granted.

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

Direct skill aliases are blocked before activity. The private review helper also
requires an exact eligible review command, standalone `--feels-like-god`, and
same-session correlation; this gate does not promise discovery invisibility.

### Conditional Codebase Navigation

When code understanding is needed and the parent packet lacks relevant evidence, an agent may check `.blueprint/codebase/INDEX.md` with its existing generic file tools if present, subject to the parent-granted read and scope boundary. `INDEX.md` and its referenced `ENTRY.md` remain the full navigation protocol; agents select only the smallest relevant route, record, or search page and verify mapped coordinates against current source and tests. Known targets, including plan `task.readFirst` paths, are read directly once. Parent-supplied relevant ENTRY/records/source evidence is reused only while unchanged, and parent commands distribute only relevant subsets to children. An absent, malformed, unsupported, unreadable, or stale map falls back immediately within that scope; cap unproductive navigation at two actions. Agents request missing paths or scope from the parent; they do not dispatch children, force lookup for unrelated work, auto-regenerate maps, infer runtime or performance/default claims, or require private receipts or generated input bundles.

## Discussion input boundary

The phase-discovery shared skill loads only the active bundle. Discuss uses its
short runtime contract and progressively loads recovery instructions on conflicts.
Sibling command call/schema/ownership rules live in `discovery-sibling-contracts.md`
and are required only by sibling bundles. Do not reintroduce primitive evidence,
checkpoint, artifact or state orchestration into the normal discuss prompt:
`blueprint_discuss_prepare` → `blueprint_discuss_record` →
`blueprint_discuss_finalize` owns it; read is notes/history recovery only. Prepare
supplies schema/defaults and missing essentials; record is notes-only. Finalize
accepts the generated model directly. Never promise draft recovery for discussion.

## Research input boundary

Research uses `blueprint_research_prepare` → investigate →
`blueprint_research_submit`. Load only its compact reference; optional researchers
answer independent bounded questions while the parent owns source approval and
synthesis. Prepare provides schema, example, grounding and actual rejection rules
before one model generation. Submit accepts `model` directly and renders canonical
research Markdown. Optional empty/omitted fields and honest open questions should
not cause avoidable rejection; planning blockers are separate from publication.
Rejected models are never saved. Repair issues in conversation at the same revision.
Read returns canonical research and metadata only. Accepted publication has a
metadata-only I/O journal; no separate state/catalog/checkpoint/artifact calls belong
in the normal prompt. There is no research record tool or draft-recovery workflow.

## Planning input boundary

Plan uses `blueprint_plan_prepare` -> author/review -> `blueprint_plan_submit`.
Prepare supplies compact schema, example, actual rejection rules and grounded
evidence. MCP derives IDs, slots, waves and coverage ledgers, preserving the
phase.plan execution shape. Review the complete model before submit when enabled;
include that verdict with the same model. No separate draft-save or finalize call.
Rejected documents are never saved. Read returns canonical plans and metadata.
Load recovery guidance only for conflicts or interrupted publication. Do not
reintroduce primitive artifact/state orchestration into the normal prompt.

## Bootstrap input boundary

New-project loads only its compact runtime contract. Project prepare owns readiness,
effective defaults and the generated authoring schema. First-run clarification is
required even without config; only an explicit `--auto` request bypasses it. Keep
config defaults interactive with auto_advance false. The model authors requirements
inside phases; the compiler assigns stable requirement IDs, phase numbers and
statuses, then MCP renders the existing canonical documents. Optional empty content
is valid. Do not reintroduce word-count gates, mandatory secondary audiences or
mandatory 2-5 criteria counts. Legacy bootstrapSeed callers remain supported but
must supply clarification in interactive mode. Test first-pass behavior with the
small corpus in new-project-authoring.test.ts; it is deterministic coverage, not a
hosted-model accuracy benchmark.
