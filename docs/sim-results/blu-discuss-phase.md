# `/blu-discuss-phase` Simulation Results

## Scope

`status`: `implemented`

Workflow simulated: `/blu-discuss-phase`

Simulation focus: realistic phase context generation through the real MCP write path, with optional discussion-log
persistence, checkpoint retention across failed writes, final state sync, and checkpoint cleanup.

Investigation grounding:

- Command: `commands/blu-discuss-phase.toml`
- Skill: `skills/blueprint-phase-discovery/SKILL.md`
- Skill references: `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md`,
  `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md`
- Save path: `blueprintPhaseArtifactWrite` in `src/mcp/tools/phase.ts`
- Context rendering: `src/mcp/tools/phase-context-model.ts`
- Context and discussion-log validation: `src/mcp/tools/artifacts.ts`
- Context schema: `src/mcp/artifact-contracts/schemas/phase.context.model.schema.json`

Artifacts involved:

- `.blueprint/phases/<phase-dir>/<phasePrefix>-CONTEXT.md`
- `.blueprint/phases/<phase-dir>/<phasePrefix>-DISCUSSION-LOG.md` when durable notes add value
- `.blueprint/phases/<phase-dir>/<phasePrefix>-DISCUSS-CHECKPOINT.json` while in progress
- `.blueprint/STATE.md`

## Simulation Summary

Three independent agents ran realistic `/blu-discuss-phase` simulations against temporary repos using real Blueprint
tool handlers. All three reached a valid saved context within three attempts. Two simulations also saved a discussion
log and verified final state routing plus checkpoint deletion.

| Agent        | Attempts | Final Result                                                            | Main Retry Drivers                                                                |
|--------------|---------:|-------------------------------------------------------------------------|-----------------------------------------------------------------------------------|
| GPT-5.5 high |        3 | Context, discussion log, state sync, checkpoint delete succeeded        | Unsupported mode claims, dropped deferred ideas, discussion-log unsupported claim |
| GPT-5.4 high |        3 | Context, discussion log, state sync, checkpoint delete succeeded        | Unsupported mode claims, weak references, dropped follow-ups, plan warning        |
| GPT-5.2 high |        3 | Context saved; discussion log placeholder probe passed then overwritten | Markdown fallback rejected, schema shape errors, non-empty arrays                 |

Positive behavior observed:

- Invalid context writes returned `status: "invalid"` and did not persist the artifact.
- Checkpoints remained present and safe to resume through failed writes.
- Final checkpoint deletion happened only after successful context/log/state finalization.
- Final routing came from `blueprint_state_load`, not from a guessed `/blu-plan-phase` handoff.

## Findings

### High: Distinct validation failures collapse into broad diagnostic codes (FIXME:)

Context and discussion-log validation correctly detected several real problems, but many unrelated failures came back
under the same broad codes:

- `context.unsupported_claim`
- `discussion-log.unsupported_claim`

In the simulations, those broad codes covered unsupported mode claims, non-concrete canonical references, dropped
deferred ideas, and dropped follow-ups. Repair agents then had to parse prose messages instead of relying on stable
machine-readable categories.

Evidence:

- Context anti-pattern diagnostics are assembled in `src/mcp/tools/artifacts.ts:5841` and
  `src/mcp/tools/artifacts.ts:5875`.
- Additional collapsed mapping appeared around `src/mcp/tools/artifacts.ts:6124`.

Why it matters: the failures are valid, but the response shape makes automated repair more expensive and less reliable.

### High: Repair guidance is under-specific for multi-issue failures (FIXME:)

When a context model had several issues, the returned `suggestedRepairs` collapsed to a section-specific fix plus
generic guidance such as repairing every required heading. For discussion-log failures, retry guidance similarly
collapsed to one generic repair sentence.

Evidence:

- Repair generation path: `src/mcp/tools/phase.ts:6874`.
- Generic context repair helper: `src/mcp/tools/artifacts.ts:5607`.

Why it matters: the workflow allows one repair retry before stopping. Generic repair text increases the chance that the
next attempt misses one of the real blockers.

### High: Discussion-log placeholder validation is too easy to bypass (DONT-FIXME:)

One simulation wrote a clearly placeholder-like discussion-log summary, `Record the major discussion outcomes here.`,
and `blueprint_phase_artifact_write` returned `status: "created"` with `validation.valid: true`.

Evidence:

- Discussion-log placeholder signals are defined in `src/mcp/artifact-contracts/index.ts:4061`.
- Placeholder matching uses literal/threshold logic in `src/mcp/tools/artifacts.ts:3609`.
- Placeholder threshold constant is in `src/mcp/tools/artifacts.ts:1800`.

Why it matters: this is the reverse of over-validation. It lets low-substance discussion logs persist while the context
path remains strict.

### High: Context schema forces non-empty arrays that can require filler(FIXME:)

The `phase.context` model schema requires non-empty arrays for many fields, including `deferredIdeas`, dependency lists,
`implementationDecisions`, and `specificIdeas`. A minimal but honest context with no deferred ideas or no prior
artifacts becomes schema-invalid.

Observed diagnostics included:

- `model.dependencies.priorPhaseArtifacts` with `schema.minItems` (`USER-SAYS` -> remove this validation, there can be a
  situation of no items here, let MCP save `none` in such a case)
- `model.dependencies.externalConstraints` with `schema.type` (`USER-SAYS` -> remove this validation, there can be a
  situation of no items here, let MCP save `none` in such a case)
- `model.openQuestions` with `schema.type` (`USER-SAYS` -> remove this validation, there can be a situation of no items
  here, let MCP save `none` in such a case)
- `model.deferredIdeas` with `schema.minItems` (`USER-SAYS` -> remove this validation, there can be a situation of no
  items here, let MCP save `none` in such a case)

Evidence:

- Top-level `minItems: 1` constraints: `src/mcp/artifact-contracts/schemas/phase.context.model.schema.json:28`.
- Dependency `minItems: 1` constraints: `src/mcp/artifact-contracts/schemas/phase.context.model.schema.json:178`.

Why it matters: the schema can push models to invent filler content just to satisfy required arrays. This is costly and
can reduce artifact honesty.

### Medium: Checkpoint shape is easy to get wrong(FIXME: if there are any concessions made due to backwards compatibility reasons, we can waive those, dont worry about backwards compatibility, look forward, remove the debt)

One simulation initially failed before artifact writes because the checkpoint shape was subtly invalid. The contract
says newer checkpoint fields are tolerated, but the live schema still requires compatibility arrays and exact object
shapes: decisions need `topic`, references need `label` and `target`, and `resumeMeta.currentQuestion` cannot be `null`.

Observed schema-style failure:

- `expected string, received undefined`

Evidence:

- Checkpoint contract guidance: `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md:156`.
- Live checkpoint schema: `src/mcp/tools/phase-checkpoint-records.ts:63`.

Why it matters: checkpointing is supposed to protect long-running discovery. Shape ambiguity can block the artifact flow
before the actual context save is tested.

### Medium: `Deferred Ideas` lacks a clear valid empty-state convention (FIXME: bring deferredIdeas in line with open questions, allow empty, MCP can write none. dont force it on model)

`Open Questions` has a precise empty sentinel that renders as `- none`. `Deferred Ideas` does not. A model using
`deferredIdeas: ["none"]` fails as non-substantive, so it must either preserve a real deferred item or invent a
substantive empty-state sentence.

Evidence:

- Context contract around `Deferred Ideas`: `src/mcp/artifact-contracts/index.ts:4009`.
- Open Questions sentinel configuration: `src/mcp/artifact-contracts/index.ts:4020`.

Why it matters: this is a small but common generation trap. Empty-state conventions should be explicit wherever the
model is allowed to have no real content.

### Medium: Schema invalid responses are accurate but not next-attempt friendly (FIXME:)

AJV diagnostics pointed to paths and keywords, but repair guidance effectively said to repair against the JSON schema.
For fields with non-empty constraints, the response did not suggest acceptable minimal honest values.

Evidence:

- Model-only write gating path: `src/mcp/tools/phase.ts:7022`.
- Context schema constraints: `src/mcp/artifact-contracts/schemas/phase.context.model.schema.json:28`.

Why it matters: the response is technically correct, but the next authoring attempt needs examples of safe repairs, not
only schema keywords.

### Medium: Empty sentinel strictness is high-friction (FIXME:)

Context Markdown validation rejects prose variants for empty Open Questions and requires the exact configured sentinel.
This is specific and repairable, but it remains an easy formatting failure.

Evidence:

- Sentinel enforcement: `src/mcp/tools/artifacts.ts:6074`.
- Open Questions sentinel configuration: `src/mcp/artifact-contracts/index.ts:4020`.

Why it matters: the strict sentinel protects consistency, but it is another place where a semantically correct answer
can fail for format-only reasons.

### Low: Plan-inventory reminder is useful but prompt-expensive

When context or discussion-log content mentioned existing or saved plans without also preserving the `/blu-plan-phase`
refresh warning, validation returned warnings. The warning did not block writes.

Evidence:

- Context warning path: `src/mcp/tools/artifacts.ts:5855`.
- Discussion-log warning path: `src/mcp/tools/artifacts.ts:5883`.

Why it matters: this is probably protective, but it is easy to miss and adds prompt burden even though the write
succeeds.

### Low: Final state sync can emit noisy duplicated plan warnings

One simulation seeded an invalid `03-01-PLAN.md`; final `blueprintStateUpdate` emitted a long duplicated warning block
during discuss-phase completion.

Evidence:

- State sync path: `src/mcp/tools/state.ts:2901`.

Why it matters: lower confidence because the seeded plan was intentionally invalid, but the warning volume could swamp
the concise completion receipt.

## Deduplication Notes

The repeated core issue across agents was not persistence failure. The save path worked: invalid writes did not persist,
checkpoints were retained, final state routing was refreshed, and cleanup was guarded.

The duplicated defects were merged into three main themes:

- diagnostic categories and repairs are too broad for one-retry model repair;
- the context model schema is stricter than many honest discovery states;
- discussion-log validation is weaker than context validation and can allow placeholder-like content.
