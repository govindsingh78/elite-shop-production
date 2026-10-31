import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { apiUrl } from "../../common/http";
import { portalConfig, portalToken } from "../portal";

const orderStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
const money = (value) => Number(value || 0).toFixed(2);

const ManageOrders = ({ portal = "admin" }) => {
  const config = portalConfig(portal);
  const isVendor = portal === "vendor";
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({ search: "", status: "", page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = portalToken(portal);
      if (!token) throw new Error(config.sessionExpired);
      const params = new URLSearchParams({ page: String(filters.page) });
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      const response = await fetch(`${apiUrl}/${config.api}/orders?${params}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load orders.");
      setOrders(data.data || []);
      setPagination(data);
    } catch (requestError) {
      setError(requestError.message || "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }, [filters, portal, config]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleSearch = (event) => {
    event.preventDefault();
    setFilters((current) => ({ ...current, search: searchInput.trim(), page: 1 }));
  };

  const handleDelete = async (order) => {
    if (!window.confirm(`Delete order #${order.id}? This cannot be undone.`)) return;
    try {
      const response = await fetch(`${apiUrl}/admin/orders/${order.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json", Authorization: `Bearer ${portalToken(portal) || ""}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to delete order.");
      if (orders.length === 1 && filters.page > 1) {
        setFilters((current) => ({ ...current, page: current.page - 1 }));
      } else {
        setOrders((current) => current.filter((item) => item.id !== order.id));
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to delete order.");
    }
  };

  const statusClass = (status) => ({
    pending: "bg-warning text-dark",
    processing: "bg-info text-dark",
    shipped: "bg-primary",
    delivered: "bg-success",
    cancelled: "bg-danger",
  }[status] || "bg-secondary");

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex admin-dashboard-layout">
          <Sidebar variant={config.sidebar} />
          <main className="container-fluid p-4">
            <div className="mb-4">
              <h2 className="mb-1">{isVendor ? "My Orders" : "Manage Orders"}</h2>
              <p className="text-muted mb-0">{isVendor ? "Orders that include your products. Ship them and keep customers updated." : "Review orders, update fulfillment, and manage tracking."}</p>
            </div>

            <form className="row g-2 mb-3" onSubmit={handleSearch}>
              <div className="col-sm-6 col-lg-5">
                <label htmlFor="order-search" className="visually-hidden">Search orders</label>
                <input id="order-search" className="form-control" placeholder={isVendor ? "Search order #, customer, tracking" : "Search order #, customer, email, tracking"} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
              </div>
              <div className="col-sm-4 col-lg-3">
                <label htmlFor="order-status-filter" className="visually-hidden">Filter status</label>
                <select id="order-status-filter" className="form-select" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}>
                  <option value="">All statuses</option>
                  {orderStatuses.map((status) => <option value={status} key={status}>{status}</option>)}
                </select>
              </div>
              <div className="col-sm-2"><button type="submit" className="btn btn-outline-primary w-100">Search</button></div>
            </form>

            {error && <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert"><span>{error}</span><button className="btn btn-outline-danger btn-sm" onClick={fetchOrders}>Try again</button></div>}
            {loading ? <p role="status">Loading orders...</p> : (
              <>
                <div className="table-responsive">
                  <table className="table table-bordered table-hover align-middle">
                    <thead className="table-light"><tr><th>Order</th><th>Customer</th><th>Placed</th><th>{isVendor ? "Your items" : "Items"}</th><th>{isVendor ? "Your sales" : "Total"}</th><th>Payment</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {orders.length ? orders.map((order) => (
                        <tr key={order.id}>
                          <td>#{order.id}</td>
                          <td>{order.customer_name}{!isVendor && <div className="small text-muted">{order.customer_email}</div>}{isVendor && <div className="small text-muted">{order.city}</div>}</td>
                          <td>{order.created_at ? new Date(order.created_at).toLocaleDateString() : "—"}</td>
                          <td>{order.items_count ?? "—"}</td>
                          <td>{money(isVendor ? order.vendor_subtotal : order.total)}</td>
                          <td className="text-capitalize">{order.payment_method} · {order.payment_status}</td>
                          <td><span className={`badge text-capitalize ${statusClass(order.status)}`}>{order.status}</span>{order.latest_tracking_event?.location && <small className="d-block text-muted mt-1">📍 {order.latest_tracking_event.location}</small>}</td>
                          <td className="text-nowrap">
                            <button className="btn btn-outline-primary btn-sm me-2" onClick={() => navigate(config.orderPath(order.id))}>{isVendor ? "View / ship" : "View / update"}</button>
                            {!isVendor && <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete(order)}>Delete</button>}
                          </td>
                        </tr>
                      )) : <tr><td colSpan="8" className="text-center text-muted py-4">{isVendor && !filters.search && !filters.status ? "No orders yet. Orders for your products will appear here." : "No orders found."}</td></tr>}
                    </tbody>
                  </table>
                </div>
                {pagination && pagination.last_page > 1 && (
                  <nav className="d-flex justify-content-between align-items-center" aria-label="Order pages">
                    <button className="btn btn-outline-secondary btn-sm" disabled={!pagination.prev_page_url || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>
                    <span>Page {pagination.current_page} of {pagination.last_page}</span>
                    <button className="btn btn-outline-secondary btn-sm" disabled={!pagination.next_page_url || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
                  </nav>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </Layout>
  );
};

export default ManageOrders;
