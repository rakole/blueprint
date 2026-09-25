# Fulfillment service notes

Keep shelf assignment rules in `domain`, orchestration and ports in
`application`, and standard-library adapters in `adapter`. Configuration is
loaded from `config/default.properties`. Compile into a temporary directory
with `javac --release 17`; this service intentionally has no Maven project or
downloaded dependency.
