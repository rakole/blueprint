import type {Tool} from "../domain/tool.ts";
import type {ToolId} from "../types/ids.ts";
import type {ToolRepository} from "./tool-repository.ts";

export class InMemoryToolRepository implements ToolRepository {
  private readonly records: readonly Tool[];

  constructor(records: readonly Tool[]) {
    this.records = records;
  }

  findById(id: ToolId): Tool | undefined {
    return this.records.find((tool) => tool.id === id);
  }
}
