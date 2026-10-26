import React from "react";
import { GST_RATES } from "./gst";

/**
 * HSN code and GST rate fields. Categories also get a higher rate above a price per piece (e.g. clothing:
 * 5%, or 18% above ₹2,500); products only set these when they differ from their category.
 */
const GstFields = ({ values, onChange, kind = "category", errors = {} }) => {
  const set = (name) => (event) => onChange({ ...values, [name]: event.target.value });
  const fieldError = (name) => errors[name] && <div className="invalid-feedback d-block">{errors[name]}</div>;
  const inherit = kind === "product" ? "Same as the category" : "Store default";

  return (
    <fieldset className="gst-fields">
      <legend>GST</legend>
      <div className="row g-3">
        <div className="col-sm-4">
          <label htmlFor={`${kind}-hsn`} className="form-label">HSN code</label>
          <input id={`${kind}-hsn`} className={`form-control ${errors.hsn_code ? "is-invalid" : ""}`} inputMode="numeric" maxLength={8} placeholder={kind === "product" ? "From the category" : "e.g. 6205"} value={values.hsn_code} onChange={set("hsn_code")} />
          {fieldError("hsn_code")}
        </div>
        <div className="col-sm-4">
          <label htmlFor={`${kind}-gst-rate`} className="form-label">GST rate</label>
          <select id={`${kind}-gst-rate`} className={`form-select ${errors.gst_rate ? "is-invalid" : ""}`} value={values.gst_rate} onChange={set("gst_rate")}>
            <option value="">{inherit}</option>
            {GST_RATES.map((rate) => <option key={rate} value={String(rate)}>{rate}%</option>)}
          </select>
          {fieldError("gst_rate")}
        </div>
        {kind === "category" && (
          <div className="col-sm-4">
            <label htmlFor="category-gst-high" className="form-label">Higher rate above a price</label>
            <div className="input-group">
              <select id="category-gst-high" className={`form-select ${errors.gst_rate_high ? "is-invalid" : ""}`} value={values.gst_rate_high} onChange={set("gst_rate_high")} aria-label="Higher GST rate">
                <option value="">None</option>
                {GST_RATES.map((rate) => <option key={rate} value={String(rate)}>{rate}%</option>)}
              </select>
              <span className="input-group-text">above ₹</span>
              <input className={`form-control ${errors.gst_threshold ? "is-invalid" : ""}`} type="number" min="1" step="1" placeholder="2500" value={values.gst_threshold} onChange={set("gst_threshold")} aria-label="Price per piece before GST" />
            </div>
            {fieldError("gst_rate_high")}{fieldError("gst_threshold")}
          </div>
        )}
      </div>
      <div className="form-text">
        {kind === "product"
          ? "Leave blank to use the category’s HSN code and rate. Prices you enter include GST."
          : "Prices include GST. For clothing and footwear, 5% applies up to ₹2,500 a piece (before GST) and 18% above. Subcategories without their own rate use this one. Check rates with your accountant."}
      </div>
    </fieldset>
  );
};

export default GstFields;
