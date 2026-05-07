---
name: blueprint-impact
description: >
  Advisory blast-radius analysis and impact report orchestration for
  Blueprint. Use this skill to keep scope resolution, deterministic findings,
  risk, confidence, unknowns, report persistence, and rendering grounded in the
  impact MCP tool family.
status: implemented
commands:
  - /blu-impact
input_bundles:
  shared: []
  commands:
    "/blu-impact":
      - commands/blu-impact.toml
      - skills/blueprint-impact/references/impact-runtime-contract.md
---

# Blueprint Impact Skill

## Purpose

Orchestrate `/blu-impact` so every report is evidence-backed, uncertainty-aware,
and bounded to `.blueprint/impact/<impact-id>/` when writing is enabled.

## Shared Runtime Contract

- Execution profile: `long-running-mutation`
- Stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`, `Validate`, `Route`
- In-flight status fields: resolved scope, active stage, pending gate, execution mode, next safe action
- Keep the resolved scope, active stage, pending gate, execution mode, and next safe action visible while impact analysis is running.
- Load `references/impact-runtime-contract.md` as the detailed runtime contract for MCP call order, scope precedence, uncertainty handling, report authoring quality, no-write rendering, overwrite gates, and completion self-checks.

## Runtime Call Rules

- Call Blueprint MCP tools only through runtime FQNs such as `mcp_blueprint_blueprint_project_status`.
- Translate any shorthand tool ids like `blueprint_project_status` from older Blueprint docs into their runtime FQNs before calling them.
- Treat Blueprint skills as loaded guidance, not callable tools. Invoke optional subagents only when the current command contract explicitly allows them and effective config has `workflow.subagents=true`; otherwise use the command's no-subagent fallback and state config disabled subagents.
- Never run `/blu-*` in the shell. Blueprint slash commands are host CLI entrypoints, not shell executables.

## Runtime Inputs

Command-specific inputs come from the structured `input_bundles` frontmatter.
Runtime use is docs-free: `/blu-impact` loads the command manifest plus the
local impact runtime contract. Blueprint MCP tools, MCP resources, artifact
contracts, and live repo context provide the structured truth for catalog
status, command behavior, artifact shape, scope, risk, confidence, findings,
unknowns, and output paths.

## Required MCP Tools

- `blueprint_impact_config_get`
- `blueprint_impact_scope_resolve`
- `blueprint_impact_context_load`
- `blueprint_impact_analyze`
- `blueprint_impact_report_write`
- `blueprint_impact_output_render`

## Optional Agents

- none

## Workflow Rules

1. Resolve scope intent first. Explicit git, file, diff, and seed inputs outrank auto detection. Phase and roadmap item inputs select Blueprint context only and do not prove changed-file scope by themselves.
2. Load impact config through `mcp_blueprint_blueprint_impact_config_get` before scope analysis so ignore paths, ownership sources, graph sources, risk thresholds, and reporting preferences are explicit.
3. Resolve changed files through `mcp_blueprint_blueprint_impact_scope_resolve`. Description-only runs are allowed, but they stay low confidence and cannot become high-confidence `PASS`.
4. Load Blueprint and repo context through `mcp_blueprint_blueprint_impact_context_load`. Optional missing metadata becomes warnings or unknowns; it is never proof that owners, dependencies, compliance, or tests are unnecessary.
5. Analyze through `mcp_blueprint_blueprint_impact_analyze` and treat its status, risk, confidence, findings, obligations, unknowns, evidence, and normalized report as authoritative.
6. Use `mcp_blueprint_blueprint_impact_report_write` only when writing is enabled, passing the normalized report plus expected analyzer context from `blueprint_impact_analyze` (`expectedScopeFingerprint`, `expectedScopeSource`, `expectedScopeDescription`, `expectedFiles`, `expectedEvidenceIds`, `expectedEvidencePathsById`, `expectedFindingIds`, `expectedBlockingFindingIds`, and `expectedWarningFindingIds`). The writer owns `report.impact` JSON Schema validation, runtime narrowing, residual quality checks, canonical rendering, and reuse detection. Keep writes under `.blueprint/impact/<impact-id>/`, use returned paths as authoritative, and require explicit overwrite confirmation when a changed bundle already exists.
7. Use `mcp_blueprint_blueprint_impact_output_render` for the final human, JSON, Markdown, PR-comment, or summary output. `--no-write` renders from the in-memory report and must not create a bundle.
8. Keep `BLOCK` advisory. It means the report found blocking impact, not that the command may mutate source files, roadmap state, PR state, deployment state, command-catalog state, or the installed extension directory.
9. Preserve implemented-only routing in follow-up guidance. Prefer `/blu-progress` when the safest next command is ambiguous, and never present planned, blocked, or repairing commands as runnable.
10. Do not use subagents for V1 impact analysis. MCP tools own deterministic scope, findings, risk, confidence, status, and output paths.

## Completion Self-Check

Before claiming a `/blu-impact` run is complete, verify these `## Self-Check`
invariants from the active impact contract:

- The `/blu-impact` manifest and `references/impact-runtime-contract.md` were loaded as the active contract; no sibling or planned command reference was treated as active input.
- Required impact MCP calls used runtime FQNs and followed the impact contract order: config, scope, context, analysis, optional write, render, or stopped at the exact MCP-returned reason.
- Persistence, when enabled, happened only through `mcp_blueprint_blueprint_impact_report_write`; returned `status`, `written`, `created`, `updated`, reuse fields, artifact `path` values, validation, warnings, and reasons were treated as authoritative.
- Any existing changed bundle paused for explicit overwrite confirmation before retrying with overwrite enabled.
- Invalid config, unresolved scope, report validation failure, tool rejection, or model-check failure was repaired once through MCP-owned inputs or reported honestly; partial, skipped, blocked, or `--no-write` output was not described as persisted success.
- Missing metadata is surfaced as unknown or warning, not as safety; every non-unknown finding or obligation has MCP evidence refs or an explicit unknown reason.
- `.blueprint/impact/<impact-id>/` was the only write boundary; source files, roadmap or phase state, command catalog, PR or deployment state, runtime files, installed extension directories, and planned-only surfaces stayed unchanged.
- Final routing named only implemented Blueprint commands and used `/blu-progress` when the safe next action was ambiguous or not implemented.
- The final response reported impact status, risk, confidence, artifact paths or explicit no-write status, warnings, blockers, unknowns, and the next safe implemented action from rendered MCP output.

## Output Style

- Lead with impact status, risk, confidence, and resolved scope.
- List the most important blocking findings, warnings, unknowns, required reviewers, required tests, and next actions from MCP output.
- Keep prose concise; the persisted `IMPACT.md`, `impact.json`, and `summary.json` carry the durable detail.
