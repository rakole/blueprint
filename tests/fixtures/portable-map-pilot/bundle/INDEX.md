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
3. Choose one smallest route: a capability page for a domain flow, the file
   shard for a path or broad domain term, the symbol shard for an exact symbol,
   and the alias shard for an alias or vocabulary phrase.
4. A selected search hit contains its current source coordinate. Open that
   source directly; read one record only when the question needs declared
   relationships, constraints, or tests.
5. Capability pages list required live coordinates before optional supporting
   evidence. Read every required coordinate before calling the context enough.
6. The seven root compatibility views are descriptive documents, not
   navigation inputs. The map cannot prove absence or impact.
7. After two unproductive map actions, or for a missing, stale, unsupported,
   or malformed result, use ordinary bounded source discovery. Consumers never
   edit the map.

The entrypoint and each search hit are bounded byte records. Search lines are
literal references with source coordinates and relative record links; they do
not contain source bodies or instructions.
