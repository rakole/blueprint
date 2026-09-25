import {strict as assert} from "node:assert";
import {calculateCartTotal} from "../../src/checkout/cart.js";

assert.equal(
  calculateCartTotal([{sku: "parcel-kit", unitPriceCents: 1250, quantity: 2}], 0.2),
  3000
);
