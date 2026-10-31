import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { apiUrl } from "../../common/http";
import { toast } from "react-toastify";
import ShippingMethodForm from "./ShippingMethodForm";
import { getShippingApiErrorMessage } from "./apiError";

const CreateShipping = () => {
  const [values, setValues] = useState({ name: "", price: "0.00", status: "1" });
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
      if (!token) {
        setErrors({ general: "Your admin session has expired. Please sign in again." });
        return;
      }
      const response = await fetch(`${apiUrl}/shipping-methods`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify({ ...values, price: Number(values.price), status: Number(values.status) }),
      });
      const data = await response.json();
      if (response.status === 422) {
        const validationErrors = {};
        Object.entries(data.errors || {}).forEach(([field, messages]) => {
          validationErrors[field] = messages[0];
        });
        setErrors(validationErrors);
        return;
      }
      if (response.status === 401) {
        setErrors({ general: "Your admin session has expired. Please sign in again." });
        return;
      }
      if (!response.ok) throw new Error(data.message || "Unable to create shipping method.");
      toast.success(data.message || "Shipping method created.");
      navigate("/admin/manage-shipping");
    } catch (error) {
      setErrors({ general: getShippingApiErrorMessage(error, "Unable to create shipping method.") });
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
            <h2 className="mb-4">Add Shipping Method</h2>
            <div className="card shadow-sm" style={{ maxWidth: 600 }}>
              <div className="card-body">
                <ShippingMethodForm
                  values={values}
                  onChange={handleChange}
                  onSubmit={handleSubmit}
                  loading={loading}
                  submitLabel="Create shipping method"
                  errors={errors}
                />
              </div>
            </div>
          </main>
        </div>
      </div>
    </Layout>
  );
};

export default CreateShipping;
