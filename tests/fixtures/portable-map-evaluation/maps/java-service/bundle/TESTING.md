# Testing

## Purpose

The checked-in tests are executable Java main classes using assertions and explicit checks rather than a visible test framework. DeliveryApplicationServiceTest covers smallest-fitting assignment, successful collection and release, wrong pickup-code rejection, and oversized rejection; ConfigurationAndManifestTest covers property parsing and CSV translation; MainSmokeTest exercises CLI composition with temporary files. README documents the javac and java invocation, but no production build or CI configuration is present in the prepared snapshot.

## Behavior exercised

The application test verifies notification order, receipt status and deadline, persistence state, locker occupancy/release, and rejection invariants. ConfigurationAndManifestTest verifies header and blank-row handling plus trimming and enum translation. MainSmokeTest verifies config and manifest arguments reach Main.

## Limits

These tests are fixture-level executable checks. They do not establish concurrency, remote persistence, carrier protocol compatibility, or production operational guarantees.

## Evidence

- `README.md`
- `tests/com/blueprint/fixture/lockers/DeliveryApplicationServiceTest.java`
- `tests/com/blueprint/fixture/lockers/ConfigurationAndManifestTest.java`
- `tests/com/blueprint/fixture/lockers/MainSmokeTest.java`
