# OpenCode Port: Tool Inventory And Conversion Plan

Status: historical plan with current implemented-design addendum.
Date: 2026-10-01. Blueprint baseline: `4409333e47c196f362fdb85be5c0000e6fe3dab6`.

## Branch Boundary

`AGENTS.md` contains the highest-priority repository rule: every OpenCode change
uses a fresh feature-branch worktree based on `origin/open_code`; every PR targets
and merges only into `open_code`. Never merge or cherry-pick port work into
`main` or `origin/main`. Keep the integration branch when cleaning up features.
The planning/policy change follows the same PR path.

## Current Implemented Design (2026-10-02)

Live native source supersedes the proposed sequence below. Blueprint has 56
canonical Markdown commands, one required primary plus 15 optional specialists,
and 17 exact native skills. Each command loads its primary skill once and gets
only ordered active effective references; the package manifest hashes the full
reference closure.

Native `steps` is not elapsed-time enforcement. Static agent permissions are not
per-assignment filesystem sandboxes. Required corruption fails closed; invalid
optional specialists are omitted with diagnostics and inline fallback. Direct
skill aliases are blocked. The private helper requires exact command/flag/session
correlation but makes no discovery-invisibility promise.

The private package export, explicit OpenCode data root, and projected
`BLUEPRINT_GLOBAL_HOME` separate installed assets from customer cwd and other
hosts' state. Qualification installs the exact local tarball into a disposable
prefix and configures its installed `file://` export; no registry publication or
host-global install is required.

Manifest hashes/closure and the static command catalog prove package consistency,
not host readiness. Evidence remains layered: source/offline, package, separately
opted-in actual-host, then provider/model qualification. The remaining sections
are historical planning context, not current implementation instructions.

## Target And Recommendation

Target released OpenCode **v1.18.34**, commit
`aec0b9a6d8898f68f923aaf08b7306d931fd9d76`. GitHub identified it as the latest
non-prerelease on the research date, published 2026-09-30 at 22:39:45 UTC.
Pin this baseline for the first implementation slice; do not silently follow
upstream `dev`. [Release](https://github.com/anomalyco/opencode/releases/tag/v1.18.34).

Use native OpenCode tools and configuration, with a small host vocabulary and
packaging boundary. Preserve Blueprint's internal MCP tool IDs, command and
specialist IDs, artifact contracts, validation, and MCP-owned persistence.
Generate OpenCode-facing assets deterministically from owned contracts where
practical. Avoid a second manually maintained copy of every workflow.

This plan does not promise support for OpenCode V2. Its separately published
[V2 tool documentation](https://opencode.ai/v2/docs/tools/) uses different
contracts, including `shell` and `subagent`. The released baseline below uses
`bash` and `task`; its configuration uses singular `permission` and servers
directly under `mcp`. Revisit V2 only as a separately chosen target.

## Verified Inventory

Two sequential GPT-5.6 subagents performed the local inventory and external
comparison. The harness rejected `gpt-5.6`; both ran as `gpt-5.6-sol`.
The parent independently recounted identifiers and checked key source contracts.

Scope: 142 files under `agents/` (15), `commands/` (56), and `skills/` (71,
including references). Counts below are textual occurrences and distinct files,
not observed runtime calls. `replace` counts only its tool declaration, excluding
ordinary English usage.

| Explicit Gemini/Tabnine name | Occurrences / files | OpenCode v1.18.34 equivalent | Conversion note |
| --- | ---: | --- | --- |
| `list_directory` | 15 / 15 | `read` | Supply directory `filePath`; produces a non-recursive listing. |
| `read_file` | 17 / 15 | `read` | Use `filePath`; `offset` is one-based and `limit` bounds output. |
| `glob` | 15 / 15 | `glob` | Retain identifier; verify path, ignore, and result-limit behavior. |
| `grep_search` | 15 / 15 | `grep` | Adapt to regex `pattern`, optional `path` and `include`. |
| `replace` | 1 / 1 | `edit` | Use `filePath`, `oldString`, `newString`, optional `replaceAll`. |
| `write_file` | 1 / 1 | `write` | Use `filePath` and `content`; retain overwrite gates. |
| `run_shell_command` | 2 / 1 | `bash` | Preserve bounded workdir, timeout, and verification scope. |
| `ask_user` | 162 / 65 | `question` | Rewrite the choice schema and preserve approval semantics. |
| `update_topic` | 77 / 57 | No direct model tool | Use concise progress prose; custom title integration is optional later. |
| `write_todos` | 84 / 57 | `todowrite` | Keep this parent-owned session coordination. |

Mappings use the released [tool registry](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/opencode/src/tool/registry.ts),
[read implementation](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/opencode/src/tool/read.ts),
[edit implementation](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/opencode/src/tool/edit.ts),
and [public tool reference](https://opencode.ai/docs/tools/).
There is no separate `list` tool in the inspected release registry.

### Local Evidence And Ownership

- `src/mcp/agent-metadata.ts`, `BLUEPRINT_AGENT_READ_ONLY_TOOLS`: all 15 specialists
  have `list_directory`, `read_file`, `glob`, and `grep_search`.
- `BLUEPRINT_EXECUTOR_AGENT_TOOLS`: only `blueprint-executor` also has `replace`,
  `write_file`, and `run_shell_command`.
- `agents/blueprint-executor.md`, lines 39, 91 and 134: parents own interaction,
  orchestration and persistence; executor shell access is bounded.
- `commands/blu-add-tests.toml`, interactive UX section: `ask_user` embeds Gemini
  choice fields, so replacing its identifier alone would leave invalid calls.
- `skills/blueprint-phase-execution/references/long-running-execution-profile.md`,
  Session-Local Visibility Helpers: progress already permits prose fallback.
- `skills/blueprint-router/SKILL.md`, runtime naming guidance: bare `blueprint_*`
  IDs are currently translated to Gemini-specific MCP names.

No explicit browser or web-search tool identifiers were found in this scope.
Generic mentions of browser, tracker, search, and shell are capability prose.
Registered `blueprint-*` agent names are dispatch targets, and skill names are
instruction identities. `/blu*` names are host commands, never shell commands.

### Blueprint MCP Names

The inventory found **102 distinct concrete MCP FQNs**, with **1,111 mentions in
102 files**. This is the referenced subset, not the complete server registry.
Keep canonical server IDs unchanged:

```text
Server key:          blueprint
Internal tool ID:    blueprint_project_status
Gemini/Tabnine FQN:  mcp_blueprint_blueprint_project_status
OpenCode FQN:        blueprint_blueprint_project_status
```

OpenCode prefixes exposed MCP tools with their configured server name. Configure
the stdio server at `mcp.blueprint`, retaining `blueprint` as its key. Do not
rename `blueprint_*` handlers or replace MCP operations with shell scripts.
[MCP configuration and prefixes](https://opencode.ai/docs/mcp-servers/).

## Required Semantic Changes

1. **Questions:** replace Gemini `type: "choice"` and placeholder instructions
   with `question`'s `questions` array, containing `header`, `question`,
   `options` with labels/descriptions, and optional `multiple`. Keep custom text
   possible. Cancellation, missing UI, or no answer must never imply approval.
   Test interactive choices and explicit headless behavior separately; fail with
   a clear pending gate when the host cannot collect a required answer.
   [Question schema](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/opencode/src/question/index.ts).
2. **Specialists:** dispatch named agents using `task` and `subagent_type`.
   Generated definitions use `mode: subagent` and explicit `permission` rules.
   Deny edits, shell, nested delegation, and parent-owned MCP mutations to
   read-only specialists. Permit only the executor's bounded mutation surface.
   Check the effective permissions, including `edit` covering write/patch paths,
   rather than trusting frontmatter intent. Preserve `workflow.subagents`
   gates and unavailable-agent fallback. Map turn bounds to supported step
   limits; do not silently discard timeout or cancellation behavior.
   [Agents](https://opencode.ai/docs/agents/),
   [task implementation](https://github.com/anomalyco/opencode/blob/v1.18.34/packages/opencode/src/tool/task.ts).
3. **Skills:** load guidance with `skill({name})`; the named skill itself is not
   a callable tool. Bundle its supporting references and retain Blueprint's own
   active-command input selection. OpenCode ignoring custom frontmatter does
   not remove the need for Blueprint to validate that metadata.
   [Skill discovery](https://opencode.ai/docs/skills/).
4. **Progress:** use `todowrite` only where existing contracts require session
   checklists; use prose for `update_topic`. Neither becomes durable Blueprint
   state. Do not add a custom progress plugin to the first slice.
5. **Packaging:** convert command TOML into OpenCode Markdown with YAML
   descriptions and prompt bodies, and convert argument placeholders to
   `$ARGUMENTS` where needed. Emit `.opencode/commands/`, `.opencode/agents/`,
   `.opencode/skills/`, and an OpenCode config. Preserve `/blu` and direct names.
   Keep development `AGENTS.md` distinct from installed Blueprint runtime
   instructions; never overwrite a consuming project's instruction file.
   [Command format](https://opencode.ai/docs/commands/).

## Implementation Sequence

Each numbered slice is a separate feature branch and PR into `open_code`.
These are proposed write scopes, not changes performed by this planning task.

### 1. Pin The Host Contract And Prove One Read-Only Path

Proposed branch: `codex/open-code-host-contract`.

- Add a small versioned OpenCode tool/schema fixture and disposable host probe.
- Update `src/mcp/runtime-vocabulary.ts#blueprintRuntimeToolFqn` and
  `src/mcp/runtime-host.ts` through an explicit OpenCode host profile.
- Prove the server connects and that `/blu` can read project status and the
  command catalog through the actual exposed OpenCode tool names.
- Choose and test an OpenCode-specific Blueprint global-state directory, with
  `BLUEPRINT_GLOBAL_HOME` override support. Do not fall through to Gemini paths
  or migrate existing Gemini/Tabnine state.
- Check actual access to `blueprint://commands/catalog` and runtime-contract
  resources. If the client lacks resource access, use an existing supported
  MCP-owned read path or report the gap; do not invent tool names.

Exit: pinned config/tool schema plus successful read-only stdio/host probe in an
isolated test home. Probe failures remain blockers, not claimed compatibility.

### 2. Add Deterministic OpenCode Packaging And Catalogue Checks

Proposed branch: `codex/open-code-packaging`.

- Add an OpenCode packaging script/profile; integrate with `scripts/build.mjs`
  and the existing shipped-assets conventions.
- Emit native command Markdown, skill files/references and runtime instructions.
  Keep one owned authoring source for each contract.
- Update `src/mcp/command-paths.ts`, `src/mcp/skill-metadata.ts`,
  `src/mcp/tools/project.ts` catalogue assembly, and
  `scripts/generate-command-registry.ts` where they assume Gemini paths.
- Require actual OpenCode-packaged command/skill/input presence before exposing
  a command as implemented. Source TOML alone must not prove OpenCode readiness.
- Match OpenCode config to the pinned release; merge user configuration
  deliberately and preserve existing files.

Exit: reproducible bundle, resolvable references, implemented-only routing,
and a shipped-assets test independent of the development checkout.

### 3. Convert And Constrain All 15 Specialist Agents

Proposed branch: `codex/open-code-agents`.

- Touch `agents/*.md` or their owned projection inputs,
  `src/mcp/agent-metadata.ts`, and `src/mcp/agent-definition.ts`.
- Generate OpenCode frontmatter without passing Gemini-only fields to its
  loader. Keep capability validation host-aware and explicit.
- Preserve parent-only interaction/persistence and all specialist identities;
  do not replace Blueprint specialists with generic OpenCode agents.
- Test named `task` dispatch, no-subagent fallback, bounded termination, and
  effective write/shell/MCP denial for a read-only reviewer.

Exit: all 15 definitions load; reviewer cannot mutate; executor can change only
its permitted disposable fixture; parent retains final state publication.

### 4. Convert Parent Workflow Prompts And MCP References

Proposed branch: `codex/open-code-workflow-tools`.

- Update owned text under `commands/`, `skills/`, runtime references, and
  `src/mcp/command-runtime-metadata.ts` as required by the projection design.
- Convert all 10 host identifiers and the 102 referenced MCP FQNs with semantic
  handling from the table. Do not globally replace English `replace` or the
  canonical internal `blueprint_*` IDs.
- Replace question schemas, skill-loading instructions, agent-dispatch wording,
  and progress helpers together with their contract tests.
- Port low-risk reads first, then bootstrap/discuss/research/plan, then executor,
  validation, and maintenance families. Preserve overwrite/freshness/confirmation
  gates and no-subagent behavior throughout.

Exit: every generated prompt uses supported host names; cancellation and missing
question UI cannot cross a mutation gate; representative authoring/publish/read
flows work through the unchanged MCP persistence contracts.

### 5. Port Necessary Advisory Hooks And Validate The Bundle

Proposed branch: `codex/open-code-integration`.

- Review `hooks/hooks.json` and `src/hooks/*` by behavior, then map only useful
  advisory hooks into an OpenCode plugin. Gemini hook registration is not portable.
  Keep enforcement and persistence in their owning runtime paths.
- Use released plugin APIs; isolate any adapter so it cannot bypass MCP safety.
  [Plugin reference](https://opencode.ai/docs/plugins/).
- Extend built-assets and host-install tests for an isolated OpenCode install.
  Include a simple read flow, structured confirmation, one specialist, bounded
  executor change, and one MCP-owned artifact publication/readback.
- Run typecheck, build, focused tests and the full applicable suite. Record any
  model-authentication/environment gap separately from deterministic coverage.

Exit: package smoke plus end-to-end evidence, unchanged state/approval/privacy
invariants, and a PR whose verified base is `open_code`.

## Validation And Stop Rules

Run `npm ci` in every fresh worktree before any build, typecheck or tests.
Start with these existing surfaces and add host-specific cases:

- `tests/runtime-vocabulary.test.ts` and `tests/settings-profile.test.ts`
- `tests/agent-schema.test.ts`, `tests/agent-tool-allowlist.test.ts`, and
  `tests/optional-agent-validity.test.ts`
- `tests/skill-metadata.test.ts`, `tests/command-catalog.test.ts`, and
  `tests/extension-runtime-contracts.test.ts`
- `tests/built-assets-smoke.test.ts` and matching command-family metadata tests

After runtime changes, run `npm run typecheck`, `npm run build`, the focused
checks, then `npm test` when shared behavior is touched. Regenerate applicable
tracked build/catalog outputs; review generated diffs. Do not edit during the
checkout-hygiene test runner. Use isolated temporary homes for host tests.

Stop a slice if the selected OpenCode version exposes different names/schema,
permissions expand a specialist's capabilities, a prompt assumes an unavailable
UI, installed assets fail catalogue checks, or the change would weaken
freshness, overwrite, containment, evidence, rejected-content privacy, or
MCP-owned publication. Do not infer success from name replacement alone.

## This Planning Change

Only repository guidance and this plan were changed. The original main checkout
and its pre-existing fixture modification were preserved. Documentation checks
and `git diff --check` apply; npm installation, builds, tests and live OpenCode
execution were deliberately not run for this documentation-only change.
Blueprint MCP resources were not mounted in this chat, so the local inventory
was grounded in source/registry files; no live catalogue execution is claimed.
