import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { serverRequest, timeAgo } from "../server/server";

const OUTCOMES = {
  success: { label: "Signed in", tone: "ok" },
  failed: { label: "Wrong password", tone: "warning" },
  blocked: { label: "Turned away", tone: "danger" },
};
const PORTALS = { admin: "Admin", vendor: "Seller", customer: "Shopper" };
const METHODS = { google: "with Google", password_change: "changing password" };
const DURATIONS = [
  { hours: 24, label: "24 hours" },
  { hours: 168, label: "7 days" },
  { hours: 720, label: "30 days" },
  { hours: "", label: "Until I unblock it" },
];

const when = (value) => new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Admin › Security: every sign-in attempt, locked accounts and blocked addresses, and blocking by hand. */
const Security = () => {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  const [blockIp, setBlockIp] = useState("");

  const loadOverview = useCallback(async () => {
    setError("");
    try {
      setOverview(await serverRequest("/admin/security"));
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const unblock = async (block) => {
    if (!window.confirm(`Unblock ${block.value}?`)) return;
    try {
      toast.success((await serverRequest(`/admin/security/blocks/${block.id}`, { method: "DELETE" })).message);
      loadOverview();
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  const stats = overview?.stats;
  const rules = overview?.rules;
  const active = overview?.blocks.filter((block) => block.active) || [];
  const past = overview?.blocks.filter((block) => !block.active) || [];

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex admin-dashboard-layout">
          <Sidebar />
          <main className="container-fluid admin-dashboard-content customer-content srv-page">
            <section className="customer-hero">
              <div>
                <span className="customer-eyebrow customer-eyebrow--light">SECURITY</span>
                <h1>Who’s signing in<span>.</span></h1>
                <p>{rules
                  ? `Every sign-in is logged. ${rules.max_failures} wrong passwords in a row lock an account for ${rules.block_hours} hours (resetting the password unlocks it), and an address making ${rules.ip_max_failures} wrong attempts within an hour can’t sign in for ${rules.block_hours} hours.`
                  : "Every sign-in is logged, and password guessing is blocked automatically."}</p>
              </div>
            </section>

            {error && <div className="alert alert-danger" role="alert">{error}</div>}

            <div className="srv-vitals">
              {[
                ["Wrong passwords", stats?.failed, stats?.failed ? "warning" : "ok", `last 24 hours · ${stats?.failed_addresses ?? "–"} ${stats?.failed_addresses === 1 ? "address" : "addresses"}`],
                ["Turned away", stats?.refused, stats?.refused ? "warning" : "ok", "locked or blocked, last 24 hours"],
                ["Signed in", stats?.succeeded, "ok", "last 24 hours"],
                ["Blocked now", stats?.blocked_now, stats?.blocked_now ? "critical" : "ok", "accounts and addresses"],
              ].map(([label, value, status, note]) => (
                <article key={label} className={`srv-vital is-${status}`}>
                  <span>{label}</span>
                  <strong>{value ?? "–"}</strong>
                  <small>{note}</small>
                </article>
              ))}
            </div>

            <div className="row g-4">
              <div className="col-xl-7">
                <section className="customer-panel">
                  <header className="customer-panel-header"><div><h2>Blocked now</h2><p>Accounts locked for wrong passwords, and blocked addresses.</p></div></header>
                  {!overview ? <p className="text-muted mb-0">Loading…</p> : active.length ? (
                    <ul className="sec-blocks">{active.map((block) => <BlockRow key={block.id} block={block} onUnblock={unblock} />)}</ul>
                  ) : <p className="text-muted mb-0">Nothing is blocked right now.</p>}
                  {past.length > 0 && (
                    <details className="mt-3">
                      <summary>Ended in the last 7 days ({past.length})</summary>
                      <ul className="sec-blocks mt-2">{past.map((block) => <BlockRow key={block.id} block={block} />)}</ul>
                    </details>
                  )}
                </section>
              </div>
              <div className="col-xl-5">
                <BlockForm ip={blockIp} onIp={setBlockIp} yourIp={overview?.your_ip} onBlocked={loadOverview} />
              </div>
            </div>

            <AttemptLog onBlockIp={(ip) => { setBlockIp(ip); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
            <CookieChoices />
          </main>
        </div>
      </div>
    </Layout>
  );
};

const BlockRow = ({ block, onUnblock }) => (
  <li className={block.active ? "" : "is-ended"}>
    <div>
      <strong>{block.value}</strong>
      <span className={`srv-badge is-${block.type === "account" ? "warning" : "danger"}`}>{block.type === "account" ? "Account" : block.scope === "all" ? "Address · whole store" : "Address · sign-in"}</span>
      <small>
        {block.reason}{block.blocked_by ? ` · by ${block.blocked_by}` : ""} · {block.active
          ? (block.blocked_until ? `until ${when(block.blocked_until)}` : "until unblocked")
          : `ended ${block.unblocked_at ? `${timeAgo(block.unblocked_at)} — ${block.unblock_reason}` : timeAgo(block.blocked_until)}`}
      </small>
    </div>
    {block.active && onUnblock && <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onUnblock(block)}>Unblock</button>}
  </li>
);

/** Blocks an IP address by hand: from the whole store (the API turns it away) or just from signing in. */
const BlockForm = ({ ip, onIp, yourIp, onBlocked }) => {
  const [form, setForm] = useState({ hours: 24, scope: "all", reason: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await serverRequest("/admin/security/blocks", { method: "POST", body: { ip: ip.trim(), hours: form.hours || null, scope: form.scope, reason: form.reason || null } });
      toast.success(result.message);
      onIp("");
      setForm((current) => ({ ...current, reason: "" }));
      onBlocked();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="customer-panel">
      <header className="customer-panel-header"><div><h2>Block an address</h2><p>For someone attacking or scraping the store. Pick an address from the log below.</p></div></header>
      <form onSubmit={submit} className="sec-block-form">
        <label htmlFor="block-ip" className="form-label">IP address</label>
        <input id="block-ip" className={`form-control${error ? " is-invalid" : ""}`} value={ip} onChange={(event) => onIp(event.target.value)} placeholder="e.g. 203.0.113.7" required />
        {error && <div className="invalid-feedback">{error}</div>}
        {yourIp && <div className="form-text">Your own address is {yourIp} — it can’t be blocked.</div>}
        <div className="row g-2 mt-1">
          <div className="col-sm-6">
            <label htmlFor="block-hours" className="form-label">For</label>
            <select id="block-hours" className="form-select" value={form.hours} onChange={(event) => setForm({ ...form, hours: event.target.value ? Number(event.target.value) : "" })}>
              {DURATIONS.map((duration) => <option key={duration.label} value={duration.hours}>{duration.label}</option>)}
            </select>
          </div>
          <div className="col-sm-6">
            <label htmlFor="block-scope" className="form-label">From</label>
            <select id="block-scope" className="form-select" value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })}>
              <option value="all">The whole store</option>
              <option value="sign-in">Signing in only</option>
            </select>
          </div>
        </div>
        <label htmlFor="block-reason" className="form-label mt-2">Reason (for your records)</label>
        <input id="block-reason" className="form-control" maxLength={200} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="e.g. Password guessing" />
        <button type="submit" className="btn btn-danger btn-sm mt-3" disabled={saving || !ip.trim()}>{saving ? "Blocking…" : "Block this address"}</button>
      </form>
    </section>
  );
};

/** The sign-in log, newest first, with filters. */
const AttemptLog = ({ onBlockIp }) => {
  const [filters, setFilters] = useState({ outcome: "", portal: "", search: "", page: 1 });
  const [searchInput, setSearchInput] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== "").map(([key, value]) => [key, String(value)]));
      setData(await serverRequest(`/admin/security/attempts?${params}`));
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const set = (key, value) => setFilters((current) => ({ ...current, [key]: value, page: 1 }));

  return (
    <section className="customer-panel mt-4">
      <header className="customer-panel-header">
        <div><h2>Sign-in log</h2><p>Every attempt to sign in to the website and the app, newest first.</p></div>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={load}>Refresh</button>
      </header>
      <div className="inv-filters">
        <label>
          <span>Result</span>
          <select className="form-select" value={filters.outcome} onChange={(event) => set("outcome", event.target.value)}>
            <option value="">Everything</option>
            {Object.entries(OUTCOMES).map(([key, outcome]) => <option key={key} value={key}>{outcome.label}</option>)}
          </select>
        </label>
        <label>
          <span>Portal</span>
          <select className="form-select" value={filters.portal} onChange={(event) => set("portal", event.target.value)}>
            <option value="">All</option>
            {Object.entries(PORTALS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <form className="inv-search" onSubmit={(event) => { event.preventDefault(); set("search", searchInput.trim()); }}>
          <span>Find</span>
          <div className="input-group">
            <input className="form-control" placeholder="Email or IP address" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
            <button type="submit" className="btn btn-outline-primary">Search</button>
          </div>
        </form>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {!data && !error && <p className="text-muted">Loading the log…</p>}
      {data && (data.data.length ? (
        <div className="table-responsive">
          <table className="table align-middle srv-table">
            <thead><tr><th>When</th><th>Result</th><th>Email</th><th>Portal</th><th>Address</th><th>Device</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              {data.data.map((attempt) => (
                <tr key={attempt.id}>
                  <td className="text-nowrap">{when(attempt.created_at)}<small>{timeAgo(attempt.created_at)}</small></td>
                  <td><span className={`srv-badge is-${OUTCOMES[attempt.outcome]?.tone}`}>{OUTCOMES[attempt.outcome]?.label || attempt.outcome}</span></td>
                  <td className="text-break">{attempt.email || "—"}</td>
                  <td>{PORTALS[attempt.portal] || "—"}{METHODS[attempt.method] && <small>{METHODS[attempt.method]}</small>}</td>
                  <td className="text-nowrap"><code>{attempt.ip}</code></td>
                  <td>{attempt.device || "—"}</td>
                  <td className="text-end">{attempt.outcome !== "success" && <button type="button" className="btn btn-link btn-sm text-danger p-0 text-nowrap" onClick={() => onBlockIp(attempt.ip)}>Block address</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-muted text-center py-4 mb-0">No sign-ins match.</p>)}

      {data && data.last_page > 1 && (
        <nav className="d-flex justify-content-between align-items-center mt-3" aria-label="Log pages">
          <button type="button" className="btn btn-outline-secondary btn-sm" disabled={data.current_page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Newer</button>
          <span>Page {data.current_page} of {data.last_page}</span>
          <button type="button" className="btn btn-outline-secondary btn-sm" disabled={data.current_page >= data.last_page} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Older</button>
        </nav>
      )}
    </section>
  );
};

const CHOICES = { accept_all: "Accept all", necessary_only: "Necessary only", custom: "Chose their own" };

/** How website visitors answered the cookie banner (kept as proof of consent), and the latest answers. */
const CookieChoices = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    serverRequest("/admin/consents").then(setData).catch((requestError) => setError(requestError.message));
  }, []);

  const stats = data?.last_30_days;
  const share = (count) => (stats?.total ? `${Math.round((count / stats.total) * 100)}%` : "–");

  return (
    <section className="customer-panel mt-4">
      <header className="customer-panel-header">
        <div>
          <h2>Cookie choices</h2>
          <p>How visitors answered the cookie banner in the last 30 days. Each answer is kept as a record of consent{data ? ` (Cookie Policy of ${data.policy_version})` : ""}.</p>
        </div>
        <Link to="/cookie-policy" className="customer-link">Cookie Policy →</Link>
      </header>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {stats && (
        <>
          <dl className="inv-totals">
            <div><dt>Answers</dt><dd>{stats.total}</dd></div>
            <div><dt>Accept all</dt><dd>{stats.accept_all} <small className="text-muted">({share(stats.accept_all)})</small></dd></div>
            <div><dt>Necessary only</dt><dd>{stats.necessary_only} <small className="text-muted">({share(stats.necessary_only)})</small></dd></div>
            <div><dt>Chose their own</dt><dd>{stats.custom}</dd></div>
            <div className="is-grand"><dt>Allow performance</dt><dd>{stats.performance_share}%</dd></div>
          </dl>
          {data.latest.length ? (
            <div className="table-responsive">
              <table className="table align-middle srv-table">
                <thead><tr><th>When</th><th>Choice</th><th>Performance</th><th>Consent ID</th><th>Page</th><th>Device</th></tr></thead>
                <tbody>
                  {data.latest.map((consent) => (
                    <tr key={consent.id}>
                      <td className="text-nowrap">{when(consent.created_at)}</td>
                      <td>{CHOICES[consent.choice] || consent.choice}{consent.user_id && <small>signed-in user #{consent.user_id}</small>}</td>
                      <td>{consent.performance ? "Allowed" : "Off"}</td>
                      <td><code className="text-break">{consent.consent_id}</code></td>
                      <td>{consent.page || "—"}</td>
                      <td>{consent.device || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-muted mb-0">No answers yet. They appear as visitors respond to the cookie banner.</p>}
        </>
      )}
    </section>
  );
};

export default Security;
