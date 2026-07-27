import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthenticatedStaff, LoginResponse } from '@nugget/shared-types';
import { api, setAuthFailureHandler } from '../lib/api-client';
import { tokenStorage } from '../lib/token-storage';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<AuthenticatedStaff | null>(() => tokenStorage.getStaff());

  useEffect(() => {
    setAuthFailureHandler(() => setStaff(null));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<LoginResponse>('/auth/login', { email, password });
    tokenStorage.setTokens(res);
    tokenStorage.setStaff(res.staff);
    setStaff(res.staff);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    if (refreshToken) {
      // Best-effort server-side revocation; the local session is cleared either way.
      await api.post('/auth/logout', { refreshToken }).catch(() => undefined);
    }
    tokenStorage.clear();
    setStaff(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ staff, login, logout }), [staff, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
