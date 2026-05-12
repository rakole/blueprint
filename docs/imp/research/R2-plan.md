# R2 Plan: Repository Mapping And Code Search Improvements For `/blu-research-phase`

**Status:** ready for approval
**Scope:** R2 only from `docs/imp/research/research-phase-frontier-research-and-improvement-plan.md`
**Planner:** Codex
**Prepared:** 2026-05-12
**Base:** `origin/main` at PR489 merge (`43618ab Merge pull request #489 from rakole/codex/research-phase-r1`)

## Inputs Read

This plan is based only on the R2 section of the improvement plan. The rest of the document was used only to identify section boundaries and avoid accidentally importing later R3-R8 or I1-I6 work.

Required inputs read:

- `docs/imp/research/research-phase-frontier-research-and-improvement-plan.md`
- `commands/blu-research-phase.toml`
- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
- `skills/blueprint-phase-discovery/SKILL.md`
- `agents/blueprint-project-researcher.md`
- `agents/blueprint-researcher.md`

Additional local files inspected only to make the implementation instructions exact:

- `docs/imp/research/R1-plan.md`
- `src/mcp/artifact-contracts/index.ts`
- `src/mcp/command-runtime-metadata.ts`
- `docs/commands/research-phase.md`
- `docs/MCP-TOOLS.md`
- `docs/RUNTIME-REFERENCE.md`
- `tests/phase-discovery-research.test.ts`
- `tests/agent-contract-specialists.test.ts`
- `tests/mcp-contract-audit-metadata.test.ts`

## R2 Commitments To Implement

R2 is not asking for a new code-search engine. It asks `/blu-research-phase` to use the existing research prompt, artifact template, and sidecar contracts with better repository mapping and code-search discipline.

Implement these R2 commitments:

1. Add an explicit repository evidence ladder before full-file reads.
2. Prefer scoped search over broad recursive sweeps.
3. Separate lexical search, syntactic/symbol search, and semantic navigation.
4. Treat semantic navigation as optional parent-owned evidence, not required tooling.
5. Treat remote code-search results as discovery hints until local worktree or saved Blueprint artifacts confirm them.
6. Require each non-trivial strand to record a concise search note: query or navigation method, scope filter, candidate files, files read, and stop or widen reason.
7. Strengthen repo evidence citations so planner-critical claims preserve `path:line`, symbol or heading, evidence role, retrieval method, and supported claim.
8. Tie recommendations to evidence roles: API usage cites definitions/references, regression risk cites tests or validation paths, runtime behavior cites manifests, MCP handlers, artifact contracts, tests, or built/runtime entrypoints.
9. Make the no-subagent fallback explicitly avoid broad noisy crawls: prefer `rg --files` plus path filters before content search, keep normal ignore behavior, and treat `rg -uu` or whole-repo browsing as last-resort with rationale.
10. Tighten `blueprint-researcher` so it consumes parent-supplied semantic/navigation packets without claiming it performed semantic navigation itself.

## R2 Non-Goals

Do not implement these in the R2 slice:

- Do not add a new MCP tool, repo-map engine, graph index, symbol index, LSP integration, SCIP parser, ctags generator, Tree-sitter parser, Sourcegraph integration, or GitHub Code Search integration.
- Do not add web browsing or upstream-source lookup; the R2 source material is already present in the improvement plan.
- Do not change `research.external_sources=off|ask|auto`.
- Do not make remote code search or external search required for valid research.
- Do not change command catalog status, root routing, `/blu-help`, `/blu-progress`, or `/blu-next` behavior.
- Do not change phase readiness, `blueprint_phase_research_status`, or `planningReadiness`.
- Do not change checkpoint schema.
- Do not add R3 dependency evaluation tables, R4/R7 claim ledgers/source registers, R5 checkpoint ledgers, R6 Plan Input Queue, or R8 UX gates.
- Do not make older valid research artifacts invalid solely because they lack the new optional R2 investigation details.
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
8. `docs/MCP-TOOLS.md`
9. `docs/RUNTIME-REFERENCE.md`
10. `tests/phase-discovery-research.test.ts`
11. `tests/agent-contract-specialists.test.ts`
12. `tests/mcp-contract-audit-metadata.test.ts`
13. `dist/` generated files after build

Do not edit:

- `agents/blueprint-project-researcher.md`
- `src/mcp/tools/phase.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/phase-checkpoint-records.ts`
- `docs/COMMAND-CATALOG.md`
- command routing/status semantics

## Exact Change 1: Command Manifest

File: `commands/blu-research-phase.toml`

### 1A. Replace the existing investigation-trace gate

Find this existing bullet:

```text
- Build a concise investigation trace before deep strand work: initial assessment, relevant saved artifacts, relevant repo files or symbols, retrieval mode, key findings, implementation questions, and confidence. Prefer saved context, saved codebase summaries, scoped repo searches, and optional parent-supplied navigation evidence packets over broad crawls.
```

Replace it with:

```text
- Build a concise repository investigation trace before deep strand work: initial assessment, relevant saved artifacts, saved `.blueprint/codebase/` summaries, compact file or symbol anchors, scoped repo searches, optional parent-supplied navigation evidence packets, targeted file/test/contract reads, key findings, implementation questions, and confidence. For each non-trivial strand, record a search note with query or navigation method, scope filter, candidate files, files actually read, and why the search stopped or widened. Prefer `rg --files` plus path filters before content search, keep normal ignore behavior, and use `rg -uu`, hidden/generated/vendor reads, or whole-repo browsing only as a justified last resort.
```

### 1B. Add remote-code-search/local-truth gate

Find the bullet inserted in 1A. Immediately after it, insert:

```text
- Treat remote code-search or symbol-search results as discovery hints only. Confirm planner-critical runtime claims against the local worktree, saved Blueprint artifacts, command manifests, MCP handlers, tests, artifact contracts, or built/runtime entrypoints before presenting them as repo truth.
```

### 1C. Replace the sidecar gate

Find this existing bullet:

```text
- When using `blueprint-researcher`, give it one bounded evidence question plus allowed source classes and require bounded findings with paths or URLs, retrieval notes, confidence, failed or limited searches, and unanswered questions. Do not ask it for broad plans, final persisted research ownership, external fetches, user decisions, checkpoints, state sync, or routing.
```

Replace it with:

```text
- When using `blueprint-researcher`, give it one bounded evidence question plus allowed source classes, retrieval boundaries, and any parent-supplied navigation evidence packet. Require bounded findings with repo paths or URLs, source roles, search notes, confidence, failed/noisy/no-hit searches, and unanswered questions. Do not ask it for broad plans, final persisted research ownership, external fetches, semantic navigation it was not given, user decisions, checkpoints, state sync, or routing.
```

### 1D. No manifest subtraction

Do not remove required MCP tool names, `long-running-mutation`, existing `research.external_sources` policy text, checkpoint rules, write rules, or routing rules.

## Exact Change 2: Research Runtime Contract

File: `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`

### 2A. Replace retained behavior bullets for navigation evidence

In `## Parity Target`, find these existing bullets:

```md
- compact navigation evidence before broad reads: source class, retrieval mode,
  path or symbol, evidence role, finding, limits, and why the search stopped or
  widened
```

Replace with:

```md
- a repository evidence ladder before broad reads: saved context, existing
  research, saved codebase summaries, compact file/symbol/contract anchors,
  scoped `rg` or path searches, optional parent-owned navigation packets, then
  targeted file/test/runtime reads
- per-strand search notes: query or navigation method, scope filter, candidate
  files or symbols, files actually read, failed/noisy/no-hit searches, and why
  the search stopped or widened
- repo evidence citations that preserve path and line when available, symbol or
  heading, evidence role, retrieval method, and the claim or recommendation
  supported
```

### 2B. Replace Execute stage wording

Find:

```md
- `Execute`: build the initial assessment and navigation evidence packet,
  research one topic strand at a time, close each strand with a planning
  handoff, and keep evidence provenance visible.
```

Replace with:

```md
- `Execute`: build the initial assessment, follow the repository evidence
  ladder, record per-strand search notes and navigation evidence, research one
  topic strand at a time, close each strand with a planning handoff, and keep
  evidence provenance visible.
```

### 2C. Replace `## Sources` authoring guidance

In `## Artifact Authoring Rules`, find the current `## Sources` bullet:

```md
- `## Sources` separates repo evidence, official or supplied external
  references, and inference. Do not blend these source classes. For repo
  evidence that supports planner-critical recommendations, prefer path or
  symbol plus evidence role such as definition, reference, test, config,
  contract, runtime, or example, and name the retrieval mode when it affects
  confidence.
```

Replace it with:

```md
- `## Sources` separates repo evidence, official or supplied external
  references, and inference. Do not blend these source classes. For
  planner-critical repo evidence, prefer this concise shape:
  `Repo evidence: path/to/file.ts:123, symbol/heading=<name>, role=definition|reference|test|config|contract|runtime|example|background, method=repo-map|rg|manual-read|parent-navigation-packet|LSP|SCIP|ctags|tree-sitter, supports=<claim or recommendation>`.
  External references should keep URL/title and access date separately from repo
  evidence. Inference should name the evidence it derives from rather than
  masquerading as a source.
```

### 2D. Replace initial-assessment retrieval-mode bullets

In `## Investigation Trace And Navigation Evidence`, find this bullet block:

```md
- which retrieval mode found them: saved context, saved codebase summary,
  scoped `rg`, targeted file read, parent-supplied semantic/navigation packet,
  official or supplied external packet, or inference
```

Replace with:

```md
- which retrieval mode found them: saved context, saved codebase summary,
  `rg --files` plus path filtering, scoped content `rg`, targeted file read,
  parent-supplied semantic/navigation packet, official or supplied external
  packet, remote code-search hint, or inference
```

### 2E. Replace the repository evidence ladder

Find this existing ladder:

```md
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
```

Replace with:

```md
1. saved `XX-CONTEXT.md` content and requirement mapping
2. existing `XX-RESEARCH.md` when updating
3. saved `.blueprint/codebase/` summaries surfaced by
   `blueprint_phase_context.codebase`
4. compact file, symbol, command, artifact, contract, or test anchors already
   present in saved context or codebase summaries
5. `rg --files` plus path, file-type, or directory filters to identify candidate
   files before reading file bodies
6. scoped content searches for named anchors, symbols, config keys, command
   names, or requirement IDs, keeping ripgrep's normal ignore behavior
7. optional parent-supplied navigation packets such as definitions, references,
   workspace symbols, call hierarchy, SCIP/ctags entries, Tree-sitter captures,
   dependency edges, or remote code-search hints when the host already has them
8. targeted full-file, test, manifest, command, skill, runtime-contract,
   artifact-contract, MCP-handler, or built-entrypoint reads
```

### 2F. Add scoped-search rules after the evidence ladder

Immediately after the paragraph:

```md
Do not treat "more files read" as better research. Widen only when the current
strand cannot be answered from narrower evidence. Record why the search stopped
or widened.
```

Insert:

```md
Prefer scoped local search over broad recursive sweeps:

- use `rg --files` with path, extension, or directory filters before content
  search when the likely surface is unknown
- prefer scoped patterns such as `rg "blueprint_phase_artifact_write" src/mcp tests`
  over unqualified `rg <term> .`
- keep normal ignore behavior by default
- use `rg -uu`, hidden-file sweeps, generated/vendor reads, or whole-repo
  file-by-file browsing only when the strand explicitly justifies why ignored,
  generated, vendored, or hidden surfaces are relevant
- record failed, noisy, or no-hit searches when they lower confidence or explain
  why the strand widened

Separate lexical search, syntactic symbol search, and semantic navigation in the
search note. `symbol:` results, Tree-sitter captures, LSP references, SCIP/ctags
entries, and remote code-search results have different completeness and
freshness limits. Treat them as labeled evidence inputs, not interchangeable
truth. Remote code-search hits are discovery hints until local worktree evidence
or saved Blueprint artifacts confirm them.
```

### 2G. Replace navigation evidence packet shape

Find this existing packet shape:

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

Replace with:

```text
Evidence ID: NAV-001
Strand: <strand id or topic>
Query or navigation method: <search query, symbol lookup, file-map read, parent packet, or manual read>
Scope filter: <paths, languages, file types, command names, or "none">
Retrieval mode: saved-context | codebase-summary | rg-files | scoped-rg | targeted-read | parent-navigation-packet | remote-code-search-hint | external-packet | inference
Candidate files or symbols: <candidate paths/symbols considered>
Files actually read: <paths read in full or targeted ranges>
Source class: blueprint-artifact | repo-code | repo-test | repo-config | command-manifest | skill-contract | runtime-contract | artifact-contract | mcp-handler | built-entrypoint | official-reference | supplied-reference | inference
Path / symbol / URL: <repo path, symbol, URL, or supplied source label>
Role: definition | reference | test | config | contract | runtime | example | background | inference
Finding: <what this proves for planning>
Limits: <staleness, partial coverage, missing lines, no-hit search, heuristic navigation, remote-index limit, or none>
Stop or widen reason: <why this evidence is enough or what would justify more search>
```

### 2H. Add recommendation-to-role guidance after Strand Planning Handoff

Immediately after the Strand Planning Handoff code block, insert:

```md
Tie recommendations to evidence roles. API-usage recommendations should cite
definitions and references. Regression-risk recommendations should cite tests,
validation paths, or prior failure evidence. Runtime-behavior recommendations
should cite command manifests, MCP handlers, artifact contracts, runtime
contracts, tests, or built/runtime entrypoints when those surfaces are relevant.
```

### 2I. Update subagent input guidance

In `## Capability-Gated Subagent Path`, find this bullet:

```md
- saved codebase summaries or a compact repo evidence packet
```

Replace with:

```md
- saved codebase summaries, compact repo evidence packets, and any
  parent-supplied navigation packet such as candidate files, symbol hits,
  definitions, references, SCIP/ctags entries, Tree-sitter captures,
  dependency edges, or remote code-search hints
```

Find this bullet:

```md
- one bounded evidence question, expected source classes, retrieval boundaries,
  and the strand handoff fields the parent needs back
```

Replace with:

```md
- one bounded evidence question, expected source classes, retrieval boundaries,
  search-note fields, and the strand handoff fields the parent needs back
```

Find this sentence:

```md
The response should include the strand/question,
concise answer, source classes, paths or URLs, retrieval notes, confidence,
failed or limited searches, unanswered questions, and a planning handoff.
```

Replace with:

```md
The response should include the strand/question, concise answer, source classes,
paths or URLs, source roles, search notes, confidence, failed/noisy/no-hit or
limited searches, unanswered questions, and a planning handoff.
```

After that paragraph, insert:

```md
The agent must not claim it performed semantic navigation, symbol search, remote
code search, LSP, SCIP, ctags, or Tree-sitter analysis unless the parent supplied
that packet or the available tool output directly proves it. If a parent-supplied
remote code-search hit is useful, the agent should label it as a discovery hint
until repo-local evidence confirms it.
```

### 2J. Update no-subagent fallback step 3

Find this existing fallback step:

```md
3. Follow the repository evidence ladder for that strand: saved context,
   existing research, saved codebase summaries, scoped searches, optional
   parent-supplied navigation packets, then targeted file/test/contract reads.
   Use official or supplied references only for claims the repo cannot settle,
   and only when the `research.external_sources` policy allows them.
```

Replace with:

```md
3. Follow the repository evidence ladder for that strand: saved context,
   existing research, saved codebase summaries, compact anchors, `rg --files`
   plus path filters, scoped content searches, optional parent-supplied
   navigation packets, then targeted file/test/contract/runtime reads. Use
   official or supplied references only for claims the repo cannot settle, and
   only when the `research.external_sources` policy allows them.
4. Record the strand search note before synthesis: query or navigation method,
   scope filter, candidate files or symbols, files actually read, failed/noisy
   or no-hit searches, and stop or widen reason.
```

Then renumber the old steps 4-7 to 5-8.

### 2K. Add output quality bullets

In `## Output Quality Criteria`, after:

```md
- the artifact exposes enough investigation trace for planning: relevant saved
  artifacts, repo files or symbols, retrieval modes, key findings,
  implementation questions, and confidence
```

Insert:

```md
- non-trivial strands include search notes with query or navigation method,
  scope filter, candidate files or symbols, files read, failed/noisy/no-hit
  searches when relevant, and stop or widen reason
- repo evidence citations preserve role and method for planner-critical claims
```

After:

```md
- planner-critical recommendations have strand handoffs naming affected files
  or modules, validation or test implications, unresolved blockers, evidence
  basis, and confidence
```

Insert:

```md
- recommendations cite evidence roles appropriate to the claim: definitions or
  references for API usage, tests or validation paths for regression risk, and
  manifests, MCP handlers, contracts, tests, or built/runtime entrypoints for
  runtime behavior
```

## Exact Change 3: Shared Discovery Skill

File: `skills/blueprint-phase-discovery/SKILL.md`

### 3A. Replace `/blu-research-phase` workflow rule 6

Find:

```md
6. Before deep strand work, build a concise investigation trace: relevant saved artifacts, relevant repo files or symbols, retrieval mode, key findings, implementation questions, and confidence. Prefer the runtime contract's repository evidence ladder over broad crawls: saved context, existing research, saved codebase summaries, scoped searches, optional parent-supplied navigation packets, then targeted file/test/contract reads.
```

Replace with:

```md
6. Before deep strand work, build a concise repository investigation trace: relevant saved artifacts, saved `.blueprint/codebase/` summaries, compact file/symbol/contract anchors, retrieval mode, key findings, implementation questions, and confidence. Prefer the runtime contract's repository evidence ladder over broad crawls: saved context, existing research, saved codebase summaries, `rg --files` plus path filters, scoped content searches, optional parent-supplied navigation packets, then targeted file/test/contract/runtime reads. Record a search note for every non-trivial strand: query or navigation method, scope filter, candidate files or symbols, files read, failed/noisy/no-hit searches when relevant, and stop or widen reason.
```

### 3B. Replace `/blu-research-phase` workflow rule 7

Find:

```md
7. Use `blueprint-researcher` only when a suitable Blueprint research or code-analysis agent is available and a bounded sidecar pass materially helps. The parent must supply any external evidence packet itself, with source title, date, URL, excerpt, claim, and whether it is an official reference or supplied reference. The parent must also supply one bounded evidence question, allowed source classes, retrieval boundaries, and expected handoff fields. Do not ask the subagent to fetch official docs, make broad plans, decide final confidence, persist artifacts, checkpoint, sync state, or route follow-up commands on its own.
```

Replace with:

```md
7. Use `blueprint-researcher` only when a suitable Blueprint research or code-analysis agent is available and a bounded sidecar pass materially helps. The parent must supply any external evidence packet itself, with source title, date, URL, excerpt, claim, and whether it is an official reference or supplied reference. The parent must also supply one bounded evidence question, allowed source classes, retrieval boundaries, any parent-owned navigation packet, search-note fields, and expected handoff fields. Do not ask the subagent to fetch official docs, make broad plans, perform or claim semantic navigation it was not given, decide final confidence, persist artifacts, checkpoint, sync state, or route follow-up commands on its own.
```

### 3C. Replace `/blu-research-phase` workflow rule 9

Find:

```md
9. Break long-running research into topic-sized strands, checkpoint paused or inconclusive work, and use the runtime contract's single-agent fallback when no suitable subagent is available. Each non-trivial strand should close with a planning handoff: recommendation, affected files or modules, validation or test implications, unresolved blockers, evidence basis, and confidence. Do not use browser-only, web-search-only, shell-only, or generic agents as substitutes.
```

Replace with:

```md
9. Break long-running research into topic-sized strands, checkpoint paused or inconclusive work, and use the runtime contract's single-agent fallback when no suitable subagent is available. Each non-trivial strand should record its search note and close with a planning handoff: recommendation, affected files or modules, validation or test implications, unresolved blockers, evidence basis, and confidence. Do not use browser-only, web-search-only, shell-only, broad crawls, or generic agents as substitutes.
```

## Exact Change 4: `blueprint-researcher` Agent

File: `agents/blueprint-researcher.md`

### 4A. Add parent-supplied navigation packets to Required Reads

Find this existing bullet:

```md
- any mapped `.blueprint/codebase/` summaries the parent command supplies for
  brownfield grounding
```

Replace with:

```md
- any mapped `.blueprint/codebase/` summaries the parent command supplies for
  brownfield grounding
- any parent-supplied navigation packet such as candidate files, symbols,
  definitions, references, workspace symbol results, SCIP/ctags entries,
  Tree-sitter captures, dependency edges, or remote code-search hints
```

### 4B. Replace Investigation Trace Rules

Find the entire `## Investigation Trace Rules` section, from:

```md
## Investigation Trace Rules
```

through this paragraph:

```md
Treat saved context files, skills, runtime contracts, and codebase summaries as
useful but potentially stale. Cite them, then check live repo files when the
claim needs planner-grade confidence.
```

Replace the whole section with:

```md
## Investigation Trace Rules

Default to answering one bounded evidence question from the parent. Do not turn
a sidecar request into broad planning, whole-repo exploration, or a general code
crawl.

Use this evidence ladder unless the parent gives a narrower order:

1. parent-supplied phase context and requirement mapping
2. parent-supplied existing research when revising
3. parent-supplied `.blueprint/codebase/` summaries
4. compact file, symbol, command, artifact, contract, or test anchors
5. file listing or `glob` filtering as the sidecar equivalent of `rg --files`
   with path, extension, or directory filters
6. scoped content `grep_search` for named anchors, command names, symbols,
   config keys, requirement IDs, or exact strings
7. parent-supplied semantic/navigation packets
8. targeted file, test, manifest, command, skill, runtime-contract,
   artifact-contract, MCP-handler, or built-entrypoint reads

For every substantive answer, return:

- the strand or question answered
- source classes used: repo evidence, locked Blueprint docs, parent-supplied
  external evidence, supplied reference, parent-supplied navigation packet, or
  inference
- repo paths, symbols, headings, URLs, or supplied-source labels that matter
- source roles such as `definition`, `reference`, `test`, `config`, `contract`,
  `runtime`, `example`, or `background`
- search notes: query or navigation method, scope filter, candidate files or
  symbols, files actually read, and why the search stopped or widened
- failed, noisy, blocked, no-hit, or intentionally skipped searches when they
  affect confidence
- confidence and unanswered questions
- planning handoff: recommendation, affected files or modules, validation or
  test implications, unresolved blockers, and evidence basis

Treat saved context files, skills, runtime contracts, and codebase summaries as
useful but potentially stale. Cite them, then check live repo files when the
claim needs planner-grade confidence.

Do not claim semantic navigation, symbol search, remote code search, LSP, SCIP,
ctags, or Tree-sitter analysis unless the parent supplied that packet or the
available tool output directly proves it. Treat remote code-search hits as
discovery hints until repo-local evidence confirms them.
```

### 4C. Replace Required Output Contract bullets for repo sources and retrieval notes

Find:

```md
- Include `Repo Sources` with path, optional symbol or heading, evidence role
  (`definition`, `reference`, `test`, `config`, `contract`, `runtime`,
  `example`, or `background`), and why it matters.
```

Replace with:

```md
- Include `Repo Sources` with path, line when available, optional symbol or
  heading, evidence role (`definition`, `reference`, `test`, `config`,
  `contract`, `runtime`, `example`, or `background`), retrieval method
  (`repo-map`, `rg-files`, `scoped-rg`, `manual-read`, `parent-navigation-packet`,
  `LSP`, `SCIP`, `ctags`, or `tree-sitter`), and why it matters.
```

Find:

```md
- Include `Retrieval Notes`: search method, scope, candidate files, files read,
  failed/no-hit searches, and stop or widen reason when this affects
  confidence.
```

Replace with:

```md
- Include `Retrieval Notes`: query or navigation method, scope filter, candidate
  files or symbols, files actually read, failed/noisy/no-hit searches, and stop
  or widen reason when this affects confidence.
```

After that replacement, insert:

```md
- Label parent-supplied semantic packets and remote code-search hints as supplied
  inputs; do not present them as navigation the agent independently performed.
```

### 4D. Add boundary

In `## Boundaries`, after:

```md
- Do not imply that you fetched official docs or external sources yourself.
```

Insert:

```md
- Do not imply that you performed semantic navigation, symbol indexing, remote
  code search, LSP, SCIP, ctags, or Tree-sitter analysis unless the parent
  supplied that evidence packet or the tool output directly proves it.
```

## Exact Change 5: `blueprint-project-researcher`

File: `agents/blueprint-project-researcher.md`

No changes.

Reason: R2 is scoped to `/blu-research-phase`. `blueprint-project-researcher` is a bootstrap/new-project agent for `/blu-new-project`, not the research-phase sidecar. Do not copy the R2 search-note contract into this agent in this slice.

## Exact Change 6: Research Artifact Template

File: `src/mcp/artifact-contracts/index.ts`

### 6A. Replace the Navigation Evidence Packet table

Inside `renderResearchTemplate`, find:

```ts
### Navigation Evidence Packet

| Evidence ID | Strand | Retrieval Mode | Source Class | Path / Symbol / URL | Role | Finding | Limits | Stop Or Widen Reason |
|-------------|--------|----------------|--------------|---------------------|------|---------|--------|----------------------|
| NAV-001 | <strand id or topic> | <retrieval mode> | <source class> | <path, symbol, URL, or supplied label> | <definition, reference, test, config, contract, runtime, example, background, or inference> | <what this proves for planning> | <limits or none> | <why enough or why widened> |
```

Replace with:

```ts
### Navigation Evidence Packet

| Evidence ID | Strand | Query Or Navigation Method | Scope Filter | Retrieval Mode | Candidate Files Or Symbols | Files Read | Source Class | Path / Symbol / URL | Role | Finding | Limits | Stop Or Widen Reason |
|-------------|--------|----------------------------|--------------|----------------|----------------------------|------------|--------------|---------------------|------|---------|--------|----------------------|
| NAV-001 | <strand id or topic> | <query or navigation method> | <path, language, file type, or none> | <saved-context, codebase-summary, rg-files, scoped-rg, targeted-read, parent-navigation-packet, remote-code-search-hint, external-packet, or inference> | <candidate files or symbols> | <files actually read> | <source class> | <path, symbol, URL, or supplied label> | <definition, reference, test, config, contract, runtime, example, background, or inference> | <what this proves for planning> | <limits or none> | <why enough or why widened> |
```

### 6B. Replace the Sources section template

Inside `renderResearchTemplate`, find:

```ts
## Sources

- <repo path, URL, or cited file reference> - why it matters`;
```

Replace with:

```ts
## Sources

### Repo Evidence

- Repo evidence: \`<repo path:line>\`, symbol/heading=<symbol or heading>, role=<definition|reference|test|config|contract|runtime|example|background>, method=<repo-map|rg-files|scoped-rg|manual-read|parent-navigation-packet|LSP|SCIP|ctags|tree-sitter>, supports=<claim or recommendation>.

### External References

- External reference: <title>, <URL>, accessed <YYYY-MM-DD>, supports=<claim>; source policy=<off|ask-approved|auto|supplied>.`;
```

### 6C. Update placeholder signals

In the `phase.research.placeholderSignals` array, remove these existing strings:

```ts
"<retrieval mode>",
"<path, symbol, URL, or supplied label>",
"<repo path, URL, or cited file reference>"
```

Add these strings in their logical positions near the existing investigation/source placeholders:

```ts
"<query or navigation method>",
"<path, language, file type, or none>",
"<saved-context, codebase-summary, rg-files, scoped-rg, targeted-read, parent-navigation-packet, remote-code-search-hint, external-packet, or inference>",
"<candidate files or symbols>",
"<files actually read>",
"<path, symbol, URL, or supplied label>",
"<repo path:line>",
"<symbol or heading>",
"<definition|reference|test|config|contract|runtime|example|background>",
"<repo-map|rg-files|scoped-rg|manual-read|parent-navigation-packet|LSP|SCIP|ctags|tree-sitter>",
"<claim or recommendation>",
"<title>",
"<URL>",
"<off|ask-approved|auto|supplied>"
```

Do not remove the older generic placeholders that are still used elsewhere, such as `<source class>`, `<what this proves for planning>`, `<limits or none>`, or `<why enough or why widened>`.

### 6D. Update contract notes

In `phase.research.notes`, find:

```ts
"Optional Investigation Trace content should record initial assessment, navigation evidence, and strand planning handoffs for non-trivial research without becoming a new required heading.",
```

Replace with:

```ts
"Optional Investigation Trace content should record initial assessment, per-strand search notes, navigation evidence, and strand planning handoffs for non-trivial research without becoming a new required heading.",
```

Find:

```ts
"Research should preserve planner-grade evidence density: mapped requirements, prescriptive recommendations, repo-versus-external provenance, confidence by topic, and explicit open questions when evidence is incomplete."
```

Replace with:

```ts
"Research should preserve planner-grade evidence density: mapped requirements, prescriptive recommendations, repo evidence roles and retrieval methods, repo-versus-external provenance, confidence by topic, and explicit open questions when evidence is incomplete."
```

### 6E. No validator change

Do not change `src/mcp/tools/artifacts.ts` in this R2 slice. The current strict validation should continue to reject placeholders and generic fake source bullets, but R2 should not make old valid artifacts fail just because they lack the optional Investigation Trace heading or the richer source rows.

## Exact Change 7: Runtime Metadata And Docs

### 7A. Runtime metadata

File: `src/mcp/command-runtime-metadata.ts`

Find the `RESEARCH_PHASE_RUNTIME_METADATA.runtimeReference.contractNotes` string. Inside it, find this sentence:

```text
Prefer scoped repo searches, optional parent-supplied navigation packets, and targeted file/test/contract reads over broad crawls, and close each non-trivial strand with a planning handoff naming recommendation, affected files or modules, validation or test implications, blockers, evidence basis, and confidence.
```

Replace with:

```text
Prefer rg --files plus path filters, scoped content searches, optional parent-supplied navigation packets, and targeted file/test/contract/runtime reads over broad crawls; record per-strand search notes with query or navigation method, scope filter, candidate files or symbols, files read, failed/noisy/no-hit searches when relevant, and stop or widen reason; treat remote code-search results as discovery hints until local worktree or saved Blueprint artifacts confirm them; and close each non-trivial strand with a planning handoff naming recommendation, affected files or modules, validation or test implications, blockers, evidence basis, and confidence.
```

Find this later phrase:

```text
require bounded sidecar findings with source classes, paths or URLs, retrieval notes, confidence, failed or limited searches, unanswered questions, and planning handoff fields
```

Replace with:

```text
require bounded sidecar findings with source classes, source roles, paths or URLs, search notes, confidence, failed/noisy/no-hit or limited searches, unanswered questions, and planning handoff fields, and forbid sidecars from claiming semantic navigation they were not given
```

### 7B. Command docs

File: `docs/commands/research-phase.md`

Find:

```md
4. `Execute`: build an initial assessment and navigation evidence packet, then research one topic strand at a time, grounding repo truth first and keeping external evidence distinct when policy allows it.
```

Replace with:

```md
4. `Execute`: build an initial assessment, follow the repository evidence ladder, record per-strand search notes and navigation evidence, then research one topic strand at a time, grounding repo truth first and keeping external evidence distinct when policy allows it.
```

Find this runtime anchor:

```md
- Build an investigation trace for non-trivial research: saved artifacts inspected, relevant repo files or symbols, retrieval modes, key findings, implementation questions, and confidence.
```

Replace with:

```md
- Build an investigation trace for non-trivial research: saved artifacts inspected, relevant repo files or symbols, retrieval modes, per-strand search notes, key findings, implementation questions, and confidence.
```

Find:

```md
- Prefer the runtime contract's repository evidence ladder over broad crawls: saved context, existing research, saved codebase summaries, scoped repo searches, optional parent-supplied navigation packets, then targeted file/test/contract reads.
```

Replace with:

```md
- Prefer the runtime contract's repository evidence ladder over broad crawls: saved context, existing research, saved codebase summaries, `rg --files` plus path filters, scoped content searches, optional parent-supplied navigation packets, then targeted file/test/contract/runtime reads. Treat remote code-search results as discovery hints until local worktree or saved Blueprint artifacts confirm them.
```

Find this runtime anchor:

```md
- `blueprint-researcher` is optional and capability-gated. Use it only when a suitable Blueprint research or code-analysis agent is available and a bounded sidecar pass materially helps; otherwise use the runtime contract's single-agent topic-strand fallback. Any official-doc or other external evidence packet must come from the parent command or user, not from the subagent fetching it on its own. The parent sends one bounded evidence question plus allowed source classes and expects bounded findings with source classes, paths or URLs, retrieval notes, confidence, failed or limited searches, unanswered questions, and planning handoff fields.
```

Replace with:

```md
- `blueprint-researcher` is optional and capability-gated. Use it only when a suitable Blueprint research or code-analysis agent is available and a bounded sidecar pass materially helps; otherwise use the runtime contract's single-agent topic-strand fallback. Any official-doc, external evidence, or semantic/navigation packet must come from the parent command or user, not from the subagent fetching or inventing it on its own. The parent sends one bounded evidence question plus allowed source classes and expects bounded findings with source classes, source roles, paths or URLs, search notes, confidence, failed/noisy/no-hit or limited searches, unanswered questions, and planning handoff fields.
```

In `## Acceptance Criteria`, find:

```md
- Records enough investigation trace for planning: saved artifacts, relevant repo files or symbols, retrieval modes, key findings, implementation questions, and confidence.
```

Replace with:

```md
- Records enough investigation trace for planning: saved artifacts, relevant repo files or symbols, retrieval modes, per-strand search notes, key findings, implementation questions, and confidence.
```

After it, insert:

```md
- Keeps code search scoped by default, records stop/widen rationale for non-trivial strands, and treats remote code-search hits as hints until local repo evidence confirms them.
```

In `## Test Cases`, after:

```md
- Investigation trace and navigation evidence packet fixture.
```

Insert:

```md
- R2 repository evidence ladder fixture with search note fields, role/method source rows, and remote-code-search-as-hint language.
```

### 7C. MCP tools docs

File: `docs/MCP-TOOLS.md`

In `### Phase Artifact Writes And Checkpoints`, after:

```md
- Research writes should be normalized to Blueprint's exact `XX-RESEARCH.md` template before calling the tool, and angle-bracket placeholders must be replaced with real content.
```

Insert:

```md
- Research authoring should preserve repository search discipline from the research-phase runtime contract: use saved context and codebase summaries before broad reads, prefer `rg --files` plus path filters and scoped content searches, record per-strand search notes, treat semantic/navigation packets as optional parent-owned evidence, and treat remote code-search hits as hints until local repo evidence confirms them.
```

### 7D. Runtime reference

File: `docs/RUNTIME-REFERENCE.md`

In the `research-phase` row, make the same two wording replacements as in `src/mcp/command-runtime-metadata.ts`:

1. Replace the sentence beginning `Prefer scoped repo searches...` with the longer `Prefer rg --files plus path filters...` sentence from 7A.
2. Replace the phrase beginning `require bounded sidecar findings...` with the longer sidecar phrase from 7A.

Do not update any other command row.

## Exact Change 8: Tests

### 8A. Update contract assertions in `tests/phase-discovery-research.test.ts`

In the test named `research-phase command references only registered tool names and safe routing text`, add these assertions near the existing command/runtime/doc assertions for investigation trace:

```ts
  assert.match(commandFile, /rg --files/i);
  assert.match(commandFile, /whole-repo browsing/i);
  assert.match(commandFile, /remote code-search/i);
  assert.match(commandFile, /semantic navigation it was not given/i);
  assert.match(docFile, /per-strand search notes/i);
  assert.match(docFile, /remote code-search results as discovery hints/i);
  assert.match(runtimeReference, /rg --files plus path filters/i);
  assert.match(runtimeReference, /remote code-search results as discovery hints/i);
  assert.match(mcpToolsDoc, /repository search discipline/i);
  assert.match(skillFile, /search-note fields/i);
  assert.match(skillFile, /semantic navigation it was not given/i);
  assert.match(researcherAgent, /Query or navigation method|query or navigation method/i);
  assert.match(researcherAgent, /remote code-search hits as\s+discovery hints/i);
  assert.match(runtimeContract, /per-strand search notes/i);
  assert.match(runtimeContract, /rg --files/i);
  assert.match(runtimeContract, /remote code-search hits are discovery hints/i);
  assert.match(runtimeContract, /role=definition\|reference\|test\|config\|contract\|runtime\|example\|background/i);
```

If any regex is too brittle after implementation, keep the intent but adjust only the regex text, not the contract requirement.

### 8B. Update scaffold-template assertions

In the test named `research scaffold seeds the exact research template shape`, keep all existing assertions and add:

```ts
  assert.match(scaffold, /Query Or Navigation Method/);
  assert.match(scaffold, /Scope Filter/);
  assert.match(scaffold, /Candidate Files Or Symbols/);
  assert.match(scaffold, /Files Read/);
  assert.match(scaffold, /remote-code-search-hint/);
  assert.match(scaffold, /### Repo Evidence/);
  assert.match(scaffold, /role=<definition\|reference\|test\|config\|contract\|runtime\|example\|background>/);
  assert.match(scaffold, /method=<repo-map\|rg-files\|scoped-rg\|manual-read\|parent-navigation-packet\|LSP\|SCIP\|ctags\|tree-sitter>/);
  assert.match(scaffold, /### External References/);
```

Replace the old source placeholder assertion:

```ts
  assert.match(scaffold, /- <repo path, URL, or cited file reference> - why it matters/);
```

with:

```ts
  assert.match(scaffold, /Repo evidence: `<repo path:line>`/);
  assert.match(scaffold, /External reference: <title>, <URL>, accessed <YYYY-MM-DD>/);
```

### 8C. Update artifact-contract assertions

In the test named `phase artifact write creates, reuses, updates, and validates research content`, after:

```ts
  assert.match(contract.contract.authoringTemplate, /Navigation Evidence Packet/);
```

Insert:

```ts
  assert.match(contract.contract.authoringTemplate, /Query Or Navigation Method/);
  assert.match(contract.contract.authoringTemplate, /Scope Filter/);
  assert.match(contract.contract.authoringTemplate, /Candidate Files Or Symbols/);
  assert.match(contract.contract.authoringTemplate, /Files Read/);
  assert.match(contract.contract.authoringTemplate, /Repo evidence: `<repo path:line>`/);
```

After:

```ts
  assert.match(contract.contract.notes.join("\n"), /planner-grade evidence density/i);
```

Insert:

```ts
  assert.match(contract.contract.notes.join("\n"), /search notes/i);
  assert.match(contract.contract.notes.join("\n"), /retrieval methods/i);
```

### 8D. Add valid R2 fixture test

Add this test after `research scaffold seeds the exact research template shape`:

```ts
test("research template accepts R2 search notes and role-method repo evidence", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Create research with R2 repository search notes and role-method source evidence."
  ).replace(
    "## Locked Decisions From Context",
    `## Investigation Trace

### Initial Assessment

| Field | Notes |
|-------|-------|
| Saved artifacts inspected | .blueprint/phases/03-phase-discovery/03-CONTEXT.md |
| Relevant repo files or symbols | blueprintPhaseArtifactWrite, validateResearchArtifactContent |
| Retrieval modes used | saved-context, rg-files, scoped-rg, targeted-read |
| Key findings | Research writes already flow through MCP-owned artifact validation. |
| Implementation questions | Whether source evidence should stay guidance-only in R2. |
| Confidence | HIGH - supported by local repo paths and tests. |

### Navigation Evidence Packet

| Evidence ID | Strand | Query Or Navigation Method | Scope Filter | Retrieval Mode | Candidate Files Or Symbols | Files Read | Source Class | Path / Symbol / URL | Role | Finding | Limits | Stop Or Widen Reason |
|-------------|--------|----------------------------|--------------|----------------|----------------------------|------------|--------------|---------------------|------|---------|--------|----------------------|
| NAV-001 | artifact-write | rg "blueprintPhaseArtifactWrite" src/mcp tests | src/mcp, tests | scoped-rg | src/mcp/tools/phase.ts, tests/phase-discovery-research.test.ts | src/mcp/tools/phase.ts, tests/phase-discovery-research.test.ts | mcp-handler | src/mcp/tools/phase.ts | runtime | Research persistence is MCP-owned. | none | Handler and focused test were enough. |

### Strand Planning Handoff

| Strand | Recommendation | Affected Files Or Modules | Validation Or Test Implications | Unresolved Blockers | Evidence Basis | Confidence |
|--------|----------------|---------------------------|---------------------------------|---------------------|----------------|------------|
| artifact-write | Keep R2 source-shape changes in prompt/template guidance. | src/mcp/artifact-contracts/index.ts, tests/phase-discovery-research.test.ts | Focused research artifact tests should keep passing. | none | NAV-001 | HIGH - local handler and test evidence agree. |

## Locked Decisions From Context`
  ).replace(
    /## Sources[\s\S]*$/,
    `## Sources

### Repo Evidence

- Repo evidence: \`src/mcp/tools/phase.ts:1\`, symbol/heading=blueprintPhaseArtifactWrite, role=runtime, method=scoped-rg, supports=artifact-write recommendation.
- Repo evidence: \`tests/phase-discovery-research.test.ts:1\`, symbol/heading=phase artifact write creates, reuses, updates, and validates research content, role=test, method=manual-read, supports=validation recommendation.

### External References

- External reference: not used, none, accessed 2026-04-11, supports=repo-only run; source policy=off.
`
  );

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.status, "created");
  assert.equal(written.validation.valid, true, written.validation.issues.join("\n"));
});
```

Note: line numbers in the fixture are intentionally minimal (`:1`) because the existing validator checks source shape, not exact support. Do not add exact path-existence or support-validation logic in R2.

### 8E. Update agent specialist assertions

File: `tests/agent-contract-specialists.test.ts`

In the test named `mapping and discovery specialist agents encode concrete output modes and read boundaries`, near the existing `blueprint-researcher` assertions, add:

```ts
  assert.match(researcher, /parent-supplied navigation packet/i);
  assert.match(researcher, /sidecar equivalent of `rg --files`/i);
  assert.match(researcher, /scope filter/i);
  assert.match(researcher, /candidate files or\s+symbols/i);
  assert.match(researcher, /Files actually read|files actually read/i);
  assert.match(researcher, /source roles/i);
  assert.match(researcher, /remote code-search hits as\s+discovery hints/i);
  assert.match(researcher, /semantic navigation/i);
```

### 8F. Update MCP contract audit metadata assertions

File: `tests/mcp-contract-audit-metadata.test.ts`

In the test named `discovery contracts stay explicit across discuss, research, and ui command surfaces`, near existing `researchCommand` / `researchRuntimeContract` assertions, add:

```ts
  assert.match(researchCommand, /rg --files/i);
  assert.match(researchCommand, /remote code-search/i);
  assert.match(researchRuntimeContract, /per-strand search notes/i);
  assert.match(researchRuntimeContract, /remote code-search hits are discovery hints/i);
  assert.match(researchRuntimeContract, /role=definition\|reference\|test\|config\|contract\|runtime\|example\|background/i);
```

## Exact Change 9: Build Outputs

Because this plan changes TypeScript source in `src/mcp/artifact-contracts/index.ts` and `src/mcp/command-runtime-metadata.ts`, the implementor must rebuild and include tracked `dist/` updates.

In the fresh worktree, run:

```bash
npm ci
npm run build
```

Then inspect:

```bash
git status --short
```

Expected generated files will include at least:

- `dist/mcp/server.js`
- `dist/mcp/server.d.ts`

Do not hand-edit `dist/`.

## Verification Commands

Run these from the implementation worktree after edits:

```bash
npm ci
npm run typecheck
npm run build
npm test -- --test-name-pattern "research|mapping and discovery specialist agents|discovery contracts stay explicit"
```

If the filtered `npm test -- --test-name-pattern ...` command is not supported by the current npm/node test setup, run:

```bash
npm test
```

Minimum acceptable verification for this R2 slice:

```bash
npm run typecheck
npm test
```

## Expected Diff Shape

Expected source/doc changes:

- `commands/blu-research-phase.toml`: more explicit R2 repository search discipline.
- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`: richer evidence ladder, search notes, source role/method guidance, semantic/remote-search caveats, and sidecar packet constraints.
- `skills/blueprint-phase-discovery/SKILL.md`: short orchestration alignment with the runtime contract.
- `agents/blueprint-researcher.md`: sidecar packet contract tightened around search notes and parent-supplied navigation packets.
- `src/mcp/artifact-contracts/index.ts`: `phase.research` template updated with R2 search-note columns and role/method source rows.
- `src/mcp/command-runtime-metadata.ts`: command resource metadata aligned with R2 wording.
- `docs/commands/research-phase.md`, `docs/MCP-TOOLS.md`, `docs/RUNTIME-REFERENCE.md`: public docs aligned with the runtime contract and source-owned metadata.
- `tests/phase-discovery-research.test.ts`, `tests/agent-contract-specialists.test.ts`, `tests/mcp-contract-audit-metadata.test.ts`: regression assertions and one valid R2 fixture.
- `dist/`: generated runtime output after `npm run build`.

Expected no changes:

- `agents/blueprint-project-researcher.md`
- `src/mcp/tools/phase.ts`
- `src/mcp/tools/artifacts.ts`
- checkpoint implementation
- validation strictness
- command catalog statuses
- routing behavior

## Approval Checklist

Before implementation starts, confirm this plan still matches the intended R2 slice:

- R2 remains a prompt/template/test improvement, not a new repo-map or semantic-navigation tool.
- Older valid research artifacts remain accepted.
- New research drafts get stronger repository search notes and source role/method guidance.
- `blueprint-researcher` stays a bounded sidecar and does not gain persistence, routing, external-fetch, or semantic-navigation authority.
- Remote code search is explicitly a hint until local worktree evidence confirms it.
- `blueprint-project-researcher.md` stays unchanged.
