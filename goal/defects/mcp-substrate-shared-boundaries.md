# MCP Substrate Shared Boundaries Audit

Date: 2026-05-23
Scope: shared MCP substrate only: server adapter, response shaping, command runtime resources, tool registry, mutation failure logging, runtime-host/global-state boundaries, shared security helpers, and artifact contract exposure.

## Verdict

I confirmed three cross-cutting defects in the shared MCP substrate:

1. Hidden god-review mode is directly callable by any MCP client that can fabricate the activation arguments.
2. Mutation failure logging has two real blind spots: `blueprint_phase_ui_skip_write` is not treated as a mutation tool, and several hidden god-review failure statuses never trigger logging.
3. Runtime host resolution is internally inconsistent because some paths use a cached host snapshot while others resolve the current environment on demand.

I also re-checked the adjacent high-risk boundaries the goal called out and did not find a stronger defect claim in:

- `content` vs `structuredContent` parity
- built-vs-source server export parity
- runtime-contract resource exposure for implemented commands
- fake `.git`, worktree, symlink-escape, and oversized-JSON hardening
- public runtime-contract leakage of hidden god-review details

## Audited Surfaces

- `src/mcp/server-runtime.ts`
  - `createBlueprintServer` lines 10-36
- `src/mcp/tool-definitions.ts`
  - `TOOL_DEFINITIONS` lines 13-24
- `src/mcp/tools/god-review.ts`
  - hidden-substrate comment lines 18-30
  - `evaluateGodReviewActivation` lines 619-656
  - `blueprintGodReviewStart` lines 3048-3090
  - `godReviewToolDefinitions` lines 4340-4388
- `src/mcp/mutation-failure-logging.ts`
  - `BLUEPRINT_MUTATION_TOOL_NAMES` lines 8-42
  - `MUTATION_FAILURE_STATUSES` lines 43-50
  - `shouldLogMutationFailure` lines 56-75
  - `executeToolHandlerWithFailureLogging` lines 77-95
- `src/mcp/tools/phase.ts`
  - `blueprintPhaseUiSkipWrite` lines 9027-9039
  - `phaseToolDefinitions` registration lines 12285-12292
- `src/mcp/runtime-host.ts`
  - `buildRuntimeHost` lines 71-98
  - `resolveBlueprintRuntimeHost` lines 100-103
  - `getBlueprintRuntimeHost` lines 106-108
- `src/mcp/tools/config.ts`
  - cached-host call sites lines 208-209, 282-295
- `src/mcp/tools/update.ts`
  - uncached-host call site lines 603-609
- `src/mcp/tools/workspace.ts`
  - uncached-host call sites lines 2731-2755
- `src/mcp/command-resources.ts`
  - implemented-only resource gating lines 231-233
  - runtime-contract list/read lines 312-383
- Focused tests and probes
  - `tests/god-review-substrate.test.ts` lines 234-256
  - `tests/god-review-public-leak.test.ts` lines 77-101
  - `tests/mcp-write-failure-logging.test.ts` lines 150-210
  - `tests/security-hardening.test.ts` lines 281-346

## Confirmed Defects

### 1. High: hidden god-review mode is caller-spoofable through the shared MCP registry

- Files/functions:
  - `src/mcp/server-runtime.ts:createBlueprintServer`
  - `src/mcp/tool-definitions.ts:TOOL_DEFINITIONS`
  - `src/mcp/tools/god-review.ts:evaluateGodReviewActivation`
  - `src/mcp/tools/god-review.ts:blueprintGodReviewStart`
  - `src/mcp/tools/god-review.ts:godReviewToolDefinitions`
- Exact source evidence:
  - The shared server registers every entry in `TOOL_DEFINITIONS` without a public/private filter (`src/mcp/server-runtime.ts:18-34`).
  - `TOOL_DEFINITIONS` explicitly includes `godReviewToolDefinitions` (`src/mcp/tool-definitions.ts:13-24`).
  - The god-review module itself says these helpers are "intentionally registered on the shared MCP substrate" and that privacy means "hidden-branch-only, not invisible" (`src/mcp/tools/god-review.ts:18-30`).
  - Activation trusts only caller-supplied `activeCommand` and `rawInvocation` strings (`src/mcp/tools/god-review.ts:619-656`); there is no host-provided provenance check.
  - `blueprintGodReviewStart` accepts that activation result and proceeds to write session/report/state artifacts (`src/mcp/tools/god-review.ts:3059-3090`).
  - The repo’s own substrate test intentionally locks that these private tools remain callable MCP tools (`tests/god-review-substrate.test.ts:234-256`).
- Minimal repro / proof:

```sh
npx tsx <<'EOF'
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { createCommittedGitRepo, runGit } from './tests/helpers/git-fixtures.ts';
import { blueprintGodReviewStart } from './src/mcp/tools/god-review.ts';

const PHASE_DIR = '.blueprint/phases/05-god-review';
const repoPath = await createCommittedGitRepo('god-review-direct-call-');
try {
  const phaseDir = path.join(repoPath, PHASE_DIR);
  await mkdir(path.join(repoPath, 'src'), { recursive: true });
  await mkdir(path.join(repoPath, 'tests'), { recursive: true });
  await mkdir(phaseDir, { recursive: true });
  await writeFile(path.join(repoPath, '.blueprint/PROJECT.md'), '# Project\n', 'utf8');
  await writeFile(path.join(repoPath, '.blueprint/REQUIREMENTS.md'), '# Requirements\n', 'utf8');
  await writeFile(path.join(repoPath, '.blueprint/ROADMAP.md'), '# Roadmap: Fixture\n\n## Milestone\n\n- Active milestone: v1\n\n## Phases\n\n- [x] **Phase 5: God Review** - Completed implementation ready for review\n\n## Phase Details\n\n### Phase 5: God Review\n**Goal**: Review the changed files.\n**Requirements**: GOD-01\n**Status**: completed\n', 'utf8');
  await writeFile(path.join(repoPath, '.blueprint/STATE.md'), '# Blueprint State\n\n- Project status: initialized\n- Current milestone: v1\n- Current phase: 5\n- Active command: /blu-progress\n- Next action: Run /blu-code-review 5\n- Last updated: 2026-05-11T00:00:00.000Z\n\n## Blockers\n\n- none\n', 'utf8');
  await writeFile(path.join(repoPath, '.blueprint/config.json'), '{\n  "version": 2\n}\n', 'utf8');
  await writeFile(path.join(repoPath, 'src/feature.ts'), 'export const value = 1;\n', 'utf8');
  await writeFile(path.join(repoPath, 'tests/feature.test.ts'), 'export {};\n', 'utf8');
  await writeFile(path.join(phaseDir, '05-01-PLAN.md'), '---\nphase: 5\nplan_id: "01"\ntitle: "God Review Scope"\nwave: 1\nstatus: done\nobjective: "Review the changed repo files."\ndepends_on: []\nrequirements:\n  - GOD-01\nfiles_modified:\n  - src/feature.ts\n  - tests/feature.test.ts\nread_first:\n  - src/feature.ts\nacceptance_criteria:\n  - npm test -- tests/feature.test.ts\nautonomous: true\n---\n\n# Phase 05: God Review Scope - Plan 01\n\n## Goal\n\nReview the changed repo files.\n', 'utf8');
  await writeFile(path.join(phaseDir, '05-01-SUMMARY.md'), '# Phase 05 Summary\n\n## Status\n\nCOMPLETED\n\n## Changes Made\n\n- Updated `src/feature.ts`.\n- Updated `tests/feature.test.ts`.\n', 'utf8');
  await writeFile(path.join(phaseDir, '05-REVIEW.md'), '# Existing Normal Review\n', 'utf8');
  await writeFile(path.join(phaseDir, '05-REVIEW-FIX.md'), '# Existing Normal Review Fix\n', 'utf8');
  await runGit(['add', '.'], repoPath);
  await runGit(['commit', '-m', 'fixture'], repoPath);

  const result = await blueprintGodReviewStart({
    cwd: repoPath,
    activeCommand: '/blu-code-review',
    rawInvocation: '/blu-code-review 5 --feels-like-god',
    scopeKind: 'phase',
    phase: 5
  });

  const state = await readFile(path.join(repoPath, result.humanStatePath ?? ''), 'utf8');
  console.log(JSON.stringify({
    status: result.status,
    written: result.written,
    sessionPath: result.sessionPath,
    humanStatePath: result.humanStatePath,
    reportPath: result.reportPath,
    files: result.files,
    statePreview: state.split('\n').slice(0, 4)
  }, null, 2));
} finally {
  await rm(path.dirname(repoPath), { recursive: true, force: true });
}
EOF
```

- Observed result:
  - `status: "started"`
  - `written: true`
  - `.god-review-session.json`, `.god-review-state.md`, and `05-GOD-REVIEW.md` were created
  - the fixture `STATE.md` still said `Active command: /blu-progress`, proving the hidden-mode gate trusted the tool arguments, not trusted runtime provenance
- Expected vs actual:
  - Expected: hidden review/fix mode should be unreachable from a generic MCP client, or at minimum require server-side provenance stronger than caller-supplied strings.
  - Actual: any client that can call MCP tools can fabricate `/blu-code-review ... --feels-like-god` arguments and start the hidden review flow.
- Affected fan-out surface:
  - shared tool registry
  - hidden review/fix session state under `.blueprint/`
  - any client that consumes the generic MCP tool list rather than only documented slash commands
- Residual uncertainty:
  - If some host filters tool visibility before the model sees the registry, blast radius is smaller there. The server-side substrate itself does not enforce that boundary.

### 2. High: mutation failure journaling misses both an entire write tool and several real failure statuses

- Files/functions:
  - `src/mcp/mutation-failure-logging.ts:BLUEPRINT_MUTATION_TOOL_NAMES`
  - `src/mcp/mutation-failure-logging.ts:shouldLogMutationFailure`
  - `src/mcp/tools/phase.ts:blueprintPhaseUiSkipWrite`
  - `src/mcp/tools/god-review.ts` result status unions and refusal/stale returns
- Exact source evidence:
  - `BLUEPRINT_MUTATION_TOOL_NAMES` omits `blueprint_phase_ui_skip_write` even though the phase tool registry exposes it (`src/mcp/mutation-failure-logging.ts:8-42`, `src/mcp/tools/phase.ts:12285-12292`).
  - `blueprintPhaseUiSkipWrite` is a pure write wrapper that delegates straight into `blueprintPhaseArtifactWrite` (`src/mcp/tools/phase.ts:9027-9039`).
  - `shouldLogMutationFailure` only logs status values in `{invalid, project_missing, not_found, blocked, rejected, error}` plus `_delete` `deleted: false` (`src/mcp/mutation-failure-logging.ts:43-75`).
  - Hidden god-review mutation result types explicitly include `refused` and `stale` (`src/mcp/tools/god-review.ts:375-487`), and `blueprintGodReviewStart` returns `status: "refused"` before any repo checks (`src/mcp/tools/god-review.ts:3059-3086`).
  - Existing logging tests cover only `blueprint_phase_artifact_write` invalid/exception paths, not these gaps (`tests/mcp-write-failure-logging.test.ts:150-210`).
- Minimal repro / proof A: missing mutation tool entry drops thrown UI-skip write failures entirely

```sh
npx tsx <<'EOF'
import { mkdir, writeFile, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { createGitRepo } from './tests/helpers/git-fixtures.ts';
import { executeToolHandlerWithFailureLogging } from './src/mcp/server.ts';
import { blueprintPhaseUiSkipWrite } from './src/mcp/tools/phase.ts';
import { MCP_WRITE_FAILURE_LOG_PATH } from './src/mcp/write-failure-log.ts';

const repoPath = await createGitRepo('phase-ui-skip-log-gap-');
try {
  await mkdir(path.join(repoPath, '.blueprint/phases/03-phase-discovery'), { recursive: true });
  await writeFile(path.join(repoPath, '.blueprint/PROJECT.md'), '# Project\n', 'utf8');
  await writeFile(path.join(repoPath, '.blueprint/REQUIREMENTS.md'), '# Requirements\n', 'utf8');
  await writeFile(path.join(repoPath, '.blueprint/ROADMAP.md'), '# Roadmap: Fixture\n\n## Milestone\n\n- Active milestone: v1\n\n## Phases\n\n- [ ] **Phase 3: Phase Discovery**\n', 'utf8');
  await writeFile(path.join(repoPath, '.blueprint/STATE.md'), '# Blueprint State\n\n- Project status: initialized\n- Current milestone: v1\n- Current phase: 3\n- Active command: /blu-progress\n- Next action: Run /blu-progress\n- Last updated: 2026-04-11T00:00:00.000Z\n\n## Blockers\n\n- none\n', 'utf8');
  await writeFile(path.join(repoPath, '.blueprint/config.json'), '{\n  "version": 2\n}\n', 'utf8');

  let thrown = null;
  try {
    await executeToolHandlerWithFailureLogging(
      {
        name: 'blueprint_phase_ui_skip_write',
        description: 'fixture',
        handler: async (args) => blueprintPhaseUiSkipWrite(args)
      },
      {
        cwd: repoPath,
        phase: '99',
        skipRationale: 'No UI work.',
        overwrite: true
      }
    );
  } catch (error) {
    thrown = error instanceof Error ? error.message : String(error);
  }

  let logExists = true;
  try { await access(path.join(repoPath, MCP_WRITE_FAILURE_LOG_PATH)); } catch { logExists = false; }
  console.log(JSON.stringify({ thrown, logExists }, null, 2));
} finally {
  await rm(path.dirname(repoPath), { recursive: true, force: true });
}
EOF
```

- Observed result A:
  - thrown error: `Phase 99 was not found in .blueprint/ROADMAP.md.`
  - `logExists: false`
- Minimal repro / proof B: real god-review mutation failures with `refused` or `stale` never log

```sh
npx tsx <<'EOF'
import { executeToolHandlerWithFailureLogging } from './src/mcp/server.ts';
import { blueprintGodReviewStart } from './src/mcp/tools/god-review.ts';
import { createGitRepo } from './tests/helpers/git-fixtures.ts';
import { mkdir, writeFile, access, rm } from 'node:fs/promises';
import path from 'node:path';
import { MCP_WRITE_FAILURE_LOG_PATH } from './src/mcp/write-failure-log.ts';

const repoPath = await createGitRepo('god-review-refused-log-gap-');
try {
  await mkdir(path.join(repoPath, '.blueprint'), { recursive: true });
  await writeFile(path.join(repoPath, '.blueprint/PROJECT.md'), '# Project\n', 'utf8');
  await writeFile(path.join(repoPath, '.blueprint/REQUIREMENTS.md'), '# Requirements\n', 'utf8');
  await writeFile(path.join(repoPath, '.blueprint/ROADMAP.md'), '# Roadmap: Fixture\n', 'utf8');
  await writeFile(path.join(repoPath, '.blueprint/STATE.md'), '# Blueprint State\n', 'utf8');
  await writeFile(path.join(repoPath, '.blueprint/config.json'), '{\n  "version": 2\n}\n', 'utf8');

  const result = await executeToolHandlerWithFailureLogging(
    {
      name: 'blueprint_god_review_start',
      description: 'fixture',
      handler: async (args) => blueprintGodReviewStart(args)
    },
    {
      cwd: repoPath,
      activeCommand: '/blu-code-review',
      rawInvocation: '/blu-code-review 5',
      scopeKind: 'phase',
      phase: 5
    }
  );

  let logExists = true;
  try { await access(path.join(repoPath, MCP_WRITE_FAILURE_LOG_PATH)); } catch { logExists = false; }
  console.log(JSON.stringify({ status: result.status, reason: result.reason, logExists }, null, 2));
} finally {
  await rm(path.dirname(repoPath), { recursive: true, force: true });
}
EOF
```

- Observed result B:
  - `status: "refused"`
  - `reason: "Raw invocation does not contain the standalone hidden god-review flag token."`
  - `logExists: false`
- Helper proof:

```sh
npx tsx <<'EOF'
import { isMutationTool, shouldLogMutationFailure } from './src/mcp/mutation-failure-logging.ts';
const cases = [
  { tool: 'blueprint_phase_ui_skip_write', result: { status: 'invalid' } },
  { tool: 'blueprint_god_review_start', result: { status: 'refused' } },
  { tool: 'blueprint_god_review_append', result: { status: 'stale' } },
  { tool: 'blueprint_god_review_record_fix', result: { status: 'stale' } },
  { tool: 'blueprint_workspace_remove', result: { status: 'blocked' } },
];
console.log(JSON.stringify(cases.map(({ tool, result }) => ({
  tool,
  status: result.status,
  isMutationTool: isMutationTool(tool),
  shouldLog: shouldLogMutationFailure(tool, result)
})), null, 2));
EOF
```

- Observed helper output:
  - `blueprint_phase_ui_skip_write`: `isMutationTool: false`, `shouldLog: false`
  - `blueprint_god_review_start` with `refused`: `isMutationTool: true`, `shouldLog: false`
  - `blueprint_god_review_append` with `stale`: `isMutationTool: true`, `shouldLog: false`
  - control case `blueprint_workspace_remove` with `blocked`: `shouldLog: true`
- Expected vs actual:
  - Expected: every mutating write path and every durable mutation refusal/stale blocker should land in `.blueprint/mcp-write-failures.ndjson`.
  - Actual: one real write tool bypasses mutation classification completely, and some classified mutation tools return unlogged failure statuses.
- Affected fan-out surface:
  - phase UI-skip persistence
  - hidden god-review review/fix lifecycle
  - any downstream audit or forensic process that relies on `.blueprint/mcp-write-failures.ndjson`
- Residual uncertainty:
  - I did not prove a non-hidden, non-god-review mutation tool returning another uncovered status. The shared helper gap itself is confirmed.

### 3. Medium: runtime host derivation is inconsistent because cached and uncached helpers coexist

- Files/functions:
  - `src/mcp/runtime-host.ts:getBlueprintRuntimeHost`
  - `src/mcp/runtime-host.ts:resolveBlueprintRuntimeHost`
  - `src/mcp/tools/config.ts`
  - `src/mcp/tools/update.ts`
  - `src/mcp/tools/workspace.ts`
- Exact source evidence:
  - `getBlueprintRuntimeHost` memoizes the first computed host forever (`src/mcp/runtime-host.ts:106-108`).
  - `resolveBlueprintRuntimeHost` always rebuilds from the supplied environment (`src/mcp/runtime-host.ts:100-103`).
  - Config defaults and host-specific patch-registry alignment use the cached helper (`src/mcp/tools/config.ts:208-209`, `src/mcp/tools/config.ts:282-295`).
  - Update and workspace paths use the uncached helper (`src/mcp/tools/update.ts:603-609`, `src/mcp/tools/workspace.ts:2731-2755`).
- Minimal repro / proof:

```sh
npx tsx <<'EOF'
import { getBlueprintRuntimeHost, resolveBlueprintRuntimeHost } from './src/mcp/runtime-host.ts';
process.env.BLUEPRINT_HOST = 'tabnine';
process.env.BLUEPRINT_GLOBAL_HOME = '/tmp/first-home';
const first = getBlueprintRuntimeHost();
process.env.BLUEPRINT_HOST = 'gemini';
process.env.BLUEPRINT_GLOBAL_HOME = '/tmp/second-home';
const second = getBlueprintRuntimeHost();
const fresh = resolveBlueprintRuntimeHost(process.env);
console.log(JSON.stringify({
  firstHost: first.host,
  secondHost: second.host,
  freshHost: fresh.host,
  firstHome: first.globalBlueprintDir,
  secondHome: second.globalBlueprintDir,
  freshHome: fresh.globalBlueprintDir
}, null, 2));
EOF
```

- Observed result:
  - cached path: first host `tabnine`, second host still `tabnine`
  - fresh path: host `gemini`
  - cached global dir stayed `/tmp/first-home`
  - fresh global dir became `/tmp/second-home`
- Expected vs actual:
  - Expected: all host-derived defaults within one process should resolve from one coherent source of truth.
  - Actual: config can keep an old host/global-home snapshot while update/workspace resolve a different one in the same process.
- Affected fan-out surface:
  - default config path
  - maintenance patch registry alignment
  - workspace registry and patch registry location
  - update inspection of extension path / manifest path
- Residual uncertainty:
  - Production extension processes may treat these env vars as immutable after startup, which lowers real-world frequency. The same-process inconsistency is still source-proven.

## Near-Misses And No-Defect Checks

### Runtime-contract resource exposure held on the implemented-only boundary

- Evidence:
  - implemented-only gating is explicit in `src/mcp/command-resources.ts:231-233`
  - runtime-owned fallback rows are merged before listing/building resources (`src/mcp/command-resources.ts:253-383`)
  - public leak tests verify hidden god-review tokens do not appear in public docs, router guidance, catalog payloads, or runtime-contract payloads (`tests/god-review-public-leak.test.ts:77-101`)
- Direct probe:

```sh
npx tsx <<'EOF'
import { blueprintCommandCatalog } from './src/mcp/tools/project.ts';
import { listBlueprintCommandRuntimeContractCommands } from './src/mcp/command-resources.ts';
const catalog = await blueprintCommandCatalog();
const implemented = Object.entries(catalog.commands)
  .filter(([, entry]) => entry.status === 'implemented' && entry.implemented)
  .map(([name]) => name)
  .sort();
const runtimeCommands = await listBlueprintCommandRuntimeContractCommands();
console.log(JSON.stringify({
  implementedCount: implemented.length,
  runtimeContractCount: runtimeCommands.length,
  missing: implemented.filter((name) => !runtimeCommands.includes(name)),
  extra: runtimeCommands.filter((name) => !implemented.includes(name))
}, null, 2));
EOF
```

- Observed result:
  - `implementedCount: 54`
  - `runtimeContractCount: 54`
  - `missing: []`
  - `extra: []`
- Conclusion:
  - I could not prove runtime-contract resource leakage or omission in the current shared resource layer.

### Path/prompt hardening held for the explicit fake `.git`, worktree, symlink, and oversized-JSON edges

- Evidence:
  - `tests/security-hardening.test.ts:281-346` covers fake `.git` file, fake `.git` directory, real worktree roots, symlinked repo roots, and nested-directory rejection.
  - `tests/security-hardening.test.ts:270-278` covers oversized JSON rejection.
- Conclusion:
  - The shared hardening helpers held on the exact edge classes the goal called out. I did not find a stronger exploitable path-traversal or fake-worktree claim.

## Coverage Gaps Worth Follow-Up

1. No focused logging regression covers `blueprint_phase_ui_skip_write`.
   - Current positive coverage locks only `blueprint_phase_artifact_write` invalid/exception behavior (`tests/mcp-write-failure-logging.test.ts:150-210`).

2. No focused logging regression covers mutation-tool result statuses such as `refused` or `stale`.
   - Hidden god-review result unions advertise those statuses (`src/mcp/tools/god-review.ts:375-487`), but `tests/mcp-write-failure-logging.test.ts` never exercises them.

3. No regression test covers `getBlueprintRuntimeHost` cache semantics or mixed cached/uncached call sites.
   - I found no tests referencing `getBlueprintRuntimeHost` or `resolveBlueprintRuntimeHost` in `tests/`.

4. The current test suite intentionally locks callable god-review private tools, but it does not assert any trusted host provenance boundary.
   - `tests/god-review-substrate.test.ts:234-256` proves registry exposure, not safe provenance.

## Validation Executed

Executed exactly the requested validation surface, plus the read-only `tsx` probes above.

### Requested test batches

```sh
npx tsx --test tests/mcp-server-summary.test.ts tests/mcp-write-failure-logging.test.ts tests/built-assets-smoke.test.ts
npx tsx --test tests/maintenance-runtime-contract-resource.test.ts tests/review-runtime-contract-resource.test.ts tests/security-hardening.test.ts
npx tsx --test tests/update-tools.test.ts tests/workspace-tools.test.ts tests/artifact-contracts.test.ts tests/artifact-validate-runtime.test.ts
```

Observed result:

- Batch 1: 157 pass, 1 fail
- Batch 2: 12 pass, 0 fail
- Batch 3: 69 pass, 0 fail

### Existing unrelated failure surfaced during validation

- Failing test:
  - `tests/mcp-server-summary.test.ts:6857-6895`
  - `public config set profile live MCP response already matches the direct compact contract`
- Failure text:
  - `Blueprint project is not initialized. Initialize the repo first with /blu-new-project.`
- Exact mismatch:
  - the test fixture `createConfigSetRepo()` only creates `.blueprint/config.json` (`tests/mcp-server-summary.test.ts:1496-1506`)
  - `blueprintConfigSetProfile()` now hard-requires `inspection.readiness === "initialized"` (`src/mcp/tools/config.ts:1080-1089`)
- Scope note:
  - I did not widen this report into a config-tool defect because the goal asked for shared substrate fan-out issues, not direct config command behavior.
