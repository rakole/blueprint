# Tool Library Reservation Service

This directory is a synthetic fixture for repository-understanding evaluations.
It models a small service that lets members reserve shared tools for a bounded
time window. The source is intentionally compact, but the boundaries between
HTTP routing, application policy, domain rules, and persistence are representative
of a small service. It makes no claim about production readiness.

The fixture uses only Node.js built-ins at runtime. From this directory run the
executable baseline:

```sh
node --experimental-strip-types --test tests/*.test.ts
```

From the Blueprint repository root, validate the typed source with the local
toolchain:

```sh
./node_modules/.bin/tsc -p tests/fixtures/portable-map-evaluation/sources/ts-service/tsconfig.json --noEmit
```

The test command exercises the service through the application and router
layers without starting a network listener. TypeScript emits no files in this
fixture.
