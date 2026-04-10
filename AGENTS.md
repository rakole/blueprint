# Blueprint Codex Guide

## Mission

Blueprint is a Gemini CLI extension scaffold for building a get-shit-done style harness inside Gemini CLI.

Treat this repository as extension infrastructure. We are not building the product that Gemini will help operate; we are building the extension surfaces, workflow prompts, and supporting glue that make that structured workflow possible.

## Current Reality

- This repo is still scaffold-first.
- Commands, skills, agents, a starter hook, and the plan directory exist.
- MCP integration, active policy rules, and richer orchestration are not implemented yet.
- Prefer honest scaffolding over placeholder behavior that looks production-ready.

## Source Of Truth

1. `gemini-extension.json` defines the extension package Gemini CLI loads.
2. `GEMINI.md` is the Gemini-facing context file for this project.
3. `README.md` describes the scaffold, install flow, and supported surfaces.
4. `.blueprint/plans/` is the home for plan artifacts when planning features are used.

## Working Model

- Read the closest `AGENTS.md` before changing a directory.
- Keep changes incremental and verifiable.
- Preserve the Blueprint workflow vocabulary: intake, plan, execute, review, status.
- Match real Gemini CLI extension behavior and docs instead of inventing repo-local magic.
- If a feature is not wired up yet, say so plainly in prompts, docs, and code.
- When adding a new first-class extension surface, update both docs and validation.

## What Good Changes Look Like

- They make the scaffold more real without pretending unfinished systems already exist.
- They keep commands, skills, agents, hooks, and docs aligned with each other.
- They prefer small execution slices over speculative architecture.
- They leave behind enough verification that the next contributor can trust the new surface.

## Verification

- Run `npm run check` after repository changes.
- If you change a hook or script, run the narrow script entry point too when practical.

