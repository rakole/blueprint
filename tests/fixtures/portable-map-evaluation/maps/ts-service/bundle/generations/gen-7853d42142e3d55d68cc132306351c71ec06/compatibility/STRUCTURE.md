# Structure

## Purpose

The tree is organized by domain, application, contracts, HTTP, persistence, adapters, types and UI under src, with focused node:test files under tests. Reservation behavior is represented by a domain aggregate and a service over repository ports.

## Source areas

src/domain defines Member, Tool, Reservation and errors; src/application contains ReservationService; src/persistence contains repository interfaces and in-memory adapters; src/http contains parsing, route handling and response translation; src/contracts and src/types define transport and branded-ID shapes.

## Entrypoints and UI

src/server.ts exposes createService, createDemoService and routeRequest. reservation-form.tsx posts a tool reservation form, while reservation-summary.jsx renders a status label and time range.

## Evidence

- `src/server.ts`
- `src/domain/member.ts`
- `src/domain/tool.ts`
- `src/domain/reservation.ts`
- `src/application/reservation-service.ts`
- `src/persistence/member-repository.ts`
- `src/persistence/reservation-repository.ts`
- `src/persistence/tool-repository.ts`
- `src/ui/reservation-form.tsx`
- `src/ui/reservation-summary.jsx`
- `tests/reservation-service.test.ts`
