import type { AuthTokens } from '@nugget/shared-types';
import { tokenStorage } from './token-storage';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const BASE = `${API_URL}/api/v1`;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Set by AuthProvider so a failed refresh can drop the app back to the login screen. */
let onAuthFailure: (() => void) | null = null;
export function setAuthFailureHandler(handler: () => void) {
  onAuthFailure = handler;
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(', ');
    if (body.message) return body.message;
  } catch {
    /* fall through to the generic message below */
  }
  return res.statusText || 'Request failed';
}

async function rawRequest(path: string, init: RequestInit, accessToken: string | null) {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
}

/**
 * Refreshes once on a 401 and replays the original request. A single shared
 * promise means N concurrent 401s trigger one refresh, not N — otherwise
 * parallel requests would rotate each other's refresh tokens and cascade
 * into a spurious logout.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return false;

  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) return false;
  tokenStorage.setTokens((await res.json()) as AuthTokens);
  return true;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await rawRequest(path, init, tokenStorage.getAccessToken());

  if (res.status === 401 && tokenStorage.getRefreshToken()) {
    refreshInFlight ??= refreshTokens().finally(() => {
      refreshInFlight = null;
    });

    if (await refreshInFlight) {
      res = await rawRequest(path, init, tokenStorage.getAccessToken());
    } else {
      tokenStorage.clear();
      onAuthFailure?.();
      throw new ApiError(401, 'Session expired, please sign in again');
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res));
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
};

/**
 * PDF endpoints need the Authorization header a plain `<a href>` can't send,
 * so this fetches the file as a blob and triggers the browser's normal
 * save-file flow via a throwaway object URL.
 */
export async function downloadAuthenticatedFile(
  path: string,
  fallbackFilename: string,
): Promise<void> {
  let res = await rawRequest(path, {}, tokenStorage.getAccessToken());

  if (res.status === 401 && tokenStorage.getRefreshToken()) {
    refreshInFlight ??= refreshTokens().finally(() => {
      refreshInFlight = null;
    });
    if (await refreshInFlight) {
      res = await rawRequest(path, {}, tokenStorage.getAccessToken());
    } else {
      tokenStorage.clear();
      onAuthFailure?.();
      throw new ApiError(401, 'Session expired, please sign in again');
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res));
  }

  const disposition = res.headers.get('Content-Disposition');
  const filenameMatch = disposition?.match(/filename="([^"]+)"/);
  const filename = filenameMatch?.[1] ?? fallbackFilename;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
