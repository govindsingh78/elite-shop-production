import React from "react";

const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

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
      {field("city", "City", { required: true, autoComplete: "address-level2", maxLength: 120 })}
      {field("state", "State", { required: true, autoComplete: "address-level1", list: `${idPrefix}-states`, maxLength: 120 })}
      {field("postal_code", "PIN code", { required: true, autoComplete: "postal-code", inputMode: "numeric", maxLength: 30 })}
      {field("country", "Country", { autoComplete: "country-name", maxLength: 120 })}
      <datalist id={`${idPrefix}-states`}>{INDIAN_STATES.map((state) => <option key={state} value={state} />)}</datalist>
    </div>
  );
};

export default AddressFields;
