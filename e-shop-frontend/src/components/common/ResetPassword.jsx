import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Layout from "./Layout";
import { apiUrl } from "./http";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: searchParams.get("email") || "", password: "", password_confirmation: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...form, token: searchParams.get("token") || "" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.errors?.token?.[0] || data.errors?.password?.[0] || "Unable to reset password.");
      navigate("/admin/login", { replace: true, state: { message: data.message } });
    } catch (requestError) {
      setError(requestError.message || "Unable to reach the password reset service.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container d-flex justify-content-center my-5 py-4">
        <form onSubmit={handleSubmit} className="card shadow-sm border-0 p-4" style={{ width: "min(100%, 500px)" }}>
          <p className="text-uppercase text-muted small mb-1">Account security</p>
          <h1 className="h3 mb-2">Set a new password</h1>
          <p className="text-muted mb-4">Use at least 8 characters. You’ll need to sign in again after resetting.</p>
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          <div className="mb-3">
            <label htmlFor="email" className="form-label">Email address</label>
            <input id="email" type="email" className="form-control" autoComplete="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
          </div>
          <div className="mb-3">
            <label htmlFor="password" className="form-label">New password</label>
            <input id="password" type="password" className="form-control" autoComplete="new-password" minLength={8} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required />
          </div>
          <div className="mb-3">
            <label htmlFor="password_confirmation" className="form-label">Confirm new password</label>
            <input id="password_confirmation" type="password" className="form-control" autoComplete="new-password" minLength={8} value={form.password_confirmation} onChange={(event) => setForm((current) => ({ ...current, password_confirmation: event.target.value }))} required />
          </div>
          <button type="submit" className="btn btn-primary w-100" disabled={loading}>{loading ? "Resetting..." : "Reset password"}</button>
          <p className="text-center mt-3 mb-0"><Link to="/admin/login">Back to sign in</Link></p>
        </form>
      </div>
    </Layout>
  );
};

export default ResetPassword;
