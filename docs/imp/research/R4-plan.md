# R4 Plan: Evidence Quality, Citations, And Provenance For `/blu-research-phase`

**Planner:** Codex
**Created:** 2026-05-12
**Source section:** `docs/imp/research/research-phase-frontier-research-and-improvement-plan.md` -> `### R4. Evidence Quality, Citations, And Provenance`
**Scope:** research-phase only. This plan assumes R1, R2, and R3 are already implemented.

## R4 Interpretation

R4 is not a new research engine. It is a provenance hardening pass for the existing `/blu-research-phase` flow:

- Treat planner-critical research evidence as a claim graph, not a flat bibliography.
- Preserve three evidence lanes: `repo`, `external`, and `inference`.
- Assign stable evidence and claim IDs before final prose synthesis.
- Classify every planner-critical claim with one of:
  `directly_supported`, `partially_supported`, `inferred_from_supported`,
  `contradicted`, `conflicting_sources`, `not_enough_evidence`, or `out_of_scope`.
- Record source type, authority tier, support span, retrieval context, provenance, limitations, and downstream use.
- Make `## Sources` split into `Repo Evidence`, `External Sources`, and `Inference Notes`.
- Keep repo evidence dominant for Blueprint runtime claims.
- Keep older valid research artifacts compatible by making the first validator pass warning-only for R4 structure.

## Non-Goals

Do not implement R5 sidecar overhaul, R6 Plan Input Queue, R7 full anti-hallucination validation, or R8 UX changes in this slice.

Do not add new MCP tools.

Do not change the `/blu-research-phase` MCP tool allowlist.

Do not change `research.external_sources` values or defaults.

Do not make web access mandatory for repo-only research.

Do not make R4 source/claim IDs a hard validation blocker in the first implementation. Add warnings first.

Do not update `agents/blueprint-project-researcher.md` for this R4 slice. It was read for boundary awareness, but it serves `/blu-new-project`, not `/blu-research-phase`.

## Current Baseline To Preserve

The current post-R1/R2/R3 baseline already includes:

- command-local repo investigation trace guidance in `commands/blu-research-phase.toml`
- repository evidence ladder and navigation packets in `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
- dependency/tool evaluation tables in `src/mcp/artifact-contracts/index.ts`
- warning-only dependency/tool validation in `src/mcp/tools/artifacts.ts`
- `blueprint-researcher` bounded sidecar behavior
- tests proving scaffold/template shape, R2 source role/method rows, R3 dependency rows, source evidence rejection, and sidecar boundary language

R4 must add provenance detail without removing those behaviors.

## Implementation Order

1. Update behavior contracts and docs first.
2. Update `phase.research` authoring template and placeholder signals.
3. Add R4 warning-only validator helpers.
4. Update focused tests and fixtures.
5. Run focused tests.
6. Rebuild tracked `dist/` because runtime TypeScript and command metadata change.
7. Run typecheck and focused tests again after build.

## Exact File Plan

### 1. `commands/blu-research-phase.toml`

Purpose: keep the manifest thin but make R4 a command-local gate.

Add one bullet after the current external-source policy bullet that starts with `Read mcp_blueprint_blueprint_config_get`.

Insert this exact bullet:

```text
- Before final synthesis, build a concise R4 provenance packet for planner-critical claims: assign evidence IDs and claim IDs, separate `repo`, `external`, and `inference` lanes, classify support as `directly_supported`, `partially_supported`, `inferred_from_supported`, `contradicted`, `conflicting_sources`, `not_enough_evidence`, or `out_of_scope`, and make `## Sources` split repo evidence, external sources, and inference notes instead of mixing them in one bibliography.
```

Do not inline the full evidence packet schema in the manifest.

Do not alter the `Response requirements` tool list.

### 2. `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`

Purpose: make this the richest R4 behavior authority.

#### 2.1 Parity Target

In `## Parity Target`, add these bullets after the existing bullet:

```text
- clear distinction between repo evidence, official or supplied external
  references, and inference
```

Add this block:

```text
- R4 claim-addressable provenance: planner-critical claims get evidence IDs,
  claim IDs, lane labels (`repo`, `external`, or `inference`), source type,
  authority tier, support class, support span, retrieval context, provenance,
  limitations, and downstream-use notes before final prose synthesis
- final `## Sources` is split into `Repo Evidence`, `External Sources`, and
  `Inference Notes`; inference notes reference evidence IDs they combine instead
  of masquerading as citations
```

#### 2.2 Shared Stage Mapping

In the `Execute` stage bullet, after `keep evidence provenance visible`, append:

```text
, and construct the R4 claim/evidence packet before writing final recommendations
```

Keep the rest of the stage list unchanged.

#### 2.3 Artifact Authoring Rules

Replace the existing `## Sources` quality-rule bullet block with the following. The block currently starts with:

```text
- `## Sources` separates repo evidence, official or supplied external
  references, and inference.
```

Replace that full bullet and its continuation through:

```text
  masquerading as a source.
```

with:

```text
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
```

#### 2.4 New R4 Section

Add this full section immediately before `## Investigation Trace And Navigation Evidence`:

````md
## R4 Evidence Quality, Citations, And Provenance

Treat evidence as a parent-owned claim graph, not as a bibliography assembled
after writing prose. Build the evidence packet before final synthesis, then cite
evidence IDs or claim IDs from the packet while drafting `XX-RESEARCH.md`.

Use this packet shape in prose, tables, or parent-side working notes:

```text
evidence_id: E-R4-001
lane: repo | external | inference
claim_id: C-R4-001
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

### Repo Evidence

| Evidence ID | Claim ID | Source Ref | Role | Retrieval Context | Support Span | Claim Class | Downstream Use | Limitations |
|-------------|----------|------------|------|-------------------|--------------|-------------|----------------|-------------|
| E-R4-001 | C-R4-001 | src/example.ts:42 | runtime | scoped-rg + targeted-read | function behavior observed locally | directly_supported | REC-001 | local checkout only |

### External Sources

| Evidence ID | Claim ID | Source Type | Authority Tier | Source Title | Source Ref | Accessed | Support Span | Claim Class | Retrieval Context | Limitations | Downstream Use |
|-------------|----------|-------------|----------------|--------------|------------|----------|--------------|-------------|-------------------|-------------|----------------|
| E-R4-002 | C-R4-002 | official_product_doc | official_vendor_doc | <title> | https://example.com/docs | 2026-05-12 | <section or excerpt summary> | directly_supported | parent-approved external check | may drift | REC-001 |

### Inference Notes

| Evidence ID | Claim ID | Derived From | Claim Class | Derivation / Attribution | Limitations | Downstream Use |
|-------------|----------|--------------|-------------|--------------------------|-------------|----------------|
| E-R4-003 | C-R4-003 | E-R4-001, E-R4-002 | inferred_from_supported | Repo behavior plus official guidance suggest this planner-safe improvement. | verify during planning | REC-001 |

### Supply Chain Evidence

- Supply-chain evidence remains allowed when R3 dependency/tool rows need it, but
  it should reference the relevant R4 evidence IDs or dependency decision IDs.
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
````

#### 2.5 Capability-Gated Subagent Path

In `When used, pass the agent:`, replace the bullet:

```text
- any external evidence packet the parent already gathered or the user already
  supplied, with source title, date, URL, excerpt, claim, and evidence class
```

with:

```text
- any parent-gathered or user-supplied R4 evidence packet, including evidence ID,
  lane, claim ID, claim text, support class, source type, authority tier,
  source reference, source title, access date when external, support span,
  retrieval context, provenance, limitations, and downstream use
```

Replace the response expectation paragraph:

```text
The response should include the strand/question, concise
answer, source classes, paths or URLs, source roles, search notes, confidence,
failed/noisy/no-hit or limited searches, unanswered questions, and a planning
handoff.
```

with:

```text
The response should include the strand/question, concise answer, R4 evidence
packet rows for any planner-critical claims, source classes, paths or URLs,
source roles, search notes, support classes, confidence, failed/noisy/no-hit or
limited searches, unanswered questions, and a planning handoff.
```

#### 2.6 Retry And Repair Behavior

Add this bullet after the current bullet:

```text
- If evidence conflicts or a critical claim cannot be verified, lower
  confidence, preserve the conflict in `## Open Questions`, and checkpoint when
  the uncertainty blocks a planner-grade recommendation.
```

Add this new bullet:

```text
- If R4 provenance is missing for planner-critical claims, prefer a warning,
  lower confidence, or an explicit `not_enough_evidence` row before hard-failing
  older valid artifacts. Do not convert R4 source-register omissions into strict
  MCP validation blockers in the first implementation slice.
```

#### 2.7 Output Quality Criteria

Add these bullets after:

```text
- repo evidence citations preserve role and method for planner-critical claims
```

Add:

```text
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
```

### 3. `skills/blueprint-phase-discovery/SKILL.md`

Purpose: keep shared skill concise while pointing `/blu-research-phase` at R4.

In the `### research-phase` numbered list, update item 5.

Current item starts:

```text
Honor `research.external_sources` before any external verification step...
```

Replace item 5 with:

```text
5. Honor `research.external_sources` before any external verification step:
   `off` stays repo-only, `ask` stops for confirmation, and `auto` allows
   official-doc or external verification only when repo evidence cannot settle
   the claim. Keep repo-derived evidence distinct from external evidence, avoid
   implying live verification happened when it did not, and use the runtime
   contract's R4 provenance rules for planner-critical claims: evidence IDs,
   claim IDs, lane labels, support classes, source type, authority tier, support
   span, retrieval context, limitations, and split `## Sources` sections for repo
   evidence, external sources, and inference notes.
```

In item 7, replace:

```text
The parent must supply any external evidence packet itself, with source title, date, URL, excerpt, claim, and whether it is an official reference or supplied reference.
```

with:

```text
The parent must supply any external or R4 evidence packet itself, with evidence ID, lane, claim ID, claim text, support class, source type, authority tier, source reference, source title, access date when external, support span, retrieval context, provenance, limitations, and downstream use.
```

In `## Completion Self-Check`, add this bullet after the validation/repair bullet:

```text
- For `/blu-research-phase`, planner-critical claims used R4 provenance where
  available: claim/evidence IDs, repo/external/inference lanes, support class,
  source type, authority tier, support span, retrieval context, limitations, and
  split source sections. Missing R4 provenance in an otherwise valid older
  artifact was treated as warning-level unless the MCP validator made it strict.
```

### 4. `agents/blueprint-researcher.md`

Purpose: make sidecar outputs compatible with R4 evidence packets while preserving parent ownership.

#### 4.1 Purpose

After:

```text
Artifact-grade mode supports comparing repo evidence against parent-supplied official-doc or external evidence packets with clear provenance.
```

Add:

```text
For R4 provenance work, artifact-grade mode returns claim-addressable evidence
rows that the parent can accept, reject, or synthesize; it does not decide final
artifact confidence on its own.
```

#### 4.2 Required Reads

Replace:

```text
- parent-supplied official-doc or external evidence packets when the parent
  asks for comparisons, validation, or citation-backed deltas
```

with:

```text
- parent-supplied official-doc, external, supplied-reference, or R4 evidence
  packets when the parent asks for comparisons, validation, or citation-backed
  deltas. Preserve evidence ID, lane, claim ID, claim text, support class,
  source type, authority tier, source reference, source title, access date,
  support span, retrieval context, provenance, limitations, and downstream use.
```

#### 4.3 External Research And Self-Correction Rules

Replace rule 3 with:

```text
3. This agent does not fetch official docs itself. If the parent asks for an
   official-doc comparison without supplying an R4 evidence packet with evidence
   ID, lane, claim ID, source title, date or access date, URL or source ref,
   support span or excerpt/summary, support class, and limitations, return the
   claim as `not_enough_evidence` and ask the parent for confirmation or evidence
   instead of improvising a citation.
```

#### 4.4 Source Hierarchy

Replace item 3:

```text
3. parent-supplied official-doc or explicitly supplied external references,
   with provenance captured at the claim level
```

with:

```text
3. parent-supplied official-doc or explicitly supplied external references, with
   R4 provenance captured at the claim level
```

#### 4.5 Required Output Contract

Replace the `Findings` support-status bullet:

```text
- Include a `Findings` list. Each finding must name support status:
  `supported`, `partially-supported`, `conflict`, `unverified`, or
  `inference`.
```

with:

```text
- Include a `Findings` list. Each finding must name one R4 support class:
  `directly_supported`, `partially_supported`, `inferred_from_supported`,
  `contradicted`, `conflicting_sources`, `not_enough_evidence`, or
  `out_of_scope`.
```

Add this block after the `External Sources` bullet:

```text
- Include `Evidence Packet Rows` for planner-critical claims when artifact-grade
  mode is used. Each row must include evidence ID, lane (`repo`, `external`, or
  `inference`), claim ID, claim text, support class, source type, authority tier,
  source ref, source title when external, access date when external, support
  span, retrieval context, provenance, limitations, and downstream use.
```

Replace:

```text
- Keep citations, provenance, and repo-path evidence explicit enough for the
  parent to copy into `## Sources` or optional `## Investigation Trace`.
```

with:

```text
- Keep citations, provenance, repo-path evidence, and R4 evidence packet rows
  explicit enough for the parent to copy into `## Sources` or optional
  `## Investigation Trace`.
```

#### 4.6 Output Quality Expectations

Replace:

```text
- Use source labels near claims or in `## Sources`: `Repo evidence`, `Official
  reference`, `Supplied reference`, or `Inference`. Never present inference or
  stale training knowledge as verified fact.
```

with:

```text
- Use R4 source labels near claims or in `## Sources`: `Repo Evidence`,
  `External Sources`, and `Inference Notes`. Never present inference or stale
  training knowledge as verified fact.
```

#### 4.7 Boundaries

Add:

```text
- Do not invent evidence IDs, claim IDs, access dates, support spans, source
  authority tiers, or retrieval methods for external evidence the parent did not
  supply or approve.
```

### 5. `agents/blueprint-project-researcher.md`

No changes.

Rationale: R4 is scoped to `/blu-research-phase`. `blueprint-project-researcher`
is a bootstrap-context specialist for `/blu-new-project`, and changing it would
broaden the slice outside the user's requested research-phase-only scope.

### 6. `src/mcp/artifact-contracts/index.ts`

Purpose: enrich the canonical `phase.research` authoring template with R4 source structure while preserving required headings.

#### 6.1 `renderResearchTemplate`

Replace the current `## Sources` block at the end of `renderResearchTemplate`.

Current block starts:

```md
## Sources

### Repo Evidence
```

and ends with:

```md
- Supply-chain evidence: <source title or command>, <URL or repo path>, accessed/observed <YYYY-MM-DD>, signal=<version|maintenance|vulnerability|license|provenance|transitive|update>, supports=DEP-001; source policy=<off|ask-approved|auto|supplied|unchecked>.
```

Replace it with:

```md
## Sources

### Repo Evidence

| Evidence ID | Claim ID | Source Ref | Role | Retrieval Context | Support Span | Claim Class | Downstream Use | Limitations |
|-------------|----------|------------|------|-------------------|--------------|-------------|----------------|-------------|
| E-R4-001 | C-R4-001 | <repo path:line, command, test output, manifest, contract, or saved Blueprint artifact> | <definition, reference, test, config, contract, runtime, example, or background> | <repo-map, rg-files, scoped-rg, manual-read, parent-navigation-packet, LSP, SCIP, ctags, tree-sitter, or command> | <quoted line, line range, command summary, or extracted fact> | directly_supported|partially_supported|contradicted|conflicting_sources|not_enough_evidence|out_of_scope | <claim, recommendation, or do not use as support> | <limits or none> |

### External Sources

| Evidence ID | Claim ID | Source Type | Authority Tier | Source Title | Source Ref | Accessed | Support Span | Claim Class | Retrieval Context | Limitations | Downstream Use |
|-------------|----------|-------------|----------------|--------------|------------|----------|--------------|-------------|-------------------|-------------|----------------|
| E-R4-002 | C-R4-002 | <official_standard, official_product_doc, peer_reviewed_paper, preprint, supplied_reference, or web_page> | <official_standard, official_vendor_doc, peer_reviewed, maintained_project_doc, preprint, secondary, or unknown> | <exact title> | <URL, DOI, or supplied source label> | <YYYY-MM-DD or supplied-unchecked> | <section, page, excerpt, or extracted fact> | directly_supported|partially_supported|contradicted|conflicting_sources|not_enough_evidence|out_of_scope | <parent-approved external check or user-supplied source> | <stale risk, inaccessible text, supplied-only, conflict, or none> | <claim, recommendation, or do not use as support> |

### Inference Notes

| Evidence ID | Claim ID | Derived From | Claim Class | Derivation / Attribution | Limitations | Downstream Use |
|-------------|----------|--------------|-------------|--------------------------|-------------|----------------|
| E-R4-003 | C-R4-003 | <E-R4-001, E-R4-002> | inferred_from_supported|conflicting_sources|not_enough_evidence|out_of_scope | <bounded inference that follows from cited evidence IDs> | <limits or none> | <claim, recommendation, or do not use as support> |

### Supply Chain Evidence

- Supply-chain evidence: <source title or command>, <URL or repo path>, accessed/observed <YYYY-MM-DD>, signal=<version|maintenance|vulnerability|license|provenance|transitive|update>, supports=DEP-001 or E-R4-002; source policy=<off|ask-approved|auto|supplied|unchecked>.
```

Notes:

- Keep `### Supply Chain Evidence` for R3 compatibility.
- Rename `### External References` to `### External Sources`.
- Add `### Inference Notes`.
- Keep the top-level `## Sources` heading unchanged.

#### 6.2 `placeholderSignals`

Add placeholder signals for every new angle-bracket token introduced above.

Add these exact strings near the other research placeholder signals:

```ts
"<repo path:line, command, test output, manifest, contract, or saved Blueprint artifact>",
"<quoted line, line range, command summary, or extracted fact>",
"<claim, recommendation, or do not use as support>",
"<official_standard, official_product_doc, peer_reviewed_paper, preprint, supplied_reference, or web_page>",
"<official_standard, official_vendor_doc, peer_reviewed, maintained_project_doc, preprint, secondary, or unknown>",
"<exact title>",
"<URL, DOI, or supplied source label>",
"<YYYY-MM-DD or supplied-unchecked>",
"<section, page, excerpt, or extracted fact>",
"<parent-approved external check or user-supplied source>",
"<stale risk, inaccessible text, supplied-only, conflict, or none>",
"<E-R4-001, E-R4-002>",
"<bounded inference that follows from cited evidence IDs>",
```

Do not remove existing placeholder signals unless the exact placeholder text is removed from the template.

#### 6.3 Contract Notes

In the `phase.research` contract `notes` array, add one sentence:

```text
Planner-critical claims should use R4 claim-addressable provenance with evidence IDs, claim IDs, repo/external/inference lanes, support classes, source type, authority tier, support span, retrieval context, limitations, and downstream-use notes; first-pass validation warns instead of rejecting older valid artifacts that lack this richer source register.
```

### 7. `src/mcp/tools/artifacts.ts`

Purpose: add warning-only R4 quality checks.

Do not add strict `issues` for R4 in this slice unless the artifact already fails an existing required-heading/source-evidence rule.

#### 7.1 Add helper functions

Insert these helpers near the existing research validation helpers, after `hasSupplyChainEvidenceSource`.

```ts
function sourceLinesWithUrlsMissingAccessDate(sources: string): string[] {
  return sources
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /https?:\/\/|doi\.org\//i.test(line))
    .filter((line) => !/(?:\baccessed\s+|\|\s*)\d{4}-\d{2}-\d{2}\b/i.test(line));
}

function hasR4SourceSections(sources: string): boolean {
  return (
    /### Repo Evidence/i.test(sources) &&
    /### External Sources/i.test(sources) &&
    /### Inference Notes/i.test(sources)
  );
}

function hasClaimAddressableR4Evidence(sources: string): boolean {
  return (
    /\b(?:Evidence ID|evidence_id)\b/i.test(sources) &&
    /\b(?:Claim ID|claim_id)\b/i.test(sources) &&
    /\b(?:directly_supported|partially_supported|inferred_from_supported|contradicted|conflicting_sources|not_enough_evidence|out_of_scope)\b/i.test(
      sources
    )
  );
}

function usesLiveVerificationLanguageWithoutExternalEvidence(content: string): boolean {
  const claimText = [
    extractMarkdownSection(content, "Summary"),
    extractMarkdownSection(content, "State Of The Art"),
    extractMarkdownSection(content, "Recommendations")
  ].join("\n");

  if (
    !/\b(?:latest|current official|official docs confirm|upstream confirms|current upstream|live external verification)\b/i.test(
      claimText
    )
  ) {
    return false;
  }

  const sources = extractMarkdownSection(content, "Sources");
  return !/### External Sources/i.test(sources) || !/\baccessed\s+\d{4}-\d{2}-\d{2}\b/i.test(sources);
}

function hasHighConfidenceWithUnsupportedR4Claims(content: string): boolean {
  const highConfidence =
    /^\*\*Confidence:\*\*\s*HIGH\s*$/m.test(content) ||
    /\|\s*[^|\n]+\s*\|\s*HIGH\s*\|/i.test(extractMarkdownSection(content, "Confidence Breakdown"));

  return (
    highConfidence &&
    /\b(?:not_enough_evidence|contradicted|conflicting_sources|unchecked|unverified)\b/i.test(content)
  );
}
```

#### 7.2 Add warning checks inside `validateResearchArtifactContent`

After the current `sources` validation block:

```ts
const sources = extractMarkdownSection(content, "Sources");

if (!/^- /m.test(sources) || !containsSourceEvidence(sources)) {
  issues.push(
    "Research artifact must include at least one source bullet with a URL, repo path, or cited file."
  );
}
```

insert:

```ts
const externalSourceLinesMissingAccessDate = sourceLinesWithUrlsMissingAccessDate(sources);

if (externalSourceLinesMissingAccessDate.length > 0) {
  warnings.push(
    "Research artifact external source rows should include `accessed YYYY-MM-DD` for every URL or DOI used as current evidence."
  );
}

if (!hasR4SourceSections(sources)) {
  warnings.push(
    "Research artifact should split ## Sources into ### Repo Evidence, ### External Sources, and ### Inference Notes for R4 provenance."
  );
}

if (!hasClaimAddressableR4Evidence(sources)) {
  warnings.push(
    "Research artifact should use R4 claim-addressable evidence with Evidence ID, Claim ID, and support classes for planner-critical claims."
  );
}

if (usesLiveVerificationLanguageWithoutExternalEvidence(content)) {
  warnings.push(
    "Research artifact appears to use live external verification wording without an External Sources row with an access date; lower confidence or mark the claim unchecked."
  );
}

if (hasHighConfidenceWithUnsupportedR4Claims(content)) {
  warnings.push(
    "Research artifact should not use HIGH confidence while planner-critical claims are contradicted, conflicting, unchecked, unverified, or not enough evidence."
  );
}
```

Keep `diagnostics` mapped only from `issues` for this R4 slice.

### 8. `docs/commands/research-phase.md`

Purpose: mirror concise user-facing R4 behavior.

#### 8.1 Purpose

After:

```text
evidence, and only-when-needed approved external references
```

change to:

```text
evidence, claim-addressable provenance, and only-when-needed approved external references
```

#### 8.2 Behavior Stages

In `Execute`, append:

```text
, then assigns evidence IDs, claim IDs, lane labels, support classes, and limitations before final synthesis
```

#### 8.3 Research Runtime Anchors

Add this bullet after the bullet that starts `Keep repo evidence distinct`:

```text
- For planner-critical claims, use R4 provenance: evidence IDs, claim IDs, repo/external/inference lanes, support class, source type, authority tier, support span, retrieval context, limitations, and downstream use. `## Sources` should split into `Repo Evidence`, `External Sources`, and `Inference Notes`; first-pass MCP validation warns rather than rejects older otherwise-valid artifacts that lack this richer shape.
```

#### 8.4 Acceptance Criteria

Add:

```text
- Planner-critical claims are traceable through R4 evidence IDs or claim IDs when new research is authored, with repo truth dominating Blueprint runtime claims and inference explicitly labeled.
```

#### 8.5 Test Cases

Add:

```text
- R4 evidence provenance fixture with Repo Evidence, External Sources, Inference Notes, Evidence ID, Claim ID, support class, source type, authority tier, access date, support span, retrieval context, limitations, and downstream use.
- Warning fixture for external URL evidence without `accessed YYYY-MM-DD`.
- Warning fixture for `HIGH` confidence research that also contains `not_enough_evidence`, `contradicted`, `conflicting_sources`, `unchecked`, or `unverified`.
```

### 9. `docs/ARTIFACT-SCHEMA.md`

Purpose: keep the artifact schema doc aligned with the template.

In the `XX-RESEARCH.md` canonical template structure list, replace:

```text
- `## Sources` with optional supply-chain evidence rows
```

with:

```text
- `## Sources` split into `Repo Evidence`, `External Sources`, and `Inference Notes`, with optional supply-chain evidence rows
```

In validation expectations, add:

```text
- new planner-critical claims should use R4 provenance where available: evidence IDs, claim IDs, repo/external/inference lanes, support classes, source type, authority tier, support span, retrieval context, limitations, and downstream-use notes
- first-pass R4 provenance checks are warning-level so older otherwise-valid research artifacts do not fail solely because they lack the richer source register
```

Replace the `## Sources` block in the exact persistence template with the same block from section 6.1 above.

Contract notes: keep the statement that `## Investigation Trace` is optional.

### 10. `docs/MCP-TOOLS.md`

Purpose: update the one-line research-phase runtime note without bloating docs.

In the long `research-phase uses ...` bullet, after:

```text
keep repo truth distinct from external verification
```

add:

```text
, build R4 claim-addressable evidence for planner-critical claims with repo/external/inference lanes, support classes, source type, authority tier, support span, retrieval context, limitations, and split `## Sources` sections
```

In the later bullet that starts:

```text
- Research authoring should preserve repository search discipline
```

append:

```text
 New research should also preserve R4 provenance for planner-critical claims; absence of R4 rows in older otherwise-valid research is warning-level unless stricter validation is introduced later.
```

### 11. `docs/RUNTIME-REFERENCE.md`

Purpose: keep public runtime reference aligned.

In the `research-phase` row, add this sentence to the contract-notes cell after the existing sentence about keeping repo truth distinct from external truth:

```text
New research uses R4 claim-addressable provenance for planner-critical claims: evidence IDs, claim IDs, repo/external/inference lanes, support classes, source type, authority tier, support span, retrieval context, limitations, and split `## Sources` sections; first-pass validation warns instead of rejecting older valid research that lacks the richer source register.
```

Do not change tool lists, optional agents, hook involvement, or evidence state.

### 12. `src/mcp/command-runtime-metadata.ts`

Purpose: keep live runtime resource text aligned with docs.

In `RESEARCH_PHASE_RUNTIME_METADATA.runtimeReference.contractNotes`, insert this sentence after the clause:

```text
keep repo-derived evidence distinct from external truth in the finished research
```

Insert:

```text
, build R4 claim-addressable provenance for planner-critical claims with evidence IDs, claim IDs, repo/external/inference lanes, support classes, source type, authority tier, support span, retrieval context, limitations, and split `## Sources` sections
```

Do not change `requiredTools`, `optionalAgents`, or catalog status.

### 13. Tests

#### 13.1 `tests/phase-discovery-research.test.ts`

Update the scaffold test `research scaffold seeds the exact research template shape`.

Add assertions:

```ts
assert.match(scaffold, /### External Sources/);
assert.match(scaffold, /### Inference Notes/);
assert.match(scaffold, /Evidence ID/);
assert.match(scaffold, /Claim ID/);
assert.match(scaffold, /Claim Class/);
assert.match(scaffold, /Source Type/);
assert.match(scaffold, /Authority Tier/);
assert.match(scaffold, /Support Span/);
assert.match(scaffold, /Retrieval Context/);
assert.match(scaffold, /Downstream Use/);
assert.match(scaffold, /directly_supported\|partially_supported\|inferred_from_supported/);
```

Replace the existing assertion:

```ts
assert.match(scaffold, /### External References/);
```

with:

```ts
assert.match(scaffold, /### External Sources/);
```

Keep the `### Supply Chain Evidence` assertion.

Update `validResearchContent` to use the new R4 `## Sources` block while keeping at least one bullet source for existing strict validation.

Use this replacement for its current `## Sources` section:

```md
## Sources

### Repo Evidence

- Repo evidence: `src/mcp/tools/phase.ts:1`, symbol/heading=blueprintPhaseArtifactWrite, role=runtime, method=manual-read, supports=C-R4-001.

| Evidence ID | Claim ID | Source Ref | Role | Retrieval Context | Support Span | Claim Class | Downstream Use | Limitations |
|-------------|----------|------------|------|-------------------|--------------|-------------|----------------|-------------|
| E-R4-001 | C-R4-001 | src/mcp/tools/phase.ts:1 | runtime | manual-read | phase artifact writes route through MCP-owned tooling | directly_supported | Persist validated research content. | local checkout only |

### External Sources

| Evidence ID | Claim ID | Source Type | Authority Tier | Source Title | Source Ref | Accessed | Support Span | Claim Class | Retrieval Context | Limitations | Downstream Use |
|-------------|----------|-------------|----------------|--------------|------------|----------|--------------|-------------|-------------------|-------------|----------------|
| E-R4-002 | C-R4-002 | supplied_reference | unknown | Repo-only fixture | supplied-none | supplied-unchecked | no external lookup used | out_of_scope | source policy off | repo-only fixture | do not use as external support |

### Inference Notes

| Evidence ID | Claim ID | Derived From | Claim Class | Derivation / Attribution | Limitations | Downstream Use |
|-------------|----------|--------------|-------------|--------------------------|-------------|----------------|
| E-R4-003 | C-R4-003 | E-R4-001 | inferred_from_supported | MCP-owned write path implies command should not hand-write research files. | verify in focused tests | Persist through blueprint_phase_artifact_write. |

### Supply Chain Evidence

- Supply-chain evidence: repo-local validator, `src/mcp/tools/artifacts.ts`, accessed/observed 2026-04-11, signal=version, supports=DEP-001; source policy=off.
```

Add a new test after the R2 template acceptance test:

```ts
test("research template accepts R4 claim-addressable provenance", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content: validResearchContent(
      "Create research with R4 claim-addressable provenance and split source lanes."
    ),
    overwrite: true
  });

  assert.equal(written.status, "created");
  assert.equal(written.validation.valid, true, written.validation.issues.join("\n"));
  assert.doesNotMatch(
    written.validation.warnings.join("\n"),
    /split ## Sources|claim-addressable evidence|External Sources row with an access date/i
  );
});
```

Add a warning test:

```ts
test("research validation warns when external URL evidence lacks an access date", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Create research whose external source row omits an access date."
  ).replace(
    "| E-R4-002 | C-R4-002 | supplied_reference | unknown | Repo-only fixture | supplied-none | supplied-unchecked | no external lookup used | out_of_scope | source policy off | repo-only fixture | do not use as external support |",
    "| E-R4-002 | C-R4-002 | official_product_doc | official_vendor_doc | Example docs | https://example.com/docs | unchecked | current behavior | directly_supported | parent-approved external check | may drift | REC-001 |"
  );

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.validation.valid, true, written.validation.issues.join("\n"));
  assert.match(
    written.validation.warnings.join("\n"),
    /external source rows should include `accessed YYYY-MM-DD`/i
  );
});
```

Add a high-confidence warning test:

```ts
test("research validation warns on HIGH confidence with unsupported R4 claims", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Create research that keeps unsupported R4 evidence visible for validation warnings."
  ).replace(
    "| E-R4-002 | C-R4-002 | supplied_reference | unknown | Repo-only fixture | supplied-none | supplied-unchecked | no external lookup used | out_of_scope | source policy off | repo-only fixture | do not use as external support |",
    "| E-R4-002 | C-R4-002 | supplied_reference | unknown | Repo-only fixture | supplied-none | supplied-unchecked | no external lookup used | not_enough_evidence | source policy off | repo-only fixture | do not use as external support |"
  );

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.validation.valid, true, written.validation.issues.join("\n"));
  assert.match(
    written.validation.warnings.join("\n"),
    /should not use HIGH confidence while planner-critical claims are contradicted, conflicting, unchecked, unverified, or not enough evidence/i
  );
});
```

Keep the default `validResearchContent` fixture warning-clean for R4. Use the local `replace(...)` variant above for the unsupported high-confidence warning.

Update the contract-parity assertions in this file to require:

```ts
assert.match(commandFile, /R4 provenance packet/i);
assert.match(runtimeContract, /R4 Evidence Quality, Citations, And Provenance/i);
assert.match(runtimeContract, /directly_supported/);
assert.match(runtimeContract, /not_enough_evidence/);
assert.match(skillFile, /R4 provenance/i);
assert.match(researcherAgent, /Evidence Packet Rows/i);
assert.match(researcherAgent, /authority tier/i);
```

#### 13.2 `tests/agent-contract-specialists.test.ts`

In the `blueprint-researcher` assertions, add:

```ts
assert.match(researcher, /Evidence Packet Rows/i);
assert.match(researcher, /evidence ID/i);
assert.match(researcher, /claim ID/i);
assert.match(researcher, /authority tier/i);
assert.match(researcher, /support span/i);
assert.match(researcher, /directly_supported/i);
assert.match(researcher, /partially_supported/i);
assert.match(researcher, /inferred_from_supported/i);
assert.match(researcher, /not_enough_evidence/i);
assert.match(researcher, /Do not invent evidence IDs/i);
```

Keep all existing R2/R3 assertions.

#### 13.3 `tests/mcp-contract-audit-metadata.test.ts`

Where this test asserts research command docs/runtime parity, add checks that the research command doc and runtime metadata mention:

```ts
assert.match(researchDoc, /R4 provenance/i);
assert.match(researchDoc, /Repo Evidence/);
assert.match(researchDoc, /External Sources/);
assert.match(researchDoc, /Inference Notes/);
assert.match(researchDoc, /warning-level/i);
```

If there is already a runtime metadata string check for `research-phase`, add:

```ts
assert.match(runtimeReference, /claim-addressable provenance/i);
assert.match(runtimeReference, /support classes/i);
```

Do not add broad snapshot-style assertions.

### 14. Validation Commands

Run these from the repo root after implementation:

```bash
npm run typecheck
npm test -- tests/phase-discovery-research.test.ts tests/agent-contract-specialists.test.ts tests/mcp-contract-audit-metadata.test.ts
npm run build
npm test -- tests/phase-discovery-research.test.ts tests/agent-contract-specialists.test.ts tests/mcp-contract-audit-metadata.test.ts
```

If `npm run build` changes tracked `dist/`, commit those files with the source changes.

If `npm ci` has not been run in the current checkout or `node_modules` is missing, run `npm ci` before the commands above.

## Expected Diff Summary

Additive or replacement changes:

- `commands/blu-research-phase.toml`: one thin R4 gate bullet.
- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`: new R4 section, source quality rules, sidecar packet field updates, output-quality additions.
- `skills/blueprint-phase-discovery/SKILL.md`: concise R4 references in research-phase flow and completion self-check.
- `agents/blueprint-researcher.md`: R4 evidence packet output contract and no-invented-provenance boundary.
- `src/mcp/artifact-contracts/index.ts`: richer `## Sources` template and placeholder signals.
- `src/mcp/tools/artifacts.ts`: warning-only R4 validation helpers.
- `docs/commands/research-phase.md`: concise user-facing R4 anchors, acceptance criteria, test cases.
- `docs/ARTIFACT-SCHEMA.md`: canonical template and validation expectations.
- `docs/MCP-TOOLS.md`: concise MCP docs parity.
- `docs/RUNTIME-REFERENCE.md`: runtime reference parity.
- `src/mcp/command-runtime-metadata.ts`: live runtime resource parity.
- `tests/phase-discovery-research.test.ts`: scaffold, valid R4 fixture, warning fixtures, contract text checks.
- `tests/agent-contract-specialists.test.ts`: sidecar R4 assertions.
- `tests/mcp-contract-audit-metadata.test.ts`: doc/runtime parity assertions.
- `dist/`: rebuilt if TypeScript/runtime metadata changes.

Subtractions:

- Rename template subheading `### External References` to `### External Sources`.
- Replace broad sidecar support status words `supported`, `partially-supported`, `conflict`, `unverified`, `inference` in the artifact-grade contract with R4 support classes.
- Do not remove `### Supply Chain Evidence`; keep it as a compatibility subheading for R3.

## Done Criteria

The R4 implementation is done when:

- `/blu-research-phase` runtime contract clearly requires claim-addressable provenance for new planner-critical research claims.
- `phase.research` authoring template exposes `Repo Evidence`, `External Sources`, `Inference Notes`, evidence IDs, claim IDs, support classes, source type, authority tier, support span, retrieval context, limitations, and downstream use.
- `blueprint-researcher` returns R4-compatible evidence rows and still cannot fetch official docs, mutate `.blueprint/`, persist research, checkpoint, sync state, route commands, or invent external verification.
- Research validation warns, but does not hard fail, when R4 provenance is absent or weak in otherwise valid artifacts.
- Existing source-evidence hard failures still reject fake generic code spans.
- Existing R1/R2/R3 tests still pass.
- Tracked `dist/` is rebuilt when runtime source changes.
