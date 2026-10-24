import React, { useContext, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiUrl } from "../common/http";
import GoogleSignInButton from "../common/GoogleSignInButton";
import { AdminAuthContext } from "../context/AdminAuth";
import CustomerAuthShell from "../customer/CustomerAuthShell";

const COPY = {
  admin: {
    eyebrow: "Store management",
    title: "Admin sign in",
    subtitle: "Manage your catalog, orders, sellers and customers.",
    endpoint: "admin/login",
    dashboard: "/admin/dashboard",
    button: "Sign in to admin",
  },
  vendor: {
    eyebrow: "Partner portal",
    title: "Welcome back, seller",
    subtitle: "Sign in to manage your products and ship your orders.",
    endpoint: "vendor/login",
    dashboard: "/vendor/dashboard",
    button: "Sign in to seller hub",
  },
};

const Login = ({ portal = "admin" }) => {
  const isVendor = portal === "vendor";
  const copy = COPY[isVendor ? "vendor" : "admin"];
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  // A Google sign-in that didn't finish comes back here with the reason.
  const [error, setError] = useState(location.state?.error || "");
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AdminAuthContext);

  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/${copy.endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (response.status === 429) throw new Error("Too many attempts. Please wait a minute and try again.");
      if (!response.ok) throw new Error(Object.values(result.error || result.errors || {}).flat()[0] || result.message || "Unable to sign in.");
      login(result);
      navigate(location.state?.from || copy.dashboard, { replace: true });
    } catch (requestError) {
      setError(requestError instanceof TypeError ? "Cannot reach the API server. Make sure the backend is running." : requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <CustomerAuthShell portal={isVendor ? "vendor" : "admin"} eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle}>
      {location.state?.message && <div className="alert alert-success" role="status">{location.state.message}</div>}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="portal-email" className="form-label">{isVendor ? "Seller email" : "Work email"}</label>
          <input id="portal-email" name="email" type="email" className="form-control form-control-lg" autoComplete="email" value={form.email} onChange={change} required />
        </div>
        <div className="mb-2">
          <label htmlFor="portal-password" className="form-label">Password</label>
          <div className="customer-password-wrap">
            <input id="portal-password" name="password" type={showPassword ? "text" : "password"} className="form-control form-control-lg" autoComplete="current-password" value={form.password} onChange={change} required />
            <button type="button" className="customer-password-toggle" onClick={() => setShowPassword((shown) => !shown)} aria-pressed={showPassword}>{showPassword ? "Hide" : "Show"}</button>
          </div>
        </div>
        <div className="text-end mb-4"><Link to="/forgot-password" className="customer-link">Forgot password?</Link></div>
        <button type="submit" className="btn btn-primary btn-lg w-100 customer-submit" disabled={loading}>{loading ? "Signing in…" : copy.button}</button>
      </form>
      <GoogleSignInButton portal={isVendor ? "vendor" : "admin"} from={location.state?.from} label={isVendor ? "Continue with Google" : "Sign in with Google"} onError={setError} />

      {isVendor ? (
        <>
          <div className="customer-auth-divider"><span>New to selling on Elitezaar?</span></div>
          <Link to="/vendor/register" className="btn btn-outline-secondary btn-lg w-100">Create a seller account</Link>
          <p className="customer-auth-footnote">Shopping instead? <Link to="/customer/login" className="customer-link">Customer sign in</Link></p>
        </>
      ) : (
        <div className="customer-auth-switch">
          <Link to="/vendor/login"><strong>Seller?</strong><span>Vendor portal →</span></Link>
          <Link to="/customer/login"><strong>Shopper?</strong><span>Customer sign in →</span></Link>
        </div>
      )}
    </CustomerAuthShell>
  );
};

export default Login;
