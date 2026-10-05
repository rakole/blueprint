# Verification Guide

Pick verification by change type. Do not use a noisy broad suite as the only
signal when a focused contract test exists.

## Baseline

Fresh worktree:

```bash
npm ci
```

Canonical offline/source verification (build first, then every non-fixture `*.test.ts`
entrypoint exactly once):

```bash
npm test
```

The package-owned Node runner discovers files without shell glob expansion,
excludes `tests/fixtures/**`, and runs built-asset checks after the parallel
suite to isolate their shared `dist/` surface.

Production dependency security (requires advisory-network access):

```bash
npm run audit:production
```

This checks production dependencies only and fails on moderate, high, or
critical advisories while preserving npm's actionable audit output and exit
code. Keep it separate from `npm test` so canonical local verification remains
deterministic when the advisory service is unavailable.

Static TypeScript gate when code changed:

```bash
npm run typecheck
```

No lint script is currently defined in `package.json`.

## Docs-Only Changes

For this folder:

```bash
rg -n "d[o]cs/" agent-docs
rg -n "GSD|gsd|/blu-" agent-docs
rg -n "npm ci|implemented|MCP|worktree|gh" agent-docs
```

Interpretation:

- The first command should not find required dependency references to the
  legacy documentation tree.
- The second command should show GSD only as a forbidden development workflow
  and slash commands only as host commands, not shell commands.
- The third command should confirm the core safety vocabulary is present.

No build is required for docs-only changes unless examples, tests, or scripts
are added.

## TypeScript Or MCP Tool Changes

Run:

```bash
npm run typecheck
npx tsx --test tests/<focused-area>.test.ts
```

The package-owned equivalent for one or more focused files is:

```bash
npm run test:focused -- tests/<focused-area>.test.ts
```

Add `npm test` when the change touches shared runtime behavior, catalog status,
path safety, artifact contracts, or command routing.

Useful focused MCP/runtime tests:

```bash
npx tsx --test tests/mcp-server-summary.test.ts
npx tsx --test tests/mcp-write-failure-logging.test.ts
npx tsx --test tests/security-hardening.test.ts
```

## Command, Skill, Or Agent Metadata Changes

Common focused tests:

```bash
npx tsx --test tests/command-catalog.test.ts
npx tsx --test tests/extension-runtime-contracts.test.ts
npx tsx --test tests/*-metadata.test.ts
npx tsx --test tests/skill-metadata.test.ts
npx tsx --test tests/agent-schema.test.ts
npx tsx --test tests/optional-agent-validity.test.ts
npx tsx --test tests/opencode-command-catalog.test.ts
npx tsx --test tests/opencode-package.test.ts
```

Choose the matching command-family tests rather than running every metadata
test by reflex.

## Artifact, Phase, Review, Or Report Changes

Use focused tests for the touched domain:

- artifact contracts: `tests/artifact-contracts.test.ts`
- artifact validation: `tests/artifact-validate-runtime.test.ts`
- phase planning: `tests/phase-planning-tools.test.ts`
- phase plan hardening: `tests/phase-plan-validation-hardening.test.ts`
- execution summaries: `tests/execute-phase-summary-tools.test.ts`
- review tools: `tests/review-slice.test.ts`
- mutation logging: `tests/mcp-write-failure-logging.test.ts`
- path and prompt-boundary safety: `tests/security-hardening.test.ts`

Add `npm test` when the contract affects multiple command families.

## Build, Package, Or Host Changes

Run:

```bash
npm run build
npm run test:focused -- tests/opencode-package.test.ts tests/runtime-host.test.ts
```

Actual OpenCode launch is opt-in and separate from `npm test`:

```bash
BLUEPRINT_OPENCODE_BIN=/absolute/path/to/opencode \
BLUEPRINT_OPENCODE_SOURCE=/absolute/path/to/opencode-source \
npm run test:integration:opencode
```

This installs the exact local tarball into a disposable prefix and loads the
installed `file://` entry in isolated roots. A skipped probe means host behavior
is unqualified; it is neither a package failure nor a readiness success.

Lifecycle verification must additionally cover install, upgrade, status,
rollback and uninstall from the packed tarball, outside the checkout. Use an
absolute config path and a separate absolute customer `cwd`. Assert that:

- strict JSON config surgery preserves unrelated bytes and plugin entries;
- JSON-with-comments and ambiguous ownership fail without changing config;
- active and previous generations follow the ledger across upgrade and rollback;
- interrupted transactions recover or stop honestly under the directory lock;
- uninstall removes only known owned files and refuses unknown content;
- customer `.blueprint/`, `BLUEPRINT_GLOBAL_HOME`, credentials and unrelated
  OpenCode configuration remain unchanged; and
- `status` describes configured package intent without claiming that a running
  process has loaded it.

Run the helper's `--help` from the packed package before publishing command
examples. A source/offline lifecycle pass does not qualify the OpenCode host.
The actual-host gate remains opt-in and requires evidence from the exact pinned
host binary; model-driven commands remain a separate gate.

## Workspace And Maintenance Changes

Use focused tests such as:

- `tests/maintenance-regression.test.ts`
- `tests/workspace-tools.test.ts`
- `tests/workstream-tools.test.ts`
- `tests/update-tools.test.ts`
- `tests/patch-tools.test.ts`
- `tests/cleanup-tools.test.ts`
- `tests/cleanup-behavior.test.ts`
- the matching `*-metadata.test.ts`

## Reporting Verification

Always report:

- Commands run.
- Pass or fail result.
- Skipped checks and why.
- Any unrelated baseline warning, such as existing audit findings.
- Evidence class: source/offline, package, or actual host.
