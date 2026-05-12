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
- topic-strand research with checkpoints for pauses or inconclusive evidence
- per-strand planning handoff with recommendation, affected files or modules,
  validation or test implications, unresolved blockers, evidence basis, and
  confidence
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
  ladder, record per-strand search notes and navigation evidence, research one
  topic strand at a time, evaluate dependency/tool choices when they affect a
  recommendation, close each strand with a planning handoff, and keep evidence
  provenance visible.
- `Persist`: scaffold only a missing file, write checkpoints for pauses, and
  write final research through MCP only.
- `Validate`: normalize to the live authoring template, self-check, write in
  strict mode, repair invalid results, and retry when safe.
- `Route`: reload state and recommend only implemented next commands.

During non-trivial runs, keep resolved scope, active stage, pending gate,
execution mode, and next safe action visible through Gemini-native progress
helpers when available, or concise progress recaps when they are not.

## Required MCP Calls

- `blueprint_phase_locate`: selects the phase and supplies authoritative phase
  number, prefix, name, and directory. Stop on `found: false`.
- `blueprint_phase_context`: provides project brief, roadmap boundary,
  requirement mapping, workflow posture, missing artifacts, and saved codebase
  bundle signals. This controls research scope and surfaces the mirrored
  `workflowPosture.research.externalSources` policy view.
- `blueprint_config_get` with `scope: "effective"`: provides the source-of-truth
  `research.external_sources` policy before any official-doc or other external
  verification step. `off` means no live external lookup, `ask` means confirm
  first, and `auto` allows official-doc or external verification when the repo
  cannot settle the claim.
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
  then honor `safeToResume` and `warnings` before using saved state.
- `blueprint_state_load`: grounds workflow posture before and after writes.
- `blueprint_command_catalog`: gates every next-command recommendation.
- `blueprint_artifact_contract_read` with `artifactId: "phase.research"`:
  supplies `contract.authoringTemplate`, required headings, locked markers,
  placeholder signals, and freehand policy. This is the schema authority.
- `blueprint_artifact_scaffold`: reserve this for deliberate placeholder
  creation only. Default drafting should start from
  `contract.authoringTemplate`, and scaffold output is never completed
  research.
- `blueprint_phase_checkpoint_put`: persists inconclusive or paused strand
  state using the structured checkpoint shape with
  `ownerCommand: "/blu-research-phase"` and `resumeMeta.mode: "research"`.
  The MCP tool owns the shared checkpoint path; do not assume the filename is
  research-specific.
- `blueprint_phase_artifact_write`: persists final research with the resolved
  numeric `phase`, `artifact: "research"`, full markdown body, and strict
  validation unless the user explicitly accepts a warned save.
- `blueprint_phase_checkpoint_delete`: removes stale continuation state after a
  successful final research write. Pass
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
- Each planner-critical recommendation should be traceable to a strand handoff
  that names affected files or modules, validation or test implications,
  unresolved blockers, evidence basis, and confidence.
- `## Sources` separates repo evidence, official or supplied external
  references, and inference. Do not blend these source classes. For
  planner-critical repo evidence, prefer this concise shape:
  `Repo evidence: path/to/file.ts:123, symbol/heading=<name>, role=definition|reference|test|config|contract|runtime|example|background, method=repo-map|rg|manual-read|parent-navigation-packet|LSP|SCIP|ctags|tree-sitter, supports=<claim or recommendation>`.
  External references should keep URL/title and access date separately from repo
  evidence. Inference should name the evidence it derives from rather than
  masquerading as a source.

Every non-repo factual claim should carry provenance in nearby prose or the
source list. Use labels such as `Repo evidence`, `Official reference`,
`Supplied reference`, or `Inference` rather than implying external verification
that did not happen.

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
- any external evidence packet the parent already gathered or the user already
  supplied, with source title, date, URL, excerpt, claim, and evidence class
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
answer, source classes, paths or URLs, source roles, search notes, confidence,
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

If no suitable subagent is available, the parent command must still complete
the workflow without lowering output quality:

1. Build a compact carry-forward packet: phase boundary, requirement mapping,
   saved context decisions, codebase bundle status, existing research posture,
   initial assessment, navigation evidence packet, and current open questions.
2. Select one topic strand, such as stack, architecture, dependency/runtime
   availability, validation/testing impact, risk/pitfalls, sources, or a
   specific implementation question from the initial assessment.
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

## Retry And Repair Behavior

- If phase resolution fails, stop with the tool reason and recovery guidance.
- If existing research is present, default to reuse unless the user chooses
  view or update, but only when the saved research is already valid. Treat an
  explicit `update` selection as the overwrite gate; do not default overwrite
  or ask for a second confirmation unless the user's intent remains ambiguous.
- If `research.external_sources` is `off`, do not perform live external lookup.
  Keep the run repo-only and avoid implying that upstream guidance was checked.
- If `research.external_sources` is `ask`, stop for confirmation before any
  official-doc or external verification.
- If existing research is invalid, do not allow skip, default reuse, or an
  unchanged invalid write result to count as successful completion. Surface the
  validation issues, repair the artifact, or stop with the blocker.
- If a checkpoint exists, resume by default unless the user explicitly discards
  it.
- If evidence conflicts or a critical claim cannot be verified, lower
  confidence, preserve the conflict in `## Open Questions`, and checkpoint when
  the uncertainty blocks a planner-grade recommendation.
- If `blueprint_phase_artifact_write` returns `status: "invalid"`, repair the
  same normalized draft using the returned validation issues and retry before
  treating the command as complete.
- If repair cannot be completed safely, leave or refresh the checkpoint and
  report the exact validation blocker plus the next safe continuation action.
- Delete the checkpoint only after final research writes successfully.
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
- repo evidence citations preserve role and method for planner-critical claims
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

## Completion Criteria

`/blu-research-phase` is complete when:

- the selected phase and artifact paths are resolved through MCP
- existing research was viewed, reused, skipped, updated, or replaced through an
  explicit path, and invalid research never completed through a silent reuse
- the final artifact was normalized to the canonical `phase.research`
  authoring template
- strict MCP write validation passed, or a validation blocker was checkpointed
  and reported
- stale research-owned shared checkpoints were deleted after success
- `STATE.md` was updated through MCP
- refreshed state and command catalog were used for the next safe action
- the effective `research.external_sources` policy was honored before any
  external verification step

## Phase Context Ownership And Repair Loop

- Blueprint does not create, manage, or repair repo-root `CONTEXT.md`.
- Brownfield mapping writes repo context only to `.blueprint/codebase/*.md`.
- `/blu-research-phase` reads phase context only from `.blueprint/phases/<phase>/<XX>-CONTEXT.md` and must not repair, overwrite, synthesize, or mirror it.
- Missing, invalid, contradictory, or unusable context routes to `/blu-discuss-phase <phase>` with exact diagnostics before any research drafting.
- If research validation returns diagnostics, repair the same normalized research draft once and retry the same MCP write path.
- If the retry returns identical diagnostics, stop, preserve or refresh the research checkpoint, report the exact diagnostics and next safe action, and do not inspect MCP source files as a repair strategy.
