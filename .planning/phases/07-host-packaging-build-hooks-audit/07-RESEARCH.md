# Phase 7: Host Packaging Build Hooks Audit - Research

**Researched:** 2026-05-02
**Domain:** Blueprint extension host manifests, build pipeline, generated assets, advisory hooks, and install or smoke readiness
**Confidence:** HIGH

## Research Question

What does the executor need to know to audit Blueprint's host packaging, build, generated `dist`, advisory hooks, and install readiness without applying source, manifest, skill, test, build, generated asset, runtime `.blueprint/`, installed-extension, host-global, branch, PR, remote-service, or git-history fixes?

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COV-06 | Extension host manifests, build pipeline, generated `dist`, hooks, packaging, and install/smoke behavior are audited. | The plan set must trace `gemini-extension.json`, `tabnine-extension.json`, `package.json`, `scripts/build.mjs`, `scripts/lib/extension-hosts.mjs`, `dist/`, `hooks/hooks.json`, `src/hooks/*.ts`, `src/shared/security.ts`, and install/smoke tests. |
| NFIX-01 | No source, manifest, skill, test, build, generated asset, or runtime behavior fixes are applied. | Plans must be read-heavy and write only bug reports, the bug index, summaries, and Phase 7 planning artifacts. |
| NFIX-02 | Temporary probe files are removed before completion and documented. | Any install or smoke probe must use temp staging roots, clean homes, containers, or fake CLIs and must record cleanup evidence or environment blockers. |
| NFIX-03 | Git status is checked at phase boundaries. | Every plan includes `git status --short` and separates unrelated user changes from phase-owned bug docs or summaries. |

## Summary

Phase 7 should be planned as five audit slices. Start with the two host manifests and shared extension-host metadata, because install-time host identity, context file selection, MCP entrypoint resolution, and `BLUEPRINT_HOST`/`BLUEPRINT_EXTENSION_PATH` are the top-level packaging contract. Then audit the build and generated `dist` assets, including declaration output, bundled MCP and hook entrypoints, schema copying, source maps, package scripts, and git-tracked built files. Keep advisory hooks as their own slice because they intentionally warn without blocking, reuse shared security detectors, and must remain configured through `hooks/hooks.json` rather than repo config. Audit install and smoke readiness separately because containerized host validation, clean-home smoke behavior, staging exclusions, metadata checks, and fake/live CLI fallbacks have different evidence and environment risks. Close by reconciling any Phase 7 bug reports, updating the bug index slice row, and verifying the discovery-only boundary.

No Phase 7 `CONTEXT.md` exists at planning time. These plans therefore derive their decisions from the Phase 7 ROADMAP slice, project guardrails, requirements, existing Phase 1 bug-reporting harness, and this research.

## Locked Decisions From Repository Context

- Blueprint is installed as a Gemini CLI or Tabnine CLI extension from GitHub, not by a custom installer.
- Extension runtime entrypoints must be built under `dist/` before release because hosts launch `dist/mcp/server.js` directly from `${extensionPath}`.
- `gemini-extension.json` must point to `GEMINI.md`; `tabnine-extension.json` must point to `TABNINE.md`; `TABNINE.md` is currently a symlink to `GEMINI.md`.
- Host manifests must set `BLUEPRINT_HOST` to `gemini` or `tabnine` and pass `BLUEPRINT_EXTENSION_PATH=${extensionPath}`.
- Advisory hooks are limited to read-before-edit, `.blueprint` write guard, and workflow advisory. They must return advisory `allow` output and must not become a hidden state engine or permission system.
- Runtime global state remains only under `~/.<host>/blueprint/`; installed extension directories are read-only from Blueprint commands.
- This milestone is discovery-only: source, manifest, hook, test, build, generated asset, runtime, installed-extension, host-global, branch, PR, and git-history fixes are not part of Phase 7.

## Evidence Baseline

### Host Manifests And Shared Host Metadata

- `gemini-extension.json` and `tabnine-extension.json` define host-specific descriptions, context files, MCP command, MCP args, and environment variables.
- `scripts/lib/extension-hosts.mjs` is the shared host table for Gemini and Tabnine metadata: manifest file, context file, host home, global Blueprint root, CLI binary, and install metadata filenames.
- `tests/helpers/extension-hosts.ts` mirrors the shared host table into TypeScript tests.
- `tests/extension-runtime-contracts.test.ts` verifies host manifest shape, built MCP entrypoint path, host env values, host runtime context reuse, tracked `dist` assets, and runtime prompt contracts.

### Build Pipeline And Generated Assets

- `scripts/build.mjs` removes `dist/`, emits declarations with TypeScript, bundles `src/mcp/server.ts` and the three hook entrypoints with esbuild, writes source maps, targets Node 20, and copies artifact-contract JSON schemas into `dist/mcp/artifact-contracts/schemas`.
- `package.json` exposes `build`, `typecheck`, `test`, `smoke:gemini-clean-home`, and `test:integration:extension`.
- Current generated assets include `dist/mcp/server.js`, `dist/hooks/read-before-edit.js`, `dist/hooks/blueprint-write-guard.js`, `dist/hooks/workflow-advisory.js`, their source maps, declarations, shared declarations, tool declarations, and copied schema files.
- `tests/built-assets-smoke.test.ts` runs built hooks directly and starts the built MCP server over stdio, comparing exposed tools against `blueprintToolNames`.
- `tests/extension-runtime-contracts.test.ts` checks that git-installed extension bundles include tracked `dist/mcp/server.js` and built hook files.

### Advisory Hooks

- `hooks/hooks.json` registers one `BeforeTool` group for `write_file|replace` with three command hooks rooted at `${extensionPath}/dist/hooks/*.js`.
- `src/hooks/read-before-edit.ts` advises when editing an existing non-`.blueprint` file without prior transcript evidence of a read.
- `src/hooks/blueprint-write-guard.ts` advises on suspicious `.blueprint` content and incomplete research artifact shape, using shared prompt-boundary analysis from `src/shared/security.ts`.
- `src/hooks/workflow-advisory.ts` advises on direct non-`.blueprint` repo writes.
- `src/hooks/run-hook.ts` parses stdin JSON and returns `{}` on unexpected failures so hooks stay advisory and do not block the host.
- `tests/hooks.test.ts` covers TypeScript hook behavior and `hooks/hooks.json`; `tests/built-assets-smoke.test.ts` covers built hook execution.

### Install And Smoke Readiness

- `tests/extension-install.integration.ts` stages tracked shipped paths only, excludes `src`, `node_modules`, `.planning`, and `.git`, installs host CLIs inside a Node 20 container, validates the extension, exercises link and install modes, verifies install metadata, ensures required installed paths exist, asserts forbidden repo-only paths are absent, imports the installed MCP server, and checks hook command targets stay inside the bundle.
- Tabnine integration is optional and requires `BLUEPRINT_TABNINE_CLI_INSTALL_COMMAND`.
- The live Gemini prompt smoke is optional and requires `GEMINI_API_KEY`.
- `scripts/gemini-clean-home-smoke.mjs` validates, links, lists, and verifies Blueprint in a clean host home for Gemini or Tabnine; it preserves the smoke home on failure and removes auto-created clean homes only after success.
- `tests/gemini-clean-home-smoke.test.ts` uses fake CLIs to verify validate/link/list ordering, clean home environment, PTY/list behavior, success output, and failure preservation.

## Existing Tests To Reuse

Prefer these targeted commands during Phase 7 execution:

```bash
npm run typecheck
npm run build
npx tsx --test tests/extension-runtime-contracts.test.ts tests/built-assets-smoke.test.ts
npx tsx --test tests/hooks.test.ts tests/security-hardening.test.ts tests/security-docs.test.ts
npx tsx --test tests/gemini-clean-home-smoke.test.ts
npm run test:integration:extension
```

Run `npm ci` first only in a fresh worktree with missing `node_modules`. The integration command requires Docker and may skip or block on host CLI/auth prerequisites; record the exact blocker instead of treating it as a source defect.

## Recommended Audit Shape

1. Host manifests and shared metadata: manifest fields, context files, host env, extensionPath-rooted MCP entrypoint, host metadata consistency, and runtime-contract coverage.
2. Build pipeline and generated assets: declaration emit, esbuild entrypoints, schema copying, tracked `dist` files, package scripts, build/typecheck/smoke target coverage, and generated asset freshness.
3. Advisory hooks: `hooks/hooks.json`, hook stdin/stdout contract, advisory-only behavior, shared security detector reuse, path handling, transcript parsing, and tests.
4. Install and clean-home smoke readiness: staged shipped bundle, forbidden repo-only path exclusions, link/install metadata, clean-home env, fake/live CLI gates, Docker/auth blockers, and smoke script cleanup.
5. Closeout: reconcile Phase 7 bugs, update the bug index slice row, verify no-fix discipline, and prepare validation.

## Validation Architecture

Phase 7 validation is artifact, test, and packaging-contract based.

- Each plan must preserve no-fix discipline: writes are limited to `docs/bugs/*.md`, `docs/bugs/INDEX.md`, and Phase 7 planning/execution artifacts under `.planning/phases/07-host-packaging-build-hooks-audit/`.
- Each bug report must follow `docs/bugs/TEMPLATE.md` and cite concrete evidence from file paths, command output, test names, generated asset comparisons, or docs/runtime contract mismatches.
- At least one targeted packaging, build, hook, or smoke test command should be run per plan, or the environment blocker must be recorded.
- Install probes must use disposable staging roots, clean homes, fake CLIs, containers, or explicit `--keep-home` cleanup notes; no installed extension directory or host-global `~/.gemini/blueprint/` or `~/.tabnine/blueprint/` state may be mutated during discovery.
- Every plan must run `git status --short` before completion and document that no source, manifest, hook, test, build, generated asset, runtime `.blueprint/`, installed-extension, host-global, branch, PR, remote-service, or git-history change was applied by the audit.
- If tests fail, classify whether the failure is defect evidence, environment/dependency friction, Docker/auth/CLI availability, or unrelated pre-existing breakage.

## Risks And Mitigations

| Risk | Mitigation |
|------|------------|
| A build audit refreshes `dist/` and accidentally turns discovery into a generated-asset fix. | Plans may run `npm run build` as evidence, but must not keep generated changes as fixes; any freshness drift is documented as a bug candidate and generated changes are not committed as Phase 7 execution output. |
| Integration smoke mutates real host homes or installed extensions. | Use containerized tests, fake CLI tests, and temp clean homes; do not target real user homes or installed extension directories. |
| Hook behavior is mistaken for enforcement. | Plans explicitly require advisory `decision: "allow"` or `{}` behavior and compare hooks to MCP-owned enforcement docs. |
| Tabnine smoke is treated as failed because optional CLI setup is absent. | Record `BLUEPRINT_TABNINE_CLI_INSTALL_COMMAND` absence as an environment skip unless the shipped Tabnine manifest or metadata is itself defective. |
| Live Gemini smoke is treated as failed because auth is unavailable. | Record missing `GEMINI_API_KEY` as an environment skip unless local validation/link/list behavior exposes a packaging defect. |

## Deferrals

- Fixing any packaging, build, hook, generated asset, or install defect is deferred to a later repair milestone.
- Cross-cut docs/runtime drift and duplicated root causes across phases are deferred to Phase 8 unless they are directly tied to Phase 7 packaging or hook evidence.
- Final prioritization and deduplication across all bug reports is deferred to Phase 9.

## Research Complete

Phase 7 can be planned from this research, the Phase 7 roadmap slice, requirements, existing codebase map, and Phase 1 bug-reporting harness.

