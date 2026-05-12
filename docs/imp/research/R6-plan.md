# R6 Implementation Plan

Status: planning artifact only. Do not implement source changes from this file until the plan is approved.

Source inputs used:
- `docs/imp/research/research-phase-frontier-research-and-improvement-plan.md`, specifically the planning-grade technical research artifact section.
- `commands/blu-research-phase.toml`
- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
- `skills/blueprint-phase-discovery/SKILL.md`
- `agents/blueprint-project-researcher.md`
- `agents/blueprint-researcher.md`
- Current local implementation surfaces in `src/mcp/artifact-contracts/index.ts`, `src/mcp/tools/artifacts.ts`, `src/mcp/tools/phase.ts`, `docs/ARTIFACT-SCHEMA.md`, `docs/commands/research-phase.md`, `tests/artifact-contracts.test.ts`, and `tests/phase-discovery-research.test.ts`.

No new upstream research is needed or allowed for this implementation. Use the local files above as the complete authority.

## Scope Guard

The implementation goal is to make `XX-RESEARCH.md` more directly consumable by `/blu-plan-phase` while preserving the existing research artifact contract.

- Keep every existing required top-level research heading unchanged.
- Keep `**Confidence:** LOW|MEDIUM|HIGH` unchanged.
- Keep `freehandPolicy: "additional-top-level-headings"` unchanged.
- Keep older valid research artifacts valid where possible.
- Keep the new checks warning-only and machine-readable first.
- Do not add new MCP tools.
- Do not change command routing, external-source policy semantics, subagent ownership, checkpoint ownership, or planning command behavior in this implementation.

## Minimum Implementation Slice

Only these changes are mandatory in this implementation:

- Header metadata: `Research Status`, `Planning Readiness`, and `Access Date`.
- `Planner Abstract` under `## Summary`.
- `Requirements Coverage Ledger` under `## Phase Requirements`.
- `Option Decision Matrix` under `## Alternatives Considered`.
- `Open Question Handling Ledger` under `## Open Questions`.
- `Evidence Grade Breakdown` under `## Confidence Breakdown`.
- `Plan Input Queue` under `## Recommendations`.
- `Source Register` and `Claim And Evidence Ledger` under `## Sources`.
- Stable warning diagnostics for the new planner-ready table checks.

Do not table-ize `## Locked Decisions From Context`, `## User Constraints`, `## Architecture Patterns`, `## Don't Hand-Roll`, `## Anti-Patterns`, `## State Of The Art`, `## Common Pitfalls`, or `## Code Examples` in this implementation. Those sections should stay close to the current template except where existing dependency/tool tables already exist.

## Product And Runtime Names

Use these labels only in files this implementation actually edits. This glossary prevents rollout labels and plan codenames from leaking into runtime-facing output; it does not authorize broad command, skill, agent, or product renames.

| Planning concept | Final product/runtime name |
|------------------|----------------------------|
| artifact status metadata | `Research Status` and `Planning Readiness` |
| summary handoff | `Planner Abstract` |
| requirement coverage table | `Requirements Coverage Ledger` |
| alternatives table | `Option Decision Matrix` |
| open-question table | `Open Question Handling Ledger` |
| confidence table | `Evidence Grade Breakdown` |
| recommendation handoff table | `Plan Input Queue` |
| source provenance table | `Source Register` |
| claim support table | `Claim And Evidence Ledger` |

## File Plan

### `src/mcp/artifact-contracts/index.ts`

Subtractions:

- In `renderResearchTemplate(...)`, replace the current header block:

```md
**Researched:** <YYYY-MM-DD>
**Domain:** ${domain(context)}
**Confidence:** LOW|MEDIUM|HIGH
```

- In `renderResearchTemplate(...)`, replace the current three-column `## Phase Requirements` table:

```md
| ID | Description | Research Support |
|----|-------------|------------------|
| <requirement-id> | <phase requirement> | <evidence-backed guidance> |
```

- In `renderResearchTemplate(...)`, replace the current one-bullet `## Summary` placeholder:

```md
- <key conclusion>
```

- In `renderResearchTemplate(...)`, replace the current one-bullet `## Alternatives Considered` placeholder:

```md
- <alternative considered and tradeoff>
```

- In `renderResearchTemplate(...)`, replace the current one-bullet `## Open Questions` placeholder:

```md
- <open question that still needs an answer>
```

- In `renderResearchTemplate(...)`, replace the current `## Confidence Breakdown` table:

```md
| Topic | Confidence | Why |
|-------|------------|-----|
| <topic> | LOW|MEDIUM|HIGH | <evidence-backed confidence explanation> |
```

- In `renderResearchTemplate(...)`, replace the current `## Recommendations` bullet:

```md
- <prescriptive recommendation with tradeoffs; cite DEP-001 when this adds, adopts, rejects, defers, upgrades, or hand-rolls a dependency/tool>
```

- In `renderResearchTemplate(...)`, replace the current `## Sources` opening so a `Source Register` and `Claim And Evidence Ledger` appear before `### Repo Evidence`.

Additions/Replacements:

- Use this header block in `renderResearchTemplate(...)`:

```md
**Researched:** <YYYY-MM-DD>
**Research Status:** COMPLETE|PARTIAL|BLOCKED
**Planning Readiness:** READY|NEEDS_DECISION|BLOCKED
**Access Date:** <YYYY-MM-DD or not applicable>
**Domain:** ${domain(context)}
**Confidence:** LOW|MEDIUM|HIGH
```

- Replace `## Phase Requirements` with this exact shape:

```md
## Phase Requirements

### Requirements Coverage Ledger

| Requirement ID | Research Topic | Recommendation IDs | Plan Implication | Blocking Unknowns | Evidence IDs |
|----------------|----------------|--------------------|------------------|-------------------|--------------|
| <requirement-id> | <topic or decision area> | REC-001 | <what the plan should do or avoid> | <none or OQ-001> | SRC-001, CLM-001 |
```

- Replace `## Summary` with this exact shape:

```md
## Summary

### Planner Abstract

- Planning posture: <recommended planning posture>
- Safest implementation shape: <smallest safe implementation shape>
- Do not plan yet: <none or exact blocker>
```

- Replace the start of `## Alternatives Considered` with this table, keeping the existing `### Dependency Alternatives` table after it:

```md
## Alternatives Considered

### Option Decision Matrix

| Option ID | Option | Pros | Cons | Disposition | Decision Driver | Evidence IDs | Plan Impact |
|-----------|--------|------|------|-------------|-----------------|--------------|-------------|
| OPT-001 | <option considered> | <benefit> | <cost or risk> | recommended|rejected|deferred | <driver or none> | SRC-001, CLM-001 | <task, guardrail, deferral, or none> |
```

- Replace `## Open Questions` with this exact shape:

```md
## Open Questions

### Open Question Handling Ledger

| Question ID | Question | Handling | Decision Or Evidence Needed | Blocks Planning? | Owner / Next Step |
|-------------|----------|----------|-----------------------------|------------------|-------------------|
| OQ-001 | <open question that still needs an answer> | blocks_plan|ask_before_planning|plan_time_investigation|defer_to_execution|out_of_scope | <exact decision or evidence needed> | yes|no | <user, planner, executor, or none> |
```

- Replace `## Confidence Breakdown` with this exact shape:

```md
## Confidence Breakdown

### Evidence Grade Breakdown

| Topic | Confidence | Evidence Grade | Direct Repo Evidence | External Evidence | Contradictions / Gaps | Planning Effect |
|-------|------------|----------------|----------------------|-------------------|-----------------------|-----------------|
| <topic> | LOW|MEDIUM|HIGH | direct|mixed|inferred|insufficient | <SRC or CLM ids, or none> | <SRC ids, declined, off, or none> | <none or exact gap> | plan_now|defer|block |
```

- Replace `## Recommendations` with this exact `Plan Input Queue` shape:

```md
## Recommendations

### Plan Input Queue

| Rec ID | Disposition | Covers Requirements | Recommended Approach | Read First | Target Surfaces | Evidence IDs | Acceptance Signals | Tests / Checks | Dependencies | Risks / Mitigations | Confidence | Blocking Unknowns |
|--------|-------------|---------------------|----------------------|------------|-----------------|--------------|--------------------|----------------|--------------|---------------------|------------|-------------------|
| REC-001 | plan_now | <requirement ids> | <planner-ready implementation direction> | <repo paths/docs> | <files, modules, commands, APIs, schemas> | SRC-001, CLM-001 | <observable target state> | <test, grep, file-read, or command checks> | <none or REC-000> | <risk and mitigation> | LOW|MEDIUM|HIGH | <none or OQ-001> |
```

- Add these sections immediately after `## Sources` and before the existing `### Repo Evidence` section:

```md
## Sources

### Source Register

| Source ID | Lane | Source Class | Path / URL | Role | Accessed / Version | Used For Claims | Limitations |
|-----------|------|--------------|------------|------|--------------------|-----------------|-------------|
| SRC-001 | repo|external|supplied|inference | repo_code|repo_test|repo_doc|command_manifest|skill_contract|mcp_contract|artifact_contract|official_external|supplied_external|package_registry|vulnerability_database|standard_or_paper|inference | <path, URL, DOI, command, or supplied label> | normative|informative|example_only|background|inference | <YYYY-MM-DD, local worktree, supplied-unchecked, version, or not applicable> | CLM-001 | <stale risk, access limit, line drift, unchecked source, or none> |

### Claim And Evidence Ledger

| Claim ID | Claim | Claim Class | Evidence IDs | Support Status | Confidence | Plan Impact |
|----------|-------|-------------|--------------|----------------|------------|-------------|
| CLM-001 | <planner-critical claim> | repo_runtime|repo_contract|external_practice|dependency_tool|security_or_privacy|inference|open_question | SRC-001 | directly_supported|partially_supported|inferred_from_supported|contradicted|conflicting_sources|not_enough_evidence|background_only|out_of_scope | LOW|MEDIUM|HIGH | supports REC-001 |
```

- Add these placeholder signals to the `phase.research.placeholderSignals` array:

```ts
"<YYYY-MM-DD or not applicable>",
"<topic or decision area>",
"<what the plan should do or avoid>",
"<recommended planning posture>",
"<smallest safe implementation shape>",
"<none or exact blocker>",
"<option considered>",
"<benefit>",
"<cost or risk>",
"<driver or none>",
"<task, guardrail, deferral, or none>",
"<exact decision or evidence needed>",
"<user, planner, executor, or none>",
"<SRC or CLM ids, or none>",
"<SRC ids, declined, off, or none>",
"<none or exact gap>",
"<planner-ready implementation direction>",
"<repo paths/docs>",
"<files, modules, commands, APIs, schemas>",
"<observable target state>",
"<test, grep, file-read, or command checks>",
"<none or REC-000>",
"<path, URL, DOI, command, or supplied label>",
"<YYYY-MM-DD, local worktree, supplied-unchecked, version, or not applicable>",
"<stale risk, access limit, line drift, unchecked source, or none>",
"<planner-critical claim>"
```

- Replace the existing research notes that describe planner-grade evidence density and claim-addressable provenance with these notes. Keep the existing first three notes unchanged.

```ts
"Research should preserve planner-grade evidence density: status metadata, a Planner Abstract, requirements coverage, option decisions, open-question handling, confidence by evidence grade, a Plan Input Queue, a Source Register, and a Claim And Evidence Ledger.",
"Plan Input Queue rows are research-layer handoff rows, not executable plans. They name recommended direction, read-first paths, target surfaces, evidence IDs, acceptance signals, tests/checks, dependencies, risks, confidence, and blockers so /blu-plan-phase can plan without re-inferring the research.",
"Planner-critical claims should use claim-addressable provenance with source IDs, claim IDs, evidence lanes, support status, source class, access/version metadata, limitations, and plan-impact notes; validation emits stable warning diagnostics instead of rejecting older valid artifacts that lack richer provenance.",
"When a phase recommendation depends on adding, adopting, replacing, upgrading, installing, vendoring, forking, code-generating, or hand-rolling a dependency/tool, research should include the dependency/tool evaluation, setup/update posture, alternatives, library-vs-custom decision, and supply-chain evidence rows in the existing required headings."
```

### `src/mcp/tools/artifacts.ts`

Subtractions:

- Do not remove existing dependency/tool warning checks.
- Do not remove existing claim-addressable source section warnings.
- Do not remove existing legacy bullet acceptance until the new table fixtures prove compatibility.
- Replace the strict recommendations check that only accepts bullets:

```ts
if (!/^- /m.test(recommendations)) {
  issues.push("Research artifact must include at least one bullet under Recommendations.");
}
```

- Replace the strict sources check that only accepts bullets:

```ts
if (!/^- /m.test(sources) || !containsSourceEvidence(sources)) {
  issues.push(
    "Research artifact must include at least one source bullet with a URL, repo path, or cited file."
  );
}
```

Additions/Replacements:

- Extend `validateResearchArtifactContent(...)` and `validatePhaseArtifactContent(...)` return shapes with warning diagnostics:

```ts
warningDiagnostics: PhaseArtifactValidationDiagnostic[];
```

- For non-research artifacts inside `validatePhaseArtifactContent(...)`, return `warningDiagnostics: []`.

- Add this local helper inside or near `validateResearchArtifactContent(...)`:

```ts
const warningDiagnostics: PhaseArtifactValidationDiagnostic[] = [];

function addResearchWarning(args: {
  code: string;
  message: string;
  heading?: string;
  missing?: string[];
  repair: string;
}): void {
  warnings.push(args.message);
  warningDiagnostics.push(
    phaseArtifactDiagnostic({
      artifact: "research",
      path: args.heading ? `## ${args.heading}` : "content",
      code: args.code,
      message: args.message,
      heading: args.heading,
      missing: args.missing,
      repair: args.repair
    })
  );
}
```

- Add these table helper types near the existing research helper functions:

```ts
type ResearchMarkdownTable = {
  tablePresent: boolean;
  headers: string[];
  missingHeaders: string[];
  rows: Record<string, string>[];
};

type ResearchSourceRegister = ResearchMarkdownTable & {
  ids: Set<string>;
  repoSourceIds: Set<string>;
};

type ResearchClaimLedger = ResearchMarkdownTable & {
  ids: Set<string>;
};
```

- Add these helpers near the current research helper functions, before `sourceLinesWithUrlsMissingAccessDate(...)`:

```ts
function normalizeResearchTableHeader(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function extractResearchSubsection(section: string, subheading: string): string {
  const escaped = subheading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = section.match(new RegExp(`(?:^|\\n)### ${escaped}\\s*\\n([\\s\\S]*?)(?=\\n### |\\n## |$)`, "m"));
  return match?.[1] ?? "";
}

function parseResearchMarkdownTable(section: string, requiredHeaders: readonly string[]): ResearchMarkdownTable {
  const lines = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\|.*\|$/.test(line));

  for (let index = 0; index < lines.length - 1; index += 1) {
    const headerCells = lines[index]!
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    const separatorCells = lines[index + 1]!
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    const isSeparator =
      separatorCells.length === headerCells.length &&
      separatorCells.every((cell) => /^:?-{3,}:?$/.test(cell));

    if (!isSeparator) {
      continue;
    }

    const normalizedHeaders = headerCells.map(normalizeResearchTableHeader);
    const missingHeaders = requiredHeaders.filter(
      (header) => !normalizedHeaders.includes(normalizeResearchTableHeader(header))
    );
    const rows: Record<string, string>[] = [];

    for (const rawRow of lines.slice(index + 2)) {
      const cells = rawRow
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim());

      if (cells.length !== headerCells.length) {
        break;
      }

      const row = Object.fromEntries(headerCells.map((header, cellIndex) => [header, cells[cellIndex] ?? ""]));
      if (Object.values(row).some((cell) => cell.length > 0)) {
        rows.push(row);
      }
    }

    return {
      tablePresent: true,
      headers: headerCells,
      missingHeaders,
      rows
    };
  }

  return {
    tablePresent: false,
    headers: [],
    missingHeaders: [...requiredHeaders],
    rows: []
  };
}

function getResearchRowValue(row: Record<string, string>, header: string): string {
  const normalizedHeader = normalizeResearchTableHeader(header);
  const entry = Object.entries(row).find(
    ([key]) => normalizeResearchTableHeader(key) === normalizedHeader
  );
  return entry?.[1]?.trim() ?? "";
}

function splitResearchIds(value: string): string[] {
  return value
    .split(/[,\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
}

function isEmptyResearchCell(value: string): boolean {
  return value.trim().length === 0 || /^<(?:[^>]+)>$/.test(value.trim());
}

function collectResearchRequirementRows(content: string): ResearchMarkdownTable {
  return parseResearchMarkdownTable(extractMarkdownSection(content, "Phase Requirements"), [
    "Requirement ID",
    "Research Topic",
    "Recommendation IDs",
    "Plan Implication",
    "Blocking Unknowns",
    "Evidence IDs"
  ]);
}

function collectResearchPlanInputRows(content: string): ResearchMarkdownTable {
  return parseResearchMarkdownTable(extractMarkdownSection(content, "Recommendations"), [
    "Rec ID",
    "Disposition",
    "Covers Requirements",
    "Recommended Approach",
    "Read First",
    "Target Surfaces",
    "Evidence IDs",
    "Acceptance Signals",
    "Tests / Checks",
    "Dependencies",
    "Risks / Mitigations",
    "Confidence",
    "Blocking Unknowns"
  ]);
}

function collectResearchSourceRegister(content: string): ResearchSourceRegister {
  const sources = extractMarkdownSection(content, "Sources");
  const table = parseResearchMarkdownTable(extractResearchSubsection(sources, "Source Register"), [
    "Source ID",
    "Lane",
    "Source Class",
    "Path / URL",
    "Role",
    "Accessed / Version",
    "Used For Claims",
    "Limitations"
  ]);
  const ids = new Set(table.rows.map((row) => getResearchRowValue(row, "Source ID")).filter(Boolean));
  const repoSourceIds = new Set(
    table.rows
      .filter((row) => /^repo$/i.test(getResearchRowValue(row, "Lane")))
      .map((row) => getResearchRowValue(row, "Source ID"))
      .filter(Boolean)
  );

  return {
    ...table,
    ids,
    repoSourceIds
  };
}

function collectResearchClaimLedger(content: string): ResearchClaimLedger {
  const sources = extractMarkdownSection(content, "Sources");
  const table = parseResearchMarkdownTable(extractResearchSubsection(sources, "Claim And Evidence Ledger"), [
    "Claim ID",
    "Claim",
    "Claim Class",
    "Evidence IDs",
    "Support Status",
    "Confidence",
    "Plan Impact"
  ]);

  return {
    ...table,
    ids: new Set(table.rows.map((row) => getResearchRowValue(row, "Claim ID")).filter(Boolean))
  };
}

function collectResearchOpenQuestionRows(content: string): ResearchMarkdownTable {
  return parseResearchMarkdownTable(extractMarkdownSection(content, "Open Questions"), [
    "Question ID",
    "Question",
    "Handling",
    "Decision Or Evidence Needed",
    "Blocks Planning?",
    "Owner / Next Step"
  ]);
}

function collectResearchConfidenceRows(content: string): ResearchMarkdownTable {
  return parseResearchMarkdownTable(extractMarkdownSection(content, "Confidence Breakdown"), [
    "Topic",
    "Confidence",
    "Evidence Grade",
    "Direct Repo Evidence",
    "External Evidence",
    "Contradictions / Gaps",
    "Planning Effect"
  ]);
}

function hasPlanInputQueueRows(recommendations: string): boolean {
  const table = parseResearchMarkdownTable(recommendations, [
    "Rec ID",
    "Disposition",
    "Covers Requirements",
    "Recommended Approach",
    "Read First",
    "Target Surfaces",
    "Evidence IDs",
    "Acceptance Signals",
    "Tests / Checks",
    "Dependencies",
    "Risks / Mitigations",
    "Confidence",
    "Blocking Unknowns"
  ]);

  return table.tablePresent && table.rows.some((row) => /^REC-\d{3}$/i.test(getResearchRowValue(row, "Rec ID")));
}

function hasSourceRegisterRows(sources: string): boolean {
  const table = parseResearchMarkdownTable(extractResearchSubsection(sources, "Source Register"), [
    "Source ID",
    "Lane",
    "Source Class",
    "Path / URL",
    "Role",
    "Accessed / Version",
    "Used For Claims",
    "Limitations"
  ]);

  return table.tablePresent && table.rows.some((row) => /^SRC-\d{3}$/i.test(getResearchRowValue(row, "Source ID")));
}
```

- Replace the recommendations strict check with:

```ts
if (!/^- /m.test(recommendations) && !hasPlanInputQueueRows(recommendations)) {
  issues.push("Research artifact must include at least one bullet or Plan Input Queue row under Recommendations.");
}
```

- Replace the sources strict check with:

```ts
if ((!/^- /m.test(sources) && !hasSourceRegisterRows(sources)) || !containsSourceEvidence(sources)) {
  issues.push(
    "Research artifact must include at least one source bullet or Source Register row with a URL, repo path, or cited file."
  );
}
```

- After `const sources = extractMarkdownSection(content, "Sources");`, collect the richer table state:

```ts
const requirementRows = collectResearchRequirementRows(content);
const planInputRows = collectResearchPlanInputRows(content);
const sourceRegister = collectResearchSourceRegister(content);
const claimLedger = collectResearchClaimLedger(content);
const openQuestionRows = collectResearchOpenQuestionRows(content);
const confidenceRows = collectResearchConfidenceRows(content);
```

- Add these warning diagnostics after the current claim-addressable evidence warnings and before dependency/tool warnings:

```ts
if (
  !/^\*\*Research Status:\*\*\s*(COMPLETE|PARTIAL|BLOCKED)\s*$/m.test(content) ||
  !/^\*\*Planning Readiness:\*\*\s*(READY|NEEDS_DECISION|BLOCKED)\s*$/m.test(content) ||
  !/^\*\*Access Date:\*\*\s*(?:\d{4}-\d{2}-\d{2}|not applicable)\s*$/m.test(content)
) {
  addResearchWarning({
    code: "research.header_metadata_missing",
    heading: "metadata",
    message: "Research artifact should include Research Status, Planning Readiness, and Access Date metadata near the header.",
    repair: "Add **Research Status:** COMPLETE|PARTIAL|BLOCKED, **Planning Readiness:** READY|NEEDS_DECISION|BLOCKED, and **Access Date:** YYYY-MM-DD or not applicable near the research header."
  });
}

if (sourceRegister.tablePresent && sourceRegister.missingHeaders.length > 0) {
  addResearchWarning({
    code: "research.source_register_missing_ids",
    heading: "Sources",
    missing: sourceRegister.missingHeaders,
    message: "Research artifact Source Register should include Source ID, Lane, Source Class, Path / URL, Role, Accessed / Version, Used For Claims, and Limitations.",
    repair: "Populate the Source Register with stable SRC-* IDs, evidence lane, source class, path or URL, role, access/version metadata, used-for claims, and limitations."
  });
}

if (
  sourceRegister.rows.some((row) => {
    const lane = getResearchRowValue(row, "Lane");
    const access = getResearchRowValue(row, "Accessed / Version");
    return /^(external|supplied)$/i.test(lane) && !/\d{4}-\d{2}-\d{2}|supplied-unchecked/i.test(access);
  })
) {
  addResearchWarning({
    code: "research.external_source_missing_access_date",
    heading: "Sources",
    message: "Research artifact external Source Register rows should include an access date YYYY-MM-DD or an explicit supplied-unchecked marker.",
    repair: "Add YYYY-MM-DD access dates for external source rows, or mark supplied-only rows as supplied-unchecked."
  });
}

if (
  claimLedger.rows.some((row) =>
    splitResearchIds(getResearchRowValue(row, "Evidence IDs")).some((id) => !sourceRegister.ids.has(id))
  )
) {
  addResearchWarning({
    code: "research.claim_missing_evidence",
    heading: "Sources",
    message: "Research artifact Claim And Evidence Ledger rows should reference Source Register IDs that exist.",
    repair: "Add the missing SRC-* source register rows or remove unsupported evidence IDs from the claim ledger."
  });
}

if (
  planInputRows.rows.some(
    (row) =>
      /^plan_now$/i.test(getResearchRowValue(row, "Disposition")) &&
      ["Covers Requirements", "Recommended Approach", "Read First", "Target Surfaces", "Evidence IDs", "Acceptance Signals", "Tests / Checks", "Confidence", "Blocking Unknowns"].some(
        (header) => isEmptyResearchCell(getResearchRowValue(row, header))
      )
  )
) {
  addResearchWarning({
    code: "research.recommendation_missing_plan_fields",
    heading: "Recommendations",
    message: "Research artifact Plan Input Queue rows with Disposition plan_now should include covered requirements, approach, read-first paths, target surfaces, evidence IDs, acceptance signals, tests/checks, confidence, and blocking unknowns.",
    repair: "Complete the Plan Input Queue handoff fields before relying on the row as planner-ready input."
  });
}

if (
  confidenceMatch?.[1] === "HIGH" &&
  (planInputRows.rows.some(
    (row) =>
      /^plan_now$/i.test(getResearchRowValue(row, "Disposition")) &&
      !/^(?:none|n\/a|not applicable)$/i.test(getResearchRowValue(row, "Blocking Unknowns"))
  ) ||
    openQuestionRows.rows.some(
      (row) =>
        /^yes$/i.test(getResearchRowValue(row, "Blocks Planning?")) ||
        /^blocks_plan$/i.test(getResearchRowValue(row, "Handling"))
    ) ||
    confidenceRows.rows.some(
      (row) =>
        /^block$/i.test(getResearchRowValue(row, "Planning Effect")) ||
        /insufficient/i.test(getResearchRowValue(row, "Evidence Grade"))
    ))
) {
  addResearchWarning({
    code: "research.high_confidence_with_blocker",
    heading: "Confidence Breakdown",
    message: "Research artifact should not use HIGH confidence while plan_now recommendations have blocking unknowns, unresolved blocker rows, or insufficient evidence.",
    repair: "Lower confidence, resolve the blocker, or classify the row as blocked before treating the research as planner-ready."
  });
}

if (
  claimLedger.rows.some((row) => {
    const claimClass = getResearchRowValue(row, "Claim Class");
    const evidenceIds = splitResearchIds(getResearchRowValue(row, "Evidence IDs"));
    return /^(repo_runtime|repo_contract)$/i.test(claimClass) && !evidenceIds.some((id) => sourceRegister.repoSourceIds.has(id));
  })
) {
  addResearchWarning({
    code: "research.repo_runtime_without_repo_source",
    heading: "Sources",
    message: "Research artifact repo runtime or repo contract claims should cite repo-lane source rows.",
    repair: "Cite repo code, tests, manifests, skills, contracts, MCP handlers, built entrypoints, or saved Blueprint artifacts for repo runtime claims."
  });
}
```

- Return `warningDiagnostics` from `validateResearchArtifactContent(...)`:

```ts
return {
  valid: issues.length === 0,
  issues,
  warnings,
  warningDiagnostics,
  diagnostics: issues.map((issue) =>
    phaseArtifactDiagnostic({
      artifact: "research",
      path: "content",
      code: "research.invalid",
      message: issue
    })
  )
};
```

- Do not make warning diagnostics affect `valid`. Deterministic checks should validate IDs, headers, source lanes, access dates, missing planner fields, and obvious confidence/blocker contradictions. Semantic citation-support precision remains advisory and is not strict validation in this implementation.

### `src/mcp/tools/phase.ts`

Subtractions:

- Replace the generic research repair fallback:

```ts
return ["Add the required research sections, confidence marker, and at least one cited source before retrying."];
```

Additions/Replacements:

- Use this exact fallback:

```ts
return [
  "Add the required research sections and confidence marker, populate Phase Requirements as a Requirements Coverage Ledger, populate Recommendations with at least one bullet or Plan Input Queue row, and populate Sources with a cited source bullet or Source Register row before retrying."
];
```

- Extend `PhaseArtifactWriteResult.validation` with:

```ts
warningDiagnostics?: PhaseArtifactValidationDiagnostic[];
```

- In invalid, reused, created, and updated write results, pass through `validation.warningDiagnostics`.

### `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`

Subtractions:

- Do not remove the existing evidence-quality, investigation-trace, strand-ledger, dependency/tool, sidecar, no-subagent, retry, or completion sections.
- In `Artifact Authoring Rules`, replace these existing bullets:
  - `` `## Phase Requirements` maps each in-scope requirement ID to the research finding that enables implementation or verification. ``
  - `` `## Summary` gives a concise executive recommendation, not just a list of topics inspected. ``
  - `` `## Alternatives Considered` records real tradeoffs, including why the recommendation is preferred. ``
  - `` `## Open Questions` lists only unresolved questions that matter downstream, with a recommended handling path. ``
  - `` `## Confidence Breakdown` assigns honest confidence by topic and explains the evidence behind each level. ``
  - `` `## Recommendations` is prescriptive enough for `/blu-plan-phase` to turn into tasks. ``
  - the current `## Sources` bullet that describes only split repo/external/inference sources.

Additions/Replacements:

- Insert this subsection in `Artifact Authoring Rules` immediately after the opening sentence "Populate every required section with substantive, phase-specific content before persistence.":

```md
Planner-ready research uses targeted ledgers inside existing required headings:

- Header metadata should include `Research Status: COMPLETE|PARTIAL|BLOCKED`, `Planning Readiness: READY|NEEDS_DECISION|BLOCKED`, and `Access Date: YYYY-MM-DD` or `not applicable` near `Researched` and `Confidence`.
- `## Phase Requirements` should contain a `Requirements Coverage Ledger` table with `Requirement ID`, `Research Topic`, `Recommendation IDs`, `Plan Implication`, `Blocking Unknowns`, and `Evidence IDs`.
- `## Summary` should contain a `Planner Abstract` with planning posture, safest implementation shape, and anything that should not be planned yet.
- `## Alternatives Considered` should contain an `Option Decision Matrix` with option, pros, cons, disposition, decision driver, evidence IDs, and plan impact.
- `## Open Questions` should contain an `Open Question Handling Ledger`; each question should be classified as `blocks_plan`, `ask_before_planning`, `plan_time_investigation`, `defer_to_execution`, or `out_of_scope`.
- `## Confidence Breakdown` should contain `Evidence Grade Breakdown` with direct repo evidence, external evidence, contradictions/gaps, and planning effect.
- `## Recommendations` should contain a `Plan Input Queue` when research has planner-critical recommendations.
- `## Sources` should contain a `Source Register` and `Claim And Evidence Ledger` plus the existing repo evidence, external sources, inference notes, and supply-chain evidence subsections when those evidence lanes are used.
```

- Replace the old individual bullets listed in Subtractions with these bullets:

```md
- `## Phase Requirements` maps each in-scope requirement ID to research topics, recommendation IDs, plan implications, blocking unknowns, and evidence IDs.
- `## Summary` gives a concise `Planner Abstract`, not just a list of topics inspected.
- `## Alternatives Considered` records real tradeoffs through an `Option Decision Matrix`, including why each option is recommended, rejected, deferred, or blocked.
- `## Open Questions` lists only downstream-relevant uncertainty and classifies each question by handling path.
- `## Confidence Breakdown` assigns honest confidence by topic and ties confidence to evidence grade, direct repo evidence, external evidence, contradictions/gaps, and planning effect.
- `## Recommendations` is a research-layer `Plan Input Queue`; it is not an executable plan, but it must be concrete enough for `/blu-plan-phase` to map rows into plan candidates without re-inferring the research.
- `## Sources` includes a `Source Register`, `Claim And Evidence Ledger`, `Repo Evidence`, `External Sources`, and `Inference Notes`. Source rows identify source lane, class, path or URL, role, access/version metadata, claims they support, and limitations. Claim rows identify claim class, evidence IDs, support status, confidence, and plan impact.
```

- In `Output Quality Criteria`, add these bullets after "requirements are mapped to research support":

```md
- header metadata states whether research is complete, partial, or blocked and whether planning is ready, needs a decision, or blocked
- requirements coverage rows include recommendation IDs, plan implications, blocking unknowns, and evidence IDs
- recommendations use stable `REC-*` IDs and `Disposition` values: `plan_now`, `defer`, `block`, or `reject`
- `Disposition=plan_now` rows name covered requirements, recommended approach, read-first paths, target surfaces, evidence IDs, acceptance signals, tests/checks, dependencies, risks/mitigations, confidence, and blocking unknowns
- open questions are classified as `blocks_plan`, `ask_before_planning`, `plan_time_investigation`, `defer_to_execution`, or `out_of_scope`
- source register rows identify source lane, source class, access/version metadata, used-for claims, and limitations
- claim ledger rows identify planner-critical claims, claim class, evidence IDs, support status, confidence, and plan impact
```

### `docs/ARTIFACT-SCHEMA.md`

Subtractions:

- In the `XX-RESEARCH.md` "Canonical template structure" list, replace:
  - `## Phase Requirements`
  - `## Summary`
  - `## Alternatives Considered` with optional dependency alternatives table
  - `## Open Questions`
  - `## Confidence Breakdown`
  - `## Recommendations`
  - `## Sources` split into `Repo Evidence`, `External Sources`, and `Inference Notes`, with optional supply-chain evidence rows

- In the exact persistence template, replace only the section bodies listed for `src/mcp/artifact-contracts/index.ts` with the exact new Markdown shapes from that section. Leave the other sections close to their current shapes.

Additions/Replacements:

- In the `XX-RESEARCH.md` "Canonical template structure" list, use this wording for the changed parts:

```md
- `**Research Status:** COMPLETE|PARTIAL|BLOCKED`
- `**Planning Readiness:** READY|NEEDS_DECISION|BLOCKED`
- `**Access Date:** YYYY-MM-DD` or `not applicable`
- `## Phase Requirements` with `Requirements Coverage Ledger`
- `## Summary` with `Planner Abstract`
- `## Alternatives Considered` with `Option Decision Matrix` and optional dependency alternatives table
- `## Open Questions` with `Open Question Handling Ledger`
- `## Confidence Breakdown` with `Evidence Grade Breakdown`
- `## Recommendations` with `Plan Input Queue`
- `## Sources` with `Source Register`, `Claim And Evidence Ledger`, `Repo Evidence`, `External Sources`, `Inference Notes`, and optional supply-chain evidence rows
```

- Add these validation expectations:

```md
- `Plan Input Queue` rows are research-layer handoff rows, not executable plan tasks
- `Disposition=plan_now` rows should include covered requirements, read-first paths, target surfaces, evidence IDs, acceptance signals, tests/checks, dependencies, risks/mitigations, confidence, and blocking unknowns
- `Source Register` rows should identify source lane, source class, path or URL, access/version metadata, used-for claims, and limitations
- external and supplied source-register rows should include an access date or an explicit supplied-unchecked marker
- `Claim And Evidence Ledger` rows should link planner-critical `CLM-*` claims to existing `SRC-*` source rows and include support status, confidence, and plan impact
- warning diagnostics use stable `research.*` codes while preserving compatibility for older valid research artifacts
```

- Replace the exact persistence template section bodies with the exact Markdown from `src/mcp/artifact-contracts/index.ts` for the changed sections only. Keep the surrounding fenced Markdown block intact.

### `docs/commands/research-phase.md`

Subtractions:

- Do not remove existing command behavior, external-source, checkpoint, sidecar, dependency/tool, or routing guidance.
- Replace any sentence that only says recommendations should be "prescriptive" if it does not name the new handoff tables.

Additions/Replacements:

- Add this bullet under the user-visible behavior or quality expectations section that already discusses planner-ready recommendations:

```md
- Saved research uses planner-ready ledgers inside selected existing headings: `Planner Abstract`, `Requirements Coverage Ledger`, `Option Decision Matrix`, `Open Question Handling Ledger`, `Evidence Grade Breakdown`, `Plan Input Queue`, `Source Register`, and `Claim And Evidence Ledger`. These are research handoff structures, not executable plans.
```

- Add this bullet near the validation/test expectations section:

```md
- Warning-grade validation diagnostics should use stable `research.*` codes for missing header metadata, weak source-register rows, missing claim evidence, missing Plan Input Queue fields, high confidence with blockers, and repo-runtime claims without repo sources while keeping older otherwise-valid research artifacts compatible.
```

### `tests/artifact-contracts.test.ts`

Subtractions:

- In `canonicalResearchContent(...)`, replace the old header metadata, `## Phase Requirements` table, `## Summary` bullet, `## Alternatives Considered` opening bullet, `## Open Questions` bullet, `## Confidence Breakdown` table, `## Recommendations` bullet, and `## Sources` opening shape with the new template-compatible shapes.
- Do not remove the dependency/tool fixture sections or the extra top-level heading fixture.
- Do not add assertions for optional follow-on ledger names such as `Decision Drivers And Stakeholder Concerns`, `Scope Boundary And Non-Goals`, `Target Surface Ledger`, `Implementation Guardrail Ledger`, `External Evidence And Currency`, `Risks, Mitigations, And Compatibility`, or `Plan-Safe Code Examples`.

Additions/Replacements:

- In `canonicalResearchContent(...)`, use these exact snippets:

```md
**Researched:** 2026-04-18
**Research Status:** COMPLETE
**Planning Readiness:** READY
**Access Date:** not applicable
**Domain:** blueprint contracts
**Confidence:** HIGH
```

```md
## Phase Requirements

### Requirements Coverage Ledger

| Requirement ID | Research Topic | Recommendation IDs | Plan Implication | Blocking Unknowns | Evidence IDs |
|----------------|----------------|--------------------|------------------|-------------------|--------------|
${requirementRows}

## Summary

### Planner Abstract

- Planning posture: ${summary}
- Safest implementation shape: Keep the MCP-owned validator path and update focused fixtures.
- Do not plan yet: none
```

- Change requirement row call sites to pass rows shaped like:

```md
| LIFE-01 | Research artifact validation | REC-001 | Keep endpoint research grounded in MCP validation. | none | SRC-001, CLM-001 |
```

- Replace the start of `## Alternatives Considered` in `canonicalResearchContent(...)` with:

```md
## Alternatives Considered

### Option Decision Matrix

| Option ID | Option | Pros | Cons | Disposition | Decision Driver | Evidence IDs | Plan Impact |
|-----------|--------|------|------|-------------|-----------------|--------------|-------------|
| OPT-001 | Prompt-local research outline | quick to draft | drifts from MCP contract | rejected | contract ownership | SRC-001, CLM-001 | Keep contract as source of truth. |
```

- Replace `## Open Questions` in `canonicalResearchContent(...)` with:

```md
## Open Questions

### Open Question Handling Ledger

| Question ID | Question | Handling | Decision Or Evidence Needed | Blocks Planning? | Owner / Next Step |
|-------------|----------|----------|-----------------------------|------------------|-------------------|
| OQ-001 | Should critical external claims eventually require multi-source support? | defer_to_execution | Future validation policy decision. | no | planner follow-up if needed |
```

- Replace the confidence table in `canonicalResearchContent(...)` with:

```md
## Confidence Breakdown

### Evidence Grade Breakdown

| Topic | Confidence | Evidence Grade | Direct Repo Evidence | External Evidence | Contradictions / Gaps | Planning Effect |
|-------|------------|----------------|----------------------|-------------------|-----------------------|-----------------|
| Contract parity | HIGH | direct | SRC-001 | off | none | plan_now |
```

- Replace the recommendations bullet in `canonicalResearchContent(...)` with:

```md
## Recommendations

### Plan Input Queue

| Rec ID | Disposition | Covers Requirements | Recommended Approach | Read First | Target Surfaces | Evidence IDs | Acceptance Signals | Tests / Checks | Dependencies | Risks / Mitigations | Confidence | Blocking Unknowns |
|--------|-------------|---------------------|----------------------|------------|-----------------|--------------|--------------------|----------------|--------------|---------------------|------------|-------------------|
| REC-001 | plan_now | LIFE-01 | Fetch the canonical contract before persistence. | src/mcp/artifact-contracts/index.ts, src/mcp/tools/artifacts.ts | src/mcp/tools/artifacts.ts, tests/artifact-contracts.test.ts | SRC-001, CLM-001 | Contract read exposes the research authoring template. | npx tsx --test tests/artifact-contracts.test.ts | none | Keep required headings stable. | HIGH | none |
```

- Add `### Source Register` and `### Claim And Evidence Ledger` immediately after `## Sources` in `canonicalResearchContent(...)`:

```md
### Source Register

| Source ID | Lane | Source Class | Path / URL | Role | Accessed / Version | Used For Claims | Limitations |
|-----------|------|--------------|------------|------|--------------------|-----------------|-------------|
| SRC-001 | repo | artifact_contract | src/mcp/artifact-contracts/index.ts | normative | local worktree | CLM-001 | line numbers may drift |

### Claim And Evidence Ledger

| Claim ID | Claim | Claim Class | Evidence IDs | Support Status | Confidence | Plan Impact |
|----------|-------|-------------|--------------|----------------|------------|-------------|
| CLM-001 | The MCP artifact contract is the canonical research template source. | repo_contract | SRC-001 | directly_supported | HIGH | supports REC-001 |
```

- Add these exact assertions to the existing contract template test near the current research template assertions:

```ts
assert.match(researchContract.authoringTemplate, /Research Status/);
assert.match(researchContract.authoringTemplate, /Planning Readiness/);
assert.match(researchContract.authoringTemplate, /Access Date/);
assert.match(researchContract.authoringTemplate, /Requirements Coverage Ledger/);
assert.match(researchContract.authoringTemplate, /Planner Abstract/);
assert.match(researchContract.authoringTemplate, /Option Decision Matrix/);
assert.match(researchContract.authoringTemplate, /Open Question Handling Ledger/);
assert.match(researchContract.authoringTemplate, /Evidence Grade Breakdown/);
assert.match(researchContract.authoringTemplate, /Plan Input Queue/);
assert.match(researchContract.authoringTemplate, /Source Register/);
assert.match(researchContract.authoringTemplate, /Claim And Evidence Ledger/);
```

- Add this new test after the existing dependency/tool warning test:

```ts
test("research contract returns warning diagnostics for incomplete planner handoff rows", () => {
  const research = canonicalResearchContent(
    "Keep registry updates aligned with MCP.",
    "| LIFE-01 | Research artifact validation | REC-001 | Keep endpoint research grounded in MCP validation. | none | SRC-001, CLM-001 |"
  ).replace(
    "| REC-001 | plan_now | LIFE-01 | Fetch the canonical contract before persistence. | src/mcp/artifact-contracts/index.ts, src/mcp/tools/artifacts.ts | src/mcp/tools/artifacts.ts, tests/artifact-contracts.test.ts | SRC-001, CLM-001 | Contract read exposes the research authoring template. | npx tsx --test tests/artifact-contracts.test.ts | none | Keep required headings stable. | HIGH | none |",
    "| REC-001 | plan_now | LIFE-01 | Fetch the canonical contract before persistence. |  |  |  |  |  | none | Keep required headings stable. | HIGH | none |"
  );

  const validation = validateResearchArtifactContent(research);

  assert.equal(validation.valid, true, validation.issues.join("\n"));
  assert.match(
    validation.warnings.join("\n"),
    /Plan Input Queue rows with Disposition plan_now/
  );
  assert.ok(
    validation.warningDiagnostics.some(
      (diagnostic) => diagnostic.code === "research.recommendation_missing_plan_fields"
    )
  );
});
```

### `tests/phase-discovery-research.test.ts`

Subtractions:

- In `validResearchContent(...)`, replace the same old research header, table, and bullet bodies as in `tests/artifact-contracts.test.ts`.
- Do not remove existing tests for command tool names, source-policy text, investigation trace, claim-addressable provenance, external access-date warnings, high-confidence warnings, dependency/tool warnings, selected-phase routing, or invalid reuse.
- Do not add assertions for optional follow-on ledger names such as `Decision Drivers And Stakeholder Concerns`, `Scope Boundary And Non-Goals`, `Target Surface Ledger`, `Implementation Guardrail Ledger`, `External Evidence And Currency`, `Risks, Mitigations, And Compatibility`, or `Plan-Safe Code Examples`.

Additions/Replacements:

- Update `validResearchContent(...)` to include:
  - `Research Status`
  - `Planning Readiness`
  - `Access Date`
  - `Requirements Coverage Ledger`
  - `Planner Abstract`
  - `Option Decision Matrix`
  - `Open Question Handling Ledger`
  - `Evidence Grade Breakdown`
  - `Plan Input Queue`
  - `Source Register`
  - `Claim And Evidence Ledger`

- Add these exact scaffold/template assertions to the existing scaffold test:

```ts
assert.match(scaffold, /Research Status/);
assert.match(scaffold, /Planning Readiness/);
assert.match(scaffold, /Access Date/);
assert.match(scaffold, /Requirements Coverage Ledger/);
assert.match(scaffold, /Planner Abstract/);
assert.match(scaffold, /Option Decision Matrix/);
assert.match(scaffold, /Open Question Handling Ledger/);
assert.match(scaffold, /Evidence Grade Breakdown/);
assert.match(scaffold, /Plan Input Queue/);
assert.match(scaffold, /Source Register/);
assert.match(scaffold, /Claim And Evidence Ledger/);
```

- Add these exact contract assertions to the `phase artifact write creates, reuses, updates, and validates research content` test near the current `authoringTemplate` assertions:

```ts
assert.match(contract.contract.authoringTemplate, /Research Status/);
assert.match(contract.contract.authoringTemplate, /Planning Readiness/);
assert.match(contract.contract.authoringTemplate, /Access Date/);
assert.match(contract.contract.authoringTemplate, /Requirements Coverage Ledger/);
assert.match(contract.contract.authoringTemplate, /Plan Input Queue/);
assert.match(contract.contract.authoringTemplate, /Source Register/);
assert.match(contract.contract.authoringTemplate, /Claim And Evidence Ledger/);
assert.match(contract.contract.notes.join("\n"), /Plan Input Queue rows are research-layer handoff rows/);
```

- Add this new warning fixture after the existing high-confidence warning test:

```ts
test("research validation returns warning diagnostics for incomplete Plan Input Queue rows", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Create research with an incomplete Plan Input Queue row."
  ).replace(
    "| REC-001 | plan_now | LIFE-02 | Persist only validated research content through `blueprint_phase_artifact_write`. | src/mcp/tools/phase.ts, src/mcp/tools/artifacts.ts | src/mcp/tools/phase.ts, tests/phase-discovery-research.test.ts | SRC-001, CLM-001 | Research writes remain MCP-owned and validated. | npx tsx --test tests/phase-discovery-research.test.ts | none | Keep routing and validation ownership unchanged. | HIGH | none |",
    "| REC-001 | plan_now | LIFE-02 | Persist only validated research content through `blueprint_phase_artifact_write`. |  |  |  |  |  | none | Keep routing and validation ownership unchanged. | HIGH | none |"
  );

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  assert.equal(written.validation?.valid, true, written.validation?.issues.join("\n"));
  assert.match(
    written.validation?.warnings.join("\n") ?? "",
    /Plan Input Queue rows with Disposition plan_now/
  );
  assert.ok(
    written.validation?.warningDiagnostics?.some(
      (diagnostic) => diagnostic.code === "research.recommendation_missing_plan_fields"
    )
  );
});
```

- Add this new warning fixture after the Plan Input Queue warning test:

```ts
test("research validation returns warning diagnostics for Source Register and claim evidence gaps", async (t) => {
  const repoPath = await createPhaseRepo();
  t.after(async () => {
    await rm(path.dirname(repoPath), { recursive: true, force: true });
  });

  await blueprintArtifactScaffold({
    cwd: repoPath,
    artifacts: [".blueprint/phases/03-phase-discovery/03-CONTEXT.md"]
  });

  const content = validResearchContent(
    "Create research with external source and claim evidence gaps."
  )
    .replace(
      "| SRC-001 | repo | repo_code | src/mcp/tools/phase.ts | normative | local worktree | CLM-001 | line numbers may drift |",
      "| SRC-001 | external | official_external | https://example.com/docs | normative | unchecked | CLM-001 | may drift |"
    )
    .replace(
      "| CLM-001 | Research writes route through MCP-owned tooling. | repo_runtime | SRC-001 | directly_supported | HIGH | supports REC-001 |",
      "| CLM-001 | Research writes route through MCP-owned tooling. | repo_runtime | SRC-999 | directly_supported | HIGH | supports REC-001 |"
    );

  const written = await blueprintPhaseArtifactWrite({
    cwd: repoPath,
    phase: "3",
    artifact: "research",
    content,
    overwrite: true
  });

  const warningCodes = written.validation?.warningDiagnostics?.map((diagnostic) => diagnostic.code) ?? [];

  assert.equal(written.validation?.valid, true, written.validation?.issues.join("\n"));
  assert.ok(warningCodes.includes("research.external_source_missing_access_date"));
  assert.ok(warningCodes.includes("research.claim_missing_evidence"));
  assert.ok(warningCodes.includes("research.repo_runtime_without_repo_source"));
});
```

- Update existing external-date warning tests only if their string expectations need to include both old evidence-lane tables and the new source-register warning. Keep the old expectation:

```ts
/external source rows should include `accessed YYYY-MM-DD`/
```

### Files Intentionally Not Edited

Subtractions:

- None.

Additions/Replacements:

- Do not edit `commands/blu-research-phase.toml` for this implementation. It already delegates detailed behavior to the runtime contract and already names planner-critical provenance, repository investigation traces, strand handoffs, and sidecar packet boundaries.
- Do not edit `skills/blueprint-phase-discovery/SKILL.md` for this implementation. It already delegates `/blu-research-phase` detail to `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md` and should not duplicate artifact tables.
- Do not edit `agents/blueprint-project-researcher.md`. It is for bootstrap research, not phase research artifact authoring.
- Do not edit `agents/blueprint-researcher.md`. The current sidecar contract already says the parent owns final artifact synthesis and that sidecars return planning handoff fields, not final persisted research.
- Do not edit `/blu-plan-phase` skill, runtime contract, docs, or source in this implementation. The `Plan Input Queue` is being made available in saved research; teaching `/blu-plan-phase` to consume it as primary input is a separate product change.

## Dist And Build Expectations

Runtime source changes in `src/mcp/artifact-contracts/index.ts`, `src/mcp/tools/artifacts.ts`, and `src/mcp/tools/phase.ts` require a rebuild.

After implementation:

- Run `npm ci` first if the checkout or worktree does not already have a current `node_modules` installed from the lockfile.
- Run focused tests before build.
- Run `npm run typecheck`.
- Run `npm run build`.
- Include tracked `dist/` changes produced by the build. Gemini launches `dist/mcp/server.js`, so source-only runtime changes are incomplete.

## Validation Commands

Run this sequence from repo root:

```bash
npm ci
npx tsx --test tests/artifact-contracts.test.ts tests/phase-discovery-research.test.ts
npm run typecheck
npm run build
npx tsx --test tests/artifact-contracts.test.ts tests/phase-discovery-research.test.ts
git status --short
```

If the focused tests reveal metadata drift, add and run the narrow metadata test that failed. Do not run `npm test -- <file>` as the focused shortcut; use `npx tsx --test <files>`.

## Wording Hygiene Gate

Before opening a PR, run these checks after `npm run build` so built output is covered. Exclude `docs/imp/**` only.

```bash
rg -n --glob '!docs/imp/**' '\b(R6|R5|R4|R3|R2|R1)\b|post-R6|first implementation slice' commands skills agents src tests dist docs
rg -n --glob '!docs/imp/**' 'R6 work|R6 mode|R6 section|R6 validation|post-R6|first implementation slice|planning scope label|rollout label|plan-internal codename' commands skills agents src tests dist docs
```

Any hit introduced by this implementation must be fixed when it leaks rollout labels or plan-internal codenames into runtime-facing files. This gate does not authorize unrelated renames. The final product/runtime wording must use the names in "Product And Runtime Names" for this implementation's actual `phase.research` template changes.

## Completion Checklist

- `docs/imp/research/R6-plan.md` was the only planning file created by this task.
- Implementation keeps required research headings stable.
- Implementation keeps new checks warning-first and machine-readable.
- Implementation includes header metadata, the Plan Input Queue, the Source Register, and the Claim And Evidence Ledger.
- Implementation does not introduce new MCP tools.
- Implementation does not alter command routing or external-source policy semantics.
- Implementation updates `dist/` after runtime source edits.
- Wording hygiene grep passes or all remaining hits are justified as unrelated historical documentation.
