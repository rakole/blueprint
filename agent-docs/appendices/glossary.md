# Glossary

Artifact contract:

- A source-defined contract for a Blueprint artifact's owner, path, headings,
  model schema, scaffold template, and validation rules.

Command manifest:

- A TOML host command prompt under `commands`. It should be thin and point at
  the active skill and allowed MCP FQNs.

Declared status:

- The status recorded by command metadata or catalog source material. It is an
  input to availability, not the final runtime truth.

Implemented command:

- A command whose live catalog entry has `status: implemented` and
  `implemented: true`.

MCP substrate:

- The registered tools, resources, schemas, path helpers, and runtime metadata
  that make a command safe to expose.

Runtime catalog:

- The live command catalog produced by MCP project tools. It is stronger than
  declared status for routing decisions.

Runtime FQN:

- The host-callable MCP tool name, such as
  `mcp_blueprint_blueprint_project_status`.

Skill input bundle:

- A skill frontmatter mapping from active command to the exact command manifest
  and local runtime references that should be loaded.

Source-owned metadata:

- Command metadata embedded in TypeScript source rather than parsed from
  external command spec tables.

Host-global state:

- Cross-project Blueprint operational data such as defaults, workspace
  registry, patch registry, and update metadata.

Project-local state:

- The `.blueprint/` tree inside a managed repository or workspace.

Advisory hook:

- A hook that warns or guides before edits but does not own persistence or state
  transitions.
