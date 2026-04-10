# Blueprint

Blueprint is a Gemini-native planning and execution system for repository work.

## Command Namespace

- Use `/blu` as the root router when the user wants help, next-step guidance, or intent-based routing.
- Use direct commands in the `/blu:<command>` namespace when the user already knows the action they want.
- Current Wave 0 direct commands: `/blu:new-project`, `/blu:settings`, `/blu:set-profile`, `/blu:help`, `/blu:progress`, `/blu:health`, and `/blu:map-codebase`.

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
- `/blu:health` diagnoses Blueprint artifacts and enters repair flows only after explicit confirmation.
- `/blu:map-codebase` creates or reuses the seven-document `.blueprint/codebase/` bundle, including `STRUCTURE.md`.
- Shipped orchestration skills live in `skills/`.
- Shipped agent contracts for Wave 0 parity work live in `agents/`.

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
