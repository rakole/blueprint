# Mixed monorepo held-out dataset

This source-only dataset covers the synthetic MarketRoute monorepo: a
TypeScript dispatch console, a Python route-planner worker, a Java fulfillment
service, and the JSON contracts they share. The dataset is pinned to source
manifest `b790f6dc577221d1bd1fcc706093458e1c9814e88bbdddd5596e55872888f3ff`.

The 15 navigation queries cover all ten required classes. Three queries use
small disposable scenarios: the stale scenario lowers the slot box limit from
12 to 10, the renamed scenario moves `status-badge.jsx` to `status-label.jsx`,
and the new scenario creates `contracts/dispatch-status.schema.json`. Scenario
operations apply only to future disposable copies after the frozen source and
maps are retained; they never modify the frozen fixture.

There are two pilot tasks for implementation and testing, followed by one
confirmatory task for each of discussion, research, planning, implementation,
review, and testing. Hosted `knownTarget` is true only when the prompt names a
principal live source path or declaration as the direct target. Discovery
prompts leave their target to source-grounded investigation. Alias navigation
uses terms such as delivery stops and day; absence of that synonym in an unseen
map is a legitimate held-out miss. Unknown-feature and unsupported-language
queries use conservative bounded-abstention evidence.

Baseline commands run from the disposable participant root (`cwd: fixture`):

```sh
node --experimental-strip-types --test apps/dispatch-console/tests/*.test.ts
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=workers/route-planner/src python3 -m unittest discover -s workers/route-planner/tests -v
set -euo pipefail
tmp_dir=$(mktemp -d)
cleanup() { local status=$?; rm -rf "$tmp_dir"; exit "$status"; }
trap cleanup EXIT
mkdir -p "$tmp_dir/classes"
find services/fulfillment/src services/fulfillment/tests -name '*.java' -print0 | xargs -0 javac --release 17 -d "$tmp_dir/classes"
for test_class in \
  com.marketroute.fulfillment.FulfillmentServiceTest \
  com.marketroute.fulfillment.ConfigurationTest
do
  java -ea -cp "$tmp_dir/classes" "$test_class"
done
node --experimental-strip-types scripts/check-contracts.mjs "$tmp_dir/classes"
```

Each task baseline is independently executable in a fresh Bash shell. The Java
checks compile into a task-owned temporary directory and clean that directory
on exit. The cross-language script needs the compiled Java classes and the
standard Python path shown above. TypeScript compiler checks, when requested by
the parent harness, use its absolute generic `EVALUATION_TSC` and
`EVALUATION_TYPE_ROOTS` values rather than a path into this frozen fixture.

Evidence coordinates are 1-based spans in the base source or in the resulting
disposable scenario copy. Rubric evidence uses the normalized
`required`/`supporting`/`alternatives` evidence-set object, and every criterion
has source-grounded `0`, `0.5`, and `1` score anchors. Prompts are standalone
engineering work requests and do not disclose held-out artifacts or solutions.
