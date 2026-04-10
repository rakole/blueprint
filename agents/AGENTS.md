# Blueprint Agent Instructions

Files in this directory define narrow specialist agents for Blueprint.

## Rules

- Keep YAML frontmatter valid and complete.
- Prefer one specialist responsibility per file.
- Keep roles crisp: research, plan, execute, verify.
- Use `kind: local` unless there is a real reason to change it.
- Set `max_turns` conservatively.
- Agent prompts should focus on the specialist's job, not restate the entire repository guide.
- Do not add agents that have no realistic call site in the extension workflow.

