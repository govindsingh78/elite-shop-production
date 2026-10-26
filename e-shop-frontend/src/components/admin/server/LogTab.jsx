import React, { useCallback, useEffect, useState } from "react";
import { formatBytes, serverRequest } from "./server";

const LEVELS = [
  { key: "all", label: "Everything" },
  { key: "error", label: "Errors only" },
  { key: "warning", label: "Warnings only" },
];

/** The latest entries of the server's log file, newest first. */
const LogTab = () => {
  const [filters, setFilters] = useState({ file: "", level: "error" });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ level: filters.level, ...(filters.file ? { file: filters.file } : {}) });
      setData(await serverRequest(`/admin/server/logs?${params}`));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="customer-panel">
      <header className="customer-panel-header">
        <div><h2>Server log</h2><p>The raw log, newest first. Problems groups the same errors together and is usually easier to read.</p></div>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
      </header>

      <div className="inv-filters">
        <label>
          <span>Log file</span>
          <select className="form-select" value={filters.file || data?.file || ""} onChange={(event) => setFilters((current) => ({ ...current, file: event.target.value }))}>
            {(data?.files || []).map((file) => <option key={file.name} value={file.name}>{file.name} ({formatBytes(file.size)})</option>)}
          </select>
        </label>
        <label>
          <span>Show</span>
          <select className="form-select" value={filters.level} onChange={(event) => setFilters((current) => ({ ...current, level: event.target.value }))}>
            {LEVELS.map((level) => <option key={level.key} value={level.key}>{level.label}</option>)}
          </select>
        </label>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {data && (data.entries.length ? (
        <ul className="srv-log">
          {data.entries.map((entry, index) => (
            <li key={`${entry.time}-${index}`} className={`is-${entry.level}`}>
              <span className="srv-log-meta"><time>{entry.time}</time><span className="srv-log-level">{entry.level}</span></span>
              {entry.details ? (
                <details>
                  <summary>{entry.message}</summary>
                  <pre className="srv-pre">{entry.details}</pre>
                </details>
              ) : <span className="srv-log-message">{entry.message}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="text-muted text-center py-4 mb-0">{data.file ? "Nothing at this level in the latest part of the log." : "There’s no log file yet."}</p>)}
    </section>
  );
};

export default LogTab;
