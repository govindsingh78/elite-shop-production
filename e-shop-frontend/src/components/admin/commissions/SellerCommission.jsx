import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { formatPrice } from "../../common/currency";
import { EarningsTiles, PayoutsTable, PendingNote, RateBadge, SoldItemsTable } from "./CommissionBits";
import { PAYOUT_METHODS, commissionRequest, formatRate, today } from "./commissions";

const EMPTY_PAYOUT = { amount: "", paid_on: today(), method: "upi", reference: "", note: "" };

/** Admin: one seller's rate, sales and payouts, and recording a new payout. */
const SellerCommission = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [rate, setRate] = useState("");
  const [rateError, setRateError] = useState("");
  const [payout, setPayout] = useState(EMPTY_PAYOUT);
  const [payoutErrors, setPayoutErrors] = useState({});
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await commissionRequest("admin", `/admin/commissions/sellers/${id}?page=${page}`);
      setData(result);
      setRate(result.seller.commission_rate === null ? "" : String(result.seller.commission_rate));
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [id, page]);

  useEffect(() => { load(); }, [load]);

  const seller = data?.seller;

  const saveRate = async (value) => {
    setBusy("rate");
    setRateError("");
    try {
      const result = await commissionRequest("admin", `/admin/commissions/sellers/${id}`, { method: "PUT", body: { commission_rate: value } });
      toast.success(result.message);
      await load();
    } catch (requestError) {
      setRateError(requestError.message);
    } finally {
      setBusy("");
    }
  };

  const changePayout = (event) => {
    const { name, value } = event.target;
    setPayout((current) => ({ ...current, [name]: value }));
    setPayoutErrors((current) => ({ ...current, [name]: undefined }));
  };

  const recordPayout = async (event) => {
    event.preventDefault();
    setBusy("payout");
    setPayoutErrors({});
    try {
      const result = await commissionRequest("admin", `/admin/commissions/sellers/${id}/payouts`, { method: "POST", body: payout });
      toast.success(`${result.message} ${formatPrice(result.payout.amount)} paid to ${seller.name}.`);
      setPayout(EMPTY_PAYOUT);
      await load();
    } catch (requestError) {
      setPayoutErrors(Object.keys(requestError.fieldErrors || {}).length ? requestError.fieldErrors : { general: requestError.message });
    } finally {
      setBusy("");
    }
  };

  const removePayout = async (item) => {
    if (!window.confirm(`Remove the ${formatPrice(item.amount)} payout? The amount will be owed to the seller again.`)) return;
    try {
      const result = await commissionRequest("admin", `/admin/commissions/payouts/${item.id}`, { method: "DELETE" });
      toast.success(result.message);
      await load();
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  const field = (name) => ({ id: `payout-${name}`, name, value: payout[name], onChange: changePayout, className: `form-control${payoutErrors[name] ? " is-invalid" : ""}` });

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex admin-dashboard-layout">
          <Sidebar />
          <main className="container-fluid admin-dashboard-content customer-content">
            <Link to="/admin/commissions" className="commission-back">← All sellers</Link>
            <section className="customer-hero">
              <div>
                <span className="customer-eyebrow customer-eyebrow--light">SELLER COMMISSION</span>
                <h1>{seller?.name || "Seller"}<span>.</span></h1>
                <p>{seller ? <>{seller.email} · Commission <RateBadge seller={seller} defaultRate={data.default_rate} /></> : "Loading…"}</p>
              </div>
            </section>

            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            <EarningsTiles figures={seller} />
            <PendingNote figures={seller} />

            {seller && (
              <div className="row g-4 mt-1">
                <div className="col-xl-5">
                  <section className="customer-panel">
                    <header className="customer-panel-header"><div><h2>Record a payout</h2><p>After you’ve sent the money by UPI or bank transfer.</p></div></header>
                    <form onSubmit={recordPayout} noValidate>
                      {payoutErrors.general && <div className="alert alert-danger py-2" role="alert">{payoutErrors.general}</div>}
                      <div className="row g-3">
                        <div className="col-sm-6">
                          <label htmlFor="payout-amount" className="form-label">Amount (₹)</label>
                          <input {...field("amount")} type="number" min="0.01" step="0.01" placeholder={seller.balance > 0 ? seller.balance.toFixed(2) : "0.00"} required />
                          {seller.balance > 0 && !payout.amount && <button type="button" className="btn btn-link btn-sm px-0" onClick={() => setPayout((current) => ({ ...current, amount: seller.balance.toFixed(2) }))}>Pay full balance ({formatPrice(seller.balance)})</button>}
                          {payoutErrors.amount && <div className="invalid-feedback">{payoutErrors.amount}</div>}
                        </div>
                        <div className="col-sm-6">
                          <label htmlFor="payout-paid_on" className="form-label">Paid on</label>
                          <input {...field("paid_on")} type="date" max={today()} />
                          {payoutErrors.paid_on && <div className="invalid-feedback">{payoutErrors.paid_on}</div>}
                        </div>
                        <div className="col-sm-6">
                          <label htmlFor="payout-method" className="form-label">Method</label>
                          <select {...field("method")} className="form-select">
                            {Object.entries(PAYOUT_METHODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </div>
                        <div className="col-sm-6">
                          <label htmlFor="payout-reference" className="form-label">Reference <small className="text-muted">(optional)</small></label>
                          <input {...field("reference")} maxLength={120} placeholder="UPI or bank reference" />
                        </div>
                        <div className="col-12">
                          <label htmlFor="payout-note" className="form-label">Note <small className="text-muted">(optional)</small></label>
                          <input {...field("note")} maxLength={500} placeholder="e.g. October sales" />
                        </div>
                      </div>
                      <button type="submit" className="btn btn-primary mt-3" disabled={busy === "payout" || seller.balance <= 0}>{busy === "payout" ? "Recording…" : "Record payout"}</button>
                      {seller.balance <= 0 && <p className="form-text mb-0">Nothing is owed to this seller right now.</p>}
                    </form>
                  </section>

                  <section className="customer-panel mt-4">
                    <header className="customer-panel-header"><div><h2>Commission rate</h2><p>Applies to this seller’s new orders.</p></div></header>
                    <form onSubmit={(event) => { event.preventDefault(); saveRate(rate === "" ? null : rate); }} className="commission-rate-form">
                      <label htmlFor="seller-rate" className="form-label">Custom rate <small className="text-muted">(leave empty for the {formatRate(data.default_rate)} default)</small></label>
                      <div className="input-group">
                        <input id="seller-rate" type="number" min="0" max="100" step="0.01" className={`form-control${rateError ? " is-invalid" : ""}`} value={rate} onChange={(event) => setRate(event.target.value)} placeholder={String(data.default_rate)} />
                        <span className="input-group-text">%</span>
                        <button type="submit" className="btn btn-primary" disabled={busy === "rate"}>Save</button>
                        {rateError && <div className="invalid-feedback">{rateError}</div>}
                      </div>
                      {seller.commission_rate !== null && <button type="button" className="btn btn-link btn-sm px-0 mt-1" onClick={() => saveRate(null)} disabled={busy === "rate"}>Use the default rate instead</button>}
                    </form>
                  </section>
                </div>

                <div className="col-xl-7">
                  <section className="customer-panel">
                    <header className="customer-panel-header"><div><h2>Payouts</h2><p>Money you’ve sent this seller.</p></div></header>
                    <PayoutsTable payouts={data.payouts} onRemove={removePayout} />
                  </section>
                </div>
              </div>
            )}
            {seller && (
              <section className="customer-panel mt-4">
                <header className="customer-panel-header"><div><h2>Sales</h2><p>Every product this seller sold, newest first.</p></div></header>
                <SoldItemsTable page={data.items} onPage={setPage} orderLink={(orderId) => `/admin/manage-orders/${orderId}`} />
              </section>
            )}
          </main>
        </div>
      </div>
    </Layout>
  );
};

export default SellerCommission;
