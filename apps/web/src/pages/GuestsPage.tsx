import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { GuestProfileDto, PaginatedResponse } from '@nugget/shared-types';
import { useAuth } from '../auth/auth-context';
import { Drawer } from '../components/Drawer';
import { Pagination } from '../components/Pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { api, ApiError } from '../lib/api-client';

/** PRD §5.6 Guest CRM — profiles, VIP/blacklist flags, preferences. */
export function GuestsPage() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canEdit =
    staff?.role === 'SUPER_ADMIN' ||
    staff?.role === 'BRANCH_MANAGER' ||
    staff?.role === 'FRONT_DESK';

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [vipFilter, setVipFilter] = useState(false);
  const [blacklistFilter, setBlacklistFilter] = useState(false);
  const [page, setPage] = useState(1);

  const [editGuest, setEditGuest] = useState<GuestProfileDto | null>(null);
  const [form, setForm] = useState({
    preferences: '',
    notes: '',
    isVip: false,
    isBlacklisted: false,
  });
  const [error, setError] = useState<string | null>(null);

  const guests = useQuery({
    queryKey: ['guests', page, debouncedSearch, vipFilter, blacklistFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (vipFilter) params.set('isVip', 'true');
      if (blacklistFilter) params.set('isBlacklisted', 'true');
      return api.get<PaginatedResponse<GuestProfileDto>>(`/guests?${params}`);
    },
  });

  const update = useMutation({
    mutationFn: () =>
      api.patch<GuestProfileDto>(`/guests/${editGuest!.id}`, form),
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ['guests'] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Could not update guest'),
  });

  function openEdit(guest: GuestProfileDto) {
    setEditGuest(guest);
    setForm({
      preferences: guest.preferences ?? '',
      notes: guest.notes ?? '',
      isVip: guest.isVip,
      isBlacklisted: guest.isBlacklisted,
    });
    setError(null);
  }

  function closeDrawer() {
    setEditGuest(null);
    setError(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    update.mutate();
  }

  return (
    <>
      <div className="page-header">
        <h2>Guests</h2>
      </div>

      {canEdit && editGuest && (
        <Drawer
          open
          title={`${editGuest.firstName} ${editGuest.lastName}`}
          onClose={closeDrawer}
        >
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <form className="form-card" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="g-preferences">Preferences</label>
              <textarea
                id="g-preferences"
                rows={3}
                value={form.preferences}
                onChange={(e) => setForm({ ...form, preferences: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="g-notes">Notes</label>
              <textarea
                id="g-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={form.isVip}
                  onChange={(e) => setForm({ ...form, isVip: e.target.checked })}
                />{' '}
                VIP guest
              </label>
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={form.isBlacklisted}
                  onChange={(e) =>
                    setForm({ ...form, isBlacklisted: e.target.checked })
                  }
                />{' '}
                Blacklisted
              </label>
            </div>
            <button type="submit" className="btn-primary" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save'}
            </button>
          </form>
        </Drawer>
      )}

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="g-search">Search</label>
          <input
            id="g-search"
            placeholder="Name, email, phone…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={vipFilter}
              onChange={(e) => {
                setVipFilter(e.target.checked);
                setPage(1);
              }}
            />{' '}
            VIP only
          </label>
        </div>
        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={blacklistFilter}
              onChange={(e) => {
                setBlacklistFilter(e.target.checked);
                setPage(1);
              }}
            />{' '}
            Blacklisted only
          </label>
        </div>
      </div>

      {guests.isPending && <p className="muted">Loading guests…</p>}
      {guests.isError && <div className="alert error">Could not load guests.</div>}

      {guests.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Flags</th>
                  {canEdit && <th />}
                </tr>
              </thead>
              <tbody>
                {guests.data.data.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 5 : 4} className="muted">
                      No guests match these filters.
                    </td>
                  </tr>
                )}
                {guests.data.data.map((guest) => (
                  <tr key={guest.id}>
                    <td>
                      {guest.firstName} {guest.lastName}
                    </td>
                    <td className="muted">{guest.email ?? '—'}</td>
                    <td className="muted">{guest.phone ?? '—'}</td>
                    <td>
                      {guest.isVip && <span className="pill success">VIP</span>}
                      {guest.isBlacklisted && (
                        <span className="pill error" style={{ marginLeft: 4 }}>
                          Blacklisted
                        </span>
                      )}
                    </td>
                    {canEdit && (
                      <td>
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => openEdit(guest)}
                        >
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={guests.data.page}
            totalPages={guests.data.totalPages}
            total={guests.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
