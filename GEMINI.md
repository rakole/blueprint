# Blueprint

Blueprint is a Gemini CLI extension scaffold inspired by structured delivery workflows like Get Shit Done, but designed specifically for Gemini CLI extension packaging.

## Current status

- This repository is scaffolding only.
- Slash commands, skills, subagents, a session-start hook, and a plan directory are present.
- No MCP server, policy rules, or automated orchestration logic are implemented yet.

## Working conventions

- Keep planning artifacts in `.blueprint/plans/`.
- Prefer namespaced slash commands such as `/blueprint:help` and `/blueprint:plan`.
- Treat the skills and agents in this repo as lightweight starting points that we will harden later.
- Expand functionality incrementally rather than adding placeholder behavior that looks production-ready.

## Design goal

Blueprint should eventually provide a clear path from intake to planning, execution, review, and verification inside Gemini CLI while staying easy to install and maintain as an extension.
