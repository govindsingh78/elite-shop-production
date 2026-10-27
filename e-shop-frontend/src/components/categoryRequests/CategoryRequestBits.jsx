import React from "react";
import { REQUEST_STATUSES } from "./categoryRequests";

export const RequestStatusBadge = ({ status }) => (
  <span className={`seller-status is-${REQUEST_STATUSES[status]?.tone || status}`}>{REQUEST_STATUSES[status]?.label || status}</span>
);

/**
 * One category to ask for: its name, where it goes (under a main collection, or a new main collection) and an
 * optional note. Shows what's already there, so sellers can spot a category that exists. `categories` is the
 * storefront tree (main collections with their subcategories).
 */
export const CategoryRequestFields = ({ id, value, onChange, errors = {}, categories, onRemove }) => {
  const parent = categories.find((category) => String(category.id) === String(value.parent_id));
  const existing = parent ? (parent.children || []).map((child) => child.name) : categories.map((category) => category.name);
  const set = (field) => (event) => onChange({ ...value, [field]: event.target.value });

  return (
    <div className="category-ask-row">
      <div className="row g-2">
        <div className="col-md-6">
          <label htmlFor={`${id}-name`} className="form-label">Category you need</label>
          <input id={`${id}-name`} className={`form-control ${errors.name ? "is-invalid" : ""}`} maxLength={60} placeholder="e.g. Footwear" value={value.name} onChange={set("name")} />
          {errors.name && <div className="invalid-feedback">{errors.name}</div>}
        </div>
        <div className="col-md-6">
          <label htmlFor={`${id}-parent`} className="form-label">Where it goes</label>
          <select id={`${id}-parent`} className={`form-select ${errors.parent_id ? "is-invalid" : ""}`} value={value.parent_id} onChange={set("parent_id")}>
            <option value="">A new main collection</option>
            {categories.map((category) => <option key={category.id} value={category.id}>Under {category.name}</option>)}
          </select>
          {errors.parent_id && <div className="invalid-feedback">{errors.parent_id}</div>}
        </div>
        <div className="col-12">
          <label htmlFor={`${id}-note`} className="form-label">What will you sell in it? <span className="text-muted fw-normal">Optional</span></label>
          <input id={`${id}-note`} className={`form-control ${errors.note ? "is-invalid" : ""}`} maxLength={300} placeholder="e.g. School shoes and sandals for ages 3 to 12" value={value.note} onChange={set("note")} />
          {errors.note && <div className="invalid-feedback">{errors.note}</div>}
        </div>
      </div>
      <div className="category-ask-foot">
        {existing.length > 0 && <p>{parent ? `Already in ${parent.name}: ` : "Main collections now: "}{existing.join(", ")}</p>}
        {onRemove && <button type="button" className="btn btn-link btn-sm text-danger" onClick={onRemove}>Remove</button>}
      </div>
    </div>
  );
};
