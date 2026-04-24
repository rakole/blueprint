# Testing Patterns

**Analysis Date:** 2026-04-24

## Test Framework

**Runner:**
- Node test runner via `node:test` with TypeScript execution through `tsx` (`tests/*.ts`, `package.json` script `test`).
- Config: No separate Jest/Vitest config file detected (`jest.config.*` and `vitest.config.*` absent).

**Assertion Library:**
- `node:assert/strict` (examples: `tests/next.test.ts`, `tests/update-tools.test.ts`, `tests/extension-install.integration.ts`).

**Run Commands:**
```bash
npm test                                  # Runs build first, then tsx --test tests/**/*.test.ts
npm run test:integration:extension        # Runs build, then tests/extension-install.integration.ts
npm run smoke:gemini-clean-home           # Host smoke script from scripts/gemini-clean-home-smoke.mjs
```

## Test File Organization

**Location:**
- Tests are centralized in `tests/` (not colocated with `src/`), with helpers in `tests/helpers/` and fixtures in `tests/fixtures/`.

**Naming:**
- Main pattern: `*.test.ts` (examples: `tests/roadmap-tools.test.ts`, `tests/phase-planning-tools.test.ts`).
- Integration pattern: `*.integration.ts` (example: `tests/extension-install.integration.ts`).
- Metadata/regression naming uses explicit suffixes (`*-metadata.test.ts`, `*-slice.test.ts`) across `tests/`.

**Structure:**
```text
tests/
  *.test.ts
  *.integration.ts
  helpers/
    extension-hosts.ts
  fixtures/
    map-codebase/
    new-project/
    help-progress-health/
    settings-profile/
```

## Test Structure

**Suite Organization:**
```typescript
import test from "node:test";
import assert from "node:assert/strict";

test("behavior statement", async (t) => {
  const repoPath = await createFixtureRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  const result = await toolCall({ cwd: repoPath });
  assert.equal(result.status, "created");
});
```
- Pattern appears across `tests/roadmap-tools.test.ts`, `tests/map-codebase.test.ts`, and `tests/update-tools.test.ts`.

**Patterns:**
- Setup pattern: per-test temp repo creation with `mkdtemp`, `mkdir`, `writeFile` (examples: `createRoadmapRepo` in `tests/roadmap-tools.test.ts`, `createPhaseRepo` in `tests/phase-plan-validation-hardening.test.ts`).
- Teardown pattern: `t.after(...)` cleanup with recursive `rm` (examples: `tests/new-project.test.ts`, `tests/lifecycle-pilot-integration.test.ts`).
- Assertion pattern: contract-heavy `assert.match`, `assert.equal`, `assert.deepEqual`, and rejection checks via `assert.rejects` (examples: `tests/command-contract-docs.test.ts`, `tests/update-tools.test.ts`).

## Mocking

**Framework:** `node:test` built-in mocking (`t.mock.method`).

**Patterns:**
```typescript
const realWriteFile = fs.writeFile.bind(fs);
t.mock.method(fs, "writeFile", async (filePath, data, options) => {
  if (String(filePath).includes("update-plan-latest.md.tmp-")) {
    throw new Error("simulated checklist write failure");
  }
  return realWriteFile(filePath as any, data as any, options as any);
});
```
- Concrete usage in `tests/update-tools.test.ts`.

**What to Mock:**
- Mock narrow failure seams when validating fallback behavior (example: filesystem write failures in `tests/update-tools.test.ts`).
- Override environment variables in scoped helpers for host/runtime switching (example: `withUpdateEnv` in `tests/update-tools.test.ts`).

**What NOT to Mock:**
- Avoid mocking core MCP tool handlers; tests invoke real handlers directly (examples: `blueprintRoadmapAddPhase` in `tests/roadmap-tools.test.ts`, `blueprintProjectInit` in `tests/new-project.test.ts`).
- Avoid in-memory fake filesystems; tests primarily use real temp directories and real file IO (pattern across `tests/*tools.test.ts` and `tests/*integration.test.ts`).

## Fixtures and Factories

**Test Data:**
```typescript
async function createRepoFromFixture(fixtureName: string): Promise<string> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blueprint-new-project-"));
  const repoPath = path.join(tempRoot, "repo");
  await mkdir(repoPath, { recursive: true });
  await writeFile(path.join(repoPath, ".git"), "gitdir: ./.git/worktree-placeholder\n", "utf8");
  await cpFixtureContents(path.join(fixtureRoot, fixtureName), repoPath);
  return repoPath;
}
```
- Pattern used in `tests/new-project.test.ts` and similarly in `tests/map-codebase.test.ts`.

**Location:**
- Static fixtures live under `tests/fixtures/` (examples: `tests/fixtures/map-codebase/brownfield-repo/`, `tests/fixtures/new-project/`).
- Dynamic fixtures are built inline per file through `create*Repo` helpers (examples: `tests/roadmap-tools.test.ts`, `tests/mcp-write-failure-logging.test.ts`).

## Coverage

**Requirements:** None enforced by tooling.
- No coverage threshold/config file detected in repo root (`package.json`, absence of Jest/Vitest configs).

**View Coverage:**
```bash
Not configured (no coverage script in package.json)
```

## Test Types

**Unit Tests:**
- Metadata and contract assertions for manifests, docs, skill ownership, and command catalog integrity (examples: `tests/command-catalog.test.ts`, `tests/command-contract-docs.test.ts`, `tests/extension-runtime-contracts.test.ts`).

**Integration Tests:**
- Tool-level integration using temporary repositories and real artifact files (examples: `tests/roadmap-tools.test.ts`, `tests/phase-validation-slice.test.ts`, `tests/lifecycle-pilot-integration.test.ts`).
- Install/runtime integration in containers validates extension packaging behavior (example: `tests/extension-install.integration.ts` using `testcontainers`).

**E2E Tests:**
- No browser/UI E2E framework detected.
- CLI install and host smoke behavior are covered via container and smoke scripts (`tests/extension-install.integration.ts`, `scripts/gemini-clean-home-smoke.mjs`).

## Common Patterns

**Async Testing:**
```typescript
await assert.rejects(
  blueprintRoadmapAddPhase({ cwd: repoPath, description: "X", expectedPhaseNumber: "4" }),
  /Confirmed next phase 4 no longer matches the live next phase 3/
);
```
- Pattern in `tests/roadmap-tools.test.ts` and many failure-mode tests.

**Error Testing:**
```typescript
const result = await executeToolHandlerWithFailureLogging(definition, args);
assert.equal(result.status, "invalid");
const [entry] = await readFailureLogEntries(repoPath);
assert.equal(entry.failureKind, "rejected");
```
- Pattern in `tests/mcp-write-failure-logging.test.ts`.

---

*Testing analysis: 2026-04-24*
