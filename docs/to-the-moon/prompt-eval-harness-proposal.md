# Prompt Evaluation Harness Proposal

Date: 2026-05-04
Scope: Blueprint command prompts, skill contracts, command-to-skill-to-MCP drift, artifact authoring contracts, and practical regression fixtures.
Mode: Proposal only. No source, prompt, skill, MCP, or test fixes were implemented.

## Executive Summary

Blueprint already has a strong deterministic test base for runtime metadata, MCP tool behavior, artifact validators, built assets, and selected lifecycle journeys. The missing layer is not a generic live-LLM benchmark. The highest leverage harness is a repo-local prompt contract suite that treats command prompts and skills as versioned operational assets, then tests their rendered command packets, allowed tool calls, forbidden behaviors, artifact output requirements, and journey handoffs with the same `node:test` style already used in this repo.

The proposed first version should be deterministic and cheap enough for `npm test`: golden command contract tests, prompt linting, command-to-skill-to-MCP drift tests, artifact output shape tests, simulated user journey tests, and regression fixtures. A later optional tier can replay recorded host transcripts or run live Gemini smoke scenarios, but only after the static and MCP-backed fixtures are stable.

## Why This Fits Blueprint

Current strengths to reuse:

- `tests/command-catalog.test.ts` already proves implemented commands have manifests, primary skills, required tools, aliases, and no blockers.
- `tests/command-contract-docs.test.ts` already parses `docs/COMMAND-CATALOG.md`, `docs/SKILLS-AND-AGENTS.md`, `docs/RUNTIME-REFERENCE.md`, and per-command specs to detect doc-level drift.
- `tests/skill-metadata.test.ts` already resolves structured `input_bundles` and proves runtime inputs stay docs-free for key commands.
- `tests/extension-runtime-contracts.test.ts` already validates installed-extension-facing prompt contracts, runtime FQN references, skill metadata, and built runtime assets.
- `tests/*runtime-contract-resource.test.ts` already exercises `buildBlueprintCommandRuntimeContractResource()` and runtime-owned command metadata when docs are unavailable.
- `tests/artifact-contracts.test.ts`, `tests/artifact-validate-runtime.test.ts`, `tests/phase-planning-tools.test.ts`, and `tests/execute-phase-summary-tools.test.ts` already validate model contracts, authoring contexts, and shape checks for saved artifacts.
- `tests/lifecycle-pilot-integration.test.ts`, `tests/help-progress-health.test.ts`, and `tests/impact-fixtures.test.ts` already show the repo's preferred fixture style: temporary repos, `.blueprint/` seeds, MCP tool calls, and scenario manifests.

Current gap:

- Existing prompt checks are mostly regex and metadata assertions. They catch missing tool names or missing guardrail phrases, but they do not prove the assembled command packet remains coherent, does not over-read sibling contracts, preserves tool-call order, blocks raw `.blueprint/` writes, or routes final output through implemented commands only.

## Harness Shape

Add a new deterministic prompt-eval layer under the existing test stack:

- `tests/prompt-eval/golden-command-contracts.test.ts`
- `tests/prompt-eval/prompt-lint.test.ts`
- `tests/prompt-eval/command-skill-mcp-drift.test.ts`
- `tests/prompt-eval/artifact-output-shape.test.ts`
- `tests/prompt-eval/user-journeys.test.ts`
- `tests/fixtures/prompt-eval/scenarios.json`
- `tests/fixtures/prompt-eval/golden/*.json`
- `tests/fixtures/prompt-eval/repos/*`

Keep it inside `tsx --test tests/**/*.test.ts` so it rides the current `npm test` command. Avoid a new runner unless live host transcript replay becomes necessary.

## 1. Golden Command Contract Tests

Purpose: snapshot the normalized prompt packet for every implemented command family, starting with high-risk/high-frequency commands.

Recommended first scenarios:

| Scenario | Command | Why |
|---|---|---|
| Router catalog gate | `/blu`, `/blu-help`, `/blu-progress`, `/blu-next` | Implemented-only recommendations are a core safety property. |
| Plan model-only write | `/blu-plan-phase` | Highest prompt complexity and strict artifact authoring path. |
| Execution summary write | `/blu-execute-phase`, `/blu-quick`, `/blu-fast` | Similar family, different write/read behavior. |
| Validation handoff | `/blu-validate-phase`, `/blu-verify-work`, `/blu-add-tests` | Artifact evidence and next-action routing are easy to overclaim. |
| Review repair | `/blu-code-review-fix`, `/blu-audit-fix`, `/blu-secure-phase`, `/blu-ui-review` | Review/report artifacts and optional subagents. |
| High-risk maintenance | `/blu-cleanup`, `/blu-ship`, `/blu-undo`, `/blu-reapply-patches` | Confirmation and destructive-risk behavior. |
| Impact analysis | `/blu-impact` | Existing scenario manifest shows this command already has strong fixture structure. |

Implementation design:

- Build a normalized packet from:
  - `commands/blu*.toml`
  - `buildBlueprintCommandRuntimeContractResource(command)`
  - `loadBlueprintSkillInputs(primarySkill, route)`
  - active skill/reference input contents
  - runtime catalog entry from `blueprintCommandCatalog()`
- Normalize volatile text:
  - collapse whitespace
  - normalize runtime FQNs with the existing `blueprintRuntimeToolFqn()` helper
  - sort tool arrays only where order is not semantically meaningful
  - preserve ordered command steps for prompts where order matters
- Compare to JSON goldens such as `tests/fixtures/prompt-eval/golden/plan-phase.json`.
- Store only structural fields, not entire Markdown blobs:
  - `command`
  - `primarySkill`
  - `executionProfile`
  - `requiredTools`
  - `optionalAgents`
  - `inputBundlePaths`
  - `requiredStages`
  - `allowedPersistenceTools`
  - `forbiddenPersistencePatterns`
  - `confirmationGates`
  - `finalResponseRequirements`

This gives high-signal diffs when a command prompt changes without turning every word into a brittle snapshot.

## 2. Prompt Linting

Purpose: catch prompt-layer hazards that regex metadata tests currently miss.

Initial lint rules should be simple, deterministic, and explainable:

| Rule | Example Failure It Should Catch | Current Reference |
|---|---|---|
| Required tools must appear only as runtime FQNs in active command prompts. | `blueprint_phase_plan_write` mentioned without `mcp_blueprint_...` in a manifest. | `tests/extension-runtime-contracts.test.ts` already checks many FQN references. |
| Active command inputs must not point to `docs/` unless explicitly allowed. | Runtime packet depends on control-plane docs. | `tests/skill-metadata.test.ts` and runtime-contract-resource tests already enforce docs-free bundles for several families. |
| Command prompts must not reference `skills/*.md` or `agents/*.md` file paths as runtime instructions. | Legacy file-path based loading returns. | `tests/extension-runtime-contracts.test.ts` checks path-free manifests. |
| Mutating commands must name allowed persistence tools and forbid raw `.blueprint/` writes. | Plan-phase suggests writing `XX-YY-PLAN.md` directly. | `commands/blu-plan-phase.toml` and `skills/blueprint-phase-planning/SKILL.md` have explicit model-only language. |
| High-risk commands must include explicit confirmation language. | Cleanup/ship/undo/reapply-patches lose the confirmation gate. | AGENTS guardrails and maintenance command specs. |
| Router commands must say implemented-only and must not recommend planned-only commands. | `/blu-do` appears as runnable route. | `tests/router-pilot-regression.test.ts`. |
| Prompt packet must not load sibling command contracts as active inputs. | `/blu-plan-phase` accidentally loads execute-phase contract. | `loadBlueprintSkillInputs()` already gives the active input list. |
| Response requirements must require warnings/blockers/next safe action for long-running commands. | Command can claim completion without state or route summary. | Shared stage vocabulary in command manifests and skills. |

Parsing can stay pragmatic at first. Existing tests already inspect TOML files as text, and command manifests use a consistent triple-quoted `prompt = """..."""` shape. A small local helper can extract `description` and `prompt` without adding a dependency. If command TOML grows more complex, switch to a TOML parser later.

## 3. Command-To-Skill-To-MCP Drift Tests

Purpose: prove each implemented command's manifest, skill frontmatter, runtime metadata, runtime contract resource, and MCP registry agree.

Extend patterns from:

- `tests/command-catalog.test.ts`
- `tests/command-contract-docs.test.ts`
- `tests/skill-metadata.test.ts`
- `tests/extension-runtime-contracts.test.ts`
- `tests/roadmap-admin-runtime-contract-resource.test.ts`
- `tests/phase-execution-runtime-contract-resource.test.ts`

Proposed assertions:

- For every `catalog.commands[command].implemented === true`:
  - manifest exists at `blueprintPrimaryManifestPath(command)`
  - manifest prompt names exactly `entry.primarySkill`
  - skill frontmatter `commands` includes the route
  - `input_bundles.commands[route]` resolves to the expected active inputs
  - runtime contract resource `catalog`, `spec`, and `runtimeReference` required tools match `entry.requiredTools`
  - every required tool exists in `blueprintToolNames`
  - active prompt packet includes each required tool FQN
  - active prompt packet does not include non-required mutating tools unless explicitly whitelisted
  - optional agents in metadata, skill, and prompt packet match
- For every non-implemented command:
  - no runtime contract resource is exposed
  - router/root prompt packets do not present it as runnable

The useful difference from the current suite is that this test should operate on the assembled prompt packet, not only one file at a time.

## 4. Artifact Output Shape Tests

Purpose: evaluate whether command prompts tell the model to produce artifacts that can pass the live MCP contracts.

Do not ask a live model to generate artifacts in v1. Instead, create golden "model outputs" as JSON fixtures and validate them through the same MCP model validators the commands require.

First artifact families:

| Artifact | Validator/Tooling To Reuse | Command Prompts Covered |
|---|---|---|
| `phase.plan` | `blueprint_phase_plan_authoring_context`, `blueprint_phase_plan_validate_model`, `blueprint_phase_plan_write`, `blueprint_phase_plan_validate` | `/blu-plan-phase` |
| `phase.summary` | `blueprint_phase_summary_authoring_context`, `blueprint_phase_summary_validate_model`, `blueprint_phase_summary_write` | `/blu-execute-phase`, `/blu-quick` where applicable |
| `phase.verification` and `phase.uat` | `blueprint_phase_validation_write`, `validateVerificationArtifactContent`, `validateUatArtifactContent` | `/blu-validate-phase`, `/blu-verify-work` |
| `report.add-tests` | `blueprintArtifactReportValidateModel`, `blueprintArtifactReportWrite` | `/blu-add-tests` |
| `report.audit-fix`, `review.*` | review/report model contracts and review tool validators | `/blu-audit-fix`, `/blu-code-review-fix`, `/blu-secure-phase`, `/blu-ui-review` |
| `report.impact` | `blueprintImpactAnalyze`, `blueprintImpactReportWrite`, `blueprintImpactOutputRender` | `/blu-impact` |

Fixture shape:

```json
{
  "id": "plan-phase-model-only-happy-path",
  "command": "plan-phase",
  "repoFixture": "phase-ready-with-research",
  "artifactId": "phase.plan",
  "modelFixture": "phase-plan-valid.json",
  "expected": {
    "writeStatus": "written",
    "requiredHeadings": ["Goal", "Scope", "Tasks", "Verification", "Must Haves"],
    "forbiddenStrings": ["placeholder", "future enhancement", "stub"]
  }
}
```

Negative fixtures should be equally important:

- `planId` double-encoded as `"\"01\""`
- Markdown `content` passed from `/blu-plan-phase`
- missing `requirements`
- missing task `Read First`
- router final action names a planned command
- report model omits completion evidence but claims `COMPLETED`
- high-risk command fixture has no confirmation gate

## 5. Simulated User Journey Tests

Purpose: test prompt contracts as user workflows without requiring a live LLM.

These should be "scripted transcript" tests: a scenario defines the expected tool sequence, allowed branch points, simulated tool responses, user confirmation responses, artifact writes, and final response assertions. The runner verifies the command packet can support that sequence and that MCP tools accept the resulting state.

Start with three journeys:

1. Bootstrap-to-plan:
   - Seed a fixture repo like `tests/fixtures/new-project/fresh-repo`.
   - Simulate `/blu-new-project` output by calling existing MCP init/bootstrap tools or using a seeded `.blueprint/`.
   - Run the planning path through `phase_locate`, contract read, research readiness, authoring context, model validate, write, scoped validate, state update.
   - Assert next safe action is implemented-only.

2. Plan-to-verify:
   - Reuse the temporary repo style from `tests/lifecycle-pilot-integration.test.ts`.
   - Simulate `/blu-plan-phase` -> `/blu-execute-phase` -> `/blu-validate-phase` -> `/blu-verify-work`.
   - Assert plan, summary, verification, and UAT/report artifacts are valid and indexed.

3. High-risk maintenance confirmation:
   - Seed a repo with dirty or risky state.
   - Simulate `/blu-cleanup`, `/blu-undo`, or `/blu-ship`.
   - Assert no mutating tool runs before a confirmation fixture returns accept.
   - Assert decline/cancel paths leave repo and global state untouched.

These tests should not inspect the actual host CLI. They should verify the prompt-level contract and deterministic MCP state engine agree about what must happen.

## 6. Regression Fixtures

Create a scenario manifest similar to `tests/fixtures/impact/scenarios.json`:

```json
{
  "schemaVersion": "blueprint.prompt-eval.scenarios.v1",
  "scenarios": [
    {
      "id": "router-do-planned-not-runnable",
      "group": "router",
      "command": "blu",
      "fixtureRepo": "initialized-repo",
      "expectedTools": ["blueprint_project_status", "blueprint_command_catalog"],
      "forbiddenCommands": ["/blu-do"],
      "expectedFinalPatterns": ["implemented"]
    }
  ]
}
```

Recommended first regression IDs:

- `router-do-planned-not-runnable`
- `help-progress-next-implemented-only`
- `plan-phase-model-only-no-markdown-fallback`
- `plan-phase-no-double-encoded-plan-id`
- `plan-phase-no-live-web-browse`
- `execute-phase-summary-before-complete-claim`
- `verify-work-no-pass-without-evidence`
- `cleanup-requires-confirmation-before-mutation`
- `ship-requires-confirmation-and-report-before-mutation`
- `undo-requires-confirmation-before-git-mutation`
- `impact-command-manifest-change-classified`
- `code-review-fix-does-not-mutate-before-findings-read`
- `skill-inputs-no-sibling-contract-leakage`
- `runtime-resource-docs-unavailable-still-works`

Use fixture repos already present where possible:

- `tests/fixtures/help-progress-health/*`
- `tests/fixtures/new-project/*`
- `tests/fixtures/map-codebase/brownfield-repo`
- `tests/fixtures/impact/base-repo`
- `tests/fixtures/settings-profile/*`

Add only small new repo fixtures when an existing one cannot represent the state.

## Evaluation Dimensions

Each scenario should report these deterministic pass/fail dimensions:

| Dimension | What It Measures |
|---|---|
| Packet coherence | Command, skill, runtime metadata, runtime resource, and active inputs agree. |
| Tool discipline | Required tools are present, forbidden tools are absent, persistence uses MCP only. |
| Order discipline | Resolve/read/decide/execute/persist/validate/route order is preserved where required. |
| Confirmation discipline | Risky writes and overwrite paths require explicit user gate fixtures. |
| Artifact discipline | Golden model outputs pass live schema/model/Markdown validators. |
| Routing discipline | Final actions name only implemented commands and preserve blockers. |
| Drift discipline | Docs-unavailable runtime-owned commands still resolve from source metadata. |
| Regression discipline | Known defect classes have named, stable fixtures. |

## Staged Implementation Path

### Stage 0: Helpers And Manifest

- Add `tests/fixtures/prompt-eval/scenarios.json` with 8-12 high-value scenarios.
- Add `tests/helpers/prompt-eval.ts` with:
  - command manifest reader
  - triple-quoted prompt extractor
  - prompt packet builder
  - whitespace/FQN normalizer
  - scenario manifest schema using `zod`
- Keep this stage read-only against the repo except fixture files.

Exit criteria: helper can build packets for `/blu`, `/blu-plan-phase`, `/blu-execute-phase`, `/blu-cleanup`, and `/blu-impact`.

### Stage 1: Golden Contract Packets

- Add `tests/prompt-eval/golden-command-contracts.test.ts`.
- Commit goldens for 6 commands first:
  - `/blu`
  - `/blu-help`
  - `/blu-plan-phase`
  - `/blu-execute-phase`
  - `/blu-cleanup`
  - `/blu-impact`
- Require intentional golden updates when prompt contracts change.

Exit criteria: packet changes produce clear JSON diffs that identify changed tools, inputs, gates, and response requirements.

### Stage 2: Prompt Lints

- Add prompt lint tests for FQN usage, docs-free active inputs, path-free manifest loading, no raw `.blueprint/` writes, high-risk confirmation language, and implemented-only router language.
- Start with warnings encoded as failing tests only for shipped commands where the contract is already explicit. Do not blanket-fail planned commands.

Exit criteria: every implemented command has a packet-level lint result with actionable failure messages.

### Stage 3: Drift Matrix

- Add command-to-skill-to-MCP drift tests over every implemented catalog entry.
- Use runtime metadata as the source-owned fallback when docs are unavailable, following the pattern in `tests/phase-execution-runtime-contract-resource.test.ts`.
- Assert optional agents and required tools agree across catalog, runtime resource, active inputs, and prompt packet.

Exit criteria: adding a new implemented command fails until manifest, skill input bundle, required tools, runtime resource, and packet expectations are aligned.

### Stage 4: Artifact Shape Fixtures

- Add model-output fixtures for `phase.plan`, `phase.summary`, `phase.verification`, `phase.uat`, and one report contract.
- Validate fixtures through existing MCP validators and write tools in temporary repos.
- Add negative fixtures for common prompt failure modes.

Exit criteria: prompt-required artifact behavior is backed by live contract validation rather than prose alone.

### Stage 5: Simulated Journeys

- Add scripted journey tests for router, plan-to-verify, and one high-risk maintenance command.
- Keep the journey runner deterministic: no live LLM, no host CLI, no network, no installed extension mutation.
- Use the same temporary repo and `createGitRepo` fixture style as existing tests.

Exit criteria: at least three end-to-end prompt contracts are executable as deterministic state journeys.

### Stage 6: Optional Transcript And Host Tier

- Add a separate opt-in script, not default `npm test`, for recorded host transcript replay.
- Later, add live Gemini smoke only behind credentials and explicit environment gates, similar to `tests/extension-install.integration.ts`.
- Keep live LLM results advisory until the deterministic suite is stable.

Exit criteria: prompt regressions are caught locally; live host tests are release/nightly confidence, not the only eval signal.

## CI And Script Recommendation

Do not add a separate package dependency or CI gate in the first harness commit unless the repo is also adding CI. The current `npm test` already runs `npm run build --silent && tsx --test tests/**/*.test.ts`, which is enough for the deterministic prompt-eval suite.

Once CI exists, add:

- `npm run test:prompt-eval` for targeted prompt contract runs
- `npm run verify` that includes typecheck, normal tests, prompt evals, and production audit
- scheduled or release-only host transcript/live smoke

## Non-Goals

- Do not use live web browsing or current external docs in prompt-eval tests.
- Do not score model creativity or subjective answer quality in v1.
- Do not mutate installed extension directories or host-global `~/.gemini/blueprint/` state.
- Do not make planned commands routable to satisfy fixtures.
- Do not replace MCP tool tests; prompt eval should sit above them and reuse them.
- Do not require Docker/Testcontainers for the default prompt-eval suite.

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| Goldens become noisy word snapshots. | Store structural packet fields, not full prompt prose. |
| Prompt lint rules become too broad. | Start with command families whose contracts already state the rule explicitly. |
| Fixture runner duplicates MCP tests. | Make prompt eval assert command-packet obligations, then call existing MCP validators for state. |
| Live LLM evals are flaky. | Keep live transcript tier optional and advisory until deterministic coverage is mature. |
| Runtime authority remains split between docs and source metadata. | Include docs-unavailable tests and prefer runtime-owned metadata where already available. |

## Success Criteria

The harness is working when:

- a missing required MCP FQN in a command prompt fails locally
- a command that loads a sibling skill contract fails locally
- a high-risk command without an explicit confirmation gate fails locally
- `/blu`, `/blu-help`, `/blu-progress`, and `/blu-next` cannot regress into planned-only recommendations
- `/blu-plan-phase` cannot regress to raw Markdown plan writes or non-strict validation
- artifact output fixtures pass the same model/schema validators the command prompts require
- adding a new implemented command requires adding or intentionally updating prompt-eval coverage

## Top Recommendation

Start with Stage 1 and Stage 2 for six commands: `/blu`, `/blu-help`, `/blu-plan-phase`, `/blu-execute-phase`, `/blu-cleanup`, and `/blu-impact`. This gives fast value across router safety, lifecycle authoring, high-risk confirmation, and impact classification while staying grounded in the repo's current `node:test` patterns.
