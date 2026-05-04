# LLM Workflow And Prompt Engineering Research

Subagent A report for `rakole/blueprint`.

## Executive Summary

Blueprint has an unusually strong foundation for agentic workflow control: command routing is catalog-gated, persistence is mostly MCP-owned, skills use command-scoped input bundles, agents have conservative tool metadata, and high-risk flows consistently name confirmation gates. This is directionally aligned with current public guidance from Gemini CLI extensions, Claude Skills/subagents, Codex-style repo instructions, MCP primitives, and prompt/eval best practices.

The main risk is not lack of rules; it is too many prompt-layer rules duplicated across commands, skills, runtime references, and tests without an executable prompt-behavior eval harness. The system is statically well-defended against missing manifests/tools, but less defended against LLM behavior drift: wrong tool choice, skipped confirmation, incomplete subagent handoff, over-reading sibling contracts, or final responses that claim a stage was completed when only prose instructions were followed.

Top areas to improve are: slim command prompts into stable contracts, add prompt/tool-call eval scenarios, make confirmation gates more typed and server-visible where possible, define machine-checkable subagent handoff packets, and repair durable context drift such as the shipped `impact` command missing from `AGENTS.md` current-phase lists.

## External Research Sources

| Source | URL | Relevant takeaway |
|---|---|---|
| Gemini CLI Extensions docs | https://google-gemini.github.io/gemini-cli/docs/extensions/ | Extensions package prompts, MCP servers, and custom commands; installed extension copies require update/restart behavior. |
| Gemini CLI extension getting started | https://google-gemini.github.io/gemini-cli/docs/extensions/getting-started-extensions.html | Extension manifests wire MCP servers; custom commands are prompt files; `GEMINI.md` provides persistent model context. |
| Google Gemini prompt strategies | https://ai.google.dev/gemini-api/docs/prompting-strategies | Be precise, use consistent structure/delimiters, define ambiguous terms, prioritize critical constraints, and manage long context deliberately. |
| Anthropic Agent Skills overview | https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview | Skills should be reusable, on-demand filesystem modules; progressive disclosure avoids loading all details upfront; `SKILL.md` should include clear instructions and examples. |
| Claude Code subagents docs | https://code.claude.com/docs/en/sub-agents | Subagents have their own frontmatter, tool lists, prompts, turn limits, and do not inherit skills unless explicitly configured; delegation boundaries matter. |
| MCP architecture docs | https://modelcontextprotocol.io/docs/learn/architecture | MCP separates tools, resources, prompts, sampling, elicitation, and logging; primitives are discoverable and schema-driven. |
| MCP elicitation spec | https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation | Structured user input and confirmation can be modeled as client-mediated JSON-schema requests with accept/decline/cancel actions. |
| OpenAI eval best practices | https://developers.openai.com/api/docs/guides/evaluation-best-practices | Agent systems need evals for instruction following, tool selection, argument precision, and handoff accuracy because nondeterminism is expected. |
| OpenAI prompting guide | https://developers.openai.com/api/docs/guides/prompting | Prompt objects benefit from versioning, templating, reuse, and eval comparison across versions. |
| Codex CLI docs | https://developers.openai.com/codex/cli | Coding agents read/edit/run in the local repo and rely on explicit approval modes. |
| Codex launch / AGENTS.md guidance | https://openai.com/index/introducing-codex/ | Repo instruction files, configured test commands, logs, and test evidence improve coding-agent reliability and reviewability. |
| Codex agent loop | https://openai.com/index/unrolling-the-codex-agent-loop/ | The harness composes system/developer/user instructions, tools, project docs, skills, and environment context; tool ordering/context management affects reliability and caching. |

## Evidence Table

| Finding | Local evidence | External comparison | Confidence |
|---|---|---|---|
| Strong implemented-only routing and command-scoped loading already exist. | `docs/SKILLS-AND-AGENTS.md:3-5` says multi-command skills should load only the effective bundle. `skills/blueprint-router/SKILL.md:67-81` routes only `implemented: true`. `tests/skill-metadata.test.ts:139-158` verifies router commands load only their manifest. | Matches progressive disclosure from Claude Skills and deterministic extension composition from Gemini CLI. | High |
| Command prompts are too large and duplicate skill/runtime-contract logic. | `commands/blu-plan-phase.toml:5-6` says to load the planning skill/runtime contract, but `commands/blu-plan-phase.toml:21-42` repeats a detailed call sequence and tool allowlist. `skills/blueprint-phase-planning/SKILL.md:24-31` and `:83-93` repeat the same gates and model-write contract. Word-count sampling found 20 command manifests above 700 words, with `blu-add-tests` at 1590 and `blu-code-review-fix` at 1397. | Claude Skills recommend on-demand progressive disclosure; Google recommends precision and avoiding unnecessary complexity. | High |
| Static metadata tests are strong, but no prompt-behavior eval harness was found. | `package.json:10-16` has build/typecheck/test/integration scripts only. `find . -maxdepth 3 -iname '*eval*' -o -iname '*prompt*'` found only `docs/build/WAVE-2-AUTO-AGENT-META-PROMPT.md` plus dependency files. `tests/extension-runtime-contracts.test.ts:272-330` checks manifest FQNs, tool registration, and raw-name drift, but not model transcripts or expected tool-call sequences. | OpenAI eval guidance calls out tool selection, data precision, instruction following, and agent handoff evals for agent systems. | High |
| Confirmation gates remain mostly prompt-mediated rather than a typed, cross-host runtime primitive. | `commands/blu-cleanup.toml:16-18` relies on Gemini `ask_user` or stopping if unavailable; `skills/blueprint-maintenance/SKILL.md:278-279` repeats the same. `src/mcp/tools/config.ts:34-38` has `ux.structured_confirmations`, but repo-wide search found no general MCP elicitation layer; only `src/mcp/tools/update.ts` has host-specific `ask_user`/manual mode text. | MCP now has elicitation for structured user input with accept/decline/cancel. Blueprint's prompt gates are good, but not yet a first-class runtime contract across hosts. | Medium-High |
| Subagents have good internal boundaries, but parent-to-agent handoff packets are not machine-checkable. | `agents/blueprint-executor.md:73-75` requires explicit write ownership and blocks if the parent prompt omits it. `commands/blu-execute-phase.toml:18` says use executor subagents only for disjoint write ownership, and `:29` says preserve ownership boundaries, but does not define a required handoff schema containing plan id, files, verification command, allowed edits, stop conditions, and summary fields. `tests/agent-schema.test.ts:230-327` verifies agent metadata/body markers, not per-command handoff packet completeness. | Claude subagent docs emphasize independent system prompts, tool restrictions, and explicit invocation boundaries. OpenAI eval guidance calls out handoff accuracy. | Medium |
| Durable repo guidance has drift around `impact`. | `AGENTS.md:15-17` current-phase shipped-command lists omit `impact`. `docs/COMMAND-CATALOG.md:27`, `PROGRESS.md:74`, and `docs/RUNTIME-REFERENCE.md:28` mark `/blu-impact` implemented and explain its additive Wave 4 status. | Codex-style repo instructions are intended to guide agents on command/test behavior; stale context files can mislead future agents before they reach the live catalog. | High |
| Few-shot or concrete I/O examples are sparse in runtime prompt modules. | `rg "^## Examples|Example input|Example output|few-shot"` over `skills`, `commands`, `agents`, and `docs/commands` found mostly incidental examples, not reusable command-behavior examples. Claude's suggested `SKILL.md` skeleton includes an Examples section. | OpenAI and Google both recommend explicit output formats/examples where parseability or consistency matters. | Medium |
| Blueprint has useful MCP resource direction, but many resource views remain planned. | `docs/RUNTIME-REFERENCE.md:42-59` says command catalog/runtime-contract resources are live, while phase, codebase, and report resource views remain planned; commands continue using read-oriented MCP tools. | MCP resources are designed for contextual data; using resources for large read-only context can reduce prompt duplication and tool-call ambiguity. | Medium |

## Suspected Improvement Opportunities

1. **Introduce prompt/tool-call evals.** Add scenario fixtures for router, plan-phase, execute-phase, cleanup, ship, code-review-fix, and impact that assert expected tool calls, required non-calls, confirmation behavior, final response fields, and handoff decisions.

2. **Slim command manifests into stable entry contracts.** Keep manifest prompts focused on role, critical invariants, execution profile, and which skill/runtime-contract resource to load. Move long flow details into command-scoped runtime references or MCP resources with versioned schemas.

3. **Define confirmation as data, not just prose.** For high-risk or overwrite flows, add a reusable confirmation contract: gate id, action, destructive surface, exact commands/files, allowed response states, and host fallback. Where host support exists, consider MCP elicitation or an equivalent Blueprint confirmation MCP substrate.

4. **Create subagent handoff packet templates.** Each optional-agent command should define the minimum payload the parent must pass. For executor, that likely includes `phase`, `planId`, `selected task ids`, `readFirst`, `writeBoundary`, `forbidden surfaces`, `verification command`, `repair budget`, and `summary output schema`.

5. **Version and diff prompt modules.** Treat command prompts, skill modules, and agent prompts as versioned operational assets. Add checks that summarize prompt size, referenced tools, gates, examples, and sibling-contract leakage so drift is visible in PRs.

6. **Add worked examples for high-risk model decisions.** Examples should cover positive and negative cases: blocked cleanup, report overwrite declined, code-review-fix with missing saved findings, execute-phase lower-wave blocker, and router encountering a planned command.

7. **Repair durable context drift quickly.** `AGENTS.md` should either include `impact` in shipped-command lists or explicitly say the current-phase paragraph is stale/illustrative and the live catalog wins.

## Top 5 Recommendations

1. **Build a prompt-behavior eval harness first.** Start with 10-15 golden scenarios that mock MCP tool returns and assert tool-call sequence, no-write boundaries, confirmation gates, and final next-action text. This will catch the failures static metadata tests cannot see.

2. **Refactor the largest command manifests into thin launch prompts.** `blu-add-tests`, `blu-code-review-fix`, `blu-audit-fix`, `blu-secure-phase`, `blu-code-review`, `blu-review`, `blu-ship`, and `blu-plan-phase` are prime candidates. Keep detailed instructions in command-scoped references/resources and test that only the active bundle loads.

3. **Make high-risk confirmations a reusable typed contract.** Keep prompt-visible gates, but add a runtime shape for approval state so cleanup, ship, undo, workspace, patch replay, overwrite, and force paths are audited consistently across Gemini and non-Gemini hosts.

4. **Standardize subagent handoff schemas and eval them.** The agent files already demand good behavior; now make parent prompts prove they supplied the required packet before delegation.

5. **Fix the `AGENTS.md` `impact` drift and add context-file drift checks.** The repo's durable instruction file is high-priority prompt context; it should not lag behind `COMMAND-CATALOG`, `PROGRESS`, and `RUNTIME-REFERENCE`.

## Commands And Searches Run

Local read-only commands:

- `sed -n '1,260p' AGENTS.md`
- `rg --files commands skills agents docs tests src/mcp | sort`
- `sed -n` / `nl -ba` reads for `docs/COMMAND-CATALOG.md`, `docs/SKILLS-AND-AGENTS.md`, `docs/GEMINI-CONSTRAINTS.md`, representative command manifests, skills, agents, and tests
- `rg -n "prompt|eval|evaluation|rubric|golden|snapshot|LLM|agent handoff|handoff|progressive|context|ask_user|write_todos|update_topic|runtime-contract|tool" docs tests src commands skills agents`
- `find . -maxdepth 3 -iname '*eval*' -o -iname '*prompt*' | sort`
- Word-count sampling for command manifests and skill/reference/agent files
- `rg -n "impact|do\\b|planned|implemented" AGENTS.md MEMORY.md PROGRESS.md docs/COMMAND-CATALOG.md docs/SKILLS-AND-AGENTS.md docs/RUNTIME-REFERENCE.md commands/blu*.toml skills/blueprint-router/SKILL.md`
- `rg -n "ask_user|elicitation|confirmation|confirm|pending gate|pendingGate|force|requiresConfirmation" src tests commands skills docs`
- `git status --short`

Web searches:

- `Gemini CLI extensions documentation slash commands MCP extensions skills Gemini CLI official`
- `Claude Code skills agents subagents best practices prompt engineering official Anthropic skills agents`
- `OpenAI prompt engineering guide tool use structured outputs evals agent handoff best practices official`
- `Model Context Protocol tools resources elicitation sampling official docs best practices`
- `OpenAI Codex CLI AGENTS.md instructions best practices official docs coding agent`
- `Google Gemini API prompt engineering best practices official examples context control output format`

Failures/unavailable tools:

- Web access was available.
- No local command failures were observed.
- I did not run `npm test`, `npm run build`, or any mutating Blueprint command because this was discovery-only and the repo was to remain read-only except this report file.
