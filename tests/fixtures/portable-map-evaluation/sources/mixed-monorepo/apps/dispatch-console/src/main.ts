import { DispatchService } from "./application/dispatch-service.ts";
import { dispatchRouter } from "./http/dispatch-routes.ts";
import { InMemoryDispatchRepository } from "./persistence/in-memory-dispatch-repository.ts";

export function createApplication() {
  const service = new DispatchService(new InMemoryDispatchRepository());
  return dispatchRouter(service);
}
