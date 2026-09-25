# Fixture development notes

Keep this Java service self-contained and runnable with the JDK standard
library. Preserve the boundaries between domain rules, application
orchestration, adapters, configuration, and the command-line entry point.
Compile source and tests into a temporary directory; do not add Maven or other
downloaded dependencies. This is a synthetic fixture; keep source and tests
focused on the service behavior.
