# MarketRoute monorepo

MarketRoute is an invented community food-rescue network. A TypeScript dispatch
console accepts pickup-slot requests and presents active delivery routes. A
Python worker scores route plans from those requests. A Java fulfillment service
assigns food boxes to depot shelves and emits dispatch events. The three
components exchange small JSON documents described in `contracts/`.

The repository is source-only and uses standard libraries: Node.js built-ins,
Python's standard library, and the Java 17 API. No service starts a network
listener, and no external database or message broker is required. The example
data is synthetic and only demonstrates the component boundaries.

Run the component baselines from this directory:

```sh
node --experimental-strip-types --test apps/dispatch-console/tests/*.test.ts
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=workers/route-planner/src python3 -m unittest discover -s workers/route-planner/tests -v
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT
find services/fulfillment/src services/fulfillment/tests -name '*.java' -print0 | xargs -0 javac --release 17 -d "$tmp_dir/classes"
for test_class in \
  com.marketroute.fulfillment.FulfillmentServiceTest \
  com.marketroute.fulfillment.ConfigurationTest
do
  java -ea -cp "$tmp_dir/classes" "$test_class"
done
node --experimental-strip-types scripts/check-contracts.mjs "$tmp_dir/classes"
```

The final command sends the shared dispatch event through the TypeScript
`parseDispatchEvent` contract check, the Python contract parser, and the Java
contract probe. Java classes are deliberately compiled below the system
temporary directory.
