# Stack

## Purpose

Parcel Locker is a synthetic Java service that uses only the Java standard library. The 35-file prepared snapshot contains Java domain, application, adapter, configuration, CLI, and test sources plus Markdown, properties, and SQL; 29 files have full parsed structural coverage and six are file-level records, with TimeSource.java partial because of an unsupported construct and five non-Java files unsupported. README.md documents a javac-only baseline with no Maven or network dependency.

## Runtime and dependencies

Source imports use java.time, java.util, java.nio.file, java.io, and java.util.Properties alongside the fixture packages. No dependency manifest or third-party library is present in the prepared file set; runtime dependency claims are limited to the standard library.

## Coverage

Prepared coverage is 35/35 included files, with 197 symbols, 109 imports, and 145 relationships. Six records are file-level only: README.md, docs/OPERATIONS.md, config/default.properties, sql/schema.sql, AGENTS.md, and the partially parsed TimeSource.java interface.

## Evidence

- `README.md`
- `src/com/blueprint/fixture/lockers/Main.java`
- `src/com/blueprint/fixture/lockers/application/DeliveryApplicationService.java`
