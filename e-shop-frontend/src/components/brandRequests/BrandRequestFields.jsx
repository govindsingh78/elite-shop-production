import React from "react";

/** One brand to ask for: its name, written the way the brand writes it, and an optional note. */
export const BrandRequestFields = ({ id, value, onChange, errors = {}, onRemove }) => {
  const set = (field) => (event) => onChange({ ...value, [field]: event.target.value });

  return (
    <div className="category-ask-row">
      <div className="row g-2">
        <div className="col-md-6">
          <label htmlFor={`${id}-name`} className="form-label">Brand you need</label>
          <input id={`${id}-name`} className={`form-control ${errors.name ? "is-invalid" : ""}`} maxLength={60} placeholder="e.g. Loom Craft" value={value.name} onChange={set("name")} />
          {errors.name && <div className="invalid-feedback">{errors.name}</div>}
        </div>
        <div className="col-md-6">
          <label htmlFor={`${id}-note`} className="form-label">What do you sell under it? <span className="text-muted fw-normal">Optional</span></label>
          <input id={`${id}-note`} className={`form-control ${errors.note ? "is-invalid" : ""}`} maxLength={300} placeholder="e.g. My own label of handloom sarees" value={value.note} onChange={set("note")} />
          {errors.note && <div className="invalid-feedback">{errors.note}</div>}
        </div>
      </div>
      {onRemove && (
        <div className="category-ask-foot">
          <button type="button" className="btn btn-link btn-sm text-danger ms-auto" onClick={onRemove}>Remove</button>
        </div>
      )}
    </div>
  );
};
