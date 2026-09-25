export type HttpRequest = {
  method: string;
  path: string;
  body?: unknown;
};

export type HttpResponse = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};
