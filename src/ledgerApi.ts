import { UserLedger } from './expenses';

export interface RemoteLedger extends UserLedger {
  stored: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body
      ? { 'Content-Type': 'application/json', ...init.headers }
      : init?.headers,
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(body.error || 'Request failed.');
  }
  return body as T;
}

export function getLedger() {
  return request<RemoteLedger>('/api/ledger');
}

export function saveLedger(ledger: UserLedger) {
  return request<{ ok: boolean }>('/api/ledger', {
    method: 'PUT',
    body: JSON.stringify(ledger),
  });
}
