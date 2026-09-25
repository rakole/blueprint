# Checkout source records

## File: `src/checkout/cart.ts` {#file-src-checkout-cart-ts}

- Language: TypeScript; role: checkout pricing and coordination.
- Source: [cart.ts](../../../../../src/checkout/cart.ts#L1-L24)
- Symbols:
  - `calculateCartTotal` (lines 9-18), aliases: `cart total`, `basket total`.
  - `CartCoordinator.checkout` (lines 20-23), entrypoint: receipt flow.
- **Production relationship:** imports `formatReceipt` from `receipt.js`.

### `calculateCartTotal` {#symbol-calculateCartTotal}

The function sums integer-cent line amounts and applies a rounded tax rate.
Read the source range above before relying on this generated description.

## File: `src/checkout/receipt.js` {#file-src-checkout-receipt-js}

- Language: JavaScript; role: receipt presentation.
- Source: [receipt.js](../../../../../src/checkout/receipt.js#L1-L3)
- Symbol: `formatReceipt` (lines 1-3).
- Candidate related test: [cart.test.ts](../../../../../tests/checkout/cart.test.ts#L1-L7)
  directly exercises `calculateCartTotal`; it does not construct
  `CartCoordinator` or call `formatReceipt`.
- **No test evidence in the selected inventory:** no direct `formatReceipt`
  test is established.
