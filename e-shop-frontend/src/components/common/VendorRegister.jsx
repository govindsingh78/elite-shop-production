import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiUrl } from "./http";
import CustomerAuthShell from "../customer/CustomerAuthShell";

const VendorRegister = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "", password_confirmation: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const change = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (form.password !== form.password_confirmation) {
      setErrors({ password_confirmation: "Passwords do not match." });
      return;
    }
    setLoading(true);
    setError("");
    setErrors({});
    try {
      const response = await fetch(`${apiUrl}/vendor/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (response.status === 422) {
        setErrors(Object.fromEntries(Object.entries(data.errors || {}).map(([field, messages]) => [field, messages[0]])));
        setError("Please check the highlighted fields.");
        return;
      }
      if (response.status === 429) throw new Error("Too many attempts. Please wait a minute and try again.");
      if (!response.ok) throw new Error(data.message || "Unable to create your seller account.");
      navigate("/vendor/login", { replace: true, state: { message: "Your seller account is ready — sign in to start listing products." } });
    } catch (requestError) {
      setError(requestError instanceof TypeError ? "Cannot reach the API server. Make sure the backend is running." : requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const strength = [form.password.length >= 8, /[A-Z]/.test(form.password) && /[a-z]/.test(form.password), /\d/.test(form.password), /[^A-Za-z0-9]/.test(form.password)].filter(Boolean).length;
  const strengthLabel = ["Too short", "Weak", "Fair", "Good", "Strong"][strength];

  const input = (name, label, props = {}) => (
    <div className={props.wrapperClass || "col-12"}>
      <label htmlFor={`vendor-${name}`} className="form-label">{label}</label>
      <input id={`vendor-${name}`} name={name} type={props.type || "text"} className={`form-control form-control-lg ${errors[name] ? "is-invalid" : ""}`} value={form[name]} onChange={change} required autoComplete={props.autoComplete} minLength={props.minLength} maxLength={255} placeholder={props.placeholder} />
      {errors[name] ? <div className="invalid-feedback">{errors[name]}</div> : props.hint && <div className="form-text">{props.hint}</div>}
    </div>
  );

  return (
    <CustomerAuthShell portal="vendor" wide eyebrow="Become a seller" title="Start selling on Elitezaar" subtitle="Create your seller account — it takes less than a minute.">
      <ol className="vendor-onboarding" aria-label="How it works">
        <li><span>1</span>Create your account</li>
        <li><span>2</span>List your products</li>
        <li><span>3</span>Ship &amp; get paid</li>
      </ol>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="row g-3">
          {input("name", "Your name or store name", { autoComplete: "organization", placeholder: "e.g. Urban Threads", wrapperClass: "col-md-6" })}
          {input("email", "Business email", { type: "email", autoComplete: "email", placeholder: "you@yourstore.com", wrapperClass: "col-md-6" })}
          <div className="col-md-6">
            <label htmlFor="vendor-password" className="form-label">Password</label>
            <div className="customer-password-wrap">
              <input id="vendor-password" name="password" type={showPassword ? "text" : "password"} className={`form-control form-control-lg ${errors.password ? "is-invalid" : ""}`} value={form.password} onChange={change} required minLength={8} autoComplete="new-password" />
              <button type="button" className="customer-password-toggle" onClick={() => setShowPassword((shown) => !shown)} aria-pressed={showPassword}>{showPassword ? "Hide" : "Show"}</button>
            </div>
            {errors.password ? <div className="invalid-feedback d-block">{errors.password}</div> : form.password && (
              <div className={`vendor-strength vendor-strength--${strength}`} aria-live="polite"><span><i /><i /><i /><i /></span>{strengthLabel}</div>
            )}
          </div>
          {input("password_confirmation", "Confirm password", { type: showPassword ? "text" : "password", autoComplete: "new-password", minLength: 8, wrapperClass: "col-md-6" })}
        </div>
        <p className="vendor-terms">By creating an account you agree to list genuine products and ship orders on time.</p>
        <button type="submit" className="btn btn-primary btn-lg w-100 customer-submit" disabled={loading}>{loading ? "Creating your seller account…" : "Create seller account"}</button>
      </form>
      <p className="customer-auth-footnote">Already selling with us? <Link to="/vendor/login" className="customer-link">Sign in to the seller hub</Link></p>
    </CustomerAuthShell>
  );
};

export default VendorRegister;
