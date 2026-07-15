# `/blu-execute-phase` Runtime Contract

This is the behavior authority for `/blu-execute-phase`. Use the shared
`long-running-execution-profile.md` for progress presentation. The four
execute-phase MCP tools below own all selection, mutation, verification,
persistence, and resume behavior.

## Control Plane

| Stage | Required MCP call | Authority |
| --- | --- | --- |
| Resolve / Read | `mcp_blueprint_blueprint_phase_execution_prepare` with `mode: "preview"` | Canonical repo/HEAD/status, effective config, phase topology, full plan-set validation, deterministic selected plan order, plan bodies, preimages, verification commands, external prerequisites, conflicts, existing summaries, warnings, blockers, and fingerprint |
| Decide | `mcp_blueprint_blueprint_phase_execution_prepare` with `mode: "claim"` | Exact approval, overwrite plan ids, external-service confirmation, preview freshness, replay prevention, and the one active durable session |
| Execute | `mcp_blueprint_blueprint_phase_execution_apply` | Selected-plan ownership, exact preimages, pinned-parent atomic mutation, rollback/cleanup classification, mutation receipts, initial-versus-repair limit, and deterministic current plan |
| Validate | `mcp_blueprint_blueprint_phase_execution_verify` | Exact packet-bound command list, process-group timeout/output bounds, verification receipts, one repair gate, and mandatory second verification |
| Persist / Route | `mcp_blueprint_blueprint_phase_execution_finalize` | Receipt-derived summary truth, summary write, summary index, artifact validation, synced STATE, next-plan advancement, terminal release, and idempotent stage recovery |

No primitive phase, summary, config, artifact, state, shell-write, or report tool
may substitute for this control plane during execute-phase.

## Preview And Claim

1. Preview with the requested numeric phase when supplied, plus `wave`,
   `gapsOnly`, `includeConflicts`, and external-service posture.
2. Stop on every returned blocker. Full plan-set invalidity blocks even when
   the defect sits outside a requested wave. Lower-wave pending work and
   missing dependencies are absolute blockers.
3. Present selected plan order, overlap warnings, declared external services,
   existing-summary overwrite candidates, and execution mode. Overlap never
   grants parallel write ownership; execution remains sequential.
4. Existing summary replacement requires that plan id in
   `overwriteConfirmedPlanIds`. Rerun preview after binding the decision.
5. Claim only with the exact preview fingerprint and literal
   `CLAIM BLUEPRINT PHASE EXECUTION`. Any plan/config/repo/summary/HEAD drift,
   mismatched decision, replay, or different active session blocks.

The claim packet is the immutable selection/authority packet. Do not reread
primitives and then override it.

## Execution Ownership

- Execute `packet.selectedPlans` sequentially and in order.
- The inline orchestrator may reason and draft candidate file contents. It has
  no repository write authority. `/blu-execute-phase` has no optional executor
  agent because agent-authored filesystem writes cannot become MCP receipts.
- Submit every write or delete through execution_apply. Each path must belong
  to the current plan and each `expectedHash` must equal the claimed preimage
  or latest mutation receipt.
- Direct or unreceipted repo drift blocks before apply, verify, finalize, or
  resume.
- Pinned workers retain the original parent directory identity across prepare,
  commit, observation, seal, cleanup, and rollback. Timeouts, worker death,
  symlink substitution, mixed postimages, cleanup debt, and unknown outcomes
  return explicit recovery state; none may be described as committed success.
- `committed-cleanup-required`, `rolled-back`, `rollback-failed`, and
  postimage divergence block the plan. Report every returned cleanup path.

## Verification And One Repair

- Verification commands are extracted and fingerprinted from the saved plan's
  `## Verification` section at preview time. A plan without a bound command
  cannot be claimed.
- execution_verify runs those exact commands through `/bin/sh -c`, records
  exit/signal/timeout/output hashes and bounded output, and stops on failure.
- A passing first attempt makes the plan finalizable as `COMPLETED`.
- A failing first attempt moves to `awaiting-repair`. Make at most one repair
  apply against the latest receipt, then call execution_verify exactly once.
- A failing second attempt is terminal for the plan. No third repair, third
  verification, alternate command, agent assertion, or manual success claim is
  allowed.
- A verification attempt is durably consumed before its process starts. If it
  is interrupted before its receipt is saved, resume must not replay it as the
  same attempt: attempt one moves to repair and attempt two moves to blocked.
- Verification receipts bind exact shell argv, exit/signal/timeout/overflow
  outcome, byte counts, hashes, truncation flags, and output. A passing claim
  requires a complete, internally consistent receipt for every bound command.

## Receipt-Derived Persistence

Call execution_finalize after the plan is verified or blocked. The tool, not
the model, derives summary status and evidence from the durable session:

- passing bound verification plus accepted mutations -> `COMPLETED`;
- terminal verification, mutation, authority, or recovery failure -> `BLOCKED`.

Finalize owns this exact durable sequence:

1. write or idempotently reuse the plan summary;
2. require the summary index to project the same plan/status;
3. require whole-artifact validation to pass;
4. prepare the exact STATE preimage and deterministic `base: "synced"`
   postimage, checkpoint them, then write or recover only one of those two
   byte-and-mode states;
5. mark the plan persisted and advance to the next claimed plan, or release the
   active session as `completed`/`blocked`.

Every boundary is checkpointed before or after its side effect so an
interruption can retry without duplicate summaries, skipped validation, stale
STATE, or double advancement. A filtered/wave run closes only its selected
plans. Execute-phase never marks the phase complete. When the final selected
plan still leaves any pending plan debt, route back to
`/blu-execute-phase <phase>`; route to `/blu-validate-phase <phase>` only when
the phase plan set has no remaining execution debt.

## Resume

Resume only with execution_prepare `mode: "resume"` and the exact session id.
The runtime revalidates canonical repo, HEAD, config, unchanged authority
artifacts, baseline dirty bytes, mutation receipts, pending pre/postimages, and
MCP-owned persistence paths. It permits the claimed repo changes and rejects
unreceipted drift or mixed interruption state. Pending repository mutations
bind both content hashes and modes. A pending STATE effect accepts only its
checkpointed trusted preimage or prepared postimage; arbitrary STATE edits are
never carried forward and receipted by resume.

After `resumed`, continue the persisted current plan/status:

- `pending` or `awaiting-repair` -> execution_apply;
- `applying` or `repairing` -> execution_apply or execution_verify performs
  deterministic preimage/postimage recovery before continuing;
- `mutated` -> execution_verify;
- `verified`, `blocked`, `summary-written`, or `persisted` -> execution_finalize.

Never create a replacement claim to bypass an active or stale session.

## Visible Progress And Final Response

At meaningful boundaries show: session id, selected/current plan, active
stage, pending gate, apply attempt, verification attempt, summary status/path,
cleanup debt or blocker, and next safe action. The final response must not
claim phase completion.

- completed final selected plan with pending plan debt ->
  `/blu-execute-phase <phase>`;
- completed final selected plan with no remaining execution debt ->
  `/blu-validate-phase <phase>`;
- advanced session -> continue the next packet plan;
- blocked, stale, ambiguous, or unsafe result -> `/blu-progress` with the exact
  receipt/session evidence.

Never run `/blu-*` in a shell and never persist an execute-phase report.
