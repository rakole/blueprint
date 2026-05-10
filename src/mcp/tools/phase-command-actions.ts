import { blueprintDirectCommand } from "../command-paths.js";

type CommandCatalogResult = {
  commands: Record<string, { implemented: boolean }>;
};

let implementedCommandNamesPromise: Promise<Set<string> | null> | null = null;

export async function getPhasePlanImplementedCommandNames(): Promise<Set<string> | null> {
  if (!implementedCommandNamesPromise) {
    implementedCommandNamesPromise = (async () => {
      try {
        const projectModule = (await import("./project.js")) as {
          blueprintCommandCatalog: () => Promise<CommandCatalogResult>;
        };
        const catalog = await projectModule.blueprintCommandCatalog();
        const implementedCommands = new Set(
          Object.entries(catalog.commands)
            .filter(([, entry]) => entry.implemented)
            .map(([commandName]) => blueprintDirectCommand(commandName).toLowerCase())
        );

        return implementedCommands.size > 0 ? implementedCommands : null;
      } catch {
        return null;
      }
    })();
  }

  return implementedCommandNamesPromise;
}

export function extractBlueprintDirectCommands(value: string): string[] {
  return [
    ...new Set(
      [...value.matchAll(/\/blu-[a-z0-9-]+/gi)].map((match) => match[0].toLowerCase())
    )
  ];
}

export function filterImplementedBlueprintActions(
  actions: string[],
  implementedCommands: ReadonlySet<string>
): string[] {
  return actions.filter((action) =>
    extractBlueprintDirectCommands(action).every((command) =>
      implementedCommands.has(command)
    )
  );
}
