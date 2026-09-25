export type ServiceConfig = {
  port: number;
  reservationHorizonDays: number;
};

export function loadConfig(env: Record<string, string | undefined>): ServiceConfig {
  const port = Number(env.PORT ?? "8080");
  const reservationHorizonDays = Number(env.RESERVATION_HORIZON_DAYS ?? "7");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  if (!Number.isInteger(reservationHorizonDays) || reservationHorizonDays < 1 || reservationHorizonDays > 30) {
    throw new Error("RESERVATION_HORIZON_DAYS must be an integer between 1 and 30");
  }
  return {port, reservationHorizonDays};
}
