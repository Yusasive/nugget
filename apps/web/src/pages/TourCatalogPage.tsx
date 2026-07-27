import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type {
  PaginatedResponse,
  TourGuideDto,
  TourPackageDto,
  VehicleDto,
} from '@nugget/shared-types';
import { useAuth } from '../auth/auth-context';
import { Drawer } from '../components/Drawer';
import { Pagination } from '../components/Pagination';
import { api, ApiError } from '../lib/api-client';

type Tab = 'packages' | 'guides' | 'vehicles';

const TABS: { key: Tab; label: string }[] = [
  { key: 'packages', label: 'Packages' },
  { key: 'guides', label: 'Guides' },
  { key: 'vehicles', label: 'Vehicles' },
];

/**
 * Tours Coordinator dashboard's catalog management (PRD §5.8). Three small
 * catalog entities co-located behind tabs on one page, rather than each
 * getting its own top-level nav item — none of them is large enough alone to
 * warrant that (unlike Room/RoomType/RatePlan, which grew into that).
 */
export function TourCatalogPage() {
  const [tab, setTab] = useState<Tab>('packages');

  return (
    <>
      <div className="page-header">
        <h2>Tour Catalog</h2>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'packages' && <PackagesTab />}
      {tab === 'guides' && <GuidesTab />}
      {tab === 'vehicles' && <VehiclesTab />}
    </>
  );
}

const EMPTY_PACKAGE_FORM = {
  name: '',
  description: '',
  itinerary: '',
  durationMinutes: '180',
  defaultPricePerSeat: '',
  defaultCapacity: '10',
  imageUrls: '',
};

function PackagesTab() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canManage = staff?.role === 'SUPER_ADMIN' || staff?.role === 'TOURS_COORDINATOR';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_PACKAGE_FORM);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const packages = useQuery({
    queryKey: ['tour-packages', page],
    queryFn: () =>
      api.get<PaginatedResponse<TourPackageDto>>(`/tour-packages?page=${page}`),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<TourPackageDto>('/tour-packages', {
        branchId: staff?.branchId,
        name: form.name,
        description: form.description || undefined,
        itinerary: form.itinerary || undefined,
        durationMinutes: Number(form.durationMinutes),
        defaultPricePerSeat: form.defaultPricePerSeat,
        defaultCapacity: Number(form.defaultCapacity),
        imageUrls: form.imageUrls
          ? form.imageUrls.split(',').map((u) => u.trim()).filter(Boolean)
          : undefined,
      }),
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ['tour-packages'] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Could not create tour package'),
  });

  const toggleActive = useMutation({
    mutationFn: (pkg: TourPackageDto) =>
      api.patch<TourPackageDto>(`/tour-packages/${pkg.id}`, { isActive: !pkg.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tour-packages'] }),
  });

  function closeDrawer() {
    setDrawerOpen(false);
    setForm(EMPTY_PACKAGE_FORM);
    setError(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <>
      <div className="page-header">
        {canManage && (
          <button type="button" className="btn-primary" onClick={() => setDrawerOpen(true)}>
            Add package
          </button>
        )}
      </div>

      {canManage && (
        <Drawer open={drawerOpen} title="Add tour package" onClose={closeDrawer}>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <form className="form-card" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="tp-name">Name</label>
              <input
                id="tp-name"
                required
                minLength={2}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="tp-duration">Duration (minutes)</label>
              <input
                id="tp-duration"
                type="number"
                min={1}
                required
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="tp-price">Default price per seat</label>
              <input
                id="tp-price"
                inputMode="decimal"
                required
                placeholder="0.00"
                value={form.defaultPricePerSeat}
                onChange={(e) => setForm({ ...form, defaultPricePerSeat: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="tp-capacity">Default capacity (seats)</label>
              <input
                id="tp-capacity"
                type="number"
                min={1}
                required
                value={form.defaultCapacity}
                onChange={(e) => setForm({ ...form, defaultCapacity: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="tp-description">Description (optional)</label>
              <input
                id="tp-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="tp-itinerary">Itinerary (optional)</label>
              <textarea
                id="tp-itinerary"
                rows={3}
                value={form.itinerary}
                onChange={(e) => setForm({ ...form, itinerary: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="tp-images">Image URLs (comma-separated, optional)</label>
              <input
                id="tp-images"
                value={form.imageUrls}
                onChange={(e) => setForm({ ...form, imageUrls: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Adding…' : 'Add package'}
            </button>
          </form>
        </Drawer>
      )}

      {packages.isPending && <p className="muted">Loading packages…</p>}
      {packages.isError && <div className="alert error">Could not load tour packages.</div>}

      {packages.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Duration</th>
                  <th>Price/seat</th>
                  <th>Capacity</th>
                  <th>Status</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {packages.data.data.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 6 : 5} className="muted">
                      No tour packages match these filters.
                    </td>
                  </tr>
                )}
                {packages.data.data.map((pkg) => (
                  <tr key={pkg.id}>
                    <td>{pkg.name}</td>
                    <td>{pkg.durationMinutes} min</td>
                    <td>₦{pkg.defaultPricePerSeat}</td>
                    <td>{pkg.defaultCapacity}</td>
                    <td>
                      <span className={`pill ${pkg.isActive ? 'success' : 'error'}`}>
                        {pkg.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canManage && (
                      <td>
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => toggleActive.mutate(pkg)}
                          disabled={toggleActive.isPending}
                        >
                          {pkg.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={packages.data.page}
            totalPages={packages.data.totalPages}
            total={packages.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}

const EMPTY_GUIDE_FORM = { fullName: '', phone: '', email: '' };

function GuidesTab() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canManage = staff?.role === 'SUPER_ADMIN' || staff?.role === 'TOURS_COORDINATOR';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_GUIDE_FORM);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const guides = useQuery({
    queryKey: ['tour-guides', page],
    queryFn: () => api.get<PaginatedResponse<TourGuideDto>>(`/tour-guides?page=${page}`),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<TourGuideDto>('/tour-guides', {
        branchId: staff?.branchId,
        fullName: form.fullName,
        phone: form.phone || undefined,
        email: form.email || undefined,
      }),
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ['tour-guides'] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Could not add tour guide'),
  });

  const toggleActive = useMutation({
    mutationFn: (guide: TourGuideDto) =>
      api.patch<TourGuideDto>(`/tour-guides/${guide.id}`, { isActive: !guide.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tour-guides'] }),
  });

  function closeDrawer() {
    setDrawerOpen(false);
    setForm(EMPTY_GUIDE_FORM);
    setError(null);
  }

  return (
    <>
      <div className="page-header">
        {canManage && (
          <button type="button" className="btn-primary" onClick={() => setDrawerOpen(true)}>
            Add guide
          </button>
        )}
      </div>

      {canManage && (
        <Drawer open={drawerOpen} title="Add tour guide" onClose={closeDrawer}>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <form
            className="form-card"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <div className="field">
              <label htmlFor="tg-name">Full name</label>
              <input
                id="tg-name"
                required
                minLength={2}
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="tg-phone">Phone (optional)</label>
              <input
                id="tg-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="tg-email">Email (optional)</label>
              <input
                id="tg-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Adding…' : 'Add guide'}
            </button>
          </form>
        </Drawer>
      )}

      {guides.isPending && <p className="muted">Loading guides…</p>}
      {guides.isError && <div className="alert error">Could not load tour guides.</div>}

      {guides.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Status</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {guides.data.data.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className="muted">
                      No tour guides yet.
                    </td>
                  </tr>
                )}
                {guides.data.data.map((guide) => (
                  <tr key={guide.id}>
                    <td>{guide.fullName}</td>
                    <td className="muted">{guide.phone ?? '—'}</td>
                    <td className="muted">{guide.email ?? '—'}</td>
                    <td>
                      <span className={`pill ${guide.isActive ? 'success' : 'error'}`}>
                        {guide.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canManage && (
                      <td>
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => toggleActive.mutate(guide)}
                          disabled={toggleActive.isPending}
                        >
                          {guide.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={guides.data.page}
            totalPages={guides.data.totalPages}
            total={guides.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}

const EMPTY_VEHICLE_FORM = { name: '', plateNumber: '', capacity: '10' };

function VehiclesTab() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canManage = staff?.role === 'SUPER_ADMIN' || staff?.role === 'TOURS_COORDINATOR';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_VEHICLE_FORM);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const vehicles = useQuery({
    queryKey: ['vehicles', page],
    queryFn: () => api.get<PaginatedResponse<VehicleDto>>(`/vehicles?page=${page}`),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<VehicleDto>('/vehicles', {
        branchId: staff?.branchId,
        name: form.name,
        plateNumber: form.plateNumber || undefined,
        capacity: Number(form.capacity),
      }),
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Could not add vehicle'),
  });

  const toggleActive = useMutation({
    mutationFn: (vehicle: VehicleDto) =>
      api.patch<VehicleDto>(`/vehicles/${vehicle.id}`, { isActive: !vehicle.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
  });

  function closeDrawer() {
    setDrawerOpen(false);
    setForm(EMPTY_VEHICLE_FORM);
    setError(null);
  }

  return (
    <>
      <div className="page-header">
        {canManage && (
          <button type="button" className="btn-primary" onClick={() => setDrawerOpen(true)}>
            Add vehicle
          </button>
        )}
      </div>

      {canManage && (
        <Drawer open={drawerOpen} title="Add vehicle" onClose={closeDrawer}>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <form
            className="form-card"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <div className="field">
              <label htmlFor="v-name">Name</label>
              <input
                id="v-name"
                required
                minLength={2}
                placeholder="e.g. Toyota Hiace"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="v-plate">Plate number (optional)</label>
              <input
                id="v-plate"
                value={form.plateNumber}
                onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="v-capacity">Capacity</label>
              <input
                id="v-capacity"
                type="number"
                min={1}
                required
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Adding…' : 'Add vehicle'}
            </button>
          </form>
        </Drawer>
      )}

      {vehicles.isPending && <p className="muted">Loading vehicles…</p>}
      {vehicles.isError && <div className="alert error">Could not load vehicles.</div>}

      {vehicles.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Plate</th>
                  <th>Capacity</th>
                  <th>Status</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {vehicles.data.data.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className="muted">
                      No vehicles yet.
                    </td>
                  </tr>
                )}
                {vehicles.data.data.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td>{vehicle.name}</td>
                    <td className="muted">{vehicle.plateNumber ?? '—'}</td>
                    <td>{vehicle.capacity}</td>
                    <td>
                      <span className={`pill ${vehicle.isActive ? 'success' : 'error'}`}>
                        {vehicle.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canManage && (
                      <td>
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => toggleActive.mutate(vehicle)}
                          disabled={toggleActive.isPending}
                        >
                          {vehicle.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={vehicles.data.page}
            totalPages={vehicles.data.totalPages}
            total={vehicles.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
