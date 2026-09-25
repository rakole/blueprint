# Portable codebase map evaluation

Status: incomplete; opt-in only. The evidence does not support default adoption, quality parity, downstream token savings, or a first-useful-navigation improvement.

The machine-readable aggregate is [portable-map-evaluation.json](portable-map-evaluation.json). Its `hosted.pilot.accounting` and `hosted.confirmatory.accounting` fields contain closed study totals. These include all named participants, reviewers, fixers, failed calls, report follow-ups, and the scoped parent window through the report draft; subsequent release engineering is separate.

## Scope and frozen design

The evaluation used four frozen synthetic corpora and maps: TypeScript service, Python library, Java service, and mixed-language monorepo. Source and maps were frozen before task and gold authoring. Execution amendments corrected a path-resolution callback, enumerated shipped alias handling during snapshots, and accepted the actual visible-final marker without changing frozen outcomes or scoring. All 1,736 preregistered file hashes matched before post-study source edits. The preregistration hash was `e860dc925fec6826675c96d3b3e0bbaeb91d5b406cdcb63d59f16ea37bfb72a3`; execution amendments 1–4 are part of the recorded protocol.

The hosted tasks used native MCP-prepared context with ordinary Codex task execution. This is not a full Gemini workflow benchmark. Participant work used `gpt-5.6-luna` at `xhigh`; blind grading used `gpt-5.6-terra` at `xhigh`.

The scripted navigation comparison was fixed and deterministic: 60 held-out queries, four arms, three byte budgets, and 720 observations. The budgets were 4096, 8192, and 12288 UTF-8 bytes. They are bytes, not tokens; the tokenizer and monetary cost were unavailable.

## Navigation result

The semantic portable-map arm failed to improve discovery navigation. The frozen script spent its budget on the index followed by whole semantic JSON shards, leaving no useful discovery source read. This tests that scripted strategy, not every way a model could use the readable pages or literal search. Among the 42 discovery queries (known target false), its useful-read counts were 0/42 at all three budgets. Ordinary lexical search reached a useful read for 22/42, 32/42, and 33/42 at 4096, 8192, and 12288 bytes. The preregistered navigation decision is therefore measured=true and firstUsefulImprovement=false.

Known-target queries are reported separately. Both lexical and portable-map arms reached a useful read for 18/18 at every budget, with sufficient context for 17/18. This known-target result does not offset the failed discovery result. The scripted result is a fixed-fixture navigation observation; it is not evidence about hosted-model tokens, quality, or every possible ordinary-file navigation strategy. The source-read classifier cannot interpret batched shell reads, so `verifiedSourceReads: 0` is missing observability, not evidence that no source was read or that hidden model memory was used.

## Hosted pilot

The pilot design covered eight tasks, two repeats, five arms, and an 80-run maximum under a 10-million-token cap. Three original participants completed. Strict original task completion was 0/3, the pilot variance estimate was unavailable, and no sample size could be derived from it. The pilot stopped at a budget-reserve boundary after 5,698,029 observed tokens of the 10,000,000-token cap; the stop was not a provider hard-cap exhaustion.

The three comparison records are present with `available: true`, but each has zero paired rows, zero independent clusters, and zero quality pairs. Their availability flags do not establish a comparison. No pilot quality-parity or token-savings claim is made.

## Hosted confirmatory study

The confirmatory design covered 24 tasks, three repeats, five arms, and an initial 360-run/50-million-token ceiling. Six participants were launched. Only two grades remain uncontaminated for review, and only one of those is complete. Four confirmatory grades and one pilot grade were contaminated. All five original grades remain in raw evidence; canonical quality is `null` for those rows. Exact raw original outcomes are preserved, with no repaired-grade replacement.

The three comparison records again have `available: true`, but each has only one paired task row and zero paired quality rows. The one-task token pairs are descriptive: portable versus legacy was -8.7%, portable versus compact was 4.2%, and standalone portable versus standalone source was 26.3%. These observations are too sparse to claim savings, parity, or a quality effect.

The confirmatory run stopped because the host containment boundary failed: a participant used a relative write that reached the main checkout, then used a shell retry after an absolute-path write was rejected. The affected original was restored and preserved as incident evidence. All future participant launches stopped. This was an actual host-containment failure, not a token-cap stop. The closed confirmatory aggregate is 18,807,452 tokens against the 50,000,000-token ceiling. Parent usage was 10,571,117; participant usage was 3,253,835. The remainder covers reviewers and fixers, including the report follow-up.

## Uncertainty and cost

The four-cluster one-sided 95% Hoeffding radius is 1.2238734, which is underpowered for the preregistered quality margin. Repeats are not independent tasks, and the pilot supplied no usable variance estimate. The study therefore remains incomplete and opt-in.

Measured direct map-author usage is a lower bound of 16,679,572 tokens across the four corpora. Shared mapping-wave helper usage totals 37,971,235 tokens, but its allocation is unknown. Full initial mapping cost, refresh cost, monetary cost, and break-even are all unavailable; absent scopes are not zero. The companion data includes direct-author amortization over 1, 5, 10, and 25 downstream tasks, plus cached/uncached input and output accounting. Cached input and reasoning output are subsets of input/output, not additive charges. The initial 750,000-token fixer allowance was exceeded by 54,636 tokens; report follow-up also exceeded the provisional end-report reserve. Actual usage remains charged within the unchanged study ceiling; no provider hard cap existed.

The full suite receipt at `d0978c9b7ae4bb458de949feb5666353119f2c85` recorded 2547 passing checks before the observer fix. The observer now accepts the host’s `final_answer` marker while still requiring a task-complete event; all eight focused observer tests and typechecking passed. Final release checks remain pending. This repository check does not turn the hosted evaluation into a successful benchmark.

## Decision and limits

Keep the portable map opt-in. Do not claim default adoption, quality non-inferiority, downstream savings, standalone benefit, or semantic navigation value from these observations. The public report excludes personal paths, session identifiers, and raw transcripts while retaining the exact original outcome evidence and its contamination status in the machine-readable record.
