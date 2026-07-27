import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { GuestLayout } from './guest/GuestLayout';
import { LandingPage } from './guest/LandingPage';
import { GuestRoomsPage } from './guest/GuestRoomsPage';
import { GuestToursPage } from './guest/GuestToursPage';
import { GuestRestaurantPage } from './guest/GuestRestaurantPage';
import { GuestAboutPage } from './guest/GuestAboutPage';
import { GuestGalleryPage } from './guest/GuestGalleryPage';
import { GuestContactPage } from './guest/GuestContactPage';
import { CheckoutPage } from './guest/CheckoutPage';
import { useAuth } from './auth/auth-context';
import { RequireRole } from './auth/RequireRole';
import { AppShell } from './components/AppShell';
import { AttendancePage } from './pages/AttendancePage';
import { AuditLogPage } from './pages/AuditLogPage';
import { BookingsPage } from './pages/BookingsPage';
import { BranchesPage } from './pages/BranchesPage';
import { CashReportsPage } from './pages/CashReportsPage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { DashboardPage } from './pages/DashboardPage';
import { FolioPage } from './pages/FolioPage';
import { FrontDeskPage } from './pages/FrontDeskPage';
import { InventoryPage } from './pages/InventoryPage';
import { KitchenDisplayPage } from './pages/KitchenDisplayPage';
import { LoginPage } from './pages/LoginPage';
import { MenuPage } from './pages/MenuPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { RestaurantOrdersPage } from './pages/RestaurantOrdersPage';
import { RestaurantTablesPage } from './pages/RestaurantTablesPage';
import { RoomsPage } from './pages/RoomsPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { RoomTypesPage } from './pages/RoomTypesPage';
import { ShiftPage } from './pages/ShiftPage';
import { StaffPage } from './pages/StaffPage';
import { TourBookingsPage } from './pages/TourBookingsPage';
import { TourCatalogPage } from './pages/TourCatalogPage';
import { TourDeparturesPage } from './pages/TourDeparturesPage';
import { TourManifestPage } from './pages/TourManifestPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { GuestsPage } from './pages/GuestsPage';
import { HousekeepingPage } from './pages/HousekeepingPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

function AuthenticatedRoutes() {
  const { staff } = useAuth();
  if (!staff) return <LoginPage />;

  return (
    <Routes>
      {/* No sidebar/nav — a deliberately different surface (ui-ux.md §7.2),
          so it sits outside AppShell's <Outlet/> rather than nested under it. */}
      <Route
        path="kitchen-display"
        element={
          <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'RESTAURANT_STAFF']}>
            <KitchenDisplayPage />
          </RequireRole>
        }
      />
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route
          path="branches"
          element={
            <RequireRole roles={['SUPER_ADMIN']}>
              <BranchesPage />
            </RequireRole>
          }
        />
        <Route
          path="staff"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER']}>
              <StaffPage />
            </RequireRole>
          }
        />
        <Route
          path="room-types"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK']}>
              <RoomTypesPage />
            </RequireRole>
          }
        />
        <Route
          path="rooms"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK']}>
              <RoomsPage />
            </RequireRole>
          }
        />
        <Route
          path="bookings"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'ACCOUNTANT']}>
              <BookingsPage />
            </RequireRole>
          }
        />
        <Route
          path="front-desk"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'HOUSEKEEPING']}>
              <FrontDeskPage />
            </RequireRole>
          }
        />
        <Route
          path="shift"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK']}>
              <ShiftPage />
            </RequireRole>
          }
        />
        <Route
          path="cash-reports"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT']}>
              <CashReportsPage />
            </RequireRole>
          }
        />
        <Route
          path="bookings/:bookingId/folio"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'ACCOUNTANT']}>
              <FolioPage />
            </RequireRole>
          }
        />
        <Route
          path="tour-catalog"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'TOURS_COORDINATOR']}>
              <TourCatalogPage />
            </RequireRole>
          }
        />
        <Route
          path="tour-departures"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'TOURS_COORDINATOR']}>
              <TourDeparturesPage />
            </RequireRole>
          }
        />
        <Route
          path="tour-departures/:departureId/manifest"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'TOURS_COORDINATOR']}>
              <TourManifestPage />
            </RequireRole>
          }
        />
        <Route
          path="tour-bookings"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'TOURS_COORDINATOR']}>
              <TourBookingsPage />
            </RequireRole>
          }
        />
        <Route
          path="menu"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF']}>
              <MenuPage />
            </RequireRole>
          }
        />
        <Route
          path="tables"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF']}>
              <RestaurantTablesPage />
            </RequireRole>
          }
        />
        <Route
          path="orders"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF']}>
              <RestaurantOrdersPage />
            </RequireRole>
          }
        />
        <Route
          path="inventory"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF']}>
              <InventoryPage />
            </RequireRole>
          }
        />
        <Route
          path="suppliers"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF']}>
              <SuppliersPage />
            </RequireRole>
          }
        />
        <Route
          path="purchases"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF']}>
              <PurchasesPage />
            </RequireRole>
          }
        />
        <Route
          path="expenses"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'FRONT_DESK', 'RESTAURANT_STAFF']}>
              <ExpensesPage />
            </RequireRole>
          }
        />
        <Route
          path="guests"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'ACCOUNTANT']}>
              <GuestsPage />
            </RequireRole>
          }
        />
        <Route
          path="housekeeping"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'FRONT_DESK', 'HOUSEKEEPING']}>
              <HousekeepingPage />
            </RequireRole>
          }
        />
        <Route
          path="departments"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER']}>
              <DepartmentsPage />
            </RequireRole>
          }
        />
        <Route
          path="attendance"
          element={
            <RequireRole
              roles={[
                'SUPER_ADMIN',
                'BRANCH_MANAGER',
                'FRONT_DESK',
                'HOUSEKEEPING',
                'ACCOUNTANT',
                'TOURS_COORDINATOR',
                'RESTAURANT_STAFF',
              ]}
            >
              <AttendancePage />
            </RequireRole>
          }
        />
        <Route
          path="reports"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RESTAURANT_STAFF']}>
              <ReportsPage />
            </RequireRole>
          }
        />
        <Route
          path="audit-log"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'BRANCH_MANAGER']}>
              <AuditLogPage />
            </RequireRole>
          }
        />
        <Route
          path="settings"
          element={
            <RequireRole roles={['SUPER_ADMIN']}>
              <SettingsPage />
            </RequireRole>
          }
        />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public guest-facing site */}
          <Route element={<GuestLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="rooms" element={<GuestRoomsPage />} />
            <Route path="tours" element={<GuestToursPage />} />
            <Route path="restaurant" element={<GuestRestaurantPage />} />
            <Route path="about" element={<GuestAboutPage />} />
            <Route path="gallery" element={<GuestGalleryPage />} />
            <Route path="contact" element={<GuestContactPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
          </Route>
          {/* Staff dashboard — all authenticated routes under /app */}
          <Route
            path="app/*"
            element={
              <AuthProvider>
                <AuthenticatedRoutes />
              </AuthProvider>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
