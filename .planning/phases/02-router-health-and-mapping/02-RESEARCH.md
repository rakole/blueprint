# Phase 2: Router, Health, and Mapping - Research

**Researched:** 2026-04-11
**Domain:** Wave 0 read-path commands, config governance, and brownfield codebase mapping on top of the shipped Blueprint foundation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Keep Phase 2 aligned with the Wave 0 order already captured in the roadmap: `settings` and `set-profile` first, then `help` / `progress` / `health`, then `map-codebase`.
- Build strictly on top of the shipped Phase 1 runtime surface. Extend the existing MCP tool modules and command layout instead of introducing prompt-owned persistence or a second state path.
- Treat `settings` as the normalized config workflow over project config plus optional saved defaults, and keep `set-profile` project-local by mutating only `model_profile`.
- Keep `/blu`, `help`, `progress`, and other router-style read paths Gemini-native and inline. Do not reintroduce slash-command chaining, hidden aliases, or prompt-only state inference.
- Make `health` diagnosis-first and repair-second. Non-repair mode must report exact missing or malformed state; repair mode may mutate only after an explicit confirmation-style path.
- Treat `.blueprint/codebase/STACK.md`, `ARCHITECTURE.md`, `CONVENTIONS.md`, `TESTING.md`, `INTEGRATIONS.md`, and `CONCERNS.md` as the stable mapping artifact set for downstream commands.
- Verify the phase with fixture-backed tests plus `npm run typecheck`, `npm run build`, and `npm test`.

### the agent's Discretion
- Internal file and helper boundaries under `src/mcp/tools/`
- Exact command phrasing inside the new TOML prompts
- The heuristics used to summarize repo evidence into the six codebase artifacts, as long as filenames and overwrite rules stay fixed

### Deferred Ideas (OUT OF SCOPE)
- Lifecycle orchestration commands such as `discuss-phase`, `plan-phase`, `execute-phase`, `next`, `pause-work`, and `resume-work`
- Additional brownfield analysis commands beyond `map-codebase`
- Hook activation settings or any repo-level hook toggles

</user_constraints>

<research_summary>
## Summary

Phase 2 is an extension phase, not an architecture-reset phase. Phase 1 already shipped the minimum viable runtime shell: `gemini-extension.json`, `GEMINI.md`, `/blu`, `/blu:new-project`, a buildable MCP server, deterministic bootstrap tooling, and the first fixture-driven test suite. The missing work is the rest of Wave 0: command contracts and MCP read/mutate helpers that let the extension inspect, repair, and summarize real `.blueprint/` state instead of stopping at bootstrap.

The safest path is to keep the public tool vocabulary aligned with the locked docs and fill the obvious gaps in the existing modules. `src/mcp/tools/config.ts` already handles normalized config composition and reserved-key rejection, so it should grow `blueprint_config_set_profile` and legacy/minimal-config migration rather than spawning a second config path. `src/mcp/tools/state.ts` currently writes state but cannot read or reconstruct it, so Phase 2 should add `blueprint_state_load` and `blueprint_state_sync`. `src/mcp/tools/artifacts.ts` currently scaffolds bootstrap files but does not list, validate, or summarize artifacts, so it should grow the read-path helpers that `progress`, `health`, and `map-codebase` depend on. `src/mcp/tools/project.ts` already distinguishes partial initialization and parses the command catalog, which means the new command layer can reuse it instead of inventing fresh heuristics.

There is also a repo-specific nuance: runtime-facing docs are now slightly behind the shipped implementation. `GEMINI.md` still describes only the Phase 1 command surface, and `README.md` still frames the repo as purely docs-first. Phase 2 should treat those as follow-through work where the new command coverage would otherwise make the extension appear more limited or more speculative than it really is.

**Primary recommendation:** Plan Phase 2 as three sequential plans that mirror the roadmap exactly:
1. add the governance/config command layer (`settings`, `set-profile`, profile setter, migration rules, config tests),
2. add read-path and repair flows (`help`, `progress`, `health`, shared state/artifact inspectors, runtime-doc alignment),
3. add deterministic brownfield mapping (`map-codebase`, codebase artifact helpers, mapping fixtures and overwrite handling).
</research_summary>

<standard_stack>
## Standard Stack

Phase 2 should stay on the same runtime and testing stack that Phase 1 already proved.

### Core
| Library / Surface | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript MCP server under `src/mcp/` | repo-selected | Deterministic state reads and writes | Already shipped in Phase 1 and matches Blueprint's locked architecture |
| `commands/blu/*.toml` | current repo pattern | Direct command entrypoints | Keeps command UX thin and explicit |
| `node:test` via `tsx --test` | repo-selected | Fixture-driven verification | Already used by the Phase 1 suite and fast enough for every plan |
| Normalized `.blueprint/config.json` schema v2 | locked in docs | Shared config contract | Required by `settings`, `set-profile`, `progress`, and `health` |

### Supporting
| Tooling | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `rg` | shell tool | Contract and artifact verification | Use for exact-string checks in plans and tests |
| `git` and git-tracked file discovery | shell tool | Brownfield mapping evidence | Use in `map-codebase` to understand repo shape without hidden state |
| Temp-repo fixtures under `tests/fixtures/` | repo pattern | Uninitialized, partial, migrated, and brownfield scenarios | Use for every new command-specific test suite |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extend current `config.ts`, `state.ts`, and `artifacts.ts` | Create new one-off command-local helpers | Faster to sketch, but it scatters state ownership and drifts from the MCP contracts |
| Deterministic codebase artifact set | Free-form mapper notes | Easier initially, but later discovery and planning commands need stable filenames |
| Runtime-facing doc refresh during Phase 2 | Leave stale README and `GEMINI.md` until a later docs pass | Lower immediate scope, but misleading runtime docs would undercut the shipped command surface |

</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Pattern 1: Config-first governance surface
**What:** Keep repo and defaults config normalization in `src/mcp/tools/config.ts`, then make `settings` and `set-profile` thin command contracts over those tools.
**When to use:** Any user-facing config mutation in Phase 2.
**Why it fits:** The command specs already assume `blueprint_config_get`, `blueprint_config_set`, and `blueprint_config_set_profile`; Phase 1 already proved the first two layers.

### Pattern 2: Shared inspectors for read-path commands
**What:** Put project-state reading and repair primitives in MCP tools (`blueprint_project_status`, `blueprint_state_load`, `blueprint_state_sync`, `blueprint_artifact_list`, `blueprint_artifact_validate`) and let `/blu:help`, `/blu:progress`, and `/blu:health` compose them.
**When to use:** Routing, status, health, and next-step guidance.
**Why it fits:** It keeps router-style commands Gemini-native and avoids prompt-only heuristics about whether a repo is initialized or healthy.

### Pattern 3: Stable codebase artifact bundle
**What:** Treat codebase mapping as a fixed bundle of six `.blueprint/codebase/*.md` files backed by deterministic repo evidence.
**When to use:** `map-codebase` and later brownfield planning steps.
**Why it fits:** The filenames are already locked in `docs/ARTIFACT-SCHEMA.md`, and later commands depend on them.

### Anti-Patterns to Avoid
- **Command-owned filesystem mutation:** do not let TOML prompts write or normalize `.blueprint/` files directly when an MCP tool should own the mutation.
- **Scope leakage between project and defaults config:** `set-profile` must not mutate `~/.gemini/blueprint/defaults.json`, and `settings` must not quietly write saved defaults unless the user explicitly takes that path.
- **Silent health repair:** `health` should not rewrite malformed config or recreate state in read-only mode.
- **Ad hoc codebase filenames:** `map-codebase` should not invent extra brownfield docs or drift back toward `.planning/codebase/`.

</architecture_patterns>

<validation_architecture>
## Validation Architecture

Phase 2 should add one focused test file per plan and keep the Phase 1 suite green:

1. `tests/settings-profile.test.ts`
   - Covers `blueprint_config_set`, `blueprint_config_set_profile`, legacy/minimal-config migration, reserved-key rejection, defaults isolation, and command-contract alignment for `settings` / `set-profile`.
2. `tests/help-progress-health.test.ts`
   - Covers uninitialized vs partial vs initialized status reporting, `blueprint_state_load`, `blueprint_state_sync`, `blueprint_artifact_list`, `blueprint_artifact_validate`, command-contract alignment for `help` / `progress` / `health`, and repair-mode behavior.
3. `tests/map-codebase.test.ts`
   - Covers codebase artifact scaffolding, summary digest generation, overwrite/reuse behavior, and command-contract alignment for `map-codebase`.

**Required automated commands**
- `npm run typecheck`
- `npm run build`
- `npm test`

**Required fixture shapes**
- initialized Blueprint repo
- partial `.blueprint/` repo
- legacy/minimal-config repo
- malformed defaults input
- brownfield codebase repo with recognizable `package.json`, `src/`, `tests/`, and `docs/` evidence

**Manual-only checks worth keeping**
- install the extension into Gemini CLI and run `/blu:settings`, `/blu:progress`, `/blu:health`, and `/blu:map-codebase` interactively to confirm the prompts and summaries feel coherent outside the test harness
- run `map-codebase` against a real brownfield repo to sanity-check the usefulness of the generated summaries

</validation_architecture>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Project vs defaults config mutation | Separate ad hoc JSON writers inside command prompts | `blueprint_config_get`, `blueprint_config_set`, and `blueprint_config_set_profile` | Keeps precedence, migration, and reserved-key handling in one place |
| Repo readiness inference | Prompt-only checks for `.blueprint/` files | `blueprint_project_status`, `blueprint_state_load`, and `blueprint_artifact_list` | Makes `help`, `progress`, and `health` consistent |
| Mapping output persistence | Free-form writes to whichever markdown files seem useful | `blueprint_artifact_scaffold` plus `blueprint_artifact_summary_digest` for the six locked codebase docs | Later commands need deterministic filenames and a stable bundle |

**Key insight:** Phase 2's complexity is mostly integration complexity. The risky shortcuts are not algorithmic; they are places where state ownership could drift out of MCP and into prompt prose.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Confusing uninitialized and partially initialized repos
**What goes wrong:** `help`, `progress`, or `health` pretend the repo is ready because `.blueprint/` exists, even though core files are missing.
**Why it happens:** Phase 1 already introduced partial-state detection, but Phase 2 adds more read paths that might bypass it.
**How to avoid:** Route all readiness decisions through shared project/state/artifact helpers and assert partial-state fixtures in tests.
**Warning signs:** A command only checks for the `.blueprint/` directory or only checks one core file.

### Pitfall 2: Letting `set-profile` drift into a general settings writer
**What goes wrong:** A narrow profile command starts mutating saved defaults or unrelated config keys.
**Why it happens:** The underlying config setter is broad, so the fast path is to reuse it without a dedicated guardrail.
**How to avoid:** Add `blueprint_config_set_profile` with an enum input and a return shape that exposes only `updatedKeys: ["model_profile"]`.
**Warning signs:** Tests need to assert multiple changed keys after a profile switch, or defaults JSON changes during a project-local profile update.

### Pitfall 3: Overwriting edited codebase mapping docs without a real guardrail
**What goes wrong:** `map-codebase` replaces handcrafted `STACK.md` or `CONCERNS.md` content on rerun.
**Why it happens:** Artifact scaffolding is currently optimized for bootstrap creation and reuse, not brownfield refresh decisions.
**How to avoid:** Make artifact listing/validation expose existing codebase docs, have the command detect heavily edited files, and require an explicit replace path before overwrite.
**Warning signs:** Reruns silently replace files or treat every pre-existing codebase doc as a scaffold placeholder.

</common_pitfalls>

<open_questions>
## Open Questions

1. **How aggressive should `health --repair` be when `STATE.md` is missing?**
   - What we know: the command spec allows config and state repair in repair mode.
   - What remains open: whether repair should recreate a missing state file from surviving artifacts or stop after describing the gap.
   - Recommendation: allow repair mode to regenerate `.blueprint/STATE.md` from known artifacts via `blueprint_state_sync`, but never do this in read-only mode.

2. **Where should mapping synthesis logic live once `artifacts.ts` grows?**
   - What we know: the public tool names belong to the artifact family.
   - What remains open: whether the internal digest builder stays in `artifacts.ts` or moves to a helper module.
   - Recommendation: keep the public tool in `artifacts.ts` for Phase 2, but extract pure helper functions if the file becomes too large.

3. **How much stale documentation should Phase 2 refresh?**
   - What we know: `GEMINI.md` and `README.md` lag the current runtime state.
   - What remains open: whether to stop at runtime-facing docs or also refresh broader planning/handoff text.
   - Recommendation: update `GEMINI.md` and the README sections that would misdescribe the shipped runtime; leave broader narrative cleanup for a later docs-focused pass.

</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- `AGENTS.md` - repo guardrails and read order
- `.planning/PROJECT.md` - current milestone and shipped Phase 1 context
- `.planning/REQUIREMENTS.md` - requirement IDs FND-04, FND-05, and FND-06
- `.planning/ROADMAP.md` - Phase 2 goal, success criteria, and plan breakdown
- `.planning/STATE.md` - current readiness for planning and current focus
- `.planning/phases/02-router-health-and-mapping/02-CONTEXT.md` - locked Phase 2 decisions and code context
- `docs/DECISIONS.md` - locked product/state decisions
- `docs/ARCHITECTURE.md` - runtime ownership model
- `docs/ARTIFACT-SCHEMA.md` - `.blueprint/` schema and codebase artifact names
- `docs/MCP-TOOLS.md` - required Phase 2 tool names and return shapes
- `docs/GEMINI-CONSTRAINTS.md` - Gemini runtime constraints
- `docs/TEST-STRATEGY.md` - testing layers and command-spec expectations
- `docs/commands/root-router.md`
- `docs/commands/settings.md`
- `docs/commands/set-profile.md`
- `docs/commands/help.md`
- `docs/commands/progress.md`
- `docs/commands/health.md`
- `docs/commands/map-codebase.md`
- `src/mcp/server.ts`
- `src/mcp/tools/project.ts`
- `src/mcp/tools/config.ts`
- `src/mcp/tools/state.ts`
- `src/mcp/tools/artifacts.ts`
- `commands/blu.toml`
- `commands/blu/new-project.toml`
- `tests/new-project.test.ts`
- `tests/phase-01-validation.test.ts`
- `GEMINI.md`
- `README.md`

</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Blueprint Gemini extension Wave 0 read-path and mapping flows
- Existing assets: Phase 1 MCP server, config normalization, project status, artifact scaffolding, fixture-test harness
- Missing pieces: profile setter, state readers/sync, artifact listing/validation/digest, direct Phase 2 commands, codebase artifact bundle
- Risks: scope leakage between project/defaults config, silent repair, stale runtime docs, destructive mapping refresh

**Confidence breakdown:**
- Repo contracts and required tool names: HIGH
- Current codebase gaps: HIGH
- Best module boundaries: MEDIUM
- Manual interactive behavior in Gemini CLI: MEDIUM

**Research date:** 2026-04-11
**Valid until:** 2026-05-11

</metadata>

---

*Phase: 02-router-health-and-mapping*
*Research completed: 2026-04-11*
*Ready for planning: yes*
