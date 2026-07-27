import { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

export function GuestLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="guest-site">
      <header className={`guest-nav${scrolled ? ' scrolled' : ''}`}>
        <div className="guest-nav-inner">
          <Link to="/" className="guest-brand">
            <img src="/images/logo-mark.jpg" alt="" className="guest-brand-logo" />
            <span className="guest-brand-text">
              <span className="guest-brand-name">Nugget Continental</span>
              <span className="guest-brand-sub">Hotel &amp; Tours</span>
            </span>
          </Link>

          <nav className={`guest-nav-links${menuOpen ? ' open' : ''}`}>
            <NavLink to="/rooms" onClick={() => setMenuOpen(false)}>Rooms</NavLink>
            <NavLink to="/tours" onClick={() => setMenuOpen(false)}>Tours</NavLink>
            <NavLink to="/restaurant" onClick={() => setMenuOpen(false)}>Restaurant</NavLink>
            <NavLink to="/gallery" onClick={() => setMenuOpen(false)}>Gallery</NavLink>
            <NavLink to="/about" onClick={() => setMenuOpen(false)}>About</NavLink>
            <NavLink to="/contact" onClick={() => setMenuOpen(false)}>Contact</NavLink>
          </nav>

          <div className="guest-nav-actions">
            <button
              className="guest-btn-primary"
              onClick={() => { navigate('/rooms'); setMenuOpen(false); }}
            >
              Book Now
            </button>
            <button
              className="guest-hamburger"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(v => !v)}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="guest-footer">
        <div className="guest-footer-inner">
          <div className="guest-footer-brand">
            <img src="/images/logo-mark.jpg" alt="Nugget Continental Hotel & Tours" className="guest-footer-logo" />
            <span className="guest-brand-name">Nugget Continental</span>
            <span className="guest-brand-sub">Hotel &amp; Tours</span>
            <p>A heritage of warmth and excellence,<br />rooted in Northern Nigeria.</p>
          </div>
          <div className="guest-footer-links">
            <h4>Explore</h4>
            <Link to="/rooms">Rooms &amp; Suites</Link>
            <Link to="/tours">Tour Packages</Link>
            <Link to="/restaurant">Restaurant</Link>
            <Link to="/gallery">Gallery</Link>
          </div>
          <div className="guest-footer-links">
            <h4>Company</h4>
            <Link to="/about">About Us</Link>
            <Link to="/contact">Contact</Link>
          </div>
          <div className="guest-footer-contact">
            <h4>Contact</h4>
            <p>No. 3 Umar Kaoje Street<br />Gesse Phase 1, Birnin Kebbi<br />Kebbi State, Nigeria</p>
            <p>+234 816 820 7500<br />+234 916 440 6700</p>
            <p>hello@nuggetcontinental.com</p>
          </div>
        </div>
        <div className="guest-footer-bottom">
          <span>© {new Date().getFullYear()} Nugget Continental Hotel &amp; Tours. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
