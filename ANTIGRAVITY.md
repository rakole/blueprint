# Antigravity Workflow Inefficiency Review Pack

Use this file when running Opus 4.6 under Antigravity to review one Blueprint workflow for speed, context, and orchestration inefficiencies.

## Purpose

Blueprint is a Gemini CLI and Tabnine CLI extension. It exposes `/blu-*` commands backed by:

- command manifests in `commands/*.toml`
- skills in `skills/<skill>/SKILL.md`
- command-specific runtime references in `skills/<skill>/references/*.md`
- optional bounded agents in `agents/*.md`
- deterministic MCP state tools under `src/mcp/`
- project runtime state under `.blueprint/`

The goal of an Antigravity review is not to prove every defect in Blueprint. The goal is to find the highest-leverage inefficiencies in one targeted workflow so the core Blueprint user journey gets faster, less noisy, and less context-expensive.

## Hard Context Rule

Do not open, search, summarize, or cite anything under `docs/**` unless the user explicitly overrides this rule in the same Antigravity prompt.

The docs tree is noisy right now and can cause stale-context loops. Treat `docs/**` as quarantined background material. If you think a docs file would help, mention that as a limitation in your report instead of reading it.

Allowed default inputs are:

- this file
- `antigravity/workflow-packets.md`
- packet-listed files under `commands/`, `skills/`, `src/`, `tests/`, and `agents/`
- targeted `rg` searches restricted to the packet-listed non-doc paths

Do not invoke Blueprint slash commands such as `/blu-plan-phase`. You are reviewing their implementation contracts, not running the product workflow.

## Review Protocol

1. Read this file.
2. Read the target workflow row in `antigravity/workflow-packets.md`.
3. Read only the files listed for that workflow.
4. Use targeted searches inside those files for:
   - duplicated rules
   - repeated MCP call sequences
   - warning-only behavior
   - retry and repair loops
   - validation and authoring context
   - subagent use and handoff shape
   - confirmation gates
   - checkpoint handling
   - state update and final route logic
5. Stay read-only. Do not edit files.
6. Do not run tests, builds, simulations, or real handler probes unless the user explicitly asks for runtime proof.
7. Do not broaden into sibling workflows unless the target packet says a shared file must be checked.

## Inefficiency Rubric

Prefer findings that explain wasted time, wasted context, avoidable retries, or avoidable tool calls. Useful categories:

- Context bloat: the workflow makes the agent load too many files, sibling contracts, stale docs, or full templates before it knows the branch it is in.
- Prompt duplication: the same procedure appears in command manifest, skill, runtime reference, and runtime metadata with drift risk.
- Over-sequencing: independent reads or decisions are forced into serial order without a data dependency.
- Late blockers: the workflow lets the agent draft before a missing prerequisite, stale state, or impossible gate is known.
- Retry churn: diagnostics are too broad, too schema-shaped, or too indirect for the next attempt.
- Warning noise: success paths emit warning-only messages that distract from the real next action.
- Validation overreach: validators reject wording, harmless empty states, or identity fields that MCP could own.
- Subagent overhead: the workflow delegates when a bounded inline path would be cheaper, or lacks a compact handoff packet.
- State-route confusion: write success, validation success, and final route readiness are easy to confuse.

## Output Contract

Return one read-only inefficiency report. Do not include an implementation patch.

Use this structure:

```markdown
# <workflow> Inefficiency Review

## Verdict
- Overall assessment:
- Top speed lever:
- Confidence:

## Ranked Findings
1. <Severity>: <finding title>
   Evidence: <file paths and concise references>
   Cost: <why this burns time/context/tool calls/retries>
   Smallest safe fix theme: <behavior-level fix, not a full implementation plan>
   Confidence: <high/medium/low>

## Non-Findings
- <important things checked that looked intentional or efficient>

## Suggested Next Slice
- <one smallest follow-up analysis or implementation slice>

## Limits
- Did not read `docs/**`.
- Did not run handlers or simulations.
- <any missing files or uncertainty>
```

## Severity Guide

- High: likely causes repeated retries, major context load, incorrect route state, or unnecessary multi-agent/tool work on common paths.
- Medium: likely wastes time in some common branches or makes repairs harder than necessary.
- Low: local polish or clarity issue that could still reduce friction.

## Starter Prompt Template

Use a prompt like this in Antigravity:

```text
Review one Blueprint workflow for inefficiencies: <workflow>.

First read ANTIGRAVITY.md, then read only the <workflow> row in antigravity/workflow-packets.md, then read only the non-doc files listed there.

Do not read or search docs/**. Stay read-only. Do not fix code. Do not run simulations unless I explicitly ask.

Return the inefficiency report in the exact output contract from ANTIGRAVITY.md.
```
