export function pathSegments(path) {
  return path.split("/").filter(Boolean);
}

export function reservationRouteFromPath(path) {
  const segments = pathSegments(path);
  if (segments[0] !== "reservations" || (segments.length !== 2 && segments.length !== 3)) {
    return undefined;
  }
  if (segments.length === 2) return {id: segments[1], action: undefined};
  if (segments[2] === "confirm" || segments[2] === "cancel") {
    return {id: segments[1], action: segments[2]};
  }
  return undefined;
}
