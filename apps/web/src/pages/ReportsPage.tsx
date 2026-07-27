import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type {
  BranchDto,
  ExpenseReportDto,
  InventoryReportDto,
  OccupancyReportDto,
  PaginatedResponse,
  ProfitAndLossDto,
  RestaurantSalesReportDto,
} from '@nugget/shared-types';
import { useAuth } from '../auth/auth-context';
import { api, downloadAuthenticatedFile } from '../lib/api-client';

type Tab = 'occupancy' | 'restaurant-sales' | 'inventory' | 'expenses' | 'profit-and-loss';

const TABS: { key: Tab; label: string }[] = [
  { key: 'occupancy', label: 'Occupancy' },
  { key: 'restaurant-sales', label: 'Restaurant Sales' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'profit-and-loss', label: 'Profit & Loss' },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgoIso(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function currentMonthIso(): string {
  return new Date().toISOString().slice(0, 7);
}

function formatPercent(fraction: string): string {
  return `${(Number(fraction) * 100).toFixed(1)}%`;
}

/** PRD §5.14 reporting suite: occupancy/ADR/RevPAR, restaurant sales,
 * inventory valuation, expense report, and the company-wide P&L (M12's
 * DoD). Each tab's report shape stays identical whether scoped to one
 * branch or — for Super Admin with no branch selected — consolidated with
 * a `byBranch` breakdown, per ReportsService's contract. */
export function ReportsPage() {
  const [tab, setTab] = useState<Tab>('occupancy');

  return (
    <>
      <div className="page-header">
        <h2>Reports</h2>
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

      {tab === 'occupancy' && <OccupancyTab />}
      {tab === 'restaurant-sales' && <RestaurantSalesTab />}
      {tab === 'inventory' && <InventoryTab />}
      {tab === 'expenses' && <ExpensesTab />}
      {tab === 'profit-and-loss' && <ProfitAndLossTab />}
    </>
  );
}

function useBranchFilter() {
  const { staff } = useAuth();
  const isSuperAdmin = staff?.role === 'SUPER_ADMIN';
  const [branchId, setBranchId] = useState('');
  const branches = useQuery({
    queryKey: ['branches', 'all'],
    queryFn: () => api.get<PaginatedResponse<BranchDto>>('/branches?pageSize=100'),
    enabled: isSuperAdmin,
  });

  const control = isSuperAdmin ? (
    <div className="field">
      <label htmlFor="report-branch">Branch</label>
      <select id="report-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
        <option value="">All branches (consolidated)</option>
        {branches.data?.data.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </div>
  ) : null;

  return { branchId, control };
}

function BranchBreakdownTable<T extends { branchId: string | null; branchName: string | null }>({
  rows,
  columns,
}: {
  rows: T[];
  columns: { key: keyof T; label: string; format?: (value: T[keyof T]) => string }[];
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Branch</th>
            {columns.map((c) => (
              <th key={String(c.key)}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.branchId ?? 'consolidated'}>
              <td>{row.branchName ?? 'All Branches'}</td>
              {columns.map((c) => (
                <td key={String(c.key)}>{c.format ? c.format(row[c.key]) : String(row[c.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OccupancyTab() {
  const { branchId, control } = useBranchFilter();
  const [from, setFrom] = useState(thirtyDaysAgoIso());
  const [to, setTo] = useState(todayIso());

  const params = new URLSearchParams({ from, to });
  if (branchId) params.set('branchId', branchId);

  const report = useQuery({
    queryKey: ['reports', 'occupancy', from, to, branchId],
    queryFn: () => api.get<OccupancyReportDto>(`/reports/occupancy?${params}`),
  });

  return (
    <>
      <div className="filter-bar">
        <div className="field">
          <label htmlFor="occ-from">From</label>
          <input id="occ-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="occ-to">To</label>
          <input id="occ-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {control}
        <div className="field clear-filters">
          <label>&nbsp;</label>
          <button
            type="button"
            className="btn-link"
            onClick={() => downloadAuthenticatedFile(`/reports/occupancy?${params}&format=csv`, 'occupancy-report.csv')}
          >
            Export CSV
          </button>
        </div>
      </div>

      {report.isPending && <p className="muted">Loading…</p>}
      {report.isError && <div className="alert error">Could not load the occupancy report.</div>}

      {report.data && (
        <>
          <div className="card-grid">
            <div className="metric-card">
              <div className="label">Occupancy Rate</div>
              <div className="value">{formatPercent(report.data.occupancyRate)}</div>
            </div>
            <div className="metric-card">
              <div className="label">ADR</div>
              <div className="value">{report.data.adr}</div>
            </div>
            <div className="metric-card">
              <div className="label">RevPAR</div>
              <div className="value">{report.data.revPar}</div>
            </div>
            <div className="metric-card">
              <div className="label">Room Revenue</div>
              <div className="value">{report.data.roomRevenue}</div>
            </div>
          </div>

          {report.data.byBranch && (
            <BranchBreakdownTable
              rows={report.data.byBranch}
              columns={[
                { key: 'occupancyRate', label: 'Occupancy', format: (v) => formatPercent(v as string) },
                { key: 'adr', label: 'ADR' },
                { key: 'revPar', label: 'RevPAR' },
                { key: 'roomRevenue', label: 'Room Revenue' },
              ]}
            />
          )}
        </>
      )}
    </>
  );
}

function RestaurantSalesTab() {
  const { branchId, control } = useBranchFilter();
  const [from, setFrom] = useState(thirtyDaysAgoIso());
  const [to, setTo] = useState(todayIso());

  const params = new URLSearchParams({ from, to });
  if (branchId) params.set('branchId', branchId);

  const report = useQuery({
    queryKey: ['reports', 'restaurant-sales', from, to, branchId],
    queryFn: () => api.get<RestaurantSalesReportDto>(`/reports/restaurant-sales?${params}`),
  });

  return (
    <>
      <div className="filter-bar">
        <div className="field">
          <label htmlFor="rs-from">From</label>
          <input id="rs-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="rs-to">To</label>
          <input id="rs-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {control}
        <div className="field clear-filters">
          <label>&nbsp;</label>
          <button
            type="button"
            className="btn-link"
            onClick={() =>
              downloadAuthenticatedFile(`/reports/restaurant-sales?${params}&format=csv`, 'restaurant-sales-report.csv')
            }
          >
            Export CSV
          </button>
        </div>
      </div>

      {report.isPending && <p className="muted">Loading…</p>}
      {report.isError && <div className="alert error">Could not load the restaurant sales report.</div>}

      {report.data && (
        <>
          <div className="card-grid">
            <div className="metric-card">
              <div className="label">Total Sales</div>
              <div className="value">{report.data.totalSales}</div>
            </div>
            <div className="metric-card">
              <div className="label">Orders</div>
              <div className="value">{report.data.orderCount}</div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order Type</th>
                  <th>Total</th>
                  <th>Orders</th>
                </tr>
              </thead>
              <tbody>
                {report.data.byOrderType.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted">
                      No paid orders in this period.
                    </td>
                  </tr>
                )}
                {report.data.byOrderType.map((line) => (
                  <tr key={line.orderType}>
                    <td>{line.orderType.replace(/_/g, ' ')}</td>
                    <td>{line.total}</td>
                    <td>{line.orderCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function InventoryTab() {
  const { branchId, control } = useBranchFilter();
  const params = new URLSearchParams();
  if (branchId) params.set('branchId', branchId);

  const report = useQuery({
    queryKey: ['reports', 'inventory', branchId],
    queryFn: () => api.get<InventoryReportDto>(`/reports/inventory?${params}`),
  });

  return (
    <>
      <div className="filter-bar">
        {control}
        <div className="field clear-filters">
          <label>&nbsp;</label>
          <button
            type="button"
            className="btn-link"
            onClick={() => downloadAuthenticatedFile(`/reports/inventory?${params}&format=csv`, 'inventory-report.csv')}
          >
            Export CSV
          </button>
        </div>
      </div>

      {report.isPending && <p className="muted">Loading…</p>}
      {report.isError && <div className="alert error">Could not load the inventory report.</div>}

      {report.data && (
        <>
          <div className="card-grid">
            <div className="metric-card">
              <div className="label">Total Value</div>
              <div className="value">{report.data.totalValue}</div>
            </div>
            <div className="metric-card">
              <div className="label">Low Stock Items</div>
              <div className="value">{report.data.lowStockCount}</div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>On Hand</th>
                  <th>Unit Cost</th>
                  <th>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {report.data.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      No inventory items.
                    </td>
                  </tr>
                )}
                {report.data.items.map((item) => (
                  <tr key={item.inventoryItemId}>
                    <td>{item.name}</td>
                    <td>
                      {item.quantityOnHand} {item.unit}
                    </td>
                    <td>{item.unitCost}</td>
                    <td>{item.value}</td>
                    <td>
                      {item.isLowStock ? (
                        <span className="pill warning">Low stock</span>
                      ) : (
                        <span className="pill success">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function ExpensesTab() {
  const { branchId, control } = useBranchFilter();
  const [from, setFrom] = useState(thirtyDaysAgoIso());
  const [to, setTo] = useState(todayIso());

  const params = new URLSearchParams({ from, to });
  if (branchId) params.set('branchId', branchId);

  const report = useQuery({
    queryKey: ['reports', 'expenses', from, to, branchId],
    queryFn: () => api.get<ExpenseReportDto>(`/reports/expenses?${params}`),
  });

  return (
    <>
      <div className="filter-bar">
        <div className="field">
          <label htmlFor="exp-from">From</label>
          <input id="exp-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="exp-to">To</label>
          <input id="exp-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {control}
        <div className="field clear-filters">
          <label>&nbsp;</label>
          <button
            type="button"
            className="btn-link"
            onClick={() => downloadAuthenticatedFile(`/reports/expenses?${params}&format=csv`, 'expense-report.csv')}
          >
            Export CSV
          </button>
        </div>
      </div>

      {report.isPending && <p className="muted">Loading…</p>}
      {report.isError && <div className="alert error">Could not load the expense report.</div>}

      {report.data && (
        <>
          <div className="card-grid">
            <div className="metric-card">
              <div className="label">Total Expenses (Approved)</div>
              <div className="value">{report.data.totalExpenses}</div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {report.data.byCategory.length === 0 && (
                  <tr>
                    <td colSpan={2} className="muted">
                      No approved expenses in this period.
                    </td>
                  </tr>
                )}
                {report.data.byCategory.map((line) => (
                  <tr key={line.categoryId}>
                    <td>{line.categoryName}</td>
                    <td>{line.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function ProfitAndLossTab() {
  const { branchId, control } = useBranchFilter();
  const [month, setMonth] = useState(currentMonthIso());

  const params = new URLSearchParams({ month });
  if (branchId) params.set('branchId', branchId);

  const report = useQuery({
    queryKey: ['reports', 'profit-and-loss', month, branchId],
    queryFn: () => api.get<ProfitAndLossDto>(`/reports/profit-and-loss?${params}`),
  });

  const netProfitPositive = report.data && Number(report.data.netProfit) >= 0;

  return (
    <>
      <div className="filter-bar">
        <div className="field">
          <label htmlFor="pl-month">Month</label>
          <input id="pl-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        {control}
        <div className="field clear-filters">
          <label>&nbsp;</label>
          <button
            type="button"
            className="btn-link"
            onClick={() =>
              downloadAuthenticatedFile(`/reports/profit-and-loss?${params}&format=pdf`, `profit-and-loss-${month}.pdf`)
            }
          >
            Export PDF
          </button>{' '}
          <button
            type="button"
            className="btn-link"
            onClick={() =>
              downloadAuthenticatedFile(`/reports/profit-and-loss?${params}&format=csv`, `profit-and-loss-${month}.csv`)
            }
          >
            Export CSV
          </button>
        </div>
      </div>

      {report.isPending && <p className="muted">Loading…</p>}
      {report.isError && <div className="alert error">Could not load the P&amp;L report.</div>}

      {report.data && (
        <>
          <div className="card-grid">
            <div className="metric-card">
              <div className="label">Room Revenue</div>
              <div className="value">{report.data.roomRevenue}</div>
            </div>
            <div className="metric-card">
              <div className="label">Restaurant Revenue</div>
              <div className="value">{report.data.restaurantRevenue}</div>
            </div>
            <div className="metric-card">
              <div className="label">Tour Revenue</div>
              <div className="value">{report.data.tourRevenue}</div>
            </div>
            <div className="metric-card">
              <div className="label">Total Revenue</div>
              <div className="value">{report.data.totalRevenue}</div>
            </div>
            <div className="metric-card">
              <div className="label">Total Expenses</div>
              <div className="value">{report.data.totalExpenses}</div>
            </div>
            <div className={`metric-card${netProfitPositive ? '' : ' pending'}`}>
              <div className="label">Net Profit</div>
              <div className="value">{report.data.netProfit}</div>
            </div>
          </div>

          <h3>Expenses by category</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {report.data.expensesByCategory.length === 0 && (
                  <tr>
                    <td colSpan={2} className="muted">
                      No approved expenses this month.
                    </td>
                  </tr>
                )}
                {report.data.expensesByCategory.map((line) => (
                  <tr key={line.categoryId}>
                    <td>{line.categoryName}</td>
                    <td>{line.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {report.data.byBranch && (
            <>
              <h3>By branch</h3>
              <BranchBreakdownTable
                rows={report.data.byBranch}
                columns={[
                  { key: 'totalRevenue', label: 'Revenue' },
                  { key: 'totalExpenses', label: 'Expenses' },
                  { key: 'netProfit', label: 'Net Profit' },
                ]}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
