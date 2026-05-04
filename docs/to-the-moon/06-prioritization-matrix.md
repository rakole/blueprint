# Subagent F: Top 5 Prioritization Matrix

Worktree: `/Users/rhishi/dev/repositories/blueprint-top5-20260504-194251`

Output owner: Subagent F

Date: 2026-05-04

Scope: prioritization across Subagent A, B, C, and D reports. Discovery only; no source, runtime, `.blueprint/`, package, command, skill, test, release, or existing documentation fixes were implemented.

## Scoring Methodology

Each candidate was scored from 1 to 5 on the requested dimensions:

| Dimension | Interpretation |
|---|---|
| User impact | How much the improvement helps users choose, trust, or complete Blueprint workflows. |
| Reliability/safety impact | How much it reduces state corruption, wrong routing, unsafe mutation, bad release, or recovery risk. |
| Prompt/agent quality impact | How much it improves LLM instruction following, tool choice, handoffs, confirmations, or prompt drift resistance. |
| Engineering effort | 1 means easy and contained; 5 means broad design, implementation, migration, or host integration work. This value is subtracted. |
| Strategic leverage | How much the improvement unlocks future work, reduces recurring drift, or strengthens Blueprint's architecture. |
| Evidence strength | How directly the input reports support the candidate with file evidence, command output, tests, or clear contract mismatch. |

Priority score formula:

```text
(User impact + Reliability/safety impact + Prompt/agent quality impact + Strategic leverage + Evidence strength) - Engineering effort
```

Ties were broken by lower engineering effort first, then by cross-report corroboration, then by whether the item protects other future improvements.

## Top 10 Candidate Matrix

| Rank | Candidate | Source reports | User | Reliability / safety | Prompt / agent | Effort | Strategic | Evidence | Score |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Repair public command-status and durable context drift, especially `/blu-do`, README/runtime wording, stale architecture/status docs, and `AGENTS.md` missing `impact`. | A, C | 5 | 4 | 4 | 2 | 5 | 5 | 21 |
| 2 | Build a prompt/tool-call behavior eval harness for router, lifecycle, high-risk, review-fix, shipping, and impact scenarios. | A, D | 5 | 5 | 5 | 4 | 5 | 5 | 21 |
| 3 | Add an intent-first command chooser and high-risk grouping to README/help so users can pick commands by goal, writes, and confirmation need. | C | 5 | 4 | 4 | 2 | 4 | 5 | 20 |
| 4 | Make high-risk confirmations a typed reusable runtime contract instead of only prompt prose. | A, C | 4 | 5 | 5 | 4 | 5 | 4 | 19 |
| 5 | Enforce release gates with `npm run verify`, PR CI, production audit, and dist/schema freshness checks. | D | 4 | 5 | 2 | 2 | 5 | 5 | 19 |
| 6 | Expand `blueprint_artifact_validate` into a registry-backed sweep for all managed artifact classes. | B | 4 | 5 | 2 | 3 | 5 | 5 | 18 |
| 7 | Standardize subagent handoff packets and test parent-to-agent delegation completeness. | A | 4 | 4 | 5 | 3 | 4 | 4 | 18 |
| 8 | Clean the overlapping `fast`, `quick`, and `debug` docs, examples, and copied boilerplate. | C | 4 | 3 | 4 | 1 | 3 | 5 | 18 |
| 9 | Make `.blueprint/` persistence atomic and consistently serialized for read-modify-write paths. | B | 4 | 5 | 1 | 4 | 5 | 5 | 16 |
| 10 | Add dependency audit automation and an explicit vulnerability exception policy. | D | 3 | 5 | 1 | 2 | 4 | 5 | 16 |

## Final Recommended Top 5

1. **Repair public command-status and durable context drift.**
   - Why now: this is the cheapest high-score fix and directly prevents users or agents from treating planned-only or stale surfaces as runnable truth.
   - Evidence: Subagent C found `/blu-do` marked planned in catalog/progress/runtime fallback but runnable-looking in `docs/commands/do.md`; README and architecture contain stale public/runtime layout wording. Subagent A found `AGENTS.md` omits shipped `impact`.

2. **Build a prompt/tool-call behavior eval harness.**
   - Why now: Blueprint already has strong static metadata tests, but the highest remaining agent risk is behavioral drift: wrong tool order, skipped confirmation, incomplete handoff, or claiming completion from prose.
   - Evidence: Subagent A found no prompt-behavior eval harness, while Subagent D found many command tests are regex/metadata oriented and not host-level behavior fixtures.

3. **Add an intent-first command chooser and high-risk grouping to README/help.**
   - Why now: the product has 53 implemented direct commands plus root routing. Users need a compact "I want to..." path before they read catalogs, specs, waves, or maintainer docs.
   - Evidence: Subagent C found command overload, crowded README grouping, and high-risk maintenance commands mixed into broad quality/shipping sections.

4. **Make high-risk confirmations a typed reusable runtime contract.**
   - Why now: prompt-visible confirmation gates are good, but cleanup, ship, undo, workspace, patch replay, overwrite, and force flows deserve auditable, uniform approval state.
   - Evidence: Subagent A found confirmations are mostly prompt-mediated; Subagent C found confirmation language is scattered even though the safety model is important.

5. **Enforce release gates with CI and a `verify` script.**
   - Why now: the local suite is strong and passed in Subagent D's run, but release confidence stays convention-driven without PR enforcement.
   - Evidence: Subagent D ran `npm ci`, `npm run build`, `npm run typecheck`, and `npm test` successfully, but found no `.github/` workflows, no aggregate `verify`, no audit gate, and active audit findings.

## Rationale And Tradeoffs

The top five deliberately mix user-facing clarity, LLM behavior control, high-risk safety, and release confidence.

The top drift repair is ranked first because it is high impact and relatively cheap. A stale public command story can mislead every future user and agent before they ever reach the live catalog. It also improves the quality of the prompt context itself.

The eval harness is tied for highest score but costs more. It should still be one of the first major investments because it protects nearly every prompt and command refactor that follows. Static tests can prove manifests, skills, and tools exist; behavior evals prove the model actually uses them correctly.

The README/help chooser is intentionally separate from the drift cleanup. Drift cleanup makes docs correct; the chooser makes them usable. Blueprint's command surface is powerful, but current public docs ask users to understand too much internal taxonomy before choosing a safe command.

Typed confirmations outrank deeper state-engine repairs because they sit directly in front of destructive or high-risk workflows. Atomic writes and full artifact validation are important, but typed confirmations reduce the chance of initiating the wrong destructive action in the first place.

CI release gates are the highest leverage engineering-system item. They convert already-good local practices into enforced project behavior and can include production audit, dist freshness, typecheck, and test gates without redesigning Blueprint's runtime.

Near misses:

- The registry-backed artifact validation sweep should follow close behind. It has stronger state-engine value than several doc fixes, but it is somewhat broader and benefits from CI/eval scaffolding being in place first.
- Atomic and serialized persistence is important for parallel and interrupted runs, but it has higher implementation risk and should be designed carefully around existing lock behavior.
- Dependency audit automation is partly covered by the CI recommendation. It should not be ignored, especially the production `hono` advisory and dev/testcontainers critical advisory, but it is narrower than the top five.
- Subagent handoff packets are valuable, especially for execute/review flows. They become more measurable once the prompt/tool-call eval harness exists.
- `fast`/`quick`/`debug` doc cleanup is a very good low-effort parallel task, but it is more local than the top five.

## Commands Run And Failures

Read-only commands run by Subagent F:

| Command | Result | Notes |
|---|---:|---|
| `sed -n '1,240p' AGENTS.md` | pass | Read worktree instructions first. |
| `sed -n '241,520p' AGENTS.md` | pass | Finished reading the local guide. |
| `wc -l docs/to-the-moon/01-llm-workflow-prompt-research.md docs/to-the-moon/02-mcp-state-artifact-audit.md docs/to-the-moon/03-command-skill-agent-ux-audit.md docs/to-the-moon/04-code-tests-release-audit.md` | pass | Confirmed report sizes before reading. |
| `sed -n '1,260p' docs/to-the-moon/01-llm-workflow-prompt-research.md` | pass | Read Subagent A report. |
| `sed -n '1,260p' docs/to-the-moon/02-mcp-state-artifact-audit.md` | pass | Read Subagent B report. |
| `sed -n '1,260p' docs/to-the-moon/03-command-skill-agent-ux-audit.md` | pass | Read Subagent C report. |
| `sed -n '1,260p' docs/to-the-moon/04-code-tests-release-audit.md` | pass | Read Subagent D report. |
| `ls -la docs/to-the-moon` | pass | Checked the output directory and sibling report files. |
| `test -f docs/to-the-moon/06-prioritization-matrix.md && sed -n '1,240p' docs/to-the-moon/06-prioritization-matrix.md || true` | pass | Confirmed the owned output file did not already contain content. |
| `sed -n '1,260p' docs/to-the-moon/06-prioritization-matrix.md` | pass | Read back the written report. |
| `git status --short docs/to-the-moon/06-prioritization-matrix.md` | pass | Confirmed the owned output file is a new untracked report. |

No command failures were observed. No tests, builds, installs, MCP tools, web searches, or Blueprint commands were run by Subagent F. The only file written was this owned report under `docs/to-the-moon/`.
