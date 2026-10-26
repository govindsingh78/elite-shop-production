import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { CommandBlock, Meter } from "./ServerBits";
import { GROW_DISK_COMMANDS, GROW_DISK_STEPS, SPACE_COMMANDS, formatBytes, serverRequest, timeAgo } from "./server";

/** What fills the disk, one-click clean-ups, and how to free or add space on the server itself. */
const StorageTab = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState("");

  const load = useCallback(async (fresh = false) => {
    setError("");
    try {
      setData(await serverRequest(`/admin/server/storage${fresh ? "?fresh=1" : ""}`));
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const clean = async (action) => {
    setBusy(action);
    setProgress("");
    try {
      let result = await serverRequest("/admin/server/cleanup", { method: "POST", body: { action } });
      // Photos go a batch at a time; keep going while each batch gets some done.
      while (action === "photos" && result.remaining > 0 && result.optimised > 0) {
        setProgress(result.message);
        result = await serverRequest("/admin/server/cleanup", { method: "POST", body: { action } });
      }
      toast.success(result.message);
      setData((current) => ({ ...current, disk: result.disk, storage: result.storage }));
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setBusy("");
      setProgress("");
    }
  };

  if (!data) {
    return error ? <div className="alert alert-danger" role="alert">{error}</div> : <p className="text-muted" role="status">Measuring what’s on the disk…</p>;
  }

  const { disk, storage, photo_sides: sides } = data;
  const folder = (key) => storage.folders.find((item) => item.key === key);
  const scale = Math.max(disk?.used || 0, storage.app_total, 1);
  const oversized = storage.photos.small.oversized + storage.photos.large.oversized;

  return (
    <>
      <section className="customer-panel">
        <header className="customer-panel-header">
          <div><h2>Disk</h2><p>Measured {timeAgo(storage.measured_at)}.</p></div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => load(true)}>Measure again</button>
        </header>
        {disk ? (
          <>
            <div className="srv-disk-figures">
              <strong>{disk.percent}% full</strong>
              <span>{formatBytes(disk.used)} used · {formatBytes(disk.free)} free · {formatBytes(disk.total)} in all</span>
            </div>
            <Meter percent={disk.percent} status={disk.status} label="Disk used" />
            {disk.status !== "ok" && <p className="srv-disk-warning">{disk.status === "critical" ? "Almost full: uploads, orders and deploys will start failing. Clean up below, or make the disk bigger." : "Getting full. Clean up below before it becomes a problem."}</p>}
          </>
        ) : <p className="text-muted">The disk size isn’t available on this server.</p>}

        <h3 className="srv-subhead">What’s using it</h3>
        <ul className="srv-folders">
          {storage.folders.map((item) => (
            <li key={item.key}>
              <span className="srv-folder-name"><strong>{item.label}</strong><small>{item.files.toLocaleString("en-IN")} files · {item.path}</small></span>
              <span className="srv-folder-bar"><span style={{ width: `${(item.bytes / scale) * 100}%` }} /></span>
              <span className="srv-folder-size">{formatBytes(item.bytes)}</span>
            </li>
          ))}
          {storage.outside_app != null && (
            <li className="is-other">
              <span className="srv-folder-name"><strong>Operating system & everything else</strong><small>System files, packages, system logs and caches — see “Need more space?” below</small></span>
              <span className="srv-folder-bar"><span style={{ width: `${(storage.outside_app / scale) * 100}%` }} /></span>
              <span className="srv-folder-size">{formatBytes(storage.outside_app)}</span>
            </li>
          )}
        </ul>
      </section>

      <section className="customer-panel mt-4">
        <header className="customer-panel-header"><div><h2>Clean up</h2><p>Safe one-click clean-ups of the store’s own files.</p></div></header>
        {progress && <div className="alert alert-info py-2" role="status">{progress}</div>}
        <div className="srv-cleanups">
          <article>
            <strong>Product photos</strong>
            <p>{oversized
              ? `${oversized} ${oversized === 1 ? "photo is" : "photos are"} bigger than shoppers need. Listing photos average ${formatBytes(storage.photos.small.average)}. Shrinking them (to ${sides.small} px for lists, ${sides.large} px for product pages) speeds up the shop and frees space. New uploads are already saved at these sizes.`
              : `All ${storage.photos.small.count} product photos are the right size (${sides.small} px for lists, ${sides.large} px for product pages).`}</p>
            <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(busy) || !oversized} onClick={() => clean("photos")}>{busy === "photos" ? "Optimising…" : "Optimise photos"}</button>
          </article>
          <article>
            <strong>Old photo uploads · {formatBytes(folder("temp")?.bytes || 0)}</strong>
            <p>Every photo is uploaded first, then copied into its product. The uploads aren’t needed afterwards; ones older than 3 days are removed every night, and this removes those older than a day.</p>
            <button type="button" className="btn btn-outline-primary btn-sm" disabled={Boolean(busy)} onClick={() => clean("temp-uploads")}>{busy === "temp-uploads" ? "Removing…" : "Remove old uploads"}</button>
          </article>
          <article>
            <strong>Log files · {formatBytes(folder("logs")?.bytes || 0)}</strong>
            <p>Removes log files older than a week and trims any log over 10 MB to its latest entries. Problems stay listed under Problems.</p>
            <button type="button" className="btn btn-outline-primary btn-sm" disabled={Boolean(busy)} onClick={() => clean("logs")}>{busy === "logs" ? "Cleaning…" : "Clean logs"}</button>
          </article>
        </div>
      </section>

      <section className="customer-panel mt-4">
        <header className="customer-panel-header">
          <div><h2>Need more space?</h2><p>If “Operating system & everything else” is big, free space on the server itself. Connect with PuTTY or SSH and run these one at a time.</p></div>
        </header>
        {SPACE_COMMANDS.map((item) => <CommandBlock key={item.command} command={item.command} note={item.note} />)}

        <h3 className="srv-subhead">Make the disk bigger</h3>
        <ol className="srv-steps">{GROW_DISK_STEPS.map((step) => <li key={step}>{step}</li>)}</ol>
        {GROW_DISK_COMMANDS.map((command) => <CommandBlock key={command} command={command} />)}
      </section>
    </>
  );
};

export default StorageTab;
