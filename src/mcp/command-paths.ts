export const BLUEPRINT_ROOT_COMMAND = "/blu" as const;
export const BLUEPRINT_ROOT_COMMAND_MANIFEST = "commands/blu.toml" as const;
export const BLUEPRINT_DIRECT_COMMAND_PREFIX = "/blu-" as const;
export const BLUEPRINT_ROUTER_COMMAND_SEPARATOR = " " as const;

export function blueprintRootCommand(): typeof BLUEPRINT_ROOT_COMMAND {
  return BLUEPRINT_ROOT_COMMAND;
}

export function blueprintDirectCommand(commandName: string): `/blu-${string}` {
  return `${BLUEPRINT_DIRECT_COMMAND_PREFIX}${commandName}`;
}

export function blueprintRouterCommand(commandName?: string): string {
  return commandName
    ? `${BLUEPRINT_ROOT_COMMAND}${BLUEPRINT_ROUTER_COMMAND_SEPARATOR}${commandName}`
    : BLUEPRINT_ROOT_COMMAND;
}

export function blueprintRunCommand(command: string, args?: string | null): string {
  const suffix = args && args.trim().length > 0 ? ` ${args.trim()}` : "";
  return `Run ${command}${suffix}`;
}

export function blueprintRunDirectCommand(commandName: string, args?: string | null): string {
  return blueprintRunCommand(blueprintDirectCommand(commandName), args);
}

export function blueprintPrimaryManifestPath(commandName: string): string {
  return `commands/blu-${commandName}.toml`;
}

export function blueprintDirectCommandAliases(commandName: string): string[] {
  return [blueprintRouterCommand(commandName)];
}
