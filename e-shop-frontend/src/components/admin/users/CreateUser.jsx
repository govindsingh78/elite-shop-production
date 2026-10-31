import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { apiUrl } from "../../common/http";
import { toast } from "react-toastify";
import UserForm from "./UserForm";

const initialValues = { name: "", email: "", role: "customer", password: "", password_confirmation: "" };

const CreateUser = () => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined, general: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) throw new Error("Your admin session has expired. Sign in again.");
      const response = await fetch(`${apiUrl}/admin/users`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (response.status === 422) {
        const fieldErrors = {};
        Object.entries(data.errors || {}).forEach(([field, messages]) => { fieldErrors[field] = messages[0]; });
        setErrors(fieldErrors);
        return;
      }
      if (!response.ok) throw new Error(data.message || "Unable to create user.");
      toast.success(data.message || "User created.");
      navigate("/admin/manage-users");
    } catch (error) {
      setErrors({ general: error.message || "Unable to create user." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex admin-dashboard-layout">
          <Sidebar />
          <main className="container-fluid p-4">
            <h2 className="mb-4">Create User</h2>
            <div className="card shadow-sm" style={{ maxWidth: 650 }}>
              <div className="card-body">
                <UserForm values={values} onChange={handleChange} onSubmit={handleSubmit} errors={errors} loading={loading} />
              </div>
            </div>
          </main>
        </div>
      </div>
    </Layout>
  );
};

export default CreateUser;
