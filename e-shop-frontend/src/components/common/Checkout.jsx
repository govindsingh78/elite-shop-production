import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "./Layout";
import { apiUrl } from "./http";
import { useCart } from "../context/CartContext";
import { formatPrice } from "./currency";

const initialForm = {
  customer_name: "", customer_email: "", customer_phone: "", address: "", city: "",
  state: "", postal_code: "", country: "", notes: "",
};

const Checkout = () => {
  const { items, subtotal, clearCart } = useCart();
  const navigate = useNavigate();
  const [customerAction, setCustomerAction] = useState("guest");
  const [form, setForm] = useState(initialForm);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [shippingMethods, setShippingMethods] = useState([]);
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [loadingShipping, setLoadingShipping] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/storefront/shipping-methods`, { headers: { Accept: "application/json" } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load delivery methods.");
        return data;
      })
      .then((data) => {
        if (active) {
          setShippingMethods(data);
          if (data.length) setShippingMethodId(String(data[0].id));
        }
      })
      .catch((requestError) => { if (active) setError(requestError.message || "Unable to load delivery methods."); })
      .finally(() => { if (active) setLoadingShipping(false); });
    return () => { active = false; };
  }, []);

  const shipping = shippingMethods.find((method) => String(method.id) === shippingMethodId);
  const shippingAmount = Number(shipping?.price || 0);
  const total = useMemo(() => subtotal + shippingAmount, [subtotal, shippingAmount]);

  const changeAction = (event) => {
    setCustomerAction(event.target.value);
    setPassword("");
    setPasswordConfirmation("");
    setError("");
    setFieldErrors({});
  };

  const changeField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
  };

  const submitOrder = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setFieldErrors({});
    try {
      const payload = {
        ...form,
        customer_action: customerAction,
        ...(customerAction === "guest" ? {} : { account_password: password }),
        ...(customerAction === "register" ? { account_password_confirmation: passwordConfirmation } : {}),
        payment_method: "cod",
        shipping_method_id: shippingMethodId ? Number(shippingMethodId) : null,
        items: items.map(({ id, quantity }) => ({ product_id: id, quantity })),
      };
      const response = await fetch(`${apiUrl}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.status === 422) {
        const validationErrors = {};
        Object.entries(data.errors || {}).forEach(([field, messages]) => { validationErrors[field] = messages[0]; });
        setFieldErrors(validationErrors);
        setError(Object.values(data.errors || {}).flat()[0] || data.message || "Please check the information and try again.");
        return;
      }
      if (!response.ok) throw new Error(data.message || "Unable to place order.");
      if (data.customer_token && data.customer) {
        localStorage.setItem("customerToken", data.customer_token);
        localStorage.setItem("customer", JSON.stringify(data.customer));
      }
      clearCart();
      navigate(`/order-confirmation/${data.data.id}`, { replace: true, state: { order: data.data } });
    } catch (requestError) {
      setError(requestError.message || "Unable to reach checkout.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!items.length) return <Layout><main className="container py-5 text-center"><h1 className="h3">Your bag is empty</h1><p className="text-muted">Add a product before checking out.</p><Link to="/shop" className="btn btn-primary">Browse products</Link></main></Layout>;

  const input = (name, label, options = {}) => (
    <div className="mb-3">
      <label htmlFor={name} className="form-label">{label}</label>
      {options.multiline ? (
        <textarea id={name} name={name} rows={options.rows || 2} autoComplete={options.autoComplete} className={`form-control ${fieldErrors[name] ? "is-invalid" : ""}`} value={form[name]} onChange={changeField} required={options.required} />
      ) : (
        <input id={name} name={name} type={options.type || "text"} autoComplete={options.autoComplete} className={`form-control ${fieldErrors[name] ? "is-invalid" : ""}`} value={form[name]} onChange={changeField} required={options.required} />
      )}
      {fieldErrors[name] && <div className="invalid-feedback">{fieldErrors[name]}</div>}
    </div>
  );

  return (
    <Layout>
      <main className="container product-detail py-4 pb-5">
        <nav aria-label="Breadcrumb" className="mb-4"><ol className="breadcrumb"><li className="breadcrumb-item"><Link to="/">Home</Link></li><li className="breadcrumb-item"><Link to="/cart">Shopping bag</Link></li><li className="breadcrumb-item active" aria-current="page">Checkout</li></ol></nav>
        <h1 className="h2 border-bottom pb-3 mb-4">Checkout</h1>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <form onSubmit={submitOrder}>
          <div className="row g-4">
            <section className="col-lg-7">
              <div className="card border-0 shadow-sm mb-4"><div className="card-body p-4">
                <h2 className="h5 mb-3">Customer details</h2>
                <div className="mb-3"><label htmlFor="customer_action" className="form-label">Checkout as</label><select id="customer_action" className="form-select" value={customerAction} onChange={changeAction}><option value="guest">Guest checkout</option><option value="register">Create a new customer account</option><option value="login">I already have an account</option></select></div>
                {customerAction !== "login" && input("customer_name", "Full name", { autoComplete: "name", required: true })}
                {input("customer_email", "Email address", { type: "email", autoComplete: "email", required: true })}
                {customerAction === "login" && <div className="mb-3"><label htmlFor="account_password" className="form-label">Account password</label><input id="account_password" type="password" autoComplete="current-password" className="form-control" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>}
                {customerAction === "login" && input("customer_name", "Full name for delivery", { autoComplete: "name", required: true })}
                {customerAction === "register" && <>
                  <div className="mb-3"><label htmlFor="account_password" className="form-label">Create password</label><input id="account_password" type="password" autoComplete="new-password" minLength={8} className="form-control" value={password} onChange={(event) => setPassword(event.target.value)} required /><div className="form-text">Use at least 8 characters.</div></div>
                  <div className="mb-3"><label htmlFor="account_password_confirmation" className="form-label">Confirm password</label><input id="account_password_confirmation" type="password" autoComplete="new-password" minLength={8} className="form-control" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} required /></div>
                </>}
                {input("customer_phone", "Phone (optional)", { type: "tel", autoComplete: "tel" })}
              </div></div>
              <div className="card border-0 shadow-sm"><div className="card-body p-4">
                <h2 className="h5 mb-3">Delivery address</h2>
                {input("address", "Street address", { autoComplete: "street-address", multiline: true, required: true })}
                <div className="row"><div className="col-md-6">{input("city", "City", { autoComplete: "address-level2", required: true })}</div><div className="col-md-6">{input("state", "State / region", { autoComplete: "address-level1" })}</div><div className="col-md-6">{input("postal_code", "Postal code", { autoComplete: "postal-code" })}</div><div className="col-md-6">{input("country", "Country", { autoComplete: "country-name" })}</div></div>
                {input("notes", "Delivery notes (optional)", { multiline: true })}
              </div></div>
            </section>
            <aside className="col-lg-5"><div className="card border-0 shadow-sm"><div className="card-body p-4">
              <h2 className="h5 mb-3">Your order</h2>
              <div className="mb-3">{items.map((item) => <div key={item.id} className="d-flex justify-content-between gap-3 border-bottom py-2"><span>{item.title} <span className="text-muted">× {item.quantity}</span></span><strong>{formatPrice(item.price * item.quantity)}</strong></div>)}</div>
              <div className="mb-3"><label htmlFor="shipping_method_id" className="form-label">Delivery method</label>{loadingShipping ? <p className="form-text">Loading delivery options...</p> : shippingMethods.length ? <select id="shipping_method_id" className="form-select" value={shippingMethodId} onChange={(event) => setShippingMethodId(event.target.value)}>{shippingMethods.map((method) => <option key={method.id} value={method.id}>{method.name} — {formatPrice(method.price)}</option>)}</select> : <p className="form-text">Standard delivery — free</p>}</div>
              <div className="d-flex justify-content-between border-top pt-3"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div><div className="d-flex justify-content-between py-2"><span>Shipping</span><span>{formatPrice(shippingAmount)}</span></div><div className="d-flex justify-content-between border-top pt-3 fw-bold fs-5"><span>Total</span><span>{formatPrice(total)}</span></div>
              <div className="alert alert-light small mt-3 mb-0">Payment: Cash on delivery. Online card payment is not configured.</div>
              <button type="submit" className="btn btn-primary w-100 mt-3" disabled={submitting || loadingShipping}>{submitting ? "Placing order..." : "Place order"}</button>
              <p className="small text-muted mt-3 mb-0">The server verifies pricing and inventory before saving your order.</p>
            </div></div></aside>
          </div>
        </form>
      </main>
    </Layout>
  );
};

export default Checkout;
