---
id: BPBUG-005
title: Repo-root guard accepts any `.git` entry as a valid repository
severity: medium
confidence: confirmed
surface: cross-cutting
status: new
discovery_phase: 8
reported: 2026-05-02
---

# BPBUG-005: Repo-root guard accepts any `.git` entry as a valid repository

## Classification

- Severity: `medium`
- Confidence: `confirmed`
- Surface: `cross-cutting`
- Status: `new`

## Summary

Blueprint's shared repo-root guard accepts any existing `.git` entry in the current directory as proof that the directory is a valid repository root. A disposable Phase 8 probe showed that a temporary directory containing only a fake `.git` file is accepted as a Blueprint repo root, even though it is not a real Git repository. Because `ensureRepoRoot()` is shared by multiple MCP tool families, this can let Blueprint start repo-root-gated flows or write `.blueprint/` state in directories that do not actually satisfy the product's Git-backed repo assumptions.

## Expected Behavior

Repo-root validation should confirm that the current directory is an actual Git repository or worktree root, not merely a path containing a `.git` file or directory entry. Shared repo-root gating should reject bogus `.git` placeholders before Blueprint starts artifact, phase, impact, or workspace flows that assume real repository semantics.

## Actual Behavior

`src/mcp/tools/artifacts.ts` resolves the current directory and checks only whether `.git` exists. It does not verify `git rev-parse --show-toplevel`, compare the resolved top-level path, or reject malformed `.git` placeholders. A disposable `npx tsx` probe with a temporary directory containing `not-a-real-gitdir` in a fake `.git` file returned that temp directory as the repo root instead of rejecting it.

## Impact

Blueprint can falsely treat arbitrary directories as valid repo roots if they contain a stray `.git` entry. That weakens a shared safety boundary used by multiple MCP tools, can create `.blueprint/` state in non-repo directories, and can turn later Git-dependent failures into confusing downstream errors instead of failing fast at repo-root validation.

## Affected Files

- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/phase.ts`
- `src/mcp/tools/impact.ts`
- `src/mcp/tools/workspace.ts`
- `tests/artifact-contracts.test.ts`
- `tests/artifact-validate-runtime.test.ts`
- `tests/security-hardening.test.ts`
- `tests/workspace-tools.test.ts`

## Evidence

| Source | Evidence | Why It Matters |
|--------|----------|----------------|
| `src/mcp/tools/artifacts.ts:2133-2154` | `getProjectRoot()` returns `path.resolve(cwd ?? process.cwd())`, and `ensureRepoRoot()` only checks `pathExists(path.join(projectRoot, ".git"))` before returning `projectRoot`. | The shared repo-root guard is existence-based, not Git-backed. |
| `src/mcp/tools/phase.ts`, `src/mcp/tools/impact.ts`, `src/mcp/tools/workspace.ts` | These tool families import and call `ensureRepoRoot()` for their shared repo-root gating. | The weak guard is cross-cutting rather than isolated to one command surface. |
| `src/mcp/tools/workspace.ts:1279-1288` | Workspace code already has a stronger helper, `resolveGitRepoRoot()`, that calls `git rev-parse --show-toplevel`. | The repo already contains a safer pattern that the shared guard does not reuse. |
| `rg -n "ensureRepoRoot\\(|\\.git entry|rev-parse --show-toplevel" tests/workspace-tools.test.ts tests/security-hardening.test.ts tests/artifact-validate-runtime.test.ts tests/artifact-contracts.test.ts` | No targeted regression was found that rejects a bogus `.git` entry at the shared guard boundary. | There is no focused test preventing this false-positive repo-root acceptance. |
| `tmpdir=$(mktemp -d); printf 'not-a-real-gitdir\\n' > \"$tmpdir/.git\"; npx tsx -e 'import { ensureRepoRoot } from \"./src/mcp/tools/artifacts.ts\"; const dir = process.argv[1]!; (async () => { const result = await ensureRepoRoot(dir); console.log(result); })().catch((error) => { console.error(error); process.exit(1); });' \"$tmpdir\"; rm -rf \"$tmpdir\"` | The probe printed the temporary directory path instead of rejecting it. | Confirms the weak guard is a live runtime behavior, not only a source-reading concern. |

## Verification Steps

1. Inspect `src/mcp/tools/artifacts.ts:2133-2154`; confirm that `ensureRepoRoot()` only checks for an existing `.git` entry and does not validate Git repository structure.
2. Inspect `src/mcp/tools/phase.ts`, `src/mcp/tools/impact.ts`, and `src/mcp/tools/workspace.ts`; confirm they rely on `ensureRepoRoot()` as shared repo-root gating.
3. Inspect `src/mcp/tools/workspace.ts:1279-1288`; confirm the repo already uses `git rev-parse --show-toplevel` in a stronger helper for workspace-specific checks.
4. Run the disposable probe listed in the evidence table; observe that a temporary directory with a fake `.git` file is accepted and echoed back as the repo root.
5. Run `rg -n "ensureRepoRoot\\(|\\.git entry|rev-parse --show-toplevel" tests/workspace-tools.test.ts tests/security-hardening.test.ts tests/artifact-validate-runtime.test.ts tests/artifact-contracts.test.ts`; observe that no focused regression guards this false-positive path.

## Likely Cause

The original helper stayed as a lightweight `.git`-presence check even as more MCP tools began relying on it as a shared repository-boundary gate. The repo already added stronger Git-backed validation in workspace-specific paths, but that stricter check never replaced the generic helper used across other tool families.

## Suggested Fix Direction

Replace the shared `.git`-existence heuristic with Git-backed validation such as `git rev-parse --show-toplevel`, accept only a real repo or worktree root, and add a regression test that rejects bogus `.git` placeholders while still allowing legitimate worktree roots.

## Uncertainty

None known. The weak guard is confirmed by source inspection and a disposable no-write probe.

## Related Bugs

Root-cause cluster: `repo-root validation gaps`. No same-repair-path peer is known yet.

## No Fix Applied

No source, manifest, skill, test, generated asset, or runtime behavior fix was applied during this discovery milestone.

## Repair Plan - 2026-05-03

### Inspection

- The bug report confirms `ensureRepoRoot()` accepts a fake `.git` file.
- `src/mcp/tools/artifacts.ts` has `pathExists()`, and `ensureRepoRoot()` only checks `path.join(projectRoot, ".git")`.
- `src/mcp/tools/phase.ts`, `src/mcp/tools/impact.ts`, and `src/mcp/tools/workspace.ts` import the shared guard. Representative calls include phase validation, artifact validation, impact config/scope, and workstreams.
- `src/mcp/tools/workspace.ts` already has a safe `runGit()` wrapper and `resolveGitRepoRoot()` uses `git -C <path> rev-parse --show-toplevel`.
- `tests/artifact-validate-runtime.test.ts` and `tests/security-hardening.test.ts` create fixture repos with fake `.git` files. `tests/workspace-tools.test.ts` already has real Git helpers and worktree coverage. `tests/artifact-contracts.test.ts` is contract-only and probably should not host this regression.
- A broader fixture sweep may be needed because many test files contain fake worktree placeholder `.git` entries.

### Official Gemini CLI Research

- Gemini CLI shell tool docs define `dir_path` as the command execution directory and emphasize checking exit code/stderr: <https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/shell.md>. Impact: `git rev-parse` is the right deterministic validation primitive, but it should live inside Blueprint MCP code, not slash-command prompt shell snippets.
- Gemini CLI extension docs show MCP server `command`, `args`, and optional `cwd`, commonly `${extensionPath}`: <https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md> and <https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/writing-extensions.md>. Impact: repo validation must be based on the project `cwd` passed to tools, not the MCP server process cwd.
- Gemini CLI configuration docs describe project settings under the project root: <https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md>. Impact: this supports Blueprint's requirement that repo-scoped state only be accepted from a real project root.

### Minimal Implementation Plan

- Change production logic only in `src/mcp/tools/artifacts.ts`.
- Add `execFile`/`promisify` imports and a local `runGitRevParseTopLevel(projectRoot)` helper using `execFile("git", ["-C", projectRoot, "rev-parse", "--show-toplevel"])`.
- Keep the current no-`.git` error text for the missing-entry path so workspace default-root fallback behavior remains stable.
- After `.git` exists, require `git rev-parse --show-toplevel` to succeed. Reject malformed `.git` files/directories with a clear "not a valid git repository root" error.
- Compare `fs.realpath(projectRoot)` to `fs.realpath(gitTopLevel)` before accepting. This preserves real worktree roots and symlinked repo roots while rejecting bogus placeholders and nested directories.
- Return the existing `projectRoot` value after validation to avoid changing downstream path shape.

### Tests To Add / Update

- Add focused regressions, preferably in `tests/security-hardening.test.ts`:
  - `ensureRepoRoot` rejects a fake `.git` file containing arbitrary text.
  - `ensureRepoRoot` rejects a fake `.git` directory that is not a Git repository.
  - `ensureRepoRoot` accepts a real Git worktree root where `.git` is a valid worktree gitdir file.
- Update fixture helpers in `tests/artifact-validate-runtime.test.ts` and `tests/security-hardening.test.ts` to initialize real Git repos instead of writing placeholders.
- Reuse or extract a small `tests/helpers/git-fixtures.ts` helper from `tests/workspace-tools.test.ts` if broader fixture cleanup is needed.
- Run `npm run typecheck`, targeted `npx tsx --test tests/security-hardening.test.ts tests/artifact-validate-runtime.test.ts tests/workspace-tools.test.ts`, then full `npm test`.

### Gemini CLI Tool Usage Placement

- No command manifest change is needed.
- Do not add `!{git ...}` shell snippets to Gemini slash commands.
- Git validation belongs inside the MCP server helper in `artifacts.ts`, using Node `execFile` with static args. This mirrors existing internal Git usage in `workspace.ts` and `impact.ts`.

### Parallel Waves

- Wave A, source guard: `src/mcp/tools/artifacts.ts` only.
- Wave B, focused tests: `tests/security-hardening.test.ts`, `tests/artifact-validate-runtime.test.ts`, optionally `tests/workspace-tools.test.ts`.
- Wave C, fixture sweep: mechanically replace remaining fake `.git` repo fixtures across tests only where those fixtures call repo-gated Blueprint tools.
- Dependency: Wave B/C need the real Git fixture helper or duplicated local init helper. Wave A can be reviewed independently.

### DoD Reviewer Checklist

- `ensureRepoRoot()` no longer accepts arbitrary `.git` entries.
- Real Git repository roots and real worktree roots pass.
- Missing `.git` behavior remains compatible with workspace default-root fallback.
- No changes to command catalog routing, command manifests, installed extension mutation, or Blueprint/GSD workflow surfaces.
- Targeted tests and full test suite pass.
- Remaining fake `.git` placeholders, if any, are proven not to exercise repo-root-gated tools.

### Risks / Uncertainty

- The main risk is fixture blast radius: many tests use fake `.git` placeholders, so full-suite repair may be larger than the production fix.
- This makes `git` availability required for all repo-gated tools, not only workspace/impact paths. That aligns with Blueprint's Git-backed repo assumption but may expose environments with missing Git sooner.
- Path comparison must canonicalize realpaths to avoid false failures for symlinked checkouts and real worktrees.
