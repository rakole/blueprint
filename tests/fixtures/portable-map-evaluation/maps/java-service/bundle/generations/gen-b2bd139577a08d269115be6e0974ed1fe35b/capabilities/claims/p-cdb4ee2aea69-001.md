# Accepted claims

### claim-claim-stdlib-synthetic
- basis: observed

README describes Parcel Locker as a small invented Java service, bounded to standard-library APIs, with a javac-only executable baseline and no Maven or network access.

Evidence:
- file: README.md

### claim-claim-tests-and-baseline
- basis: observed

README documents direct javac and java execution for three main-style test classes and Main; the checked-in tests exercise assignment and collection, rejection invariants, configuration and CSV translation, and CLI wiring.

Evidence:
- file: README.md
- file: tests/com/blueprint/fixture/lockers/DeliveryApplicationServiceTest.java:1-122
- file: tests/com/blueprint/fixture/lockers/ConfigurationAndManifestTest.java:1-41
- file: tests/com/blueprint/fixture/lockers/MainSmokeTest.java:1-19
