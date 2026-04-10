# Blueprint Policy Instructions

Policies should stay narrow, conservative, and tied to real extension capabilities.

## Rules

- Prefer `ask_user` or `deny` over broad allow rules.
- Scope rules to specific tools, commands, or agents.
- Do not rely on policies to auto-approve risky actions silently.
- Only add policy files when the related MCP tools, hooks, or agent behaviors actually exist.
- Document the safety reason for each policy change in nearby docs or commit context.

