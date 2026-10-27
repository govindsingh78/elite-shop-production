import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiUrl } from "./http";
import { PRIVACY_PATH, TERMS_PATH } from "./policy";
import { useStorefrontCategories } from "./useStorefrontCategories";
import CustomerAuthShell from "../customer/CustomerAuthShell";
import { CategoryRequestFields } from "../categoryRequests/CategoryRequestBits";
import { AT_SIGN_UP, emptyRequest, requestPayload } from "../categoryRequests/categoryRequests";

const VendorRegister = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "", password_confirmation: "" });
  // Categories the store doesn't have yet, for our team to add (rows left blank aren't sent).
  const [requests, setRequests] = useState([]);
  const { categories } = useStorefrontCategories();
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
    // Errors come back by position among the requests sent ("category_requests.0.name"): map them to their rows.
    const sent = requests.map((request, row) => ({ request, row })).filter(({ request }) => request.name.trim());
    try {
      const response = await fetch(`${apiUrl}/vendor/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...form, category_requests: sent.map(({ request }) => requestPayload(request)) }),
      });
      const data = await response.json();
      if (response.status === 422) {
        setErrors(Object.fromEntries(Object.entries(data.errors || {}).map(([field, messages]) => {
          const [, position, part] = field.match(/^category_requests\.(\d+)\.(\w+)$/) || [];
          return [position !== undefined ? `request.${sent[position]?.row}.${part}` : field, messages[0]];
        })));
        setError("Please check the highlighted fields.");
        return;
      }
      if (response.status === 429) throw new Error("Too many attempts. Please wait a minute and try again.");
      if (!response.ok) throw new Error(data.message || "Unable to create your seller account.");
      const asked = sent.length ? " We’ve passed your category requests to our team, and we’ll let you know when they’re added." : "";
      navigate("/vendor/login", { replace: true, state: { message: `Your seller account is created. Sign in to add your business details — you can list products once our team approves your account.${asked}` } });
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
        <section className="category-ask" aria-labelledby="category-ask-title">
          <div className="category-ask-head">
            <div>
              <h2 id="category-ask-title">Can’t find your category?</h2>
              <p>Ask us to add a category or subcategory you’ll sell in. Optional — you can also ask later from your seller hub.</p>
            </div>
            {requests.length < AT_SIGN_UP && (
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setRequests((current) => [...current, emptyRequest()])}>＋ Ask for a category</button>
            )}
          </div>
          {requests.map((request, row) => (
            <CategoryRequestFields
              // Rows are only added at the end and removed in place, so their position is a stable enough key here.
              key={row}
              id={`signup-request-${row}`}
              value={request}
              categories={categories}
              errors={{ name: errors[`request.${row}.name`], parent_id: errors[`request.${row}.parent_id`], note: errors[`request.${row}.note`] }}
              onChange={(next) => {
                setRequests((current) => current.map((item, index) => (index === row ? next : item)));
                setErrors((current) => ({ ...current, [`request.${row}.name`]: undefined, [`request.${row}.parent_id`]: undefined, [`request.${row}.note`]: undefined }));
              }}
              onRemove={() => { setRequests((current) => current.filter((_, index) => index !== row)); setErrors({}); }}
            />
          ))}
          {errors.category_requests && <div className="text-danger small mt-2">{errors.category_requests}</div>}
        </section>
        <p className="vendor-terms">By creating an account, you agree to our <a href={TERMS_PATH} target="_blank" rel="noreferrer">Terms &amp; Conditions</a>, including listing genuine products and shipping orders on time, and our <a href={PRIVACY_PATH} target="_blank" rel="noreferrer">Privacy Policy</a>.</p>
        <button type="submit" className="btn btn-primary btn-lg w-100 customer-submit" disabled={loading}>{loading ? "Creating your seller account…" : "Create seller account"}</button>
      </form>
      <p className="customer-auth-footnote">Already selling with us? <Link to="/vendor/login" className="customer-link">Sign in to the seller hub</Link></p>
    </CustomerAuthShell>
  );
};

export default VendorRegister;
