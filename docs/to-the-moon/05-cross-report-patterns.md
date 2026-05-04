# Cross-Report Pattern Synthesis

Subagent E synthesis for the rakole/blueprint top-5 improvement discovery run.

Scope note: this report synthesizes only the executive summaries, evidence tables/findings, and recommendations from reports 01-04. Source-code references below are cited through those reports unless explicitly noted otherwise. No fixes were implemented.

## Cross-Report Executive Summary

All four reports agree that Blueprint's core architecture is directionally strong: implemented-only routing is a real guardrail, MCP owns much of the durable state surface, command/skill/agent contracts exist, and the local test suite is much stronger than a typical early extension project. The dominant improvement theme is therefore not "invent the architecture"; it is "make the architecture executable, generated, and enforced."

The repeated risk is drift between layers that currently describe the same truth in different forms: command prompts, skills, runtime references, docs, tests, source metadata, MCP resources, and public README/help surfaces. Report 01 frames this as prompt-behavior drift without an eval harness. Report 02 frames it as incomplete deterministic state and docs/runtime authority ambiguity. Report 03 frames it as public UX and command-status drift. Report 04 frames it as release confidence that depends on local convention rather than CI policy.

The highest compound opportunities are:

1. Enforce release gates and prompt/runtime contract checks in CI.
2. Turn prompt behavior into tested artifacts, not only prose.
3. Harden MCP state persistence and validation under parallel/resumable execution.
4. Generate public command/help/reference surfaces from canonical runtime metadata.
5. Normalize high-risk command safety with typed confirmation and clearer user-facing grouping.

## Repeated Themes

### 1. Drift Is The Central Product Risk

Supporting reports:

- `docs/to-the-moon/01-llm-workflow-prompt-research.md` identifies duplicated prompt-layer rules across commands, skills, runtime references, and tests, plus stale `AGENTS.md` current-phase lists around `impact`.
- `docs/to-the-moon/02-mcp-state-artifact-audit.md` finds runtime resources still parse Markdown docs even though `docs/RUNTIME-REFERENCE.md` says docs are control-plane history rather than runtime inputs.
- `docs/to-the-moon/03-command-skill-agent-ux-audit.md` finds visible public/status drift in `/blu-do`, README, architecture docs, implementation-order docs, and command examples.
- `docs/to-the-moon/04-code-tests-release-audit.md` finds broad regex metadata coverage but too little golden prompt/runtime-contract coverage to prove coherent end-to-end command packets.

Important cited surfaces:

- `/blu-do` is documented as runnable/root-routable in `docs/commands/do.md` while catalog/progress/runtime paths keep it planned and non-routable.
- `AGENTS.md` omits shipped `impact` in current-phase command lists while `docs/COMMAND-CATALOG.md`, `PROGRESS.md`, and `docs/RUNTIME-REFERENCE.md` mark it implemented.
- README and architecture docs contain stale or representative command/path claims that conflict with source-owned runtime metadata.

Pattern: Blueprint has many truth-bearing layers. The next improvement wave should reduce hand-maintained parallel truth, then test the remaining boundaries.

### 2. Strong Static Contracts Need Behavioral Evals

Supporting reports:

- Report 01 says static metadata tests catch missing manifests/tools but not LLM behavior drift: wrong tool choice, skipped confirmation, incomplete subagent handoff, over-reading sibling contracts, or overclaiming completion.
- Report 04 says command/prompt drift coverage is broad but regex-heavy, with no uniform golden corpus for command prompt manifests, generated artifact templates, or command-visible copy.
- Report 03 shows why this matters to users: high-overlap commands such as `fast`, `quick`, and `debug` have confusing or copied boilerplate even when the section scaffolding exists.

Important cited surfaces:

- `tests/extension-runtime-contracts.test.ts` checks manifest FQNs, tool registration, and raw-name drift but not expected model transcripts or tool-call sequences.
- `docs/TEST-STRATEGY.md` calls for per-command fixture suites, but report 04 found a large share of command coverage remains metadata/regex style.
- Report 01 recommends 10-15 golden scenarios for router, plan-phase, execute-phase, cleanup, ship, code-review-fix, and impact.

Pattern: prompt modules should become versioned operational assets with golden behavior tests, not only Markdown/TOML strings checked for keywords.

### 3. MCP Is The Right Spine, But State-Engine Properties Are Uneven

Supporting reports:

- Report 02 says MCP owns many mutations and validations, but global validation, atomic persistence, locking, state typing, and schema versioning are incomplete.
- Report 01 recommends typed confirmation and subagent handoff packets so model-facing orchestration can become more machine-checkable.
- Report 04 flags high-complexity MCP modules as release-risk concentrators: `phase.ts`, `artifacts.ts`, `review.ts`, `impact.ts`, `workspace.ts`, and `command-runtime-metadata.ts`.

Important cited surfaces:

- `blueprint_artifact_validate` skips some managed artifact classes such as context, discussion log, UI spec, review artifacts, and several report surfaces.
- Many shared writers use direct `fs.writeFile`; repo locks exist but are used on only a subset of read-modify-write flows.
- `STATE.md` is Markdown with arbitrary string fields and no clear schema version.
- Unknown report names can pass through generic report write paths with effectively optional schema enforcement.

Pattern: the top state improvement is not "add MCP tools"; it is to make existing MCP writes atomic, serialized where needed, schema-versioned, and registry-validated.

### 4. Safety Gates Are Present But Too Prose-Mediated

Supporting reports:

- Report 01 says high-risk confirmations rely mostly on prompt text or host-specific `ask_user` behavior rather than a typed, cross-host runtime primitive.
- Report 03 says confirmation gates are scattered across README, per-command specs, and router logic, and high-risk commands are visually mixed with lower-risk quality commands.
- Report 02 shows deterministic state and logging gaps that make safety gates harder to audit after the fact.

Important cited surfaces:

- `commands/blu-cleanup.toml` and `skills/blueprint-maintenance/SKILL.md` rely on explicit user asking or stopping if confirmation is unavailable.
- `src/mcp/tools/config.ts` includes `ux.structured_confirmations`, but report 01 found no general MCP elicitation layer.
- README groups review, docs, tests, PR branch, ship, undo, workspace, update, cleanup, and patch replay in one broad quality/maintenance area.

Pattern: keep prompt-visible safety language, but add a reusable confirmation data shape and a user-facing safety matrix by command family.

### 5. Release Confidence Exists Locally, Not Institutionally

Supporting reports:

- Report 04 passed the full non-Docker suite: 906 tests, 0 failures.
- The same report found no GitHub Actions workflow, no aggregate `verify` script, no lint/format/coverage gate, no test typecheck, no dependency automation, and active audit debt.
- Reports 01-03 all propose checks that would need CI to stay fixed: prompt evals, generated docs/catalogs, context-file drift checks, docs/runtime parsing tests, and confirmation matrix checks.

Important cited surfaces:

- `npm audit --omit=dev --json` showed a production moderate vulnerability through `@modelcontextprotocol/sdk -> hono`.
- Full `npm audit --json` also showed dev/testcontainers vulnerability debt including a critical `protobufjs` advisory.
- Git-installed hosts launch checked-in `dist/`, so build/dist freshness must be release-gated.

Pattern: many recommended improvements become durable only if CI enforces them. The orchestrator should treat CI as the multiplier for every other top-5 item.

## Contradictions Or Tensions Between Reports

1. **"Docs are control-plane history" vs docs parsed at runtime.**
   Report 02 directly identifies a runtime authority contradiction: runtime code still parses `docs/COMMAND-CATALOG.md`, command specs, and `docs/RUNTIME-REFERENCE.md` rows even though docs describe themselves as non-runtime truth.

2. **"Commands are thin" vs large manifest prompts.**
   AGENTS and architecture rules say commands should stay thin and user-facing. Report 01 finds many command manifests are large and duplicate skill/runtime-contract logic, with 20 command manifests above 700 words.

3. **"Implemented-only routing is strong" vs public docs make planned commands look runnable.**
   Reports 01 and 03 both praise implemented-only routing. Report 03 then shows `/blu-do` docs and public README/status language can still mislead users or agents before they reach the runtime catalog.

4. **"MCP is deterministic state engine" vs incomplete atomicity/versioning/validation.**
   Report 02 says MCP is the right persistence spine, but deterministic-state-engine quality is only partial until validation covers all managed artifacts and writes are atomic/serialized.

5. **"Excellent local tests" vs no enforced release policy.**
   Report 04 shows strong local tests and a clean 906-test run. It also shows there is no CI, no aggregate verify gate, and active vulnerability debt, so the pass is not institutional release confidence.

6. **"Flexible generic reports" vs contract-backed artifacts.**
   Report 02 labels generic report writes as potentially intentional, but this flexibility conflicts with Blueprint's broader deterministic artifact-contract story.

## Hidden Dependencies Between Improvements

1. **Prompt-behavior evals depend on canonical command packets.**
   Golden tool-call scenarios will be brittle until the command manifest, skill, runtime-contract resource, and source metadata boundaries are clearer.

2. **Generated public docs depend on runtime authority cleanup.**
   A generated README/help/catalog can eliminate drift only after Blueprint decides whether source metadata, docs tables, or MCP resources are canonical for command availability and command facts.

3. **Subagent reliability depends on write-boundary and persistence hardening.**
   Handoff packet schemas help parent prompts delegate safely, but parallel subagents still need atomic writes, locks, and clear ownership for `.blueprint/` artifacts.

4. **Typed confirmations depend on host-fallback semantics.**
   A reusable confirmation contract needs accept/decline/cancel states, destructive-surface metadata, and a clear fallback when Gemini/Tabnine host affordances differ.

5. **State migration depends on schema-version policy.**
   Tightening `STATE.md`, report contracts, and artifact validation requires knowing whether an artifact is old-but-valid, needs migration, or is malformed.

6. **Monolith extraction depends on characterization coverage.**
   Report 04 correctly warns not to refactor high-complexity MCP modules first. Add coverage and contract tests before splitting `phase.ts`, `artifacts.ts`, `review.ts`, `impact.ts`, or `workspace.ts`.

7. **Every durable fix depends on CI.**
   Drift checks, generated docs, prompt snapshots, audit policy, dist freshness, schema freshness, and host smoke only matter if they run automatically before release.

## Compound Opportunities For Top-5 Ranking

### Opportunity 1: Release Gate Baseline

Bundle:

- `npm run verify` with typecheck, test, production audit, and build/dist/schema freshness.
- GitHub Actions PR CI.
- Dependency automation and explicit audit policy.
- Later: lint, format check, test typecheck, coverage, scheduled host install smoke.

Why it compounds: this converts existing local confidence into enforced release confidence and creates a place to run the other drift/eval checks.

Primary reports: 04, reinforced by 01, 02, and 03.

### Opportunity 2: Prompt And Runtime Contract Eval Harness

Bundle:

- Golden scenarios for high-risk and high-frequency commands.
- Expected MCP tool-call order, forbidden calls, confirmation behavior, subagent delegation decisions, and final response shape.
- Snapshot/golden tests for rendered command/runtime-contract packets.
- Prompt size, referenced-tool, gate, and sibling-contract leakage checks.

Why it compounds: this directly addresses LLM behavior drift, regex-heavy tests, bloated command prompts, and command UX inconsistencies.

Primary reports: 01 and 04, reinforced by 03.

### Opportunity 3: Canonical Command Truth And Generated Public Docs

Bundle:

- Resolve `/blu-do` planned/runnable contradiction.
- Fix `AGENTS.md` `impact` drift and missing `docs/DRIFT.MD` read-order drift.
- Decide docs/runtime authority and remove or formalize Markdown runtime parsing.
- Generate README/help/catalog command tables from canonical runtime metadata.
- Add command chooser table with writes and confirmation risk.

Why it compounds: it collapses user confusion, agent context drift, and runtime-resource ambiguity into one source-of-truth initiative.

Primary reports: 03 and 02, reinforced by 01 and 04.

### Opportunity 4: MCP State Engine Hardening

Bundle:

- Registry-backed artifact validation across all managed artifact classes.
- Atomic temp-write-plus-rename persistence.
- Repo/path-scoped locks for read-modify-write `.blueprint/` mutations.
- Versioned `STATE.md` or structured JSON canonical state.
- Report contract tightening and schema-version policy.

Why it compounds: it protects parallel/resumable workflows, makes validation trustworthy, and gives future migrations a deterministic footing.

Primary report: 02, reinforced by 04 and 01.

### Opportunity 5: High-Risk Command Safety Normalization

Bundle:

- Typed confirmation contract with gate id, action, destructive surface, files/commands, accept/decline/cancel, and host fallback.
- Confirmation matrix for cleanup, ship, undo, workspace, patch replay, overwrite, and force paths.
- README/help regrouping to separate quality evidence, release/git, workspace, and maintenance.
- Optional diagnostic trace/request id for routing and confirmation decisions.

Why it compounds: it turns scattered safety prose into auditable behavior and makes destructive command risk visible before users choose a command.

Primary reports: 01 and 03, reinforced by 02 and 04.

### Opportunity 6: Lightweight Execution UX Cleanup

Bundle:

- Clarify `fast`, `quick`, and `debug` as a triage ladder.
- Replace generic examples with realistic task-bearing examples.
- Remove copied capture boilerplate from non-capture command docs.
- Promote `/blu-next` and the phase lifecycle map for work that exceeds quick/fast scope.

Why it compounds: lower effort than the infrastructure work, and likely high frequency for day-to-day users.

Primary report: 03, reinforced by 01 and 04.

## Recommended Synthesis For The Orchestrator

Recommended top-5 ranking:

1. **Enforced release and verification gates.**
   Start with CI, `npm run verify`, production audit, test/typecheck, and dist/schema freshness. This gives every later fix a durable enforcement lane.

2. **Prompt-behavior and runtime-contract eval harness.**
   Add golden command scenarios and rendered contract snapshots for router, plan/execute/validate, cleanup, ship, code-review-fix, impact, and fast/quick/debug.

3. **Canonical command truth plus generated user-facing docs.**
   Resolve `/blu-do`, `impact`, README, architecture, implementation-order, and docs/runtime authority drift. Generate command availability/help tables from the chosen canonical metadata.

4. **MCP state-engine hardening.**
   Make artifact validation registry-backed, writes atomic and locked where needed, state versioned/typed, and report schemas explicit.

5. **High-risk command safety normalization.**
   Create typed confirmations and a safety matrix, then reflect that matrix in README/help and high-risk command specs.

Runner-up: lightweight execution UX cleanup for `fast`, `quick`, and `debug`. It is probably the best small win, but the top five above are more compound and reduce repeated drift classes across reports.

Suggested sequencing:

1. Land CI/verify first so later discovery-to-fix work has a guardrail.
2. In parallel, define canonical command truth and prompt/runtime packet formats, because both unblock generated docs and prompt evals.
3. Harden MCP writes/validation before scaling parallel subagent or resumable workflows further.
4. Add typed confirmation after command truth and state persistence semantics are stable enough to audit.
5. Use the generated docs/help pass to absorb the lightweight UX cleanup.

## Commands Run And Failures

Commands run:

- `cat AGENTS.md` from `/Users/rhishi/dev/repositories/blueprint-top5-20260504-194251`.
- `rg -n "^(#|##|###) |Executive Summary|Evidence|Recommendations|Recommendation" docs/to-the-moon/01-llm-workflow-prompt-research.md`.
- `rg -n "^(#|##|###) |Executive Summary|Evidence|Recommendations|Recommendation" docs/to-the-moon/02-mcp-state-artifact-audit.md`.
- `rg -n "^(#|##|###) |Executive Summary|Evidence|Recommendations|Recommendation" docs/to-the-moon/03-command-skill-agent-ux-audit.md`.
- `rg -n "^(#|##|###) |Executive Summary|Evidence|Recommendations|Recommendation" docs/to-the-moon/04-code-tests-release-audit.md`.
- `sed -n '5,70p' docs/to-the-moon/01-llm-workflow-prompt-research.md`.
- `sed -n '9,70p' docs/to-the-moon/02-mcp-state-artifact-audit.md`.
- `sed -n '9,171p' docs/to-the-moon/03-command-skill-agent-ux-audit.md`.
- `sed -n '7,185p' docs/to-the-moon/04-code-tests-release-audit.md`.
- `ls docs/to-the-moon`.

Failures: none.

Not run: tests, build, package installation, source search beyond the four assigned reports, or any command that mutates `.blueprint/`, source files, installed extension directories, host-global state, or other agents' report files.
