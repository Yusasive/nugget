import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type {
  InventoryItemDto,
  PaginatedResponse,
  PurchaseLineItemInput,
  PurchaseRecordDto,
  SupplierDto,
} from '@nugget/shared-types';
import { useAuth } from '../auth/auth-context';
import { Drawer } from '../components/Drawer';
import { Pagination } from '../components/Pagination';
import { api, ApiError } from '../lib/api-client';

const EMPTY_LINE: PurchaseLineItemInput = { inventoryItemId: '', quantity: '', unitCost: '' };

/** PRD §5.10 purchase records — recording one atomically creates a stock
 * movement per line item and a matching expense (Milestone 8's DoD). */
export function PurchasesPage() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canManage = staff?.role === 'SUPER_ADMIN' || staff?.role === 'RESTAURANT_STAFF';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [lineItems, setLineItems] = useState<PurchaseLineItemInput[]>([{ ...EMPTY_LINE }]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const purchases = useQuery({
    queryKey: ['purchase-records', page],
    queryFn: () => api.get<PaginatedResponse<PurchaseRecordDto>>(`/purchase-records?page=${page}`),
  });

  const suppliers = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: () => api.get<PaginatedResponse<SupplierDto>>('/suppliers?isActive=true&pageSize=100'),
    enabled: drawerOpen,
  });

  const inventoryItems = useQuery({
    queryKey: ['inventory-items', 'all'],
    queryFn: () => api.get<PaginatedResponse<InventoryItemDto>>('/inventory-items?isActive=true&pageSize=200'),
    enabled: drawerOpen,
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<PurchaseRecordDto>('/purchase-records', {
        branchId: staff?.branchId,
        supplierId,
        lineItems,
      }),
    onSuccess: async () => {
      closeDrawer();
      await queryClient.invalidateQueries({ queryKey: ['purchase-records'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : 'Could not record purchase'),
  });

  function closeDrawer() {
    setDrawerOpen(false);
    setSupplierId('');
    setLineItems([{ ...EMPTY_LINE }]);
    setError(null);
  }

  function updateLine(index: number, patch: Partial<PurchaseLineItemInput>) {
    setLineItems(lineItems.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLineItems([...lineItems, { ...EMPTY_LINE }]);
  }

  function removeLine(index: number) {
    setLineItems(lineItems.filter((_, i) => i !== index));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  const total = lineItems.reduce((sum, line) => {
    const qty = Number(line.quantity) || 0;
    const cost = Number(line.unitCost) || 0;
    return sum + qty * cost;
  }, 0);

  return (
    <>
      <div className="page-header">
        <h2>Purchases</h2>
        {canManage && (
          <button type="button" className="btn-primary" onClick={() => setDrawerOpen(true)}>
            Record purchase
          </button>
        )}
      </div>

      {canManage && (
        <Drawer open={drawerOpen} title="Record purchase" onClose={closeDrawer}>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <form className="form-card" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="pr-supplier">Supplier</label>
              <select id="pr-supplier" required value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Select…</option>
                {suppliers.data?.data.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <label>Line items</label>
            {lineItems.map((line, index) => (
              <div key={index} className="field" style={{ borderBottom: '1px solid var(--cream-200)', paddingBottom: 'var(--space)' }}>
                <select
                  required
                  value={line.inventoryItemId}
                  onChange={(e) => updateLine(index, { inventoryItemId: e.target.value })}
                >
                  <option value="">Select item…</option>
                  {inventoryItems.data?.data.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.unit})
                    </option>
                  ))}
                </select>
                <input
                  inputMode="decimal"
                  required
                  placeholder="Quantity"
                  value={line.quantity}
                  onChange={(e) => updateLine(index, { quantity: e.target.value })}
                />
                <input
                  inputMode="decimal"
                  required
                  placeholder="Unit cost"
                  value={line.unitCost}
                  onChange={(e) => updateLine(index, { unitCost: e.target.value })}
                />
                {lineItems.length > 1 && (
                  <button type="button" className="btn-link" onClick={() => removeLine(index)}>
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn-link" onClick={addLine}>
              + Add line item
            </button>

            <p className="muted">Total: {total.toFixed(2)}</p>

            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Recording…' : 'Record purchase'}
            </button>
          </form>
        </Drawer>
      )}

      {purchases.isPending && <p className="muted">Loading purchases…</p>}
      {purchases.isError && <div className="alert error">Could not load purchases.</div>}

      {purchases.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {purchases.data.data.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No purchases recorded yet.
                    </td>
                  </tr>
                )}
                {purchases.data.data.map((purchase) => (
                  <tr key={purchase.id}>
                    <td>{purchase.supplier.name}</td>
                    <td className="muted">
                      {purchase.lineItems.map((l) => `${l.quantity}× ${l.inventoryItemName}`).join(', ')}
                    </td>
                    <td>{purchase.totalCost}</td>
                    <td className="muted">{new Date(purchase.purchasedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={purchases.data.page}
            totalPages={purchases.data.totalPages}
            total={purchases.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
