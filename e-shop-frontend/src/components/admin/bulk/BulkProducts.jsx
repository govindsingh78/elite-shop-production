import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { formatPrice } from "../../common/currency";
import { portalConfig } from "../portal";
import { buildWorkbook, bulkRequest, downloadBlob, isImageFile, readSheet, today, uploadPhoto } from "./bulkSheet";

const PARALLEL_UPLOADS = 3;

/** Add or update many products at once from a spreadsheet and a folder of photos (admins and sellers). */
const BulkProducts = ({ portal = "admin" }) => {
  const config = portalConfig(portal);
  const isVendor = portal === "vendor";
  const [lists, setLists] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [rows, setRows] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [check, setCheck] = useState(null);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    bulkRequest(portal, "/template").then(setLists).catch((loadError) => setError(loadError.message));
  }, [portal]);

  const resetResults = () => {
    setCheck(null);
    setReport(null);
    setError("");
  };

  const downloadTemplate = async () => {
    setBusy("template");
    try {
      downloadBlob(await buildWorkbook({ data: lists }), `elitezaar-bulk-upload-${today()}.xlsx`);
    } catch (downloadError) {
      toast.error(downloadError.message);
    } finally {
      setBusy("");
    }
  };

  const downloadMine = async () => {
    setBusy("export");
    try {
      const data = await bulkRequest(portal, "/export");
      downloadBlob(await buildWorkbook({ data, rows: data.rows }), `elitezaar-my-products-${today()}.xlsx`);
      toast.success(`${data.rows.length} ${data.rows.length === 1 ? "product" : "products"} downloaded. Edit them and upload the sheet here.`);
    } catch (downloadError) {
      toast.error(downloadError.message);
    } finally {
      setBusy("");
    }
  };

  const chooseSheet = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    resetResults();
    setSheet({ name: file.name, reading: true });
    try {
      const parsed = await readSheet(file);
      if (!parsed.length) throw new Error("No products found. Fill in the “Products” sheet, starting on row 2.");
      if (lists && parsed.length > lists.max_rows) throw new Error(`This sheet has ${parsed.length} products; upload at most ${lists.max_rows} at a time.`);
      setRows(parsed);
      setSheet({ name: file.name });
    } catch (readError) {
      setRows([]);
      setSheet({ name: file.name, error: readError.message });
    }
  };

  const choosePhotos = (event) => {
    const chosen = [...(event.target.files || [])].filter(isImageFile);
    const skipped = (event.target.files?.length || 0) - chosen.length;
    event.target.value = "";
    if (!chosen.length) {
      if (skipped) toast.error("None of those files are JPG, PNG, GIF or WebP photos.");
      return;
    }
    resetResults();
    // Same file name again replaces the earlier one.
    setPhotos((current) => [...new Map([...current, ...chosen].map((file) => [file.name.toLowerCase(), file])).values()]);
    if (skipped) toast.info(`${skipped} file${skipped === 1 ? " that isn’t a photo was" : "s that aren’t photos were"} left out.`);
  };

  const runCheck = async () => {
    setBusy("check");
    setError("");
    setReport(null);
    try {
      setCheck(await bulkRequest(portal, "/check", { method: "POST", body: { rows, image_names: photos.map((file) => file.name) } }));
      setFilter("all");
    } catch (checkError) {
      setError(checkError.message);
    } finally {
      setBusy("");
    }
  };

  const ready = useMemo(() => (check ? check.rows.filter((row) => !row.errors.length) : []), [check]);
  const neededPhotos = useMemo(() => {
    const names = new Set(ready.flatMap((row) => row.images.map((name) => name.toLowerCase())));
    return photos.filter((file) => names.has(file.name.toLowerCase()));
  }, [ready, photos]);

  const runImport = async () => {
    setBusy("import");
    setError("");
    try {
      const uploaded = [];
      setProgress({ label: "Uploading photos", done: 0, total: neededPhotos.length });
      const queue = [...neededPhotos];
      const worker = async () => {
        for (let file = queue.shift(); file; file = queue.shift()) {
          uploaded.push({ name: file.name, id: await uploadPhoto(portal, file) });
          setProgress((current) => ({ ...current, done: current.done + 1 }));
        }
      };
      await Promise.all(Array.from({ length: PARALLEL_UPLOADS }, worker));

      setProgress({ label: "Saving products", done: 0, total: 0 });
      const result = await bulkRequest(portal, "/import", { method: "POST", body: { rows, images: uploaded } });
      setReport(result);
      setCheck(null);
      toast.success(result.message);
    } catch (importError) {
      setError(importError.message);
    } finally {
      setBusy("");
      setProgress(null);
    }
  };

  const startOver = () => {
    setSheet(null);
    setRows([]);
    setPhotos([]);
    resetResults();
  };

  const shownRows = check ? check.rows.filter((row) => filter === "all" || (filter === "fix" ? row.errors.length : !row.errors.length)) : [];

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex admin-dashboard-layout">
          <Sidebar variant={config.sidebar} />
          <main className="container-fluid admin-dashboard-content customer-content">
            <Link to={config.productsPath} className="commission-back">← {isVendor ? "My products" : "All products"}</Link>
            <section className="customer-hero">
              <div>
                <span className="customer-eyebrow customer-eyebrow--light">PRODUCTS</span>
                <h1>Bulk upload<span>.</span></h1>
                <p>Add or update many products at once, with a spreadsheet and a folder of photos.{isVendor ? " New listings go live once our team approves them." : ""}</p>
              </div>
            </section>

            {error && <div className="alert alert-danger" role="alert">{error}</div>}

            <section className="customer-panel bulk-step">
              <span className="bulk-step-number">1</span>
              <div className="bulk-step-body">
                <header className="customer-panel-header"><div><h2>Get the sample sheet</h2><p>Made for {lists ? lists.owner.name : "you"}: it has drop-down lists of {lists ? <>{lists.categories.length} categories and subcategories and {lists.brands.length} brands</> : "Elitezaar’s categories and brands"}, an example, and instructions.</p></div></header>
                <div className="d-flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary" onClick={downloadTemplate} disabled={!lists || busy === "template"}>{busy === "template" ? "Preparing…" : "Download sample sheet (.xlsx)"}</button>
                  <button type="button" className="btn btn-outline-primary" onClick={downloadMine} disabled={!lists || busy === "export"}>{busy === "export" ? "Preparing…" : "Download my products"}</button>
                </div>
                <p className="bulk-hint">To change prices or stock in bulk, download your products, edit the sheet and upload it below. Only the cells you fill in change.</p>
              </div>
            </section>

            <section className="customer-panel bulk-step">
              <span className="bulk-step-number">2</span>
              <div className="bulk-step-body">
                <header className="customer-panel-header"><div><h2>Choose your sheet and photos</h2><p>Photos are matched to products by the file names in the “Photo file names” column.</p></div></header>
                <div className="row g-3">
                  <div className="col-lg-6">
                    <label className={`bulk-drop${sheet && !sheet.error && !sheet.reading ? " is-done" : ""}`}>
                      <input type="file" accept=".xlsx,.csv" onChange={chooseSheet} disabled={!!busy} />
                      <strong>{sheet ? sheet.name : "Choose your sheet"}</strong>
                      <small>{sheet?.reading ? "Reading…" : sheet?.error ? "" : sheet ? `${rows.length} ${rows.length === 1 ? "product" : "products"} found` : "Excel (.xlsx) or CSV"}</small>
                    </label>
                    {sheet?.error && <p className="text-danger small mt-2 mb-0" role="alert">{sheet.error}</p>}
                  </div>
                  <div className="col-lg-6">
                    <div className={`bulk-drop is-photos${photos.length ? " is-done" : ""}`}>
                      <strong>{photos.length ? `${photos.length} ${photos.length === 1 ? "photo" : "photos"} selected` : "Choose photos"}</strong>
                      <small>JPG, PNG, GIF or WebP. They’re resized before uploading.</small>
                      <div className="d-flex flex-wrap gap-2 justify-content-center mt-2">
                        <label className="btn btn-outline-secondary btn-sm mb-0">Select photos<input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple hidden onChange={choosePhotos} disabled={!!busy} /></label>
                        <label className="btn btn-outline-secondary btn-sm mb-0">Select a folder<input type="file" hidden onChange={choosePhotos} disabled={!!busy} {...{ webkitdirectory: "", directory: "" }} /></label>
                        {photos.length > 0 && <button type="button" className="btn btn-link btn-sm" onClick={() => { setPhotos([]); resetResults(); }} disabled={!!busy}>Clear</button>}
                      </div>
                    </div>
                  </div>
                </div>
                <button type="button" className="btn btn-primary mt-3" onClick={runCheck} disabled={!rows.length || !!busy}>{busy === "check" ? "Checking…" : "Check my sheet"}</button>
              </div>
            </section>

            {check && (
              <section className="customer-panel bulk-step">
                <span className="bulk-step-number">3</span>
                <div className="bulk-step-body">
                  <header className="customer-panel-header"><div><h2>Check and import</h2><p>Nothing has been saved yet.</p></div></header>
                  <div className="bulk-summary">
                    <button type="button" className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}><strong>{check.summary.total}</strong> rows</button>
                    <button type="button" className={`is-ready${filter === "ready" ? " is-active" : ""}`} onClick={() => setFilter("ready")}><strong>{check.summary.create}</strong> new · <strong>{check.summary.update}</strong> updates</button>
                    <button type="button" className={`is-error${filter === "fix" ? " is-active" : ""}`} onClick={() => setFilter("fix")}><strong>{check.summary.errors}</strong> need fixing</button>
                    <span><strong>{neededPhotos.length}</strong> photos to upload</span>
                  </div>
                  <div className="table-responsive bulk-table-wrap">
                    <table className="table align-middle commission-table bulk-table">
                      <thead><tr><th>Row</th><th>SKU</th><th>Product</th><th>Action</th><th>Photos</th><th>Check</th></tr></thead>
                      <tbody>
                        {shownRows.map((row) => (
                          <tr key={row.row} className={row.errors.length ? "has-errors" : undefined}>
                            <td>{row.row}</td>
                            <td className="text-break">{row.sku || "—"}</td>
                            <td>{row.title || <span className="text-muted">—</span>}</td>
                            <td>{row.action === "update" ? <span className="badge text-bg-info">Update</span> : row.action === "create" ? <span className="badge text-bg-success">New</span> : "—"}</td>
                            <td>{row.images.length || "—"}</td>
                            <td>
                              {row.errors.length
                                ? <ul className="bulk-issues is-error">{row.errors.map((message) => <li key={message}>{message}</li>)}</ul>
                                : <span className="bulk-ok">✓ Ready</span>}
                              {row.warnings.length > 0 && <ul className="bulk-issues">{row.warnings.map((message) => <li key={message}>{message}</li>)}</ul>}
                            </td>
                          </tr>
                        ))}
                        {!shownRows.length && <tr><td colSpan={6} className="text-center text-muted py-4">No rows here.</td></tr>}
                      </tbody>
                    </table>
                  </div>

                  {progress ? (
                    <div className="bulk-progress" role="status">
                      <span>{progress.label}{progress.total ? ` ${progress.done} of ${progress.total}` : "…"}</span>
                      <div className="progress"><div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : "100%" }} /></div>
                    </div>
                  ) : (
                    <div className="d-flex flex-wrap align-items-center gap-3 mt-3">
                      <button type="button" className="btn btn-primary" onClick={runImport} disabled={!ready.length || !!busy}>Import {ready.length} {ready.length === 1 ? "product" : "products"}</button>
                      {check.summary.errors > 0 && <span className="text-muted small">Rows that need fixing are skipped. Fix them in your sheet, choose it again and re-check.</span>}
                    </div>
                  )}
                </div>
              </section>
            )}

            {report && (
              <section className="customer-panel bulk-step bulk-done">
                <span className="bulk-step-number">✓</span>
                <div className="bulk-step-body">
                  <header className="customer-panel-header"><div><h2>{report.message}</h2><p>{report.created} added · {report.updated} updated · {report.skipped.length + report.failed.length} skipped</p></div></header>
                  {report.saved.length > 0 && (
                    <ul className="bulk-saved">
                      {report.saved.slice(0, 8).map((item) => (
                        <li key={item.product_id}>
                          <Link to={config.editProductPath(item.product_id)}>{item.title}</Link>
                          <small>{item.sku} · {item.action === "create" ? "added" : "updated"}{item.approval_status === "pending" ? " · in review" : ""}</small>
                        </li>
                      ))}
                      {report.saved.length > 8 && <li className="text-muted">and {report.saved.length - 8} more</li>}
                    </ul>
                  )}
                  {[...report.skipped, ...report.failed].length > 0 && (
                    <div className="alert alert-warning mt-3 mb-0">
                      <strong>Skipped rows</strong>
                      <ul className="mb-0">{[...report.skipped, ...report.failed].map((row) => <li key={`${row.row}-${row.sku}`}>Row {row.row}{row.sku ? ` (${row.sku})` : ""}: {row.errors[0]}</li>)}</ul>
                    </div>
                  )}
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <Link to={config.productsPath} className="btn btn-primary">View products</Link>
                    <button type="button" className="btn btn-outline-secondary" onClick={startOver}>Upload another sheet</button>
                  </div>
                </div>
              </section>
            )}

            {lists && <p className="bulk-hint mt-3">Up to {lists.max_rows} products and {lists.max_images} photos per product in each upload. Prices are in rupees ({formatPrice(1499)} is written 1499).</p>}
          </main>
        </div>
      </div>
    </Layout>
  );
};

export default BulkProducts;
