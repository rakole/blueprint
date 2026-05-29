# Blueprint Agent Guide

This folder is the working manual for coding agents changing Blueprint. It is
self-contained on purpose: read these files plus live source code, and do not
depend on the legacy documentation tree for implementation context.

Blueprint is a Gemini and Tabnine CLI extension. It exposes the root `/blu`
router plus direct `/blu-<command>` commands, stores workflow state in
`.blueprint/`, and uses an MCP server as the deterministic state engine.

## Always Read First

- `00-operating-rules.md`: required worktree, install, subagent, and git rules.
- `01-product-runtime-model.md`: what Blueprint is and which layer owns what.
- `02-repo-map.md`: where source, runtime assets, build outputs, tests, and
  host manifests live.

## Read By Task

- Command routing or slash command changes: read `03-command-system.md`,
  `04-skills-and-agents.md`, `05-mcp-runtime-and-persistence.md`, and the
  matching file under `commands`.
- MCP tool, artifact, state, report, or path changes: read
  `05-mcp-runtime-and-persistence.md` and
  `06-state-artifacts-and-path-safety.md`.
- Skill or subagent changes: read `04-skills-and-agents.md` and the relevant
  command-family guide.
- Hook, extension host, install, or build changes: read
  `07-hosts-packaging-and-build.md`.
- Any code or source-controlled file change: read `08-change-recipes.md`,
  `09-verification-guide.md`, and `10-risk-checklists.md`.

## Core Rules

Do:

- Use the Codex harness and normal repository tools for Blueprint development.
- Create a fresh git worktree before any source-controlled edit.
- Run `npm ci` in that fresh worktree before build, typecheck, or tests.
- Keep command recommendations inside the live `implemented` catalog surface.
- Let MCP tools own structured `.blueprint/` and host-global state writes.

Do not:

- Use GSD workflows or Blueprint slash workflows to develop Blueprint itself.
- Run `/blu-*` as shell commands.
- Hand-edit runtime `.blueprint/` state as a shortcut for command behavior.
- Treat hooks as persistence or enforcement.
- Mutate installed extension directories.

## Fast Mental Model

Commands are thin user-facing TOML contracts. Skills orchestrate the command
behavior. Agents do bounded specialist work. MCP tools read and write
structured state. Hooks advise. Extension manifests launch built files from
`dist`.

When in doubt, preserve the layer boundary rather than inventing a shortcut.
