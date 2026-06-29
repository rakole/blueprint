# Lifecycle

Blueprint work usually moves from understanding the repo to planning, execution, validation, review, and shipping. The exact path depends on project state, command configuration, and the kind of work.

## Start With State

Use read-only routing before making changes:

```text
/blu-progress
```

```text
/blu-next
```

These commands inspect Blueprint state and recommend the next safe implemented command.

## 1. Map Or Bootstrap

For an existing repo, map it first:

```text
/blu-map-codebase
```

For a fresh project, bootstrap it:

```text
/blu-new-project
```

Mapping builds codebase context. Bootstrapping creates the initial project shape and roadmap.

## 2. Clarify The Phase

Use spec and discussion when the phase is still ambiguous:

```text
/blu-spec-phase <phase>
```

```text
/blu-discuss-phase <phase>
```

`/blu-spec-phase` is optional and need-driven. Use it when the WHAT, WHY, boundaries, or acceptance criteria are unclear. `/blu-discuss-phase` gathers durable context for the phase before planning.

## 3. Research When Needed

Run research when implementation choices depend on current technical facts, unfamiliar code, external APIs, migrations, or risky assumptions:

```text
/blu-research-phase <phase>
```

Research is not mandatory for every phase. Use it when the plan would otherwise depend on guesses.

## 4. Add UI Guidance When Needed

For UI work, create or skip a phase UI contract explicitly:

```text
/blu-ui-phase <phase>
```

This depends on the work and project configuration. Non-UI work may not need it.

## 5. Plan

Create or revise execution-ready plans:

```text
/blu-plan-phase <phase>
```

Existing saved plans need an explicit add, revise, or replace decision. Replacement or overwrite requires confirmation.

## 6. Execute

Execute only a plan you understand and trust:

```text
/blu-execute-phase <phase>
```

Execution can mutate the repo. Stop before running it if the plan feels stale, too broad, or wrong.

## 7. Validate And Verify

Validate saved execution evidence:

```text
/blu-validate-phase <phase>
```

Run UAT-style verification when user acceptance or workflow behavior needs confirmation:

```text
/blu-verify-work <phase>
```

## 8. Review

Use review commands according to risk and project configuration:

```text
/blu-code-review <phase>
```

```text
/blu-secure-phase <phase>
```

```text
/blu-review <phase>
```

Code review, security review, UI review, and peer review are need- and config-dependent. Do not treat every review command as mandatory for every phase.

## 9. Ship

Ship only after the needed evidence is present and you are ready for git or remote mutation:

```text
/blu-ship
```

`/blu-ship` is high risk. Expect confirmation gates.

## Lifecycle Command Links

This section is filled from the generated command registry so lifecycle links stay aligned with runnable commands.

<!-- command-registry:user-docs-lifecycle:start -->
The runnable command families below come from the live command registry:

- Foundation: `/blu-health`, `/blu-help`, `/blu-map-codebase`, `/blu-new-project`, `/blu-progress`, `/blu-set-profile`, `/blu-settings`
- Core Lifecycle: `/blu-discuss-phase <phase>`, `/blu-execute-phase <phase>`, `/blu-next`, `/blu-pause-work`, `/blu-plan-phase <phase>`, `/blu-research-phase <phase>`, `/blu-resume-work`, `/blu-spec-phase <phase>`, `/blu-ui-phase <phase>`, `/blu-validate-phase <phase>`, `/blu-verify-work <phase>`
- Roadmap And Milestone: `/blu-add-phase`, `/blu-audit-milestone`, `/blu-complete-milestone`, `/blu-insert-phase`, `/blu-list-phase-assumptions <phase>`, `/blu-milestone-summary`, `/blu-new-milestone`, `/blu-plan-milestone-gaps`, `/blu-remove-phase`
- Capture And Lightweight Execution: `/blu-add-backlog`, `/blu-add-todo`, `/blu-check-todos`, `/blu-debug`, `/blu-explore`, `/blu-fast`, `/blu-note`, `/blu-quick`, `/blu-review-backlog`
- Quality And Shipping: `/blu-add-tests <phase>`, `/blu-audit-fix <phase>`, `/blu-code-review <phase>`, `/blu-code-review-fix <phase>`, `/blu-docs-update`, `/blu-impact`, `/blu-pr-branch`, `/blu-review <phase>`, `/blu-secure-phase <phase>`, `/blu-ship`, `/blu-ui-review <phase>`, `/blu-undo`
- Plan Run Harness: `/blu-run-plan <phase> <planId>`
- Workspace And Maintenance: `/blu-cleanup`, `/blu-new-workspace`, `/blu-reapply-patches`, `/blu-remove-workspace`, `/blu-update`, `/blu-workstreams`

Generated from `generated/command-catalog.json`. Retained non-runnable commands are intentionally excluded from this lifecycle map.
<!-- command-registry:user-docs-lifecycle:end -->
