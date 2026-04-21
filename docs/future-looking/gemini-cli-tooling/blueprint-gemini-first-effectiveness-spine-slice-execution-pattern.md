# Blueprint Gemini-First Effectiveness Spine Slice Execution Pattern

## Purpose

Standardize one-slice-at-a-time execution so Blueprint effectiveness-spine work stays narrow, verifiable, and low-hallucination. Each slice should be small enough that the implementing agent can remain grounded in a tiny asset set and a short acceptance loop.

## Roles

### Main agent

- Owns slice selection, grounding, and final integration.
- Defines the exact write set before any implementation work starts.
- Spawns the implementation, verification, and review subagents in that order.
- Applies only the minimum integration fixes needed after verifier or reviewer feedback.
- Decides whether the slice is complete, partial, or blocked.
- Reports the next recommended slice.

### Implementation subagent

- Owns only the exact write scope for the slice.
- Reads the live files in scope before changing anything.
- Implements only the contract described in the slice definition.
- Must not widen into adjacent commands, families, tests, or cleanup.
- Returns a concise change summary, files changed, and targeted verification notes.

### Verification subagent

- Owns no writes.
- Runs only the targeted checks for the slice.
- Verifies acceptance criteria, not broad repo health.
- Reports pass/fail evidence with exact commands or inspections used.
- Flags any unverified claims or missing coverage.

### Review subagent

- Owns no writes.
- Reviews only the diff produced by the slice.
- Looks for drift from locked Blueprint decisions, scope creep, missing tests, contract mismatch, and unsafe assumptions.
- Reports only actionable findings tied to the slice scope.

## Required Inputs For Each Slice Run

- `AGENTS.md`
- [blueprint-gemini-first-effectiveness-spine.md](/Users/rhishi/dev/repositories/blueprint/docs/future-looking/gemini-cli-tooling/blueprint-gemini-first-effectiveness-spine.md)
- [blueprint-gemini-first-effectiveness-spine-slice-plan.md](/Users/rhishi/dev/repositories/blueprint/docs/future-looking/gemini-cli-tooling/blueprint-gemini-first-effectiveness-spine-slice-plan.md)
- [blueprint-gemini-first-effectiveness-spine-slice-execution-pattern.md](/Users/rhishi/dev/repositories/blueprint/docs/future-looking/gemini-cli-tooling/blueprint-gemini-first-effectiveness-spine-slice-execution-pattern.md)
- the exact slice section or row from [blueprint-gemini-first-effectiveness-spine-slice-index.md](/Users/rhishi/dev/repositories/blueprint/docs/future-looking/gemini-cli-tooling/blueprint-gemini-first-effectiveness-spine-slice-index.md)
- the exact write set for the slice
- the exact targeted tests or checks for the slice
- the slice acceptance criteria
- any locked Blueprint docs directly relevant to the slice
- current live state of the touched assets before edits begin

## Allowed Write Scope Rules

- One slice should touch only the smallest asset bundle needed for that slice.
- If the slice is a command slice, default scope is:
  - one command manifest
  - one command spec
  - one owning skill section
  - one runtime-reference row or cluster
  - the narrowest matching tests
- If the slice is an agent slice, default scope is:
  - one agent contract
  - matching agent tests
  - any directly coupled runtime-reference text
- If the slice is an infra slice, default scope is:
  - one runtime module
  - directly related docs/schema
  - directly related tests
- Verifier and reviewer never write files.
- Main agent should not widen scope while integrating feedback.
- If the slice is doc-only, do not change runtime code, manifests, tests, or config.
- If implementation reveals missing substrate outside scope, stop and mark the slice blocked or recommend a preceding micro-slice.

## Verification Loop

1. Main agent grounds the slice and locks the write scope.
2. Implementation subagent makes the scoped changes and returns evidence.
3. Verification subagent runs only the targeted checks for the slice.
4. Main agent fixes only verified issues that block slice completion.
5. Main agent reruns the same targeted checks.
6. Slice is complete only when the scoped acceptance criteria are backed by explicit evidence.

## Review Loop

1. After verification passes or reaches a useful checkpoint, main agent requests a diff-only review.
2. Review subagent checks for:
   - drift from locked docs
   - hidden scope widening
   - missing contract alignment across touched assets
   - missing or weak targeted tests
   - misleading completion claims
3. Main agent applies only the minimum follow-up fixes.
4. Main agent reruns the same targeted checks after any review-driven fix.

## Completion Checklist

- Slice ID and name are clearly stated.
- Exact write scope was respected.
- Touched assets stay aligned with the slice contract.
- No planned-only commands became newly routable by implication.
- Implemented-only routing remains preserved.
- MCP remains the persistence boundary where relevant.
- Hooks remain advisory.
- Targeted tests or checks were run and summarized.
- Residual risks are explicitly listed.
- Next recommended slice is named.

## Reusable "Run One Slice" Prompt

```text
Implement Blueprint slice <SLICE-ID>: <SLICE-NAME>.

Read first:
- AGENTS.md
- docs/future-looking/gemini-cli-tooling/blueprint-gemini-first-effectiveness-spine.md
- docs/future-looking/gemini-cli-tooling/blueprint-gemini-first-effectiveness-spine-slice-plan.md
- docs/future-looking/gemini-cli-tooling/blueprint-gemini-first-effectiveness-spine-slice-execution-pattern.md
- the exact slice section or row from docs/future-looking/gemini-cli-tooling/blueprint-gemini-first-effectiveness-spine-slice-index.md
- any locked Blueprint reference docs directly named by this slice
- only the exact files in this write set: <FILES>

Hard scope:
- do not widen beyond this slice
- do not touch planned-command routing
- preserve implemented-only exposure
- keep MCP as the only persistence layer
- keep hooks advisory
- if this is a doc-only slice, do not change runtime code

Execution pattern:
1. Create a fresh worktree/branch for this slice.
2. Do a short grounding pass on the listed files and current targeted tests.
3. Spawn one implementation subagent with the exact write set above.
4. After implementation returns, spawn one verification subagent to run only the targeted checks for this slice.
5. After verification returns, spawn one review subagent to do a code-review pass on the diff only.
6. Apply only the minimum fixes needed from verifier/reviewer feedback.
7. Re-run the same targeted checks and report completion against the slice acceptance criteria.

Required output:
- files changed
- tests/checks run
- acceptance criteria met / not met
- residual risks
- exact next slice recommended

Default stance:
- prefer tiny edits
- prefer existing repo patterns
- keep manifest, command doc, owning skill, runtime reference row, and tests aligned when they are in scope
```
