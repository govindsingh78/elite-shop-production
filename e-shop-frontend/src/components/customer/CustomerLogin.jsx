import React, { useContext, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { apiUrl } from "../common/http";
import GoogleSignInButton from "../common/GoogleSignInButton";
import { AdminAuthContext } from "../context/AdminAuth";
import CustomerAuthShell from "./CustomerAuthShell";

const CustomerLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  // A Google sign-in that didn't finish comes back here with the reason.
  const [error, setError] = useState(location.state?.error || "");
  const [loading, setLoading] = useState(false);
  const { user, login } = useContext(AdminAuthContext);
  const redirectTo = location.state?.from || "/customer/dashboard";

  if (user?.portal === "customer") return <Navigate to={redirectTo} replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/customer/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (response.status === 429) throw new Error("Too many attempts. Please wait a minute and try again.");
      if (!response.ok) throw new Error(Object.values(result.error || result.errors || {}).flat()[0] || result.message || "Unable to sign in.");
      login(result);
      navigate(redirectTo, { replace: true });
    } catch (requestError) {
      setError(requestError instanceof TypeError ? "Cannot reach the store right now. Please try again shortly." : requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  return (
    <CustomerAuthShell eyebrow="Welcome back" title="Sign in to your account" subtitle="Track orders, manage addresses and check out faster.">
      {location.state?.message && <div className="alert alert-success" role="status">{location.state.message}</div>}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <form onSubmit={handleSubmit} noValidate={false}>
        <div className="mb-3">
          <label htmlFor="customer-email" className="form-label">Email address</label>
          <input id="customer-email" name="email" type="email" className="form-control form-control-lg" autoComplete="email" value={form.email} onChange={change} required />
        </div>
        <div className="mb-2">
          <label htmlFor="customer-password" className="form-label">Password</label>
          <div className="customer-password-wrap">
            <input id="customer-password" name="password" type={showPassword ? "text" : "password"} className="form-control form-control-lg" autoComplete="current-password" value={form.password} onChange={change} required />
            <button type="button" className="customer-password-toggle" onClick={() => setShowPassword((shown) => !shown)} aria-pressed={showPassword}>{showPassword ? "Hide" : "Show"}</button>
          </div>
        </div>
        <div className="text-end mb-4"><Link to="/forgot-password" className="customer-link">Forgot password?</Link></div>
        <button type="submit" className="btn btn-primary btn-lg w-100 customer-submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
      </form>
      <GoogleSignInButton portal="customer" from={location.state?.from} onError={setError} />
      <div className="customer-auth-divider"><span>New to Elitezaar?</span></div>
      <Link to="/customer/register" state={location.state} className="btn btn-outline-secondary btn-lg w-100">Create an account</Link>
      <p className="customer-auth-footnote">Selling with us? <Link to="/vendor/login" className="customer-link">Vendor portal</Link></p>
    </CustomerAuthShell>
  );
};

export default CustomerLogin;
