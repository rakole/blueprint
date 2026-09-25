import type {ReservationService} from "../application/reservation-service.ts";
import type {HttpRequest, HttpResponse} from "../types/http.ts";
import {DomainError} from "../domain/errors.ts";
import {jsonResponse} from "./json-response.js";
import {handleReservationRoute} from "./reservation-routes.ts";

export function routeRequest(request: HttpRequest, service: ReservationService): HttpResponse {
  try {
    const response = handleReservationRoute(request, service);
    return response ?? jsonResponse(404, {error: "route_not_found"});
  } catch (error) {
    if (error instanceof DomainError) {
      const status = error.code === "not_found" ? 404 : error.code === "conflict" ? 409 : 400;
      return jsonResponse(status, {error: error.code, message: error.message});
    }
    return jsonResponse(500, {error: "internal_error"});
  }
}
