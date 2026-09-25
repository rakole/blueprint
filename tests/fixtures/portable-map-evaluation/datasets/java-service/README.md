# Java service held-out dataset

This dataset covers the frozen `java-service` source corpus for the portable
codebase-map evaluation. The source manifest is
`1c9586b0f3a9d8c1e8388444caf7140b3c8ec27ea7022c82673400b0fe65f2d0`.

`navigation.json` contains 15 source-grounded queries spanning the ten required
navigation classes. It includes base queries plus one stale, one renamed, and
one new-file scenario. `tasks.json` contains two pilot tasks (planning and
review) and six confirmatory tasks (discussion, research, planning,
implementation, review, and testing). `scenarios.json` describes disposable
source-copy operations only; the frozen source and any authored maps remain
unchanged.

The source corpus is self-contained Java and uses the executable commands in
the source README for baseline checks. Dataset authoring uses only source spans
and structural validation; no task solutions, evaluator runs, routing, ranking,
or hosted outcomes are part of this fixture.

Task `knownTarget` is a prompt-only preregistered label. It is `true` only when
the prompt itself names a principal repository-relative source or test path, or
names a principal live declaration that is the direct task target. Routes,
feature phrases, incidental helpers or configuration names, expected
deliverables, and hidden evidence do not qualify. In this dataset,
`java-service-confirm-implementation` and `java-service-confirm-testing` are
`true`; the other six tasks are `false`. These labels are fixed before
participant runs and never use map behavior or outcomes.

Each task `baselineChecks` item has the form `{cwd:"fixture",command:string}`.
The harness runs each command independently in one Bash shell from an
unchanged disposable participant copy. Every Java command creates its own
`mktemp -d` classes directory, enables failure propagation, and removes that
directory with an exit-status-preserving trap. Commands use only the JDK,
write no files into the fixture, and do not depend on setup performed by a
different baseline item.
