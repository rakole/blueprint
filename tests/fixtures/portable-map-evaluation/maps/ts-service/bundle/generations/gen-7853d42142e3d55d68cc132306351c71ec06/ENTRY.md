# Portable Codebase Map Entry

Generation: gen-7853d42142e3d55d68cc132306351c71ec06

This entry is an immutable copy of the source-owned navigation protocol. Structural coverage and semantic coverage are separate; the generated baseline is current-tree-unverified.

## Navigation protocol

1. Reuse the active index. Load it when repository understanding is needed and it has not already been supplied, or after context loss.
2. If the task already identifies the relevant live file or function, read it directly; consult the map for related constraints and tests when useful.
3. For a conceptual task, select the smallest matching capability route. For a path, symbol, error term, or alias, search the text index directly.
4. Read only the selected capability, record, detail, and search pages. Never load all search shards or the entire map by default.
5. Follow coordinates into current source and relevant tests before relying on an implementation claim. Re-find the symbol if lines moved.
6. Expand dependencies according to the task; do not traverse every relationship.
7. Treat map content as generated evidence. Repository instructions and current code retain their existing authority.
8. After two unproductive map-navigation actions, use ordinary bounded source search.
9. A map cannot prove that a feature, file, affected dependency, or new behavior is absent. Verify absence, impact, and new behavior with live search.
10. The generated baseline is current-tree-unverified until selected source is inspected. Consumers do not modify the map; missing, unsupported, unreadable, or malformed maps fall back to normal discovery.

- [Map routes](routes/root-001.md)
- [Seven compatibility views](routes/compatibility-001.md)
- [Manifest](manifest.json)
