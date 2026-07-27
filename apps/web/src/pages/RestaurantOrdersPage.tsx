import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type {
  KitchenItemStatus,
  MenuItemDto,
  PaginatedResponse,
  RestaurantOrderDto,
  RestaurantOrderStatus,
  RestaurantOrderType,
  RestaurantTableDto,
} from '@nugget/shared-types';
import { useAuth } from '../auth/auth-context';
import { Drawer } from '../components/Drawer';
import { Pagination } from '../components/Pagination';
import { api, ApiError } from '../lib/api-client';

const POLL_INTERVAL_MS = 5000;

const ORDER_STATUS_PILL: Record<RestaurantOrderStatus, string> = {
  OPEN: 'info',
  SENT_TO_KITCHEN: 'warning',
  SERVED: 'success',
  PAID: 'success',
  CANCELLED: 'error',
};

const KITCHEN_STATUS_PILL: Record<KitchenItemStatus, string> = {
  PENDING: 'warning',
  PREPARING: 'info',
  READY: 'success',
  SERVED: 'success',
};

const ORDER_TYPE_LABEL: Record<RestaurantOrderType, string> = {
  DINE_IN: 'Dine-in',
  ROOM_SERVICE: 'Room service',
  TAKEAWAY: 'Takeaway',
};

const EMPTY_FILTERS = { status: '' as RestaurantOrderStatus | '', orderType: '' as RestaurantOrderType | '' };
const EMPTY_CREATE_FORM = { orderType: 'DINE_IN' as RestaurantOrderType, tableId: '', roomBookingId: '', guestId: '' };
const EMPTY_ITEM_FORM = { menuItemId: '', quantity: '1', notes: '' };

/** PRD §5.9 order entry: dine-in (table-linked), room service (linked to a
 * room/guest folio), takeaway. The order list polls (TRD §7) so status
 * changes made from the Kitchen Display show up here without a refresh. */
export function RestaurantOrdersPage() {
  const { staff } = useAuth();
  const queryClient = useQueryClient();
  const canManage =
    staff?.role === 'SUPER_ADMIN' || staff?.role === 'BRANCH_MANAGER' || staff?.role === 'RESTAURANT_STAFF';

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createError, setCreateError] = useState<string | null>(null);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [detailError, setDetailError] = useState<string | null>(null);

  const orders = useQuery({
    queryKey: ['restaurant-orders', page, filters.status, filters.orderType],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (filters.status) params.set('status', filters.status);
      if (filters.orderType) params.set('orderType', filters.orderType);
      return api.get<PaginatedResponse<RestaurantOrderDto>>(`/restaurant-orders?${params}`);
    },
    refetchInterval: POLL_INTERVAL_MS,
  });

  const freeTables = useQuery({
    queryKey: ['restaurant-tables', 'free'],
    queryFn: () => api.get<PaginatedResponse<RestaurantTableDto>>('/restaurant-tables?status=FREE&pageSize=100'),
    enabled: createOpen && createForm.orderType === 'DINE_IN',
  });

  const menuItems = useQuery({
    queryKey: ['menu-items', 'available'],
    queryFn: () => api.get<PaginatedResponse<MenuItemDto>>('/menu-items?isAvailable=true&pageSize=200'),
    enabled: selectedOrderId !== null,
  });

  const selectedOrder = useQuery({
    queryKey: ['restaurant-orders', selectedOrderId],
    queryFn: () => api.get<RestaurantOrderDto>(`/restaurant-orders/${selectedOrderId}`),
    enabled: selectedOrderId !== null,
    refetchInterval: POLL_INTERVAL_MS,
  });

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['restaurant-orders'] });
    void queryClient.invalidateQueries({ queryKey: ['restaurant-tables'] });
  };

  const create = useMutation({
    mutationFn: () =>
      api.post<RestaurantOrderDto>('/restaurant-orders', {
        orderType: createForm.orderType,
        tableId: createForm.orderType === 'DINE_IN' ? createForm.tableId : undefined,
        roomBookingId: createForm.orderType === 'ROOM_SERVICE' ? createForm.roomBookingId : undefined,
        guestId: createForm.guestId || undefined,
      }),
    onSuccess: (order) => {
      closeCreate();
      invalidateAll();
      setSelectedOrderId(order.id);
    },
    onError: (err: unknown) =>
      setCreateError(err instanceof ApiError ? err.message : 'Could not create order'),
  });

  const addItem = useMutation({
    mutationFn: () =>
      api.post<RestaurantOrderDto>(`/restaurant-orders/${selectedOrderId}/items`, {
        items: [
          {
            menuItemId: itemForm.menuItemId,
            quantity: Number(itemForm.quantity),
            notes: itemForm.notes || undefined,
          },
        ],
      }),
    onSuccess: () => {
      setItemForm(EMPTY_ITEM_FORM);
      setDetailError(null);
      void queryClient.invalidateQueries({ queryKey: ['restaurant-orders', selectedOrderId] });
    },
    onError: (err: unknown) =>
      setDetailError(err instanceof ApiError ? err.message : 'Could not add item'),
  });

  const sendToKitchen = useMutation({
    mutationFn: () => api.post<RestaurantOrderDto>(`/restaurant-orders/${selectedOrderId}/send-to-kitchen`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['restaurant-orders', selectedOrderId] });
      invalidateAll();
    },
    onError: (err: unknown) =>
      setDetailError(err instanceof ApiError ? err.message : 'Could not send order to kitchen'),
  });

  const markServed = useMutation({
    mutationFn: () => api.post<RestaurantOrderDto>(`/restaurant-orders/${selectedOrderId}/serve`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['restaurant-orders', selectedOrderId] });
      invalidateAll();
    },
    onError: (err: unknown) =>
      setDetailError(err instanceof ApiError ? err.message : 'Could not mark order served'),
  });

  const bill = useMutation({
    mutationFn: () => api.post<RestaurantOrderDto>(`/restaurant-orders/${selectedOrderId}/bill`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['restaurant-orders', selectedOrderId] });
      invalidateAll();
    },
    onError: (err: unknown) =>
      setDetailError(err instanceof ApiError ? err.message : 'Could not bill order'),
  });

  const cancel = useMutation({
    mutationFn: () => api.post<RestaurantOrderDto>(`/restaurant-orders/${selectedOrderId}/cancel`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['restaurant-orders', selectedOrderId] });
      invalidateAll();
    },
    onError: (err: unknown) =>
      setDetailError(err instanceof ApiError ? err.message : 'Could not cancel order'),
  });

  function closeCreate() {
    setCreateOpen(false);
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateError(null);
  }

  function closeDetail() {
    setSelectedOrderId(null);
    setItemForm(EMPTY_ITEM_FORM);
    setDetailError(null);
  }

  function handleCreateSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  function handleAddItemSubmit(event: FormEvent) {
    event.preventDefault();
    addItem.mutate();
  }

  function updateFilter(patch: Partial<typeof filters>) {
    setFilters({ ...filters, ...patch });
    setPage(1);
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');
  const order = selectedOrder.data;
  const allItemsServed = !!order && order.items.length > 0 && order.items.every((i) => i.kitchenStatus === 'SERVED');

  return (
    <>
      <div className="page-header">
        <h2>Orders</h2>
        {canManage && (
          <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
            New order
          </button>
        )}
      </div>

      {canManage && (
        <Drawer open={createOpen} title="New order" onClose={closeCreate}>
          {createError && (
            <div className="alert error" role="alert">
              {createError}
            </div>
          )}
          <form className="form-card" onSubmit={handleCreateSubmit}>
            <div className="field">
              <label htmlFor="ro-type">Order type</label>
              <select
                id="ro-type"
                required
                value={createForm.orderType}
                onChange={(e) =>
                  setCreateForm({ ...createForm, orderType: e.target.value as RestaurantOrderType })
                }
              >
                <option value="DINE_IN">Dine-in</option>
                <option value="ROOM_SERVICE">Room service</option>
                <option value="TAKEAWAY">Takeaway</option>
              </select>
            </div>
            {createForm.orderType === 'DINE_IN' && (
              <div className="field">
                <label htmlFor="ro-table">Table</label>
                <select
                  id="ro-table"
                  required
                  value={createForm.tableId}
                  onChange={(e) => setCreateForm({ ...createForm, tableId: e.target.value })}
                >
                  <option value="">Select…</option>
                  {freeTables.data?.data.map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.tableNumber} (seats {table.capacity})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {createForm.orderType === 'ROOM_SERVICE' && (
              <div className="field">
                <label htmlFor="ro-booking">Room booking ID</label>
                <input
                  id="ro-booking"
                  required
                  placeholder="Paste the guest's booking ID"
                  value={createForm.roomBookingId}
                  onChange={(e) => setCreateForm({ ...createForm, roomBookingId: e.target.value })}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="ro-guest">Guest ID (optional)</label>
              <input
                id="ro-guest"
                value={createForm.guestId}
                onChange={(e) => setCreateForm({ ...createForm, guestId: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create order'}
            </button>
          </form>
        </Drawer>
      )}

      <Drawer
        open={selectedOrderId !== null}
        title={order ? `${ORDER_TYPE_LABEL[order.orderType]}${order.table ? ` — Table ${order.table.tableNumber}` : ''}` : 'Order'}
        onClose={closeDetail}
      >
        {detailError && (
          <div className="alert error" role="alert">
            {detailError}
          </div>
        )}
        {selectedOrder.isPending && <p className="muted">Loading order…</p>}
        {order && (
          <>
            <p>
              <span className={`pill ${ORDER_STATUS_PILL[order.status]}`}>{order.status.replace(/_/g, ' ')}</span>
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Kitchen status</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.length === 0 && (
                    <tr>
                      <td colSpan={3} className="muted">
                        No items yet.
                      </td>
                    </tr>
                  )}
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.menuItemName}
                        {item.notes && <div className="muted">{item.notes}</div>}
                      </td>
                      <td>{item.quantity}</td>
                      <td>
                        <span className={`pill ${KITCHEN_STATUS_PILL[item.kitchenStatus]}`}>
                          {item.kitchenStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted">Total: {order.totalAmount}</p>

            {canManage && (order.status === 'OPEN' || order.status === 'SENT_TO_KITCHEN') && (
              <form className="form-card" onSubmit={handleAddItemSubmit}>
                <div className="field">
                  <label htmlFor="oi-item">Add item</label>
                  <select
                    id="oi-item"
                    required
                    value={itemForm.menuItemId}
                    onChange={(e) => setItemForm({ ...itemForm, menuItemId: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {menuItems.data?.data.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — {item.price}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="oi-qty">Quantity</label>
                  <input
                    id="oi-qty"
                    type="number"
                    min={1}
                    required
                    value={itemForm.quantity}
                    onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="oi-notes">Notes (optional)</label>
                  <input
                    id="oi-notes"
                    value={itemForm.notes}
                    onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={addItem.isPending}>
                  {addItem.isPending ? 'Adding…' : 'Add item'}
                </button>
              </form>
            )}

            {canManage && (
              <div className="page-header" style={{ marginTop: 'var(--gutter)' }}>
                {order.status === 'OPEN' && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => sendToKitchen.mutate()}
                    disabled={sendToKitchen.isPending || order.items.length === 0}
                  >
                    Send to kitchen
                  </button>
                )}
                {order.status === 'SENT_TO_KITCHEN' && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => markServed.mutate()}
                    disabled={markServed.isPending || !allItemsServed}
                  >
                    Mark served
                  </button>
                )}
                {order.status === 'SERVED' && (
                  <button type="button" className="btn-primary" onClick={() => bill.mutate()} disabled={bill.isPending}>
                    Bill
                  </button>
                )}
                {(order.status === 'OPEN' || order.status === 'SENT_TO_KITCHEN') && (
                  <button type="button" className="btn-link" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                    Cancel order
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </Drawer>

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="ro-filter-status">Status</label>
          <select
            id="ro-filter-status"
            value={filters.status}
            onChange={(e) => updateFilter({ status: e.target.value as RestaurantOrderStatus | '' })}
          >
            <option value="">All</option>
            <option value="OPEN">Open</option>
            <option value="SENT_TO_KITCHEN">Sent to kitchen</option>
            <option value="SERVED">Served</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="ro-filter-type">Type</label>
          <select
            id="ro-filter-type"
            value={filters.orderType}
            onChange={(e) => updateFilter({ orderType: e.target.value as RestaurantOrderType | '' })}
          >
            <option value="">All types</option>
            <option value="DINE_IN">Dine-in</option>
            <option value="ROOM_SERVICE">Room service</option>
            <option value="TAKEAWAY">Takeaway</option>
          </select>
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

      {orders.isPending && <p className="muted">Loading orders…</p>}
      {orders.isError && <div className="alert error">Could not load orders.</div>}

      {orders.data && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Table / Room</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.data.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      No orders match these filters.
                    </td>
                  </tr>
                )}
                {orders.data.data.map((o) => (
                  <tr key={o.id}>
                    <td>{ORDER_TYPE_LABEL[o.orderType]}</td>
                    <td>{o.table ? o.table.tableNumber : o.roomBookingId ? 'Room service' : '—'}</td>
                    <td>
                      <span className={`pill ${ORDER_STATUS_PILL[o.status]}`}>{o.status.replace(/_/g, ' ')}</span>
                    </td>
                    <td>{o.totalAmount}</td>
                    <td>
                      <button type="button" className="btn-link" onClick={() => setSelectedOrderId(o.id)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={orders.data.page}
            totalPages={orders.data.totalPages}
            total={orders.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
