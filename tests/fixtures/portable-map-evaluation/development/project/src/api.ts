import { applyOrderPolicy, calculateOrderTotal } from "./order.js";

export function createOrder(items: number[]) {
  const order = { id: "fixture-order", total: calculateOrderTotal(items) };
  return applyOrderPolicy(order) ? order : null;
}
