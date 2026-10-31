import React, { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import Layout from "../common/Layout";
import Sidebar from "../common/Sidebar";
import { commissionRequest, formatDay } from "../admin/commissions/commissions";
import { SellerStatusBadge } from "../admin/sellers/SellerBits";
import { RequestStatusBadge } from "../categoryRequests/CategoryRequestBits";
import { REQUEST_STATUSES, REQUEST_TABS } from "../categoryRequests/categoryRequests";

/** Admin: brands sellers asked for. Add them (as asked, renamed, or as one already in the store) or decline. */
const ManageBrandRequests = () => {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({ status: searchParams.get("status") || "pending", page: 1 });
  const [data, setData] = useState(null);
  const [brands, setBrands] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await commissionRequest("admin", `/admin/brand-requests?status=${filters.status}&page=${filters.page}`));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  // Every brand, for pointing a seller to one that already exists.
  const loadBrands = useCallback(() => {
    commissionRequest("admin", "/brands").then((list) => setBrands(Array.isArray(list) ? list : [])).catch(() => {});
  }, []);
  useEffect(() => { loadBrands(); }, [loadBrands]);

  const onAnswered = (result, request) => {
    toast.success(result.message);
    loadBrands();
    // Sellers waiting on the same brand were answered too.
    if (request.also_waiting > 0) {
      load();
      return;
    }
    setData((current) => ({ ...current, counts: result.counts, data: current.data.map((item) => (item.id === result.request.id ? result.request : item)) }));
  };

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex admin-dashboard-layout">
          <Sidebar />
          <main className="container-fluid admin-dashboard-content customer-content">
            <section className="customer-hero">
              <div>
                <span className="customer-eyebrow customer-eyebrow--light">CATALOGUE</span>
                <h1>Brand requests<span>.</span></h1>
                <p>Brands sellers asked for. Add one and every seller who asked can list under it straight away, or decline with a reason they’ll see.</p>
              </div>
              <Link to="/admin/manage-brands" className="customer-hero-cta">All brands</Link>
            </section>

            <div className="product-review-tabs" role="tablist" aria-label="Request status">
              {REQUEST_TABS.map((tab) => {
                const count = data?.counts?.[tab.key];
                return (
                  <button key={tab.key} type="button" role="tab" aria-selected={filters.status === tab.key} className={`product-review-tab${filters.status === tab.key ? " is-active" : ""}`} onClick={() => setFilters({ status: tab.key, page: 1 })}>
                    {tab.label}{count > 0 && <span>{count}</span>}
                  </button>
                );
              })}
            </div>

            {error && (
              <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
                <span>{error}</span>
                <button type="button" className="btn btn-outline-danger btn-sm" onClick={load}>Try again</button>
              </div>
            )}
            {loading && !data && <p className="text-muted" role="status">Loading requests…</p>}
            {data && (data.data.length ? (
              <ul className="seller-list" aria-busy={loading}>
                {data.data.map((request) => <RequestCard key={request.id} request={request} brands={brands} onAnswered={onAnswered} />)}
              </ul>
            ) : (
              <div className="customer-panel text-center text-muted py-5">
                {filters.status === "pending" ? "No requests waiting — you’re all caught up." : "Nothing here yet."}
              </div>
            ))}

            {data && data.last_page > 1 && (
              <nav className="d-flex justify-content-between align-items-center mt-3" aria-label="Request pages">
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

const RequestCard = ({ request, brands, onAnswered }) => {
  // "add" (as asked, or renamed), "existing" (one already in the store) or "decline".
  const [mode, setMode] = useState(null);
  const [name, setName] = useState(request.name);
  const [existingId, setExistingId] = useState("");
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [saving, setSaving] = useState(false);
  const tone = REQUEST_STATUSES[request.status]?.tone;

  const answer = async (path, body) => {
    setSaving(true);
    setFieldError("");
    try {
      const result = await commissionRequest("admin", `/admin/brand-requests/${request.id}/${path}`, { method: "POST", body });
      setMode(null);
      onAnswered(result, request);
    } catch (requestError) {
      setFieldError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    if (mode === "add") answer("approve", { name: name.trim() });
    if (mode === "existing") answer("approve", { brand_id: Number(existingId) });
    if (mode === "decline") answer("decline", { note: note.trim() });
  };

  const open = (next) => {
    setMode(next);
    setFieldError("");
  };

  return (
    <li className={`seller-card is-${tone}`}>
      <div className="seller-card-head">
        <span className="seller-avatar" aria-hidden="true">{request.name.charAt(0).toUpperCase()}</span>
        <div className="seller-card-title">
          <h2>{request.name} <RequestStatusBadge status={request.status} /></h2>
          <p>
            Asked by {request.seller ? <>{request.seller.name} · {request.seller.email} <SellerStatusBadge status={request.seller.seller_status} /></> : "a seller who has left"} · {formatDay(request.created_at)}
          </p>
        </div>
        {request.status === "pending" && (
          <div className="seller-card-actions">
            <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={() => open("add")}>Add brand</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={saving} onClick={() => open("existing")}>Use an existing one</button>
            <button type="button" className="btn btn-sm btn-outline-danger" disabled={saving} onClick={() => open("decline")}>Decline</button>
          </div>
        )}
      </div>

      {request.note && <p className="seller-address">“{request.note}”</p>}
      {request.also_waiting > 0 && <p className="category-request-also">{request.also_waiting} other {request.also_waiting === 1 ? "seller" : "sellers"} asked for this too. They’ll all get your answer.</p>}
      {request.status === "approved" && request.brand && <p className="category-request-answer">Added as <strong>{request.brand.name}</strong>{request.reviewer ? ` by ${request.reviewer}` : ""} on {formatDay(request.reviewed_at)}.</p>}
      {request.status === "declined" && <p className="seller-note"><strong>Declined{request.reviewer ? ` by ${request.reviewer}` : ""} {formatDay(request.reviewed_at)}:</strong> {request.admin_note}</p>}

      {mode && (
        <form className={mode === "decline" ? "seller-reason" : "category-request-form"} onSubmit={submit}>
          {mode === "add" && (
            <>
              <label htmlFor={`brand-request-name-${request.id}`} className="form-label">Brand name</label>
              <input id={`brand-request-name-${request.id}`} className="form-control" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} required />
              <p className="form-text mb-0">It goes live straight away. Fix the spelling or capitals here if you need to.</p>
            </>
          )}
          {mode === "existing" && (
            <>
              <label htmlFor={`brand-request-existing-${request.id}`} className="form-label">Which brand should they use?</label>
              <select id={`brand-request-existing-${request.id}`} className="form-select" value={existingId} onChange={(event) => setExistingId(event.target.value)} required>
                <option value="">Choose a brand</option>
                {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}{brand.status === 1 ? "" : " (blocked: it will be switched on)"}</option>)}
              </select>
            </>
          )}
          {mode === "decline" && (
            <>
              <label htmlFor={`brand-request-note-${request.id}`} className="form-label">Why aren’t you adding it? <span className="text-muted fw-normal">The seller sees this.</span></label>
              <textarea id={`brand-request-note-${request.id}`} className="form-control" rows={2} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Please share proof that you’re authorised to sell this brand." autoFocus required />
            </>
          )}
          {fieldError && <div className="text-danger small mt-2" role="alert">{fieldError}</div>}
          <div className="d-flex gap-2 mt-3">
            <button type="submit" className={`btn btn-sm ${mode === "decline" ? "btn-danger" : "btn-primary"}`} disabled={saving}>
              {saving ? "Saving…" : mode === "add" ? "Add & tell the seller" : mode === "existing" ? "Use this & tell the seller" : "Decline & tell the seller"}
            </button>
            <button type="button" className="btn btn-link btn-sm" onClick={() => setMode(null)}>Cancel</button>
          </div>
        </form>
      )}
    </li>
  );
};

export default ManageBrandRequests;
