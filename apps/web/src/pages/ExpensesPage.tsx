import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type {
  ExpenseCategoryDto,
  ExpenseDto,
  ExpenseStatus,
  PaginatedResponse,
} from '@nugget/shared-types';
import { useAuth } from '../auth/auth-context';
import { Drawer } from '../components/Drawer';
import { Pagination } from '../components/Pagination';
import { api, ApiError } from '../lib/api-client';

const EMPTY_FORM = { categoryId: '', amount: '', description: '' };
const STATUS_LABELS: Record<ExpenseStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

/** PRD §5.11 expense management — manual entry and approval flow. */
export function ExpensesPage() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canCreate =
    staff?.role === 'SUPER_ADMIN' ||
    staff?.role === 'BRANCH_MANAGER' ||
    staff?.role === 'ACCOUNTANT' ||
    staff?.role === 'FRONT_DESK' ||
    staff?.role === 'RESTAURANT_STAFF';
  const canApprove =
    staff?.role === 'SUPER_ADMIN' ||
    staff?.role === 'BRANCH_MANAGER' ||
    staff?.role === 'ACCOUNTANT';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | ''>('');
  const [page, setPage] = useState(1);

  const expenses = useQuery({
    queryKey: ['expenses', page, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (statusFilter) params.set('status', statusFilter);
      return api.get<PaginatedResponse<ExpenseDto>>(`/expenses?${params}`);
    },
  });

  const categories = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => api.get<ExpenseCategoryDto[]>('/expense-categories'),
    enabled: drawerOpen,
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<ExpenseDto>('/expenses', {
        branchId: staff?.branchId,
        categoryId: form.categoryId,
        amount: form.amount,
        description: form.description,
      }),
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Could not create expense'),
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.patch<ExpenseDto>(`/expenses/${id}/approve`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const reject = useMutation({
    mutationFn: (id: string) => api.patch<ExpenseDto>(`/expenses/${id}/reject`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
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

  return (
    <>
      <div className="page-header">
        <h2>Expenses</h2>
        {canCreate && (
          <button type="button" className="btn-primary" onClick={() => setDrawerOpen(true)}>
            Add expense
          </button>
        )}
      </div>

      {canCreate && (
        <Drawer open={drawerOpen} title="Add expense" onClose={closeDrawer}>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <form className="form-card" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="exp-category">Category</label>
              <select
                id="exp-category"
                required
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Select…</option>
                {categories.data?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="exp-amount">Amount</label>
              <input
                id="exp-amount"
                inputMode="decimal"
                required
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="exp-desc">Description</label>
              <input
                id="exp-desc"
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Save expense'}
            </button>
          </form>
        </Drawer>
      )}

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="exp-status">Status</label>
          <select
            id="exp-status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ExpenseStatus | '');
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {expenses.isPending && <p className="muted">Loading expenses…</p>}
      {expenses.isError && <div className="alert error">Could not load expenses.</div>}

      {expenses.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                  {canApprove && <th />}
                </tr>
              </thead>
              <tbody>
                {expenses.data.data.length === 0 && (
                  <tr>
                    <td colSpan={canApprove ? 6 : 5} className="muted">
                      No expenses found.
                    </td>
                  </tr>
                )}
                {expenses.data.data.map((expense) => (
                  <tr key={expense.id}>
                    <td>{expense.category.name}</td>
                    <td>{expense.description}</td>
                    <td>{expense.amount}</td>
                    <td className="muted">
                      {new Date(expense.incurredAt).toLocaleDateString()}
                    </td>
                    <td>
                      <span
                        className={`pill ${
                          expense.status === 'APPROVED'
                            ? 'success'
                            : expense.status === 'REJECTED'
                              ? 'error'
                              : 'info'
                        }`}
                      >
                        {STATUS_LABELS[expense.status]}
                      </span>
                    </td>
                    {canApprove && (
                      <td>
                        {expense.status === 'PENDING' && (
                          <span style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                            <button
                              type="button"
                              className="btn-link"
                              disabled={approve.isPending}
                              onClick={() => approve.mutate(expense.id)}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn-link"
                              disabled={reject.isPending}
                              onClick={() => reject.mutate(expense.id)}
                            >
                              Reject
                            </button>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={expenses.data.page}
            totalPages={expenses.data.totalPages}
            total={expenses.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
