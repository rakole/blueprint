export function jsonResponse(status, body) {
  return {
    status,
    headers: {"content-type": "application/json"},
    body,
  };
}
