import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { busyTracker } from './busy';

const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');

export function getAuthToken(): string | null {
  return sessionStorage.getItem('stf_auth_token');
}

export function setAuthToken(token: string): void {
  sessionStorage.setItem('stf_auth_token', token);
}

export function clearAuthToken(): void {
  sessionStorage.removeItem('stf_auth_token');
  sessionStorage.removeItem('stf_auth_user');
  sessionStorage.removeItem('stf_impersonator_token');
}

const client = axios.create({
  baseURL: API_BASE,
  timeout: 30_000,
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

const WRITE_METHODS = ['post', 'put', 'patch', 'delete'];

type TrackedConfig = InternalAxiosRequestConfig & {
  __busyKind?: 'read' | 'write';
  __busyLabel?: string;
};

function busyKindOf(config: TrackedConfig): 'read' | 'write' {
  return WRITE_METHODS.includes((config.method || 'get').toLowerCase()) ? 'write' : 'read';
}

function busyLabelOf(config: TrackedConfig): string {
  if (config.__busyLabel) return config.__busyLabel;
  const method = (config.method || 'get').toLowerCase();
  if (method === 'delete') return 'Deleting…';
  if (method === 'post' || method === 'put' || method === 'patch') return 'Saving…';
  return 'Loading…';
}

client.interceptors.request.use(config => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const tracked = config as TrackedConfig;
  tracked.__busyKind = busyKindOf(tracked);
  tracked.__busyLabel = busyLabelOf(tracked);
  busyTracker.start(tracked.__busyKind, tracked.__busyLabel);
  return config;
});

function releaseBusy(config?: TrackedConfig): void {
  if (!config?.__busyKind) return;
  busyTracker.finish(config.__busyKind, config.__busyLabel);
  config.__busyKind = undefined;
}

client.interceptors.response.use(
  response => {
    releaseBusy(response.config as TrackedConfig);
    return response;
  },
  error => {
    if (axios.isAxiosError(error)) {
      releaseBusy(error.config as TrackedConfig);
      if (error.response?.status === 401) {
        clearAuthToken();
        window.dispatchEvent(new CustomEvent('stf:unauthorized'));
      }
    }
    return Promise.reject(error);
  },
);

function apiError(error: unknown, fallback = 'The server request failed.'): Error {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error : new Error(fallback);
  }
  const payload = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
  const validation = payload?.errors
    ? Object.values(payload.errors).flat().join(' ')
    : '';
  if (error.response?.status === 401) {
    return new Error('Your session has expired. Please sign in again.');
  }
  return new Error(validation || payload?.message || error.message || fallback);
}

function parseBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

export async function apiRequest<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const config: AxiosRequestConfig = {
    url: path,
    method: (options.method || 'GET').toLowerCase(),
    data: parseBody(options.body),
    headers: options.headers ? Object.fromEntries(new Headers(options.headers).entries()) : undefined,
    signal: options.signal ?? undefined,
  };
  try {
    const response = await client.request<T>(config);
    return response.data;
  } catch (error) {
    throw apiError(error);
  }
}

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export async function apiDownload(path: string): Promise<void> {
  try {
    const response = await client.get<Blob>(path, { responseType: 'blob' });
    const disposition = response.headers['content-disposition'] || '';
    const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'trust-group-report';
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    if (error instanceof AxiosError && error.response?.data instanceof Blob) {
      const text = await error.response.data.text();
      try {
        const payload = JSON.parse(text) as { message?: string };
        throw new Error(payload.message || 'Export failed.');
      } catch (parseError) {
        if (parseError instanceof SyntaxError) throw apiError(error, 'Export failed.');
        throw parseError;
      }
    }
    throw apiError(error, 'Export failed.');
  }
}

export async function apiMultipart<T = unknown>(path: string, form: FormData): Promise<T> {
  try {
    const response = await client.post<T>(path, form);
    return response.data;
  } catch (error) {
    throw apiError(error, 'Upload failed.');
  }
}

export async function apiBlobUrl(path: string): Promise<string> {
  try {
    const response = await client.get<Blob>(path, { responseType: 'blob' });
    return URL.createObjectURL(response.data);
  } catch (error) {
    throw apiError(error, 'Unable to open the file.');
  }
}
