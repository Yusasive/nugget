import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type {
  BookingDto,
  HousekeepingTaskDto,
  HousekeepingTaskStatus,
  InventoryReportDto,
  OccupancyReportDto,
  PaginatedResponse,
  ProfitAndLossDto,
  RestaurantSalesReportDto,
  RoomBoardStatus,
  RoomStatusBoardEntry,
  ShiftDto,
  StaffRoleName,
  TourDepartureDto,
} from "@nugget/shared-types";
import { useAuth } from "../auth/auth-context";
import { api } from "../lib/api-client";

function firstOfMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthIso(): string {
  return new Date().toISOString().slice(0, 7);
}

function formatPercent(fraction: string): string {
  return `${(Number(fraction) * 100).toFixed(1)}%`;
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const ROOM_STATUS_PILL: Record<RoomBoardStatus, string> = {
  VACANT: "success",
  OCCUPIED: "info",
  DIRTY: "warning",
  OUT_OF_ORDER: "error",
};

const HOUSEKEEPING_STATUS_PILL: Record<HousekeepingTaskStatus, string> = {
  PENDING: "warning",
  IN_PROGRESS: "info",
  DONE: "success",
};

/**
 * ui-ux.md §7 item 2: "Super Admin / Branch Manager Home — occupancy,
 * restaurant sales, tour revenue, expenses, and P&L at a glance, scoped
 * appropriately." Every widget below is real data from the Milestone 12
 * reporting endpoints (or, for roles without report access, the
 * operational endpoint that role already has), gated to the roles that
 * can actually call it — no widget renders a request its role would get a
 * 403 for.
 */
export function DashboardPage() {
  const { staff } = useAuth();
  if (!staff) return null;

  const isScopedToBranch = staff.role !== "SUPER_ADMIN";
  const canSeeFinancials = staff.role === "SUPER_ADMIN" || staff.role === "BRANCH_MANAGER" || staff.role === "ACCOUNTANT";
  const canSeeBookings = staff.role === "SUPER_ADMIN" || staff.role === "BRANCH_MANAGER" || staff.role === "FRONT_DESK" || staff.role === "ACCOUNTANT";
  const canSeeRoomStatus = staff.role === "SUPER_ADMIN" || staff.role === "BRANCH_MANAGER" || staff.role === "FRONT_DESK" || staff.role === "HOUSEKEEPING";
  const canSeeHousekeeping = canSeeRoomStatus;
  const canSeeShift = staff.role === "SUPER_ADMIN" || staff.role === "BRANCH_MANAGER" || staff.role === "FRONT_DESK";
  const canSeeRestaurant = staff.role === "RESTAURANT_STAFF";
  const canSeeTours = staff.role === "TOURS_COORDINATOR";

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Welcome, {staff.firstName}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <span className="pill info">{isScopedToBranch ? staff.branchName : "All branches"}</span>
      </div>

      <div className="bento-grid">
        {canSeeFinancials && <KpiHeroWidget />}
        {canSeeBookings && <ReservationsTimelineWidget />}
        {canSeeRoomStatus && <RoomStatusGridWidget />}
        {canSeeHousekeeping && <HousekeepingWidget />}
        {canSeeRoomStatus && !canSeeHousekeeping && <div className="bento-card" />}
        {canSeeBookings && <ArrivalsDeparturesWidget />}
        {canSeeShift && <ShiftStatusWidget />}
        {canSeeRestaurant && <RestaurantWidget />}
        {canSeeTours && <ToursWidget />}
        {/* Fill remaining grid space with role-appropriate quick-action cards */}
        {canSeeRestaurant && <RestaurantQuickLinksWidget />}
        {canSeeTours && <ToursQuickLinksWidget />}
        {!canSeeFinancials && !canSeeRestaurant && !canSeeTours && <QuickLinksWidget role={staff.role} />}
      </div>
    </>
  );
}

function KpiHeroWidget() {
  const month = currentMonthIso();
  const occupancy = useQuery({
    queryKey: ["dashboard", "occupancy", month],
    queryFn: () =>
      api.get<OccupancyReportDto>(`/reports/occupancy?from=${firstOfMonthIso()}&to=${todayIso()}`),
  });
  const pl = useQuery({
    queryKey: ["dashboard", "profit-and-loss", month],
    queryFn: () => api.get<ProfitAndLossDto>(`/reports/profit-and-loss?month=${month}`),
  });

  return (
    <section className="bento-card bento-span-2">
      <div className="dashboard-section-header">
        <h3>Performance this month</h3>
        <Link className="btn-link" to="/reports">
          Full reports →
        </Link>
      </div>

      {(occupancy.isPending || pl.isPending) && <p className="muted">Loading…</p>}
      {(occupancy.isError || pl.isError) && (
        <div className="alert error">Could not load this month's performance.</div>
      )}

      {occupancy.data && pl.data && (
        <div className="card-grid">
          <div className="metric-card highlight">
            <div className="label">Occupancy</div>
            <div className="value">{formatPercent(occupancy.data.occupancyRate)}</div>
          </div>
          <div className="metric-card highlight">
            <div className="label">ADR</div>
            <div className="value">{occupancy.data.adr}</div>
          </div>
          <div className="metric-card highlight">
            <div className="label">RevPAR</div>
            <div className="value">{occupancy.data.revPar}</div>
          </div>
          <div className="metric-card highlight">
            <div className="label">Room revenue</div>
            <div className="value">{pl.data.roomRevenue}</div>
          </div>
        </div>
      )}
    </section>
  );
}

function ReservationsTimelineWidget() {
  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(i));

  const arrivals = useQuery({
    queryKey: ["dashboard", "reservations-timeline", days[0]],
    queryFn: async () => {
      const results = await Promise.all(
        days.map((day) =>
          api.get<PaginatedResponse<BookingDto>>(
            `/bookings?checkInDateFrom=${day}&checkInDateTo=${day}&pageSize=1`,
          ),
        ),
      );
      return days.map((day, i) => ({ day, count: results[i].total }));
    },
  });

  const maxCount = Math.max(1, ...(arrivals.data?.map((d) => d.count) ?? [1]));

  return (
    <section className="bento-card bento-span-2">
      <div className="dashboard-section-header">
        <h3>7-day reservations</h3>
        <Link className="btn-link" to="/app/bookings">
          Bookings →
        </Link>
      </div>

      {arrivals.isPending && <p className="muted">Loading…</p>}
      {arrivals.isError && <div className="alert error">Could not load the reservations timeline.</div>}

      {arrivals.data && (
        <div className="timeline-strip">
          {arrivals.data.map(({ day, count }) => (
            <div className="timeline-day" key={day}>
              <div className="timeline-bar-track">
                <div
                  className="timeline-bar"
                  style={{ height: `${Math.max(8, (count / maxCount) * 100)}%` }}
                />
              </div>
              <div className="timeline-count">{count}</div>
              <div className="timeline-label">
                {new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RoomStatusGridWidget() {
  const statuses: RoomBoardStatus[] = ["VACANT", "OCCUPIED", "DIRTY", "OUT_OF_ORDER"];
  const board = useQuery({
    queryKey: ["dashboard", "room-status-board"],
    queryFn: () => api.get<PaginatedResponse<RoomStatusBoardEntry>>("/rooms/status-board?pageSize=100"),
  });

  const counts = board.data
    ? Object.fromEntries(statuses.map((status) => [status, board.data.data.filter((e) => e.status === status).length]))
    : null;

  return (
    <section className="bento-card bento-span-2">
      <div className="dashboard-section-header">
        <h3>Room status</h3>
        <Link className="btn-link" to="/app/front-desk">
          Front desk board →
        </Link>
      </div>

      {board.isPending && <p className="muted">Loading…</p>}
      {board.isError && <div className="alert error">Could not load room status.</div>}

      {board.data && counts && (
        <>
          <div className="room-status-legend">
            {statuses.map((status) => (
              <span className="pill" key={status} data-status={ROOM_STATUS_PILL[status]}>
                <span className={`pill ${ROOM_STATUS_PILL[status]}`}>
                  {status.replace(/_/g, " ")} ({counts[status]})
                </span>
              </span>
            ))}
          </div>
          <div className="room-tile-grid">
            {board.data.data.map((entry) => (
              <div
                key={entry.room.id}
                className={`room-tile room-tile-${ROOM_STATUS_PILL[entry.status]}`}
                title={`${entry.room.roomNumber} — ${entry.status.replace(/_/g, " ")}`}
              >
                {entry.room.roomNumber}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function HousekeepingWidget() {
  const statuses: HousekeepingTaskStatus[] = ["PENDING", "IN_PROGRESS", "DONE"];
  const counts = useQuery({
    queryKey: ["dashboard", "housekeeping-counts"],
    queryFn: async () => {
      const results = await Promise.all(
        statuses.map((status) =>
          api.get<PaginatedResponse<HousekeepingTaskDto>>(`/housekeeping-tasks?status=${status}&pageSize=1`),
        ),
      );
      return Object.fromEntries(statuses.map((status, i) => [status, results[i].total])) as Record<
        HousekeepingTaskStatus,
        number
      >;
    },
  });
  const tasks = useQuery({
    queryKey: ["dashboard", "housekeeping-tasks", "PENDING"],
    queryFn: () => api.get<PaginatedResponse<HousekeepingTaskDto>>("/housekeeping-tasks?status=PENDING&pageSize=5"),
  });

  return (
    <section className="bento-card bento-span-2">
      <div className="dashboard-section-header">
        <h3>Housekeeping</h3>
        <Link className="btn-link" to="/housekeeping">
          Board →
        </Link>
      </div>

      {(counts.isPending || tasks.isPending) && <p className="muted">Loading…</p>}
      {(counts.isError || tasks.isError) && <div className="alert error">Could not load housekeeping.</div>}

      {counts.data && (
        <div className="status-row-stack">
          {statuses.map((status) => (
            <div className={`status-row status-row-${HOUSEKEEPING_STATUS_PILL[status]}`} key={status}>
              <span>{status.replace(/_/g, " ")}</span>
              <strong>{counts.data[status]}</strong>
            </div>
          ))}
        </div>
      )}

      {tasks.data && tasks.data.data.length > 0 && (
        <ul className="compact-list">
          {tasks.data.data.map((task) => (
            <li key={task.id}>
              <span>Room {task.room.roomNumber}</span>
              <span className="muted">{task.assignedToStaff ? `${task.assignedToStaff.firstName} ${task.assignedToStaff.lastName}` : "Unassigned"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ArrivalsDeparturesWidget() {
  const today = todayIso();
  const arrivals = useQuery({
    queryKey: ["dashboard", "arrivals", today],
    queryFn: () =>
      api.get<PaginatedResponse<BookingDto>>(`/bookings?checkInDateFrom=${today}&checkInDateTo=${today}&pageSize=5`),
  });
  const departures = useQuery({
    queryKey: ["dashboard", "departures", today],
    queryFn: () =>
      api.get<PaginatedResponse<BookingDto>>(`/bookings?checkOutDateFrom=${today}&checkOutDateTo=${today}&pageSize=5`),
  });

  return (
    <section className="bento-card bento-span-2">
      <div className="dashboard-section-header">
        <h3>Today's arrivals &amp; departures</h3>
        <Link className="btn-link" to="/app/bookings">
          Bookings →
        </Link>
      </div>

      <div className="arrivals-departures-split">
        <div>
          <div className="arrivals-departures-heading">
            Arrivals <span className="pill info">{arrivals.data?.total ?? "…"}</span>
          </div>
          {arrivals.isPending && <p className="muted">Loading…</p>}
          {arrivals.isError && <div className="alert error">Could not load arrivals.</div>}
          {arrivals.data && (
            <ul className="compact-list">
              {arrivals.data.data.map((b) => (
                <li key={b.id}>
                  <span>{b.guest.firstName} {b.guest.lastName}</span>
                  <span className="muted">Room {b.room.roomNumber}</span>
                </li>
              ))}
              {arrivals.data.data.length === 0 && <li className="muted">No arrivals today.</li>}
            </ul>
          )}
        </div>
        <div>
          <div className="arrivals-departures-heading">
            Departures <span className="pill warning">{departures.data?.total ?? "…"}</span>
          </div>
          {departures.isPending && <p className="muted">Loading…</p>}
          {departures.isError && <div className="alert error">Could not load departures.</div>}
          {departures.data && (
            <ul className="compact-list">
              {departures.data.data.map((b) => (
                <li key={b.id}>
                  <span>{b.guest.firstName} {b.guest.lastName}</span>
                  <span className="muted">Room {b.room.roomNumber}</span>
                </li>
              ))}
              {departures.data.data.length === 0 && <li className="muted">No departures today.</li>}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function ShiftStatusWidget() {
  const shift = useQuery({
    queryKey: ["dashboard", "shift-current"],
    queryFn: () => api.get<ShiftDto>("/shifts/mine/current"),
    // 404 = no open shift, treat as null not an error
    retry: false,
  });

  const isOpen = shift.data?.status === "OPEN";
  const totalIn = shift.data?.transactions
    .filter((t) => t.type === "CASH_IN")
    .reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;

  return (
    <section className="bento-card bento-span-2">
      <div className="dashboard-section-header">
        <h3>My shift</h3>
        <Link className="btn-link" to="/app/shift">Shift →</Link>
      </div>

      {shift.isPending && <p className="muted">Loading…</p>}

      {(shift.isError || !shift.data) && !shift.isPending && (
        <div className="card-grid">
          <div className="metric-card pending">
            <div className="label">Status</div>
            <div className="value">No open shift</div>
          </div>
          <div className="metric-card">
            <div className="label">Action</div>
            <div className="value" style={{ fontSize: "0.9375rem" }}>
              <Link to="/app/shift">Open a shift →</Link>
            </div>
          </div>
        </div>
      )}

      {shift.data && (
        <div className="card-grid">
          <div className={`metric-card highlight${isOpen ? "" : " pending"}`}>
            <div className="label">Status</div>
            <div className="value">{isOpen ? "Open" : "Closed"}</div>
          </div>
          <div className="metric-card">
            <div className="label">Opening cash</div>
            <div className="value">{shift.data.openingCash}</div>
          </div>
          <div className="metric-card">
            <div className="label">Cash collected</div>
            <div className="value">{totalIn.toFixed(2)}</div>
          </div>
          <div className="metric-card">
            <div className="label">Opened at</div>
            <div className="value" style={{ fontSize: "1rem" }}>
              {new Date(shift.data.openedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function RestaurantWidget() {
  const month = currentMonthIso();
  const sales = useQuery({
    queryKey: ["dashboard", "restaurant-sales", month],
    queryFn: () =>
      api.get<RestaurantSalesReportDto>(`/reports/restaurant-sales?from=${firstOfMonthIso()}&to=${todayIso()}`),
  });
  const inventory = useQuery({
    queryKey: ["dashboard", "inventory"],
    queryFn: () => api.get<InventoryReportDto>("/reports/inventory"),
  });

  return (
    <section className="bento-card bento-span-2">
      <div className="dashboard-section-header">
        <h3>Restaurant this month</h3>
        <Link className="btn-link" to="/orders">
          Orders →
        </Link>
      </div>

      {(sales.isPending || inventory.isPending) && <p className="muted">Loading…</p>}
      {(sales.isError || inventory.isError) && (
        <div className="alert error">Could not load restaurant data.</div>
      )}

      {sales.data && inventory.data && (
        <div className="card-grid">
          <div className="metric-card highlight">
            <div className="label">Sales</div>
            <div className="value">{sales.data.totalSales}</div>
          </div>
          <div className="metric-card">
            <div className="label">Orders</div>
            <div className="value">{sales.data.orderCount}</div>
          </div>
          <div className={`metric-card${inventory.data.lowStockCount > 0 ? " negative" : ""}`}>
            <div className="label">Low stock items</div>
            <div className="value">{inventory.data.lowStockCount}</div>
          </div>
        </div>
      )}
    </section>
  );
}

function ToursWidget() {
  const departures = useQuery({
    queryKey: ["dashboard", "tour-departures", "scheduled"],
    queryFn: () =>
      api.get<PaginatedResponse<TourDepartureDto>>("/tour-departures?status=SCHEDULED&pageSize=5"),
  });

  return (
    <section className="bento-card bento-span-2">
      <div className="dashboard-section-header">
        <h3>Tours</h3>
        <Link className="btn-link" to="/app/tour-departures">
          Departures →
        </Link>
      </div>

      {departures.isPending && <p className="muted">Loading…</p>}
      {departures.isError && <div className="alert error">Could not load tour departures.</div>}

      {departures.data && (
        <>
          <div className="card-grid" style={{ marginBottom: "var(--gutter)" }}>
            <div className="metric-card highlight">
              <div className="label">Upcoming scheduled departures</div>
              <div className="value">{departures.data.total}</div>
            </div>
          </div>
          {departures.data.data.length > 0 && (
            <ul className="compact-list">
              {departures.data.data.map((d) => (
                <li key={d.id}>
                  <span>{d.tourPackage.name}</span>
                  <span className="muted">
                    {new Date(d.departureAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    {" · "}{d.totalSeats - d.availableSeats}/{d.totalSeats} seats
                  </span>
                </li>
              ))}
            </ul>
          )}
          {departures.data.data.length === 0 && <p className="muted">No upcoming departures.</p>}
        </>
      )}
    </section>
  );
}

function RestaurantQuickLinksWidget() {
  const links = [
    { label: "Menu", path: "/menu", description: "Manage menu items & categories" },
    { label: "Tables", path: "/tables", description: "View & manage table status" },
    { label: "Inventory", path: "/inventory", description: "Check stock levels" },
    { label: "Suppliers", path: "/suppliers", description: "Manage suppliers" },
  ];
  return (
    <section className="bento-card bento-span-2">
      <div className="dashboard-section-header">
        <h3>Quick links</h3>
      </div>
      <div className="card-grid">
        {links.map(({ label, path, description }) => (
          <Link key={path} to={path} className="quick-link-card">
            <strong>{label}</strong>
            <span className="muted">{description}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ToursQuickLinksWidget() {
  const links = [
    { label: "Tour Catalog", path: "/tour-catalog", description: "Browse & manage tour packages" },
    { label: "Tour Bookings", path: "/tour-bookings", description: "View all tour bookings" },
    { label: "Attendance", path: "/attendance", description: "Your attendance record" },
    { label: "Expenses", path: "/expenses", description: "Submit & track expenses" },
  ];
  return (
    <section className="bento-card bento-span-2">
      <div className="dashboard-section-header">
        <h3>Quick links</h3>
      </div>
      <div className="card-grid">
        {links.map(({ label, path, description }) => (
          <Link key={path} to={path} className="quick-link-card">
            <strong>{label}</strong>
            <span className="muted">{description}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

const ROLE_QUICK_LINKS: Record<string, { label: string; path: string; description: string }[]> = {
  HOUSEKEEPING: [
    { label: "Housekeeping Board", path: "/housekeeping", description: "View & update task status" },
    { label: "Front Desk", path: "/front-desk", description: "Room status overview" },
    { label: "Attendance", path: "/attendance", description: "Your attendance record" },
  ],
  FRONT_DESK: [
    { label: "Front Desk", path: "/front-desk", description: "Check-in & check-out" },
    { label: "Bookings", path: "/bookings", description: "Manage reservations" },
    { label: "Shift", path: "/shift", description: "Open or close your shift" },
    { label: "Guests", path: "/guests", description: "Guest profiles" },
  ],
  ACCOUNTANT: [
    { label: "Cash Reports", path: "/cash-reports", description: "Consolidated cash view" },
    { label: "Expenses", path: "/expenses", description: "Approve & track expenses" },
    { label: "Reports", path: "/reports", description: "P&L and occupancy reports" },
    { label: "Bookings", path: "/bookings", description: "Reservation ledger" },
  ],
};

function QuickLinksWidget({ role }: { role: StaffRoleName }) {
  const links = ROLE_QUICK_LINKS[role] ?? [];
  if (links.length === 0) return null;
  return (
    <section className="bento-card bento-span-2">
      <div className="dashboard-section-header">
        <h3>Quick links</h3>
      </div>
      <div className="card-grid">
        {links.map(({ label, path, description }) => (
          <Link key={path} to={path} className="quick-link-card">
            <strong>{label}</strong>
            <span className="muted">{description}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
