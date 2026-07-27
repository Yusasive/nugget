import { useEffect, useState, type SyntheticEvent } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { STAFF_ROLE_LABELS } from "@nugget/shared-types";
import { useAuth } from "../auth/auth-context";
import { DASHBOARD_ITEM, PROFILE_ITEM, navSectionsForRole } from "../auth/nav-config";
import logo from "../assets/logo.png";

export function AppShell() {
  const { staff, logout } = useAuth();
  const location = useLocation();
  const sections = navSectionsForRole(staff?.role ?? "SUPER_ADMIN");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Each section starts open only if the page it was mounted on lives
  // inside it; after that it's the user's own expand/collapse state,
  // except navigating into a still-collapsed section reopens it (but
  // never force-closes one the user opened themselves).
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      sections.map((section) => [
        section.label,
        section.items.some((item) => location.pathname.startsWith(item.path)),
      ]),
    ),
  );

  useEffect(() => {
    const active = sections.find((section) =>
      section.items.some((item) => location.pathname.startsWith(item.path)),
    );
    if (!active) return;
    setOpenSections((prev) => (prev[active.label] ? prev : { ...prev, [active.label]: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the route changes, not when `sections` is recomputed
  }, [location.pathname]);

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (!staff) return null;

  function toggleSection(label: string, event: SyntheticEvent<HTMLDetailsElement>) {
    // Read `open` synchronously — `event.currentTarget` is nulled out by the
    // time React's state-updater callback below actually runs.
    const isOpen = event.currentTarget.open;
    setOpenSections((prev) => ({ ...prev, [label]: isOpen }));
  }

  return (
    <div className="shell">
      <div className="mobile-topbar">
        <button
          className="hamburger"
          aria-label="Open navigation"
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen(true)}
        >
          <span /><span /><span />
        </button>
        <span className="mobile-brand">
          <img src={logo} alt="" width={20} height={18} />
          Nugget Continental
        </span>
      </div>

      {sidebarOpen && (
        <div className="sidebar-backdrop" aria-hidden onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar${sidebarOpen ? " sidebar--open" : ""}`}>
        <div className="brand">
          <img src={logo} alt="" width={24} height={22} />
          <span>
            Nugget Continental
            <br />
            Hotel &amp; Tours
          </span>
        </div>

        <nav>
          <NavLink to={DASHBOARD_ITEM.path} end className={({ isActive }) => (isActive ? "active" : "")}>
            {DASHBOARD_ITEM.label}
          </NavLink>

          {sections.map((section) => (
            <details
              key={section.label}
              className="nav-section"
              open={openSections[section.label] ?? false}
              onToggle={(event) => toggleSection(section.label, event)}
            >
              <summary>{section.label}</summary>
              <div className="nav-section-items">
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => (isActive ? "active" : "")}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </details>
          ))}
        </nav>

        <NavLink
          to={PROFILE_ITEM.path}
          className={({ isActive }) => `profile-link${isActive ? " active" : ""}`}
        >
          {PROFILE_ITEM.label}
        </NavLink>

        <div className="account">
          <strong>
            {staff.firstName} {staff.lastName}
          </strong>
          {STAFF_ROLE_LABELS[staff.role]} · {staff.branchName}
          <button type="button" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
