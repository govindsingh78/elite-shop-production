import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { formatPrice } from "../common/currency";
import { currentMilestone, formatDateTime, lastKnownLocation, MILESTONES, timeAgo, trackingLabel } from "../common/tracking";
import CustomerShell from "./CustomerShell";
import { customerRequest, formatDate } from "./customerApi";
import OrderStatus from "./OrderStatus";

const REFRESH_MS = 10000;

const CustomerOrderDetails = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [checkedAt, setCheckedAt] = useState(null);
  const [, setTick] = useState(0); // re-renders the "x minutes ago" labels
  const [justUpdated, setJustUpdated] = useState(false);
  const lastSeenEventId = useRef(null);

  const load = useCallback(async (signal) => {
    setRefreshing(true);
    try {
      const data = await customerRequest(`orders/${id}`, { signal });
      const newest = data.tracking_events?.[0];
      // A different newest event after the first load means the admin just posted an update.
      if (lastSeenEventId.current !== null && newest && newest.id !== lastSeenEventId.current) {
        toast.info(`Order update: ${trackingLabel(newest.status)}${newest.location ? ` · ${newest.location}` : ""}`);
        setJustUpdated(true);
        window.setTimeout(() => setJustUpdated(false), 2500);
      }
      lastSeenEventId.current = newest?.id ?? lastSeenEventId.current;
      setOrder(data);
      setError("");
      setCheckedAt(new Date());
    } catch (requestError) {
      if (requestError.name === "AbortError") return;
      setError(requestError.status === 404 ? "We couldn’t find that order on your account." : requestError.message);
    } finally {
      if (!signal?.aborted) setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    setOrder(null);
    lastSeenEventId.current = null;
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const finished = order && ["delivered", "cancelled"].includes(order.status);

  // Poll for new tracking updates while the order is still moving and the tab is visible.
  useEffect(() => {
    if (!order || finished) return undefined;
    const refreshIfVisible = () => { if (document.visibilityState === "visible") load(); };
    const timer = window.setInterval(refreshIfVisible, REFRESH_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [order, finished, load]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((tick) => tick + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const events = order?.tracking_events || [];
  const latest = events[0];
  const cancelled = order?.status === "cancelled";
  const delivered = order?.status === "delivered";
  const currentStep = currentMilestone(order);
  const location = lastKnownLocation(events);

  return (
    <CustomerShell>
      <Link to="/customer/orders" className="customer-back-link">← Back to my orders</Link>

      {error && <div className="alert alert-warning mt-3" role="alert">{error}</div>}
      {!order && !error && <div className="customer-skeleton-list mt-4">{[0, 1, 2].map((key) => <span key={key} />)}</div>}

      {order && (
        <>
          <div className="customer-page-head customer-page-head--split">
            <div>
              <span className="customer-eyebrow">ORDER #{order.id}</span>
              <h1>{latest ? trackingLabel(latest.status) : "Order placed"}</h1>
              <p>Placed on {formatDate(order.created_at)} · {order.items.length} {order.items.length === 1 ? "product" : "products"}</p>
            </div>
            <OrderStatus status={order.status} />
          </div>

          {!cancelled && (
            <ol className={`customer-timeline customer-timeline--5${justUpdated ? " is-updated" : ""}`} aria-label="Delivery progress" aria-live="polite">
              {MILESTONES.map((milestone, index) => (
                <li key={milestone.label} className={index < currentStep || delivered ? "is-done" : index === currentStep ? "is-current" : ""} aria-current={index === currentStep && !delivered ? "step" : undefined}>
                  <span className="customer-timeline-dot">{index < currentStep || delivered ? "✓" : index + 1}</span>
                  <span className="customer-timeline-label">{milestone.label}</span>
                </li>
              ))}
            </ol>
          )}

          <section className={`tracking-live${cancelled ? " is-cancelled" : ""}${order.status === "delivered" ? " is-delivered" : ""}`}>
            <div className="tracking-live-main">
              <div className="tracking-live-badge">
                {finished ? <span>{cancelled ? "Closed" : "Completed"}</span> : <><span className="tracking-pulse" aria-hidden="true" />Live tracking</>}
              </div>
              <p className="tracking-live-label">{cancelled ? "Status" : order.status === "delivered" ? "Delivered to" : "Current location"}</p>
              <h2>{cancelled ? "Order cancelled" : order.status === "delivered" ? `${order.city}${order.state ? `, ${order.state}` : ""}` : location || "Preparing at our warehouse"}</h2>
              {latest && <p className="tracking-live-note">{latest.description || trackingLabel(latest.status)} · <span title={formatDateTime(latest.event_at)}>{timeAgo(latest.event_at)}</span></p>}
            </div>
            <dl className="tracking-live-facts">
              <div><dt>Courier</dt><dd>{order.courier_name || "Assigned at dispatch"}</dd></div>
              <div><dt>Tracking number</dt><dd>{order.tracking_number || "Shared once shipped"}</dd></div>
              <div><dt>{order.status === "delivered" ? "Delivered on" : "Estimated delivery"}</dt><dd>{order.status === "delivered" ? formatDate(latest?.event_at) : order.estimated_delivery_date ? formatDate(order.estimated_delivery_date) : "To be confirmed"}</dd></div>
            </dl>
            {!finished && (
              <div className="tracking-live-refresh">
                <span>{checkedAt ? `Checked ${checkedAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" })} · refreshes automatically` : ""}</span>
                <button type="button" onClick={() => load()} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh now"}</button>
              </div>
            )}
          </section>

          <div className="row g-4">
            <div className="col-lg-7 d-flex flex-column gap-4">
              <section className="customer-panel">
                <header className="customer-panel-header"><div><h2>Tracking history</h2><p>Every update on your parcel’s journey.</p></div></header>
                <ol className="tracking-history">
                  {events.map((event, index) => (
                    <li key={event.id} className={index === 0 ? "is-latest" : ""}>
                      <span className="tracking-history-dot" aria-hidden="true" />
                      <div>
                        <strong>{trackingLabel(event.status)}</strong>
                        {event.location && <span className="tracking-history-location">📍 {event.location}</span>}
                        {event.description && <p>{event.description}</p>}
                      </div>
                      <time dateTime={event.event_at}>{formatDateTime(event.event_at)}</time>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="customer-panel">
                <header className="customer-panel-header"><div><h2>Items</h2></div></header>
                <ul className="customer-item-list">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      <span className="customer-item-thumb" aria-hidden="true">{item.product_title.charAt(0)}</span>
                      <span className="customer-item-copy">
                        {item.product_id ? <Link to={`/product/${item.product_id}`}>{item.product_title}</Link> : <strong>{item.product_title}</strong>}
                        <small>{formatPrice(item.unit_price)} × {item.quantity}{item.sku ? ` · SKU ${item.sku}` : ""}</small>
                        {delivered && item.product_id && <Link to={`/product/${item.product_id}#reviews`} className="customer-review-link">★ Rate &amp; review</Link>}
                      </span>
                      <strong>{formatPrice(item.line_total)}</strong>
                    </li>
                  ))}
                </ul>
                <dl className="customer-totals">
                  <div><dt>Subtotal</dt><dd>{formatPrice(order.subtotal)}</dd></div>
                  <div><dt>Shipping{order.shipping_method ? ` · ${order.shipping_method.name}` : ""}</dt><dd>{Number(order.shipping_amount) ? formatPrice(order.shipping_amount) : "Free"}</dd></div>
                  <div className="customer-totals-grand"><dt>Total</dt><dd>{formatPrice(order.total)}</dd></div>
                </dl>
              </section>
            </div>
            <div className="col-lg-5 d-flex flex-column gap-4">
              <section className="customer-panel">
                <header className="customer-panel-header"><div><h2>Delivery address</h2></div></header>
                <address className="customer-address-preview">
                  <strong>{order.customer_name}</strong>
                  <span>{order.address}</span>
                  <span>{[order.city, order.state, order.postal_code].filter(Boolean).join(", ")}</span>
                  {order.country && <span>{order.country}</span>}
                  {order.customer_phone && <small>☎ {order.customer_phone}</small>}
                </address>
              </section>
              <section className="customer-panel">
                <header className="customer-panel-header"><div><h2>Payment</h2></div></header>
                <dl className="customer-facts">
                  <div><dt>Payment method</dt><dd>{{ cod: "Cash on delivery", razorpay: "Online (UPI / net banking)" }[order.payment_method] || order.payment_method}</dd></div>
                  <div><dt>Payment status</dt><dd className="text-capitalize">{order.payment_status}</dd></div>
                </dl>
              </section>
            </div>
          </div>
        </>
      )}
    </CustomerShell>
  );
};

export default CustomerOrderDetails;
