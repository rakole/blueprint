# `/blu-secure-phase` Simulation Results

## Scope

Workflow simulated: `/blu-secure-phase`

Simulation focus: realistic `XX-SECURITY.md` generation through the real security authoring context, saved threat-model parsing, summary threat-flag coverage, narrowed model validation, canonical render, and review record/write path.

Investigation grounding:
- Command: `commands/blu-secure-phase.toml`
- Skill: `skills/blueprint-review/SKILL.md`
- Runtime contract: `skills/blueprint-review/references/secure-phase-runtime-contract.md`
- Optional security auditor: `agents/blueprint-security-auditor.md`
- Command spec: `docs/commands/secure-phase.md`
- Contract/model source: `src/mcp/artifact-contracts/index.ts`
- Base model schema: `src/mcp/artifact-contracts/schemas/review.security.model.schema.json`
- Security authoring, validation, rendering, and record path: `src/mcp/tools/review.ts`
- Rendered Markdown validation: `src/mcp/tools/artifacts.ts`
- Later quality-gate routing: `src/mcp/tools/quality-gates.ts`

Artifacts involved:
- `.blueprint/phases/<phase-slug>/<phase-prefix>-SECURITY.md`

Normal `/blu-secure-phase` does not update `.blueprint/STATE.md`, `.blueprint/ROADMAP.md`, plans, summaries, verification, or UAT artifacts.

## Simulation Summary

Two independent agents ran real simulations against temporary repos using live Blueprint handlers. Both reached persisted `XX-SECURITY.md` artifacts. The model-only path correctly rejected invented or unregistered threat coverage in some cases and prevented a false `COMPLETED` result for an uncovered unregistered flag. However, one simulation found a stronger correctness issue: a declared summary threat flag can be considered covered merely because the threat id appears in the threat register, even if the concrete flag text is absent from the saved security artifact.

| Agent | Attempts | Final Result | Main Retry Drivers |
| --- | ---: | --- | --- |
| GPT-5.5 high | 3 | `PARTIAL` security artifact saved after unregistered-flag repair | Unregistered summary flag, PARTIAL ledger truth table, `/blu-progress` routing |
| GPT-5.4 high | 3 probes | Passing declared-flag artifact saved; unregistered-flag repair saved; missing-summary probe exposed late blocker | Declared flag under-enforcement, unregistered-flag repair, authoring context readiness |

Both simulations exercised `blueprintReviewAuthoringContext`, `blueprintReviewValidateModel`, and `blueprintReviewRecord` with `artifact: "security"`.

## Findings

### High: Declared summary threat flags are too weakly enforced

A completed summary included a `## Threat Flags` row for declared threat `T-01` with concrete text: `External webhook authentication drifted after execution.` A naive `COMPLETED` model with a `T-01` threat-register row validated and saved even though the saved `XX-SECURITY.md` did not contain or address the concrete flag phrase.

Evidence:
- Declared summary flag coverage currently treats matching `threatId` row presence as enough: `src/mcp/tools/review.ts:7759`.
- Runtime contract says summary threat flags should be incorporated and threat-count consistency should be enforced: `skills/blueprint-review/references/secure-phase-runtime-contract.md:34` and `skills/blueprint-review/references/secure-phase-runtime-contract.md:105`.

Why it matters: this can persist a passing security artifact while silently dropping execution-discovered threat evidence. The validation should require the mapped threat row or a finding to address the flag text, not just repeat the threat id.

### High: Unregistered summary threat flags force a heavy PARTIAL ledger

A single unregistered summary threat flag cannot be represented as just a finding. Once the model becomes `PARTIAL`, the schema also requires manual/deferred work, gap route, follow-up, status/readiness/completion-state changes, and `/blu-progress`.

Evidence:
- `PARTIAL` requires findings plus manual/deferred work, gap routes, and follow-ups: `src/mcp/artifact-contracts/schemas/review.security.model.schema.json:292`.
- Runtime contract says unregistered flags should stay visible without widening into a generic scan: `skills/blueprint-review/references/secure-phase-runtime-contract.md:59`.
- Observed second attempt failed with `schema.contains` for `model.manualOrDeferredWork`, `model.gapRoutes`, and `model.followUps`.

Why it matters: the safety intent is sound, but the authoring burden is high for a narrow unregistered flag. This drove a two-repair sequence before persistence.

### Medium: Missing summaries and pending plans are not blocked early enough in authoring context

The command/runtime contract says to stop before authoring when completed summaries are missing or plans remain pending. One simulation found `blueprintReviewAuthoringContext` still returned `status: "ready"` with missing completed-summary evidence; validation later narrowed `model.status` to `PARTIAL | BLOCKED`.

Evidence:
- Command says to require completed summaries before persistence: `commands/blu-secure-phase.toml:22`.
- Runtime contract describes State C stop behavior: `skills/blueprint-review/references/secure-phase-runtime-contract.md:20`.
- Authoring context accumulates warnings: `src/mcp/tools/review.ts:3040`.
- Authoring context still returns ready: `src/mcp/tools/review.ts:3163`.

Why it matters: this shifts a prerequisite blocker into model repair. The model gets a schema enum failure instead of the clean stop/route promised by the command contract.

### Medium: PARTIAL repair diagnostics become schema-noisy after a good first hint

For unregistered summary flags, the first diagnostic was useful: add a finding with `kind: unregistered-flag`. The second failure became lower-level AJV output such as `must contain at least 1 valid item(s)` and duplicate truth-table `schema.if` messages.

Evidence:
- Hand-authored summary flag diagnostic: `src/mcp/tools/review.ts:7788`.
- Validation surfaces narrowed schema/AJV output: `src/mcp/tools/review.ts:9147`.
- Observed repair path needed coordinated edits to `model.findings`, status markers, `manualOrDeferredWork`, `gapRoutes`, `followUps`, `auditTrail`, and `nextSafeAction`.

Why it matters: the command tells models to repair by exact paths, but the actual repair spans multiple model sections. A semantic repair bundle would avoid one extra retry.

### Medium: `No pending plans remain` appears as a warning in a successful security path

Both simulations saw `No pending plans remain for phase 5.` as a warning while the authoring context was otherwise ready. This comes from the execution-target helper, where no pending plans can be an execute-phase blocker, but for secure-phase it is expected good news.

Evidence:
- Secure authoring context pulls execution target warnings into its own warning list: `src/mcp/tools/review.ts:3014`.
- Execution target warning originates around `src/mcp/tools/phase.ts:9034` and propagates around `src/mcp/tools/phase.ts:9205`.

Why it matters: this is low-value noise in the security workflow and makes actual blockers easier to miss.

### Low: The one-repair retry contract is optimistic

One realistic unregistered-flag path required two repair iterations: first to add the required finding, then to satisfy the `PARTIAL` ledger truth table.

Evidence:
- Command retry rule says repair once: `commands/blu-secure-phase.toml:34`.
- Runtime contract repeats repair-once guidance: `skills/blueprint-review/references/secure-phase-runtime-contract.md:108`.

Why it matters: either diagnostics need to include all downstream status-truth-table repairs on the first failure, or the command should allow two validation repair attempts for model-only security artifacts.

### Low: Empty-array rendering behaved as intended

The simulations confirmed that empty arrays can be used in the model and MCP renders canonical `none` rows/bullets. This reduced filler compared with hand-authored sentinel rows.

Evidence:
- Command instructs empty arrays and MCP-rendered none rows: `commands/blu-secure-phase.toml:33`.

Why it matters: this part of the contract is useful and should be preserved.

## Deduplication Notes

Both agents agreed that the model-only secure-phase path is mostly protective and correctly prevents broad generic security scans. The key issues are:
- declared summary threat flags can be under-enforced;
- unregistered flags require a heavy PARTIAL repair bundle;
- prerequisite blockers are sometimes deferred into model validation instead of authoring readiness;
- success-path execution-target warnings are noisy for secure-phase.

The simulations did not find Markdown fallback or unsafe overwrite behavior. Valid structured models persisted canonical `XX-SECURITY.md` artifacts through MCP.
