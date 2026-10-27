import React, { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { commissionRequest, formatDay } from "../commissions/commissions";
import { SellerStatusBadge } from "./SellerBits";
import { SELLER_TABS, sellerActions, sellerIsInactive } from "./sellers";

/** Admin: approve or decline new sellers, and deactivate or reactivate existing ones. */
const ManageSellers = () => {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({ status: searchParams.get("status") || "", search: "", page: 1 });
  const [searchInput, setSearchInput] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(filters.page) });
      if (filters.status) params.set("status", filters.status);
      if (filters.search) params.set("search", filters.search);
      setData(await commissionRequest("admin", `/admin/sellers?${params}`));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const onChanged = (result) => {
    toast.success(result.message);
    setData((current) => ({
      ...current,
      counts: result.counts,
      data: current.data.map((seller) => (seller.id === result.seller.id ? result.seller : seller)),
    }));
  };

  const search = (event) => {
    event.preventDefault();
    setFilters((current) => ({ ...current, search: searchInput.trim(), page: 1 }));
  };

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex admin-dashboard-layout">
          <Sidebar />
          <main className="container-fluid admin-dashboard-content customer-content">
            <section className="customer-hero">
              <div>
                <span className="customer-eyebrow customer-eyebrow--light">MARKETPLACE</span>
                <h1>Sellers<span>.</span></h1>
                <p>Approve new sellers before they can list products, and deactivate a seller when you need to — their products leave the store straight away.</p>
              </div>
            </section>

            <div className="product-review-tabs" role="tablist" aria-label="Seller status">
              {SELLER_TABS.map((tab) => {
                const count = data?.counts?.[tab.count];
                return (
                  <button key={tab.key || "all"} type="button" role="tab" aria-selected={filters.status === tab.key} className={`product-review-tab${filters.status === tab.key ? " is-active" : ""}${tab.key ? ` is-${tab.key}` : ""}`} onClick={() => setFilters((current) => ({ ...current, status: tab.key, page: 1 }))}>
                    {tab.label}{count > 0 && (tab.key === "pending" || !tab.key) && <span>{count}</span>}
                  </button>
                );
              })}
            </div>

            <form className="seller-search" onSubmit={search} role="search">
              <label className="visually-hidden" htmlFor="seller-search">Find a seller</label>
              <input id="seller-search" className="form-control" placeholder="Name, email, phone or GSTIN" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
              <button type="submit" className="btn btn-outline-primary">Search</button>
            </form>

            {error && (
              <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
                <span>{error}</span>
                <button type="button" className="btn btn-outline-danger btn-sm" onClick={load}>Try again</button>
              </div>
            )}

            {loading && !data && <p className="text-muted" role="status">Loading sellers…</p>}
            {data && (data.data.length ? (
              <ul className="seller-list" aria-busy={loading}>
                {data.data.map((seller) => <SellerCard key={seller.id} seller={seller} onChanged={onChanged} />)}
              </ul>
            ) : (
              <div className="customer-panel text-center text-muted py-5">
                {filters.search ? "No sellers match your search." : filters.status === "pending" ? "No applications waiting — you’re all caught up." : "No sellers here yet."}
              </div>
            ))}

            {data && data.last_page > 1 && (
              <nav className="d-flex justify-content-between align-items-center mt-3" aria-label="Seller pages">
                <button type="button" className="btn btn-outline-secondary btn-sm" disabled={data.current_page <= 1 || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>
                <span>Page {data.current_page} of {data.last_page}</span>
                <button type="button" className="btn btn-outline-secondary btn-sm" disabled={data.current_page >= data.last_page || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
              </nav>
            )}
          </main>
        </div>
      </div>
    </Layout>
  );
};

const SellerCard = ({ seller, onChanged }) => {
  const [asking, setAsking] = useState(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [saving, setSaving] = useState("");
  const status = seller.seller_status;
  const hidden = sellerIsInactive(status);

  const change = async (action) => {
    setSaving(action.status);
    setReasonError("");
    try {
      const result = await commissionRequest("admin", `/admin/sellers/${seller.id}/status`, { method: "PATCH", body: { status: action.status, note: action.reason ? reason : null } });
      setAsking(null);
      setReason("");
      onChanged(result);
    } catch (requestError) {
      if (action.reason) setReasonError(requestError.fieldErrors?.note || requestError.message);
      else toast.error(requestError.message);
    } finally {
      setSaving("");
    }
  };

  const start = (action) => {
    if (action.reason) {
      setAsking(action);
      setReasonError("");
    } else {
      change(action);
    }
  };

  return (
    <li className={`seller-card is-${status}`}>
      <div className="seller-card-head">
        <span className="seller-avatar" aria-hidden="true">{seller.name.trim().charAt(0).toUpperCase()}</span>
        <div className="seller-card-title">
          <h2>{seller.name} <SellerStatusBadge status={status} /></h2>
          <p>{seller.email}{seller.phone ? ` · ${seller.phone}` : ""} · joined {formatDay(seller.created_at)}</p>
        </div>
        <div className="seller-card-actions">
          {sellerActions(status).map((action) => (
            <button key={action.status} type="button" className={`btn btn-sm ${action.tone === "danger" ? "btn-outline-danger" : "btn-primary"}`} disabled={Boolean(saving) || asking?.status === action.status} onClick={() => start(action)}>
              {saving === action.status ? "Saving…" : action.label}
            </button>
          ))}
        </div>
      </div>

      <dl className="seller-facts">
        <div><dt>Legal name</dt><dd>{seller.legal_name || <span className="text-muted">Not added</span>}</dd></div>
        <div><dt>GSTIN</dt><dd>{seller.gstin || <span className="text-muted">{seller.business_address ? "Not registered" : "Not added"}</span>}</dd></div>
        <div><dt>State</dt><dd>{seller.business_state_name || "—"}</dd></div>
        <div>
          <dt>Products</dt>
          <dd>{seller.listed_products_count} approved{hidden && seller.listed_products_count > 0 ? " (hidden)" : ""} · {seller.products_count} total</dd>
        </div>
        <div><dt>Open orders</dt><dd className={seller.open_orders ? "fw-bold" : ""}>{seller.open_orders}</dd></div>
      </dl>
      {seller.business_address && <p className="seller-address">{seller.business_address}</p>}
      {seller.seller_status_note && hidden && (
        <p className="seller-note"><strong>{status === "rejected" ? "Declined" : "Deactivated"} {formatDay(seller.seller_status_at)}:</strong> {seller.seller_status_note}</p>
      )}

      {asking && (
        <form className="seller-reason" onSubmit={(event) => { event.preventDefault(); change(asking); }}>
          <label htmlFor={`seller-reason-${seller.id}`} className="form-label">{asking.reason} <span className="text-muted fw-normal">The seller sees this.</span></label>
          <textarea id={`seller-reason-${seller.id}`} className={`form-control${reasonError ? " is-invalid" : ""}`} rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} autoFocus required />
          {reasonError && <div className="invalid-feedback">{reasonError}</div>}
          {asking.status === "deactivated" && (
            <p className="seller-reason-help">
              Their products leave the store at once and they can’t change products or orders. They can still sign in to see their orders, earnings and invoices.
              {seller.open_orders > 0 && <strong> They have {seller.open_orders} open {seller.open_orders === 1 ? "order" : "orders"} — deactivating doesn’t cancel {seller.open_orders === 1 ? "it" : "them"}; you can manage {seller.open_orders === 1 ? "it" : "them"} from Orders.</strong>}
            </p>
          )}
          <div className="d-flex gap-2 mt-2">
            <button type="submit" className="btn btn-danger btn-sm" disabled={Boolean(saving)}>{saving ? "Saving…" : asking.label}</button>
            <button type="button" className="btn btn-link btn-sm" onClick={() => { setAsking(null); setReasonError(""); }}>Cancel</button>
          </div>
        </form>
      )}

      {seller.pending_category_requests > 0 && (
        <Link to="/admin/category-requests" className="seller-card-link me-3">
          Asked for {seller.pending_category_requests} new {seller.pending_category_requests === 1 ? "category" : "categories"} →
        </Link>
      )}
      {(status === "approved" || status === "deactivated") && <Link to={`/admin/commissions/${seller.id}`} className="seller-card-link">Commission & payouts →</Link>}
    </li>
  );
};

export default ManageSellers;
