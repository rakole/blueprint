export function formatReceipt(totalCents) {
  return `Total: ${(totalCents / 100).toFixed(2)}`;
}
