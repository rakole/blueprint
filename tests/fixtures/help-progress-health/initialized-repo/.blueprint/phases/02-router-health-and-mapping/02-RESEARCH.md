# Phase 02: Router Health And Mapping - Research

**Researched:** 2026-04-11
**Domain:** Router health and mapping validation
**Confidence:** HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FND-06 | Router and status surfaces recommend only implemented commands. | Keep help/progress logic bound to `blueprint_command_catalog` rather than docs-only command lists. |

## Summary

- Healthy router fixtures should include valid discovery research when a phase already claims research exists.

## User Constraints

- Keep `.blueprint/` as runtime truth.

## Standard Stack

- TypeScript
- node:test

## Architecture Patterns

- Validate runtime state from MCP-owned artifacts.

## Don't Hand-Roll

- Reuse command catalog availability checks.

## Common Pitfalls

- Treating placeholder research text as completed research.

## Code Examples

```ts
const catalog = await blueprintCommandCatalog();
```

## Recommendations

- Keep healthy fixtures aligned with the validated research contract.

## Sources

- `src/mcp/tools/project.ts` - runtime command availability logic.
- `tests/help-progress-health.test.ts` - initialized repo expectations.
