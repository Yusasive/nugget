import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import type { TourBookingStatus, TourManifestDto } from '@nugget/shared-types';
import { api } from '../lib/api-client';

const STATUS_PILL: Record<TourBookingStatus, string> = {
  HELD: 'info',
  CONFIRMED: 'success',
  CANCELLED: 'error',
  EXPIRED: 'error',
};

/** PRD §5.8's manifest view: the guest list for one tour departure. */
export function TourManifestPage() {
  const { departureId } = useParams<{ departureId: string }>();

  const manifest = useQuery({
    queryKey: ['tour-manifest', departureId],
    queryFn: () => api.get<TourManifestDto>(`/tour-departures/${departureId}/manifest`),
    enabled: !!departureId,
  });

  if (manifest.isPending) return <p className="muted">Loading manifest…</p>;
  if (manifest.isError || !manifest.data) {
    return <div className="alert error">Could not load the manifest.</div>;
  }

  const { tourDeparture, entries, totalSeatsBooked } = manifest.data;

  return (
    <>
      <div className="page-header">
        <h2>Tour Manifest</h2>
        <Link className="btn-link" to="/app/tour-departures">
          Back to departures
        </Link>
      </div>

      <div className="card-grid" style={{ marginBottom: 'var(--gutter)' }}>
        <div className="metric-card">
          <div className="label">Package</div>
          <div className="value">{tourDeparture.tourPackage.name}</div>
        </div>
        <div className="metric-card">
          <div className="label">Departs</div>
          <div className="value">{new Date(tourDeparture.departureAt).toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <div className="label">Guide / Vehicle</div>
          <div className="value">
            {tourDeparture.guide.fullName} / {tourDeparture.vehicle.name}
          </div>
        </div>
        <div className="metric-card">
          <div className="label">Seats booked</div>
          <div className="value">
            {totalSeatsBooked} / {tourDeparture.totalSeats}
          </div>
        </div>
      </div>

      <h3>Guests</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Guest</th>
              <th>Contact</th>
              <th>Seats</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No guests booked on this departure yet.
                </td>
              </tr>
            )}
            {entries.map((entry) => (
              <tr key={entry.tourBookingId}>
                <td>
                  {entry.guest.firstName} {entry.guest.lastName}
                </td>
                <td className="muted">{entry.guest.email ?? entry.guest.phone ?? '—'}</td>
                <td>{entry.seats}</td>
                <td>
                  <span className={`pill ${STATUS_PILL[entry.status]}`}>{entry.status}</span>
                </td>
                <td className="muted">{entry.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
