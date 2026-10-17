// src/pages/ChangePassword.jsx
import { useState } from "react";
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
  headers: { Accept: "application/json" },
});

// Attach admin token (adjust to however you store it)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const initial = { current_password: "", password: "", password_confirmation: "" };

export default function ChangePassword() {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: undefined });
  };

  const validate = () => {
    const e = {};
    if (!form.current_password) e.current_password = "Current password is required.";
    if (form.password.length < 8) e.password = "Minimum 8 characters.";
    else if (form.password === form.current_password)
      e.password = "New password must differ from the current one.";
    if (form.password !== form.password_confirmation)
      e.password_confirmation = "Passwords do not match.";
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setSuccess("");
    const clientErrors = validate();
    if (Object.keys(clientErrors).length) return setErrors(clientErrors);

    setLoading(true);
    try {
      const { data } = await api.post("/admin/change-password", form);
      setSuccess(data.message);
      setForm(initial);
      setErrors({});
    } catch (err) {
      if (err.response?.status === 422) {
        const serverErrors = {};
        Object.entries(err.response.data.errors).forEach(
          ([k, v]) => (serverErrors[k] = v[0])
        );
        setErrors(serverErrors);
      } else if (err.response?.status === 429) {
        setErrors({ general: "Too many attempts. Try again in a minute." });
      } else {
        setErrors({ general: "Something went wrong. Please try again." });
      }
    } finally {
      setLoading(false);
    }
  };

  const field = (name, label) => (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor={name} style={{ display: "block", marginBottom: 4 }}>{label}</label>
      <input
        id={name}
        name={name}
        type={show ? "text" : "password"}
        value={form[name]}
        onChange={handleChange}
        autoComplete={name === "current_password" ? "current-password" : "new-password"}
        style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
      />
      {errors[name] && <small style={{ color: "crimson" }}>{errors[name]}</small>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 400, margin: "40px auto" }}>
      <h2>Change Password</h2>

      {success && <p style={{ color: "green" }}>{success}</p>}
      {errors.general && <p style={{ color: "crimson" }}>{errors.general}</p>}

      {field("current_password", "Current Password")}
      {field("password", "New Password")}
      {field("password_confirmation", "Confirm New Password")}

      <label style={{ display: "block", marginBottom: 16 }}>
        <input type="checkbox" checked={show} onChange={() => setShow(!show)} /> Show passwords
      </label>

      <button type="submit" disabled={loading} style={{ padding: "8px 16px" }}>
        {loading ? "Updating..." : "Update Password"}
      </button>
    </form>
  );
}
