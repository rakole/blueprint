# Custom-Agent Audit And Fix Plan

## Status

- Audit date: 2026-04-12
- Scope: all shipped Blueprint custom agents in `agents/`
- Blueprint agent count reviewed: 9
- Blueprint agent corpus size reviewed: 189 lines total
- Upstream GSD baseline: `rakole/get-shit-done` commit `c480961de6142ff6f126f6745a49dc983c9a7269`
- Upstream comparable agent corpus reviewed: 6,631 lines total
- Official Gemini references used:
  - `https://geminicli.com/docs/core/subagents/`
  - `https://geminicli.com/docs/extensions/reference/`

## Executive Summary

Blueprint's shipped agent layer is materially drifted.

The largest problem is a platform-level blocker: none of the nine shipped `agents/*.md` files are valid Gemini subagent definition files. The Gemini CLI subagent docs require Markdown agent files to start with YAML frontmatter, and the extension reference says extension subagents are bundled by placing those definition files in `agents/`. Every current Blueprint agent file starts directly with Markdown headings instead. Based on the official docs, these files should not be treated as valid Gemini subagents.

The second problem is availability drift inside Blueprint itself. `src/mcp/tools/project.ts` and the current command-catalog tests only check whether an agent file exists on disk. That means Blueprint can claim an optional agent is available even when the file is not a valid Gemini agent definition.

The third problem is behavioral dilution versus upstream GSD. Blueprint preserved the broad agent roster and rough responsibility split, but it compressed most agents down to purpose/output/boundary notes. In practice, most of the real behavior contract now lives in command prompts and skill docs rather than in the agents themselves. That makes the agents weak, inconsistent, and prompt-sensitive.

The most diluted agents are `blueprint-planner`, `blueprint-checker`, `blueprint-executor`, and `blueprint-verifier`. The least diluted is `blueprint-researcher`, but it is still platform-invalid and still missing key Gemini-facing metadata and project-context handling.

## Audit Method

This audit used four lenses:

1. Gemini CLI subagent compliance
   - file format
   - required metadata
   - routing-friendly descriptions
   - isolated-tool support

2. Upstream GSD parity
   - compare each Blueprint agent to the closest upstream GSD agent
   - focus on accidental loss of behavior contract, not line-count parity for its own sake

3. Blueprint internal contract drift
   - compare each agent against the command and skill files that currently claim to use it

4. Model-behavior quality review
   - based on prompt-engineering and agent-training behavior rather than only repo-local wording

## Intentional Blueprint Deltas That Were Not Logged As Drift

These are valid Blueprint differences and should stay:

- parent commands and MCP tools own persistence; agents do not need to become a second state engine
- no `.planning/` runtime ownership
- no file-for-file port of upstream CLAUDE/Codex tool names or shell flows
- no command-status-semantic changes that make agent presence a requirement for command routability
- no silent exposure of planned-only commands

The drift in this report is about removing too much contract depth, not about refusing a literal GSD port.

## Cross-Cutting Findings

### AGENT-01 Blocker: None Of The Shipped Agent Files Are Valid Gemini Subagent Definitions

Evidence:

- All nine files in `agents/` start with Markdown headings instead of YAML frontmatter.
- Gemini CLI subagent docs say custom agents are Markdown files with YAML frontmatter and that the file must start with frontmatter.
- Gemini extension docs say subagents are bundled from the extension-root `agents/` directory.

Impact:

- Blueprint currently ships agent contract files that satisfy local file-existence checks but do not meet the documented Gemini subagent file format.
- Forced `@agent` use and automatic delegation should both be considered unreliable until this is fixed.

Affected files:

- `agents/blueprint-project-researcher.md`
- `agents/blueprint-roadmapper.md`
- `agents/blueprint-mapper.md`
- `agents/blueprint-researcher.md`
- `agents/blueprint-ui-designer.md`
- `agents/blueprint-planner.md`
- `agents/blueprint-checker.md`
- `agents/blueprint-executor.md`
- `agents/blueprint-verifier.md`

### AGENT-02 High: Blueprint Overstates Agent Availability

Evidence:

- `src/mcp/tools/project.ts` populates `availableOptionalAgents` by checking only whether `agents/<name>.md` exists.
- `tests/command-catalog.test.ts` asserts available optional agents from file presence only.

Impact:

- Blueprint can report an agent as shipped and available even when Gemini CLI would reject or ignore the file.
- This hides real drift from both runtime metadata and regression tests.

Consequence:

- Agent validity needs its own guardrail, but command `implemented` status semantics should remain unchanged.

### AGENT-03 High: Description-Driven Routing Is Missing Entirely

Evidence:

- Gemini CLI docs say the main agent decides whether to use a subagent based on the agent's description and recommends describing expertise, when to use it, and example scenarios.
- Blueprint currently has no frontmatter `description` field on any shipped agent.

Impact:

- Even after file-format repair, delegation quality will stay weak unless descriptions become trigger-rich and role-specific.

### AGENT-04 High: Tool Scope And Isolation Are Not Encoded

Evidence:

- Gemini CLI supports explicit `tools` lists and isolated MCP servers per subagent.
- Upstream GSD agents explicitly encode tool expectations in frontmatter.
- Blueprint agents currently encode no tool scope at all.

Impact:

- There is no repo-checked contract for what each agent is allowed to use once real Gemini subagent loading is restored.
- Bounded specialists can silently behave like generalists.

Note:

- `tools` are optional in Gemini CLI, so this is not a format blocker.
- It is still a meaningful drift because Blueprint depends on bounded-agent behavior.

### AGENT-05 High: Most Real Behavior Contracts Were Lifted Out Of The Agents

Evidence:

- Blueprint agents total 189 lines across nine files.
- The comparable upstream GSD agents reviewed total 6,631 lines.
- Except for `blueprint-researcher`, the Blueprint agents generally omit:
  - mandatory initial-read rules
  - project-context loading
  - explicit process steps
  - detailed output contracts
  - failure-mode guidance
  - downstream-consumer context
- The command and skill files now carry much of the detail that should live in the agent prompts.

Impact:

- The agent becomes a weak label instead of a reliable specialist.
- Parent command prompts must keep restating agent logic.
- Behavior becomes fragile under prompt changes and more likely to drift again.

### AGENT-06 Medium: Repo-Instruction Awareness Is Mostly Missing

Evidence:

- Upstream planning, execution, verification, and UI agents explicitly load project instructions and skill rules before acting.
- Blueprint agents do not consistently encode any equivalent `AGENTS.md` or `GEMINI.md` awareness.

Impact:

- Agents are more likely to violate repo-local constraints or miss Blueprint-specific conventions.

Training-based note:

- When a subagent runs in an isolated context loop, assumptions about inherited repo guidance are unsafe unless the contract makes that guidance explicit.

### AGENT-07 Medium: Layer Boundaries Drifted In Docs

Evidence:

- `docs/SKILLS-AND-AGENTS.md` says `add-phase` uses `blueprint-roadmap-admin` under `Command To Agent Expectations`.
- `blueprint-roadmap-admin` is a skill, not an agent.

Impact:

- This reintroduces the exact command-skill-agent blurring that earlier drift repair tried to remove.

## Model-Behavior Risks

These are not copied from a single repo file. They come from the practical behavior of agent prompts.

- Very short agent prompts collapse into generalist behavior.
  - If the prompt only says purpose, outputs, and boundaries, the model must re-derive process and quality bars on every run.

- Missing output schemas increase entropy.
  - The model optimizes for a plausible answer, not the exact artifact shape the parent command expects.

- Missing stop conditions widen scope.
  - Planner, checker, executor, and verifier prompts need explicit rules for what they must not do, not just what they are for.

- Missing project-context loading causes local-rule drift.
  - This is especially risky for execution and verification agents.

## Agent-By-Agent Findings

| Blueprint Agent | Upstream Baseline | Current State | Main Drift |
|---|---|---|---|
| `blueprint-project-researcher` | `gsd-project-researcher` | Very light bootstrap brief contract | Missing Gemini frontmatter, mandatory reads, source/verification protocol, clearer bootstrap output structure, and richer brownfield/bootstrap decision support |
| `blueprint-roadmapper` | `gsd-roadmapper` | Very light roadmap synthesis note | Missing requirement-to-phase coverage rules, success-criteria derivation, dependency logic, numbering rules, and gap-grouping behavior now expected by roadmap-admin flows |
| `blueprint-mapper` | `gsd-codebase-mapper` | Minimal bundle note | Missing focus modes, seven-artifact ownership details, process steps, output templates, and reuse/replace handling needed for consistent codebase docs |
| `blueprint-researcher` | `gsd-phase-researcher` | Closest current file to usable | Still invalid as a Gemini agent and still missing project-context handling, tool scope, run limits, and richer revision/update guidance |
| `blueprint-ui-designer` | `gsd-ui-researcher` | Thin UI-contract note | Missing design-system detection, skip-rationale logic, upstream-artifact ingestion, question filtering, output template, and safety-vetting rules |
| `blueprint-planner` | `gsd-planner` | Skeleton plan prompt | Missing plan schema, must-haves derivation, dependency-wave rules, config-gate handling, revision-loop instructions, and downstream execution awareness |
| `blueprint-checker` | `gsd-plan-checker` | Skeleton validation prompt | Missing goal-backward dimensions, blocker/warning schema, context-compliance checks, dependency validation, scope-sanity checks, and concrete fix hints |
| `blueprint-executor` | `gsd-executor` | Skeleton execution prompt | Missing per-plan execution protocol, deviation rules, auth-gate handling, checkpoint logic, summary contract, partial-run honesty rules, and repo-instruction enforcement |
| `blueprint-verifier` | `gsd-verifier` | Skeleton validation/UAT prompt | Missing summary-first verification, must-have derivation, artifact and wiring checks, re-verification mode, override handling, and detailed UAT/gap classification rules |

## Severity By Agent

- Blocked at platform format level:
  - all 9 shipped agents

- Highest behavioral drift:
  - `blueprint-planner`
  - `blueprint-checker`
  - `blueprint-executor`
  - `blueprint-verifier`

- High but narrower drift:
  - `blueprint-ui-designer`
  - `blueprint-roadmapper`
  - `blueprint-mapper`

- Moderate drift:
  - `blueprint-project-researcher`
  - `blueprint-researcher`

## Blueprint-Internal Mismatch Notes

These are the most important mismatches between current Blueprint prompts/docs and the actual agent files:

- `commands/blu/plan-phase.toml` and `skills/blueprint-phase-planning.md` expect the planner to output execution-ready plans with frontmatter, dependency waves, task-level `Read First`, `Action`, and acceptance criteria, but `agents/blueprint-planner.md` does not encode that schema.
- `commands/blu/plan-phase.toml` expects the checker to review saved plans against requirements, locked decisions, and discovery artifacts, but `agents/blueprint-checker.md` has no review dimensions or issue schema.
- `commands/blu/execute-phase.toml` expects bounded per-plan execution and one summary artifact per completed plan, but `agents/blueprint-executor.md` does not encode per-plan execution or summary structure.
- `commands/blu/validate-phase.toml` and `commands/blu/verify-work.toml` expect summary-grounded validation and UAT analysis, but `agents/blueprint-verifier.md` does not encode summary-first verification or UAT output modes.
- `commands/blu/ui-phase.toml` expects concrete UI output or explicit skip rationale that can be written directly into `XX-UI-SPEC.md`, but `agents/blueprint-ui-designer.md` does not encode either output form.

## Recommended Fix Direction

Blueprint should not port every upstream GSD agent literally.

Blueprint should restore the missing contract shape selectively:

- keep Blueprint's MCP-owned persistence boundary
- keep commands thin
- keep agents bounded
- port the reasoning model, output structure, and failure-mode rules that make the agent reliable
- do not port upstream `.planning/` ownership, direct git rituals, or CLAUDE-specific shell/tool syntax unless there is a Blueprint reason

## Next-Round Execution Plan

### Goal

Repair the shipped Blueprint agent layer so it becomes:

1. valid for Gemini CLI subagent loading
2. behaviorally strong enough to match Blueprint's own command and skill contracts
3. guarded by regression checks that catch future drift without changing command status semantics

### Constraints

- Do not change `blueprint_command_catalog` command-status semantics.
- Do not make agent presence a new requirement for command routability.
- Keep persistent state ownership in MCP tools and parent commands.
- Preserve Blueprint-specific deltas from `docs/DECISIONS.md` and `AGENTS.md`.

### Workstream 1: Gemini Agent Schema Recovery

Priority: P0

Files:

- all shipped `agents/*.md`

Tasks:

1. Rewrite each shipped agent as a valid Gemini subagent file with YAML frontmatter.
2. Add at minimum:
   - `name`
   - `description`
   - `kind: local`
3. Add explicit, routing-friendly `description` text that states:
   - area of expertise
   - when the agent should be used
   - example scenarios
4. Add explicit `tools` allowlists using real Gemini CLI tool names and appropriate MCP wildcards where needed.
5. Add `max_turns` and `timeout_mins` where the role benefits from bounded runtime behavior.
6. Keep model overrides conservative unless a role clearly needs one.

Exit criteria:

- every shipped agent file starts with YAML frontmatter
- every shipped agent declares a valid `name` that matches the intended tool slug
- every shipped agent declares a routing-friendly `description`
- every shipped agent becomes loadable as a Gemini extension subagent by documented file format

### Workstream 2: Common Blueprint Agent Contract Blocks

Priority: P0

Files:

- all shipped `agents/*.md`

Tasks:

1. Add a consistent Blueprint-specific base contract to each agent:
   - role and purpose
   - mandatory initial-read behavior when the parent passes explicit context files
   - project-context awareness for repo guidance such as `AGENTS.md` and Blueprint docs when needed
   - explicit write boundary
   - explicit non-goals
2. Make clear when the agent returns content to the parent versus when it may write directly.
3. Encode the Blueprint delta once per agent instead of relying on the parent command to restate it every time.

Exit criteria:

- parent commands no longer need to carry most of the agent-specific quality bar
- every agent can stand on its own as a bounded specialist

### Workstream 3: Planning, Execution, And Validation Agent Recovery

Priority: P0

Files:

- `agents/blueprint-planner.md`
- `agents/blueprint-checker.md`
- `agents/blueprint-executor.md`
- `agents/blueprint-verifier.md`

Tasks:

1. `blueprint-planner`
   - encode the exact plan quality bar already promised by `plan-phase`
   - require concrete frontmatter, dependency waves, must-haves, task fields, and acceptance criteria
   - encode config-gate awareness and targeted revision behavior
2. `blueprint-checker`
   - port goal-backward review dimensions from upstream selectively
   - add blocker/warning output format
   - check requirements, dependencies, scope, context compliance, and key wiring
3. `blueprint-executor`
   - encode per-plan execution behavior, not vague phase-wide work
   - add deviation rules, auth-gate behavior, summary output contract, and partial-run honesty
4. `blueprint-verifier`
   - encode summary-first verification
   - add must-have derivation, artifact/wiring checks, re-verification behavior, and UAT/verification mode split

Exit criteria:

- planning, execution, and validation commands no longer depend on skeletal agent prompts
- planner/checker/executor/verifier each have a real bounded operating contract

### Workstream 4: Discovery, UI, Bootstrap, Roadmap, And Mapping Agent Recovery

Priority: P1

Files:

- `agents/blueprint-project-researcher.md`
- `agents/blueprint-roadmapper.md`
- `agents/blueprint-mapper.md`
- `agents/blueprint-researcher.md`
- `agents/blueprint-ui-designer.md`

Tasks:

1. `blueprint-project-researcher`
   - strengthen bootstrap-context gathering, brownfield classification, and confidence/assumption reporting
2. `blueprint-roadmapper`
   - encode requirement coverage, success-criteria derivation, sequencing logic, and milestone-gap grouping behavior
3. `blueprint-mapper`
   - encode the seven-artifact bundle, focus modes, evidence expectations, and reuse/replace discipline
4. `blueprint-researcher`
   - preserve the current strong research sections
   - add valid Gemini frontmatter, tool scope, project-context awareness, and clearer update/revision guidance
5. `blueprint-ui-designer`
   - encode design-system detection, UI-skip rationale mode, contract template, and stronger repo-context reading

Exit criteria:

- all shipped discovery/bootstrap/roadmap agents match the behavior Blueprint currently claims in command and skill docs

### Workstream 5: Runtime Metadata And Test Guardrails

Priority: P0

Files:

- `src/mcp/tools/project.ts`
- `tests/command-catalog.test.ts`
- new agent-contract regression tests

Tasks:

1. Add a lightweight bundled-agent validation helper that checks at least:
   - frontmatter exists
   - `name` exists
   - `description` exists
   - agent name matches expected filename or declared slug
2. Use that helper when populating `availableOptionalAgents`.
3. Keep command `status` and `implemented` semantics unchanged.
4. Add regression coverage so invalid agent files do not appear as available optional agents.
5. Add a direct syntax/metadata test over all shipped agent files.

Exit criteria:

- Blueprint stops advertising invalid agent files as available optional agents
- command exposure rules remain exactly as they are today

### Workstream 6: Documentation Truth-Sync

Priority: P1

Files:

- `docs/SKILLS-AND-AGENTS.md`
- `docs/GSD-RUNTIME-MIGRATION.md`
- `docs/DRIFT.MD`
- any command spec whose agent wording stops matching the repaired agent contracts

Tasks:

1. Fix skill-versus-agent mislabels such as the `add-phase` note in `docs/SKILLS-AND-AGENTS.md`.
2. Update any command or migration doc that still points to diluted agent behavior after repair.
3. Keep the drift ledger linked to the agent-repair work until the repair round closes.

Exit criteria:

- docs describe the repaired agent layer accurately
- command-skill-agent ownership stays explicit

### Workstream 7: Gemini Runtime Smoke Verification

Priority: P1

Environment requirement:

- linked or installed local Blueprint extension in Gemini CLI

Tasks:

1. Verify the repaired agents show up as extension subagents.
2. Force-run at least these agents with `@` invocation:
   - `@blueprint-researcher`
   - `@blueprint-planner`
   - `@blueprint-checker`
   - `@blueprint-verifier`
3. Confirm output shape matches the repaired contract for each role.
4. Confirm command routing still surfaces only implemented commands.
5. Confirm intentionally broken test fixtures, if added, are excluded from `availableOptionalAgents`.

Exit criteria:

- manual Gemini smoke checks pass
- repaired agent definitions are valid in the actual target runtime, not only in repo-local tests

## Suggested Execution Order

1. Workstream 1: Gemini agent schema recovery
2. Workstream 5: runtime metadata and test guardrails
3. Workstream 3: planning, execution, and validation agents
4. Workstream 4: discovery, UI, bootstrap, roadmap, and mapping agents
5. Workstream 6: documentation truth-sync
6. Workstream 7: Gemini runtime smoke verification

Reason:

- First make the files valid.
- Then stop the runtime from overstating availability.
- Then repair the most risk-heavy agents first.

## Minimum Acceptance Bar For The Repair Round

- all shipped Blueprint agents are valid Gemini subagent definition files
- all shipped Blueprint agents have routing-friendly descriptions
- all shipped Blueprint agents have explicit write boundaries
- `availableOptionalAgents` reports only syntactically valid shipped agents
- planner, checker, executor, and verifier regain a real bounded contract
- docs no longer confuse skills and agents
- command status semantics remain unchanged
- implemented-only routing guarantees remain unchanged

## Bottom Line

Blueprint has the right agent roster, but today it mostly ships agent placeholders rather than real Gemini subagents.

The fix is not to port upstream GSD verbatim. The fix is to restore the missing contract depth selectively, make the files valid for Gemini CLI, and add guardrails so Blueprint stops confusing file presence with actual agent availability.
