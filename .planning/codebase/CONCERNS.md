# Codebase Concerns

**Analysis Date:** 2026-05-01

## Tech Debt

**Monolithic MCP tool modules:**
- Issue: Several MCP tool files concentrate multiple responsibilities (parsing, IO, validation, rendering, domain policy), which raises change risk and makes incremental refactors hard.
- Files: `src/mcp/tools/phase.ts`, `src/mcp/tools/artifacts.ts`, `src/mcp/tools/review.ts`, `src/mcp/tools/impact.ts`, `src/mcp/tools/workspace.ts`
- Impact: Higher regression probability for routine changes, slower reviews, and higher barrier to adding new commands/tools safely.
- Fix approach: Split by subdomain (e.g., “roadmap parsing”, “phase artifact IO”, “impact scope resolution”, “dependency graph”, “ownership resolution”) into internal modules under `src/mcp/tools/` or a sibling folder (keeping the exported tool handlers thin wrappers).

**Regex-driven Markdown parsing as a primary parser:**
- Issue: Multiple flows parse and mutate Markdown using regex/line heuristics (headings, tables, bullet sections).
- Files: `src/mcp/tools/phase.ts`, `src/mcp/tools/artifacts.ts`, `src/mcp/tools/workspace.ts`
- Impact: Format drift (extra spacing, reordered headings, unexpected Markdown constructs) can cause silent mis-parses, destructive edits, or confusing error messages.
- Fix approach: Centralize Markdown section parsing helpers (single implementation + shared tests) and tighten invariants around “canonical headings/markers” already enforced in `src/mcp/artifact-contracts/index.ts`.

**Deep-clone via JSON stringify/parse:**
- Issue: `JSON.parse(JSON.stringify(...))` is used as a general-purpose clone.
- Files: `src/mcp/tools/config.ts`, `src/mcp/tools/impact.ts`, `src/mcp/tools/review.ts`, `src/mcp/tools/phase.ts`, `src/mcp/tools/artifacts.ts`, `src/mcp/artifact-contracts/index.ts`
- Impact: Drops `undefined`, loses non-JSON types, and adds avoidable CPU/memory overhead in hot paths (notably impact analysis and large artifact validations).
- Fix approach: Replace with `structuredClone` (Node 20+) for JSON-like objects where safe, or implement explicit copy/normalize functions per domain type.

**Schema validation configured permissively:**
- Issue: AJV is instantiated with permissive settings for schema validation.
- Files: `src/mcp/tools/impact.ts`
- Impact: Schema drift or unexpected properties can slip through until later rendering/consumption, making failures harder to localize.
- Fix approach: Keep permissive mode where needed for compatibility, but emit explicit warnings when unknown keys appear (the config already has `KNOWN_IMPACT_CONFIG_TOP_LEVEL_KEYS` in `src/mcp/tools/impact.ts`).

**Operational scripts as parallel state channels:**
- Issue: Drift-repair coordination script stores shared state outside git by default.
- Files: `scripts/drift-fix-memory.mjs`
- Impact: Harder-to-audit changes, potential confusion when local/global state diverges, and risk of stale coordination data affecting later runs.
- Fix approach: Keep this script explicitly “out-of-band,” but ensure docs and runtime do not rely on it; consider adding a cleanup/expiry policy (the script already provides `cleanup`).

## Known Bugs

**Test-only failure injection toggles in production code paths:**
- Symptoms: Workspace registry writes can be forced to fail if specific environment variables are set.
- Files: `src/mcp/tools/workspace.ts`
- Trigger: Setting `BLUEPRINT_TEST_FAIL_WORKSPACE_REGISTRY_WRITE_ONCE` (and related timing knobs like `BLUEPRINT_TEST_WORKSPACE_REGISTRY_LOCK_*`) in a real environment.
- Workaround: Ensure test-only env vars are never set in normal usage; consider guarding these behind an explicit “test mode” check in `src/mcp/runtime-host.ts`.

**Repo-root detection is existence-based only:**
- Symptoms: Repo-root enforcement is based on the presence of a `.git` entry, not on validating git repository structure.
- Files: `src/mcp/tools/artifacts.ts` (`ensureRepoRoot`)
- Trigger: Running in a directory containing a `.git` file/dir that is not a real git repo root.
- Workaround: Prefer using git-backed checks in higher-risk operations (many flows already rely on `git` via `src/mcp/tools/impact.ts` and `src/mcp/tools/workspace.ts`); optionally validate `.git` via `git rev-parse --show-toplevel` in `ensureRepoRoot`.

## Security Considerations

**Path containment relies on realpath of existing segments (TOCTOU/symlink edges):**
- Risk: `ensurePathWithinRootSync()` canonicalizes existing paths via `realpathSync.native` but cannot fully prevent time-of-check/time-of-use races if the filesystem changes between validation and IO.
- Files: `src/shared/security.ts`, `src/mcp/tools/artifacts.ts` (`resolveBlueprintPath`), `src/mcp/tools/workspace.ts`, `src/mcp/tools/impact.ts`
- Current mitigation: Multiple tools validate repo-relative paths and enforce `.blueprint/` containment using `ensurePathWithinRootSync()` and `resolveRepoRelativeInputPathSync()` in `src/shared/security.ts`.
- Recommendations: For the highest-risk deletes/moves (e.g., `fs.rm` and `fs.rename` flows), re-check containment immediately before the operation and prefer operating on file descriptors where possible (practically limited in Node).

**Destructive filesystem operations are present:**
- Risk: Commands can delete or rename `.blueprint/` directories and external workspaces.
- Files: `src/mcp/tools/phase.ts` (phase removal uses `fs.rm`), `src/mcp/tools/workspace.ts` (workspace removal and patch replay cleanup use `fs.rm`)
- Current mitigation: Some flows require explicit `force` gates (e.g., phase removal checks execution evidence in `src/mcp/tools/phase.ts`).
- Recommendations: Ensure every destructive tool path surfaces an explicit confirmation gate in the command/skill contracts (command manifests in `commands/*.toml` and skills in `skills/*/SKILL.md`) and keep “dry run” modes consistent.

**Network access in update checks:**
- Risk: Update inspection fetches remote metadata over HTTPS.
- Files: `src/mcp/tools/update.ts`
- Current mitigation: Fetch is limited to `raw.githubusercontent.com` derived from a validated GitHub remote (`parseGithubRemote()` in `src/mcp/tools/update.ts`), uses a timeout, and falls back to manual-only guidance.
- Recommendations: Treat network lookup as best-effort only (current behavior) and ensure fetched data is never executed; keep it as display-only metadata.

**Prompt-boundary / content persistence heuristics are necessarily incomplete:**
- Risk: `prepareTextForPersistence()` blocks some instruction-override and high-entropy payload patterns, but no heuristic is complete against adversarial prompt injection.
- Files: `src/shared/security.ts`, `src/mcp/tools/artifacts.ts` (`writeTextFile`)
- Current mitigation: Rejects strong override patterns and suspicious encoded payloads; strips control characters.
- Recommendations: Keep “persisted artifacts” as advisory-only inputs; require explicit user confirmation before high-risk operations even when artifacts suggest them.

## Performance Bottlenecks

**Impact dependency scanning reads many source files:**
- Problem: The import scan dependency source enumerates and reads bounded source files (plus changed files), then regex-scans import/require specifiers.
- Files: `src/mcp/tools/impact.ts` (`listBoundedSourceFiles`, `loadTsImportScanDependencySource`, `extractImportSpecifiers`)
- Cause: `fs.readdir` traversal + `fs.readFile` for up to hundreds of files; regex scanning per file; additional work to build dependency edges.
- Improvement path: Cache file lists and parsed import specifiers keyed by `(repo root, HEAD sha, scope fingerprint)`; short-circuit when `config.dependencyGraph.sources` excludes `ts-import-scan`.

**Impact scope processing can become expensive for large diffs:**
- Problem: Diff stats and diff parsing loop over every line of diff input.
- Files: `src/mcp/tools/impact.ts` (`parseDiffFileStats`, diff ingest in scope resolution paths)
- Cause: `rawDiff.split(/\r?\n/)` and per-line processing.
- Improvement path: Avoid full split for very large diffs (stream or bounded processing) and/or cap diff size with clear “low confidence” output.

**Large artifact validation performs many regex passes over large Markdown:**
- Problem: Artifact validation and placeholder detection perform repeated regex scans and section extraction.
- Files: `src/mcp/tools/artifacts.ts`
- Cause: Multiple validations re-scan full document content and sections.
- Improvement path: Parse once into a structured representation (headings → blocks) and run validations over that structure; reuse compiled regex.

## Fragile Areas

**Roadmap/phase lifecycle edits involve multi-step coordinated mutations:**
- Files: `src/mcp/tools/phase.ts`, `src/mcp/tools/artifacts.ts`, `src/mcp/tools/state.ts`
- Why fragile: Operations can modify `ROADMAP.md`, rename phase directories, and rewrite phase references; partial failure can leave drift across files.
- Safe modification: Keep operations idempotent, prefer “preview” modes, and ensure every multi-step mutation has rollback or clear recovery guidance (phase removal already emits recovery guidance in `src/mcp/tools/phase.ts`).
- Test coverage: Covered by multiple slice/regression tests in `tests/` (e.g., roadmap and lifecycle suites), but drift recovery across interrupted filesystem operations remains hard to fully simulate.

**Workspace registry locking relies on filesystem semantics and timing:**
- Files: `src/mcp/tools/workspace.ts`
- Why fragile: Lock acquisition uses a directory lock with lease heartbeat and staleness checks; non-standard filesystem behavior (networked FS, clock skew) can break assumptions.
- Safe modification: Keep lock operations small, ensure the heartbeat always stops, and prefer atomic rename-based writes (already used in `writeFileAtomically()`).
- Test coverage: Exercise exists in `tests/workspace-tools.test.ts`, but real-world multi-process contention is difficult to cover fully.

## Scaling Limits

**Impact analysis scales with repo size and dependency graph inputs:**
- Current capacity: Bounded source traversal in `src/mcp/tools/impact.ts` limits results (e.g., listing stops after a few hundred files) but still reads file contents and can run multiple git commands.
- Limit: Large monorepos with thousands of source files and large `package-lock.json` can produce slow or memory-heavy runs.
- Scaling path: Introduce caching keyed by scope fingerprint; allow configurable scan limits in `.blueprint/impact/config.json` (`src/mcp/tools/impact.ts`), and degrade gracefully to “metadata-only” analysis with explicit low-confidence flags.

## Dependencies at Risk

**MCP SDK surface churn:**
- Risk: Blueprint runtime depends on `@modelcontextprotocol/sdk` for tool/resource contracts.
- Impact: Breaking changes could affect tool registration, transport, or resource templates.
- Migration plan: Pin/upgrade with focused compatibility tests around `src/mcp/server.ts` and `src/mcp/command-resources.ts` (tests live under `tests/` and exercise runtime contracts).

**Schema/validation libraries as a correctness gate:**
- Risk: `ajv` and `zod` are core to config/report validation logic.
- Impact: Version bumps can change error formatting and strictness, potentially breaking contract tests.
- Migration plan: Keep schema versions explicit (e.g., `IMPACT_REPORT_SCHEMA_VERSION` in `src/mcp/tools/impact.ts`) and expand regression tests when changing schema behavior.

## Missing Critical Features

**Deterministic performance telemetry for “why was this slow?”**
- Problem: When impact/phase/workspace operations are slow, there is limited structured timing output to guide tuning.
- Blocks: Harder to keep impact reports responsive on large repos and to set safe defaults confidently.

## Test Coverage Gaps

**Cross-platform filesystem edge cases (Windows/macOS/Linux differences):**
- What's not tested: Path separator edge cases, case-insensitive filesystems, and rename semantics under contention.
- Files: `src/shared/security.ts`, `src/mcp/tools/artifacts.ts`, `src/mcp/tools/phase.ts`, `src/mcp/tools/workspace.ts`
- Risk: Subtle path normalization or rename/delete behavior differs across OSes.
- Priority: Medium

**Large-repo / large-lockfile performance regressions:**
- What's not tested: Time/memory bounds for impact dependency scans and `package-lock.json` parsing in pathological repos.
- Files: `src/mcp/tools/impact.ts`
- Risk: The `/blu-impact` workflow can become unusable in the exact environments it targets (large/regulated repos) without early detection.
- Priority: High

---

*Concerns audit: 2026-05-01*

