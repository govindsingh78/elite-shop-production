import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Modal } from "react-bootstrap";
import { toast } from "react-toastify";
import { apiUrl } from "../../common/http";
import { CommandBlock } from "./ServerBits";
import { formatBytes, serverRequest, timeAgo } from "./server";

const TYPES = { manual: "Manual", automatic: "Automatic", safety: "Safety copy" };
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const KEEP = [7, 14, 30, 60];
const POLL_MS = 2000;

const formatWhen = (value) => new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
/** 14 → "2:00 pm" */
const hourLabel = (hour) => `${hour % 12 || 12}:00 ${hour < 12 ? "am" : "pm"}`;

/** Asks for the admin's password before a backup leaves the server or replaces the database. */
const ConfirmDialog = ({ action, backup, onClose, onDone }) => {
  const restoring = action === "restore";
  const [password, setPassword] = useState("");
  const [word, setWord] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [changes, setChanges] = useState(null);

  useEffect(() => {
    if (!restoring) return;
    serverRequest(`/admin/server/backups/${backup.id}/restore-check`).then((data) => setChanges(data.changes)).catch(() => setChanges(false));
  }, [backup.id, restoring]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const body = restoring ? { password, confirm: word } : { password };
      const data = await serverRequest(`/admin/server/backups/${backup.id}/${restoring ? "restore" : "download-link"}`, { method: "POST", body });
      onDone(data);
    } catch (requestError) {
      setErrors(requestError.fieldErrors && Object.keys(requestError.fieldErrors).length ? requestError.fieldErrors : { form: requestError.message });
      setBusy(false);
    }
  };

  const lost = changes && [["order", changes.orders], ["customer account", changes.customers], ["product", changes.products]]
    .filter(([, count]) => count > 0).map(([label, count]) => `${count} ${label}${count === 1 ? "" : "s"}`);

  return (
    <Modal show centered onHide={busy ? undefined : onClose} aria-labelledby="backup-dialog-title">
      <form onSubmit={submit}>
        <Modal.Header closeButton={!busy}>
          <Modal.Title id="backup-dialog-title" as="h2" className="h5 mb-0">{restoring ? "Restore this backup?" : "Download this backup"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {restoring ? (
            <>
              <p>The whole database goes back to how it was on <strong>{formatWhen(backup.started_at)}</strong>.</p>
              {changes === null ? <p className="text-muted" role="status">Checking what’s changed since then…</p> : lost?.length
                ? <p className="bkp-lost"><strong>{lost.join(", ")}</strong> added since then will be removed.</p>
                : changes && <p>No orders, customers or products have been added since then.</p>}
              <ul className="bkp-steps">
                <li>The store goes offline for shoppers while this runs.</li>
                <li>A safety copy of today’s database is saved first, and goes back automatically if anything fails.</li>
                <li>Anyone who signed in after this backup, maybe you, will have to sign in again.</li>
              </ul>
              <label htmlFor="backup-word" className="form-label">Type RESTORE to confirm</label>
              <input id="backup-word" className={`form-control mb-3${errors.confirm ? " is-invalid" : ""}`} value={word} onChange={(event) => setWord(event.target.value)} autoComplete="off" autoFocus required />
              {errors.confirm && <div className="invalid-feedback d-block mt-n2 mb-3">{errors.confirm}</div>}
            </>
          ) : <p>This file holds every customer’s details and all your store’s data, so keep it somewhere private.</p>}
          <label htmlFor="backup-password" className="form-label">Your admin password</label>
          <input id="backup-password" type="password" className={`form-control${errors.password ? " is-invalid" : ""}`} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" autoFocus={!restoring} required />
          {errors.password && <div className="invalid-feedback d-block">{errors.password}</div>}
          {(errors.form || errors.backup) && <div className="text-danger small mt-2" role="alert">{errors.form || errors.backup}</div>}
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-link" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="submit" className={`btn ${restoring ? "btn-danger" : "btn-primary"}`} disabled={busy || (restoring && changes === null)}>
            {busy ? "Please wait…" : restoring ? "Restore" : "Download"}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  );
};

const BackupSettings = ({ settings, onSaved }) => {
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const change = (field) => (event) => setForm({ ...form, [field]: Number(event.target.value) });

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await serverRequest("/admin/server/backups/settings", { method: "PUT", body: form });
      toast.success(data.message);
      onSaved();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="customer-panel">
      <header className="customer-panel-header"><div><h2>Automatic backups</h2><p>One a day. Times are India time.</p></div></header>
      <form className="bkp-settings" onSubmit={save}>
        <div className="form-check form-switch">
          <input id="backup-auto" className="form-check-input" type="checkbox" role="switch" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
          <label className="form-check-label" htmlFor="backup-auto">Back up every day</label>
        </div>
        <div>
          <label htmlFor="backup-hour" className="form-label">Time</label>
          <select id="backup-hour" className="form-select" value={form.hour} disabled={!form.enabled} onChange={change("hour")}>
            {HOURS.map((hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="backup-keep" className="form-label">Keep the latest</label>
          <select id="backup-keep" className="form-select" value={form.keep} disabled={!form.enabled} onChange={change("keep")}>
            {KEEP.map((count) => <option key={count} value={count}>{count} backups</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-outline-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </form>
      <p className="form-text mb-0 mt-2">Older automatic backups are deleted to save space. Manual backups and safety copies stay until you delete them.</p>
    </section>
  );
};

/** Copies of the database: take one, set up the daily one, download, restore or delete. */
const BackupsTab = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [starting, setStarting] = useState(false);
  const [dialog, setDialog] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await serverRequest("/admin/server/backups"));
      setError("");
      setOffline(false);
    } catch (requestError) {
      // The store answers 503 while a restore runs. A 401 means it finished, and this sign-in wasn't in that backup.
      setOffline(requestError.status === 503);
      setSignedOut(requestError.status === 401);
      setError(requestError.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const working = restoring || offline || data?.working;
  useEffect(() => {
    if (!working || signedOut) return undefined;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [working, signedOut, load]);

  const restoreStatus = data?.restore?.status;
  useEffect(() => {
    if (!restoring || !restoreStatus || restoreStatus === "running") return;
    setRestoring(false);
    if (restoreStatus === "done") toast.success("The database has been restored.");
    else toast.error("The restore failed. See the details below.");
  }, [restoring, restoreStatus]);

  const backUp = async () => {
    setStarting(true);
    try {
      await serverRequest("/admin/server/backups", { method: "POST" });
      await load();
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setStarting(false);
    }
  };

  const remove = async (backup) => {
    if (!window.confirm(`Delete the backup from ${formatWhen(backup.started_at)}? This can’t be undone.`)) return;
    try {
      toast.success((await serverRequest(`/admin/server/backups/${backup.id}`, { method: "DELETE" })).message);
      load();
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  const finishDialog = (result) => {
    if (dialog.action === "restore") {
      setRestoring(true);
    } else {
      window.location.assign(`${apiUrl.replace(/\/api\/?$/, "")}${result.url}`);
      setTimeout(load, 1500);
    }
    setDialog(null);
  };

  if (signedOut) {
    return (
      <section className="customer-panel" role="status">
        <h2>Please sign in again</h2>
        <p>Your sign-in was newer than the backup that was restored, so it no longer exists. The result will be here once you’re back.</p>
        <Link to="/admin/login" className="btn btn-primary">Sign in</Link>
      </section>
    );
  }
  if (restoring || offline) {
    return <section className="customer-panel bkp-working" role="status"><span className="spinner-border spinner-border-sm" aria-hidden="true" /><div><h2>Restoring the database…</h2><p>The store is offline for shoppers until this finishes. This page updates by itself.</p></div></section>;
  }
  if (!data) {
    return error ? <div className="alert alert-danger" role="alert">{error}</div> : <p className="text-muted" role="status">Loading backups…</p>;
  }

  const { problem, install_command: install, backups, settings, restore } = data;

  return (
    <>
      {problem && (
        <div className="alert alert-warning" role="alert">
          <strong>Backups can’t run yet.</strong> {problem}
          {install && <CommandBlock command={install} note="Run this on the server, then come back here." />}
        </div>
      )}

      {restore && restore.status !== "running" && (
        <div className={`alert ${restore.status === "done" ? "alert-success" : "alert-danger"}`} role="status">
          <strong>{restore.status === "done" ? `Restored the backup from ${formatWhen(restore.backup_taken_at)}` : "The last restore failed"}</strong>
          {" "}{timeAgo(restore.finished_at)}{restore.by ? `, by ${restore.by}` : ""}.
          {restore.status === "done" ? restore.safety_copy && " The database as it was is kept as a safety copy below." : <p className="mb-0 mt-1">{restore.error}</p>}
        </div>
      )}

      <section className="customer-panel">
        <header className="customer-panel-header">
          <div><h2>Database backups</h2><p>{backups.length ? `${backups.length} ${backups.length === 1 ? "backup" : "backups"}, using ${formatBytes(data.total_size)}.` : "No backups yet."}</p></div>
          <button type="button" className="btn btn-primary" disabled={Boolean(problem) || data.working || starting} onClick={backUp}>{data.working || starting ? "Backing up…" : "Back up now"}</button>
        </header>
        <dl className="bkp-facts">
          <div><dt>Latest backup</dt><dd>{timeAgo(data.last_ready_at)}</dd></div>
          <div><dt>Next automatic</dt><dd>{data.next_automatic_at ? formatWhen(data.next_automatic_at) : "Switched off"}</dd></div>
          <div><dt>Last copied off the server</dt><dd>{timeAgo(data.last_copied_at)}</dd></div>
        </dl>
        <p className="bkp-note">Backups are kept on this server, so they’d be lost with it. Download one every so often and keep it somewhere safe.</p>

        {backups.length > 0 && (
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead><tr><th scope="col">Taken</th><th scope="col">Type</th><th scope="col">Size</th><th scope="col" className="text-end">Actions</th></tr></thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.id}>
                    <td>
                      <strong className="d-block">{formatWhen(backup.started_at)}</strong>
                      <small className="text-muted">{backup.by ? `by ${backup.by}` : "Scheduled"}{backup.downloaded_at ? ` · downloaded ${timeAgo(backup.downloaded_at)}` : ""}</small>
                      {backup.status === "failed" && <small className="d-block text-danger">{backup.error}</small>}
                    </td>
                    <td><span className={`srv-badge is-${backup.status === "failed" ? "danger" : backup.status === "running" ? "warning" : "ok"}`}>{backup.status === "failed" ? "Failed" : backup.status === "running" ? "Working…" : TYPES[backup.trigger]}</span></td>
                    <td className="text-nowrap">{backup.status === "ready" ? formatBytes(backup.size) : "—"}</td>
                    <td className="text-end text-nowrap">
                      {backup.status === "ready" && (
                        <>
                          <button type="button" className="btn btn-outline-primary btn-sm me-2" disabled={data.working} onClick={() => setDialog({ action: "download", backup })}>Download</button>
                          <button type="button" className="btn btn-outline-primary btn-sm me-2" disabled={data.working} onClick={() => setDialog({ action: "restore", backup })}>Restore</button>
                        </>
                      )}
                      {backup.status !== "running" && <button type="button" className="btn btn-outline-danger btn-sm" disabled={data.working} onClick={() => remove(backup)}>Delete</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <BackupSettings key={JSON.stringify(settings)} settings={settings} onSaved={load} />

      <section className="customer-panel">
        <header className="customer-panel-header"><div><h2>If the admin panel won’t open</h2><p>A badly broken database stops everyone signing in. A restore can also be run on the server.</p></div></header>
        <CommandBlock command={data.restore_command} note="Lists the backups, then restores the one you name. Run it in the e-street-backend folder." />
      </section>

      {dialog && <ConfirmDialog {...dialog} onClose={() => setDialog(null)} onDone={finishDialog} />}
    </>
  );
};

export default BackupsTab;
