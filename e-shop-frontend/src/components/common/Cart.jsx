import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Layout from "./Layout";
import { apiUrl } from "./http";
import { useCart } from "../context/CartContext";
import { formatPrice } from "./currency";
import StorefrontProductCard from "./StorefrontProductCard";

const imageBase = apiUrl.replace(/\/api\/?$/, "");
const LOW_STOCK = 5;
const STEPS = ["Bag", "Details & delivery", "Confirmation"];

const perks = [
  ["Cash on delivery", "Pay when it arrives", <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></>],
  ["Live tracking", "Follow every step", <><path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z" /><circle cx="7.5" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" /></>],
  ["Secure checkout", "Prices verified by us", <><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></>],
];

const Cart = () => {
  const { items, count, subtotal, addItem, updateQuantity, removeItem, clearCart } = useCart();
  const navigate = useNavigate();
  const [shippingMethods, setShippingMethods] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiUrl}/storefront/shipping-methods`, { headers: { Accept: "application/json" }, signal: controller.signal })
      .then((response) => (response.ok ? response.json() : []))
      .then(setShippingMethods)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Suggestions for an empty bag.
  useEffect(() => {
    if (items.length) return undefined;
    const controller = new AbortController();
    fetch(`${apiUrl}/storefront/products`, { headers: { Accept: "application/json" }, signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => setSuggestions((result?.products?.data || []).slice(0, 4)))
      .catch(() => {});
    return () => controller.abort();
  }, [items.length]);

  const cheapestShipping = shippingMethods?.length ? Math.min(...shippingMethods.map((method) => Number(method.price))) : 0;
  const shippingLabel = shippingMethods === null ? "Calculated at checkout" : cheapestShipping === 0 ? "Free" : `From ${formatPrice(cheapestShipping)}`;

  const remove = (item) => {
    removeItem(item.id);
    toast.info(({ closeToast }) => (
      <span className="cart-undo">
        Removed {item.title}.
        <button type="button" onClick={() => {
          addItem({ id: item.id, title: item.title, price: item.price, image: item.image, sku: item.sku, qty: item.qtyAvailable }, item.quantity);
          closeToast();
        }}>Undo</button>
      </span>
    ));
  };

  const emptyBag = () => {
    if (window.confirm("Remove everything from your bag?")) clearCart();
  };

  return (
    <Layout>
      <main className="cart-page">
        <section className="cart-hero">
          <div className="container">
            <nav aria-label="Breadcrumb"><ol className="breadcrumb shop-breadcrumb mb-0"><li className="breadcrumb-item"><Link to="/">Home</Link></li><li className="breadcrumb-item active" aria-current="page">Shopping bag</li></ol></nav>
            <div className="cart-hero-copy">
              <div>
                <span className="shop-eyebrow">YOUR EDIT</span>
                <h1>Shopping bag<span>.</span></h1>
                <p>{items.length ? `${count} ${count === 1 ? "item" : "items"} ready for checkout.` : "Your bag is empty — for now."}</p>
              </div>
              {items.length > 0 && (
                <ol className="cart-steps" aria-label="Checkout progress">
                  {STEPS.map((step, index) => (
                    <li key={step} className={index === 0 ? "is-current" : ""} aria-current={index === 0 ? "step" : undefined}><span>{index + 1}</span>{step}</li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </section>

        <div className="container py-4 py-lg-5">
          {!items.length ? (
            <>
              <section className="cart-empty">
                <span className="cart-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 8h14l-1 13H6L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></svg></span>
                <h2>Your bag is waiting</h2>
                <p>Find something you’ll love wearing again and again.</p>
                <div className="d-flex flex-wrap justify-content-center gap-2">
                  <Link to="/shop" className="btn btn-primary cart-empty-cta">Explore the collection ↗</Link>
                  <Link to="/customer/orders" className="btn btn-outline-secondary cart-empty-cta">Track an order</Link>
                </div>
              </section>
              {suggestions.length > 0 && (
                <section className="pd-related">
                  <div className="pd-related-head"><div><span className="shop-eyebrow">FRESH IN</span><h2>Start with these</h2></div><Link to="/shop" className="customer-link">Shop all →</Link></div>
                  <div className="row g-3 g-lg-4">{suggestions.map((product) => <div className="col-6 col-lg-3" key={product.id}><StorefrontProductCard product={product} /></div>)}</div>
                </section>
              )}
            </>
          ) : (
            <div className="row g-4 g-xl-5">
              <div className="col-lg-8">
                <div className="cart-list-head">
                  <span>{count} {count === 1 ? "item" : "items"}</span>
                  <button type="button" onClick={emptyBag}>Empty bag</button>
                </div>
                <ul className="cart-list">
                  {items.map((item) => {
                    const max = Math.min(999, item.qtyAvailable ?? 999);
                    return (
                      <li key={item.id} className="cart-item">
                        <Link to={`/product/${item.id}`} className="cart-item-image">
                          {item.image
                            ? <img src={`${imageBase}/uploads/products/small/${encodeURIComponent(item.image)}`} alt={item.title} />
                            : <span>PW</span>}
                        </Link>
                        <div className="cart-item-body">
                          <div className="cart-item-top">
                            <div>
                              <Link to={`/product/${item.id}`} className="cart-item-title">{item.title}</Link>
                              <p className="cart-item-meta">{formatPrice(item.price)} each{item.sku ? ` · SKU ${item.sku}` : ""}</p>
                              {item.qtyAvailable != null && item.qtyAvailable <= LOW_STOCK && <p className="cart-item-stock">Only {item.qtyAvailable} left — order soon</p>}
                            </div>
                            <strong className="cart-item-total">{formatPrice(item.price * item.quantity)}</strong>
                          </div>
                          <div className="cart-item-actions">
                            <div className="pd-qty cart-qty" role="group" aria-label={`Quantity for ${item.title}`}>
                              <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1} aria-label="Decrease quantity">−</button>
                              <input type="number" min="1" max={max} value={item.quantity} onChange={(event) => updateQuantity(item.id, Math.min(max, Number(event.target.value) || 1))} aria-label="Quantity" />
                              <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= max} aria-label="Increase quantity">+</button>
                            </div>
                            <button type="button" className="cart-remove" onClick={() => remove(item)}>
                              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                              Remove
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <Link to="/shop" className="cart-continue">← Continue shopping</Link>
              </div>

              <aside className="col-lg-4">
                <section className="cart-summary">
                  <h2>Order summary</h2>
                  <dl>
                    <div><dt>Subtotal ({count} {count === 1 ? "item" : "items"})</dt><dd>{formatPrice(subtotal)}</dd></div>
                    <div><dt>Delivery</dt><dd className={cheapestShipping === 0 && shippingMethods ? "is-free" : ""}>{shippingLabel}</dd></div>
                    <div className="cart-summary-total"><dt>Total{cheapestShipping > 0 ? " (est.)" : ""}</dt><dd>{formatPrice(subtotal + cheapestShipping)}</dd></div>
                  </dl>
                  {shippingMethods?.length > 1 && <p className="cart-summary-note">Choose from {shippingMethods.length} delivery options at checkout.</p>}
                  <button type="button" className="btn btn-primary cart-checkout" onClick={() => navigate("/checkout")}>
                    Checkout securely <span aria-hidden="true">→</span>
                  </button>
                  <ul className="cart-perks">
                    {perks.map(([title, copy, icon]) => (
                      <li key={title}><span><svg viewBox="0 0 24 24" aria-hidden="true">{icon}</svg></span><div><strong>{title}</strong><small>{copy}</small></div></li>
                    ))}
                  </ul>
                </section>
              </aside>
            </div>
          )}
        </div>
      </main>
    </Layout>
  );
};

export default Cart;
