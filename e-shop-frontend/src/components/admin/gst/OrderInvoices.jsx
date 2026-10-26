import React, { useState } from "react";
import { toast } from "react-toastify";
import { formatPrice } from "../../common/currency";
import { gstRequest, invoiceUrl } from "./gst";

/**
 * An order's invoices on the admin and seller order pages. Admins can issue them early, e.g. for orders that
 * shipped before invoices existed.
 */
const OrderInvoices = ({ portal, order, onChange }) => {
  const [issuing, setIssuing] = useState(false);
  const invoices = order.invoice_links || [];
  const canIssue = portal === "admin" && !["pending", "cancelled"].includes(order.status);

  const issue = async () => {
    setIssuing(true);
    try {
      const data = await gstRequest("admin", `/admin/orders/${order.id}/invoices`, { method: "POST" });
      onChange(data.invoice_links);
      toast.success(data.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIssuing(false);
    }
  };

  return (
    <section className="card shadow-sm mt-4">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Invoices</h5>
        {Number(order.tax_total) > 0 && <span className="small text-muted">GST on order: {formatPrice(order.tax_total)}</span>}
      </div>
      <div className="card-body">
        {invoices.length ? (
          <ul className="order-invoices">
            {invoices.map((invoice) => (
              <li key={invoice.id}>
                <div>
                  <strong>{invoice.number}</strong>
                  <small>{invoice.supplier_name} · {invoice.type === "tax_invoice" ? `GST ${formatPrice(invoice.tax_total)}` : "Bill of supply"}{invoice.status === "cancelled" ? " · Cancelled" : ""}</small>
                </div>
                <a href={invoiceUrl(invoice)} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary">View / print</a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted small mb-0">
            Issued automatically when the order ships{portal === "vendor" ? ", one for your items." : ": one per seller, and one from Elitezaar for its own products and delivery."}
          </p>
        )}
        {canIssue && !invoices.length && (
          <button type="button" className="btn btn-sm btn-outline-secondary mt-3" onClick={issue} disabled={issuing}>{issuing ? "Issuing…" : "Issue invoices now"}</button>
        )}
      </div>
    </section>
  );
};

export default OrderInvoices;
