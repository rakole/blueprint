# Workflow Packets For Antigravity Reviews

Use this index after reading `ANTIGRAVITY.md`. Every packet is intentionally non-doc. Do not open `docs/**` for default reviews.

For `src/mcp/command-runtime-metadata.ts`, search for `commandName: "<workflow>"` and read that entry plus the nearby required tool constant list. Do not read the whole file unless the target entry depends on shared constants nearby.

For large tool modules such as `src/mcp/tools/phase.ts`, use targeted `rg` for the workflow's tool names before reading blocks.

## Review Search Terms

Run these only within packet-listed files:

```text
warning|warnings|retry|repair|validate|validation|authoring context|taskSchema|subagent|handoff|checkpoint|state_update|state_load|confirmation|overwrite|readiness|route|next safe action|MCP|artifact_contract|schema|model-only|fallback
```

## Core Lifecycle

### `new-project`

Read first:

- `commands/blu-new-project.toml`
- `skills/blueprint-bootstrap/SKILL.md`
- `skills/blueprint-bootstrap/references/bootstrap-runtime-contract.md`
- `skills/blueprint-bootstrap/references/runtime-guardrails.md`
- `skills/blueprint-bootstrap/references/questioning.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/project.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/state.ts`
- `src/mcp/artifact-contracts/index.ts`
- `src/mcp/artifact-contracts/schemas/bootstrap.roadmap.model.schema.json`
- `tests/new-project.test.ts`
- `tests/new-project-metadata.test.ts`

Known friction themes to verify:

- Bootstrap seed requirements may be stricter than the visible first-pass guidance.
- Brownfield map-first routing can be correct but easy to over-read before deciding.
- Roadmap success criteria and requirement mapping validation can create wording retries.
- Duplicate or normalized requirement references can hide what the model actually authored.
- Preflight failure messages should not trigger unrelated artifact validation noise.

### `map-codebase`

Read first:

- `commands/blu-map-codebase.toml`
- `skills/blueprint-map/SKILL.md`
- `skills/blueprint-map/references/map-runtime-contract.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/project.ts`
- `src/mcp/tools/state.ts`
- `src/mcp/artifact-contracts/index.ts`
- `tests/map-codebase.test.ts`
- `tests/mcp-contract-audit-metadata.test.ts`

Known friction themes to verify:

- Mapping is read-heavy and can over-scan when focus areas are narrow.
- Refresh or replace paths need confirmation, but reuse should stay the default.
- Scaffold/template text must not become final mapped content.
- Digest scope should be authoritative so the agent does not rediscover the same files repeatedly.

### `discuss-phase`

Read first:

- `commands/blu-discuss-phase.toml`
- `skills/blueprint-phase-discovery/SKILL.md`
- `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md`
- `skills/blueprint-phase-discovery/references/discuss-phase-runtime-contract.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/phase.ts`
- `src/mcp/tools/phase-context-model.ts`
- `src/mcp/tools/phase-checkpoint-records.ts`
- `src/mcp/artifact-contracts/schemas/phase.context.model.schema.json`
- `tests/phase-discovery-discuss.test.ts`
- `tests/context-contract-parity.test.ts`
- `tests/context-diagnostics.test.ts`

Known friction themes to verify:

- Distinct validation failures can collapse into broad repair guidance.
- Non-empty arrays and empty sentinels can force filler instead of letting MCP render `none`.
- Checkpoint shape and ownership rules can be easy to get wrong.
- Prior-context sweeps and plan-inventory reminders may be prompt-expensive.
- Final route should come from refreshed state, not from successful context write alone.

### `research-phase`

Read first:

- `commands/blu-research-phase.toml`
- `skills/blueprint-phase-discovery/SKILL.md`
- `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md`
- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/phase.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/artifact-contracts/index.ts`
- `tests/phase-discovery-research.test.ts`
- `tests/phase-discovery-tools.test.ts`
- `tests/artifact-validate-runtime.test.ts`
- `tests/plan-phase-speed-budget.test.ts`

Known friction themes to verify:

- Exact heading requirements and required sections can be generation-costly.
- `Code Examples` and source evidence gates can force retries even when the research is otherwise useful.
- Heavy evidence ledgers may be warning-only but still consume prompt and repair budget.
- Warning diagnostics can be duplicative or not machine-actionable.
- External-source guidance should not cause broad live browsing by default.

### `ui-phase`

Read first:

- `commands/blu-ui-phase.toml`
- `skills/blueprint-phase-discovery/SKILL.md`
- `skills/blueprint-phase-discovery/references/long-running-phase-discovery-profile.md`
- `skills/blueprint-phase-discovery/references/ui-phase-runtime-contract.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/phase.ts`
- `src/mcp/tools/phase-no-ui-signals.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/artifact-contracts/index.ts`
- `tests/phase-discovery-ui.test.ts`
- `tests/phase-discovery-tools.test.ts`

Known friction themes to verify:

- Skip mode should not load full UI contract context unless needed.
- UI safety gates can be useful but may delay obvious backend-only skip decisions.
- Designer/checker paths need compact handoffs; parent should own persistence and routing.
- Visual evidence limits should be explicit without turning every run into browser inspection.

### `plan-phase`

Read first:

- `commands/blu-plan-phase.toml`
- `skills/blueprint-phase-planning/SKILL.md`
- `skills/blueprint-phase-planning/references/plan-phase-runtime-contract.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/phase.ts`
- `src/mcp/tools/phase-plan-diagnostics.ts`
- `src/mcp/tools/phase-plan-schemas.ts`
- `src/mcp/tools/phase-plan-rendering.ts`
- `src/mcp/artifact-contracts/schemas/phase.plan.model.schema.json`
- `tests/phase-planning-tools.test.ts`
- `tests/phase-planning-contract.test.ts`
- `tests/phase-plan-validation-hardening.test.ts`
- `tests/phase-plan-write-locking.test.ts`
- `tests/plan-phase-metadata.test.ts`
- `tests/plan-phase-speed-budget.test.ts`

Known friction themes to verify:

- Strict write success, final plan-set validation, and state routing can be misread as the same gate.
- Exact coverage diagnostics can be noisy or misleading.
- Planning readiness may be enforced by the command but not by lower-level authoring helpers.
- Saved plans can become future evidence and make accidental auto-add costly.
- Structured plan models can be heavy for small plans.

### `execute-phase`

Read first:

- `commands/blu-execute-phase.toml`
- `skills/blueprint-phase-execution/SKILL.md`
- `skills/blueprint-phase-execution/references/long-running-execution-profile.md`
- `skills/blueprint-phase-execution/references/execute-phase-runtime-contract.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/phase.ts`
- `src/mcp/tools/phase-execution-surfaces.ts`
- `src/mcp/tools/phase-summary-diagnostics.ts`
- `src/mcp/tools/phase-summary-rendering.ts`
- `src/mcp/tools/phase-summary-routing.ts`
- `tests/execute-phase-summary-tools.test.ts`
- `tests/execute-phase-metadata.test.ts`
- `tests/phase-execution-runtime-contract-resource.test.ts`

Known friction themes to verify:

- Summary scaffold/template material may not be saveable as a first draft.
- Warning-only sentinel formatting can create low-value retry loops.
- Dependency truth gates are useful, but repair hints can be indirect.
- Invalid write diagnostics may be weaker than preflight validation diagnostics.
- Post-write artifact/state warnings can muddy successful summary completion.

### `validate-phase`

Read first:

- `commands/blu-validate-phase.toml`
- `skills/blueprint-phase-validation/SKILL.md`
- `skills/blueprint-phase-validation/references/validate-phase-runtime-contract.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/phase.ts`
- `src/mcp/tools/phase-validation-contracts.ts`
- `src/mcp/tools/phase-validation-diagnostics.ts`
- `src/mcp/tools/phase-validation-rendering.ts`
- `src/mcp/tools/phase-validation-schemas.ts`
- `src/mcp/artifact-contracts/schemas/phase.verification.model.schema.json`
- `tests/validate-phase-tools.test.ts`
- `tests/validate-phase-metadata.test.ts`
- `tests/phase-validation-slice.test.ts`

Known friction themes to verify:

- Completed-summary coverage diagnostics can be correct but too low-level.
- PASS next-action enforcement may be explained in schema terms instead of workflow terms.
- PASS/no-gap authoring guidance can ask for more ceremony than runtime needs.
- Writer revalidation may duplicate preflight validation.
- Post-write state sync can mix local success with unrelated lifecycle warnings.

### `verify-work`

Read first:

- `commands/blu-verify-work.toml`
- `skills/blueprint-phase-validation/SKILL.md`
- `skills/blueprint-phase-validation/references/verify-work-runtime-contract.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/phase.ts`
- `src/mcp/tools/phase-validation-contracts.ts`
- `src/mcp/tools/phase-validation-diagnostics.ts`
- `src/mcp/tools/phase-validation-rendering.ts`
- `src/mcp/artifact-contracts/schemas/phase.uat.model.schema.json`
- `tests/verify-work-metadata.test.ts`
- `tests/verify-work-roadmap-sync.test.ts`
- `tests/phase-validation-slice.test.ts`

Known friction themes to verify:

- UAT depends on saved summaries and verification state; missing prerequisites should be early and crisp.
- User-reported issues are evidence, while follow-up capture needs a separate explicit gate.
- Roadmap closeout, state update, and UAT write success should remain distinct.
- Retry guidance should target the model contract rather than rendered Markdown headings.

## Lightweight Execution And Debug

### `add-tests`

Read first:

- `commands/blu-add-tests.toml`
- `skills/blueprint-phase-validation/SKILL.md`
- `skills/blueprint-phase-validation/references/add-tests-runtime-contract.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/phase.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/phase-validation-contracts.ts`
- `src/mcp/tools/phase-validation-diagnostics.ts`
- `src/mcp/artifact-contracts/schemas/report.add-tests.model.schema.json`
- `tests/add-tests-slice.test.ts`
- `tests/add-tests-metadata.test.ts`
- `tests/phase-validation-slice.test.ts`

Known friction themes to verify:

- The command mutates repo tests and persists verification/report evidence, so scope must stay tight.
- Validation and report writes can duplicate model construction or retry work.
- Generated/passing/failing/blocked counts should be MCP-contract owned, not freeform prose.
- Follow-up routing should not imply verification is complete merely because tests were added.

### `quick`

Read first:

- `commands/blu-quick.toml`
- `skills/blueprint-phase-execution/SKILL.md`
- `skills/blueprint-phase-execution/references/quick-runtime-contract.md`
- `skills/blueprint-phase-execution/references/long-running-execution-profile.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/state.ts`
- `tests/quick-metadata.test.ts`
- `tests/lightweight-execution-regression.test.ts`

Known friction themes to verify:

- Quick can impersonate heavier lifecycle workflows if opt-in boundaries are vague.
- Visible todos/update-topic are session-local and should not become persistence.
- Durable quick-run report writing should not force full phase planning semantics.
- Branchy quick work should route to planning when it stops being bounded.

### `fast`

Read first:

- `commands/blu-fast.toml`
- `skills/blueprint-phase-execution/SKILL.md`
- `skills/blueprint-phase-execution/references/fast-runtime-contract.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/state.ts`
- `tests/fast-metadata.test.ts`
- `tests/lightweight-execution-regression.test.ts`

Known friction themes to verify:

- Fast should stay genuinely trivial: no subagents, no reports, no phase artifacts.
- The boundary between `fast`, `quick`, and lifecycle planning should be obvious.
- State updates should be optional and initialized-project only.

### `debug`

Read first:

- `commands/blu-debug.toml`
- `skills/blueprint-debug/SKILL.md`
- `skills/blueprint-debug/references/debug-runtime-contract.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/state.ts`
- `tests/debug-metadata.test.ts`

Known friction themes to verify:

- Diagnose-only mode should not drift into fixes.
- Durable report overwrite and todo capture need explicit gates.
- Debug should not hide broad direct fixes inside investigation.
- Long-running visibility should be used only for non-trivial investigations.

## Review And Quality

### `code-review`

Read first:

- `commands/blu-code-review.toml`
- `skills/blueprint-review/SKILL.md`
- `skills/blueprint-review/references/code-review-runtime-contract.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/review.ts`
- `src/mcp/tools/quality-gates.ts`
- `src/mcp/artifact-contracts/schemas/review.code-review.model.schema.json`
- `tests/code-review-slice.test.ts`
- `tests/code-review-metadata.test.ts`
- `tests/review-runtime-contract-resource.test.ts`
- `tests/quality-gate-routing.test.ts`

Known friction themes to verify:

- Evidence coverage failures can be noisy for one authoring slip.
- `scopeSource` lives outside the model and can pass validation but fail record.
- Exhaustive evidence coverage can encourage filler.
- Plan-shape warnings can leak into successful review generation.
- Security-first routing and code-review-fix follow-ups must stay clearly separate.

### `code-review-fix`

Read first:

- `commands/blu-code-review-fix.toml`
- `skills/blueprint-review/SKILL.md`
- `skills/blueprint-review/references/code-review-fix-runtime-contract.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/review.ts`
- `src/mcp/tools/quality-gates.ts`
- `src/mcp/artifact-contracts/schemas/review.review-fix.model.schema.json`
- `tests/code-review-fix-slice.test.ts`
- `tests/code-review-fix-metadata.test.ts`
- `tests/god-review-fix-selection.test.ts`

Known friction themes to verify:

- Remediation must stay scoped to selected saved findings.
- Stale evidence classification and fix/defer/skip decisions need compact handoff data.
- State routing after remediation should not overclaim validation success.
- Report schema and review finding inventory can duplicate source-of-truth fields.

### `audit-fix`

Read first:

- `commands/blu-audit-fix.toml`
- `skills/blueprint-review/SKILL.md`
- `skills/blueprint-review/references/audit-fix-runtime-contract.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/review.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/quality-gates.ts`
- `src/mcp/artifact-contracts/schemas/report.audit-fix.model.schema.json`
- `tests/audit-fix-slice.test.ts`
- `tests/audit-fix-metadata.test.ts`

Known friction themes to verify:

- Saved-evidence classification should be narrow and not become a broad repo audit.
- Dry-run, max attempts, severity, mutation confirmation, and report overwrite gates can create ceremony.
- Structured report validation should not make the agent reread stale context unnecessarily.
- Todo capture should stay explicitly confirmed.

### `secure-phase`

Read first:

- `commands/blu-secure-phase.toml`
- `skills/blueprint-review/SKILL.md`
- `skills/blueprint-review/references/secure-phase-runtime-contract.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/review.ts`
- `src/mcp/tools/quality-gates.ts`
- `src/mcp/artifact-contracts/schemas/review.security.model.schema.json`
- `tests/secure-phase-slice.test.ts`
- `tests/secure-phase-metadata.test.ts`
- `tests/security-hardening.test.ts`

Known friction themes to verify:

- Declared summary threat flags may be under-enforced or expensive to repair.
- Unregistered threat flags can force a heavy PARTIAL ledger.
- Missing summaries or pending plans should block early enough in authoring context.
- Benign warnings such as no pending plans can distract from successful security review.
- One-repair retry contracts may be optimistic for semantic repairs.

### `review`

Read first:

- `commands/blu-review.toml`
- `skills/blueprint-review/SKILL.md`
- `skills/blueprint-review/references/review-runtime-contract.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/review.ts`
- `src/mcp/artifact-contracts/schemas/review.peer-review.model.schema.json`
- `tests/review-slice.test.ts`
- `tests/review-metadata.test.ts`
- `tests/review-runtime-contract-resource.test.ts`

Known friction themes to verify:

- Reviewer availability, unavailable reviewers, partial coverage, and disagreement can become prompt-heavy.
- The parent should own evidence selection, validation, persistence, and routing.
- Reviewer packets should be compact and saved-evidence based.
- MCP validation rejection should stop rather than invite hand-written `.blueprint/` edits.

### `ui-review`

Read first:

- `commands/blu-ui-review.toml`
- `skills/blueprint-review/SKILL.md`
- `skills/blueprint-review/references/ui-review-runtime-contract.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/review.ts`
- `src/mcp/artifact-contracts/schemas/review.ui-review.model.schema.json`
- `tests/ui-review-slice.test.ts`
- `tests/ui-review-metadata.test.ts`

Known friction themes to verify:

- Visual-evidence limits should be stated clearly without requiring browser work by default.
- Scored pillar evidence can become filler if saved execution/UI-spec evidence is thin.
- Pending-plan narrowing and overwrite confirmation should happen before drafting.
- Auditor use needs a bounded packet; parent owns MCP writes.

## Documentation Workflow

### `docs-update`

Read first:

- `commands/blu-docs-update.toml`
- `skills/blueprint-docs/SKILL.md`
- `skills/blueprint-docs/references/docs-update-runtime-contract.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/state.ts`
- `src/mcp/artifact-contracts/index.ts`
- `tests/docs-update-metadata.test.ts`
- `tests/review-docs-safety-regression.test.ts`

Known friction themes to verify:

- The command reviews documentation behavior, but this Antigravity packet still forbids `docs/**` unless the user overrides it.
- Scope resolution should be narrow before drafting.
- Verify-only mode should remain read-only for repo docs, while durable reports may still be written by the actual command.
- Digest `inputsUsed` should prevent the agent from repeatedly rediscovering the same source files.
- Doc writer/verifier subagents need bounded file scopes and should not become generic research agents.

## Fallback For Unlisted Workflows

If the user targets a workflow not listed here:

1. Do not read `docs/**`.
2. Open `commands/blu-<workflow>.toml`.
3. Search `src/mcp/command-runtime-metadata.ts` for `commandName: "<workflow>"`.
4. Read the `primarySkill` from the runtime metadata entry and open `skills/<primarySkill>/SKILL.md`.
5. If the metadata entry names a `skills/<primarySkill>/references/*-runtime-contract.md`, open only that reference.
6. Search `tests/` for the workflow name and open only the focused tests that match.
7. If this still does not identify the MCP tool module, report that limitation instead of browsing `docs/**`.
