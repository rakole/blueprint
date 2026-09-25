export class DispatchRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DispatchRuleError";
  }
}
