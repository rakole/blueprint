import type {Tool} from "../domain/tool.ts";
import type {ToolId} from "../types/ids.ts";

export interface ToolRepository {
  findById(id: ToolId): Tool | undefined;
}
