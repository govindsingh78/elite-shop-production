import React, { useContext, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import Layout from "./Layout";
import { apiUrl } from "./http";
import { formatPrice } from "./currency";
import { orderItemPath } from "./productPath";
import { SUPPORT_PHONES } from "./support";
import { AdminAuthContext } from "../context/AdminAuth";
import { customerRequest } from "../customer/customerApi";

const imageBase = apiUrl.replace(/\/api\/?$/, "");

const nextSteps = [
  ["Order placed", "We’ve received your order."],
  ["Packed", "Our team checks and packs your items."],
  ["On the way", "Handed to the courier — track it live."],
  ["Delivered", "Pay on delivery and enjoy."],
];

const OrderConfirmation = () => {
  const { id } = useParams();
  const location = useLocation();
  const isCustomer = useContext(AdminAuthContext).user?.portal === "customer";
  const [order, setOrder] = useState(location.state?.order || null);
  const [loading, setLoading] = useState(!location.state?.order && isCustomer);

  // After a refresh the order is gone from navigation state; signed-in customers can reload it.
  useEffect(() => {
    if (order || !isCustomer) return undefined;
    const controller = new AbortController();
    customerRequest(`orders/${id}`, { signal: controller.signal })
      .then(setOrder)
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, order, isCustomer]);

  const firstName = order?.customer_name?.split(" ")[0];
  const placedAt = order?.created_at ? new Date(order.created_at).toLocaleString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";

  return (
    <Layout>
      <main className="cart-page">
        <section className="cart-hero oc-hero">
          <div className="container">
            <ol className="cart-steps oc-steps" aria-label="Checkout progress">
              <li className="is-done"><span>✓</span>Bag</li>
              <li className="is-done"><span>✓</span>Details &amp; delivery</li>
              <li className="is-current" aria-current="step"><span>✓</span>Confirmation</li>
            </ol>
            <div className="oc-success">
              <svg className="oc-check" viewBox="0 0 52 52" aria-hidden="true">
                <circle cx="26" cy="26" r="24" />
                <path d="m15 27 7.5 7.5L38 19" />
              </svg>
              <span className="shop-eyebrow">ORDER CONFIRMED</span>
              <h1>Thank you{firstName ? `, ${firstName}` : ""}<span>!</span></h1>
              <p>Your order <strong>#{order?.id || id}</strong> has been placed{placedAt ? ` on ${placedAt}` : ""}.{order?.customer_email && <> A summary is linked to <strong>{order.customer_email}</strong>.</>}</p>
              <div className="oc-actions">
                {isCustomer && <Link to={`/customer/orders/${order?.id || id}`} className="btn btn-primary oc-btn">Track this order <span aria-hidden="true">→</span></Link>}
                <Link to="/shop" className={`btn ${isCustomer ? "btn-outline-secondary" : "btn-primary"} oc-btn`}>Continue shopping</Link>
              </div>
            </div>
          </div>
        </section>

        <div className="container py-4 py-lg-5">
          {loading && <div className="customer-skeleton-list"><span /><span /><span /></div>}

          {!loading && (
            <div className="row g-4 g-xl-5">
              <div className="col-lg-7 d-flex flex-column gap-4">
                <section className="co-section">
                  <header className="co-section-head"><span className="co-section-number">✦</span><div><h2>What happens next</h2><p>We’ll keep this order updated at every step.</p></div></header>
                  <ol className="oc-timeline">
                    {nextSteps.map(([title, copy], index) => (
                      <li key={title} className={index === 0 ? "is-done" : ""}>
                        <span className="oc-timeline-dot">{index === 0 ? "✓" : index + 1}</span>
                        <div><strong>{title}</strong><small>{copy}</small></div>
                      </li>
                    ))}
                  </ol>
                  {!isCustomer && (
                    <div className="oc-signup">
                      <div><strong>Want live tracking?</strong><small>Create an account with the same email to follow this order from your dashboard.</small></div>
                      <Link to="/customer/register" className="btn btn-outline-secondary btn-sm">Create account</Link>
                    </div>
                  )}
                </section>

                {order?.items?.length > 0 && (
                  <section className="co-section">
                    <header className="co-section-head"><span className="co-section-number">{order.items.length}</span><div><h2>Items in this order</h2></div></header>
                    <ul className="co-items oc-items">
                      {order.items.map((item) => (
                        <li key={item.id}>
                          <span className="co-item-image">
                            {item.product?.image ? <img src={`${imageBase}/uploads/products/small/${encodeURIComponent(item.product.image)}`} alt="" /> : <span>{item.product_title.charAt(0)}</span>}
                            <b>{item.quantity}</b>
                          </span>
                          <span className="co-item-copy">
                            {item.product_id ? <Link to={orderItemPath(item)}><strong>{item.product_title}</strong></Link> : <strong>{item.product_title}</strong>}
                            <small>{item.size ? `Size ${item.size} · ` : ""}{formatPrice(item.unit_price)} × {item.quantity}</small>
                          </span>
                          <strong className="co-item-total">{formatPrice(item.line_total)}</strong>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>

              <aside className="col-lg-5 d-flex flex-column gap-4">
                {order ? (
                  <>
                    <section className="cart-summary oc-summary">
                      <h2>Payment summary</h2>
                      <dl>
                        <div><dt>Subtotal</dt><dd>{formatPrice(order.subtotal)}</dd></div>
                        <div><dt>Delivery</dt><dd className={Number(order.shipping_amount) === 0 ? "is-free" : ""}>{Number(order.shipping_amount) === 0 ? "Free" : formatPrice(order.shipping_amount)}</dd></div>
                        <div className="cart-summary-total"><dt>Total</dt><dd>{formatPrice(order.total)}</dd></div>
                      </dl>
                      {order.payment_method === "razorpay" && order.payment_status === "paid" && (
                        <div className="oc-cod oc-paid">
                          <span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></svg></span>
                          <div><strong>Paid online · {formatPrice(order.total)}</strong><small>Payment received{order.razorpay_payment_id ? ` (ref. ${order.razorpay_payment_id})` : ""}. Nothing to pay on delivery.</small></div>
                        </div>
                      )}
                      {order.payment_method === "cod" && (
                        <div className="oc-cod">
                          <span aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></svg></span>
                          <div><strong>Cash on delivery</strong><small>Please keep {formatPrice(order.total)} ready when your order arrives.</small></div>
                        </div>
                      )}
                    </section>

                    <section className="co-section">
                      <header className="co-section-head mb-3"><div><h2>Delivering to</h2></div></header>
                      <address className="customer-address-preview">
                        <strong>{order.customer_name}</strong>
                        <span>{order.address}</span>
                        <span>{[order.city, order.state, order.postal_code].filter(Boolean).join(", ")}</span>
                        {order.country && <span>{order.country}</span>}
                        {order.customer_phone && <small>☎ {order.customer_phone}</small>}
                      </address>
                    </section>
                  </>
                ) : (
                  <section className="cart-summary oc-summary">
                    <h2>Order #{id}</h2>
                    <p className="text-muted mb-0">Your order was received. Keep your order number for your records — our team will prepare it for delivery.</p>
                  </section>
                )}

                <section className="oc-help">
                  <strong>Need help with your order?</strong>
                  <small>Call our helpline and quote order <b>#{order?.id || id}</b>.</small>
                  <span className="oc-help-phones">
                    {SUPPORT_PHONES.map((phone) => <a key={phone.tel} href={`tel:${phone.tel}`}>{phone.label}</a>)}
                  </span>
                </section>
              </aside>
            </div>
          )}
        </div>
      </main>
    </Layout>
  );
};

export default OrderConfirmation;
