import React, { useEffect, useRef, useState } from "react";
import { formatPrice } from "./currency";
import { checkCoupon, fetchOffers, saveCode, savedCode } from "./coupons";

/**
 * Checkout's coupon box: type a code or pick one of the offers for this bag. `applied` is the API's answer for the
 * code in use ({ code, discount, message }); it's checked again when the bag or the email changes, and dropped
 * (with the reason) if it no longer works.
 */
const CouponBox = ({ items, email, token, applied, onApplied }) => {
  const [code, setCode] = useState("");
  const [offers, setOffers] = useState([]);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState("");
  const productKey = items.map((item) => item.id).join(",");
  const bagKey = items.map((item) => `${item.id}x${item.quantity}`).join(",");
  const latest = useRef({ applied, onApplied });
  latest.current = { applied, onApplied };

  useEffect(() => {
    let active = true;
    fetchOffers(productKey.split(",").map(Number)).then((list) => active && setOffers(list)).catch(() => {});
    return () => { active = false; };
  }, [productKey]);

  // A code copied from a product's offers is applied when checkout opens; one that doesn't work here is forgotten.
  useEffect(() => {
    const saved = savedCode();
    if (!saved || latest.current.applied) return undefined;
    let active = true;
    checkCoupon(saved, items, { email, token })
      .then((result) => active && latest.current.onApplied(result))
      .catch(() => saveCode(""));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A different bag or buyer can change the discount, or whether the code works at all.
  useEffect(() => {
    const current = latest.current.applied;
    if (!current) return undefined;
    let active = true;
    // Once typing stops: the email changes with every key.
    const timer = setTimeout(() => {
      checkCoupon(current.code, items, { email, token })
        .then((result) => active && latest.current.onApplied(result))
        .catch((checkError) => {
          if (!active) return;
          latest.current.onApplied(null);
          saveCode("");
          setError(`${current.code} was removed: ${checkError.message}`);
        });
    }, 700);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // `items` is captured through bagKey, which changes whenever a line or quantity does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bagKey, email, token]);

  const apply = async (value) => {
    const wanted = value.trim().toUpperCase();
    if (!wanted) return;
    setChecking(wanted);
    setError("");
    try {
      const result = await checkCoupon(wanted, items, { email, token });
      onApplied(result);
      saveCode(result.code);
      setCode("");
    } catch (applyError) {
      setError(applyError.message);
    } finally {
      setChecking("");
    }
  };

  return (
    <section className="co-coupon" aria-labelledby="co-coupon-title">
      <h3 id="co-coupon-title">Coupons & offers</h3>
      {applied ? (
        <div className="co-coupon-applied" role="status">
          <span aria-hidden="true">✓</span>
          <div><strong>{applied.code} applied</strong><small>{applied.message}</small></div>
          <button type="button" className="btn btn-link btn-sm" onClick={() => { onApplied(null); saveCode(""); setError(""); }}>Remove</button>
        </div>
      ) : (
        // Not a <form>: this sits inside checkout's form, and a submit (or Enter) here would place the order.
        <div className="co-coupon-form">
          <label htmlFor="co-coupon-code" className="visually-hidden">Coupon code</label>
          <input id="co-coupon-code" className={error ? "is-invalid" : ""} placeholder="Enter coupon code" value={code} autoComplete="off" autoCapitalize="characters"
            onChange={(event) => { setCode(event.target.value.toUpperCase()); setError(""); }}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); apply(code); } }} />
          <button type="button" disabled={!code.trim() || Boolean(checking)} onClick={() => apply(code)}>{checking === code.trim() && checking ? "Checking…" : "Apply"}</button>
        </div>
      )}
      {error && <p className="co-coupon-error" role="alert">{error}</p>}
      {!applied && offers.length > 0 && (
        <ul className="co-coupon-offers">
          {offers.map((offer) => (
            <li key={offer.code}>
              <div>
                <strong>{offer.code}</strong>
                <span>{offer.title}</span>
                {offer.min_order ? <small>On {formatPrice(offer.min_order)} or more</small> : null}
              </div>
              <button type="button" className="btn btn-outline-primary btn-sm" disabled={Boolean(checking)} onClick={() => apply(offer.code)}>{checking === offer.code ? "Checking…" : "Apply"}</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default CouponBox;
