# Prompt and Skill Deep Audit

Date: 2026-05-04

Scope: Blueprint prompt, command, skill, and agent design. This report ignores normal code quality unless it affects prompt execution, tool selection, state safety, artifact correctness, delegation, or user workflow quality. No fixes were implemented.

## Executive Summary

Blueprint's prompt architecture is stronger than a typical CLI extension. The system has a real separation of concerns: command manifests provide user-facing entrypoints, skills hold orchestration rules, agents do bounded deep work, and MCP tools own state. The best prompt patterns are implemented-only routing, schema-first artifact persistence, returned MCP path/status authority, explicit confirmation gates, and parent-owned subagent persistence.

The main risk is not missing prompt detail. It is contract drift and contract overload. Several important behaviors are described in too many places: `commands/*.toml`, top-level skills, command-local skill references, `docs/MCP-TOOLS.md`, `docs/RUNTIME-REFERENCE.md`, `src/mcp/command-runtime-metadata.ts`, agent contracts, and regex-heavy tests. That makes it easy for a model to load the wrong level of detail, miss a buried gate, or translate a subagent's prose output into a strict MCP model incorrectly.

The highest priority repairs are prompt-contract repairs, not source behavior fixes:

- Make every mutating command manifest self-sufficient about required MCP tools, artifact contracts, confirmation gates, stop conditions, and final response shape.
- Slim the largest multi-command skills so progressive disclosure actually works.
- Add mode-specific subagent handoff/output schemas where agents are reused across incompatible workflows.
- Normalize high-risk confirmation gates into typed preview packets rather than only prose.
- Add deterministic prompt evals that test command packets, tool discipline, artifact shape, and user journeys.

## Biggest Prompt Design Risks

1. **Command-local contracts are uneven.** Most manifests are precise, but `/blu-new-project` delegates key MCP/tool/artifact details to references, and known report writers such as `/blu-debug`, `/blu-quick`, `/blu-docs-update`, and `/blu-cleanup` write durable reports without requiring their canonical report contract reads.

2. **Progressive disclosure is partially inverted.** `input_bundles` are a good pattern, but top-level family skills such as `skills/blueprint-review/SKILL.md` and `skills/blueprint-maintenance/SKILL.md` still contain many sibling command workflows. A host that loads the whole skill has already loaded too much.

3. **Tool affordances ask the model to translate at runtime.** Many skills say "call runtime FQNs" but list shorthand tool names in Required MCP Tool sections. Bootstrap and router use full FQNs, while planning, validation, docs, review, and maintenance often mix shorthand lists with FQN self-checks.

4. **Subagent outputs do not always match parent MCP schemas.** `blueprint-security-auditor` and `blueprint-ui-auditor` still ask for prose artifact drafts even though `/blu-secure-phase` and `/blu-ui-review` require strict model-only persistence. `blueprint-reviewer` is also reused for code-review, peer-review synthesis, review-fix triage, and audit-fix classification while its concrete schema is primarily code-review shaped.

5. **Reduced-ceremony commands can blur lifecycle boundaries.** `/blu-quick` can invoke researcher, planner, executor, and verifier agents without quick-specific output contracts. That risks turning "bounded quick run" into a hidden lifecycle run without the saved phase artifacts that those agents normally expect.

6. **Safety gates are strong but prose-mediated.** Commands often say "require explicit confirmation" or "use `ask_user`", but there is no shared command prompt packet shape for the preview, destructive surface, exact commands, accept/decline/cancel state, and host fallback.

7. **Prompt behavior is not evaluated directly.** Existing tests are broad and useful, but mostly metadata or regex checks. They do not yet prove assembled command packets preserve tool-call order, avoid sibling-contract leakage, block unsafe writes, or produce artifacts that match live MCP schemas.

## Top 5 Prompt/Skill Improvements

### 1. Make Mutating Command Manifests Self-Sufficient

**Problem**

Some mutating command prompts depend too much on skill references for critical execution details. The clearest examples are `/blu-new-project`, which says the manifest is a "thin command envelope", and report-writing commands that persist known report artifacts without first requiring their canonical report contract.

**Repo Evidence**

- `commands/blu-new-project.toml:5` calls itself a thin envelope.
- `commands/blu-new-project.toml:13` says to use the required MCP tool set declared by the skill package instead of listing the command-local tool set.
- `commands/blu-debug.toml:23`, `commands/blu-quick.toml:25`, `commands/blu-docs-update.toml:33`, and `commands/blu-cleanup.toml:17` persist `debug-latest`, `quick-run-latest`, `docs-update-latest`, and `cleanup-latest`.
- The corresponding response tool lists omit `mcp_blueprint_blueprint_artifact_contract_read` in those manifests.
- `docs/MCP-TOOLS.md:241` and `docs/MCP-TOOLS.md:311` describe `blueprint_artifact_contract_read` as the canonical report/artifact contract authority.
- `src/mcp/artifact-contracts/index.ts` defines known contracts for report families including debug, quick-run, docs-update, and cleanup.

**Best-Practice Principle**

The command prompt should be the active, self-sufficient execution contract for the current invocation. Skills and references may provide richer procedure detail, but the command must still state its required reads, writes, gates, artifact contracts, and final response shape where state can be mutated.

**Concrete Fix**

Normalize mutating command manifests to a checklist shape:

- Required MCP reads, with runtime FQNs.
- Required MCP writes, with destination and "no raw file write" boundary.
- Artifact contract reads, with exact artifact/report ids.
- Preconditions and hard stops.
- Confirmation gates with gate ids.
- Optional subagent mode and no-subagent fallback.
- Final response requirements.

For `/blu-new-project`, list `mcp_blueprint_blueprint_project_status`, `mcp_blueprint_blueprint_config_get`, `mcp_blueprint_blueprint_artifact_contract_read`, `mcp_blueprint_blueprint_project_init`, `mcp_blueprint_blueprint_artifact_validate`, and state/config writes explicitly. For `/blu-debug`, `/blu-quick`, `/blu-docs-update`, and `/blu-cleanup`, require the matching `report.*` contract read before drafting the report.

**Example Before**

```text
Use the required MCP tool set and optional agent names declared by the `blueprint-bootstrap` skill package.
```

**Example After**

```text
Required MCP reads before any write:
- `mcp_blueprint_blueprint_project_status`
- `mcp_blueprint_blueprint_config_get` with `scope: "effective"`
- `mcp_blueprint_blueprint_artifact_contract_read` for bootstrap project, requirements, and roadmap contracts

First persistent write:
- Call `mcp_blueprint_blueprint_project_init` only after the visible approval packet is approved.
- Do not scaffold or hand-edit `.blueprint/` before project init succeeds.

Validation:
- Call `mcp_blueprint_blueprint_artifact_validate`.
- Treat returned paths, warnings, and next action as authoritative.
```

**Acceptance Criteria**

- Every mutating implemented manifest names exact runtime FQNs for allowed Blueprint persistence.
- Every known report writer reads its report contract before drafting or writing.
- `/blu-new-project` can be understood from the command manifest plus active skill bundle without opening control-plane docs.
- `/blu-health` and `/blu-settings` include explicit tool allow-lists, write boundaries, post-write re-read or validation expectations, and final response fields.

**Suggested Tests/Evals**

- Prompt lint: mutating command packet must include allowed persistence tools and forbid raw `.blueprint/` writes.
- Golden packet tests for `/blu-new-project`, `/blu-quick`, `/blu-debug`, `/blu-docs-update`, and `/blu-cleanup`.
- Artifact shape tests that verify report-writing commands name the same `report.*` contracts registered in `src/mcp/artifact-contracts/index.ts`.

**Effort**

Medium.

**Confidence**

High.

### 2. Slim Family Skills Into Real Progressive Disclosure

**Problem**

Blueprint has the right `input_bundles` mechanism, but several top-level skills still act like long command-family manuals. This undermines the "load only the active command" rule because sibling workflows are already present in the loaded `SKILL.md` body.

**Repo Evidence**

- `skills/blueprint-review/SKILL.md` embeds full workflows for `code-review`, `code-review-fix`, `secure-phase`, `ui-review`, `audit-fix`, and `review`.
- `skills/blueprint-maintenance/SKILL.md` embeds workflows for nine maintenance commands.
- `skills/blueprint-review/SKILL.md` and `skills/blueprint-maintenance/SKILL.md` are among the largest skill files and carry high-risk, multi-command instructions in one context.
- `skills/blueprint-phase-discovery/SKILL.md:41` and similar rules correctly say to load only active command inputs, showing the intended design.
- Required MCP Tool sections are inconsistent: bootstrap/router list runtime FQNs, while many other skills list shorthand ids and rely on local translation rules.

**Best-Practice Principle**

A skill should be a reusable, progressively disclosed procedure. The top-level skill should select the active command bundle, state shared invariants, and point to the command-local reference. It should not load detailed sibling command procedures by default.

**Concrete Fix**

- Keep top-level `SKILL.md` files as thin dispatchers: purpose, shared invariants, active-bundle loading, common safety rules, and completion self-check.
- Move detailed per-command workflows into `skills/<skill>/references/<command>-runtime-contract.md`.
- Replace shorthand Required MCP Tool lists with runtime FQN allow-lists, or use a two-column map: `runtime FQN -> internal short name`.
- Extract repeated runtime call rules into a shared reference modeled after `skills/blueprint-bootstrap/references/runtime-guardrails.md`.
- Add compact examples to command-local references, not to top-level family skills.

**Example Before**

```text
### `code-review`
...
### `code-review-fix`
...
### `secure-phase`
...
### `ui-review`
...
```

**Example After**

```text
## Active Command Procedure

1. Resolve the active `/blu-*` command.
2. Load only `input_bundles.commands[activeCommand]`.
3. Apply shared invariants: runtime FQNs only, MCP-owned persistence only, implemented-only routing.
4. Follow the loaded command-local runtime contract.
5. Run the completion self-check for the active command only.
```

**Acceptance Criteria**

- Top-level multi-command skills no longer include full sibling workflows.
- Active command input bundles remain docs-free and command-scoped.
- Required tool allow-lists are FQN-consistent or explicitly mapped.
- Shared guardrails are defined once and reused.
- Each command-local reference has at least one happy-path example, one blocked/no-write example, and one validation/overwrite repair example where relevant.

**Suggested Tests/Evals**

- Prompt packet test: active command packet must not include sibling runtime-contract paths.
- Prompt lint: top-level skill body must not contain detailed headings for sibling workflows beyond a compact command index.
- Skill metadata test: Required MCP tools in skills must be runtime FQNs or explicitly mapped.

**Effort**

Medium to large.

**Confidence**

High.

### 3. Make Subagent Handoffs Mode-Specific And Schema-Shaped

**Problem**

Most agents are bounded correctly, but several are reused across multiple parent command modes without output schemas that match the parent MCP persistence path.

**Repo Evidence**

- `commands/blu-secure-phase.toml:33-36` requires structured `review.security` model fields and rejects Markdown fallback.
- `agents/blueprint-security-auditor.md:78-89` asks for a posture plus a concise artifact draft for `XX-SECURITY.md`.
- `commands/blu-ui-review.toml:23-24` requires structured `review.ui-review` JSON and rejects Markdown content.
- `agents/blueprint-ui-auditor.md:98-119` asks for scored findings plus a concise artifact draft for `XX-UI-REVIEW.md`.
- `agents/blueprint-reviewer.md:123-148` defines `review.code-review` JSON fields, but `/blu-review`, `/blu-code-review-fix`, and `/blu-audit-fix` reuse the reviewer for peer-review packet synthesis, saved-finding triage, and audit-fix classification.
- `commands/blu-quick.toml:5` permits researcher, planner, executor, and verifier agents even though those agents normally target phase research, phase plans, summaries, or validation artifacts.
- `agents/blueprint-debugger.md` is read-only, while `/blu-debug` asks it to support reproduction-oriented investigation.

**Best-Practice Principle**

Subagents should receive a bounded handoff packet and return a parent-consumable schema. The parent owns persistence, routing, and confirmation, but the subagent output should already be shaped for the parent MCP model or report, not a prose draft that must be reinterpreted.

**Concrete Fix**

Introduce reusable handoff packet fields:

- `mode`
- `phase` or `scope`
- `evidencePaths`
- `requiredReads`
- `writeBoundary`
- `forbiddenSurfaces`
- `outputSchema`
- `stopConditions`
- `verificationExpectation`
- `parentOwnedPersistence`

Then update agent contracts:

- `blueprint-security-auditor`: return `review.security` model-shaped rows, threat statuses, audit trail, follow-ups, and next safe action.
- `blueprint-ui-auditor`: return `review.ui-review` model-shaped pillar scores, findings, visual evidence posture, recommendations, and next safe action.
- `blueprint-reviewer`: define modes for `code-review`, `peer-review-packet`, `review-fix-triage`, and `audit-fix-classification`.
- `/blu-quick`: define quick-mode outputs such as `QuickResearchMemo`, `QuickChecklist`, `QuickExecutionNotes`, and `QuickValidationNotes`, or remove lifecycle agents from quick and route deeper work to lifecycle commands.
- `blueprint-debugger`: add a structured `ReproCommandRequest` output if it needs parent-run shell evidence.

**Example Before**

```text
Include a concise artifact draft for `XX-SECURITY.md`.
```

**Example After**

```text
Return `SecurityAuditResult`:
- `status`: `ready-for-routing` | `needs-follow-up` | `blocked`
- `threatRows`: array of declared threat id, mitigation evidence, status, confidence, gap
- `suspiciousArtifactFindings`: array
- `auditTrail`: object
- `nextSafeAction`: implemented command or blocker

Do not return Markdown artifact content. The parent persists through `mcp_blueprint_blueprint_review_record`.
```

**Acceptance Criteria**

- Every subagent-capable command names the subagent mode and output schema.
- Agent contracts no longer ask for Markdown artifact drafts when the parent requires model-only persistence.
- `blueprint-reviewer` has separate mode contracts or is split into narrower agents.
- `/blu-quick` cannot delegate phase-shaped outputs into a quick report without a quick-mode schema.
- Debugger reproduction requests are structured and safe for parent execution.

**Suggested Tests/Evals**

- Agent schema tests for required mode sections and output fields.
- Prompt eval: parent command delegation packet must include mode, read scope, forbidden surfaces, and output schema.
- Negative eval: `/blu-secure-phase` fails if a subagent handoff asks for `XX-SECURITY.md` Markdown draft instead of model-shaped data.

**Effort**

Medium.

**Confidence**

High.

### 4. Normalize High-Risk Confirmation Gates As Typed Preview Packets

**Problem**

High-risk commands usually require confirmation, but the gate is expressed as prompt prose and host-specific `ask_user` guidance. That is better than silent mutation, but weaker than a testable prompt contract.

**Repo Evidence**

- `commands/blu-cleanup.toml:16-17` requires cleanup and report overwrite confirmations.
- `commands/blu-ship.toml` separates report-before-mutate, optional push, and optional PR creation, with explicit confirmation.
- `commands/blu-undo.toml` requires preview and confirmation before revert-style git operations.
- `commands/blu-new-workspace.toml`, `commands/blu-remove-workspace.toml`, and `commands/blu-reapply-patches.toml` use confirmation gates for host-global or filesystem/git mutation.
- `skills/blueprint-maintenance/SKILL.md` repeats many confirmation rules across high-risk commands.
- `docs/GEMINI-CONSTRAINTS.md:25-26` says to prefer `ask_user` and name fallback paths for unavailable host helpers.

**Best-Practice Principle**

For destructive or host-global actions, the prompt should require a typed preview-confirm-act packet. The model should not proceed because it "got a yes"; it should proceed only after a confirmation tied to the exact gate id, action, files, commands, and fallback behavior.

**Concrete Fix**

Define a shared `SafetyGate` shape in prompt contracts:

```json
{
  "gateId": "cleanup-confirmation",
  "command": "/blu-cleanup",
  "riskLevel": "high",
  "action": "move phase directories to archive",
  "destructiveSurface": ["filesystem", ".blueprint/phases"],
  "affectedPaths": [],
  "exactCommands": [],
  "reportName": "cleanup-latest",
  "accepted": false,
  "hostFallback": "stop-with-pending-gate"
}
```

Use the same shape for overwrite gates, remote push/PR gates, workspace registry gates, patch replay gates, and state repair gates. Keep `ask_user` as the preferred UI, but make the prompt contract independent of the host helper.

**Example Before**

```text
Require explicit confirmation before any push or PR creation.
```

**Example After**

```text
Before remote mutation, present `ship-remote-confirmation`:
- source branch
- base branch
- exact `git push` command
- exact `gh pr create` command, if any
- draft/ready posture
- report path already written
- fallback when `gh` is unavailable

Proceed only when the user accepts this gate. Decline or unavailable structured confirmation is a hard stop.
```

**Acceptance Criteria**

- Every high-risk command declares gate ids and required preview fields.
- Overwrite, destructive, remote, host-global, and forced paths use the same confirmation vocabulary.
- A command that cannot obtain confirmation reports the named pending gate and performs no mutation.
- Durable reports capture which gate was accepted or skipped/blocked where relevant.

**Suggested Tests/Evals**

- Prompt lint: high-risk commands must include a `SafetyGate` or equivalent gate fields.
- Simulated journey: cleanup/ship/undo decline path leaves repo unchanged.
- Golden packet: high-risk command packet includes destructive surface, exact mutation preview, and fallback.

**Effort**

Medium.

**Confidence**

Medium-high.

### 5. Add Deterministic Prompt And Skill Evaluation Harness

**Problem**

Blueprint has many tests for catalog status, runtime metadata, skill input bundles, artifacts, and MCP tools, but the model-facing prompt contracts are not tested as executable packets.

**Repo Evidence**

- `tests/command-catalog.test.ts` verifies implemented command catalog metadata, manifests, required tools, and optional agents.
- `tests/skill-metadata.test.ts` verifies structured `input_bundles` and docs-free runtime inputs for many command families.
- `tests/extension-runtime-contracts.test.ts` checks FQN references, path-free manifests, runtime guardrails, and built assets.
- `tests/artifact-contracts.test.ts` and related tests validate model contracts and artifact shapes.
- Runtime references still carry `needs-behavior-audit` evidence states for many commands.
- There is no `tests/prompt-eval/` layer that validates assembled command prompt packets, forbidden calls, confirmation behavior, or artifact output shapes as prompt obligations.

**Best-Practice Principle**

Prompt behavior should be versioned and evaluated like runtime behavior. The first harness should be deterministic and cheap, using node tests, normalized prompt packets, fixtures, and live MCP validators rather than flaky live LLM runs.

**Concrete Fix**

Create a repo-local prompt eval suite:

- `tests/prompt-eval/golden-command-contracts.test.ts`
- `tests/prompt-eval/prompt-lint.test.ts`
- `tests/prompt-eval/command-skill-mcp-drift.test.ts`
- `tests/prompt-eval/artifact-output-shape.test.ts`
- `tests/prompt-eval/user-journeys.test.ts`
- `tests/fixtures/prompt-eval/scenarios.json`
- `tests/fixtures/prompt-eval/golden/*.json`

Start with `/blu`, `/blu-help`, `/blu-plan-phase`, `/blu-execute-phase`, `/blu-cleanup`, and `/blu-impact`.

**Example Fixture**

```json
{
  "id": "cleanup-requires-confirmation-before-mutation",
  "command": "cleanup",
  "expectedToolsBeforeConfirmation": [
    "blueprint_project_status",
    "blueprint_artifact_list",
    "blueprint_artifact_summary_digest",
    "blueprint_artifact_contract_read",
    "blueprint_artifact_report_write"
  ],
  "forbiddenBeforeConfirmation": ["filesystem-move", "filesystem-delete"],
  "requiredGates": ["cleanup-confirmation", "report-overwrite-confirmation"]
}
```

**Acceptance Criteria**

- Prompt packet goldens capture command, primary skill, required tools, active input bundle paths, confirmation gates, persistence tools, forbidden patterns, and final response requirements.
- Prompt lints fail on missing FQNs, sibling-contract leakage, raw `.blueprint/` writes, high-risk commands without confirmation gates, and router prompts that expose planned commands as runnable.
- Artifact output fixtures validate through existing MCP model validators.
- Simulated journeys cover router, plan-to-verify, and one high-risk maintenance command.

**Suggested Tests/Evals**

- `router-do-planned-not-runnable`
- `plan-phase-model-only-no-markdown-fallback`
- `execute-phase-summary-before-complete-claim`
- `verify-work-no-pass-without-evidence`
- `cleanup-requires-confirmation-before-mutation`
- `ship-requires-confirmation-and-report-before-mutation`
- `code-review-fix-does-not-mutate-before-findings-read`
- `skill-inputs-no-sibling-contract-leakage`

**Effort**

Large.

**Confidence**

High.

## Recommended Prompt Design Standard for Blueprint

### Command Manifest Standard

Every `commands/blu-*.toml` prompt should use this structure:

1. **Identity**
   - Command name.
   - Primary skill.
   - Execution profile.
   - Risk class.

2. **Purpose**
   - One sentence describing what this command accomplishes.
   - One sentence describing what it must not widen into.

3. **Inputs**
   - Required user arguments.
   - Optional flags.
   - Default inference rules.
   - Ambiguous input stop condition.

4. **Preconditions And Stops**
   - Project state prerequisites.
   - Missing artifact behavior.
   - Dirty tree or host-global blockers where relevant.
   - Planned-only command routing rule.

5. **Active Runtime Inputs**
   - Skill references or runtime-contract references to load.
   - Explicit "do not load sibling command references" rule.

6. **Required MCP Reads**
   - Runtime FQNs only.
   - Expected purpose of each read.
   - Returned fields that are authoritative.

7. **Required MCP Writes**
   - Runtime FQNs only.
   - Exact artifact/report/state destinations.
   - Raw file write prohibition.
   - Returned path/status authority.

8. **Artifact Contracts**
   - Required `artifact_contract_read` ids.
   - Model authoring context and validator tools.
   - Strict model-only or Markdown path, explicitly stated.

9. **Confirmation Gates**
   - Gate id.
   - Risk surface.
   - Required preview fields.
   - Accept/decline/cancel behavior.
   - Host helper fallback.

10. **Optional Subagents**
    - Agent name.
    - Mode.
    - Required handoff packet.
    - Output schema.
    - No-subagent fallback.
    - Parent-owned persistence/routing.

11. **Session-Local Helpers**
    - Whether `update_topic`, `write_todos`, tracker, or `ask_user` may be used.
    - Explicit statement that they are not persistence.

12. **Final Response**
    - Work performed or no-write status.
    - Artifact paths or returned report paths.
    - Warnings/blockers.
    - Verification evidence or "not verified" reason.
    - Next safe implemented action.

### Skill Standard

Every `skills/<name>/SKILL.md` should use this structure:

1. Frontmatter with `name`, `description`, `status`, `commands`, and `input_bundles`.
2. Purpose and scope.
3. Shared invariants only.
4. Active command input resolution.
5. Runtime FQN tool allow-list or FQN-to-short-name map.
6. Shared MCP contracts that apply across commands.
7. Command-local reference index, not embedded full sibling workflows.
8. Optional agents, command-scoped.
9. Failure handling and validation repair policy.
10. Compact examples in references, not top-level sprawl.
11. Completion self-check.

### Agent Standard

Every `agents/*.md` should use this structure:

1. Frontmatter with conservative tools and timeout.
2. Purpose.
3. Parent-owned responsibilities.
4. Supported modes.
5. Required handoff packet.
6. Required reads and evidence boundaries.
7. Write boundary, or explicit read-only status.
8. Output schema per mode.
9. Stop/blocker conditions.
10. Boundaries and forbidden substitutes.

## Recommended Evaluation Harness

Use the proposal in `docs/to-the-moon/prompt-eval-harness-proposal.md` as the implementation blueprint.

The recommended first pass is deterministic and repo-local:

- Build normalized command packets from command manifests, live catalog entries, runtime-contract resources, skill input bundles, and active skill/reference files.
- Snapshot structural fields, not entire prompt prose.
- Add prompt lints for FQN usage, docs-free active inputs, no sibling references, no raw `.blueprint/` writes, implemented-only routing, and high-risk confirmation gates.
- Add drift tests that compare command manifest, skill frontmatter, runtime metadata, runtime resource, MCP registry, and optional agents for every implemented command.
- Validate golden model/report fixtures through existing MCP validators.
- Add simulated journeys for router safety, plan-to-verify lifecycle, and high-risk maintenance confirmation.

Initial command coverage should include:

- `/blu`
- `/blu-help`
- `/blu-plan-phase`
- `/blu-execute-phase`
- `/blu-cleanup`
- `/blu-impact`

Then extend to `/blu-quick`, `/blu-debug`, `/blu-ship`, `/blu-undo`, `/blu-code-review-fix`, `/blu-secure-phase`, and `/blu-ui-review`.

## Appendix

Subagent reports:

- [Command Prompt Contract Audit](prompt-audit-command-contracts.md)
- [Blueprint Skill Quality Audit](prompt-audit-skills.md)
- [Prompt Audit: Agents And Delegation](prompt-audit-agents.md)
- [Prompt Evaluation Harness Proposal](prompt-eval-harness-proposal.md)

Supporting prior to-the-moon reports consulted:

- [Command, Skill, Agent, and UX Coherence Audit](03-command-skill-agent-ux-audit.md)
- [Cross-Report Pattern Synthesis](05-cross-report-patterns.md)
- [Top 5 Improvements for Blueprint](TOP-5-IMPROVEMENTS.md)
