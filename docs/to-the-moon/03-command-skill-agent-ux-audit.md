# Subagent C: Command, Skill, Agent, and UX Coherence Audit

Worktree: `/Users/rhishi/dev/repositories/blueprint-top5-20260504-194251`

Output owner: Subagent C

Scope: command TOML, skills, agents, `docs/commands`, command catalog, README, help/progress/next behavior, and workflow lifecycle docs. Discovery only; no fixes implemented.

## Executive Summary

Blueprint has the core UX primitives a user needs: `/blu` as the front door, direct `/blu-<command>` entrypoints, `.blueprint/` as durable state, command specs with reads/writes/gates, and router rules that explicitly restrict recommendations to implemented commands. The strongest coherence point is the implemented-only routing contract: `commands/blu.toml`, `skills/blueprint-router/SKILL.md`, `docs/RUNTIME-REFERENCE.md`, and `src/mcp/tools/project.ts` all reinforce catalog-gated routing.

The main problem is not absence of information. It is cognitive load and drift. A new user faces 53 implemented direct commands plus root `/blu`, one planned-but-documented `/blu-do`, six broad command families, 15 skill bundles, and 15 agent contracts. The information is spread across README, command catalog, artifact schema, phase lifecycle, runtime reference, implementation order, progress, skill docs, and per-command specs. Users can eventually answer "what runs, what writes, and what is next," but they have to stitch together too many layers.

The highest-impact UX defects are:

1. `/blu-do` is simultaneously documented with runnable-looking examples and root-routable metadata, while catalog/progress/router runtime guidance say it is planned and non-routable.
2. Public and control-plane docs contain visible drift: README says its list controls public availability but also calls its runtime layout representative; architecture and implementation-order docs contain stale shipped-surface claims.
3. Several command docs still carry generic or misleading boilerplate, especially around `fast`, `quick`, and `debug`, which are already the hardest lightweight-execution commands to distinguish.

## Command Taxonomy

Observed inventory:

| Surface | Count | Notes |
|---|---:|---|
| Command TOML files | 54 | Root `commands/blu.toml` plus 53 implemented direct command manifests. No `commands/blu-do.toml` exists. |
| Catalog rows | 54 | 53 implemented direct commands plus planned `do`. Root `/blu` is intentionally outside this table. |
| `docs/commands/*.md` files | 56 | Includes `root-router.md`, planned `do.md`, and `_template.md`. |
| Skill bundles | 15 | Host-discoverable `skills/<name>/SKILL.md` bundles. |
| Agent contracts | 15 | `agents/*.md` contracts. |

Catalog families:

| Family | Catalog Count | User Mental Model |
|---|---:|---|
| Foundation | 7 | Install/load, bootstrap, map existing repo, health, config, status. |
| Core Lifecycle | 10 | Discuss, research, UI spec, plan, execute, validate, UAT, pause/resume, next. |
| Roadmap And Milestone | 9 | Add/insert/remove phases, audit and close milestones, start next milestone. |
| Capture And Lightweight Execution | 10 | Notes, todos, backlog, explore, fast, quick, debug, plus planned `do`. |
| Quality And Shipping | 12 | Reviews, fixes, security/UI audits, docs, tests, impact, PR branch, ship, undo. |
| Workspace And Maintenance | 6 | Workspaces, workstreams, update, cleanup, patch replay. |

Suggested user-facing compression:

| User Intent | Preferred Front Door | Direct Commands To Expose First |
|---|---|---|
| "What should I do?" | `/blu` or `/blu-next` | `/blu-progress`, `/blu-help` |
| "Start or map this repo" | `/blu` | `/blu-map-codebase`, `/blu-new-project`, `/blu-health` |
| "Run a normal phase" | `/blu-next` | discuss -> research/UI -> plan -> execute -> validate -> verify |
| "Capture small project state" | `/blu-explore` | `/blu-note`, `/blu-add-todo`, `/blu-add-backlog` |
| "Do small code work" | `/blu-quick` | `/blu-fast` only for obvious trivial edits, `/blu-debug` only for diagnosis |
| "Make roadmap changes" | `/blu-progress` first | `/blu-add-phase`, `/blu-insert-phase`, `/blu-remove-phase`, milestone commands |
| "Harden or ship" | `/blu-progress` first | code review, add tests, secure/UI review, pr-branch, ship, undo |
| "Manage workspaces/maintenance" | explicit direct command | new/remove workspace, workstreams, update, cleanup, reapply-patches |

## Evidence Table

| Area | Evidence | UX Impact |
|---|---|---|
| Implemented-only routing is well specified | `commands/blu.toml` requires catalog-gated recommendations and blocked-substrate explanations at lines 13-16 and 20-25. `skills/blueprint-router/SKILL.md` treats `implemented: true` as the only routable state at lines 67-72 and repeats the completion check at lines 106-108. | Strong foundation. Users can trust `/blu`, `/blu-help`, `/blu-progress`, and `/blu-next` if the docs stay aligned. |
| Runtime status semantics are deterministic | `src/mcp/tools/project.ts` computes `blockedBy`, `requiredToolsSatisfied`, `status`, and `implemented` from manifest/skill/tool/runtime-input checks at lines 641-740. | Good internal substrate. Coherence issues are mostly documentation and product-surface issues, not a missing runtime concept. |
| `/blu-do` is contradictory | Catalog marks `do` as `planned` at `docs/COMMAND-CATALOG.md:20`; `PROGRESS.md` says it is incomplete and non-routable at lines 7-25; `src/mcp/tools/project.ts` has a docless fallback row with `declaredStatus: "planned"` at lines 202-212. But `docs/commands/do.md` says `Root-routable | Yes` at line 7 and gives runnable examples at lines 24-28. | High confusion. Users and agents can read the command spec and think `/blu-do` is safe to run even though the live surface intentionally hides it. |
| README public-surface promise conflicts with representative runtime list | README says unlisted commands are not public at line 9, but the "Current Runtime Layout" list is explicitly representative at line 19 and omits many shipped commands while listing a stale-looking `skills/blueprint-router.md` path at line 34. | High onboarding risk. A user cannot tell whether README command lists are exhaustive, representative, or historical. |
| README status language is stale/noisy | README still says "Wave 0 shipped commands cover..." and "Phase 3 discovery commands are shipped" at lines 11-15, even though later sections list Wave 4 and Wave 5 commands at lines 221-244. | Medium confusion. The first viewport after the intro makes the product sound less shipped than the command surface actually is. |
| Architecture doc has visible stale repetitions | `docs/ARCHITECTURE.md` repeats Wave 5 maintenance status four times with inconsistent subsets at lines 20-26. It also lists source layout as `commands/blu/*.toml` and `skills/<skill>.md` at lines 40-47, while the actual command manifests are flat `commands/blu-*.toml` and skill handles are `skills/<name>/SKILL.md`. | Medium-to-high maintainability and audit risk. Agents using architecture as a map can look in wrong paths or inherit stale rollout assumptions. |
| Architecture says planned later agents that are already shipped | `docs/ARCHITECTURE.md` calls review/docs/debug/UI/security agent contracts "planned later runtime surfaces" at lines 65-68, while `docs/SKILLS-AND-AGENTS.md` lists `blueprint-debugger`, `blueprint-reviewer`, `blueprint-security-auditor`, `blueprint-ui-auditor`, `blueprint-doc-writer`, and `blueprint-doc-verifier` as implemented at lines 41-47. | Medium drift. Users may not know whether subagent-backed quality flows are actually available. |
| Implementation-order Wave 5 is stale | `docs/IMPLEMENTATION-ORDER.md` lists Wave 5 commands at lines 79-86 but says only `new-workspace` and `cleanup` shipped at line 88. `PROGRESS.md` marks `remove-workspace`, `workstreams`, `update`, and `reapply-patches` implemented at lines 80-85. | Medium drift in planning docs. A user planning maintenance work gets conflicting availability signals. |
| README gives a useful but crowded command grouping | README groups Foundation, Core lifecycle, Roadmap, Capture, and Quality/Maintenance at lines 163-244. The final group combines quality, review, docs, shipping, workspace, update, cleanup, and patch replay into 18 bullets at lines 221-244. | The grouping exists, but the last bucket is too broad for decision-making. It hides high-risk maintenance among quality tasks. |
| Phase lifecycle mental model is clear | `docs/PHASE-LIFECYCLE.md` gives the happy path and artifacts at lines 7-22, optional quality pass outputs at lines 24-32, completion signals at lines 34-42, and pause/resume behavior at lines 44-50. | Strong conceptual anchor. This should be promoted as the primary lifecycle map in README/help output. |
| Artifact model is clear but too deep for first-run onboarding | `docs/ARTIFACT-SCHEMA.md` defines the project tree at lines 3-23 and readiness states at lines 25-35. | Useful reference, but new users need a smaller "what gets written first" version before schema details. |
| Per-command specs include complete sections | `rg` checks found every `docs/commands/*.md` has `Command Path And Examples`, `Outputs`, and `User Prompts And Confirmation Gates`. | Strong baseline. The defect is quality and consistency of content, not missing section scaffolding. |
| Lightweight execution commands overlap | `fast` is "trivial" and no report at `docs/commands/fast.md:13-19`; `quick` is bounded with optional depth and report at `docs/commands/quick.md:13-18`; `debug` is investigation/report with possible follow-up routing at `docs/commands/debug.md:13-19`. | Users can distinguish them only after reading all three. README gives only one-line bullets at lines 217-219, which is not enough for the highest-overlap family. |
| `quick` examples omit the required task description | `docs/commands/quick.md` says a bounded task description should already exist at lines 29-33, but examples are `/blu-quick --full` and `/blu quick` at lines 23-27. | Low-effort fix with high clarity. The example should show a real task plus optional flags. |
| `fast` command doc has internal contradictions and boilerplate | `docs/commands/fast.md` says Blueprint reads are "none" at lines 44-47, but required MCP tools include `blueprint_project_status` and `blueprint_state_update` at lines 56-60. It also carries capture boilerplate edge cases and acceptance language at lines 101-124. | Medium confusion for a command whose entire value is sharp boundaries. |
| `debug` command doc carries capture boilerplate | `docs/commands/debug.md` contains note/todo/backlog edge cases at lines 134-138 and "Capture outputs stay deterministic" acceptance language at lines 149-156. | Low-effort quality bug. It makes the debug contract feel template-generated instead of purpose-built. |
| Confirmation gates exist but are scattered | README safety model summarizes high-risk confirmation at lines 284-291. Per-command specs include gate sections; e.g. `pr-branch` confirmation is detailed in docs, and router skill refuses vague high-risk routing at lines 110-112. | Good safety posture, but users need one normalized "preview -> confirm -> mutate -> report" rule by family. |
| Command availability is split across docs and runtime metadata | Runtime reference says docs remain control-plane history, not runtime inputs, at `docs/RUNTIME-REFERENCE.md:54-59`. Catalog says live `blueprint_command_catalog` is actual availability at `docs/COMMAND-CATALOG.md:3`. | Accurate but not user-friendly. The user should not need to know which docs are runtime-owned, source-owned, or control-plane history. |

## Confusing Areas

1. `/blu-do` vs `/blu`

`/blu` already accepts freeform guidance such as `/blu what should I do next` in README examples. `/blu-do` is planned as a direct freeform router, but docs present it with a runnable CLI path and root-routable flag. The intended distinction appears to be: `/blu` is the current front door; `/blu-do` is a future direct freeform alias with a stricter taxonomy. That distinction is not cleanly enforced in `docs/commands/do.md`.

2. `fast` vs `quick` vs `debug`

The conceptual distinctions are good:

- `fast`: trivial inline execution, no subagents, no report.
- `quick`: bounded execution with optional depth and a durable quick-run report.
- `debug`: diagnosis first, durable report, follow-up gate before fixes.

But README gives only one-line descriptions, `quick` examples omit a task, and the command docs carry copied capture edge cases. This is probably the highest-frequency user confusion zone.

3. Quality vs shipping vs maintenance

README combines quality review, docs update, tests, PR branch prep, ship, undo, workspace creation/removal, workstreams, update, cleanup, and patch replay in one "Quality, review, docs, and shipping" section. That grouping hides risk differences: `/blu-code-review` writes a review artifact, while `/blu-remove-workspace`, `/blu-undo`, and `/blu-reapply-patches` can mutate filesystem or git state.

4. "Current runtime" vs "retained baseline" vs "public"

The docs use multiple status frames: retained baseline, additive `/blu-impact`, live runtime catalog, source-owned runtime metadata, docs-aligned specs, behavior-audit queue, Wave 0/3/4/5. These are valuable for maintainers but too many for users. Public user docs should collapse these into: available now, not public yet, use `/blu-help` for live truth.

5. Source and skill paths

README and architecture still mention stale or compatibility paths such as `skills/blueprint-router.md` and `commands/blu/*.toml`, while `docs/SKILLS-AND-AGENTS.md` correctly says runtime skills are `skills/<name>/SKILL.md`. This matters because command/skill/agent coherence is path-sensitive.

## Low-Effort UX Wins

1. Fix `/blu-do` presentation.
   Change `docs/commands/do.md` to mark root-routable as "No until implemented" or add a prominent "planned-only, not public" banner above examples. Keep the taxonomy, but prevent runnable-looking examples from being mistaken for current UX.

2. Replace README's "Current Runtime Layout" section.
   Either remove it or make it an explicit maintainer note. Do not combine "README lists public commands" with "representative rather than exhaustive." If retained, update paths to `skills/<name>/SKILL.md`.

3. Split README's Quality/Maintenance section.
   Use separate headings: "Quality Evidence", "Release And Git", and "Workspace And Maintenance." Keep high-risk commands visibly separate.

4. Add a one-screen command chooser.
   Before the full command list, add a compact table:
   "I want to..." -> "Run this first" -> "Writes" -> "Needs confirmation?"

5. Tighten examples for high-overlap commands.
   Replace `/blu-quick --full` with something like `/blu-quick "Rename API_ENV to BLUEPRINT_API_ENV and update focused tests" --validate`. Add concrete `fast` and `debug --diagnose` examples.

6. Remove copied capture boilerplate from non-capture docs.
   At minimum clean `docs/commands/fast.md`, `docs/commands/quick.md`, and `docs/commands/debug.md` edge cases and acceptance criteria.

7. Normalize confirmation language.
   Use one repeated phrase per family: "preview first, explicit confirmation, MCP write, report/state update." Apply it visibly in README, help text, and high-risk command specs.

8. Add "artifact read/write" summaries to README for common flows.
   Users do not need every MCP tool, but they do need "this reads ROADMAP/STATE; this writes XX-PLAN; this mutates repo files."

## High-Impact Product Simplifications

1. Make `/blu` the only freeform router for v1.
   Keep `/blu-do` in maintainer docs as a future alias or remove it from user-facing command specs until it ships. This removes one planned command and one mental-model branch without losing current functionality.

2. Introduce "modes" instead of exposing all commands equally.
   Suggested top-level modes: Start, Plan, Build, Verify, Improve, Ship, Maintain. The direct commands remain available, but README/help should lead with modes and only reveal detailed commands inside each mode.

3. Collapse lightweight execution into a triage ladder.
   Present as:
   - Use `/blu-fast` only for one obvious tiny edit.
   - Use `/blu-quick` for bounded repo tasks.
   - Use `/blu-debug --diagnose` when the problem is unclear.
   - Use lifecycle commands when work deserves durable planning.

4. Make `/blu-next` the canonical lifecycle driver.
   README already recommends it, and runtime manifests ground it in state. Lean harder into `/blu-next` after every lifecycle step so users do not need to remember optional research/UI/quality edges.

5. Turn the command catalog into a generated public reference.
   The table is valuable but dense. A generated public catalog could show command, family, writes, risk, confirmation, and example. That would reduce drift between README, catalog, progress, and specs.

6. Separate user docs from maintainer docs.
   User docs should not lead with waves, drift-repair phases, source-owned runtime metadata, or behavior-audit tags. Maintainer docs should keep those, but public README/help should use product language.

## Recommendations Ranked By User Impact

| Rank | Recommendation | Impact | Effort |
|---:|---|---|---|
| 1 | Resolve `/blu-do` public-status contradiction across `docs/commands/do.md`, README, catalog, and router docs. | Prevents users/agents from trying a planned-only router. | Low |
| 2 | Replace README's stale/runtime-layout opening with a concise "Start here" mental model and a generated available-command link/table. | Improves first-run confidence immediately. | Medium |
| 3 | Split quality/shipping/maintenance in README and help guidance, with high-risk commands visually isolated. | Reduces accidental selection of destructive workflows. | Low |
| 4 | Add a command chooser table keyed by intent, artifacts written, and confirmation gates. | Lets users pick the right command without reading 50 specs. | Medium |
| 5 | Clean copied boilerplate in `fast`, `quick`, and `debug`, and update examples to include realistic tasks. | Clarifies the most overlapping command family. | Low |
| 6 | Refresh architecture and implementation-order docs to match current file layout and shipped Wave 5 status. | Reduces agent and maintainer drift. | Low |
| 7 | Promote `docs/PHASE-LIFECYCLE.md` into README/help as the canonical phase map. | Helps users trust `/blu-next` and understand artifacts. | Low |
| 8 | Add a normalized confirmation-gate matrix for high-risk commands. | Makes safety posture visible before mutation. | Medium |
| 9 | Consider hiding low-frequency direct commands from default help unless the user asks for "all commands." | Reduces command overload while preserving power-user access. | Medium |

## Commands And Web Searches Run

Read-only commands used:

- Read required worktree instructions first: `sed -n '1,240p' AGENTS.md`.
- Inventoried surfaces: `rg --files commands`, `rg --files skills`, `rg --files agents`, `rg --files docs/commands`.
- Read core docs: `README.md`, `docs/COMMAND-CATALOG.md`, `docs/PHASE-LIFECYCLE.md`, `docs/SKILLS-AND-AGENTS.md`, `docs/RUNTIME-REFERENCE.md`, `docs/IMPLEMENTATION-ORDER.md`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/ARTIFACT-SCHEMA.md`, `docs/MCP-TOOLS.md`, `PROGRESS.md`.
- Read representative manifests/specs: `commands/blu*.toml`, `docs/commands/root-router.md`, `help.md`, `progress.md`, `next.md`, `do.md`, `fast.md`, `quick.md`, `debug.md`.
- Inspected runtime catalog behavior: `src/mcp/tools/project.ts`, `src/mcp/command-runtime-metadata.ts`, and relevant tests via `rg`.
- Counted and compared surfaces with `find`, `wc -l`, `comm`, `rg`, and shell loops.
- Checked owned output directory and worktree state with `ls -la docs/to-the-moon`, `find docs/to-the-moon`, `git status --short`, and `git rev-parse --show-toplevel`.

Failures or unavailable tools:

- `sed -n '1,160p' docs/DRIFT.MD` failed because `docs/DRIFT.MD` does not exist in this worktree. `rg --files docs | rg -i drift` found no drift doc.
- One `rg` invocation containing unescaped backticks failed because the shell interpreted the backticked words as command substitutions. I reran safer searches without that pattern.
- No web searches were run. Web access was available, but the audit questions were answerable from repo-local command, skill, agent, source, and docs evidence.

