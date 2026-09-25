export interface ConsoleConfig {
  defaultDepot: string;
  dailyBoxLimit: number;
}

export function loadConfig(environment: Record<string, string | undefined> = process.env): ConsoleConfig {
  const dailyBoxLimit = Number(environment.MARKETROUTE_DAILY_BOX_LIMIT ?? "40");
  if (!Number.isInteger(dailyBoxLimit) || dailyBoxLimit < 1) {
    throw new Error("MARKETROUTE_DAILY_BOX_LIMIT must be a positive integer");
  }
  return {
    defaultDepot: environment.MARKETROUTE_DEFAULT_DEPOT ?? "NORTH-01",
    dailyBoxLimit,
  };
}
