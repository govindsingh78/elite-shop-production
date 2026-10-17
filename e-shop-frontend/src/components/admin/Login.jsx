import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../common/Layout";
import { apiUrl } from "../common/http";
import { useContext } from "react";
import { AdminAuthContext } from "../context/AdminAuth";

const Login = ({ portal = "admin" }) => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useContext(AdminAuthContext);
  const isVendor = portal === "vendor";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/${isVendor ? "vendor/login" : "admin/login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to sign in.");
      login(result);
      navigate(isVendor ? "/vendor/dashboard" : "/admin/dashboard", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Unable to sign in. Check the API server and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container d-flex justify-content-center my-5 py-4">
        <form onSubmit={handleSubmit} className="card shadow-sm border-0 p-4" style={{ width: "min(100%, 500px)" }}>
          <p className="text-uppercase text-muted small mb-1">{isVendor ? "Partner portal" : "Store management"}</p>
          <h1 className="h3 mb-4"><strong>{isVendor ? "Vendor Login" : "Admin Login"}</strong></h1>
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          <div className="mb-3">
            <label htmlFor="email" className="form-label">Email</label>
            <input id="email" type="email" className="form-control" autoComplete="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
          </div>
          <div className="mb-3">
            <label htmlFor="password" className="form-label">Password</label>
            <input id="password" type="password" className="form-control" autoComplete="current-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required />
          </div>
          <div className="text-end mb-3"><Link to="/forgot-password">Forgot password?</Link></div>
          <button type="submit" className="btn btn-secondary w-100" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
          {isVendor ? (
            <p className="text-center mt-3 mb-0">New to the marketplace? <Link to="/vendor/register">Create a vendor account</Link></p>
          ) : (
            <p className="text-center mt-3 mb-0"><Link to="/vendor/login">Vendor portal</Link></p>
          )}
        </form>
      </div>
    </Layout>
  );
};

export default Login;
