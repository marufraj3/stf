import { apiRequest, clearAuthToken, getAuthToken, setAuthToken } from './api';
import { User } from '../types';

export function hasSession(): boolean {
  return Boolean(getAuthToken());
}

export function getSessionUser(): User | null {
  try {
    const raw = sessionStorage.getItem('stf_auth_user');
    return raw ? JSON.parse(raw) as User : null;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<User> {
  const payload = await apiRequest<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(payload.token);
  sessionStorage.setItem('stf_auth_user', JSON.stringify(payload.user));
  return payload.user;
}

export async function logout(): Promise<void> {
  if (getAuthToken()) {
    await apiRequest('/auth/logout', { method: 'POST' }).catch(() => undefined);
  }
  clearAuthToken();
}
