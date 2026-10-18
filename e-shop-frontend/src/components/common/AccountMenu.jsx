import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import Dropdown from "react-bootstrap/Dropdown";
import { AdminAuthContext } from "../context/AdminAuth";

const icons = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  bag: <><path d="M5 8h14l-1 13H6L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
  receipt: <><path d="M5 3h14v18l-2.5-1.7L14 21l-2-1.7L9.5 21 7 19.3 5 21V3Z" /><path d="M8 8h8M8 12h8M8 16h4" /></>,
  box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.4 7.7 7.6 4.4 7.6-4.4M12 12v9" /></>,
  pin: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3M12 14v3" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.4-3.2 2.2-5 5.5-5s5.1 1.8 5.5 5M16 5.3a3 3 0 0 1 0 5.8M17 14c2.2.7 3.4 2.3 3.6 5" /></>,
  store: <><path d="M3 10V5h18v5M5 10v10h14V10M9 20v-6h6v6" /></>,
  shield: <><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c.5-4 3-6 7.5-6s7 2 7.5 6" /></>,
  signout: <path d="M10 17l5-5-5-5M15 12H3M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />,
};

const portals = {
  customer: {
    label: "Customer account",
    accent: "customer",
    items: [
      ["My dashboard", "/customer/dashboard", "Overview of your account", "dashboard"],
      ["My orders", "/customer/orders", "Track deliveries live", "bag"],
      ["Addresses", "/customer/addresses", "Saved delivery addresses", "pin"],
      ["Profile & security", "/customer/profile", "Details and password", "lock"],
    ],
  },
  vendor: {
    label: "Vendor portal",
    accent: "vendor",
    items: [
      ["Seller dashboard", "/vendor/dashboard", "Sales, orders and stock", "dashboard"],
      ["My products", "/vendor/products", "Manage your listings", "box"],
      ["My orders", "/vendor/orders", "Ship and track orders", "receipt"],
      ["Change password", "/vendor/change-password", "Keep your account secure", "lock"],
    ],
  },
  admin: {
    label: "Store admin",
    accent: "admin",
    items: [
      ["Admin dashboard", "/admin/dashboard", "Your store at a glance", "dashboard"],
      ["Orders", "/admin/manage-orders", "Fulfilment and tracking", "receipt"],
      ["Products", "/admin/manage-products", "The full catalog", "box"],
      ["Customers & users", "/admin/manage-users", "Accounts and roles", "users"],
      ["Change password", "/admin/change-password", "Keep your account secure", "lock"],
    ],
  },
};

const Icon = ({ name }) => <svg viewBox="0 0 24 24" aria-hidden="true">{icons[name]}</svg>;

/** Header account button: sign-in links for every portal, or the signed-in user's shortcuts. */
const AccountMenu = ({ onNavigate }) => {
  const { user, logout } = useContext(AdminAuthContext);
  const navigate = useNavigate();
  const portal = portals[user?.portal];
  const profile = user?.user || user;
  const initial = (profile?.name || "?").trim().charAt(0).toUpperCase();

  const signOut = () => {
    logout();
    onNavigate?.();
    navigate("/", { replace: true });
  };

  const item = ([label, to, hint, icon]) => (
    <Dropdown.Item key={to} as={Link} to={to} onClick={onNavigate} className="account-menu-item">
      <span className="account-menu-icon"><Icon name={icon} /></span>
      <span className="account-menu-copy"><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
      <span className="account-menu-arrow" aria-hidden="true">›</span>
    </Dropdown.Item>
  );

  return (
    <Dropdown align="end" className={`account-menu account-menu--${portal?.accent || "guest"}`}>
      <Dropdown.Toggle bsPrefix="store-icon-link" className={portal ? "account-menu-toggle is-signed-in" : "account-menu-toggle"} aria-label={portal ? `Account menu for ${profile?.name}` : "Sign in"} title={portal ? profile?.name : "Sign in"}>
        {portal ? <span className="account-menu-initial">{initial}</span> : <Icon name="user" />}
        {portal && <span className="account-menu-status" aria-hidden="true" />}
      </Dropdown.Toggle>

      <Dropdown.Menu className="account-menu-panel">
        {portal ? (
          <>
            <div className="account-menu-hero">
              <span className="account-menu-avatar">{initial}</span>
              <div className="account-menu-hero-copy">
                <span className="account-menu-chip">{portal.label}</span>
                <strong>{profile?.name}</strong>
                <small>{profile?.email}</small>
              </div>
            </div>
            <div className="account-menu-list">{portal.items.map(item)}</div>
            <div className="account-menu-footer">
              <Dropdown.Item as={Link} to="/shop" onClick={onNavigate} className="account-menu-footer-link"><Icon name="store" />Storefront</Dropdown.Item>
              <Dropdown.Item as="button" type="button" onClick={signOut} className="account-menu-signout"><Icon name="signout" />Sign out</Dropdown.Item>
            </div>
          </>
        ) : (
          <>
            <div className="account-menu-hero account-menu-hero--guest">
              <span className="account-menu-avatar"><Icon name="user" /></span>
              <div className="account-menu-hero-copy">
                <strong>Welcome to Street Shop</strong>
                <small>Sign in to track orders and check out faster.</small>
              </div>
            </div>
            <div className="account-menu-cta">
              <Link to="/customer/login" onClick={onNavigate} className="btn btn-primary">Sign in</Link>
              <Link to="/customer/register" onClick={onNavigate} className="btn btn-outline-secondary">Create account</Link>
            </div>
            <div className="account-menu-section">For business</div>
            <div className="account-menu-list">
              {item(["Vendor login", "/vendor/login", "Manage your seller account", "box"])}
              {item(["Become a vendor", "/vendor/register", "Sell with Street Shop", "store"])}
              {item(["Admin login", "/admin/login", "Store staff only", "shield"])}
            </div>
          </>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default AccountMenu;
