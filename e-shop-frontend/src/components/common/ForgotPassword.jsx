import React, { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "./Layout";
import { apiUrl } from "./http";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${apiUrl}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.errors?.email?.[0] || "Unable to request a reset link.");
      setMessage(data.message || "If an account exists for that email, a reset link has been sent.");
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
          <p className="text-uppercase text-muted small mb-1">Account help</p>
          <h1 className="h3 mb-2">Forgot your password?</h1>
          <p className="text-muted mb-4">Enter your account email and we’ll send instructions to reset your password.</p>
          {message && <div className="alert alert-success" role="status">{message}</div>}
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          <div className="mb-3">
            <label htmlFor="email" className="form-label">Email address</label>
            <input id="email" className="form-control" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary w-100" disabled={loading}>{loading ? "Sending..." : "Send reset link"}</button>
          <p className="text-center mt-3 mb-0"><Link to="/admin/login">Back to sign in</Link></p>
        </form>
      </div>
    </Layout>
  );
};

export default ForgotPassword;
