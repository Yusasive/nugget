import { useState } from 'react';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';

const CONTACT_DETAILS = [
  {
    icon: <MapPin size={20} strokeWidth={1.5} />,
    label: 'Main Branch',
    value: "No. 3 Umar Kaoje Street, Gesse Phase 1\nBirnin Kebbi, Kebbi State, Nigeria",
  },
  {
    icon: <Phone size={20} strokeWidth={1.5} />,
    label: 'Phone',
    value: '+234 816 820 7500\n+234 916 440 6700',
  },
  {
    icon: <Mail size={20} strokeWidth={1.5} />,
    label: 'Email',
    value: 'hello@nuggetcontinental.com',
  },
  {
    icon: <Clock size={20} strokeWidth={1.5} />,
    label: 'Front Desk Hours',
    value: '24 hours, 7 days a week',
  },
];

export function GuestContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <>
      <section className="guest-page-hero">
        <div className="guest-hero-texture" aria-hidden="true" />
        <div className="guest-page-hero-content">
          <p className="guest-section-eyebrow">Get in Touch</p>
          <h1 className="guest-page-title">Contact Us</h1>
          <p>We'd love to hear from you. Reach out for reservations, enquiries, or feedback.</p>
        </div>
      </section>

      <section className="guest-section">
        <div className="guest-section-inner guest-contact-inner">
          <div className="guest-contact-info">
            <h2>Visit Us</h2>
            {CONTACT_DETAILS.map(d => (
              <div key={d.label} className="guest-contact-detail">
                <span className="guest-contact-icon" aria-hidden="true">{d.icon}</span>
                <div>
                  <strong>{d.label}</strong>
                  <p>{d.value}</p>
                </div>
              </div>
            ))}
            <div className="guest-map-embed">
              <iframe
                title="Nugget Continental Hotel & Tours location"
                src="https://www.google.com/maps?q=Nugget+Continental+Hotel+%26+Tours,+Birnin+Kebbi&ll=12.4624091,4.2203912&z=16&output=embed"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>

          <div className="guest-contact-form-wrap">
            <h2>Send a Message</h2>
            {sent ? (
              <div className="guest-form-success">
                <Mail size={20} strokeWidth={2} />
                <p>Thank you for reaching out. We'll be in touch within 24 hours.</p>
              </div>
            ) : (
              <form className="guest-contact-form" onSubmit={handleSubmit}>
                <div className="guest-form-field">
                  <label htmlFor="contact-name">Full Name</label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Your name"
                  />
                </div>
                <div className="guest-form-field">
                  <label htmlFor="contact-email">Email Address</label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="guest-form-field">
                  <label htmlFor="contact-subject">Subject</label>
                  <input
                    id="contact-subject"
                    type="text"
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="Reservation enquiry, feedback…"
                  />
                </div>
                <div className="guest-form-field">
                  <label htmlFor="contact-message">Message</label>
                  <textarea
                    id="contact-message"
                    required
                    rows={5}
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="How can we help?"
                  />
                </div>
                <button type="submit" className="guest-btn-primary guest-btn-full">
                  Send Message
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
