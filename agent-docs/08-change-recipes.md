# Change Recipes

Use these recipes to keep related surfaces aligned.

## Add Or Repair A Command

1. Identify the command family and primary skill.
2. Update or create `commands/blu-<command>.toml`.
3. Update the primary skill's `commands` list and `input_bundles`.
4. Add or update a command-specific runtime reference when behavior is too rich
   for the manifest.
5. Update runtime-owned command metadata when that command is source-owned.
6. Ensure every required MCP tool is registered.
7. Ensure optional agents are known Blueprint agents.
8. Add or update metadata, catalog, runtime-resource, and behavior tests.
9. Verify routers and follow-up text name only implemented commands.

Stop if the change requires altering command-status semantics. That is a
separate architecture decision.

## Add An MCP Tool

1. Choose the owning tool family under `src/mcp/tools`.
2. Define typed args and result shapes.
3. Add a Zod input schema near the handler.
4. Implement helper functions before dense orchestration logic.
5. Return structured status, warnings, paths, diagnostics, and idempotency
   signals.
6. Export the tool through the family's `*ToolDefinitions` array.
7. Register mutation logging if the tool writes state.
8. Add focused tests for success, invalid input, path safety, and failure
   status.

## Change An Artifact Contract

1. Update the contract definition and model contract, if any.
2. Update scaffold and authoring templates.
3. Update path resolution or owner mapping if the canonical path changed.
4. Update write and validation tools that consume the contract.
5. Add or update artifact contract tests and any affected command tests.

## Change A Skill

1. Identify the active command bundle.
2. Keep shared skill rules separate from command-specific runtime details.
3. Update `input_bundles` for the command.
4. Update optional agent rules only when the command contract allows them.
5. Add metadata or bundle tests when input resolution changes.

## Add Or Change An Agent

1. Update `agents/<name>.md`.
2. Keep frontmatter tool permissions bounded.
3. Update `src/mcp/agent-metadata.ts` if the agent is part of the runtime
   allowlist.
4. Keep parent-owned MCP persistence explicit.
5. Add agent schema or allowlist tests.

## Change Hooks

1. Edit `src/hooks`.
2. Keep hooks advisory.
3. Update `hooks/hooks.json` only when registration changes.
4. Run build before checking built hook output.
5. Add hook tests.

## Change Host Packaging

1. Update both host manifests when behavior should match.
2. Update runtime host resolution only through `src/mcp/runtime-host.ts`.
3. Build before smoke or install checks.
4. Run the clean-home smoke test for host startup and global-state changes.
5. Run the integration install test when bundle/install behavior changes and
   Docker is available.
