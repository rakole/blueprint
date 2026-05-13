# R8 Plan: Gemini And CLI Extension Research UX

## Planning Boundary

This is a planning-only artifact for the remaining Gemini and CLI extension UX improvement to `/blu-research-phase`. Do not implement source changes while writing or reviewing this document.

Use only the R8 section of `docs/imp/research/research-phase-frontier-research-and-improvement-plan.md` plus these current local surfaces:

- `commands/blu-research-phase.toml`
- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
- `skills/blueprint-phase-discovery/SKILL.md`
- `agents/blueprint-researcher.md`
- `agents/blueprint-project-researcher.md`

No source, tests, `dist/`, or non-imp docs are direct edit targets in this slice. Existing tests are validation targets only unless the implementor separately verifies the local test surface and gets approval to broaden the edit set.

Rollout labels are planning labels only. Do not paste `R8`, `R7`, `R6`, `R5`, `R4`, `R3`, `R2`, `R1`, `post-R8`, `post-R6`, `R8 work`, `R8 mode`, `R8 section`, `R8 validation`, `first implementation slice`, or similar plan-internal wording into product-facing or runtime-facing files.

## Plan Vocabulary

These are planning labels, not required product strings. Runtime files may use clear descriptive wording instead of verbatim Title Case labels.

| Planning label | Meaning |
|---|---|
| Research Progress Script | The stable visible stage sequence for long `/blu-research-phase` runs. |
| External Source Decision Gate | The `research.external_sources=ask` confirmation gate with `accept`, `decline`, and `cancel` outcomes. |
| Parent-Only Research Fallback | The complete same-quality path when `blueprint-researcher` is unavailable, disabled, unsupported, failed, or timed out. |
| Research Completion Receipt | The compact final response shape. |
| Research Run Metadata | The saved run metadata that records source mode, user decision, skipped source classes, execution mode, and completion outcome. |

## Non-Goals

- Do not add a new MCP tool.
- Do not change `research.external_sources` enum values or defaults.
- Do not broaden external fetching authority.
- Do not make MCP Elicitation a required runtime dependency.
- Do not require web access for repo-only research.
- Do not let `blueprint-researcher` own user decisions, persistence, checkpoints, state sync, or routing.
- Do not duplicate `XX-RESEARCH.md` in final chat output.
- Do not change implemented-only routing guarantees.
- Do not change `phase.research.requiredHeadings`, authoring templates, scaffold templates, placeholder signals, validators, TypeScript runtime metadata, or built `dist/` in this slice.

## Preflight

Before editing, verify the exact local anchors still exist:

```bash
rg -n 'shared stage vocabulary|final user response concise|research.external_sources|When using `blueprint-researcher`|Research Sidecar Packet Semantics|Completion Self-Check' commands/blu-research-phase.toml skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md skills/blueprint-phase-discovery/SKILL.md agents/blueprint-researcher.md agents/blueprint-project-researcher.md
rg -n --glob '!docs/imp/**' '\bR8\b|\bR7\b|\bR6\b|\bR5\b|\bR4\b|\bR3\b|\bR2\b|\bR1\b|post-R[0-9]+|first implementation slice|Host Progress Bridge' commands skills agents src tests dist docs
```

The second command is an initial hygiene scan. Existing unrelated historical references must be reviewed before changing them; new implementation work must not add any hits.

## Implementation Summary

Direct edit targets:

1. `commands/blu-research-phase.toml`
2. `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
3. `skills/blueprint-phase-discovery/SKILL.md`
4. `agents/blueprint-researcher.md`
5. `agents/blueprint-project-researcher.md` as a no-op boundary check

Implement the UX contract only:

- short visible stage-boundary narration for non-trivial research runs
- explicit `accept`, `decline`, and `cancel` handling for `research.external_sources=ask`
- persistence of the source decision envelope in checkpoint metadata before waits/stops and in final research metadata when final research is created or updated
- visible parent-only fallback when no suitable sidecar can help or a sidecar fails
- compact final response receipt instead of restating the artifact

## File: `commands/blu-research-phase.toml`

### Subtractions

Replace the current standalone progress sentence:

```text
For non-trivial runs, keep the shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route` visible together with resolved scope, active stage, pending gate, execution mode, and next safe action.
```

Replace the current final response gate:

```text
- Keep the final user response concise: phase, viewed/reused/created/updated/checkpointed outcome, warnings, and the next safe action.
```

Do not add `update_topic` or `write_todos` to this command manifest. The manifest should stay command-local and thin.

### Additions/Replacements

Use this replacement after `Execution profile: \`long-running-mutation\`.`:

```text
For non-trivial runs, keep the shared stage vocabulary `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, and `Route` visible together with resolved scope, active stage, pending gate, execution mode, and next safe action. Use short stage-boundary updates, not per-file narration. The visible research stages are: resolve phase; load saved context and state; inspect existing research/checkpoint; classify research strands; confirm external-source policy; collect repo evidence; collect approved external evidence; synthesize recommendations; write/validate artifact; sync state and summarize result.
```

Add these command-local gates after the existing `research.external_sources` gate:

```text
- Treat `research.external_sources=ask` as an external-source confirmation gate with three outcomes: `accept` gathers only the named external source classes and records the decision; `decline` continues repo-only or supplied-only and marks affected claims unchecked or lower-confidence; `cancel` stops safely, preserves or refreshes the research-owned checkpoint, and does not write a final `XX-RESEARCH.md` unless the artifact is already complete without the blocked external claim.
- Announce the external-source envelope once per run: why external access is needed, which source classes or known URLs/domains are in scope, and that the command will not mutate source files, installed extensions, host-global Blueprint state, credentials, packages, external services, or source-code defects.
- Persist `external_sources_mode`, `user_decision`, and the source envelope in the research checkpoint before waiting, cancelling, or stopping. On safe resume, do not re-ask the same envelope; ask only for a materially different source class or known URL/domain set.
- In `auto` mode, narrate the source envelope before fetching. In `off` mode, narrate the repo-only constraint once and avoid live-verification wording in the artifact or final response.
```

Add this gate immediately before the existing `When using \`blueprint-researcher\`` gate:

```text
- Before deciding whether to use a sidecar, make sidecar availability visible: check `workflow.subagents`, suitable `blueprint-researcher` availability, and whether the current strand benefits from isolated sidecar reading. If unavailable, disabled, unsupported, failed, or timed out, continue parent-only with one runnable strand at a time and the same evidence, checkpoint, validation, state-sync, and routing requirements.
```

Replace the final response gate with:

```text
- End with a compact completion receipt, not a duplicate of `XX-RESEARCH.md`: phase, outcome (`created`, `updated`, `reused`, `viewed`, `checkpointed`, or `blocked`), artifact path or `none`, `external_sources_mode`, `user_decision`, strand and recommendation counts when known, blockers or `none`, checkpoint disposition, state sync/routing result, and next safe implemented action.
```

## File: `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`

### Subtractions

In `## Shared Stage Mapping`, replace this sentence:

```text
During non-trivial runs, keep resolved scope, active stage, pending gate,
execution mode, and next safe action visible through Gemini-native progress
helpers when available, or concise progress recaps when they are not.
```

In `## Required MCP Calls`, replace the `blueprint_config_get` bullet text that currently ends with:

```text
`off` means no live external lookup, `ask` means confirm
first, and `auto` allows official-doc or external verification when the repo
cannot settle the claim.
```

In `## Retry And Repair Behavior`, replace these two bullets:

```text
- If `research.external_sources` is `off`, do not perform live external lookup.
  Keep the run repo-only and avoid implying that upstream guidance was checked.
- If `research.external_sources` is `ask`, stop for confirmation before any
  official-doc or external verification.
```

Do not remove existing stage vocabulary, strand ledger, evidence provenance, checkpoint, sidecar, or dependency/tool sections.

### Additions/Replacements

Add this section immediately after `## Shared Stage Mapping`:

````md
## Visible Research Progress

For non-trivial runs, keep progress visible through short stage-boundary
updates. Use Gemini-native progress helpers when available. When they are not
available, emit concise text updates at stage boundaries and exceptional events.

Gemini-native progress helpers are presentation mirrors only. They do not
expand the tool allowlist, authorize persistence, external access, user
decisions, checkpointing, state sync, or routing, and they never replace MCP
checkpoint, state, or command-catalog authority.

Visible research stages:

| Step | User-visible wording | Shared stage | Required visibility |
|------|----------------------|--------------|---------------------|
| 1 | resolve phase | Resolve | selected phase or blocker |
| 2 | load saved context and state | Read | context path/status and state source |
| 3 | inspect existing research/checkpoint | Read | reuse/update/checkpoint posture |
| 4 | classify research strands | Decide | active strand set and execution mode |
| 5 | confirm external-source policy | Decide | source mode, pending gate, or repo-only constraint |
| 6 | collect repo evidence | Execute | evidence lane and stop/widen reason when relevant |
| 7 | collect approved external evidence | Execute | source envelope and decision outcome |
| 8 | synthesize recommendations | Execute | accepted evidence basis and unresolved blockers |
| 9 | write/validate artifact | Persist/Validate | write path, validation status, repair attempt, or checkpoint |
| 10 | sync state and summarize result | Route | state sync result, routing source, next safe action |

Progress updates must be short boundary updates. Do not narrate every file read.
Emit exceptional updates for external-source waits, sidecar unavailable or
failed, external sources declined, external source unavailable, validation
repair, checkpoint writes, post-write state-sync failure, and completion.

Example progress line:

```text
Research stage 5/10: external sources are set to ask; requesting confirmation before network-backed verification.
```

Future host progress integration may map progress values and messages to the
same stage script, but deterministic text stage lines remain the compatibility
baseline.
````

Replace the `blueprint_config_get` bullet with:

```md
- `blueprint_config_get` with `scope: "effective"`: provides the source-of-truth
  `research.external_sources` policy before any official-doc, package-registry,
  security-advisory, release-note, remote-code-search, or other external
  verification step. `off` means no live external lookup. `ask` triggers an
  external-source confirmation gate with `accept`, `decline`, and `cancel`
  outcomes. `auto` allows bounded external verification only when repo evidence
  cannot settle a planner-critical claim. `workflowPosture.research.externalSources`
  remains a mirrored convenience view, not the authority.
```

Add this section after `## Evidence Quality, Citations, And Provenance`:

````md
## External Source Decision Gate

Treat `research.external_sources=ask` as a first-class user gate, not a final
prose caveat. Ask at the point of need, before any live external verification.

The gate prompt must include:

- why external access is needed
- which source classes will be used
- known URLs or domains when already known
- what will not happen: no source-file mutation, installed-extension changes,
  host-global Blueprint state mutation, credential use, package installation,
  external service mutation, or source-code fixing

Use this outcome model:

- `accept`: gather only the named source classes and record the decision.
- `decline`: continue repo-only or supplied-only, mark affected claims
  unchecked or lower-confidence, and avoid "official docs confirm", "latest",
  "current upstream", or equivalent live-verification wording.
- `cancel`: stop safely, preserve or refresh the research-owned checkpoint, and
  do not write final `XX-RESEARCH.md` unless the artifact is already complete
  without the blocked external claim.

Persist `external_sources_mode`, `user_decision`, and the source envelope in the
research checkpoint before waiting, cancelling, or stopping. On safe resume, do
not re-ask the same envelope; ask only for a materially different source class
or known URL/domain set.

Do not repeatedly ask for the same source envelope inside one run. Ask again
only when the run needs a materially different source class, such as moving
from official docs to package registry metadata, security advisories, release
notes, issue trackers, or user-supplied URLs.

In `auto` mode, narrate the source envelope before fetching:

```text
External sources are auto-enabled; using official docs for standards and current product behavior.
```

In `off` mode, narrate the repo-only constraint once and keep freshness-sensitive
external claims unchecked, lower-confidence, or in `## Open Questions`.
````

Add this section after `## Investigation Trace And Navigation Evidence`:

```md
## Research Run Metadata

Record run-level UX metadata when final research is created or updated. Do not
change `phase.research.requiredHeadings`, authoring templates, scaffold
templates, placeholder signals, or validators in this UX slice. Include this
metadata only when creating or updating final research; do not modify an
existing artifact solely for a viewed, skipped, or reused no-write path.

Place the metadata inside existing artifact structure, preferably under
`## Summary`, using these keys:

| Key | Value |
|-----|-------|
| `external_sources_mode` | off|ask|auto |
| `user_decision` | not_required|accept|decline|cancel|not_applicable |
| `source_classes_allowed` | <classes or none> |
| `source_classes_declined_or_unavailable` | <classes or none> |
| `execution_mode` | parent-only|sidecar-assisted |
| `completion_receipt` | <artifact path or none; state sync result; next safe action> |

When external evidence was declined, cancelled, unavailable, or disabled by
config, also reflect the resulting uncertainty in `## Confidence Breakdown` and
`## Open Questions` when it affects planner readiness. Do not hide the
uncertainty only in chat.
```

Add this paragraph near the top of `## No-Subagent Fallback`, before the numbered list:

```md
Make parent-only fallback visible before dispatch. The parent should say once
whether `workflow.subagents` is disabled, no suitable `blueprint-researcher` is
available, the strand does not justify sidecar work, or a sidecar failed or
timed out. The fallback remains the required complete path, not a degraded
emergency path.
```

Add this paragraph after the existing sidecar failure paragraph:

```md
Do not dwell on sidecar absence in the final response unless it changed output
quality. Preserve detailed uncertainty in the artifact and checkpoint. Mention
fallback in the completion receipt only when it lowered confidence, left
blockers, or caused checkpointing.
```

Replace the two retry bullets for external source policy with:

```md
- If `research.external_sources` is `off`, do not perform live external lookup.
  Keep the run repo-only, narrate the repo-only constraint once, and avoid
  implying that upstream guidance was checked.
- If `research.external_sources` is `ask`, use the external-source confirmation
  gate before any official-doc or external verification. `accept` gathers the
  named evidence, `decline` continues with explicit unchecked uncertainty, and
  `cancel` stops with a research-owned checkpoint when the blocked evidence
  matters.
```

Add this section before `## Completion Criteria`:

````md
## Research Completion Receipt

The final response is a compact receipt, not a duplicate of `XX-RESEARCH.md`.
Detailed citations, alternatives, evidence packets, confidence analysis, and
open questions belong in the artifact.

Use this text shape:

```text
Research result: <created|updated|reused|viewed|checkpointed|blocked>
Phase: <phase number and name>
Artifact: <MCP-returned research path or none>
External sources: external_sources_mode=<off|ask|auto>, user_decision=<not_required|accept|decline|cancel|not_applicable>
Coverage: strands=<count or unknown>, recommendations=<count or unknown>
Blockers: <none or concise blocker>
Checkpoint: <deleted|preserved|refreshed|none>
State and routing: <synced and refreshed|not synced: reason|blocked: reason>
Next safe action: <implemented command or /blu-progress>
```

Use explicit incomplete states:

- `Research checkpointed; no final artifact written.`
- `Research saved with external sources declined; see Confidence Breakdown for unchecked claims.`
- `Research blocked before write; checkpoint preserved for continuation.`
````

Add this completion criterion:

```md
- the final response used the completion receipt shape and did not duplicate
  the saved research artifact
```

## File: `skills/blueprint-phase-discovery/SKILL.md`

### Subtractions

In the `/blu-research-phase` workflow rule 5, replace:

```text
`off` stays repo-only, `ask` stops for confirmation, and `auto` allows
official-doc or external verification only when repo evidence cannot settle
the claim.
```

Do not add full tables or long schema blocks to this shared skill. The runtime contract remains the detailed authority.

### Additions/Replacements

Replace the rule 5 fragment with:

```text
`off` stays repo-only, `ask` uses the runtime contract's external-source confirmation gate with `accept`, `decline`, and `cancel` outcomes, and `auto` allows bounded official-doc or external verification only when repo evidence cannot settle the claim.
```

Add this sentence to workflow rule 8 after the existing helper fallback sentence:

```text
Use the runtime contract's visible research stages for stage-boundary progress, and use the compact completion receipt for the final response instead of restating the full artifact.
```

Add this sentence to workflow rule 9 after the first sentence:

```text
Make parent-only fallback visible when `workflow.subagents` disables sidecars, no suitable `blueprint-researcher` is available, or a sidecar fails or times out; continue one runnable strand at a time rather than expanding silently.
```

Add this bullet to `## Completion Self-Check`:

```md
- For `/blu-research-phase`, progress used the visible research stages, any
  `research.external_sources=ask` branch recorded `accept`, `decline`, or
  `cancel`, parent-only fallback was explicit when relevant, and the final
  response used the compact completion receipt instead of duplicating
  `XX-RESEARCH.md`.
```

## File: `agents/blueprint-researcher.md`

### Subtractions

Do not add new required packet fields for this UX slice.

Do not add external fetching, shell access, browser access, MCP writes, `ask_user`, checkpointing, state sync, routing, progress ownership, or final response ownership to this agent.

### Additions/Replacements

Add this paragraph after the `Research Sidecar Packet Semantics` packet block:

```md
Do not write progress copy or final receipt copy for the parent. The parent
derives user-visible receipt impact from existing packet fields such as
`status`, `terminationReason`, `confidence`, `warnings`, and `followUps`, then
decides whether sidecar results changed confidence, left blockers, or required
checkpointing.
```

Add this bullet to `## Required Output Contract` after the warnings/follow-ups bullet:

```md
- Do not author final progress narration or a final completion receipt. Return
  bounded findings, warnings, and follow-ups so the parent can decide what, if
  anything, belongs in the user-visible progress or receipt.
```

## File: `agents/blueprint-project-researcher.md`

### Subtractions

None.

### Additions/Replacements

None. This agent is a bootstrap-context specialist, not the `/blu-research-phase` sidecar. It already states that the parent command owns visible stage narration, `update_topic`, `write_todos`, and `ask_user` gates. Do not edit it for this UX pass.

## Test Assertion Text

Tests are not direct edit targets in this scoped slice. If the implementor verifies the existing test surface and receives approval to update tests, the assertion text should cover these product behaviors without using rollout labels:

```text
visible research stages
external-source confirmation gate
accept
decline
cancel
external_sources_mode
user_decision
parent-only fallback
compact completion receipt
does not duplicate `XX-RESEARCH.md`
does not add sidecar progress ownership
does not change phase.research template or validators
```

Suggested exact assertion strings or regex fragments, after test-surface verification:

```ts
assert.match(commandFile, /resolve phase[\s\S]*load saved context and state[\s\S]*inspect existing research\/checkpoint[\s\S]*classify research strands[\s\S]*confirm external-source policy[\s\S]*collect repo evidence[\s\S]*collect approved external evidence[\s\S]*synthesize recommendations[\s\S]*write\/validate artifact[\s\S]*sync state and summarize result/i);
assert.match(commandFile, /`accept`[\s\S]*`decline`[\s\S]*`cancel`/i);
assert.match(commandFile, /external_sources_mode/i);
assert.match(commandFile, /user_decision/i);
assert.match(commandFile, /parent-only/i);
assert.match(commandFile, /completion receipt/i);
assert.match(runtimeContract, /Gemini-native progress helpers are presentation mirrors only/i);
assert.match(runtimeContract, /do not re-ask the same envelope/i);
assert.match(runtimeContract, /phase\.research\.requiredHeadings[\s\S]*authoring templates[\s\S]*validators/i);
assert.match(researcherAgent, /Do not write progress copy or final receipt copy/i);
assert.doesNotMatch(researcherAgent, /progressSummary|userVisibleImpact/);
```

## Build And Dist Expectations

No runtime source changes are direct edit targets in this scoped slice, so no `dist/` rebuild is expected.

If an implementor discovers a necessary change under `src/` or generated `dist/`, stop and request approval to broaden scope before making that change. After any approved runtime source change, the implementation must run `npm run build` and review tracked `dist/` output.

## Validation Commands

In a fresh worktree, run `npm ci` before build, typecheck, or tests.

Targeted validation for this scoped UX contract pass:

```bash
npm ci
npx tsx --test tests/phase-discovery-research.test.ts tests/agent-contract-specialists.test.ts
git diff --check
git status --short
```

Do not run `npm run build` unless approved runtime source changes are added.

## Wording Hygiene Gate

Run these grep checks after implementation. Exclude `docs/imp/**` because this plan intentionally contains planning labels.

Search for forbidden rollout labels and plan-internal wording:

```bash
rg -n --glob '!docs/imp/**' '\bR8\b|\bR7\b|\bR6\b|\bR5\b|\bR4\b|\bR3\b|\bR2\b|\bR1\b|post-R[0-9]+|first implementation slice|R8 work|R8 mode|R8 section|R8 validation|post-R8|post-R6|Host Progress Bridge' commands skills agents src tests dist docs
```

Search built output too when a build was approved and run:

```bash
rg -n '\bR8\b|\bR7\b|\bR6\b|\bR5\b|\bR4\b|\bR3\b|\bR2\b|\bR1\b|post-R[0-9]+|first implementation slice|R8 work|R8 mode|R8 section|R8 validation|post-R8|post-R6|Host Progress Bridge' dist
```

Any new hit in `commands/`, `skills/`, `agents/`, `src/`, `tests/`, `dist/`, or non-imp `docs/` must be fixed unless it is clearly unrelated historical documentation.

Review planning-label vocabulary rather than requiring it to appear verbatim:

```bash
rg -n --glob '!docs/imp/**' 'Research Progress Script|External Source Decision Gate|Parent-Only Research Fallback|Research Completion Receipt|Research Run Metadata' commands skills agents src tests dist docs
```

Hits for these descriptive labels are allowed only when they make the runtime contract clearer. Implementors may instead use equivalent plain wording such as "visible research stages", "external-source confirmation gate", "parent-only fallback", "compact completion receipt", and "research run metadata".

## Implementation Stop Conditions

Stop and ask for clarification if implementation reveals any of these ambiguities:

- Whether `cancel` should ever write a partial final research artifact.
- Whether a specific external source class counts as materially different enough to ask again.
- Whether existing tests must be edited in this slice despite the direct-edit boundary.
- Whether sidecar timeout handling should retry inline automatically or always checkpoint.
- Whether any required change under `src/`, `dist/`, or non-imp docs is unavoidable.

Do not assume ambiguous behavior. Preserve the current safer boundary until clarified.
