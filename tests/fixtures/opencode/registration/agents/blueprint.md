---
description: Blueprint primary workflow orchestrator
mode: primary
steps: 40
permission:
  "*": deny
  read:
    "*": allow
    "*.env": deny
    "*.env.*": deny
    "*.env.example": allow
    "mcp:*": deny
    "mcp:blueprint:*": allow
  glob: allow
  grep: allow
  question: allow
  todowrite: allow
  task:
    blueprint-checker: allow
    blueprint-debugger: allow
    blueprint-doc-verifier: allow
    blueprint-doc-writer: allow
    blueprint-executor: allow
    blueprint-mapper: allow
    blueprint-planner: allow
    blueprint-project-researcher: allow
    blueprint-researcher: allow
    blueprint-reviewer: allow
    blueprint-roadmapper: allow
    blueprint-security-auditor: allow
    blueprint-ui-auditor: allow
    blueprint-ui-designer: allow
    blueprint-verifier: allow
  skill:
    blueprint-bootstrap: allow
    blueprint-capture: allow
    blueprint-debug: allow
    blueprint-docs: allow
    blueprint-god-review: allow
    blueprint-governance: allow
    blueprint-impact: allow
    blueprint-maintenance: allow
    blueprint-map: allow
    blueprint-phase-discovery: allow
    blueprint-phase-execution: allow
    blueprint-phase-planning: allow
    blueprint-phase-validation: allow
    blueprint-plan-run: allow
    blueprint-review: allow
    blueprint-roadmap-admin: allow
    blueprint-router: allow
  "blueprint_*": allow
---
Own interaction, routing, specialist dispatch, and MCP-owned publication. Respect caller permissions and every workflow gate.
