# `/blu-research-phase` Simulation Results

## Scope

Workflow simulated: `/blu-research-phase`

Simulation focus: realistic research artifact generation through the real MCP write path, including strict validation failures, warning-only evidence checks, checkpoint behavior, final state sync, and idempotent reuse.

Investigation grounding:
- Command: `commands/blu-research-phase.toml`
- Skill: `skills/blueprint-phase-discovery/SKILL.md`
- Runtime contract: `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md`
- Optional sidecar agent: `agents/blueprint-researcher.md`
- Save path: `blueprintPhaseArtifactWrite` in `src/mcp/tools/phase.ts`
- Research validator: `validateResearchArtifactContent` in `src/mcp/tools/artifacts.ts`
- Artifact contract: `phase.research` in `src/mcp/artifact-contracts/index.ts`

Artifacts involved:
- `.blueprint/phases/<phase-slug>/<phase-prefix>-RESEARCH.md`
- `.blueprint/phases/<phase-slug>/<phase-prefix>-DISCUSS-CHECKPOINT.json` when research-owned continuation state is needed
- `.blueprint/STATE.md`

## Simulation Summary

Three independent agents ran real save simulations against temporary repos. All reached a persisted `XX-RESEARCH.md` within three attempts. Invalid writes did not persist files. Research-owned checkpoints were safe to resume and could be deleted after successful finalization. Synced state routing worked, including routing to `/blu-ui-phase` when UI was enabled and no UI spec existed. Identical final content returned `status: "reused"`.

| Agent | Attempts | Final Result | Main Retry Drivers |
| --- | ---: | --- | --- |
| GPT-5.5 high | 3 | Warning-free rich research saved | No concrete source, no fenced code, `Open Questions: none`, warning cleanup |
| GPT-5.4 high | 3 | Research saved with warnings | Code Examples hard blocker, missing requirement row/source, noisy warnings |
| GPT-5.2 high | 3 | Research saved with warnings | Missing `Confidence`, source evidence gate, exact heading/contract friction |

Focused tests reported by simulation agents passed for the research surface, including `tests/phase-discovery-research.test.ts` and research checkpoint coverage in `tests/phase-discovery-tools.test.ts`.

## Findings

### High: Invalid-write repair guidance is too generic

All simulations hit strict validation failures, but `suggestedRepairs` and retry plan steps collapsed to generic contract-reading guidance rather than targeted repairs.

Observed repair text:

```text
Read the phase.research contract, repair the research artifact, then retry blueprint_phase_artifact_write.
```

Observed hard failures that needed concrete guidance:
- Missing `**Confidence:** LOW|MEDIUM|HIGH`
- `Code Examples` non-substantive
- Empty Phase Requirements table
- No concrete source bullet or structured source row
- `Open Questions` treated as non-substantive

Evidence:
- Research repair helper: `src/mcp/tools/artifacts.ts:5625`.
- Invalid write response assembly: `src/mcp/tools/phase.ts:6918` and `src/mcp/tools/phase.ts:6929`.

Why it matters: the workflow permits repair retries, but the response does not tell the next attempt the exact shape needed to recover quickly.

### High: `Code Examples` is an unexpectedly hard blocker

Two simulations failed because `## Code Examples` was not considered substantive. One realistic inline command/example was rejected, and the validator separately warns when code is not fenced.

Observed issue:

```text
Research artifact section Code Examples must contain substantive content after placeholders are removed.
```

Evidence:
- Required-section substance validation: `src/mcp/tools/artifacts.ts:3664`.
- Fenced-code warning rule: `src/mcp/tools/artifacts.ts:3775`.
- Runtime contract says code, config, command examples, or explanation can satisfy the section: `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md:246`.

Why it matters: this is a likely real-world retry driver. The contract suggests a broader acceptable shape than the validator effectively accepts.

### High: Exact-heading brittleness is generation-costly

The research artifact requires all contract headings exactly, including casing and punctuation such as `Don't Hand-Roll`. Slightly humanized headings can fail even if the content is semantically correct.

Evidence:
- `phase.research` required headings: `src/mcp/artifact-contracts/index.ts:4085`.
- Strict heading validation path: `src/mcp/tools/artifacts.ts:3630`.

Why it matters: exact heading matching protects parseability, but it creates high retry risk for generated Markdown unless the model copies the template perfectly.

### Medium: Research contract is very generation-expensive

The live contract requires 17 headings and a large placeholder surface, while the command and runtime contract also ask for claim ledgers, source registers, recommendation handoffs, dependency/tool evaluation, search notes, visible stages, and checkpoint ledger behavior.

Evidence:
- Required headings and placeholder surface: `src/mcp/artifact-contracts/index.ts:4093`.
- Command manifest evidence/source-support guidance: `commands/blu-research-phase.toml:10`.
- Runtime contract research strand/source guidance: `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md:196` and `skills/blueprint-phase-discovery/references/research-phase-runtime-contract.md:202`.

Why it matters: many of these checks are warning-grade, which keeps persistence forgiving, but a model trying to satisfy the full contract pays a large ceremony cost before producing planner-usable content.

### Medium: Heavy evidence ledgers are requested but mostly warning-only

The manifest and runtime contract ask for Source-Support Self-Check, Claim Support Ledger, Source Register, Recommendation Handoff, and dependency/tool evidence. The validator allows saves without many of these richer structures and emits warnings instead.

Evidence:
- Manifest asks for source-support checks and provenance: `commands/blu-research-phase.toml:20`.
- Warning-only evidence paths: `src/mcp/tools/artifacts.ts:3713` and `src/mcp/tools/artifacts.ts:3779`.

Why it matters: this creates a mismatch between “what the command asks the LLM to do” and “what persistence requires.” It can either waste generation effort or allow thin valid artifacts depending on which signal the model follows.

### Medium: Source evidence hard gate is shallow

The hard source gate is easy to satisfy with anything that looks like a URL, repo path, file name, or structured source row. It does not verify existence or claim linkage at the hard-failure level.

Evidence:
- Concrete source matcher: `src/mcp/tools/artifacts.ts:2699`.
- Hard source issue in `validateResearchArtifactContent`: `src/mcp/tools/artifacts.ts:3697`.

Why it matters: the hard gate can cause retries, but once satisfied it may not prove meaningful provenance. Stronger evidence linkage is largely warning-grade.

### Medium: Warning diagnostics are noisy and partially duplicative

Successful saves still returned warning clusters that were difficult to prioritize. Repeated examples included two near-duplicate live-external wording warnings plus supply-chain, dependency/tool, Recommendation Handoff, and repo-runtime evidence warnings.

Evidence:
- Live external wording warning path: `src/mcp/tools/artifacts.ts:3725`.
- Additional live/current external diagnostic path: `src/mcp/tools/artifacts.ts:3506`.
- Dependency/tool warning bundle: `src/mcp/tools/artifacts.ts:3737` and `src/mcp/tools/artifacts.ts:3762`.

Why it matters: “valid” can still feel noisy enough that the model keeps repairing warning-only items, even when persistence has already accepted the artifact.

### Medium: Warning diagnostics are not uniformly machine-actionable

Some warnings also appear as structured diagnostics with codes and repairs, while dependency/tool warning bundles are plain warning strings. This makes automated triage uneven.

Evidence:
- Dependency/tool warning paths: `src/mcp/tools/artifacts.ts:3737` and `src/mcp/tools/artifacts.ts:3789`.

Why it matters: repair agents can act on structured diagnostics more reliably than prose-only warning bundles.

### Low: `Open Questions: none` is rejected as non-substantive

One simulation used `- none` for Open Questions and failed because the generic section-substance rule requires more meaningful content.

Evidence:
- Section substance rule: `src/mcp/tools/artifacts.ts:3588`.

Why it matters: “none” can be an honest final research state, but the current validator requires padded prose such as “No unresolved planning questions remain.”

### Low: Duplicate live-external warnings reduce signal

One simulation saw both:
- `appears to use live external verification wording...`
- `uses current external verification wording...`

Evidence:
- Warning path one: `src/mcp/tools/artifacts.ts:3725`.
- Warning path two: `src/mcp/tools/artifacts.ts:3506`.

Why it matters: one diagnostic with one repair would be easier to act on.

### Low: ROADMAP requirement parsing is format-sensitive

One temp repo used `(REQ-001)` in a phase title. The parser did not treat that as requirement linkage because it recognizes `(Requirements: ...)`, which produced phase-context warnings.

Evidence:
- Requirement parsing pattern: `src/mcp/tools/phase-roadmap-parser.ts:73`.

Why it matters: this is outside the core research artifact save path, but it can make research readiness warnings noisier in realistic repos.

## Deduplication Notes

The three agents independently reproduced the same central pattern: the persistence path is safe and forgiving after strict blockers are cleared, but the authoring contract is expensive. The most repeated issues were generic repair guidance, Code Examples/source blockers, and noisy warning clusters around evidence quality and dependency/tool research.

The simulations did not find data-loss behavior. Invalid writes returned `written: false`, valid writes persisted, checkpoint ownership worked, state routing refreshed, and unchanged valid content reused correctly.
