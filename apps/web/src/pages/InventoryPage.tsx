import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type {
  InventoryItemDto,
  PaginatedResponse,
  StockMovementReason,
  StockMovementType,
} from '@nugget/shared-types';
import { useAuth } from '../auth/auth-context';
import { Drawer } from '../components/Drawer';
import { Pagination } from '../components/Pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { api, ApiError } from '../lib/api-client';

const EMPTY_FORM = { name: '', unit: '', reorderThreshold: '', unitCost: '' };
const EMPTY_FILTERS = { search: '', lowStockOnly: false };
const EMPTY_MOVEMENT_FORM = { type: 'IN' as StockMovementType, quantity: '', reason: 'ADJUSTMENT' as StockMovementReason };

/** PRD §5.10 raw-material inventory: stock in/out and low-stock alerts. */
export function InventoryPage() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canManage =
    staff?.role === 'SUPER_ADMIN' || staff?.role === 'BRANCH_MANAGER' || staff?.role === 'RESTAURANT_STAFF';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const debouncedSearch = useDebouncedValue(filters.search);
  const [page, setPage] = useState(1);

  const [movementItem, setMovementItem] = useState<InventoryItemDto | null>(null);
  const [movementForm, setMovementForm] = useState(EMPTY_MOVEMENT_FORM);
  const [movementError, setMovementError] = useState<string | null>(null);

  const items = useQuery({
    queryKey: ['inventory-items', page, debouncedSearch, filters.lowStockOnly],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filters.lowStockOnly) params.set('lowStockOnly', 'true');
      return api.get<PaginatedResponse<InventoryItemDto>>(`/inventory-items?${params}`);
    },
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<InventoryItemDto>('/inventory-items', {
        branchId: staff?.branchId,
        name: form.name,
        unit: form.unit,
        reorderThreshold: form.reorderThreshold,
        unitCost: form.unitCost,
      }),
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Could not create inventory item'),
  });

  const recordMovement = useMutation({
    mutationFn: () =>
      api.post(`/inventory-items/${movementItem?.id}/stock-movements`, {
        type: movementForm.type,
        quantity: movementForm.quantity,
        reason: movementForm.reason,
      }),
    onSuccess: async () => {
      closeMovementDrawer();
      await queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    },
    onError: (err: unknown) =>
      setMovementError(err instanceof ApiError ? err.message : 'Could not record stock movement'),
  });

  function closeDrawer() {
    setDrawerOpen(false);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function closeMovementDrawer() {
    setMovementItem(null);
    setMovementForm(EMPTY_MOVEMENT_FORM);
    setMovementError(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  function handleMovementSubmit(event: FormEvent) {
    event.preventDefault();
    recordMovement.mutate();
  }

  return (
    <>
      <div className="page-header">
        <h2>Inventory</h2>
        {canManage && (
          <button type="button" className="btn-primary" onClick={() => setDrawerOpen(true)}>
            Add item
          </button>
        )}
      </div>

      {canManage && (
        <Drawer open={drawerOpen} title="Add inventory item" onClose={closeDrawer}>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <form className="form-card" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="inv-name">Name</label>
              <input
                id="inv-name"
                required
                minLength={2}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="inv-unit">Unit (kg, l, pcs, ...)</label>
              <input
                id="inv-unit"
                required
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="inv-threshold">Reorder threshold</label>
              <input
                id="inv-threshold"
                inputMode="decimal"
                required
                placeholder="0.000"
                value={form.reorderThreshold}
                onChange={(e) => setForm({ ...form, reorderThreshold: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="inv-cost">Unit cost</label>
              <input
                id="inv-cost"
                inputMode="decimal"
                required
                placeholder="0.00"
                value={form.unitCost}
                onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Adding…' : 'Add item'}
            </button>
          </form>
        </Drawer>
      )}

      {canManage && (
        <Drawer
          open={movementItem !== null}
          title={`Adjust stock — ${movementItem?.name ?? ''}`}
          onClose={closeMovementDrawer}
        >
          {movementError && (
            <div className="alert error" role="alert">
              {movementError}
            </div>
          )}
          <form className="form-card" onSubmit={handleMovementSubmit}>
            <p className="muted">
              On hand: {movementItem?.quantityOnHand} {movementItem?.unit}
            </p>
            <div className="field">
              <label htmlFor="mv-type">Direction</label>
              <select
                id="mv-type"
                value={movementForm.type}
                onChange={(e) =>
                  setMovementForm({ ...movementForm, type: e.target.value as StockMovementType })
                }
              >
                <option value="IN">Stock in</option>
                <option value="OUT">Stock out</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="mv-reason">Reason</label>
              <select
                id="mv-reason"
                value={movementForm.reason}
                onChange={(e) =>
                  setMovementForm({ ...movementForm, reason: e.target.value as StockMovementReason })
                }
              >
                <option value="ADJUSTMENT">Adjustment</option>
                <option value="CONSUMPTION">Consumption</option>
                <option value="WASTE">Waste</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="mv-quantity">Quantity</label>
              <input
                id="mv-quantity"
                inputMode="decimal"
                required
                placeholder="0.000"
                value={movementForm.quantity}
                onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={recordMovement.isPending}>
              {recordMovement.isPending ? 'Recording…' : 'Record movement'}
            </button>
          </form>
        </Drawer>
      )}

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="inv-search">Search</label>
          <input
            id="inv-search"
            placeholder="Name…"
            value={filters.search}
            onChange={(e) => {
              setFilters({ ...filters, search: e.target.value });
              setPage(1);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="inv-low-stock">
            <input
              id="inv-low-stock"
              type="checkbox"
              checked={filters.lowStockOnly}
              onChange={(e) => {
                setFilters({ ...filters, lowStockOnly: e.target.checked });
                setPage(1);
              }}
            />{' '}
            Low stock only
          </label>
        </div>
      </div>

      {items.isPending && <p className="muted">Loading inventory…</p>}
      {items.isError && <div className="alert error">Could not load inventory.</div>}

      {items.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>On hand</th>
                  <th>Reorder threshold</th>
                  <th>Unit cost</th>
                  <th>Status</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {items.data.data.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 6 : 5} className="muted">
                      No inventory items match these filters.
                    </td>
                  </tr>
                )}
                {items.data.data.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>
                      {item.quantityOnHand} {item.unit}
                    </td>
                    <td>
                      {item.reorderThreshold} {item.unit}
                    </td>
                    <td>{item.unitCost}</td>
                    <td>
                      {item.isLowStock ? (
                        <span className="pill warning">Low stock</span>
                      ) : (
                        <span className="pill success">OK</span>
                      )}
                    </td>
                    {canManage && (
                      <td>
                        <button type="button" className="btn-link" onClick={() => setMovementItem(item)}>
                          Adjust stock
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={items.data.page}
            totalPages={items.data.totalPages}
            total={items.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
