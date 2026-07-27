import { createContext, useContext } from 'react';
import type { AuthenticatedStaff } from '@nugget/shared-types';

export interface AuthContextValue {
  staff: AuthenticatedStaff | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
