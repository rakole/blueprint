# Portable generation `gen-001`

This immutable entry is the generation-specific copy of the public protocol.
The source baseline is the small Parcel Desk fixture. Structural coverage is
file inventory plus selected declarations; semantic coverage is limited to the
capabilities and records linked below.

## Routes

- [Capability routes](routes/capabilities.md)
- [File and record routes](routes/records.md)
- [Literal search routes](routes/search.md)
- [Generation manifest](manifest.json)

## Reading rules

Use direct source reads for known targets. Otherwise choose one literal search
shard or capability route, open the selected source coordinates, and read a
record only when the question needs its relationships, constraints, or tests.
Capability pages identify required and supporting live evidence; all required
evidence must be present before the context is sufficient. A stale, negative,
unsupported, or missing result requires ordinary bounded source discovery; the
map cannot establish absence.
