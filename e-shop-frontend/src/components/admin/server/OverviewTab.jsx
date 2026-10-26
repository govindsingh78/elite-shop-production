import React, { useCallback, useEffect, useState } from "react";
import { AttentionItem, Meter, SuggestionItem } from "./ServerBits";
import { SOURCES, affectedText, formatBytes, formatMs, formatUptime, serverRequest, timeAgo } from "./server";

/** The server's vital signs, what needs attention, suggestions, and the latest problems at a glance. */
const OverviewTab = ({ onOpenTab }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await serverRequest("/admin/server"));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data) {
    return error
      ? <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert"><span>{error}</span><button type="button" className="btn btn-outline-danger btn-sm" onClick={load}>Try again</button></div>
      : <p className="text-muted" role="status">Checking the server…</p>;
  }

  const { health, attention, suggestions, problems, slowest } = data;
  const { disk, memory, cpu, database, app, background } = health;
  const urgent = attention.filter((item) => item.severity !== "info").length;

  return (
    <div className="srv-overview">
      <div className={`srv-status${urgent ? " is-warning" : ""}`} role="status">
        <strong>{urgent ? `${urgent} ${urgent === 1 ? "thing needs" : "things need"} your attention` : "Everything looks healthy"}</strong>
        <span>Checked {timeAgo(health.checked_at)} · automatic checks {background.running ? `ran ${timeAgo(background.last_check_at)}` : "aren’t running"}</span>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={load} disabled={loading}>{loading ? "Checking…" : "Check again"}</button>
      </div>

      <div className="srv-vitals">
        <article className={`srv-vital is-${disk?.status || "unknown"}`}>
          <span>Disk</span>
          <strong>{disk ? `${disk.percent}%` : "—"}</strong>
          {disk && <Meter percent={disk.percent} status={disk.status} label="Disk used" />}
          <small>{disk ? `${formatBytes(disk.free)} free of ${formatBytes(disk.total)}` : "Not available"}</small>
        </article>
        <article className={`srv-vital is-${memory?.status || "unknown"}`}>
          <span>Memory</span>
          <strong>{memory ? `${memory.percent}%` : "—"}</strong>
          {memory && <Meter percent={memory.percent} status={memory.status} label="Memory used" />}
          <small>{memory ? `${formatBytes(memory.available)} available${memory.swap_total ? ` · swap ${formatBytes(memory.swap_used)} of ${formatBytes(memory.swap_total)}` : " · no swap"}` : "Only shown on Linux servers"}</small>
        </article>
        <article className={`srv-vital is-${cpu?.status || "unknown"}`}>
          <span>CPU load</span>
          <strong>{cpu ? cpu.load[1] : "—"}</strong>
          {cpu && <Meter percent={(cpu.load[1] / cpu.cores) * 50} status={cpu.status} label="CPU load" />}
          <small>{cpu ? `5-minute average on ${cpu.cores} ${cpu.cores === 1 ? "core" : "cores"} (now ${cpu.load[0]})` : "Only shown on Linux servers"}</small>
        </article>
        <article className={`srv-vital is-${database.status}`}>
          <span>Database</span>
          <strong>{database.status === "critical" ? "Down" : formatMs(database.latency_ms)}</strong>
          <small>{database.status === "critical" ? database.error : `${database.driver}${database.size != null ? ` · ${formatBytes(database.size)}` : ""}`}</small>
        </article>
        <article className="srv-vital is-ok">
          <span>Up for</span>
          <strong>{formatUptime(health.uptime_seconds)}</strong>
          <small>Since the server last restarted</small>
        </article>
      </div>

      <div className="row g-4">
        <div className="col-xl-7">
          <section className="customer-panel">
            <header className="customer-panel-header"><div><h2>Needs attention</h2><p>Checked every 10 minutes; urgent ones are sent to you.</p></div></header>
            {attention.length
              ? <ul className="srv-attention-list">{attention.map((item) => <AttentionItem key={item.key} item={item} onOpenTab={onOpenTab} />)}</ul>
              : <p className="text-muted mb-0">Nothing right now. Disk, memory, database, settings, problems and speed all look fine.</p>}
          </section>

          <section className="customer-panel mt-4">
            <header className="customer-panel-header">
              <div><h2>Latest problems</h2><p>{problems.open ? `${problems.open} open · ${problems.last_day} seen in the last 24 hours` : "Errors shoppers, sellers and admins run into show up here."}</p></div>
              <button type="button" className="customer-link btn btn-link p-0" onClick={() => onOpenTab("problems")}>All problems →</button>
            </header>
            {problems.latest.length ? (
              <ul className="srv-mini-list">
                {problems.latest.map((problem) => (
                  <li key={problem.id}>
                    <strong>{problem.title}</strong>
                    <small>{SOURCES[problem.source]} · {problem.hits}× · {affectedText(problem.affected)} · {timeAgo(problem.last_seen_at)}</small>
                  </li>
                ))}
              </ul>
            ) : <p className="text-muted mb-0">No open problems. 🎉</p>}
          </section>
        </div>

        <div className="col-xl-5">
          <section className="customer-panel">
            <header className="customer-panel-header"><div><h2>Suggestions</h2><p>Ways to run the store better, from what’s in it today.</p></div></header>
            {suggestions.length
              ? <ul className="srv-suggestion-list">{suggestions.map((item) => <SuggestionItem key={item.key} item={item} onOpenTab={onOpenTab} />)}</ul>
              : <p className="text-muted mb-0">No suggestions right now — nicely done.</p>}
          </section>

          <section className="customer-panel mt-4">
            <header className="customer-panel-header">
              <div><h2>Slowest in the last 24 hours</h2><p>Average time the server takes to answer.</p></div>
              <button type="button" className="customer-link btn btn-link p-0" onClick={() => onOpenTab("speed")}>Speed →</button>
            </header>
            {slowest.length ? (
              <ul className="srv-mini-list">
                {slowest.map((route) => (
                  <li key={route.route}>
                    <strong>{route.label || route.route}</strong>
                    <small>{formatMs(route.avg_ms)} on average · {formatMs(route.max_ms)} at worst · {route.hits} {route.hits === 1 ? "call" : "calls"}</small>
                  </li>
                ))}
              </ul>
            ) : <p className="text-muted mb-0">No visits recorded yet today.</p>}
          </section>

          <section className="customer-panel mt-4">
            <header className="customer-panel-header"><div><h2>Server details</h2></div></header>
            <dl className="srv-details">
              <div><dt>Environment</dt><dd>{app.environment}{app.debug ? " · debug on" : ""}</dd></div>
              <div><dt>PHP / Laravel</dt><dd>{app.php} / {app.laravel}</dd></div>
              <div><dt>OPcache</dt><dd>{app.opcache == null ? "Unknown" : app.opcache ? "On" : "Off"}</dd></div>
              <div><dt>Settings cached</dt><dd>{app.config_cached ? "Yes" : "No"}{app.routes_cached ? " · routes too" : ""}</dd></div>
              <div><dt>Email</dt><dd>{app.mailer}</dd></div>
              <div><dt>Logs</dt><dd>{app.log_channel}</dd></div>
              <div><dt>PHP memory / upload</dt><dd>{app.memory_limit} / {app.upload_max}</dd></div>
              <div><dt>Operating system</dt><dd>{app.os}</dd></div>
              {database.largest_tables?.length > 0 && (
                <div className="srv-details-wide"><dt>Largest tables</dt><dd>{database.largest_tables.map((table) => `${table.name} (${formatBytes(table.size)})`).join(", ")}</dd></div>
              )}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
