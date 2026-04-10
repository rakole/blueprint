# Blueprint

Blueprint is a Gemini-native planning and execution system for repository work.

## Command Namespace

- Use `/blu` as the root router when the user wants help, next-step guidance, or intent-based routing.
- Use direct commands in the `/blu:<command>` namespace when the user already knows the action they want.
- The first mutating command in scope is `/blu:new-project`.

## State Boundaries

- Project-local Blueprint state lives in `.blueprint/`.
- Global operational Blueprint state lives in `~/.gemini/blueprint/`.
- `.planning/` is not Blueprint runtime state and must not be used for shipped command persistence.

## Mutation Rules

- Commands own UX and routing.
- MCP tools own persistent reads and writes.
- Do not create or mutate Blueprint artifacts through prompt-only prose when an MCP tool is responsible for the change.

## Router Guidance

- Prefer safe inline routing when user intent is clear.
- Recommend the best direct `/blu:<command>` entrypoint when intent is ambiguous or the next action is risky.
- Do not rely on slash-command chaining or undocumented aliases.
