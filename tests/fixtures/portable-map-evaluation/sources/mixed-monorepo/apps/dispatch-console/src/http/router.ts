import type { HttpRequest } from "./request.ts";
import type { HttpResponse } from "./response.ts";

type Handler = (request: HttpRequest) => HttpResponse;

export class Router {
  private readonly handlers = new Map<string, Handler>();
  on(method: string, path: string, handler: Handler): void { this.handlers.set(`${method}:${path}`, handler); }
  handle(request: HttpRequest): HttpResponse {
    return this.handlers.get(`${request.method}:${request.path}`)?.(request) ?? {status: 404, body: {error: "not found"}};
  }
}
