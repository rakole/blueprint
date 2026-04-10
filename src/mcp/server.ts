import { pathToFileURL } from "node:url";

export async function startServer(): Promise<void> {
  process.stderr.write(
    "Blueprint MCP server bootstrap is not implemented yet. Phase 1 Wave 2 will register the tool surface.\n"
  );
}

const entrypoint = process.argv[1];

if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  await startServer();
}
