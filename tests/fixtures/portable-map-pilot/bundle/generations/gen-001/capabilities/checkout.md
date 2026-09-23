# Checkout totals and receipts

## Purpose

The checkout capability turns priced cart lines into a tax-inclusive total and
formats the amount for a receipt. The public vocabulary includes `cart total`
and the alias `basket total`.

## Entry points and flow

- [Cart records](../records/checkout.md#file-src-checkout-cart-ts) contain
  `calculateCartTotal` and `CartCoordinator.checkout`.
- The coordinator passes the calculated cents value to
  [receipt formatting](../records/checkout.md#file-src-checkout-receipt-js).
- [The checkout test](../../../../../tests/checkout/cart.test.ts) exercises the
  total boundary.

## Constraints

- Prices are integer cents and quantities are multiplied before tax.
- The tax result is rounded to integer cents.
- The map records coordinates and relationships; current source verifies them.
