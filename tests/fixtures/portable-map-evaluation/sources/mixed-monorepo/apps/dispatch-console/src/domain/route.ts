import type { Dispatch, RouteSummary } from "../types.ts";

export function summarizeRoute(dispatches: Dispatch[]): RouteSummary[] {
  const groups = new Map<string, RouteSummary>();
  for (const dispatch of dispatches) {
    const key = `${dispatch.depotCode}:${dispatch.routeDate}`;
    const current = groups.get(key) ?? {
      depotCode: dispatch.depotCode,
      routeDate: dispatch.routeDate,
      dispatchIds: [],
      boxCount: 0,
    };
    current.dispatchIds.push(dispatch.id);
    current.boxCount += dispatch.boxCount;
    groups.set(key, current);
  }
  return [...groups.values()].sort((left, right) =>
    `${left.routeDate}:${left.depotCode}`.localeCompare(`${right.routeDate}:${right.depotCode}`),
  );
}
