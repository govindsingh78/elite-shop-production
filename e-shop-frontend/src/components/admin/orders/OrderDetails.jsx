import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { apiUrl } from "../../common/http";

const orderStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
const paymentStatuses = ["unpaid", "paid", "refunded", "failed"];
const money = (value) => Number(value || 0).toFixed(2);

const OrderDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [form, setForm] = useState({ status: "pending", payment_status: "unpaid", tracking_number: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) throw new Error("Your admin session has expired. Sign in again.");
      const response = await fetch(`${apiUrl}/admin/orders/${id}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load order.");
      setOrder(data);
      setForm({
        status: data.status || "pending",
        payment_status: data.payment_status || "unpaid",
        tracking_number: data.tracking_number || "",
        notes: data.notes || "",
      });
    } catch (requestError) {
      setError(requestError.message || "Unable to load order.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`${apiUrl}/admin/orders/${id}`, {
        method: "PUT",
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (response.status === 422) {
        throw new Error(Object.values(data.errors || {}).flat()[0] || data.message || "Please check the submitted values.");
      }
      if (!response.ok) throw new Error(data.message || "Unable to update order.");
      setOrder(data.data);
      setSuccess(data.message || "Order updated successfully.");
    } catch (requestError) {
      setError(requestError.message || "Unable to update order.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex">
          <Sidebar />
          <main className="container-fluid p-4">
            <button className="btn btn-link px-0 mb-2" onClick={() => navigate("/admin/manage-orders")}>← Back to orders</button>
            {loading ? <p role="status">Loading order...</p> : error && !order ? (
              <div className="alert alert-danger" role="alert">{error}</div>
            ) : order && (
              <>
                <div className="mb-4">
                  <h2 className="mb-1">Order #{order.id}</h2>
                  <p className="text-muted mb-0">Placed {order.created_at ? new Date(order.created_at).toLocaleString() : "—"}</p>
                </div>

                {error && <div className="alert alert-danger" role="alert">{error}</div>}
                {success && <div className="alert alert-success" role="status">{success}</div>}

                <div className="row g-4">
                  <div className="col-lg-7">
                    <section className="card shadow-sm mb-4">
                      <div className="card-header bg-white"><h5 className="mb-0">Items</h5></div>
                      <div className="table-responsive">
                        <table className="table mb-0 align-middle">
                          <thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Unit price</th><th>Subtotal</th></tr></thead>
                          <tbody>
                            {(order.items || []).map((item) => (
                              <tr key={item.id}><td>{item.product_title}</td><td>{item.sku || "—"}</td><td>{item.quantity}</td><td>{money(item.unit_price)}</td><td>{money(item.line_total)}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="card-body ms-auto" style={{ minWidth: 250 }}>
                        <div className="d-flex justify-content-between"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
                        <div className="d-flex justify-content-between"><span>Shipping</span><span>{money(order.shipping_amount)}</span></div>
                        <div className="d-flex justify-content-between border-top mt-2 pt-2 fw-bold"><span>Total</span><span>{money(order.total)}</span></div>
                      </div>
                    </section>
                    <section className="card shadow-sm">
                      <div className="card-header bg-white"><h5 className="mb-0">Customer and delivery</h5></div>
                      <div className="card-body">
                        <p className="mb-1 fw-semibold">{order.customer_name}</p>
                        <p className="mb-1">{order.customer_email}</p>
                        {order.customer_phone && <p className="mb-2">{order.customer_phone}</p>}
                        <address className="mb-0">{order.address}<br />{order.city}{order.state ? `, ${order.state}` : ""} {order.postal_code || ""}<br />{order.country}</address>
                      </div>
                    </section>
                  </div>

                  <div className="col-lg-5">
                    <section className="card shadow-sm">
                      <div className="card-header bg-white"><h5 className="mb-0">Fulfillment and payment</h5></div>
                      <div className="card-body">
                        <form onSubmit={handleSubmit}>
                          <div className="mb-3">
                            <label htmlFor="status" className="form-label">Order status</label>
                            <select id="status" className="form-select" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                              {orderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                            </select>
                          </div>
                          <div className="mb-3">
                            <label htmlFor="payment_status" className="form-label">Payment status</label>
                            <select id="payment_status" className="form-select" value={form.payment_status} onChange={(event) => setForm((current) => ({ ...current, payment_status: event.target.value }))}>
                              {paymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                            </select>
                            <div className="form-text">Payment method: {order.payment_method}</div>
                          </div>
                          <div className="mb-3">
                            <label htmlFor="tracking_number" className="form-label">Tracking number</label>
                            <input id="tracking_number" className="form-control" value={form.tracking_number} onChange={(event) => setForm((current) => ({ ...current, tracking_number: event.target.value }))} maxLength={255} />
                          </div>
                          <div className="mb-3">
                            <label htmlFor="notes" className="form-label">Admin notes</label>
                            <textarea id="notes" className="form-control" rows="4" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} maxLength={4000} />
                          </div>
                          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save order updates"}</button>
                        </form>
                      </div>
                    </section>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </Layout>
  );
};

export default OrderDetails;
