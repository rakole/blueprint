# Repo Map

Use this map to find the source of truth before changing behavior.

## Runtime Assets

- `commands/*.md`: native command prompts for `/blu` and direct `/blu-*`
  commands.
- `skills/*/SKILL.md`: orchestration contracts and command input bundles.
- `skills/*/references/*.md`: command-specific runtime contracts used by
  skills.
- `agents/blueprint.md`: required primary; 15 other definitions are optional specialists.
- `src/opencode/*.ts`: package loading, validation, projection, and dispatch gate.
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
- `src/mcp/runtime-host.ts`: explicit OpenCode data-root/global-home resolution.

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
- `tests/opencode-package.test.ts`: private package and native closure behavior.
- `tests/opencode-registration.integration.ts`: opt-in actual-host qualification.

## Generated Or Built Outputs

- `generated/opencode-assets.json`: native hashes, mappings, aliases, and closure.
- `dist/`: built OpenCode plugin and MCP runtime.
- `node_modules/`: local install output from `npm ci`.

Do not edit generated or installed output as the source of truth. Change source,
then build when verification needs built artifacts.
