# Blueprint External Review Prompt Deck

Use this deck when you want a frontier model to review the Blueprint repo as an
external reviewer and then feed the highest-value findings back into Blueprint
implementation work.

The deck is tuned for Blueprint's current shape:

- large MCP and state surfaces in `src/mcp/tools/`
- strong artifact and contract docs under `docs/`
- a broad but metadata-heavy regression suite under `tests/`

The point is not generic "improve the repo" critique. The point is to surface
high-value issues around correctness, contract drift, safety, maintenance risk,
and missing regressions, then turn those into small implementation batches.

## Recommended Cadence

Run the review in iterations:

1. one repo-wide triage pass
2. six focused deep-review passes on the highest-risk surfaces
3. one synthesis pass to convert findings into fix batches
4. one post-fix verification pass after each implementation batch

Minimum useful sequence when you want fewer runs:

1. `Prompt 0 - Repo-Wide Triage`
2. `Prompt 2 - Artifact / State / Phase Contract Integrity`
3. `Prompt 3 - Security / Path / Persistence Hardening`
4. `Prompt 4 - Review / Maintenance / High-Risk Operations`
5. `Prompt 7 - Synthesis And Fix Batching`
6. `Prompt 8 - Post-Fix Verifier`

## Output Contract

Every review run should use the same output contract so findings are easier to
deduplicate and turn into fix batches.

Ask the model to include, for every finding:

- severity
- confidence
- evidence
- why it matters
- smallest safe fix
- tests to add or update

Ask the model to output exactly these sections:

1. `Confirmed Findings`
2. `Lower-Confidence Concerns`
3. `Suggested Tests`
4. `Minimal Patch Queue`

## Shared Header

Use this block at the top of every review run, then append one of the prompt
tails from the next section.

```text
Review the Blueprint GitHub repo as a high-signal reviewer. Start with
`AGENTS.md`, then read in this order: `docs/DECISIONS.md`, `docs/DRIFT.MD`,
`docs/ARCHITECTURE.md`, `docs/ARTIFACT-SCHEMA.md`, `docs/MCP-TOOLS.md`,
`docs/GEMINI-CONSTRAINTS.md`, `docs/PHASE-LIFECYCLE.md`,
`docs/SKILLS-AND-AGENTS.md`, `docs/IMPLEMENTATION-ORDER.md`, and
`docs/COMMAND-CATALOG.md`.

Hard constraints to respect:
- Blueprint is a Gemini-native redesign, not a legacy port.
- `.blueprint/` is the project source of truth.
- `~/.gemini/blueprint/` is only for cross-project operational state.
- Commands stay thin and user-facing.
- Skills orchestrate.
- Agents do bounded deep work.
- Hooks are advisory, not state-owning.
- Do not reintroduce `.planning/` or legacy slash-command surfaces.
- Do not broaden `/blu`, `/blu-help`, or `/blu-progress` beyond commands whose
  catalog entry is `implemented`.
- Do not change command-status semantics while the current Phase 3 repair
  posture is in effect.
- Do not suggest self-mutating `update` behavior.

Review rules:
- Focus on concrete bugs, contract drift, safety gaps, brittle assumptions, and
  missing regressions.
- Skip praise and low-signal style nits.
- Separate confirmed issues from lower-confidence concerns.
- Cite exact files and lines or exact symbols when possible.
- Prefer minimal fixes that match existing repo patterns.

Output exactly these sections:
1. `Confirmed Findings`
2. `Lower-Confidence Concerns`
3. `Suggested Tests`
4. `Minimal Patch Queue`

For each finding include:
- severity
- confidence
- evidence
- why it matters
- smallest safe fix
- tests to add or update

If you can execute commands, run `npm run typecheck` and `npm run test`. Also
run `npm run test:integration:extension` when the slice touches packaging,
install, built assets, or extension runtime wiring. If you cannot execute
commands, say so and continue with static review.
```

## Prompt Deck

### Prompt 0 - Repo-Wide Triage

```text
Do a repo-wide triage. Scan `src/`, `commands/`, `skills/`, `agents/`, `docs/`,
and `tests/`. Give me the 8-12 highest-value findings or opportunities across
correctness, contract drift, safety, maintenance risk, and test blind spots.
Group them by subsystem and then recommend which focused review prompts I
should run next, in order. Do not include low-value nits.
```

### Prompt 1 - Routing / Catalog / Exposure Drift

```text
Focus on `src/mcp/tools/project.ts`, `src/mcp/server.ts`,
`src/mcp/runtime-vocabulary.ts`, `src/mcp/command-paths.ts`, `README.md`,
`docs/COMMAND-CATALOG.md`, `docs/ARCHITECTURE.md`, `commands/*.toml`, and tests
such as `tests/command-catalog.test.ts`, `tests/help-progress-health.test.ts`,
`tests/extension-runtime-contracts.test.ts`, and
`tests/command-contract-docs.test.ts`.

Look for implemented-only exposure drift, manifest/skill/tool mismatch, alias
inconsistency, doc/runtime mismatch, and risky fallback behavior.
```

### Prompt 2 - Artifact / State / Phase Contract Integrity

```text
Focus on `src/mcp/tools/artifacts.ts`, `src/mcp/tools/phase.ts`,
`src/mcp/tools/state.ts`, `src/mcp/artifact-contracts/index.ts`,
`docs/ARTIFACT-SCHEMA.md`, `docs/MCP-TOOLS.md`, and tests including
`tests/artifact-contracts.test.ts`, `tests/artifact-validate-runtime.test.ts`,
`tests/phase-discovery-tools.test.ts`, `tests/phase-planning-tools.test.ts`,
`tests/execute-phase-summary-tools.test.ts`, `tests/validate-phase-tools.test.ts`,
and `tests/phase-plan-write-locking.test.ts`.

Hunt for schema drift, invariant leaks, overwrite/reuse ambiguity, state-sync
edge cases, plan-summary-validation linkage bugs, and roadmap-evolution
inconsistencies.
```

### Prompt 3 - Security / Path / Persistence Hardening

```text
Focus on `src/shared/security.ts`, `src/mcp/write-failure-log.ts`, `src/hooks/*`,
`docs/HOOKS-POLICIES.md`, `docs/MCP-TOOLS.md`, and tests
`tests/security-hardening.test.ts`, `tests/mcp-write-failure-logging.test.ts`,
`tests/review-docs-safety-regression.test.ts`, and `tests/hooks.test.ts`.

Look for path-escape bugs, symlink or null-byte gaps, prompt-boundary
sanitization holes, unsafe parsing assumptions, logging blind spots, and
advisory-vs-enforcement confusion.
```

### Prompt 4 - Review / Maintenance / High-Risk Operations

```text
Focus on `src/mcp/tools/review.ts`, `skills/blueprint-review/SKILL.md`,
`skills/blueprint-maintenance/SKILL.md`, docs for `code-review`,
`code-review-fix`, `audit-fix`, `review`, `secure-phase`, `ui-review`,
`docs-update`, `pr-branch`, `ship`, `undo`, and `cleanup`, plus tests such as
`tests/review-slice.test.ts`, `tests/code-review-slice.test.ts`,
`tests/code-review-fix-slice.test.ts`, `tests/secure-phase-slice.test.ts`,
`tests/ui-review-slice.test.ts`, `tests/maintenance-regression.test.ts`,
`tests/ship-metadata.test.ts`, `tests/undo-metadata.test.ts`, and
`tests/cleanup-metadata.test.ts`.

Look for unsafe remediation scope, brittle finding parsing, weak
preflight/confirmation behavior, report-before-mutate holes, and docs that
claim protections not actually enforced.
```

### Prompt 5 - Skills / Agents / Manifests / Packaging

```text
Focus on `skills/*/SKILL.md`, `agents/*.md`, `commands/*.toml`,
`gemini-extension.json`, `tabnine-extension.json`, and tests including
`tests/skill-bundles-metadata.test.ts`, `tests/agent-schema.test.ts`,
`tests/optional-agent-validity.test.ts`,
`tests/agent-contract-specialists.test.ts`, `tests/built-assets-smoke.test.ts`,
and `tests/extension-install.integration.ts`.

Look for activation-path drift, contract mismatch, missing metadata alignment,
packaging/install breakage, host-specific assumptions, and build/dist coupling
risk.
```

### Prompt 6 - Test Architecture And Highest-ROI Gaps

```text
Focus on `docs/TEST-STRATEGY.md`, `package.json`, the full `tests/` tree, and
the most complex runtime files: `src/mcp/tools/artifacts.ts`,
`src/mcp/tools/phase.ts`, `src/mcp/tools/state.ts`, `src/mcp/tools/review.ts`,
`src/mcp/tools/project.ts`, `src/mcp/tools/config.ts`, and
`src/shared/security.ts`.

Identify only the highest-value missing tests. Cap at 10. Prioritize
regressions that would allow contract drift, unsafe mutation behavior, or
broken extension/runtime wiring to ship.
```

### Prompt 7 - Synthesis And Fix Batching

Use this only after you have outputs from earlier review runs.

```text
I will paste findings from multiple prior review runs. Deduplicate them, reject
any that conflict with Blueprint's locked decisions, and convert them into a
fix queue with three buckets: `critical-now`, `next`, and `later`.

For each item, give:
- scope
- rationale
- likely files
- tests to run
- implementation risk
- whether it should be isolated in its own PR

Do not invent new findings unless a conflict between earlier findings makes one
necessary.

[PASTE PRIOR FINDINGS HERE]
```

### Prompt 8 - Post-Fix Verifier

Run this after each implementation batch.

```text
I will give you a set of changed files and the earlier findings they were meant
to fix. Re-review only those surfaces.

Tell me for each prior finding whether it is:
- `fixed`
- `partially fixed`
- `still open`
- `regressed elsewhere`

Call out any new regressions introduced by the patch. Recommend the exact tests
to run next.

[PASTE CHANGED FILES AND PRIOR FINDINGS HERE]
```

## Suggested Iteration Workflow

### Pass 1: Triage

- Run the shared header plus `Prompt 0`.
- Do not implement from that run alone.
- Use it to choose which focused prompts to run next and in what order.

### Pass 2: Focused Reviews

- Run `Prompt 1` through `Prompt 6`.
- These are intentionally sliceable and can be run in parallel.
- Ask the reviewer to stay inside the named files and contracts for each pass.

### Pass 3: Synthesis

- Paste the focused outputs into `Prompt 7`.
- Use the resulting queue as the source for implementation batches.
- Implement only the `critical-now` bucket first.

### Pass 4: Verification Loop

After each implementation batch:

1. collect the changed files and the findings that batch was meant to fix
2. run `Prompt 8`
3. run the recommended local tests
4. stop only when the batch has no unresolved critical finding and no fresh
   regression

## Acceptance Criteria

A review pass is successful when it:

- cites repo-grounded evidence instead of generic advice
- respects Blueprint's locked architecture decisions
- produces patch-ready findings, not vague critique
- gives fixes and tests that can be turned into small implementation batches

An implementation batch driven by this deck is successful when:

- `npm run typecheck` passes
- `npm run test` passes
- `npm run test:integration:extension` passes for any batch that touches
  packaging, install, built assets, or extension runtime wiring
- the `Prompt 8` follow-up does not report unresolved critical findings or new
  regressions that should block the batch

## Practical Notes

- Use the frontier model as an external reviewer, not as the primary
  implementer.
- Ask for minimal safe fixes, not speculative rewrites.
- Reject findings that conflict with locked decisions in `docs/DECISIONS.md`.
- Prefer multiple focused runs over one giant undifferentiated review pass.
- Keep the pasted prior findings for `Prompt 7` and `Prompt 8` trimmed to the
  relevant slices so the reviewer stays sharp.

## Assumptions

- review bias is balanced rather than bug-only or architecture-only
- desired output is patch-ready rather than findings-only
- the external model has repo read access
- execution access is optional
- "dock" means a reusable markdown document containing the prompt deck
