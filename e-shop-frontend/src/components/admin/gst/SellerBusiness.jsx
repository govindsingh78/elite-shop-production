import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { gstRequest } from "./gst";

const asForm = (business) => ({
  legal_name: business.legal_name || "",
  gstin: business.gstin || "",
  business_address: business.business_address || "",
  business_state: business.business_state || "",
  pickup_pincode: business.pickup_pincode || "",
});

/** A seller's business and GST details, printed on the invoices issued for their sales. */
const SellerBusiness = () => {
  const [values, setValues] = useState(null);
  const [storeName, setStoreName] = useState("");
  const [states, setStates] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    gstRequest("vendor", "/vendor/business")
      .then((data) => { setValues(asForm(data.business)); setStoreName(data.business.name); setStates(data.states); })
      .catch((error) => setLoadError(error.message));
  }, []);

  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.value }));
  const fieldError = (name) => errors[name] && <div className="invalid-feedback d-block">{errors[name]}</div>;

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const data = await gstRequest("vendor", "/vendor/business", {
        method: "PUT",
        body: { ...values, gstin: values.gstin.trim().toUpperCase(), business_state: values.business_state || null, pickup_pincode: values.pickup_pincode || null },
      });
      setValues(asForm(data.business));
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
      <div className="container py-5"><div className="d-flex admin-dashboard-layout"><Sidebar variant="vendor" /><main className="container-fluid p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-4">
          <div>
            <h2 className="mb-1">Business & GST</h2>
            <p className="text-muted mb-0">These details appear on the invoices Elitezaar issues for your sales, as the seller.</p>
          </div>
          <Link to="/vendor/invoices" className="btn btn-outline-secondary">Your invoices →</Link>
        </div>
        {loadError && <div className="alert alert-danger" role="alert">{loadError}</div>}
        {!values && !loadError && <p role="status">Loading…</p>}
        {values && (
          <form onSubmit={save} noValidate className="card shadow-sm"><div className="card-body">
            <div className={`alert ${values.gstin ? "alert-success" : "alert-warning"} small`}>
              {values.gstin
                ? "With a GSTIN, your invoices are tax invoices showing GST (CGST + SGST in your state, IGST elsewhere)."
                : "Without a GSTIN, your invoices are bills of supply and no GST is charged on your products. Most online sellers need to register; ask your accountant."}
            </div>
            <div className="row g-3">
              <div className="col-md-6">
                <label htmlFor="legal_name" className="form-label">Legal name</label>
                <input id="legal_name" className={`form-control ${errors.legal_name ? "is-invalid" : ""}`} value={values.legal_name} onChange={set("legal_name")} placeholder={storeName} />
                {fieldError("legal_name")}
                <div className="form-text">As registered. Your store name ({storeName}) shows too.</div>
              </div>
              <div className="col-md-6">
                <label htmlFor="gstin" className="form-label">GSTIN</label>
                <input id="gstin" className={`form-control text-uppercase ${errors.gstin ? "is-invalid" : ""}`} maxLength={15} value={values.gstin} onChange={set("gstin")} placeholder="e.g. 08ABCDE1234F1Z5" />
                {fieldError("gstin")}
              </div>
              <div className="col-md-8">
                <label htmlFor="business_address" className="form-label">Registered business address</label>
                <textarea id="business_address" rows="2" className={`form-control ${errors.business_address ? "is-invalid" : ""}`} value={values.business_address} onChange={set("business_address")} />
                {fieldError("business_address")}
              </div>
              <div className="col-md-4">
                <label htmlFor="business_state" className="form-label">State</label>
                <select id="business_state" className={`form-select ${errors.business_state ? "is-invalid" : ""}`} value={values.business_state} onChange={set("business_state")}>
                  <option value="">{values.gstin ? "From the GSTIN" : "Choose…"}</option>
                  {states.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}
                </select>
                {fieldError("business_state")}
              </div>
              <div className="col-md-4">
                <label htmlFor="pickup_pincode" className="form-label">Pickup PIN code</label>
                <input id="pickup_pincode" inputMode="numeric" maxLength={6} className={`form-control ${errors.pickup_pincode ? "is-invalid" : ""}`} value={values.pickup_pincode} onChange={(event) => setValues((current) => ({ ...current, pickup_pincode: event.target.value.replace(/\D/g, "") }))} placeholder="e.g. 302016" />
                {fieldError("pickup_pincode")}
                <div className="form-text">Where couriers collect your parcels. Shoppers see delivery dates worked out from here (only your state is shown).</div>
              </div>
            </div>
            <button type="submit" className="btn btn-primary mt-4" disabled={saving}>{saving ? "Saving…" : "Save details"}</button>
          </div></form>
        )}
      </main></div></div>
    </Layout>
  );
};

export default SellerBusiness;
