# `/blu-impact` Runtime Contract

This reference is the rich behavior contract for `/blu-impact`. The command
manifest should stay thin; the skill should load this file so blast-radius
analysis stays evidence-backed, uncertainty-aware, and MCP-owned.

## Stage Mapping

### Resolve

- Parse description text, explicit scope flags, output mode, write mode, CI
  policy inputs, phase targets, roadmap item targets, metadata flags, config
  paths, seed paths, and diff-file paths.
- Prefer explicit scope inputs over auto detection.
- Treat phase and roadmap item inputs as context targets, not changed-file
  proof.
- Keep resolved scope intent, active stage, pending gate, execution mode, and
  next safe action visible.

### Read

- Call `mcp_blueprint_blueprint_impact_config_get` before scope-sensitive
  analysis so ignore paths, generated paths, ownership sources, dependency
  graph sources, risk thresholds, and reporting preferences are explicit.
- Call `mcp_blueprint_blueprint_impact_scope_resolve` to produce changed files,
  git metadata, diff stats, patch hash, scope fingerprint, confidence, and
  unresolved-scope warnings.
- Call `mcp_blueprint_blueprint_impact_context_load` for project status,
  effective Blueprint config, roadmap, requested phase or roadmap targets,
  command catalog/assets, artifact contracts, runtime metadata, and repo hints.
- Do not read secret values or full file contents for scope output. Secret-like
  reporting stays at path, key, and provenance level.

### Decide

- If config is invalid, stop before analysis and do not write report artifacts.
- If scope cannot be resolved and no description was supplied, stop with
  recovery guidance for staged, working-tree, range, files, diff-file, seed, or
  description inputs.
- Description-only scope is allowed only as low-confidence advisory planning.
- Missing ownership, reverse dependency, compliance, test, or optional context
  metadata becomes explicit warnings or unknowns; never phrase it as proof of
  limited impact.
- Keep `PASS`, `WARN`, and `BLOCK` as advisory analysis statuses. Local runs do
  not fail automatically on `BLOCK`; CI policy failure is controlled by
  explicit CI/fail-on inputs.

### Execute

- Call `mcp_blueprint_blueprint_impact_analyze` with the effective config,
  resolved scope, loaded context, description, and invocation metadata.
- Treat returned findings, obligations, unknowns, evidence, impact status,
  risk, confidence, scoring metadata, and normalized report as authoritative.
- Do not synthesize deterministic findings outside MCP output. Narrative
  summaries may group or abbreviate the returned facts, but they must not
  invent certainty.

### Persist

- If `--no-write` is active, skip report writing and move directly to render.
- Otherwise call `mcp_blueprint_blueprint_impact_report_write` with the
  normalized report.
- Persist only under `.blueprint/impact/<impact-id>/`.
- Existing identical bundles may be reused. Existing changed bundles require
  explicit overwrite confirmation before retrying with overwrite enabled.
- Do not hand-write `IMPACT.md`, `impact.json`, `summary.json`,
  `evidence.jsonl`, `review-checklist.md`, or `QUESTIONS.md`.

### Validate

- Report writer validation is authoritative for `blueprint.impact.report.v1`
  structure, required Markdown sections, placeholder rejection, evidence refs,
  confidence explanation, reviewer/test/action provenance, and status
  consistency.
- If report writing returns invalid, repair the report model through the
  analysis or rendering inputs if possible and retry once through MCP. Do not
  bypass the failed write with raw filesystem edits.
- Verify the final response still distinguishes risk from confidence and keeps
  unknowns first-class.

### Route

- Call `mcp_blueprint_blueprint_impact_output_render` for final output from
  the saved impact id or in-memory report.
- Route only to implemented commands. Use `/blu-progress` when the safe next
  action is broad or ambiguous.
- Do not present planned, blocked, or repairing commands as runnable.

## Required MCP Calls

Call these in order unless an earlier invalid result requires stopping:

1. `mcp_blueprint_blueprint_impact_config_get`
2. `mcp_blueprint_blueprint_impact_scope_resolve`
3. `mcp_blueprint_blueprint_impact_context_load`
4. `mcp_blueprint_blueprint_impact_analyze`
5. `mcp_blueprint_blueprint_impact_report_write` when writing is enabled
6. `mcp_blueprint_blueprint_impact_output_render`

## Scope Rules

- Supported scope inputs: staged diff, working tree diff, commit range,
  base/head refs, explicit files, diff file, seed file, CI refs, and
  description-only planning.
- Auto detection prefers staged changes, then working tree changes, then branch
  diff against configured or detected base branch, then CI refs, then
  description-only low-confidence advisory scope.
- Explicit paths must stay repo-contained.
- Conflicting explicit scopes should be clarified before analysis instead of
  silently selecting one.

## Report Quality Rules

- Required `IMPACT.md` sections must be populated with evidence-backed content
  or a concrete reason the section is not applicable.
- Placeholder text such as `<owner>`, `<test command>`, `TBD`, `TODO`, or
  unexplained `N/A` is invalid.
- Every non-unknown finding and obligation needs evidence refs.
- Unknowns must include why the missing metadata matters and how to resolve it.
- High risk with low confidence is valid and should stay visible.
- `PASS` is invalid when blocking unknowns remain or file-backed scope proof is
  missing.

## No-Subagent Contract

V1 has no optional subagent path. The parent command may summarize returned
MCP facts, but deterministic scope, findings, risk, confidence, status, and
output paths belong to MCP tools.

## Retry And Repair Behavior

- Invalid config or seed: stop before analysis and report the validation
  errors.
- Unresolved scope with no description: stop with scope recovery guidance.
- Partial optional context: continue with warnings and unknowns unless the
  requested context target itself failed.
- Existing changed report bundle: ask for overwrite confirmation before retry.
- Invalid report payload: repair once through MCP-owned report inputs and retry.
- Tool/runtime error: stop without partial hand-written artifacts.

## Output Quality Criteria

- The user can see scope provenance, status, risk, confidence, top impacted
  areas, required reviewers, required tests, blocking findings, warnings,
  unknowns, and suggested next actions.
- Missing metadata is explicit and actionable.
- Artifact paths are included when writing succeeds.
- `--no-write` output clearly says no bundle was written.
- Follow-up routing remains inside implemented commands.

## Completion Criteria

- Config, scope, context, analysis, optional report write, and rendering all
  completed or stopped with the precise MCP reason.
- Persistent writes, when enabled, were bounded to `.blueprint/impact/<impact-id>/`.
- No source, roadmap, phase-state, command-catalog, PR, deployment, or
  installed-extension mutation occurred.
- The final answer passes the skill self-check and names any unresolved
  blockers or unknowns.
