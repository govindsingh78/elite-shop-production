import React from "react";
import { Link } from "react-router-dom";
import { formatPrice } from "../../common/currency";
import OrderStatus from "../../customer/OrderStatus";
import { PAYOUT_METHODS, formatDay, formatRate } from "./commissions";

const ICONS = {
  owed: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 15h2" /></>,
  earned: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>,
  commission: <><path d="M19 5 5 19" /><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /></>,
  paid: <><path d="M20 6 9 17l-5-5" /></>,
};

/**
 * The four headline figures. `perspective` is "admin" (Elitezaar's view of a seller, or all sellers) or
 * "seller" (the seller's own view).
 */
export const EarningsTiles = ({ figures, perspective = "admin", all = false }) => {
  const tiles = perspective === "seller"
    ? [["balance", "Due to you", "violet", ICONS.owed], ["earnings", "Your earnings", "green", ICONS.earned], ["commission", "Elitezaar commission", "amber", ICONS.commission], ["paid", "Paid to you", "teal", ICONS.paid]]
    : [["balance", all ? "Owed to sellers" : "Owed to seller", "violet", ICONS.owed], ["commission", "Your commission", "green", ICONS.commission], ["earnings", all ? "Sellers’ earnings" : "Seller’s earnings", "amber", ICONS.earned], ["paid", all ? "Paid to sellers" : "Paid out", "teal", ICONS.paid]];
  return (
    <div className="row g-3 mb-2">
      {tiles.map(([key, label, accent, icon], index) => (
        <div className="col-6 col-xl-3" key={key}>
          <article className={`customer-stat customer-stat--${accent}`} style={{ "--card-index": index }}>
            <span className="customer-stat-icon"><svg viewBox="0 0 24 24" aria-hidden="true">{icon}</svg></span>
            <p>{label}</p>
            <strong className={key === "balance" && figures?.balance < 0 ? "text-danger" : undefined}>
              {figures ? formatPrice(figures[key]) : <span className="admin-stat-skeleton" aria-label="Loading" />}
            </strong>
          </article>
        </div>
      ))}
    </div>
  );
};

/** "₹900 more on orders not yet delivered." */
export const PendingNote = ({ figures, perspective = "admin" }) => (figures?.pending_earnings > 0 ? (
  <p className="commission-pending">
    <span aria-hidden="true">⏳</span>
    <span>
      {perspective === "seller"
        ? <><strong>{formatPrice(figures.pending_earnings)}</strong> more will be due to you once your current orders are delivered.</>
        : <><strong>{formatPrice(figures.pending_earnings)}</strong> more becomes payable to sellers once orders on the way are delivered.</>}
    </span>
  </p>
) : null);

export const RateBadge = ({ seller, defaultRate }) => (
  seller.commission_rate === null
    ? <span className="commission-rate">{formatRate(defaultRate ?? seller.effective_rate)} <small>default</small></span>
    : <span className="commission-rate is-custom">{formatRate(seller.commission_rate)} <small>custom</small></span>
);

export const PayoutsTable = ({ payouts, onRemove, perspective = "admin" }) => (
  <div className="table-responsive">
    <table className="table align-middle commission-table">
      <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>Note</th>{onRemove && <th><span className="visually-hidden">Actions</span></th>}</tr></thead>
      <tbody>
        {payouts.length ? payouts.map((payout) => (
          <tr key={payout.id}>
            <td className="text-nowrap">{formatDay(payout.paid_on)}</td>
            <td className="fw-bold text-nowrap">{formatPrice(payout.amount)}</td>
            <td>{PAYOUT_METHODS[payout.method] || "—"}</td>
            <td className="text-break">{payout.reference || "—"}</td>
            <td className="text-break">{payout.note || "—"}</td>
            {onRemove && <td className="text-end"><button type="button" className="btn btn-outline-danger btn-sm" onClick={() => onRemove(payout)}>Remove</button></td>}
          </tr>
        )) : <tr><td colSpan={onRemove ? 6 : 5} className="text-center text-muted py-4">{perspective === "seller" ? "No payouts yet. Payouts appear here once Elitezaar pays you." : "No payouts recorded yet."}</td></tr>}
      </tbody>
    </table>
  </div>
);

/** Every product the seller sold, with Elitezaar's commission and the seller's earning on each. */
export const SoldItemsTable = ({ page, onPage, orderLink }) => (
  <>
    <div className="table-responsive">
      <table className="table align-middle commission-table">
        <thead><tr><th>Order</th><th>Product</th><th>Qty</th><th>Sale</th><th>Rate</th><th>Commission</th><th>Earning</th><th>Status</th></tr></thead>
        <tbody>
          {page?.data?.length ? page.data.map((item) => (
            <tr key={item.id} className={item.order_status === "cancelled" ? "is-cancelled" : undefined}>
              <td className="text-nowrap">{orderLink ? <Link to={orderLink(item.order_id)}>#{item.order_id}</Link> : `#${item.order_id}`}<small className="d-block text-muted">{formatDay(item.ordered_at)}</small></td>
              <td>{item.product_title}{item.sku && <small className="d-block text-muted">SKU {item.sku}</small>}</td>
              <td>{item.quantity}</td>
              <td className="text-nowrap">{formatPrice(item.line_total)}</td>
              <td>{item.commission_rate === null ? "—" : formatRate(item.commission_rate)}</td>
              <td className="text-nowrap">{formatPrice(item.commission_amount)}</td>
              <td className="text-nowrap fw-bold">{formatPrice(item.earning)}</td>
              <td><OrderStatus status={item.order_status} /></td>
            </tr>
          )) : <tr><td colSpan={8} className="text-center text-muted py-4">No sales yet.</td></tr>}
        </tbody>
      </table>
    </div>
    {page && page.last_page > 1 && (
      <nav className="d-flex justify-content-between align-items-center" aria-label="Sales pages">
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page.current_page <= 1} onClick={() => onPage(page.current_page - 1)}>Previous</button>
        <span>Page {page.current_page} of {page.last_page}</span>
        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page.current_page >= page.last_page} onClick={() => onPage(page.current_page + 1)}>Next</button>
      </nav>
    )}
  </>
);

export const HowItWorks = ({ perspective = "admin" }) => (
  <ul className="commission-rules">
    <li>{perspective === "seller" ? "Elitezaar keeps a commission on the price of each product you sell. Delivery charges aren’t included." : "Elitezaar keeps a commission on the price of each product a seller sells. Delivery charges aren’t included."}</li>
    <li>Earnings become payable once an order is delivered. Cancelled orders don’t count.</li>
    <li>{perspective === "seller" ? "Each sale keeps the rate in force when it was ordered." : "Rate changes apply to new orders; each sale keeps the rate in force when it was ordered."}</li>
  </ul>
);
