# Top 5 Improvements for Blueprint

## Executive Summary

- Blueprint's architecture is strong; the biggest risk is that its truths are duplicated across docs, prompts, skills, MCP metadata, and tests.
- The fastest compounding win is to make command availability, help, README tables, and runtime contract facts generated from one canonical source.
- The most important LLM-quality win is a prompt/tool-call eval harness that tests behavior, not just manifest metadata.
- MCP is the right state spine, but it needs full-surface validation, atomic writes, locks, and schema versioning to earn the "deterministic state engine" promise.
- Release confidence should move from local convention to CI-enforced gates, including build, typecheck, tests, audit policy, and generated-asset freshness.

## Ranked Top 5

### 1. Canonical Command Truth And Intent-First Help

**Problem**

Blueprint describes command availability and command behavior in too many places: command TOML, skills, command specs, README, command catalog, runtime metadata, runtime resources, progress docs, architecture docs, and durable agent context. Those layers are useful, but today they drift.

**Why it matters**

Blueprint's first promise is trust: users should know what to run, what it will read, what it will write, and whether it is safe. If public docs or durable context imply a planned command is runnable, or omit an implemented command, agents and users can choose the wrong workflow before the runtime catalog protects them.

**Evidence from repo**

- `/blu-do` is declared planned in `docs/COMMAND-CATALOG.md` and non-routable in `PROGRESS.md`, but `docs/commands/do.md` marks it root-routable and shows runnable examples.
- `AGENTS.md` omits shipped `/blu-impact` even though `docs/COMMAND-CATALOG.md`, `PROGRESS.md`, and `docs/RUNTIME-REFERENCE.md` mark it implemented.
- README says unlisted commands are not public, while its runtime layout is representative and omits later shipped commands.
- `docs/ARCHITECTURE.md` and `docs/IMPLEMENTATION-ORDER.md` contain stale path/status claims around Wave 5 and skill/command layout.
- Runtime resources still parse Markdown docs in places, even though `docs/RUNTIME-REFERENCE.md` says docs are control-plane history.

**Evidence from external research**

- Gemini CLI extensions expose custom commands through extension `commands/` files and surface descriptions in help, so command metadata quality directly affects discoverability: [Gemini CLI Extensions](https://google-gemini.github.io/gemini-cli/docs/extensions/) and [Custom Commands](https://google-gemini.github.io/gemini-cli/docs/cli/custom-commands.html).
- Claude Code skill docs emphasize concise descriptions, invocation control, and discoverability; overloaded or stale descriptions degrade routing and user choice: [Claude Code Skills](https://docs.claude.com/en/docs/claude-code/skills).

**Recommended change**

Choose one canonical command metadata source, then generate every user-facing command table and runtime help projection from it. Combine that with an intent-first command chooser so users can pick by goal rather than internal wave/family history.

**Concrete implementation sketch**

- Make `src/mcp/command-runtime-metadata.ts` or a generated source artifact the canonical command packet.
- Generate README command tables, `docs/COMMAND-CATALOG.md`, help/progress excerpts, and command availability snapshots from that packet.
- Mark planned commands like `/blu-do` with an unmistakable non-routable banner or move them out of user-facing command docs until shipped.
- Add a compact "I want to..." table: goal, first command, reads, writes, confirmation risk.
- Add a drift test that fails if README/help/catalog/spec availability diverges from canonical metadata.

**Expected user benefit**

Users get a clearer first run: "I want to plan a phase" maps to the right command, artifact, and safety posture without reading maintainer history.

**Expected engineering benefit**

Fewer hand-edited status tables, fewer agent-context repairs, and clearer ownership for command facts.

**Risk if ignored**

Blueprint can keep passing runtime tests while public docs and durable prompt context mislead users into planned or stale workflows.

**Effort:** Medium

**Confidence:** High

**Related files**

- `AGENTS.md`
- `README.md`
- `docs/COMMAND-CATALOG.md`
- `docs/RUNTIME-REFERENCE.md`
- `docs/commands/do.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION-ORDER.md`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/project.ts`
- `src/mcp/command-resources.ts`

**Suggested acceptance criteria**

- One source owns command status, command family, required manifest, primary skill, required MCP tools, confirmation risk, reads, and writes.
- `/blu`, `/blu-help`, `/blu-progress`, and README all exclude planned-only commands unless explicitly labeled as unavailable.
- `/blu-impact` and all implemented commands appear consistently in generated durable context/help surfaces.
- The README has a one-screen command chooser before the full command list.
- `docs/DRIFT.MD` read-order drift is resolved or the read order is updated.

**Suggested tests or evals**

- Snapshot generated command catalog/help/README command tables.
- Contract test that every implemented command has one canonical packet and every planned command is non-routable.
- Fixture test for `/blu-do`: root router must not recommend it while status is planned.
- Drift test comparing `AGENTS.md` current-command list or generated context block against runtime metadata.

### 2. Prompt And Tool-Call Behavior Eval Harness

**Problem**

Blueprint has strong static contract tests, but they mostly prove that manifests, skills, tools, and keywords exist. They do not prove that a model follows the intended workflow: load the right contract, call the right MCP tools in the right order, refuse unsafe steps, delegate with complete handoff context, or avoid claiming completion from prose alone.

**Why it matters**

Blueprint is an LLM workflow product. The failure mode that hurts users most is not only a missing file; it is a plausible-looking assistant that skips a gate, writes the wrong artifact, overuses tools, delegates vaguely, or says a phase is done when deterministic state was never updated.

**Evidence from repo**

- `package.json` has build/typecheck/test scripts but no eval harness.
- `tests/extension-runtime-contracts.test.ts` checks manifest FQNs, tool registration, and raw-name drift, not model transcripts or expected tool-call sequences.
- Report A found 20 command manifests above 700 words, with long prompts duplicating skill/runtime-contract logic.
- Report D found broad regex metadata tests but no uniform golden corpus for rendered command prompts, artifact templates, or command-visible copy.

**Evidence from external research**

- OpenAI's agent eval guidance calls out instruction following, tool selection, tool argument precision, and multi-agent handoff accuracy as evaluation targets: [OpenAI Evaluation Best Practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices) and [Agent Evals](https://developers.openai.com/api/docs/guides/agent-evals).
- OpenAI prompt guidance recommends prompt versioning and rerunning linked evals when publishing prompt changes: [OpenAI Prompting](https://developers.openai.com/api/docs/guides/prompting).
- Anthropic's agent guidance favors simple, composable workflows and clear boundaries between workflows and autonomous agents: [Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents).

**Recommended change**

Create a small, deterministic command-behavior eval harness before slimming prompts. It should use fixture user intents, mocked MCP responses, expected tool-call sequences, forbidden calls, confirmation outcomes, and final-response requirements.

**Concrete implementation sketch**

- Add `tests/fixtures/prompt-evals/<command>/<scenario>.json`.
- Define scenario fields: user request, command entrypoint, starting `.blueprint/` fixture, mocked MCP tool results, expected calls, forbidden calls, required stop conditions, and final response assertions.
- Start with 10-15 scenarios for router, `plan-phase`, `execute-phase`, `validate-phase`, `cleanup`, `ship`, `code-review-fix`, `impact`, `fast`, `quick`, and `debug`.
- Add normalized snapshot tests for rendered command manifest + skill + runtime-contract packets.
- Track prompt size, referenced tools, high-risk gates, examples, and sibling-contract leakage in a generated report.

**Expected user benefit**

Fewer surprising assistant behaviors. Users can trust that commands route, stop, confirm, and summarize in the intended way.

**Expected engineering benefit**

Prompt edits become reviewable diffs with behavior regression tests. It becomes safe to slim the largest command manifests without weakening the workflows.

**Risk if ignored**

Blueprint may accumulate more prompt prose and regex tests while the actual model behavior remains unmeasured.

**Effort:** Large

**Confidence:** High

**Related files**

- `commands/blu-*.toml`
- `skills/*/SKILL.md`
- `agents/*.md`
- `tests/extension-runtime-contracts.test.ts`
- `tests/fixtures/`
- `docs/TEST-STRATEGY.md`

**Suggested acceptance criteria**

- At least 10 high-value command scenarios run in CI.
- Evals assert tool order, forbidden writes, confirmation behavior, and final response shape.
- Rendered prompt/runtime-contract snapshots exist for each implemented command family.
- Prompt changes require intentional fixture or snapshot updates.
- Largest command manifests have measurable size/context budgets before refactoring begins.

**Suggested tests or evals**

- Router eval: planned command requested, router explains unavailable status and recommends implemented alternative.
- Ship eval: refuses without explicit confirmation and required evidence artifacts.
- Cleanup eval: previews destructive scope before approval and stops when confirmation is unavailable.
- Execute eval: delegates only with disjoint write ownership and complete handoff packet.
- Code-review-fix eval: refuses to invent findings when saved review artifacts are missing.

### 3. MCP State Engine Hardening

**Problem**

MCP owns much of Blueprint's durable state, but deterministic-state-engine qualities are uneven. Some managed artifacts are not covered by global validation, many write paths are direct `fs.writeFile`, only some read-modify-write flows use locks, and `STATE.md` is unversioned Markdown with loose string fields.

**Why it matters**

Blueprint's product promise depends on `.blueprint/` being more trustworthy than chat memory. That means writes must be atomic, validations must cover all managed artifacts, concurrent agents should not race, and future schema changes need migration semantics.

**Evidence from repo**

- `blueprint_artifact_validate` validates only a subset of `.blueprint/` artifacts and skips surfaces such as context, discussion log, UI spec, review artifacts, and several report classes.
- Shared writers in `src/mcp/tools/artifacts.ts` use direct `fs.writeFile`; repo locks are used only on a subset of flows.
- `STATE.md` accepts arbitrary string patches and has no explicit schema version.
- Generic report writes can accept unknown report names with optional schema enforcement.
- Failure logging is useful but best-effort and status-list dependent.

**Evidence from external research**

- MCP defines tools, resources, and prompts as schema-driven primitives, with tools using JSON Schema and resources requiring URI validation and access controls: [MCP Architecture](https://modelcontextprotocol.io/docs/learn) and [MCP Server Concepts](https://modelcontextprotocol.io/docs/learn/server-concepts).
- MCP tool annotations include read-only, destructive, idempotent, and open-world hints, which are useful risk vocabulary for stateful tools: [MCP Tool Annotations](https://modelcontextprotocol.io/specification/2025-06-18/schema).

**Recommended change**

Turn the existing MCP state layer into a stricter artifact registry and transactional persistence layer.

**Concrete implementation sketch**

- Expand `blueprint_artifact_validate` to iterate a known registry of all managed artifact classes.
- Make shared text/json writes atomic: write temp file, fsync where practical, then rename.
- Apply repo-scoped or path-scoped locks to all `.blueprint/` read-modify-write mutations.
- Add schema version policy for `STATE.md`, phase artifacts, report artifacts, review artifacts, impact bundles, and global registries.
- Move canonical state to structured JSON with Markdown as a rendered view, or add a JSON sidecar with strict runtime validation.
- Return explicit warnings for intentionally generic/unsupported artifacts instead of silently accepting them.

**Expected user benefit**

More reliable pause/resume, parallel workstreams, validation, and recovery after interrupted commands.

**Expected engineering benefit**

Cleaner migration path, fewer race-condition defects, more meaningful health checks, and safer future expansion of subagent execution.

**Risk if ignored**

Blueprint can preserve the appearance of durable state while allowing partial writes, stale artifacts, skipped validation, or untyped state drift.

**Effort:** Large

**Confidence:** High

**Related files**

- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/state.ts`
- `src/mcp/tools/phase.ts`
- `src/mcp/tools/review.ts`
- `src/mcp/tools/workspace.ts`
- `src/mcp/artifact-contracts/index.ts`
- `src/mcp/artifact-contracts/schemas/`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`

**Suggested acceptance criteria**

- Global artifact validation covers every Blueprint-managed artifact class or reports unsupported classes explicitly.
- All shared `.blueprint/` writes are atomic.
- All read-modify-write flows use a consistent lock policy.
- `STATE.md` or its canonical replacement has a schema version and constrained command/status vocabulary.
- Unknown report names are blocked or returned as explicit generic-report warnings.

**Suggested tests or evals**

- Validation fixture with intentionally malformed `*-CONTEXT.md`, `*-DISCUSSION-LOG.md`, `*-UI-SPEC.md`, review, and report artifacts.
- Concurrent write simulation that proves locks prevent lost updates.
- Interrupted write simulation that proves no partial file is accepted.
- Migration fixture for old state schema.
- Health test that reports generic or unsupported artifacts separately from valid managed artifacts.

### 4. Typed Safety Gates And Subagent Handoff Contracts

**Problem**

Blueprint has strong safety language, but high-risk confirmations and subagent handoffs remain mostly prose-mediated. Commands such as `cleanup`, `ship`, `undo`, workspace mutation, patch replay, overwrite, and force flows need consistent machine-checkable approval state. Subagents also need typed handoff packets rather than only narrative instructions.

**Why it matters**

High-risk workflows should be auditable before and after the model acts. Parallel subagents should receive precise scope, ownership, stop conditions, and verification expectations. Otherwise, safety depends on every prompt writer remembering the same details.

**Evidence from repo**

- `commands/blu-cleanup.toml` and `skills/blueprint-maintenance/SKILL.md` rely on host `ask_user` or stopping when confirmation is unavailable.
- `src/mcp/tools/config.ts` includes `ux.structured_confirmations`, but Report A found no general MCP elicitation/confirmation layer.
- README and command specs scatter confirmation language across high-risk families.
- `agents/blueprint-executor.md` requires explicit write ownership, but command manifests do not define a required parent-to-agent handoff schema.
- `tests/agent-schema.test.ts` verifies agent metadata/body markers, not per-command delegation packet completeness.

**Evidence from external research**

- MCP prompts are intended to be user-controlled and structured; MCP elicitation supports accept/decline/cancel-style user input through schema-mediated client interaction: [MCP Prompts](https://modelcontextprotocol.io/docs/concepts/prompts).
- Claude Code subagents run in separate contexts with specific tool access and independent permissions; clear descriptions and boundaries improve delegation reliability: [Claude Code Subagents](https://docs.claude.com/en/docs/claude-code/subagents).
- OpenAI eval guidance treats multi-agent handoffs as a distinct nondeterminism source that should be evaluated.

**Recommended change**

Define reusable runtime contracts for high-risk confirmation gates and subagent handoffs, then make commands and tests use them.

**Concrete implementation sketch**

- Add a confirmation packet shape: `gateId`, `command`, `action`, `riskLevel`, `destructiveSurface`, `files`, `commands`, `previewSummary`, `accepted|declined|cancelled`, `hostFallback`, `timestamp`.
- Add a command safety matrix: commands, risk class, required preview, required confirmation, allowed fallback, resulting artifact/log.
- Add handoff packet templates for executor, reviewer, debugger, researcher, UI/security auditor, and doc writer agents.
- Require parent prompts to pass `phase`, `artifact ids`, `read-first docs`, `write boundary`, `forbidden surfaces`, `verification command`, `stop conditions`, and summary schema.
- Add behavior evals that fail when a high-risk command proceeds without a typed confirmation or a subagent is launched without the packet.

**Expected user benefit**

Users see a predictable preview-confirm-act flow for risky operations and get fewer vague subagent outcomes.

**Expected engineering benefit**

Safety policy becomes testable and reusable instead of copied across prompts and docs.

**Risk if ignored**

High-risk flows will keep relying on prompt discipline, and parallel subagent work will be harder to audit or resume safely.

**Effort:** Medium to Large

**Confidence:** Medium-High

**Related files**

- `commands/blu-cleanup.toml`
- `commands/blu-ship.toml`
- `commands/blu-undo.toml`
- `commands/blu-new-workspace.toml`
- `commands/blu-remove-workspace.toml`
- `commands/blu-reapply-patches.toml`
- `skills/blueprint-maintenance/SKILL.md`
- `agents/*.md`
- `tests/agent-schema.test.ts`
- `src/mcp/tools/config.ts`

**Suggested acceptance criteria**

- Every high-risk command declares a safety packet and confirmation fallback.
- README/help displays high-risk commands separately from low-risk quality commands.
- Every subagent-capable command has a documented and tested handoff packet.
- Commands refuse to proceed when required confirmation or handoff fields are unavailable.
- Safety outcomes are included in durable reports or diagnostic state where appropriate.

**Suggested tests or evals**

- Cleanup declined confirmation: no cleanup write occurs, final response explains next safe action.
- Ship without confirmation: blocked.
- Workspace removal with missing preview: blocked.
- Executor subagent without write boundary: blocked before delegation.
- Reviewer/debugger handoff missing expected output schema: blocked or repaired before launch.

### 5. CI-Enforced Release And Verification Gates

**Problem**

Blueprint's local verification suite is strong, but release confidence is not enforced. There is no visible GitHub Actions workflow, no aggregate `verify` script, no lint/format/coverage gate, no test typecheck, and active dependency audit debt.

**Why it matters**

Blueprint is installed as a Gemini/Tabnine extension and hosts launch built `dist/` assets. A local green test run is not enough if stale bundles, dependency vulnerabilities, prompt drift, or schema drift can merge unnoticed.

**Evidence from repo**

- Subagent D ran `npm ci`, `npm run build`, `npm run typecheck`, and `npm test`; all passed, with 906/906 tests passing.
- `npm audit --omit=dev --json` failed on a production moderate `hono` advisory through `@modelcontextprotocol/sdk`.
- Full `npm audit --json` found 5 vulnerabilities, including dev/testcontainers critical `protobufjs`.
- No `.github/` workflow files or aggregate `verify` script were found.
- `tsconfig.json` typechecks `src/**/*.ts` but not tests.
- Docker/Testcontainers host install smoke exists but is opt-in and was skipped for this discovery pass.

**Evidence from external research**

- Gemini CLI extensions installed from GitHub are copied into extension directories and need update/restart behavior, which makes release-shape and built-asset freshness important: [Gemini CLI Extensions](https://google-gemini.github.io/gemini-cli/docs/extensions/).
- OpenAI prompt guidance recommends rerunning linked evals on prompt publication; for Blueprint, CI is the practical place to enforce that.

**Recommended change**

Add a project-level verification lane and CI workflow that enforces the checks Blueprint already expects maintainers to run locally, then grow it into prompt/runtime/schema/release freshness enforcement.

**Concrete implementation sketch**

- Add `npm run verify`: `npm run typecheck`, `npm test`, production audit, and build freshness.
- Add PR CI on Node 20: `npm ci`, `npm run verify`.
- Add dist/schema freshness checks after build: fail if generated tracked assets differ.
- Add dependency automation and an audit exception policy with expiry dates.
- Add `typecheck:tests`, lint/format check, and coverage thresholds for high-risk MCP modules.
- Add scheduled or release-branch Docker integration smoke for Gemini/Tabnine install shape.

**Expected user benefit**

Fewer broken installs, stale extension bundles, and shipped regressions.

**Expected engineering benefit**

Every future improvement has an enforcement lane. Prompt evals, generated docs, schema checks, and audit policy become durable rather than best-effort.

**Risk if ignored**

The repo can have excellent tests but still merge changes that nobody ran, ship stale `dist/`, or normalize known dependency vulnerabilities.

**Effort:** Medium

**Confidence:** High

**Related files**

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `dist/`
- `gemini-extension.json`
- `tabnine-extension.json`
- `scripts/build.mjs`
- `tests/extension-install.integration.ts`
- `tests/built-assets-smoke.test.ts`
- `tests/built-schema-assets.test.ts`

**Suggested acceptance criteria**

- CI runs on pull requests with Node 20 and `npm ci`.
- `npm run verify` exists and passes locally.
- Production audit gate blocks moderate+ production vulnerabilities or requires explicit exception.
- Build/dist/schema freshness is enforced.
- Test files are typechecked.
- Scheduled/release integration smoke exists for host install shape.

**Suggested tests or evals**

- CI dry run proves `npm run verify` catches a stale `dist/` change.
- Audit fixture or policy check fails on unapproved production vulnerabilities.
- `tsconfig.test.json` catches a type error in a test fixture.
- Scheduled integration job reports host install smoke result separately from PR-fast checks.

## Near Misses

- **Clean `fast`, `quick`, and `debug` UX.** Very high value for a small task, but narrower than canonical command truth. It should be included in the first docs/help pass.
- **Expand artifact validation alone.** Important enough to be folded into MCP state hardening, but not broad enough as a standalone top-five item.
- **Atomic persistence alone.** Critical for parallel runs, but it belongs with validation, locks, and schema versioning.
- **Dependency automation alone.** Necessary, but it is part of release gates rather than a separate strategic pillar.
- **Refactor large MCP modules.** Files like `phase.ts`, `artifacts.ts`, `review.ts`, and `impact.ts` are large, but refactoring before characterization coverage would create risk without enough user-visible payoff.
- **More examples in every command doc.** Useful, especially for onboarding, but generated command truth plus prompt evals should come first.

## Suggested Implementation Order

1. First quick win: repair `/blu-do`, `AGENTS.md` `impact` drift, missing `docs/DRIFT.MD` read-order drift, and obvious README status/path drift.
2. Second quick win: add the README/help intent chooser and split high-risk maintenance commands out of the crowded quality/shipping section.
3. First structural improvement: decide canonical command metadata ownership and generate command tables/help/catalog projections from it.
4. First test/eval improvement: add the first 10 prompt/tool-call behavior eval fixtures and rendered prompt/runtime-contract snapshots.
5. Bigger product/architecture improvement: harden MCP state persistence and validation, then introduce typed confirmations and subagent handoff packets.

## One-Page Roadmap

**Week 1**

- Fix the obvious command-status drift: `/blu-do`, `/blu-impact`, stale README/path/status claims, and missing `docs/DRIFT.MD` reference.
- Add `npm run verify` and a first PR CI workflow with `npm ci`, typecheck, tests, production audit, and build freshness.
- Draft the command safety matrix and README intent chooser.

**Week 2**

- Choose canonical command metadata ownership.
- Generate command catalog/help/README command tables from canonical metadata.
- Add drift tests for command availability and user-facing command tables.
- Add first prompt/runtime-contract snapshots.

**Week 3 to 4**

- Add prompt/tool-call eval fixtures for router, plan/execute/validate, cleanup, ship, code-review-fix, impact, fast/quick/debug.
- Start MCP validation expansion across context, discussion log, UI spec, review, report, and impact artifacts.
- Introduce atomic shared writers and lock policy for `.blueprint/` read-modify-write paths.

**Later**

- Add schema-version/migration policy for state and model-authored artifacts.
- Add typed confirmation packets and host fallback behavior.
- Add subagent handoff packet enforcement.
- Add lint/format/test-typecheck/coverage gates and scheduled Docker host install smoke.
- Refactor high-complexity MCP modules only after characterization coverage is in place.

## Appendix

- [01-llm-workflow-prompt-research.md](01-llm-workflow-prompt-research.md)
- [02-mcp-state-artifact-audit.md](02-mcp-state-artifact-audit.md)
- [03-command-skill-agent-ux-audit.md](03-command-skill-agent-ux-audit.md)
- [04-code-tests-release-audit.md](04-code-tests-release-audit.md)
- [05-cross-report-patterns.md](05-cross-report-patterns.md)
- [06-prioritization-matrix.md](06-prioritization-matrix.md)
- [RUN-LOG.md](RUN-LOG.md)
- [RESEARCH-INDEX.md](RESEARCH-INDEX.md)

