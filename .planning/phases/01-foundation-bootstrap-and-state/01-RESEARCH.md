# Phase 1: Foundation Bootstrap and State - Research

**Researched:** 2026-04-11
**Domain:** Gemini CLI extension bootstrap with MCP-backed deterministic project state
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Keep Phase 1 limited to the smallest installable loop: manifest, `GEMINI.md`, `/blu`, `/blu:new-project`, MCP server bootstrap, and initial fixture-based tests.
- Use a minimal `gemini-extension.json` that follows current Gemini CLI extension examples and keeps extra surface area out of scope.
- Treat `/blu` as a safe root router and `/blu:new-project` as the first mutating direct command.
- Route persistent writes through MCP tools only.
- Allow the read-only `blueprint_command_catalog` tool in Phase 1 because the root router depends on retained-command metadata, while keeping later-wave mutating tool families out of scope.
- Seed `.blueprint/config.json` as a normalized full v2 config object that matches `docs/ARTIFACT-SCHEMA.md`.
- Keep `.planning/` local to Blueprint development and `.blueprint/` as the shipped runtime state directory.
- Verify Phase 1 through fixture-style happy-path tests, the main missing-precondition path, the highest-risk `new-project` edge case required by the command spec, and a deterministic packaging/install-path smoke proof.

### the agent's Discretion
- Internal module boundaries under `src/`
- The exact build and test tooling
- Helper utilities for normalization, markdown generation, and path safety

### Deferred Ideas (OUT OF SCOPE)
- Phase 2 Wave 0 read-path commands
- Later lifecycle, roadmap, review, workspace, and maintenance commands

</user_constraints>

<research_summary>
## Summary

Phase 1 does not need a broad Gemini integration surface. The strongest pattern across the locked Blueprint docs and current public Gemini CLI extension examples is a thin extension shell: a root `gemini-extension.json`, a `GEMINI.md` context file, command TOMLs in `commands/`, and optional extension-managed MCP server wiring. That lines up cleanly with Blueprint's architectural rule that commands own UX while MCP owns deterministic state changes.

The repo docs already lock most of the important decisions. What still matters for planning is sequencing and failure avoidance. The safest implementation path is to create a minimal installable scaffold first, then add just enough MCP tools to make `/blu` and `/blu:new-project` real, then add tests that prove `.blueprint/` artifacts, normalized config, required negative paths, and packaging/install-path readiness are deterministic. Anything beyond that increases surface area before the shared primitives are stable.

The only Phase 1 exception to the `new-project`-focused tool set is the read-only `blueprint_command_catalog` surface needed by the root router. That still fits the locked architecture because it adds routing metadata, not a broader mutating tool family.

**Primary recommendation:** Plan Phase 1 as a tight three-plan sequence: extension shell first, MCP primitives second, `/blu:new-project` plus fixture tests third.
</research_summary>

<standard_stack>
## Standard Stack

The standard building blocks for this phase are structural rather than framework-heavy.

### Core
| Library / Surface | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `gemini-extension.json` | Current Gemini CLI extension format | Root extension manifest | Official Gemini CLI extensions use a small root manifest and keep context in `GEMINI.md` |
| `GEMINI.md` | Current Gemini CLI context file pattern | Extension-wide guidance and default context | Official extensions point `contextFileName` at `GEMINI.md` |
| `commands/*.toml` | Current Gemini CLI command format | Direct and router command entrypoints | Blueprint docs already assume TOML command contracts |
| TypeScript MCP server under `src/mcp/` | Repo-selected | Deterministic state engine | Matches Blueprint's locked architecture and keeps persistence out of prompts |

### Supporting
| Tooling | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `npm test`-backed fixture runner | Repo-selected | Happy-path artifact verification | Use from the first mutating command onward |
| Config normalization helpers | Repo-selected | Full-schema `.blueprint/config.json` writes | Required whenever defaults, repo config, and command inputs merge |
| Repo-relative path safety helpers | Repo-selected | Prevent traversal and out-of-bound writes | Required in every MCP write surface |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MCP-owned file writes | Prompt-only command mutation | Faster to sketch, but violates locked architecture and becomes non-deterministic |
| Minimal extension shell | Broad initial command surface | Feels productive early, but makes contracts unstable before the foundation loop works |
| Full normalized config writes | Sparse override files | Less typing, but harder to validate, migrate, and inspect consistently |

</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Pattern 1: Thin command, deterministic MCP
**What:** Keep command TOMLs and `GEMINI.md` focused on UX, while every persistent operation lives in explicit MCP tool handlers.
**When to use:** For all Blueprint commands that create or mutate `.blueprint/` state.
**Why it fits Phase 1:** `/blu:new-project` is the first place Blueprint proves this architecture works in real code.

### Pattern 2: Smallest viable vertical slice
**What:** Ship the first end-to-end command loop before expanding the command surface.
**When to use:** When a docs-first repo needs to turn architecture into executable code without overcommitting.
**Why it fits Phase 1:** The roadmap already defines a single vertical slice: extension shell + MCP primitives + `new-project`.

### Pattern 3: Contract-first artifact generation
**What:** Generate `.blueprint/` files from locked docs and normalized defaults, not from incidental runtime state.
**When to use:** For project bootstrap, config seeding, and phase artifact scaffolding.
**Why it fits Phase 1:** Deterministic output is a stated success criterion and a prerequisite for later commands.

### Anti-Patterns to Avoid
- **Prompt-owned persistence:** putting file creation rules only in TOML prose instead of MCP handlers creates drift and hidden behavior.
- **`.planning/` leakage:** any generated runtime artifact or command copy that refers users to `.planning/` breaks the locked product state boundary.
- **Over-scaffolding:** implementing read-path or lifecycle commands before the `new-project` loop works increases rework risk.

</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persistent project initialization | Free-form prompt instructions that write files directly | `blueprint_project_init` plus artifact helpers | Deterministic writes, path safety, and normalized config matter immediately |
| Command routing state | Hidden slash-command chaining conventions | Explicit `/blu` router contract and direct `/blu:<command>` TOMLs | Blueprint explicitly rejects upstream slash-command chaining assumptions |
| Partial config management | Ad hoc sparse JSON overlays | Full normalized v2 config object with controlled precedence | Migration, health checks, and future commands need predictable structure |

**Key insight:** The cheapest-looking shortcuts in Phase 1 mostly violate the exact contracts that Blueprint is trying to establish.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Treating local GSD artifacts as product state
**What goes wrong:** Generated files or prompts reference `.planning/` instead of `.blueprint/`.
**Why it happens:** This repo is itself managed with GSD, so the local planning layer is easy to confuse with the product contract.
**How to avoid:** Make `.blueprint/` and `~/.gemini/blueprint/` explicit in `GEMINI.md`, command TOMLs, tool code, and tests.
**Warning signs:** File templates, tool handlers, or router prompts mention `.planning/` outside development-only docs.

### Pitfall 2: Building command UX before the MCP layer is real
**What goes wrong:** The extension looks wired up, but command prompts cannot safely create or normalize Blueprint artifacts.
**Why it happens:** Commands are easy to scaffold, while deterministic write logic takes more care.
**How to avoid:** Make plan 2 the MCP foundation plan and let plan 3 depend on it.
**Warning signs:** `commands/blu/new-project.toml` exists but tool names or return shapes are still placeholders.

### Pitfall 3: Leaving config shape ambiguous
**What goes wrong:** Early commands write only partial config keys, making later health and settings flows harder to implement.
**Why it happens:** Sparse config feels simpler during bootstrap.
**How to avoid:** Normalize `.blueprint/config.json` to the full v2 schema from day one.
**Warning signs:** The generated config omits `workflow`, `parallelization`, or `safety` sections, or still contains repo-level `hooks.*` keys.

</common_pitfalls>

<open_questions>
## Open Questions

1. **Exact manifest fields beyond the minimal root example**
   - What we know: Official public extensions use `name`, `version`, `contextFileName`, and may add `mcpServers`.
   - What's unclear: Whether Blueprint needs any additional manifest metadata on day one beyond those minimal fields.
   - Recommendation: Keep the initial manifest minimal and verify any extra keys only against current official extension behavior during implementation.

2. **Exact Gemini CLI TOML affordances for command flags and tool invocation phrasing**
   - What we know: Blueprint command docs assume TOML entrypoints and explicit slash command paths.
   - What's unclear: Which niceties should live in the TOML versus `GEMINI.md` versus command-local prompts.
   - Recommendation: Implement the happy path first and keep command prose aligned to the docs, then expand ergonomics only after `new-project` is proven.

</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- `docs/DECISIONS.md` — locked product and state-boundary decisions
- `docs/ARCHITECTURE.md` — runtime layer ownership and extension shape
- `docs/ARTIFACT-SCHEMA.md` — `.blueprint/` tree and normalized config schema
- `docs/MCP-TOOLS.md` — required tool names and return contracts
- `docs/IMPLEMENTATION-ORDER.md` — Wave 0 and Phase 1 sequencing
- `docs/commands/root-router.md` — `/blu` routing contract
- `docs/commands/new-project.md` — `/blu:new-project` contract

### Secondary (MEDIUM confidence)
- [Firebase extension for the Gemini CLI](https://firebase.google.com/docs/ai-assistance/gcli-extension) — current install flow and extension behavior overview
- [Conductor `gemini-extension.json`](https://github.com/gemini-cli-extensions/conductor/blob/main/gemini-extension.json) — current minimal manifest example with `contextFileName`
- [gcloud `gemini-extension.json`](https://github.com/gemini-cli-extensions/gcloud/blob/main/gemini-extension.json) — current manifest example that includes `mcpServers`

</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Gemini CLI extension bootstrap
- Ecosystem: extension manifest, context file, command TOMLs, MCP wiring
- Patterns: deterministic bootstrap, normalized config, thin command / thick MCP
- Pitfalls: state-boundary leakage, over-scaffolding, config ambiguity

**Confidence breakdown:**
- Repo contract: HIGH — locked in project docs
- Extension manifest shape: MEDIUM — based on current public examples rather than a dedicated schema doc
- Planning sequence: HIGH — roadmap and implementation-order docs are explicit
- Test approach: MEDIUM — repo docs require tests, but the exact runner remains open

**Research date:** 2026-04-11
**Valid until:** 2026-05-11

</metadata>

---

*Phase: 01-foundation-bootstrap-and-state*
*Research completed: 2026-04-11*
*Ready for planning: yes*
