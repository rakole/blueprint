# Parcel Locker synthetic fixture

Parcel Locker is a small, invented Java service for assigning incoming parcels
to pickup lockers. It models delivery registration, zone-aware locker policy,
pickup verification, cancellation, a CSV manifest adapter, configuration, and
an in-memory persistence boundary. The fixture is synthetic and makes bounded
realism claims about service structure only; it is not a production logistics
system and does not encode a real carrier protocol.

The corpus uses only the Java standard library and compiles without Maven or
network access. From this directory, run the executable baseline:

```sh
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT
find src tests -name '*.java' -print0 | xargs -0 javac -d "$tmp_dir/classes"
for test_class in \
  com.blueprint.fixture.lockers.DeliveryApplicationServiceTest \
  com.blueprint.fixture.lockers.ConfigurationAndManifestTest \
  com.blueprint.fixture.lockers.MainSmokeTest
do
  java -ea -cp "$tmp_dir/classes" "$test_class"
done
java -cp "$tmp_dir/classes" com.blueprint.fixture.lockers.Main
```

The tests exercise assignment and collection invariants, configuration and CSV
translation, and the CLI wiring. `sql/schema.sql` records the relational shape
that an eventual adapter could implement; the executable fixture deliberately
uses in-memory adapters so its baseline stays dependency-free.
