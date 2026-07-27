import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { AuditLogEntryDto, PaginatedResponse } from '@nugget/shared-types';
import { Pagination } from '../components/Pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { api } from '../lib/api-client';

const EMPTY_FILTERS = { entityType: '', action: '' };

/** PRD §5.14/§5.15's staff activity/audit log viewer — a read-only window
 * over every mutating endpoint's audit trail (TRD §4), extended in
 * Milestone 11 to also cover staff logins. */
export function AuditLogPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const debouncedEntityType = useDebouncedValue(filters.entityType);
  const debouncedAction = useDebouncedValue(filters.action);
  const [page, setPage] = useState(1);

  const entries = useQuery({
    queryKey: ['audit-log', page, debouncedEntityType, debouncedAction],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedEntityType) params.set('entityType', debouncedEntityType);
      if (debouncedAction) params.set('action', debouncedAction);
      return api.get<PaginatedResponse<AuditLogEntryDto>>(`/audit-log?${params}`);
    },
  });

  function updateFilter(patch: Partial<typeof filters>) {
    setFilters({ ...filters, ...patch });
    setPage(1);
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  return (
    <>
      <div className="page-header">
        <h2>Audit Log</h2>
      </div>

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="al-entity">Entity type</label>
          <input
            id="al-entity"
            placeholder="e.g. Booking, Staff…"
            value={filters.entityType}
            onChange={(e) => updateFilter({ entityType: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="al-action">Action</label>
          <input
            id="al-action"
            placeholder="e.g. auth.login…"
            value={filters.action}
            onChange={(e) => updateFilter({ action: e.target.value })}
          />
        </div>
        {hasActiveFilters && (
          <div className="field clear-filters">
            <label>&nbsp;</label>
            <button type="button" className="btn-link" onClick={() => updateFilter(EMPTY_FILTERS)}>
              Clear filters
            </button>
          </div>
        )}
      </div>

      {entries.isPending && <p className="muted">Loading audit log…</p>}
      {entries.isError && <div className="alert error">Could not load the audit log.</div>}

      {entries.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Staff</th>
                  <th>Action</th>
                  <th>Entity</th>
                </tr>
              </thead>
              <tbody>
                {entries.data.data.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No audit log entries match these filters.
                    </td>
                  </tr>
                )}
                {entries.data.data.map((entry) => (
                  <tr key={entry.id}>
                    <td className="muted">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td>{entry.staff ? `${entry.staff.firstName} ${entry.staff.lastName}` : <span className="muted">System</span>}</td>
                    <td>{entry.action}</td>
                    <td className="muted">
                      {entry.entityType} · {entry.entityId.slice(0, 8)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={entries.data.page}
            totalPages={entries.data.totalPages}
            total={entries.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
