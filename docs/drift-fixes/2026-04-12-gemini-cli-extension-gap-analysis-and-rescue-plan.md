# Gemini CLI Extension Gap Analysis And Rescue Plan

## Status

- Audit date: 2026-04-12
- Scope: Blueprint as a Gemini CLI extension, not Blueprint versus upstream GSD
- Local Gemini CLI version inspected: `0.37.1`
- Repo surfaces reviewed:
  - `gemini-extension.json`
  - `commands/`
  - `skills/`
  - `agents/`
  - `hooks/hooks.json`
  - `src/mcp/server.ts`
  - `src/mcp/tools/project.ts`
  - extension-oriented tests under `tests/`
- Official Gemini CLI references reviewed:
  - Extension reference: `https://geminicli.com/docs/extensions/reference/` (last updated April 10, 2026)
  - Build extensions: `https://geminicli.com/docs/extensions/writing-extensions/`
  - Extension best practices: `https://geminicli.com/docs/extensions/best-practices/`
  - Custom commands: `https://geminicli.com/docs/cli/custom-commands/` (last updated April 10, 2026)
  - Agent skills: `https://geminicli.com/docs/cli/skills/` (last updated March 19, 2026)
  - Subagents: `https://geminicli.com/docs/core/subagents/`
  - MCP servers: `https://geminicli.com/docs/tools/mcp-server/`
  - Hooks: `https://geminicli.com/docs/hooks/writing-hooks/`
- Gemini CLI implementation cross-checks used:
  - `/opt/homebrew/Cellar/gemini-cli/0.37.1/libexec/lib/node_modules/@google/gemini-cli/bundle/chunk-DZQZKSDY.js`
  - `/opt/homebrew/Cellar/gemini-cli/0.37.1/libexec/lib/node_modules/@google/gemini-cli/bundle/builtin/skill-creator/SKILL.md`

## Executive Summary

Blueprint currently looks internally coherent, but it is drifted against Gemini CLI's actual extension runtime model in three important ways:

1. The declared skill layer is not discoverable by Gemini CLI.
2. The command prompts are written against repo file paths and raw internal tool names rather than Gemini-visible runtime identities.
3. The regression suite mostly validates Blueprint's own internal abstractions, not the extension surface Gemini actually loads.

The highest-risk result is that Blueprint can report commands as implemented and ship a passing test suite while its primary orchestration surface is partially invisible to the real extension loader.

The biggest concrete mismatches are:

- `9/9` Blueprint skill files are flat `skills/*.md` files, while Gemini CLI skill discovery expects `skills/<skill-name>/SKILL.md`.
- `9/9` of those skill files also lack the documented `description` metadata that Gemini uses for activation.
- `23/23` command manifest files reference `skills/...` repo paths as if those were runtime handles.
- `11/23` command manifest files also reference `agents/...` file paths instead of subagent names and subagent-routing semantics.
- `23/23` command manifest files reference raw tool names such as `blueprint_project_status`; `0/23` reference the MCP fully-qualified names Gemini CLI actually exposes.
- `27/30` current test files reference raw `blueprint_*` tool names; `0/30` reference runtime `mcp_blueprint_*` names.

## What Is Already Aligned

These parts of the extension are already broadly aligned with Gemini CLI's documented model:

- Command namespacing is correct.
  - `commands/blu.toml` maps cleanly to `/blu`.
  - `commands/blu/*.toml` maps cleanly to `/blu:<command>`.
- The manifest uses the documented split `command` plus `args` form for the MCP server and uses `${extensionPath}`.
- The extension context file is declared through `contextFileName: "GEMINI.md"`.
- Hooks are packaged in the correct extension-owned location: `hooks/hooks.json`.
- The shipped agent files in `agents/` now match Gemini subagent file format expectations.
  - They start with YAML frontmatter.
  - They include `name`, `description`, `kind`, `tools`, `max_turns`, and `timeout_mins`.
- `gemini extensions validate . --debug` succeeds locally, so the basic manifest and directory shape are not catastrophically broken.

That said, validator success is not enough. The skill and MCP contract drift below still remains.

## Findings

| ID | Severity | Area | Summary |
|---|---|---|---|
| `EXT-01` | `Critical` | Skills | Blueprint's skill layer is not discoverable by the real Gemini CLI skill loader. |
| `EXT-02` | `Critical` | Commands to Skills/Agents | Command prompts target repo file paths instead of Gemini runtime identities and activation mechanisms. |
| `EXT-03` | `Critical` | Commands to MCP | Command prompts and tests target raw internal tool names instead of runtime MCP fully-qualified names. |
| `EXT-04` | `High` | Status and Tests | Blueprint's implemented-command checks validate internal file presence and source registries, not Gemini-visible extension surfaces. |
| `EXT-05` | `High` | Runtime Smoke | Current extension verification is too shallow and source-oriented; it does not exercise the built extension runtime sufficiently. |
| `EXT-06` | `Medium` | Release and Discoverability | Manifest and release metadata are missing a few extension-specific hardening and discoverability improvements. |

### EXT-01 Critical: Blueprint Skills Are Invisible To Gemini CLI

#### What the docs and runtime say

- The extension reference says extension skills live under `skills/`, with `skills/security-audit/SKILL.md` as the example shape.
- The skills docs say Gemini injects each enabled skill's name and description into the session prompt and only loads the full skill body after activation.
- The installed Gemini CLI `skillLoader` implementation searches only for `SKILL.md` and `*/SKILL.md`.
- The installed Gemini CLI extension validator's `discoverSkills` logic only recognizes subdirectories containing `skills/<name>/SKILL.md`.
- The built-in `skill-creator` guidance describes `SKILL.md` as required and says `name` and `description` frontmatter are required.

#### Blueprint today

- The repo ships `9` flat files in `skills/`:
  - `skills/blueprint-bootstrap.md`
  - `skills/blueprint-governance.md`
  - `skills/blueprint-map.md`
  - `skills/blueprint-phase-discovery.md`
  - `skills/blueprint-phase-execution.md`
  - `skills/blueprint-phase-planning.md`
  - `skills/blueprint-phase-validation.md`
  - `skills/blueprint-roadmap-admin.md`
  - `skills/blueprint-router.md`
- All `9` are flat Markdown files, not `skills/<name>/SKILL.md`.
- All `9` are missing `description` in frontmatter.

#### Why this matters

- Blueprint documents skills as the primary orchestration layer, but Gemini CLI is very unlikely to discover any of them as actual skills.
- If the skills are not discovered, Gemini will not preload their `name` and `description` metadata and will never auto-activate their bodies through the documented skill flow.
- This is not just a documentation mismatch. It means the extension's intended orchestration layer is invisible to the runtime.

#### Evidence

- Repo layout:
  - `skills/*.md`
- Local Gemini CLI implementation:
  - `chunk-DZQZKSDY.js`: `pattern = ["SKILL.md", "*/SKILL.md"]`
  - `chunk-DZQZKSDY.js`: validator only checks `skills/<entry>/SKILL.md`
- Local Gemini skill creator guidance:
  - `bundle/builtin/skill-creator/SKILL.md`

### EXT-02 Critical: Command Prompts Use Repo Paths Instead Of Gemini Runtime Contracts

#### What the docs say

- Custom commands are just TOML prompt files.
- Skills are activated by Gemini based on skill metadata and the `activate_skill` flow, not by writing a repo path into the prompt.
- Subagents are selected by description and name.
- If you want to force a subagent, the documented syntax is `@subagent-name`, not a file path.

#### Blueprint today

- `23/23` command manifest files reference `skills/...` repo paths directly.
- `11/23` command manifest files reference `agents/...` repo paths directly.
- `0/23` command manifest files use `@blueprint-...` subagent syntax.
- Only `6/23` command files mention agent names inline at all; most agent guidance is still path-oriented.

Representative examples:

- `commands/blu.toml`
  - `Use skills/blueprint-router.md as the primary orchestration contract.`
- `commands/blu/plan-phase.toml`
  - `Use skills/blueprint-phase-planning.md ... follow agents/blueprint-planner.md and agents/blueprint-checker.md.`
- `commands/blu/execute-phase.toml`
  - `Use skills/blueprint-phase-execution.md ... follow agents/blueprint-executor.md.`

#### Why this matters

- A repo path is not a documented Gemini runtime handle for a skill or a subagent.
- When a skill is undiscoverable, a prompt instruction like `Use skills/blueprint-router.md` degrades into a plain English hint and depends on the main model deciding to manually inspect that file.
- When a subagent is available, the file path still is not the subagent identity. The runtime identity is the frontmatter `name`.
- This bypasses the exact runtime isolation the extension model is supposed to provide:
  - skill activation
  - subagent routing by description
  - subagent isolation by tool list

#### Net result

Blueprint currently treats skills and agents as repo-local contract documents first and Gemini runtime primitives second. Gemini CLI expects the opposite.

### EXT-03 Critical: Blueprint Uses Internal Tool Names Where Gemini Exposes MCP FQNs

#### What the docs say

- Gemini CLI assigns every MCP tool a fully qualified name using:
  - `mcp_{serverName}_{toolName}`
- The docs explicitly warn that MCP tool naming is namespaced and that server names should avoid underscores because policy parsing depends on this naming format.

#### Blueprint today

- The extension manifest names the MCP server `blueprint`.
- The server registers tool names that are already prefixed, for example:
  - `blueprint_project_status`
  - `blueprint_project_init`
  - `blueprint_phase_locate`
- Under Gemini CLI's documented naming rules, these become runtime tool names such as:
  - `mcp_blueprint_blueprint_project_status`
  - `mcp_blueprint_blueprint_project_init`
  - `mcp_blueprint_blueprint_phase_locate`

But:

- `23/23` command manifest files reference raw internal tool names.
- `0/23` command manifest files reference runtime FQNs.
- `27/30` test files reference raw `blueprint_*` names.
- `0/30` test files reference runtime `mcp_blueprint_*` names.

#### Why this matters

- Blueprint's prompt contracts and test suite are written against a different tool naming surface than the one Gemini CLI exposes.
- The model may still select the right tool semantically from descriptions, but that is weaker than giving the runtime-visible name directly.
- The repo is currently proving that the MCP server internals are coherent, not that the commands are speaking the same language as the live Gemini tool registry.

#### Important nuance

This is not a bug in `src/mcp/server.ts`. The server is allowed to register any valid tool names.

The drift is that Blueprint has not defined a clear boundary between:

- internal tool registration names
- Gemini-visible runtime names
- prompt/test contract names

Right now those three layers are conflated.

### EXT-04 High: Implemented Status And Regression Tests Validate Internal Abstractions, Not Extension Discoverability

#### Blueprint today

- `src/mcp/tools/project.ts` still models skill paths as `skills/${primarySkill}.md`.
- `blueprint_command_catalog` can therefore report command skill availability against a path shape Gemini CLI itself does not use for extension skill discovery.
- The implemented-status rule in Blueprint docs says a command is implemented when manifest, primary skill, and required MCP tools are present.
- In practice, the `primary skill` check is currently checking the repo's internal flat Markdown file convention, not the Gemini extension loader's convention.

#### Test drift

- `tests/command-catalog.test.ts` and related tests assert `skillPath` values like `skills/blueprint-phase-discovery.md`.
- Command metadata tests look for prompt strings like `skills/blueprint-roadmap-admin.md`.
- The suite therefore codifies the wrong extension runtime contract and will actively resist correction until the tests are rewritten.

#### Why this matters

- Blueprint can mark a command implemented even if its declared primary skill is not discoverable as a Gemini skill.
- This is the exact kind of drift a command catalog is supposed to prevent.

### EXT-05 High: Extension Verification Is Too Source-Oriented And Too Shallow

#### Current state

- `gemini extensions validate . --debug` succeeds locally.
- The test suite verifies:
  - `gemini-extension.json` exists
  - `dist/mcp/server.js` exists
  - source hooks behave correctly when invoked directly from `src/hooks/*.ts`
  - source-level server tool names and docs stay aligned

#### Missing runtime checks

- No test proves that extension skills are discoverable through the Gemini runtime's actual `SKILL.md` rules.
- No test proves that command prompts speak in runtime MCP FQNs rather than internal names.
- No test launches the built hook entrypoints from `dist/hooks/*.js`.
- No test proves that the built extension can be linked into a clean Gemini home and surfaces the expected extension assets there.
- No repo-local test proves the real discovered extension surface:
  - commands
  - skills
  - agents
  - hooks
  - built MCP server entrypoint

#### Important observation

The built-in validator passing is not enough. It passed here while the extension still carries a major skill discovery drift. Blueprint therefore needs its own extension-surface contract tests.

### EXT-06 Medium: Manifest And Release Metadata Need Extension-Specific Hardening

These are not runtime blockers, but they are real extension-product gaps:

- `gemini-extension.json` has no `description`.
  - The extension reference says this is what appears on `geminicli.com/extensions`.
- The manifest does not currently use `excludeTools`.
  - This is optional, but it is a legitimate extension-level hardening lever if Blueprint wants extra restrictions beyond advisory hooks.
- There is no extension-specific release smoke in CI that exercises:
  - `gemini extensions validate`
  - local linking
  - built asset presence for all hook commands
- There is no explicit extension install smoke against a clean Gemini home.

I do not consider `plan.directory` a required fix in this rescue pass. Blueprint owns planning state through `.blueprint/`, not Gemini Plan Mode artifacts. This is a product decision, not clear drift.

## Rescue Plan

### Phase 0: Lock The Runtime Vocabulary

Goal: stop mixing repo-internal names with Gemini runtime names.

Tasks:

1. Define one canonical runtime contract table in code.
   - Include:
     - command manifest path
     - skill name
     - skill on-disk path
     - agent names
     - MCP server name
     - internal tool registration name
     - Gemini runtime FQN
2. Decide whether to keep current internal tool names or rename them.
   - Recommended immediate path:
     - keep the current tool registration names for now
     - generate runtime FQNs from them
     - fix prompts and tests first
   - Optional second pass:
     - rename tools to remove the duplicated `blueprint_` prefix at registration time for cleaner runtime names
3. Make `src/mcp/tools/project.ts` derive skill paths from the real extension layout instead of `skills/${primarySkill}.md`.

Acceptance criteria:

- There is exactly one source of truth for runtime tool names and skill paths.
- No command or test needs to guess how Gemini names a tool.

### Phase 1: Convert Skills Into Real Gemini Skills

Goal: make the orchestration layer discoverable by Gemini CLI.

Tasks:

1. Move every flat skill file into a real skill directory:
   - `skills/blueprint-router/SKILL.md`
   - `skills/blueprint-bootstrap/SKILL.md`
   - `skills/blueprint-governance/SKILL.md`
   - `skills/blueprint-map/SKILL.md`
   - `skills/blueprint-phase-discovery/SKILL.md`
   - `skills/blueprint-phase-planning/SKILL.md`
   - `skills/blueprint-phase-execution/SKILL.md`
   - `skills/blueprint-phase-validation/SKILL.md`
   - `skills/blueprint-roadmap-admin/SKILL.md`
2. Add required frontmatter fields to every `SKILL.md`:
   - `name`
   - `description`
3. Rewrite the frontmatter `description` text so Gemini can route correctly.
   - Each description should say:
     - expertise area
     - when to use the skill
     - 2-4 example scenarios
4. Keep each `SKILL.md` lean.
   - Move heavy schemas, examples, and reference material into `references/` where useful.
5. Update every repo reference that currently points to `skills/*.md`.
   - `README.md`
   - `docs/ARCHITECTURE.md`
   - `docs/SKILLS-AND-AGENTS.md`
   - `src/mcp/tools/project.ts`
   - tests

Acceptance criteria:

- A Gemini-compatible discovery script finds all `9` Blueprint skills.
- No implemented command points at a flat `skills/*.md` path.

### Phase 2: Rewrite Command Prompts Around Runtime Identities

Goal: stop depending on undocumented repo-path behavior.

Tasks:

1. Remove all `Use skills/...` prompt text.
2. Replace it with one of these patterns:
   - deterministic command-local instructions for the required control flow
   - explicit skill-name guidance where skill activation is helpful
3. Remove all `agents/...` path references from command prompts.
4. Replace them with subagent names and runtime-oriented delegation instructions.
   - Example target wording:
     - `Use the blueprint-planner subagent for bounded plan synthesis when deeper planning work is needed.`
5. Update all command prompts to refer to MCP tools using the runtime contract decided in Phase 0.
   - Minimum requirement:
     - prompts must stop pretending the raw registration names are the runtime names
6. Make commands self-sufficient for their minimum safe flow.
   - Do not make correctness depend on heuristic skill activation.
   - Skills and subagents should improve routing and depth, not be a hidden prerequisite for baseline correctness.

Acceptance criteria:

- `0/23` command manifest files reference `skills/`.
- `0/23` command manifest files reference `agents/...md`.
- `0/23` command manifest files use stale raw tool names if runtime FQNs are the chosen contract.

### Phase 3: Rebuild The Regression Suite Around Extension Reality

Goal: make future drift impossible to miss.

Tasks:

1. Add a dedicated extension discovery test.
   - Parse the extension exactly like Gemini expects:
     - commands from `commands/**/*.toml`
     - skills from `skills/*/SKILL.md`
     - agents from `agents/*.md`
     - hooks from `hooks/hooks.json`
2. Add a skill schema test.
   - Assert every `SKILL.md` has:
     - YAML frontmatter
     - `name`
     - `description`
     - non-empty body
3. Add a runtime tool-name contract test.
   - Build runtime FQNs from the manifest MCP server name plus registered tool names.
   - Assert command prompts and extension docs use the chosen runtime contract.
4. Update command-catalog tests to validate discoverable skills, not flat file presence.
5. Add built-hook smoke tests.
   - Execute `dist/hooks/read-before-edit.js`
   - Execute `dist/hooks/blueprint-write-guard.js`
   - Execute `dist/hooks/workflow-advisory.js`
   - Keep the existing source tests if useful, but add built-entrypoint coverage because the manifest uses built files.
6. Add built-MCP smoke coverage.
   - At minimum:
     - ensure `node dist/mcp/server.js` starts cleanly
     - ensure the built server registers the expected tool set
7. Add a clean-home extension smoke test.
   - Use a temporary `HOME`
   - run `gemini extensions validate . --debug`
   - run `gemini extensions link .`
   - run `gemini extensions list`
   - verify Blueprint appears and the linked extension contains the expected surfaces

Acceptance criteria:

- The suite fails if a skill is moved back to `skills/*.md`.
- The suite fails if a command prompt reintroduces `skills/...md` or `agents/...md`.
- The suite fails if the runtime MCP naming contract changes without corresponding prompt/test updates.

### Phase 4: Release And Discoverability Hardening

Goal: make Blueprint a better extension product once runtime correctness is fixed.

Tasks:

1. Add `description` to `gemini-extension.json`.
2. Add an extension release checklist or CI gate that always runs:
   - `npm run build`
   - `npm test`
   - `gemini extensions validate . --debug`
   - clean-home link smoke
3. Decide whether Blueprint wants extra manifest or policy hardening:
   - `excludeTools`
   - policy engine rules
4. Document exact extension-level install and restart expectations in `README.md`.

Acceptance criteria:

- Blueprint is discoverable and self-describing as an extension.
- Release automation blocks tags when the extension runtime shape drifts.

## Automated Drift-Prevention Plan

The regression plan should be split into fast PR checks and slower extension-smoke checks.

### PR Gate

Add these tests to the default repo test run:

1. `tests/extension-discovery.test.ts`
   - Discover commands, skills, agents, and hooks using Gemini-compatible file rules.
2. `tests/skill-schema.test.ts`
   - Validate `skills/*/SKILL.md` frontmatter and body.
3. `tests/runtime-tool-contracts.test.ts`
   - Derive runtime MCP FQNs from `gemini-extension.json` plus the tool registry.
   - Assert command prompts and command docs use the selected runtime contract.
4. `tests/command-runtime-contracts.test.ts`
   - Assert no command prompt contains:
     - `skills/*.md`
     - `agents/*.md`
     - stale raw tool names if those are no longer the runtime contract
5. `tests/built-hooks-smoke.test.ts`
   - Execute the built hook scripts in `dist/hooks/*.js`.
6. `tests/built-mcp-smoke.test.ts`
   - Start the built MCP server or import the built output and verify the tool set.

### CI Smoke Gate

Run these after the normal test suite:

1. `gemini extensions validate . --debug`
2. Temporary-home link smoke:
   - create temp home
   - `HOME=<temp> gemini extensions link .`
   - `HOME=<temp> gemini extensions list`
3. Verify the linked extension exposes:
   - `commands`
   - `skills`
   - `agents`
   - `hooks`

### Optional Authenticated Nightly Smoke

If CI has Gemini auth available, add a nightly or manually-triggered job that:

1. creates a temporary repo fixture
2. links Blueprint into a temporary Gemini home
3. runs a minimal headless interaction such as `/blu:help`
4. verifies that the command returns successfully

This should be optional because it depends on model access, but it is the only fully end-to-end proof that the live extension runtime still works.

### Specific Guardrails To Add

- Explicitly set custom-agent enablement in smoke fixtures instead of relying on channel defaults.
  - The official subagent docs and current settings docs are not perfectly aligned about enablement defaults.
  - Smoke tests should opt in deliberately to avoid channel drift.
- Treat `gemini extensions validate` as necessary but not sufficient.
  - It passed during this audit while the skill layer was still non-discoverable.
- Test the built extension, not only `src/`.
  - The manifest points to `dist/`, so source-only tests are not enough.

## Recommended Implementation Order

1. Phase 0 runtime vocabulary
2. Phase 1 skill packaging
3. Phase 2 command prompt rewrite
4. Phase 3 regression rebuild
5. Phase 4 release hardening

This order matters. Rewriting prompts before fixing the runtime vocabulary and skill packaging will create another drift cycle.

## Bottom Line

Blueprint's main extension risk is not that the repo is missing files. The risk is that the repo's internal contracts still do not match Gemini CLI's actual discovery and naming model.

The most urgent corrective actions are:

1. convert the skill layer into real `skills/<name>/SKILL.md` skills
2. stop using repo file paths as runtime handles in command prompts
3. standardize on the real Gemini MCP naming contract
4. rewrite the regression suite to validate extension discoverability, not just internal consistency

Until those four items are done, Blueprint can keep passing internal checks while drifting further away from the extension runtime it is supposed to ship.
