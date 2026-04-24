# Architecture Research

**Domain:** Blast-radius analysis command in Blueprint runtime
**Researched:** 2026-04-24
**Confidence:** MEDIUM

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                 Command + Skill Orchestration              │
├─────────────────────────────────────────────────────────────┤
│  /blu-impact router  |  input parsing  |  UX rendering     │
├─────────────────────────────────────────────────────────────┤
│                    MCP Impact Analysis Layer               │
├─────────────────────────────────────────────────────────────┤
│ scope resolver | boundary classifier | dependency resolver  │
│ owner resolver | test mapper         | risk engine          │
├─────────────────────────────────────────────────────────────┤
│                     Evidence + Artifact Layer              │
│ git diff | roadmap/phase artifacts | CODEOWNERS | reports  │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Scope Resolver | Convert input (working tree / range / branch) into canonical change set | Git compare wrapper + normalized file metadata |
| Boundary Classifier | Tag files as service/module/api/config/data/infra | Rule engine with path and content heuristics |
| Dependency Resolver | Identify downstream consumers and coupling edges | Static mapping sources first, heuristic fallback |
| Ownership Resolver | Infer required reviewers/owners | CODEOWNERS + path ownership conventions |
| Test Mapper | Suggest required test suites | File-to-test mapping table + coverage heuristics |
| Risk Engine | Produce deploy risk and rationale | Rule-based scoring with confidence and unknown handling |
| Report Writer | Persist impact report artifact | Blueprint report write path via MCP |

## Recommended Project Structure

```
src/
├── mcp/tools/impact.ts                # Tool entrypoint for impact analysis
├── shared/impact/
│   ├── scope.ts                       # Diff normalization
│   ├── classify.ts                    # Boundary classification
│   ├── dependencies.ts                # Downstream inference
│   ├── ownership.ts                   # Reviewer/owner inference
│   ├── tests.ts                       # Required test inference
│   ├── risk.ts                        # Deploy risk model
│   └── report.ts                      # Output shaping and unknowns contract
├── skills/blueprint-impact/           # Command orchestration docs
└── commands/blu-impact.toml           # Direct command manifest
```

### Structure Rationale

- **`src/shared/impact/`**: keeps analyzer primitives testable and reusable from command and MCP tool surfaces.
- **`src/mcp/tools/impact.ts`**: preserves deterministic state ownership and schema validation at the tool boundary.
- **Command + skill split**: keeps UX and orchestration thin while analysis logic stays typed and unit-testable.

## Architectural Patterns

### Pattern 1: Evidence-First Scoring

**What:** Every risk conclusion carries source evidence and confidence.
**When to use:** Always, especially for reviewer and downstream impact claims.
**Trade-offs:** Slightly larger report payload, much better auditability.

### Pattern 2: Heuristic with Explicit Unknowns

**What:** Infer where possible but emit unresolved gaps clearly.
**When to use:** Repos with partial metadata.
**Trade-offs:** Less "clean" output, but avoids false certainty.

### Pattern 3: Diff-First Incremental Expansion

**What:** Start from changed files, then expand through known dependency edges.
**When to use:** Pre-commit and PR workflows that need fast feedback.
**Trade-offs:** May miss hidden couplings unless dependency map quality improves.

## Data Flow

### Request Flow

```
Command Input
    ↓
Scope Resolver → Boundary Classifier → Dependency/Owner/Test Inference → Risk Engine
    ↓
Impact Report Renderer → MCP report write (optional) → Command display
```

### State Management

```
Request context (ephemeral)
    ↓
Analyzer outputs (typed in-memory model)
    ↓
Durable report artifact (if user asks to persist)
```

### Key Data Flows

1. **Diff to impact graph:** changed paths become impacted modules plus downstream estimates.
2. **Impact graph to governance:** impacted boundaries map to tests, owners, and deploy risk.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Small single-repo | Path rules + CODEOWNERS + heuristic dependency inference |
| Mid-size multi-service repo | Add explicit service map and ownership index cache |
| Large enterprise estate | Integrate external metadata APIs and cache snapshots |

### Scaling Priorities

1. **First bottleneck:** inaccurate dependency inference -> solve with maintained dependency manifest.
2. **Second bottleneck:** report latency on large diffs -> add bounded expansion and caching.

## Anti-Patterns

### Anti-Pattern 1: Risk Score Without Evidence

**What people do:** Return `high`/`medium`/`low` without explaining why.
**Why it's wrong:** Reviewers ignore ungrounded scores.
**Do this instead:** Attach evidence list + confidence for each risk contributor.

### Anti-Pattern 2: Binary Ownership Claims

**What people do:** Treat inferred owners as guaranteed truth.
**Why it's wrong:** Ownership data is often incomplete.
**Do this instead:** Separate `required`, `suggested`, and `unknown owner` outcomes.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Git provider PR metadata | Optional read enrichment | Keep v1 functional without it |
| Service catalog / CMDB | Optional ownership/dependency enrichment | Confidence should indicate source quality |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Command <-> MCP Tool | Structured request/response | MCP owns deterministic analysis + persistence |
| MCP Tool <-> report artifacts | Existing artifact report write path | Reuse established report conventions |

## Sources

- `docs/ARCHITECTURE.md`
- `docs/MCP-TOOLS.md`
- `docs/COMMAND-CATALOG.md`
- `.planning/codebase/ARCHITECTURE.md`

---
*Architecture research for: `/blu-impact`*
*Researched: 2026-04-24*
