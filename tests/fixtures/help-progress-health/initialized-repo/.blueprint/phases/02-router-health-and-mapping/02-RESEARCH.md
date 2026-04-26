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

## Locked Decisions From Context

- Router and status surfaces must stay limited to implemented commands.

## User Constraints

- Keep `.blueprint/` as runtime truth.

## Standard Stack

- TypeScript on Node.js
- node:test in the local fixture suite

## Installation And Setup

- Run initialized fixture checks against the saved discovery artifacts and codebase bundle.

## Alternatives Considered

- Docs-only routing was rejected because runtime status must come from live artifacts.

## Architecture Patterns

- Validate runtime state from MCP-owned artifacts.

## Don't Hand-Roll

- Reuse command catalog availability checks.

## Anti-Patterns

- Treating placeholder research text as completed research or bypassing the catalog gate.

## State Of The Art

- Not externally checked; this fixture validates local router and artifact behavior only.
- Healthy router fixtures now preserve the full research contract used by lifecycle status reads.

## Common Pitfalls

- Treating placeholder research text as completed research.

## Open Questions

- Should initialized fixtures also carry explicit UI-skip rationale when UI work is out of scope?

## Confidence Breakdown

| Topic | Confidence | Why |
|-------|------------|-----|
| Router fixture validity | HIGH | The fixture is maintained in-repo and checked by runtime status tests. |

## Code Examples

```ts
const catalog = await blueprintCommandCatalog();
```

## Recommendations

- Keep healthy fixtures aligned with the validated research contract.

## Sources

- `src/mcp/tools/project.ts` - runtime command availability logic.
- `tests/help-progress-health.test.ts` - initialized repo expectations.
