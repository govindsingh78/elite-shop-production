import React, { useCallback, useEffect, useState } from "react";
import { apiUrl } from "./http";

const STORAGE_KEY = "ez_delivery_pincode";

const remembered = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

/**
 * "Delivery to" on the product page: a PIN code tells the shopper whether we deliver there and roughly when, from
 * where this product ships (see App\Services\Delivery). The last PIN code is remembered and checked on every product.
 */
const DeliveryCheck = ({ productId }) => {
  const [pincode, setPincode] = useState(remembered);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const check = useCallback(async (value) => {
    setChecking(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/storefront/delivery?${new URLSearchParams({ pincode: value, product: String(productId) })}`, { headers: { Accept: "application/json" } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.errors?.pincode?.[0] || data.message || "We couldn’t check that PIN code.");
      setResult(data);
      try { localStorage.setItem(STORAGE_KEY, data.pincode); } catch { /* not remembered, that's fine */ }
    } catch (checkError) {
      setResult(null);
      setError(checkError instanceof TypeError ? "We can’t reach the store right now. Please try again." : checkError.message);
    } finally {
      setChecking(false);
    }
  }, [productId]);

  // A PIN code checked before is checked for this product straight away.
  useEffect(() => {
    const saved = remembered();
    if (saved) check(saved);
  }, [check]);

  const submit = (event) => {
    event.preventDefault();
    if (pincode.length !== 6) {
      setResult(null);
      setError("Enter a 6-digit PIN code, like 302016.");
      return;
    }
    check(pincode);
  };

  return (
    <section className="pd-delivery" aria-labelledby="pd-delivery-title">
      <h2 id="pd-delivery-title">Delivery to</h2>
      <p>Enter your PIN code to check delivery info</p>
      <form className={`pd-delivery-form${error ? " is-invalid" : ""}`} onSubmit={submit}>
        <label htmlFor="pd-delivery-pincode" className="visually-hidden">PIN code</label>
        <input id="pd-delivery-pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} placeholder="Enter PIN code" value={pincode}
          onChange={(event) => { setPincode(event.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} />
        <button type="submit" disabled={checking}>{checking ? "Checking…" : "Check"}</button>
      </form>
      {error && <p className="pd-delivery-error" role="alert">{error}</p>}
      {result && (
        <div className={`pd-delivery-result ${result.deliverable ? "is-ok" : "is-no"}`} role="status">
          <span className="pd-delivery-icon" aria-hidden="true">{result.deliverable ? "✓" : "✕"}</span>
          <div>
            {result.deliverable ? <>
              <strong>{result.label}</strong>
              <span>{result.message}</span>
              <small>To {result.pincode}{result.to ? ` · ${result.to}` : ""} · {result.window}</small>
            </> : <strong>{result.message}</strong>}
          </div>
        </div>
      )}
    </section>
  );
};

export default DeliveryCheck;
