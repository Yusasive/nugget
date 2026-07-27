import type { AuthTokens, AuthenticatedStaff } from '@nugget/shared-types';

const ACCESS_TOKEN_KEY = 'nugget.accessToken';
const REFRESH_TOKEN_KEY = 'nugget.refreshToken';
const STAFF_KEY = 'nugget.staff';

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),

  getStaff(): AuthenticatedStaff | null {
    const raw = localStorage.getItem(STAFF_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthenticatedStaff;
    } catch {
      return null;
    }
  },

  setTokens(tokens: AuthTokens) {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  },

  setStaff(staff: AuthenticatedStaff) {
    localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
  },

  clear() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(STAFF_KEY);
  },
};
