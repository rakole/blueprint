import { DispatchRuleError } from "./errors.ts";

export interface FoodBox {
  id: string;
  category: "produce" | "pantry" | "mixed";
  weightKg: number;
}

export function createFoodBox(id: string, category: FoodBox["category"], weightKg: number): FoodBox {
  if (!id.trim() || weightKg <= 0) throw new DispatchRuleError("food boxes need an id and positive weight");
  return {id, category, weightKg};
}
