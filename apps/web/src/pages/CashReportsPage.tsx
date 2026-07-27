import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { PaginatedResponse, ShiftDto } from '@nugget/shared-types';
import { Pagination } from '../components/Pagination';
import { api } from '../lib/api-client';

const EMPTY_FILTERS = { closedFrom: '', closedTo: '' };

export function CashReportsPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const reports = useQuery({
    queryKey: ['cash-reports', page, filters.closedFrom, filters.closedTo],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (filters.closedFrom) params.set('closedFrom', filters.closedFrom);
      if (filters.closedTo) params.set('closedTo', filters.closedTo);
      return api.get<PaginatedResponse<ShiftDto>>(`/shifts/cash-reports?${params}`);
    },
  });

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
        <h2>Cash Reports</h2>
      </div>

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="cr-filter-from">Closed from</label>
          <input
            id="cr-filter-from"
            type="date"
            value={filters.closedFrom}
            onChange={(e) => updateFilter({ closedFrom: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="cr-filter-to">Closed to</label>
          <input
            id="cr-filter-to"
            type="date"
            value={filters.closedTo}
            onChange={(e) => updateFilter({ closedTo: e.target.value })}
          />
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

      {reports.isPending && <p className="muted">Loading cash reports…</p>}
      {reports.isError && <div className="alert error">Could not load cash reports.</div>}

      {reports.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Opened</th>
                  <th>Closed</th>
                  <th>Opening cash</th>
                  <th>Total sales</th>
                  <th>Expected</th>
                  <th>Actual</th>
                  <th>Discrepancy</th>
                </tr>
              </thead>
              <tbody>
                {reports.data.data.length === 0 && (
                  <tr>
                    <td colSpan={8} className="muted">
                      No closed shifts match these filters.
                    </td>
                  </tr>
                )}
                {reports.data.data.map((shift) => (
                  <tr key={shift.id}>
                    <td>
                      {shift.staff.firstName} {shift.staff.lastName}
                    </td>
                    <td>{new Date(shift.openedAt).toLocaleString()}</td>
                    <td>{shift.closedAt ? new Date(shift.closedAt).toLocaleString() : '—'}</td>
                    <td>₦{shift.openingCash}</td>
                    <td>₦{shift.cashReport?.totalSales}</td>
                    <td>₦{shift.closingCashExpected}</td>
                    <td>₦{shift.closingCashActual}</td>
                    <td>
                      <span
                        className={`pill ${Number(shift.cashReport?.discrepancy) === 0 ? 'success' : 'error'}`}
                      >
                        ₦{shift.cashReport?.discrepancy}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={reports.data.page}
            totalPages={reports.data.totalPages}
            total={reports.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
