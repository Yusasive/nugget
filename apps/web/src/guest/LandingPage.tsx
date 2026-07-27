import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Globe, Utensils, Star, Shield, Leaf, Clock, Award,
} from 'lucide-react';
import { api } from '../lib/api-client';
import { GUEST_BRANCH_ID } from './guest-config';
import type { RoomTypeDto, TourPackageDto } from '@nugget/shared-types';

const FALLBACK_ROOMS = [
  { id: 'f1', name: 'Deluxe Room', description: 'Spacious comfort with city views and premium amenities.', price: '45,000' },
  { id: 'f2', name: 'Executive Suite', description: 'A refined retreat with a separate living area and butler service.', price: '85,000' },
  { id: 'f3', name: 'Presidential Suite', description: 'The pinnacle of luxury — panoramic views and bespoke furnishings.', price: '150,000' },
];

const FALLBACK_TOURS = [
  { id: 'f1', name: 'Sahel Discovery', description: '3-day guided journey through the Sahel landscape and ancient trade routes.', price: '65,000' },
  { id: 'f2', name: 'Argungu Cultural Tour', description: 'Immerse yourself in the legendary Argungu Fishing Festival and local heritage.', price: '45,000' },
  { id: 'f3', name: 'Zuma Rock Expedition', description: 'A full-day guided hike and photography tour around the iconic Zuma Rock.', price: '25,000' },
];

const REVIEWS = [
  {
    name: 'Amina B.',
    rating: 5,
    text: "The most comfortable stay I've had in Kaduna. The staff were incredibly attentive and the rooms were immaculate.",
    date: 'June 2025',
  },
  {
    name: 'Chukwuemeka O.',
    rating: 5,
    text: 'Booked the Sahel Discovery tour and it exceeded every expectation. Professional guides, beautiful landscapes.',
    date: 'May 2025',
  },
  {
    name: 'Fatima A.',
    rating: 5,
    text: 'The restaurant alone is worth the visit. Authentic Northern Nigerian cuisine with a refined touch.',
    date: 'April 2025',
  },
];

const PILLARS = [
  { icon: <Shield size={24} strokeWidth={1.5} />, title: 'Heritage & Character', body: 'A growing tradition of hospitality, expressed in every detail of your stay.' },
  { icon: <Leaf size={24} strokeWidth={1.5} />, title: 'Local Roots', body: 'Authentic Northern Nigerian cuisine, culture, and guided experiences — not a generic hotel chain.' },
  { icon: <Clock size={24} strokeWidth={1.5} />, title: 'Unhurried Service', body: 'No countdown timers, no pressure. Just attentive, personal care at your pace.' },
  { icon: <Award size={24} strokeWidth={1.5} />, title: 'Trusted Excellence', body: 'Consistently rated among the finest properties in the region by returning guests.' },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="guest-stars" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={14} className={i < rating ? 'star filled' : 'star'} />
      ))}
    </span>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('1');

  const { data: roomTypesData } = useQuery({
    queryKey: ['public-room-types'],
    queryFn: () => api.get<RoomTypeDto[]>(`/public/room-types?branchId=${GUEST_BRANCH_ID}`),
    retry: false,
    enabled: Boolean(GUEST_BRANCH_ID),
  });

  const { data: toursData } = useQuery({
    queryKey: ['public-tours'],
    queryFn: () => api.get<TourPackageDto[]>(`/public/tour-packages?branchId=${GUEST_BRANCH_ID}`),
    retry: false,
    enabled: Boolean(GUEST_BRANCH_ID),
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (checkIn) params.set('checkIn', checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    if (guests) params.set('guests', guests);
    navigate(`/rooms?${params.toString()}`);
  }

  const roomTypes: RoomTypeDto[] = (roomTypesData ?? []).slice(0, 3);
  const tours: TourPackageDto[] = (toursData ?? []).slice(0, 3);

  return (
    <>
      {/* ── Hero ── */}
      <section className="guest-hero">
        <div className="guest-hero-photo" aria-hidden="true" />
        <div className="guest-hero-texture" aria-hidden="true" />
        <div className="guest-hero-content">
          <img src="/images/logo-mark.jpg" alt="Nugget Continental Hotel & Tours" className="guest-hero-logo" />
          <p className="guest-hero-eyebrow">Welcome to</p>
          <h1 className="guest-hero-title">Nugget Continental<br />Hotel &amp; Tours</h1>
          <p className="guest-hero-subtitle">
            A heritage of warmth and excellence, rooted in the heart of Northern Nigeria.
          </p>
          <div className="guest-hero-ctas">
            <Link to="/rooms" className="guest-btn-primary guest-btn-lg">Explore Rooms</Link>
            <Link to="/tours" className="guest-btn-outline guest-btn-lg">Discover Tours</Link>
          </div>
        </div>

        {/* ── Search widget ── */}
        <form className="guest-search-widget" onSubmit={handleSearch}>
          <div className="guest-search-field">
            <label htmlFor="check-in">Check-in</label>
            <input
              id="check-in"
              type="date"
              value={checkIn}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setCheckIn(e.target.value)}
            />
          </div>
          <div className="guest-search-field">
            <label htmlFor="check-out">Check-out</label>
            <input
              id="check-out"
              type="date"
              value={checkOut}
              min={checkIn || new Date().toISOString().split('T')[0]}
              onChange={e => setCheckOut(e.target.value)}
            />
          </div>
          <div className="guest-search-field">
            <label htmlFor="guests">Guests</label>
            <select id="guests" value={guests} onChange={e => setGuests(e.target.value)}>
              {[1, 2, 3, 4].map(n => (
                <option key={n} value={n}>{n} {n === 1 ? 'Guest' : 'Guests'}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="guest-btn-primary guest-search-btn">
            Check Availability
          </button>
        </form>
      </section>

      {/* ── Stats bar ── */}
      <div className="guest-stats-bar">
        <div className="guest-stats-bar-inner">
          {[
            { value: '51', label: 'Rooms & Suites' },
            { value: '24/7', label: 'Power & Front Desk' },
            { value: '3', label: 'Dining & Leisure Spots' },
            { value: '98%', label: 'Guest Satisfaction' },
          ].map(s => (
            <div key={s.label} className="guest-stats-bar-item">
              <span className="guest-stats-bar-value">{s.value}</span>
              <span className="guest-stats-bar-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Rooms ── */}
      <section className="guest-section">
        <div className="guest-section-inner">
          <div className="guest-section-header guest-animate">
            <div>
              <p className="guest-section-eyebrow">Accommodations</p>
              <h2 className="guest-section-title">Rooms &amp; Suites</h2>
            </div>
            <Link to="/rooms" className="guest-link-arrow">View all rooms →</Link>
          </div>

          <div className="guest-card-grid">
            {(roomTypes.length > 0
              ? roomTypes.map(rt => ({ id: rt.id, name: rt.name, description: rt.description, price: null, linkTo: `/rooms?type=${rt.id}` }))
              : FALLBACK_ROOMS.map(r => ({ id: r.id, name: r.name, description: r.description, price: r.price, linkTo: '/rooms' }))
            ).map(r => (
              <Link key={r.id} to={r.linkTo} className="guest-room-card">
                <div className="guest-room-card-img">
                  <div
                    className="guest-room-card-img-placeholder has-image"
                    style={{ backgroundImage: 'url(/images/room-bedroom.jpg)' }}
                    aria-hidden="true"
                  />
                </div>
                <div className="guest-room-card-body">
                  <h3>{r.name}</h3>
                  {r.description && <p className="guest-room-card-desc">{r.description}</p>}
                  <div className="guest-room-card-footer">
                    {r.price && (
                      <span className="guest-room-price">
                        <span className="guest-room-price-amount">₦{r.price}</span>
                        <span className="guest-room-price-per"> / night</span>
                      </span>
                    )}
                    <span className="guest-link-arrow">Book →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why us ── */}
      <section className="guest-section guest-section-dark">
        <div className="guest-hero-texture" aria-hidden="true" />
        <div className="guest-section-inner">
          <div className="guest-section-header centered">
            <div>
              <p className="guest-section-eyebrow">The Nugget Difference</p>
              <h2 className="guest-section-title">Why Guests Return</h2>
            </div>
          </div>
          <div className="guest-pillars">
            {PILLARS.map(p => (
              <div key={p.title} className="guest-pillar">
                <span className="guest-pillar-icon" aria-hidden="true">{p.icon}</span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tours ── */}
      <section className="guest-section">
        <div className="guest-section-inner">
          <div className="guest-section-header guest-animate">
            <div>
              <p className="guest-section-eyebrow">Experiences</p>
              <h2 className="guest-section-title">Tour Packages</h2>
            </div>
            <Link to="/tours" className="guest-link-arrow">View all tours →</Link>
          </div>

          <div className="guest-card-grid">
            {(tours.length > 0
              ? tours.map(t => ({ id: t.id, name: t.name, description: t.description, price: Number(t.defaultPricePerSeat).toLocaleString(), linkTo: '/tours' }))
              : FALLBACK_TOURS.map(t => ({ id: t.id, name: t.name, description: t.description, price: t.price, linkTo: '/tours' }))
            ).map(t => (
              <Link key={t.id} to={t.linkTo} className="guest-tour-card">
                <div className="guest-tour-card-img">
                  <div className="guest-room-card-img-placeholder" aria-hidden="true">
                    <Globe size={48} strokeWidth={1} />
                  </div>
                </div>
                <div className="guest-room-card-body">
                  <h3>{t.name}</h3>
                  {t.description && <p className="guest-room-card-desc">{t.description}</p>}
                  <div className="guest-room-card-footer">
                    <span className="guest-room-price">
                      <span className="guest-room-price-amount">₦{t.price}</span>
                      <span className="guest-room-price-per"> / person</span>
                    </span>
                    <span className="guest-link-arrow">Details →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Restaurant teaser ── */}
      <section className="guest-section guest-restaurant-teaser">
        <div className="guest-section-inner guest-restaurant-inner">
          <div className="guest-restaurant-text">
            <p className="guest-section-eyebrow">Dining</p>
            <h2 className="guest-section-title">The Continental Kitchen</h2>
            <p className="guest-restaurant-body">
              Authentic Northern Nigerian cuisine elevated with refined technique. From slow-cooked
              tuwo shinkafa to grilled suya platters — every dish tells a story of the land.
            </p>
            <Link to="/restaurant" className="guest-btn-primary">View Menu</Link>
          </div>
          <div className="guest-restaurant-visual" aria-hidden="true">
            <div className="guest-restaurant-emblem">
              <Utensils size={72} strokeWidth={1} color="var(--gold-500)" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Reviews ── */}
      <section className="guest-section">
        <div className="guest-section-inner">
          <div className="guest-section-header centered">
            <div>
              <p className="guest-section-eyebrow">Guest Stories</p>
              <h2 className="guest-section-title">What Our Guests Say</h2>
            </div>
          </div>
          <div className="guest-reviews-grid">
            {REVIEWS.map(r => (
              <div key={r.name} className="guest-review-card">
                <StarRating rating={r.rating} />
                <p className="guest-review-text">"{r.text}"</p>
                <div className="guest-review-meta">
                  <strong>{r.name}</strong>
                  <span>{r.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="guest-cta-banner">
        <div className="guest-hero-texture" aria-hidden="true" />
        <div className="guest-cta-inner">
          <h2>Ready to experience Nugget Continental?</h2>
          <p>Reserve your room today and let us take care of the rest.</p>
          <Link to="/rooms" className="guest-btn-primary guest-btn-lg">Book Your Stay</Link>
        </div>
      </section>
    </>
  );
}
