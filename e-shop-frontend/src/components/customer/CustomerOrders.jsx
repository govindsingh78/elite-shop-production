import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatPrice } from "../common/currency";
import CustomerShell from "./CustomerShell";
import { customerRequest, formatDate, STATUS_LABELS } from "./customerApi";
import OrderStatus from "./OrderStatus";

const filters = [["", "All orders"], ...Object.entries(STATUS_LABELS)];

const CustomerOrders = () => {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ page: String(page), ...(status ? { status } : {}) });
    customerRequest(`orders?${query}`, { signal: controller.signal })
      .then(setResult)
      .catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [status, page]);

  const orders = result?.data || [];

  return (
    <CustomerShell>
      <div className="customer-page-head">
        <span className="customer-eyebrow">ORDER HISTORY</span>
        <h1>My orders</h1>
        <p>Every purchase you’ve made, with live delivery status.</p>
      </div>

      <div className="customer-filter-bar" role="tablist" aria-label="Filter orders by status">
        {filters.map(([value, label]) => (
          <button key={value || "all"} type="button" role="tab" aria-selected={status === value} className={`customer-filter${status === value ? " is-active" : ""}`} onClick={() => { setStatus(value); setPage(1); }}>
            {label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <section className="customer-panel">
        {loading && <div className="customer-skeleton-list">{[0, 1, 2, 3].map((key) => <span key={key} />)}</div>}
        {!loading && !error && !orders.length && (
          <div className="customer-empty">
            <span aria-hidden="true">📦</span>
            <h3>{status ? `No ${STATUS_LABELS[status].toLowerCase()} orders` : "No orders yet"}</h3>
            <p>{status ? "Try another filter to see the rest of your orders." : "Your orders will appear here once you check out."}</p>
            {!status && <Link to="/shop" className="btn btn-primary">Browse the collection</Link>}
          </div>
        )}
        {!loading && orders.length > 0 && (
          <ul className="customer-order-list">
            {orders.map((order) => (
              <li key={order.id}>
                <Link to={`/customer/orders/${order.id}`} className="customer-order-row">
                  <span className="customer-order-id">#{order.id}</span>
                  <span className="customer-order-meta"><strong>{formatDate(order.created_at)}</strong><small>{order.items_count} {order.items_count === 1 ? "item" : "items"} · {order.latest_tracking_event?.location ? `📍 ${order.latest_tracking_event.location}` : order.city}</small></span>
                  <OrderStatus status={order.status} />
                  <span className="customer-order-total">{formatPrice(order.total)}</span>
                  <span className="customer-order-arrow" aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {result && result.last_page > 1 && (
          <nav className="customer-pagination" aria-label="Order pages">
            <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>← Newer</button>
            <span>Page {result.current_page} of {result.last_page}</span>
            <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page >= result.last_page || loading} onClick={() => setPage((current) => current + 1)}>Older →</button>
          </nav>
        )}
      </section>
    </CustomerShell>
  );
};

export default CustomerOrders;
