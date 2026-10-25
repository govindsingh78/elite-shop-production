import React, { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../common/Layout";
import { apiUrl } from "../common/http";
import { formatPrice } from "../common/currency";
import { AdminAuthContext } from "../context/AdminAuth";
import VendorSidebar from "./VendorSidebar";
import OrderStatus from "../customer/OrderStatus";

const statTiles = [
  { key: "revenue", label: "Sales", accent: "violet", money: true, icon: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></> },
  { key: "total_orders", label: "Orders", accent: "teal", icon: <><path d="M5 3h14v18l-2.5-1.7L14 21l-2-1.7L9.5 21 7 19.3 5 21V3Z" /><path d="M8 8h8M8 12h8" /></> },
  { key: "to_ship", label: "To ship", accent: "amber", icon: <><path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z" /><circle cx="7.5" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" /></> },
  { key: "active_products", label: "Live products", accent: "green", icon: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.4 7.7 7.6 4.4 7.6-4.4M12 12v9" /></> },
];

const VendorDashboard = () => {
  const { user } = useContext(AdminAuthContext);
  const vendor = user?.user || user;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiUrl}/vendor/dashboard`, {
      signal: controller.signal,
      headers: { Accept: "application/json", Authorization: `Bearer ${localStorage.getItem("vendorToken") || ""}` },
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Unable to load your dashboard.");
        setData(result);
      })
      .catch((requestError) => {
        if (requestError.name === "AbortError") return;
        setError(requestError instanceof TypeError ? `Cannot reach the API at ${apiUrl}.` : requestError.message);
      });
    return () => controller.abort();
  }, []);

  const stats = data?.stats;

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex admin-dashboard-layout">
          <VendorSidebar />
          <main className="container-fluid admin-dashboard-content customer-content">
            <section className="customer-hero">
              <div>
                <span className="customer-eyebrow customer-eyebrow--light">SELLER WORKSPACE</span>
                <h1>Welcome, {vendor?.name?.split(" ")[0] || "Seller"}<span>.</span></h1>
                <p>{stats ? `${stats.units_sold.toLocaleString()} units sold · ${stats.total_products} products listed` : "Loading your store…"}</p>
              </div>
              <Link to="/vendor/products/create" className="customer-hero-cta">＋ List a product</Link>
            </section>

            {error && <div className="alert alert-danger" role="alert">{error}</div>}

            {stats && (stats.pending_review > 0 || stats.rejected > 0) && (
              <Link to={`/vendor/products?approval=${stats.rejected ? "rejected" : "pending"}`} className={`review-callout${stats.rejected ? " is-rejected" : ""}`}>
                <span className="review-callout-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h10M7 21h10M8 3c0 4.5 8 4.5 8 9s-8 4.5-8 9M16 3c0 4.5-8 4.5-8 9s8 4.5 8 9" /></svg></span>
                <span className="review-callout-text">
                  <strong>{[
                    stats.pending_review > 0 && `${stats.pending_review} ${stats.pending_review === 1 ? "listing" : "listings"} in review`,
                    stats.rejected > 0 && `${stats.rejected} ${stats.rejected === 1 ? "needs" : "need"} changes`,
                  ].filter(Boolean).join(" · ")}</strong>
                  <small>{stats.rejected ? "See our team’s note, update the listing and save to resubmit." : "They appear in the store as soon as our team approves them."}</small>
                </span>
                <span className="review-callout-cta">View <span aria-hidden="true">→</span></span>
              </Link>
            )}

            {stats && (stats.balance_due !== 0 || stats.pending_earnings > 0) && (
              <Link to="/vendor/earnings" className="review-callout is-earnings">
                <span className="review-callout-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 15h2" /></svg></span>
                <span className="review-callout-text">
                  <strong>{formatPrice(stats.balance_due)} due to you</strong>
                  <small>{stats.pending_earnings > 0 ? `${formatPrice(stats.pending_earnings)} more once your current orders are delivered. ` : ""}Elitezaar’s commission is {Number(stats.commission_rate).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%.</small>
                </span>
                <span className="review-callout-cta">Earnings <span aria-hidden="true">→</span></span>
              </Link>
            )}

            <div className="row g-3 mb-4">
              {statTiles.map((tile, index) => (
                <div className="col-6 col-xl-3" key={tile.key}>
                  <article className={`customer-stat customer-stat--${tile.accent}`} style={{ "--card-index": index }}>
                    <span className="customer-stat-icon"><svg viewBox="0 0 24 24" aria-hidden="true">{tile.icon}</svg></span>
                    <p>{tile.label}</p>
                    <strong>{stats ? (tile.money ? formatPrice(stats[tile.key]) : stats[tile.key].toLocaleString()) : <span className="admin-stat-skeleton" aria-label="Loading" />}</strong>
                  </article>
                </div>
              ))}
            </div>

            <div className="row g-4">
              <div className="col-xl-8">
                <section className="customer-panel">
                  <header className="customer-panel-header">
                    <div><h2>Recent orders</h2><p>Your latest sales and their delivery status.</p></div>
                    <Link to="/vendor/orders" className="customer-link">View all →</Link>
                  </header>
                  {!data && !error && <div className="customer-skeleton-list">{[0, 1, 2].map((key) => <span key={key} />)}</div>}
                  {data && !data.recent_orders.length && (
                    <div className="customer-empty">
                      <span aria-hidden="true">🧾</span>
                      <h3>No orders yet</h3>
                      <p>Once customers buy your products, their orders show up here.</p>
                      <Link to="/vendor/products" className="btn btn-primary">Review your products</Link>
                    </div>
                  )}
                  {data?.recent_orders.length > 0 && (
                    <ul className="customer-order-list">
                      {data.recent_orders.map((order) => (
                        <li key={order.id}>
                          <Link to={`/vendor/orders/${order.id}`} className="customer-order-row">
                            <span className="customer-order-id">#{order.id}</span>
                            <span className="customer-order-meta"><strong>{order.customer_name}</strong><small>{order.items_count} {order.items_count === 1 ? "item" : "items"} · {order.latest_tracking_event?.location ? `📍 ${order.latest_tracking_event.location}` : order.city}</small></span>
                            <OrderStatus status={order.status} />
                            <span className="customer-order-total">{formatPrice(order.vendor_subtotal)}</span>
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
                    <div><h2>Low stock</h2><p>Products with 5 or fewer left.</p></div>
                    <Link to="/vendor/products" className="customer-link">Manage</Link>
                  </header>
                  {data && !data.low_stock_products.length && <p className="text-muted mb-0">All your products are well stocked.</p>}
                  {data?.low_stock_products.length > 0 && (
                    <ul className="vendor-stock-list">
                      {data.low_stock_products.map((product) => (
                        <li key={product.id}>
                          <Link to={`/vendor/products/${product.id}/edit`}>
                            <span><strong>{product.title}</strong><small>SKU {product.sku}</small></span>
                            <span className={`vendor-stock-qty${product.qty === 0 ? " is-out" : ""}`}>{product.qty === 0 ? "Sold out" : `${product.qty} left`}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="customer-quick-links">
                  <Link to="/vendor/products/create"><span>＋</span>List a new product</Link>
                  <Link to="/vendor/products"><span>📦</span>My products ({stats?.total_products ?? "–"})</Link>
                  <Link to="/vendor/orders"><span>🚚</span>Orders to ship ({stats?.to_ship ?? "–"})</Link>
                  <Link to="/vendor/change-password"><span>🔒</span>Change password</Link>
                </section>
              </div>
            </div>
          </main>
        </div>
      </div>
    </Layout>
  );
};

export default VendorDashboard;
