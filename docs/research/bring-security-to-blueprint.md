# Bringing Security To Blueprint

## Status

- Date: 2026-04-11
- Type: future-work research note
- Scope: how Blueprint can adopt the useful security parts of GSD without breaking Blueprint's Gemini-native architecture
- Reference: [GSD `security.cjs`](https://github.com/gsd-build/get-shit-done/blob/main/get-shit-done/bin/lib/security.cjs)

## Recommendation In One Paragraph

Blueprint should not copy GSD's security layer file-for-file. It should extract the intent of that module into a small shared Blueprint security library, make MCP tools the primary enforcement point, keep hooks advisory, and only wire higher-level audit behavior into `secure-phase` after the planned review substrate exists. The first goal is a shared guardrail foundation for path safety, prompt-safety scans, safe parsing, and argument validation. The second goal is a later security review flow that produces `XX-SECURITY.md` through `blueprint-review` and `blueprint-security-auditor`.

## What GSD's Security Module Actually Gives Us

The upstream module is a defense-in-depth utility layer. It centralizes:

- path traversal protection with symlink-aware resolution
- prompt-injection pattern scanning
- prompt/display sanitization
- shell argument validation
- safe JSON parsing with size limits
- phase and field-name validation
- prompt-structure validation for XML-like workflow files
- entropy-based anomaly detection for suspicious encoded payloads

That is useful for Blueprint, but the integration point needs to change. GSD uses this in a CLI runtime that writes markdown prompts and orchestrates shell-heavy workflows. Blueprint's architecture puts deterministic state changes inside MCP tools, keeps commands thin, and treats hooks as advisory only.

## Blueprint Constraints That Change The Design

- `docs/DECISIONS.md` locks Blueprint into MCP-owned persistence, not script-owned persistence.
- `docs/DRIFT.MD` freezes Phase 3+ exposure until missing substrate lands, so this work must not accidentally surface blocked commands early.
- `docs/MCP-TOOLS.md` already requires tools to reject path traversal.
- `docs/commands/secure-phase.md` already defines the future contract for a security audit command, but that command is still `planned`.
- `src/mcp/tools/artifacts.ts` already has basic repo-relative and `.blueprint/` path checks through `resolveRepoRelativePath` and `resolveBlueprintPath`.

Because of that, the right move is to strengthen shared validation under the MCP layer first, then attach review and audit behavior later.

## Proposed Blueprint Design

### 1. Add a shared security module

Create a reusable module under `src/shared/security/` or `src/shared/security.ts` with Blueprint-shaped helpers such as:

- `validatePathWithinRoot(baseDir, candidatePath, opts)`
- `scanForPromptInjection(text, opts)`
- `sanitizeForPromptEmbedding(text)`
- `sanitizeForUserDisplay(text)`
- `safeJsonParse(text, opts)`
- `validateBlueprintPhaseRef(value)`
- `validateBlueprintFieldName(value)`
- `scanEntropyAnomalies(text)`

Blueprint should reuse existing repo-relative path helpers where possible, then centralize stricter logic there instead of duplicating checks in each MCP tool.

### 2. Make MCP tools the hard enforcement layer

Security checks should run inside MCP tools before filesystem writes or risky parsing. Priority integration points:

1. `src/mcp/tools/artifacts.ts`
2. `src/mcp/tools/project.ts`
3. `src/mcp/tools/config.ts`
4. future review, workspace, patch, and update tool families

This keeps Blueprint aligned with its core rule: tools own persistence. Commands and skills can warn, but they should not become the only place where security validation happens.

### 3. Add prompt-safety specifically where Blueprint writes LLM-facing artifacts

Blueprint may not generate GSD-style workflow files today, but it does own agent specs, skill docs, command specs, and `.blueprint/` planning artifacts that can later flow back into model context. That means Blueprint still benefits from:

- scanning user-supplied long-form text before embedding it into generated artifacts
- stripping invisible Unicode and obvious role-boundary markers before prompt embedding
- sanitizing display output to avoid surfacing leaked protocol markers

This should be applied narrowly to user-controlled text fields, not as a blanket rewrite of every markdown file.

### 4. Keep hooks advisory

The existing hook policy already points in the right direction. A Blueprint hook can warn on suspicious `.blueprint/` writes or prompt-injection markers, but it should not become the source of truth for state safety. The hook should complement MCP validation, not replace it.

### 5. Treat `secure-phase` as a later review surface, not the foundation

`secure-phase` should stay planned until the review substrate is real. When it is implemented, it should consume the shared security helpers and produce an audit artifact through `blueprint_review_record`. That later flow can cover:

- threat-model verification against completed phase outputs
- missing mitigation checks
- suspicious artifact content findings
- follow-up tasks or fix recommendations

In other words: the shared security library protects the runtime; `secure-phase` reports on project security posture.

## Suggested Delivery Order

### Slice A: shared runtime guardrails

- extract current path-safety logic into a shared module
- add symlink-aware containment checks similar to GSD's `validatePath`
- add safe JSON parsing and common identifier validators
- add unit tests for traversal, null-byte, and malformed-input cases

### Slice B: prompt-safety integration

- add injection scanning and sanitization helpers
- integrate them into artifact creation and any MCP path that embeds user-controlled text into Blueprint-managed markdown
- add tests for invisible Unicode, delimiter markers, prompt-stuffing, and encoded payload heuristics

### Slice C: advisory hook alignment

- add warnings in Blueprint hooks for suspicious artifact writes
- keep hook messages informational and consistent with MCP rejection behavior

### Slice D: future quality/security command work

- implement `blueprint-review` review substrate
- add `blueprint-security-auditor`
- implement `/blu-secure-phase` on top of the shared helpers and review recording tools

## What Not To Port Directly

- do not port shell-specific validation everywhere if Blueprint is not using shell execution at that boundary
- do not make hooks state-owning
- do not introduce a second persistence path outside MCP tools
- do not expose `secure-phase` early just because security helpers exist
- do not assume GSD's XML-like prompt structure rules map 1:1 to Gemini command or agent files

## Concrete Future Work Backlog

1. Add `src/shared/security.ts` with shared validators and sanitizers.
2. Refactor `src/mcp/tools/artifacts.ts` to consume the shared path-safety helper instead of owning all traversal logic locally.
3. Add shared tests that cover symlinks, null bytes, absolute paths, prompt injection markers, invisible Unicode, oversized JSON, and high-entropy payloads.
4. Define which Blueprint artifact fields are "prompt-boundary sensitive" and should be scanned or sanitized before persistence.
5. Add a review-family design note for how `blueprint-security-auditor` will emit findings into `XX-SECURITY.md`.

## Exit Criteria For This Research To Become Implementation

- a shared security module exists and is used by MCP tools
- path safety is centralized rather than duplicated
- prompt-safety checks are applied only at clear user-input boundaries
- tests prove traversal and prompt-safety regressions fail fast
- `secure-phase` remains `planned` until the review-family MCP tools and agent contract are actually present

## Bottom Line

Bring the security part into Blueprint in two layers:

- now: shared MCP-first runtime guardrails
- later: `secure-phase` and security-auditor reporting

That preserves the useful parts of GSD's security posture while staying faithful to Blueprint's own architecture and current Phase 2.2 freeze rules.
