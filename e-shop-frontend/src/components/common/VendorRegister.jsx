import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "./Layout";
import { apiUrl } from "./http";

const VendorRegister = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "", password_confirmation: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/vendor/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        const firstValidationError = Object.values(data.errors || {}).flat()[0];
        throw new Error(firstValidationError || data.message || "Unable to create vendor account.");
      }
      navigate("/vendor/login", { replace: true, state: { message: data.message } });
    } catch (requestError) {
      setError(requestError.message || "Unable to reach the vendor registration service.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container d-flex justify-content-center my-5 py-4">
        <form onSubmit={handleSubmit} className="card shadow-sm border-0 p-4" style={{ width: "min(100%, 540px)" }}>
          <p className="text-uppercase text-muted small mb-1">Seller partnership</p>
          <h1 className="h3 mb-2">Create your vendor account</h1>
          <p className="text-muted mb-4">Set up your seller login to access the vendor portal.</p>
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          <div className="mb-3">
            <label htmlFor="name" className="form-label">Your name</label>
            <input id="name" className="form-control" autoComplete="name" maxLength={255} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
          </div>
          <div className="mb-3">
            <label htmlFor="email" className="form-label">Email address</label>
            <input id="email" type="email" className="form-control" autoComplete="email" maxLength={255} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
          </div>
          <div className="mb-3">
            <label htmlFor="password" className="form-label">Password</label>
            <input id="password" type="password" className="form-control" autoComplete="new-password" minLength={8} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required />
          </div>
          <div className="mb-3">
            <label htmlFor="password_confirmation" className="form-label">Confirm password</label>
            <input id="password_confirmation" type="password" className="form-control" autoComplete="new-password" minLength={8} value={form.password_confirmation} onChange={(event) => setForm((current) => ({ ...current, password_confirmation: event.target.value }))} required />
          </div>
          <button type="submit" className="btn btn-primary w-100" disabled={loading}>{loading ? "Creating account..." : "Create vendor account"}</button>
          <p className="text-center mt-3 mb-0">Already registered? <Link to="/vendor/login">Vendor sign in</Link></p>
        </form>
      </div>
    </Layout>
  );
};

export default VendorRegister;
