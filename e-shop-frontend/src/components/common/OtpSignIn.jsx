import React, { useEffect, useRef, useState } from "react";
import { cleanCode, cleanPhone, phoneRequest, useCountdown } from "./phoneSignIn";

/**
 * Signing in with a mobile number: send a code by SMS, then type it. `onSignedIn` gets the same session reply as
 * a password sign-in.
 */
const OtpSignIn = ({ portal, onSignedIn }) => {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resendIn, setResendIn] = useCountdown();
  const codeInput = useRef(null);

  useEffect(() => {
    if (step === "code") codeInput.current?.focus();
  }, [step]);

  const send = async (event) => {
    event?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await phoneRequest("/auth/otp/send", { body: { portal, phone } });
      setNotice(result.message);
      setResendIn(result.resend_in || 30);
      setCode("");
      setStep("code");
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.retryAfter && requestError.retryAfter < 120) setResendIn(requestError.retryAfter);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onSignedIn(await phoneRequest("/auth/otp/verify", { body: { portal, phone, code } }));
    } catch (requestError) {
      setError(requestError.message);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  if (step === "phone") {
    return (
      <form onSubmit={send} className="otp-form">
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <label htmlFor={`${portal}-otp-phone`} className="form-label">Mobile number</label>
        <div className="input-group input-group-lg mb-2">
          <span className="input-group-text">+91</span>
          <input id={`${portal}-otp-phone`} type="tel" inputMode="tel" autoComplete="tel-national" className="form-control" placeholder="98765 43210" value={phone} onChange={(event) => setPhone(cleanPhone(event.target.value))} required />
        </div>
        <p className="form-text mb-4">We’ll text you a 6-digit code. It works for numbers you’ve confirmed in your account settings.</p>
        <button type="submit" className="btn btn-primary btn-lg w-100 customer-submit" disabled={busy || resendIn > 0 || phone.replace(/\D/g, "").length < 10}>
          {busy ? "Sending…" : resendIn > 0 ? `Send code (${resendIn}s)` : "Send code"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="otp-form">
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <label htmlFor={`${portal}-otp-code`} className="form-label">6-digit code</label>
      <input ref={codeInput} id={`${portal}-otp-code`} className="form-control form-control-lg otp-code mb-3" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} placeholder="••••••" value={code} onChange={(event) => setCode(cleanCode(event.target.value))} required />
      <button type="submit" className="btn btn-primary btn-lg w-100 customer-submit" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify & sign in"}</button>
      <div className="otp-links">
        <button type="button" className="btn btn-link" onClick={() => { setStep("phone"); setError(""); }}>Change number</button>
        <button type="button" className="btn btn-link" onClick={send} disabled={busy || resendIn > 0}>{resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}</button>
      </div>
    </form>
  );
};

export default OtpSignIn;
