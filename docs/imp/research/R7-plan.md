# R7 Implementation Plan: Research Evidence Validation

## Scope

This is an implementation-ready plan for the `/blu-research-phase` improvements described only by the `R7. Evaluation, Validation, And Anti-Hallucination` section in `docs/imp/research/research-phase-frontier-research-and-improvement-plan.md`.

Do not implement source changes while preparing this plan. The implementation itself should make the current evidence discipline enforceable without replacing the existing research engine, without adding model graders in this slice, and without making older otherwise-valid research artifacts fail only because they lack the richer evidence shape. Future advisory model graders remain allowed as a later opt-in layer; this plan implements deterministic traceability checks first.

## Final Product And Runtime Names

Use these names in every source, runtime, skill, agent, test, and non-imp documentation change:

- `Claim Support Ledger`: optional-but-preferred table for planner-critical claims.
- `Source Register`: structured source table under `## Sources`.
- `Recommendation Handoff`: structured recommendation table under `## Recommendations`.
- `Source-Support Self-Check`: parent-command pre-write check over planner-critical claims, recommendations, evidence IDs, source IDs, external access dates, repo-runtime support, and confidence.
- `Research evidence warning diagnostics`: warning-grade validation diagnostics returned with research validation warnings.
- `External Evidence Access-Date Rule`: external URLs or DOI rows used as current evidence need `YYYY-MM-DD` access dates.
- `Repository Runtime Support Rule`: repo-runtime claims should cite repo evidence before external evidence.
- `Retrieval Adequacy Rule`: repo-runtime claims should cite repo artifacts with the right evidence role, such as command manifests, skills, runtime contracts, artifact contracts, MCP handlers, tests, or built entrypoints, rather than only summaries or search hits.
- `Source Policy Honesty Rule`: repo-only output must not claim current official-doc confirmation unless an allowed external evidence packet exists.
- `Sidecar External Evidence Boundary`: `blueprint-researcher` may use parent-supplied external evidence packets, but must not claim it fetched official docs or external sources itself.
- `Confidence Evidence Rule`: `**Confidence:** HIGH` is incompatible with unsupported, contradicted, conflicting, unchecked, or unverified planner-critical claims.

The `Claim Type` taxonomy is intentionally small and R7-scoped: `repo_runtime`, `external_practice`, `dependency_tool`, `inference`, and `open_question` map directly to R7's required split between repository behavior, external practice, tool/dependency claims, bounded synthesis, and explicit uncertainty. Do not add more claim types in this slice.

This plan introduces no R6 concept as a runtime concept. Do not use any R6 label, rollout label, or plan-internal codename in product-facing or runtime-facing files.

## Intended End State

- `/blu-research-phase` still produces the same canonical `XX-RESEARCH.md` artifact and uses the same MCP persistence path.
- Existing required headings stay required. New evidence tables are added inside the existing artifact shape and through optional top-level guidance, not by making a new artifact type.
- Strict validation remains backward-compatible. Older artifacts can still be valid when they satisfy the current structural contract.
- New R7 checks are warning-grade first. They add deterministic warnings plus dedicated diagnostic codes for access dates, missing source IDs, missing evidence chains, orphan source IDs, repo-runtime claims supported only by external evidence, repo-runtime claims with partial retrieval, source-policy honesty drift, unsupported high confidence, weak recommendation handoffs, and sidecar external-evidence boundary drift.
- Deterministic validation checks traceability shape, not semantic entailment. It can verify IDs, lanes, source classes, access dates, retrieval context, source/evidence chains, and handoff fields. It cannot prove that a cited source semantically supports a claim; that remains a human or future optional advisory grader concern.
- The command, skill, runtime contract, and `blueprint-researcher` agent all name the Source-Support Self-Check explicitly.
- Tests pin both compatibility and the new anti-hallucination warnings.

## File Plan

### `commands/blu-research-phase.toml`

#### Subtractions

None.

#### Additions/Replacements

Add this command-local gate immediately after the existing gate that starts `Before final synthesis, build a concise claim-addressable provenance packet`:

```toml
- Before `mcp_blueprint_blueprint_phase_artifact_write`, run a Source-Support Self-Check over planner-critical claims and recommendations. Ensure each Claim Support Ledger row cites at least one `EVID-*` row that resolves to an existing `SRC-*` Source Register row, or directly cites an existing `SRC-*` row, or is marked `not_enough_evidence` or `out_of_scope`; each Recommendation Handoff row cites supporting claim IDs or evidence IDs, affected surfaces, and tests/checks or is blocked by a named open question; repo-runtime claims cite local repo evidence before external practice evidence and use adequate runtime evidence roles; and `**Confidence:** HIGH` is used only when no planner-critical claim is unsupported, contradicted, conflicting, unchecked, or unverified.
```

In the `Response requirements` block, keep the MCP allowlist unchanged. No new MCP tool is introduced.

Add these exact contract-test assertions to `tests/phase-discovery-research.test.ts` in the command manifest contract test, near the existing `claim-addressable provenance packet` assertion:

```ts
  assert.match(commandFile, /Source-Support Self-Check/i);
  assert.match(commandFile, /Claim Support Ledger/i);
  assert.match(commandFile, /Source Register/i);
  assert.match(commandFile, /Recommendation Handoff/i);
  assert.match(commandFile, /repo-runtime claims cite local repo evidence/i);
  assert.match(commandFile, /\*\*Confidence:\*\*\s+HIGH/i);
```

### `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`

#### Subtractions

Do not remove the existing claim-addressable provenance, investigation trace, strand ledger, dependency/tool evaluation, or no-subagent fallback text.

#### Additions/Replacements

In `## Artifact Authoring Rules`, add these bullets after the existing bullet that starts ``- `## Recommendations` is prescriptive enough``:

```md
- `## Claim Support Ledger`, when present, is the planner-critical claim ledger. Use columns `Claim ID`, `Claim`, `Claim Type`, `Evidence IDs`, `Support Status`, `Confidence`, and `Plan Impact`. Valid claim types are `repo_runtime`, `external_practice`, `dependency_tool`, `inference`, and `open_question`. Valid support statuses are `directly_supported`, `partially_supported`, `inferred_from_supported`, `contradicted`, `conflicting_sources`, `not_enough_evidence`, and `out_of_scope`.
- `## Recommendations` should include a `Recommendation Handoff` table for planner-critical recommendations. Use columns `Recommendation ID`, `Recommendation`, `Supporting Claim IDs`, `Evidence IDs`, `Affected Surfaces`, `Tests / Checks`, and `Status`. A recommendation is planner-ready only when it cites supporting claim IDs or evidence IDs, names affected repo or contract surfaces, and names tests/checks, or when `Status` says `blocked` and points to a named open question.
- Legacy non-table claim-addressable provenance remains valid when the artifact otherwise satisfies the current contract. It is good enough when planner-critical claims still include stable claim/evidence/source IDs, support status, source lane, and downstream use in nearby prose or the existing `Repo Evidence`, `External Sources`, and `Inference Notes` tables. It should receive warning diagnostics when those IDs cannot be connected, when recommendations lack affected surfaces or tests/checks, or when repo-runtime and external-source policy claims cannot be traced.
```

In `## Evidence Quality, Citations, And Provenance`, replace the `Final sources should use this structure:` Markdown block with this final source structure. Preserve the surrounding prose:

````md
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
````

Add this new subsection before `## Retry And Repair Behavior`:

```md
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
```

Add these exact contract-test assertions in `tests/phase-discovery-research.test.ts` near the existing runtime-contract assertions for `Evidence Quality, Citations, And Provenance`:

```ts
  assert.match(runtimeContract, /Source-Support Self-Check/i);
  assert.match(runtimeContract, /Claim Support Ledger/i);
  assert.match(runtimeContract, /Source Register/i);
  assert.match(runtimeContract, /Recommendation Handoff/i);
  assert.match(runtimeContract, /repo_runtime/i);
  assert.match(runtimeContract, /research evidence warning diagnostics/i);
```

### `skills/blueprint-phase-discovery/SKILL.md`

#### Subtractions

None.

#### Additions/Replacements

In the `/blu-research-phase` numbered workflow, extend step 5 by appending this sentence to the end of the existing paragraph:

```md
Before persistence, run the runtime contract's Source-Support Self-Check so planner-critical claims, Source Register rows, Recommendation Handoff rows, repo-runtime evidence, external access dates, and high-confidence claims are consistent before the MCP write.
```

In `## Completion Self-Check`, replace this existing bullet:

```md
- For `/blu-research-phase`, planner-critical claims used claim-addressable provenance where
  available: claim/evidence IDs, repo/external/inference lanes, support class,
  source type, authority tier, support span, retrieval context, limitations, and
  split source sections. Missing claim-addressable provenance in an otherwise valid older
  artifact was treated as a validation warning unless the MCP validator made it strict.
```

with:

```md
- For `/blu-research-phase`, planner-critical claims used claim-addressable provenance where available: Claim Support Ledger rows, Source Register rows, Recommendation Handoff rows, claim/evidence/source IDs, repo/external/inference lanes, support class, source type, authority tier, support span, retrieval context, limitations, and split source sections. Missing richer provenance in an otherwise valid older artifact was treated as a research evidence warning diagnostic unless the MCP validator made it strict.
```

Add these exact assertions in `tests/phase-discovery-research.test.ts` near the existing skill assertions:

```ts
  assert.match(skillFile, /Source-Support Self-Check/i);
  assert.match(skillFile, /Source Register/i);
  assert.match(skillFile, /Recommendation Handoff/i);
  assert.match(skillFile, /research evidence warning diagnostic/i);
```

### `agents/blueprint-researcher.md`

#### Subtractions

None.

#### Additions/Replacements

In `## Required Output Contract`, add these bullets after the existing `Evidence Packet Rows` bullet:

```md
- Include `Claim Support Ledger Rows` for planner-critical artifact-grade claims when the parent asks for evidence validation. Each row must include claim ID, claim, claim type, evidence IDs, support status, confidence, and plan impact.
- Include `Source Register Rows` for sources the parent can copy into `## Sources`. Each row must include source ID, lane, path or URL, access date when external, repo line or symbol when available, source type, used-for-claims, and limitations.
- Include `Recommendation Handoff Rows` when the bounded question supports a recommendation. Each row must include recommendation ID, recommendation, supporting claim IDs, evidence IDs, affected surfaces, tests/checks, and status.
```

In `## Boundaries`, add this bullet after `Do not invent evidence IDs, claim IDs, access dates, support spans, source authority tiers, or retrieval methods for external evidence the parent did not supply or approve.`:

```md
- Do not invent Source Register rows, source IDs, or Recommendation Handoff rows for evidence the parent did not supply, approve, or let you confirm from repo-local reads.
```

Add these exact assertions in `tests/phase-discovery-research.test.ts` near the existing `blueprint-researcher` assertions:

```ts
  assert.match(researcherAgent, /Claim Support Ledger Rows/i);
  assert.match(researcherAgent, /Source Register Rows/i);
  assert.match(researcherAgent, /Recommendation Handoff Rows/i);
  assert.match(researcherAgent, /Do not invent Source Register rows/i);
  assert.match(researcherAgent, /does not fetch official docs itself/i);
  assert.match(researcherAgent, /needs-parent-evidence/i);
  assert.match(researcherAgent, /externalSources: <parent-supplied external packet ids only; never self-fetched>/i);
  assert.match(researcherAgent, /Do not imply that you fetched official docs or external sources yourself/i);
```

### `agents/blueprint-project-researcher.md`

#### Subtractions

None.

#### Additions/Replacements

No edit is required. This agent is for bootstrap-context research, not `/blu-research-phase` artifact-grade phase research. Do not copy the Source Register or Recommendation Handoff contract here unless a separate bootstrap research plan explicitly asks for it.

### `src/mcp/artifact-contracts/index.ts`

#### Subtractions

None.

#### Additions/Replacements

In `renderResearchTemplate`, insert this block immediately after `## Summary` and its placeholder bullet:

```ts
`## Claim Support Ledger

| Claim ID | Claim | Claim Type | Evidence IDs | Support Status | Confidence | Plan Impact |
|----------|-------|------------|--------------|----------------|------------|-------------|
| CLM-001 | <planner-critical claim> | <claim type> | EVID-001 or SRC-001 | <support status> | <LOW, MEDIUM, or HIGH> | REC-001, open question, or blocked |
`
```

Because this is inside a template literal, implement the insertion as literal Markdown, not as a nested TypeScript string.

Immediately after the table, add this authoring guidance:

```md
Allowed claim types: `repo_runtime`, `external_practice`, `dependency_tool`, `inference`, `open_question`.
Allowed support statuses: `directly_supported`, `partially_supported`, `inferred_from_supported`, `contradicted`, `conflicting_sources`, `not_enough_evidence`, `out_of_scope`.
Use `EVID-*` when a claim is supported by evidence rows under `Repo Evidence`, `External Sources`, or `Inference Notes`; use `SRC-*` only for direct Source Register support.
```

Replace the current `## Recommendations` placeholder:

```md
## Recommendations

- <prescriptive recommendation with tradeoffs; cite DEP-001 when this adds, adopts, rejects, defers, upgrades, or hand-rolls a dependency/tool>
```

with:

```md
## Recommendations

### Recommendation Handoff

| Recommendation ID | Recommendation | Supporting Claim IDs | Evidence IDs | Affected Surfaces | Tests / Checks | Status |
|-------------------|----------------|----------------------|--------------|-------------------|----------------|--------|
| REC-001 | <prescriptive recommendation with tradeoffs> | CLM-001 | EVID-001 or SRC-001 | <files, commands, contracts, docs, or none> | <tests/checks or named validation> | <ready or blocked with open question> |
```

In `## Sources`, insert this block immediately after the `## Sources` heading and before `### Repo Evidence`:

```md
### Source Register

| Source ID | Lane | Path Or URL | Accessed | Repo Line Or Symbol | Source Type | Used For Claims | Limitations |
|-----------|------|-------------|----------|---------------------|-------------|-----------------|-------------|
| SRC-001 | repo | <repo path, command, test output, manifest, contract, or saved Blueprint artifact> | observed <YYYY-MM-DD> | <line, symbol, heading, or n/a> | <repo source type> | CLM-001 | <limits or none> |
| SRC-002 | external | <URL, DOI, or supplied source label> | <YYYY-MM-DD or supplied-unchecked> | n/a | <external source type> | CLM-002 or background | <stale risk, inaccessible text, supplied-only, conflict, or none> |
```

Immediately after the Source Register table, add this authoring guidance:

```md
Allowed lanes: `repo`, `external`, `supplied`, `inference`. Use `supplied` when the user supplied a source but live external verification did not happen.
Repo source types include `repo_file`, `command_output`, and `test_output`.
External or supplied source types include `official_standard`, `official_product_doc`, `peer_reviewed_paper`, `preprint`, `supplied_reference`, and `web_page`.
```

In the `phase.research.placeholderSignals` array, add these exact placeholder strings:

```ts
      "<planner-critical claim>",
      "<claim type>",
      "<support status>",
      "<prescriptive recommendation with tradeoffs>",
      "<files, commands, contracts, docs, or none>",
      "<tests/checks or named validation>",
      "<ready or blocked with open question>",
      "<open question>",
      "<repo path, command, test output, manifest, contract, or saved Blueprint artifact>",
      "<line, symbol, heading, or n/a>",
      "<repo source type>",
      "<external source type>",
      "<URL, DOI, or supplied source label>"
```

In the `phase.research.notes` array, add these exact entries:

```ts
      "Claim Support Ledger rows are preferred for planner-critical claims and should connect claim IDs to source or evidence IDs, support status, confidence, and plan impact.",
      "Source Register rows are preferred under ## Sources and should connect source IDs to lanes, paths or URLs, access dates, repo line or symbol anchors, source types, used claims, and limitations.",
      "Recommendation Handoff rows are preferred for planner-critical recommendations and should connect recommendation IDs to supporting claims, evidence, affected surfaces, tests/checks, and ready or blocked status.",
      "Research validation returns warning-grade evidence diagnostics for missing or weak claim/source/recommendation support before making the richer evidence contract strict."
```

Update scaffold/template assertions in `tests/phase-discovery-research.test.ts` to assert these exact strings:

```ts
  assert.match(scaffold, /## Claim Support Ledger/);
  assert.match(scaffold, /Claim Type/);
  assert.match(scaffold, /Support Status/);
  assert.match(scaffold, /Plan Impact/);
  assert.match(scaffold, /### Recommendation Handoff/);
  assert.match(scaffold, /Supporting Claim IDs/);
  assert.match(scaffold, /Affected Surfaces/);
  assert.match(scaffold, /Tests \/ Checks/);
  assert.match(scaffold, /### Source Register/);
  assert.match(scaffold, /Source ID/);
  assert.match(scaffold, /Path Or URL/);
  assert.match(scaffold, /Repo Line Or Symbol/);
  assert.match(scaffold, /Used For Claims/);
```

Update the contract-read assertions in the `phase artifact write creates, reuses, updates, and validates research content` test:

```ts
  assert.match(contract.contract.authoringTemplate, /## Claim Support Ledger/);
  assert.match(contract.contract.authoringTemplate, /### Recommendation Handoff/);
  assert.match(contract.contract.authoringTemplate, /### Source Register/);
  assert.match(contract.contract.notes.join("\n"), /warning-grade evidence diagnostics/i);
```

### `src/mcp/tools/artifacts.ts`

#### Subtractions

Do not remove existing strict validation checks, dependency/tool warning checks, source-split warning checks, or high-confidence warning checks.

#### Additions/Replacements

Extend `PhaseArtifactValidationDiagnostic` with warning severity:

```ts
export type PhaseArtifactValidationDiagnostic = {
  path: string;
  code: string;
  message: string;
  severity?: "error" | "warning";
  heading?: string;
  missing?: string[];
  repair: string;
  retryable: boolean;
  nextTool?: string;
};
```

Update `phaseArtifactDiagnostic` to set `severity: "error"`:

```ts
    severity: "error",
```

Add this helper near `phaseArtifactDiagnostic`:

```ts
function researchEvidenceWarningDiagnostic(args: {
  code: string;
  message: string;
  heading?: string;
  repair: string;
}): PhaseArtifactValidationDiagnostic {
  return {
    path: "content",
    code: args.code,
    message: args.message,
    severity: "warning",
    heading: args.heading,
    repair: args.repair,
    retryable: true,
    nextTool: "blueprint_phase_artifact_write"
  };
}
```

Add these parsing helpers near the current research validation helpers, before `stripResearchPlaceholderSignals`:

```ts
type ResearchMarkdownRow = Record<string, string>;

function normalizeResearchTableHeader(value: string): string {
  return value
    .trim()
    .replace(/`/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function splitResearchTableLine(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function parseResearchMarkdownTable(section: string): ResearchMarkdownRow[] {
  const lines = section.split("\n");

  for (let index = 0; index < lines.length - 1; index += 1) {
    const headerLine = lines[index]?.trim() ?? "";
    const dividerLine = lines[index + 1]?.trim() ?? "";

    if (!headerLine.startsWith("|") || !dividerLine.startsWith("|")) {
      continue;
    }

    if (!/^\|?[\s:-]+\|[\s|:-]*$/.test(dividerLine)) {
      continue;
    }

    const headers = splitResearchTableLine(headerLine).map(normalizeResearchTableHeader);
    const rows: ResearchMarkdownRow[] = [];

    for (const rowLine of lines.slice(index + 2)) {
      const trimmed = rowLine.trim();

      if (!trimmed.startsWith("|")) {
        break;
      }

      const cells = splitResearchTableLine(trimmed);
      const row: ResearchMarkdownRow = {};

      headers.forEach((header, cellIndex) => {
        row[header] = cells[cellIndex] ?? "";
      });

      rows.push(row);
    }

    return rows;
  }

  return [];
}

function extractMarkdownSubsection(section: string, subheading: string): string {
  const escaped = subheading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = section.match(new RegExp(`(?:^|\\n)### ${escaped}\\s*\\n([\\s\\S]*?)(?=\\n### |\\n## |$)`, "m"));
  return match?.[1] ?? "";
}

function splitResearchReferenceIds(value: string): string[] {
  return uniqueStrings(value.match(/\b(?:SRC|EVID|CLM|REC)-\d{3}\b/g) ?? []);
}

function isBackgroundSourceUse(value: string): boolean {
  return /\b(?:background|do not use as support|out_of_scope)\b/i.test(value);
}

function collectResearchClaimRows(content: string): ResearchMarkdownRow[] {
  return parseResearchMarkdownTable(extractMarkdownSection(content, "Claim Support Ledger"));
}

function collectResearchRecommendationRows(content: string): ResearchMarkdownRow[] {
  return parseResearchMarkdownTable(extractMarkdownSection(content, "Recommendations"));
}

function collectResearchSourceRegisterRows(content: string): ResearchMarkdownRow[] {
  return parseResearchMarkdownTable(
    extractMarkdownSubsection(extractMarkdownSection(content, "Sources"), "Source Register")
  );
}

function sourceRegisterRowId(row: ResearchMarkdownRow): string {
  return row.source_id || row.evidence_id || "";
}

function collectResearchEvidenceRows(content: string): ResearchMarkdownRow[] {
  const sources = extractMarkdownSection(content, "Sources");
  return [
    ...parseResearchMarkdownTable(extractMarkdownSubsection(sources, "Repo Evidence")),
    ...parseResearchMarkdownTable(extractMarkdownSubsection(sources, "External Sources")),
    ...parseResearchMarkdownTable(extractMarkdownSubsection(sources, "Inference Notes"))
  ];
}

function evidenceRowId(row: ResearchMarkdownRow): string {
  return row.evidence_id || "";
}

function evidenceRowReferences(row: ResearchMarkdownRow): string[] {
  return splitResearchReferenceIds(
    [
      row.source_ref,
      row.derived_from,
      row.downstream_use,
      row.support_span,
      row.retrieval_context
    ].join(" ")
  );
}

function resolveEvidenceSourceIds(
  evidenceId: string,
  evidenceRowsById: Map<string, ResearchMarkdownRow>,
  visited = new Set<string>()
): string[] {
  if (visited.has(evidenceId)) {
    return [];
  }

  visited.add(evidenceId);
  const row = evidenceRowsById.get(evidenceId);
  if (!row) {
    return [];
  }

  const refs = evidenceRowReferences(row);
  const directSourceIds = refs.filter((id) => id.startsWith("SRC-"));
  const nestedSourceIds = refs
    .filter((id) => id.startsWith("EVID-"))
    .flatMap((id) => resolveEvidenceSourceIds(id, evidenceRowsById, visited));

  return uniqueStrings([...directSourceIds, ...nestedSourceIds]);
}

function sourceRowIsRepoLane(row: ResearchMarkdownRow): boolean {
  return /\brepo\b/i.test(row.lane || "");
}

function hasRuntimeAdequateEvidence(
  evidenceIds: string[],
  sourceIds: string[],
  evidenceRowsById: Map<string, ResearchMarkdownRow>,
  sourceRowsById: Map<string, ResearchMarkdownRow>
): boolean {
  const evidenceText = evidenceIds
    .map((id) => evidenceRowsById.get(id))
    .filter((row): row is ResearchMarkdownRow => Boolean(row))
    .map((row) =>
      [
        row.role,
        row.retrieval_context,
        row.source_ref,
        row.source_type,
        row.source_class,
        row.path_symbol_url,
        row.path_or_url
      ].join(" ")
    )
    .join(" ");
  const sourceText = sourceIds
    .map((id) => sourceRowsById.get(id))
    .filter((row): row is ResearchMarkdownRow => Boolean(row))
    .map((row) => [row.source_type, row.path_or_url, row.repo_line_or_symbol].join(" "))
    .join(" ");
  const combined = `${evidenceText}\n${sourceText}`;

  return /\b(command-manifest|skill-contract|runtime-contract|artifact-contract|mcp-handler|test|built-entrypoint|command manifest|skill\/reference doc|MCP handler|artifact contract|built entrypoint)\b/i.test(
    combined
  ) || /\b(?:commands|skills|src\/mcp|tests|dist)\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+/i.test(combined);
}
```

Replace the existing `usesLiveVerificationLanguageWithoutExternalEvidence` helper with this version so the warning is deterministic and not a vague prose scan:

```ts
function usesLiveVerificationLanguageWithoutExternalEvidence(content: string): boolean {
  const claimText = [
    extractMarkdownSection(content, "Summary"),
    extractMarkdownSection(content, "State Of The Art"),
    extractMarkdownSection(content, "Recommendations")
  ].join("\n");

  const currentExternalClaimPattern =
    /\b(?:latest|current official|official docs confirm|upstream confirms|current upstream|live external verification|current vendor docs|official documentation currently)\b/i;

  if (!currentExternalClaimPattern.test(claimText)) {
    return false;
  }

  const sources = extractMarkdownSection(content, "Sources");
  const sourceRegister = extractMarkdownSubsection(sources, "Source Register");

  return (
    !/### External Sources/i.test(sources) ||
    !/\baccessed\s+\d{4}-\d{2}-\d{2}\b/i.test(sources)
  ) && !/\|\s*(?:external|supplied)\s*\|[\s\S]*\|\s*\d{4}-\d{2}-\d{2}\s*\|/i.test(sourceRegister);
}
```

Add this helper after those parsers:

```ts
function researchEvidenceWarningDiagnostics(content: string): PhaseArtifactValidationDiagnostic[] {
  const diagnostics: PhaseArtifactValidationDiagnostic[] = [];
  const sources = extractMarkdownSection(content, "Sources");
  const sourceRows = collectResearchSourceRegisterRows(content);
  const sourceRowsById = new Map(
    sourceRows
      .map((row) => [sourceRegisterRowId(row), row] as const)
      .filter(([id]) => id.length > 0)
  );
  const evidenceRows = collectResearchEvidenceRows(content);
  const evidenceRowsById = new Map(
    evidenceRows
      .map((row) => [evidenceRowId(row), row] as const)
      .filter(([id]) => id.length > 0)
  );
  const claimRows = collectResearchClaimRows(content);
  const recommendationRows = collectResearchRecommendationRows(content);
  const sourceIds = new Set(sourceRowsById.keys());
  const evidenceIds = new Set(evidenceRowsById.keys());
  const claimIds = new Set(claimRows.map((row) => row.claim_id).filter((id) => id.length > 0));
  const usedSourceIds = new Set<string>();

  for (const line of sourceLinesWithUrlsMissingAccessDate(sources)) {
    diagnostics.push(
      researchEvidenceWarningDiagnostic({
        code: "research.external_source_missing_access_date",
        heading: "Sources",
        message: `Research artifact external source row is missing an access date: ${line}`,
        repair: "Add an Accessed value in YYYY-MM-DD form, or mark the source supplied-unchecked and do not use it as current evidence."
      })
    );
  }

  for (const row of sourceRows) {
    const sourceId = sourceRegisterRowId(row);
    if (!sourceId) {
      diagnostics.push(
        researchEvidenceWarningDiagnostic({
          code: "research.source_id_missing",
          heading: "Sources",
          message: "Research artifact Source Register rows should include a stable Source ID.",
          repair: "Add a Source ID such as SRC-001 to every Source Register row used by claims or recommendations."
        })
      );
    }
  }

  for (const row of claimRows) {
    const supportStatus = row.support_status || row.claim_class || "";
    const citedIds = splitResearchReferenceIds(row.evidence_ids || row.source_ids || row.evidence || "");
    const directSourceIds = citedIds.filter((id) => id.startsWith("SRC-"));
    const citedEvidenceIds = citedIds.filter((id) => id.startsWith("EVID-"));
    const resolvedSourceIds = uniqueStrings([
      ...directSourceIds,
      ...citedEvidenceIds.flatMap((id) => resolveEvidenceSourceIds(id, evidenceRowsById))
    ]);

    for (const id of resolvedSourceIds) {
      usedSourceIds.add(id);
    }

    if (
      resolvedSourceIds.length === 0 &&
      !/\b(?:not_enough_evidence|out_of_scope)\b/i.test(supportStatus)
    ) {
      diagnostics.push(
        researchEvidenceWarningDiagnostic({
          code: "research.claim_missing_evidence",
          heading: "Claim Support Ledger",
          message: "Research artifact planner-critical claim rows should cite at least one evidence ID that resolves to a Source Register row, or explicitly mark missing evidence.",
          repair: "Add EVID-* rows that resolve to Source Register rows, add direct SRC-* support, or set Support Status to not_enough_evidence or out_of_scope."
        })
      );
    }

    for (const id of directSourceIds) {
      if (!sourceIds.has(id)) {
        diagnostics.push(
          researchEvidenceWarningDiagnostic({
            code: "research.source_id_missing_from_register",
            heading: "Claim Support Ledger",
            message: `Research artifact claim cites ${id}, but ${id} is not present in the Source Register.`,
            repair: "Add the cited source to the Source Register or change the claim evidence IDs to existing sources."
          })
        );
      }
    }

    for (const id of citedEvidenceIds) {
      if (!evidenceIds.has(id)) {
        diagnostics.push(
          researchEvidenceWarningDiagnostic({
            code: "research.evidence_id_missing_from_sources",
            heading: "Claim Support Ledger",
            message: `Research artifact claim cites ${id}, but ${id} is not present in Repo Evidence, External Sources, or Inference Notes.`,
            repair: "Add the cited evidence row or change the claim evidence IDs to existing evidence."
          })
        );
      } else if (resolveEvidenceSourceIds(id, evidenceRowsById).length === 0) {
        diagnostics.push(
          researchEvidenceWarningDiagnostic({
            code: "research.evidence_missing_source_register_link",
            heading: "Sources",
            message: `Research artifact evidence row ${id} does not resolve to any Source Register row.`,
            repair: "Set Source Ref or Derived From to an existing SRC-* row, or mark the evidence as unsupported."
          })
        );
      }
    }

    if ((row.claim_type || "").trim() === "repo_runtime") {
      const repoSourceIds = resolvedSourceIds.filter((id) => {
        const source = sourceRowsById.get(id);
        return source && sourceRowIsRepoLane(source);
      });

      if (
        repoSourceIds.length === 0 &&
        !/\b(?:not_enough_evidence|out_of_scope)\b/i.test(supportStatus)
      ) {
        diagnostics.push(
          researchEvidenceWarningDiagnostic({
            code: "research.repo_runtime_claim_missing_repo_evidence",
            heading: "Claim Support Ledger",
            message: "Research artifact repo_runtime claims should cite at least one repo-lane Source Register row before relying on external evidence.",
            repair: "Add repo evidence for the runtime claim, lower confidence, or change the claim to an inference or open question."
          })
        );
      }

      if (
        repoSourceIds.length > 0 &&
        !hasRuntimeAdequateEvidence(citedEvidenceIds, repoSourceIds, evidenceRowsById, sourceRowsById)
      ) {
        diagnostics.push(
          researchEvidenceWarningDiagnostic({
            code: "research.repo_runtime_claim_retrieval_partial",
            heading: "Claim Support Ledger",
            message: "Research artifact repo_runtime claims should cite runtime-adequate evidence such as command manifests, skills, runtime contracts, artifact contracts, MCP handlers, tests, or built entrypoints.",
            repair: "Add runtime-adequate repo evidence, or lower confidence and mark the claim as partially supported."
          })
        );
      }
    }
  }

  for (const row of sourceRows) {
    const sourceId = sourceRegisterRowId(row);

    if (
      sourceId &&
      !usedSourceIds.has(sourceId) &&
      !isBackgroundSourceUse(row.used_for_claims || row.downstream_use || row.limitations || "")
    ) {
      diagnostics.push(
        researchEvidenceWarningDiagnostic({
          code: "research.source_id_orphaned",
          heading: "Sources",
          message: `Research artifact Source Register row ${sourceId} is not used by a claim and is not labeled background.`,
          repair: "Use the source from a claim row, remove it, or label it background or do not use as support."
        })
      );
    }
  }

  for (const row of recommendationRows) {
    if (!row.recommendation_id && !row.recommendation) {
      continue;
    }

    const supportingClaims = splitResearchReferenceIds(row.supporting_claim_ids || row.claim_ids || "");
    const recommendationEvidenceIds = splitResearchReferenceIds(row.evidence_ids || row.evidence || "");
    const status = row.status || "";

    if (
      supportingClaims.filter((id) => id.startsWith("CLM-")).length === 0 &&
      recommendationEvidenceIds.length === 0 &&
      !/\bblocked\b/i.test(status)
    ) {
      diagnostics.push(
        researchEvidenceWarningDiagnostic({
          code: "research.recommendation_missing_evidence",
          heading: "Recommendations",
          message: "Research artifact Recommendation Handoff rows should cite supporting claim IDs or evidence IDs unless blocked by a named open question.",
          repair: "Add Supporting Claim IDs or Evidence IDs, or mark the recommendation blocked with the open question that prevents planner-ready action."
        })
      );
    }

    for (const id of recommendationEvidenceIds) {
      if (id.startsWith("SRC-") && !sourceIds.has(id)) {
        diagnostics.push(
          researchEvidenceWarningDiagnostic({
            code: "research.source_id_missing_from_register",
            heading: "Recommendations",
            message: `Research artifact recommendation cites ${id}, but ${id} is not present in the Source Register.`,
            repair: "Add the cited source to the Source Register or change the recommendation evidence IDs to existing sources."
          })
        );
      }

      if (id.startsWith("EVID-") && !evidenceIds.has(id)) {
        diagnostics.push(
          researchEvidenceWarningDiagnostic({
            code: "research.evidence_id_missing_from_sources",
            heading: "Recommendations",
            message: `Research artifact recommendation cites ${id}, but ${id} is not present in Repo Evidence, External Sources, or Inference Notes.`,
            repair: "Add the cited evidence row or change the recommendation evidence IDs to existing evidence."
          })
        );
      }
    }

    for (const id of supportingClaims.filter((candidate) => candidate.startsWith("CLM-"))) {
      if (claimIds.size > 0 && !claimIds.has(id)) {
        diagnostics.push(
          researchEvidenceWarningDiagnostic({
            code: "research.recommendation_claim_id_missing_from_ledger",
            heading: "Recommendations",
            message: `Research artifact recommendation cites ${id}, but ${id} is not present in the Claim Support Ledger.`,
            repair: "Add the claim to the Claim Support Ledger or change the recommendation to cite an existing claim."
          })
        );
      }
    }

    if (!row.affected_surfaces?.trim() && !/\bblocked\b/i.test(status)) {
      diagnostics.push(
        researchEvidenceWarningDiagnostic({
          code: "research.recommendation_missing_affected_surfaces",
          heading: "Recommendations",
          message: "Research artifact Recommendation Handoff rows should name affected files, commands, contracts, docs, or modules.",
          repair: "Add affected surfaces, or mark the recommendation blocked if no planner-ready surface can be named."
        })
      );
    }

    if (!row.tests_checks?.trim() && !/\bblocked\b/i.test(status)) {
      diagnostics.push(
        researchEvidenceWarningDiagnostic({
          code: "research.recommendation_missing_validation_signal",
          heading: "Recommendations",
          message: "Research artifact Recommendation Handoff rows should name tests/checks or validation signals.",
          repair: "Add tests/checks, or mark the recommendation blocked if validation cannot yet be named."
        })
      );
    }
  }

  if (!/### Recommendation Handoff/i.test(extractMarkdownSection(content, "Recommendations"))) {
    diagnostics.push(
      researchEvidenceWarningDiagnostic({
        code: "research.recommendation_handoff_missing",
        heading: "Recommendations",
        message: "Research artifact should include a Recommendation Handoff table for planner-critical recommendations.",
        repair: "Add a Recommendation Handoff table with recommendation IDs, supporting claims/evidence, affected surfaces, tests/checks, and status."
      })
    );
  }

  if (usesLiveVerificationLanguageWithoutExternalEvidence(content)) {
    diagnostics.push(
      researchEvidenceWarningDiagnostic({
        code: "research.live_external_claim_without_evidence",
        heading: "Sources",
        message: "Research artifact uses current external verification wording without an External Sources or Source Register row with an access date.",
        repair: "Add allowed external evidence with an access date, lower confidence, or mark the claim unchecked."
      })
    );
  }

  if (hasHighConfidenceWithUnsupportedEvidenceClaims(content)) {
    diagnostics.push(
      researchEvidenceWarningDiagnostic({
        code: "research.high_confidence_unsupported",
        heading: "Confidence Breakdown",
        message: "Research artifact uses HIGH confidence while planner-critical claims are contradicted, conflicting, unchecked, unverified, or not enough evidence.",
        repair: "Lower confidence, move the issue to Open Questions, or add direct support for the planner-critical claim."
      })
    );
  }

  return diagnostics;
}
```

In `validateResearchArtifactContent`, after `const warnings: string[] = [];`, add:

```ts
  const diagnostics: PhaseArtifactValidationDiagnostic[] = [];
```

Replace every direct warning push for R7 evidence checks with a warning string plus a diagnostic from `researchEvidenceWarningDiagnostics(content)`.

The final return must become:

```ts
  const issueDiagnostics = issues.map((issue) =>
    phaseArtifactDiagnostic({
      artifact: "research",
      path: "content",
      code: "research.invalid",
      message: issue
    })
  );
  const warningDiagnostics = researchEvidenceWarningDiagnostics(content);

  diagnostics.push(...issueDiagnostics, ...warningDiagnostics);

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    diagnostics
  };
```

When warning diagnostics are produced, each diagnostic message must also appear in `warnings`. The simplest implementation is to push `diagnostic.message` into `warnings` for warning diagnostics that are not already represented by an existing warning string. Preserve the existing warning text where tests already assert it.

Update `phaseArtifactSuggestedRepairs` and `phaseArtifactRetryPlan` so retry plans for invalid writes use only error diagnostics:

```ts
const errorDiagnostics = diagnostics.filter((diagnostic) => diagnostic.severity !== "warning");
```

Use `errorDiagnostics` for invalid-write suggested repairs and retry plan steps. Keep warning diagnostics visible in `validation.diagnostics`.

### `src/mcp/tools/phase.ts`

#### Subtractions

None.

#### Additions/Replacements

Update the `PhaseArtifactWriteResult.validation` type to keep diagnostics available on valid warning-only writes:

```ts
  validation: {
    valid: boolean;
    issues: string[];
    warnings: string[];
    suggestedRepairs: string[];
    diagnostics?: PhaseArtifactValidationDiagnostic[];
    retryPlan?: PhaseArtifactRetryPlan | null;
  } | null;
```

In the reused and successful write return objects inside `blueprintPhaseArtifactWrite`, add:

```ts
          diagnostics: validation.diagnostics,
```

for the `validation` object in the `reused` branch, and:

```ts
      diagnostics: validation.diagnostics,
```

for the `validation` object in the `created`/`updated` branch.

Do not change write status semantics. Warning-only research diagnostics must not turn `status` into `"invalid"` and must not make `researchValid` false.

### `tests/phase-discovery-research.test.ts`

#### Subtractions

None.

#### Additions/Replacements

Update `validResearchContent(summary: string)` so the returned fixture includes:

1. A `## Claim Support Ledger` section after `## Summary`:

```md
## Claim Support Ledger

| Claim ID | Claim | Claim Type | Evidence IDs | Support Status | Confidence | Plan Impact |
|----------|-------|------------|--------------|----------------|------------|-------------|
| CLM-001 | Research persistence is MCP-owned and validated before write completion. | repo_runtime | EVID-001 | directly_supported | HIGH | REC-001 |
| CLM-002 | No live external lookup is required for this repo-only fixture. | open_question | EVID-002 | out_of_scope | LOW | do not use as support |
```

2. A `### Recommendation Handoff` table under `## Recommendations`:

```md
### Recommendation Handoff

| Recommendation ID | Recommendation | Supporting Claim IDs | Evidence IDs | Affected Surfaces | Tests / Checks | Status |
|-------------------|----------------|----------------------|--------------|-------------------|----------------|--------|
| REC-001 | Persist only validated research content through `blueprint_phase_artifact_write`. | CLM-001 | EVID-001 | src/mcp/tools/phase.ts, src/mcp/tools/artifacts.ts, tests/phase-discovery-research.test.ts | npx tsx --test tests/phase-discovery-research.test.ts | ready |
```

3. A `### Source Register` table under `## Sources` before `### Repo Evidence`:

```md
### Source Register

| Source ID | Lane | Path Or URL | Accessed | Repo Line Or Symbol | Source Type | Used For Claims | Limitations |
|-----------|------|-------------|----------|---------------------|-------------|-----------------|-------------|
| SRC-001 | repo | src/mcp/tools/phase.ts | observed 2026-04-11 | blueprintPhaseArtifactWrite | repo_file | CLM-001 | local fixture evidence |
| SRC-002 | external | supplied-none | supplied-unchecked | n/a | supplied_reference | background | no live external lookup used |
```

4. Update the existing `### Repo Evidence` row for `EVID-001` so it resolves through the Source Register and uses a runtime-adequate role:

```md
| EVID-001 | CLM-001 | SRC-001 | mcp-handler | manual-read; MCP handler | phase artifact writes route through MCP-owned tooling | directly_supported | REC-001 | local checkout only |
```

In the existing valid claim-addressable provenance test, update the negative warning assertion to include the new diagnostics:

```ts
    /split ## Sources|claim-addressable evidence|External Sources row with an access date|Source Register rows should include|Recommendation Handoff rows should cite|repo_runtime claims should cite|HIGH confidence/i
```

Add these tests after `research validation warns on HIGH confidence with unsupported claims`:

```ts
test("research validation returns warning diagnostics for missing source register ids", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Create research with a claim that cites a missing Source Register row."
  ).replace("| EVID-001 | CLM-001 | SRC-001 | mcp-handler |", "| EVID-001 | CLM-001 | SRC-404 | mcp-handler |");

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.status, "created");
  assert.equal(written.validation?.valid, true);
  assert.match(
    written.validation?.warnings.join("\n") ?? "",
    /evidence row EVID-001 does not resolve to any Source Register row/i
  );
  assert.ok(
    written.validation?.diagnostics?.some(
      (diagnostic) => diagnostic.code === "research.evidence_missing_source_register_link" && diagnostic.severity === "warning"
    )
  );
});

test("research validation returns warning diagnostics for repo-runtime claims without repo evidence", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Create research with a repo-runtime claim supported only by external evidence."
  )
    .replace("EVID-001 | directly_supported", "EVID-002 | directly_supported")
    .replace("| SRC-002 | external | supplied-none | supplied-unchecked | n/a | supplied_reference | background | no live external lookup used |", "| SRC-002 | external | https://example.com/docs | 2026-04-11 | n/a | official_product_doc | CLM-001 | fixture only |")
    .replace("| EVID-002 | CLM-002 | supplied_reference | unknown | Repo-only fixture | supplied-none | supplied-unchecked | no external lookup used | out_of_scope | source policy off | repo-only fixture | do not use as external support |", "| EVID-002 | CLM-001 | official_product_doc | official_vendor_doc | Example docs | SRC-002 | 2026-04-11 | docs describe an adjacent practice | directly_supported | parent-approved external check | fixture only | REC-001 |");

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.validation?.valid, true);
  assert.match(
    written.validation?.warnings.join("\n") ?? "",
    /repo_runtime claims should cite at least one repo-lane Source Register row/i
  );
  assert.ok(
    written.validation?.diagnostics?.some(
      (diagnostic) => diagnostic.code === "research.repo_runtime_claim_missing_repo_evidence" && diagnostic.severity === "warning"
    )
  );
});

test("research validation returns warning diagnostics for partial repo-runtime retrieval", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Create research with repo evidence that is not runtime-adequate for a repo-runtime claim."
  )
    .replace("| SRC-001 | repo | src/mcp/tools/phase.ts | observed 2026-04-11 | blueprintPhaseArtifactWrite | repo_file | CLM-001 | local fixture evidence |", "| SRC-001 | repo | .blueprint/codebase/STACK.md | observed 2026-04-11 | n/a | repo_file | CLM-001 | summary-only evidence |")
    .replace("| EVID-001 | CLM-001 | SRC-001 | mcp-handler | manual-read; MCP handler | phase artifact writes route through MCP-owned tooling | directly_supported | REC-001 | local checkout only |", "| EVID-001 | CLM-001 | SRC-001 | background | codebase-summary | summary says validation exists | partially_supported | REC-001 | summary-only fixture |");

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.validation?.valid, true);
  assert.match(
    written.validation?.warnings.join("\n") ?? "",
    /repo_runtime claims should cite runtime-adequate evidence/i
  );
  assert.ok(
    written.validation?.diagnostics?.some(
      (diagnostic) => diagnostic.code === "research.repo_runtime_claim_retrieval_partial" && diagnostic.severity === "warning"
    )
  );
});

test("research validation returns warning diagnostics for weak recommendation handoff rows", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Create research with a recommendation that lacks planner-ready support."
  ).replace(
    "| REC-001 | Persist only validated research content through `blueprint_phase_artifact_write`. | CLM-001 | SRC-001 | src/mcp/tools/phase.ts, src/mcp/tools/artifacts.ts, tests/phase-discovery-research.test.ts | npx tsx --test tests/phase-discovery-research.test.ts | ready |",
    "| REC-001 | Persist only validated research content through `blueprint_phase_artifact_write`. |  |  |  |  | ready |"
  );

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.validation?.valid, true);
  assert.match(
    written.validation?.warnings.join("\n") ?? "",
    /Recommendation Handoff rows should cite supporting claim IDs or evidence IDs/i
  );
  assert.match(
    written.validation?.warnings.join("\n") ?? "",
    /Recommendation Handoff rows should name tests\/checks or validation signals/i
  );
  assert.ok(
    written.validation?.diagnostics?.some(
      (diagnostic) => diagnostic.code === "research.recommendation_missing_evidence" && diagnostic.severity === "warning"
    )
  );
  assert.ok(
    written.validation?.diagnostics?.some(
      (diagnostic) => diagnostic.code === "research.recommendation_missing_validation_signal" && diagnostic.severity === "warning"
    )
  );
});

test("research validation warns when repo-only output claims current official docs confirmed", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Current official docs confirm that research artifact validation should stay MCP-owned."
  );

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.validation?.valid, true);
  assert.match(
    written.validation?.warnings.join("\n") ?? "",
    /uses current external verification wording without an External Sources or Source Register row with an access date/i
  );
  assert.ok(
    written.validation?.diagnostics?.some(
      (diagnostic) => diagnostic.code === "research.live_external_claim_without_evidence" && diagnostic.severity === "warning"
    )
  );
});
```

Update the existing external URL access-date test to assert the dedicated diagnostic:

```ts
  assert.ok(
    written.validation?.diagnostics?.some(
      (diagnostic) => diagnostic.code === "research.external_source_missing_access_date" && diagnostic.severity === "warning"
    )
  );
```

Update the existing high-confidence unsupported-claims test to assert:

```ts
  assert.ok(
    written.validation?.diagnostics?.some(
      (diagnostic) => diagnostic.code === "research.high_confidence_unsupported" && diagnostic.severity === "warning"
    )
  );
```

Add a compatibility test after the new diagnostics tests:

```ts
test("research validation keeps legacy structurally valid research warning-only", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent("Create legacy-shaped research that remains structurally valid.")
    .replace(/## Claim Support Ledger[\s\S]*?\n## Locked Decisions From Context/, "## Locked Decisions From Context")
    .replace(/### Recommendation Handoff[\s\S]*?\n## Sources/, "- Persist only validated research content through `blueprint_phase_artifact_write`.\n\n## Sources")
    .replace(/### Source Register[\s\S]*?\n### Repo Evidence/, "### Repo Evidence");

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.status, "created");
  assert.equal(written.validation?.valid, true, written.validation?.issues.join("\n"));
  assert.match(written.validation?.warnings.join("\n") ?? "", /Recommendation Handoff|Source Register/i);
});
```

### `docs/commands/research-phase.md`

#### Subtractions

None.

#### Additions/Replacements

In `## Research Runtime Anchors`, extend the existing claim-addressable provenance bullet by appending:

```md
The preferred saved shape includes a Claim Support Ledger for planner-critical claims, a Source Register under `## Sources`, a Recommendation Handoff table under `## Recommendations`, and a Source-Support Self-Check before persistence.
```

In `## Test Cases`, add these bullets:

```md
- Source Register fixture where a claim cites a missing source ID and validation returns `research.source_id_missing_from_register` as a warning diagnostic.
- Evidence chain fixture where a claim cites `EVID-001`, `EVID-001` points to missing `SRC-404`, and validation returns `research.evidence_missing_source_register_link` as a warning diagnostic.
- Repository Runtime Support Rule fixture where a `repo_runtime` claim cites only external evidence and validation returns `research.repo_runtime_claim_missing_repo_evidence` as a warning diagnostic.
- Retrieval Adequacy Rule fixture where a `repo_runtime` claim cites only summary/search evidence and validation returns `research.repo_runtime_claim_retrieval_partial` as a warning diagnostic.
- Recommendation Handoff fixture where a planner-critical recommendation lacks supporting claims, affected surfaces, or tests/checks and validation returns `research.recommendation_missing_evidence` or `research.recommendation_missing_validation_signal` as warning diagnostics.
- Source Policy Honesty Rule fixture where `research.external_sources` is effectively `off` and research prose says "current official docs confirm" without allowed external evidence; validation returns `research.live_external_claim_without_evidence`.
- Sidecar External Evidence Boundary fixture where `agents/blueprint-researcher.md` requires `needs-parent-evidence`, parent-supplied external source IDs only, and a prohibition on self-fetched official-doc claims.
```

### `docs/ARTIFACT-SCHEMA.md`

#### Subtractions

None.

#### Additions/Replacements

In the `phase.research` section, add `## Claim Support Ledger` to the documented optional sections and update the template excerpt so it includes the same Claim Support Ledger, Recommendation Handoff, and Source Register snippets from `src/mcp/artifact-contracts/index.ts`.

Add this exact paragraph near the research validation notes:

```md
Research validation remains backward-compatible for structurally valid older artifacts. The richer evidence shape is warning-grade first: missing Source Register rows, missing claim/source IDs, repo-runtime claims without repo evidence, Recommendation Handoff gaps, missing external access dates, and unsupported high confidence return research evidence warning diagnostics unless a future contract makes them strict.
```

### `docs/MCP-TOOLS.md`

#### Subtractions

None.

#### Additions/Replacements

In the `research-phase` MCP summary row, append:

```md
Research validation also returns warning-grade evidence diagnostics for the Source Register, Claim Support Ledger, Recommendation Handoff, External Evidence Access-Date Rule, Repository Runtime Support Rule, and Confidence Evidence Rule while preserving compatibility for older structurally valid research artifacts.
```

In the phase artifact write notes, add:

```md
- Research validation warnings can include `diagnostics` with `severity: "warning"`. Warning diagnostics do not make `validation.valid=false`, but commands should report or repair them when they affect planner-critical recommendations.
```

## Dist And Build Expectations

Runtime source changes require rebuilt tracked output. After implementation, run:

```sh
npm ci
npm run build
```

The implementor should expect at least these built files to change:

- `dist/mcp/server.js`
- `dist/mcp/server.js.map`
- `dist/mcp/tools/artifacts.d.ts`
- `dist/mcp/tools/phase.d.ts`
- `dist/mcp/artifact-contracts/index.d.ts`

Because `scripts/build.mjs` bundles the MCP runtime into `dist/mcp/server.js`, the TypeScript implementation changes in `src/mcp/tools/artifacts.ts`, `src/mcp/tools/phase.ts`, and `src/mcp/artifact-contracts/index.ts` must be reflected in `dist/mcp/server.js` and its source map.

## Rollout Risks And Guardrails

- Keep this warning-only for richer evidence shape. The implementation should not block older structurally valid research artifacts only because they lack Claim Support Ledger, Source Register, or Recommendation Handoff tables.
- Keep repo-only mode honest and valid. When `research.external_sources` is `off`, research can still be valid, but it must avoid current external-confirmation claims or mark them unchecked.
- Keep parsers conservative. Markdown table parsing should ignore absent optional tables, preserve existing strict structural validation, and emit warning diagnostics only when optional rows are present but inconsistent or when prose clearly makes current external claims without evidence.
- Keep deterministic validation scoped to traceability. Do not claim it proves semantic citation precision or replaces human/model review.
- Rebuild tracked `dist/` output after source changes so installed extension behavior matches tests.

## Validation Commands

Run these commands after implementation:

```sh
npm ci
npm run typecheck
npx tsx --test tests/phase-discovery-research.test.ts
npm test -- --test-name-pattern=phase-discovery-research
npm run build
git diff --check
```

If the repository test script does not support `-- --test-name-pattern=phase-discovery-research`, replace that command with:

```sh
npm test
```

## Wording Hygiene Gate

After implementation and build, run these grep checks from the repo root. The searches must include built `dist/` output and must exclude `docs/imp/`:

```sh
rg -n --glob '!docs/imp/**' '\b(R6|R5|R4|R3|R2|R1)\b|post-R6|first implementation slice' commands skills agents src tests dist docs
rg -n --glob '!docs/imp/**' 'R6 work|R6 mode|R6 section|R6 validation|post-R6|first implementation slice|rollout label|plan-internal codename' commands skills agents src tests dist docs
rg -n --glob '!docs/imp/**' 'planning scope label|implementation slice|frontier research section|research rollout' commands skills agents src tests dist docs
```

Any hit in `commands/`, `skills/`, `agents/`, `src/`, `tests/`, `dist/`, or non-imp `docs/` must be fixed unless it is clearly unrelated historical documentation. Do not waive hits merely because they are in tests or built output. If a final product/runtime name is needed, use the names in `Final Product And Runtime Names`.

## Completion Checklist

- `commands/blu-research-phase.toml` mentions Source-Support Self-Check without adding new MCP tools.
- `research-phase-runtime-contract.md` defines Claim Support Ledger, Source Register, Recommendation Handoff, and the Source-Support Self-Check.
- `blueprint-phase-discovery/SKILL.md` completion checks include the richer evidence shape.
- `blueprint-researcher.md` can return claim, source, and recommendation rows without owning persistence.
- `renderResearchTemplate` emits Claim Support Ledger, Recommendation Handoff, and Source Register guidance.
- `validateResearchArtifactContent` emits warning diagnostics with stable codes for R7 evidence drift.
- `blueprintPhaseArtifactWrite` exposes diagnostics on warning-only valid writes.
- Focused tests cover valid rich artifacts, legacy warning-only compatibility, missing source IDs, repo-runtime support, weak recommendation handoffs, missing external access dates, unsupported high confidence, and contract wording.
- `dist/` is rebuilt.
- Wording Hygiene Gate passes outside `docs/imp/`.
