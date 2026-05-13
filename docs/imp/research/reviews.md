# /blu-research-phase MCP Review

Date: 2026-05-13
Worktree: `/Users/rhishi/dev/repositories/blueprint-research-mcp-review`
Branch: `codex/research-mcp-review`
Comparison base: `bdea90dfc29ba70ef89472166bd8d045a289742c`
Comparison command: `git diff bdea90dfc29ba70ef89472166bd8d045a289742c..HEAD`

Note: `bdea90dfc29ba70ef89472166bd8d045a289742c` is not an ancestor of this branch. Reviews used the explicit two-endpoint diff requested above.

## Scope

This review used Codex harness and tools only. No GSD or Blueprint workflow commands were used.

Review agents:

| Lane | Model | Focus |
|------|-------|-------|
| R1 | GPT-5.5 high | Changed MCP code diff, correctness bugs |
| R2 | GPT-5.5 high | MCP code triggered across the full `/blu-research-phase` workflow |
| R3 | GPT-5.5 high | Changed MCP code diff, code smells |
| R4 | GPT-5.4 high | Schema, contract, and validation side effects between base and HEAD |

Simulation agents:

| Lane | Model | Focus |
|------|-------|-------|
| S1 | GPT-5.4-mini medium | Split source tables, external accessed table, high confidence unchecked rows |
| S2 | GPT-5.4-mini medium | Install text, complete dependency evidence, placeholder tokens in fenced code |
| S3 | GPT-5.4-mini medium | Control save, scaffold intent, invalid UI-spec routing |

Primary MCP files reviewed:

- `src/mcp/artifact-contracts/index.ts`
- `src/mcp/command-runtime-metadata.ts`
- `src/mcp/tools/artifacts.ts`
- `src/mcp/tools/phase.ts`
- `src/mcp/tools/phase-checkpoint-records.ts`
- `src/mcp/tools/config.ts`
- `src/mcp/tools/state.ts`
- `src/mcp/tools/project.ts`
- `src/mcp/tool-definitions.ts`
- `src/mcp/public-response.ts`
- `src/mcp/response-sanitizer.ts`

Relevant command, skill, and contract context:

- `commands/blu-research-phase.toml`
- `skills/blueprint-phase-discovery/SKILL.md`
- `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
- `docs/ARTIFACT-SCHEMA.md`
- `docs/MCP-TOOLS.md`
- `docs/commands/research-phase.md`

Baseline verification before writing this review:

- `npm ci` completed in the new worktree.
- `npm test -- tests/phase-discovery-research.test.ts tests/artifact-contracts.test.ts tests/phase-discovery-tools.test.ts tests/mcp-contract-audit-metadata.test.ts` expanded through the repo test script and passed the full suite: 1222 tests, 0 failures.

## Severity Remapping

Severity was remapped after deduplication using runtime impact:

| Severity | Mapping Rule |
|----------|--------------|
| Critical | Data loss, cross-project mutation, or command routing to a dangerous unsupported action. None found. |
| High | Strict MCP persistence failure for canonical or likely research output, or next-action routing that can advance the workflow past an invalid required artifact. |
| Medium | Warning-only diagnostics that mislead users or agents, rare strict failures, contract/API mismatch without direct data loss, or maintainability debt likely to create future bugs. |
| Low | Advisory maintainability, doc drift, or noisy diagnostics with narrow impact. |

## Deduplicated Findings

### RRV-01: Table-only claim-addressable Sources are rejected in strict mode

Severity: High

Evidence:

- `src/mcp/artifact-contracts/index.ts:1053` makes `## Sources` primarily a split table register with `### Repo Evidence`, `### External Sources`, and `### Inference Notes`.
- `src/mcp/tools/artifacts.ts:2996` still requires a `- ` bullet under `## Sources`.
- R1, R4, and S1 independently reproduced the failure.

Impact:

New-format research that follows the claim-addressable table contract can fail `blueprint_phase_artifact_write` in default strict mode. A failed write leaves `hasResearch=false` or `researchValid=null/false`, blocking plan readiness even though the artifact shape matches the new contract direction.

Simulation result:

S1 generated a full-size research document with split source tables and no bullet source lines. `blueprintPhaseArtifactWrite` returned `status: "invalid"` with:

`Research artifact must include at least one source bullet with a URL, repo path, or cited file.`

Recommended fix direction:

Treat populated claim-addressable source table rows as source evidence. The hard gate should accept either legacy bullet evidence or table evidence with a repo path, URL, DOI, command, test output, manifest, or saved Blueprint artifact reference. Add a regression test for split-source-only content.

### RRV-02: `blueprint_state_load` can route to `/blu-plan-phase` when an existing UI spec is invalid

Severity: High

Evidence:

- `src/mcp/tools/phase.ts:3168` in `blueprint_phase_research_status` treats an unusable UI spec as a blocker and routes to `/blu-ui-phase`.
- `src/mcp/tools/state.ts:2119` computes `uiReady` from existence only: `!workflow.uiPhaseEnabled || hasUiSpec`.
- `src/mcp/tools/state.ts:1428` checks UI spec presence/reviewability but not validity/usability.
- R2 identified the mismatch; S3 reproduced it with actual MCP calls.

Impact:

After a successful research write or valid reuse path, `/blu-research-phase` must call `blueprint_state_update({ base: "synced" })` and then `blueprint_state_load`. If `03-UI-SPEC.md` exists but is scaffold-only or invalid, status says repair UI, but state routing can advance to `/blu-plan-phase 3`. That can let planning consume unusable discovery input.

Simulation result:

S3 created a phase with valid context, valid research, and scaffold `03-UI-SPEC.md`. `blueprintPhaseResearchStatus` returned `uiSpecValid=false` and suggested `/blu-ui-phase`, but `blueprintStateLoad` returned:

`Run /blu-plan-phase 3 to create execution-ready phase plans`

Recommended fix direction:

Have state inspection validate UI-spec usability with the same artifact validation used by `blueprint_phase_research_status`, then derive next action from usable artifacts rather than mere existence. Preserve explicit UI skip rationale as usable.

### RRV-03: `blueprint_artifact_scaffold` cannot satisfy the research command's numeric phase scaffold contract

Severity: Medium

Evidence:

- `commands/blu-research-phase.toml:30` tells the command to pass numeric `phase` and never pass directories, slugs, filenames, or bare artifact names back into phase-write or scaffold tools.
- `src/mcp/tools/artifacts.ts:1956` and nearby scaffold parsing accept repo-relative artifact paths, not `{ phase, artifact }`.
- If no `artifacts` path is supplied, `blueprint_artifact_scaffold` falls back to bootstrap scaffolds.
- R2 found the contract/API mismatch; S3 reproduced it.

Impact:

The command has no MCP-owned way to say "scaffold research for phase 3" with only numeric phase and artifact intent. To use scaffold correctly, a caller must reconstruct `.blueprint/phases/<phase-dir>/<prefix>-RESEARCH.md`, which violates the command-local contract. If it passes numeric phase/artifact fields, those fields are ignored and bootstrap artifacts may be reused instead.

Simulation result:

S3 called `blueprintArtifactScaffold({ cwd, phase: "3", artifact: "research" } as any)`. The result reused bootstrap paths and did not create `03-RESEARCH.md`; `blueprintPhaseArtifactRead` then returned `found: false`.

Recommended fix direction:

Add a phase-scoped scaffold API, for example `blueprint_phase_artifact_scaffold({ phase, artifact })`, or extend the existing scaffold tool with an explicit phase-artifact input shape that resolves through `blueprint_phase_locate`.

### RRV-04: External Sources table `Accessed` dates are not recognized by the live-verification warning

Severity: Medium

Evidence:

- `src/mcp/artifact-contracts/index.ts:1063` defines an `External Sources` table with an `Accessed` column.
- `src/mcp/tools/artifacts.ts:2832` only recognizes prose matching `accessed YYYY-MM-DD`.
- R1 identified the mismatch; S1 reproduced it.

Impact:

Research can follow the canonical table shape and still receive a warning saying live external verification lacks access-date evidence. This warning is non-blocking, but it nudges agents to lower confidence or mark claims unchecked even when the table supplied the access date.

Simulation result:

S1 generated full-size research with live/current wording and an External Sources table row containing URL plus `Accessed = 2026-05-13`. The write succeeded, but emitted:

`Research artifact appears to use live external verification wording without an External Sources row with an access date; lower confidence or mark the claim unchecked.`

Recommended fix direction:

Share date detection with `sourceLinesWithUrlsMissingAccessDate`, or parse the External Sources table and recognize the `Accessed` column.

### RRV-05: Placeholder scanning rejects literal placeholder-like tokens inside fenced code examples

Severity: Medium

Evidence:

- `src/mcp/artifact-contracts/index.ts:4171` and nearby placeholder signals include generic strings such as `<URL>`, `<title>`, and `<reason>`.
- `src/mcp/tools/artifacts.ts:2910` performs global placeholder-signal matching without ignoring fenced code.
- R4 identified the compatibility risk; S2 reproduced it.

Impact:

An otherwise valid research artifact can fail strict persistence when a fenced HTML/XML/pseudocode example intentionally contains placeholder-like syntax. This is a strict write failure, but likely narrower than RRV-01 because it depends on particular code examples.

Simulation result:

S2 generated a full-size research artifact with a fenced code example containing `<title>`, `<reason>`, and `<URL>`. `blueprintPhaseArtifactWrite` returned `status: "invalid"` with:

`Research artifact still contains scaffold placeholder text and must be replaced with real research content.`

Recommended fix direction:

Ignore fenced code blocks when checking scaffold placeholder signals, or restrict generic placeholder signals to template table cells and prose outside code fences. Add a regression test with literal HTML/XML placeholder syntax inside `## Code Examples`.

### RRV-06: Generic setup text triggers dependency/tool warning bundle

Severity: Medium

Evidence:

- `src/mcp/tools/artifacts.ts:2712` defines dependency-choice detection.
- `src/mcp/tools/artifacts.ts:2714` treats install commands such as `npm install` as sufficient to trigger the dependency/tool warning path.
- R4 identified it; S2 reproduced it.

Impact:

Ordinary setup guidance like "Run npm install before local verification" can trigger a full bundle of dependency-evaluation warnings even when the research is not recommending a new dependency or tool. This does not block persistence, but it adds noisy repair pressure and can make warnings less trustworthy.

Simulation result:

S2 generated full-size research with generic `Run npm install before local verification` text and no dependency choice. The write succeeded, but emitted warnings for missing Dependency / Tool Evaluation, alternatives coverage, setup/update posture, Library Vs Custom Decision, and Supply Chain Evidence.

Recommended fix direction:

Trigger dependency/tool warnings only when prose recommends adding, adopting, replacing, upgrading, installing a specific new package/tool, vendoring, forking, code-generating, or hand-rolling. Generic repo setup commands should not trigger the full dependency decision lane by themselves.

### RRV-07: HIGH-confidence warning scans unsupported words globally instead of planner-critical support rows

Severity: Medium

Evidence:

- `src/mcp/tools/artifacts.ts:2851` checks the whole artifact for `not_enough_evidence`, `contradicted`, `conflicting_sources`, `unchecked`, or `unverified` when confidence is HIGH.
- The template allows values such as `supplied-unchecked` and source rows that are explicitly `out_of_scope` or `do not use as support`.
- R1, R3, R4, S1, S2, and S3 all saw variants of this warning.

Impact:

Repo-only or source-policy-limited research can receive a warning even when unsupported evidence is explicitly marked out of scope or not used downstream. This is warning-only, but it appears frequently enough to lower diagnostic signal.

Simulation result:

S1 generated HIGH-confidence research with a harmless `supplied-unchecked` / `out_of_scope` external row marked `Downstream Use: do not use as support`. The write succeeded, but emitted the HIGH-confidence unsupported-evidence warning.

S3 also saw the same warning on otherwise successful control saves.

Recommended fix direction:

Parse source-register rows and fire this warning only when unsupported claim classes are used for downstream claims or recommendations. Ignore explicit `out_of_scope`, `do not use as support`, and source-policy notes that are not supporting planner-critical claims.

### RRV-08: Research table contracts and validators are duplicated across too many string surfaces

Severity: Medium

Evidence:

- Template tables live in `src/mcp/artifact-contracts/index.ts`.
- Placeholder signals live in the same contract object.
- Validator regexes live in `src/mcp/tools/artifacts.ts`.
- Runtime behavior prose lives in `src/mcp/command-runtime-metadata.ts:1538`.
- R3 flagged this as the highest maintainability smell.

Impact:

Column names and policy terms now need synchronized edits across template rendering, placeholder detection, validation regexes, docs, warning strings, and runtime metadata. Drift already appears in source-table validation and placeholder behavior.

Recommended fix direction:

Extract structured descriptors for dependency evaluation, setup posture, alternatives, library-vs-custom, and source-register lanes. Render templates, placeholder signals, and validator expectations from the same descriptors where practical.

### RRV-09: `contract.authoringTemplate` is still scaffold-shaped

Severity: Low

Evidence:

- `src/mcp/artifact-contracts/index.ts:4202` maps `renderAuthoringTemplate` to `renderResearchTemplate`.
- `renderResearchTemplate` includes many literal `<...>` placeholders.
- Validation rejects scaffold placeholder text before persistence.

Impact:

The command contract says to draft from `contract.authoringTemplate`, but that template is still full of scaffold cues that final content must remove. This is manageable but confusing for future authors and increases the odds of prompt-local template leakage.

Recommended fix direction:

Consider a dedicated research authoring template that keeps canonical headings and table shapes but avoids scaffold placeholder literals, while keeping scaffold output explicitly placeholder-heavy.

### RRV-10: Human schema docs drift from the live research authoring template

Severity: Low

Evidence:

- R4 noted that `docs/ARTIFACT-SCHEMA.md` shows a shorter `Navigation Evidence Packet` shape than the live template around `src/mcp/artifact-contracts/index.ts:957`.

Impact:

This does not break MCP writes because the runtime contract is source of truth, but it can mislead humans or offline prompt packs that copy docs instead of calling `blueprint_artifact_contract_read`.

Recommended fix direction:

Align the docs table with the runtime authoring template, or explicitly state that docs are illustrative and `blueprint_artifact_contract_read` is authoritative.

### RRV-11: Research runtime metadata note is monolithic and diff-hostile

Severity: Low

Evidence:

- `src/mcp/command-runtime-metadata.ts:1538` contains the full research runtime behavior as one long string.
- R3 flagged reviewability risk.

Impact:

Small changes create noisy diffs and increase the chance of accidental unrelated policy changes. This is maintainability-only in this review.

Recommended fix direction:

Split the note into named paragraph constants or a joined string array grouped by topic. Keep focused tests for the required topic anchors.

## Simulation Findings

The simulation agents created isolated temp Blueprint repos and used the actual MCP handler functions from the worktree. No source or docs files were edited by simulations.

### S1: Split Sources, External Access Date, High Confidence

Handlers used:

- `blueprintArtifactContractRead`
- `blueprintPhaseArtifactWrite`
- `blueprintPhaseResearchStatus`
- `blueprintStateUpdate`
- `blueprintStateLoad`

Results:

| Variant | Intended Shape | Write Result | Key Output |
|---------|----------------|--------------|------------|
| S1.1 | Full-size research with split source tables and no source bullets | `invalid` | `Research artifact must include at least one source bullet with a URL, repo path, or cited file.` |
| S1.2 | Live/current wording with External Sources table `Accessed = 2026-05-13` | `created`, valid | False live-verification access-date warning fired. |
| S1.3 | HIGH confidence with harmless `supplied-unchecked` / `out_of_scope` row | `created`, valid | Broad HIGH-confidence unsupported-evidence warning fired. |

### S2: Install Text, Dependency Evidence, Placeholder Code

Handlers used:

- `blueprintArtifactContractRead`
- `blueprintArtifactScaffold`
- `blueprintPhaseArtifactWrite`
- `blueprintPhaseResearchStatus`
- `blueprintStateUpdate`
- `blueprintStateLoad`

Results:

| Variant | Intended Shape | Write Result | Key Output |
|---------|----------------|--------------|------------|
| S2.1 | Generic `Run npm install before local verification` setup text | `created`, valid | Full dependency/tool warning bundle fired despite no dependency choice. |
| S2.2 | Repo-local tool recommendation with complete dependency/tool evidence | `created`, valid | Dependency warnings cleared; broad HIGH-confidence warning remained. |
| S2.3 | Fenced code containing `<title>`, `<reason>`, and `<URL>` | `invalid` | Rejected as scaffold placeholder text. |

### S3: Control Save, Scaffold Intent, Invalid UI Spec Route

Handlers used:

- `blueprintArtifactContractRead`
- `blueprintArtifactScaffold`
- `blueprintPhaseArtifactRead`
- `blueprintPhaseArtifactWrite`
- `blueprintPhaseResearchStatus`
- `blueprintStateUpdate`
- `blueprintStateLoad`

Results:

| Scenario | Intended Shape | Result | Key Output |
|----------|----------------|--------|------------|
| S3.1 | Normal full-size research with bullet-based sources | `created`, valid | State routed to `/blu-ui-phase 3`; broad HIGH-confidence warning fired. |
| S3.2 | Scaffold research via numeric phase/artifact intent | Scaffold did not create research | Bootstrap artifacts were reused; `03-RESEARCH.md` remained missing. |
| S3.3 | Valid research with existing scaffold/invalid `03-UI-SPEC.md` | Research saved, route wrong | `blueprintPhaseResearchStatus` said UI repair; `blueprintStateLoad` routed to `/blu-plan-phase 3`. |

## Non-Findings And Notes

- No review agent found a correctness issue in the changed `src/mcp/command-runtime-metadata.ts` content itself.
- Checkpoint ownership and guarded delete behavior looked aligned when callers pass both `expectedOwnerCommand: "/blu-research-phase"` and `expectedMode: "research"`.
- Dependency/tool validation is intentionally warning-only. Findings here are about false positives and noisy guidance, not blocked writes.
- The full `npm test` suite passed before this document was written.
