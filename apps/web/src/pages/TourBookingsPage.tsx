import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type {
  InitiatePaymentResponse,
  InvoiceDto,
  PaginatedResponse,
  PaymentMethod,
  TourBookingDto,
  TourBookingStatus,
  TourDepartureDto,
} from '@nugget/shared-types';
import { useAuth } from '../auth/auth-context';
import { Drawer } from '../components/Drawer';
import { Pagination } from '../components/Pagination';
import { api, ApiError } from '../lib/api-client';

const EMPTY_FORM = {
  tourDepartureId: '',
  seats: '1',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  linkedBookingId: '',
  notes: '',
};
const EMPTY_FILTERS = { status: '' as TourBookingStatus | '' };
const EMPTY_PAYMENT = { method: 'CASH' as PaymentMethod, amount: '' };

const STATUS_PILL: Record<TourBookingStatus, string> = {
  HELD: 'info',
  CONFIRMED: 'success',
  CANCELLED: 'error',
  EXPIRED: 'error',
};

export function TourBookingsPage() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canManage = staff?.role === 'SUPER_ADMIN' || staff?.role === 'TOURS_COORDINATOR';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const [invoicesByBooking, setInvoicesByBooking] = useState<Record<string, InvoiceDto>>({});
  const [paymentBookingId, setPaymentBookingId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const bookings = useQuery({
    queryKey: ['tour-bookings', page, filters.status],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (filters.status) params.set('status', filters.status);
      return api.get<PaginatedResponse<TourBookingDto>>(`/tour-bookings?${params}`);
    },
  });

  const openDepartures = useQuery({
    queryKey: ['tour-departures', 'open'],
    queryFn: () =>
      api.get<PaginatedResponse<TourDepartureDto>>('/tour-departures?status=SCHEDULED&pageSize=100'),
    enabled: drawerOpen,
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<TourBookingDto>('/tour-bookings', {
        tourDepartureId: form.tourDepartureId,
        seats: Number(form.seats),
        guest: {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email || undefined,
          phone: form.phone || undefined,
        },
        linkedBookingId: form.linkedBookingId || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ['tour-bookings'] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Could not create tour booking'),
  });

  const confirmBooking = useMutation({
    mutationFn: (booking: TourBookingDto) => api.post<TourBookingDto>(`/tour-bookings/${booking.id}/confirm`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tour-bookings'] }),
  });

  const cancelBooking = useMutation({
    mutationFn: (booking: TourBookingDto) => api.post<TourBookingDto>(`/tour-bookings/${booking.id}/cancel`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tour-bookings'] }),
  });

  const issueInvoice = useMutation({
    mutationFn: (booking: TourBookingDto) =>
      api.post<InvoiceDto>(`/tour-bookings/${booking.id}/invoices`),
    onSuccess: (invoice, booking) => {
      setInvoicesByBooking((prev) => ({ ...prev, [booking.id]: invoice }));
    },
  });

  const recordPayment = useMutation({
    mutationFn: () =>
      api.post<InitiatePaymentResponse>(`/tour-bookings/${paymentBookingId}/payments`, {
        method: paymentForm.method,
        amount: paymentForm.amount,
      }),
    onSuccess: async () => {
      const bookingId = paymentBookingId;
      setPaymentBookingId(null);
      setPaymentForm(EMPTY_PAYMENT);
      setPaymentError(null);
      if (bookingId) {
        const invoice = await api.get<InvoiceDto | null>(`/tour-bookings/${bookingId}/invoice`);
        if (invoice) {
          setInvoicesByBooking((prev) => ({ ...prev, [bookingId]: invoice }));
        }
      }
    },
    onError: (err: unknown) =>
      setPaymentError(err instanceof ApiError ? err.message : 'Could not record payment'),
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

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  const paymentInvoice = paymentBookingId ? invoicesByBooking[paymentBookingId] : undefined;

  return (
    <>
      <div className="page-header">
        <h2>Tour Bookings</h2>
        {canManage && (
          <button type="button" className="btn-primary" onClick={() => setDrawerOpen(true)}>
            New tour booking
          </button>
        )}
      </div>

      {canManage && (
        <Drawer open={drawerOpen} title="New tour booking" onClose={closeDrawer}>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <form className="form-card" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="tb-departure">Departure</label>
              <select
                id="tb-departure"
                required
                value={form.tourDepartureId}
                onChange={(e) => setForm({ ...form, tourDepartureId: e.target.value })}
              >
                <option value="">Select…</option>
                {openDepartures.data?.data.map((departure) => (
                  <option key={departure.id} value={departure.id}>
                    {departure.tourPackage.name} — {new Date(departure.departureAt).toLocaleString()} (
                    {departure.availableSeats} seats left)
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="tb-seats">Seats</label>
              <input
                id="tb-seats"
                type="number"
                min={1}
                required
                value={form.seats}
                onChange={(e) => setForm({ ...form, seats: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="tb-first">Guest first name</label>
              <input
                id="tb-first"
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="tb-last">Guest last name</label>
              <input
                id="tb-last"
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="tb-email">Guest email (optional)</label>
              <input
                id="tb-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="tb-phone">Guest phone (optional)</label>
              <input
                id="tb-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="tb-linked">Bundle with room booking ID (optional)</label>
              <input
                id="tb-linked"
                placeholder="Leave blank for a standalone tour booking"
                value={form.linkedBookingId}
                onChange={(e) => setForm({ ...form, linkedBookingId: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="tb-notes">Notes (optional)</label>
              <input
                id="tb-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create tour booking'}
            </button>
          </form>
        </Drawer>
      )}

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="tb-filter-status">Status</label>
          <select
            id="tb-filter-status"
            value={filters.status}
            onChange={(e) => updateFilter({ status: e.target.value as TourBookingStatus | '' })}
          >
            <option value="">All</option>
            <option value="HELD">Held</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="EXPIRED">Expired</option>
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

      {bookings.isPending && <p className="muted">Loading tour bookings…</p>}
      {bookings.isError && <div className="alert error">Could not load tour bookings.</div>}

      {bookings.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Package</th>
                  <th>Departs</th>
                  <th>Seats</th>
                  <th>Total</th>
                  <th>Linked booking</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {bookings.data.data.length === 0 && (
                  <tr>
                    <td colSpan={8} className="muted">
                      No tour bookings match these filters.
                    </td>
                  </tr>
                )}
                {bookings.data.data.map((booking) => {
                  const invoice = invoicesByBooking[booking.id];
                  return (
                    <tr key={booking.id}>
                      <td>
                        {booking.guest.firstName} {booking.guest.lastName}
                      </td>
                      <td>{booking.tourDeparture.tourPackage.name}</td>
                      <td>{new Date(booking.tourDeparture.departureAt).toLocaleString()}</td>
                      <td>{booking.seats}</td>
                      <td>₦{booking.totalAmount}</td>
                      <td className="muted">{booking.linkedBookingId ? 'Bundled' : 'Standalone'}</td>
                      <td>
                        <span className={`pill ${STATUS_PILL[booking.status]}`}>{booking.status}</span>
                      </td>
                      <td style={{ display: 'flex', gap: 'calc(var(--space) * 1.5)', flexWrap: 'wrap' }}>
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
                        {canManage &&
                          booking.status === 'CONFIRMED' &&
                          !booking.linkedBookingId &&
                          !invoice && (
                            <button
                              type="button"
                              className="btn-link"
                              onClick={() => issueInvoice.mutate(booking)}
                              disabled={issueInvoice.isPending}
                            >
                              Issue invoice
                            </button>
                          )}
                        {canManage && invoice && invoice.paymentStatus !== 'PAID' && (
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => {
                              setPaymentBookingId(booking.id);
                              setPaymentForm({ ...EMPTY_PAYMENT, amount: invoice.balanceDue });
                            }}
                          >
                            Record payment ({invoice.invoiceNumber})
                          </button>
                        )}
                        {invoice && invoice.paymentStatus === 'PAID' && (
                          <span className="pill success">Paid ({invoice.invoiceNumber})</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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

      <Drawer
        open={paymentBookingId !== null}
        title={`Record payment — ${paymentInvoice?.invoiceNumber ?? ''}`}
        onClose={() => setPaymentBookingId(null)}
      >
        {paymentError && (
          <div className="alert error" role="alert">
            {paymentError}
          </div>
        )}
        <form
          className="form-card"
          onSubmit={(e) => {
            e.preventDefault();
            recordPayment.mutate();
          }}
        >
          <p className="muted">Balance due: ₦{paymentInvoice?.balanceDue}</p>
          <div className="field">
            <label htmlFor="tb-pay-method">Method</label>
            <select
              id="tb-pay-method"
              value={paymentForm.method}
              onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as PaymentMethod })}
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="USSD">USSD</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="tb-pay-amount">Amount</label>
            <input
              id="tb-pay-amount"
              inputMode="decimal"
              required
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={recordPayment.isPending}>
            {recordPayment.isPending ? 'Recording…' : 'Record payment'}
          </button>
        </form>
      </Drawer>
    </>
  );
}
