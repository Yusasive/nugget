import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  BookingDto,
  PaginatedResponse,
  RoomBoardStatus,
  RoomStatusBoardEntry,
  RoomTypeDto,
} from '@nugget/shared-types';
import { useAuth } from '../auth/auth-context';
import { Drawer } from '../components/Drawer';
import { Pagination } from '../components/Pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { api, ApiError } from '../lib/api-client';

const POLL_INTERVAL_MS = 5000;

const STATUS_PILL: Record<RoomBoardStatus, string> = {
  VACANT: 'success',
  OCCUPIED: 'info',
  DIRTY: 'warning',
  OUT_OF_ORDER: 'error',
};

const STATUS_LABEL: Record<RoomBoardStatus, string> = {
  VACANT: 'Vacant',
  OCCUPIED: 'Occupied',
  DIRTY: 'Needs cleaning',
  OUT_OF_ORDER: 'Out of order',
};

const EMPTY_FILTERS = { search: '', status: '' as RoomBoardStatus | '', roomTypeId: '' };

export function FrontDeskPage() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canFrontDesk =
    staff?.role === 'SUPER_ADMIN' || staff?.role === 'BRANCH_MANAGER' || staff?.role === 'FRONT_DESK';
  const canHousekeeping =
    staff?.role === 'SUPER_ADMIN' || staff?.role === 'BRANCH_MANAGER' || staff?.role === 'HOUSEKEEPING';

  const [checkInEntry, setCheckInEntry] = useState<RoomStatusBoardEntry | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [transferEntry, setTransferEntry] = useState<RoomStatusBoardEntry | null>(null);
  const [toRoomId, setToRoomId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const debouncedSearch = useDebouncedValue(filters.search);
  const [page, setPage] = useState(1);

  const roomTypes = useQuery({
    queryKey: ['room-types', 'all'],
    queryFn: () => api.get<PaginatedResponse<RoomTypeDto>>('/room-types?pageSize=100'),
  });

  const board = useQuery({
    queryKey: ['room-status-board', page, debouncedSearch, filters.status, filters.roomTypeId],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filters.status) params.set('status', filters.status);
      if (filters.roomTypeId) params.set('roomTypeId', filters.roomTypeId);
      return api.get<PaginatedResponse<RoomStatusBoardEntry>>(`/rooms/status-board?${params}`);
    },
    refetchInterval: POLL_INTERVAL_MS,
  });

  // Independent of the (paginated/filtered) board display above — the
  // transfer drawer needs every vacant room to choose from, not just
  // whichever page/filter happens to be showing right now.
  const vacantRoomsForTransfer = useQuery({
    queryKey: ['room-status-board', 'vacant-for-transfer'],
    queryFn: () =>
      api.get<PaginatedResponse<RoomStatusBoardEntry>>(
        '/rooms/status-board?status=VACANT&pageSize=100',
      ),
    enabled: transferEntry !== null,
  });

  const previousStatuses = useRef<Map<string, RoomBoardStatus>>(new Map());
  const [changedRoomIds, setChangedRoomIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!board.data) return;
    const changed = new Set<string>();
    for (const entry of board.data.data) {
      const prev = previousStatuses.current.get(entry.room.id);
      if (prev && prev !== entry.status) changed.add(entry.room.id);
    }
    previousStatuses.current = new Map(board.data.data.map((e) => [e.room.id, e.status]));
    if (changed.size > 0) {
      setChangedRoomIds(changed);
      const timer = setTimeout(() => setChangedRoomIds(new Set()), 1300);
      return () => clearTimeout(timer);
    }
  }, [board.data]);

  function closeCheckIn() {
    setCheckInEntry(null);
    setDepositAmount('');
    setError(null);
  }

  function closeTransfer() {
    setTransferEntry(null);
    setToRoomId('');
    setTransferReason('');
    setError(null);
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

  const invalidateBoard = () => queryClient.invalidateQueries({ queryKey: ['room-status-board'] });

  const checkIn = useMutation({
    mutationFn: () =>
      api.post<BookingDto>(`/bookings/${checkInEntry?.arrivalToday?.id}/check-in`, {
        depositAmount: depositAmount || undefined,
      }),
    onSuccess: async () => {
      closeCheckIn();
      await invalidateBoard();
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'Could not check in guest');
    },
  });

  const transfer = useMutation({
    mutationFn: () =>
      api.post<BookingDto>(`/bookings/${transferEntry?.activeBooking?.id}/transfer`, {
        toRoomId,
        reason: transferReason || undefined,
      }),
    onSuccess: async () => {
      closeTransfer();
      await invalidateBoard();
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'Could not transfer guest');
    },
  });

  const checkOut = useMutation({
    mutationFn: (entry: RoomStatusBoardEntry) =>
      api.post<BookingDto>(`/bookings/${entry.activeBooking?.id}/check-out`, {}),
    onSuccess: () => invalidateBoard(),
  });

  const markClean = useMutation({
    mutationFn: (entry: RoomStatusBoardEntry) =>
      api.patch(`/rooms/${entry.room.id}/housekeeping-status`, { housekeepingStatus: 'CLEAN' }),
    onSuccess: () => invalidateBoard(),
  });

  function handleCheckInSubmit(event: FormEvent) {
    event.preventDefault();
    checkIn.mutate();
  }

  function handleTransferSubmit(event: FormEvent) {
    event.preventDefault();
    transfer.mutate();
  }

  const vacantRooms = (vacantRoomsForTransfer.data?.data ?? []).filter(
    (e) => e.room.id !== transferEntry?.room.id,
  );

  return (
    <>
      <div className="page-header">
        <h2>Front Desk</h2>
      </div>

      {canFrontDesk && (
        <Drawer
          open={checkInEntry !== null}
          title={`Check in — Room ${checkInEntry?.room.roomNumber ?? ''}`}
          onClose={closeCheckIn}
        >
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <form className="form-card" onSubmit={handleCheckInSubmit}>
            <p className="muted">Guest: {checkInEntry?.arrivalToday?.guestName}</p>
            <div className="field">
              <label htmlFor="fd-deposit">Deposit amount (optional)</label>
              <input
                id="fd-deposit"
                inputMode="decimal"
                placeholder="0.00"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={checkIn.isPending}>
              {checkIn.isPending ? 'Checking in…' : 'Check in'}
            </button>
          </form>
        </Drawer>
      )}

      {canFrontDesk && (
        <Drawer
          open={transferEntry !== null}
          title={`Transfer — Room ${transferEntry?.room.roomNumber ?? ''}`}
          onClose={closeTransfer}
        >
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <form className="form-card" onSubmit={handleTransferSubmit}>
            <p className="muted">Guest: {transferEntry?.activeBooking?.guestName}</p>
            <div className="field">
              <label htmlFor="fd-to-room">New room</label>
              <select id="fd-to-room" required value={toRoomId} onChange={(e) => setToRoomId(e.target.value)}>
                <option value="">Select…</option>
                {vacantRooms.map((entry) => (
                  <option key={entry.room.id} value={entry.room.id}>
                    {entry.room.roomNumber} — {entry.room.roomType.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="fd-reason">Reason (optional)</label>
              <input id="fd-reason" value={transferReason} onChange={(e) => setTransferReason(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary" disabled={transfer.isPending}>
              {transfer.isPending ? 'Transferring…' : 'Transfer'}
            </button>
          </form>
        </Drawer>
      )}

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="fd-search">Search</label>
          <input
            id="fd-search"
            placeholder="Room number…"
            value={filters.search}
            onChange={(e) => updateFilter({ search: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="fd-filter-status">Status</label>
          <select
            id="fd-filter-status"
            value={filters.status}
            onChange={(e) => updateFilter({ status: e.target.value as RoomBoardStatus | '' })}
          >
            <option value="">All</option>
            <option value="VACANT">Vacant</option>
            <option value="OCCUPIED">Occupied</option>
            <option value="DIRTY">Needs cleaning</option>
            <option value="OUT_OF_ORDER">Out of order</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="fd-filter-type">Room type</label>
          <select
            id="fd-filter-type"
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
        {hasActiveFilters && (
          <div className="field clear-filters">
            <label>&nbsp;</label>
            <button type="button" className="btn-link" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}
      </div>

      {board.isPending && <p className="muted">Loading room status board…</p>}
      {board.isError && <div className="alert error">Could not load the room status board.</div>}

      {board.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Guest</th>
                  {(canFrontDesk || canHousekeeping) && <th />}
                </tr>
              </thead>
              <tbody>
                {board.data.data.length === 0 && (
                  <tr>
                    <td colSpan={canFrontDesk || canHousekeeping ? 5 : 4} className="muted">
                      No rooms match these filters.
                    </td>
                  </tr>
                )}
                {board.data.data.map((entry) => (
                  <tr key={entry.room.id} className={changedRoomIds.has(entry.room.id) ? 'just-changed' : undefined}>
                    <td>{entry.room.roomNumber}</td>
                    <td>{entry.room.roomType.name}</td>
                    <td>
                      <span className={`pill ${STATUS_PILL[entry.status]}`}>{STATUS_LABEL[entry.status]}</span>
                    </td>
                    <td>
                      {entry.activeBooking && (
                        <>
                          {entry.activeBooking.guestName}{' '}
                          <span className="muted">
                            until {new Date(entry.activeBooking.checkOutDate).toLocaleDateString()}
                          </span>
                        </>
                      )}
                      {!entry.activeBooking && entry.arrivalToday && (
                        <span className="muted">Arriving today: {entry.arrivalToday.guestName}</span>
                      )}
                      {!entry.activeBooking && !entry.arrivalToday && <span className="muted">—</span>}
                    </td>
                    {(canFrontDesk || canHousekeeping) && (
                      <td style={{ display: 'flex', gap: 'calc(var(--space) * 1.5)' }}>
                        {canFrontDesk && entry.arrivalToday && !entry.activeBooking && (
                          <button type="button" className="btn-link" onClick={() => setCheckInEntry(entry)}>
                            Check in
                          </button>
                        )}
                        {canFrontDesk && entry.activeBooking && (
                          <>
                            <button type="button" className="btn-link" onClick={() => setTransferEntry(entry)}>
                              Transfer
                            </button>
                            <button
                              type="button"
                              className="btn-link"
                              onClick={() => checkOut.mutate(entry)}
                              disabled={checkOut.isPending}
                            >
                              Check out
                            </button>
                          </>
                        )}
                        {canHousekeeping && entry.status === 'DIRTY' && (
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => markClean.mutate(entry)}
                            disabled={markClean.isPending}
                          >
                            Mark clean
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
            page={board.data.page}
            totalPages={board.data.totalPages}
            total={board.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
