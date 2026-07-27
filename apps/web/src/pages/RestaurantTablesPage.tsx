import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type {
  PaginatedResponse,
  RestaurantTableDto,
  RestaurantTableStatus,
} from '@nugget/shared-types';
import { useAuth } from '../auth/auth-context';
import { Drawer } from '../components/Drawer';
import { Pagination } from '../components/Pagination';
import { api, ApiError } from '../lib/api-client';

const POLL_INTERVAL_MS = 5000;

const STATUS_PILL: Record<RestaurantTableStatus, string> = {
  FREE: 'success',
  OCCUPIED: 'info',
  RESERVED: 'warning',
  NEEDS_CLEANING: 'warning',
};

const STATUS_LABEL: Record<RestaurantTableStatus, string> = {
  FREE: 'Free',
  OCCUPIED: 'Occupied',
  RESERVED: 'Reserved',
  NEEDS_CLEANING: 'Needs cleaning',
};

const EMPTY_FORM = { tableNumber: '', capacity: '2' };

/** PRD §5.9 table management — the same "same visual language as the room
 * status board" pattern from ui-ux.md §7 (7.), so staff who know one board
 * read the other instantly. Status is a stored field here (see schema.prisma
 * doc comment), not computed, but the live-polling/flash treatment matches
 * FrontDeskPage exactly. */
export function RestaurantTablesPage() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canManage =
    staff?.role === 'SUPER_ADMIN' || staff?.role === 'BRANCH_MANAGER' || staff?.role === 'RESTAURANT_STAFF';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const tables = useQuery({
    queryKey: ['restaurant-tables', page],
    queryFn: () => api.get<PaginatedResponse<RestaurantTableDto>>(`/restaurant-tables?page=${page}`),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<RestaurantTableDto>('/restaurant-tables', {
        branchId: staff?.branchId,
        tableNumber: form.tableNumber,
        capacity: Number(form.capacity),
      }),
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Could not create table'),
  });

  const setStatus = useMutation({
    mutationFn: ({ table, status }: { table: RestaurantTableDto; status: RestaurantTableStatus }) =>
      api.patch<RestaurantTableDto>(`/restaurant-tables/${table.id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] }),
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
        <h2>Tables</h2>
        {canManage && (
          <button type="button" className="btn-primary" onClick={() => setDrawerOpen(true)}>
            Add table
          </button>
        )}
      </div>

      {canManage && (
        <Drawer open={drawerOpen} title="Add table" onClose={closeDrawer}>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <form className="form-card" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="rt-number">Table number</label>
              <input
                id="rt-number"
                required
                value={form.tableNumber}
                onChange={(e) => setForm({ ...form, tableNumber: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="rt-capacity">Capacity</label>
              <input
                id="rt-capacity"
                type="number"
                min={1}
                required
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Adding…' : 'Add table'}
            </button>
          </form>
        </Drawer>
      )}

      {tables.isPending && <p className="muted">Loading tables…</p>}
      {tables.isError && <div className="alert error">Could not load tables.</div>}

      {tables.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Capacity</th>
                  <th>Status</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {tables.data.data.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 4 : 3} className="muted">
                      No tables yet.
                    </td>
                  </tr>
                )}
                {tables.data.data.map((table) => (
                  <tr key={table.id}>
                    <td>{table.tableNumber}</td>
                    <td>{table.capacity}</td>
                    <td>
                      <span className={`pill ${STATUS_PILL[table.status]}`}>{STATUS_LABEL[table.status]}</span>
                    </td>
                    {canManage && (
                      <td style={{ display: 'flex', gap: 'calc(var(--space) * 1.5)' }}>
                        {table.status !== 'OCCUPIED' && table.status !== 'FREE' && (
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => setStatus.mutate({ table, status: 'FREE' })}
                            disabled={setStatus.isPending}
                          >
                            Mark free
                          </button>
                        )}
                        {table.status === 'FREE' && (
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => setStatus.mutate({ table, status: 'RESERVED' })}
                            disabled={setStatus.isPending}
                          >
                            Reserve
                          </button>
                        )}
                        {table.status !== 'NEEDS_CLEANING' && table.status !== 'OCCUPIED' && (
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => setStatus.mutate({ table, status: 'NEEDS_CLEANING' })}
                            disabled={setStatus.isPending}
                          >
                            Needs cleaning
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={tables.data.page}
            totalPages={tables.data.totalPages}
            total={tables.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
