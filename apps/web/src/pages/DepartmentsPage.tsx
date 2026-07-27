import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { DepartmentDto } from '@nugget/shared-types';
import { useAuth } from '../auth/auth-context';
import { Drawer } from '../components/Drawer';
import { api, ApiError } from '../lib/api-client';

const EMPTY_FORM = { name: '' };

/** PRD §5.13 department CRUD — staff-to-department assignment itself
 * happens on StaffPage's create/edit form (Staff.departmentId), the same
 * split BranchesPage/RoomTypesPage already use between "manage the
 * catalog" and "assign to it". */
export function DepartmentsPage() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canManage = staff?.role === 'SUPER_ADMIN';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get<DepartmentDto[]>('/departments'),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<DepartmentDto>('/departments', {
        branchId: staff?.branchId,
        name: form.name,
      }),
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Could not create department'),
  });

  const toggleActive = useMutation({
    mutationFn: (department: DepartmentDto) =>
      api.patch<DepartmentDto>(`/departments/${department.id}`, {
        isActive: !department.isActive,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });

  function closeDrawer() {
    setDrawerOpen(false);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <>
      <div className="page-header">
        <h2>Departments</h2>
        {canManage && (
          <button type="button" className="btn-primary" onClick={() => setDrawerOpen(true)}>
            Add department
          </button>
        )}
      </div>

      {canManage && (
        <Drawer open={drawerOpen} title="Add department" onClose={closeDrawer}>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <form className="form-card" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="dept-name">Name</label>
              <input
                id="dept-name"
                required
                minLength={2}
                placeholder="e.g. Front Office"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Adding…' : 'Add department'}
            </button>
          </form>
        </Drawer>
      )}

      {departments.isPending && <p className="muted">Loading departments…</p>}
      {departments.isError && <div className="alert error">Could not load departments.</div>}

      {departments.data && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {departments.data.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 3 : 2} className="muted">
                    No departments yet.
                  </td>
                </tr>
              )}
              {departments.data.map((department) => (
                <tr key={department.id}>
                  <td>{department.name}</td>
                  <td>
                    <span className={`pill ${department.isActive ? 'success' : 'error'}`}>
                      {department.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canManage && (
                    <td>
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => toggleActive.mutate(department)}
                        disabled={toggleActive.isPending}
                      >
                        {department.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
