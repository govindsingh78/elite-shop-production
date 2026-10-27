import React, { useContext, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { AdminAuthContext } from "../context/AdminAuth";
import { BrandMark } from "./BrandLogo";
import { SUPPORT_PHONES } from "./support";

const adminLinks = [
  { label: "Overview", to: "/admin/dashboard", icon: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></> },
  { label: "Orders", to: "/admin/manage-orders", icon: <><path d="M5 3h14v18l-2.5-1.7L14 21l-2-1.7L9.5 21 7 19.3 5 21V3Z" /><path d="M8 8h8M8 12h8M8 16h4" /></> },
  { label: "Products", to: "/admin/manage-products", icon: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.4 7.7 7.6 4.4 7.6-4.4M12 12v9" /></> },
  { label: "Categories", to: "/admin/manage-categories", icon: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11" /></> },
  { label: "Reviews", to: "/admin/manage-reviews", icon: <path d="M12 3.4l2.65 5.37 5.93.86-4.29 4.18 1.01 5.9L12 16.92l-5.3 2.79 1.01-5.9-4.29-4.18 5.93-.86L12 3.4Z" /> },
  { label: "Sellers", to: "/admin/sellers", icon: <><path d="M3 10V5h18v5M5 10v10h14V10M9 20v-6h6v6" /><path d="M3 10a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" /></> },
  { label: "GST & invoices", to: "/admin/invoices", icon: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6M9 16h3" /></> },
  { label: "Coupons", to: "/admin/coupons", icon: <><path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4V8Z" /><path d="m9.5 14.5 5-5M9.5 9.5h.01M14.5 14.5h.01" /></> },
  { label: "Commissions", to: "/admin/commissions", icon: <><path d="M19 5 5 19" /><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /></> },
  { label: "Brands", to: "/admin/manage-brands", icon: <><path d="m12 3 2.2 5 5.5.6-4.1 3.7 1.2 5.4-4.8-2.8-4.8 2.8 1.2-5.4-4.1-3.7 5.5-.6L12 3Z" /></> },
  { label: "Sizes", to: "/admin/manage-sizes", icon: <><path d="M3 8h18v8H3z" /><path d="M7 8v3M11 8v4M15 8v3M19 8v4" /></> },
  { label: "Customers", to: "/admin/manage-users", icon: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.4-3.2 2.2-5 5.5-5s5.1 1.8 5.5 5M16 5.3a3 3 0 0 1 0 5.8M17 14c2.2.7 3.4 2.3 3.6 5" /></> },
  { label: "Server & health", to: "/admin/server", icon: <><rect x="3" y="4" width="18" height="7" rx="1.5" /><rect x="3" y="13" width="18" height="7" rx="1.5" /><path d="M7 7.5h.01M7 16.5h.01M11 7.5h6M11 16.5h6" /></> },
  { label: "Security", to: "/admin/security", icon: <><path d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></> },
  { label: "Shipping", to: "/admin/manage-shipping", icon: <><path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z" /><circle cx="7.5" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" /></> },
  { label: "Delivery areas", to: "/admin/delivery", icon: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></> },
];

const vendorLinks = [
  { label: "Overview", to: "/vendor/dashboard", icon: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></> },
  { label: "My products", to: "/vendor/products", icon: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.4 7.7 7.6 4.4 7.6-4.4M12 12v9" /></> },
  { label: "Category requests", to: "/vendor/category-requests", icon: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11M15 13v5M12.5 15.5h5" /></> },
  { label: "My orders", to: "/vendor/orders", icon: <><path d="M5 3h14v18l-2.5-1.7L14 21l-2-1.7L9.5 21 7 19.3 5 21V3Z" /><path d="M8 8h8M8 12h8M8 16h4" /></> },
  { label: "Invoices", to: "/vendor/invoices", icon: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6M9 16h3" /></> },
  { label: "Business & GST", to: "/vendor/business", icon: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></> },
  { label: "Earnings", to: "/vendor/earnings", icon: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 15h2" /></> },
  { label: "Visit storefront", to: "/shop", icon: <><path d="M3 10V5h18v5M5 10v10h14V10M9 20v-6h6v6" /><path d="M3 10a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" /></> },
];

const customerLinks = [
  { label: "Overview", to: "/customer/dashboard", icon: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></> },
  { label: "My orders", to: "/customer/orders", icon: <><path d="M5 8h14l-1 13H6L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></> },
  { label: "Wishlist", to: "/wishlist", icon: <path d="M12 20.3s-7.6-4.6-7.6-10.5A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.6 2.6c0 5.9-7.6 10.5-7.6 10.5Z" /> },
  { label: "Addresses", to: "/customer/addresses", icon: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></> },
  { label: "Profile & security", to: "/customer/profile", icon: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3M12 14v3" /></> },
  { label: "Continue shopping", to: "/shop", icon: <><path d="M3 10V5h18v5M5 10v10h14V10M9 20v-6h6v6" /><path d="M3 10a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0" /></> },
];

const variants = {
  admin: { links: adminLinks, home: "/admin/dashboard", login: "/admin/login", passwordPath: "/admin/change-password", role: "STORE CONTROL", menu: "Store menu", fallbackName: "Store administrator", fallbackEmail: "Administrator", label: "Admin navigation" },
  vendor: { links: vendorLinks, home: "/vendor/dashboard", login: "/vendor/login", passwordPath: "/vendor/change-password", role: "PARTNER PORTAL", menu: "Vendor menu", fallbackName: "Vendor account", fallbackEmail: "Vendor", label: "Vendor navigation", helpTitle: "Seller support", helpCopy: "Listings, orders or payouts — call us." },
  customer: { links: customerLinks, home: "/customer/dashboard", login: "/customer/login", role: "MY ACCOUNT", menu: "Account menu", fallbackName: "My account", fallbackEmail: "Customer", label: "Account navigation", helpTitle: "Need help?", helpCopy: "Orders, delivery or payments — call us." },
};

const NavIcon =({ children }) => <svg className="admin-sidebar-icon" viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;

const Sidebar = ({ variant = "admin" }) => {
  const { user, logout } = useContext(AdminAuthContext);
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const config = variants[variant] || variants.admin;
  const links = config.links;
  const profile = user?.user || user;
  const name = profile?.name || config.fallbackName;
  const role = config.role;

  const signOut = () => {
    logout();
    navigate(config.login, { replace: true });
  };

  return (
    <div className="admin-sidebar-shell">
      <button className="admin-sidebar-mobile-toggle" type="button" aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)}>
        <BrandMark size={34} />
        <span>{config.menu}</span>
        <span className={`admin-sidebar-chevron${mobileOpen ? " is-open" : ""}`} aria-hidden="true">⌄</span>
      </button>
      <aside className={`admin-sidebar${mobileOpen ? " is-open" : ""}`} aria-label={config.label}>
        <Link to={config.home} className="admin-sidebar-brand">
          <BrandMark size={42} className="admin-sidebar-brand-logo" />
          <span className="admin-sidebar-brand-copy"><strong>Elitezaar</strong><small>{role}</small></span>
        </Link>

        <div className="admin-sidebar-section-label">WORKSPACE</div>
        <nav className="admin-sidebar-nav">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to.endsWith("dashboard") || item.to === "/shop"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `admin-sidebar-link${isActive ? " is-active" : ""}`}
            >
              <NavIcon>{item.icon}</NavIcon>
              <span>{item.label}</span>
              <span className="admin-sidebar-link-arrow" aria-hidden="true">↗</span>
            </NavLink>
          ))}
        </nav>

        {config.passwordPath && <>
          <div className="admin-sidebar-section-label admin-sidebar-preferences-label">PREFERENCES</div>
          <nav className="admin-sidebar-nav">
            <NavLink to={config.passwordPath} onClick={() => setMobileOpen(false)} className={({ isActive }) => `admin-sidebar-link${isActive ? " is-active" : ""}`}>
              <NavIcon><><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3M12 14v3" /></></NavIcon>
              <span>Password &amp; sign-in</span>
              <span className="admin-sidebar-link-arrow" aria-hidden="true">↗</span>
            </NavLink>
          </nav>
        </>}

        <div className="admin-sidebar-spacer" />
        {config.helpTitle && (
          <div className="admin-sidebar-help">
            <strong>{config.helpTitle}</strong>
            <small>{config.helpCopy}</small>
            {SUPPORT_PHONES.map((phone) => (
              <a key={phone.tel} href={`tel:${phone.tel}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
                {phone.label}
              </a>
            ))}
          </div>
        )}
        <div className="admin-sidebar-profile">
          <span className="admin-sidebar-avatar">{name.trim().charAt(0).toUpperCase()}</span>
          <span className="admin-sidebar-profile-copy"><strong>{name}</strong><small>{profile?.email || config.fallbackEmail}</small></span>
          <button className="admin-sidebar-logout" type="button" onClick={signOut} aria-label="Sign out" title="Sign out">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></svg>
          </button>
        </div>
      </aside>
    </div>
  );
};

export default Sidebar;
