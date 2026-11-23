export interface SessionUser {
  id: string;
  username: string;
  role: 'admin' | 'user';
}

export interface AccessUser extends SessionUser {
  accessEnabled: boolean;
  createdAt: string;
}

export interface SessionResponse {
  needsSetup: boolean;
  user: SessionUser | null;
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

export function clearLegacyAuthStorage() {
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key) continue;
    if (key === 'isLoggedIn' || key === 'username' || key.startsWith('password_')) {
      keys.push(key);
    }
  }
  keys.forEach((key) => localStorage.removeItem(key));
}

export function getSession() {
  return request<SessionResponse>('/api/auth/session');
}

export function setupAdmin(username: string, password: string) {
  return request<{ user: SessionUser }>('/api/auth/setup', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function login(username: string, password: string) {
  return request<{ user: SessionUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function logout() {
  return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
}

export function listUsers() {
  return request<{ users: AccessUser[] }>('/api/admin/users');
}

export function createUser(username: string, password: string) {
  return request<{ user: AccessUser }>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function updateUser(id: string, changes: { accessEnabled?: boolean; password?: string }) {
  return request<{ user: AccessUser }>(`/api/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
}

export function deleteUser(id: string) {
  return request<{ ok: boolean }>(`/api/admin/users/${id}`, { method: 'DELETE' });
}
