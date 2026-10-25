import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { formatPrice } from "../../common/currency";
import { EarningsTiles, HowItWorks, PendingNote, RateBadge } from "./CommissionBits";
import { commissionRequest } from "./commissions";

/** Admin: every seller's sales, Elitezaar's commission, and what's owed to them. */
const ManageCommissions = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [rate, setRate] = useState("");
  const [rateError, setRateError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await commissionRequest("admin", "/admin/commissions");
      setData(result);
      setRate(String(result.default_rate));
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveRate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setRateError("");
    try {
      const result = await commissionRequest("admin", "/admin/commissions/settings", { method: "PUT", body: { default_rate: rate } });
      toast.success(result.message);
      await load();
    } catch (requestError) {
      setRateError(requestError.message);
    } finally {
      setSaving(false);
    }
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
                <h1>Commissions<span>.</span></h1>
                <p>What sellers have sold, Elitezaar’s share, and what you owe them.</p>
              </div>
            </section>

            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            <EarningsTiles figures={data?.totals} all />
            <PendingNote figures={data?.totals} />

            <section className="customer-panel mt-3">
              <header className="customer-panel-header"><div><h2>Sellers</h2><p>Sellers you owe the most are listed first.</p></div></header>
              <div className="table-responsive">
                <table className="table align-middle commission-table">
                  <thead><tr><th>Seller</th><th>Rate</th><th>Delivered sales</th><th>Commission</th><th>Paid</th><th>Owed</th><th><span className="visually-hidden">Manage</span></th></tr></thead>
                  <tbody>
                    {!data && !error && <tr><td colSpan={7} className="text-muted py-4" role="status">Loading sellers…</td></tr>}
                    {data && (data.sellers.length ? data.sellers.map((seller) => (
                      <tr key={seller.id}>
                        <td><Link to={`/admin/commissions/${seller.id}`} className="commission-seller-link">{seller.name}</Link><small className="d-block text-muted">{seller.email}</small></td>
                        <td><RateBadge seller={seller} defaultRate={data.default_rate} /></td>
                        <td className="text-nowrap">{formatPrice(seller.sales)}{seller.pending_sales > 0 && <small className="d-block text-muted">+{formatPrice(seller.pending_sales)} pending</small>}</td>
                        <td className="text-nowrap">{formatPrice(seller.commission)}</td>
                        <td className="text-nowrap">{formatPrice(seller.paid)}</td>
                        <td className={`text-nowrap fw-bold${seller.balance > 0 ? " commission-owed" : ""}`}>{formatPrice(seller.balance)}</td>
                        <td className="text-end"><Link to={`/admin/commissions/${seller.id}`} className="btn btn-outline-primary btn-sm text-nowrap">Manage →</Link></td>
                      </tr>
                    )) : <tr><td colSpan={7} className="text-center text-muted py-4">No sellers yet. Sellers who sign up appear here.</td></tr>)}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="customer-panel mt-4 commission-settings">
              <div>
                <header className="customer-panel-header"><div><h2>Default commission</h2><p>For sellers without their own rate.</p></div></header>
                <form onSubmit={saveRate} className="commission-rate-form">
                  <label htmlFor="default-rate" className="form-label">Commission on each sale</label>
                  <div className="input-group">
                    <input id="default-rate" type="number" min="0" max="100" step="0.01" className={`form-control${rateError ? " is-invalid" : ""}`} value={rate} onChange={(event) => setRate(event.target.value)} required />
                    <span className="input-group-text">%</span>
                    <button type="submit" className="btn btn-primary" disabled={saving || !data}>{saving ? "Saving…" : "Save"}</button>
                    {rateError && <div className="invalid-feedback">{rateError}</div>}
                  </div>
                </form>
              </div>
              <HowItWorks />
            </section>
          </main>
        </div>
      </div>
    </Layout>
  );
};

export default ManageCommissions;
