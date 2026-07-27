import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Globe, Users, Clock } from 'lucide-react';
import { api } from '../lib/api-client';
import { GUEST_BRANCH_ID } from './guest-config';
import type { TourPackageDto } from '@nugget/shared-types';

const FALLBACK = [
  { id: 'f1', name: 'Sahel Discovery', description: '3-day guided journey through the Sahel landscape and ancient trade routes of Northern Nigeria.', defaultPricePerSeat: '65000', defaultCapacity: 12, durationMinutes: 4320 },
  { id: 'f2', name: 'Argungu Cultural Tour', description: 'Immerse yourself in the legendary Argungu Fishing Festival heritage and local village life.', defaultPricePerSeat: '45000', defaultCapacity: 16, durationMinutes: 2880 },
  { id: 'f3', name: 'Zuma Rock Expedition', description: 'A full-day guided hike and photography tour around the iconic Zuma Rock monolith.', defaultPricePerSeat: '25000', defaultCapacity: 20, durationMinutes: 480 },
  { id: 'f4', name: 'Kano Ancient City Walk', description: 'Explore the ancient walls, dye pits, and markets of Kano with an expert local guide.', defaultPricePerSeat: '30000', defaultCapacity: 15, durationMinutes: 360 },
  { id: 'f5', name: 'Yankari Wildlife Safari', description: 'Two days in Yankari National Park — elephants, baboons, and the warm springs of Wikki.', defaultPricePerSeat: '75000', defaultCapacity: 10, durationMinutes: 2880 },
  { id: 'f6', name: 'Gashaka-Gumti Trek', description: "A challenging multi-day trek through Nigeria's largest national park and highest peaks.", defaultPricePerSeat: '95000', defaultCapacity: 8, durationMinutes: 5760 },
];

function formatDuration(minutes: number) {
  const days = Math.round(minutes / 60 / 24);
  if (days >= 1) return `${days} ${days === 1 ? 'Day' : 'Days'}`;
  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}

export function GuestToursPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['public-tours-all'],
    queryFn: () => api.get<TourPackageDto[]>(`/public/tour-packages?branchId=${GUEST_BRANCH_ID}`),
    retry: false,
    enabled: Boolean(GUEST_BRANCH_ID),
  });

  const tours: typeof FALLBACK = (data?.length ?? 0) > 0
    ? (data as unknown as typeof FALLBACK)
    : FALLBACK;

  return (
    <>
      <section className="guest-page-hero">
        <div className="guest-hero-texture" aria-hidden="true" />
        <div className="guest-page-hero-content">
          <p className="guest-section-eyebrow">Experiences</p>
          <h1 className="guest-page-title">Tour Packages</h1>
          <p>Guided journeys through the landscapes, culture, and heritage of Northern Nigeria.</p>
        </div>
      </section>

      <section className="guest-section">
        <div className="guest-section-inner">
          {isLoading ? (
            <div className="guest-loading">Loading tours…</div>
          ) : (
            <div className="guest-card-grid">
              {tours.map(t => (
                <div key={t.id} className="guest-tour-card">
                  <div className="guest-tour-card-img">
                    <div className="guest-room-card-img-placeholder" aria-hidden="true">
                      <Globe size={48} strokeWidth={1} />
                    </div>
                    <div className="guest-tour-badge">
                      <Clock size={11} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                      {formatDuration(t.durationMinutes)}
                    </div>
                  </div>
                  <div className="guest-room-card-body">
                    <h3>{t.name}</h3>
                    <p className="guest-room-card-desc">{t.description}</p>
                    <div className="guest-tour-meta">
                      <Users size={14} strokeWidth={2} />
                      <span>Max {t.defaultCapacity} guests</span>
                    </div>
                    <div className="guest-room-card-footer">
                      <span className="guest-room-price">
                        <span className="guest-room-price-amount">
                          ₦{Number(t.defaultPricePerSeat).toLocaleString()}
                        </span>
                        <span className="guest-room-price-per"> / person</span>
                      </span>
                      <Link to={`/checkout?tourId=${t.id}`} className="guest-btn-primary guest-btn-sm">
                        Book
                      </Link>
                    </div>
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
