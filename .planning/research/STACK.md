# Stack Research

**Domain:** Blueprint command-level blast-radius analysis
**Researched:** 2026-04-24
**Confidence:** MEDIUM

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | >=20 | Runtime for command + MCP execution | Matches repo runtime and avoids parallel runtimes for analysis logic |
| TypeScript | ^6 | Type-safe impact graph and report models | Existing Blueprint codebase is TypeScript-first with strict tooling |
| `@modelcontextprotocol/sdk` | ^1.29 | Deterministic MCP tool surface for reads/writes | Keeps impact analysis stateful operations in MCP, consistent with Blueprint architecture |
| `zod` | ^4.3 | Input/output schema validation for impact report contracts | Supports explicit unknown handling and safer command/runtime boundaries |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Built-in `git` CLI invocation | n/a | Diff enumeration, file history, rename detection | Use for canonical diff source in local repos and PR branches |
| Existing Blueprint artifact and roadmap tools | existing runtime | Pull phase context, requirements mappings, and state hints | Use whenever impact context is phase-aware rather than raw-diff-only |
| `CODEOWNERS` parser (small helper, local) | n/a | Reviewer/owner inference from file paths | Use when ownership metadata is available in-repo |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `tsx --test` | Regression and contract tests | Add deterministic fixtures for diff-to-impact expectations |
| `tsc --noEmit` | Type-level safety | Keep report schema and risk-level enum stable |
| Existing build pipeline (`scripts/build.mjs`) | Runtime packaging | Ensures command + tool additions stay extension-compatible |

## Installation

```bash
# Existing project dependencies already cover core stack
npm install
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| MCP-backed deterministic analysis APIs | Prompt-only analysis in command skill | Only for rapid prototype exploration, never for production confidence claims |
| Repo-local ownership/dependency heuristics | External CMDB/service catalog as source of truth | Use when enterprise metadata APIs are available and trusted |
| Advisory report output | Auto-remediation workflows | Consider later after trust, precision, and auditability are proven |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Black-box risk scoring with no evidence links | Teams cannot audit or trust findings | Include evidence links per finding and explicit confidence |
| Hard-failing when ownership metadata is missing | Creates command brittleness on partial repos | Emit "unknowns" section with remediation suggestions |
| Full-repo static analysis on every run | Too slow for pre-review usage | Start from diff-first scope and expand selectively |

## Stack Patterns by Variant

**If analyzing local working-tree changes:**
- Use git working diff + staged diff merge
- Because developer pre-commit use needs fast iterative feedback

**If analyzing PR branches:**
- Use base..head compare with rename detection
- Because review workflows need stable patch semantics

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@modelcontextprotocol/sdk@^1.29.0` | Node.js >=20 | Matches current repo engines |
| `zod@^4.3.6` | TypeScript ^6 | Existing repo dependency pair |

## Sources

- `package.json` — current runtime/dependency constraints
- `docs/ARCHITECTURE.md` — MCP-owned persistence and command-thin boundaries
- `docs/MCP-TOOLS.md` — existing deterministic tool and report patterns
- `docs/COMMAND-CATALOG.md` — implemented-only routing and command surface constraints

---
*Stack research for: Blueprint impact analysis command*
*Researched: 2026-04-24*
