import {formatReceipt} from "./receipt.js";

export type CartLine = {
  sku: string;
  unitPriceCents: number;
  quantity: number;
};

export function calculateCartTotal(
  lines: readonly CartLine[],
  taxRate: number
): number {
  const subtotal = lines.reduce(
    (total, line) => total + line.unitPriceCents * line.quantity,
    0
  );
  return Math.round(subtotal * (1 + taxRate));
}

export class CartCoordinator {
  checkout(lines: readonly CartLine[], taxRate: number): string {
    return formatReceipt(calculateCartTotal(lines, taxRate));
  }
}
