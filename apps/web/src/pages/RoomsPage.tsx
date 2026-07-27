import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { PaginatedResponse, RoomDto, RoomTypeDto } from '@nugget/shared-types';
import { useAuth } from '../auth/auth-context';
import { Drawer } from '../components/Drawer';
import { Pagination } from '../components/Pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { api, ApiError } from '../lib/api-client';

const EMPTY_FORM = { roomTypeId: '', roomNumber: '', floor: '' };
const EMPTY_OOO_FORM = { reason: '', until: '' };
const EMPTY_FILTERS = { search: '', roomTypeId: '', isActive: '' };

export function RoomsPage() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canManage = staff?.role === 'SUPER_ADMIN' || staff?.role === 'BRANCH_MANAGER';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const [oooRoom, setOooRoom] = useState<RoomDto | null>(null);
  const [oooForm, setOooForm] = useState(EMPTY_OOO_FORM);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const debouncedSearch = useDebouncedValue(filters.search);
  const [page, setPage] = useState(1);

  const rooms = useQuery({
    queryKey: ['rooms', page, debouncedSearch, filters.roomTypeId, filters.isActive],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filters.roomTypeId) params.set('roomTypeId', filters.roomTypeId);
      if (filters.isActive) params.set('isActive', filters.isActive);
      return api.get<PaginatedResponse<RoomDto>>(`/rooms?${params}`);
    },
  });

  const roomTypes = useQuery({
    queryKey: ['room-types', 'all'],
    queryFn: () => api.get<PaginatedResponse<RoomTypeDto>>('/room-types?pageSize=100'),
  });

  const createRoom = useMutation({
    mutationFn: (body: { roomTypeId: string; roomNumber: string; floor?: string }) =>
      api.post<RoomDto>('/rooms', body),
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'Could not create room');
    },
  });

  const toggleActive = useMutation({
    mutationFn: (room: RoomDto) => api.patch<RoomDto>(`/rooms/${room.id}`, { isActive: !room.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
  });

  const setOutOfOrder = useMutation({
    mutationFn: (body: { isOutOfOrder: boolean; reason?: string; until?: string }) =>
      api.patch<RoomDto>(`/rooms/${oooRoom?.id}/out-of-order`, body),
    onSuccess: async () => {
      setOooRoom(null);
      setOooForm(EMPTY_OOO_FORM);
      await queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });

  function closeDrawer() {
    setDrawerOpen(false);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createRoom.mutate({ roomTypeId: form.roomTypeId, roomNumber: form.roomNumber, floor: form.floor || undefined });
  }

  function handleOooSubmit(event: FormEvent) {
    event.preventDefault();
    setOutOfOrder.mutate({ isOutOfOrder: true, reason: oooForm.reason || undefined, until: oooForm.until || undefined });
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
        <h2>Rooms</h2>
        {canManage && (
          <button type="button" className="btn-primary" onClick={() => setDrawerOpen(true)}>
            Add room
          </button>
        )}
      </div>

      {canManage && (
        <Drawer open={drawerOpen} title="Add room" onClose={closeDrawer}>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <form className="form-card" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="room-type">Room type</label>
              <select
                id="room-type"
                required
                value={form.roomTypeId}
                onChange={(e) => setForm({ ...form, roomTypeId: e.target.value })}
              >
                <option value="">Select…</option>
                {roomTypes.data?.data.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="room-number">Room number</label>
              <input
                id="room-number"
                required
                value={form.roomNumber}
                onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="room-floor">Floor (optional)</label>
              <input
                id="room-floor"
                value={form.floor}
                onChange={(e) => setForm({ ...form, floor: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={createRoom.isPending}>
              {createRoom.isPending ? 'Adding…' : 'Add room'}
            </button>
          </form>
        </Drawer>
      )}

      <Drawer
        open={oooRoom !== null}
        title={`Mark room ${oooRoom?.roomNumber ?? ''} out of order`}
        onClose={() => setOooRoom(null)}
      >
        <form className="form-card" onSubmit={handleOooSubmit}>
          <div className="field">
            <label htmlFor="ooo-reason">Reason (optional)</label>
            <input
              id="ooo-reason"
              value={oooForm.reason}
              onChange={(e) => setOooForm({ ...oooForm, reason: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="ooo-until">Expected return to service (optional)</label>
            <input
              id="ooo-until"
              type="date"
              value={oooForm.until}
              onChange={(e) => setOooForm({ ...oooForm, until: e.target.value })}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={setOutOfOrder.isPending}>
            {setOutOfOrder.isPending ? 'Saving…' : 'Mark out of order'}
          </button>
        </form>
      </Drawer>

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="room-search">Search</label>
          <input
            id="room-search"
            placeholder="Room number…"
            value={filters.search}
            onChange={(e) => updateFilter({ search: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="room-filter-type">Room type</label>
          <select
            id="room-filter-type"
            value={filters.roomTypeId}
            onChange={(e) => updateFilter({ roomTypeId: e.target.value })}
          >
            <option value="">All types</option>
            {roomTypes.data?.data.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="room-filter-status">Status</label>
          <select
            id="room-filter-status"
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

      {rooms.isPending && <p className="muted">Loading rooms…</p>}
      {rooms.isError && <div className="alert error">Could not load rooms.</div>}

      {rooms.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Room type</th>
                  <th>Floor</th>
                  <th>Status</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {rooms.data.data.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className="muted">
                      No rooms match these filters.
                    </td>
                  </tr>
                )}
                {rooms.data.data.map((room) => (
                  <tr key={room.id}>
                    <td>{room.roomNumber}</td>
                    <td>{room.roomType.name}</td>
                    <td>{room.floor ?? <span className="muted">Not set</span>}</td>
                    <td>
                      {room.isOutOfOrder ? (
                        <span className="pill error" title={room.outOfOrderReason ?? undefined}>
                          Out of order
                        </span>
                      ) : room.isActive ? (
                        <span className="pill success">Active</span>
                      ) : (
                        <span className="pill error">Inactive</span>
                      )}
                    </td>
                    {canManage && (
                      <td style={{ display: 'flex', gap: 'calc(var(--space) * 1.5)' }}>
                        {room.isOutOfOrder ? (
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => setOutOfOrder.mutate({ isOutOfOrder: false })}
                          >
                            Clear out-of-order
                          </button>
                        ) : (
                          <button type="button" className="btn-link" onClick={() => setOooRoom(room)}>
                            Mark out of order
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => toggleActive.mutate(room)}
                          disabled={toggleActive.isPending}
                        >
                          {room.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={rooms.data.page}
            totalPages={rooms.data.totalPages}
            total={rooms.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
