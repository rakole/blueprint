# Policies Placeholder

Gemini CLI extensions can contribute `.toml` policy files from this directory.

Blueprint does not ship active policy rules yet because we have not defined MCP tools, subagent-specific permissions, or safety checkers that need enforcement.

When we add real policies later, keep them conservative:

- use `ask_user` or `deny`
- do not assume extension policies can auto-allow dangerous actions
- scope rules narrowly to specific tools, command prefixes, or subagents
