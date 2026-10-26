import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { AUDIENCES, SOURCES, affectedText, serverRequest, timeAgo } from "./server";

const CONTEXT_LABELS = { platform: "Browser or device", version: "App version" };

const STATUSES = [
  { key: "open", label: "Open" },
  { key: "resolved", label: "Fixed" },
  { key: "all", label: "All" },
];

/** Errors people ran into on the server, website and app, grouped, with who was affected and the details to fix them. */
const ProblemsTab = () => {
  const [filters, setFilters] = useState({ status: "open", source: "", audience: "", search: "", page: 1 });
  const [searchInput, setSearchInput] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== "").map(([key, value]) => [key, String(value)]));
      setData(await serverRequest(`/admin/server/problems?${params}`));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const set = (key, value) => setFilters((current) => ({ ...current, [key]: value, page: 1 }));

  const resolveAll = async () => {
    if (!window.confirm("Mark every open problem as fixed? Any that happen again will reopen and alert you.")) return;
    try {
      toast.success((await serverRequest("/admin/server/problems/resolve-all", { method: "POST" })).message);
      load();
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  return (
    <section className="customer-panel">
      <header className="customer-panel-header">
        <div>
          <h2>Problems</h2>
          <p>Every error is grouped with its repeats, so you see what happens most and to whom. Mark one fixed once you’ve dealt with it — it reopens if it comes back.</p>
        </div>
        {filters.status === "open" && data?.counts.open > 0 && <button type="button" className="btn btn-outline-secondary btn-sm text-nowrap" onClick={resolveAll}>Mark all fixed</button>}
      </header>

      <div className="inv-filters">
        <label>
          <span>Status</span>
          <select className="form-select" value={filters.status} onChange={(event) => set("status", event.target.value)}>
            {STATUSES.map((status) => <option key={status.key} value={status.key}>{status.label}{data?.counts[status.key] != null ? ` (${data.counts[status.key]})` : ""}</option>)}
          </select>
        </label>
        <label>
          <span>Where</span>
          <select className="form-select" value={filters.source} onChange={(event) => set("source", event.target.value)}>
            <option value="">Everywhere</option>
            {Object.entries(SOURCES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Who</span>
          <select className="form-select" value={filters.audience} onChange={(event) => set("audience", event.target.value)}>
            <option value="">Everyone</option>
            {Object.entries(AUDIENCES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <form className="inv-search" onSubmit={(event) => { event.preventDefault(); set("search", searchInput.trim()); }}>
          <span>Find</span>
          <div className="input-group">
            <input className="form-control" placeholder="Error, page or file" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
            <button type="submit" className="btn btn-outline-primary">Search</button>
          </div>
        </form>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {loading && !data && <p className="text-muted" role="status">Loading problems…</p>}
      {data && (data.data.length ? (
        <ul className="srv-problems" aria-busy={loading}>
          {data.data.map((problem) => (
            <ProblemRow key={problem.id} problem={problem} open={openId === problem.id} onToggle={() => setOpenId(openId === problem.id ? null : problem.id)} onChanged={load} />
          ))}
        </ul>
      ) : (
        <p className="text-muted text-center py-4 mb-0">{filters.status === "open" && !filters.search && !filters.source && !filters.audience ? "No open problems. Nobody has run into an error lately. 🎉" : "No problems match."}</p>
      ))}

      {data && data.last_page > 1 && (
        <nav className="d-flex justify-content-between align-items-center mt-3" aria-label="Problem pages">
          <button type="button" className="btn btn-outline-secondary btn-sm" disabled={data.current_page <= 1 || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>
          <span>Page {data.current_page} of {data.last_page}</span>
          <button type="button" className="btn btn-outline-secondary btn-sm" disabled={data.current_page >= data.last_page || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
        </nav>
      )}
    </section>
  );
};

const ProblemRow = ({ problem, open, onToggle, onChanged }) => {
  const [details, setDetails] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || details) return;
    serverRequest(`/admin/server/problems/${problem.id}`).then((result) => setDetails(result.problem)).catch((requestError) => toast.error(requestError.message));
  }, [open, details, problem.id]);

  const change = async (method, body) => {
    setBusy(true);
    try {
      const result = await serverRequest(`/admin/server/problems/${problem.id}`, { method, body });
      toast.success(result.message);
      onChanged();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`srv-problem is-${problem.level}${problem.status === "resolved" ? " is-resolved" : ""}`}>
      <button type="button" className="srv-problem-head" onClick={onToggle} aria-expanded={open}>
        <span className="srv-problem-count" title="Times it happened">{problem.hits}×</span>
        <span className="srv-problem-text">
          <strong>{problem.title}</strong>
          <small>
            {SOURCES[problem.source]}{problem.url ? ` · ${problem.method && problem.method !== "GET" ? `${problem.method} ` : ""}${problem.url}` : ""}
            {" · "}{affectedText(problem.affected)}
          </small>
        </span>
        <span className="srv-problem-when">
          {problem.status === "resolved" ? <span className="srv-badge is-ok">Fixed</span> : timeAgo(problem.last_seen_at)}
        </span>
      </button>
      {open && (
        <div className="srv-problem-body">
          {!details ? <p className="text-muted mb-0">Loading details…</p> : (
            <>
              <dl className="srv-details">
                <div><dt>First seen</dt><dd>{new Date(details.first_seen_at).toLocaleString("en-IN")}</dd></div>
                <div><dt>Last seen</dt><dd>{new Date(details.last_seen_at).toLocaleString("en-IN")}</dd></div>
                {details.location && <div><dt>{problem.source === "server" ? "Where in the code" : "Where"}</dt><dd><code>{details.location}</code></dd></div>}
                {details.last_user_id && <div><dt>Last user</dt><dd>#{details.last_user_id}</dd></div>}
                {details.context && Object.entries(details.context).map(([key, value]) => <div key={key}><dt>{CONTEXT_LABELS[key] || key}</dt><dd>{String(value)}</dd></div>)}
              </dl>
              {details.message && details.message !== details.title && <pre className="srv-pre">{details.message}</pre>}
              {details.trace && (
                <details className="mt-2">
                  <summary>Stack trace (for your developer)</summary>
                  <pre className="srv-pre">{details.trace}</pre>
                </details>
              )}
              <div className="d-flex flex-wrap gap-2 mt-3">
                {problem.status === "open"
                  ? <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => change("PATCH", { status: "resolved" })}>Mark fixed</button>
                  : <button type="button" className="btn btn-outline-primary btn-sm" disabled={busy} onClick={() => change("PATCH", { status: "open" })}>Reopen</button>}
                <button type="button" className="btn btn-outline-danger btn-sm" disabled={busy} onClick={() => window.confirm("Remove this problem from the list?") && change("DELETE")}>Remove</button>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
};

export default ProblemsTab;
