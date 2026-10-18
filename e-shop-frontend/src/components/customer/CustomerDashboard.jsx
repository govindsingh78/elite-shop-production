import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatPrice } from "../common/currency";
import CustomerShell from "./CustomerShell";
import { customerRequest, formatDate } from "./customerApi";
import OrderStatus from "./OrderStatus";

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const statTiles = [
  { key: "total_orders", label: "Orders placed", accent: "teal", icon: <><path d="M5 8h14l-1 13H6L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></> },
  { key: "active_orders", label: "In progress", accent: "amber", icon: <><path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z" /><circle cx="7.5" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" /></> },
  { key: "delivered_orders", label: "Delivered", accent: "green", icon: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></> },
  { key: "total_spent", label: "Total spent", accent: "violet", money: true, icon: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></> },
];

const CustomerDashboard = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    customerRequest("dashboard", { signal: controller.signal })
      .then(setData)
      .catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); });
    return () => controller.abort();
  }, []);

  const user = data?.user;
  const address = data?.default_address;
  const firstName = user?.name?.split(" ")[0];

  return (
    <CustomerShell>
      <section className="customer-hero">
        <div>
          <span className="customer-eyebrow customer-eyebrow--light">MY ACCOUNT</span>
          <h1>{greeting()}{firstName ? `, ${firstName}` : ""}<span>.</span></h1>
          <p>{user ? `Member since ${formatDate(user.created_at)} · ${user.email}` : "Loading your account…"}</p>
        </div>
        <Link to="/shop" className="customer-hero-cta">Continue shopping <span aria-hidden="true">↗</span></Link>
      </section>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <div className="row g-3 mb-4">
        {statTiles.map((tile, index) => (
          <div className="col-6 col-xl-3" key={tile.key}>
            <article className={`customer-stat customer-stat--${tile.accent}`} style={{ "--card-index": index }}>
              <span className="customer-stat-icon"><svg viewBox="0 0 24 24" aria-hidden="true">{tile.icon}</svg></span>
              <p>{tile.label}</p>
              <strong>
                {data ? (tile.money ? formatPrice(data.stats[tile.key]) : data.stats[tile.key].toLocaleString()) : <span className="admin-stat-skeleton" aria-label="Loading" />}
              </strong>
            </article>
          </div>
        ))}
      </div>

      <div className="row g-4">
        <div className="col-xl-8">
          <section className="customer-panel">
            <header className="customer-panel-header">
              <div><h2>Recent orders</h2><p>Your latest purchases and where they are.</p></div>
              <Link to="/customer/orders" className="customer-link">View all →</Link>
            </header>
            {!data && !error && <div className="customer-skeleton-list">{[0, 1, 2].map((key) => <span key={key} />)}</div>}
            {data && !data.recent_orders.length && (
              <div className="customer-empty">
                <span aria-hidden="true">🛍</span>
                <h3>No orders yet</h3>
                <p>When you place an order, you can follow it here from checkout to your doorstep.</p>
                <Link to="/shop" className="btn btn-primary">Start shopping</Link>
              </div>
            )}
            {data?.recent_orders.length > 0 && (
              <ul className="customer-order-list">
                {data.recent_orders.map((order) => (
                  <li key={order.id}>
                    <Link to={`/customer/orders/${order.id}`} className="customer-order-row">
                      <span className="customer-order-id">#{order.id}</span>
                      <span className="customer-order-meta"><strong>{formatDate(order.created_at)}</strong><small>{order.items_count} {order.items_count === 1 ? "item" : "items"}{order.latest_tracking_event?.location ? ` · 📍 ${order.latest_tracking_event.location}` : ""}</small></span>
                      <OrderStatus status={order.status} />
                      <span className="customer-order-total">{formatPrice(order.total)}</span>
                      <span className="customer-order-arrow" aria-hidden="true">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="col-xl-4 d-flex flex-column gap-4">
          <section className="customer-panel">
            <header className="customer-panel-header">
              <div><h2>Delivering to</h2><p>Your default address.</p></div>
              <Link to="/customer/addresses" className="customer-link">Manage</Link>
            </header>
            {address ? (
              <address className="customer-address-preview">
                <span className="customer-address-label">{address.label}</span>
                <strong>{address.full_name}</strong>
                <span>{address.address}</span>
                <span>{address.city}, {address.state} {address.postal_code}</span>
                <span>{address.country}</span>
                <small>☎ {address.phone}</small>
              </address>
            ) : data && (
              <div className="customer-empty customer-empty--compact">
                <p>Add a delivery address to speed up checkout.</p>
                <Link to="/customer/addresses" className="btn btn-outline-secondary btn-sm">Add address</Link>
              </div>
            )}
          </section>

          <section className="customer-quick-links">
            <Link to="/customer/orders"><span>📦</span>Track an order</Link>
            <Link to="/customer/addresses"><span>📍</span>Saved addresses ({data?.stats.saved_addresses ?? "–"})</Link>
            <Link to="/customer/profile"><span>🔒</span>Profile &amp; password</Link>
            <Link to="/cart"><span>👜</span>Your shopping bag</Link>
          </section>
        </div>
      </div>
    </CustomerShell>
  );
};

export default CustomerDashboard;
