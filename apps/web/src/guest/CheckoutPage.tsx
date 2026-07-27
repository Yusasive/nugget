import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '../lib/api-client';
import { GUEST_BRANCH_ID } from './guest-config';
import type {
  AvailableRoomDto,
  BookingDto,
  PaginatedResponse,
  RatePlanDto,
  RoomTypeDto,
  TourBookingDto,
  TourDepartureDto,
  TourPackageDto,
} from '@nugget/shared-types';

interface GuestFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

const EMPTY_GUEST_FORM: GuestFormState = { firstName: '', lastName: '', email: '', phone: '' };

function nights(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function GuestDetailsForm({
  form,
  onChange,
  submitLabel,
  submitting,
  disabled,
}: {
  form: GuestFormState;
  onChange: (form: GuestFormState) => void;
  submitLabel: string;
  submitting: boolean;
  disabled: boolean;
}) {
  return (
    <>
      <div className="guest-form-field">
        <label htmlFor="checkout-first-name">First Name</label>
        <input
          id="checkout-first-name"
          type="text"
          required
          value={form.firstName}
          onChange={e => onChange({ ...form, firstName: e.target.value })}
          placeholder="Your first name"
        />
      </div>
      <div className="guest-form-field">
        <label htmlFor="checkout-last-name">Last Name</label>
        <input
          id="checkout-last-name"
          type="text"
          required
          value={form.lastName}
          onChange={e => onChange({ ...form, lastName: e.target.value })}
          placeholder="Your last name"
        />
      </div>
      <div className="guest-form-field">
        <label htmlFor="checkout-email">Email Address</label>
        <input
          id="checkout-email"
          type="email"
          required
          value={form.email}
          onChange={e => onChange({ ...form, email: e.target.value })}
          placeholder="you@example.com"
        />
      </div>
      <div className="guest-form-field">
        <label htmlFor="checkout-phone">Phone Number</label>
        <input
          id="checkout-phone"
          type="tel"
          value={form.phone}
          onChange={e => onChange({ ...form, phone: e.target.value })}
          placeholder="+234 800 000 0000"
        />
      </div>
      <button type="submit" className="guest-btn-primary guest-btn-full" disabled={disabled || submitting}>
        {submitting ? 'Processing…' : submitLabel}
      </button>
    </>
  );
}

function RoomCheckout({
  roomTypeId,
  initialCheckIn,
  initialCheckOut,
}: {
  roomTypeId: string;
  initialCheckIn: string;
  initialCheckOut: string;
}) {
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);

  const { data: roomTypePage } = useQuery({
    queryKey: ['public-room-type', roomTypeId],
    queryFn: () =>
      api.get<PaginatedResponse<RoomTypeDto>>(
        `/public/room-types?branchId=${GUEST_BRANCH_ID}&pageSize=100`,
      ),
    enabled: Boolean(GUEST_BRANCH_ID),
    retry: false,
  });
  const roomType = roomTypePage?.data.find(rt => rt.id === roomTypeId) ?? null;
  const [guestForm, setGuestForm] = useState<GuestFormState>(EMPTY_GUEST_FORM);
  const datesReady = Boolean(checkIn && checkOut);

  const { data: availableRooms, isLoading: loadingRooms, isFetched: roomsFetched } = useQuery({
    queryKey: ['public-room-availability', roomTypeId, checkIn, checkOut],
    queryFn: () =>
      api.get<AvailableRoomDto[]>(
        `/public/rooms/availability?branchId=${GUEST_BRANCH_ID}&checkInDate=${checkIn}&checkOutDate=${checkOut}&roomTypeId=${roomTypeId}`,
      ),
    enabled: datesReady && Boolean(GUEST_BRANCH_ID),
    retry: false,
  });

  const selectedRoom = availableRooms?.[0] ?? null;

  const { data: ratePlans } = useQuery({
    queryKey: ['public-rate-plans', roomTypeId, checkIn, checkOut],
    queryFn: () =>
      api.get<RatePlanDto[]>(
        `/public/rate-plans?roomTypeId=${roomTypeId}&checkInDate=${checkIn}&checkOutDate=${checkOut}`,
      ),
    enabled: datesReady && Boolean(selectedRoom),
    retry: false,
  });

  const selectedRatePlan = ratePlans?.[0] ?? null;

  const createBooking = useMutation({
    mutationFn: () =>
      api.post<BookingDto>('/public/bookings', {
        branchId: GUEST_BRANCH_ID,
        roomId: selectedRoom!.id,
        ratePlanId: selectedRatePlan!.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guest: {
          firstName: guestForm.firstName,
          lastName: guestForm.lastName,
          email: guestForm.email || undefined,
          phone: guestForm.phone || undefined,
        },
      }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createBooking.mutate();
  }

  if (createBooking.isSuccess) {
    const booking = createBooking.data;
    return (
      <div className="guest-form-success guest-checkout-confirmation">
        <CheckCircle2 size={32} strokeWidth={1.5} />
        <h2>Booking Held!</h2>
        <p>
          Room {booking.room.roomNumber} ({booking.room.roomType.name}) is held for{' '}
          <strong>{formatDate(booking.checkInDate)}</strong> to <strong>{formatDate(booking.checkOutDate)}</strong>.
        </p>
        <p className="guest-checkout-total">Total: ₦{Number(booking.totalAmount).toLocaleString()}</p>
        {booking.holdExpiresAt && (
          <p className="guest-checkout-hold-note">
            Please complete payment at the front desk or via our team before the hold expires at{' '}
            {formatDateTime(booking.holdExpiresAt)} to secure this room.
          </p>
        )}
        <Link to="/" className="guest-btn-primary">Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="guest-checkout-inner">
      {roomType && (
        <div className="guest-checkout-item-card">
          <h2>{roomType.name}</h2>
          {roomType.description && <p className="guest-checkout-item-desc">{roomType.description}</p>}
          <div className="guest-checkout-item-meta">
            <span>Up to {roomType.maxOccupancy} guest{roomType.maxOccupancy !== 1 ? 's' : ''}</span>
            {roomType.amenities.length > 0 && (
              <span>{roomType.amenities.join(' · ')}</span>
            )}
          </div>
        </div>
      )}

      <div className="guest-checkout-dates">
        <div className="guest-form-field">
          <label htmlFor="checkout-check-in">Check-in</label>
          <input
            id="checkout-check-in"
            type="date"
            required
            value={checkIn}
            min={new Date().toISOString().split('T')[0]}
            onChange={e => setCheckIn(e.target.value)}
          />
        </div>
        <div className="guest-form-field">
          <label htmlFor="checkout-check-out">Check-out</label>
          <input
            id="checkout-check-out"
            type="date"
            required
            value={checkOut}
            min={checkIn || new Date().toISOString().split('T')[0]}
            onChange={e => setCheckOut(e.target.value)}
          />
        </div>
      </div>

      {!datesReady && (
        <p className="guest-checkout-hint">Choose your check-in and check-out dates to continue.</p>
      )}

      {datesReady && loadingRooms && <div className="guest-loading">Checking availability…</div>}

      {datesReady && roomsFetched && !selectedRoom && (
        <div className="guest-checkout-empty">
          <p>No rooms of this type are available for the selected dates.</p>
          <Link to="/rooms" className="guest-link-inline">Try different dates or another room →</Link>
        </div>
      )}

      {selectedRoom && (
        <>
          <div className="guest-checkout-summary">
            <h2>Booking Summary</h2>
            <div className="guest-checkout-summary-row">
              <span>Room Type</span>
              <strong>{selectedRoom.roomType.name}</strong>
            </div>
            <div className="guest-checkout-summary-row">
              <span>Room</span>
              <strong>{selectedRoom.roomNumber}</strong>
            </div>
            <div className="guest-checkout-summary-row">
              <span>Dates</span>
              <strong>{checkIn} → {checkOut} ({nights(checkIn, checkOut)} nights)</strong>
            </div>
            {selectedRatePlan && (
              <div className="guest-checkout-summary-row">
                <span>Rate</span>
                <strong>
                  ₦{Number(selectedRatePlan.pricePerNight).toLocaleString()} / night · ₦
                  {(Number(selectedRatePlan.pricePerNight) * nights(checkIn, checkOut)).toLocaleString()} total
                </strong>
              </div>
            )}
          </div>

          <form className="guest-contact-form" onSubmit={handleSubmit}>
            <GuestDetailsForm
              form={guestForm}
              onChange={setGuestForm}
              submitLabel="Confirm Booking"
              submitting={createBooking.isPending}
              disabled={!selectedRatePlan}
            />
            {createBooking.isError && (
              <p className="guest-checkout-error">
                {createBooking.error instanceof ApiError
                  ? createBooking.error.message
                  : 'Something went wrong. Please try again.'}
              </p>
            )}
          </form>
        </>
      )}
    </div>
  );
}

function TourCheckout({ tourId }: { tourId: string }) {
  const [selectedDepartureId, setSelectedDepartureId] = useState<string | null>(null);
  const [seats, setSeats] = useState(1);
  const [guestForm, setGuestForm] = useState<GuestFormState>(EMPTY_GUEST_FORM);

  const { data: tourPackagePage } = useQuery({
    queryKey: ['public-tour-package', tourId],
    queryFn: () =>
      api.get<PaginatedResponse<TourPackageDto>>(
        `/public/tour-packages?branchId=${GUEST_BRANCH_ID}&pageSize=100`,
      ),
    enabled: Boolean(GUEST_BRANCH_ID),
    retry: false,
  });
  const tourPackage = tourPackagePage?.data.find(p => p.id === tourId) ?? null;

  const { data: departures, isLoading, isFetched } = useQuery({
    queryKey: ['public-tour-departures', tourId],
    queryFn: () => api.get<TourDepartureDto[]>(`/public/tour-departures?tourPackageId=${tourId}`),
    retry: false,
  });

  useEffect(() => {
    if (departures?.length && !selectedDepartureId) {
      setSelectedDepartureId(departures[0].id);
    }
  }, [departures, selectedDepartureId]);

  const selectedDeparture = departures?.find(d => d.id === selectedDepartureId) ?? null;

  const createTourBooking = useMutation({
    mutationFn: () =>
      api.post<TourBookingDto>('/public/tour-bookings', {
        branchId: GUEST_BRANCH_ID,
        tourDepartureId: selectedDeparture!.id,
        seats,
        guest: {
          firstName: guestForm.firstName,
          lastName: guestForm.lastName,
          email: guestForm.email || undefined,
          phone: guestForm.phone || undefined,
        },
      }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createTourBooking.mutate();
  }

  if (createTourBooking.isSuccess) {
    const booking = createTourBooking.data;
    return (
      <div className="guest-form-success guest-checkout-confirmation">
        <CheckCircle2 size={32} strokeWidth={1.5} />
        <h2>Tour Booking Held!</h2>
        <p>
          {booking.seats} seat{booking.seats > 1 ? 's' : ''} held for{' '}
          <strong>{booking.tourDeparture.tourPackage.name}</strong>, departing{' '}
          {formatDateTime(booking.tourDeparture.departureAt)}.
        </p>
        <p className="guest-checkout-total">Total: ₦{Number(booking.totalAmount).toLocaleString()}</p>
        {booking.holdExpiresAt && (
          <p className="guest-checkout-hold-note">
            Please complete payment before the hold expires at {formatDateTime(booking.holdExpiresAt)} to secure your seats.
          </p>
        )}
        <Link to="/" className="guest-btn-primary">Back to Home</Link>
      </div>
    );
  }

  if (isLoading) return <div className="guest-loading">Loading upcoming departures…</div>;

  if (isFetched && !departures?.length) {
    return (
      <div className="guest-checkout-empty">
        <p>There are no upcoming departures scheduled for this tour right now.</p>
        <Link to="/contact" className="guest-link-inline">Contact us to arrange a private departure →</Link>
      </div>
    );
  }

  return (
    <div className="guest-checkout-inner">
      {tourPackage && (
        <div className="guest-checkout-item-card">
          <h2>{tourPackage.name}</h2>
          {tourPackage.description && <p className="guest-checkout-item-desc">{tourPackage.description}</p>}
          <div className="guest-checkout-item-meta">
            <span>{Math.round(tourPackage.durationMinutes / 60)}h tour</span>
            <span>From ₦{Number(tourPackage.defaultPricePerSeat).toLocaleString()} / person</span>
          </div>
        </div>
      )}

      <h2>Choose a Departure</h2>
      <div className="guest-checkout-departures">
        {departures?.map(d => (
          <label
            key={d.id}
            className={`guest-checkout-departure${selectedDepartureId === d.id ? ' selected' : ''}`}
          >
            <input
              type="radio"
              name="departure"
              checked={selectedDepartureId === d.id}
              onChange={() => setSelectedDepartureId(d.id)}
            />
            <div>
              <strong>{formatDateTime(d.departureAt)}</strong>
              <span>{d.availableSeats} seats left · ₦{Number(d.pricePerSeat).toLocaleString()} / person</span>
            </div>
          </label>
        ))}
      </div>

      {selectedDeparture && (
        <>
          <div className="guest-checkout-summary">
            <h2>Booking Summary</h2>
            <div className="guest-checkout-summary-row">
              <span>Tour</span>
              <strong>{selectedDeparture.tourPackage.name}</strong>
            </div>
            <div className="guest-checkout-summary-row">
              <span>Departure</span>
              <strong>{formatDateTime(selectedDeparture.departureAt)}</strong>
            </div>
            <div className="guest-form-field">
              <label htmlFor="checkout-seats">Number of Seats</label>
              <input
                id="checkout-seats"
                type="number"
                min={1}
                max={selectedDeparture.availableSeats}
                value={seats}
                onChange={e => setSeats(Math.max(1, Math.min(selectedDeparture.availableSeats, Number(e.target.value))))}
              />
            </div>
            <div className="guest-checkout-summary-row">
              <span>Total</span>
              <strong>₦{(Number(selectedDeparture.pricePerSeat) * seats).toLocaleString()}</strong>
            </div>
          </div>

          <form className="guest-contact-form" onSubmit={handleSubmit}>
            <GuestDetailsForm
              form={guestForm}
              onChange={setGuestForm}
              submitLabel="Confirm Booking"
              submitting={createTourBooking.isPending}
              disabled={selectedDeparture.availableSeats < 1}
            />
            {createTourBooking.isError && (
              <p className="guest-checkout-error">
                {createTourBooking.error instanceof ApiError
                  ? createTourBooking.error.message
                  : 'Something went wrong. Please try again.'}
              </p>
            )}
          </form>
        </>
      )}
    </div>
  );
}

export function CheckoutPage() {
  const [params] = useSearchParams();
  const roomTypeId = params.get('roomTypeId');
  const tourId = params.get('tourId');
  const checkIn = params.get('checkIn') ?? '';
  const checkOut = params.get('checkOut') ?? '';

  return (
    <>
      <section className="guest-page-hero">
        <div className="guest-hero-texture" aria-hidden="true" />
        <div className="guest-page-hero-content">
          <p className="guest-section-eyebrow">Almost There</p>
          <h1 className="guest-page-title">Checkout</h1>
          <p>Just a few details and your booking will be held for you.</p>
        </div>
      </section>

      <section className="guest-section">
        <div className="guest-section-inner guest-checkout-page">
          {roomTypeId && (
            <RoomCheckout roomTypeId={roomTypeId} initialCheckIn={checkIn} initialCheckOut={checkOut} />
          )}
          {!roomTypeId && tourId && <TourCheckout tourId={tourId} />}
          {!roomTypeId && !tourId && (
            <div className="guest-checkout-empty">
              <p>Nothing selected yet — browse our rooms or tours to get started.</p>
              <div className="guest-hero-ctas">
                <Link to="/rooms" className="guest-btn-primary">Explore Rooms</Link>
                <Link to="/tours" className="guest-btn-outline">Discover Tours</Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
