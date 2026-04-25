# `/blu-impact` Implementation Plan

## Purpose

This is the canonical implementation plan for adding `/blu-impact` to Blueprint.
It normalizes the external GPT-5.5 Pro design against the actual Blueprint
runtime, repository shape, command-catalog semantics, MCP tool registration
model, artifact-contract registry, and shipped command conventions.

`/blu-impact` computes blast radius for proposed or actual changes before
implementation, merge, or release. Its first production version must be
advisory and evidence-backed: it may write impact report artifacts under
`.blueprint/impact/<impact-id>/`, but it must not mutate source files, roadmap
state, phase state, command catalog state, PR state, deployment state, or the
installed extension directory.

The command's core value is:

> Every meaningful change gets a reproducible, evidence-backed blast-radius
> report before it ships.

## Repo-Grounded Corrections

Use these corrections instead of the generic Pro-plan assumptions.

| Area | Normalized Blueprint Decision |
|---|---|
| Command manifests | `commands/blu-*.toml` are prompt contracts, not declarative metadata files. Do not add `status`, `primary_skill`, or `required_tools` TOML fields. |
| Runtime catalog | `blueprint_command_catalog` derives availability from `docs/COMMAND-CATALOG.md`, `docs/commands/<command>.md`, command manifest existence, primary skill existence, and registered MCP tools. |
| Required tools | Required tools are parsed from the `## Required MCP Tools` section in `docs/commands/<command>.md`. |
| Runtime FQNs | Command manifests must reference MCP tools through runtime FQNs such as `mcp_blueprint_blueprint_impact_scope_resolve`. |
| Artifact contracts | Artifact contracts live in `src/mcp/artifact-contracts/index.ts`, not in separate JSON Schema files. |
| JSON payload validation | Use Zod and typed helpers inside the impact tool module for `impact.json`, config, evidence, and summary payloads. |
| Tool-family shape | Prefer one family module, `src/mcp/tools/impact.ts`, with internal helpers, matching current `project`, `phase`, `review`, and `workspace` patterns. |
| Tool registration | Register `impactToolDefinitions` in `src/mcp/server.ts`, include impact tools in `src/mcp/tools/project.ts` availability checks, and rebuild `dist/`. |
| Output location | Write impact reports under `.blueprint/impact/<impact-id>/`, not `.blueprint/reports/`, because each run owns a multi-file report bundle. |
| V1 PR support | Use local git and CI environment metadata first. Do not require provider APIs or mutate PR comments in V1. |
| Command-surface status | `/blu-impact` is outside the current 53-command baseline, so adding it requires an explicit command-surface decision update before it is routable. |

## Non-Negotiable Runtime Guarantees

- `/blu`, `/blu-help`, `/blu-progress`, and `/blu-next` must continue to surface only commands whose live runtime catalog entry is `implemented`.
- `/blu-impact` must stay non-routable until the command spec, catalog row, command manifest, primary skill, registered MCP tools, docs, tests, and built `dist/` assets all align.
- Missing metadata must never become false certainty:
  - Missing ownership does not mean no owners are required.
  - Missing dependency graph does not mean no reverse dependencies.
  - Missing compliance map does not mean not regulated.
  - Missing test map does not mean no tests are required.
- Agents may help with narrative synthesis only. MCP tools decide deterministic findings, evidence, risk, confidence, status, and output paths.
- Secret values must not be read or printed. Secret-sensitive reporting is path/key/provenance only.
- Description-only impact runs are allowed only as low-confidence advisory planning reports and cannot produce a high-confidence `PASS`.

## V1 User Experience

Supported invocation shapes:

```text
/blu-impact
/blu-impact "Add checkout payment retry support"
/blu-impact --staged
/blu-impact --working-tree
/blu-impact --range main..HEAD
/blu-impact --base main --head feature/payment-retry
/blu-impact --files src/payments/retry.ts config/payments.json
/blu-impact --diff-file /path/to/change.patch
/blu-impact --phase 3
/blu-impact --roadmap-item checkout-retry
/blu-impact --seed-file .blueprint/impact/seeds/payment-retry.json
/blu-impact --staged --meta compliance=PCI --meta service=checkout
```

Default scope resolution:

| Situation | Default |
|---|---|
| Staged changes exist | Analyze staged diff. |
| No staged changes, dirty working tree | Analyze working tree diff. |
| Clean non-base branch | Analyze branch diff against configured base branch or detected default branch. |
| CI with PR refs | Analyze CI-provided base/head refs. |
| CI without PR refs | Analyze `HEAD^..HEAD` unless configured otherwise. |
| No git scope and only description | Produce `WARN`, low confidence, and explicit `scope not proven` unknown. |

Recommended output statuses:

| Status | Meaning | Default local exit |
|---|---|---:|
| `PASS` | No blocking impact found and confidence is sufficient for the analyzed scope. | `0` |
| `WARN` | Non-blocking risk, missing metadata, or review/test obligations exist. | `0` |
| `BLOCK` | A breaking change, sensitive-path unknown, required evidence gap, or policy threshold should block approval until resolved. | `0` |

Recommended exit codes:

| Exit | Meaning |
|---:|---|
| `0` | Command completed; advisory status may be `PASS`, `WARN`, or `BLOCK`. |
| `1` | Invalid seed/config, tool/runtime error, or artifact write failure. |
| `2` | Completed but failed configured CI policy threshold. |
| `3` | Scope could not be resolved at all. |

In CI, `--ci` should default to `--fail-on=block`; local advisory use should not fail automatically on `BLOCK`.

## V1 MCP Tool Surface

Keep the model-facing surface small and deterministic. Internal helpers may be
larger, but the command should call a compact sequence.

| Tool | Responsibility | Writes |
|---|---|---|
| `blueprint_impact_config_get` | Load built-in defaults, optional host-global impact defaults, `.blueprint/impact/config.json`, optional invocation config, and flag overrides. Return merged config, provenance, validation warnings, and config hash. | No |
| `blueprint_impact_scope_resolve` | Resolve seed into normalized changed files, git metadata, diff stats, patch hash, scope fingerprint, scope confidence, and unresolved-scope warnings. | No |
| `blueprint_impact_context_load` | Load relevant Blueprint context: project status, config, roadmap, phase artifacts when requested, command catalog, manifests, skills, MCP tool registry metadata, artifact contracts, and repo package/test/doc hints. | No |
| `blueprint_impact_analyze` | Classify surfaces, ownership, dependencies, contracts, obligations, unknowns, findings, risk, confidence, and final impact status. | No |
| `blueprint_impact_report_write` | Write `IMPACT.md`, `impact.json`, `summary.json`, optional `review-checklist.md`, optional `QUESTIONS.md`, and optional `evidence.jsonl` under `.blueprint/impact/<impact-id>/`. | Yes, bounded |
| `blueprint_impact_output_render` | Render compact human, JSON, Markdown, PR-comment, or summary output from a normalized report object or saved impact id. | No |

The tool implementation should live in:

```text
src/mcp/tools/impact.ts
```

Then register it from:

```text
src/mcp/server.ts
src/mcp/tools/project.ts
docs/MCP-TOOLS.md
```

## V1 Artifact Bundle

Impact artifacts are a run bundle:

```text
.blueprint/
  impact/
    impact-<12-char-scope-fingerprint>/
      IMPACT.md
      impact.json
      summary.json
      evidence.jsonl
      review-checklist.md
      QUESTIONS.md
```

Required files in V1:

- `IMPACT.md`
- `impact.json`
- `summary.json`

Conditional files:

- `evidence.jsonl` when evidence records exist or `reporting.writeEvidenceLog` is enabled.
- `review-checklist.md` when review/test/action obligations exist.
- `QUESTIONS.md` when unknowns exist.

`IMPACT.md` should be backed by a new `report.impact` contract in
`src/mcp/artifact-contracts/index.ts`. The structured JSON files should be
validated by Zod inside the impact tool. Do not create a separate JSON Schema
directory unless Blueprint later adopts schema generation broadly.

Required `IMPACT.md` sections:

```text
# Impact Report: <impact-id>

## Summary
## Change Scope
## Top Impacted Areas
## Required Reviewers
## Required Tests
## Blocking Findings
## Warnings
## Contract And Compatibility Impact
## Database, Config, Infra, And Deployment Impact
## Unknowns And Missing Metadata
## Evidence
## Suggested Next Actions
```

## Analysis Model

Every deterministic check should produce normalized findings:

```json
{
  "id": "finding.contract.cli.commands-blu-impact.001",
  "checkId": "contract.cli",
  "title": "Command manifest changed",
  "severity": "MEDIUM",
  "status": "WARN",
  "confidence": 0.86,
  "impactedFiles": ["commands/blu-impact.toml"],
  "impactedAreas": ["blueprint-runtime"],
  "owners": [],
  "requiredActions": ["Review command manifest and command spec alignment"],
  "evidenceRefs": ["ev.diff.commands-blu-impact.001"]
}
```

Required finding rules:

- `id` must be stable for the same scope/config.
- `evidenceRefs` must be non-empty unless the finding is explicitly an unknown.
- Unknown findings must include the missing metadata source, why it matters, and how to resolve it.
- Findings must be sorted deterministically by status, severity, impacted area, check id, then id.
- Risk and confidence must be separate. High risk with low confidence is valid and useful.

Core V1 checks:

| Check | Required V1 Behavior |
|---|---|
| Changed files | Resolve staged, working tree, range, base/head, explicit files, diff file, CI refs, and description-only seeds. |
| Blueprint runtime surfaces | Detect changes to `commands/*.toml`, `docs/commands/**`, `docs/COMMAND-CATALOG.md`, `src/mcp/server.ts`, `src/mcp/tools/**`, `src/mcp/artifact-contracts/**`, `src/mcp/command-resources.ts`, `skills/**`, `agents/**`, `gemini-extension.json`, `tabnine-extension.json`, `hooks/**`, and `dist/**`. |
| Implemented-only routing | If a command is declared `implemented`, verify manifest, skill, and required MCP tools exist. Check that router/help/progress surfaces remain implemented-only. |
| Artifact contracts | Detect required heading changes, new report contracts, removed contracts, and migration risk. |
| Package/runtime | Detect `package.json`, `package-lock.json`, `tsconfig.json`, build script, Node engine, and dependency changes. |
| Tests | Map changed implementation surfaces to likely tests and required quality gates. Missing test map becomes warning, not false safety. |
| Ownership | Parse CODEOWNERS when present and optional `.blueprint/impact/ownership.json`. Missing owner on sensitive path can block. |
| Dependency graph | Support package-lock/package.json workspaces and TypeScript/JavaScript import scan fallback. Missing reverse graph becomes unknown. |
| Config/env/secrets | Report path/key-level config changes and secret-sensitive paths without reading secret values. |
| Docs obligations | Require docs updates for command, MCP, artifact, config, public behavior, and runtime-reference changes. |

Out of scope for V1:

- Posting or updating PR comments.
- Provider-specific PR fetching unless already available from local/CI refs.
- SBOM, SAST, DAST, policy-as-code integrations.
- Language-specific symbol-level dependency graphs beyond simple TS/JS import fallback.
- Automatic creation of Blueprint todos or roadmap phases from unknowns.

## Configuration

Recommended config precedence, highest first:

1. Invocation flags.
2. Explicit `--config <path>`.
3. `.blueprint/impact/config.json`.
4. Host-global defaults at `~/.<host>/blueprint/impact.defaults.json`.
5. Built-in safe defaults.

V1 should not use `.blueprint/config.json` as the main impact config because
Blueprint's current normalized config schema is intentionally strict. Impact
config should be loaded by `blueprint_impact_config_get` from the dedicated
impact locations above, while still reading regular Blueprint config through
existing tools when it needs base-branch or workflow hints.

Initial config shape:

```json
{
  "schemaVersion": "blueprint.impact.config.v1",
  "baseBranches": ["main", "master"],
  "paths": {
    "include": ["**/*"],
    "ignore": ["node_modules/**", "coverage/**"],
    "generated": ["dist/**", "**/*.generated.*"],
    "docs": ["docs/**", "**/*.md"],
    "tests": ["tests/**", "**/*.test.ts"]
  },
  "ownership": {
    "sources": ["CODEOWNERS", ".blueprint/impact/ownership.json"],
    "requiredOwnerMatch": false,
    "fallbackReviewers": []
  },
  "dependencyGraph": {
    "sources": ["package-json", "package-lock", "ts-import-scan"],
    "customGraphFiles": [".blueprint/impact/dependency-graph.json"],
    "requireReverseDepsFor": ["runtime", "contract", "security", "compliance"]
  },
  "risk": {
    "blockOnCritical": true,
    "blockOnBreakingContract": true,
    "blockOnSensitiveUnknownOwner": true,
    "warnBelowConfidence": 0.7,
    "blockBelowConfidenceForSensitiveAreas": 0.5
  },
  "reporting": {
    "defaultVerbosity": "normal",
    "writeEvidenceLog": true,
    "redactPathPatterns": ["**/secrets/**"]
  }
}
```

Config validation rules:

- Invalid schema version is an error.
- Paths escaping the repo root are errors.
- Unknown top-level keys warn by default and error with `--strict-config`.
- Missing impact config continues with safe defaults and emits a config-coverage warning.
- Sensitive paths excluded by ignore rules warn or block depending on risk settings.

## Phase Plan

Each phase below should be implemented and reviewed completely before the next
phase starts. Do not mark a phase complete because files exist; complete means
the phase acceptance criteria, tests, docs, and review gates are satisfied.

### Phase 0: Command-Surface Decision

Goal: Make it explicit that `/blu-impact` is being added beyond the original
53-command retained baseline.

Work:

- Update `docs/DECISIONS.md` with a new decision for `/blu-impact`.
- Update `docs/COMMAND-BASELINE.md` to list `/blu-impact` as an intentionally added Blueprint command, not a silently revived omitted command.
- Update `PROGRESS.md` and `MEMORY.md` to reflect the new planned command.
- Decide whether it belongs to Wave 4 quality/shipping or a new Impact/Advisory family. Recommended: Wave 4, family `Quality And Shipping`, risk `Low` for V1 because writes are bounded to `.blueprint/impact/`.

Acceptance:

- Docs explain why adding the command does not violate the strict omit policy.
- `/blu-impact` is not routable yet.
- Existing implemented-only routing tests still pass.

### Phase 1: Command Spec And Non-Routable Catalog Entry

Goal: Add the command contract without making it runnable.

Work:

- Add `docs/commands/impact.md` using `docs/commands/_template.md`.
- Add a planned or blocked row to `docs/COMMAND-CATALOG.md`.
- Include the final intended `## Required MCP Tools` list in the command spec.
- Document arguments, output artifacts, no-source-mutation policy, CI exits, and unknown-handling semantics.
- Do not add `commands/blu-impact.toml` yet unless the team intentionally wants live status to show `repairing`.
- Do not add `skills/blueprint-impact/SKILL.md` yet unless the team intentionally wants live status to show `repairing`.

Acceptance:

- `blueprint_command_catalog` keeps `/blu-impact` non-routable.
- Existing router/help/progress tests do not surface `/blu-impact`.
- The command spec is detailed enough for later implementation without relying on chat memory.

### Phase 2: MCP Tool Skeleton And Registration

Goal: Create the impact MCP family with empty-but-typed deterministic seams.

Work:

- Add `src/mcp/tools/impact.ts`.
- Define Zod input schemas and typed result objects for all six V1 tools.
- Register `impactToolDefinitions` in `src/mcp/server.ts`.
- Include impact tool names in the availability set used by `src/mcp/tools/project.ts`.
- Add minimal tests proving tools register, reject invalid inputs, and return safe placeholder warnings where appropriate.
- Rebuild `dist/`.

Acceptance:

- `npm run typecheck` passes.
- Tool names are present in `blueprintToolNames`.
- Tool handlers do not mutate anything except the future writer tool, which can initially be disabled or guarded.

### Phase 3: Config And Scope Resolution

Goal: Make `/blu-impact` useful for real diffs and safe for missing scope.

Work:

- Implement `blueprint_impact_config_get`.
- Implement `blueprint_impact_scope_resolve`.
- Support staged, working-tree, range, base/head, explicit files, diff file, CI refs, and description-only inputs.
- Compute deterministic `scopeFingerprint`.
- Record scope confidence and unresolved warnings.
- Enforce repo-relative path containment for explicit file and config inputs.

Acceptance:

- Tests cover staged diff, working tree, range, base/head, explicit files, diff file, no diff, non-git description-only, invalid path, and invalid config.
- Description-only scope returns low confidence and cannot be marked high-confidence `PASS`.
- No secret values or full file contents are included in scope output.

### Phase 4: Blueprint Context And Surface Classification

Goal: Classify changed files into actionable Blueprint and repo surfaces.

Work:

- Implement `blueprint_impact_context_load`.
- Load project status, effective Blueprint config, roadmap and phase context when requested, command catalog, package metadata, artifact contracts, and runtime tool registry metadata.
- Implement surface classification inside `blueprint_impact_analyze`.
- Classify Blueprint-specific runtime surfaces separately from generic source/docs/tests.

Acceptance:

- Tests classify command manifests, command docs, MCP tools, artifact contracts, skills, agents, extension manifests, hooks, tests, docs, package files, and generated `dist/**`.
- Missing optional context produces explicit warnings, not tool failure unless the input specifically required that context.

### Phase 5: Ownership And Dependency Analysis

Goal: Detect who needs to care and where reverse impact is known or unknown.

Work:

- Parse CODEOWNERS where present.
- Load optional `.blueprint/impact/ownership.json`.
- Support fallback reviewers only when configured.
- Build package/dependency hints from `package.json`, `package-lock.json`, workspaces where present, and TS/JS import scan fallback.
- Load optional `.blueprint/impact/dependency-graph.json`.
- Report graph coverage.

Acceptance:

- Missing ownership emits owner unknowns.
- Sensitive path with missing owner can produce `BLOCK` when configured.
- Missing reverse dependency graph emits `unknown.reverseDependencies`, not a limited-impact conclusion.
- Tests cover monorepo-style packages, missing ownership, missing graph, partial graph, and generated/source mixed changes.

### Phase 6: Contract And Obligation Checks

Goal: Turn changed surfaces into review, docs, test, compatibility, and runtime obligations.

Work:

- Check CLI contracts: `commands/*.toml`, `docs/commands/**`, `docs/COMMAND-CATALOG.md`.
- Check MCP contracts: registered tool names, input schema changes, output contract docs, server registration.
- Check artifact contracts: required headings, report contract additions/removals, template changes.
- Check skill and agent contracts.
- Check extension manifests and built `dist/` requirements.
- Infer docs, tests, release notes, migration, security, and deployment obligations from changed surfaces.

Acceptance:

- Implemented command missing manifest, primary skill, or required tools produces `BLOCK`.
- Planned command exposure in router/help/progress produces `BLOCK`.
- Runtime contract or command-doc changes produce docs/test obligations.
- Tests cover command manifest change, MCP tool change, artifact contract change, skill change, extension manifest change, and `dist/` stale/missing scenarios.

### Phase 7: Scoring And Report Model

Goal: Produce deterministic risk, confidence, status, and normalized report data.

Work:

- Implement scoring inside `blueprint_impact_analyze`.
- Separate severity, impact status, risk level, confidence score, and confidence level.
- Make unknowns lower confidence and optionally raise status based on config.
- Stabilize finding ids, evidence ids, and sorting.
- Produce a complete normalized report object for downstream writing/rendering.

Acceptance:

- Same seed/config/repo state produces same fingerprint, findings, status, and report JSON except explicit run metadata.
- Findings are stable and sorted.
- Tests cover `PASS`, `WARN`, `BLOCK`, low-confidence unknowns, and sensitive unknown blocking.

### Phase 8: Report Writing And Rendering

Goal: Persist useful reviewer artifacts and render compact output.

Work:

- Add `report.impact` to the artifact-contract registry.
- Implement `blueprint_impact_report_write`.
- Implement `blueprint_impact_output_render`.
- Write files atomically where possible under `.blueprint/impact/<impact-id>/`.
- Support `--no-write` by skipping the writer and rendering from the normalized report object.
- Support output modes: `human`, `json`, `markdown`, `pr-comment`, and `summary`.

Acceptance:

- Report writer refuses empty sections, unresolved placeholders, invalid JSON payloads, path escapes, and writes outside `.blueprint/impact/`.
- `IMPACT.md`, `impact.json`, and `summary.json` are always written when writing is enabled.
- Checklist/questions/evidence files are written only when relevant or configured.
- Golden snapshot tests confirm stable Markdown and JSON ordering.

### Phase 9: Skill And Command Manifest

Goal: Make `/blu-impact` runnable only after the substrate is ready.

Work:

- Add `skills/blueprint-impact/SKILL.md`.
- Add `commands/blu-impact.toml`.
- Ensure manifest references all required MCP tools through runtime FQNs.
- Update `docs/SKILLS-AND-AGENTS.md`, `docs/MCP-TOOLS.md`, `docs/RUNTIME-REFERENCE.md`, `docs/ARTIFACT-SCHEMA.md`, `README.md`, `PROGRESS.md`, and `MEMORY.md`.
- Flip `docs/COMMAND-CATALOG.md` status to `implemented` only after tests prove catalog alignment.

Acceptance:

- `blueprint_command_catalog().commands.impact.status === "implemented"`.
- `requiredToolsSatisfied === true`.
- Manifest, skill, command spec, runtime reference, and MCP docs agree.
- Router/help/progress expose `/blu-impact` only after implementation.

### Phase 10: Integration Fixtures And CI Coverage

Goal: Prove the workflow across realistic repo states.

Add fixtures under:

```text
tests/fixtures/impact/
```

Required fixture scenarios:

- clean repo / no diff
- staged diff
- working tree diff
- commit range
- explicit files
- description-only
- command manifest change
- MCP tool change
- artifact contract change
- skill change
- docs-only change
- package/config change
- security-sensitive path
- missing ownership
- missing dependency graph
- generated-only change
- generated plus source change

Acceptance:

- `npm run typecheck` passes.
- Targeted impact tests pass.
- Existing command-catalog, runtime-contract, metadata, artifact-contract, and built-assets tests pass.
- `npm run build` updates tracked `dist/` assets.

### Phase 11: Final Hardening And Release Readiness

Goal: Make the command useful enough for production review workflows.

Work:

- Run a real impact report on the `/blu-impact` implementation branch itself.
- Use the generated report to verify it catches command, MCP, docs, skill, tests, artifact-contract, package, and `dist/` impact.
- Tighten false-positive noise.
- Update docs with any intentional runtime deltas.

Acceptance:

- A self-impact run produces a rich, actionable report.
- No required section is boilerplate-only.
- All known unknowns have resolution guidance.
- The final command is valuable even when ownership/dependency metadata is incomplete.

## Implementation Orchestration Harness

This section defines the agent workflow for implementing the phases above. It
is intentionally strict to prevent shallow plans, incomplete implementation, or
"done because files exist" behavior.

### Roles

| Role | Responsibility | May Implement? |
|---|---|---|
| Orchestrator | Own sequencing, context handoff, gates, subagent lifecycle, integration, and final decision-making. | No, except when prescribed review/fix turns are exhausted. |
| Phase Planner | Plans exactly one phase from this document and live repo context. | No |
| Plan Quality Reviewer | Reviews the phase plan for enterprise-grade completeness, missing risks, shallow tasks, weak tests, and Blueprint drift. | No |
| Implementor | Implements the approved phase plan only. | Yes |
| DoD Reviewer | Checks phase acceptance criteria, docs alignment, routing safety, and completion evidence. | No |
| Code Reviewer | Reviews changed source/tests/docs for bugs, drift, maintainability, and missing tests. | No |
| Final E2E DoD Reviewer | Reviews all phases against this bible. | No |
| Final E2E Code Reviewer | Reviews integrated code and docs across the complete workflow. | No |
| Final Quality Checker | Reviews whether `/blu-impact` provides production-grade, high-value blast-radius output. | No |
| Final Test Reviewer | Reviews whether tests are meaningful, non-shallow, and cover the risky surfaces. | No |

### Per-Phase Algorithm

The orchestrator must run phases strictly in order.

For each phase:

1. Start a Phase Planner for only the current phase.
2. Wait for the planner result.
3. Close the Phase Planner immediately after collecting the plan.
4. Start a Plan Quality Reviewer with the plan, phase goal, and phase acceptance criteria.
5. Wait for the plan-quality review.
6. Close the Plan Quality Reviewer immediately after collecting the review.
7. If the plan quality reviewer finds issues, send the plan back through a single planner revision loop or revise the plan locally as orchestrator-owned planning. Do not implement until the plan is approved.
8. Start one Implementor with the approved plan and exact write scope.
9. Wait for implementation.
10. Close the Implementor immediately after collecting the result.
11. Start two reviewers in parallel:
    - DoD Reviewer
    - Code Reviewer
12. Wait for both reviewers.
13. Close both reviewers immediately after collecting their reviews.
14. If neither reviewer finds actionable issues, mark the phase complete and proceed to the next phase.
15. If either reviewer finds actionable issues, start a new Implementor with only those findings as scope.
16. Repeat review -> fix -> review for at most three review rounds per phase.
17. If actionable issues remain after three rounds, the Orchestrator may implement or repair directly, but must document:
    - which agent loop exhausted
    - which issues remained
    - exactly what the orchestrator changed
    - why the phase is now safe to close
18. Do not begin the next phase until the current phase passes DoD and code review or the orchestrator has explicitly resolved the exhausted-loop exception.

### Per-Phase Completion Checklist

A phase is complete only when all are true:

- The phase goal is satisfied.
- Every acceptance criterion in this document is satisfied or explicitly deferred with a reason.
- Required tests were added or updated.
- Targeted tests pass.
- Existing routing safety is preserved.
- No planned-only command is accidentally routable.
- No unreviewed TODO, placeholder, or scaffold-only content remains.
- Docs changed in the phase agree with command specs, skill docs, MCP docs, runtime reference, and tests.
- Built `dist/` assets are updated when runtime code changed.
- Review findings are closed or explicitly documented as deferred.

### Maximum Review/Fix Turns

Per phase:

```text
Round 1: implementation -> DoD review + code review
Round 2: fix implementation -> DoD review + code review
Round 3: fix implementation -> DoD review + code review
```

After round 3, no more subagent fix loops for that phase. The orchestrator must
resolve remaining issues directly or stop and escalate. This prevents infinite
review churn while preserving quality pressure.

### Final End-To-End Review Algorithm

After every phase is complete, the orchestrator must start four reviewers in
parallel:

1. End-to-End DoD Reviewer
2. End-to-End Code Reviewer
3. End-to-End Quality Checker
4. End-to-End Test Reviewer

Each reviewer receives:

- This document.
- The final diff.
- The command catalog output.
- The relevant test output.
- Any generated self-impact report from Phase 11.

After collecting reviews:

- Close all four reviewers promptly.
- If no actionable findings remain, the implementation can be considered complete.
- If findings remain, create a bounded final Implementor for only those findings.
- Re-run the relevant final reviewers.
- Use the same maximum of three global final review/fix rounds.
- If issues remain after three global rounds, the orchestrator may repair directly or stop and escalate.

## Anti-Shallow-Output Guardrails

These guardrails are for the future `/blu-impact` command and the LLM that
orchestrates it. They exist so the command cannot get away with filling headings
with generic content.

### Artifact Richness Rules

`IMPACT.md` must not pass validation if:

- Required headings are missing.
- A required section is empty.
- A required section contains only generic filler.
- Placeholder text such as `<owner>`, `<test command>`, `TBD`, `TODO`, or `N/A` appears without an explicit reason.
- A finding lacks evidence or an explicit unknown reason.
- Unknowns lack why-it-matters and resolution guidance.
- Required reviewers/tests/actions lack provenance or confidence.

When a section is genuinely not applicable, it must say why:

```text
No database impact detected because the resolved scope contains no configured
database, migration, schema, or persistence paths. Confidence: medium because no
custom database path map was configured.
```

### Evidence Density Rules

Every non-empty report should include:

- Scope provenance.
- Config provenance.
- At least one evidence record per finding.
- Explicit graph/ownership/test/compliance coverage notes.
- A statement of confidence drivers and confidence reducers.

Special case: a clean no-diff report may have no findings, but it must still
state the exact scope check that proved no changes were found.

### Unknown Handling Rules

Unknowns must be first-class report objects:

```json
{
  "id": "unknown.reverseDependencies.package-runtime.001",
  "source": "dependencyGraph",
  "reason": "No dependency graph source was configured or detected.",
  "whyItMatters": "Runtime package changes may affect downstream consumers.",
  "blocking": false,
  "suggestedResolution": "Add .blueprint/impact/dependency-graph.json or configure package graph source."
}
```

The report writer must never turn unknowns into passive prose only.

### Report Quality Gate

`blueprint_impact_report_write` should run a report-quality validator before
writing. The validator should return structured warnings or invalid status for:

- placeholder content
- missing evidence refs
- missing confidence explanation
- empty required sections
- ungrounded required tests/reviewers
- contradiction between status and findings
- `PASS` with blocking unknowns
- high confidence with missing scope proof

### Skill-Level Self-Check

Before ending, the `blueprint-impact` skill must perform a self-check:

- Did I call every required MCP tool in the prescribed order?
- Did I keep source/runtime/PR/deployment state read-only?
- Did I distinguish risk from confidence?
- Did I surface missing metadata as unknown, not safety?
- Did every finding have evidence or an explicit unknown reason?
- Did I avoid planned-only command recommendations?
- Did the final answer include artifact paths or explain `--no-write`?

If any answer is no, the skill must repair the report or stop with the blocker.

## Subagent Prompt Templates

Use these templates to keep implementation agents bounded.

### Phase Planner Prompt

```text
You are the Phase Planner for `/blu-impact`.

Plan only Phase <N>: <phase name> from docs/IMPACT-WORKFLOW-IMPLEMENTATION-PLAN.md.
Read the live repo context before planning. Do not implement.

Return:
- phase goal
- exact files likely to change
- ordered tasks
- tests to add/update
- docs to add/update
- routing/catalog risks
- acceptance checklist
- explicit non-goals
- likely failure modes
```

### Plan Quality Reviewer Prompt

```text
You are the Plan Quality Reviewer for `/blu-impact`.

Review the proposed Phase <N> plan for enterprise-grade completeness.
Be strict. Look for shallow tasks, missing tests, command-catalog drift,
artifact-contract drift, missing docs, unsafe routing assumptions, weak
acceptance criteria, and unbounded implementation scope.

Return:
- verdict: PASS or REVISE
- blocking plan issues
- non-blocking improvements
- missing tests
- missing docs
- exact plan edits required
```

### Implementor Prompt

```text
You are the Implementor for `/blu-impact` Phase <N>.

Implement only the approved plan. You are not alone in the codebase. Do not
revert changes made by others. Keep writes inside the approved file scope unless
the plan is impossible without a small, explained adjustment.

Return:
- files changed
- behavior implemented
- tests added/updated
- commands run and results
- deviations from plan
- remaining risks
```

### DoD Reviewer Prompt

```text
You are the DoD Reviewer for `/blu-impact` Phase <N>.

Check whether the implementation satisfies every acceptance criterion in
docs/IMPACT-WORKFLOW-IMPLEMENTATION-PLAN.md for this phase.

Return:
- verdict: PASS or FAIL
- missing acceptance criteria
- docs/catalog/runtime alignment issues
- routing safety issues
- required fixes
```

### Code Reviewer Prompt

```text
You are the Code Reviewer for `/blu-impact` Phase <N>.

Review changed files for bugs, security issues, TypeScript/runtime drift,
test gaps, brittle parsing, path-safety problems, and Blueprint convention
violations.

Return findings first, ordered by severity, with file/line references where
possible. If no issues, say so and list residual risk.
```

### Final Quality Checker Prompt

```text
You are the Final Quality Checker for `/blu-impact`.

Judge whether the completed command will provide immense practical value in a
large or regulated repo. Be strict about generic output, weak confidence models,
missing unknowns, shallow tests, and reports that look complete but are not
actionable.

Return:
- verdict: PASS or FAIL
- value gaps
- shallow-output risks
- production-readiness blockers
- concrete required fixes
```

## Done Means

The full `/blu-impact` workflow is done only when:

- `/blu-impact` is implemented in the live runtime catalog.
- All six impact MCP tools are registered and tested.
- The command manifest uses runtime FQNs and remains thin.
- The `blueprint-impact` skill contains the orchestration, uncertainty, and anti-shallow-output guardrails.
- Impact report artifacts are written only under `.blueprint/impact/<impact-id>/`.
- JSON report, summary, evidence, checklist, and questions payloads are deterministic and parseable.
- Router/help/progress implemented-only guarantees are preserved.
- Tests cover happy paths, missing metadata, risky Blueprint runtime changes, and shallow-output prevention.
- The implementation has passed final E2E DoD, E2E code review, quality, and test review.
