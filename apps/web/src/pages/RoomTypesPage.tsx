import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { BranchDto, PaginatedResponse, RoomTypeDto } from '@nugget/shared-types';
import { useAuth } from '../auth/auth-context';
import { Drawer } from '../components/Drawer';
import { Pagination } from '../components/Pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { api, ApiError } from '../lib/api-client';

const EMPTY_FORM = { branchId: '', name: '', description: '', maxOccupancy: '2', amenities: '' };
const EMPTY_FILTERS = { search: '', isActive: '' };

export function RoomTypesPage() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canManage = staff?.role === 'SUPER_ADMIN' || staff?.role === 'BRANCH_MANAGER';
  const isSuperAdmin = staff?.role === 'SUPER_ADMIN';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const debouncedSearch = useDebouncedValue(filters.search);
  const [page, setPage] = useState(1);

  const roomTypes = useQuery({
    queryKey: ['room-types', page, debouncedSearch, filters.isActive],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filters.isActive) params.set('isActive', filters.isActive);
      return api.get<PaginatedResponse<RoomTypeDto>>(`/room-types?${params}`);
    },
  });

  const branches = useQuery({
    queryKey: ['branches', 'all'],
    queryFn: () => api.get<PaginatedResponse<BranchDto>>('/branches?pageSize=100'),
    enabled: isSuperAdmin,
  });

  const createRoomType = useMutation({
    mutationFn: (body: {
      branchId: string;
      name: string;
      description?: string;
      maxOccupancy: number;
      amenities?: string[];
    }) => api.post<RoomTypeDto>('/room-types', body),
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ['room-types'] });
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'Could not create room type');
    },
  });

  const toggleActive = useMutation({
    mutationFn: (roomType: RoomTypeDto) =>
      api.patch<RoomTypeDto>(`/room-types/${roomType.id}`, { isActive: !roomType.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['room-types'] }),
  });

  function closeDrawer() {
    setDrawerOpen(false);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const branchId = isSuperAdmin ? form.branchId : (staff?.branchId ?? '');
    createRoomType.mutate({
      branchId,
      name: form.name,
      description: form.description || undefined,
      maxOccupancy: Number(form.maxOccupancy),
      amenities: form.amenities
        ? form.amenities
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean)
        : undefined,
    });
  }

  function updateFilter(patch: Partial<typeof filters>) {
    setFilters({ ...filters, ...patch });
    setPage(1);
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  return (
    <>
      <div className="page-header">
        <h2>Room Types</h2>
        {canManage && (
          <button type="button" className="btn-primary" onClick={() => setDrawerOpen(true)}>
            Add room type
          </button>
        )}
      </div>

      {canManage && (
        <Drawer open={drawerOpen} title="Add room type" onClose={closeDrawer}>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <form className="form-card" onSubmit={handleSubmit}>
            {isSuperAdmin && (
              <div className="field">
                <label htmlFor="rt-branch">Branch</label>
                <select
                  id="rt-branch"
                  required
                  value={form.branchId}
                  onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                >
                  <option value="">Select…</option>
                  {branches.data?.data.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label htmlFor="rt-name">Name</label>
              <input
                id="rt-name"
                required
                minLength={2}
                placeholder="e.g. Deluxe"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="rt-occupancy">Max occupancy</label>
              <input
                id="rt-occupancy"
                type="number"
                min={1}
                required
                value={form.maxOccupancy}
                onChange={(e) => setForm({ ...form, maxOccupancy: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="rt-description">Description (optional)</label>
              <input
                id="rt-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="rt-amenities">Amenities (comma-separated, optional)</label>
              <input
                id="rt-amenities"
                placeholder="Wi-Fi, TV, Air conditioning"
                value={form.amenities}
                onChange={(e) => setForm({ ...form, amenities: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={createRoomType.isPending}>
              {createRoomType.isPending ? 'Adding…' : 'Add room type'}
            </button>
          </form>
        </Drawer>
      )}

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="rt-search">Search</label>
          <input
            id="rt-search"
            placeholder="Name…"
            value={filters.search}
            onChange={(e) => updateFilter({ search: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="rt-filter-status">Status</label>
          <select
            id="rt-filter-status"
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
            <button type="button" className="btn-link" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}
      </div>

      {roomTypes.isPending && <p className="muted">Loading room types…</p>}
      {roomTypes.isError && <div className="alert error">Could not load room types.</div>}

      {roomTypes.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Max occupancy</th>
                  <th>Amenities</th>
                  <th>Status</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {roomTypes.data.data.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className="muted">
                      No room types match these filters.
                    </td>
                  </tr>
                )}
                {roomTypes.data.data.map((roomType) => (
                  <tr key={roomType.id}>
                    <td>{roomType.name}</td>
                    <td>{roomType.maxOccupancy}</td>
                    <td>{roomType.amenities.length ? roomType.amenities.join(', ') : <span className="muted">None listed</span>}</td>
                    <td>
                      <span className={`pill ${roomType.isActive ? 'success' : 'error'}`}>
                        {roomType.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canManage && (
                      <td>
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => toggleActive.mutate(roomType)}
                          disabled={toggleActive.isPending}
                        >
                          {roomType.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={roomTypes.data.page}
            totalPages={roomTypes.data.totalPages}
            total={roomTypes.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
