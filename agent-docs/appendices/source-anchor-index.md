# Source Anchor Index

Use this index to refresh the agent guide from live source. It is a maintenance
aid, not required reading for every task.

## Operating Rules

- `AGENTS.md`: repo-specific hard rules for worktrees, subagents, install,
  high-risk commands, and GitHub write posture.
- `package.json`: Node version, npm scripts, dependencies, and lack of lint
  script.

## Product And Packaging

- `README.md`: shipped user-facing surface and `.blueprint/` layout.
- `gemini-extension.json`: Gemini host manifest.
- `tabnine-extension.json`: Tabnine host manifest.
- `hooks/hooks.json`: hook registration.
- `scripts/build.mjs`: build pipeline.

## Runtime And MCP

- `src/mcp/server.ts`: entrypoint.
- `src/mcp/server-runtime.ts`: server assembly and response handling.
- `src/mcp/tool-definitions.ts`: registry assembly and required tool guards.
- `src/mcp/tool-types.ts`: tool definition shape.
- `src/mcp/public-response.ts`: public text response generation.
- `src/mcp/response-sanitizer.ts`: public MCP payload trimming rules.
- `src/mcp/runtime-vocabulary.ts`: skill, agent, and MCP FQN helpers.
- `src/mcp/tools/project.ts`: command catalog, project init, project status.
- `src/mcp/command-runtime-metadata.ts`: source-owned command metadata.
- `src/mcp/command-resources.ts`: command catalog and runtime-contract
  resources.
- `src/mcp/agent-metadata.ts`: Blueprint agent allowlist and write-capable
  agent set.
- `src/mcp/skill-metadata.ts`: skill input-bundle resolution.
- `src/mcp/mutation-failure-logging.ts`: mutation tool logging wrapper.
- `src/mcp/write-failure-log.ts`: write failure log serialization.
- `src/mcp/runtime-host.ts`: Gemini and Tabnine host-global paths.
- `src/shared/security.ts`: path, JSON, prompt-boundary, and identifier safety.

## Artifacts And State

- `src/mcp/artifact-contracts/index.ts`: artifact contract definitions and
  templates.
- `src/mcp/tools/artifacts.ts`: project-local artifact path and write helpers.
- `src/mcp/tools/phase.ts`: phase artifact, plan, summary, validation, and
  checkpoint tools.
- `src/mcp/tools/state.ts`: state load, sync, and update behavior.

## Tests

- `tests/command-catalog.test.ts`: implemented-only catalog behavior.
- `tests/extension-runtime-contracts.test.ts`: command runtime-contract
  alignment.
- `tests/skill-metadata.test.ts`: skill bundle behavior.
- `tests/agent-schema.test.ts`: agent frontmatter and schema checks.
- `tests/optional-agent-validity.test.ts`: optional agent validity.
- `tests/mcp-write-failure-logging.test.ts`: rejected mutation telemetry.
- `tests/security-hardening.test.ts`: path containment, repo root, prompt
  boundary, and persistence safety.
- `tests/maintenance-regression.test.ts`: high-risk maintenance gates and
  abort behavior.
- `tests/built-assets-smoke.test.ts`: built output checks.
- `tests/extension-install.integration.ts`: containerized extension install.
