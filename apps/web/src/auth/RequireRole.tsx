import { Navigate } from 'react-router-dom';
import type { StaffRoleName } from '@nugget/shared-types';
import { useAuth } from './auth-context';

/**
 * Client-side routing convenience only. The API rejects unauthorized calls
 * regardless (PRD §5.15) — this just avoids rendering a screen that would
 * only fill with 403s.
 */
export function RequireRole({
  roles,
  children,
}: {
  roles: StaffRoleName[];
  children: React.ReactNode;
}) {
  const { staff } = useAuth();
  if (!staff) return <Navigate to="/" replace />;
  return roles.includes(staff.role) ? <>{children}</> : <Navigate to="/" replace />;
}
