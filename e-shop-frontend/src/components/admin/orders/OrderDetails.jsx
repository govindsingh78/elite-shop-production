import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { apiUrl } from "../../common/http";
import TrackingManager from "./TrackingManager";
import OrderInvoices from "../gst/OrderInvoices";
import { portalConfig, portalToken } from "../portal";

const orderStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
const paymentStatuses = ["unpaid", "paid", "refunded", "failed"];
const money = (value) => Number(value || 0).toFixed(2);

const OrderDetails = ({ portal = "admin" }) => {
  const config = portalConfig(portal);
  const isVendor = portal === "vendor";
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [form, setForm] = useState({ status: "pending", payment_status: "unpaid", tracking_number: "", courier_name: "", estimated_delivery_date: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Vendors can only change shipping on orders where every item is theirs.
  const canEdit = !isVendor || !!order?.can_manage_shipping;

  const applyOrder = (data) => {
    setOrder(data);
    setForm({
      status: data.status || "pending",
      payment_status: data.payment_status || "unpaid",
      tracking_number: data.tracking_number || "",
      courier_name: data.courier_name || "",
      estimated_delivery_date: data.estimated_delivery_date || "",
      notes: data.notes || "",
    });
  };

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = portalToken(portal);
      if (!token) throw new Error(config.sessionExpired);
      const response = await fetch(`${apiUrl}/${config.api}/orders/${id}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 404 ? "This order was not found." : data.message || "Unable to load order.");
      applyOrder(data);
    } catch (requestError) {
      setError(requestError.message || "Unable to load order.");
    } finally {
      setLoading(false);
    }
  }, [id, portal, config]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const shipping = { status: form.status, tracking_number: form.tracking_number, courier_name: form.courier_name, estimated_delivery_date: form.estimated_delivery_date || null };
      const response = await fetch(`${apiUrl}/${config.api}/orders/${id}`, {
        method: "PUT",
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${portalToken(portal) || ""}` },
        body: JSON.stringify(isVendor ? shipping : { ...form, ...shipping }),
      });
      const data = await response.json();
      if (response.status === 422) {
        throw new Error(Object.values(data.errors || {}).flat()[0] || data.message || "Please check the submitted values.");
      }
      if (!response.ok) throw new Error(data.message || "Unable to update order.");
      applyOrder(data.data);
      setSuccess(data.message || "Order updated successfully.");
    } catch (requestError) {
      setError(requestError.message || "Unable to update order.");
    } finally {
      setSaving(false);
    }
  };

  const field = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex">
          <Sidebar variant={config.sidebar} />
          <main className="container-fluid p-4">
            <button className="btn btn-link px-0 mb-2" onClick={() => navigate(config.ordersPath)}>← Back to orders</button>
            {loading ? <p role="status">Loading order...</p> : error && !order ? (
              <div className="alert alert-danger" role="alert">{error}</div>
            ) : order && (
              <>
                <div className="mb-4">
                  <h2 className="mb-1">Order #{order.id}</h2>
                  <p className="text-muted mb-0">Placed {order.created_at ? new Date(order.created_at).toLocaleString() : "—"}</p>
                </div>

                {isVendor && !order.can_manage_shipping && (
                  <div className="alert alert-info" role="status">This order also contains items from other sellers, so the store team manages its shipping and tracking. You can see the items you sold and follow the delivery progress below.</div>
                )}
                {error && <div className="alert alert-danger" role="alert">{error}</div>}
                {success && <div className="alert alert-success" role="status">{success}</div>}

                <div className="row g-4">
                  <div className="col-lg-7">
                    <section className="card shadow-sm mb-4">
                      <div className="card-header bg-white"><h5 className="mb-0">{isVendor ? "Your items in this order" : "Items"}</h5></div>
                      <div className="table-responsive">
                        <table className="table mb-0 align-middle">
                          <thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Unit price</th><th>Subtotal</th></tr></thead>
                          <tbody>
                            {(order.items || []).map((item) => (
                              <tr key={item.id}><td>{item.product_title}{item.size && <div className="small text-muted">Size <strong>{item.size}</strong></div>}</td><td>{item.sku || "—"}</td><td>{item.quantity}</td><td>{money(item.unit_price)}</td><td>{money(Number(item.unit_price) * item.quantity)}{Number(item.discount_amount) > 0 && <div className="small text-success">−{money(item.discount_amount)} coupon</div>}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="card-body ms-auto" style={{ minWidth: 250 }}>
                        {isVendor && (order.items || []).some((item) => Number(item.discount_amount) > 0) && <div className="d-flex justify-content-between small text-muted"><span>Coupon {order.coupon_code}</span><span>−{money((order.items || []).reduce((sum, item) => sum + Number(item.discount_amount || 0), 0))}</span></div>}
                        {isVendor && <div className="d-flex justify-content-between fw-bold"><span>Your sales</span><span>{money(order.vendor_subtotal)}</span></div>}
                        {order.total !== undefined && <>
                          <div className={`d-flex justify-content-between${isVendor ? " text-muted small mt-2" : ""}`}><span>{isVendor ? "Order subtotal" : "Subtotal"}</span><span>{money(order.subtotal)}</span></div>
                          {!isVendor && Number(order.discount_amount) > 0 && <div className="d-flex justify-content-between text-success"><span>Coupon {order.coupon_code}</span><span>−{money(order.discount_amount)}</span></div>}
                          <div className={`d-flex justify-content-between${isVendor ? " text-muted small" : ""}`}><span>Shipping</span><span>{money(order.shipping_amount)}</span></div>
                          {!isVendor && <div className="d-flex justify-content-between border-top mt-2 pt-2 fw-bold"><span>Total</span><span>{money(order.total)}</span></div>}
                          {!isVendor && Number(order.tax_total) > 0 && <div className="d-flex justify-content-between small text-muted"><span>Includes GST</span><span>{money(order.tax_total)}</span></div>}
                        </>}
                      </div>
                    </section>
                    <section className="card shadow-sm">
                      <div className="card-header bg-white"><h5 className="mb-0">Customer and delivery</h5></div>
                      <div className="card-body">
                        <p className="mb-1 fw-semibold">{order.customer_name}</p>
                        <p className="mb-1">{order.customer_email}</p>
                        {order.customer_phone && <p className="mb-2">{order.customer_phone}</p>}
                        <address className="mb-0">{order.address}<br />{order.city}{order.state ? `, ${order.state}` : ""} {order.postal_code || ""}<br />{order.country}</address>
                        {order.billing_gstin && <p className="mt-2 mb-0"><span className="text-muted">Bill to:</span> {order.billing_name} · GSTIN {order.billing_gstin}</p>}
                        {isVendor && order.notes && <p className="mt-3 mb-0"><span className="text-muted">Delivery notes:</span> {order.notes}</p>}
                        {!isVendor && order.policy_accepted_at && (
                          <p className="small text-muted mt-3 mb-0">Accepted the Return &amp; Refund Policy (version {order.policy_version}) on {new Date(order.policy_accepted_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.</p>
                        )}
                      </div>
                    </section>
                    <TrackingManager portal={portal} order={order} onOrderChange={applyOrder} readOnly={!canEdit} />
                    <OrderInvoices portal={portal} order={order} onChange={(links) => setOrder((current) => ({ ...current, invoice_links: links }))} />
                  </div>

                  <div className="col-lg-5">
                    <section className="card shadow-sm">
                      <div className="card-header bg-white"><h5 className="mb-0">{isVendor ? "Fulfillment" : "Fulfillment and payment"}</h5></div>
                      <div className="card-body">
                        <form onSubmit={handleSubmit}>
                          <fieldset disabled={!canEdit}>
                            <div className="mb-3">
                              <label htmlFor="status" className="form-label">Order status</label>
                              <select id="status" className="form-select" value={form.status} onChange={field("status")}>
                                {orderStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                              </select>
                            </div>
                            {isVendor ? (
                              <p className="small text-muted">Payment: <span className="text-capitalize">{order.payment_method} · {order.payment_status}</span></p>
                            ) : (
                              <div className="mb-3">
                                <label htmlFor="payment_status" className="form-label">Payment status</label>
                                <select id="payment_status" className="form-select" value={form.payment_status} onChange={field("payment_status")}>
                                  {paymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                                </select>
                                <div className="form-text">Payment method: {order.payment_method}</div>
                              </div>
                            )}
                            <div className="mb-3">
                              <label htmlFor="tracking_number" className="form-label">Tracking number</label>
                              <input id="tracking_number" className="form-control" value={form.tracking_number} onChange={field("tracking_number")} maxLength={255} />
                            </div>
                            <div className="row g-3 mb-3">
                              <div className="col-sm-6">
                                <label htmlFor="courier_name" className="form-label">Courier</label>
                                <input id="courier_name" className="form-control" placeholder="e.g. BlueDart" value={form.courier_name} onChange={field("courier_name")} maxLength={120} />
                              </div>
                              <div className="col-sm-6">
                                <label htmlFor="estimated_delivery_date" className="form-label">Estimated delivery</label>
                                <input id="estimated_delivery_date" type="date" className="form-control" value={form.estimated_delivery_date} onChange={field("estimated_delivery_date")} />
                              </div>
                            </div>
                            {!isVendor && (
                              <div className="mb-3">
                                <label htmlFor="notes" className="form-label">Admin notes</label>
                                <textarea id="notes" className="form-control" rows="4" value={form.notes} onChange={field("notes")} maxLength={4000} />
                              </div>
                            )}
                            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save order updates"}</button>
                          </fieldset>
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
