# Lifecycle Commands

Lifecycle commands define, plan, execute, validate, verify, pause, and resume
phase work.

Commands:

- `/blu-discuss-phase`
- `/blu-list-phase-assumptions`
- `/blu-research-phase`
- `/blu-spec-phase`
- `/blu-ui-phase`
- `/blu-plan-phase`
- `/blu-execute-phase`
- `/blu-validate-phase`
- `/blu-verify-work`
- `/blu-pause-work`
- `/blu-resume-work`

## Source Surfaces

- Phase discovery, planning, execution, validation, and governance skills.
- Phase, state, artifact, review, and config MCP tools.
- Artifact contracts for context, spec, research, UI spec, plan, summary,
  verification, and UAT.
- Blueprint planner, checker, researcher, UI designer, executor, verifier, and
  related agents.

## Invariants

Do:

- Resolve phases through MCP before writing phase artifacts.
- Treat context, plan, summary, validation, and UAT artifacts as contract-owned.
- Keep parent commands responsible for MCP persistence and state updates.
- Use saved evidence and config gates before drafting or executing.
- Preserve final validation and next safe implemented routing.

Do not:

- Synthesize missing required context when the runtime says to route to an
  earlier command.
- Draft Markdown fallback for model-only JSON contracts.
- Let optional agents persist state or widen allowed tools.

## Verification

Use focused tests such as:

- `tests/phase-discovery-discuss.test.ts`
- `tests/phase-discovery-research.test.ts`
- `tests/spec-phase-artifact.test.ts`
- `tests/phase-planning-tools.test.ts`
- `tests/phase-planning-contract.test.ts`
- `tests/execute-phase-summary-tools.test.ts`
- `tests/phase-validation-slice.test.ts`
- `tests/validate-phase-tools.test.ts`
- `tests/verify-work-roadmap-sync.test.ts`
- `tests/pause-work.test.ts`
- `tests/resume-work.test.ts`
