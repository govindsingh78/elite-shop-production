import React, { useContext, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { AdminAuthContext } from "../context/AdminAuth";

const adminLinks = [
  { label: "Overview", to: "/admin/dashboard", icon: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></> },
  { label: "Orders", to: "/admin/manage-orders", icon: <><path d="M5 3h14v18l-2.5-1.7L14 21l-2-1.7L9.5 21 7 19.3 5 21V3Z" /><path d="M8 8h8M8 12h8M8 16h4" /></> },
  { label: "Products", to: "/admin/manage-products", icon: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.4 7.7 7.6 4.4 7.6-4.4M12 12v9" /></> },
  { label: "Categories", to: "/admin/manage-categories", icon: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11" /></> },
  { label: "Brands", to: "/admin/manage-brands", icon: <><path d="m12 3 2.2 5 5.5.6-4.1 3.7 1.2 5.4-4.8-2.8-4.8 2.8 1.2-5.4-4.1-3.7 5.5-.6L12 3Z" /></> },
  { label: "Customers", to: "/admin/manage-users", icon: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.4-3.2 2.2-5 5.5-5s5.1 1.8 5.5 5M16 5.3a3 3 0 0 1 0 5.8M17 14c2.2.7 3.4 2.3 3.6 5" /></> },
  { label: "Shipping", to: "/admin/manage-shipping", icon: <><path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z" /><circle cx="7.5" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" /></> },
];

const vendorLinks = [
  { label: "Overview", to: "/vendor/dashboard", icon: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></> },
  { label: "Visit storefront", to: "/shop", icon: <><path d="M3 10V5h18v5M5 10v10h14V10M9 20v-6h6v6" /><path d="M3 10a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" /></> },
];

const NavIcon = ({ children }) => <svg className="admin-sidebar-icon" viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;

const Sidebar = ({ variant = "admin" }) => {
  const { user, logout } = useContext(AdminAuthContext);
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isVendor = variant === "vendor";
  const links = isVendor ? vendorLinks : adminLinks;
  const profile = user?.user || user;
  const name = profile?.name || (isVendor ? "Vendor account" : "Store administrator");
  const role = isVendor ? "PARTNER PORTAL" : "STORE CONTROL";

  const signOut = () => {
    logout();
    navigate(isVendor ? "/vendor/login" : "/admin/login", { replace: true });
  };

  return (
    <div className="admin-sidebar-shell">
      <button className="admin-sidebar-mobile-toggle" type="button" aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>
        <span className="admin-sidebar-toggle-mark">PW</span>
        <span>{isVendor ? "Vendor menu" : "Store menu"}</span>
        <span className={`admin-sidebar-chevron${mobileOpen ? " is-open" : ""}`} aria-hidden="true">⌄</span>
      </button>
      <aside className={`admin-sidebar${mobileOpen ? " is-open" : ""}`} aria-label={isVendor ? "Vendor navigation" : "Admin navigation"}>
        <Link to={isVendor ? "/vendor/dashboard" : "/admin/dashboard"} className="admin-sidebar-brand">
          <span className="admin-sidebar-brand-mark">PW</span>
          <span className="admin-sidebar-brand-copy"><strong>Pure Wear</strong><small>{role}</small></span>
        </Link>

        <div className="admin-sidebar-section-label">WORKSPACE</div>
        <nav className="admin-sidebar-nav">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to.endsWith("dashboard")}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `admin-sidebar-link${isActive ? " is-active" : ""}`}
            >
              <NavIcon>{item.icon}</NavIcon>
              <span>{item.label}</span>
              <span className="admin-sidebar-link-arrow" aria-hidden="true">↗</span>
            </NavLink>
          ))}
        </nav>

        {!isVendor && <>
          <div className="admin-sidebar-section-label admin-sidebar-preferences-label">PREFERENCES</div>
          <nav className="admin-sidebar-nav">
            <NavLink to="/admin/change-password" onClick={() => setMobileOpen(false)} className={({ isActive }) => `admin-sidebar-link${isActive ? " is-active" : ""}`}>
              <NavIcon><><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3M12 14v3" /></></NavIcon>
              <span>Change password</span>
              <span className="admin-sidebar-link-arrow" aria-hidden="true">↗</span>
            </NavLink>
          </nav>
        </>}

        <div className="admin-sidebar-spacer" />
        <div className="admin-sidebar-profile">
          <span className="admin-sidebar-avatar">{name.trim().charAt(0).toUpperCase()}</span>
          <span className="admin-sidebar-profile-copy"><strong>{name}</strong><small>{profile?.email || (isVendor ? "Vendor" : "Administrator")}</small></span>
          <button className="admin-sidebar-logout" type="button" onClick={signOut} aria-label="Sign out" title="Sign out">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></svg>
          </button>
        </div>
      </aside>
    </div>
  );
};

export default Sidebar;
