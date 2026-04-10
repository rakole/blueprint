# Blueprint Command Instructions

Custom commands in this repo should stay focused, honest, and easy to compose.

## Rules

- Keep commands namespaced under `commands/blueprint/`.
- Each TOML file should represent one clear user intent.
- `description` should describe the user-facing action, not internal implementation details.
- `prompt` should be explicit about output shape and realistic about scaffold limitations.
- Use `@{...}` imports for source-of-truth context instead of duplicating long instructions.
- Prefer commands that turn vague requests into structured Blueprint workflow outputs.
- If a command depends on an unbuilt surface, acknowledge that directly instead of faking it.

