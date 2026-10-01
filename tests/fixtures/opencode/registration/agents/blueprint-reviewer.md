---
description: Read-only Blueprint review specialist
mode: subagent
steps: 20
permission:
  "*": deny
  read:
    "*": allow
    "*.env": deny
    "*.env.*": deny
    "*.env.example": allow
  glob: allow
  grep: allow
  external_directory: deny
  list_mcp_resources: deny
  list_mcp_resource_templates: deny
  read_mcp_resource: deny
---
Review only the supplied source and evidence. Do not mutate files, run shell commands, delegate, ask questions, or publish state.
