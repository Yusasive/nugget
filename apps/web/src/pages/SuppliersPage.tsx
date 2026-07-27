import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { PaginatedResponse, SupplierDto } from '@nugget/shared-types';
import { useAuth } from '../auth/auth-context';
import { Drawer } from '../components/Drawer';
import { Pagination } from '../components/Pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { api, ApiError } from '../lib/api-client';

const EMPTY_FORM = { name: '', phone: '', contactNotes: '' };
const EMPTY_FILTERS = { search: '', isActive: '' };

/** PRD §5.10 supplier management. */
export function SuppliersPage() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canManage =
    staff?.role === 'SUPER_ADMIN' || staff?.role === 'BRANCH_MANAGER' || staff?.role === 'RESTAURANT_STAFF';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const debouncedSearch = useDebouncedValue(filters.search);
  const [page, setPage] = useState(1);

  const suppliers = useQuery({
    queryKey: ['suppliers', page, debouncedSearch, filters.isActive],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filters.isActive) params.set('isActive', filters.isActive);
      return api.get<PaginatedResponse<SupplierDto>>(`/suppliers?${params}`);
    },
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<SupplierDto>('/suppliers', {
        branchId: staff?.branchId,
        name: form.name,
        phone: form.phone || undefined,
        contactNotes: form.contactNotes || undefined,
      }),
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Could not create supplier'),
  });

  const toggleActive = useMutation({
    mutationFn: (supplier: SupplierDto) =>
      api.patch<SupplierDto>(`/suppliers/${supplier.id}`, { isActive: !supplier.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
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

  function updateFilter(patch: Partial<typeof filters>) {
    setFilters({ ...filters, ...patch });
    setPage(1);
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  return (
    <>
      <div className="page-header">
        <h2>Suppliers</h2>
        {canManage && (
          <button type="button" className="btn-primary" onClick={() => setDrawerOpen(true)}>
            Add supplier
          </button>
        )}
      </div>

      {canManage && (
        <Drawer open={drawerOpen} title="Add supplier" onClose={closeDrawer}>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <form className="form-card" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="sup-name">Name</label>
              <input
                id="sup-name"
                required
                minLength={2}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="sup-phone">Phone (optional)</label>
              <input
                id="sup-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="sup-notes">Contact notes (optional)</label>
              <input
                id="sup-notes"
                value={form.contactNotes}
                onChange={(e) => setForm({ ...form, contactNotes: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Adding…' : 'Add supplier'}
            </button>
          </form>
        </Drawer>
      )}

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="sup-search">Search</label>
          <input
            id="sup-search"
            placeholder="Name…"
            value={filters.search}
            onChange={(e) => updateFilter({ search: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="sup-filter-status">Status</label>
          <select
            id="sup-filter-status"
            value={filters.isActive}
            onChange={(e) => updateFilter({ isActive: e.target.value })}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        {hasActiveFilters && (
          <div className="field clear-filters">
            <label>&nbsp;</label>
            <button type="button" className="btn-link" onClick={() => updateFilter(EMPTY_FILTERS)}>
              Clear filters
            </button>
          </div>
        )}
      </div>

      {suppliers.isPending && <p className="muted">Loading suppliers…</p>}
      {suppliers.isError && <div className="alert error">Could not load suppliers.</div>}

      {suppliers.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Status</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {suppliers.data.data.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 4 : 3} className="muted">
                      No suppliers match these filters.
                    </td>
                  </tr>
                )}
                {suppliers.data.data.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>{supplier.name}</td>
                    <td className="muted">{supplier.phone ?? '—'}</td>
                    <td>
                      <span className={`pill ${supplier.isActive ? 'success' : 'error'}`}>
                        {supplier.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canManage && (
                      <td>
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => toggleActive.mutate(supplier)}
                          disabled={toggleActive.isPending}
                        >
                          {supplier.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={suppliers.data.page}
            totalPages={suppliers.data.totalPages}
            total={suppliers.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
