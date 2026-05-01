# Testing Patterns

**Analysis Date:** 2026-05-01

## Test Framework

**Runner:**
- Node.js built-in test runner (`node:test`) executed through `tsx --test` (`package.json`, tests import `test` from `node:test` like `tests/update-tools.test.ts`).
- Config: No standalone runner config file detected; execution is driven by npm scripts in `package.json`.

**Assertion Library:**
- Node core assertions via `node:assert/strict` (example: `tests/update-tools.test.ts`).

**Run Commands:**
```bash
npm test                          # Build, then run tests/**/*.test.ts
npm run test:integration:extension # Build, then run tests/extension-install.integration.ts
npm run typecheck                  # TypeScript static check (often paired with tests)
```

## Test File Organization

**Location:**
- Tests live in a dedicated `tests/` directory (example suites: `tests/map-codebase.test.ts`, `tests/new-project.test.ts`).
- Fixtures live under `tests/fixtures/` and are copied into temporary repos during tests (examples: `tests/fixtures/map-codebase/*`, `tests/fixtures/new-project/*` as used by `tests/map-codebase.test.ts` and `tests/new-project.test.ts`).

**Naming:**
- Primary suite naming: `tests/**/*.test.ts` (wired by the `npm test` script in `package.json`).
- Integration suite naming: `tests/extension-install.integration.ts` (wired by `npm run test:integration:extension` in `package.json`).
- Contract-alignment suites use descriptive suffixes: `*-metadata.test.ts` and `*-slice.test.ts` (examples: `tests/ship-metadata.test.ts`, `tests/add-tests-slice.test.ts`).

**Structure:**
```
tests/
  *.test.ts
  *.integration.ts
  helpers/
  fixtures/
```

## Test Structure

**Suite Organization:**
```typescript
import test from "node:test";
import assert from "node:assert/strict";

test("does something", async (t) => {
  t.after(async () => {
    /* cleanup */
  });

  assert.equal(1, 1);
});
```
Pattern appears throughout `tests/` (example: `tests/update-tools.test.ts` uses `t.after(...)` for cleanup, `assert.*` for checks).

**Patterns:**
- Cleanup: prefer `t.after(async () => ...)` for per-test cleanup (example: `tests/update-tools.test.ts`).
- Async: tests are commonly `async` and use `await` with explicit assertions (examples: `assert.rejects(...)` in `tests/update-tools.test.ts`, `await`-heavy flows in `tests/map-codebase.test.ts`).
- Environment control: tests override `process.env` and restore it in `try/finally` helpers for isolation (example helper `withUpdateEnv()` in `tests/update-tools.test.ts`).

## Mocking

**Framework:** Node test runner’s mock facility (`t.mock`).

**Patterns:**
```typescript
t.mock.method(fs, "writeFile", async (...args) => {
  throw new Error("simulated failure");
});
```
Used sparingly (example: `tests/update-tools.test.ts`).

**What to Mock:**
- Narrow, failure-injection scenarios at I/O seams (example: mocking `fs.writeFile` to simulate persistence failures in `tests/update-tools.test.ts`).

**What NOT to Mock:**
- Most tool logic is exercised end-to-end through real filesystem operations in temporary directories (examples: fixture-copy tests in `tests/map-codebase.test.ts`, repo scaffolding in `tests/new-project.test.ts`).

## Fixtures and Factories

**Test Data:**
- Fixtures are stored in `tests/fixtures/` and copied recursively into a temp directory for test runs (example copy routine in `tests/map-codebase.test.ts`).
- Tests frequently create ephemeral repos and directories via `mkdtemp()` and `mkdir()` (examples: `tests/impact-tools.test.ts`, `tests/new-project.test.ts`).

**Location:**
- Fixture roots are built from `process.cwd()` and joined into `tests/fixtures/...` (examples: `fixtureRoot` constants in `tests/map-codebase.test.ts` and `tests/new-project.test.ts`).

## Coverage

**Requirements:** None enforced.

**View Coverage:**
- No coverage command is declared in `package.json`; there is no repo-level coverage configuration detected.

## Test Types

**Unit Tests:**
- Tool-level and contract-level checks validate deterministic outputs, status codes, and schema validation behavior (examples across `tests/*-tools.test.ts` and `tests/*-metadata.test.ts` using MCP tool handlers imported from `src/mcp/tools/*.js`).

**Integration Tests:**
- Containerized extension install and validation tests use `testcontainers` (example: `tests/extension-install.integration.ts` uses `GenericContainer` and `Wait`).

**E2E Tests:**
- Not detected as a separate framework (no Playwright/Cypress/etc. config or dependencies; E2E-like checks are covered by the integration container test `tests/extension-install.integration.ts`).

## Common Patterns

**Async Testing:**
```typescript
await assert.rejects(async () => {
  await someAsyncOperation();
});
```
Pattern appears in tests that validate failure handling and safety behavior (example usage in `tests/update-tools.test.ts`).

**Error Testing:**
- Prefer `assert.rejects(...)` for promise-based failure cases and `assert.throws(...)` for sync failure cases (examples in `tests/update-tools.test.ts` and other `tests/*.test.ts` suites).

---

*Testing analysis: 2026-05-01*

