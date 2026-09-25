import type { RouteSummary } from "../types.ts";

export function DispatchBoard({routes}: {routes: RouteSummary[]}) {
  return <section aria-label="dispatch board">{routes.map((route) =>
    <article key={`${route.depotCode}-${route.routeDate}`}>
      <h2>{route.depotCode}</h2><p>{route.dispatchIds.length} dispatches · {route.boxCount} boxes</p>
    </article>,
  )}</section>;
}
