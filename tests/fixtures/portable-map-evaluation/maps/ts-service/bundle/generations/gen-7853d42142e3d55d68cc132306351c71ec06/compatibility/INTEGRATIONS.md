# Integrations

## Purpose

The runtime integration surface is intentionally local: HTTP-shaped request/response records feed the router, repositories provide member/tool/reservation access, and adapters supply a system clock and random UUID IDs. The UI form posts to /reservations and the summary consumes ReservationView-like status and timestamps.

## Injected ports

ReservationService receives MemberRepository, ToolRepository, ReservationRepository, now and nextId dependencies. The server binds the three in-memory repositories, systemClock and newReservationId; no external package or network client is used by the fixture runtime.

## Presentation boundary

HTTP responses carry application/json bodies. reservation-form.tsx submits startsAt and endsAt fields with a tool data attribute, while reservation-summary.jsx displays Cancelled or Reserved from reservation.status.

## Evidence

- `src/application/reservation-service.ts`
- `src/persistence/member-repository.ts`
- `src/persistence/reservation-repository.ts`
- `src/persistence/tool-repository.ts`
- `src/server.ts`
- `src/adapters/system-clock.js`
- `src/adapters/ids.js`
- `src/http/json-response.js`
- `src/types/http.ts`
- `src/ui/reservation-form.tsx`
- `src/ui/reservation-summary.jsx`
