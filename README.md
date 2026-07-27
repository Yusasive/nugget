# Nugget Continental Hotel & Tours

Multi-branch hotel, restaurant & tours management system. See [PRD.md](./PRD.md), [TRD.md](./TRD.md), [milestone.md](./milestone.md), and [ui-ux.md](./ui-ux.md) for product/technical/design context.

This repo is currently at **Milestone 2 — Room & Reservation Core**.

## Stack

- **API:** NestJS (`apps/api`), Prisma → PostgreSQL, ioredis → Redis/Valkey
- **Web:** React + Vite + TypeScript (`apps/web`)
- **Shared:** `packages/shared-types` — TS types shared between api and web
- **Monorepo tooling:** pnpm workspaces + Turborepo

## Prerequisites

- Node.js 20+
- pnpm 9+ (`corepack enable` will pick up the pinned version from `package.json`)
- Docker Desktop (for local Postgres + Redis)

## Quickstart

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

pnpm install
pnpm infra:up
pnpm --filter @nugget/api prisma:migrate:dev
pnpm --filter @nugget/api prisma:seed

pnpm dev
```

`pnpm dev` starts local Postgres + Redis via Docker Compose, waits for them to be healthy, then runs the API (`http://localhost:3000/api/v1`) and the web app (`http://localhost:5173`) in parallel via Turborepo.

Visit `http://localhost:5173` and sign in with the seeded bootstrap account:

| | |
|---|---|
| Email | `admin@nugget.test` |
| Password | `ChangeMe123!` |

Override those via `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` before seeding. **Change this password before any shared or deployed environment** — the seed defaults are for local development only.

### Other commands

| Command | What it does |
|---|---|
| `pnpm build` | Build all apps/packages (dependency-ordered via Turborepo) |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Run across the whole monorepo |
| `pnpm --filter @nugget/api test:e2e` | Auth/RBAC/branch-scoping + booking-concurrency tests (needs Postgres + Redis running) |
| `pnpm infra:down` | Stop the local Postgres/Redis containers |
| `pnpm --filter @nugget/api prisma:studio` | Browse the dev database |

## Repository structure

```
apps/
├── api/            # NestJS backend
└── web/            # React (Vite) frontend
packages/
└── shared-types/   # Shared TypeScript types/DTOs between api and web
docker-compose.yml  # Local Postgres + Redis/Valkey only — app processes run natively for fast HMR
```

## Manual setup still required (not something this repo can do for you)

- **Aiven PostgreSQL + Valkey (dev & staging):** create a free-tier Aiven project, provision one Postgres and one Valkey service for `dev` and another pair for `staging`, then drop the connection strings into `apps/api/.env` (locally) and into GitHub Actions / your host's environment config (for staging). Local development does not need Aiven — Docker Compose covers it — but staging/CI-against-staging does.
- **GitHub repository + branch protection:** push this repo to GitHub, set `main` as protected, and require the `CI` workflow to pass before merge.
- **Paystack/Flutterwave test API keys (Milestone 5):** the integration code is written and unit-tested (initialize/verify/refund against each provider's real REST API, webhook signature verification), but has not been exercised against either provider's actual sandbox — that needs real test-mode secret keys. Drop them into `apps/api/.env` as `PAYSTACK_SECRET_KEY` / `FLUTTERWAVE_SECRET_KEY` / `FLUTTERWAVE_WEBHOOK_HASH` (see that file's comments for where to get each) to complete this milestone's DoD for real; until then, gateway payments fail with a clear "not configured" error rather than a confusing call with an empty key, and cash/POS-in-person payments (fully working today) prove the rest of the folio/invoice/payment logic.
- **Secrets:** notification providers (email/SMS), once wired up in a later milestone, belong in GitHub Actions secrets / host env vars the same way — never committed.

## Double-booking prevention (Milestone 2)

TRD §6's pattern, implemented in [booking.service.ts](./apps/api/src/booking/booking.service.ts): two layers, both required.

1. **Redis lock on the room** ([redis-lock.service.ts](./apps/api/src/redis/redis-lock.service.ts)) — a `SET key value PX <ttl> NX` mutex keyed on `lock:room:{roomId}`, not on the date range. Two requests for the *same room* always serialize, even if their date ranges only partially overlap — locking per exact range would miss that case. Released via a compare-and-delete Lua script so a request can never release a lock another holder has since acquired after its own TTL lapsed.
2. **Row-locked overlap check inside a Postgres transaction** — once a request holds the Redis lock, it re-checks for conflicting bookings with `SELECT ... FOR UPDATE` before inserting. This is the actual correctness guarantee; the Redis lock is what makes the common case fast and avoids hammering Postgres with lock contention, not the source of truth.

A `HELD` booking only blocks availability while `holdExpiresAt` is in the future (`BOOKING_HOLD_MINUTES`, default 15) — this is the "abandoned cart" window from PRD §5.2. `CONFIRMED` always blocks; `CANCELLED`/`EXPIRED` never do.

Proven under real concurrent load, not mocked: [booking-concurrency.e2e-spec.ts](./apps/api/test/booking-concurrency.e2e-spec.ts) fires genuinely simultaneous HTTP requests (including a 5-way race on one room/date) against the real app, real Postgres, and real Redis, and asserts exactly one ever wins.

## Front desk operations (Milestone 3)

Check-in, check-out, and room transfer, implemented in [booking.service.ts](./apps/api/src/booking/booking.service.ts) alongside the booking lifecycle, plus a computed [room-status-board.service.ts](./apps/api/src/room/room-status-board.service.ts).

- **Room status is computed, not stored.** `VACANT` / `OCCUPIED` / `DIRTY` / `OUT_OF_ORDER` is derived on every read from `isOutOfOrder`, `housekeepingStatus`, and whether a `CHECKED_IN` booking currently holds the room — see the doc comment on the `Room` model in `schema.prisma`. There is no status column to fall out of sync with reality.
- **Check-in reassignment and mid-stay transfer are separate code paths, on purpose.** Check-in's optional `roomId` override lets Front Desk swap the room right at arrival (the originally booked one isn't ready) without ever marking the original room dirty — nobody stayed there. `POST /bookings/:id/transfer` only accepts an already-`CHECKED_IN` booking, and dirties the *vacated* room, because a guest actually occupied it. Both paths reuse the same double-booking protection as booking creation: a Redis lock on the destination room plus a row-locked overlap check inside the transaction.
- **A room must be `CLEAN` to receive a check-in or a transfer.** This is what actually gates room reuse after checkout — `housekeepingStatus` flips to `DIRTY` automatically on checkout and on transfer-out, and back to `CLEAN` only via an explicit housekeeping action (`PATCH /rooms/:id/housekeeping-status`).
- **Early check-in / late check-out fees are computed at the moment of check-in/check-out**, not backfilled later, by comparing the actual timestamp against the branch's configurable `standardCheckInTime`/`standardCheckOutTime` (`booking.util.ts`'s `isEarlyCheckIn`/`isLateCheckOut`). The fee is added onto `totalAmount` and also recorded separately (`earlyCheckInFee`/`lateCheckOutFee`) so it's visible on the folio in a later milestone, not just baked into one opaque total.
- **The Front Desk board polls, it doesn't hold a WebSocket** (TRD §7 — the frontend's [FrontDeskPage.tsx](./apps/web/src/pages/FrontDeskPage.tsx) refetches on a 5-second interval). A row briefly flashes gold when its status changes between polls, so staff notice a change without a jarring re-render.

Proven end-to-end, not just by inspection: [front-desk-operations.e2e-spec.ts](./apps/api/test/front-desk-operations.e2e-spec.ts) runs the full check-in → transfer → check-out lifecycle against the real app and asserts the status board reflects every step, and separately proves that transferring into an occupied, dirty, or out-of-order room is rejected, and that a checked-in booking can no longer be cancelled.

## Shift & cash management (Milestone 4)

Shift open/close and cash reconciliation, implemented in [shift.service.ts](./apps/api/src/shift/shift.service.ts), with the reconciliation math itself isolated in [shift.util.ts](./apps/api/src/shift/shift.util.ts) so it's unit-testable without a database.

- **`totalSales` and `totalCashCollected` are the same figure for now, on purpose.** The TRD's `cash_reports` schema keeps them as separate fields because a non-cash tender will eventually make them diverge, but every collection modeled before Milestone 5's payment gateways exist is cash by definition — so `computeCashReconciliation` computes one number and reports it as both, rather than inventing a fake distinction ahead of the data that would justify one.
- **A check-in deposit is attributed to the collecting staff member's open shift automatically**, inside the same transaction as the check-in itself (`BookingService.checkIn`) — not as a separate manual bookkeeping step, and not via a second call into `ShiftService` (which would mean two transactions and a window where they could disagree). Having no open shift is not an error; the deposit still lands on the booking either way, it just isn't attributed anywhere.
- **A Front Desk staff member can only ever see their own shifts and cash report — not just their own branch's.** This is stricter than the standard branch-scoping extension (TRD §5) and is enforced a second time in `ShiftService` itself (`findAccessibleShiftOrThrow`), because the generic branch-scoping layer has no concept of "and also filter by which staff member this is." Cross-staff access returns 404, the same convention as cross-branch access.
- **`GET /shifts/mine/current` throws 404 rather than returning `null` for "no open shift."** Nest's response handling treats a bare `null` return the same as `undefined` and sends an empty body — a client calling `res.json()` on that gets a parse error instead of the value it expected. 404 is also the more correct status for "this resource (your current shift) doesn't exist right now," and the frontend's `ShiftPage.tsx` treats that specific 404 as the empty state, not an error.

Proven end-to-end: [shift-cash-management.e2e-spec.ts](./apps/api/test/shift-cash-management.e2e-spec.ts) runs the full open → several payments → close lifecycle against the real app and asserts zero discrepancy when the drawer matches, a correctly-signed discrepancy when it doesn't, that a second concurrent open/transaction-after-close/double-close are all rejected, that one Front Desk staff member cannot see another's shift or the consolidated cash-report view, and that a check-in deposit lands on the collecting staff member's shift automatically.

## Billing, invoicing & payments (Milestone 5)

The guest folio ([folio.service.ts](./apps/api/src/billing/folio.service.ts)), invoice lifecycle ([invoice.service.ts](./apps/api/src/billing/invoice.service.ts)), and payment/refund flow ([payment.service.ts](./apps/api/src/billing/payment.service.ts)), with both gateways behind one interface ([payment-provider.interface.ts](./apps/api/src/billing/providers/payment-provider.interface.ts)).

- **The folio is a computed view; the invoice is a deliberate snapshot.** `GET /bookings/:id/folio` recomputes room charge + fees + incidental `FolioCharge` rows + payments-so-far on every read, the same "computed, not stored" choice as the Milestone 3 room-status board. Issuing an invoice freezes `totalAmount` at that moment on purpose — a real invoice shouldn't silently reprice itself if a new incidental charge is added afterward. One active (non-`VOID`) invoice per booking at a time; amending means voiding (only while nothing has been paid against it) and reissuing, which naturally picks up the current folio total. There's no credit-note system yet — a deliberate Phase-1 boundary, not an oversight.
- **`InvoiceStatus` only ever stores `ISSUED`/`VOID`.** Whether it's actually paid (`UNPAID`/`PARTIALLY_PAID`/`PAID`) is derived from the Payment/Refund ledger at read time (`billing.util.ts`'s `deriveInvoicePaymentStatus`), never stored — so it structurally can't disagree with the payments that are the source of truth. `paymentNetAmount` folds a payment's own successful refunds into what it actually contributes, so `SUCCESSFUL`/`PARTIALLY_REFUNDED`/fully-`REFUNDED` all fall out of one formula instead of three separate branches.
- **MANUAL settles synchronously; PAYSTACK/FLUTTERWAVE go through an initialize → (webhook or manual verify) → confirm flow**, same as any real card/bank-transfer/USSD integration has to. A `CASH` MANUAL payment is attributed to the collecting staff member's open shift exactly like Milestone 4's check-in-deposit auto-attribution (and a `CASH` refund posts the matching `CASH_OUT`) — card/gateway tenders deliberately do not touch the cash-shift ledger, since that's specifically a cash drawer reconciliation tool.
- **A webhook never trusts its own payload.** `PaymentService.handleWebhook` checks the provider's signature first (HMAC-SHA512 over the raw body for Paystack; a static configured hash for Flutterwave), then re-verifies the transaction against the provider's own verify API before marking anything `SUCCESSFUL` (TRD §10) — a valid signature only proves the request came from the provider, not that its claimed status is trustworthy on its own.
- **Both gateway integrations are written and unit-tested against each provider's real API contract, but not yet exercised against a live sandbox** — an explicit scope decision for this pass (see "Manual setup still required" above) so the folio/invoice/payment architecture didn't have to wait on obtaining test credentials. Webhook signature verification specifically *is* covered end-to-end, since it's pure cryptography/string comparison that needs no network access to test honestly.
- **PDF generation only shows folio charges created before the invoice's `issuedAt`** ([invoice-pdf.service.ts](./apps/api/src/billing/invoice-pdf.service.ts)) — an approximation, since there's no `InvoiceLineItem` table snapshotting exactly which charges a given invoice billed. Consistent with the "no credit-note system yet" boundary above.

Proven end-to-end: [billing.e2e-spec.ts](./apps/api/test/billing.e2e-spec.ts) runs the full folio → issue invoice → partial cash payment → full payment → partial refund → full refund lifecycle against the real app (with real shift cash-attribution asserted at each cash-in/cash-out step), rejects issuing a second active invoice, voiding a paid one, zero/over-amount payments and over-amount refunds, generates and downloads both PDF types, and separately proves the webhook endpoints reject invalid signatures and safely no-op on validly-signed-but-unrelated deliveries — all without needing a live gateway sandbox.

## Pagination, filtering & layout (cross-cutting)

Every list endpoint — branches, staff, room types, rooms, the front-desk status board, bookings, shifts, cash reports — shares one pagination contract and one Prisma helper, applied after the fact once these had grown into eight near-identical "just return everything" endpoints.

- **One envelope, one helper, applied uniformly.** `PaginatedResponse<T>` (`page`/`pageSize`/`total`/`totalPages`/`data`) is the shape every list route returns; `normalizePagination()`/`buildPaginatedResponse()` ([common/pagination.ts](./apps/api/src/common/pagination.ts)) are the only place `skip`/`take`/`totalPages` arithmetic exists. `pageSize` clamps to 100 server-side regardless of what's requested, so a client can't force an unbounded query.
- **The front-desk board's status filter is computed, then pushed to the database anyway.** `VACANT`/`OCCUPIED`/`DIRTY`/`OUT_OF_ORDER` isn't a column (Milestone 3) — filtering by it means expressing the same isOutOfOrder/housekeepingStatus/active-booking logic as a `where` clause (`room-status-board.service.ts`'s `statusWhere`) instead of fetching everything and filtering in memory, so pagination on a computed field still means one bounded query, not a full table scan per page.
- **A "list" endpoint and a "give me every row for a dropdown" call are different needs wearing the same route.** Room type/branch pickers inside other forms (adding a room, adding staff) fetch `?pageSize=100` from the very same paginated endpoint rather than getting a second unpaginated route — simpler than maintaining two endpoints per resource, and 100 is comfortably above any realistic per-branch count for this data.
- **Search/filter state lives in the URL query string per request, not client-side filtering of an already-fetched page.** Every filter (`search`, `status`, date ranges, `roomTypeId`, ...) is a real `where` clause on the server; the frontend's only client-side logic is a 300ms debounce on free-text search inputs ([useDebouncedValue.ts](./apps/web/src/hooks/useDebouncedValue.ts)) so a paginated fetch doesn't fire on every keystroke.
- **The sidebar is `position: sticky`, not `fixed`, and only above the mobile breakpoint.** `fixed` would need the content column's margin hand-kept in sync with the sidebar's width; `sticky` inside the same grid does it for free and falls back to normal document flow automatically once the mobile media query switches the shell to a single column — a `fixed` sidebar at `height: 100vh` on a narrow screen would instead have permanently occupied the whole viewport.

## Authorization model (Milestone 1)

Two independent layers, both enforced server-side:

1. **Role gate** — `@Roles(...)` + `RolesGuard` on the route. Super Admin passes everything; every other role must be listed explicitly.
2. **Branch scope** — a Prisma client extension ([branch-scope.extension.ts](./apps/api/src/prisma/branch-scope.extension.ts)) injects the caller's `branchId` into every query on a branch-scoped model, sourced from request-scoped CLS context set by the JWT strategy.

The critical property is that layer 2 is **not** re-implemented per module (TRD §3.7). A service calls `prisma.staff.findMany()` with no branch filter and still cannot see another branch's rows. Adding a new branch-scoped table means adding its model name to one `Set` — nothing else.

Two deliberate choices worth knowing before extending this:

- **The scope is force-merged, not defaulted.** A caller-supplied `branchId` is *overwritten*, not respected. A controller bug that lets a user pass someone else's branch id therefore can't leak data.
- **Cross-branch reads return 404, never 403.** A 403 would confirm the record exists. Frontend nav gating ([nav-config.ts](./apps/web/src/auth/nav-config.ts)) is convenience only — the API rejects the call regardless.

## Architecture decisions made in this pass (pagination & layout)

- **Pagination retrofitted uniformly rather than per-page ad hoc.** Once a second list page needed it, the temptation is to copy-paste `skip`/`take` math; instead every resource's `list()` went through the same `normalizePagination`/`buildPaginatedResponse` pair on the backend and the same `<Pagination>` component plus `useDebouncedValue` hook on the frontend, so the ninth list view (whenever it arrives) is a smaller diff than the first one was.
- **The room-status board grew a `branchId` filter as a side effect of fixing its own e2e test.** Once paginated, Super Admin's "all branches" board could put a specific test's rooms on page 6 of a database that accumulates rooms across every run — the honest fix was a real filter (useful for Super Admin in general), not a larger page size hiding the same fragility.

## Architecture decisions from Milestone 5

- **`Invoice` stores only its own lifecycle (`ISSUED`/`VOID`); everything payment-shaped is derived.** Same rationale as Milestone 3's room-status board — a stored `PAID`/`PARTIALLY_PAID` column is a second place that number could live, and a second place is a place it can go stale. One pure function (`deriveInvoicePaymentStatus`) is the only place that logic exists.
- **One `PaymentProviderClient` interface, two implementations, selected at the call site — not a strategy registry or factory.** `PaymentService` never needs to know more than "which enum value did the caller pass"; adding a third gateway later means one more class implementing the same four methods, not a change to how `PaymentService` dispatches.
- **The gateway call happens before the database write, not after, in `createPayment`.** A gateway's initialize API can't be rolled back by a failed local transaction — so the write records what actually happened externally, accepting the (documented, narrow) risk of an orphaned gateway-side transaction if the local write itself then fails. Trying to make that fully transactional would need a saga/outbox pattern, which is more machinery than a Phase-1 integration with no live sandbox access yet justifies.
- **Worth knowing if you add another raw-body e2e test:** `moduleFixture.createNestApplication(undefined, { rawBody: true })` silently drops the options object — `@nestjs/testing`'s overload resolution treats a non-HTTP-adapter first argument as *the* options argument and never looks at a second one. The fix is `createNestApplication({ rawBody: true })`, options as the only argument. This cost real debugging time (`req.rawBody` was simply empty, no error) before the fix in `billing.e2e-spec.ts`'s webhook tests.

## Architecture decisions from Milestone 4

- **Shift/cash-report visibility as a second, stricter access check layered on top of branch scoping**, not a special case baked into the generic scoping extension. The extension answers "which branch" for every model uniformly; "which staff member, within my own branch" is specific to exactly one model (`Shift`) and belongs in `ShiftService`, not generalized into infrastructure that every other module would have to reason about.
- **The reconciliation math lives in a pure function (`computeCashReconciliation`), not inline in the service.** Money arithmetic with signed discrepancies is exactly the kind of logic worth unit-testing directly against a Decimal, without spinning up a database to prove `expected = opening + net` and `discrepancy = actual - expected` hold for every combination of cash-in/cash-out.
- **Automatic deposit attribution happens inside `BookingService.checkIn`'s own transaction, not via a call out to `ShiftService`.** A second service call would mean a second transaction — and thus a window, however small, where the booking is checked in but the shift transaction failed to attach, or vice versa. Reading and writing `Shift`/`ShiftTransaction` rows directly against the transaction handle already in scope keeps both atomic.

## Architecture decisions from Milestone 3

- **Room-status board as a computed view, not a stored/synced status column.** A stored status invites an entire class of bugs where a code path forgets to update it; deriving it fresh from `isOutOfOrder` + `housekeepingStatus` + the presence of an active `CHECKED_IN` booking makes an inconsistent board structurally impossible.
- **Housekeeping status, not booking status, gates room reuse after checkout.** `CHECKED_OUT` bookings deliberately do not block new bookings/check-ins/transfers into that room — `housekeepingStatus: 'DIRTY'` does, until an explicit cleaning action clears it. This matches how a real hotel works: the room isn't bookable again the instant a guest leaves, it's bookable once it's been cleaned.
- **Check-in-time room reassignment and mid-stay transfer are modeled as genuinely different operations**, not one generic "move booking to room" function with a flag — they have different preconditions (`CONFIRMED` vs. `CHECKED_IN`) and different housekeeping side effects (never-occupied room stays clean vs. vacated room goes dirty), and collapsing them into one function would need that distinction re-derived internally anyway.

## Architecture decisions from Milestone 2

- **Redis lock keyed on the room, not the date range**: locking per exact range would let two overlapping-but-not-identical requests race each other straight into the database. Locking the whole room serializes every attempt on it, and non-conflicting requests (genuinely different dates) still both succeed once each gets its turn — proven by the e2e suite, not assumed.
- **The Redis lock is a performance/contention optimization, not the correctness guarantee.** The Postgres row-locked overlap check inside the transaction is what actually prevents double-booking; the lock just keeps concurrent requests for the same room from all hammering that check at once.
- **`Booking.roomTypeId` deliberately doesn't exist** as a denormalized field, even though it would save a join in a few places — it's derivable from `room.roomType`, and a denormalized copy is a value that can drift from the truth if a room's type ever changes.
- **Guests are looked up by email and reused, not always recreated.** A repeat guest with the same email attaches to their existing `Guest` row rather than spawning a duplicate — cheap to do now, and avoids a data-cleanup problem before M10's CRM exists to fix it.

## Architecture decisions from Milestone 1

- **Prisma client extension for branch scoping**, rather than a Nest interceptor or a base-repository class: it sits at the lowest layer that every query must pass through, so there is no way to bypass it by writing a query somewhere new.
- **argon2 over bcrypt** for password hashing — memory-hard, and the current OWASP-preferred default.
- **Opaque random refresh tokens (hashed at rest), rotated on every use**, rather than a second JWT: rotation plus a stored `revokedAt` makes logout and compromise-response actually possible, which a stateless JWT can't offer. Reuse of a rotated-out token is rejected.
- **Roles as a table, not a Postgres enum**: adding or relabelling a role becomes seed data rather than a schema migration.

## Architecture decisions from Milestone 0

- **pnpm + Turborepo** over a single flat repo or Nx: the shared-types package needs to build before either app starts, and Turborepo's task graph (`dependsOn: ["^build"]`) handles that correctly with caching, without the heavier config surface of Nx.
- **Prisma** over TypeORM (TRD left this open): plain-SQL migration files are easy to review and audit — relevant given this system handles financial data — and its generated client keeps query types in sync with the schema automatically.
- **Docker Compose scoped to infra only** (Postgres + Redis), not the app processes: containerizing hot-reload for a pnpm/Turborepo monorepo is fragile (volume/node_modules conflicts) and buys nothing in local dev. `pnpm dev` gets you the same "one command" experience with proper HMR.
- **React + Vite (not Next.js)** per the updated TRD: this is a CSR SPA — SEO on the public booking site is explicitly not a priority for this scope.




The seeded bootstrap Super Admin account (local dev only):

Email	admin@nugget.test
Password	ChangeMe123!