# Codebase Concerns

**Analysis Date:** 2026-04-24

## Tech Debt

**Runtime contracts depend on markdown parsing at runtime:**
- Issue: Command availability, required tools, and runtime-contract resources are derived by parsing docs instead of a compiled machine-readable contract.
- Files: `src/mcp/tools/project.ts`, `src/mcp/command-resources.ts`, `docs/COMMAND-CATALOG.md`, `docs/RUNTIME-REFERENCE.md`, `docs/commands/*.md`
- Impact: Small docs-format edits can silently change runtime behavior; debugging drift requires tracing parser assumptions across multiple files.
- Fix approach: Introduce a canonical JSON contract generated at build time, validate docs against that contract in CI, and make runtime readers consume the JSON.

**Core MCP tools are monolithic:**
- Issue: Critical mutation logic is concentrated in very large files.
- Files: `src/mcp/tools/artifacts.ts`, `src/mcp/tools/phase.ts`, `src/mcp/tools/workspace.ts`
- Impact: Review and change risk is high; bug fixes are harder to isolate and regressions are harder to prevent.
- Fix approach: Split by bounded domains (artifact IO, validation, roadmap mutation, workspace/patch ops) with narrow exported interfaces and focused test modules.

**Repo guidance references a missing drift document:**
- Issue: Preferred read order still references `docs/DRIFT.MD`, but that file is intentionally absent.
- Files: `AGENTS.md`, `docs/HANDOFF.md`, `tests/drift-repair-docs.test.ts`
- Impact: New sessions hit dead links and spend time reconciling documentation source-of-truth.
- Fix approach: Replace `docs/DRIFT.MD` references with `docs/RUNTIME-REFERENCE.md` and `docs/HANDOFF.md`, or restore a lightweight drift index doc.

## Known Bugs

**Duplicate exclusion check in runtime-contract resource listing:**
- Symptoms: The same exclusion condition is nested twice in command runtime-contract listing logic.
- Files: `src/mcp/command-resources.ts`
- Trigger: Calling runtime-contract command listing path.
- Workaround: Not required for users; cleanup is code-level.

**`remove-phase` mutation path is not transactional:**
- Symptoms: Directory deletion and multi-phase rename happen before final roadmap write, with no rollback if mid-flight filesystem operations fail.
- Files: `src/mcp/tools/phase.ts`
- Trigger: `blueprint_roadmap_remove_phase` with IO failure/interruption during rename/write sequence.
- Workaround: Manual repair via roadmap/phase-directory reconciliation after failure.

## Security Considerations

**Failure logs can capture sensitive request payload fields:**
- Risk: Mutation failure logging truncates values but only special-cases a few keys; arbitrary secret-like fields can still be persisted in `.blueprint/mcp-write-failures.ndjson`.
- Files: `src/mcp/write-failure-log.ts`
- Current mitigation: Depth, size, and stack truncation; selective content key shaping.
- Recommendations: Add denylist/regex redaction for keys like `token`, `secret`, `password`, `key`, `auth`, and hash or drop unknown large string fields.

**Destructive MCP tools rely on orchestration-layer confirmation:**
- Risk: High-risk operations can run directly through MCP tool calls without a built-in confirmation token handshake.
- Files: `src/mcp/tools/phase.ts`, `src/mcp/tools/workspace.ts`, `commands/blu-undo.toml`, `commands/blu-ship.toml`, `commands/blu-cleanup.toml`
- Current mitigation: Validation gates and command/skill prompt instructions.
- Recommendations: Add explicit tool-level confirmation args (`confirmPhrase`/`intentHash`) and enforce dry-run previews before destructive writes.

## Performance Bottlenecks

**Command catalog/resource reads do repeated full-file parsing:**
- Problem: Catalog and runtime-contract resources repeatedly read and parse markdown specs and references.
- Files: `src/mcp/tools/project.ts`, `src/mcp/command-resources.ts`, `docs/COMMAND-CATALOG.md`, `docs/RUNTIME-REFERENCE.md`
- Cause: No persistent in-process cache or precompiled metadata artifact.
- Improvement path: Add memoized catalog/resource snapshots keyed by file mtimes, or compile contract JSON at build and read once.

**Markdown state/index updates are full-file operations:**
- Problem: Planning artifacts are frequently parsed and rewritten as whole markdown files.
- Files: `src/mcp/tools/artifacts.ts`, `src/mcp/tools/phase.ts`, `src/mcp/tools/state.ts`
- Cause: Line/section parsing plus full document rewrite model.
- Improvement path: Move high-churn indexes to structured JSON with append/patch semantics and generate markdown views from structured state.

## Fragile Areas

**Roadmap phase deletion and renumbering path:**
- Files: `src/mcp/tools/phase.ts`, `tests/roadmap-tools.test.ts`
- Why fragile: One command mutates roadmap text, phase directories, and artifact filenames in a tightly coupled sequence.
- Safe modification: Add two-phase commit semantics (prepare plan, persist journal, execute, verify, finalize) with rollback on failure.
- Test coverage: Heavy happy-path and drift tests exist, but injected filesystem-failure rollback tests are not present.

**Workspace registry locking and rollback flow:**
- Files: `src/mcp/tools/workspace.ts`, `tests/workspace-tools.test.ts`
- Why fragile: Lock leasing, rollback, cross-repo cleanup, and registry mutation are intertwined and sensitive to partial failure.
- Safe modification: Keep lock/journal logic isolated, avoid touching delete paths without explicit rollback assertions, and add failure-injection tests.
- Test coverage: Broad behavior coverage exists, but lock-staleness race windows and multi-process contention are still a risk.

## Scaling Limits

**Append-only write-failure log has no retention controls:**
- Current capacity: Not bounded; grows with every rejected or thrown mutation write.
- Limit: Disk growth over long-lived repos can become unbounded.
- Scaling path: Implement rotation (`maxBytes`, `maxFiles`) and optional compression for `.blueprint/mcp-write-failures.ndjson`.

**Single-file markdown indexes do not scale with entry volume:**
- Current capacity: No enforced entry-count limits for `TODO.md`, `BACKLOG.md`, `NOTES.md`, and roadmap text sections.
- Limit: Parse and rewrite cost grows linearly with file size and increases merge-conflict frequency.
- Scaling path: Normalize to structured per-entry state and generate markdown projections for human readability.

## Dependencies at Risk

**MCP SDK version drift risk:**
- Risk: Runtime behavior is tightly coupled to `@modelcontextprotocol/sdk` while dependency range allows minor/patch updates.
- Impact: Tool/resource registration or protocol behavior can change under a semver-compatible upgrade and affect command routing.
- Migration plan: Pin and test exact versions in CI, then roll upgrades with explicit compatibility tests around `src/mcp/server.ts` and `src/mcp/command-resources.ts`.

## Missing Critical Features

**Behavior-audit closure for shipped runtime is incomplete:**
- Problem: Runtime reference marks many shipped commands as `needs-behavior-audit`, and the open verification queue remains active.
- Blocks: High-confidence promotion of high-risk command paths without manual caution.
- Files: `docs/RUNTIME-REFERENCE.md`

**High-risk command execution paths lack end-to-end command-level tests:**
- Problem: Coverage for several shipped maintenance commands is primarily metadata/contract text assertions.
- Blocks: Deterministic confidence that confirmation gates and mutation ordering are enforced in real command runs.
- Files: `tests/ship-metadata.test.ts`, `tests/undo-metadata.test.ts`, `tests/pr-branch-metadata.test.ts`, `tests/cleanup-metadata.test.ts`, `tests/reapply-patches-metadata.test.ts`, `tests/maintenance-regression.test.ts`

## Test Coverage Gaps

**Maintenance command behavior vs metadata coverage mismatch:**
- What's not tested: End-to-end execution behavior for `/blu-ship`, `/blu-undo`, `/blu-pr-branch`, and `/blu-cleanup` under dirty-tree, missing-branch, and partial-failure scenarios.
- Files: `commands/blu-ship.toml`, `commands/blu-undo.toml`, `commands/blu-pr-branch.toml`, `commands/blu-cleanup.toml`, `tests/*metadata.test.ts`
- Risk: Prompt-level safety wording can drift from actual runtime behavior without failing tests.
- Priority: High

**Failure injection for non-transactional roadmap mutation paths:**
- What's not tested: Mid-mutation filesystem failure during `blueprint_roadmap_remove_phase` and guaranteed rollback/repair behavior.
- Files: `src/mcp/tools/phase.ts`, `tests/roadmap-tools.test.ts`
- Risk: Partial state corruption between `ROADMAP.md` and `.blueprint/phases/` can go unnoticed.
- Priority: High

**Command-resource parser resilience to malformed docs:**
- What's not tested: Robust behavior when command docs/runtime tables are malformed but syntactically present.
- Files: `src/mcp/tools/project.ts`, `src/mcp/command-resources.ts`, `tests/command-catalog.test.ts`, `tests/mcp-server-summary.test.ts`
- Risk: Runtime contract/resource responses may degrade silently on doc-shape drift.
- Priority: Medium

---

*Concerns audit: 2026-04-24*
