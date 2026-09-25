import {ValidationError} from "./errors.ts";
import type {ToolId} from "../types/ids.ts";

export type ToolCondition = "ready" | "maintenance" | "retired";

export class Tool {
  readonly id: ToolId;
  readonly name: string;
  readonly category: string;
  readonly condition: ToolCondition;

  constructor(id: ToolId, name: string, category: string, condition: ToolCondition = "ready") {
    this.id = id;
    this.name = name;
    this.category = category;
    this.condition = condition;
    if (!name.trim() || !category.trim()) {
      throw new ValidationError("tool name and category are required");
    }
  }

  canReserve(): boolean {
    return this.condition === "ready";
  }
}
