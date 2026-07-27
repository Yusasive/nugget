import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { KitchenItemStatus, RestaurantOrderDto, RestaurantOrderType } from '@nugget/shared-types';
import { api } from '../lib/api-client';

const POLL_INTERVAL_MS = 4000;

const NEXT_STATUS: Partial<Record<KitchenItemStatus, KitchenItemStatus>> = {
  PENDING: 'PREPARING',
  PREPARING: 'READY',
  READY: 'SERVED',
};

const ADVANCE_LABEL: Partial<Record<KitchenItemStatus, string>> = {
  PENDING: 'Start preparing',
  PREPARING: 'Mark ready',
  READY: 'Mark served',
};

const KITCHEN_STATUS_PILL: Record<KitchenItemStatus, string> = {
  PENDING: 'warning',
  PREPARING: 'info',
  READY: 'success',
  SERVED: 'success',
};

const GROUP_LABEL: Record<RestaurantOrderType, string> = {
  DINE_IN: 'Table',
  ROOM_SERVICE: 'Room service',
  TAKEAWAY: 'Takeaway',
};

/**
 * ui-ux.md §7.2: a deliberately different surface from the rest of the
 * dashboard — dark, high-contrast, large type, no sidebar/nav, mounted in a
 * kitchen and read at a glance. Polls the same feed the order-entry page's
 * detail view reads (TRD §7: 3-5s interval), advancing one item at a time.
 */
export function KitchenDisplayPage() {
  const queryClient = useQueryClient();

  const tickets = useQuery({
    queryKey: ['kitchen-display'],
    queryFn: () => api.get<RestaurantOrderDto[]>('/restaurant-orders/kitchen-display'),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const previousOrderIds = useRef<Set<string>>(new Set());
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!tickets.data) return;
    const currentIds = new Set(tickets.data.map((o) => o.id));
    const fresh = new Set<string>();
    for (const id of currentIds) {
      if (!previousOrderIds.current.has(id)) fresh.add(id);
    }
    previousOrderIds.current = currentIds;
    if (fresh.size > 0 && previousOrderIds.current.size > fresh.size) {
      setNewOrderIds(fresh);
      const timer = setTimeout(() => setNewOrderIds(new Set()), 1500);
      return () => clearTimeout(timer);
    }
  }, [tickets.data]);

  const advance = useMutation({
    mutationFn: ({ orderId, itemId, status }: { orderId: string; itemId: string; status: KitchenItemStatus }) =>
      api.patch<RestaurantOrderDto>(`/restaurant-orders/${orderId}/items/${itemId}/kitchen-status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kitchen-display'] }),
  });

  return (
    <div className="kds-screen">
      <header className="kds-header">
        <h1>Kitchen Display</h1>
        <span className="muted">Auto-refreshing every {POLL_INTERVAL_MS / 1000}s</span>
      </header>

      {tickets.isPending && <p className="kds-empty">Loading tickets…</p>}
      {tickets.isError && <p className="kds-empty">Could not load the kitchen queue.</p>}
      {tickets.data && tickets.data.length === 0 && <p className="kds-empty">No active tickets.</p>}

      <div className="kds-grid">
        {tickets.data?.map((order) => (
          <div key={order.id} className={`kds-ticket${newOrderIds.has(order.id) ? ' kds-ticket-new' : ''}`}>
            <div className="kds-ticket-header">
              <span>
                {GROUP_LABEL[order.orderType]}
                {order.table ? ` ${order.table.tableNumber}` : ''}
              </span>
              <span className="muted">{new Date(order.createdAt).toLocaleTimeString()}</span>
            </div>
            <ul className="kds-items">
              {order.items
                .filter((item) => item.kitchenStatus !== 'SERVED')
                .map((item) => (
                  <li key={item.id} className="kds-item">
                    <div>
                      <span className="kds-item-qty">{item.quantity}×</span> {item.menuItemName}
                      {item.notes && <div className="kds-item-notes">{item.notes}</div>}
                    </div>
                    <div className="kds-item-actions">
                      <span className={`pill ${KITCHEN_STATUS_PILL[item.kitchenStatus]}`}>{item.kitchenStatus}</span>
                      {NEXT_STATUS[item.kitchenStatus] && (
                        <button
                          type="button"
                          className="kds-advance-btn"
                          disabled={advance.isPending}
                          onClick={() =>
                            advance.mutate({
                              orderId: order.id,
                              itemId: item.id,
                              status: NEXT_STATUS[item.kitchenStatus]!,
                            })
                          }
                        >
                          {ADVANCE_LABEL[item.kitchenStatus]}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
