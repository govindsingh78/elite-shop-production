import React from "react";
import Layout from "../common/Layout";
import BrandLogo from "../common/BrandLogo";

const perks = [
  ["Track every order", "Live status from placed to delivered."],
  ["Faster checkout", "Your saved delivery addresses, ready to go."],
  ["Cash on delivery", "Pay when your order reaches your door."],
];

/** Two-panel layout used by the customer sign-in and registration pages. */
const CustomerAuthShell = ({ eyebrow, title, subtitle, children, wide = false }) => (
  <Layout>
    <main className="customer-auth">
      <div className={`customer-auth-card${wide ? " customer-auth-card--wide" : ""}`}>
        <aside className="customer-auth-aside" aria-hidden="true">
          <BrandLogo tone="light" size={44} />
          <h2>Your wardrobe,<br />beautifully organised.</h2>
          <ul>
            {perks.map(([heading, copy]) => (
              <li key={heading}><span>✦</span><div><strong>{heading}</strong><small>{copy}</small></div></li>
            ))}
          </ul>
          <p className="customer-auth-aside-foot">Thoughtfully picked · Made to be worn on repeat</p>
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

export default CustomerAuthShell;
