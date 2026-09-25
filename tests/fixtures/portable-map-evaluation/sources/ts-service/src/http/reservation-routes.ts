import type {CreateReservationInput} from "../contracts/reservations.ts";
import type {HttpRequest, HttpResponse} from "../types/http.ts";
import type {ReservationService} from "../application/reservation-service.ts";
import {ValidationError} from "../domain/errors.ts";
import {jsonResponse} from "./json-response.js";
import {reservationRouteFromPath} from "./request-parser.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isCreateReservationInput(value: unknown): value is CreateReservationInput {
  return isRecord(value) &&
    isNonEmptyString(value.memberId) &&
    isNonEmptyString(value.toolId) &&
    isNonEmptyString(value.startsAt) &&
    isNonEmptyString(value.endsAt);
}

function parseCreateReservationInput(body: unknown) {
  if (!isCreateReservationInput(body)) {
    throw new ValidationError("request body must include memberId, toolId, startsAt, and endsAt strings");
  }
  return body;
}

export function handleReservationRoute(
  request: HttpRequest,
  service: ReservationService,
): HttpResponse | undefined {
  if (request.method === "POST" && request.path === "/reservations") {
    return jsonResponse(201, service.create(parseCreateReservationInput(request.body)));
  }
  const route = reservationRouteFromPath(request.path);
  if (!route) return undefined;
  if (request.method === "GET" && route.action === undefined) {
    return jsonResponse(200, service.get(route.id));
  }
  if (request.method === "POST" && route.action === "confirm") {
    return jsonResponse(200, service.confirm(route.id));
  }
  if (request.method === "POST" && route.action === "cancel") {
    return jsonResponse(200, service.cancel(route.id));
  }
  return undefined;
}
