import React, { useEffect, useState } from "react";
import Layout from "../../common/Layout";
import VendorSidebar from "../VendorSidebar";
import { EarningsTiles, HowItWorks, PayoutsTable, PendingNote, SoldItemsTable } from "./CommissionBits";
import { commissionRequest, formatRate } from "./commissions";

/** Seller hub: what the seller earned, Elitezaar's commission, payouts received and what's still due. */
const VendorEarnings = () => {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    commissionRequest("vendor", `/vendor/earnings?page=${page}`)
      .then((result) => active && setData(result))
      .catch((requestError) => active && setError(requestError.message));
    return () => { active = false; };
  }, [page]);

  const summary = data?.summary;

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex admin-dashboard-layout">
          <VendorSidebar />
          <main className="container-fluid admin-dashboard-content customer-content">
            <section className="customer-hero">
              <div>
                <span className="customer-eyebrow customer-eyebrow--light">SELLER WORKSPACE</span>
                <h1>Earnings<span>.</span></h1>
                <p>{summary ? `Elitezaar’s commission on your sales is ${formatRate(summary.effective_rate)}. Here’s what you’ve earned and been paid.` : "Loading your earnings…"}</p>
              </div>
            </section>

            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            <EarningsTiles figures={summary} perspective="seller" />
            <PendingNote figures={summary} perspective="seller" />

            <div className="row g-4 mt-1">
              <div className="col-xl-4">
                <section className="customer-panel">
                  <header className="customer-panel-header"><div><h2>How earnings work</h2></div></header>
                  <HowItWorks perspective="seller" />
                  <p className="commission-help">Questions about a payout? Call seller support or email support@elitezaar.com.</p>
                </section>
              </div>
              <div className="col-xl-8">
                <section className="customer-panel">
                  <header className="customer-panel-header"><div><h2>Payouts received</h2><p>Money Elitezaar has sent you.</p></div></header>
                  {data && <PayoutsTable payouts={data.payouts} perspective="seller" />}
                </section>
              </div>
            </div>

            <section className="customer-panel mt-4">
              <header className="customer-panel-header"><div><h2>Your sales</h2><p>Every product you’ve sold, with the commission and your earning on each.</p></div></header>
              {data && <SoldItemsTable page={data.items} onPage={setPage} orderLink={(orderId) => `/vendor/orders/${orderId}`} />}
            </section>
          </main>
        </div>
      </div>
    </Layout>
  );
};

export default VendorEarnings;
