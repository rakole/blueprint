# Blueprint

Blueprint is a Gemini-native planning and execution system for repository work.

## Checkpoint Status

- Phase 2.1 drift recovery and Phase 2.2 future-contract drift repair both closed on 2026-04-11.
- Phase 3 discovery shipped on 2026-04-11.
- Phase 4 validation is now live through `/blu:validate-phase` and `/blu:verify-work`, and the current repair focus is making the shipped discovery, execution, validation, and UAT commands fully substantive while later commands remain blocked until their substrate exists.
- Runtime routing must still surface only commands whose catalog entry is `implemented`.

## Command Namespace

- Use `/blu` as the root router when the user wants help, next-step guidance, or intent-based routing.
- Use direct commands in the `/blu:<command>` namespace when the user already knows the action they want.
- Current shipped direct commands: `/blu:new-project`, `/blu:settings`, `/blu:set-profile`, `/blu:help`, `/blu:progress`, `/blu:health`, `/blu:map-codebase`, `/blu:discuss-phase`, `/blu:research-phase`, `/blu:ui-phase`, `/blu:plan-phase`, `/blu:execute-phase`, `/blu:validate-phase`, `/blu:verify-work`, and `/blu:next`.

## State Boundaries

- Project-local Blueprint state lives in `.blueprint/`.
- Global operational Blueprint state lives in `~/.gemini/blueprint/`.
- `.planning/` is not Blueprint runtime state and must not be used for shipped command persistence. It may still exist in this repo as implementation bookkeeping for the GSD build-out.

## Current Runtime Surface

- `/blu:new-project` bootstraps deterministic `.blueprint/` artifacts and normalized repo config.
- `/blu:settings` reads or updates normalized Blueprint config through MCP tools.
- `/blu:set-profile` changes only the project-local `model_profile`.
- `/blu:help` returns read-only routing guidance from an implementation-aware command catalog and repo readiness.
- `/blu:progress` summarizes repo status, blockers, warnings, and the next safe action from real `.blueprint/` state while filtering to implemented commands.
- `/blu:next` turns the current derived next action into a safe direct-command recommendation without introducing hidden writes.
- `/blu:health` diagnoses Blueprint artifacts and enters repair flows only after explicit confirmation.
- `/blu:map-codebase` creates or reuses the seven-document `.blueprint/codebase/` bundle, including `STRUCTURE.md`.
- `/blu:discuss-phase` now captures substantive `XX-CONTEXT.md` content and can persist resumable discussion checkpoints.
- `/blu:research-phase` now persists substantive `XX-RESEARCH.md` content instead of relying on scaffold placeholders.
- `/blu:ui-phase` now persists substantive `XX-UI-SPEC.md` content or an explicit skip rationale in that same file.
- `/blu:plan-phase` now persists substantive `XX-YY-PLAN.md` content through the plan MCP substrate.
- `/blu:execute-phase` now persists `XX-YY-SUMMARY.md` execution evidence through the summary MCP substrates and keeps the next action explicit.
- `/blu:validate-phase` now persists `XX-VERIFICATION.md` validation evidence through the phase artifact MCP substrate.
- `/blu:verify-work` now persists resumable `XX-UAT.md` conversational UAT evidence through the phase artifact MCP substrate and keeps follow-up fixes explicit.
- Shipped orchestration skills live in `skills/`, including `blueprint-phase-discovery`.
- Shipped orchestration skills live in `skills/`, including `blueprint-phase-validation`.
- Shipped agent contracts live in `agents/`, including `blueprint-researcher` and `blueprint-ui-designer`.

## Mutation Rules

- Commands own UX and routing.
- MCP tools own persistent reads and writes.
- Do not create or mutate Blueprint artifacts through prompt-only prose when an MCP tool is responsible for the change.

## Router Guidance

- Prefer safe inline routing when user intent is clear.
- Recommend the best direct `/blu:<command>` entrypoint when intent is ambiguous or the next action is risky.
- Only recommend commands whose `blueprint_command_catalog` entry is `implemented`.
- When a command is blocked, explain the missing substrate instead of presenting it as runnable.
- Do not rely on slash-command chaining or undocumented aliases.
