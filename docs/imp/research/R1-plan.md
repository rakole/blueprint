# R1 Plan: Agentic Codebase Investigation Improvements For `/blu-research-phase`

**Status:** ready for approval
**Scope:** R1 only from `docs/imp/research/research-phase-frontier-research-and-improvement-plan.md`
**Planner:** Codex
**Prepared:** 2026-05-12

## Inputs Read

The plan below is based only on the R1 section of the improvement plan, while using the rest of the file only to avoid scope collisions.

Read inputs:

- `docs/imp/research/research-phase-frontier-research-and-improvement-plan.md`
- `commands/blu-research-phase.toml`
- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
- `skills/blueprint-phase-discovery/SKILL.md`
- `agents/blueprint-project-researcher.md`
- `agents/blueprint-researcher.md`

Additional local files inspected to make the implementation instructions exact:

- `src/mcp/artifact-contracts/index.ts`
- `src/mcp/command-runtime-metadata.ts`
- `docs/commands/research-phase.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/RUNTIME-REFERENCE.md`
- `tests/phase-discovery-research.test.ts`
- `tests/agent-contract-specialists.test.ts`

## R1 Commitments To Implement

R1 does not ask for a new research engine. It asks for better research behavior around existing `/blu-research-phase` contracts.

Implement these R1 commitments:

1. Separate exploration from synthesis more explicitly.
2. Add a visible investigation trace: files/artifacts inspected, retrieval mode, key findings, implementation questions, and confidence.
3. Add a compact navigation evidence packet before deep topic-strand work.
4. Make repo evidence retrieval quality explicit: saved context, saved codebase summaries, scoped search, optional semantic/navigation packets, then targeted full-file/test reads.
5. Require each topic strand to close with a planning handoff: recommendation, affected files/modules, validation/test implications, unresolved blockers, and confidence.
6. Tighten `blueprint-researcher` so it returns bounded findings with source classes, paths/URLs, confidence, failed/limited searches, and unanswered questions.
7. Treat context files, skills, and saved summaries as valuable but potentially stale: cite them, then confirm live repo agreement before planner-grade claims.
8. Add tests/golden assertions for research usefulness, not only structural validity.

## R1 Non-Goals

Do not implement these in this R1 slice:

- Do not add a graph, LSP, SCIP, ctags, Tree-sitter, Sourcegraph, or semantic-navigation MCP substrate.
- Do not add a new MCP tool.
- Do not change `research.external_sources=off|ask|auto`.
- Do not make web access required for valid research.
- Do not change `blueprint_phase_research_status`, `planningReadiness`, or phase-readiness behavior.
- Do not change checkpoint schema.
- Do not change `blueprint_phase_artifact_write` strict validation.
- Do not add source-register, claim-support, Plan Input Queue, or access-date validation from later sections.
- Do not edit `agents/blueprint-project-researcher.md`; it is a bootstrap/new-project specialist, not the `/blu-research-phase` sidecar. It was read for contrast only.

## File Change Summary

Edit these files:

1. `commands/blu-research-phase.toml`
2. `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
3. `skills/blueprint-phase-discovery/SKILL.md`
4. `agents/blueprint-researcher.md`
5. `src/mcp/artifact-contracts/index.ts`
6. `src/mcp/command-runtime-metadata.ts`
7. `docs/commands/research-phase.md`
8. `docs/ARTIFACT-SCHEMA.md`
9. `docs/MCP-TOOLS.md`
10. `docs/RUNTIME-REFERENCE.md`
11. `tests/phase-discovery-research.test.ts`
12. `tests/agent-contract-specialists.test.ts`
13. `dist/` generated files after build

Do not edit:

- `agents/blueprint-project-researcher.md`
- `src/mcp/tools/phase.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/phase-checkpoint-records.ts`
- `docs/COMMAND-CATALOG.md`
- command status/routing semantics

## Exact Change 1: Command Manifest

File: `commands/blu-research-phase.toml`

### 1A. Add R1 command-local gates

Find this existing bullet:

```text
- Read `mcp_blueprint_blueprint_config_get` with `scope: "effective"` before any external verification step and honor `research.external_sources` as `off`, `ask`, or `auto`. Keep repo-derived evidence distinct from official docs or explicitly supplied external references, and avoid implying live external verification happened when it did not.
```

Immediately after it, insert:

```text
- Build a concise investigation trace before deep strand work: initial assessment, relevant saved artifacts, relevant repo files or symbols, retrieval mode, key findings, implementation questions, and confidence. Prefer saved context, saved codebase summaries, scoped repo searches, and optional parent-supplied navigation packets over broad crawls.
- For each non-trivial topic strand, close with a planning handoff that names the recommendation, affected files or modules, validation or test implications, unresolved blockers, evidence basis, and confidence.
- When using `blueprint-researcher`, give it one bounded evidence question plus allowed source classes and require bounded findings with paths or URLs, retrieval notes, confidence, failed or limited searches, and unanswered questions. Do not ask it for broad plans, final persisted research ownership, external fetches, user decisions, checkpoints, state sync, or routing.
```

### 1B. No subtraction in manifest

Do not remove any existing manifest tool names or gates.

## Exact Change 2: Research Runtime Contract

File: `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`

### 2A. Add retained behavior bullets

In `## Parity Target`, under `The retained behaviors that matter are:`, add these bullets after the existing saved context bullet:

```md
- visible initial assessment before deep research: relevant saved artifacts, repo files or symbols, key findings, implementation questions, and confidence
- compact navigation evidence before broad reads: source class, retrieval mode, path or symbol, evidence role, finding, limits, and why the search stopped or widened
```

Add this bullet after the existing topic-strand bullet:

```md
- per-strand planning handoff with recommendation, affected files or modules, validation or test implications, unresolved blockers, evidence basis, and confidence
```

### 2B. Replace Execute stage wording

Find:

```md
- `Execute`: research one topic strand at a time and keep evidence provenance
  visible.
```

Replace with:

```md
- `Execute`: build the initial assessment and navigation evidence packet,
  research one topic strand at a time, close each strand with a planning
  handoff, and keep evidence provenance visible.
```

### 2C. Add an investigation trace section

Insert this entire section immediately before `## Capability-Gated Subagent Path`.

````md
## Investigation Trace And Navigation Evidence

Before deep strand work, create a concise parent-owned investigation trace. The
trace is not a new persistence owner and does not require a new MCP tool. It is
the working evidence shape the parent uses while drafting `XX-RESEARCH.md` from
`contract.authoringTemplate`.

The initial assessment should answer:

- which saved Blueprint artifacts were inspected
- which repo files, tests, manifests, commands, skills, contracts, or symbols
  look relevant
- which retrieval mode found them: saved context, saved codebase summary,
  scoped `rg`, targeted file read, parent-supplied semantic/navigation packet,
  official or supplied external packet, or inference
- the key findings so far
- implementation questions that still matter for planning
- current confidence and why

Use this repository evidence ladder before widening research:

1. saved `XX-CONTEXT.md` content and requirement mapping
2. existing `XX-RESEARCH.md` when updating
3. saved `.blueprint/codebase/` summaries surfaced by
   `blueprint_phase_context.codebase`
4. compact file, symbol, command, artifact, or contract anchors already present
   in saved context
5. scoped repo searches such as targeted path or term searches, keeping normal
   ignore behavior unless the strand explains why hidden, generated, vendored,
   or ignored files matter
6. optional parent-supplied navigation packets such as definitions, references,
   symbol maps, dependency edges, or code-search hints when the host already
   has them
7. targeted full-file, test, manifest, command, skill, runtime-contract, or
   built-entrypoint reads

Do not treat "more files read" as better research. Widen only when the current
strand cannot be answered from narrower evidence. Record why the search stopped
or widened.

A compact navigation evidence packet should use this shape in prose, tables, or
the optional `## Investigation Trace` template section:

```text
Evidence ID: NAV-001
Strand: <strand id or topic>
Retrieval mode: saved-context | codebase-summary | scoped-rg | targeted-read | parent-navigation-packet | external-packet | inference
Source class: blueprint-artifact | repo-code | repo-test | repo-config | command-manifest | skill-contract | runtime-contract | built-entrypoint | official-reference | supplied-reference | inference
Path / symbol / URL: <repo path, symbol, URL, or supplied source label>
Role: definition | reference | test | config | contract | runtime | example | background | inference
Finding: <what this proves for planning>
Limits: <staleness, partial coverage, missing lines, no-hit search, heuristic navigation, or none>
Stop or widen reason: <why this evidence is enough or what would justify more search>
```

Treat context files, skills, runtime contracts, and saved summaries as valuable
but potentially stale. Cite them as repo evidence, then check that the live
repository still agrees before presenting them as planner-grade truth.

Each non-trivial topic strand must close with a planning handoff:

```text
Strand: <id/topic>
Recommendation: <planner-ready direction or "no safe recommendation">
Affected files/modules: <repo paths, command surfaces, contracts, tests, or none>
Validation or test implications: <specific tests/checks or "not yet known">
Unresolved blockers: <none or exact blocker>
Evidence basis: <NAV/source ids or concise citations>
Confidence: LOW|MEDIUM|HIGH with reason
```

When evidence is partial, inconclusive, stale, or blocked by source policy,
lower confidence and preserve the uncertainty in `## Open Questions`, the
strand handoff, or the research checkpoint. Do not turn a weak strand into a
confident recommendation.
````

### 2D. Add artifact authoring guidance

In `## Artifact Authoring Rules`, add this bullet after the current `## Summary` bullet:

```md
- Optional `## Investigation Trace` content, when present in the authoring
  template, records the initial assessment, navigation evidence packet, and
  per-strand planning handoffs. Populate it for non-trivial research, but do
  not make older valid artifacts fail solely because they lack this optional
  heading.
```

Add this bullet after the current `## Recommendations` bullet:

```md
- Each planner-critical recommendation should be traceable to a strand handoff
  that names affected files or modules, validation or test implications,
  unresolved blockers, evidence basis, and confidence.
```

Replace the current `## Sources` bullet:

```md
- `## Sources` separates repo evidence, official or supplied external
  references, and inference. Do not blend these source classes.
```

with:

```md
- `## Sources` separates repo evidence, official or supplied external
  references, and inference. Do not blend these source classes. For repo
  evidence that supports planner-critical recommendations, prefer path or
  symbol plus evidence role such as definition, reference, test, config,
  contract, runtime, or example, and name the retrieval mode when it affects
  confidence.
```

### 2E. Replace subagent handoff language

In `## Capability-Gated Subagent Path`, keep the current pass-list but add this bullet to the list of what the parent passes the agent:

```md
- one bounded evidence question, expected source classes, retrieval boundaries,
  and the strand handoff fields the parent needs back
```

Find this paragraph:

```md
Ask the agent for populated research content or a bounded section draft with
warnings. The agent must not imply it fetched official docs itself. If the
parent asks for official-doc comparison without an external evidence packet,
the agent should mark the claim unverified and ask the parent for confirmation
or supplied evidence. The parent command owns synthesis, user gates,
normalization, checkpointing, final artifact persistence, state updates, and
routing.
```

Replace it with:

```md
Ask the agent for bounded findings by default, not broad plans or final
persistence ownership. The response should include the strand/question,
concise answer, source classes, paths or URLs, retrieval notes, confidence,
failed or limited searches, unanswered questions, and a planning handoff.
Ask for a bounded section draft only when the parent names target headings from
`contract.authoringTemplate`; the parent still merges, normalizes, validates,
and persists the final artifact.

The agent must not imply it fetched official docs itself. If the parent asks
for official-doc comparison without an external evidence packet, the agent
should mark the claim unverified and ask the parent for confirmation or
supplied evidence. The parent command owns synthesis, evidence acceptance, user
gates, normalization, checkpointing, final artifact persistence, state updates,
and routing.
```

### 2F. Tighten no-subagent fallback

In `## No-Subagent Fallback`, replace steps 1 through 3:

```md
1. Build a compact carry-forward packet: phase boundary, requirement mapping,
   saved context decisions, codebase bundle status, existing research posture,
   and current open questions.
2. Select one topic strand, such as stack, architecture, dependency/runtime
   availability, validation/testing impact, risk/pitfalls, or sources.
3. Read only the repo files or saved Blueprint artifacts needed for that
   strand. Use official or supplied references only for claims the repo cannot
   settle, and only when the `research.external_sources` policy allows them.
```

with:

```md
1. Build a compact carry-forward packet: phase boundary, requirement mapping,
   saved context decisions, codebase bundle status, existing research posture,
   initial assessment, navigation evidence packet, and current open questions.
2. Select one topic strand, such as stack, architecture, dependency/runtime
   availability, validation/testing impact, risk/pitfalls, sources, or a
   specific implementation question from the initial assessment.
3. Follow the repository evidence ladder for that strand: saved context,
   existing research, saved codebase summaries, scoped searches, optional
   parent-supplied navigation packets, then targeted file/test/contract reads.
   Use official or supplied references only for claims the repo cannot settle,
   and only when the `research.external_sources` policy allows them.
```

### 2G. Add output quality criteria

In `## Output Quality Criteria`, add these bullets after `requirements are mapped to research support`:

```md
- the artifact exposes enough investigation trace for planning: relevant saved
  artifacts, repo files or symbols, retrieval modes, key findings,
  implementation questions, and confidence
- planner-critical recommendations have strand handoffs naming affected files
  or modules, validation or test implications, unresolved blockers, evidence
  basis, and confidence
```

## Exact Change 3: Shared Discovery Skill

File: `skills/blueprint-phase-discovery/SKILL.md`

### 3A. Add evidence ladder to workflow rule 0

Find workflow rule `0.`:

```md
0. Treat `blueprint_phase_context.codebase` as reusable brownfield repo evidence when it is present. Prefer the saved `.blueprint/codebase/` summaries before re-reading broad repo surfaces, and call out when the codebase bundle is missing or incomplete.
   Sweep prior-phase context first so the session reuses the current evidence base before it asks for fresh detail; this is a saved-artifact sweep, not a dedicated todo/backlog file crawl.
```

Replace with:

```md
0. Treat `blueprint_phase_context.codebase` as reusable brownfield repo evidence when it is present. Prefer the saved `.blueprint/codebase/` summaries before re-reading broad repo surfaces, and call out when the codebase bundle is missing or incomplete. Treat saved summaries as useful but potentially stale: cite them, then confirm the live repo still agrees before using them as planner-grade truth.
   Sweep prior-phase context first so the session reuses the current evidence base before it asks for fresh detail; this is a saved-artifact sweep, not a dedicated todo/backlog file crawl.
```

### 3B. Add R1 research-phase workflow rules

In the `/blu-research-phase` numbered list, insert this new item after current item 5:

```md
6. Before deep strand work, build a concise investigation trace: relevant saved artifacts, relevant repo files or symbols, retrieval mode, key findings, implementation questions, and confidence. Prefer the runtime contract's repository evidence ladder over broad crawls: saved context, existing research, saved codebase summaries, scoped searches, optional parent-supplied navigation packets, then targeted file/test/contract reads.
```

Renumber the existing items 6 through 10 to 7 through 11.

After renumbering, replace the old subagent item with:

```md
7. Use `blueprint-researcher` only when a suitable Blueprint research or code-analysis agent is available and a bounded sidecar pass materially helps. The parent must supply any external evidence packet itself, with source title, date, URL, excerpt, claim, and whether it is an official reference or supplied reference. The parent must also supply one bounded evidence question, allowed source classes, retrieval boundaries, and expected handoff fields. Do not ask the subagent to fetch official docs, make broad plans, decide final confidence, persist artifacts, checkpoint, sync state, or route follow-up commands on its own.
```

Replace the old topic-strand item with:

```md
9. Break long-running research into topic-sized strands, checkpoint paused or inconclusive work, and use the runtime contract's single-agent fallback when no suitable subagent is available. Each non-trivial strand should close with a planning handoff: recommendation, affected files or modules, validation or test implications, unresolved blockers, evidence basis, and confidence. Do not use browser-only, web-search-only, shell-only, or generic agents as substitutes.
```

The final numbering for the `/blu-research-phase` list should be 1 through 11.

## Exact Change 4: `blueprint-researcher` Agent

File: `agents/blueprint-researcher.md`

### 4A. Remove duplicate purpose sentence

In `## Purpose`, remove this duplicated line:

```md
Artifact-grade mode supports comparing repo evidence against official docs with clear provenance.
```

Keep the next line:

```md
Artifact-grade mode supports comparing repo evidence against parent-supplied official-doc or external evidence packets with clear provenance.
```

### 4B. Add bounded investigation rules

After `## Source Hierarchy`, insert:

```md
## Investigation Trace Rules

Default to answering one bounded evidence question from the parent. Do not turn
a sidecar request into broad planning or whole-repo exploration.

For every substantive answer, return:

- the strand or question answered
- source classes used: repo evidence, locked Blueprint docs,
  parent-supplied external evidence, supplied reference, or inference
- repo paths, symbols, headings, URLs, or supplied-source labels that matter
- retrieval notes: how the evidence was found, scope searched, files read, and
  why the search stopped or widened
- failed, noisy, blocked, or intentionally skipped searches when they affect
  confidence
- confidence and unanswered questions
- planning handoff: recommendation, affected files or modules, validation or
  test implications, unresolved blockers, and evidence basis

Treat saved context files, skills, runtime contracts, and codebase summaries as
useful but potentially stale. Cite them, then check live repo files when the
claim needs planner-grade confidence.
```

### 4C. Replace Outputs section

Replace the current `## Outputs` section with:

```md
## Outputs

- artifact-grade mode: a bounded findings packet for one research strand or
  evidence question; include section draft Markdown only when the parent names
  target headings from the supplied `phase.research` authoring template
- gray-area memo mode: a concise read-only memo for one discuss-phase gray area
  or assumptions pass, not an `XX-RESEARCH.md` draft
- concrete recommendations with explicit tradeoffs when evidence supports them
- source-backed risks, constraints, implementation patterns, and comparison
  notes when official-doc or external evidence packets are part of the evidence
  set
- provenance-aware citations that let the parent trace each conclusion back to
  repo evidence or a named external reference
- failed or limited search notes when no-hit, too-broad, unreadable, stale, or
  not-allowed evidence affects confidence
```

### 4D. Replace Output Mode Selection section

Replace the current `## Output Mode Selection` section with:

```md
## Output Mode Selection

The parent prompt must say which mode is required.

- Use artifact-grade mode when `/blu-research-phase` needs source-backed
  findings that the parent can synthesize into `XX-RESEARCH.md`.
- In artifact-grade mode, default to a bounded findings packet. Do not return a
  full research body unless the parent explicitly asks for a full-artifact
  draft, supplies the full `phase.research` authoring template, and explains
  why a full draft is safer than parent synthesis.
- Use section-draft output only when the parent names target headings from the
  supplied template. The parent still merges, normalizes, validates, and
  persists.
- Use gray-area memo mode when `/blu-discuss-phase` needs bounded evidence for
  one gray area or assumptions pass before the parent synthesizes a user-facing
  question or context decision.
- If the parent does not specify a mode or bounded question, ask for
  clarification instead of returning artifact-shaped content by default.
- Do not use gray-area memo mode as a replacement for `/blu-research-phase` or
  as a hidden persistence path.
```

### 4E. Replace Required Output Contract section

Replace the current `## Required Output Contract` section with:

```md
## Required Output Contract

Use this contract for artifact-grade mode.

- Start with `Mode: artifact-grade` and `Strand:` or `Question:` so the parent
  can attach the packet to the active strand.
- Include `**Confidence:** LOW|MEDIUM|HIGH`.
- Include a concise answer.
- Include a `Findings` list. Each finding must name support status:
  `supported`, `partially-supported`, `conflict`, `unverified`, or
  `inference`.
- Include `Repo Sources` with path, optional symbol or heading, evidence role
  (`definition`, `reference`, `test`, `config`, `contract`, `runtime`,
  `example`, or `background`), and why it matters.
- Include `External Sources` only from parent-supplied or user-supplied packets.
  Preserve source title, date or access date, URL, excerpt or summary, claim,
  and whether it is an official reference or supplied reference.
- Include `Retrieval Notes`: search method, scope, candidate files, files read,
  failed/no-hit searches, and stop or widen reason when this affects
  confidence.
- Include `Planning Handoff`: recommendation, affected files or modules,
  validation or test implications, unresolved blockers, evidence basis, and
  confidence.
- Preserve the canonical section names and ordering only when the parent
  explicitly requests section-draft or full-artifact-draft output and supplies
  the template.
- Return concise warnings when evidence is weak, stale, unsupported, inferred,
  or blocked by missing parent external evidence.
- Keep citations, provenance, and repo-path evidence explicit enough for the
  parent to copy into `## Sources` or optional `## Investigation Trace`.
- Make it clear which conclusions came from repo evidence, which came from
  official docs or supplied external references, and which remain informed
  inference.
- Keep `## State Of The Art` freshness-sensitive claims clear about their
  evidence basis when the parent explicitly requests draft sections.
- Replace every angle-bracket placeholder before returning any draft section,
  and do not rename headings.
- Return only bounded findings, optional requested draft sections, and concise
  warnings for the parent command; do not mutate files directly.
```

### 4F. Add output quality bullet

In `## Output Quality Expectations`, after the first bullet, add:

```md
- Answer the exact bounded question the parent asked; do not widen into a broad
  plan or whole-artifact ownership unless the parent explicitly requested that
  exceptional mode.
```

### 4G. Add boundary

In `## Boundaries`, add this bullet before the final bullet:

```md
- Do not present a sidecar packet as final persisted research; the parent owns
  synthesis, evidence acceptance, MCP writes, checkpoint mutation, state sync,
  routing, and user-visible decisions.
```

## Exact Change 5: `blueprint-project-researcher`

File: `agents/blueprint-project-researcher.md`

Make no changes.

Reason: R1 is scoped to `/blu-research-phase`. `blueprint-project-researcher` is a bootstrap-context specialist for `/blu-new-project` and milestone-definition work. Editing it would broaden this R1 implementation outside the existing research phase.

## Exact Change 6: Research Artifact Template

File: `src/mcp/artifact-contracts/index.ts`

### 6A. Add optional Investigation Trace to template

In `renderResearchTemplate(...)`, find:

```md
## Summary

- <key conclusion>

## Locked Decisions From Context
```

Replace with:

```md
## Summary

- <key conclusion>

## Investigation Trace

### Initial Assessment

| Field | Notes |
|-------|-------|
| Saved artifacts inspected | <saved artifacts inspected> |
| Relevant repo files or symbols | <repo files or symbols inspected> |
| Retrieval modes used | <saved-context, codebase-summary, scoped-rg, targeted-read, parent-navigation-packet, external-packet, or inference> |
| Key findings | <initial finding for planning> |
| Implementation questions | <implementation question for planning> |
| Confidence | LOW|MEDIUM|HIGH - <confidence reason> |

### Navigation Evidence Packet

| Evidence ID | Strand | Retrieval Mode | Source Class | Path / Symbol / URL | Role | Finding | Limits | Stop Or Widen Reason |
|-------------|--------|----------------|--------------|---------------------|------|---------|--------|----------------------|
| NAV-001 | <strand id or topic> | <retrieval mode> | <source class> | <path, symbol, URL, or supplied label> | <definition, reference, test, config, contract, runtime, example, background, or inference> | <what this proves for planning> | <limits or none> | <why enough or why widened> |

### Strand Planning Handoff

| Strand | Recommendation | Affected Files Or Modules | Validation Or Test Implications | Unresolved Blockers | Evidence Basis | Confidence |
|--------|----------------|---------------------------|---------------------------------|---------------------|----------------|------------|
| <strand id or topic> | <planner-ready direction> | <repo paths, command surfaces, contracts, tests, or none> | <specific tests/checks or not yet known> | <none or exact blocker> | <NAV/source ids or concise citations> | LOW|MEDIUM|HIGH - <reason> |

## Locked Decisions From Context
```

Do not add `Investigation Trace` to `requiredHeadings`.

### 6B. Add placeholder signals

In the `phase.research` `placeholderSignals` array, add these strings after `"<key conclusion>",`:

```ts
      "<saved artifacts inspected>",
      "<repo files or symbols inspected>",
      "<saved-context, codebase-summary, scoped-rg, targeted-read, parent-navigation-packet, external-packet, or inference>",
      "<initial finding for planning>",
      "<implementation question for planning>",
      "<confidence reason>",
      "<strand id or topic>",
      "<retrieval mode>",
      "<source class>",
      "<path, symbol, URL, or supplied label>",
      "<definition, reference, test, config, contract, runtime, example, background, or inference>",
      "<what this proves for planning>",
      "<limits or none>",
      "<why enough or why widened>",
      "<planner-ready direction>",
      "<repo paths, command surfaces, contracts, tests, or none>",
      "<specific tests/checks or not yet known>",
      "<none or exact blocker>",
      "<NAV/source ids or concise citations>",
      "<reason>",
```

### 6C. Add contract note

In the `phase.research` `notes` array, add:

```ts
      "Optional Investigation Trace content should record initial assessment, navigation evidence, and strand planning handoffs for non-trivial research without becoming a new required heading.",
```

## Exact Change 7: Runtime Metadata

File: `src/mcp/command-runtime-metadata.ts`

Replace `RESEARCH_PHASE_RUNTIME_METADATA.runtimeReference.contractNotes` with this exact string:

```ts
      "Long-running-mutation profile for topic-strand phase research: keep Resolve/Read/Decide/Execute/Persist/Validate/Route narration plus resolved scope, active stage, pending gate, execution mode, and next safe action visible, use Gemini-native update_topic and write_todos for non-trivial multi-strand research without turning them into persistence, and when those helpers are unavailable fall back to short progress recaps plus MCP-backed checkpoints and STATE.md. Ground repo truth first in phase context, actual saved context content, existing research, saved codebase summaries, a concise initial assessment, and a navigation evidence packet before broad reads; stop on missing XX-CONTEXT.md instead of drafting from status-only signals. Prefer scoped repo searches, optional parent-supplied navigation packets, and targeted file/test/contract reads over broad crawls, and close each non-trivial strand with a planning handoff naming recommendation, affected files or modules, validation or test implications, blockers, evidence basis, and confidence. Read blueprint_config_get before any official-doc or external verification, honor research.external_sources as off/ask/auto, use official docs or explicitly supplied external references only when the repo cannot settle a claim, keep repo-derived evidence distinct from external truth in the finished research, treat State Of The Art freshness wording as runtime-contract guidance rather than an MCP validation gate, use skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md as the rich behavior contract, keep contract.authoringTemplate as schema authority, reserve blueprint_artifact_scaffold for deliberate placeholder creation only, use capability-gated blueprint-researcher only when suitable Blueprint research or code-analysis agents are available, require the parent to supply any official-doc or external evidence packet instead of asking the subagent to fetch it, require bounded sidecar findings with source classes, paths or URLs, retrieval notes, confidence, failed or limited searches, unanswered questions, and planning handoff fields, preserve the single-agent topic-strand fallback when subagents are unavailable, reject browser/web-search/shell-only or generic agents as substitutes, force repair when existing research is invalid, sync STATE.md even on valid non-writing reuse paths, repair invalid writes or validation failures before completion, checkpoint inconclusive strands instead of bluffing a final artifact, delete only research-owned shared checkpoints, and keep routing limited to implemented commands only.",
```

## Exact Change 8: Command Docs

File: `docs/commands/research-phase.md`

### 8A. Update Execute stage

Find:

```md
4. `Execute`: research one topic strand at a time, grounding repo truth first and keeping external evidence distinct when policy allows it.
```

Replace with:

```md
4. `Execute`: build an initial assessment and navigation evidence packet, then research one topic strand at a time, grounding repo truth first and keeping external evidence distinct when policy allows it.
```

### 8B. Add runtime anchors

In `## Research Runtime Anchors`, after the bullet about keeping repo evidence distinct from official docs, insert:

```md
- Build an investigation trace for non-trivial research: saved artifacts inspected, relevant repo files or symbols, retrieval modes, key findings, implementation questions, and confidence.
- Prefer the runtime contract's repository evidence ladder over broad crawls: saved context, existing research, saved codebase summaries, scoped repo searches, optional parent-supplied navigation packets, then targeted file/test/contract reads.
- Close each non-trivial topic strand with a planning handoff: recommendation, affected files or modules, validation or test implications, unresolved blockers, evidence basis, and confidence.
```

### 8C. Update subagent anchor

Find the bullet starting:

```md
- `blueprint-researcher` is optional and capability-gated.
```

Replace the whole bullet with:

```md
- `blueprint-researcher` is optional and capability-gated. Use it only when a suitable Blueprint research or code-analysis agent is available and a bounded sidecar pass materially helps; otherwise use the runtime contract's single-agent topic-strand fallback. Any official-doc or other external evidence packet must come from the parent command or user, not from the subagent fetching it on its own. The parent sends one bounded evidence question plus allowed source classes and expects bounded findings with source classes, paths or URLs, retrieval notes, confidence, failed or limited searches, unanswered questions, and planning handoff fields.
```

### 8D. Add acceptance criteria

In `## Acceptance Criteria`, after `Keeps repo truth explicit and distinct from official-doc or user-supplied external evidence.`, insert:

```md
- Records enough investigation trace for planning: saved artifacts, relevant repo files or symbols, retrieval modes, key findings, implementation questions, and confidence.
- Closes non-trivial strands with planning handoffs that name affected files or modules, validation or test implications, unresolved blockers, evidence basis, and confidence.
```

### 8E. Add test cases

In `## Test Cases`, append:

```md
- Investigation trace and navigation evidence packet fixture.
- Bounded `blueprint-researcher` packet contract fixture.
- Strand planning handoff fixture.
```

## Exact Change 9: Artifact Schema Docs

File: `docs/ARTIFACT-SCHEMA.md`

### 9A. Add optional heading in template structure

Under `XX-RESEARCH.md` canonical template structure, add this bullet after `## Summary`:

```md
- optional `## Investigation Trace` with initial assessment, navigation evidence packet, and strand planning handoff tables
```

### 9B. Add validation expectation note

Under `Validation expectations`, add:

```md
- `## Investigation Trace` is optional and planner-facing; when present, it should record initial assessment, navigation evidence, and strand handoffs, but older valid research artifacts are not invalid solely because they lack it
```

### 9C. Update exact persistence template

In the exact persistence template, insert the same `## Investigation Trace` block from Exact Change 6A immediately after `## Summary`.

### 9D. Add contract note

Under `Contract notes`, add:

```md
- Populate optional `## Investigation Trace` for non-trivial research so `/blu-plan-phase` can see how evidence was found and why each strand is ready, partial, or blocked.
```

## Exact Change 10: MCP Tools Docs

File: `docs/MCP-TOOLS.md`

Find the long `research-phase` bullet under command behavior. In that bullet, insert these phrases without changing tool lists:

```text
build a concise initial assessment and navigation evidence packet before broad reads
```

```text
prefer scoped searches and targeted file/test/contract reads over broad crawls
```

```text
close non-trivial strands with planning handoffs
```

```text
require bounded `blueprint-researcher` findings with source classes, paths or URLs, retrieval notes, confidence, failed or limited searches, unanswered questions, and planning handoff fields
```

Do not add any new MCP tool to this doc for R1.

## Exact Change 11: Runtime Reference

File: `docs/RUNTIME-REFERENCE.md`

Update the `research-phase` row to mirror the new `contractNotes` concepts from Exact Change 7. Keep it one row and do not paste the full investigation trace template into the table.

Required phrases that must appear in the row after the edit:

- `initial assessment`
- `navigation evidence packet`
- `scoped repo searches`
- `targeted file/test/contract reads`
- `planning handoff`
- `bounded sidecar findings`
- `failed or limited searches`

Do not change declared status, required tools, optional agents, hooks, or evidence state.

## Exact Change 12: Tests

### 12A. `tests/phase-discovery-research.test.ts`

In the main parity test `research-phase command references only registered tool names and safe routing text`, add these assertions.

After existing command-file assertions for external-source policy, add:

```ts
  assert.match(commandFile, /investigation trace/i);
  assert.match(commandFile, /navigation evidence packet/i);
  assert.match(commandFile, /retrieval mode/i);
  assert.match(commandFile, /planning handoff/i);
  assert.match(commandFile, /bounded evidence question/i);
  assert.match(commandFile, /failed or limited searches/i);
```

After existing doc-file assertions for external docs/repo evidence, add:

```ts
  assert.match(docFile, /investigation trace/i);
  assert.match(docFile, /navigation evidence packet/i);
  assert.match(docFile, /repository evidence ladder/i);
  assert.match(docFile, /planning handoff/i);
  assert.match(docFile, /failed or limited searches/i);
```

After existing runtime-reference assertions for repo truth/external truth, add:

```ts
  assert.match(runtimeReference, /initial assessment/i);
  assert.match(runtimeReference, /navigation evidence packet/i);
  assert.match(runtimeReference, /scoped repo searches/i);
  assert.match(runtimeReference, /targeted file\/test\/contract reads/i);
  assert.match(runtimeReference, /planning handoff/i);
  assert.match(runtimeReference, /bounded sidecar findings/i);
```

After existing `mcpToolsDoc` assertions for research-phase behavior, add:

```ts
  assert.match(mcpToolsDoc, /initial assessment/i);
  assert.match(mcpToolsDoc, /navigation evidence packet/i);
  assert.match(mcpToolsDoc, /planning handoffs/i);
  assert.match(mcpToolsDoc, /bounded `blueprint-researcher` findings/i);
```

After existing `skillFile` assertions for single-agent fallback, add:

```ts
  assert.match(skillFile, /investigation trace/i);
  assert.match(skillFile, /repository evidence ladder/i);
  assert.match(skillFile, /planning handoff/i);
  assert.match(skillFile, /bounded evidence question/i);
```

After existing `researcherAgent` assertions for source/provenance behavior, add:

```ts
  assert.match(researcherAgent, /Investigation Trace Rules/);
  assert.match(researcherAgent, /bounded evidence question/i);
  assert.match(researcherAgent, /Retrieval Notes/i);
  assert.match(researcherAgent, /failed or limited search/i);
  assert.match(researcherAgent, /Planning Handoff/i);
  assert.match(researcherAgent, /Do not present a sidecar packet as final persisted research/i);
```

After existing `runtimeContract` assertions for section headings, add:

```ts
  assert.match(runtimeContract, /Investigation Trace And Navigation Evidence/);
  assert.match(runtimeContract, /repository evidence ladder/i);
  assert.match(runtimeContract, /Navigation Evidence Packet/i);
  assert.match(runtimeContract, /Strand Planning Handoff/i);
  assert.match(runtimeContract, /targeted full-file, test, manifest, command, skill, runtime-contract, or\s+built-entrypoint reads/i);
```

In `research scaffold seeds the exact research template shape`, add:

```ts
  assert.match(scaffold, /## Investigation Trace/);
  assert.match(scaffold, /### Initial Assessment/);
  assert.match(scaffold, /### Navigation Evidence Packet/);
  assert.match(scaffold, /### Strand Planning Handoff/);
  assert.match(scaffold, /Saved artifacts inspected/);
  assert.match(scaffold, /Retrieval Mode/);
  assert.match(scaffold, /Stop Or Widen Reason/);
  assert.match(scaffold, /Validation Or Test Implications/);
```

In `phase artifact write creates, reuses, updates, and validates research content`, after the existing contract template assertion, add:

```ts
  assert.match(contract.contract.authoringTemplate, /## Investigation Trace/);
  assert.match(contract.contract.authoringTemplate, /Navigation Evidence Packet/);
  assert.match(contract.contract.notes.join("\n"), /Investigation Trace/i);
```

Do not change `validResearchContent(...)` for R1. Old valid research must still pass without `## Investigation Trace`.

### 12B. `tests/agent-contract-specialists.test.ts`

In the `mapping and discovery specialist agents encode concrete output modes and read boundaries` test, after existing `researcher` assertions, add:

```ts
  assert.match(researcher, /## Investigation Trace Rules/);
  assert.match(researcher, /bounded evidence question/i);
  assert.match(researcher, /retrieval notes/i);
  assert.match(researcher, /failed, noisy, blocked, or intentionally skipped searches/i);
  assert.match(researcher, /Planning Handoff/i);
  assert.match(researcher, /sidecar packet as final persisted research/i);
  assert.match(researcher, /full-artifact\s+draft/i);
```

## Exact Change 13: Build Outputs

Because `src/mcp/artifact-contracts/index.ts` and `src/mcp/command-runtime-metadata.ts` change, rebuild tracked `dist/` after tests/typecheck:

```bash
npm run build
```

Include generated `dist/` changes in the implementation PR.

## Verification Commands

In the fresh worktree, before any build/typecheck/test, run:

```bash
npm ci
```

Then run:

```bash
npx tsx --test tests/phase-discovery-research.test.ts tests/agent-contract-specialists.test.ts
npx tsx --test tests/mcp-contract-audit-metadata.test.ts tests/command-catalog.test.ts
npm run typecheck
npm run build
git status --short
```

Do not use `npm test -- <file>` for the focused loop.

## Expected Diff Shape

Expected additions:

- More command/runtime wording around investigation trace, navigation evidence, strand handoff, and bounded sidecar findings.
- Optional `## Investigation Trace` in the `phase.research` authoring/scaffold template.
- Placeholder signals for the optional investigation trace template.
- Text parity tests and scaffold/template assertions.
- Generated `dist/` changes from build.

Expected subtractions:

- Remove the duplicate `Artifact-grade mode supports comparing repo evidence against official docs with clear provenance.` line from `agents/blueprint-researcher.md`.
- Replace the unqualified subagent instruction `Ask the agent for populated research content or a bounded section draft with warnings` with bounded-findings-first wording.
- Replace `blueprint-researcher`'s output contract that makes a populated full `XX-RESEARCH.md` body sound like the default sidecar output.

Expected non-diff:

- No command status changes.
- No MCP tool allowlist changes.
- No `research.external_sources` config changes.
- No checkpoint schema changes.
- No validation strictness changes.
- No `blueprint-project-researcher.md` edits.

## Approval Checklist

Approve this plan only if these statements are acceptable:

- R1 implementation should be prompt/template/test hardening, not a new research engine.
- `## Investigation Trace` should be added to the research authoring template but not to `requiredHeadings`.
- Old valid research artifacts should continue to pass without investigation trace content.
- `blueprint-researcher` should default to bounded findings packets, not full artifact ownership.
- Later I2/I5 source-register, claim-support, Plan Input Queue, and stricter validation work should remain out of this R1 slice.
