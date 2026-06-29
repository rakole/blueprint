# Quickstart

This guide gets a repo to its first safe Blueprint action in about 15 minutes.

## 1. Install, Link, Restart

Install Blueprint for your AI host, link or enable it for the repo you want to manage, then restart the host session so slash commands and MCP tools reload.

After restart, open the repo in your host and run:

```text
/blu-help
```

If `/blu-help` is not available, see [Troubleshooting](troubleshooting.md).

## 2. Choose Your Starting Point

For a fresh project with no saved Blueprint roadmap yet, run:

```text
/blu-new-project
```

Use this when you want Blueprint to ask project-shaping questions, create the initial planning structure, and seed the first roadmap.

For an existing repo that Blueprint has not mapped yet, run:

```text
/blu-map-codebase
```

Use this when Blueprint needs to understand the stack, architecture, structure, conventions, testing, integrations, and concerns before planning new work.

If you are unsure which path applies, run:

```text
/blu-progress
```

or:

```text
/blu-next
```

Both are read-only routing commands. They inspect current Blueprint state and point to the next safe implemented command.

## 3. First 15 Minutes

1. Run `/blu-help` to confirm Blueprint is loaded.
2. Run `/blu-map-codebase` for a brownfield repo, or `/blu-new-project` for a fresh project.
3. Answer prompts concretely. Prefer goals, constraints, risks, and acceptance signals over broad intent.
4. Run `/blu-progress` after a long command finishes.
5. Run `/blu-next` when you want the next safe action without rereading the whole state.

## Intent Chooser

This section is filled from the generated command registry so it stays aligned with runnable commands.

<!-- command-registry:user-docs-intents:start -->
Use these runnable commands when the intent matches your current need:

| Intent | Runnable command |
| --- | --- |
| Start fresh | `/blu-new-project` |
| Understand an existing repo | `/blu-map-codebase` |
| Decide next safe action | `/blu-next` |
| Plan implementation | `/blu-plan-phase <phase>` |
| Execute safely | `/blu-execute-phase <phase>` |
| Prepare isolated plan run | `/blu-run-plan <phase> <planId>` |
| Review/fix code | `/blu-code-review <phase>`, `/blu-code-review-fix <phase>` |
| Ship | `/blu-ship` |

Generated from `generated/command-catalog.json`. Only commands whose live catalog status is `implemented` appear here as runnable routes.
<!-- command-registry:user-docs-intents:end -->

## Good First Prompts

Use plain language around the slash command:

```text
/blu-map-codebase
Focus on build, tests, runtime entrypoints, and deployment risks.
```

```text
/blu-new-project
Help me shape a small first milestone for this repo.
```

```text
/blu-next
Show the next safe action and why.
```

## What To Avoid Early

- Do not hand-edit `.blueprint/` to make Blueprint "catch up".
- Do not skip mapping for an existing repo unless you already have current codebase context.
- Do not execute a phase plan you have not read and trusted.
- Do not use `/blu-ship`, `/blu-undo`, `/blu-cleanup`, or workspace commands until you understand the confirmation gates.
