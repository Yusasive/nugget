export function GuestAboutPage() {
  return (
    <>
      <section className="guest-page-hero">
        <div className="guest-hero-texture" aria-hidden="true" />
        <div className="guest-page-hero-content">
          <p className="guest-section-eyebrow">Our Story</p>
          <h1 className="guest-page-title">About Nugget Continental</h1>
        </div>
      </section>

      <section className="guest-section">
        <div className="guest-section-inner guest-about-inner">
          <div className="guest-about-text">
            <h2>A Heritage of Warmth</h2>
            <p>
              Nugget Continental Hotel &amp; Tours was founded on a simple belief: that genuine
              hospitality is not a service — it is a relationship. Since our founding, we have
              welcomed guests from across Nigeria and the world, offering them not just a room,
              but a home away from home in the heart of Northern Nigeria.
            </p>
            <p>
              Our name carries the weight of that promise. A nugget is rare, precious, and
              worth seeking out. We hold ourselves to that standard in every interaction —
              from the warmth of our front desk to the craft of our kitchen.
            </p>
            <h2>Our Mission</h2>
            <p>
              To be the most trusted hospitality brand in Northern Nigeria — one that celebrates
              local culture, supports local communities, and delivers an experience that guests
              return to, year after year.
            </p>
            <h2>Our Values</h2>
            <ul className="guest-values-list">
              {[
                ['Warmth', 'Every guest is treated as a personal guest, not a transaction.'],
                ['Authenticity', 'We celebrate Northern Nigerian culture — in our food, our tours, and our design.'],
                ['Excellence', 'We hold ourselves to the highest standard, without the pretension.'],
                ['Restraint', 'No gimmicks, no pressure. Trust is built through consistency.'],
              ].map(([title, body]) => (
                <li key={title}>
                  <strong>{title}:</strong> {body}
                </li>
              ))}
            </ul>
          </div>
          <div className="guest-about-visual" aria-hidden="true">
            <div className="guest-about-emblem">
              <span className="guest-emblem-icon">✦</span>
              <span className="guest-emblem-text">Est. 2020</span>
            </div>
          </div>
        </div>
      </section>

      <section className="guest-section guest-section-dark">
        <div className="guest-hero-texture" aria-hidden="true" />
        <div className="guest-section-inner">
          <div className="guest-section-header centered">
            <div>
              <p className="guest-section-eyebrow">By the Numbers</p>
              <h2 className="guest-section-title">Property at a Glance</h2>
            </div>
          </div>
          <div className="guest-stats-grid">
            {[
              { value: '51', label: 'Rooms & Suites' },
              { value: '24/7', label: 'Power & Front Desk' },
              { value: '3', label: 'Dining & Leisure Spots' },
              { value: '98%', label: 'Guest Satisfaction' },
            ].map(s => (
              <div key={s.label} className="guest-stat">
                <span className="guest-stat-value">{s.value}</span>
                <span className="guest-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
