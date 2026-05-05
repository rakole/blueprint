# Architecture, Tests, and Product Hardening Report

## Executive Summary

Blueprint is already past the "does this architecture make sense?" stage. The main architecture is sound: command prompts stay thin in principle, skills orchestrate, MCP owns deterministic state, `.blueprint/` is the durable project memory, and implemented-only routing is a real guardrail. The hardening work now is about making that trust durable enough for an open-source Gemini CLI extension.

The highest-impact risks are concentrated in five areas:

- Release confidence is lower than the green unit suite suggests: `npm test` passed 906/906 tests, but clean-home and extension-install smoke paths failed, and there is no repo-owned CI workflow.
- Runtime truth is spread across typed metadata, Markdown tables, TOML manifests, skill docs, command specs, and parsed runtime-reference docs.
- MCP is the right state spine, but persistence, locking, schema versioning, and validation are not uniform across `.blueprint/` artifacts.
- Prompt and high-risk command behavior are mostly protected by static regex/metadata tests, not by behavior evals or host-command journey tests.
- The public README and OSS surface expose power before adoption: 53 implemented commands, little demo proof, incomplete contribution/release/security signals, and too much rollout language.

The theme: Blueprint should move from "well-documented contracts" to "generated, versioned, tested contracts." That makes it more reliable for users, easier to maintain for contributors, and safer to release.

## Top 5 Hardening Improvements

### 1. Establish Release Gates And CI As The Trust Floor

**Problem**

The local unit suite is strong, but release/install verification is red and not enforced by CI. A Git-installed CLI extension can pass local MCP tests while still failing the actual host install or clean-home path.

**Evidence**

- `npm ci` passed, but reported 5 vulnerabilities: 4 moderate and 1 critical.
- `npm run build` passed.
- `npm run typecheck` passed.
- `npm test` passed 906/906 tests.
- `npm run smoke:gemini-clean-home` failed after `gemini extensions validate` and `link` succeeded because `gemini extensions list --output-format json` did not return a JSON array in the non-TTY run.
- `npm run test:integration:extension` failed: Gemini link smoke failed at `tests/extension-install.integration.ts:500`, install mode timed out at 900s, and Tabnine was skipped because `BLUEPRINT_TABNINE_CLI_INSTALL_COMMAND` was unset.
- `.github/` is absent, so no repo-owned CI workflow currently enforces `npm ci`, build, typecheck, tests, smoke, integration, or audit policy.

**Why It Matters**

Blueprint is installed from GitHub and host manifests launch checked-in `dist/mcp/server.js`. Users need confidence that the release artifact, not just the TypeScript source, works in a fresh host. A green local suite is not enough if install smoke fails and no automated gate blocks release.

**Proposed Design**

- Add `npm run verify` for the fast local trust floor: build, typecheck, tests, production audit, and generated asset freshness.
- Add GitHub Actions PR CI for Node 20 with `npm ci`, `npm run verify`, and artifact freshness checks.
- Split host smoke into separate scripts:
  - `test:host:gemini-link`
  - `test:host:gemini-install`
  - `test:host:gemini-live`
  - `test:host:tabnine-link`
- Put short per-command host CLI timeouts inside the integration runner instead of relying on one 900s parent timeout.
- Make Docker/live-host smoke a release or scheduled gate once stabilized.
- Add dependency audit policy with explicit exception files and expiry dates.

**Files Likely Involved**

- `package.json`
- `.github/workflows/ci.yml`
- `.github/workflows/release-smoke.yml`
- `tests/extension-install.integration.ts`
- `scripts/gemini-clean-home-smoke.mjs`
- `scripts/build.mjs`
- `package-lock.json`
- `gemini-extension.json`
- `tabnine-extension.json`

**Acceptance Criteria**

- `npm run verify` exists and passes locally in a clean checkout.
- PR CI runs `npm ci`, build, typecheck, tests, production audit policy, and generated asset freshness checks.
- Host smoke failures produce captured stdout/stderr artifacts.
- Link, install, and live prompt smoke failures are isolated from each other.
- Release notes or release checklist require passing host smoke before publishing.
- Critical production dependency vulnerabilities block release, and dev criticals are either fixed or explicitly waived with expiry.

**Tests Required**

- CI workflow dry run or PR run.
- Unit test for script timeout/error capture helper if extracted.
- Integration tests split by host mode.
- Audit-policy test or script fixture proving allowlisted advisories expire.
- Dist/schema freshness check after build.

**Effort**

Medium for CI and script split. Large if stabilizing host install requires upstream Gemini CLI behavior work.

**Confidence**

High.

### 2. Make Command And Runtime Truth Source-Owned And Generated

**Problem**

Command availability and command behavior are described in too many places: typed runtime metadata, `docs/COMMAND-CATALOG.md`, `PROGRESS.md`, `docs/RUNTIME-REFERENCE.md`, command TOML, command specs, skills, README, and tests. Some runtime code still parses Markdown docs as input.

**Evidence**

- `blueprint_command_catalog` currently reports 54 retained catalog entries: 53 implemented and one non-implemented `/blu-do` entry.
- Manifest/catalog scans found required MCP FQNs aligned today, which is good, but the substrate still relies on multiple authority layers.
- `src/mcp/tools/project.ts` reads and parses `docs/COMMAND-CATALOG.md`.
- `src/mcp/tools/project.ts` and `src/mcp/command-resources.ts` parse command spec Markdown sections.
- `src/mcp/command-resources.ts` reads and parses `docs/RUNTIME-REFERENCE.md`, then overlays runtime-owned metadata.
- Stale prose still calls implemented commands planned, for example `/blu-update`, `/blu-workstreams`, `new-workspace`, `remove-workspace`, and `reapply-patches` in some maintenance/migration docs.
- Risk ratings drift between `docs/COMMAND-CATALOG.md` and `PROGRESS.md` for `verify-work`, `fast`, and `explore`.
- README lists `skills/blueprint-router.md`, but the real skill path is `skills/blueprint-router/SKILL.md`.

**Why It Matters**

Implemented-only routing is one of Blueprint's most important trust promises. If command truth remains hand-maintained across docs and runtime inputs, future changes can pass tests while confusing users, contributors, and agents. The runtime should not be sensitive to Markdown table formatting.

**Proposed Design**

- Promote a typed command registry as the single runtime authority for:
  - command status
  - risk
  - family
  - manifest path
  - primary skill
  - required MCP tools
  - optional agents
  - reads/writes
  - confirmation gates
  - runtime resource payload
- Generate `docs/COMMAND-CATALOG.md`, public command reference tables, runtime-reference rows, and README command tables from that registry.
- Keep Markdown command specs as human docs, not runtime input.
- If doc parsing must remain during migration, isolate all Markdown parsers behind one compatibility package with fixtures and deprecation warnings.
- Track implementation status separately from behavior-audit status.

**Files Likely Involved**

- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/project.ts`
- `src/mcp/command-resources.ts`
- `src/mcp/skill-metadata.ts`
- `src/mcp/runtime-vocabulary.ts`
- `docs/COMMAND-CATALOG.md`
- `docs/RUNTIME-REFERENCE.md`
- `PROGRESS.md`
- `README.md`
- `commands/blu*.toml`
- `skills/*/SKILL.md`
- `tests/command-contract-docs.test.ts`
- `tests/extension-runtime-contracts.test.ts`

**Acceptance Criteria**

- Live command catalog no longer depends on parsing `docs/COMMAND-CATALOG.md`.
- Runtime command resources are generated from typed metadata plus known command assets, not parsed Markdown tables.
- Generated docs show the same status, risk, tools, skill, and write surfaces as the live catalog.
- `/blu-do` is clearly planned/non-routable everywhere until implemented.
- A stale-status check fails when active docs call an implemented command planned or not routable.
- A risk parity check covers runtime metadata, generated catalog, and generated progress/reference docs.

**Tests Required**

- Command registry snapshot test.
- Generated doc freshness test.
- Stale planned/reference prose test with archive allowlist.
- Runtime resource fixture test for source-owned commands and doc-backed compatibility commands.
- README path-existence test for backticked repo paths in runtime layout sections.

**Effort**

Large.

**Confidence**

High.

### 3. Harden MCP State With Transactions, Locks, And Versioned Artifacts

**Problem**

MCP owns durable state, but state-engine properties are uneven. Some write paths are direct file writes, locks are used in only a subset of read-modify-write flows, Markdown artifact versioning is partial, and validation does not cover every managed artifact class.

**Evidence**

- High-complexity modules concentrate ownership:
  - `src/mcp/tools/phase.ts`: 12,098 lines
  - `src/mcp/tools/artifacts.ts`: 11,839 lines
  - `src/mcp/tools/review.ts`: 8,908 lines
  - `src/mcp/tools/impact.ts`: 8,341 lines
  - `src/mcp/artifact-contracts/index.ts`: 4,954 lines
  - `src/mcp/command-runtime-metadata.ts`: 3,004 lines
- Shared writers in `src/mcp/tools/artifacts.ts` use direct `fs.writeFile` for text/json.
- A repo lock exists, but current usage is concentrated around `roadmap-add-phase` and `phase-plan-write`.
- `blueprint_state_update` and `blueprint_state_sync` read/derive/write `STATE.md` without the shared lock.
- Config has a versioned schema, impact has stronger schema-version handling, and some model contracts expose `schemaVersion`, but `STATE.md` and many Markdown artifacts lack durable schema markers.
- Generic report writes can accept arbitrary non-empty content for unknown report names, which weakens the artifact-contract story.
- `docs/ARTIFACT-SCHEMA.md` omits shipped schema-backed contracts for `review.review-fix` and `report.audit-fix`.

**Why It Matters**

Blueprint's product promise is that `.blueprint/` is more trustworthy than chat memory. That promise depends on atomic writes, clear migrations, consistent validation, and safe concurrency when multiple agents or interrupted commands touch the same state.

**Proposed Design**

- Add an artifact registry with owner tool, path pattern, schema version, validator, renderer, migration handler, and lock policy.
- Make shared text/json persistence atomic: temp file, write, fsync where practical, rename.
- Require path-scoped or repo-scoped locks for every `.blueprint/` read-modify-write mutation.
- Add explicit schema markers or JSON sidecars for Markdown-owned artifacts, starting with `STATE.md`, roadmap, phase artifacts, reviews, reports, checkpoints, workstreams, and global registries.
- Add migration tooling:
  - read-only `assess_migrations`
  - explicit write-mode `apply_migrations`
  - project status exposes `migration: current | needed | unsupported`
- Tighten report writes so unknown report names are either rejected or returned as an explicit generic-report class with warnings.

**Files Likely Involved**

- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/phase.ts`
- `src/mcp/tools/state.ts`
- `src/mcp/tools/review.ts`
- `src/mcp/tools/workspace.ts`
- `src/mcp/tools/config.ts`
- `src/mcp/tools/impact.ts`
- `src/mcp/artifact-contracts/index.ts`
- `src/shared/security.ts`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `tests/artifact-contracts.test.ts`
- `tests/artifact-validate-runtime.test.ts`
- `tests/mcp-write-failure-logging.test.ts`

**Acceptance Criteria**

- All shared `.blueprint/` writes are atomic.
- All read-modify-write tools declare and use a lock policy.
- Concurrent write tests cannot lose updates for state, roadmap, capture indexes, reports, summaries, and checkpoints.
- `blueprint_artifact_validate` reports coverage for all managed artifact classes, including review-fix and audit-fix contracts.
- `blueprint_project_status` reports migration posture.
- Unknown report writes are either blocked or visibly classified as generic with warnings and inventory separation.

**Tests Required**

- Concurrent mutation tests for `STATE.md`, roadmap, todos/backlog, phase summaries, reports, and checkpoints.
- Crash/interrupted temp-file tests.
- Artifact registry coverage test.
- Migration assessment fixtures for old, current, malformed, and unsupported artifacts.
- Report-name registry tests.
- Golden render/parse round-trip tests for every contract consumer.

**Effort**

Large.

**Confidence**

High.

### 4. Add Behavior Evals For Prompt, Tool-Call, And High-Risk Command Flows

**Problem**

Blueprint has many contract tests, but too many are raw-text regex checks over prompts, docs, and metadata. They do not prove that an agent follows the workflow: read the right context, call tools in order, stop at missing prerequisites, honor confirmations, avoid generic agents, and report state from MCP returns.

**Evidence**

- No uniform `prompt-eval`, `golden`, or `snapshot` test category exists.
- `rg -n "golden|snapshot" tests` found only narrow output-ordering coverage, not a command-prompt corpus.
- Command manifest tests often read TOML as raw text and assert regexes.
- `package.json` has no TOML parser or manifest-schema validation dependency.
- High-risk command tests for `ship`, `undo`, maintenance, and workspace flows strongly check guardrail text and report contracts, but not realistic LLM-orchestrated behavior.
- `docs/RUNTIME-REFERENCE.md` still marks several implemented commands as `needs-behavior-audit`.

**Why It Matters**

Blueprint is an LLM workflow product. The worst user failures are plausible-looking assistant failures: skipping a gate, inventing state, persisting Markdown fallback when model-only is required, using the wrong tool, or claiming completion without MCP-owned evidence.

**Proposed Design**

- Add structural golden packets for each implemented command family:
  - manifest path
  - primary skill
  - effective skill input bundle
  - required MCP FQNs
  - optional agents
  - confirmation gates
  - persistence tools
  - forbidden tool classes
  - final response obligations
- Add behavior eval fixtures for high-frequency and high-risk commands:
  - `/blu`
  - `/blu-help`
  - `/blu-next`
  - `/blu-plan-phase`
  - `/blu-execute-phase`
  - `/blu-validate-phase`
  - `/blu-code-review-fix`
  - `/blu-cleanup`
  - `/blu-ship`
  - `/blu-undo`
  - `/blu-impact`
- Add a parser-backed manifest schema test for all `commands/blu*.toml`.
- Add full schema validation for skill frontmatter and `input_bundles`.
- Label existing text tests as "contract text drift" so they are not mistaken for behavior coverage.

**Files Likely Involved**

- `commands/blu*.toml`
- `skills/*/SKILL.md`
- `skills/*/references/*.md`
- `agents/*.md`
- `tests/fixtures/prompt-evals/**`
- `tests/fixtures/command-packets/**`
- `tests/extension-runtime-contracts.test.ts`
- `tests/command-contract-docs.test.ts`
- `tests/*metadata.test.ts`
- `docs/TEST-STRATEGY.md`

**Acceptance Criteria**

- Every implemented command family has a structural golden packet.
- At least 10 behavior eval scenarios assert expected MCP tool order, forbidden calls, confirmation outcomes, and final response requirements.
- Command TOML files parse and validate against a schema.
- Skill frontmatter/input bundles parse and validate against a schema.
- High-risk maintenance commands have behavior simulations for dirty tree, confirmation denial, missing host tooling, report-before-mutate, and post-mutation report updates.

**Tests Required**

- Prompt/runtime packet golden tests.
- Behavior eval fixture runner with mocked MCP returns.
- TOML manifest schema tests.
- Skill frontmatter/input bundle schema tests.
- High-risk command scenario tests.
- Regression eval for planned command request: `/blu-do` must remain non-routable while planned.

**Effort**

Large.

**Confidence**

High.

### 5. Repackage The Public Product Surface For Adoption

**Problem**

Blueprint has strong capabilities, but the public README and OSS surface make a new user work too hard. It leads with wave/runtime history, exposes 53 commands before a beginner ladder, lacks a 60-second demo, does not clearly answer common alternatives, and is missing root-level OSS trust files.

**Evidence**

- README quickly shifts from a strong value prop into "Wave 0", "Phase 3 discovery", "parity closeout", and runtime layout internals.
- README exposes long command lists before showing realistic output.
- The best demo idea, `/blu-impact --staged`, appears in presentation material but not as a public quick demo.
- README does not directly answer "why not a todo list, issue tracker, CI, or just an agent prompt?"
- No root-level `LICENSE`, `CONTRIBUTING`, `CHANGELOG`, `SECURITY`, `CODE_OF_CONDUCT`, or release policy was found in a depth-limited search.
- `package.json`, `gemini-extension.json`, and `tabnine-extension.json` are all versioned `0.1.0`, but there is no public release/versioning story.
- Help/progress/next routing is a product strength, but README does not show example output for those commands.

**Why It Matters**

Open-source adoption depends on fast comprehension and trust. Blueprint's current docs prove breadth, but new users need a narrow path: what it is, why it exists, how to try it, what files it writes, how safe it is, and how to contribute.

**Proposed Design**

- Rewrite README opening around the product value:
  - "Blueprint makes AI coding work visible, resumable, and reviewable by storing plans, evidence, validation, and next actions in `.blueprint/`."
- Add "See it in 60 seconds" using `/blu-impact --staged`.
- Add a "Use this first" command ladder:
  - `/blu`
  - `/blu-help`
  - `/blu-map-codebase`
  - `/blu-new-project`
  - `/blu-next`
  - `/blu-impact --staged`
  - `/blu-quick "..."`
- Split command docs into "Start", "Plan/Build/Verify", "Capture", "Quality Evidence", "Git/Release", and "Workspace/Maintenance".
- Add "Why not just..." positioning.
- Add real examples under `docs/examples/`.
- Add OSS trust files and a release/versioning policy.

**Files Likely Involved**

- `README.md`
- `docs/examples/**`
- `docs/commands/do.md`
- `docs/PHASE-LIFECYCLE.md`
- `docs/presentation/blueprint-team-presentation-qa.md`
- `LICENSE`
- `CONTRIBUTING.md`
- `CHANGELOG.md`
- `SECURITY.md`
- `.github/workflows/**`

**Acceptance Criteria**

- README shows a 60-second demo before the full command reference.
- README has a compact beginner command chooser.
- High-risk commands are visually separated from read-only/report commands.
- README includes example output for `/blu-help`, `/blu-progress`, and `/blu-next`.
- `/blu-do` is unambiguously planned/non-public in all public docs.
- Root-level OSS trust files exist.
- Versioning and `/blu-update` advisory semantics are documented.

**Tests Required**

- README command table generated/freshness test.
- README path existence test.
- Docs drift test for `/blu-do` planned status.
- Link checks for docs examples and OSS files.
- Optional screenshot/transcript freshness check if demo assets become generated.

**Effort**

Medium.

**Confidence**

High.

## Recommended Quality Gates

### Local Developer Gates

- `npm ci`
- `npm run build`
- `npm run typecheck`
- `npm test`
- New `npm run verify` combining build, typecheck, tests, production audit policy, and generated asset freshness.
- New `npm run typecheck:tests` with `tsconfig.test.json`.
- New parser-backed manifest/skill schema validation.
- New generated-doc freshness checks for command catalog, runtime reference, README command tables, and MCP tool docs.

### CI Gates

- Pull request workflow on Node 20:
  - `npm ci`
  - `npm run verify`
  - generated `dist` and schema freshness check
  - production dependency audit policy
  - command/doc/runtime drift checks
- Separate scheduled or manual host-smoke workflow:
  - Gemini link smoke
  - Gemini install smoke
  - optional Gemini live prompt smoke when credentials exist
  - optional Tabnine smoke when install command is configured
- Store host CLI stdout/stderr as workflow artifacts on failure.

### Release Gates

- All PR CI gates green.
- Host install smoke green, or an explicit release-blocking waiver with reason and expiry.
- `dist/` built from current source and checked for freshness.
- `package.json`, `gemini-extension.json`, and `tabnine-extension.json` versions aligned.
- Production audit passes or documented exception exists.
- CHANGELOG/release notes updated.
- `/blu-update` advisory metadata behavior verified.
- GitHub release checklist includes install-from-GitHub validation.

### Prompt/Skill Drift Gates

- Structural golden command packets for implemented command families.
- Behavior eval fixtures for high-risk and high-frequency commands.
- TOML schema validation for all command manifests.
- Skill frontmatter and `input_bundles` schema validation.
- Stale planned-command prose detection with archive allowlist.
- Planned command requests, especially `/blu-do`, tested to remain non-routable.

### MCP/Artifact Contract Gates

- Tool registry snapshot with tool name, input schema, mutation/read kind, lock policy, and documented result statuses.
- Artifact registry snapshot with id, path pattern, owner tool, schema version, validator, renderer, and migration handler.
- Rendered artifact fixture corpus for every artifact contract.
- Atomic write and lock tests for `.blueprint/` read-modify-write flows.
- Migration assessment fixtures.
- Docs generated from registries, not manually synchronized tables.

## Recommended Product Simplification

Blueprint should keep the direct command power, but stop presenting all commands as equally relevant to a beginner.

Recommended grouping:

| Public Group | Default Entry | Commands To Surface First |
|---|---|---|
| Start | `/blu` | `/blu-help`, `/blu-map-codebase`, `/blu-new-project`, `/blu-health` |
| Plan/Build/Verify | `/blu-next` | `/blu-discuss-phase`, `/blu-plan-phase`, `/blu-execute-phase`, `/blu-validate-phase`, `/blu-verify-work` |
| Capture | `/blu-explore` | `/blu-note`, `/blu-add-todo`, `/blu-add-backlog` |
| Small Work | `/blu-quick` | `/blu-fast`, `/blu-debug --diagnose` |
| Quality Evidence | `/blu-progress` | `/blu-impact`, `/blu-code-review`, `/blu-add-tests`, `/blu-secure-phase`, `/blu-ui-review` |
| Git/Release | explicit only | `/blu-pr-branch`, `/blu-ship`, `/blu-undo` |
| Workspace/Maintenance | explicit only | `/blu-new-workspace`, `/blu-remove-workspace`, `/blu-workstreams`, `/blu-update`, `/blu-cleanup`, `/blu-reapply-patches` |

Specific simplifications:

- Make `/blu` the only public freeform router until `/blu-do` is implemented.
- Lead README with `/blu-impact --staged` as the fastest proof path because it can show value without full lifecycle adoption.
- Promote `/blu-next` as the normal lifecycle driver so users do not memorize every optional phase step.
- Separate high-risk mutation commands from read-only/report commands everywhere.
- Add "Why not just..." to explain the distinction from todos, issue trackers, CI, and agent prompts.
- Move wave/history/runtime internals into maintainer docs.

## Implementation Sequence

### Quick Wins

1. Fix public docs drift:
   - Mark `/blu-do` planned/non-public in `docs/commands/do.md`.
   - Fix README path `skills/blueprint-router.md` to `skills/blueprint-router/SKILL.md`.
   - Remove stale planned-command wording around implemented maintenance commands.
   - Align risk ratings for `verify-work`, `fast`, and `explore`.
   - Add `review.review-fix` and `report.audit-fix` to the structured schema inventory.

2. Add release command baseline:
   - Add `npm run verify`.
   - Add CI for `npm ci`, build, typecheck, and `npm test`.
   - Add production audit policy in reporting mode first.

3. Improve README adoption:
   - Replace rollout language with beginner value prop.
   - Add "Use this first" table.
   - Add `/blu-impact --staged` mini demo transcript.

### Structural Changes

1. Create typed command, tool, and artifact registries.
2. Generate command catalog/runtime-reference/README command tables from the command registry.
3. Centralize Markdown parsing as a migration compatibility layer.
4. Introduce atomic shared writers and declared lock policy for mutating tools.
5. Add schema markers or sidecars plus migration assessment for project-local artifacts.

### Release Confidence Work

1. Split and stabilize host smoke tests.
2. Add per-host CLI timeout/capture utilities.
3. Add release workflow for host link/install/live smoke.
4. Add dependency automation and audit exception policy.
5. Add manifest/package version sync checks.
6. Add generated `dist` freshness and bundle-shape checks.

### Product Adoption Work

1. Add `LICENSE`, `CONTRIBUTING.md`, `CHANGELOG.md`, and `SECURITY.md`.
2. Add `docs/examples/impact-staged.md`.
3. Add `docs/examples/brownfield-onboarding.md`.
4. Add `docs/examples/phase-lifecycle.md`.
5. Add example outputs for `/blu-help`, `/blu-progress`, and `/blu-next`.
6. Add screenshots or terminal recordings once smoke output is stable.

## Appendix

- Runtime architecture audit: [docs/to-the-moon/hardening-runtime-architecture.md](./hardening-runtime-architecture.md)
- Contract drift and consistency audit: [docs/to-the-moon/hardening-contract-drift.md](./hardening-contract-drift.md)
- Test and CI audit: [docs/to-the-moon/hardening-tests-ci.md](./hardening-tests-ci.md)
- Product adoption and open-source UX audit: [docs/to-the-moon/hardening-product-adoption.md](./hardening-product-adoption.md)
