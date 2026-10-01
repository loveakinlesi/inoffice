import type { Entries, Settings, Status } from './types.ts';

export interface AccountData { settings: Settings | null; entries: Entries }

/** The request never reached the server (offline, DNS, CORS); distinct from an HTTP error. */
export class NetworkError extends Error {
  constructor() { super('You appear to be offline. Check your connection and try again.'); }
}

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...rest,
      credentials: 'same-origin',
      headers: json === undefined ? rest.headers : { 'content-type': 'application/json', ...rest.headers },
      body: json === undefined ? rest.body : JSON.stringify(json),
    });
  } catch {
    throw new NetworkError();
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new ApiError(response.status, body?.error ?? 'Something went wrong. Please try again.');
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const api = {
  getData: () => request<AccountData>('/data'),
  saveSettings: (settings: Settings) => request<{ settings: Settings }>('/settings', { method: 'PUT', json: settings }),
  setEntry: (date: string, status: Status) => request('/entries/' + date, { method: 'PUT', json: { status } }),
  deleteEntry: (date: string) => request('/entries/' + date, { method: 'DELETE' }),
  resetMonth: (month: string) => request(`/entries?month=${month}`, { method: 'DELETE' }),
  importData: (mode: 'merge' | 'replace', data: { settings: Settings | null; entries: Entries }) =>
    request('/import', { method: 'POST', json: { mode, ...data } }),
  deleteData: () => request('/data', { method: 'DELETE' }),
};
