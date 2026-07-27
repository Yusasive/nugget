import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { AttendanceDto, DepartmentDto, PaginatedResponse } from '@nugget/shared-types';
import { useAuth } from '../auth/auth-context';
import { Pagination } from '../components/Pagination';
import { api, ApiError } from '../lib/api-client';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** PRD §5.13: every staff member clocks themselves in/out here; a Branch
 * Manager (or Super Admin) additionally sees the day's roster below,
 * attributed to departments (M11's DoD). */
export function AttendancePage() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canViewRoster = staff?.role === 'SUPER_ADMIN' || staff?.role === 'BRANCH_MANAGER';

  const [clockMessage, setClockMessage] = useState<string | null>(null);
  const [clockError, setClockError] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(1);

  const clockIn = useMutation({
    mutationFn: () => api.post<AttendanceDto>('/attendance/clock-in'),
    onSuccess: (attendance) => {
      setClockError(null);
      setClockMessage(`Clocked in at ${new Date(attendance.clockIn).toLocaleTimeString()}`);
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (err: unknown) => {
      setClockMessage(null);
      setClockError(err instanceof ApiError ? err.message : 'Could not clock in');
    },
  });

  const clockOut = useMutation({
    mutationFn: () => api.post<AttendanceDto>('/attendance/clock-out'),
    onSuccess: (attendance) => {
      setClockError(null);
      setClockMessage(
        `Clocked out at ${attendance.clockOut ? new Date(attendance.clockOut).toLocaleTimeString() : ''}`,
      );
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (err: unknown) => {
      setClockMessage(null);
      setClockError(err instanceof ApiError ? err.message : 'Could not clock out');
    },
  });

  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get<DepartmentDto[]>('/departments'),
    enabled: canViewRoster,
  });

  const roster = useQuery({
    queryKey: ['attendance', page, date, departmentId],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), date });
      if (departmentId) params.set('departmentId', departmentId);
      return api.get<PaginatedResponse<AttendanceDto>>(`/attendance?${params}`);
    },
    enabled: canViewRoster,
  });

  return (
    <>
      <div className="page-header">
        <h2>Attendance</h2>
      </div>

      {clockError && (
        <div className="alert error" role="alert">
          {clockError}
        </div>
      )}
      {clockMessage && <div className="alert success" role="status">{clockMessage}</div>}

      <div className="form-card" style={{ marginBottom: 'var(--gutter)' }}>
        <button type="button" className="btn-primary" onClick={() => clockIn.mutate()} disabled={clockIn.isPending}>
          {clockIn.isPending ? 'Clocking in…' : 'Clock in'}
        </button>{' '}
        <button type="button" className="btn-primary" onClick={() => clockOut.mutate()} disabled={clockOut.isPending}>
          {clockOut.isPending ? 'Clocking out…' : 'Clock out'}
        </button>
      </div>

      {canViewRoster && (
        <>
          <h3>Day's roster</h3>
          <div className="filter-bar">
            <div className="field">
              <label htmlFor="att-date">Date</label>
              <input
                id="att-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="att-department">Department</label>
              <select
                id="att-department"
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All departments</option>
                {departments.data?.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {roster.isPending && <p className="muted">Loading attendance…</p>}
          {roster.isError && <div className="alert error">Could not load attendance.</div>}

          {roster.data && (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Department</th>
                      <th>Clock in</th>
                      <th>Clock out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.data.data.length === 0 && (
                      <tr>
                        <td colSpan={4} className="muted">
                          No attendance records for this day.
                        </td>
                      </tr>
                    )}
                    {roster.data.data.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          {entry.staff.firstName} {entry.staff.lastName}
                        </td>
                        <td className="muted">{entry.department?.name ?? '—'}</td>
                        <td>{new Date(entry.clockIn).toLocaleTimeString()}</td>
                        <td>
                          {entry.clockOut ? (
                            new Date(entry.clockOut).toLocaleTimeString()
                          ) : (
                            <span className="pill info">Clocked in</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={roster.data.page}
                totalPages={roster.data.totalPages}
                total={roster.data.total}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
