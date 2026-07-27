import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BedDouble, Wifi, Wind, Tv, Users } from 'lucide-react';
import { api } from '../lib/api-client';
import { GUEST_BRANCH_ID } from './guest-config';
import type { RoomTypeDto } from '@nugget/shared-types';

const AMENITY_ICONS = [
  { label: 'King Bed', icon: <BedDouble size={14} strokeWidth={2} /> },
  { label: 'Free Wi-Fi', icon: <Wifi size={14} strokeWidth={2} /> },
  { label: 'Air Conditioning', icon: <Wind size={14} strokeWidth={2} /> },
  { label: 'Flat-screen TV', icon: <Tv size={14} strokeWidth={2} /> },
];

const FALLBACK: { id: string; name: string; description: string; price: string; maxOccupancy: number }[] = [
  { id: 'f1', name: 'Standard Room', description: 'Comfortable and well-appointed for the business or leisure traveller.', price: '35,000', maxOccupancy: 2 },
  { id: 'f2', name: 'Deluxe Room', description: 'Spacious comfort with city views and premium amenities.', price: '45,000', maxOccupancy: 2 },
  { id: 'f3', name: 'Junior Suite', description: 'A generous suite with a separate seating area and upgraded bath.', price: '65,000', maxOccupancy: 3 },
  { id: 'f4', name: 'Executive Suite', description: 'A refined retreat with a separate living area and butler service.', price: '85,000', maxOccupancy: 3 },
  { id: 'f5', name: 'Presidential Suite', description: 'The pinnacle of luxury — panoramic views and bespoke furnishings.', price: '150,000', maxOccupancy: 4 },
];

export function GuestRoomsPage() {
  const [params] = useSearchParams();
  const checkIn = params.get('checkIn') ?? '';
  const checkOut = params.get('checkOut') ?? '';

  const { data, isLoading } = useQuery({
    queryKey: ['public-room-types-all'],
    queryFn: () => api.get<RoomTypeDto[]>(`/public/room-types?branchId=${GUEST_BRANCH_ID}`),
    retry: false,
    enabled: Boolean(GUEST_BRANCH_ID),
  });

  const roomTypes = data ?? [];

  const rooms = roomTypes.length > 0
    ? roomTypes.map(rt => ({
        id: rt.id,
        name: rt.name,
        description: rt.description,
        price: null as string | null,
        maxOccupancy: rt.maxOccupancy,
      }))
    : FALLBACK;

  return (
    <>
      <section className="guest-page-hero">
        <div className="guest-hero-texture" aria-hidden="true" />
        <div className="guest-page-hero-content">
          <p className="guest-section-eyebrow">Accommodations</p>
          <h1 className="guest-page-title">Rooms &amp; Suites</h1>
          <p>Every room is a considered space — designed for rest, not just sleep.</p>
        </div>
      </section>

      {(checkIn || checkOut) && (
        <div className="guest-search-summary">
          <div className="guest-section-inner">
            <p>
              Showing availability
              {checkIn && <> from <strong>{checkIn}</strong></>}
              {checkOut && <> to <strong>{checkOut}</strong></>}.{' '}
              <Link to="/rooms" className="guest-link-inline">Clear dates</Link>
            </p>
          </div>
        </div>
      )}

      <section className="guest-section">
        <div className="guest-section-inner">
          {isLoading ? (
            <div className="guest-loading">Loading rooms…</div>
          ) : (
            <div className="guest-rooms-list">
              {rooms.map(rt => (
                <div key={rt.id} className="guest-room-row">
                  <div className="guest-room-row-img">
                    <div
                      className="guest-room-card-img-placeholder large has-image"
                      style={{ backgroundImage: 'url(/images/room-bedroom.jpg)' }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="guest-room-row-body">
                    <h2>{rt.name}</h2>
                    {rt.description && <p className="guest-room-card-desc">{rt.description}</p>}
                    <ul className="guest-amenities">
                      {AMENITY_ICONS.map(a => (
                        <li key={a.label}>
                          <span aria-hidden="true">{a.icon}</span> {a.label}
                        </li>
                      ))}
                      <li>
                        <span aria-hidden="true"><Users size={14} strokeWidth={2} /></span>
                        Up to {rt.maxOccupancy} guests
                      </li>
                    </ul>
                  </div>
                  <div className="guest-room-row-cta">
                    {rt.price && (
                      <div className="guest-room-price stacked">
                        <span className="guest-room-price-amount">₦{rt.price}</span>
                        <span className="guest-room-price-per">per night</span>
                      </div>
                    )}
                    <Link
                      to={`/checkout?roomTypeId=${rt.id}${checkIn ? `&checkIn=${checkIn}` : ''}${checkOut ? `&checkOut=${checkOut}` : ''}`}
                      className="guest-btn-primary"
                    >
                      Book Now
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
