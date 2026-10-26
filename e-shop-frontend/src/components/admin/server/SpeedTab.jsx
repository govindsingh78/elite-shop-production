import React, { useCallback, useEffect, useState } from "react";
import { formatMs, serverRequest } from "./server";

const PERIODS = [
  { days: 1, label: "Last 24 hours" },
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
];

/** How fast pages load for real visitors, and how long each API call takes, with the likely cause of slow ones. */
const SpeedTab = () => {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await serverRequest(`/admin/server/speed?days=${days}`));
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <p className="text-muted mb-0">Measured from real visits. Slow ones come with the likely cause.</p>
        <select className="form-select w-auto" aria-label="Period" value={days} onChange={(event) => setDays(Number(event.target.value))}>
          {PERIODS.map((period) => <option key={period.days} value={period.days}>{period.label}</option>)}
        </select>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {!data && !error && <p className="text-muted" role="status">Loading speed figures…</p>}

      {data && (
        <>
          <section className="customer-panel">
            <header className="customer-panel-header">
              <div>
                <h2>Website pages</h2>
                <p>How long visitors wait for a page’s main content (photo or heading) on their first visit. Under 2.5 s is good; over 4 s loses shoppers.</p>
              </div>
            </header>
            {data.pages.length ? (
              <div className="table-responsive">
                <table className="table align-middle srv-table">
                  <thead><tr><th>Page</th><th>Visits</th><th>Main content</th><th>Fast</th><th>Slow</th><th>Server answer</th></tr></thead>
                  <tbody>
                    {data.pages.map((page) => (
                      <React.Fragment key={page.page}>
                        <tr className={page.poor_share >= 25 ? "is-slow" : ""}>
                          <td><strong>{page.label || page.page}</strong>{page.label && <small>{page.page}</small>}<small>{page.mobile_share}% on phones</small></td>
                          <td>{page.hits.toLocaleString("en-IN")}</td>
                          <td className="fw-bold">{formatMs(page.avg_lcp)}</td>
                          <td className="text-success">{page.good_share}%</td>
                          <td className={page.poor_share >= 25 ? "text-danger fw-bold" : ""}>{page.poor_share}%</td>
                          <td>{formatMs(page.avg_ttfb)}</td>
                        </tr>
                        {page.tip && <tr className="srv-tip-row"><td colSpan={6}>💡 {page.tip}</td></tr>}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-muted mb-0">No page loads recorded yet. They appear as visitors browse the website.</p>}
          </section>

          <section className="customer-panel mt-4">
            <header className="customer-panel-header">
              <div>
                <h2>Server answers (API)</h2>
                <p>Every page and app screen asks the server for its data. Under 0.6 s is quick; a call over {formatMs(data.slow_ms)} counts as slow.</p>
              </div>
            </header>
            {data.routes.length ? (
              <div className="table-responsive">
                <table className="table align-middle srv-table">
                  <thead><tr><th>What</th><th>Calls</th><th>Average</th><th>Slowest</th><th>Slow</th><th>Errors</th><th>Queries</th></tr></thead>
                  <tbody>
                    {data.routes.map((route) => (
                      <React.Fragment key={route.route}>
                        <tr className={route.avg_ms >= data.slow_ms ? "is-slow" : ""}>
                          <td><strong>{route.label || route.route}</strong>{route.label && <small>{route.route}</small>}</td>
                          <td>{route.hits.toLocaleString("en-IN")}</td>
                          <td className="fw-bold">{formatMs(route.avg_ms)}</td>
                          <td>{formatMs(route.max_ms)}</td>
                          <td>{route.slow_share}%</td>
                          <td className={route.error_hits ? "text-danger fw-bold" : ""}>{route.error_hits}</td>
                          <td title="Database queries per call">{route.avg_queries}</td>
                        </tr>
                        {route.tip && <tr className="srv-tip-row"><td colSpan={7}>💡 {route.tip}</td></tr>}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-muted mb-0">Nothing recorded for this period yet.</p>}
          </section>
        </>
      )}
    </>
  );
};

export default SpeedTab;
