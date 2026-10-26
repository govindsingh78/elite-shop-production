import React from "react";
import { Link } from "react-router-dom";
import { SUPPORT_PHONES } from "../../common/support";
import { SELLER_STATUSES } from "./sellers";

export const SellerStatusBadge = ({ status }) => (
  <span className={`seller-status is-${status}`}>{SELLER_STATUSES[status]?.label || status}</span>
);

/** On the product form: why this seller can't save products right now. */
export const SellerRestriction = ({ message }) => (
  <div className="alert alert-warning d-flex flex-wrap justify-content-between align-items-center gap-2" role="status">
    <span>{message}</span>
    <Link to="/vendor/dashboard" className="alert-link text-nowrap">Your seller hub →</Link>
  </div>
);

const ICONS = {
  pending: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  rejected: <><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></>,
  deactivated: <><circle cx="12" cy="12" r="9" /><path d="M6 6l12 12" /></>,
};

/** On the seller's dashboard: where their account stands, while it isn't approved. */
export const SellerAccountBanner = ({ account }) => {
  if (!account || account.can_sell) return null;
  const { status, note } = account;
  const reason = note ? `Reason: ${note.replace(/[.\s]+$/, "")}. ` : "";
  const copy = {
    pending: {
      title: "Your seller account is waiting for approval",
      text: account.business_details_added
        ? "Thanks for adding your business details. We’ll email you as soon as our team approves your account — then you can list products."
        : "Add your business and GST details so our team can verify you. We’ll email you once you’re approved — then you can list products.",
    },
    rejected: { title: "Your seller application wasn’t approved", text: `${reason}Call us if you have questions or want us to look again.` },
    deactivated: {
      title: "Your seller account is deactivated",
      text: `${reason}Your products are hidden from the store and you can’t change products or orders. You can still see your orders, earnings and invoices.`,
    },
  }[status];
  if (!copy) return null;

  const body = (
    <>
      <span className="review-callout-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[status]}</svg></span>
      <span className="review-callout-text"><strong>{copy.title}</strong><small>{copy.text}</small></span>
    </>
  );

  return status === "pending" ? (
    <Link to="/vendor/business" className="review-callout seller-account-callout" role="status">
      {body}
      <span className="review-callout-cta">{account.business_details_added ? "Review details" : "Add details"} <span aria-hidden="true">→</span></span>
    </Link>
  ) : (
    <div className="review-callout is-rejected seller-account-callout" role="status">
      {body}
      <a className="review-callout-cta" href={`tel:${SUPPORT_PHONES[0].tel}`}>Call {SUPPORT_PHONES[0].label}</a>
    </div>
  );
};
