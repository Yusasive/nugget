import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type {
  PaginatedResponse,
  TourDepartureDto,
  TourDepartureStatus,
  TourGuideDto,
  TourPackageDto,
  VehicleDto,
} from '@nugget/shared-types';
import { useAuth } from '../auth/auth-context';
import { Drawer } from '../components/Drawer';
import { Pagination } from '../components/Pagination';
import { api, ApiError } from '../lib/api-client';

const EMPTY_FORM = {
  tourPackageId: '',
  guideId: '',
  vehicleId: '',
  departureAt: '',
  returnAt: '',
  totalSeats: '',
  pricePerSeat: '',
};
const EMPTY_FILTERS = { status: '' as TourDepartureStatus | '', tourPackageId: '' };

const STATUS_PILL: Record<TourDepartureStatus, string> = {
  SCHEDULED: 'success',
  CANCELLED: 'error',
  COMPLETED: 'info',
};

export function TourDeparturesPage() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canManage = staff?.role === 'SUPER_ADMIN' || staff?.role === 'TOURS_COORDINATOR';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const departures = useQuery({
    queryKey: ['tour-departures', page, filters.status, filters.tourPackageId],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (filters.status) params.set('status', filters.status);
      if (filters.tourPackageId) params.set('tourPackageId', filters.tourPackageId);
      return api.get<PaginatedResponse<TourDepartureDto>>(`/tour-departures?${params}`);
    },
  });

  const packages = useQuery({
    queryKey: ['tour-packages', 'all'],
    queryFn: () => api.get<PaginatedResponse<TourPackageDto>>('/tour-packages?pageSize=100&isActive=true'),
  });

  const guides = useQuery({
    queryKey: ['tour-guides', 'all'],
    queryFn: () => api.get<PaginatedResponse<TourGuideDto>>('/tour-guides?pageSize=100&isActive=true'),
    enabled: drawerOpen,
  });

  const vehicles = useQuery({
    queryKey: ['vehicles', 'all'],
    queryFn: () => api.get<PaginatedResponse<VehicleDto>>('/vehicles?pageSize=100&isActive=true'),
    enabled: drawerOpen,
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<TourDepartureDto>('/tour-departures', {
        tourPackageId: form.tourPackageId,
        guideId: form.guideId,
        vehicleId: form.vehicleId,
        departureAt: new Date(form.departureAt).toISOString(),
        returnAt: new Date(form.returnAt).toISOString(),
        totalSeats: form.totalSeats ? Number(form.totalSeats) : undefined,
        pricePerSeat: form.pricePerSeat || undefined,
      }),
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ['tour-departures'] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Could not schedule departure'),
  });

  const cancelDeparture = useMutation({
    mutationFn: (departure: TourDepartureDto) =>
      api.post<TourDepartureDto>(`/tour-departures/${departure.id}/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tour-departures'] }),
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

  return (
    <>
      <div className="page-header">
        <h2>Tour Departures</h2>
        {canManage && (
          <button type="button" className="btn-primary" onClick={() => setDrawerOpen(true)}>
            Schedule departure
          </button>
        )}
      </div>

      {canManage && (
        <Drawer open={drawerOpen} title="Schedule a departure" onClose={closeDrawer}>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <form className="form-card" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="td-package">Tour package</label>
              <select
                id="td-package"
                required
                value={form.tourPackageId}
                onChange={(e) => setForm({ ...form, tourPackageId: e.target.value })}
              >
                <option value="">Select…</option>
                {packages.data?.data.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="td-guide">Guide</label>
              <select
                id="td-guide"
                required
                value={form.guideId}
                onChange={(e) => setForm({ ...form, guideId: e.target.value })}
              >
                <option value="">Select…</option>
                {guides.data?.data.map((guide) => (
                  <option key={guide.id} value={guide.id}>
                    {guide.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="td-vehicle">Vehicle</label>
              <select
                id="td-vehicle"
                required
                value={form.vehicleId}
                onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
              >
                <option value="">Select…</option>
                {vehicles.data?.data.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name} ({vehicle.capacity} seats)
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="td-departure">Departs</label>
              <input
                id="td-departure"
                type="datetime-local"
                required
                value={form.departureAt}
                onChange={(e) => setForm({ ...form, departureAt: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="td-return">Returns</label>
              <input
                id="td-return"
                type="datetime-local"
                required
                value={form.returnAt}
                onChange={(e) => setForm({ ...form, returnAt: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="td-seats">Seats (optional — defaults to the package's default capacity)</label>
              <input
                id="td-seats"
                type="number"
                min={1}
                value={form.totalSeats}
                onChange={(e) => setForm({ ...form, totalSeats: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="td-price">Price per seat (optional — defaults to the package's default price)</label>
              <input
                id="td-price"
                inputMode="decimal"
                placeholder="0.00"
                value={form.pricePerSeat}
                onChange={(e) => setForm({ ...form, pricePerSeat: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Scheduling…' : 'Schedule departure'}
            </button>
          </form>
        </Drawer>
      )}

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="td-filter-package">Package</label>
          <select
            id="td-filter-package"
            value={filters.tourPackageId}
            onChange={(e) => updateFilter({ tourPackageId: e.target.value })}
          >
            <option value="">All</option>
            {packages.data?.data.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="td-filter-status">Status</label>
          <select
            id="td-filter-status"
            value={filters.status}
            onChange={(e) => updateFilter({ status: e.target.value as TourDepartureStatus | '' })}
          >
            <option value="">All</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="COMPLETED">Completed</option>
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

      {departures.isPending && <p className="muted">Loading departures…</p>}
      {departures.isError && <div className="alert error">Could not load tour departures.</div>}

      {departures.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Guide</th>
                  <th>Vehicle</th>
                  <th>Departs</th>
                  <th>Returns</th>
                  <th>Seats</th>
                  <th>Price/seat</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {departures.data.data.length === 0 && (
                  <tr>
                    <td colSpan={9} className="muted">
                      No departures match these filters.
                    </td>
                  </tr>
                )}
                {departures.data.data.map((departure) => (
                  <tr key={departure.id}>
                    <td>{departure.tourPackage.name}</td>
                    <td>{departure.guide.fullName}</td>
                    <td>{departure.vehicle.name}</td>
                    <td>{new Date(departure.departureAt).toLocaleString()}</td>
                    <td>{new Date(departure.returnAt).toLocaleString()}</td>
                    <td>
                      {departure.availableSeats} / {departure.totalSeats}
                    </td>
                    <td>₦{departure.pricePerSeat}</td>
                    <td>
                      <span className={`pill ${STATUS_PILL[departure.status]}`}>{departure.status}</span>
                    </td>
                    <td style={{ display: 'flex', gap: 'calc(var(--space) * 1.5)' }}>
                      <Link className="btn-link" to={`/app/tour-departures/${departure.id}/manifest`}>
                        Manifest
                      </Link>
                      {canManage && departure.status === 'SCHEDULED' && (
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => cancelDeparture.mutate(departure)}
                          disabled={cancelDeparture.isPending}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={departures.data.page}
            totalPages={departures.data.totalPages}
            total={departures.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
