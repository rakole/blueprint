# Held-out TS service dataset

This dataset is source-grounded in the frozen `ts-service` corpus. The source
manifest SHA is
`3dd4045412f65feebc7c95893da2502e81677f55e0b82244a3890fda7a7d4438`.

The dataset contains 15 navigation queries covering all ten navigation classes,
two pilot tasks (discussion and implementation), and six confirmatory tasks (one
each for discussion, research, planning, implementation, review, and testing).
Every source span is repository-relative and uses inclusive one-based lines from
the frozen base source unless the query explicitly names a scenario.

The three controlled scenarios are:

- `ts-service-scenario-stale-limit`: changes the open-reservation threshold in
  place from three to four.
- `ts-service-scenario-renamed-summary`: renames the standalone UI summary
  module while preserving its contents.
- `ts-service-scenario-new-window-helper`: creates a small reservation-horizon
  helper after map freeze.

Scenario operations are applied only to disposable copies of the source for
validation. The frozen source and any authored maps remain untouched. The
dataset's aliases use source-grounded synonyms; absence of a synonym from a
frozen map is a valid held-out miss. The unknown-feature and
unsupported-language queries require conservative abstention from the bounded
corpus rather than a claim of global absence.

Task `knownTarget` is a prompt-only preregistered label. It is `true` only when
the prompt itself names a principal repository-relative source or test path, or
names a principal live declaration that is the direct task target. Routes,
feature phrases, incidental helpers or configuration names, expected
deliverables, and hidden evidence do not qualify. In this dataset,
`ts-service-confirm-research` is `true` because its prompt names
`src/persistence/reservations.sql`, and `ts-service-confirm-implementation` is
`true` because its direct target is the named `ReservationForm` component; the
other six tasks are `false`. These labels are fixed before participant runs and
never use map behavior or outcomes.

Each task `baselineChecks` item has the form `{cwd:"fixture",command:string}`.
The harness runs each command independently in one Bash shell from an
unchanged disposable participant copy. The documented fixture baselines are:

```sh
node --experimental-strip-types --test tests/*.test.ts
"$EVALUATION_TSC" -p tsconfig.json --noEmit --typeRoots "$EVALUATION_TYPE_ROOTS"
```

The test command is run with the fixture as its working directory and exercises
the service through the application and router layers without starting a
network listener. The parent harness supplies `EVALUATION_TSC` and
`EVALUATION_TYPE_ROOTS` as absolute paths to the same generic TypeScript
compiler executable and Node typings/toolchain roots in every evaluation arm;
both variables are required for the typecheck. No command points back to the
frozen Blueprint checkout. TypeScript emits no files in this fixture. Each
check must be independently executable and must leave its disposable copy
unchanged.

Gold evidence, scenario patches, and blinded rubrics are for the evaluation
harness. They must not be copied into a participant source workspace or exposed
to future participants.
