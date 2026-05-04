# Subagent D: Codebase Quality, Tests, and Release Confidence Audit

Date: 2026-05-04
Worktree: `/Users/rhishi/dev/repositories/blueprint-top5-20260504-194251`
Scope: TypeScript architecture, package scripts, test suite, build pipeline, integration tests, runtime packaging, extension manifests, security helpers, maintainability, and release confidence.

## Executive Summary

Blueprint has a surprisingly strong local regression suite for MCP tool behavior, implemented-only routing, artifact schema validation, built asset freshness, and high-risk maintenance flows. The full non-Docker suite passed: 906 tests, 0 failures.

Release confidence is still mostly local and convention-driven. There is no GitHub Actions workflow, no aggregate `verify` command, no lint/format/coverage gate, no test typecheck, and no dependency automation visible in this worktree. `npm ci` and `npm audit` also surfaced active vulnerability debt: one production moderate issue through `@modelcontextprotocol/sdk -> hono`, and dev/testcontainers debt including a critical `protobufjs` advisory.

The highest leverage repair is to turn the current good local gates into enforced release gates: CI should run `npm ci`, `npm run typecheck`, `npm test`, a production audit gate, and dist/schema freshness checks on every PR. A second tier should add lint/format/test-typecheck and scheduled Docker install smoke rather than relying on ad hoc local execution.

## Commands Run And Results

| Command | Result | Notes |
|---|---:|---|
| `sed -n '1,240p' AGENTS.md` and `sed -n '241,520p' AGENTS.md` | pass | Read the local repo instructions first, per constraint. |
| `git status --short` | pass | Initial status showed untracked `docs/to-the-moon/`; no source changes were present. |
| `npm ci` | pass | Installed 263 packages, audited 264. Reported 5 vulnerabilities: 4 moderate, 1 critical. |
| `npm run build` | pass | Built `dist/mcp/server.js` at 2.5 MB and source map at 4.4 MB. |
| `npm run typecheck` | pass | `tsc -p tsconfig.json --noEmit` exited 0. |
| `npm audit --json` | fail by policy | 5 vulnerabilities: `hono` moderate, `protobufjs` critical, plus `testcontainers`/`dockerode`/`uuid` moderate chain. |
| `npm audit --omit=dev --json` | fail by policy | 1 production moderate vulnerability: `hono <4.12.14` via `@modelcontextprotocol/sdk@1.29.0`. |
| `npm explain protobufjs`, `npm explain hono`, `npm explain dockerode` | pass | Confirmed `protobufjs` critical is dev/testcontainers transitively; `hono` is production MCP SDK transitively. |
| `npm test` | pass | Rebuilt, then ran 906 tests, 906 pass, 0 fail, duration about 53 seconds. |

Not run: `npm run test:integration:extension`. It uses Testcontainers and installs/runs host CLIs inside Docker (`tests/extension-install.integration.ts:153`, `tests/extension-install.integration.ts:253`, `tests/extension-install.integration.ts:578`). The prompt explicitly said to avoid Docker/testcontainers integration unless justified as safe and available; the non-Docker suite already exercised the local built MCP and hook smoke paths.

## Test Coverage Themes

Strong coverage exists for:

- Implemented-only routing and runtime command catalog invariants, including planned command exclusion (`tests/command-catalog.test.ts:185`, `tests/command-catalog.test.ts:285`).
- Built runtime smoke and hook execution from `dist/` (`tests/built-assets-smoke.test.ts:108`, `tests/built-assets-smoke.test.ts:188`).
- Tracked schema/dist freshness for Git-installed extension hosts (`tests/built-schema-assets.test.ts:48`, `tests/built-schema-assets.test.ts:75`).
- MCP behavior for lifecycle, validation, review, impact, workspace/workstream, cleanup, and update paths.
- Security helper coverage for path containment, fake `.git` handling, prompt-boundary sanitization, and mutation failure logging.

Confidence gaps:

- The documented strategy says every command spec should have happy-path, missing-precondition, and riskiest-edge fixture coverage (`docs/TEST-STRATEGY.md:111`), but a large share of command tests are metadata/regex contract tests. I counted 47 `*metadata.test.ts` files. This is useful drift coverage, but it is not the same as host-level command execution coverage.
- Golden output coverage is narrow. I found an impact report golden ordering test, but no general snapshot/golden corpus for command prompt manifests, generated artifact templates, or command-visible copy.
- `tsconfig.json` only includes `src/**/*.ts` (`tsconfig.json:17`), while `npm test` runs tests through `tsx` (`package.json:13`). That means test files are executed but not typechecked by `tsc`.
- Docker/host install smoke is opt-in via `npm run test:integration:extension` (`package.json:15`) and has skip gates for Tabnine CLI setup and live Gemini auth (`tests/extension-install.integration.ts:239`, `tests/extension-install.integration.ts:622`).

## Findings

### F1 - High: Release gates are not enforced by CI

Evidence:
- No `.github/` workflow files were found.
- `package.json` exposes only `build`, `typecheck`, `test`, one clean-home smoke, and one integration script (`package.json:10`).
- There is no aggregate `verify` script that runs the expected release gate set.

Risk:
Local verification is good, but nothing in the repo appears to force it before merge/release. This is especially risky because Git-installed hosts launch checked-in `dist/` directly (`gemini-extension.json:9`, `tabnine-extension.json:9`) and stale `dist/` has already been a documented defect class in `docs/bugs/BPBUG-004-stale-built-bundle-omits-audit-fix-generated-assets.md`.

Recommended gate:
Add CI with `npm ci`, `npm run typecheck`, `npm test`, `npm audit --omit=dev --audit-level=moderate`, and a `git diff --exit-code -- dist`/schema freshness assertion after build.

### F2 - High: Active dependency vulnerability debt has no visible policy gate

Evidence:
- `npm audit --json` returned 5 vulnerabilities: 4 moderate, 1 critical.
- `npm audit --omit=dev --json` still returned 1 production moderate vulnerability in `hono <4.12.14`.
- `npm explain hono` traces `hono@4.12.12` through `@modelcontextprotocol/sdk@1.29.0`, a production dependency (`package.json:17`).
- `npm explain protobufjs` traces the critical `protobufjs@7.5.4` issue through `testcontainers@11.14.0`, a dev dependency (`package.json:22`).
- No Dependabot/Renovate config was found.

Risk:
The critical advisory appears confined to dev/testcontainers, but it still affects the integration-test supply chain. The production `hono` advisory may or may not be exploitable in Blueprint's stdio MCP usage, but it is still present in the shipped dependency graph and should be patched or explicitly documented.

Recommended gate:
Introduce dependency automation and a CI audit policy that blocks production moderate+ issues, reports dev critical/high issues, and records explicit exceptions with expiry dates.

### F3 - Medium: Static quality gates are thinner than the codebase size warrants

Evidence:
- No ESLint, Prettier, Biome, `.editorconfig`, `.npmrc`, `.nvmrc`, or `.node-version` config files were found.
- `package.json` has no lint, format, coverage, or test-typecheck scripts (`package.json:10`).
- `tsconfig.json` has strict mode on (`tsconfig.json:7`) but excludes tests (`tsconfig.json:17`) and has `skipLibCheck: true` (`tsconfig.json:10`).

Risk:
The repo is already over 61k lines of TypeScript source. Without lint/format/test-typecheck/coverage, many style, dead-code, unhandled-promise, import, and test-fixture type regressions depend on reviewer attention.

Recommended gate:
Add a lightweight static gate first: ESLint or Biome, `tsconfig.test.json`, `npm run lint`, `npm run format:check`, and coverage collection with thresholds on the highest-risk modules.

### F4 - Medium: Host install and release smoke exists but is not part of the normal test path

Evidence:
- `npm test` runs only `tests/**/*.test.ts`; it excludes `tests/extension-install.integration.ts` (`package.json:13`).
- The integration test stages only shipped paths and excludes `src`, `node_modules`, `.planning`, and `.git` (`tests/extension-install.integration.ts:29`, `tests/extension-install.integration.ts:42`), which is the right release shape.
- The same test requires Docker/Testcontainers and installs host CLIs in the container (`tests/extension-install.integration.ts:153`, `tests/extension-install.integration.ts:253`), with Tabnine disabled unless `BLUEPRINT_TABNINE_CLI_INSTALL_COMMAND` is set (`tests/extension-install.integration.ts:231`) and live Gemini prompt smoke skipped without `GEMINI_API_KEY` (`tests/extension-install.integration.ts:620`).
- The clean-home smoke script validates, links, and lists an extension under an isolated host home (`scripts/gemini-clean-home-smoke.mjs:209`), but it is not run by `npm test`.

Risk:
Local tests can be green while the actual host install path or host-specific extension behavior drifts.

Recommended gate:
Keep PR CI on fast local gates, then add a scheduled/nightly or release-branch Docker smoke matrix for Gemini and Tabnine, with live Gemini prompt smoke only when credentials are available.

### F5 - Medium: Command/prompt drift coverage is broad but too regex-heavy for prompt contracts

Evidence:
- Many tests assert manifest and doc fragments using regex, for example command contract and metadata tests read `commands/blu-*.toml` directly.
- `docs/TEST-STRATEGY.md` calls for per-command fixture suites (`docs/TEST-STRATEGY.md:27`) and per-command spec-derived happy/missing/edge fixtures (`docs/TEST-STRATEGY.md:111`).
- `tests/fixtures/` has durable fixture packs for help/progress/health, impact, map-codebase, new-project, and settings-profile, but not a uniform retained-command fixture matrix.

Risk:
Regex checks catch important keywords, but they do not prove command prompts still render a coherent end-to-end instruction packet, preserve ordering, or avoid accidental prompt regressions.

Recommended gate:
Add golden prompt/rendered-contract tests for each implemented command family. Store normalized expected prompt/runtime-contract packets and diff them intentionally when command behavior changes.

### F6 - Medium: High-complexity modules concentrate too much release risk

Evidence from `wc -l`:
- `src/mcp/tools/phase.ts`: 12,098 lines.
- `src/mcp/tools/artifacts.ts`: 11,839 lines.
- `src/mcp/tools/review.ts`: 8,908 lines.
- `src/mcp/tools/impact.ts`: 8,341 lines.
- `src/mcp/artifact-contracts/index.ts`: 4,954 lines.
- `src/mcp/tools/workspace.ts`: 3,581 lines.
- `src/mcp/command-runtime-metadata.ts`: 3,004 lines.

Risk:
These modules own critical state transitions, schema validation, report rendering, command metadata truth, git/worktree mutation, and safety checks. Even with strong tests, review cost and accidental cross-feature coupling are high.

Recommended approach:
Do not refactor first. Add characterization coverage and coverage metrics around each module, then extract by contract boundary: parsers, renderers, validators, repo adapters, and mutation orchestrators.

### F7 - Low/Medium: Debuggability is focused on mutation failures, not full runtime traces

Evidence:
- Mutation failures are centrally logged to `.blueprint/mcp-write-failures.ndjson` (`src/mcp/write-failure-log.ts:10`).
- The MCP server only logs failed/rejected mutation outcomes through `executeToolHandlerWithFailureLogging` (`src/mcp/server.ts:486`).
- Tool response summaries are concise, which is good for UX, but there is no visible request id, trace mode, or structured read-path diagnostic bundle for routing/debug cases.

Risk:
When read-side routing or catalog/resource projection drifts, users may get a short summary but lack a durable diagnostic packet unless a mutation fails.

Recommended gate:
Add an opt-in `BLUEPRINT_DEBUG_TRACE` or MCP diagnostic tool that emits redacted request ids, catalog version/provenance, path decisions, and routing inputs without writing host-global state.

## High-Risk Files And Modules

| File | Risk | Why it matters |
|---|---|---|
| `src/mcp/tools/phase.ts` | High | 12k-line lifecycle hub for phase context, plan, summary, validation, and routing-adjacent behavior. |
| `src/mcp/tools/artifacts.ts` | High | 11.8k-line owner of repo root validation, artifact inspection, scaffolding, report writes, and schema enforcement. |
| `src/mcp/tools/review.ts` | High | 8.9k-line review/security/UI/review-fix persistence and validation surface. |
| `src/mcp/tools/impact.ts` | High | 8.3k-line impact analysis engine touching command, dependency, ownership, security, and release surfaces. |
| `src/mcp/tools/workspace.ts` | High | Git/worktree/registry mutation and rollback logic; high blast radius even with good tests. |
| `src/mcp/command-runtime-metadata.ts` | Medium/High | Source-owned runtime truth for command status, tools, skills, and references; drift here affects routing. |
| `src/mcp/artifact-contracts/index.ts` | Medium/High | Central contract/template/schema registry; schema drift can break many commands. |
| `src/mcp/server.ts` | Medium | Tool registration, mutation classification, failure logging, and user-facing summaries. |
| `scripts/build.mjs` | Medium | Release bundle producer for Git-installed hosts; missing checks here can ship stale or bloated runtime assets. |
| `tests/extension-install.integration.ts` | Medium | Strong install-shape coverage, but expensive/optional and not in default `npm test`. |

## Recommended Quality Gates

1. Add `npm run verify` that runs `npm run typecheck`, `npm test`, and production audit.
2. Add GitHub Actions PR CI: Node 20, `npm ci`, `npm run verify`, and artifact/dist freshness check.
3. Add scheduled/release Docker integration CI for `npm run test:integration:extension`.
4. Add `npm run lint` and `npm run format:check` using one toolchain.
5. Add `tsconfig.test.json` and `npm run typecheck:tests`.
6. Add coverage with thresholds for `src/mcp/tools/phase.ts`, `artifacts.ts`, `review.ts`, `impact.ts`, `workspace.ts`, and `command-runtime-metadata.ts`.
7. Add dependency automation plus `npm audit --omit=dev --audit-level=moderate` in PR CI.
8. Add bundle-size and source-map policy checks for `dist/mcp/server.js`.
9. Add version-sync checks across `package.json`, `gemini-extension.json`, and `tabnine-extension.json`.
10. Add golden prompt/runtime-contract snapshot tests for implemented command families.

## Recommendations Ranked By Engineering Leverage

1. Enforce the existing local gates in CI. This converts current good practice into actual release confidence with minimal design churn.
2. Patch or explicitly manage the dependency audit findings. Production `hono` should be resolved first; dev/testcontainers critical debt should not be normalized.
3. Add lint/format/test-typecheck. This is low-risk and immediately reduces reviewer burden across a large TypeScript codebase.
4. Make integration smoke scheduled and release-blocking. Host extension regressions are too expensive to discover after install.
5. Add golden contract tests for command prompts and artifact renderers. This addresses the exact drift class that regex metadata tests only partially cover.
6. Add coverage telemetry before refactoring the monoliths. Let coverage guide safe extraction instead of starting with mechanical splitting.
7. Add opt-in diagnostic traces for read-side routing and catalog/resource projection. Mutation failure logs are useful but incomplete for support/debug loops.

## Residual Risk And Uncertainty

- I did not run Docker/Testcontainers integration, so host install confidence is based on code inspection plus the passing non-Docker built-asset smoke.
- I did not inspect every line of the largest modules; high-risk module rankings are based on ownership, line count, test evidence, and release blast radius.
- The production `hono` advisory may not be exploitable in Blueprint's current stdio MCP usage, but the dependency is still present in the production graph and should be treated as policy debt until updated or documented.
