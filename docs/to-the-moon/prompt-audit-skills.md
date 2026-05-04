# Blueprint Skill Quality Audit

Date: 2026-05-04

Scope: `skills/**/SKILL.md`, with reference-file sizes inspected only as supporting evidence for progressive-disclosure weight. This audit does not evaluate command behavior at runtime and does not implement fixes.

## Executive Summary

Blueprint's skills are unusually strong on deterministic state ownership: they repeatedly require MCP-owned writes, schema-first artifact authoring, authoritative returned paths/statuses, explicit confirmation gates, and implemented-only routing. The best examples are `skills/blueprint-phase-validation/SKILL.md`, `skills/blueprint-phase-planning/SKILL.md`, `skills/blueprint-review/SKILL.md`, and `skills/blueprint-map/SKILL.md`.

The main quality risk is that several skills have become command-family manuals rather than small reusable skill procedures. `skills/blueprint-review/SKILL.md` is 649 lines and embeds six full command workflows; `skills/blueprint-maintenance/SKILL.md` is 328 lines and embeds nine maintenance workflows. This works as a contract archive, but it weakens progressive disclosure and raises the chance that an LLM loads sibling-command instructions it does not need.

The second major risk is affordance inconsistency. Most skills say MCP calls must use runtime FQNs, but many Required MCP Tool lists use shorthand IDs while bootstrap/router use full `mcp_blueprint_*` IDs. That creates avoidable translation work exactly where skill files should reduce ambiguity.

## Scorecard

| Dimension | Rating | Evidence-backed assessment |
|---|---:|---|
| Progressive disclosure | B- | Strong `input_bundles` pattern, but large top-level family skills retain too much command detail. |
| Small reusable procedures | C+ | Many procedures are clear, but common guardrails and stage rules are copied across skills instead of factored. |
| Tool affordance clarity | B | Argument and returned-field guidance is strong; canonical FQN usage is inconsistent. |
| Deterministic artifact writes | A- | Repeated schema-first MCP write constraints are a clear strength. |
| Bounded subagent delegation | B+ | Most subagent rules are bounded and parent-owned; a few Optional Agent sections are too thin or over-broad. |
| Examples | D | No dedicated example sections were found; only frontmatter "Example scenarios" and inline "such as" cases. |
| Failure handling | A- | Skills consistently require honest blocked/no-write reporting, validation repair, and no hand-written fallback artifacts. |
| Context hygiene | B | Active-command input rules are strong, but long all-in-one command-family files still add context load. |

## Findings

### 1. Progressive disclosure exists, but several top-level skills are too large

The strongest pattern is command-scoped `input_bundles`. For example, `skills/blueprint-phase-execution/SKILL.md:41` says shipped execution commands are docs-free at runtime and resolve inputs from structured bundles, and `skills/blueprint-phase-execution/SKILL.md:46` explicitly says to load only the active command's reference bundle. `skills/blueprint-phase-discovery/SKILL.md:41` and `skills/blueprint-phase-validation/SKILL.md:60` through `skills/blueprint-phase-validation/SKILL.md:66` repeat the same good context-hygiene rule.

The issue is size and density. `skills/blueprint-review/SKILL.md` is 649 lines and includes separate full workflows for `code-review` (`skills/blueprint-review/SKILL.md:132`), `code-review-fix` (`skills/blueprint-review/SKILL.md:182`), `secure-phase` (`skills/blueprint-review/SKILL.md:260`), `ui-review` (`skills/blueprint-review/SKILL.md:356`), `audit-fix` (`skills/blueprint-review/SKILL.md:425`), and `review` (`skills/blueprint-review/SKILL.md:540`). `skills/blueprint-maintenance/SKILL.md` similarly covers nine commands from `workstreams` through `reapply-patches` (`skills/blueprint-maintenance/SKILL.md:123` through `skills/blueprint-maintenance/SKILL.md:298`).

Recommendation: keep top-level `SKILL.md` files closer to a dispatcher contract plus shared invariants, and move detailed per-command checklists into command-local references. Where a skill serves many high-risk commands, consider one skill per command family slice or make the top-level procedure a compact "choose active bundle, load it, run self-check" wrapper.

### 2. MCP affordance guidance is good, but FQN usage is inconsistent

Every skill tells the model to call tools through runtime FQNs, e.g. `skills/blueprint-docs/SKILL.md:29`, `skills/blueprint-review/SKILL.md:47`, and `skills/blueprint-maintenance/SKILL.md:59`. Some skills also list required tools as full FQNs, such as `skills/blueprint-bootstrap/SKILL.md:67` through `skills/blueprint-bootstrap/SKILL.md:75` and `skills/blueprint-router/SKILL.md:59` through `skills/blueprint-router/SKILL.md:65`.

Most other Required MCP Tool sections list shorthand names instead. Examples: `skills/blueprint-docs/SKILL.md:53` through `skills/blueprint-docs/SKILL.md:58`, `skills/blueprint-phase-validation/SKILL.md:68` through `skills/blueprint-phase-validation/SKILL.md:86`, and `skills/blueprint-phase-planning/SKILL.md:55` through `skills/blueprint-phase-planning/SKILL.md:75`. Those same skills later self-check against runtime FQNs, such as `skills/blueprint-docs/SKILL.md:146` through `skills/blueprint-docs/SKILL.md:150` and `skills/blueprint-phase-validation/SKILL.md:182` through `skills/blueprint-phase-validation/SKILL.md:184`.

Recommendation: make all allowlists canonical. Either list only runtime FQNs, or use a two-column pattern like `runtime FQN -> short label`. Avoid requiring the model to translate in the same file that could have supplied the exact callable name.

### 3. Repeated shared guardrails are drifting

Many skills repeat the same runtime rules: "call MCP tools only through runtime FQNs", "translate shorthand tool ids", "skills are guidance, not callable tools", and "never run `/blu-*` in the shell". This is useful, but repetition has already produced small drift. `skills/blueprint-phase-execution/SKILL.md:54` through `skills/blueprint-phase-execution/SKILL.md:57` repeats the shorthand-translation rule twice. `skills/blueprint-review/SKILL.md:204` through `skills/blueprint-review/SKILL.md:208` repeats the automatic-commit prohibition for `--auto`.

There is already a better pattern in bootstrap: `skills/blueprint-bootstrap/SKILL.md:39` through `skills/blueprint-bootstrap/SKILL.md:40` loads `references/runtime-guardrails.md`, and `skills/blueprint-bootstrap/SKILL.md:63` through `skills/blueprint-bootstrap/SKILL.md:65` defines that file as the host-entrypoint/FQN/anti-legacy guardrail authority.

Recommendation: extract common runtime call rules into one shared reference and have each skill state only command-specific deltas. This would shrink files and reduce accidental contradictions.

### 4. Deterministic artifact writing is the strongest skill pattern

Several skills provide excellent tool-affordance detail for persistence:

- `skills/blueprint-phase-validation/SKILL.md:95` through `skills/blueprint-phase-validation/SKILL.md:104` defines exact validation/write inputs, model-only constraints, returned authoritative fields, and post-write validation.
- `skills/blueprint-phase-planning/SKILL.md:90` gives a precise model-first plan write flow, including `authoringMode: "model-only"`, `validationMode: "strict"`, and a concrete warning against double-encoded `planId`.
- `skills/blueprint-review/SKILL.md:118` through `skills/blueprint-review/SKILL.md:126` defines scope derivation, authoring context, model validation, review recording, report writing, and authoritative returned fields.
- `skills/blueprint-map/SKILL.md:126` through `skills/blueprint-map/SKILL.md:132` requires substantive mapping content to go through `blueprint_codebase_artifact_write`, repair invalid writes from returned issues, and validate the bundle.

This is high-quality reusable skill behavior. It turns artifact writes into deterministic API interactions instead of prompt-local Markdown generation.

### 5. Subagent delegation is mostly bounded, with a few thin sections

The best subagent rules clearly define when a subagent may run, what it may return, and what the parent command still owns. Examples:

- `skills/blueprint-bootstrap/SKILL.md:82` through `skills/blueprint-bootstrap/SKILL.md:88` gates agents on bundled definitions and bounded read-only synthesis, then gives a no-subagent fallback.
- `skills/blueprint-phase-discovery/SKILL.md:181` says the parent owns synthesis, questions, persistence, and routing.
- `skills/blueprint-review/SKILL.md:213` through `skills/blueprint-review/SKILL.md:217` keeps `blueprint-reviewer` read-only for `code-review-fix`.
- `skills/blueprint-review/SKILL.md:321` through `skills/blueprint-review/SKILL.md:325` says `blueprint-security-auditor` cannot persist artifacts, mutate files, invent threats, or route the user.
- `skills/blueprint-review/SKILL.md:572` through `skills/blueprint-review/SKILL.md:577` blocks `blueprint-reviewer` from invoking external reviewer CLIs or replacing unavailable reviewers.

The weaker cases are places where the Optional Agents list is broader than the actual command-specific guidance. `skills/blueprint-roadmap-admin/SKILL.md:95` through `skills/blueprint-roadmap-admin/SKILL.md:98` lists `blueprint-roadmapper` and `blueprint-verifier`, but `add-phase` and `insert-phase` later explicitly say there is no subagent path (`skills/blueprint-roadmap-admin/SKILL.md:128`, `skills/blueprint-roadmap-admin/SKILL.md:143`). `skills/blueprint-docs/SKILL.md:60` through `skills/blueprint-docs/SKILL.md:63` lists doc agents, and `skills/blueprint-docs/SKILL.md:115` through `skills/blueprint-docs/SKILL.md:118` says when to use them, but it does not state the same "cannot persist, cannot route, cannot widen scope" boundaries found in review.

Recommendation: make Optional Agents command-scoped where possible, and add a standard "parent owns persistence/routing; subagent stays read-only unless explicitly stated" clause to every skill that lists agents.

### 6. Failure handling is consistently strong

Most skills explicitly reject false success. Representative examples:

- `skills/blueprint-capture/SKILL.md:161` requires duplicate, unhealthy, invalid, partial, or skipped results to be repaired or reported honestly.
- `skills/blueprint-debug/SKILL.md:174` through `skills/blueprint-debug/SKILL.md:176` says rejected, invalid, partial, skipped, or blocked debug work must be repaired or reported plainly.
- `skills/blueprint-maintenance/SKILL.md:323` through `skills/blueprint-maintenance/SKILL.md:325` requires returned statuses and dirty/drift/validation/dry-run conflicts to drive the result.
- `skills/blueprint-review/SKILL.md:635` through `skills/blueprint-review/SKILL.md:638` says validation diagnostics, tool rejections, failed verification, stale context, open threats, unavailable reviewers, dry-run boundaries, skipped mutation, and partial or blocked outcomes must be repaired once when allowed or reported honestly.

Recommendation: preserve this pattern. It is one of the clearest places where Blueprint's skills are better than generic "do the task" prompts.

### 7. Examples are missing as reusable skill assets

I found no dedicated `## Examples` or `### Example` sections in `skills/*/SKILL.md`. There are only frontmatter usage scenarios in a few descriptions, such as `skills/blueprint-bootstrap/SKILL.md:6` through `skills/blueprint-bootstrap/SKILL.md:9`, `skills/blueprint-governance/SKILL.md:7` through `skills/blueprint-governance/SKILL.md:9`, `skills/blueprint-map/SKILL.md:7` through `skills/blueprint-map/SKILL.md:10`, and `skills/blueprint-router/SKILL.md:6` through `skills/blueprint-router/SKILL.md:11`.

Recommendation: add small, non-verbose examples to the relevant local references rather than bloating top-level skills. Useful examples would be:

- one happy-path invocation with the minimum MCP call sequence,
- one no-write/blocked example,
- one overwrite-confirmation example,
- one model-validation-repair example,
- one subagent-unavailable fallback example.

### 8. Context hygiene is intentional but undermined by all-in-one command summaries

The skills often explicitly prohibit sibling-context loading. `skills/blueprint-capture/SKILL.md:44` says to load only the active command inputs. `skills/blueprint-roadmap-admin/SKILL.md:50` says roadmap-admin commands do not use docs as active runtime inputs. `skills/blueprint-review/SKILL.md:613` through `skills/blueprint-review/SKILL.md:615` makes sibling review contracts a completion-check failure.

However, if a host loads the whole top-level skill body, sibling summaries are already present in context. The strongest example is `skills/blueprint-review/SKILL.md`, where a `/blu-code-review` run receives the `audit-fix`, `secure-phase`, `ui-review`, and peer-review workflow text in the same loaded file. The maintenance skill has the same issue for high-risk git/workspace/archive operations.

Recommendation: keep top-level `SKILL.md` files intentionally sparse and rely on `input_bundles` references for command detail. The current files already have the metadata needed to support that pattern.

## Top Priorities

1. Split or slim the largest family skills, starting with `skills/blueprint-review/SKILL.md` and `skills/blueprint-maintenance/SKILL.md`.
2. Standardize Required MCP Tool lists on runtime FQNs, or explicitly map shorthand to FQN in each allowlist.
3. Extract repeated runtime guardrails into a shared reference and remove duplicated local copies.
4. Add compact examples to command-local references, especially for blocked/no-write, overwrite confirmation, and validation repair.
5. Make Optional Agent sections command-scoped and consistently state read/write/routing boundaries.

## Notable Strengths To Preserve

- `input_bundles` command-scoping is the right primitive for progressive disclosure.
- Schema-first artifact persistence is consistently emphasized and should remain non-negotiable.
- Returned MCP paths/statuses are treated as authoritative throughout the skill set.
- Implemented-only routing appears as a durable cross-skill invariant.
- High-risk commands consistently require visible confirmation gates and honest blocked states.
