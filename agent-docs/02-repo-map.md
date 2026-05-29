# Repo Map

Use this map to find the source of truth before changing behavior.

## Runtime Assets

- `commands/*.toml`: host command prompts for `/blu` and direct `/blu-*`
  commands.
- `skills/*/SKILL.md`: orchestration contracts and command input bundles.
- `skills/*/references/*.md`: command-specific runtime contracts used by
  skills.
- `agents/*.md`: bounded local agent contracts and tool allowlists.
- `hooks/hooks.json`: host hook registration.

## MCP Server Source

- `src/mcp/server.ts`: thin entrypoint and public re-exports.
- `src/mcp/server-runtime.ts`: MCP server assembly, resource registration, tool
  registration, response shaping.
- `src/mcp/tool-definitions.ts`: assembled tool registry and registration
  guardrails.
- `src/mcp/tools/*.ts`: domain tool families for project, config, state,
  phase, review, workspace, update, impact, and artifacts.
- `src/mcp/command-runtime-metadata.ts`: source-owned command metadata for many
  shipped commands.
- `src/mcp/command-resources.ts`: read-only command catalog and runtime-contract
  MCP resources.
- `src/mcp/artifact-contracts/index.ts`: canonical artifact contract
  definitions, templates, and model contracts.
- `src/mcp/mutation-failure-logging.ts` and `src/mcp/write-failure-log.ts`:
  rejected mutation telemetry.
- `src/mcp/runtime-host.ts`: Gemini and Tabnine host-global path resolution.

## Shared Source

- `src/shared/security.ts`: path containment, safe JSON parsing, phase and
  artifact identifier normalization, prompt-boundary checks.
- `src/hooks/*.ts`: advisory hook implementation.
- `scripts/*.mjs`: build, smoke, and helper scripts.

## Tests

- `tests/*-metadata.test.ts`: command metadata and runtime-contract alignment.
- `tests/command-catalog.test.ts`: implemented-only catalog behavior.
- `tests/*runtime-contract-resource.test.ts`: resource projections.
- `tests/*tools.test.ts` and `tests/*slice.test.ts`: focused tool and workflow
  behavior.
- `tests/built-assets-smoke.test.ts`: build output expectations.
- `tests/extension-install.integration.ts`: containerized extension install
  behavior.

## Generated Or Built Outputs

- `dist/`: built extension runtime and hook entrypoints.
- `node_modules/`: local install output from `npm ci`.

Do not edit generated or installed output as the source of truth. Change source,
then build when verification needs built artifacts.
