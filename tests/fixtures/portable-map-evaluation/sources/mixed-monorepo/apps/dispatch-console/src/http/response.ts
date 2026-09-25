export interface HttpResponse { status: number; body: unknown; }

export const json = (status: number, body: unknown): HttpResponse => ({status, body});
