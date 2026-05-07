# Blueprint Host Constraints

## Purpose

This file keeps its historical name in the repo, but the shared constraints below apply to both Gemini CLI and Tabnine CLI unless a bullet explicitly calls out one host. It exists so future implementation sessions do not accidentally drift back toward legacy assumptions that only made sense in a different host environment.
Blueprint remains Gemini-first, but the shared contract must still describe honest fallback behavior for hosts that do not expose Gemini-only helpers.

## Locked Runtime Constraints

- Blueprint is installed as a Gemini CLI or Tabnine CLI extension from GitHub, not through a custom installer flow.
- Project-specific state belongs in `.blueprint/`; mutable global state belongs only in `~/.<host>/blueprint/`.
- User-level Blueprint defaults, when supported, live only in `~/.<host>/blueprint/defaults.json`.
- Stateful mutations should happen through an extension-bundled MCP server rather than prompt-only logic.
- Blueprint slash commands are host CLI entrypoints, not shell executables, and callable Blueprint MCP instructions should use runtime FQNs such as `mcp_blueprint_...` instead of bare internal tool ids.
- Hooks are advisory in v1. Blueprint should not depend on statusline injection, hidden settings mutation, or extension self-modification.
- Repo config should not control hook activation; hook configuration belongs to extension-owned `hooks/hooks.json`.
- `/blu-update` is advisory because extension installation and update flows happen outside the current interactive host session.
- `/blu-reapply-patches` must target the global patch registry instead of patching the installed extension copy directly.
- Review, shipping, and peer-CLI orchestration must degrade gracefully when optional external tools are missing.

## Consequences For Implementation

- Bundle runtime code into `dist/` before release so `gemini extensions install https://github.com/<repo>` and `tabnine extensions install https://github.com/<repo>` work without post-install setup.
- Keep commands thin and deterministic by routing filesystem changes through MCP tools with explicit return shapes.
- When Blueprint needs structured clarification or confirmation, prefer Gemini CLI's built-in `ask_user` dialog instead of imitating questionnaires in plain assistant prose.
- When docs or prompts name the shared effectiveness-spine vocabulary, use the same execution-profile and stage/status terms across hosts, and state the fallback path when `ask_user`, `write_todos`, `update_topic`, tracker tools, or resource tools are not available.
- Prefer direct command specs and shared contracts over hidden runtime conventions.
- Separate project-local artifacts from maintenance-only global registries to keep `.blueprint/` portable across repos.
- Treat config precedence, migration, and defaults loading as MCP-owned behavior rather than per-command prompt logic.
- Treat install, update, restart, and patch replay as operational workflows, not normal in-session slash-command mutations.

## Agent Visibility Notes

- Gemini extension agents load from `agents/*.md` inside the installed extension bundle; a copied file alone is not enough if the host has not reloaded the extension yet.
- After installing or updating Blueprint, restart Gemini before treating a missing `blueprint-*` subagent as a packaging defect.
- Use `/agents list` to verify whether Gemini actually registered the Blueprint agents in the current session.
- Restrictive `tools.core` or `tools.exclude` settings can hide Blueprint subagents even when the extension loaded successfully, because Gemini policy and allowlist handling uses the agent names themselves as tool names.
- Trusted-workspace checks still matter for the overall operator experience; confirm the workspace is trusted before diagnosing missing-agent behavior.

## What Future Sessions Should Avoid

- Reintroducing `.planning/`, legacy slash-command surfaces, or installer-managed runtime state.
- Adding omitted legacy commands as hidden aliases without revisiting the retained-command contract.
- Letting high-risk commands skip confirmation gates because another command already checked something earlier.
- Writing extension-owned runtime state into the installed extension directory.
