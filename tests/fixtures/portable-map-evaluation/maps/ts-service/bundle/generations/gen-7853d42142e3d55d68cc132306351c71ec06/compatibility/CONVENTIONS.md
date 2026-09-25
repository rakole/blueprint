# Conventions

## Purpose

Typed modules use exported type aliases, interfaces, classes and functions with explicit readonly state where appropriate. IDs are branded string types, domain transitions return new Reservation values, and JavaScript helpers remain small named ESM functions.

## Types and state

MemberId, ToolId and ReservationId are branded strings with as*Id constructors. Domain entities expose readonly fields; Reservation keeps private parts and uses confirm/cancel to create updated values rather than mutating its status.

## Validation and naming

Constructors and factories throw typed DomainError subclasses for invalid state; policy errors use ConflictError, missing resources use NotFoundError, and HTTP validation uses ValidationError. Names follow descriptive PascalCase classes and camelCase functions.

## Evidence

- `src/types/ids.ts`
- `src/domain/member.ts`
- `src/domain/tool.ts`
- `src/domain/reservation.ts`
- `src/domain/errors.ts`
- `src/domain/reservation-policy.ts`
- `src/http/reservation-routes.ts`
- `src/adapters/ids.js`
