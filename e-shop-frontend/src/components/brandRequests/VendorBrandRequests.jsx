import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Layout from "../common/Layout";
import Sidebar from "../common/Sidebar";
import { commissionRequest, formatDay } from "../admin/commissions/commissions";
import { RequestStatusBadge } from "../categoryRequests/CategoryRequestBits";
import { BrandRequestFields } from "./BrandRequestFields";
import { brandRequestPayload, emptyBrandRequest } from "./brandRequests";

/** Seller: ask for a brand the store doesn't have yet, and see what our team said. */
const VendorBrandRequests = () => {
  const [requests, setRequests] = useState(null);
  const [maxPending, setMaxPending] = useState(5);
  const [draft, setDraft] = useState(emptyBrandRequest);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    commissionRequest("vendor", "/vendor/brand-requests")
      .then((data) => {
        setRequests(data.requests);
        setMaxPending(data.max_pending);
      })
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  const waiting = (requests || []).filter((request) => request.status === "pending").length;

  const send = async (event) => {
    event.preventDefault();
    setSending(true);
    setErrors({});
    try {
      const result = await commissionRequest("vendor", "/vendor/brand-requests", { method: "POST", body: brandRequestPayload(draft) });
      toast.success(result.message);
      setRequests((current) => [result.request, ...(current || [])]);
      setDraft(emptyBrandRequest());
    } catch (requestError) {
      setErrors(requestError.fieldErrors && Object.keys(requestError.fieldErrors).length ? requestError.fieldErrors : { name: requestError.message });
    } finally {
      setSending(false);
    }
  };

  const withdraw = async (request) => {
    if (!window.confirm(`Withdraw your request for “${request.name}”?`)) return;
    try {
      const result = await commissionRequest("vendor", `/vendor/brand-requests/${request.id}`, { method: "DELETE" });
      toast.success(result.message);
      setRequests((current) => current.filter((item) => item.id !== request.id));
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex admin-dashboard-layout">
          <Sidebar variant="vendor" />
          <main className="container-fluid admin-dashboard-content customer-content">
            <section className="customer-hero">
              <div>
                <span className="customer-eyebrow customer-eyebrow--light">YOUR CATALOGUE</span>
                <h1>Brand requests<span>.</span></h1>
                <p>Can’t find your brand when you list a product? Ask us to add it, and we’ll let you know as soon as it’s ready.</p>
              </div>
            </section>

            <section className="customer-panel mb-4">
              <header className="customer-panel-header"><div><h2>Ask for a brand</h2><p>Write the name the way the brand writes it.</p></div></header>
              {waiting >= maxPending ? (
                <p className="text-muted mb-0">You have {maxPending} requests waiting. We’ll get to them soon, and you can ask for more once they’re answered.</p>
              ) : (
                <form onSubmit={send}>
                  <BrandRequestFields id="vendor-brand-request" value={draft} errors={errors} onChange={(next) => { setDraft(next); setErrors({}); }} />
                  <button type="submit" className="btn btn-primary mt-3" disabled={sending || !draft.name.trim()}>{sending ? "Sending…" : "Send request"}</button>
                </form>
              )}
            </section>

            <section className="customer-panel">
              <header className="customer-panel-header"><div><h2>Your requests</h2><p>Newest first.</p></div></header>
              {error && <div className="alert alert-danger" role="alert">{error}</div>}
              {!requests && !error && <p className="text-muted mb-0" role="status">Loading your requests…</p>}
              {requests && !requests.length && <p className="text-muted mb-0">You haven’t asked for any brands yet.</p>}
              {requests && requests.length > 0 && (
                <ul className="category-ask-list">
                  {requests.map((request) => (
                    <li key={request.id}>
                      <div className="category-ask-list-head">
                        <strong>{request.name}</strong>
                        <RequestStatusBadge status={request.status} />
                      </div>
                      {request.note && <p className="category-ask-list-note">“{request.note}”</p>}
                      <p className="category-ask-list-meta">
                        Asked {formatDay(request.created_at)}
                        {request.status === "approved" && request.brand && <> · Added as <strong>{request.brand.name}</strong> on {formatDay(request.reviewed_at)}. <Link to="/vendor/products/create">List a product →</Link></>}
                        {request.status === "declined" && <> · Not added{request.admin_note ? `: ${request.admin_note}` : "."}</>}
                      </p>
                      {request.status === "pending" && <button type="button" className="btn btn-link btn-sm px-0 text-danger" onClick={() => withdraw(request)}>Withdraw</button>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </main>
        </div>
      </div>
    </Layout>
  );
};

export default VendorBrandRequests;
