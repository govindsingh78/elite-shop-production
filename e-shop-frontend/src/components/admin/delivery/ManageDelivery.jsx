import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { commissionRequest } from "../commissions/commissions";

const request = (path, options) => commissionRequest("admin", path, options);
const DAYS = [0, 1, 2, 3, 4, 5, 6, 7];
const ZONES = { local: "Same city", state: "Same state", regional: "Nearby state", national: "Across India", remote: "Hard-to-reach area" };
const emptyArea = { pincodes: "", name: "", deliverable: true, extra_days: 0 };

/**
 * Admin: where we deliver (everywhere in India apart from blocked areas, or only the areas listed), the PIN codes on
 * the list, Elitezaar's own dispatch PIN code and packing time, and a PIN code checker.
 */
const ManageDelivery = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      setData(await request(`/admin/delivery?${new URLSearchParams({ page: String(page), ...(search ? { search } : {}) })}`));
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex admin-dashboard-layout">
          <Sidebar />
          <main className="container-fluid admin-dashboard-content customer-content">
            <section className="customer-hero">
              <div>
                <span className="customer-eyebrow customer-eyebrow--light">SHIPPING</span>
                <h1>Delivery areas<span>.</span></h1>
                <p>Choose the PIN codes we deliver to. Shoppers check theirs on each product page, with an estimate from where it ships, and checkout refuses addresses we don’t deliver to.</p>
              </div>
            </section>
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            {data && (
              <div className="row g-4">
                <div className="col-xl-6"><SettingsPanel settings={data.settings} counts={data.counts} onSaved={load} /></div>
                <div className="col-xl-6"><CheckPanel storePincode={data.settings.store_pincode} /></div>
                <div className="col-12"><AddPanel onAdded={load} /></div>
                <div className="col-12">
                  <section className="customer-panel">
                    <header className="customer-panel-header">
                      <div><h2>The list</h2><p>{data.counts.all ? `${data.counts.deliverable} we deliver to · ${data.counts.blocked} we don’t. A PIN code’s most specific entry wins, so 302001 can be on while 30 is off.` : "Nothing listed yet."}</p></div>
                    </header>
                    <form className="seller-search" role="search" onSubmit={(event) => { event.preventDefault(); setSearch(searchInput.trim()); setPage(1); }}>
                      <label className="visually-hidden" htmlFor="delivery-search">Find a PIN code or name</label>
                      <input id="delivery-search" className="form-control" placeholder="PIN code or name" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
                      <button type="submit" className="btn btn-outline-primary">Search</button>
                    </form>
                    {data.data.length ? (
                      <ul className="delivery-areas">{data.data.map((area) => <AreaRow key={area.id} area={area} onChanged={load} />)}</ul>
                    ) : <p className="text-muted mb-0">{search ? "Nothing matches." : "Add PIN codes above."}</p>}
                    {data.last_page > 1 && (
                      <nav className="d-flex justify-content-between align-items-center mt-3" aria-label="Pages">
                        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                        <span>Page {data.current_page} of {data.last_page}</span>
                        <button type="button" className="btn btn-outline-secondary btn-sm" disabled={page >= data.last_page} onClick={() => setPage(page + 1)}>Next</button>
                      </nav>
                    )}
                  </section>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </Layout>
  );
};

const SettingsPanel = ({ settings, counts, onSaved }) => {
  const [values, setValues] = useState({ mode: settings.mode, store_pincode: settings.store_pincode || "", dispatch_days: String(settings.dispatch_days) });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const result = await request("/admin/delivery/settings", { method: "PUT", body: { ...values, store_pincode: values.store_pincode || null, dispatch_days: Number(values.dispatch_days) } });
      toast.success(result.message);
      onSaved();
    } catch (requestError) {
      setErrors(requestError.fieldErrors || {});
      toast.error(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="customer-panel h-100">
      <header className="customer-panel-header"><div><h2>Where we deliver</h2><p>Applies to Indian addresses.</p></div></header>
      <form onSubmit={save}>
        {[
          ["all", "Everywhere in India", counts.blocked
            ? `Except the ${counts.blocked} ${counts.blocked === 1 ? "entry" : "entries"} marked “we don’t deliver” below.`
            : "Every Indian PIN code, unless you mark one “we don’t deliver” below."],
          ["listed", "Only the areas listed", `Just the ${counts.deliverable} ${counts.deliverable === 1 ? "entry" : "entries"} marked “we deliver” below; every other address is refused.`],
        ].map(([mode, label, hint]) => (
          <label key={mode} className={`delivery-mode${values.mode === mode ? " is-active" : ""}`}>
            <input type="radio" name="delivery-mode" value={mode} checked={values.mode === mode} onChange={() => setValues({ ...values, mode })} />
            <span><strong>{label}</strong><small>{hint}</small></span>
          </label>
        ))}
        {errors.mode && <div className="text-danger small mb-2">{errors.mode}</div>}
        <div className="row g-3 mt-1">
          <div className="col-sm-6">
            <label htmlFor="store-pincode" className="form-label">Elitezaar dispatches from</label>
            <input id="store-pincode" className={`form-control ${errors.store_pincode ? "is-invalid" : ""}`} inputMode="numeric" maxLength={6} placeholder="PIN code" value={values.store_pincode} onChange={(event) => setValues({ ...values, store_pincode: event.target.value.replace(/\D/g, "") })} />
            {errors.store_pincode ? <div className="invalid-feedback">{errors.store_pincode}</div> : <div className="form-text">{settings.store_region ? `${settings.store_region}. ` : ""}For Elitezaar’s own products; sellers’ ship from their pickup PIN code.</div>}
          </div>
          <div className="col-sm-6">
            <label htmlFor="dispatch-days" className="form-label">Days to pack and hand over</label>
            <select id="dispatch-days" className="form-select" value={values.dispatch_days} onChange={(event) => setValues({ ...values, dispatch_days: event.target.value })}>
              {DAYS.map((day) => <option key={day} value={day}>{day === 0 ? "Same day" : `${day} day${day === 1 ? "" : "s"}`}</option>)}
            </select>
            <div className="form-text">Added to every estimate. Couriers deliver Monday to Saturday.</div>
          </div>
        </div>
        <button type="submit" className="btn btn-primary mt-3" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </form>
    </section>
  );
};

const CheckPanel = ({ storePincode }) => {
  const [pincode, setPincode] = useState("");
  const [from, setFrom] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const check = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);
    try {
      setResult(await request(`/admin/delivery/check?${new URLSearchParams({ pincode, ...(from ? { from } : {}) })}`));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <section className="customer-panel h-100">
      <header className="customer-panel-header"><div><h2>Check a PIN code</h2><p>What shoppers there see, from a pickup PIN code{storePincode ? ` (or Elitezaar’s, ${storePincode})` : ""}.</p></div></header>
      <form className="row g-2" onSubmit={check}>
        <div className="col-sm-5"><input className="form-control" inputMode="numeric" maxLength={6} placeholder="Deliver to" aria-label="Deliver to PIN code" value={pincode} onChange={(event) => setPincode(event.target.value.replace(/\D/g, ""))} required /></div>
        <div className="col-sm-4"><input className="form-control" inputMode="numeric" maxLength={6} placeholder="Ships from" aria-label="Ships from PIN code" value={from} onChange={(event) => setFrom(event.target.value.replace(/\D/g, ""))} /></div>
        <div className="col-sm-3"><button type="submit" className="btn btn-outline-primary w-100">Check</button></div>
      </form>
      {error && <p className="text-danger small mt-2 mb-0" role="alert">{error}</p>}
      {result && (
        <div className={`pd-delivery-result mt-3 ${result.deliverable ? "is-ok" : "is-no"}`} role="status">
          <span className="pd-delivery-icon" aria-hidden="true">{result.deliverable ? "✓" : "✕"}</span>
          <div>
            {result.deliverable ? <>
              <strong>{result.label} · {result.days.min === result.days.max ? result.days.max : `${result.days.min}–${result.days.max}`} days</strong>
              <span>{result.from ? `${result.from} → ` : ""}{result.to}{result.distance_km ? ` · about ${result.distance_km.toLocaleString("en-IN")} km` : ""} · {ZONES[result.zone] || result.zone}</span>
              <small>{result.area ? `Matches the list entry ${result.area}. ` : ""}{result.window}</small>
            </> : <strong>{result.message}</strong>}
          </div>
        </div>
      )}
    </section>
  );
};

const AddPanel = ({ onAdded }) => {
  const [values, setValues] = useState(emptyArea);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await request("/admin/delivery/areas", { method: "POST", body: { ...values, extra_days: Number(values.extra_days) } });
      toast.success(result.message);
      setValues(emptyArea);
      onAdded();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="customer-panel">
      <header className="customer-panel-header"><div><h2>Add PIN codes</h2><p>Full PIN codes, or their first digits for a whole area: 302 is Jaipur and around, 30 most of Rajasthan. Paste many at once, separated by commas or new lines.</p></div></header>
      <form className="row g-3" onSubmit={add}>
        <div className="col-lg-5">
          <label htmlFor="area-pincodes" className="form-label">PIN codes</label>
          <textarea id="area-pincodes" rows="3" className={`form-control ${error ? "is-invalid" : ""}`} placeholder="302001, 302016, 3030" value={values.pincodes} onChange={(event) => setValues({ ...values, pincodes: event.target.value })} required />
          {error && <div className="invalid-feedback">{error}</div>}
        </div>
        <div className="col-lg-7">
          <div className="row g-3">
            <div className="col-md-6">
              <label htmlFor="area-name" className="form-label">Name <span className="text-muted fw-normal">Optional</span></label>
              <input id="area-name" className="form-control" maxLength={80} placeholder="e.g. Jaipur city" value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} />
            </div>
            <div className="col-md-6">
              <span className="form-label d-block">We…</span>
              <div className="btn-group w-100" role="group" aria-label="Delivery">
                <input type="radio" className="btn-check" id="area-yes" checked={values.deliverable} onChange={() => setValues({ ...values, deliverable: true })} />
                <label className="btn btn-outline-success" htmlFor="area-yes">Deliver here</label>
                <input type="radio" className="btn-check" id="area-no" checked={!values.deliverable} onChange={() => setValues({ ...values, deliverable: false, extra_days: 0 })} />
                <label className="btn btn-outline-danger" htmlFor="area-no">Don’t deliver</label>
              </div>
            </div>
            {values.deliverable && (
              <div className="col-md-6">
                <label htmlFor="area-extra" className="form-label">Extra days</label>
                <select id="area-extra" className="form-select" value={values.extra_days} onChange={(event) => setValues({ ...values, extra_days: event.target.value })}>
                  {DAYS.map((day) => <option key={day} value={day}>{day === 0 ? "None" : `+${day} day${day === 1 ? "" : "s"}`}</option>)}
                </select>
                <div className="form-text">For places couriers reach slowly.</div>
              </div>
            )}
            <div className="col-md-6 d-flex align-items-end"><button type="submit" className="btn btn-primary w-100" disabled={saving}>{saving ? "Adding…" : "Add to the list"}</button></div>
          </div>
        </div>
      </form>
    </section>
  );
};

const AreaRow = ({ area, onChanged }) => {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ name: area.name || "", deliverable: area.deliverable, extra_days: area.extra_days });

  const save = async () => {
    try {
      toast.success((await request(`/admin/delivery/areas/${area.id}`, { method: "PUT", body: { ...values, extra_days: Number(values.extra_days) } })).message);
      setEditing(false);
      onChanged();
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Remove ${area.pincode} from the list?`)) return;
    try {
      toast.success((await request(`/admin/delivery/areas/${area.id}`, { method: "DELETE" })).message);
      onChanged();
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  return (
    <li className={area.deliverable ? "" : "is-blocked"}>
      <div className="delivery-area-code">
        <strong>{area.pincode}</strong>
        <small>{area.is_prefix ? `Every PIN code starting ${area.pincode}` : "One PIN code"}{area.region ? ` · ${area.region}` : ""}</small>
      </div>
      {editing ? (
        <div className="delivery-area-edit">
          <input className="form-control form-control-sm" maxLength={80} placeholder="Name" aria-label="Name" value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} />
          <select className="form-select form-select-sm" aria-label="Delivery" value={values.deliverable ? "yes" : "no"} onChange={(event) => setValues({ ...values, deliverable: event.target.value === "yes", extra_days: event.target.value === "yes" ? values.extra_days : 0 })}>
            <option value="yes">We deliver</option>
            <option value="no">We don’t deliver</option>
          </select>
          {values.deliverable && (
            <select className="form-select form-select-sm" aria-label="Extra days" value={values.extra_days} onChange={(event) => setValues({ ...values, extra_days: event.target.value })}>
              {DAYS.map((day) => <option key={day} value={day}>{day === 0 ? "No extra days" : `+${day} day${day === 1 ? "" : "s"}`}</option>)}
            </select>
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={save}>Save</button>
          <button type="button" className="btn btn-link btn-sm" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      ) : (
        <>
          <span className="delivery-area-name">{area.name || <span className="text-muted">—</span>}</span>
          <span className={`seller-status ${area.deliverable ? "is-approved" : "is-rejected"}`}>{area.deliverable ? `We deliver${area.extra_days ? ` · +${area.extra_days} day${area.extra_days === 1 ? "" : "s"}` : ""}` : "We don’t deliver"}</span>
          <span className="delivery-area-actions">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setEditing(true)}>Edit</button>
            <button type="button" className="btn btn-link btn-sm text-danger" onClick={remove}>Remove</button>
          </span>
        </>
      )}
    </li>
  );
};

export default ManageDelivery;
