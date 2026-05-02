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
