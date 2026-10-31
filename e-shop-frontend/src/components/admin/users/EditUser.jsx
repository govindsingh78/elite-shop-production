import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { apiUrl } from "../../common/http";
import { toast } from "react-toastify";
import UserForm from "./UserForm";

const EditUser = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: "", email: "", role: "customer", password: "", password_confirmation: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("adminToken");
        if (!token) throw new Error("Your admin session has expired. Sign in again.");
        const response = await fetch(`${apiUrl}/admin/users/${id}`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load user.");
        setValues({ name: data.name || "", email: data.email || "", role: data.role || "customer", password: "", password_confirmation: "" });
      } catch (error) {
        setErrors({ general: error.message || "Unable to load user." });
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [id]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined, general: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) throw new Error("Your admin session has expired. Sign in again.");
      const response = await fetch(`${apiUrl}/admin/users/${id}`, {
        method: "PUT",
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
      if (!response.ok) throw new Error(data.message || "Unable to update user.");
      toast.success(data.message || "User updated.");
      navigate("/admin/manage-users");
    } catch (error) {
      setErrors({ general: error.message || "Unable to update user." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex admin-dashboard-layout">
          <Sidebar />
          <main className="container-fluid p-4">
            <h2 className="mb-4">Edit User</h2>
            {loading ? <p role="status">Loading user...</p> : (
              <div className="card shadow-sm" style={{ maxWidth: 650 }}>
                <div className="card-body">
                  <UserForm values={values} onChange={handleChange} onSubmit={handleSubmit} errors={errors} loading={saving} editing />
                </div>
              </div>
            )}
            {!loading && errors.general && <button className="btn btn-link mt-2" onClick={() => navigate("/admin/manage-users")}>Back to users</button>}
          </main>
        </div>
      </div>
    </Layout>
  );
};

export default EditUser;
