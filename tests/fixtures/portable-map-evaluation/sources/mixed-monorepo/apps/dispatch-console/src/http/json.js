export function parseJsonBody(text) {
  try { return {ok: true, value: JSON.parse(text)}; }
  catch { return {ok: false, value: {error: "invalid json"}}; }
}
