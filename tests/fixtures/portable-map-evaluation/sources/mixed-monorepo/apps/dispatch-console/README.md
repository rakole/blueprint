# Dispatch console

The TypeScript console accepts pickup-slot requests, stores dispatches behind a
repository interface, and exposes a tiny in-process router for the synthetic
domain. The TSX board and JSX badge show how the same route summaries could be
rendered without making the baseline depend on a browser framework.

Run `node --experimental-strip-types --test tests/*.test.ts` from this
directory, or run the equivalent command from the monorepo root. Type checking
uses the repository's local TypeScript compiler and emits no files.
