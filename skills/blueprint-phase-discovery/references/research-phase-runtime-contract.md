# Research Phase Runtime Contract

This reference is the rich behavior contract for `/blu-research-phase`. Load it
on demand for research runs instead of copying its details into the shared
discovery skill or command manifest. The canonical artifact schema still comes
from `blueprint_artifact_contract_read` with `artifactId: "phase.research"`.
Treat this file as orchestration, evidence-depth, and recovery guidance, not a
competing markdown schema.

## Parity Target

`/blu-research-phase` must produce planner-grade phase research, not a valid but
thin research-shaped note. It should answer "what do we need to know to plan
this phase well?" and preserve uncertainty honestly when the answer is not yet
known.

The retained behaviors that matter are:

- phase validation before research
- explicit reuse, view, or update handling for existing research
- actual saved `XX-CONTEXT.md` content and requirement mapping before drafting
- visible initial assessment before deep research: relevant saved artifacts,
  repo files or symbols, key findings, implementation questions, and confidence
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
- canonical `phase.research` template use before authoring and persistence
- planner-consumed sections such as standard stack, architecture patterns,
  don't-hand-roll guidance, pitfalls, code examples, recommendations, sources,
  and confidence breakdown
- clear distinction between repo evidence, official or supplied external
  references, and inference
- claim-addressable provenance: planner-critical claims get evidence IDs,
  claim IDs, lane labels (`repo`, `external`, or `inference`), source type,
  authority tier, support class, support span, retrieval context, provenance,
  limitations, and downstream-use notes before final prose synthesis
- final `## Sources` is split into `Repo Evidence`, `External Sources`, and
  `Inference Notes`; inference notes reference evidence IDs they combine instead
  of masquerading as citations
- parent-owned research strand ledger for non-trivial runs, with each strand
  tracked by id, type, question, requirement IDs, repo anchors, source policy,
  dependencies, expected packet shape, budget, status, evidence IDs, accepted
  claims, rejected or low-quality sources, search notes, uncertainty, stopping
  reason, and next action
- checkpointed resumability for pauses, inconclusive evidence, blocked source
  policy, sidecar failures, budget or timeout limits, validation repair, and
  post-write state-sync or route-refresh failures
- per-strand planning handoff with recommendation, affected files or modules,
  validation or test implications, unresolved blockers, evidence basis, and
  confidence
- parent-owned synthesis from accepted strand packets before final
  `XX-RESEARCH.md` authoring; child transcripts are never copied into the final
  artifact or checkpoint
- dependency/tool decisions treated as first-class research when a phase may add, adopt, replace, or hand-roll a package, library, CLI, framework, service, code generator, package-manager behavior, or other tool
- validation repair before completion
- routing only to implemented commands after refreshed state is loaded

## Shared Stage Mapping

Use the shared long-running-mutation stages:

- `Resolve`: resolve the phase and current roadmap boundary.
- `Read`: load phase context, current context artifact, existing research,
  checkpoint state, effective external-source policy, state, catalog, and the
  canonical research contract.
- `Decide`: choose reuse, view, update, resume, discard, repo-only, or
  repo-plus-external verification posture based on
  `research.external_sources`.
- `Execute`: build the initial assessment, follow the repository evidence
  ladder, classify non-trivial work into the parent-owned research strand
  ledger, record per-strand search notes and navigation evidence, research one
  runnable strand at a time, evaluate dependency/tool choices when they affect
  a recommendation, accept or reject sidecar packets before synthesis, close
  each strand with a planning handoff, keep evidence provenance visible, and
  construct the claim-addressable evidence packet before writing final
  recommendations.
- `Persist`: scaffold only a missing file, write checkpoints when there is
  useful resumable strand state, checkpoint before blocked waits or repair
  retries, and write final research through MCP only.
- `Validate`: normalize to the live authoring template, self-check, write in
  strict mode, repair invalid results, and retry when safe.
- `Route`: reload state, refresh implemented-command routing, delete only the
  research-owned checkpoint after write plus routing succeeds, and recommend
  only implemented next commands.

During non-trivial runs, keep resolved scope, active stage, pending gate,
execution mode, and next safe action visible through short progress updates.

## Visible Research Progress

For non-trivial runs, keep progress visible through short stage-boundary
updates. Use Gemini-native progress helpers when available. When they are not
available, emit concise text updates at stage boundaries and exceptional events.

Gemini-native progress helpers are presentation mirrors only. They do not
expand the tool allowlist, authorize persistence, external access, user
decisions, checkpointing, state sync, or routing, and they never replace MCP
checkpoint, state, or command-catalog authority.

Visible research stages:

| Step | User-visible wording | Shared stage | Required visibility |
|------|----------------------|--------------|---------------------|
| 1 | resolve phase | Resolve | selected phase or blocker |
| 2 | load saved context and state | Read | context path/status and state source |
| 3 | inspect existing research/checkpoint | Read | reuse/update/checkpoint posture |
| 4 | classify research strands | Decide | active strand set and execution mode |
| 5 | confirm external-source policy | Decide | source mode, pending gate, or repo-only constraint |
| 6 | collect repo evidence | Execute | evidence lane and stop/widen reason when relevant |
| 7 | collect approved external evidence | Execute | source envelope and decision outcome |
| 8 | synthesize recommendations | Execute | accepted evidence basis and unresolved blockers |
| 9 | write/validate artifact | Persist/Validate | write path, validation status, repair attempt, or checkpoint |
| 10 | sync state and summarize result | Route | state sync result, routing source, next safe action |

Progress updates must be short boundary updates. Do not narrate every file read.
Emit exceptional updates for external-source waits, sidecar unavailable or
failed, external sources declined, external source unavailable, validation
repair, checkpoint writes, post-write state-sync failure, and completion.

Example progress line:

```text
Research stage 5/10: external sources are set to ask; requesting confirmation before network-backed verification.
```

Future host progress integration may map progress values and messages to the
same stage script, but deterministic text stage lines remain the compatibility
baseline.

## Required MCP Calls

- `blueprint_phase_locate`: selects the phase and supplies authoritative phase
  number, prefix, name, and directory. Stop on `found: false`.
- `blueprint_phase_context`: provides project brief, roadmap boundary,
  requirement mapping, workflow posture, missing artifacts, and saved codebase
  bundle signals. This controls research scope and surfaces the mirrored
  `workflowPosture.research.externalSources` policy view.
- `blueprint_config_get` with `scope: "effective"`: provides the source-of-truth
  `research.external_sources` policy before any official-doc, package-registry,
  security-advisory, release-note, remote-code-search, or other external
  verification step. `off` means no live external lookup. `ask` means confirm
  first through an external-source confirmation gate with `accept`, `decline`,
  and `cancel` outcomes. `auto` allows bounded external verification only when
  repo evidence cannot settle a planner-critical claim. `workflowPosture.research.externalSources`
  remains a mirrored convenience view, not the authority.
- `blueprint_phase_research_status`: detects existing context, research,
  UI-spec, validity, stale paths, and suggested repair posture.
- `blueprint_phase_artifact_read` with `artifact: "context"`: loads the actual
  saved discovery decisions that constrain research.
- If the `context` read returns `found: false`, stop and route back to
  `/blu-discuss-phase <phase>` before drafting research. Do not continue from
  status-only signals.
- `blueprint_phase_artifact_read` with `artifact: "research"`: supports
  view, skip, update, and revision paths.
- `blueprint_phase_checkpoint_get`: detects resumable in-progress research and
  controls resume-versus-discard branching. Pass
  `expectedOwnerCommand: "/blu-research-phase"` and `expectedMode: "research"`,
  then honor `safeToResume` and `warnings` before using saved state. A safe
  research checkpoint resumes by default unless the user explicitly asks to
  discard it.
- `blueprint_state_load`: grounds workflow posture before and after writes.
- `blueprint_command_catalog`: gates every next-command recommendation.
- `blueprint_artifact_contract_read` with `artifactId: "phase.research"`:
  supplies `contract.authoringTemplate`, required headings, locked markers,
  placeholder signals, and freehand policy. This is the schema authority.
- `blueprint_artifact_scaffold`: reserve this for deliberate placeholder
  creation only. Default drafting should start from
  `contract.authoringTemplate`, and scaffold output is never completed
  research.
- `blueprint_phase_checkpoint_put`: persists useful continuation state using
  the structured checkpoint shape with `ownerCommand: "/blu-research-phase"`
  and `resumeMeta.mode: "research"`. For non-trivial research, include a nested
  `researchLedger` payload with `schemaVersion: "research-ledger/v1"`, compact
  strand state, accepted evidence packet references, sidecar status, draft
  state, and next action. Store packets and source references, not child
  transcripts. The MCP tool owns the shared checkpoint path; do not assume the
  filename is research-specific.
- `blueprint_phase_artifact_write`: persists final research with the resolved
  numeric `phase`, `artifact: "research"`, full markdown body, and strict
  validation unless the user explicitly accepts a warned save.
- `blueprint_phase_checkpoint_delete`: removes stale continuation state only
  after final research writes successfully, `STATE.md` sync succeeds, refreshed
  state load succeeds, and implemented-command routing has been checked. Pass
  `expectedOwnerCommand: "/blu-research-phase"` and `expectedMode: "research"`
  so cleanup cannot delete another command's shared checkpoint.
- `blueprint_state_update`: records completion or repair posture after
  artifact persistence.

## Artifact Authoring Rules

Use `contract.authoringTemplate` as the heading, marker, and direct drafting
authority. Populate every required section with substantive, phase-specific
content before persistence.

Quality rules for `XX-RESEARCH.md`:

- `## Phase Requirements` maps each in-scope requirement ID to the research
  finding that enables implementation or verification.
- `## Summary` gives a concise executive recommendation, not just a list of
  topics inspected.
- Optional `## Investigation Trace` content, when present in the authoring
  template, records the initial assessment, navigation evidence packet, and
  per-strand planning handoffs. Populate it for non-trivial research, but do
  not make older valid artifacts fail solely because they lack this optional
  heading.
- `## Locked Decisions From Context` and `## User Constraints` preserve the
  saved context decisions that constrain implementation.
- `## Standard Stack` names concrete runtime, library, tool, or repo patterns
  and versions when version knowledge matters.
- `## Standard Stack` includes a `Dependency / Tool Evaluation` table when the
  research recommends adding, adopting, replacing, upgrading, globally
  installing, locally installing, vendoring, forking, code-generating, or
  hand-rolling a package, library, CLI, framework, service, or tool.
- `## Installation And Setup` says whether setup is needed, already present, or
  intentionally not applicable.
- `## Installation And Setup` names manifest and lockfile impact, install scope,
  side effects, verification commands, and update posture when a dependency/tool
  decision affects setup.
- `## Alternatives Considered` records real tradeoffs, including why the
  recommendation is preferred.
- `## Alternatives Considered` compares no-new-dependency, existing dependency,
  standard-library/platform API, candidate package/tool, and custom
  implementation before recommending a new dependency/tool.
- `## Architecture Patterns`, `## Don't Hand-Roll`, and `## Anti-Patterns`
  give planner-usable implementation structure and verification risks.
- `## Don't Hand-Roll` explains library-versus-custom reasoning for standardized,
  security-sensitive, adversarial, parser, protocol, package/version,
  vulnerability/license/provenance, AST/indexing, or edge-case-heavy behavior.
- `## State Of The Art` identifies current guidance or repo-local context. As
  advisory provenance guidance, prefer explicit source dates near
  freshness-sensitive external evidence, or say when live external checking did
  not happen; MCP validation does not require either marker.
- `## Common Pitfalls` describes failure modes, why they happen, and how a plan
  should prevent them.
- `## Open Questions` lists only unresolved questions that matter downstream,
  with a recommended handling path.
- `## Confidence Breakdown` assigns honest confidence by topic and explains the
  evidence behind each level.
- `## Code Examples` includes fenced code, pseudocode, config, command examples,
  or says why examples would be misleading for this phase.
- `## Recommendations` is prescriptive enough for `/blu-plan-phase` to turn
  into tasks.
- `## Claim Support Ledger`, when present, is the planner-critical claim ledger. Use columns `Claim ID`, `Claim`, `Claim Type`, `Evidence IDs`, `Support Status`, `Confidence`, and `Plan Impact`. Valid claim types are `repo_runtime`, `external_practice`, `dependency_tool`, `inference`, and `open_question`. Valid support statuses are `directly_supported`, `partially_supported`, `inferred_from_supported`, `contradicted`, `conflicting_sources`, `not_enough_evidence`, and `out_of_scope`.
- `## Recommendations` should include a `Recommendation Handoff` table for planner-critical recommendations. Use columns `Recommendation ID`, `Recommendation`, `Supporting Claim IDs`, `Evidence IDs`, `Affected Surfaces`, `Tests / Checks`, and `Status`. A recommendation is planner-ready only when it cites supporting claim IDs or evidence IDs, names affected repo or contract surfaces, and names tests/checks, or when `Status` says `blocked` and points to a named open question.
- Legacy non-table claim-addressable provenance remains valid when the artifact otherwise satisfies the current contract. It is good enough when planner-critical claims still include stable claim/evidence/source IDs, support status, source lane, and downstream use in nearby prose or the existing `Repo Evidence`, `External Sources`, and `Inference Notes` tables. It should receive warning diagnostics when those IDs cannot be connected, when recommendations lack affected surfaces or tests/checks, or when repo-runtime and external-source policy claims cannot be traced.
- Each planner-critical recommendation should be traceable to a strand handoff
  that names affected files or modules, validation or test implications,
  unresolved blockers, evidence basis, and confidence.
- `## Sources` separates repo evidence, external sources, and inference notes.
  Do not blend these source classes. Repo evidence rows cite local files,
  commands, tests, manifests, contracts, saved Blueprint artifacts, or built
  runtime entrypoints. External source rows cite official docs, standards,
  papers, supplied references, package docs, or web pages only when allowed by
  `research.external_sources`. Inference notes cite the evidence IDs they
  combine and never masquerade as direct source citations.
- Each planner-critical claim should be traceable through a stable evidence ID
  and claim ID. Use support classes:
  `directly_supported`, `partially_supported`, `inferred_from_supported`,
  `contradicted`, `conflicting_sources`, `not_enough_evidence`, and
  `out_of_scope`.
- Repo-runtime claims should cite repo evidence first. External sources may
  inform practice or dependency/tool choices, but they must not override observed
  Blueprint runtime behavior without an explicit conflict note.
- External evidence should include title, URL or DOI when available, access date,
  source type, authority tier, support span or excerpt/summary, retrieval
  context, limitations, and the downstream claim or recommendation it supports.

Every non-repo factual claim should carry provenance in nearby prose or the
source list. Use labels such as `Repo evidence`, `Official reference`,
`Supplied reference`, or `Inference` rather than implying external verification
that did not happen.

## Evidence Quality, Citations, And Provenance

Treat evidence as a parent-owned claim graph, not as a bibliography assembled
after writing prose. Build the evidence packet before final synthesis, then cite
evidence IDs or claim IDs from the packet while drafting `XX-RESEARCH.md`.

Use this packet shape in prose, tables, or parent-side working notes:

```text
evidence_id: EVID-001
lane: repo | external | inference
claim_id: CLM-001
claim_text: concise atomic claim
claim_class: directly_supported | partially_supported | inferred_from_supported | contradicted | conflicting_sources | not_enough_evidence | out_of_scope
source_type: repo_file | command_output | test_output | official_standard | official_product_doc | peer_reviewed_paper | preprint | supplied_reference | web_page | inference
authority_tier: repo_runtime | official_standard | official_vendor_doc | peer_reviewed | maintained_project_doc | preprint | secondary | unknown
source_ref: path:line, command, URL, DOI, or source packet IDs
source_title: exact title when external
accessed: YYYY-MM-DD for external sources, or observed YYYY-MM-DD for repo-local evidence when helpful
support_span: quoted span, line range, page/section, command output summary, or extracted fact
retrieval_context: search query, tool/API used, local command, targeted file read, or user-supplied source
provenance: collected_by, collected_at, activity, and derivation/attribution notes
limitations: missing lines, inaccessible full text, stale version risk, partial support, ambiguity, conflict, or none
downstream_use: planner-safe conclusion, recommendation id, or "do not use as support"
```

Evidence lanes:

- `repo`: local files, commands, tests, manifests, runtime contracts, artifact
  contracts, MCP handlers, saved Blueprint artifacts, and git-visible state.
- `external`: official docs, standards, papers, supplied URLs, package docs,
  release notes, registry pages, or web pages gathered under the configured
  external-source policy.
- `inference`: bounded synthesis derived from specific repo or external evidence
  IDs. Inference cannot be the only support for a current external factual claim
  written as fact.

Source types:

- `repo_file`
- `command_output`
- `test_output`
- `official_standard`
- `official_product_doc`
- `peer_reviewed_paper`
- `preprint`
- `supplied_reference`
- `web_page`
- `inference`

Authority tiers:

- `repo_runtime`
- `official_standard`
- `official_vendor_doc`
- `peer_reviewed`
- `maintained_project_doc`
- `preprint`
- `secondary`
- `unknown`

Support classes:

- `directly_supported`: the cited span directly says or proves the claim.
- `partially_supported`: the source supports part of the claim, but limits remain.
- `inferred_from_supported`: the claim is a bounded synthesis from cited evidence.
- `contradicted`: a cited source contradicts the claim.
- `conflicting_sources`: credible sources disagree or local repo truth conflicts
  with external guidance.
- `not_enough_evidence`: available evidence cannot safely support the claim.
- `out_of_scope`: the claim belongs outside the selected phase or outside
  `/blu-research-phase`.

Final sources should use this structure:

```md
## Sources

### Source Register

| Source ID | Lane | Path Or URL | Accessed | Repo Line Or Symbol | Source Type | Used For Claims | Limitations |
|-----------|------|-------------|----------|---------------------|-------------|-----------------|-------------|
| SRC-001 | repo | src/example.ts | observed 2026-05-12 | exampleFunction | repo_file | CLM-001 | local checkout only |
| SRC-002 | external | https://example.com/docs | 2026-05-12 | n/a | official_product_doc | CLM-002 | may drift |

### Repo Evidence

| Evidence ID | Claim ID | Source Ref | Role | Retrieval Context | Support Span | Claim Class | Downstream Use | Limitations |
|-------------|----------|------------|------|-------------------|--------------|-------------|----------------|-------------|
| EVID-001 | CLM-001 | SRC-001 | runtime | scoped-rg + targeted-read | function behavior observed locally | directly_supported | REC-001 | local checkout only |

### External Sources

| Evidence ID | Claim ID | Source Type | Authority Tier | Source Title | Source Ref | Accessed | Support Span | Claim Class | Retrieval Context | Limitations | Downstream Use |
|-------------|----------|-------------|----------------|--------------|------------|----------|--------------|-------------|-------------------|-------------|----------------|
| EVID-002 | CLM-002 | official_product_doc | official_vendor_doc | <title> | SRC-002 | 2026-05-12 | <section or excerpt summary> | directly_supported | parent-approved external check | may drift | REC-001 |

### Inference Notes

| Evidence ID | Claim ID | Derived From | Claim Class | Derivation / Attribution | Limitations | Downstream Use |
|-------------|----------|--------------|-------------|--------------------------|-------------|----------------|
| EVID-003 | CLM-003 | EVID-001, EVID-002 | inferred_from_supported | Repo behavior plus official guidance suggest this planner-safe improvement. | verify during planning | REC-001 |

### Supply Chain Evidence

- Supply-chain evidence remains allowed when dependency/tool rows need it, but it should reference the relevant Source Register, claim-addressable evidence IDs, or dependency decision IDs.
```

Rules:

- Final paragraphs should cite existing evidence IDs, source IDs, or claim IDs;
  do not invent citations during final prose writing.
- Repo evidence dominates Blueprint runtime claims.
- External sources are allowed only under the effective `research.external_sources`
  policy and should include access dates.
- Inference must be explicit, bounded, and traceable to evidence IDs.
- Conflicts, stale evidence, missing evidence, inaccessible sources, or private
  artifacts must be recorded as limitations or open questions instead of being
  smoothed into confident recommendations.

## External Source Decision Gate

Treat `research.external_sources=ask` as a first-class user gate, not a final
prose caveat. Ask at the point of need, before any live external verification.

The gate prompt must include:

- why external access is needed
- which source classes will be used
- known URLs or domains when already known
- what will not happen: no source-file mutation, installed-extension changes,
  host-global Blueprint state mutation, credential use, package installation,
  external service mutation, or source-code fixing

Use this outcome model:

- `accept`: gather only the named source classes and record the decision.
- `decline`: continue repo-only or supplied-only, mark affected claims
  unchecked or lower-confidence, and avoid "official docs confirm", "latest",
  "current upstream", or equivalent live-verification wording.
- `cancel`: stop safely, preserve or refresh the research-owned checkpoint, and
  do not write final `XX-RESEARCH.md` unless the artifact is already complete
  without the blocked external claim.

Persist `external_sources_mode`, `user_decision`, and the source envelope in the
research checkpoint before waiting, cancelling, or stopping. On safe resume, do
not re-ask the same envelope; ask only for a materially different source class
or known URL/domain set.

Do not repeatedly ask for the same source envelope inside one run. Ask again
only when the run needs a materially different source class, such as moving
from official docs to package registry metadata, security advisories, release
notes, issue trackers, or user-supplied URLs.

In `auto` mode, narrate the source envelope before fetching:

```text
External sources are auto-enabled; using official docs for standards and current product behavior.
```

In `off` mode, narrate the repo-only constraint once and keep freshness-sensitive
external claims unchecked, lower-confidence, or in `## Open Questions`.

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
  `rg --files` plus path filtering, scoped content `rg`, targeted file read,
  parent-supplied semantic/navigation packet, official or supplied external
  packet, remote code-search hint, or inference
- the key findings so far
- implementation questions that still matter for planning
- current confidence and why

Use this repository evidence ladder before widening research:

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

Do not treat "more files read" as better research. Widen only when the current
strand cannot be answered from narrower evidence. Record why the search stopped
or widened.

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

A compact navigation evidence packet should use this shape in prose, tables, or
the optional `## Investigation Trace` template section:

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

Treat context files, skills, runtime contracts, and saved summaries as valuable
but potentially stale. Cite them as repo evidence, then check that the live
repository still agrees before presenting them as planner-grade truth.

Each non-trivial topic strand must close with a Strand Planning Handoff:

```text
Strand: <id/topic>
Recommendation: <planner-ready direction or "no safe recommendation">
Affected files/modules: <repo paths, command surfaces, contracts, tests, or none>
Validation or test implications: <specific tests/checks or "not yet known">
Unresolved blockers: <none or exact blocker>
Evidence basis: <NAV/source ids or concise citations>
Confidence: LOW|MEDIUM|HIGH with reason
```

Tie recommendations to evidence roles. API-usage recommendations should cite
definitions and references. Regression-risk recommendations should cite tests,
validation paths, or prior failure evidence. Runtime-behavior recommendations
should cite command manifests, MCP handlers, artifact contracts, runtime
contracts, tests, or built/runtime entrypoints when those surfaces are relevant.

When evidence is partial, inconclusive, stale, or blocked by source policy,
lower confidence and preserve the uncertainty in `## Open Questions`, the
strand handoff, or the research checkpoint. Do not turn a weak strand into a
confident recommendation.

## Research Run Metadata

Record run-level UX metadata when final research is created or updated. Do not
change `phase.research.requiredHeadings`, authoring templates, scaffold
templates, placeholder signals, or validators in this UX slice. Include this
metadata only when creating or updating final research; do not modify an
existing artifact solely for a viewed, skipped, or reused no-write path.

Place the metadata inside existing artifact structure, preferably under
`## Summary`, using these keys:

| Key | Value |
|-----|-------|
| `external_sources_mode` | off\|ask\|auto |
| `user_decision` | not_required\|accept\|decline\|cancel\|not_applicable |
| `source_classes_allowed` | <classes or none> |
| `source_classes_declined_or_unavailable` | <classes or none> |
| `execution_mode` | parent-only\|sidecar-assisted |
| `completion_receipt` | <artifact path or none; state sync result; next safe action> |

When external evidence was declined, cancelled, unavailable, or disabled by
config, also reflect the resulting uncertainty in `## Confidence Breakdown` and
`## Open Questions` when it affects planner readiness. Do not hide the
uncertainty only in chat.

## Research Strand Ledger And Checkpoint Semantics

Treat topic strands as a parent-owned ledger, not as ad hoc prose. A simple run
may collapse strands, but every non-trivial, blocked, resumed, or sidecar-aided
run should classify work into the smallest useful set from:

1. `context-lock`: saved `XX-CONTEXT.md`, requirement mapping, user constraints,
   prior phase artifacts, and current workflow gates.
2. `repo-map`: saved `.blueprint/codebase/` summaries, relevant files, symbols,
   tests, commands, and contract anchors.
3. `stack-and-dependencies`: current repo stack, existing dependencies,
   candidate libraries/tools, versions, setup, license/security/maintenance
   cautions, and "do not hand-roll" calls.
4. `architecture-integration`: implementation patterns, ownership boundaries,
   state/data flow, MCP/tool contracts, and affected modules.
5. `validation-and-tests`: expected verification surfaces, test harnesses,
   fixtures, commands, and failure modes planning must cover.
6. `risks-and-pitfalls`: anti-patterns, contradictory evidence, operational
   hazards, migration concerns, and blocked assumptions.
7. `external-delta`: official or supplied external sources only when
   `research.external_sources` allows them and repo evidence cannot settle the
   claim.
8. `planner-handoff`: parent-owned synthesis across completed strands into
   recommendations, open questions, confidence, and planning handoff notes.

For each strand, track:

- `id`
- `type`
- `question`
- `requirementIds`
- `repoAnchors`
- `sourcePolicy`
- `dependencies`
- `expectedPacket`
- `budget`
- `status`
- `evidenceIds`
- `acceptedClaims`
- `rejectedOrLowQualitySources`
- `searchNotes`
- `uncertainty`
- `stoppingReason`
- `nextAction`

Valid strand statuses are:

- `pending`
- `active`
- `complete`
- `blocked`
- `inconclusive`
- `failed`
- `deferred`

Valid stopping reasons are:

- `evidence-sufficient`
- `no-authoritative-source-found`
- `blocked-by-source-policy`
- `budget-exhausted`
- `timeout`
- `tool-failure`
- `contradictory-evidence`
- `parent-escalation-required`
- `waiting-for-user`
- `validation-repair-required`
- `state-sync-failed`
- `route-refresh-failed`

`Inconclusive with evidence and next search direction` is a valid terminal
strand state. Endless research is not.

Checkpoint research state with `blueprint_phase_checkpoint_put` only when there
is useful continuation state. Update the checkpoint:

- after `blueprint_phase_checkpoint_get` returns a safe resumable checkpoint and
  the parent accepts or defaults to resume, if the parent changes the active
  strand or next action;
- before launching any sidecar wave, with strand ids, questions, budgets, and
  expected packet shape already recorded;
- after each parent-accepted or parent-rejected sidecar packet;
- after each parent-completed inline strand when the remaining strands still
  matter and the run is long enough to resume later;
- before waiting on `research.external_sources=ask` when the run cannot continue
  repo-only without losing context;
- when a source-policy decline, tool failure, budget limit, timeout, or
  contradictory evidence leaves a strand inconclusive;
- before a final artifact write retry when validation diagnostics require
  repair;
- after a failed or identical validation repair attempt, preserving the draft
  status and exact diagnostics;
- before stopping due to state-sync or route-refresh failure after a final write
  attempt.

Do not checkpoint after a straightforward successful final write except as a
temporary pre-delete state. Delete only after the final research write, state
sync, refreshed state load, and implemented-command routing receipt are known.

Recommended parent command loop:

```ts
const checkpoint = await blueprint_phase_checkpoint_get({
  phase,
  expectedOwnerCommand: "/blu-research-phase",
  expectedMode: "research",
});

const ledger = decideResumeOrFreshLedger(checkpoint, userIntent);
classifyStrands(ledger, context, researchStatus, config, contract);

for (const strand of nextRunnableStrands(ledger)) {
  setProgress("Execute", strand);

  if (shouldUseSidecar(strand, config)) {
    await putCheckpoint(ledger.markDispatching(strand));
    const packet = await runResearcherSidecar(strand);
    ledger.acceptOrRejectPacket(strand.id, packet);
    await putCheckpoint(ledger);
  } else {
    const packet = await parentInlineResearch(strand);
    ledger.acceptOrRejectPacket(strand.id, packet);
    if (ledger.hasRemainingCriticalWork()) {
      await putCheckpoint(ledger);
    }
  }

  if (strand.isBlockedOrInconclusive()) {
    await putCheckpoint(ledger);
    stopWithCheckpointReceipt(ledger);
  }
}

const draft = synthesizeResearchFromParentLedger(
  ledger,
  contract.authoringTemplate
);
const write = await blueprint_phase_artifact_write({
  phase,
  artifact: "research",
  content: draft,
});

if (write.status === "invalid") {
  await putCheckpoint(ledger.recordValidationAttempt(write.validation));
  const repaired = repairSameDraft(draft, write.validation);
  const retry = await blueprint_phase_artifact_write({
    phase,
    artifact: "research",
    content: repaired,
    overwrite: true,
  });
  if (retry.status === "invalid") {
    await putCheckpoint(ledger.recordRepeatedValidationFailure(retry.validation));
    stopWithCheckpointReceipt(ledger);
  }
}

await blueprint_state_update({
  base: "synced",
  patch: { currentPhase: phase, activeCommand: "/blu-research-phase" },
});
await blueprint_state_load({ phase });
await blueprint_command_catalog({});
await blueprint_phase_checkpoint_delete({
  phase,
  expectedOwnerCommand: "/blu-research-phase",
  expectedMode: "research",
});
```

Keep the existing generic checkpoint fields for compatibility. Add
`researchLedger` as a nested payload instead of replacing the generic schema:

```json
{
  "ownerCommand": "/blu-research-phase",
  "completedAreas": ["S1 context-lock"],
  "remainingAreas": ["S2 repo-map"],
  "decisions": [],
  "deferredIdeas": [],
  "canonicalReferences": [],
  "resumeMeta": {
    "mode": "research",
    "pendingTopics": ["S2 repo-map"],
    "completedTopics": ["S1 context-lock"],
    "currentQuestion": "Which repo surfaces constrain this phase?",
    "notes": [],
    "resumeHint": "Resume at S2.",
    "updatedAt": "2026-05-12T00:00:00.000Z"
  },
  "researchLedger": {
    "schemaVersion": "research-ledger/v1",
    "phase": {
      "number": "3",
      "prefix": "03",
      "name": "Phase Discovery",
      "dir": ".blueprint/phases/03-phase-discovery"
    },
    "runtime": {
      "ownerCommand": "/blu-research-phase",
      "artifactId": "phase.research",
      "externalSources": {
        "effective": "ask",
        "decision": "pending",
        "reason": "Repo evidence cannot settle upstream behavior."
      }
    },
    "strands": [
      {
        "id": "S1",
        "type": "context-lock",
        "question": "What saved context decisions constrain this research?",
        "requirementIds": ["REQ-001"],
        "repoAnchors": [".blueprint/phases/03-example/03-CONTEXT.md"],
        "sourcePolicy": "repo-only",
        "dependencies": [],
        "expectedPacket": "parent-inline-evidence",
        "budget": {
          "maxFiles": 3,
          "maxSidecars": 0
        },
        "status": "complete",
        "evidenceIds": ["SRC-001"],
        "acceptedClaims": ["Context requires MCP-owned persistence."],
        "rejectedOrLowQualitySources": [],
        "searchNotes": [],
        "uncertainty": "none",
        "stoppingReason": "evidence-sufficient",
        "nextAction": "feed planner-handoff"
      }
    ],
    "evidencePackets": [
      {
        "id": "SRC-001",
        "class": "repo",
        "strandId": "S1",
        "source": ".blueprint/phases/03-example/03-CONTEXT.md",
        "claim": "Saved context constrains research scope.",
        "confidence": "high"
      }
    ],
    "sidecars": [],
    "draftState": {
      "hasDraft": false,
      "sectionsTouched": [],
      "validationAttempted": false,
      "validationIssues": [],
      "finalWriteAttempted": false,
      "lastKnownPath": null
    },
    "nextAction": {
      "stage": "Execute",
      "pendingGate": "none",
      "safeCommand": "/blu-research-phase 3"
    }
  }
}
```

Initial implementation must not require every optional nested field for every
simple run. Runtime/text tests should require only the generic MCP checkpoint
fields plus references to `researchLedger.schemaVersion`,
`researchLedger.strands`, and `researchLedger.nextAction`. Code should not add a
strict `researchLedger` Zod schema in this slice.

Checkpoint resume behavior:

- If no checkpoint exists, start a fresh parent-owned strand ledger.
- If a checkpoint exists and `safeToResume=true`, resume by default. Show a
  compact recap of completed strands, blocked strands, pending gate, and next
  action before doing more work.
- If the user explicitly asks to discard a safe research checkpoint, call
  `blueprint_phase_checkpoint_delete` with
  `expectedOwnerCommand: "/blu-research-phase"` and `expectedMode: "research"`;
  then start fresh only if deletion succeeds.
- If a checkpoint exists but `safeToResume=false`, do not resume, overwrite, or
  delete it by default. Report `ownerCommand`, `resumeMode`, warnings, and the
  next safe implemented action.
- If a legacy checkpoint is mode-compatible but missing `ownerCommand`, treat it
  as resumable only when `safeToResume=true`, include the warning in the
  progress recap, and refresh it into the richer research ledger before the next
  pause.
- If final research is successfully written but state sync, state load, or
  command-catalog routing fails afterward, keep or refresh the checkpoint with
  the exact failure and do not claim the run fully completed.

When `update_topic` and `write_todos` are available, use them only as a
session-local mirror of the strand ledger: topic is current stage plus active
strand, and todos are strand ids and statuses. They are never persistence and
never replace `blueprint_phase_checkpoint_put`.

When those helpers are unavailable, emit compact progress recaps at stage
boundaries and exceptional events:

```text
Stage: Execute | Scope: Phase 3 Phase Discovery | Mode: parent-only |
Completed: S1 context-lock, S2 repo-map | Active: S3 stack-and-dependencies |
Pending gate: external-source confirmation | Next safe action: checkpoint or
resume /blu-research-phase 3
```

Do not narrate every file read. Recap after Read, after strand classification,
after each completed or blocked strand, before checkpointing, before validation
repair, and after Route.

If `blueprint-researcher` is unavailable or disabled, the parent narrows to one
runnable strand at a time, uses scoped repo searches, and checkpoints blocked
strands instead of expanding silently.

If a sidecar fails or times out, the parent records a sidecar packet with
`status: "failed"`, retries inline only when the strand budget and source
policy allow it, and otherwise checkpoints with `stoppingReason:
"tool-failure"` or `"budget-exhausted"`.

Do not dwell on sidecar absence in the final response unless it changed output
quality. Preserve detailed uncertainty in the artifact and checkpoint. Mention
fallback in the completion receipt only when it lowered confidence, left
blockers, or caused checkpointing.

Before writing final research, the parent command must run a synthesis pass over
the accepted strand ledger. The final `XX-RESEARCH.md` may cite child packets or
repo/external evidence, but it must not paste a child transcript or let a sidecar
decide final confidence, open questions, routing, checkpoint deletion, or state
sync.

Parent synthesis should build this internal matrix before drafting:

| Strand id | Artifact sections affected | Accepted evidence ids | Recommendation | Test or validation implication | Unresolved blocker |
|---|---|---|---|---|---|

Only recommendations that map to accepted evidence or clearly labeled inference
should enter `## Recommendations`. Any strand that remains blocked should appear
in `## Open Questions` or cause a checkpointed no-final-write exit when it
blocks planner-grade output.

## Tool And Dependency Selection

Treat dependency/tool choice as a first-class research strand whenever the phase
may add, adopt, replace, upgrade, globally install, locally install, vendor,
fork, code-generate, or hand-roll any package, library, CLI, framework, service,
package-manager behavior, parser, protocol client, security-sensitive helper,
or other implementation tool.

The default answer is not "add a package." First evaluate:

1. no new dependency
2. existing repo dependency
3. standard library or platform API
4. candidate package, CLI, service, framework, or code generator
5. custom implementation

Record the result in the existing research artifact headings instead of adding a
new top-level required heading:

- `## Standard Stack`: dependency/tool evaluation table for current and
  candidate stack choices.
- `## Installation And Setup`: reproducible setup, manifest and lockfile
  impact, install scope, side effects, verification, and update posture.
- `## Alternatives Considered`: no-new-dependency, existing dependency,
  standard-library/platform, candidate, and custom alternatives.
- `## Don't Hand-Roll`: library-versus-custom decision rule for standardized,
  security-sensitive, adversarial, protocol, parser, package/version,
  vulnerability/license/provenance, AST/indexing, or edge-case-heavy behavior.
- `## Recommendations`: cite the dependency/tool evaluation row when a
  recommendation adds, adopts, rejects, defers, upgrades, or hand-rolls a tool.
- `## Sources`: cite repo, official, supplied, or unchecked `Supply Chain Evidence`
  rows for each planner-critical dependency/tool claim.

Use this `## Standard Stack` table shape when a dependency/tool decision exists:

```md
### Dependency / Tool Evaluation

| Decision ID | Need | Candidate | Decision | Official Source Or Repo Evidence | Package Ecosystem | Install Scope | Current / Wanted / Latest Evidence | Maintenance Signal | Vulnerability Signal | License | Provenance / Signature Signal | Transitive Footprint | Existing / Standard-Library Alternative | Update Posture | Residual Risk And Mitigation |
|-------------|------|-----------|----------|----------------------------------|-------------------|---------------|------------------------------------|--------------------|----------------------|---------|-------------------------------|---------------------|------------------------------------------|----------------|-------------------------------|
| DEP-001 | <capability needed> | <package, tool, repo helper, platform API, or custom> | already_in_repo|use_existing|add_candidate|defer|reject|custom | <repo path, official URL, supplied source, or unchecked> | <npm, stdlib, platform, repo-local, service, or none> | runtime|dev|global|none | <current/wanted/latest, observed version, or unchecked> | <release/maintainer/CI/security-policy signal or unchecked> | <audit/OSV/advisory result or unchecked> | <SPDX/license signal or unchecked> | <provenance/SLSA/signature/scope identity signal or unchecked> | <none, small, moderate, large, or unchecked> | <no-new-dependency, existing dependency, standard library, or platform API option> | <Dependabot/Renovate/audit/OSV/release-note/changelog/manual review posture> | <risk and mitigation> |
```

Use this `## Installation And Setup` table shape when setup changes:

```md
### Setup And Update Posture

| Decision ID | Manifest / Lockfile Impact | Install Command Or Path | Install Scope | Side Effects | Verification Command | Update / Monitoring Plan | Manual Review Required |
|-------------|----------------------------|-------------------------|---------------|--------------|----------------------|--------------------------|------------------------|
| DEP-001 | <package.json/package-lock or none> | <repo-local command/path or none> | runtime|dev|global|none | <transitive deps, lifecycle scripts, native binaries, peers, engines, or none> | <test/build/check or manual verification> | <Dependabot/Renovate/dependency review/OSV/npm audit/release notes/changelog/manual> | yes|no - <reason> |
```

Use this `## Alternatives Considered` table shape when a dependency/tool decision
exists:

```md
### Dependency Alternatives

| Decision ID | Need | No New Dependency | Existing Dependency | Standard Library / Platform API | Candidate Package / Tool | Custom Implementation | Decision | Rationale |
|-------------|------|-------------------|---------------------|---------------------------------|--------------------------|----------------------|----------|-----------|
| DEP-001 | <capability needed> | <viable/rejected and why> | <viable/rejected and why> | <viable/rejected and why> | <candidate and evidence> | <allowed/rejected and tests needed> | use_existing|add_candidate|defer|reject|custom | <actionable rationale> |
```

Use this `## Don't Hand-Roll` table shape when custom code is recommended or a
library should be preferred:

```md
### Library Vs Custom Decision

| Decision ID | Capability | Domain Risk | Proven Library / Existing Option | Custom Path Allowed? | Rationale | Required Tests / Validation | Maintenance / Update Owner |
|-------------|------------|-------------|----------------------------------|----------------------|-----------|-----------------------------|----------------------------|
| DEP-001 | <capability> | security-sensitive|standardized|protocol|parser|package-resolution|low-risk-project-specific | <option or none> | yes|no | <why package/library/custom is safer> | <tests/checks required> | <owner or update path> |
```

Selection rules:

- A new package/tool recommendation should not be `HIGH` confidence unless the
  research artifact records version, maintenance, vulnerability, license,
  provenance/signature, transitive-footprint, install-scope, update-posture, and
  residual-risk evidence or explicitly explains which signals are unavailable.
- `latest` is not the same as `wanted` for npm-style package managers. When
  version freshness matters, record observed `current`, `wanted`, and `latest`
  evidence when available, and mark the nuance as unchecked when external
  package metadata was not gathered.
- Treat package identity as evidence: project website, registry package,
  repository, namespace/scope, official docs, and package provenance should
  point to the same artifact lineage before the package is recommended.
- Missing maintenance, vulnerability, license, provenance, or transitive data is
  uncertainty, not approval.
- Do not present `npm audit fix`, OSV guided remediation, dependency-update PRs,
  or package-manager install side effects as automatically safe. Recommend
  manifest and lockfile review, release-note or changelog review, focused tests,
  and human review for risky major updates or remediation.
- Avoid global installs for project runtime dependencies when a repo-local
  runtime or dev dependency works. If a global install is recommended, justify it
  from official or supplied evidence and record the install/update risk.
- Avoid vendoring, copying snippets, or forking as a casual compromise. If
  unavoidable, record source/version provenance, license retention,
  vulnerability-monitoring ownership, and an update plan.

Hand-rolling is allowed only when the capability is narrow, project-specific,
easy to test exhaustively, not security-sensitive, not a standards
implementation, and smaller than the dependency risk it avoids. The artifact
must name the tests or validation that make the custom path safe.

## Capability-Gated Subagent Path

Use `blueprint-researcher` only when the host exposes a suitable Blueprint
research or code-analysis agent and the work benefits from isolated reading or
comparison. Do not substitute browser-only, web-search-only, shell-only, or
generic agents for codebase and workflow analysis.

When used, pass the agent:

- resolved phase number, name, goal, success criteria, and requirements
- the actual saved context artifact content
- saved codebase summaries, compact repo evidence packets, and any
  parent-supplied navigation packet such as candidate files, symbol hits,
  definitions, references, SCIP/ctags entries, Tree-sitter captures,
  dependency edges, or remote code-search hints
- any parent-gathered or user-supplied claim-addressable evidence packet, including evidence ID,
  lane, claim ID, claim text, support class, source type, authority tier,
  source reference, source title, access date when external, support span,
  retrieval context, provenance, limitations, and downstream use
- existing research content when revising
- `contract.authoringTemplate`, required headings, locked markers,
  placeholder signals, and freehand policy
- the requested topic strand or evidence question
- one bounded evidence question, expected source classes, retrieval boundaries,
  search-note fields, and the strand handoff fields the parent needs back
- source and confidence expectations

For dependency/tool strands, pass the exact bounded need and ask for a
dependency/tool evidence packet, not a broad package recommendation. The packet
must compare no-new-dependency, existing dependency, standard-library/platform,
candidate package/tool, and custom options, and must label unavailable version,
maintenance, vulnerability, license, provenance, transitive, install, lockfile,
and update-posture evidence under the current external-source policy.

Ask the agent for bounded findings by default, not broad plans or final
persistence ownership. The response should include the strand/question, concise
answer, claim-addressable evidence rows for any planner-critical claims, source classes,
paths or URLs, source roles, search notes, support classes, confidence,
failed/noisy/no-hit or limited searches, unanswered questions, and a planning
handoff.
Ask for a bounded section draft only when the parent names target headings from
`contract.authoringTemplate`; the parent still merges, normalizes, validates,
and persists the final artifact.

The agent must not claim it performed semantic navigation, symbol search, remote
code search, LSP, SCIP, ctags, or Tree-sitter analysis unless the parent supplied
that packet or the available tool output directly proves it. If a parent-supplied
remote code-search hit is useful, the agent should label it as a discovery hint
until repo-local evidence confirms it.

The agent must not imply it fetched official docs itself. If the parent asks
for official-doc comparison without an external evidence packet, the agent
should mark the claim unverified and ask the parent for confirmation or
supplied evidence. The parent command owns synthesis, evidence acceptance, user
gates, normalization, checkpointing, final artifact persistence, state updates,
and routing.

## No-Subagent Fallback

Make parent-only fallback visible before dispatch. The parent should say once
whether `workflow.subagents` is disabled, no suitable `blueprint-researcher` is
available, the strand does not justify sidecar work, or a sidecar failed or
timed out. The fallback remains the required complete path, not a degraded
emergency path.

If no suitable subagent is available, the parent command must still complete
the workflow without lowering output quality. Use the same parent-owned research
strand ledger; only the evidence gathering happens inline:

1. Build a compact carry-forward packet: phase boundary, requirement mapping,
   saved context decisions, codebase bundle status, existing research posture,
   initial assessment, navigation evidence packet, and current open questions.
2. Select one runnable ledger strand from `context-lock`, `repo-map`,
   `stack-and-dependencies`, `architecture-integration`,
   `validation-and-tests`, `risks-and-pitfalls`, `external-delta`, or
   `planner-handoff`.
3. Follow the repository evidence ladder for that strand: saved context,
   existing research, saved codebase summaries, compact anchors, `rg --files`
   plus path filters, scoped content searches, optional parent-supplied
   navigation packets, then targeted file/test/contract/runtime reads. Use
   official or supplied references only for claims the repo cannot settle, and
   only when the `research.external_sources` policy allows them.
4. Record the strand search note before synthesis: query or navigation method,
   scope filter, candidate files or symbols, files actually read, failed/noisy
   or no-hit searches, and stop or widen reason.
5. Append or revise the normalized research draft section-by-section against
   the canonical template.
6. Compress the completed strand into the carry-forward packet.
7. Re-check research status or checkpoint state between strands when the run is
   long enough that persistence could have changed.
8. Persist a structured checkpoint if the run pauses or evidence remains
   inconclusive before the artifact is ready.

This fallback is the required single-agent path, not a degraded emergency mode.

## Source-Support Self-Check

Before calling `blueprint_phase_artifact_write`, run this deterministic self-check over the final normalized draft:

1. Every planner-critical claim in the Claim Support Ledger cites at least one `EVID-*` row that resolves to an existing `SRC-*` Source Register row, directly cites an existing `SRC-*` row, or is explicitly marked `not_enough_evidence` or `out_of_scope`.
2. Every Source Register row is used by at least one claim or is clearly labeled as background or `do not use as support`.
3. Every external Source Register row with a URL or DOI has an `Accessed` value in `YYYY-MM-DD` form unless it is a supplied unchecked source that is not used as current evidence.
4. Every `repo_runtime` claim cites at least one repo-lane source before using external practice evidence.
5. Every `repo_runtime` claim cites a runtime-adequate source role when the claim is about command behavior or persistence: command manifest, skill contract, runtime contract, artifact contract, MCP handler, test, built entrypoint, or saved Blueprint artifact. Search hits, summaries, and external docs alone are partial retrieval.
6. Every Recommendation Handoff row cites supporting claim IDs or evidence IDs, affected surfaces, and tests/checks, or is marked `blocked` by a named open question.
7. `**Confidence:** HIGH` is allowed only when planner-critical claims are directly supported or bounded inferred support, no high-impact recommendation has unresolved blockers, and the artifact does not contain unsupported, contradicted, conflicting, unchecked, or unverified planner-critical claims.

These checks prove traceability shape and planner handoff completeness. They do not prove semantic citation precision; if semantic support is uncertain, lower confidence, add an open question, or use a later optional advisory review.

Warning diagnostic codes introduced by this slice:

- `research.external_source_missing_access_date`
- `research.source_id_missing`
- `research.source_id_missing_from_register`
- `research.evidence_id_missing_from_sources`
- `research.evidence_missing_source_register_link`
- `research.claim_missing_evidence`
- `research.repo_runtime_claim_missing_repo_evidence`
- `research.repo_runtime_claim_retrieval_partial`
- `research.source_id_orphaned`
- `research.recommendation_missing_evidence`
- `research.recommendation_claim_id_missing_from_ledger`
- `research.recommendation_missing_affected_surfaces`
- `research.recommendation_missing_validation_signal`
- `research.recommendation_handoff_missing`
- `research.live_external_claim_without_evidence`
- `research.high_confidence_unsupported`

If the self-check fails but the legacy artifact structure is otherwise valid, lower confidence, add or update `## Open Questions`, and expect MCP validation to return research evidence warning diagnostics rather than a strict invalid result.

## Retry And Repair Behavior

- If phase resolution fails, stop with the tool reason and recovery guidance.
- If existing research is present, default to reuse unless the user chooses
  view or update, but only when the saved research is already valid. Treat an
  explicit `update` selection as the overwrite gate; do not default overwrite
  or ask for a second confirmation unless the user's intent remains ambiguous.
- If `research.external_sources` is `off`, do not perform live external lookup.
  Keep the run repo-only, narrate the repo-only constraint once, and avoid
  implying that upstream guidance was checked.
- If `research.external_sources` is `ask`, use the external-source confirmation
  gate before any official-doc or external verification. `accept` gathers the
  named evidence, `decline` continues with explicit unchecked uncertainty, and
  `cancel` stops with a research-owned checkpoint when the blocked evidence
  matters.
- If existing research is invalid, do not allow skip, default reuse, or an
  unchanged invalid write result to count as successful completion. Surface the
  validation issues, repair the artifact, or stop with the blocker.
- If a research checkpoint exists and `safeToResume=true`, resume by default
  unless the user explicitly asks to discard it. Show a compact recap of
  completed strands, blocked strands, pending gate, warnings, and next action
  before doing more work.
- If the user explicitly asks to discard a safe research checkpoint, delete it
  only through `blueprint_phase_checkpoint_delete` with
  `expectedOwnerCommand: "/blu-research-phase"` and `expectedMode: "research"`.
  Start fresh only if deletion succeeds.
- If a checkpoint exists but `safeToResume=false`, do not resume, overwrite, or
  delete it by default. Report `ownerCommand`, `resumeMode`, warnings, and the
  next safe implemented action.
- If evidence conflicts or a critical claim cannot be verified, lower
  confidence, preserve the conflict in `## Open Questions`, and checkpoint when
  the uncertainty blocks a planner-grade recommendation.
- If claim-addressable provenance is missing for planner-critical claims, prefer a warning,
  lower confidence, or an explicit `not_enough_evidence` row before hard-failing
  older valid artifacts. Do not convert source-register omissions into strict
  MCP validation blockers unless the validator already enforces them.
- If `blueprint_phase_artifact_write` returns `status: "invalid"`, repair the
  same normalized draft using the returned validation issues and retry before
  treating the command as complete.
- If repair cannot be completed safely, leave or refresh the checkpoint and
  report the exact validation blocker plus the next safe continuation action.
- Delete the checkpoint only after final research writes successfully, synced
  `STATE.md` update succeeds, refreshed state load succeeds, and
  implemented-command routing has been checked. If any post-write routing step
  fails, keep or refresh the research checkpoint with the exact failure.
- After a successful research write or a valid `view`/`skip`/`reuse` exit,
  sync `STATE.md` through `blueprint_state_update` with `base: "synced"` while
  preserving the already resolved selected phase in `patch.currentPhase`
  together with `patch.activeCommand`, then re-load routing through
  `blueprint_state_load` without mutating the research artifact or falling back
  to roadmap-derived phase selection.

## Output Quality Criteria

Research is complete only when the saved artifact is specific, evidence-backed,
and planner-ready:

- requirements are mapped to research support
- the artifact exposes enough investigation trace for planning: relevant saved
  artifacts, repo files or symbols, retrieval modes, key findings,
  implementation questions, and confidence
- non-trivial strands include search notes with query or navigation method,
  scope filter, candidate files or symbols, files read, failed/noisy/no-hit
  searches when relevant, and stop or widen reason
- non-trivial, resumed, blocked, or sidecar-assisted runs have a parent-owned
  strand ledger with `researchLedger.schemaVersion`, strand ids/statuses,
  evidence packet references, stopping reasons, and next action
- checkpoints store accepted packets, source references, draft state, warnings,
  and next action; they do not store child-agent transcripts
- sidecar failures, timeouts, budget exhaustion, and source-policy blocks are
  represented as strand stopping reasons rather than hidden in prose
- repo evidence citations preserve role and method for planner-critical claims
- planner-critical claims have claim IDs, evidence IDs, lane labels, support
  classes, source type, authority tier when applicable, support span, retrieval
  context, provenance, limitations, and downstream-use notes
- `## Sources` includes `Repo Evidence`, `External Sources`, and `Inference Notes`
  when the artifact contains planner-critical claims that depend on those lanes
- inference notes name the evidence IDs they derive from and do not appear as
  direct source citations
- conflicts, missing evidence, stale source risk, inaccessible evidence, and
  external-source policy blocks are represented as limitations, open questions,
  or lower confidence instead of hidden inside confident prose
- planner-critical recommendations have strand handoffs naming affected files
  or modules, validation or test implications, unresolved blockers, evidence
  basis, and confidence
- dependency/tool recommendations include a decision row that compares
  no-new-dependency, existing dependency, standard-library/platform, candidate,
  and custom options
- supply-chain evidence for accepted package/tool choices records version,
  maintenance, vulnerability, license, provenance/signature, transitive
  footprint, install scope, lockfile impact, update posture, residual risk, and
  verification signals, or explicitly marks unavailable signals as unchecked
- custom-code recommendations in areas with mature packages include a
  library-versus-custom rationale and named tests/validation that make the custom
  path safe
- recommendations cite evidence roles appropriate to the claim: definitions or
  references for API usage, tests or validation paths for regression risk, and
  manifests, MCP handlers, contracts, tests, or built/runtime entrypoints for
  runtime behavior
- recommendations are prescriptive rather than exploratory
- don't-hand-roll and anti-pattern sections are concrete
- pitfalls are tied to prevention or validation steps
- code examples or pseudocode are useful, or their omission is justified
- sources include at least one repo path, URL, or cited file reference
- `## State Of The Art` uses clear provenance for freshness-sensitive claims
  when helpful; absence of a date or unchecked marker is not an MCP blocker
- confidence is honest and scoped by topic
- unresolved questions are visible instead of hidden by confident language

## Research Completion Receipt

The final response is a compact receipt, not a duplicate of `XX-RESEARCH.md`.
Detailed citations, alternatives, evidence packets, confidence analysis, and
open questions belong in the artifact.

Use this text shape:

```text
Research result: <created|updated|reused|viewed|checkpointed|blocked>
Phase: <phase number and name>
Artifact: <MCP-returned research path or none>
External sources: external_sources_mode=<off|ask|auto>, user_decision=<not_required|accept|decline|cancel|not_applicable>
Coverage: strands=<count or unknown>, recommendations=<count or unknown>
Blockers: <none or concise blocker>
Checkpoint: <deleted|preserved|refreshed|none>
State and routing: <synced and refreshed|not synced: reason|blocked: reason>
Next safe action: <implemented command or /blu-progress>
```

Use explicit incomplete states:

- `Research checkpointed; no final artifact written.`
- `Research saved with external sources declined; see Confidence Breakdown for unchecked claims.`
- `Research blocked before write; checkpoint preserved for continuation.`

## Completion Criteria

`/blu-research-phase` is complete when:

- the selected phase and artifact paths are resolved through MCP
- existing research was viewed, reused, skipped, updated, or replaced through an
  explicit path, and invalid research never completed through a silent reuse
- the final artifact was normalized to the canonical `phase.research`
  authoring template
- strict MCP write validation passed, or a validation blocker was checkpointed
  and reported
- stale research-owned shared checkpoints were deleted only after final write,
  synced state update, refreshed state load, and implemented-command routing
  receipt succeeded
- `STATE.md` was updated through MCP
- refreshed state and command catalog were used for the next safe action
- the effective `research.external_sources` policy was honored before any
  external verification step
- the final response used the completion receipt shape and did not duplicate
  the saved research artifact

## Phase Context Ownership And Repair Loop

- Blueprint does not create, manage, or repair repo-root `CONTEXT.md`.
- Brownfield mapping writes repo context only to `.blueprint/codebase/*.md`.
- `/blu-research-phase` reads phase context only from `.blueprint/phases/<phase>/<XX>-CONTEXT.md` and must not repair, overwrite, synthesize, or mirror it.
- Missing, invalid, contradictory, or unusable context routes to `/blu-discuss-phase <phase>` with exact diagnostics before any research drafting.
- If research validation returns diagnostics, repair the same normalized research draft once and retry the same MCP write path.
- If the retry returns identical diagnostics, stop, preserve or refresh the research checkpoint, report the exact diagnostics and next safe action, and do not inspect MCP source files as a repair strategy.
