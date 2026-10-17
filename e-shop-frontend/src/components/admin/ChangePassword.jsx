import React, { useState } from "react";
import Layout from "../common/Layout";
import Sidebar from "../common/Sidebar";
import { apiUrl } from "../common/http";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const initialForm = {
  current_password: "",
  password: "",
  password_confirmation: "",
};

const ChangePassword = () => {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    setErrors({ ...errors, [name]: undefined }); // clear error of the field being edited
  };

  // Basic client-side validation
  const validate = () => {
    const newErrors = {};
    if (!form.current_password) {
      newErrors.current_password = "Current password is required.";
    }
    if (form.password.length < 8) {
      newErrors.password = "New password must be at least 8 characters.";
    } else if (form.password === form.current_password) {
      newErrors.password = "New password must be different from current password.";
    }
    if (form.password !== form.password_confirmation) {
      newErrors.password_confirmation = "Passwords do not match.";
    }
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const clientErrors = validate();
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`${apiUrl}/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        "body": JSON.stringify(form),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Password changed successfully!");
        setForm(initialForm);
        setErrors({});
      } else if (response.status === 422) {
        // Laravel validation errors: { errors: { field: [msg] } }
        const serverErrors = {};
        Object.entries(data.errors || {}).forEach(([field, messages]) => {
          serverErrors[field] = messages[0];
        });
        setErrors(serverErrors);
      } else if (response.status === 429) {
        toast.error("Too many attempts. Please try again in a minute.");
      } else {
        toast.error(data.message || "Failed to change password.");
      }
    } catch (error) {
      console.error("Error changing password:", error);
      toast.error("An error occurred while changing the password.");
    } finally {
      setLoading(false);
    }
  };

  const renderField = (name, label) => (
    <div className="mb-3">
      <label htmlFor={name} className="form-label">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={showPassword ? "text" : "password"}
        className={`form-control ${errors[name] ? "is-invalid" : ""}`}
        value={form[name]}
        onChange={handleChange}
        autoComplete={name === "current_password" ? "current-password" : "new-password"}
      />
      {errors[name] && <div className="invalid-feedback">{errors[name]}</div>}
    </div>
  );

  return (
    <Layout>
      <div className="container py-5">
        <div className="row">
          <div className="col-md-12">
            <div className="d-flex">
              {/* Left Navigation Bar */}
              <Sidebar />

              {/* Right Content Area */}
              <div className="container-fluid p-4">
                <h2 className="mb-4">Change Password</h2>

                <div className="card shadow-sm" style={{ maxWidth: 500 }}>
                  <div className="card-body">
                    <form onSubmit={handleSubmit} noValidate>
                      {renderField("current_password", "Current Password")}
                      {renderField("password", "New Password")}
                      {renderField("password_confirmation", "Confirm New Password")}

                      <div className="form-check mb-3">
                        <input
                          id="showPassword"
                          type="checkbox"
                          className="form-check-input"
                          checked={showPassword}
                          onChange={() => setShowPassword(!showPassword)}
                        />
                        <label htmlFor="showPassword" className="form-check-label">
                          Show passwords
                        </label>
                      </div>

                      <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? "Updating..." : "Update Password"}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ChangePassword;
