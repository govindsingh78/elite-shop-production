import React from "react";
import LocationFields from "../common/LocationFields";
import { postalLabel } from "../common/geo";

const LABELS = ["Home", "Work", "Other"];

/** Delivery address inputs shared by registration and the address book. */
const AddressFields = ({ values, errors = {}, onChange, idPrefix = "address", showRecipient = true }) => {
  const field = (name, label, props = {}) => (
    <div className={props.wrapperClass || "col-md-6"}>
      <label htmlFor={`${idPrefix}-${name}`} className="form-label">{label}</label>
      {props.multiline ? (
        <textarea id={`${idPrefix}-${name}`} name={name} rows={2} className={`form-control ${errors[name] ? "is-invalid" : ""}`} value={values[name] || ""} onChange={onChange} required={props.required} autoComplete={props.autoComplete} placeholder={props.placeholder} maxLength={2000} />
      ) : (
        <input id={`${idPrefix}-${name}`} name={name} type={props.type || "text"} className={`form-control ${errors[name] ? "is-invalid" : ""}`} value={values[name] || ""} onChange={onChange} required={props.required} autoComplete={props.autoComplete} placeholder={props.placeholder} inputMode={props.inputMode} list={props.list} maxLength={props.maxLength || 255} />
      )}
      {errors[name] && <div className="invalid-feedback">{errors[name]}</div>}
    </div>
  );

  return (
    <div className="row g-3">
      <div className="col-12">
        <span className="form-label d-block">Save address as</span>
        <div className="customer-chip-group" role="radiogroup" aria-label="Address label">
          {LABELS.map((label) => (
            <label key={label} className={`customer-chip${(values.label || "Home") === label ? " is-active" : ""}`}>
              <input type="radio" name="label" value={label} checked={(values.label || "Home") === label} onChange={onChange} />
              {label}
            </label>
          ))}
        </div>
      </div>
      {showRecipient && field("full_name", "Recipient name", { required: true, autoComplete: "name" })}
      {showRecipient && field("phone", "Phone number", { type: "tel", required: true, autoComplete: "tel", inputMode: "tel", placeholder: "+91 98765 43210", maxLength: 40 })}
      {field("address", "House / flat, street and area", { multiline: true, required: true, autoComplete: "street-address", wrapperClass: "col-12", placeholder: "e.g. 12, MG Road, near City Mall" })}
      <LocationFields values={values} errors={errors} onChange={onChange} idPrefix={idPrefix} />
      {field("postal_code", postalLabel(values.country), { required: true, autoComplete: "postal-code", maxLength: 30 })}
    </div>
  );
};

export default AddressFields;
