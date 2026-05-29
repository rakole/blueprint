# State, Artifacts, And Path Safety

Blueprint-managed runtime state belongs in `.blueprint/` for each project or
workspace. Host-global operational state belongs under the host-specific
Blueprint directory.

## Project State

Common project-local paths:

```text
.blueprint/PROJECT.md
.blueprint/REQUIREMENTS.md
.blueprint/ROADMAP.md
.blueprint/STATE.md
.blueprint/config.json
.blueprint/phases/
.blueprint/reports/
.blueprint/codebase/
.blueprint/impact/
.blueprint/notes/
.blueprint/todos/
.blueprint/backlog/
```

MCP tools own structured writes to these paths. Coding agents should not
hand-edit them to fake command behavior.

## Host-Global State

Host-global state is for cross-project operational data:

- defaults
- workspace registry
- patch registry
- update metadata

It is resolved through runtime host helpers and must be written only through
the owning MCP tools.

## Artifact Contracts

Artifact shape is centralized in `src/mcp/artifact-contracts/index.ts`.
Contracts define:

- id and scope
- owner tool
- path owner
- canonical filename pattern
- freehand policy
- required headings
- locked markers
- placeholder signals
- optional model contract
- scaffold and authoring templates

When changing an artifact:

- Update the contract definition first.
- Update validation, scaffold, and write flows together.
- Add tests for scaffold, validation, and write behavior.
- Keep generated examples from leaking into real authored content.

## Path Safety

Use existing helpers instead of ad hoc path handling.

Do:

- Resolve repo roots before project-local writes.
- Require repo-relative paths where tool contracts expect them.
- Keep `.blueprint/` writes inside the repo's Blueprint root.
- Use safe JSON parsing helpers for model-supplied JSON.
- Normalize phase and artifact identifiers with shared helpers.

Do not:

- Accept absolute paths in repo-relative tool inputs.
- Follow path traversal outside the allowed root.
- Concatenate untrusted strings into write paths.
- Write host-global paths outside runtime host helpers.

## Persistence Writes

Text persistence helpers normalize line endings, run prompt-boundary checks by
default, write through a temporary file, and finish with an atomic rename.
Mutating flows may use `.blueprint/locks/<name>.lock` plus stale-lock cleanup
when concurrent writes would be unsafe.

Do not bypass these helpers for convenience. A direct `fs.writeFile` in a new
tool should be treated as suspicious unless the tool is explicitly outside
Blueprint-owned state and has its own containment story.

## Prompt-Boundary Safety

Some tools inspect prompt-like content for injection markers, unsafe display
markers, encoded payloads, and control characters. Preserve this boundary when
adding model-authored artifacts or reports.
