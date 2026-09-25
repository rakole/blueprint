# Portable map study observations

`portable-map-study-observations.mjs` extracts a bounded observation from one
explicitly named Codex session JSONL file. It is metadata-only and has no
directory discovery, model calls, grading, persistence, or billing estimate.

```js
import { extractObservedSession } from "./portable-map-study-observations.mjs";

const observation = await extractObservedSession({
  sessionFile: "/private/tmp/named-session.jsonl",
  parentId: "parent-thread-id",
  agentPath: "/root/portable_wave22_author",
  workspaceRoot: "/private/tmp/frozen-source",
  sourceSnapshots: {
    "src/example.ts": {
      content: "export const value = 1;\n",
      sha256: "<lowercase sha256 of the supplied bytes>"
    }
  }
});
```

`sessionFile`, `parentId`, and `agentPath` are required exact values. The
extractor rejects a missing, symlinked, malformed, or differently named
session. `extractObservedSessions` accepts an explicit `sessionFiles` array
and one matching `agentPaths` array; it never scans a directory for candidates.

The lineage header is checked before any study events are interpreted. The
extractor retains only model context metadata, cumulative token metadata,
completion markers, visible assistant final hashes and bounded citation paths,
and ordered tool call/result metadata. Hidden reasoning and messages are never
stored. Token usage is `null` when cumulative counters are absent, malformed,
decreasing, or any JSONL line (including an interior blank line) is malformed. Valid cumulative input
and output totals are preserved; cached input and reasoning output remain
subsets, `totalTokens` is not double-counted, and monetary cost is always
`null` because it is unavailable.

Only one genuinely observed subsequent result paired with an explicit
source-read command is recorded as a source read. Duplicate calls/results,
result-before-call ordering, failed/nonzero results, and error-shaped `cat` or
`sed` output are rejected. Plain single-file `cat` and single-range `sed`
are recognized. The current Codex envelope supports custom `exec` calls whose
raw JavaScript forwards `r.output` or `r`; the latter is unwrapped only when
the returned value is valid JSON with an `output` field. Search commands such
as `rg` are retained as `candidateSearches`, never as source reads. Batches,
pipelines, unsupported commands, missing results, output truncation, path
escapes, and unparseable wrappers become explicit `unclassifiableEvents`.

Source-read records report the observed output hash and UTF-8 bytes, command,
ordered call/result sequences, and a conservative coverage label. Byte/range
coverage is `null` unless an explicit `sourceSnapshots` entry supplies bytes
whose SHA-256 is validated and whose selected lines exactly match the delivered
output. Snapshot content is never returned. The `retentionProxy` separates
path-only citation overlap from verified range overlap and leaves unknown-read
metrics unavailable.

An explicit final assistant marker (`final` or `final_answer`) and task-complete event are both required for
`completionStatus: "completed"`; malformed or incomplete sessions remain
incomplete even when a completion event appears.

The extractor does not read source files to fill gaps, infer omitted output,
or turn backend scans/search candidates into ordered reads. Tokenizer and
monetary cost fields stay unavailable (`null`).
