import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type {
  AvailableRoomDto,
  BookingDto,
  BookingStatus,
  PaginatedResponse,
  RatePlanDto,
} from '@nugget/shared-types';
import { useAuth } from '../auth/auth-context';
import { Drawer } from '../components/Drawer';
import { Pagination } from '../components/Pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { api, ApiError } from '../lib/api-client';

const EMPTY_SEARCH = { checkInDate: '', checkOutDate: '' };
const EMPTY_GUEST = { firstName: '', lastName: '', email: '', phone: '' };
const EMPTY_FILTERS = { status: '' as BookingStatus | '', guestSearch: '', checkInDateFrom: '', checkInDateTo: '' };

const STATUS_PILL: Record<BookingDto['status'], string> = {
  HELD: 'info',
  CONFIRMED: 'success',
  CHECKED_IN: 'success',
  CHECKED_OUT: 'info',
  CANCELLED: 'error',
  EXPIRED: 'error',
};

export function BookingsPage() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canManage = staff?.role !== 'ACCOUNTANT';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState(EMPTY_SEARCH);
  const [searched, setSearched] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<AvailableRoomDto | null>(null);
  const [ratePlanId, setRatePlanId] = useState('');
  const [guest, setGuest] = useState(EMPTY_GUEST);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const debouncedGuestSearch = useDebouncedValue(filters.guestSearch);
  const [page, setPage] = useState(1);

  const bookings = useQuery({
    queryKey: [
      'bookings',
      page,
      filters.status,
      debouncedGuestSearch,
      filters.checkInDateFrom,
      filters.checkInDateTo,
    ],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (filters.status) params.set('status', filters.status);
      if (debouncedGuestSearch) params.set('guestSearch', debouncedGuestSearch);
      if (filters.checkInDateFrom) params.set('checkInDateFrom', filters.checkInDateFrom);
      if (filters.checkInDateTo) params.set('checkInDateTo', filters.checkInDateTo);
      return api.get<PaginatedResponse<BookingDto>>(`/bookings?${params}`);
    },
  });

  const availability = useQuery({
    queryKey: ['booking-availability', staff?.branchId, search.checkInDate, search.checkOutDate],
    queryFn: () =>
      api.get<AvailableRoomDto[]>(
        `/bookings/availability?branchId=${staff?.branchId}&checkInDate=${search.checkInDate}&checkOutDate=${search.checkOutDate}`,
      ),
    enabled: searched && !!search.checkInDate && !!search.checkOutDate,
  });

  const ratePlans = useQuery({
    queryKey: ['booking-rate-plans', selectedRoom?.roomType.id, search.checkInDate, search.checkOutDate],
    queryFn: () =>
      api.get<RatePlanDto[]>(
        `/rate-plans?roomTypeId=${selectedRoom?.roomType.id}&checkInDate=${search.checkInDate}&checkOutDate=${search.checkOutDate}`,
      ),
    enabled: !!selectedRoom,
  });

  const createBooking = useMutation({
    mutationFn: () =>
      api.post<BookingDto>('/bookings', {
        roomId: selectedRoom?.id,
        ratePlanId,
        checkInDate: search.checkInDate,
        checkOutDate: search.checkOutDate,
        guest: {
          firstName: guest.firstName,
          lastName: guest.lastName,
          email: guest.email || undefined,
          phone: guest.phone || undefined,
        },
        notes: notes || undefined,
      }),
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'Could not create booking');
    },
  });

  const confirmBooking = useMutation({
    mutationFn: (booking: BookingDto) => api.post<BookingDto>(`/bookings/${booking.id}/confirm`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings'] }),
  });

  const cancelBooking = useMutation({
    mutationFn: (booking: BookingDto) => api.post<BookingDto>(`/bookings/${booking.id}/cancel`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings'] }),
  });

  function closeDrawer() {
    setDrawerOpen(false);
    setSearch(EMPTY_SEARCH);
    setSearched(false);
    setSelectedRoom(null);
    setRatePlanId('');
    setGuest(EMPTY_GUEST);
    setNotes('');
    setError(null);
  }

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    setSelectedRoom(null);
    setSearched(true);
  }

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    createBooking.mutate();
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
        <h2>Bookings</h2>
        {canManage && (
          <button type="button" className="btn-primary" onClick={() => setDrawerOpen(true)}>
            New booking
          </button>
        )}
      </div>

      {canManage && (
        <Drawer open={drawerOpen} title="New booking" onClose={closeDrawer}>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}

          <form className="form-card" onSubmit={handleSearch}>
            <div className="field">
              <label htmlFor="b-checkin">Check-in</label>
              <input
                id="b-checkin"
                type="date"
                required
                value={search.checkInDate}
                onChange={(e) => setSearch({ ...search, checkInDate: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="b-checkout">Check-out</label>
              <input
                id="b-checkout"
                type="date"
                required
                value={search.checkOutDate}
                onChange={(e) => setSearch({ ...search, checkOutDate: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary">
              Check availability
            </button>
          </form>

          {searched && availability.isPending && <p className="muted">Checking availability…</p>}
          {searched && availability.isError && (
            <div className="alert error">Could not check availability.</div>
          )}
          {searched && availability.data && (
            <div className="table-wrap" style={{ marginBottom: 'var(--gutter)' }}>
              <table>
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Type</th>
                    <th>Max occupancy</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {availability.data.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted">
                        No rooms available for these dates.
                      </td>
                    </tr>
                  )}
                  {availability.data.map((room) => (
                    <tr key={room.id}>
                      <td>{room.roomNumber}</td>
                      <td>{room.roomType.name}</td>
                      <td>{room.roomType.maxOccupancy}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => {
                            setSelectedRoom(room);
                            setRatePlanId('');
                          }}
                        >
                          {selectedRoom?.id === room.id ? 'Selected' : 'Select'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedRoom && (
            <form className="form-card" onSubmit={handleCreate}>
              <div className="field">
                <label htmlFor="b-rateplan">Rate plan</label>
                <select
                  id="b-rateplan"
                  required
                  value={ratePlanId}
                  onChange={(e) => setRatePlanId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {ratePlans.data?.map((rp) => (
                    <option key={rp.id} value={rp.id}>
                      {rp.name} — ₦{rp.pricePerNight}/night
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="b-first">Guest first name</label>
                <input
                  id="b-first"
                  required
                  value={guest.firstName}
                  onChange={(e) => setGuest({ ...guest, firstName: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="b-last">Guest last name</label>
                <input
                  id="b-last"
                  required
                  value={guest.lastName}
                  onChange={(e) => setGuest({ ...guest, lastName: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="b-email">Guest email (optional)</label>
                <input
                  id="b-email"
                  type="email"
                  value={guest.email}
                  onChange={(e) => setGuest({ ...guest, email: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="b-phone">Guest phone (optional)</label>
                <input
                  id="b-phone"
                  value={guest.phone}
                  onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="b-notes">Notes (optional)</label>
                <input id="b-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary" disabled={createBooking.isPending}>
                {createBooking.isPending ? 'Creating…' : 'Create booking'}
              </button>
            </form>
          )}
        </Drawer>
      )}

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="bk-guest-search">Guest</label>
          <input
            id="bk-guest-search"
            placeholder="Name or email…"
            value={filters.guestSearch}
            onChange={(e) => updateFilter({ guestSearch: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="bk-filter-status">Status</label>
          <select
            id="bk-filter-status"
            value={filters.status}
            onChange={(e) => updateFilter({ status: e.target.value as BookingStatus | '' })}
          >
            <option value="">All</option>
            <option value="HELD">Held</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CHECKED_IN">Checked in</option>
            <option value="CHECKED_OUT">Checked out</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="bk-filter-from">Check-in from</label>
          <input
            id="bk-filter-from"
            type="date"
            value={filters.checkInDateFrom}
            onChange={(e) => updateFilter({ checkInDateFrom: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="bk-filter-to">Check-in to</label>
          <input
            id="bk-filter-to"
            type="date"
            value={filters.checkInDateTo}
            onChange={(e) => updateFilter({ checkInDateTo: e.target.value })}
          />
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

      {bookings.isPending && <p className="muted">Loading bookings…</p>}
      {bookings.isError && <div className="alert error">Could not load bookings.</div>}

      {bookings.data && (
        <>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Guest</th>
                <th>Room</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Total</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bookings.data.data.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    No bookings match these filters.
                  </td>
                </tr>
              )}
              {bookings.data.data.map((booking) => (
                <tr key={booking.id}>
                  <td>
                    {booking.guest.firstName} {booking.guest.lastName}
                  </td>
                  <td>{booking.room.roomNumber}</td>
                  <td>{new Date(booking.checkInDate).toLocaleDateString()}</td>
                  <td>{new Date(booking.checkOutDate).toLocaleDateString()}</td>
                  <td>₦{booking.totalAmount}</td>
                  <td>
                    <span className={`pill ${STATUS_PILL[booking.status]}`}>{booking.status}</span>
                  </td>
                  <td style={{ display: 'flex', gap: 'calc(var(--space) * 1.5)' }}>
                    {canManage && booking.status === 'HELD' && (
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => confirmBooking.mutate(booking)}
                        disabled={confirmBooking.isPending}
                      >
                        Confirm
                      </button>
                    )}
                    {canManage && (booking.status === 'HELD' || booking.status === 'CONFIRMED') && (
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => cancelBooking.mutate(booking)}
                        disabled={cancelBooking.isPending}
                      >
                        Cancel
                      </button>
                    )}
                    {(booking.status === 'CONFIRMED' ||
                      booking.status === 'CHECKED_IN' ||
                      booking.status === 'CHECKED_OUT') && (
                      <Link className="btn-link" to={`/app/bookings/${booking.id}/folio`}>
                        Folio
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={bookings.data.page}
          totalPages={bookings.data.totalPages}
          total={bookings.data.total}
          onPageChange={setPage}
        />
        </>
      )}
    </>
  );
}
