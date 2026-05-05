# Blueprint Test And CI Hardening Audit

Date: 2026-05-04  
Scope: tests, package scripts, build pipeline, extension install tests, smoke tests, and GitHub workflow files for `/Users/rhishi/dev/repositories/blueprint`.

## Verification Run

| Command | Result | Evidence |
|---|---:|---|
| `npm ci` | PASS with audit warnings | Installed 263 packages, audited 264 packages in about 5s. Reported `5 vulnerabilities (4 moderate, 1 critical)` and a deprecated `glob@10.5.0` warning. |
| `npm run build` | PASS | `scripts/build.mjs` rebuilt `dist/mcp/server.js` and hook bundles successfully; esbuild reported `Done in 76ms`. |
| `npm run typecheck` | PASS | `tsc -p tsconfig.json --noEmit` exited 0. |
| `npm test` | PASS | Ran `npm run build --silent && tsx --test tests/**/*.test.ts`; summary: `tests 906`, `pass 906`, `fail 0`, duration about `72150ms`. |
| `npm run smoke:gemini-clean-home` | FAIL, environment-sensitive | `gemini extensions validate ... --debug` passed and `gemini extensions link ... --consent` ran, but `gemini extensions list --output-format json` did not return a JSON array in this non-TTY run. Script preserved clean home at `/var/folders/p2/r6z4656x2rd2jn1jdc_v51200000gn/T/blueprint-gemini-home-rTkLQe`. |
| `npm run test:integration:extension` | FAIL | Containerized Gemini link smoke failed: `link mode should surface Blueprint from a fresh Gemini CLI process` at `tests/extension-install.integration.ts:500`. Install mode then timed out at the parent `900000ms` suite timeout. Tabnine was skipped because `BLUEPRINT_TABNINE_CLI_INSTALL_COMMAND` was unset. |

Worktree note: `git status --short` showed pre-existing/unrelated untracked `.blueprint/` plus other agents' untracked `docs/to-the-moon/*` reports. Verification did not leave tracked `dist`, lockfile, or source changes.

## Current Test Shape

- `package.json:10-15` exposes five scripts: `build`, `typecheck`, `test`, `smoke:gemini-clean-home`, and `test:integration:extension`. `npm test` does not run `typecheck`, the clean-home smoke, or the extension install integration suite.
- `scripts/build.mjs:29-60` deletes and rebuilds `dist/`, emits declarations with local `tsc`, bundles the MCP server and hooks with esbuild, and copies artifact schema JSON into `dist`.
- `docs/TEST-STRATEGY.md:12-95` already names the intended layers: MCP/schema unit tests, command fixtures, hook fixtures, integration tests, git behavior tests, and install/packaging tests.
- There are 115 top-level `*.test.ts` files and 1 top-level `*.integration.ts` file under `tests/`.
- No repo-owned GitHub workflow was found: `.github directory absent`.

## Prioritized Findings

### P0: Release/install verification is currently red and not part of the default gate

Evidence:
- `npm run test:integration:extension` failed in Gemini link mode at `tests/extension-install.integration.ts:500`, where the suite expects `gemini --debug --list-extensions` output to include the expected context path.
- The same integration run timed out at `tests/extension-install.integration.ts:578-633` after 900s, cancelling install-mode and auth-backed smoke subtests.
- `package.json:13-15` keeps `npm test` and `test:integration:extension` separate, so the passing default test suite can miss this release blocker.
- `tests/extension-install.integration.ts:29-65` correctly stages a shipped bundle and asserts required installed files, which makes this a high-value gate once stable.

Recommendation:
- Make extension-install integration either reliable in CI or explicitly quarantined with a required scheduled/release gate.
- Split link mode, install mode, and live prompt smoke into separate test files or separate npm scripts so one hung install path cannot consume the whole 900s parent timeout.
- Capture `gemini --debug --list-extensions` stdout/stderr as first-class failure artifacts.
- Add a short timeout around each host CLI command, not only the parent suite.

### P1: There is no visible CI workflow to enforce the passing local gates

Evidence:
- `.github` is absent.
- `package.json:10-15` defines the local commands, but no workflow runs `npm ci`, `npm run build`, `npm run typecheck`, `npm test`, smoke, or integration checks automatically.
- `npm ci` surfaced a critical dependency vulnerability, but no CI audit policy is visible.

Recommendation:
- Add a GitHub Actions workflow for pull requests with `npm ci`, `npm run build`, `npm run typecheck`, and `npm test`.
- Add a release/manual workflow for `npm run test:integration:extension`, with Docker enabled and explicit host env documentation.
- Add at least non-blocking `npm audit --audit-level=critical` reporting, then decide whether criticals should block release.

### P1: Golden prompt/runtime packet tests are missing as a uniform category

Evidence:
- `rg --files tests | rg 'prompt-eval|golden|snapshot'` returned no test files.
- `rg -n "golden|snapshot" tests` found one narrow output-ordering test, `tests/impact-tools.test.ts:2324`, plus unrelated snapshot wording.
- Existing metadata tests are mostly regex assertions over prose, for example `tests/plan-phase-metadata.test.ts:12-86`.

Recommendation:
- Add normalized golden packet tests for implemented command families. Each packet should include command manifest path, primary skill, active input bundle paths, required MCP FQNs, optional agents, confirmation gates, persistence tools, forbidden patterns, and expected next-action language.
- Start with `/blu`, `/blu-plan-phase`, `/blu-execute-phase`, `/blu-validate-phase`, `/blu-code-review-fix`, `/blu-cleanup`, `/blu-ship`, and `/blu-impact`.
- Keep goldens structural rather than full prose snapshots to avoid noisy diffs.

### P1: Command manifest schema validation is regex-heavy, not parser-backed

Evidence:
- Command manifests are TOML files, but `package.json:17-28` has no TOML parser or manifest-schema test dependency.
- Many manifest tests read TOML as raw text and assert regexes, e.g. `tests/plan-phase-metadata.test.ts:13-86`.
- `tests/extension-runtime-contracts.test.ts:272-333` checks repaired manifests for runtime-name and FQN consistency, but it does not parse TOML or validate a host-facing manifest schema.

Recommendation:
- Add a manifest schema test that parses every `commands/blu*.toml`, validates required keys, rejects unknown/deprecated surfaces, verifies command path naming, and checks runtime profile fields.
- Keep existing regex drift tests for semantic guardrails, but make parser/schema validation the first failure layer.

### P2: Skill metadata and runtime input tests are strong, but still need schema-style coverage

Evidence:
- `tests/skill-metadata.test.ts:21-39`, `57-97`, and `139-177` verify command-specific input bundles and docs-free behavior.
- `tests/extension-runtime-contracts.test.ts:220-270` verifies implemented skills resolve to discoverable bundles and include runtime call guardrails.

Gap:
- These tests validate important content but do not appear to enforce a single typed schema for all skill frontmatter and `input_bundles`.

Recommendation:
- Add a schema pass for every `skills/*/SKILL.md`: frontmatter fields, status vocabulary, command coverage, input bundle references, duplicate command entries, and broken reference paths.

### P2: MCP tool and artifact contract coverage is broad, but docs/runtime generation remains manual

Evidence:
- `tests/artifact-contracts.test.ts:107-140` verifies structured model contracts for plan, summary, UAT, quick-run, add-tests, and audit-fix.
- `tests/built-assets-smoke.test.ts:188-220` starts the built MCP server over stdio and compares advertised tool names to `blueprintToolNames`.
- `tests/command-contract-docs.test.ts:166-206` and nearby tests compare command catalog, command specs, skill ownership, and runtime reference rows.

Gap:
- Return-shape docs in `docs/MCP-TOOLS.md` are still text tables, so drift can survive when only selected rows or regexes are asserted.

Recommendation:
- Generate or snapshot MCP tool names, input schemas, mutation classification, and documented return-shape keys from the registered tool definitions.
- Add fixture-level artifact render tests for every contract template, not only selected model contracts.

### P2: Command lifecycle integration exists, but not as a real host-command journey

Evidence:
- `tests/lifecycle-pilot-integration.test.ts:27-133` seeds a repo and exercises MCP lifecycle substrates directly.
- `docs/TEST-STRATEGY.md:97-109` defines the desired smoke flow from install through `/blu-new-project`, `/blu-discuss-phase`, `/blu-plan-phase`, `/blu-execute-phase`, `/blu-validate-phase`, and `/blu-verify-work`.
- Current install smoke tests validate host extension mechanics, but not this complete command journey.

Recommendation:
- Add a deterministic lifecycle fixture that simulates host command packets and MCP tool returns for the full command chain.
- Add an optional live-host journey only for nightly/release runs, gated on credentials and bounded timeouts.

## Missing/Partial Category Matrix

| Category requested | Current status | Hardening target |
|---|---|---|
| Golden prompt tests | Missing as a uniform category; only impact output ordering found. | Add structural prompt/runtime packet goldens. |
| Command manifest schema tests | Partial; regex-heavy raw TOML checks. | Parse and schema-validate every `commands/blu*.toml`. |
| Skill metadata tests | Strong partial coverage. | Add full schema validation for frontmatter and `input_bundles`. |
| MCP tool contract tests | Strong partial coverage. | Generate/snapshot registered tool schemas and documented return keys. |
| Artifact fixture tests | Strong for selected contracts and impact fixtures. | Add rendered artifact fixture corpus for every contract. |
| Command lifecycle integration tests | Partial MCP-level lifecycle coverage. | Add host-command packet journey; optional live host journey. |
| Release packaging tests | Present but currently failing in integration. | Stabilize and gate link/install/live prompt paths separately. |
| Docs/runtime drift tests | Broad regex/metadata coverage. | Replace high-value regex checks with generated contract snapshots where possible. |

## Bottom Line

Blueprint's local unit and fixture suite is unusually broad and currently green, but release confidence is lower than the 906 passing tests imply. The highest-risk gaps are outside normal `npm test`: no visible CI workflow, failing containerized Gemini install smoke, environment-sensitive clean-home smoke, no uniform golden prompt/runtime packet corpus, and parserless command manifest validation.
