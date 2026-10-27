import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { cleanCode, cleanPhone, phoneRequest, useCountdown } from "./phoneSignIn";

/**
 * "Sign in with your mobile number": confirm a number with a code sent to it, so it can be used to sign in
 * with a code instead of the password; or turn that off. For shoppers, sellers and admins alike.
 */
const PhoneSignInSettings = ({ portal, className = "" }) => {
  const [state, setState] = useState(null);
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useCountdown();

  const load = useCallback(() => {
    phoneRequest("/account/phone", { method: "GET", portal })
      .then((result) => {
        setState(result);
        setPhone((result.phone || "").replace(/^\+91\s*/, ""));
      })
      .catch(() => setState(null));
  }, [portal]);

  useEffect(() => { load(); }, [load]);

  if (!state?.available) return null;

  const send = async (event) => {
    event?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await phoneRequest("/account/phone/send", { body: { phone }, portal });
      toast.info(result.message);
      setCodeSent(true);
      setCode("");
      setResendIn(result.resend_in || 30);
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.retryAfter && requestError.retryAfter < 120) setResendIn(requestError.retryAfter);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await phoneRequest("/account/phone/verify", { body: { phone, code }, portal });
      toast.success(result.message);
      setState(result);
      setEditing(false);
      setCodeSent(false);
    } catch (requestError) {
      setError(requestError.message);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    if (!window.confirm("Stop signing in with your mobile number? You can turn it on again any time.")) return;
    try {
      const result = await phoneRequest("/account/phone", { method: "DELETE", portal });
      toast.success(result.message);
      setState(result);
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  const showForm = !state.verified || editing;

  return (
    <section className={`phone-signin ${className}`}>
      <h2>Sign in with your mobile number</h2>
      {state.verified && !editing ? (
        <>
          <p className="phone-signin-status"><span aria-hidden="true">✓</span> <strong>{state.phone}</strong> can be used to sign in with a code sent by SMS.</p>
          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { setEditing(true); setPhone(""); }}>Use a different number</button>
            <button type="button" className="btn btn-link btn-sm text-danger" onClick={turnOff}>Turn off</button>
          </div>
        </>
      ) : <p>Confirm your number once, then sign in with a 6-digit code sent by SMS instead of your password.</p>}

      {showForm && (
        <form onSubmit={codeSent ? confirm : send} className="phone-signin-form">
          {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
          <label htmlFor={`${portal}-signin-phone`} className="form-label">Mobile number</label>
          <div className="input-group mb-2">
            <span className="input-group-text">+91</span>
            <input id={`${portal}-signin-phone`} type="tel" inputMode="tel" autoComplete="tel-national" className="form-control" value={phone} disabled={codeSent} onChange={(event) => setPhone(cleanPhone(event.target.value))} required />
          </div>
          {codeSent && (
            <>
              <label htmlFor={`${portal}-signin-code`} className="form-label">6-digit code</label>
              <input id={`${portal}-signin-code`} className="form-control otp-code mb-2" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(cleanCode(event.target.value))} required autoFocus />
            </>
          )}
          <div className="d-flex flex-wrap align-items-center gap-2">
            {codeSent
              ? <button type="submit" className="btn btn-primary btn-sm" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Confirm number"}</button>
              : <button type="submit" className="btn btn-primary btn-sm" disabled={busy || resendIn > 0 || phone.replace(/\D/g, "").length < 10}>{busy ? "Sending…" : resendIn > 0 ? `Send code (${resendIn}s)` : "Send code"}</button>}
            {codeSent && <button type="button" className="btn btn-link btn-sm" onClick={send} disabled={busy || resendIn > 0}>{resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}</button>}
            {(codeSent || editing) && <button type="button" className="btn btn-link btn-sm" onClick={() => { setCodeSent(false); setEditing(false); setError(""); load(); }}>Cancel</button>}
          </div>
        </form>
      )}
    </section>
  );
};

export default PhoneSignInSettings;
