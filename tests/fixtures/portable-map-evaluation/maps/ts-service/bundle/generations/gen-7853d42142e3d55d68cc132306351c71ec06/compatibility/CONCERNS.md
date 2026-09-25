# Concerns

## Purpose

The prepared map contains 34 files: 14 with full parsed coverage, 15 TypeScript source/test files with file-level partial coverage, and 5 unsupported-language records for SQL, configuration or documentation. Runtime persistence is in-memory and tests call the router directly; the role of reservations.sql is not established by executable source.

## Evidence limits

The preparation reports unsupported-construct partial coverage for server.ts, reservation-routes.ts, config.ts, repository ports/adapters, branded IDs and all three test files. It reports unsupported-language file coverage for reservations.sql, package.json, tsconfig.json, README.md and AGENTS.md, so semantic details from those records are limited to file-level evidence.

## Runtime scope

The observed executable composition creates in-memory repositories and does not start a network listener. The SQL file is present but its runtime integration is unknown from the prepared source; durable persistence, deployment and production readiness are outside this fixture's evidence.

## Evidence

- `src/persistence/reservations.sql`
- `src/server.ts`
- `src/persistence/in-memory-reservation-repository.ts`
- `package.json`
- `tsconfig.json`
- `README.md`
- `tests/router.test.ts`
