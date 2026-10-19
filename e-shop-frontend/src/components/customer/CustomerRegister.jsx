import React, { useContext, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { apiUrl } from "../common/http";
import { AdminAuthContext } from "../context/AdminAuth";
import CustomerAuthShell from "./CustomerAuthShell";
import AddressFields from "./AddressFields";

const initialForm = {
  name: "", email: "", phone: "", password: "", password_confirmation: "",
  label: "Home", address: "", city: "", state: "", postal_code: "", country: "India",
};

const CustomerRegister = () => {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, login } = useContext(AdminAuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || "/customer/dashboard";

  if (user?.portal === "customer") return <Navigate to={redirectTo} replace />;

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
      const response = await fetch(`${apiUrl}/customer/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (response.status === 422) {
        setErrors(Object.fromEntries(Object.entries(result.errors || {}).map(([field, messages]) => [field, messages[0]])));
        setError("Please check the highlighted fields.");
        return;
      }
      if (response.status === 429) throw new Error("Too many attempts. Please wait a minute and try again.");
      if (!response.ok) throw new Error(result.message || "Unable to create your account.");
      login(result);
      toast.success(`Welcome to Elite Shop, ${result.user.name.split(" ")[0]}!`);
      navigate(redirectTo, { replace: true });
    } catch (requestError) {
      setError(requestError instanceof TypeError ? "Cannot reach the store right now. Please try again shortly." : requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const input = (name, label, props = {}) => (
    <div className={props.wrapperClass || "col-md-6"}>
      <label htmlFor={`register-${name}`} className="form-label">{label}</label>
      <input id={`register-${name}`} name={name} type={props.type || "text"} className={`form-control ${errors[name] ? "is-invalid" : ""}`} value={form[name]} onChange={change} required autoComplete={props.autoComplete} minLength={props.minLength} maxLength={props.maxLength || 255} inputMode={props.inputMode} placeholder={props.placeholder} />
      {errors[name] ? <div className="invalid-feedback">{errors[name]}</div> : props.hint && <div className="form-text">{props.hint}</div>}
    </div>
  );

  return (
    <CustomerAuthShell wide eyebrow="Join Elite Shop" title="Create your account" subtitle="Just the essentials — and where we should deliver.">
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="customer-form-step"><span>1</span>About you</div>
        <div className="row g-3 mb-4">
          {input("name", "Full name", { autoComplete: "name", wrapperClass: "col-12" })}
          {input("email", "Email address", { type: "email", autoComplete: "email" })}
          {input("phone", "Mobile number", { type: "tel", autoComplete: "tel", inputMode: "tel", maxLength: 40, placeholder: "+91 98765 43210", hint: "For delivery updates only." })}
          {input("password", "Password", { type: "password", autoComplete: "new-password", minLength: 8, hint: "At least 8 characters." })}
          {input("password_confirmation", "Confirm password", { type: "password", autoComplete: "new-password", minLength: 8 })}
        </div>
        <div className="customer-form-step"><span>2</span>Delivery address <small className="customer-required-pill">Required</small></div>
        <AddressFields values={form} errors={errors} onChange={change} idPrefix="register" showRecipient={false} />
        <button type="submit" className="btn btn-primary btn-lg w-100 customer-submit mt-4" disabled={loading}>{loading ? "Creating your account…" : "Create account"}</button>
      </form>
      <p className="customer-auth-footnote">Already have an account? <Link to="/customer/login" state={location.state} className="customer-link">Sign in</Link></p>
    </CustomerAuthShell>
  );
};

export default CustomerRegister;
