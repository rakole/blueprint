# Blueprint

![Blueprint](https://raw.githubusercontent.com/rakole/blueprint/main/resources/README_banner_dark.png)

Blueprint is a Gemini CLI extension for running a structured, artifact-backed product workflow inside your repository. It helps you turn an idea into a roadmap, shape each phase, execute the work, validate the result, review it, and ship it without losing the thread between sessions.

The workflow is inspired by GSD, but Blueprint's skills, workflows, commands, and runtime are custom-built for Blueprint.

This README documents the shipped user-facing surface and the active implementation only. If a command is not listed here, you should treat it as not public yet.

Wave 0 shipped commands cover the stable routing, bootstrap, lifecycle, and maintenance surface that Blueprint exposes today.

Phase 3 discovery commands are shipped. Phase 3 discovery shipped the same day and remains in parity closeout while later waves land.

The shipped lifecycle slice also includes `/blu-plan-phase`, `/blu-execute-phase`, `/blu-validate-phase`, `/blu-verify-work`, and the read-only next-step router `/blu-next`.

<!-- command-registry:readme-chooser:start -->
## Command Chooser

I want to...
- Start fresh → /blu-new-project
- Understand an existing repo → /blu-map-codebase
- Decide next safe action → /blu-next
- Plan implementation → /blu-plan-phase <phase>
- Execute safely → /blu-execute-phase <phase>
- Review/fix code → /blu-code-review <phase>, /blu-code-review-fix <phase>
- Ship → /blu-ship

This chooser is generated from `generated/command-catalog.json`. 54 direct commands are runnable now; 1 retained command is kept out of runnable help until the live catalog marks it implemented.
<!-- command-registry:readme-chooser:end -->

## Current Runtime Layout

<!-- command-registry:readme-runtime-layout:start -->
The active command map is generated from `src/mcp/command-runtime-metadata.ts` into `generated/command-catalog.json`. Runtime availability still comes from the live `blueprint_command_catalog` check, so missing manifests, skills, MCP tools, or required runtime inputs downgrade commands before they can be recommended.

- Root router manifest: `commands/blu.toml`
- Runnable direct command manifests: 54
- Non-runnable retained command: 1

Runnable command manifests:
- `commands/blu-add-backlog.toml`
- `commands/blu-add-phase.toml`
- `commands/blu-add-tests.toml`
- `commands/blu-add-todo.toml`
- `commands/blu-audit-fix.toml`
- `commands/blu-audit-milestone.toml`
- `commands/blu-check-todos.toml`
- `commands/blu-cleanup.toml`
- `commands/blu-code-review-fix.toml`
- `commands/blu-code-review.toml`
- `commands/blu-complete-milestone.toml`
- `commands/blu-debug.toml`
- `commands/blu-discuss-phase.toml`
- `commands/blu-docs-update.toml`
- `commands/blu-execute-phase.toml`
- `commands/blu-explore.toml`
- `commands/blu-fast.toml`
- `commands/blu-health.toml`
- `commands/blu-help.toml`
- `commands/blu-impact.toml`
- `commands/blu-insert-phase.toml`
- `commands/blu-list-phase-assumptions.toml`
- `commands/blu-map-codebase.toml`
- `commands/blu-milestone-summary.toml`
- `commands/blu-new-milestone.toml`
- `commands/blu-new-project.toml`
- `commands/blu-new-workspace.toml`
- `commands/blu-next.toml`
- `commands/blu-note.toml`
- `commands/blu-pause-work.toml`
- `commands/blu-plan-milestone-gaps.toml`
- `commands/blu-plan-phase.toml`
- `commands/blu-pr-branch.toml`
- `commands/blu-progress.toml`
- `commands/blu-quick.toml`
- `commands/blu-reapply-patches.toml`
- `commands/blu-remove-phase.toml`
- `commands/blu-remove-workspace.toml`
- `commands/blu-research-phase.toml`
- `commands/blu-resume-work.toml`
- `commands/blu-review-backlog.toml`
- `commands/blu-review.toml`
- `commands/blu-secure-phase.toml`
- `commands/blu-set-profile.toml`
- `commands/blu-settings.toml`
- `commands/blu-ship.toml`
- `commands/blu-spec-phase.toml`
- `commands/blu-ui-phase.toml`
- `commands/blu-ui-review.toml`
- `commands/blu-undo.toml`
- `commands/blu-update.toml`
- `commands/blu-validate-phase.toml`
- `commands/blu-verify-work.toml`
- `commands/blu-workstreams.toml`

Runtime skill bundles used by runnable commands:
- `skills/blueprint-bootstrap/SKILL.md`
- `skills/blueprint-capture/SKILL.md`
- `skills/blueprint-debug/SKILL.md`
- `skills/blueprint-docs/SKILL.md`
- `skills/blueprint-governance/SKILL.md`
- `skills/blueprint-impact/SKILL.md`
- `skills/blueprint-maintenance/SKILL.md`
- `skills/blueprint-map/SKILL.md`
- `skills/blueprint-phase-discovery/SKILL.md`
- `skills/blueprint-phase-execution/SKILL.md`
- `skills/blueprint-phase-planning/SKILL.md`
- `skills/blueprint-phase-validation/SKILL.md`
- `skills/blueprint-review/SKILL.md`
- `skills/blueprint-roadmap-admin/SKILL.md`
- `skills/blueprint-router/SKILL.md`
<!-- command-registry:readme-runtime-layout:end -->

## What Blueprint Gives You

- A root router, `/blu`, that helps you find the safest next command.
- Direct commands, `/blu-<command>`, when you want precise control.
- Durable project state in `.blueprint/` so planning and execution survive chat resets.
- A full repo workflow for bootstrap, planning, execution, validation, reviews, milestone management, and shipping.
- Implemented-only routing: `/blu`, `/blu-help`, and `/blu-progress` surface only commands that are actually shipped.

## Install

Blueprint is designed for Gemini CLI.

Prerequisites:

- Gemini CLI
- Node.js 20 or newer

Install from GitHub:

```bash
gemini extensions install https://github.com/rakole/blueprint
```

After install:

1. Restart Gemini CLI.
2. Run `/blu-help` to confirm Blueprint loaded.

If you are testing from a local checkout instead of GitHub:

```bash
npm ci
npm run build
gemini extensions link .
```

Then restart Gemini CLI and run `/blu-help`.

## Command Style

Blueprint gives you two ways to work:

- Use `/blu` when you want routing or next-step guidance.
- Use `/blu-<command>` when you already know the exact action you want.

Examples:

```text
/blu
/blu what should I do next
/blu-new-project
/blu-plan-phase 3
/blu-add-todo "Add keyboard shortcuts to the editor"
```

## Quick Start

### Starting a new project

1. Run `/blu-new-project`.
2. Review the generated `.blueprint/PROJECT.md`, `.blueprint/REQUIREMENTS.md`, and `.blueprint/ROADMAP.md`.
3. Run `/blu-progress` or `/blu-next` to see the recommended next move.
4. Start the first phase with `/blu-discuss-phase 1`.

### Adding Blueprint to an existing repository

1. Run `/blu-map-codebase` first.
2. Run `/blu-new-project` to create the project plan on top of that repo context.
3. Use `/blu-progress` to continue from the recommended next step.

### Running a phase end to end

1. `/blu-discuss-phase <phase>`
2. `/blu-research-phase <phase>` when the phase needs technical research
3. `/blu-ui-phase <phase>` when the phase has meaningful UI scope
4. `/blu-plan-phase <phase>`
5. `/blu-execute-phase <phase>`
6. `/blu-validate-phase <phase>`
7. `/blu-verify-work <phase>`

Optional quality passes after execution:

- `/blu-code-review <phase>`
- `/blu-code-review-fix <phase>`
- `/blu-audit-fix <phase>`
- `/blu-secure-phase <phase>`
- `/blu-ui-review <phase>`
- `/blu-add-tests <phase>`
- `/blu-review <phase>`

## What Blueprint Writes

Blueprint keeps project state in `.blueprint/` inside your repo:

```text
.blueprint/
  PROJECT.md
  REQUIREMENTS.md
  ROADMAP.md
  STATE.md
  config.json
  phases/
  impact/
  reports/
  codebase/
  notes/
  todos/
  backlog/
```

What those files do:

- `PROJECT.md`: your product vision, audience, constraints, and milestone framing
- `REQUIREMENTS.md`: the requirements Blueprint is planning and verifying against
- `ROADMAP.md`: your ordered phases and milestone structure
- `STATE.md`: the current workflow position and safest next action
- `config.json`: repo-level Blueprint settings
- `phases/`: per-phase context, research, plans, summaries, validation, UAT, review, and UI artifacts
- `impact/`: blast-radius report bundles from `/blu-impact`
- `reports/`: command reports such as debug, ship, cleanup, milestone audit, and add-tests outputs
- `codebase/`: brownfield repo mapping documents
- `notes/`, `todos/`, `backlog/`: lightweight project capture

Blueprint is designed to keep those artifacts in version control by default so the workflow stays visible and resumable.

## How The Workflow Fits Together

<!-- command-registry:readme-workflow:start -->
The runnable command groups below are generated from the same registry as `/blu-help` and `docs/COMMAND-CATALOG.md`.

### Foundation

- `/blu`: root router for safe command selection and next-step guidance
- `/blu-health`: `health` checks Blueprint project health and can run explicit repair-mode normalization through MCP-owned tools.
- `/blu-help`: `help` shows safe Blueprint router guidance from project readiness and the implemented command catalog.
- `/blu-map-codebase`: `map-codebase` analyzes a brownfield codebase with mapper-style passes and produces the stable seven-document Blueprint codebase bundle.
- `/blu-new-project`: new-project initializes a Blueprint project with deep context gathering and PROJECT.md.
- `/blu-progress`: `progress` summarizes Blueprint repo status, blockers, warnings, and next safe implemented guidance from MCP-owned state.
- `/blu-set-profile`: `set-profile` changes the current project model_profile through the governance MCP config substrate.
- `/blu-settings`: `settings` inspects and updates Blueprint repo or default configuration through governance MCP tools.

### Core Lifecycle

- `/blu-discuss-phase`: `discuss-phase` gathers durable phase context through adaptive discovery, capability-gated gray-area research sidecars, checkpointed resumability, validation repair, and MCP-owned phase artifact writes.
- `/blu-execute-phase`: `execute-phase` executes saved phase plans in deterministic target order, records plan-linked execution summaries, and syncs Blueprint state without claiming phase completion.
- `/blu-next`: `next` returns the next safe direct Blueprint command for the current repo state without widening beyond implemented commands.
- `/blu-pause-work`: `pause-work` records a canonical handoff from current Blueprint state and artifact inventory.
- `/blu-plan-phase`: `plan-phase` creates or extends execution-ready phase plans through MCP-owned structured phase.plan model validation and plan writes.
- `/blu-research-phase`: `research-phase` gathers phase-scoped implementation guidance from saved Blueprint artifacts, optional spec evidence, repo evidence, and approved external references, then persists validated research through MCP-owned state paths.
- `/blu-resume-work`: `resume-work` restores working context from the canonical pause handoff and records the next safe action.
- `/blu-spec-phase`: `spec-phase` clarifies what a Blueprint phase should deliver and writes the optional phase-scoped spec artifact before later discovery and planning flows.
- `/blu-ui-phase`: `ui-phase` creates or reuses the single phase-scoped UI artifact, writing either a UI design contract or an explicit skip rationale through MCP-owned phase artifact persistence.
- `/blu-validate-phase`: `validate-phase` audits saved execution summaries and persists phase verification evidence through the validation MCP substrate.
- `/blu-verify-work`: `verify-work` runs summary-backed UAT and persists resumable phase UAT evidence through the validation MCP substrate.

### Roadmap And Milestone

- `/blu-add-phase`: Append a new whole-number phase to an initialized Blueprint roadmap through MCP-owned roadmap and scaffold writes.
- `/blu-audit-milestone`: `audit-milestone` compares original milestone intent against saved phase evidence and writes a durable milestone audit report with grouped gaps and traceability notes.
- `/blu-complete-milestone`: `complete-milestone` performs a report-driven closeout gated by saved milestone audit readiness, writes a durable completion report, and routes to milestone summary.
- `/blu-insert-phase`: `insert-phase` inserts urgent work as a decimal phase between existing phases, scaffolds the matching phase context starter, records roadmap evolution state, and routes back to discovery without renumbering later phases.
- `/blu-list-phase-assumptions`: `list-phase-assumptions` surfaces read-only pre-planning assumptions about a phase so users can correct misunderstandings before discovery or planning.
- `/blu-milestone-summary`: `milestone-summary` builds a durable consolidated milestone spec from saved roadmap, audit, and completion evidence and routes toward the next milestone-start action.
- `/blu-new-milestone`: `new-milestone` starts a new milestone cycle by deriving carry-forward context from the saved consolidated milestone spec, scaffolding starter docs and the first phase context, and preserving historical phase artifacts.
- `/blu-plan-milestone-gaps`: `plan-milestone-gaps` creates grouped roadmap phases to close actionable gaps identified by the saved milestone audit, keeping persistence on roadmap and state MCP tools.
- `/blu-remove-phase`: `remove-phase` removes a future roadmap phase, deletes its phase directory, renumbers subsequent roadmap and phase artifacts, and re-anchors state on the safest implemented follow-up.

### Capture And Lightweight Execution

- `/blu-add-backlog`: `add-backlog` appends explicit parking-lot ideas and can reserve a confirmed 999.x phase stub through MCP-owned capture and scaffold writes.
- `/blu-add-todo`: `add-todo` appends explicit project-local todo items through the capture index MCP tool.
- `/blu-check-todos`: `check-todos` inspects pending project-local todos and can mark one active or completed through bounded MCP updates.
- `/blu-debug`: `debug` investigates a concrete issue, persists a durable debug-latest report, and stops at an explicit follow-up gate before todo capture or fix attempts.
- `/blu-explore`: `explore` briefly classifies an idea into note, todo, backlog, roadmap, or no-write and persists only the explicitly confirmed target through MCP tools.
- `/blu-fast`: `fast` handles genuinely trivial inline execution without subagents, durable reports, or phase artifacts.
- `/blu-note`: `note` appends explicit project-local notes through the capture index MCP tool while keeping unsupported list, promote, and global-note asks in safe suggestion mode.
- `/blu-quick`: `quick` runs bounded quick delivery with optional depth gates, persists durable quick-run evidence, and routes follow-up through implemented Blueprint commands.
- `/blu-review-backlog`: `review-backlog` previews canonical backlog entries, promotes or archives confirmed items, and records the next safe state through MCP-owned transitions.

### Quality And Shipping

- `/blu-add-tests`: `add-tests` generates focused repo tests from saved phase evidence and persists validation plus report artifacts through MCP tools.
- `/blu-audit-fix`: `audit-fix` classifies saved review, security, verification, and UAT evidence, applies bounded remediation when not dry-running, persists a durable audit-fix report, and updates state through MCP tools.
- `/blu-code-review`: `code-review` reviews source files changed during a Blueprint phase, resolves deterministic scope from executed plan metadata or explicit file paths, honors review settings, audits saved phase evidence, and persists the result through review MCP tools instead of prompt-only file writes.
- `/blu-code-review-fix`: `code-review-fix` applies bounded fixes from saved code-review findings and persists review-fix evidence plus state through MCP tools.
- `/blu-docs-update`: `docs-update` refreshes or verifies selected repo documentation against saved Blueprint and repo evidence, optionally checks current external truth, and persists the durable docs-update report through MCP.
- `/blu-impact`: `impact` performs advisory blast-radius analysis for a resolved change scope, persists an impact report bundle when writing is enabled, and renders the requested output format through the impact MCP substrate.
- `/blu-pr-branch`: `pr-branch` prepares a clean review branch by filtering Blueprint bookkeeping scope and persists a durable report.
- `/blu-review`: `review` orchestrates bounded peer review from saved phase plans and evidence, preserves reviewer availability and disagreement honestly, and persists the peer-review artifact through review MCP tools.
- `/blu-secure-phase`: `secure-phase` verifies declared saved-plan threats against completed execution evidence and persists phase security evidence through review MCP tools.
- `/blu-ship`: `ship` prepares a confirmation-gated shipping run from saved Blueprint evidence and records actual push or PR outcomes.
- `/blu-ui-review`: `ui-review` audits shipped UI work against saved execution and UI-spec evidence, optionally delegates bounded six-pillar analysis, and persists the UI-review artifact through review MCP tools.
- `/blu-undo`: `undo` previews a bounded revert, persists a durable undo report, and runs only confirmed safe revert-style git steps.

### Workspace And Maintenance

- `/blu-cleanup`: `cleanup` archives completed Blueprint phase directories through a protected-scope confirmation flow and persists a durable cleanup report.
- `/blu-new-workspace`: `new-workspace` creates a confirmed multi-repo workspace and records it in host-global Blueprint workspace state.
- `/blu-reapply-patches`: `reapply-patches` previews, confirms, replays, and records host-global Blueprint patch reapplication.
- `/blu-remove-workspace`: `remove-workspace` tears down an exact confirmed workspace and updates the host-global workspace registry.
- `/blu-update`: `update` inspects the installed Blueprint extension and prepares an advisory out-of-band update checklist.
- `/blu-workstreams`: `workstreams` lists, creates, switches, resumes, or completes project-local Blueprint workstreams through MCP-owned state.
<!-- command-registry:readme-workflow:end -->

## Common Workflows

### I want Blueprint to tell me what to do

Start with:

- `/blu`
- `/blu-help`
- `/blu-progress`
- `/blu-next`

### I know exactly what I want

Use the direct command:

- `/blu-add-phase "Admin audit trail"`
- `/blu-plan-phase 4`
- `/blu-quick "Rename the API env var and update the affected tests"`

### I need to capture an idea without committing to roadmap work

Use:

- `/blu-note` for raw project notes
- `/blu-add-todo` for concrete next tasks
- `/blu-add-backlog` for later ideas
- `/blu-explore` when you want Blueprint to help classify the idea first

### I need to close a milestone cleanly

Use:

1. `/blu-audit-milestone`
2. `/blu-plan-milestone-gaps` if the audit found missing work
3. `/blu-complete-milestone`
4. `/blu-milestone-summary`
5. `/blu-new-milestone`

## Safety Model

Blueprint is opinionated about safety:

- It prefers durable artifacts over relying on temporary chat context.
- It keeps `/blu`, `/blu-help`, and `/blu-progress` limited to implemented commands.
- High-risk actions such as roadmap mutation, workspace creation or removal, branch preparation, shipping, undo, cleanup, and patch replay are confirmation-gated.
- It keeps project state in `.blueprint/` instead of scattering workflow state across ad-hoc files.

## Commands Not Public Yet

<!-- command-registry:readme-non-public:start -->
The retained entries below are not public runnable commands in the current runtime. `/blu`, `/blu-help`, `/blu-progress`, and `/blu-next` must not advertise them until the live catalog marks them `implemented`.

- `do`: runtime status `repairing`, declared `planned`. Blocked by: Missing command manifest: commands/blu-do.toml.
<!-- command-registry:readme-non-public:end -->

## Troubleshooting

### `/blu-help` does not appear after install

- Restart Gemini CLI after install or update.
- If you installed from a local checkout, make sure you ran `npm run build` first.
- Re-run `gemini extensions install https://github.com/rakole/blueprint` if needed.

### Blueprint says the repo is not initialized

Run `/blu-new-project`.

### The repo already has code and the roadmap feels under-informed

Run `/blu-map-codebase`, then continue with `/blu-new-project` or `/blu-progress`.

### Blueprint says the project is partial or unhealthy

Run `/blu-health`.

### I want to know the safest next move

Run `/blu-progress` or `/blu-next`.

### I saw a command in older docs or chat, but not in help

Only implemented commands are surfaced. If it is not shown by `/blu-help`, treat it as not public yet.
