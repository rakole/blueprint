# Blueprint Hook Instructions

Hooks are extension glue. They should be small, deterministic, and safe.

## Rules

- Keep hook behavior fast and predictable.
- Preserve JSON input and output contracts exactly.
- Favor bootstrap context and lightweight checks over side effects.
- Fail clearly on stderr and exit non-zero when the hook contract cannot be honored.
- Do not add slow startup work, hidden network calls, or repo mutations to session hooks unless the extension truly needs them.

