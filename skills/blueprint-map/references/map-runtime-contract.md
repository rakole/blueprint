# Blueprint Map Runtime Contract

This reference is the runtime-heavy contract for `/blu-map-codebase`.

Use it together with `skills/blueprint-map/SKILL.md` and
`agents/blueprint-mapper.md` so mapping output is useful as future planning and
execution evidence, not merely valid markdown.

## Contract Authority

- `mcp_blueprint_blueprint_artifact_contract_read` is the heading authority.
- The returned `contract.authoringTemplate` is the canonical shape for each
  artifact before drafting or repair.
- This reference is the richness and evidence authority: it tells the model how
  much concrete, path-backed analysis belongs inside those canonical headings.
- Do not add new artifact names, new state roots, or non-Blueprint persistence
  paths.

## Shared Runtime Contract

- Execution profile: `long-running-mutation`.
- Shared stage vocabulary: `Resolve`, `Read`, `Decide`, `Execute`, `Persist`,
  `Validate`, `Route`.
- In-flight status fields: resolved scope, active stage, pending gate,
  execution mode, next safe action.

Map the codebase workflow to those stages:

1. `Resolve`: confirm repo root, optional focus area, mapping target bundle, and
   whether this is a map-first brownfield run or an initialized refresh.
2. `Read`: inspect project status, canonical artifact contracts, existing
   bundle state, and repo-relative evidence inputs before any write.
3. `Decide`: choose reuse, confirmed refresh, or repair. Existing edited docs
   are reused by default.
4. `Execute`: collect evidence and author rich canonical drafts with concrete
   file paths.
5. `Persist`: write only through `mcp_blueprint_blueprint_codebase_artifact_write`.
6. `Validate`: repair invalid artifacts per returned issues, then validate the
   complete bundle.
7. `Route`: summarize created, reused, repaired, and blocked artifacts and end
   with the next safe implemented command.

## Evidence Collection

Collect repo evidence from the target repository root only, using repo-relative
paths in all MCP calls and all artifact prose.

Minimum evidence inputs:

- `package.json` when present
- source files from `src`, `app`, `lib`, and `commands` when present
- tests from `tests` and `test` when present
- docs from `docs` and root documentation files
- tracked files from `git ls-files`

Never read secret-bearing files such as `.env` contents. It is fine to mention
that a secret/config file exists, but do not copy credential values into
artifacts.

## Capability-Gated Mapping

Prefer bounded mapper decomposition when the host exposes a suitable code
analysis subagent or task mechanism.

Use four lanes:

- tech lane: `STACK.md`, `INTEGRATIONS.md`
- architecture lane: `STRUCTURE.md`, `ARCHITECTURE.md`
- quality lane: `CONVENTIONS.md`, `TESTING.md`
- concerns lane: `CONCERNS.md`

The lane output must either be persisted through Blueprint MCP tools or returned
to the parent as canonical draft content for MCP persistence. Browser, web,
generic page-inspection, or search-only agents are not acceptable substitutes
for code-analysis mapper agents.

## Single-Agent Fallback

When code-analysis subagents are unavailable, the main agent must author exactly
one artifact at a time in this order:

1. `STACK.md`
2. `STRUCTURE.md`
3. `ARCHITECTURE.md`
4. `CONVENTIONS.md`
5. `TESTING.md`
6. `INTEGRATIONS.md`
7. `CONCERNS.md`

For each artifact:

1. Read only the evidence needed for that artifact plus the corresponding
   `contract.authoringTemplate`.
2. Draft the artifact with the canonical headings and rich path-backed content.
3. Call `mcp_blueprint_blueprint_codebase_artifact_write`.
4. If the write returns `status: "invalid"`, repair the same draft from returned
   `issues`, re-check the canonical `contract.authoringTemplate`, and retry
   that artifact before moving on.
5. Keep only a compact carry-forward note: artifact path, write status, key
   evidence roots, and unresolved warnings.
6. Do not re-read or restate prior completed artifact bodies unless a later
   repair requires it.

This fallback is deliberately sequential to reduce active context pressure while
still producing documentation that is useful to future agents.

## Rich Artifact Templates

The headings below match the current codebase artifact contract. Keep the
headings unchanged unless `contract.authoringTemplate` says otherwise. Fill each
section with concrete repo paths and current-state facts.

### `STACK.md`

Required headings: `Purpose`, `Runtime`, `Tooling`, `Dependencies`, `Notes`.

Content expectations:

- `Runtime`: identify languages, runtime versions or constraints, module system,
  package manager, lockfiles, and config files. Cite paths such as
  `package.json`, `tsconfig.json`, or runtime entrypoints.
- `Tooling`: list build, typecheck, test, smoke, and integration commands from
  real scripts or config. Cite paths such as `package.json` and `scripts/*`.
- `Dependencies`: explain critical runtime and development packages with why
  they matter. Cite package manifests and representative source imports.
- `Notes`: include platform requirements, generated outputs, and constraints
  that future implementers must respect.

### `STRUCTURE.md`

Required headings: `Purpose`, `Directory Map`, `Key Files`, `Seams`, `Notes`.

Content expectations:

- `Directory Map`: describe where code, commands, skills, agents, tests, docs,
  hooks, build outputs, and runtime state live. Cite concrete directories such
  as `src/mcp/tools`, `commands`, `skills`, and `tests`.
- `Key Files`: identify entrypoints, manifests, central registries, and files
  future agents should open first.
- `Seams`: name ownership boundaries and safe modification points, such as
  command manifests versus MCP tools versus artifact contracts.
- `Notes`: state where new code or docs should be placed and what areas should
  not be mixed.

### `ARCHITECTURE.md`

Required headings: `Purpose`, `Overview`, `Boundaries`, `Flow`, `Notes`.

Content expectations:

- `Overview`: name the dominant architecture and top-level runtime shape.
- `Boundaries`: explain the major layers and responsibilities with file paths.
- `Flow`: describe command routing, MCP tool execution, persistence, validation,
  and error/failure logging paths.
- `Notes`: include practical implementation guidance, especially where runtime
  contracts are doc-derived or validation-derived.

### `CONVENTIONS.md`

Required headings: `Purpose`, `Naming`, `Module Boundaries`, `Error Handling`,
`Documentation`, `Notes`.

Content expectations:

- `Naming`: describe file, type, function, command, artifact, and tool naming
  patterns with examples from real paths.
- `Module Boundaries`: state import style, package/module layout, and ownership
  conventions future code should follow.
- `Error Handling`: document thrown-error versus structured-status patterns,
  overwrite confirmation behavior, and failure logging conventions.
- `Documentation`: explain where command specs, runtime references, skill docs,
  and durable notes belong.
- `Notes`: be prescriptive; say what future agents should do, not just what the
  repo happens to contain.

### `TESTING.md`

Required headings: `Purpose`, `Framework`, `Commands`, `Coverage`, `Notes`.

Content expectations:

- `Framework`: identify test runner, assertion library, fixture style, and
  integration-test dependencies from concrete files.
- `Commands`: list full, focused, integration, and smoke commands when present.
- `Coverage`: map major behavior areas to representative tests, and name gaps or
  metadata-only coverage explicitly.
- `Notes`: include how to add tests for command metadata, MCP behavior, artifact
  contracts, and fixtures.

### `INTEGRATIONS.md`

Required headings: `Purpose`, `External Systems`, `SDKs And APIs`,
`Authentication And Secrets`, `Notes`.

Content expectations:

- `External Systems`: list host CLIs, external services, system CLIs, and runtime
  protocols the repo integrates with. Cite manifests or source files.
- `SDKs And APIs`: identify SDK packages, MCP resources/tools, and integration
  entrypoints.
- `Authentication And Secrets`: state where auth is host-managed, environment
  mediated, or intentionally absent. Do not include secret values.
- `Notes`: include operational boundaries that matter for local development and
  extension execution.

### `CONCERNS.md`

Required headings: `Purpose`, `Risks`, `Gaps`, `Follow-Ups`, `Questions`,
`Notes`.

Content expectations:

- `Risks`: identify concrete technical debt, fragile paths, security concerns,
  performance concerns, or contract drift risks. Cite files.
- `Gaps`: distinguish missing behavior, thin tests, metadata-only coverage, and
  unknowns that could affect later lifecycle commands.
- `Follow-Ups`: give specific repair or investigation actions, not vague wishes.
- `Questions`: list assumptions that future planning should verify.
- `Notes`: preserve caution about high-risk areas and safe modification patterns.

## Completion Criteria

A mapping run is complete only when:

- all seven artifacts exist under `.blueprint/codebase/`
- each artifact follows its canonical headings from `contract.authoringTemplate`
- each artifact contains concrete repo paths and evidence-backed analysis
- invalid write results were repaired per artifact before moving on
- `mcp_blueprint_blueprint_artifact_validate` reports a valid bundle
- the final response reports created, reused, repaired, and blocked artifacts
