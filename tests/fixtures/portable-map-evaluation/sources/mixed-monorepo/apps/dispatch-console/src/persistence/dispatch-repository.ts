import type { Dispatch } from "../types.ts";

export interface DispatchRepository {
  save(dispatch: Dispatch): void;
  findByDate(routeDate: string): Dispatch[];
  findById(id: string): Dispatch | undefined;
}
