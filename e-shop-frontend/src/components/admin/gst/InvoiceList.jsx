import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { formatPrice } from "../../common/currency";
import { portalConfig } from "../portal";
import { downloadGstReport, gstRequest, invoiceUrl, thisMonth } from "./gst";

const formatDate = (value) => new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Invoices for the month, with GST totals and the report for filing. Admins see every invoice, sellers theirs. */
const InvoiceList = ({ portal = "admin" }) => {
  const config = portalConfig(portal);
  const isAdmin = portal === "admin";
  const [month, setMonth] = useState(thisMonth);
  const [supplier, setSupplier] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ page: String(page) });
    if (month) query.set("month", month);
    if (search) query.set("search", search);
    if (supplier) query.set("vendor_id", supplier);
    gstRequest(portal, `/invoices?${query}`)
      .then((data) => { if (active) { setResult(data); setError(""); } })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [portal, month, supplier, search, page]);

  const download = async () => {
    if (!month) return;
    setDownloading(true);
    try {
      await downloadGstReport(portal, month);
    } catch (downloadError) {
      toast.error(downloadError.message);
    } finally {
      setDownloading(false);
    }
  };

  const totals = result?.totals;

  return (
    <Layout>
      <div className="container py-5"><div className="d-flex"><Sidebar variant={config.sidebar} /><main className="container-fluid p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
          <div>
            <h2 className="mb-1">{isAdmin ? "GST & invoices" : "Invoices"}</h2>
            <p className="text-muted mb-0">Invoices are issued automatically when an order ships: one per seller, and one from Elitezaar for its own products and delivery.</p>
          </div>
          <div className="d-flex flex-wrap gap-2">
            <Link to={isAdmin ? "/admin/gst" : "/vendor/business"} className="btn btn-outline-secondary">{isAdmin ? "GST settings" : "Business & GST details"}</Link>
            <button type="button" className="btn btn-primary" onClick={download} disabled={downloading || !month}>
              {downloading ? "Preparing…" : "Download GST report (CSV)"}
            </button>
          </div>
        </div>

        <div className="inv-filters">
          <label>
            <span>Month</span>
            <input type="month" className="form-control" value={month} onChange={(event) => { setMonth(event.target.value); setPage(1); }} />
          </label>
          {isAdmin && (
            <label>
              <span>Supplier</span>
              <select className="form-select" value={supplier} onChange={(event) => { setSupplier(event.target.value); setPage(1); }}>
                <option value="">Everyone</option>
                <option value="store">Elitezaar only</option>
              </select>
            </label>
          )}
          <form className="inv-search" onSubmit={(event) => { event.preventDefault(); setSearch(searchInput.trim()); setPage(1); }}>
            <span>Find</span>
            <div className="input-group">
              <input className="form-control" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Invoice or order number" aria-label="Invoice or order number" />
              <button type="submit" className="btn btn-outline-secondary">Search</button>
            </div>
          </form>
        </div>

        {totals && (
          <dl className="inv-totals" aria-label="GST on issued invoices">
            <div><dt>Taxable value</dt><dd>{formatPrice(totals.taxable)}</dd></div>
            <div><dt>CGST</dt><dd>{formatPrice(totals.cgst)}</dd></div>
            <div><dt>SGST</dt><dd>{formatPrice(totals.sgst)}</dd></div>
            <div><dt>IGST</dt><dd>{formatPrice(totals.igst)}</dd></div>
            <div className="is-grand"><dt>Invoiced (incl. GST)</dt><dd>{formatPrice(totals.grand)}</dd></div>
          </dl>
        )}

        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {!result && !error && <p role="status">Loading invoices…</p>}
        {result && (
          <div className="card shadow-sm"><div className="table-responsive">
            <table className="table align-middle mb-0 inv-table">
              <thead><tr><th>Invoice</th><th>Date</th><th>Order</th><th>{isAdmin ? "Supplier" : "Customer"}</th><th className="text-end">Taxable</th><th className="text-end">GST</th><th className="text-end">Total</th><th>Status</th><th /></tr></thead>
              <tbody>
                {result.data.map((invoice) => (
                  <tr key={invoice.id} className={invoice.status === "cancelled" ? "is-cancelled" : ""}>
                    <td><strong>{invoice.number}</strong><small>{invoice.type === "tax_invoice" ? "Tax invoice" : "Bill of supply"}</small></td>
                    <td>{formatDate(invoice.issued_at)}</td>
                    <td>{invoice.order_id ? <Link to={`${isAdmin ? "/admin/manage-orders" : "/vendor/orders"}/${invoice.order_id}`}>#{invoice.order_id}</Link> : "—"}</td>
                    <td>{isAdmin ? invoice.supplier_name : invoice.buyer_name}</td>
                    <td className="text-end">{formatPrice(invoice.taxable_total)}</td>
                    <td className="text-end">{formatPrice(invoice.tax_total)}</td>
                    <td className="text-end"><strong>{formatPrice(invoice.grand_total)}</strong></td>
                    <td><span className={`badge ${invoice.status === "cancelled" ? "text-bg-danger" : "text-bg-success"}`}>{invoice.status === "cancelled" ? "Cancelled" : "Issued"}</span></td>
                    <td className="text-end"><a href={invoiceUrl(invoice)} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary">View</a></td>
                  </tr>
                ))}
                {!result.data.length && (
                  <tr><td colSpan="9" className="text-center text-muted py-5">No invoices {month ? "this month" : "yet"}. They’re issued when orders ship.</td></tr>
                )}
              </tbody>
            </table>
          </div></div>
        )}
        {result && result.last_page > 1 && (
          <div className="d-flex justify-content-between align-items-center mt-3">
            <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Newer</button>
            <span className="text-muted small">Page {result.current_page} of {result.last_page} · {result.total} invoices</span>
            <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page >= result.last_page} onClick={() => setPage(page + 1)}>Older →</button>
          </div>
        )}
      </main></div></div>
    </Layout>
  );
};

export default InvoiceList;
