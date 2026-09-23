# Portable codebase map

This file is the public entrypoint for the frozen fixture bundle. The copied
generation is generated evidence; current source and repository instructions
remain authoritative.

## Start here

- [Immutable generation entry](generations/gen-001/ENTRY.md)
- [Capability routes](generations/gen-001/routes/capabilities.md)
- [File and record routes](generations/gen-001/routes/records.md)
- [Literal search shards](generations/gen-001/routes/search.md)

## Navigation protocol

1. Reuse this index after it has been supplied; load it after context loss.
2. Read a known live file directly when the task already names its target.
3. For a concept, choose the smallest capability route. For a path, symbol,
   error, or alias, search the explicit `generations/gen-001/search/` directory.
4. Read only the selected capability or record page, then follow its source
   coordinates into the current tree and relevant tests.
5. Treat this map as generated evidence. It cannot prove absence or impact.
6. After two unproductive map actions, use ordinary bounded source discovery.
7. Missing, stale, unsupported, or malformed maps fall back to normal source
   discovery. Consumers never edit the map.

The entrypoint and each search hit are bounded byte records. Search lines are
literal references with source coordinates and relative record links; they do
not contain source bodies or instructions.
