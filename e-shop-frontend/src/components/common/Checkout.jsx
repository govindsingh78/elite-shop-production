import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "./Layout";
import { apiUrl } from "./http";
import { useCart } from "../context/CartContext";
import { formatPrice } from "./currency";
import { AdminAuthContext } from "../context/AdminAuth";
import { customerRequest } from "../customer/customerApi";
import { loadRazorpay, methodDisplay, paymentRequest } from "./razorpay";
import LocationFields from "./LocationFields";
import { DEFAULT_COUNTRY, postalLabel } from "./geo";
import { PolicyAgreement } from "./PolicyBits";

const POLICY_REQUIRED = "Please read and accept the Return & Refund Policy to place your order.";

const PAYMENT_OPTIONS = [
  { value: "upi", title: "UPI", copy: "Google Pay, PhonePe, Paytm, BHIM or any UPI app.", icon: <><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2M9.5 8.5 12 11l3-4" /></> },
  { value: "netbanking", title: "Net banking", copy: "Pay securely from 50+ Indian banks.", icon: <><path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></> },
  { value: "cod", title: "Cash on delivery", copy: "Pay in cash or UPI when your order arrives.", icon: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></> },
];

const initialForm = {
  customer_name: "", customer_email: "", customer_phone: "", address: "", city: "",
  state: "", postal_code: "", country: DEFAULT_COUNTRY, notes: "",
};

const ADDRESS_LABELS = ["Home", "Work", "Other"];
const imageBase = apiUrl.replace(/\/api\/?$/, "");

const Checkout = () => {
  const { items, subtotal, clearCart } = useCart();
  const navigate = useNavigate();
  const { user, login, logout } = useContext(AdminAuthContext);
  const isCustomer = user?.portal === "customer";

  const [shopperType, setShopperType] = useState("returning");
  const [acceptPolicy, setAcceptPolicy] = useState(false);
  const [createAccount, setCreateAccount] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState("");

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [addressMode, setAddressMode] = useState("new");
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  const [newAddressLabel, setNewAddressLabel] = useState("Home");

  const [shippingMethods, setShippingMethods] = useState([]);
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [loadingShipping, setLoadingShipping] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [onlineAvailable, setOnlineAvailable] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState("cod");
  // An online order that has been created but not yet paid: { order, token, method }.
  const [pendingPayment, setPendingPayment] = useState(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetch(`${apiUrl}/storefront/payment-methods`, { headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then((methods) => {
        if (methods?.online) {
          setOnlineAvailable(true);
          setPaymentChoice("upi");
        }
      })
      .catch(() => {});
  }, []);

  // Signed-in customers: load their address book and default to their saved default address.
  useEffect(() => {
    if (!isCustomer) {
      setSavedAddresses([]);
      setAddressMode("new");
      return undefined;
    }
    const controller = new AbortController();
    setForm((current) => ({
      ...current,
      customer_email: user.user?.email || "",
      customer_name: current.customer_name || user.user?.name || "",
      customer_phone: current.customer_phone || user.user?.phone || "",
    }));
    setLoadingAddresses(true);
    customerRequest("addresses", { signal: controller.signal })
      .then((addresses) => {
        setSavedAddresses(addresses);
        const preferred = addresses.find((address) => address.is_default) || addresses[0];
        setSelectedAddressId(preferred ? String(preferred.id) : "");
        setAddressMode(preferred ? "saved" : "new");
      })
      .catch(() => setAddressMode("new"))
      .finally(() => { if (!controller.signal.aborted) setLoadingAddresses(false); });
    return () => controller.abort();
  }, [isCustomer, user]);

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
  const selectedAddress = savedAddresses.find((address) => String(address.id) === selectedAddressId);
  const usingSavedAddress = isCustomer && addressMode === "saved" && !!selectedAddress;
  const awaitingSignIn = !isCustomer && shopperType === "returning";
  const customerAction = !isCustomer && shopperType === "new" && createAccount ? "register" : "guest";
  // New accounts and saved addresses need the complete address, so those fields become required.
  const needsFullAddress = customerAction === "register" || (isCustomer && saveNewAddress);

  const resetMessages = () => {
    setError("");
    setFieldErrors({});
    setSignInError("");
  };

  const chooseShopperType = (type) => {
    setShopperType(type);
    setPassword("");
    setPasswordConfirmation("");
    resetMessages();
  };

  const changeField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
  };

  const signIn = async () => {
    if (!credentials.email || !credentials.password) {
      setSignInError("Enter your email and password to sign in.");
      return;
    }
    setSigningIn(true);
    setSignInError("");
    try {
      const response = await fetch(`${apiUrl}/customer/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(credentials),
      });
      const result = await response.json();
      if (response.status === 429) throw new Error("Too many attempts. Please wait a minute and try again.");
      if (!response.ok) throw new Error(Object.values(result.error || result.errors || {}).flat()[0] || result.message || "Unable to sign in.");
      login(result);
      setCredentials({ email: "", password: "" });
    } catch (requestError) {
      setSignInError(requestError instanceof TypeError ? "Cannot reach the store right now. Please try again shortly." : requestError.message);
    } finally {
      setSigningIn(false);
    }
  };

  const signOut = () => {
    logout();
    setForm(initialForm);
    setShopperType("returning");
    resetMessages();
  };

  const finishOrder = (order) => {
    clearCart();
    navigate(`/order-confirmation/${order.id}`, { replace: true, state: { order } });
  };

  // Opens Razorpay's secure window for an order that is waiting for online payment.
  const openPayment = async ({ order, token, method }) => {
    setPaying(true);
    setError("");
    try {
      const [session, Razorpay] = await Promise.all([paymentRequest(order.id, "start", token), loadRazorpay()]);
      const checkout = new Razorpay({
        key: session.key_id,
        order_id: session.razorpay_order_id,
        amount: session.amount,
        currency: session.currency,
        name: "Elitezaar",
        description: `Order #${order.id}`,
        prefill: session.prefill,
        notes: { order_id: String(order.id) },
        theme: { color: "#18372e" },
        config: methodDisplay(method),
        handler: async (result) => {
          setPaying(true);
          try {
            const verified = await paymentRequest(order.id, "verify", token, result);
            finishOrder(verified.data);
          } catch (verifyError) {
            setError(verifyError.message);
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
            setError("Payment wasn’t completed. Your order is saved — pay now or switch to cash on delivery.");
          },
        },
      });
      checkout.on("payment.failed", (failure) => setError(failure.error?.description || "The payment failed. Please try again."));
      checkout.open();
    } catch (paymentError) {
      setPaying(false);
      setError(paymentError.message);
    }
  };

  const payOnDeliveryInstead = async () => {
    setPaying(true);
    try {
      const result = await paymentRequest(pendingPayment.order.id, "cod", pendingPayment.token);
      finishOrder(result.data);
    } catch (switchError) {
      setError(switchError.message);
      setPaying(false);
    }
  };

  const submitOrder = async (event) => {
    event.preventDefault();
    if (awaitingSignIn) {
      signIn();
      return;
    }
    // The order already exists; retry the payment instead of creating another order.
    if (pendingPayment) {
      openPayment(pendingPayment);
      return;
    }
    if (!acceptPolicy) {
      setFieldErrors((current) => ({ ...current, accept_policy: POLICY_REQUIRED }));
      setError(POLICY_REQUIRED);
      return;
    }
    setSubmitting(true);
    resetMessages();
    try {
      const deliveryDetails = usingSavedAddress
        ? {
          customer_name: selectedAddress.full_name, customer_phone: selectedAddress.phone, address: selectedAddress.address,
          city: selectedAddress.city, state: selectedAddress.state, postal_code: selectedAddress.postal_code, country: selectedAddress.country,
        }
        : {};
      const payload = {
        ...form,
        ...deliveryDetails,
        ...(isCustomer ? { customer_email: user.user?.email } : {}),
        customer_action: customerAction,
        ...(customerAction === "register" ? { account_password: password, account_password_confirmation: passwordConfirmation } : {}),
        payment_method: paymentChoice === "cod" ? "cod" : "razorpay",
        shipping_method_id: shippingMethodId ? Number(shippingMethodId) : null,
        accept_policy: acceptPolicy,
        items: items.map(({ id, quantity }) => ({ product_id: id, quantity })),
      };
      const response = await fetch(`${apiUrl}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          // Lets the API link the order to the signed-in customer's account.
          ...(isCustomer ? { Authorization: `Bearer ${localStorage.getItem("customerToken")}` } : {}),
        },
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

      if (isCustomer && !usingSavedAddress && saveNewAddress) {
        // The order is already placed, so a failure here must not block the confirmation page.
        await customerRequest("addresses", {
          method: "POST",
          body: {
            label: newAddressLabel, full_name: form.customer_name, phone: form.customer_phone, address: form.address,
            city: form.city, state: form.state, postal_code: form.postal_code, country: form.country,
          },
        }).catch(() => {});
      }
      if (data.customer_token && data.customer && (!user || isCustomer)) {
        login({ token: data.customer_token, user: data.customer, portal: "customer" });
      }
      if (data.payment_token) {
        const pending = { order: data.data, token: data.payment_token, method: paymentChoice };
        setPendingPayment(pending);
        openPayment(pending);
        return;
      }
      finishOrder(data.data);
    } catch (requestError) {
      setError(requestError.message || "Unable to reach checkout.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!items.length) {
    return (
      <Layout>
        <main className="container py-5">
          <section className="cart-empty">
            <span className="cart-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 8h14l-1 13H6L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></svg></span>
            <h2>Your bag is empty</h2>
            <p>Add a product before checking out.</p>
            <Link to="/shop" className="btn btn-primary cart-empty-cta">Browse products ↗</Link>
          </section>
        </main>
      </Layout>
    );
  }

  const input = (name, label, options = {}) => (
    <div className="mb-3">
      <label htmlFor={name} className="form-label">{label}</label>
      {options.multiline ? (
        <textarea id={name} name={name} rows={options.rows || 2} autoComplete={options.autoComplete} placeholder={options.placeholder} className={`form-control ${fieldErrors[name] ? "is-invalid" : ""}`} value={form[name]} onChange={changeField} required={options.required} />
      ) : (
        <input id={name} name={name} type={options.type || "text"} autoComplete={options.autoComplete} placeholder={options.placeholder} className={`form-control ${fieldErrors[name] ? "is-invalid" : ""}`} value={form[name]} onChange={changeField} required={options.required} />
      )}
      {fieldErrors[name] && <div className="invalid-feedback">{fieldErrors[name]}</div>}
    </div>
  );

  const choice = (value, title, description, current, onSelect, name) => (
    <label className={`checkout-choice${current === value ? " is-active" : ""}`}>
      <input type="radio" name={name} value={value} checked={current === value} onChange={() => onSelect(value)} />
      <span className="checkout-choice-dot" aria-hidden="true" />
      <span><strong>{title}</strong><small>{description}</small></span>
    </label>
  );

  const addressFields = (
    <>
      {isCustomer && <div className="row"><div className="col-md-6">{input("customer_name", "Recipient name", { autoComplete: "name", required: true })}</div><div className="col-md-6">{input("customer_phone", "Recipient phone", { type: "tel", autoComplete: "tel", required: true })}</div></div>}
      {input("address", "House / flat, street and area", { autoComplete: "street-address", multiline: true, required: true, placeholder: "e.g. 12, MG Road, near City Mall" })}
      <div className="row">
        <LocationFields values={form} errors={fieldErrors} onChange={changeField} idPrefix="checkout" wrapperClass="col-md-6 mb-3" stateOptional={!needsFullAddress} />
        <div className="col-md-6">{input("postal_code", needsFullAddress ? postalLabel(form.country) : `${postalLabel(form.country)} (optional)`, { autoComplete: "postal-code", required: needsFullAddress })}</div>
      </div>
    </>
  );

  const section = (number, title, subtitle, children, locked = false) => (
    <section className={`co-section${locked ? " is-locked" : ""}`}>
      <header className="co-section-head">
        <span className="co-section-number">{number}</span>
        <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      </header>
      {children}
    </section>
  );

  const placeOrderLabel = submitting ? "Placing your order…"
    : awaitingSignIn ? "Sign in to continue"
      : paymentChoice === "cod" ? `Place order · ${formatPrice(total)}` : `Pay ${formatPrice(total)} securely`;

  return (
    <Layout>
      <main className="cart-page">
        <section className="cart-hero">
          <div className="container">
            <nav aria-label="Breadcrumb"><ol className="breadcrumb shop-breadcrumb mb-0"><li className="breadcrumb-item"><Link to="/">Home</Link></li><li className="breadcrumb-item"><Link to="/cart">Shopping bag</Link></li><li className="breadcrumb-item active" aria-current="page">Checkout</li></ol></nav>
            <div className="cart-hero-copy">
              <div>
                <span className="shop-eyebrow">SECURE CHECKOUT</span>
                <h1>Checkout<span>.</span></h1>
                <p>A few details and your order is on its way.</p>
              </div>
              <ol className="cart-steps" aria-label="Checkout progress">
                <li className="is-done"><span>✓</span><Link to="/cart">Bag</Link></li>
                <li className="is-current" aria-current="step"><span>2</span>Details &amp; delivery</li>
                <li><span>3</span>Confirmation</li>
              </ol>
            </div>
          </div>
        </section>

        <div className="container py-4 py-lg-5">
          {error && <div className="alert alert-danger co-alert" role="alert">{error}</div>}
          <form onSubmit={submitOrder}>
            <div className="row g-4 g-xl-5">
              <div className="col-lg-7 d-flex flex-column gap-4">
                {section(1, "Contact", isCustomer ? "You’re signed in — we’ll use your account details." : "Sign in for saved addresses, or continue as a new customer.", isCustomer ? (
                  <div className="checkout-signed-in">
                    <span>{(user.user?.name || "?").charAt(0).toUpperCase()}</span>
                    <div><strong>Welcome back, {user.user?.name}</strong><small>{user.user?.email} · this order will appear in <Link to="/customer/orders">My orders</Link></small></div>
                    <button type="button" className="checkout-signout" onClick={signOut}>Not you?</button>
                  </div>
                ) : <>
                  <div className="checkout-choice-group mb-4" role="radiogroup" aria-label="Are you a returning customer?">
                    {choice("returning", "Returning customer", "Sign in to use your saved addresses.", shopperType, chooseShopperType, "shopper_type")}
                    {choice("new", "New customer", "Check out as a guest or create an account.", shopperType, chooseShopperType, "shopper_type")}
                  </div>

                  {shopperType === "returning" ? (
                    <div className="checkout-signin">
                      {signInError && <div className="alert alert-danger py-2" role="alert">{signInError}</div>}
                      <div className="row">
                        <div className="col-md-6 mb-3"><label htmlFor="signin_email" className="form-label">Email address</label><input id="signin_email" type="email" autoComplete="email" className="form-control" value={credentials.email} onChange={(event) => setCredentials((current) => ({ ...current, email: event.target.value }))} /></div>
                        <div className="col-md-6 mb-3"><label htmlFor="signin_password" className="form-label">Password</label><input id="signin_password" type="password" autoComplete="current-password" className="form-control" value={credentials.password} onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))} /></div>
                      </div>
                      <div className="d-flex flex-wrap align-items-center gap-3">
                        <button type="button" className="btn btn-primary co-btn" onClick={signIn} disabled={signingIn}>{signingIn ? "Signing in..." : "Sign in"}</button>
                        <Link to="/forgot-password" className="small">Forgot password?</Link>
                        <button type="button" className="btn btn-link btn-sm p-0 ms-auto" onClick={() => chooseShopperType("new")}>Continue as a new customer →</button>
                      </div>
                    </div>
                  ) : <>
                    {input("customer_name", "Full name", { autoComplete: "name", required: true })}
                    <div className="row"><div className="col-md-6">{input("customer_email", "Email address", { type: "email", autoComplete: "email", required: true })}</div><div className="col-md-6">{input("customer_phone", createAccount ? "Phone" : "Phone (optional)", { type: "tel", autoComplete: "tel", required: createAccount })}</div></div>
                    <label className={`co-toggle${createAccount ? " is-on" : ""}`}>
                      <input type="checkbox" checked={createAccount} onChange={(event) => { setCreateAccount(event.target.checked); setPassword(""); setPasswordConfirmation(""); }} />
                      <span className="co-toggle-switch" aria-hidden="true" />
                      <span><strong>Create an account</strong><small>Faster checkout next time and live order tracking.</small></span>
                    </label>
                    {createAccount && <div className="row mt-3">
                      <div className="col-md-6 mb-3"><label htmlFor="account_password" className="form-label">Create password</label><input id="account_password" type="password" autoComplete="new-password" minLength={8} className={`form-control ${fieldErrors.account_password ? "is-invalid" : ""}`} value={password} onChange={(event) => setPassword(event.target.value)} required /><div className="form-text">Use at least 8 characters.</div></div>
                      <div className="col-md-6 mb-3"><label htmlFor="account_password_confirmation" className="form-label">Confirm password</label><input id="account_password_confirmation" type="password" autoComplete="new-password" minLength={8} className={`form-control ${fieldErrors.account_password_confirmation ? "is-invalid" : ""}`} value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} required /></div>
                    </div>}
                  </>}
                </>)}

                {section(2, "Delivery address", awaitingSignIn ? "Sign in above to continue." : "Where should we send your order?", awaitingSignIn ? (
                  <p className="text-muted mb-0">Sign in above to deliver to one of your saved addresses or add a new one.</p>
                ) : <>
                  {isCustomer && loadingAddresses && <div className="customer-skeleton-list"><span /><span /></div>}
                  {isCustomer && !loadingAddresses && savedAddresses.length > 0 && (
                    <div className="checkout-choice-group mb-3" role="radiogroup" aria-label="Delivery address option">
                      {choice("saved", "Use a saved address", `${savedAddresses.length} saved ${savedAddresses.length === 1 ? "address" : "addresses"} on your account.`, addressMode, setAddressMode, "address_mode")}
                      {choice("new", "Deliver to a new address", "Enter a different delivery address.", addressMode, setAddressMode, "address_mode")}
                    </div>
                  )}

                  {usingSavedAddress ? (
                    <div className="checkout-address-picker mb-3" role="radiogroup" aria-label="Saved addresses">
                      {savedAddresses.map((address) => (
                        <label key={address.id} className={`checkout-address-option${selectedAddressId === String(address.id) ? " is-active" : ""}`}>
                          <input type="radio" name="saved_address" checked={selectedAddressId === String(address.id)} onChange={() => setSelectedAddressId(String(address.id))} />
                          <span>
                            <strong>{address.label}{address.is_default && <span className="checkout-default-tag">Default</span>}</strong>
                            <small>{address.full_name} · {address.phone}</small>
                            <small>{address.address}, {address.city}, {address.state} {address.postal_code}, {address.country}</small>
                          </span>
                        </label>
                      ))}
                      <Link to="/customer/addresses" className="small">Manage saved addresses</Link>
                    </div>
                  ) : <>
                    {addressFields}
                    {isCustomer && (
                      <div className="checkout-save-address mb-3">
                        <div className="form-check mb-0">
                          <input id="save_new_address" type="checkbox" className="form-check-input" checked={saveNewAddress} onChange={(event) => setSaveNewAddress(event.target.checked)} />
                          <label htmlFor="save_new_address" className="form-check-label">Save this address to my account</label>
                        </div>
                        {saveNewAddress && (
                          <div className="customer-chip-group mt-2" role="radiogroup" aria-label="Address label">
                            {ADDRESS_LABELS.map((label) => (
                              <label key={label} className={`customer-chip${newAddressLabel === label ? " is-active" : ""}`}>
                                <input type="radio" name="new_address_label" checked={newAddressLabel === label} onChange={() => setNewAddressLabel(label)} />
                                {label}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>}
                  {input("notes", "Delivery notes (optional)", { multiline: true, placeholder: "Landmark, preferred time, gate code…" })}
                </>, awaitingSignIn)}

                {section(3, "Delivery method", "Every option includes live order tracking.", loadingShipping ? (
                  <div className="customer-skeleton-list"><span /><span /></div>
                ) : shippingMethods.length ? (
                  <div className="co-options" role="radiogroup" aria-label="Delivery method">
                    {shippingMethods.map((method) => (
                      <label key={method.id} className={`co-option${shippingMethodId === String(method.id) ? " is-active" : ""}`}>
                        <input type="radio" name="shipping_method_id" value={method.id} checked={shippingMethodId === String(method.id)} onChange={() => setShippingMethodId(String(method.id))} />
                        <span className="checkout-choice-dot" aria-hidden="true" />
                        <span className="co-option-copy"><strong>{method.name}</strong><small>Tracked delivery</small></span>
                        <span className={`co-option-price${Number(method.price) === 0 ? " is-free" : ""}`}>{Number(method.price) === 0 ? "Free" : formatPrice(method.price)}</span>
                      </label>
                    ))}
                  </div>
                ) : <p className="mb-0 text-muted">Standard delivery — free.</p>, awaitingSignIn)}

                {section(4, "Payment", onlineAvailable ? "Pay securely online, or when your order arrives." : "Choose how you’d like to pay.", (
                  <>
                    <div className="co-options" role="radiogroup" aria-label="Payment method">
                      {PAYMENT_OPTIONS.filter((option) => onlineAvailable || option.value === "cod").map((option) => (
                        <label key={option.value} className={`co-option${paymentChoice === option.value ? " is-active" : ""}${pendingPayment ? " is-disabled" : ""}`}>
                          <input type="radio" name="payment_method" value={option.value} checked={paymentChoice === option.value} onChange={() => setPaymentChoice(option.value)} disabled={!!pendingPayment} />
                          <span className="checkout-choice-dot" aria-hidden="true" />
                          <span className="co-option-copy"><strong>{option.title}{option.value === "upi" && <span className="co-option-tag">Fastest</span>}</strong><small>{option.copy}</small></span>
                          <span className="co-option-icon" aria-hidden="true"><svg viewBox="0 0 24 24">{option.icon}</svg></span>
                        </label>
                      ))}
                    </div>
                    {onlineAvailable && paymentChoice !== "cod" && (
                      <p className="co-secure-note"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></svg>Payments are processed by Razorpay. We never see or store your bank or UPI details.</p>
                    )}
                  </>
                ), awaitingSignIn)}
              </div>

              <aside className="col-lg-5">
                <section className="cart-summary co-summary">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h2 className="mb-0">Order summary</h2>
                    <Link to="/cart" className="customer-link small">Edit bag</Link>
                  </div>
                  <ul className="co-items">
                    {items.map((item) => (
                      <li key={item.id}>
                        <span className="co-item-image">
                          {item.image ? <img src={`${imageBase}/uploads/products/small/${encodeURIComponent(item.image)}`} alt="" /> : <span>PW</span>}
                          <b>{item.quantity}</b>
                        </span>
                        <span className="co-item-copy"><strong>{item.title}</strong><small>{formatPrice(item.price)} each</small></span>
                        <strong className="co-item-total">{formatPrice(item.price * item.quantity)}</strong>
                      </li>
                    ))}
                  </ul>
                  <dl>
                    <div><dt>Subtotal</dt><dd>{formatPrice(subtotal)}</dd></div>
                    <div><dt>Delivery{shipping ? ` · ${shipping.name}` : ""}</dt><dd className={shippingAmount === 0 ? "is-free" : ""}>{shippingAmount === 0 ? "Free" : formatPrice(shippingAmount)}</dd></div>
                    <div className="cart-summary-total"><dt>Total</dt><dd>{formatPrice(total)}</dd></div>
                  </dl>
                  {usingSavedAddress && <div className="checkout-ship-to small mt-3"><span className="text-muted">Delivering to</span><strong>{selectedAddress.full_name}, {selectedAddress.city} {selectedAddress.postal_code}</strong></div>}
                  {pendingPayment ? (
                    <div className="co-pending">
                      <strong>Order #{pendingPayment.order.id} is reserved</strong>
                      <small>Complete the payment to confirm it, or pay when it arrives.</small>
                      <button type="submit" className="btn btn-primary cart-checkout" disabled={paying}>
                        {paying ? "Opening secure payment…" : `Pay ${formatPrice(pendingPayment.order.total)} now`}{!paying && <span aria-hidden="true">→</span>}
                      </button>
                      <button type="button" className="co-pending-cod" onClick={payOnDeliveryInstead} disabled={paying}>Pay on delivery instead</button>
                    </div>
                  ) : (
                    <>
                      {!awaitingSignIn && (
                        <PolicyAgreement
                          checked={acceptPolicy}
                          onChange={(value) => { setAcceptPolicy(value); setFieldErrors((current) => ({ ...current, accept_policy: undefined })); }}
                          error={fieldErrors.accept_policy}
                        />
                      )}
                      <button type="submit" className="btn btn-primary cart-checkout" disabled={submitting || paying || loadingShipping || signingIn || (isCustomer && loadingAddresses)}>
                        {placeOrderLabel}{!submitting && !awaitingSignIn && <span aria-hidden="true">→</span>}
                      </button>
                    </>
                  )}
                  <p className="co-fineprint"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3" /></svg>Prices and stock are verified when you place your order.</p>
                </section>
              </aside>
            </div>
          </form>
        </div>
      </main>
    </Layout>
  );
};

export default Checkout;
