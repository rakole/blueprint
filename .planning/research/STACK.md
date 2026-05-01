# Research: Defect Discovery Stack

**Date:** 2026-05-01
**Scope:** Blueprint defect discovery milestone
**Evidence base:** Local repo docs, existing `.planning/codebase/` map, command manifests, MCP contracts, tests, and source files. No external research was required for this initialization pass.

## Standard Stack For This Audit

The audit should use the repo's own implementation stack and verification tools:

- TypeScript and Node.js 20+ for runtime behavior, type contracts, and MCP tool implementation.
- Node ESM and relative `.js` imports, matching the repo's `tsconfig.json` and `package.json` conventions.
- `@modelcontextprotocol/sdk` for tool/resource registration and runtime contract behavior.
- `zod` and `ajv` for schema validation and model/report validation behavior.
- Node test runner via `tsx --test` for regression evidence.
- `npm run typecheck`, `npm run build`, and targeted `npm test -- <pattern>` only after `npm ci` has run in the fresh worktree.
- Git CLI for diff, worktree, branch, impact, update, and maintenance behavior.
- Markdown/TOML inspection for command manifests, skills, agents, docs, and generated bug reports.

## Recommended Evidence Tools

- `rg` and `rg --files` for source, manifest, docs, and tests inventory.
- Focused reads of `docs/COMMAND-CATALOG.md`, `docs/MCP-TOOLS.md`, `docs/RUNTIME-REFERENCE.md`, command specs, skill references, and associated tests.
- Targeted Node tests for the slice under audit.
- Build/typecheck only when needed to confirm a suspected runtime, schema, import, or generated `dist` defect.
- Git diff checks to ensure the milestone only creates planning or bug documentation, not fixes.

## Defect Documentation Format

Every `docs/bugs/*.md` file should include:

- Title and stable bug id.
- Status: `open`, `needs-repro`, `blocked`, or `duplicate`.
- Severity: `critical`, `high`, `medium`, `low`, or `info`.
- Confidence: `confirmed`, `likely`, or `suspected`.
- Affected surfaces: command, skill, MCP tool, hook, docs, tests, build, generated assets, state artifacts, host behavior.
- Summary and user/runtime impact.
- Evidence with exact file paths, command outputs, test names, or contract mismatches.
- Reproduction or verification steps.
- Expected behavior from Blueprint docs/contracts.
- Actual behavior observed.
- Likely cause and suggested fix direction.
- Related files and related bugs.
- Explicit note that no fix was applied in this milestone.

## What Not To Use

- Do not use GSD runtime assumptions as evidence for Blueprint defects.
- Do not treat `.planning/` as Blueprint runtime state.
- Do not rely on generated `dist` assets alone without comparing source or build expectations.
- Do not create shell-only conclusions for MCP contract defects when docs or tests can provide stronger evidence.

## Confidence Notes

This is a brownfield audit. Many defects will be contract drift bugs where "expected" comes from Blueprint docs and "actual" comes from manifests, skills, MCP registrations, tests, or source behavior. These should be high-value even when a full CLI reproduction is not feasible in the current session, as long as the evidence is precise and uncertainty is labelled.
