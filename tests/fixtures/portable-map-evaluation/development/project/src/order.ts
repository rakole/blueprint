export type Order = { id: string; total: number };

export function applyOrderPolicy(order: Order): boolean {
  return order.total >= 0;
}

export function calculateOrderTotal(items: number[]): number {
  return items.reduce((total, item) => total + item, 0);
}
