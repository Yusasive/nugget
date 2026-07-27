import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type {
  PaginatedResponse,
  ShiftDto,
  ShiftStatus,
  ShiftTransactionType,
} from '@nugget/shared-types';
import { useAuth } from '../auth/auth-context';
import { Drawer } from '../components/Drawer';
import { Pagination } from '../components/Pagination';
import { api, ApiError } from '../lib/api-client';

const EMPTY_TRANSACTION = { type: 'CASH_IN' as ShiftTransactionType, amount: '', description: '' };
const EMPTY_HISTORY_FILTERS = { status: '' as ShiftStatus | '', openedFrom: '', openedTo: '' };
/** The full list already arrives in one shot as part of ShiftDto (there's no
 * dedicated paginated transactions endpoint) — paginating it is a client-side
 * slice, not a fresh query, so this is just a display page size. */
const TRANSACTIONS_PAGE_SIZE = 10;

function runningTotal(shift: ShiftDto): number {
  const net = shift.transactions.reduce(
    (sum, t) => (t.type === 'CASH_IN' ? sum + Number(t.amount) : sum - Number(t.amount)),
    0,
  );
  return Number(shift.openingCash) + net;
}

export function ShiftPage() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();

  const [openingCash, setOpeningCash] = useState('');
  const [transactionForm, setTransactionForm] = useState(EMPTY_TRANSACTION);
  const [closeDrawerOpen, setCloseDrawerOpen] = useState(false);
  const [closingCashActual, setClosingCashActual] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [transactionsPage, setTransactionsPage] = useState(1);

  const currentShift = useQuery({
    queryKey: ['shift-current'],
    queryFn: async (): Promise<ShiftDto | null> => {
      try {
        return await api.get<ShiftDto>('/shifts/mine/current');
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });

  const [historyFilters, setHistoryFilters] = useState(EMPTY_HISTORY_FILTERS);
  const [historyPage, setHistoryPage] = useState(1);

  const history = useQuery({
    queryKey: ['shifts', historyPage, historyFilters.status, historyFilters.openedFrom, historyFilters.openedTo],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(historyPage) });
      if (historyFilters.status) params.set('status', historyFilters.status);
      if (historyFilters.openedFrom) params.set('openedFrom', historyFilters.openedFrom);
      if (historyFilters.openedTo) params.set('openedTo', historyFilters.openedTo);
      return api.get<PaginatedResponse<ShiftDto>>(`/shifts?${params}`);
    },
  });

  function updateHistoryFilter(patch: Partial<typeof historyFilters>) {
    setHistoryFilters({ ...historyFilters, ...patch });
    setHistoryPage(1);
  }

  const hasActiveHistoryFilters = Object.values(historyFilters).some((v) => v !== '');

  function clearHistoryFilters() {
    setHistoryFilters(EMPTY_HISTORY_FILTERS);
    setHistoryPage(1);
  }

  const invalidateAll = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['shift-current'] }),
      queryClient.invalidateQueries({ queryKey: ['shifts'] }),
    ]);

  const openShift = useMutation({
    mutationFn: () => api.post<ShiftDto>('/shifts', { openingCash }),
    onSuccess: async () => {
      setOpeningCash('');
      setError(null);
      await invalidateAll();
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'Could not open shift');
    },
  });

  const addTransaction = useMutation({
    mutationFn: () =>
      api.post<ShiftDto>(`/shifts/${currentShift.data?.id}/transactions`, {
        type: transactionForm.type,
        amount: transactionForm.amount,
        description: transactionForm.description || undefined,
      }),
    onSuccess: async (updatedShift) => {
      setTransactionForm(EMPTY_TRANSACTION);
      setError(null);
      // Jump to the page that now contains the transaction just recorded,
      // rather than leaving staff looking at a page that doesn't show it.
      setTransactionsPage(Math.max(1, Math.ceil(updatedShift.transactions.length / TRANSACTIONS_PAGE_SIZE)));
      await invalidateAll();
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'Could not record transaction');
    },
  });

  const closeShift = useMutation({
    mutationFn: () =>
      api.post<ShiftDto>(`/shifts/${currentShift.data?.id}/close`, {
        closingCashActual,
        notes: closeNotes || undefined,
      }),
    onSuccess: async () => {
      setCloseDrawerOpen(false);
      setClosingCashActual('');
      setCloseNotes('');
      setError(null);
      await invalidateAll();
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'Could not close shift');
    },
  });

  function handleOpenSubmit(event: FormEvent) {
    event.preventDefault();
    openShift.mutate();
  }

  function handleTransactionSubmit(event: FormEvent) {
    event.preventDefault();
    addTransaction.mutate();
  }

  function handleCloseSubmit(event: FormEvent) {
    event.preventDefault();
    closeShift.mutate();
  }

  if (!staff) return null;

  const shiftTransactions = currentShift.data?.transactions ?? [];
  const transactionsTotalPages = Math.max(
    1,
    Math.ceil(shiftTransactions.length / TRANSACTIONS_PAGE_SIZE),
  );
  // Clamped rather than reset via an effect: if a shorter shift loads in
  // (a fresh one just opened, say) while sitting on a later page, this
  // settles back to a valid page on the next render instead of showing blank rows.
  const transactionsPageSafe = Math.min(transactionsPage, transactionsTotalPages);
  const pageTransactions = shiftTransactions.slice(
    (transactionsPageSafe - 1) * TRANSACTIONS_PAGE_SIZE,
    transactionsPageSafe * TRANSACTIONS_PAGE_SIZE,
  );

  return (
    <>
      <div className="page-header">
        <h2>Shift</h2>
      </div>

      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}

      {currentShift.isPending && <p className="muted">Loading your shift…</p>}

      {currentShift.data === null && (
        <form className="form-card" onSubmit={handleOpenSubmit}>
          <p className="muted">You have no open shift. Open one to start taking payments.</p>
          <div className="field">
            <label htmlFor="opening-cash">Opening cash</label>
            <input
              id="opening-cash"
              inputMode="decimal"
              required
              placeholder="0.00"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={openShift.isPending}>
            {openShift.isPending ? 'Opening…' : 'Open shift'}
          </button>
        </form>
      )}

      {currentShift.data && (
        <>
          <div className="card-grid" style={{ marginBottom: 'var(--gutter)' }}>
            <div className="metric-card">
              <div className="label">Opening cash</div>
              <div className="value">₦{currentShift.data.openingCash}</div>
            </div>
            <div className="metric-card">
              <div className="label">Running cash total</div>
              <div className="value">₦{runningTotal(currentShift.data).toFixed(2)}</div>
            </div>
            <div className="metric-card">
              <div className="label">Opened</div>
              <div className="value">{new Date(currentShift.data.openedAt).toLocaleString()}</div>
            </div>
          </div>

          <form className="form-card" onSubmit={handleTransactionSubmit}>
            <div className="field">
              <label htmlFor="tx-type">Type</label>
              <select
                id="tx-type"
                value={transactionForm.type}
                onChange={(e) =>
                  setTransactionForm({ ...transactionForm, type: e.target.value as ShiftTransactionType })
                }
              >
                <option value="CASH_IN">Cash in</option>
                <option value="CASH_OUT">Cash out</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="tx-amount">Amount</label>
              <input
                id="tx-amount"
                inputMode="decimal"
                required
                placeholder="0.00"
                value={transactionForm.amount}
                onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="tx-description">Description (optional)</label>
              <input
                id="tx-description"
                value={transactionForm.description}
                onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={addTransaction.isPending}>
              {addTransaction.isPending ? 'Recording…' : 'Record transaction'}
            </button>
          </form>

          <div className="table-wrap" style={{ marginTop: 'var(--gutter)' }}>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {currentShift.data.transactions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No transactions recorded yet.
                    </td>
                  </tr>
                )}
                {pageTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{new Date(tx.recordedAt).toLocaleTimeString()}</td>
                    <td>
                      <span className={`pill ${tx.type === 'CASH_IN' ? 'success' : 'warning'}`}>
                        {tx.type === 'CASH_IN' ? 'Cash in' : 'Cash out'}
                      </span>
                    </td>
                    <td>₦{tx.amount}</td>
                    <td>{tx.description ?? <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={transactionsPageSafe}
            totalPages={transactionsTotalPages}
            total={currentShift.data.transactions.length}
            onPageChange={setTransactionsPage}
          />

          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 'var(--gutter)' }}
            onClick={() => setCloseDrawerOpen(true)}
          >
            Close shift
          </button>

          <Drawer open={closeDrawerOpen} title="Close shift" onClose={() => setCloseDrawerOpen(false)}>
            <form className="form-card" onSubmit={handleCloseSubmit}>
              <p className="muted">
                Expected in drawer (opening cash + net cash transactions): ₦
                {runningTotal(currentShift.data).toFixed(2)}
              </p>
              <div className="field">
                <label htmlFor="closing-cash">Actual cash counted</label>
                <input
                  id="closing-cash"
                  inputMode="decimal"
                  required
                  placeholder="0.00"
                  value={closingCashActual}
                  onChange={(e) => setClosingCashActual(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="close-notes">Notes (optional)</label>
                <input id="close-notes" value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary" disabled={closeShift.isPending}>
                {closeShift.isPending ? 'Closing…' : 'Close shift'}
              </button>
            </form>
          </Drawer>
        </>
      )}

      <h3 style={{ marginTop: 'calc(var(--gutter) * 1.5)' }}>Shift history</h3>

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="sh-filter-status">Status</label>
          <select
            id="sh-filter-status"
            value={historyFilters.status}
            onChange={(e) => updateHistoryFilter({ status: e.target.value as ShiftStatus | '' })}
          >
            <option value="">All</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="sh-filter-from">Opened from</label>
          <input
            id="sh-filter-from"
            type="date"
            value={historyFilters.openedFrom}
            onChange={(e) => updateHistoryFilter({ openedFrom: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="sh-filter-to">Opened to</label>
          <input
            id="sh-filter-to"
            type="date"
            value={historyFilters.openedTo}
            onChange={(e) => updateHistoryFilter({ openedTo: e.target.value })}
          />
        </div>
        {hasActiveHistoryFilters && (
          <div className="field clear-filters">
            <label>&nbsp;</label>
            <button type="button" className="btn-link" onClick={clearHistoryFilters}>
              Clear filters
            </button>
          </div>
        )}
      </div>

      {history.isPending && <p className="muted">Loading shift history…</p>}
      {history.isError && <div className="alert error">Could not load shift history.</div>}
      {history.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Opened</th>
                  <th>Closed</th>
                  <th>Status</th>
                  <th>Discrepancy</th>
                </tr>
              </thead>
              <tbody>
                {history.data.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      No shifts match these filters.
                    </td>
                  </tr>
                )}
                {history.data.data.map((shift) => (
                  <tr key={shift.id}>
                    <td>
                      {shift.staff.firstName} {shift.staff.lastName}
                    </td>
                    <td>{new Date(shift.openedAt).toLocaleString()}</td>
                    <td>{shift.closedAt ? new Date(shift.closedAt).toLocaleString() : <span className="muted">—</span>}</td>
                    <td>
                      <span className={`pill ${shift.status === 'OPEN' ? 'info' : 'success'}`}>{shift.status}</span>
                    </td>
                    <td>
                      {shift.cashReport ? (
                        <span className={`pill ${Number(shift.cashReport.discrepancy) === 0 ? 'success' : 'error'}`}>
                          ₦{shift.cashReport.discrepancy}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={history.data.page}
            totalPages={history.data.totalPages}
            total={history.data.total}
            onPageChange={setHistoryPage}
          />
        </>
      )}
    </>
  );
}
