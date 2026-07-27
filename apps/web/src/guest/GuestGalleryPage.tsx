import { useEffect, useState } from 'react';
import {
  BedDouble, UtensilsCrossed, Sunset, Trees,
  Building2, X,
} from 'lucide-react';

const GALLERY_ITEMS = [
  { label: 'Hotel Exterior', icon: <Building2 size={40} strokeWidth={1} />, span: 'wide', image: '/images/exterior-evening.jpg' },
  { label: 'Guest Room', icon: <BedDouble size={40} strokeWidth={1} />, span: '', image: '/images/room-bedroom.jpg' },
  { label: 'Banquet Hall', icon: <UtensilsCrossed size={40} strokeWidth={1} />, span: '', image: '/images/banquet-hall.jpg' },
  { label: 'The Continental Kitchen', icon: <UtensilsCrossed size={40} strokeWidth={1} />, span: '' },
  { label: 'Sahel Landscape', icon: <Sunset size={40} strokeWidth={1} />, span: 'wide' },
  { label: 'Zuma Rock', icon: <Sunset size={40} strokeWidth={1} />, span: '', image: '/images/zuma-rock.jpg' },
  { label: 'Argungu Festival', icon: <Sunset size={40} strokeWidth={1} />, span: '', image: '/images/argungu.jpg' },
  { label: 'Reception', icon: <Building2 size={40} strokeWidth={1} />, span: '', image: '/images/reception.jpg' },
  { label: 'Pool & Gardens', icon: <Trees size={40} strokeWidth={1} />, span: 'wide' },
  { label: 'Lounge & Games Room', icon: <Trees size={40} strokeWidth={1} />, span: '', image: '/images/lounge-games-room.jpg' },
  { label: 'Yankari Safari', icon: <Trees size={40} strokeWidth={1} />, span: '', image: '/images/yankari.jpg' },
  { label: 'Kano Ancient City', icon: <Building2 size={40} strokeWidth={1} />, span: '', image: '/images/kano-wall.jpg' },
  { label: 'Gashaka Trek', icon: <Trees size={40} strokeWidth={1} />, span: '', image: '/images/gashaka.jpg' },
];

export function GuestGalleryPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenIndex(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const openItem = openIndex !== null ? GALLERY_ITEMS[openIndex] : null;

  return (
    <>
      <section className="guest-page-hero">
        <div className="guest-hero-texture" aria-hidden="true" />
        <div className="guest-page-hero-content">
          <p className="guest-section-eyebrow">Visual Journey</p>
          <h1 className="guest-page-title">Photo Gallery</h1>
          <p>A glimpse into the spaces, flavours, and landscapes that define Nugget Continental.</p>
        </div>
      </section>

      <section className="guest-section">
        <div className="guest-section-inner">
          <div className="guest-gallery-grid">
            {GALLERY_ITEMS.map((item, i) => (
              <div
                key={item.label}
                className={`guest-gallery-tile${item.span ? ` ${item.span}` : ''}${item.image ? ' clickable' : ''}`}
                aria-label={item.label}
                role={item.image ? 'button' : undefined}
                tabIndex={item.image ? 0 : undefined}
                onClick={() => item.image && setOpenIndex(i)}
                onKeyDown={e => { if (item.image && (e.key === 'Enter' || e.key === ' ')) setOpenIndex(i); }}
              >
                <div
                  className={`guest-gallery-tile-inner${item.image ? ' has-image' : ''}`}
                  style={item.image ? { backgroundImage: `url(${item.image})` } : undefined}
                >
                  {!item.image && <span className="guest-gallery-emoji" aria-hidden="true">{item.icon}</span>}
                  <span className="guest-gallery-label">{item.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {openItem && (
        <div className="guest-lightbox" onClick={() => setOpenIndex(null)}>
          <button
            type="button"
            className="guest-lightbox-close"
            aria-label="Close"
            onClick={() => setOpenIndex(null)}
          >
            <X size={28} strokeWidth={1.5} />
          </button>
          <img src={openItem.image} alt={openItem.label} className="guest-lightbox-img" onClick={e => e.stopPropagation()} />
          <span className="guest-lightbox-label">{openItem.label}</span>
        </div>
      )}
    </>
  );
}
