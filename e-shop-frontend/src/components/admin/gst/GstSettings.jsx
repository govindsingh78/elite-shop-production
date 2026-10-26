import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { GST_RATES, gstRequest } from "./gst";

const asForm = (settings) => ({
  legal_name: settings.legal_name || "",
  gstin: settings.gstin || "",
  address: settings.address || "",
  state_code: settings.state_code || "",
  invoice_prefix: settings.invoice_prefix || "EZ",
  default_rate: String(Number(settings.default_rate ?? 5)),
  default_rate_high: settings.default_rate_high == null ? "" : String(Number(settings.default_rate_high)),
  default_threshold: settings.default_threshold == null ? "" : String(Number(settings.default_threshold)),
  shipping_rate: String(Number(settings.shipping_rate ?? 18)),
});

/** The store's GST registration, invoice numbering and default rates. */
const GstSettings = () => {
  const [values, setValues] = useState(null);
  const [states, setStates] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    gstRequest("admin", "/admin/gst/settings")
      .then((data) => { setValues(asForm(data.settings)); setStates(data.states); })
      .catch((error) => setLoadError(error.message));
  }, []);

  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));
  const fieldError = (name) => errors[name] && <div className="invalid-feedback d-block">{errors[name]}</div>;

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const data = await gstRequest("admin", "/admin/gst/settings", {
        method: "PUT",
        body: {
          ...values,
          gstin: values.gstin.trim().toUpperCase() || null,
          state_code: values.state_code || null,
          invoice_prefix: values.invoice_prefix.trim().toUpperCase(),
          default_rate: Number(values.default_rate),
          default_rate_high: values.default_rate_high === "" ? null : Number(values.default_rate_high),
          default_threshold: values.default_threshold === "" ? null : Number(values.default_threshold),
          shipping_rate: Number(values.shipping_rate),
        },
      });
      setValues(asForm(data.settings));
      toast.success(data.message);
    } catch (error) {
      setErrors(error.fields || {});
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="container py-5"><div className="d-flex"><Sidebar /><main className="container-fluid p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-4">
          <div>
            <h2 className="mb-1">GST settings</h2>
            <p className="text-muted mb-0">Elitezaar’s registration for its own sales and delivery charges, and the rates products use unless their category or listing says otherwise.</p>
          </div>
          <Link to="/admin/invoices" className="btn btn-outline-secondary">← Invoices</Link>
        </div>
        {loadError && <div className="alert alert-danger" role="alert">{loadError}</div>}
        {!values && !loadError && <p role="status">Loading…</p>}
        {values && (
          <form onSubmit={save} noValidate className="gst-settings">
            <section className="card shadow-sm mb-4"><div className="card-body">
              <h5 className="mb-3">Business details on invoices</h5>
              <div className="row g-3">
                <div className="col-md-6">
                  <label htmlFor="legal_name" className="form-label">Legal name</label>
                  <input id="legal_name" className={`form-control ${errors.legal_name ? "is-invalid" : ""}`} value={values.legal_name} onChange={set("legal_name")} />
                  {fieldError("legal_name")}
                </div>
                <div className="col-md-6">
                  <label htmlFor="gstin" className="form-label">GSTIN</label>
                  <input id="gstin" className={`form-control text-uppercase ${errors.gstin ? "is-invalid" : ""}`} maxLength={15} value={values.gstin} onChange={set("gstin")} placeholder="Leave blank if not registered" />
                  {fieldError("gstin")}
                  <div className="form-text">Without a GSTIN, Elitezaar’s invoices are bills of supply with no GST.</div>
                </div>
                <div className="col-md-8">
                  <label htmlFor="address" className="form-label">Registered address</label>
                  <textarea id="address" rows="2" className={`form-control ${errors.address ? "is-invalid" : ""}`} value={values.address} onChange={set("address")} />
                  {fieldError("address")}
                </div>
                <div className="col-md-4">
                  <label htmlFor="state_code" className="form-label">State</label>
                  <select id="state_code" className={`form-select ${errors.state_code ? "is-invalid" : ""}`} value={values.state_code} onChange={set("state_code")}>
                    <option value="">{values.gstin ? "From the GSTIN" : "Choose…"}</option>
                    {states.map((state) => <option key={state.code} value={state.code}>{state.name} ({state.code})</option>)}
                  </select>
                  {fieldError("state_code")}
                </div>
                <div className="col-md-4">
                  <label htmlFor="invoice_prefix" className="form-label">Invoice number prefix</label>
                  <input id="invoice_prefix" className={`form-control text-uppercase ${errors.invoice_prefix ? "is-invalid" : ""}`} maxLength={6} value={values.invoice_prefix} onChange={set("invoice_prefix")} />
                  {fieldError("invoice_prefix")}
                  <div className="form-text">Numbers look like {(values.invoice_prefix || "EZ").toUpperCase()}/2627/0001 and restart each April. Sellers’ invoices start S and their seller number.</div>
                </div>
              </div>
            </div></section>

            <section className="card shadow-sm mb-4"><div className="card-body">
              <h5 className="mb-1">Default GST rates</h5>
              <p className="text-muted small">Used for products whose category has no rate of its own. Prices include GST. Check rates with your accountant.</p>
              <div className="row g-3">
                <div className="col-md-3">
                  <label htmlFor="default_rate" className="form-label">Rate</label>
                  <select id="default_rate" className="form-select" value={values.default_rate} onChange={set("default_rate")}>
                    {GST_RATES.map((rate) => <option key={rate} value={String(rate)}>{rate}%</option>)}
                  </select>
                </div>
                <div className="col-md-5">
                  <label htmlFor="default_rate_high" className="form-label">Higher rate above a price per piece</label>
                  <div className="input-group">
                    <select id="default_rate_high" className={`form-select ${errors.default_rate_high ? "is-invalid" : ""}`} value={values.default_rate_high} onChange={set("default_rate_high")}>
                      <option value="">None</option>
                      {GST_RATES.map((rate) => <option key={rate} value={String(rate)}>{rate}%</option>)}
                    </select>
                    <span className="input-group-text">above ₹</span>
                    <input className={`form-control ${errors.default_threshold ? "is-invalid" : ""}`} type="number" min="1" value={values.default_threshold} onChange={set("default_threshold")} aria-label="Price per piece before GST" />
                  </div>
                  {fieldError("default_rate_high")}{fieldError("default_threshold")}
                  <div className="form-text">Clothing and footwear: 5%, or 18% above ₹2,500 a piece before GST.</div>
                </div>
                <div className="col-md-4">
                  <label htmlFor="shipping_rate" className="form-label">GST on delivery charges</label>
                  <select id="shipping_rate" className="form-select" value={values.shipping_rate} onChange={set("shipping_rate")}>
                    {GST_RATES.map((rate) => <option key={rate} value={String(rate)}>{rate}%</option>)}
                  </select>
                </div>
              </div>
              <p className="small text-muted mt-3 mb-0">Set HSN codes and rates for each category under <Link to="/admin/manage-categories">Categories</Link>; a product can override its category in its own form.</p>
            </div></section>

            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save GST settings"}</button>
          </form>
        )}
      </main></div></div>
    </Layout>
  );
};

export default GstSettings;
