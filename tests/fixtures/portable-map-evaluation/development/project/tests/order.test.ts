import { applyOrderPolicy, calculateOrderTotal } from "../src/order.js";

test("applies the order policy", () => {
  expect(applyOrderPolicy({ id: "one", total: 3 })).toBe(true);
  expect(calculateOrderTotal([1, 2])).toBe(3);
});
