# Fixture development notes

MarketRoute is a self-contained synthetic monorepo. Keep the TypeScript console,
Python planner, and Java fulfillment service aligned through the JSON files in
`contracts/`. Use standard library APIs and the repository's existing Node
toolchain; do not add downloaded dependencies or generated build output.

Run each component's baseline from its own directory, and use the root
cross-language command after compiling the Java sources into a temporary
directory. Keep domain rules in the component that owns them and keep adapters
thin.
