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

Use direct source reads for known targets. Otherwise search a literal term in
the listed search shards, read the linked record or capability, and verify its
coordinates against current source. A stale, negative, unsupported, or missing
result requires ordinary bounded source discovery; the map cannot establish
absence.
