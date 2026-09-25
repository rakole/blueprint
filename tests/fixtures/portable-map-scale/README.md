# Portable map scale fixture

This fixture is generated on demand by `scripts/portable-map-scale.ts`; the
repository does not check in the generated 10,000 source files. The generator
creates a temporary Git checkout with deterministic JavaScript, JSX, TypeScript,
TSX, Python, Java, and unsupported SQL paths. Named checkout, shipping, UI,
catalog, rate, payment, and order responsibilities provide source-linked
semantic evidence. Generated modules make the structural inventory meaningful,
and the 10,000-file run adds a deterministic TypeScript source larger than one
MiB for honest file-level coverage.

The focused test uses a 32-file generated checkout and asserts structural and
semantic properties, packet UTF-8 caps, lossless reconstruction, complete
seven-view rendering, first publication, retained-generation refresh, and cold
resolver results. It does not assert wallclock values.

Run the explicit scale check once with:

```text
npx tsx scripts/portable-map-scale.ts --file-count 10000 --output tests/fixtures/portable-map-scale/results/scale-result.json
```

The result records the environment, method, source hash-manifest digest,
file/record/page/byte counts, extraction/packet/render/publication/resolution
timings, sampled RSS observations, refresh disk growth, and the authored-model
size. Paths in the result are repository-relative; host-specific temporary
roots are omitted. Timings are observations without hardcoded expectations and
RSS is sampled end-of-stage process RSS rather than peak memory.

The authored model intentionally covers eight named capabilities, eight
source-linked observed claims, eight aliases, and seven substantive
compatibility views. The generated modules remain structural-only semantics.
The current complete authored submission is measured against the 48 KiB
PLAN5.3 threshold. That is a model-size observation only. Durable operation
receipt traversal, disk reload, and lossless reconstruction are covered by the
manageable operation fixture in `tests/portable-map-operations.test.ts`; the
10,000-file result does not claim that the full operation walk was measured.
