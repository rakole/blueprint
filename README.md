# Blueprint

Blueprint is a Gemini CLI extension for running a structured, artifact-backed product workflow inside your repository. It helps you turn an idea into a roadmap, shape each phase, execute the work, validate the result, review it, and ship it without losing the thread between sessions.

The workflow is inspired by GSD, but Blueprint's skills, workflows, commands, and runtime are custom-built for Blueprint.

This README documents the shipped user-facing surface and the active implementation only. If a command is not listed here, you should treat it as not public yet.

Wave 0 shipped commands cover the stable routing, bootstrap, lifecycle, and maintenance surface that Blueprint exposes today.

Phase 3 discovery commands are shipped. Phase 3 discovery shipped the same day and remains in parity closeout while later waves land.

The shipped lifecycle slice also includes `/blu-plan-phase`, `/blu-execute-phase`, `/blu-validate-phase`, `/blu-verify-work`, and the read-only next-step router `/blu-next`.

## Current Runtime Layout

The active implementation lives in the repo runtime surfaces below:

- `commands/blu-help.toml`
- `commands/blu-progress.toml`
- `commands/blu-health.toml`
- `commands/blu-map-codebase.toml`
- `commands/blu-debug.toml`
- `commands/blu-docs-update.toml`
- `commands/blu-review.toml`
- `commands/blu-code-review.toml`
- `commands/blu-code-review-fix.toml`
- `commands/blu-audit-fix.toml`
- `commands/blu-ui-review.toml`
- `commands/blu-ship.toml`
- `skills/blueprint-router.md`
- `skills/blueprint-maintenance/SKILL.md`

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
- `reports/`: command reports such as debug, ship, cleanup, milestone audit, and add-tests outputs
- `codebase/`: brownfield repo mapping documents
- `notes/`, `todos/`, `backlog/`: lightweight project capture

Blueprint is designed to keep those artifacts in version control by default so the workflow stays visible and resumable.

## How The Workflow Fits Together

### Foundation

Use these to initialize Blueprint, inspect status, and route safely:

- `/blu`: root router for safe command selection and next-step guidance
- `/blu-help`: show the currently shipped Blueprint commands
- `/blu-progress`: summarize current Blueprint state, blockers, and next action
- `/blu-next`: move to the next safe step using actual project state
- `/blu-new-project`: bootstrap a repo with project, requirements, roadmap, state, config, and phase scaffolding
- `/blu-map-codebase`: map an existing repo into `.blueprint/codebase/`
- `/blu-health`: diagnose and repair partial or unhealthy Blueprint state
- `/blu-settings`: inspect and update repo Blueprint settings
- `/blu-set-profile`: switch the active Blueprint model profile

### Core phase lifecycle

Use these to define, build, and verify a phase:

- `/blu-discuss-phase`: capture phase context and design intent
- `/blu-list-phase-assumptions`: inspect Blueprint's current assumptions before planning
- `/blu-research-phase`: create bounded phase research
- `/blu-ui-phase`: write a UI spec or an explicit UI-skip rationale
- `/blu-plan-phase`: create the executable phase plan
- `/blu-execute-phase`: implement the plan and persist execution summaries
- `/blu-validate-phase`: audit the completed execution and write verification evidence
- `/blu-verify-work`: run conversational UAT and record the result
- `/blu-pause-work`: write a resumable handoff when you need to stop mid-stream
- `/blu-resume-work`: restore that handoff and continue from live state

### Roadmap and milestone management

Use these when your roadmap needs to evolve:

- `/blu-add-phase`: append a new integer phase to the current milestone
- `/blu-insert-phase`: insert a decimal phase after an existing integer phase
- `/blu-remove-phase`: remove a future phase and renumber later roadmap references
- `/blu-audit-milestone`: compare milestone intent against completed evidence
- `/blu-plan-milestone-gaps`: turn milestone audit gaps into follow-up phases
- `/blu-complete-milestone`: close an audited milestone
- `/blu-milestone-summary`: generate a durable milestone summary
- `/blu-new-milestone`: start the next milestone from carry-forward context

### Capture and lightweight execution

Use these when you need lower-ceremony project management or small delivery work:

- `/blu-note`: save a project note
- `/blu-add-todo`: add a todo item
- `/blu-check-todos`: list, activate, or complete todos
- `/blu-add-backlog`: save a parking-lot idea, optionally with a `999.x` stub
- `/blu-review-backlog`: promote backlog items into the roadmap
- `/blu-explore`: think through an idea before choosing note, todo, backlog, or roadmap
- `/blu-fast`: do a truly trivial task inline
- `/blu-quick`: do a bounded repo task with less ceremony than a full phase
- `/blu-debug`: run a structured debugging pass and persist a debug report

### Quality, review, docs, and shipping

Use these after implementation when you want stronger evidence and release hygiene:

The review-branch command `/blu-pr-branch` is now shipped.

- `/blu-code-review`: review the files changed by a completed phase
- `/blu-code-review-fix`: apply bounded fixes from a saved review
- `/blu-audit-fix`: run a tighter audit-to-fix remediation loop
- `/blu-secure-phase`: audit a completed phase for security posture
- `/blu-ui-review`: review the UX and visual quality of a completed phase
- `/blu-review`: run cross-CLI peer review over saved plans
- `/blu-docs-update`: update repo documentation based on real project evidence
- `/blu-add-tests`: add or update focused tests for a completed phase
- `/blu-pr-branch`: prepare a clean review branch
- `/blu-ship`: prepare a confirmation-gated shipping run with PR guidance
- `/blu-undo`: preview and run a safe revert flow with an explicit report first
- `/blu-cleanup`: archive completed phase directories after confirmation

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
- High-risk actions such as roadmap mutation, branch preparation, shipping, undo, and cleanup are confirmation-gated.
- It keeps project state in `.blueprint/` instead of scattering workflow state across ad-hoc files.

## Commands Not Public Yet

These retained commands are still not public in the current runtime and should not be treated as available today:

- `/blu-do`
- `/blu-new-workspace`
- `/blu-remove-workspace`
- `/blu-workstreams`
- `/blu-update`
- `/blu-reapply-patches`

If you ask `/blu` or `/blu-help` for available commands, they will not advertise those until they are actually shipped.

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
