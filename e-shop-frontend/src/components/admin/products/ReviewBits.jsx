import React, { useState } from "react";
import { APPROVAL, reviewProduct } from "./review";

export const ApprovalBadge = ({ status }) => {
  const config = APPROVAL[status] || APPROVAL.approved;
  return <span className={`badge ${config.badge}`}>{config.label}</span>;
};

const PANEL_COPY = {
  pending: "Hidden from shoppers until you approve it. Check the details and photos below first.",
  approved: "Approved and visible in the store while it is Active. Reject it to take it down.",
  rejected: "Sent back to the seller with your note. Approve it if it is fine after all.",
};

/** Approve / reject box shown to admins on a seller's product. */
export const ReviewPanel = ({ product, onReviewed }) => {
  const [note, setNote] = useState(product.approval_status === "rejected" ? product.review_note || "" : "");
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  const submit = async (decision) => {
    setSaving(decision);
    setError("");
    try {
      onReviewed(await reviewProduct(product.id, decision, note));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving("");
    }
  };

  return (
    <section className={`product-review-panel is-${product.approval_status}`} aria-label="Listing review">
      <div className="product-review-head">
        <span className="product-review-eyebrow">Seller listing</span>
        <h3>{product.vendor?.name || "Store listing"} <ApprovalBadge status={product.approval_status} /></h3>
        <p>{PANEL_COPY[product.approval_status] || PANEL_COPY.approved}</p>
      </div>
      <label htmlFor="review-note" className="form-label">Note to the seller <span className="text-muted fw-normal">(required to reject)</span></label>
      <textarea id="review-note" className={`form-control ${error ? "is-invalid" : ""}`} rows="2" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Please add a clear front photo and the fabric details." />
      {error && <div className="invalid-feedback">{error}</div>}
      <div className="d-flex flex-wrap gap-2 mt-3">
        {product.approval_status !== "approved" && (
          <button type="button" className="btn btn-success" disabled={!!saving} onClick={() => submit("approved")}>{saving === "approved" ? "Approving..." : "Approve"}</button>
        )}
        {product.approval_status !== "rejected" && (
          <button type="button" className="btn btn-outline-danger" disabled={!!saving} onClick={() => submit("rejected")}>{saving === "rejected" ? "Rejecting..." : "Reject"}</button>
        )}
        {product.approval_status === "rejected" && (
          <button type="button" className="btn btn-outline-secondary" disabled={!!saving} onClick={() => submit("rejected")}>{saving === "rejected" ? "Saving..." : "Update note"}</button>
        )}
      </div>
    </section>
  );
};

/** What a seller sees above their product form. `status` is "new" while creating. */
export const SellerReviewNotice = ({ status, note }) => {
  if (status === "new") {
    return <div className="alert alert-info" role="note">New listings are checked by the Elitezaar team before they appear in the store. You’ll see the status under <strong>My Products</strong>.</div>;
  }
  if (status === "pending") {
    return <div className="alert alert-warning" role="status"><strong>In review.</strong> Shoppers can’t see this listing until our team approves it.</div>;
  }
  if (status === "rejected") {
    return (
      <div className="alert alert-danger" role="alert">
        <strong>Changes needed.</strong> {note || "Our team asked for changes to this listing."}
        <div className="small mt-1">Update the listing and save to send it for review again.</div>
      </div>
    );
  }
  return <div className="alert alert-light border small" role="note">Approved listing. Changing the title, descriptions, category, brand or photos sends it back for a quick review; price and stock changes apply straight away.</div>;
};
