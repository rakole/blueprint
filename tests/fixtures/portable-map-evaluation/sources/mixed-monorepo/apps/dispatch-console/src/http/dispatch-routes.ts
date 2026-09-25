import type { DispatchService } from "../application/dispatch-service.ts";
import { readSlotRequest, type HttpRequest } from "./request.ts";
import { json, type HttpResponse } from "./response.ts";
import { Router } from "./router.ts";

export function dispatchRouter(service: DispatchService): Router {
  const router = new Router();
  router.on("POST", "/slots", (request: HttpRequest): HttpResponse => {
    const dispatch = service.create(readSlotRequest(request));
    return json(201, service.toEvent(dispatch));
  });
  router.on("GET", "/routes", (request: HttpRequest): HttpResponse => {
    if (typeof request.body !== "string") return json(400, {error: "route date required"});
    return json(200, service.routeForDate(request.body));
  });
  return router;
}
