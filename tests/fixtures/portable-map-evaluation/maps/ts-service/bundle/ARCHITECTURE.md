# Architecture

## Purpose

Requests flow from routeRequest through reservation-routes and the ReservationService into domain validation and repository lookups, then return JSON responses. createService composes the service with in-memory repositories, a system clock and UUID-backed IDs.

## Request flow

POST /reservations validates a body before calling service.create; GET /reservations/:id reads a view; POST /reservations/:id/confirm and /cancel apply state transitions. Unknown reservation paths return route_not_found through the router.

## Layer boundaries

ReservationService owns orchestration and dependency injection. Reservation, Member, Tool and reservation-policy enforce domain behavior; repository interfaces abstract lookups/saves while the current server wiring selects in-memory implementations.

## Evidence

- `src/http/router.ts`
- `src/http/reservation-routes.ts`
- `src/http/request-parser.js`
- `src/application/reservation-service.ts`
- `src/domain/reservation.ts`
- `src/domain/reservation-policy.ts`
- `src/server.ts`
- `src/persistence/in-memory-reservation-repository.ts`
