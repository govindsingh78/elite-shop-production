import React from "react";
import Layout from "../common/Layout";
import BrandLogo from "../common/BrandLogo";

/** Side-panel content for each portal's sign-in and registration pages. */
const PORTAL_ASIDES = {
  customer: {
    badge: "Shopper account",
    heading: <>Your wardrobe,<br />beautifully organised.</>,
    perks: [
      ["Track every order", "Live status from placed to delivered."],
      ["Faster checkout", "Your saved delivery addresses, ready to go."],
      ["Pay your way", "UPI, net banking or cash on delivery."],
    ],
    foot: "Thoughtfully picked · Made to be worn on repeat",
  },
  vendor: {
    badge: "Seller hub",
    heading: <>Grow your brand<br />with Elite Shop.</>,
    perks: [
      ["List in minutes", "Add products, photos and stock from one simple form."],
      ["Ship with confidence", "Manage orders and post live tracking updates."],
      ["See what sells", "Sales, low-stock alerts and recent orders at a glance."],
    ],
    foot: "Elite Shop partner programme",
  },
  admin: {
    badge: "Store control",
    heading: <>Everything your store<br />needs, in one place.</>,
    perks: [
      ["Catalog & sellers", "Products, categories, brands and vendors."],
      ["Orders & tracking", "Fulfil orders and keep customers updated live."],
      ["Customers & payments", "Accounts, roles and online payment status."],
    ],
    foot: "Authorised staff only · Activity is logged",
  },
};

const PERK_ICONS = [
  <><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></>,
  <><path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z" /><circle cx="7.5" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" /></>,
  <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>,
];

/** Two-panel layout used by the customer, vendor and admin sign-in and registration pages. */
const CustomerAuthShell = ({ eyebrow, title, subtitle, children, wide = false, portal = "customer" }) => {
  const aside = PORTAL_ASIDES[portal] || PORTAL_ASIDES.customer;
  return (
    <Layout>
      <main className={`customer-auth customer-auth--${portal}`}>
        <div className={`customer-auth-card${wide ? " customer-auth-card--wide" : ""}`}>
          <aside className="customer-auth-aside" aria-hidden="true">
            <BrandLogo tone="light" size={44} />
            <span className="customer-auth-badge">{aside.badge}</span>
            <h2>{aside.heading}</h2>
            <ul>
              {aside.perks.map(([heading, copy], index) => (
                <li key={heading}>
                  <span className="customer-auth-perk-icon"><svg viewBox="0 0 24 24">{PERK_ICONS[index]}</svg></span>
                  <div><strong>{heading}</strong><small>{copy}</small></div>
                </li>
              ))}
            </ul>
            <p className="customer-auth-aside-foot">{aside.foot}</p>
          </aside>
          <section className="customer-auth-body">
            <p className="customer-eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            {subtitle && <p className="customer-auth-subtitle">{subtitle}</p>}
            {children}
          </section>
        </div>
      </main>
    </Layout>
  );
};

export default CustomerAuthShell;
