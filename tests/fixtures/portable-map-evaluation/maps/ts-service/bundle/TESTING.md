# Testing

## Purpose

The fixture uses node:test with three focused suites for configuration, application behavior and routing. Tests cover creation, confirmation, overlap rejection, cancellation reuse, HTTP status/body translation, malformed request bodies and unknown paths; README also documents a no-listener test baseline and a strict TypeScript noEmit check.

## Application cases

reservation-service.test.ts fixes the clock and ID sequence, then verifies held-to-confirmed transitions, overlapping tool rejection and cancellation releasing a time window.

## HTTP and configuration cases

router.test.ts exercises POST/GET/confirm routes, stable 404 and 400 JSON errors, unknown nested paths and /health; config.test.ts checks defaults and invalid PORT rejection.

## Evidence

- `tests/config.test.ts`
- `tests/reservation-service.test.ts`
- `tests/router.test.ts`
- `README.md`
- `package.json`
