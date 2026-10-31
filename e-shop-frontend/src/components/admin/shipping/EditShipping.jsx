import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { apiUrl } from "../../common/http";
import { toast } from "react-toastify";
import ShippingMethodForm from "./ShippingMethodForm";

const EditShipping = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: "", price: "0.00", status: "1" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchMethod = async () => {
      try {
        const token = localStorage.getItem("adminToken");
        const response = await fetch(`${apiUrl}/shipping-methods/${id}`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token || ""}`,
          },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load shipping method.");
        setValues({ name: data.name ?? "", price: String(data.price ?? "0.00"), status: String(data.status ?? 1) });
      } catch (error) {
        setErrors({ general: error.message || "Unable to load shipping method." });
      } finally {
        setLoading(false);
      }
    };
    fetchMethod();
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
      const response = await fetch(`${apiUrl}/shipping-methods/${id}`, {
        method: "PUT",
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
      if (!response.ok) throw new Error(data.message || "Unable to update shipping method.");
      toast.success(data.message || "Shipping method updated.");
      navigate("/admin/manage-shipping");
    } catch (error) {
      setErrors({ general: error.message || "Unable to update shipping method." });
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
            <h2 className="mb-4">Edit Shipping Method</h2>
            {loading ? (
              <p role="status">Loading shipping method...</p>
            ) : (
              <div className="card shadow-sm" style={{ maxWidth: 600 }}>
                <div className="card-body">
                  <ShippingMethodForm
                    values={values}
                    onChange={handleChange}
                    onSubmit={handleSubmit}
                    loading={saving}
                    submitLabel="Save changes"
                    errors={errors}
                  />
                  {errors.general && (
                    <button className="btn btn-link mt-2" onClick={() => navigate("/admin/manage-shipping")}>
                      Back to shipping methods
                    </button>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </Layout>
  );
};

export default EditShipping;
