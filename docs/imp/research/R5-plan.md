# R5 Plan: Research-Phase Strand Ledger, Checkpointing, And Handoffs

**Status:** draft for approval
**Scope:** `/blu-research-phase` only, based on the R5 section of
`docs/imp/research/research-phase-frontier-research-and-improvement-plan.md`.
**Assumption from requester:** R1, R2, R3, and R4 are already implemented. Do
not rework their evidence ladder, dependency/tool evaluation, or R4 provenance
contracts except where R5 references those packets as inputs to orchestration.

## Goal

Make `/blu-research-phase` behave like a parent-owned long-running research
orchestrator:

- the parent command owns selected phase, source policy, strand selection,
  checkpoints, evidence acceptance, final synthesis, MCP writes, state sync, and
  routing;
- topic strands are explicit durable units, not loose prose;
- checkpoints store a compact research ledger, not child transcripts;
- sidecars return bounded packets and never take over final artifact ownership;
- resume/discard/default behavior is precise and test-covered;
- final checkpoint deletion happens only after final research write, state sync,
  state reload, and implemented-command routing receipt succeed.

## Non-Goals

Do not implement R6 or later artifact-template changes in this slice.

Do not change `phase.research` required headings, `renderResearchTemplate(...)`,
or research validator strictness for Plan Input Queue, source register, or claim
support tables. Those are outside R5.

Do not add a new MCP tool.

Do not change `RESEARCH_PHASE_REQUIRED_TOOLS`.

Do not change `workflow.subagents`, optional-agent registration, or the
`blueprint-researcher` tool allowlist.

Do not add `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md`
to the `/blu-research-phase` `input_bundles` list. Current tests intentionally
keep the effective research skill input to only
`skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`.

Do not touch `agents/blueprint-project-researcher.md`. It was read for pattern
consistency, but it is a bootstrap specialist and not part of `/blu-research-phase`.

Do not introduce browser, web-search, shell-only, or generic-agent substitutes.

## Current Baseline To Preserve

These are already present after R1-R4 and must stay intact:

- `commands/blu-research-phase.toml` is thin and points at
  `research-phase-runtime-contract.md`.
- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
  owns rich research behavior.
- `skills/blueprint-phase-discovery/SKILL.md` owns shared discovery boundaries
  and the command-scoped MCP allowlist.
- `agents/blueprint-researcher.md` is read-only and parent-owned.
- `src/mcp/tools/phase-checkpoint-records.ts` already validates the generic
  checkpoint fields and uses `.catchall(z.unknown())`; R5 should use that
  existing compatibility surface by storing `researchLedger` as an extra nested
  field.
- `tests/phase-discovery-tools.test.ts` already covers generic checkpoint
  persistence, foreign-owner protection, guarded deletion, and legacy reads.
- `tests/phase-discovery-research.test.ts`,
  `tests/mcp-contract-audit-metadata.test.ts`, and
  `tests/agent-contract-specialists.test.ts` already contain string parity
  guards for research command behavior.

## Implementation Order

1. Update the rich runtime contract first.
2. Mirror only concise rules into the command manifest, shared skill, long
   running profile, command docs, MCP tools docs, runtime metadata, and runtime
   reference row.
3. Tighten `blueprint-researcher` packet/handoff wording.
4. Add tests before or with each doc/runtime metadata change.
5. Run focused tests.
6. Rebuild `dist/` because `src/mcp/command-runtime-metadata.ts` changes.

## File Summary

| File | Change Type | Rationale |
|------|-------------|-----------|
| `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md` | Add full R5 contract and small replacements | Main behavior authority for strands, checkpoints, resume/discard, progress recaps, sidecar failure fallback, parent synthesis |
| `commands/blu-research-phase.toml` | Add two thin gate bullets and strengthen checkpoint bullet | Keep manifest concise while making parent-owned strand ledger visible |
| `skills/blueprint-phase-discovery/SKILL.md` | Add short references to ledger/checkpoint timing | Shared skill should point to runtime contract without duplicating full shape |
| `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md` | Add research pending gates and recap shape | Shared helper visibility guidance gets research-specific gates |
| `agents/blueprint-researcher.md` | Add R5 sidecar packet semantics | Handoff is a packet, not a transcript or final artifact |
| `docs/commands/research-phase.md` | Add user-visible checkpoint/resume behavior | Public command doc mirrors runtime contract without helper internals |
| `docs/MCP-TOOLS.md` | Expand research command ownership note and checkpoint note | MCP docs mention optional nested research ledger and timing |
| `src/mcp/command-runtime-metadata.ts` | Expand `contractNotes` only | Runtime resource exposes R5 guarantees |
| `docs/RUNTIME-REFERENCE.md` | Mirror concise runtime note | Human runtime reference stays aligned |
| `tests/phase-discovery-research.test.ts` | Add parity assertions | Guard text drift across command surfaces |
| `tests/phase-discovery-tools.test.ts` | Add checkpoint round-trip and guarded delete success tests | Prove current catchall preserves `researchLedger` |
| `tests/agent-contract-specialists.test.ts` | Add agent packet assertions | Guard sidecar packet semantics |
| `tests/mcp-contract-audit-metadata.test.ts` | Add cross-surface R5 assertions | Keep discovery parity strong |

## Exact Changes

### 1. `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`

#### 1.1 Replace the R5-related parity bullets

Find this block in `## Parity Target`:

````md
- topic-strand research with checkpoints for pauses or inconclusive evidence
- per-strand planning handoff with recommendation, affected files or modules,
  validation or test implications, unresolved blockers, evidence basis, and
  confidence
````

Replace it with:

````md
- parent-owned research strand ledger for non-trivial runs, with each strand
  tracked by id, type, question, requirement IDs, repo anchors, source policy,
  dependencies, expected packet shape, budget, status, evidence IDs, accepted
  claims, rejected or low-quality sources, search notes, uncertainty, stopping
  reason, and next action
- checkpointed resumability for pauses, inconclusive evidence, blocked source
  policy, sidecar failures, budget or timeout limits, validation repair, and
  post-write state-sync or route-refresh failures
- per-strand planning handoff with recommendation, affected files or modules,
  validation or test implications, unresolved blockers, evidence basis, and
  confidence
- parent-owned synthesis from accepted strand packets before final
  `XX-RESEARCH.md` authoring; child transcripts are never copied into the final
  artifact or checkpoint
````

#### 1.2 Replace the `Execute`, `Persist`, and `Route` stage bullets

Find the `## Shared Stage Mapping` list. Replace only these three bullets:

```md
- `Execute`: build the initial assessment, follow the repository evidence
  ladder, record per-strand search notes and navigation evidence, research one
  topic strand at a time, evaluate dependency/tool choices when they affect a
  recommendation, close each strand with a planning handoff, and keep evidence
  provenance visible, and construct the R4 claim/evidence packet before writing final recommendations.
- `Persist`: scaffold only a missing file, write checkpoints for pauses, and
  write final research through MCP only.
- `Route`: reload state and recommend only implemented next commands.
```

with:

```md
- `Execute`: build the initial assessment, follow the repository evidence
  ladder, classify non-trivial work into the parent-owned research strand
  ledger, record per-strand search notes and navigation evidence, research one
  runnable strand at a time, evaluate dependency/tool choices when they affect
  a recommendation, accept or reject sidecar packets before synthesis, close
  each strand with a planning handoff, keep evidence provenance visible, and
  construct the claim-addressable evidence packet before writing final
  recommendations.
- `Persist`: scaffold only a missing file, write checkpoints when there is
  useful resumable strand state, checkpoint before blocked waits or repair
  retries, and write final research through MCP only.
- `Route`: reload state, refresh implemented-command routing, delete only the
  research-owned checkpoint after write plus routing succeeds, and recommend
  only implemented next commands.
```

#### 1.3 Replace checkpoint MCP call bullets

In `## Required MCP Calls`, replace the `blueprint_phase_checkpoint_get`,
`blueprint_phase_checkpoint_put`, and `blueprint_phase_checkpoint_delete`
bullets with:

```md
- `blueprint_phase_checkpoint_get`: detects resumable in-progress research and
  controls resume-versus-discard branching. Pass
  `expectedOwnerCommand: "/blu-research-phase"` and `expectedMode: "research"`,
  then honor `safeToResume` and `warnings` before using saved state. A safe
  research checkpoint resumes by default unless the user explicitly asks to
  discard it.
- `blueprint_phase_checkpoint_put`: persists useful continuation state using
  the structured checkpoint shape with `ownerCommand: "/blu-research-phase"`
  and `resumeMeta.mode: "research"`. For non-trivial research, include a nested
  `researchLedger` payload with `schemaVersion: "research-ledger/v1"`, compact
  strand state, accepted evidence packet references, sidecar status, draft
  state, and next action. Store packets and source references, not child
  transcripts. The MCP tool owns the shared checkpoint path; do not assume the
  filename is research-specific.
- `blueprint_phase_checkpoint_delete`: removes stale continuation state only
  after final research writes successfully, `STATE.md` sync succeeds, refreshed
  state load succeeds, and implemented-command routing has been checked. Pass
  `expectedOwnerCommand: "/blu-research-phase"` and `expectedMode: "research"`
  so cleanup cannot delete another command's shared checkpoint.
```

#### 1.4 Insert the new R5 section

Insert the following new section immediately before the existing
`## Tool And Dependency Selection` heading:

````md
## Research Strand Ledger And Checkpoint Semantics

Treat topic strands as a parent-owned ledger, not as ad hoc prose. A simple run
may collapse strands, but every non-trivial, blocked, resumed, or sidecar-aided
run should classify work into the smallest useful set from:

1. `context-lock`: saved `XX-CONTEXT.md`, requirement mapping, user constraints,
   prior phase artifacts, and current workflow gates.
2. `repo-map`: saved `.blueprint/codebase/` summaries, relevant files, symbols,
   tests, commands, and contract anchors.
3. `stack-and-dependencies`: current repo stack, existing dependencies,
   candidate libraries/tools, versions, setup, license/security/maintenance
   cautions, and "do not hand-roll" calls.
4. `architecture-integration`: implementation patterns, ownership boundaries,
   state/data flow, MCP/tool contracts, and affected modules.
5. `validation-and-tests`: expected verification surfaces, test harnesses,
   fixtures, commands, and failure modes planning must cover.
6. `risks-and-pitfalls`: anti-patterns, contradictory evidence, operational
   hazards, migration concerns, and blocked assumptions.
7. `external-delta`: official or supplied external sources only when
   `research.external_sources` allows them and repo evidence cannot settle the
   claim.
8. `planner-handoff`: parent-owned synthesis across completed strands into
   recommendations, open questions, confidence, and planning handoff notes.

For each strand, track:

- `id`
- `type`
- `question`
- `requirementIds`
- `repoAnchors`
- `sourcePolicy`
- `dependencies`
- `expectedPacket`
- `budget`
- `status`
- `evidenceIds`
- `acceptedClaims`
- `rejectedOrLowQualitySources`
- `searchNotes`
- `uncertainty`
- `stoppingReason`
- `nextAction`

Valid strand statuses are:

- `pending`
- `active`
- `complete`
- `blocked`
- `inconclusive`
- `failed`
- `deferred`

Valid stopping reasons are:

- `evidence-sufficient`
- `no-authoritative-source-found`
- `blocked-by-source-policy`
- `budget-exhausted`
- `timeout`
- `tool-failure`
- `contradictory-evidence`
- `parent-escalation-required`
- `waiting-for-user`
- `validation-repair-required`
- `state-sync-failed`
- `route-refresh-failed`

`Inconclusive with evidence and next search direction` is a valid terminal
strand state. Endless research is not.

Checkpoint research state with `blueprint_phase_checkpoint_put` only when there
is useful continuation state. Update the checkpoint:

- after `blueprint_phase_checkpoint_get` returns a safe resumable checkpoint and
  the parent accepts or defaults to resume, if the parent changes the active
  strand or next action;
- before launching any sidecar wave, with strand ids, questions, budgets, and
  expected packet shape already recorded;
- after each parent-accepted or parent-rejected sidecar packet;
- after each parent-completed inline strand when the remaining strands still
  matter and the run is long enough to resume later;
- before waiting on `research.external_sources=ask` when the run cannot continue
  repo-only without losing context;
- when a source-policy decline, tool failure, budget limit, timeout, or
  contradictory evidence leaves a strand inconclusive;
- before a final artifact write retry when validation diagnostics require
  repair;
- after a failed or identical validation repair attempt, preserving the draft
  status and exact diagnostics;
- before stopping due to state-sync or route-refresh failure after a final write
  attempt.

Do not checkpoint after a straightforward successful final write except as a
temporary pre-delete state. Delete only after the final research write, state
sync, refreshed state load, and implemented-command routing receipt are known.

Recommended parent command loop:

```ts
const checkpoint = await blueprint_phase_checkpoint_get({
  phase,
  expectedOwnerCommand: "/blu-research-phase",
  expectedMode: "research",
});

const ledger = decideResumeOrFreshLedger(checkpoint, userIntent);
classifyStrands(ledger, context, researchStatus, config, contract);

for (const strand of nextRunnableStrands(ledger)) {
  setProgress("Execute", strand);

  if (shouldUseSidecar(strand, config)) {
    await putCheckpoint(ledger.markDispatching(strand));
    const packet = await runResearcherSidecar(strand);
    ledger.acceptOrRejectPacket(strand.id, packet);
    await putCheckpoint(ledger);
  } else {
    const packet = await parentInlineResearch(strand);
    ledger.acceptOrRejectPacket(strand.id, packet);
    if (ledger.hasRemainingCriticalWork()) {
      await putCheckpoint(ledger);
    }
  }

  if (strand.isBlockedOrInconclusive()) {
    await putCheckpoint(ledger);
    stopWithCheckpointReceipt(ledger);
  }
}

const draft = synthesizeResearchFromParentLedger(
  ledger,
  contract.authoringTemplate
);
const write = await blueprint_phase_artifact_write({
  phase,
  artifact: "research",
  content: draft,
});

if (write.status === "invalid") {
  await putCheckpoint(ledger.recordValidationAttempt(write.validation));
  const repaired = repairSameDraft(draft, write.validation);
  const retry = await blueprint_phase_artifact_write({
    phase,
    artifact: "research",
    content: repaired,
    overwrite: true,
  });
  if (retry.status === "invalid") {
    await putCheckpoint(ledger.recordRepeatedValidationFailure(retry.validation));
    stopWithCheckpointReceipt(ledger);
  }
}

await blueprint_state_update({
  base: "synced",
  patch: { currentPhase: phase, activeCommand: "/blu-research-phase" },
});
await blueprint_state_load({ phase });
await blueprint_command_catalog({});
await blueprint_phase_checkpoint_delete({
  phase,
  expectedOwnerCommand: "/blu-research-phase",
  expectedMode: "research",
});
```

Keep the existing generic checkpoint fields for compatibility. Add
`researchLedger` as a nested payload instead of replacing the generic schema:

```json
{
  "ownerCommand": "/blu-research-phase",
  "completedAreas": ["S1 context-lock"],
  "remainingAreas": ["S2 repo-map"],
  "decisions": [],
  "deferredIdeas": [],
  "canonicalReferences": [],
  "resumeMeta": {
    "mode": "research",
    "pendingTopics": ["S2 repo-map"],
    "completedTopics": ["S1 context-lock"],
    "currentQuestion": "Which repo surfaces constrain this phase?",
    "notes": [],
    "resumeHint": "Resume at S2.",
    "updatedAt": "2026-05-12T00:00:00.000Z"
  },
  "researchLedger": {
    "schemaVersion": "research-ledger/v1",
    "phase": {
      "number": "3",
      "prefix": "03",
      "name": "Phase Discovery",
      "dir": ".blueprint/phases/03-phase-discovery"
    },
    "runtime": {
      "ownerCommand": "/blu-research-phase",
      "artifactId": "phase.research",
      "externalSources": {
        "effective": "ask",
        "decision": "pending",
        "reason": "Repo evidence cannot settle upstream behavior."
      }
    },
    "strands": [
      {
        "id": "S1",
        "type": "context-lock",
        "question": "What saved context decisions constrain this research?",
        "requirementIds": ["REQ-001"],
        "repoAnchors": [".blueprint/phases/03-example/03-CONTEXT.md"],
        "sourcePolicy": "repo-only",
        "dependencies": [],
        "expectedPacket": "parent-inline-evidence",
        "budget": {
          "maxFiles": 3,
          "maxSidecars": 0
        },
        "status": "complete",
        "evidenceIds": ["SRC-001"],
        "acceptedClaims": ["Context requires MCP-owned persistence."],
        "rejectedOrLowQualitySources": [],
        "searchNotes": [],
        "uncertainty": "none",
        "stoppingReason": "evidence-sufficient",
        "nextAction": "feed planner-handoff"
      }
    ],
    "evidencePackets": [
      {
        "id": "SRC-001",
        "class": "repo",
        "strandId": "S1",
        "source": ".blueprint/phases/03-example/03-CONTEXT.md",
        "claim": "Saved context constrains research scope.",
        "confidence": "high"
      }
    ],
    "sidecars": [],
    "draftState": {
      "hasDraft": false,
      "sectionsTouched": [],
      "validationAttempted": false,
      "validationIssues": [],
      "finalWriteAttempted": false,
      "lastKnownPath": null
    },
    "nextAction": {
      "stage": "Execute",
      "pendingGate": "none",
      "safeCommand": "/blu-research-phase 3"
    }
  }
}
```

Initial implementation must not require every optional nested field for every
simple run. Runtime/text tests should require only the generic MCP checkpoint
fields plus references to `researchLedger.schemaVersion`,
`researchLedger.strands`, and `researchLedger.nextAction`. Code should not add a
strict `researchLedger` Zod schema in this slice.

Checkpoint resume behavior:

- If no checkpoint exists, start a fresh parent-owned strand ledger.
- If a checkpoint exists and `safeToResume=true`, resume by default. Show a
  compact recap of completed strands, blocked strands, pending gate, and next
  action before doing more work.
- If the user explicitly asks to discard a safe research checkpoint, call
  `blueprint_phase_checkpoint_delete` with
  `expectedOwnerCommand: "/blu-research-phase"` and `expectedMode: "research"`;
  then start fresh only if deletion succeeds.
- If a checkpoint exists but `safeToResume=false`, do not resume, overwrite, or
  delete it by default. Report `ownerCommand`, `resumeMode`, warnings, and the
  next safe implemented action.
- If a legacy checkpoint is mode-compatible but missing `ownerCommand`, treat it
  as resumable only when `safeToResume=true`, include the warning in the
  progress recap, and refresh it into the richer research ledger before the next
  pause.
- If final research is successfully written but state sync, state load, or
  command-catalog routing fails afterward, keep or refresh the checkpoint with
  the exact failure and do not claim the run fully completed.

When `update_topic` and `write_todos` are available, use them only as a
session-local mirror of the strand ledger: topic is current stage plus active
strand, and todos are strand ids and statuses. They are never persistence and
never replace `blueprint_phase_checkpoint_put`.

When those helpers are unavailable, emit compact progress recaps at stage
boundaries and exceptional events:

```text
Stage: Execute | Scope: Phase 3 Phase Discovery | Mode: parent-only |
Completed: S1 context-lock, S2 repo-map | Active: S3 stack-and-dependencies |
Pending gate: external-source confirmation | Next safe action: checkpoint or
resume /blu-research-phase 3
```

Do not narrate every file read. Recap after Read, after strand classification,
after each completed or blocked strand, before checkpointing, before validation
repair, and after Route.

If `blueprint-researcher` is unavailable or disabled, the parent narrows to one
runnable strand at a time, uses scoped repo searches, and checkpoints blocked
strands instead of expanding silently.

If a sidecar fails or times out, the parent records a sidecar packet with
`status: "failed"`, retries inline only when the strand budget and source
policy allow it, and otherwise checkpoints with `stoppingReason:
"tool-failure"` or `"budget-exhausted"`.

Before writing final research, the parent command must run a synthesis pass over
the accepted strand ledger. The final `XX-RESEARCH.md` may cite child packets or
repo/external evidence, but it must not paste a child transcript or let a sidecar
decide final confidence, open questions, routing, checkpoint deletion, or state
sync.

Parent synthesis should build this internal matrix before drafting:

| Strand id | Artifact sections affected | Accepted evidence ids | Recommendation | Test or validation implication | Unresolved blocker |
|---|---|---|---|---|---|

Only recommendations that map to accepted evidence or clearly labeled inference
should enter `## Recommendations`. Any strand that remains blocked should appear
in `## Open Questions` or cause a checkpointed no-final-write exit when it
blocks planner-grade output.
````

#### 1.5 Replace the no-subagent fallback introduction

In `## No-Subagent Fallback`, replace:

```md
If no suitable subagent is available, the parent command must still complete
the workflow without lowering output quality:
```

with:

```md
If no suitable subagent is available, the parent command must still complete
the workflow without lowering output quality. Use the same parent-owned research
strand ledger; only the evidence gathering happens inline:
```

Then replace item 2:

```md
2. Select one topic strand, such as stack, architecture, dependency/runtime
   availability, validation/testing impact, risk/pitfalls, sources, or a
   specific implementation question from the initial assessment.
```

with:

```md
2. Select one runnable ledger strand from `context-lock`, `repo-map`,
   `stack-and-dependencies`, `architecture-integration`,
   `validation-and-tests`, `risks-and-pitfalls`, `external-delta`, or
   `planner-handoff`.
```

#### 1.6 Replace retry/checkpoint rules

In `## Retry And Repair Behavior`, replace:

```md
- If a checkpoint exists, resume by default unless the user explicitly discards
  it.
```

with:

```md
- If a research checkpoint exists and `safeToResume=true`, resume by default
  unless the user explicitly asks to discard it. Show a compact recap of
  completed strands, blocked strands, pending gate, warnings, and next action
  before doing more work.
- If the user explicitly asks to discard a safe research checkpoint, delete it
  only through `blueprint_phase_checkpoint_delete` with
  `expectedOwnerCommand: "/blu-research-phase"` and `expectedMode: "research"`.
  Start fresh only if deletion succeeds.
- If a checkpoint exists but `safeToResume=false`, do not resume, overwrite, or
  delete it by default. Report `ownerCommand`, `resumeMode`, warnings, and the
  next safe implemented action.
```

Replace:

```md
- Delete the checkpoint only after final research writes successfully.
```

with:

```md
- Delete the checkpoint only after final research writes successfully, synced
  `STATE.md` update succeeds, refreshed state load succeeds, and
  implemented-command routing has been checked. If any post-write routing step
  fails, keep or refresh the research checkpoint with the exact failure.
```

#### 1.7 Add output/completion bullets

In `## Output Quality Criteria`, insert these bullets after the existing bullet
about non-trivial strands:

```md
- non-trivial, resumed, blocked, or sidecar-assisted runs have a parent-owned
  strand ledger with `researchLedger.schemaVersion`, strand ids/statuses,
  evidence packet references, stopping reasons, and next action
- checkpoints store accepted packets, source references, draft state, warnings,
  and next action; they do not store child-agent transcripts
- sidecar failures, timeouts, budget exhaustion, and source-policy blocks are
  represented as strand stopping reasons rather than hidden in prose
```

In `## Completion Criteria`, replace:

```md
- stale research-owned shared checkpoints were deleted after success
```

with:

```md
- stale research-owned shared checkpoints were deleted only after final write,
  synced state update, refreshed state load, and implemented-command routing
  receipt succeeded
```

### 2. `commands/blu-research-phase.toml`

#### 2.1 Insert parent-owned strand ledger gate

Find this existing bullet:

```text
- For each non-trivial topic strand, close with a planning handoff that names the recommendation, affected files or modules, validation or test implications, unresolved blockers, evidence basis, and confidence.
```

Insert this bullet immediately after it:

```text
- For non-trivial, resumed, blocked, or sidecar-assisted research, maintain a parent-owned research strand ledger with strand ids, questions, dependencies, source policy, budgets, statuses, accepted evidence, stopping reasons, and next action. Checkpoint the compact ledger and packet references, not child-agent transcripts.
```

#### 2.2 Replace the checkpoint gate

Replace:

```text
- Use checkpoints only as resumable research state for paused or inconclusive work, and delete only this command's research-owned checkpoint after a successful final write.
```

with:

```text
- Use checkpoints only as resumable research state for paused, blocked, inconclusive, validation-repair, sidecar-failure, or post-write routing-failure work. Resume safe research checkpoints by default unless the user explicitly discards them through the guarded delete path. Delete only this command's research-owned checkpoint after final write, synced state update, refreshed state load, and implemented-command routing receipt succeed.
```

#### 2.3 Strengthen the sidecar bullet

Find this sentence inside the existing `When using blueprint-researcher` bullet:

```text
Require bounded findings with repo paths or URLs, source roles, search notes, confidence, failed/noisy/no-hit searches, and unanswered questions.
```

Replace it with:

```text
Require a bounded sidecar packet with strand id, concise answer, source roles, search notes, confidence, failed/noisy/no-hit searches, termination or blocking reason, warnings, and unanswered questions.
```

### 3. `skills/blueprint-phase-discovery/SKILL.md`

#### 3.1 Add a shared checkpoint note

In `## Shared MCP Contracts`, find the `blueprint_phase_checkpoint_put` bullet.
After the existing sentence that ends with:

```md
The tool owns the shared checkpoint filename and location, rejects foreign-owner overwrites, and pairs with `blueprint_phase_checkpoint_delete` owner/mode guards when commands clean up checkpoint state.
```

append this sentence to the same bullet:

```md
For `/blu-research-phase`, non-trivial continuation checkpoints should also carry the runtime contract's optional nested `researchLedger` payload with `schemaVersion: "research-ledger/v1"`, compact strand state, accepted packet references, draft state, and next action; do not store child-agent transcripts.
```

#### 3.2 Replace research workflow rule 8

Replace current `/blu-research-phase` workflow rule 8:

```md
8. During non-trivial multi-strand research on Gemini, use `update_topic` and `write_todos` only as session-local visibility aids. When a host does not expose those helpers, keep the same stage and next-safe-action visibility through short progress recaps plus MCP-backed checkpoints and `STATE.md`.
```

with:

```md
8. During non-trivial multi-strand research on Gemini, use `update_topic` and `write_todos` only as a session-local mirror of the runtime contract's parent-owned research strand ledger: topic is current stage plus active strand, and todos are strand ids and statuses. When a host does not expose those helpers, keep the same stage, strand, pending-gate, and next-safe-action visibility through short progress recaps plus MCP-backed checkpoints and `STATE.md`.
```

#### 3.3 Replace research workflow rule 9

Replace current rule 9:

```md
9. Break long-running research into topic-sized strands, checkpoint paused or inconclusive work, and use the runtime contract's single-agent fallback when no suitable subagent is available. Each non-trivial strand should record its search note and close with a planning handoff: recommendation, affected files or modules, validation or test implications, unresolved blockers, evidence basis, and confidence. Do not use browser-only, web-search-only, shell-only, broad crawls, or generic agents as substitutes. Do not let single-agent fallback skip the dependency/tool evaluation lane when the final recommendation would add, adopt, replace, upgrade, globally install, vendor, fork, code-generate, or hand-roll a tool.
```

with:

```md
9. Break long-running research into the runtime contract's research strand ledger, checkpoint paused, blocked, sidecar-failed, validation-repair, post-write-routing-failed, or inconclusive work, and use the runtime contract's single-agent fallback when no suitable subagent is available. Each non-trivial strand should record its search note, status, stopping reason, accepted evidence ids, and planning handoff: recommendation, affected files or modules, validation or test implications, unresolved blockers, evidence basis, and confidence. Do not checkpoint child-agent transcripts. Do not use browser-only, web-search-only, shell-only, broad crawls, or generic agents as substitutes. Do not let single-agent fallback skip the dependency/tool evaluation lane when the final recommendation would add, adopt, replace, upgrade, globally install, vendor, fork, code-generate, or hand-roll a tool.
```

### 4. `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md`

#### 4.1 Add research pending gates

After the existing `/blu-discuss-phase` pending-gates paragraph:

```md
For `/blu-discuss-phase`, useful pending gates include phase ambiguity,
resume-versus-discard checkpoint choice, gray-area selection, overwrite
confirmation, and validation blockers.
```

insert:

```md
For `/blu-research-phase`, useful pending gates include checkpoint
resume-versus-discard, valid-research view/skip/update, external-source
confirmation, sidecar availability, strand blocker, validation repair, and
state-sync or route-refresh failure.
```

#### 4.2 Add helper fallback recap

After:

```md
When those helpers are unavailable, keep the same stage and next-safe-action
visibility in normal progress recaps plus MCP-backed checkpoints and `STATE.md`.
Do not claim helper calls were made when the host did not expose them.
```

insert:

```md
For `/blu-research-phase`, the compact fallback recap should include the active
strand and pending gate, for example:

`Stage: Execute | Scope: Phase 3 Phase Discovery | Mode: parent-only |
Completed: S1 context-lock, S2 repo-map | Active: S3 stack-and-dependencies |
Pending gate: external-source confirmation | Next safe action: checkpoint or
resume /blu-research-phase 3`
```

### 5. `agents/blueprint-researcher.md`

#### 5.1 Update purpose wording

In `## Purpose`, replace:

```md
For R4 provenance work, artifact-grade mode returns claim-addressable evidence
rows that the parent can accept, reject, or synthesize; it does not decide final
artifact confidence on its own.
```

with:

```md
For claim-addressable evidence work, artifact-grade mode returns
claim-addressable evidence rows that the parent can accept, reject, or
synthesize; it does not decide final artifact confidence on its own. For
strand-orchestration work, every artifact-grade handoff is a sidecar packet
tied to one parent-owned strand; do not return a conversation transcript as the
handoff.
```

#### 5.2 Insert sidecar packet section

Insert the following section immediately after `## Output Mode Selection` and
before `## Required Output Contract`:

````md
## Research Sidecar Packet Semantics

Artifact-grade mode returns a compact packet, not final persistence ownership.
Use this packet shape in Markdown or JSON-like text when the parent asks for a
research sidecar:

```text
packetVersion: research-sidecar.v1
strandId: <parent strand id>
status: answered | partial | blocked | failed | needs-parent-evidence
terminationReason: evidence-sufficient | no-authoritative-source-found | blocked-by-source-policy | budget-exhausted | timeout | tool-failure | contradictory-evidence | parent-escalation-required
conciseAnswer: <direct answer to the bounded question>
confidence: LOW | MEDIUM | HIGH
claims: <claim rows with support class, source ids, confidence, and planner impact>
repoSources: <repo paths with role, locator when available, and why they matter>
externalSources: <parent-supplied external packet ids only; never self-fetched>
failedSearches: <query/path, scope, no-hit/too-broad/unreadable/not-allowed, impact>
warnings: <weak evidence, stale evidence, missing parent packet, scope limit, or conflict>
followUps: <parent, user, or plan-phase action with reason>
draftSections: <only when parent requested section-draft and named target headings>
fullArtifactDraft: <only when parent explicitly requested full-artifact-draft>
```

The parent command decides whether to accept, reject, or retry from the packet.
The packet must be compact enough to store as a checkpoint reference. Do not
include full child conversation history, hidden chain of thought, raw broad
search dumps, or a duplicate final `XX-RESEARCH.md` unless the parent explicitly
requested `full-artifact-draft`.
````

#### 5.3 Add required output bullets

In `## Required Output Contract`, after:

```md
- Start with `Mode: artifact-grade` and `Strand:` or `Question:` so the parent
  can attach the packet to the active strand.
```

insert:

```md
- Include `packetVersion: research-sidecar.v1`, `strandId`, `status`, and
  `terminationReason` so the parent can update the research strand ledger
  without replaying a transcript.
```

After:

```md
- Include `Planning Handoff`: recommendation, affected files or modules,
  validation or test implications, unresolved blockers, evidence basis, and
  confidence.
```

insert:

```md
- Include `Warnings` and `Follow Ups` when evidence is blocked, incomplete,
  stale, contradictory, failed, or requires a parent/user decision before final
  synthesis.
```

### 6. `docs/commands/research-phase.md`

#### 6.1 Update behavior stages

Replace behavior stage 4:

```md
4. `Execute`: build an initial assessment, follow the repository evidence ladder, record per-strand search notes and navigation evidence, then research one topic strand at a time, grounding repo truth first, evaluating dependency/tool choices when they affect recommendations, and keeping external evidence distinct when policy allows it, then assigns evidence IDs, claim IDs, lane labels, support classes, and limitations before final synthesis.
```

with:

```md
4. `Execute`: build an initial assessment, follow the repository evidence ladder, classify non-trivial work into a parent-owned research strand ledger, record per-strand search notes and navigation evidence, research one runnable strand at a time, grounding repo truth first, evaluating dependency/tool choices when they affect recommendations, accepting or rejecting sidecar packets before synthesis, keeping external evidence distinct when policy allows it, then assigning evidence IDs, claim IDs, lane labels, support classes, and limitations before final synthesis.
```

Replace behavior stage 5:

```md
5. `Persist`: draft directly from the canonical template, checkpoint only resumable or inconclusive work, and persist final research through MCP only.
```

with:

```md
5. `Persist`: draft directly from the canonical template, checkpoint only useful continuation state, preserve compact `researchLedger` state for paused, blocked, sidecar-failed, validation-repair, or post-write-routing-failed work, and persist final research through MCP only.
```

#### 6.2 Add Research Runtime Anchor bullets

After the current checkpoint bullet:

```md
- Use `blueprint_phase_checkpoint_get`, `blueprint_phase_checkpoint_put`, and `blueprint_phase_checkpoint_delete` only as resumability aids for `/blu-research-phase`, respecting checkpoint ownership and mode guards.
```

insert:

```md
- For non-trivial, resumed, blocked, or sidecar-assisted runs, maintain a parent-owned research strand ledger with strand ids, questions, dependencies, source policy, budgets, statuses, accepted evidence ids, rejected or low-quality sources, stopping reasons, draft state, and next action.
- Checkpoint the compact strand ledger and packet references, not child-agent transcripts. A checkpoint can include a nested `researchLedger` payload under the existing generic checkpoint shape.
- Safe research checkpoints resume by default. Explicit discard uses `blueprint_phase_checkpoint_delete` with `expectedOwnerCommand: "/blu-research-phase"` and `expectedMode: "research"`; do not start fresh unless deletion succeeds.
- Delete a research-owned checkpoint only after final research write, synced `STATE.md` update, refreshed state load, and implemented-command routing receipt succeed.
```

#### 6.3 Add a new section after `## User Prompts And Confirmation Gates`

Insert:

```md
## Checkpoint, Resume, And Completion Receipt

- If no checkpoint exists, start a fresh parent-owned strand ledger.
- If a checkpoint exists and `safeToResume=true`, resume by default and show a compact recap of completed strands, blocked strands, pending gate, warnings, and next action.
- If a checkpoint exists but `safeToResume=false`, do not resume, overwrite, or delete it by default. Report `ownerCommand`, `resumeMode`, warnings, and the next safe implemented action.
- If the user explicitly discards a safe research checkpoint, use the guarded MCP delete path and start fresh only after it succeeds.
- If final research writes successfully but state sync, refreshed state load, or command-catalog routing fails afterward, keep or refresh the checkpoint with the exact failure and report that completion is blocked.
- The final response should name the phase, created/updated/reused/viewed/checkpointed outcome, artifact path when MCP returned one, checkpoint disposition, warnings or blockers, state sync/routing result, and next safe implemented action.
```

Do not mention `update_topic` or `write_todos` in this command doc.

#### 6.4 Add acceptance criteria bullets

After:

```md
- Handles long-running or inconclusive research through checkpointed continuation rather than a single all-or-nothing pass.
```

insert:

```md
- Stores research continuation state as compact strand ledger and packet references, not child-agent transcripts.
- Resumes safe research checkpoints by default, uses guarded discard when asked, and preserves checkpoints on post-write state-sync or route-refresh failure.
```

#### 6.5 Add test case bullets

Append these bullets to `## Test Cases`:

```md
- Research strand ledger fixture with `researchLedger.schemaVersion`, strand statuses, stopping reasons, draft state, and next action.
- Checkpoint resume/discard fixture covering safe resume, guarded discard, foreign checkpoint refusal, and post-write route-refresh failure preservation.
- No-transcript checkpoint fixture proving child-agent transcripts are not checkpointed.
- Sidecar failure fixture with `tool-failure` or `budget-exhausted` stopping reason and parent-owned retry/checkpoint behavior.
```

### 7. `docs/MCP-TOOLS.md`

#### 7.1 Update checkpoint put row description

In the tools table, replace the `blueprint_phase_checkpoint_put` description:

```md
Persist an owned phase checkpoint JSON object using the richer resumability shape
```

with:

```md
Persist an owned phase checkpoint JSON object using the richer resumability shape; `/blu-research-phase` may include an optional nested `researchLedger` payload for compact strand state
```

#### 7.2 Replace the research-phase ownership note

In `## Implemented Command Ownership Notes`, replace the entire `research-phase`
bullet with:

```md
- `research-phase` uses phase location/context, research status, discovery artifact read and write tools, research checkpoint tools, `blueprint_artifact_contract_read`, optional deliberate scaffolding, `blueprint_config_get`, `blueprint_state_load`, `blueprint_command_catalog`, and `blueprint_state_update` to keep topic-strand research resumable, honor `research.external_sources` as `off`/`ask`/`auto`, keep repo truth distinct from external verification, build claim-addressable evidence for planner-critical claims, and route from refreshed runtime state instead of assuming the state-update response is the final next action. The command must load `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md` as the rich behavior contract, keep `contract.authoringTemplate` as schema authority, stop on missing `XX-CONTEXT.md` instead of drafting from status-only signals, force repair when existing research is invalid, preserve a parent-owned research strand ledger for non-trivial, resumed, blocked, sidecar-assisted, validation-repair, or post-write-routing-failed work, checkpoint compact `researchLedger` state and packet references instead of child-agent transcripts, resume safe research checkpoints by default unless explicitly discarded through guarded delete, delete research-owned checkpoints only after final write plus synced state update plus refreshed state load plus implemented-command routing receipt succeed, support capability-gated `blueprint-researcher` use when a suitable Blueprint research or code-analysis agent is available, require bounded sidecar packets with strand id, source classes, paths or URLs, retrieval notes, confidence, failed or limited searches, termination reason, unanswered questions, and planning handoff fields, require the parent to supply any official-doc or external evidence packet instead of asking the subagent to fetch it, preserve a single-agent strand-ledger fallback when it is not, reject browser/web-search/shell-only or generic agents as substitutes, and repair invalid research writes or validation failures before treating the workflow as complete.
```

### 8. `src/mcp/command-runtime-metadata.ts`

Replace only `RESEARCH_PHASE_RUNTIME_METADATA.runtimeReference.contractNotes`.
Keep `requiredTools`, `optionalAgents`, and `requiredInputPaths` unchanged.

Use this complete string:

```ts
    contractNotes:
      "Long-running-mutation profile for topic-strand phase research: keep Resolve/Read/Decide/Execute/Persist/Validate/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, use Gemini-native update_topic and write_todos for non-trivial multi-strand research only as a session-local mirror of the parent-owned research strand ledger, and when those helpers are unavailable fall back to short progress recaps plus MCP-backed checkpoints and STATE.md. Ground repo truth first in phase context, actual saved context content, existing research, saved codebase summaries, a concise initial assessment, and a navigation evidence packet before broad reads; stop on missing XX-CONTEXT.md instead of drafting from status-only signals. Prefer rg --files plus path filters, scoped content searches, optional parent-supplied navigation packets, and targeted file/test/contract/runtime reads over broad crawls; record per-strand search notes with query or navigation method, scope filter, candidate files or symbols, files read, failed/noisy/no-hit searches when relevant, and stop or widen reason; treat remote code-search results as discovery hints until local worktree or saved Blueprint artifacts confirm them; and close each non-trivial strand with a planning handoff naming recommendation, affected files or modules, validation or test implications, blockers, evidence basis, and confidence. Preserve a parent-owned research strand ledger for non-trivial, resumed, blocked, sidecar-assisted, validation-repair, or post-write-routing-failed work; checkpoint compact researchLedger state with schemaVersion research-ledger/v1, strand statuses, accepted evidence packet references, sidecar status, draft state, stopping reasons, and next action; never checkpoint child-agent transcripts; resume safe research checkpoints by default unless explicitly discarded through guarded delete; and delete research-owned shared checkpoints only after final write, synced STATE.md update, refreshed state load, and implemented-command routing receipt succeed. Treat dependency/tool selection as a first-class strand when recommendations add, adopt, replace, upgrade, install, vendor, fork, code-generate, or hand-roll a package, library, CLI, framework, service, or tool: compare no-new-dependency, existing dependency, standard-library/platform, candidate, and custom options, record version, maintenance, vulnerability, license, provenance/signature, transitive-footprint, install-scope, lockfile, update-posture, residual-risk, and verification evidence, and mark unavailable live supply-chain data as unchecked under the current research.external_sources policy. Read blueprint_config_get before any official-doc or external verification, honor research.external_sources as off/ask/auto, use official docs or explicitly supplied external references only when the repo cannot settle a claim, keep repo-derived evidence distinct from external truth in the finished research, build claim-addressable evidence for planner-critical claims with evidence IDs, claim IDs, repo/external/inference lanes, support classes, source type, authority tier, support span, retrieval context, limitations, and split ## Sources sections, treat State Of The Art freshness wording as runtime-contract guidance rather than an MCP validation gate, use skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md as the rich behavior contract, keep contract.authoringTemplate as schema authority, reserve blueprint_artifact_scaffold for deliberate placeholder creation only, use capability-gated blueprint-researcher only when suitable Blueprint research or code-analysis agents are available, require the parent to supply any official-doc or external evidence packet instead of asking the subagent to fetch it, require bounded sidecar packets with strand id, source classes, source roles, paths or URLs, search notes, confidence, failed/noisy/no-hit or limited searches, termination or blocking reason, warnings, unanswered questions, and planning handoff fields, and forbid sidecars from claiming semantic navigation they were not given. Preserve the single-agent strand-ledger fallback when subagents are unavailable, reject browser/web-search/shell-only or generic agents as substitutes, force repair when existing research is invalid, sync STATE.md even on valid non-writing reuse paths, repair invalid writes or validation failures before completion, checkpoint inconclusive strands instead of bluffing a final artifact, preserve checkpoints on post-write state-sync or route-refresh failure, synthesize final research from accepted strand packets instead of child transcripts, and keep routing limited to implemented commands only.",
```

After this change, `npm run build` must update tracked `dist/`.

### 9. `docs/RUNTIME-REFERENCE.md`

Update only the `research-phase` row's long contract note so it mirrors the new
metadata terms. The human row can be shorter than the metadata string, but it
must include these exact phrases:

- `parent-owned research strand ledger`
- `researchLedger`
- `research-ledger/v1`
- `not child-agent transcripts`
- `resume safe research checkpoints by default`
- `guarded delete`
- `final write, synced STATE.md update, refreshed state load, and implemented-command routing receipt`
- `bounded sidecar packets`
- `termination or blocking reason`
- `parent synthesis`

Do not change the row's source path, primary skill, required tools, optional
agent, hook involvement, or evidence-state cells.

### 10. `tests/phase-discovery-research.test.ts`

Add assertions in the existing test named
`research-phase command references only registered tool names and safe routing text`.

#### 10.1 Command manifest assertions

After:

```ts
  assert.match(commandFile, /planning handoff/i);
```

insert:

```ts
  assert.match(commandFile, /parent-owned research strand ledger/i);
  assert.match(commandFile, /child-agent transcripts/i);
  assert.match(commandFile, /sidecar-failure|sidecar-assisted/i);
  assert.match(commandFile, /post-write routing-failure|implemented-command routing receipt/i);
```

#### 10.2 Docs assertions

After:

```ts
  assert.match(docFile, /planning handoff/i);
```

insert:

```ts
  assert.match(docFile, /parent-owned research strand ledger/i);
  assert.match(docFile, /researchLedger/i);
  assert.match(docFile, /not child-agent transcripts/i);
  assert.match(docFile, /safe research checkpoints resume by default/i);
  assert.match(docFile, /guarded MCP delete path|guarded delete/i);
  assert.match(docFile, /state sync, refreshed state load, or command-catalog routing fails/i);
```

#### 10.3 Runtime reference assertions

After:

```ts
  assert.match(runtimeReference, /planning handoff/i);
```

insert:

```ts
  assert.match(runtimeReference, /parent-owned research strand ledger/i);
  assert.match(runtimeReference, /researchLedger/i);
  assert.match(runtimeReference, /research-ledger\/v1/i);
  assert.match(runtimeReference, /not child-agent transcripts/i);
  assert.match(runtimeReference, /resume safe research checkpoints by default/i);
  assert.match(runtimeReference, /guarded delete/i);
  assert.match(runtimeReference, /implemented-command routing receipt/i);
  assert.match(runtimeReference, /bounded sidecar packets/i);
  assert.match(runtimeReference, /termination or blocking reason/i);
```

#### 10.4 MCP tools doc assertions

After:

```ts
  assert.match(mcpToolsDoc, /planning handoffs/i);
```

insert:

```ts
  assert.match(mcpToolsDoc, /parent-owned research strand ledger/i);
  assert.match(mcpToolsDoc, /researchLedger/i);
  assert.match(mcpToolsDoc, /child-agent transcripts/i);
  assert.match(mcpToolsDoc, /guarded delete/i);
```

#### 10.5 Skill assertions

After:

```ts
  assert.match(skillFile, /planning handoff/i);
```

insert:

```ts
  assert.match(skillFile, /research strand ledger/i);
  assert.match(skillFile, /researchLedger/i);
  assert.match(skillFile, /child-agent transcripts/i);
  assert.match(skillFile, /post-write-routing-failed/i);
```

#### 10.6 Researcher agent assertions

After:

```ts
  assert.match(researcherAgent, /Do not present a sidecar packet as final persisted research/i);
```

insert:

```ts
  assert.match(researcherAgent, /Research Sidecar Packet Semantics/i);
  assert.match(researcherAgent, /packetVersion: research-sidecar\.v1/i);
  assert.match(researcherAgent, /terminationReason/i);
  assert.match(researcherAgent, /failedSearches/i);
  assert.match(researcherAgent, /do not return a conversation transcript/i);
```

#### 10.7 Runtime contract assertions

After:

```ts
  assert.match(runtimeContract, /Strand Planning Handoff/i);
```

insert:

```ts
  assert.match(runtimeContract, /Research Strand Ledger And Checkpoint Semantics/i);
  assert.match(runtimeContract, /context-lock/i);
  assert.match(runtimeContract, /repo-map/i);
  assert.match(runtimeContract, /planner-handoff/i);
  assert.match(runtimeContract, /researchLedger\.schemaVersion/i);
  assert.match(runtimeContract, /research-ledger\/v1/i);
  assert.match(runtimeContract, /stopping reasons/i);
  assert.match(runtimeContract, /child transcripts/i);
  assert.match(runtimeContract, /safeToResume=true/i);
  assert.match(runtimeContract, /Parent synthesis should build this internal matrix/i);
  assert.match(runtimeContract, /tool-failure/i);
  assert.match(runtimeContract, /budget-exhausted/i);
  assert.match(runtimeContract, /state-sync or route-refresh failure/i);
```

### 11. `tests/phase-discovery-tools.test.ts`

Add the following test after
`phase plan indexing and checkpoint persistence accept numeric inputs with the richer resumability shape`.

```ts
test("research checkpoints preserve nested strand ledger payloads", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const checkpointPayload = {
    ownerCommand: "/blu-research-phase",
    completedAreas: ["S1 context-lock"],
    remainingAreas: ["S2 repo-map"],
    decisions: [],
    deferredIdeas: [],
    canonicalReferences: [],
    resumeMeta: {
      mode: "research",
      pendingTopics: ["S2 repo-map"],
      completedTopics: ["S1 context-lock"],
      currentQuestion: "Which repo surfaces constrain this phase?",
      notes: ["Resume at the repo-map strand."],
      resumeHint: "Resume /blu-research-phase 3 at S2.",
      updatedAt: "2026-05-12T00:00:00.000Z"
    },
    researchLedger: {
      schemaVersion: "research-ledger/v1",
      phase: {
        number: "3",
        prefix: "03",
        name: "Phase Discovery",
        dir: ".blueprint/phases/03-phase-discovery"
      },
      runtime: {
        ownerCommand: "/blu-research-phase",
        artifactId: "phase.research",
        externalSources: {
          effective: "ask",
          decision: "pending",
          reason: "Repo evidence cannot settle upstream behavior."
        }
      },
      strands: [
        {
          id: "S1",
          type: "context-lock",
          question: "What saved context decisions constrain this research?",
          requirementIds: ["REQ-001"],
          repoAnchors: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"],
          sourcePolicy: "repo-only",
          dependencies: [],
          expectedPacket: "parent-inline-evidence",
          budget: { maxFiles: 3, maxSidecars: 0 },
          status: "complete",
          evidenceIds: ["SRC-001"],
          acceptedClaims: ["Context requires MCP-owned persistence."],
          rejectedOrLowQualitySources: [],
          searchNotes: [],
          uncertainty: "none",
          stoppingReason: "evidence-sufficient",
          nextAction: "feed planner-handoff"
        }
      ],
      evidencePackets: [
        {
          id: "SRC-001",
          class: "repo",
          strandId: "S1",
          source: ".blueprint/phases/03-phase-discovery/03-CONTEXT.md",
          claim: "Saved context constrains research scope.",
          confidence: "high"
        }
      ],
      sidecars: [],
      draftState: {
        hasDraft: false,
        sectionsTouched: [],
        validationAttempted: false,
        validationIssues: [],
        finalWriteAttempted: false,
        lastKnownPath: null
      },
      nextAction: {
        stage: "Execute",
        pendingGate: "none",
        safeCommand: "/blu-research-phase 3"
      }
    }
  };

  const written = await blueprintPhaseCheckpointPut({
    cwd: repoPath,
    phase: 3,
    checkpoint: checkpointPayload
  });
  const read = await blueprintPhaseCheckpointGet({
    cwd: repoPath,
    phase: 3,
    expectedOwnerCommand: "/blu-research-phase",
    expectedMode: "research"
  });

  assert.equal(written.updated, true);
  assert.equal(read.found, true);
  assert.equal(read.ownerCommand, "/blu-research-phase");
  assert.equal(read.resumeMode, "research");
  assert.equal(read.safeToResume, true);
  assert.deepEqual(read.checkpoint, checkpointPayload);
  assert.deepEqual(
    (read.checkpoint as typeof checkpointPayload).researchLedger.strands.map((strand) => strand.id),
    ["S1"]
  );
});
```

Add the following test after
`checkpoint delete refuses to remove a foreign shared checkpoint when owner or mode is expected`.

```ts
test("checkpoint delete removes matching research-owned checkpoints after guarded success", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintPhaseCheckpointPut({
    cwd: repoPath,
    phase: 3,
    checkpoint: {
      ownerCommand: "/blu-research-phase",
      completedAreas: ["S1 context-lock"],
      remainingAreas: [],
      decisions: [],
      deferredIdeas: [],
      canonicalReferences: [],
      resumeMeta: {
        mode: "research",
        pendingTopics: [],
        completedTopics: ["S1 context-lock"],
        notes: [],
        updatedAt: "2026-05-12T00:00:00.000Z"
      },
      researchLedger: {
        schemaVersion: "research-ledger/v1",
        strands: [
          {
            id: "S1",
            type: "context-lock",
            status: "complete",
            stoppingReason: "evidence-sufficient",
            nextAction: "route"
          }
        ],
        nextAction: {
          stage: "Route",
          pendingGate: "none",
          safeCommand: "/blu-plan-phase 3"
        }
      }
    }
  });

  const deleted = await blueprintPhaseCheckpointDelete({
    cwd: repoPath,
    phase: 3,
    expectedOwnerCommand: "/blu-research-phase",
    expectedMode: "research"
  });
  const checkpoint = await blueprintPhaseCheckpointGet({ cwd: repoPath, phase: 3 });

  assert.equal(deleted.deleted, true);
  assert.equal(checkpoint.found, false);
});
```

If TypeScript complains about the `read.checkpoint as typeof checkpointPayload`
cast because `checkpoint` is `Record<string, unknown>`, use this exact safer
cast:

```ts
  const readPayload = read.checkpoint as typeof checkpointPayload;
  assert.deepEqual(readPayload.researchLedger.strands.map((strand) => strand.id), ["S1"]);
```

### 12. `tests/agent-contract-specialists.test.ts`

In the test
`mapping and discovery specialist agents encode concrete output modes and read boundaries`,
after:

```ts
  assert.match(researcher, /sidecar packet as final persisted research/i);
```

insert:

```ts
  assert.match(researcher, /Research Sidecar Packet Semantics/i);
  assert.match(researcher, /packetVersion: research-sidecar\.v1/i);
  assert.match(researcher, /terminationReason/i);
  assert.match(researcher, /failedSearches/i);
  assert.match(researcher, /conversation transcript/i);
  assert.match(researcher, /parent-owned strand/i);
```

### 13. `tests/mcp-contract-audit-metadata.test.ts`

In the test `discovery contracts stay explicit across discuss, research, and ui command surfaces`, add these assertions after the existing research assertions.

After:

```ts
  assert.match(researchCommand, /no-new-dependency/i);
```

insert:

```ts
  assert.match(researchCommand, /parent-owned research strand ledger/i);
  assert.match(researchCommand, /child-agent transcripts/i);
```

After:

```ts
  assert.match(researchRuntimeContract, /npm audit fix/i);
```

insert:

```ts
  assert.match(researchRuntimeContract, /Research Strand Ledger And Checkpoint Semantics/i);
  assert.match(researchRuntimeContract, /researchLedger/i);
  assert.match(researchRuntimeContract, /research-ledger\/v1/i);
  assert.match(researchRuntimeContract, /safeToResume=true/i);
  assert.match(researchRuntimeContract, /Parent synthesis should build this internal matrix/i);
```

After:

```ts
  assert.match(researchDoc, /warning-level/i);
```

insert:

```ts
  assert.match(researchDoc, /Checkpoint, Resume, And Completion Receipt/i);
  assert.match(researchDoc, /researchLedger/i);
  assert.match(researchDoc, /safe research checkpoints resume by default/i);
```

After:

```ts
  assert.match(mcpToolsDoc, /dependency\/tool choices/i);
```

insert:

```ts
  assert.match(mcpToolsDoc, /researchLedger/i);
  assert.match(mcpToolsDoc, /guarded delete/i);
```

After:

```ts
  assert.match(discoverySkill, /artifactId: "phase\.research"/);
```

insert:

```ts
  assert.match(discoverySkill, /research strand ledger/i);
  assert.match(discoverySkill, /researchLedger/i);
```

### 14. No Source Schema Change In This Slice

Do not edit `src/mcp/tools/phase-checkpoint-records.ts` for R5 except if tests
discover that `.catchall(z.unknown())` does not preserve nested payloads. The
expected result is that no code change is needed there.

If a future implementation wants strict research ledger validation, it should be
a separate PR after compatibility fixtures exist. That later PR would add an
optional discriminated schema for `ownerCommand: "/blu-research-phase"`, but R5
does not need that now.

## Verification Commands

If implementation touches only docs, agent markdown, tests, and
`src/mcp/command-runtime-metadata.ts`, run:

```bash
npx tsx --test tests/phase-discovery-research.test.ts tests/phase-discovery-tools.test.ts tests/agent-contract-specialists.test.ts tests/mcp-contract-audit-metadata.test.ts tests/command-catalog.test.ts
npm run typecheck
npm run build
git diff --check
git status --short
```

Because `src/mcp/command-runtime-metadata.ts` changes, `dist/` must be reviewed
and committed after `npm run build`.

Do not run `npm test -- <file>` as a shortcut. Use `npx tsx --test <files>`.

## Review Checklist For The Implementor

- `/blu-research-phase` command manifest remains thin.
- `commands/blu-research-phase.toml` still does not mention `update_topic` or
  `write_todos`.
- `docs/commands/research-phase.md` still does not mention `update_topic` or
  `write_todos`.
- `RESEARCH_PHASE_REQUIRED_TOOLS` is unchanged.
- `optionalAgents` remains only `blueprint-researcher`.
- `requiredInputPaths` remains only
  `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`.
- No `phase.research` required heading changed.
- No validator strictness changed for R4/R5 tables.
- `researchLedger` rides through the existing checkpoint `.catchall(...)`
  compatibility shape.
- Checkpoints store compact ledger/packet references, not child transcripts.
- Safe checkpoint resume, guarded discard, post-write routing failure
  preservation, and delayed checkpoint delete are all visible in docs and tests.
- Final routing remains implemented-only and comes from refreshed MCP state plus
  command catalog.
