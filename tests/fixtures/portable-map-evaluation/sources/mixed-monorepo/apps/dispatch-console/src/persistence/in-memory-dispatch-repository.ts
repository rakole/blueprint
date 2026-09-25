import type { Dispatch } from "../types.ts";
import type { DispatchRepository } from "./dispatch-repository.ts";

export class InMemoryDispatchRepository implements DispatchRepository {
  private readonly dispatches = new Map<string, Dispatch>();

  save(dispatch: Dispatch): void { this.dispatches.set(dispatch.id, dispatch); }

  findByDate(routeDate: string): Dispatch[] {
    return [...this.dispatches.values()].filter((dispatch) => dispatch.routeDate === routeDate);
  }

  findById(id: string): Dispatch | undefined { return this.dispatches.get(id); }
}
