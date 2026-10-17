import React from "react";

const ShippingMethodForm = ({
  values,
  onChange,
  onSubmit,
  loading,
  submitLabel,
  errors = {},
}) => (
  <form onSubmit={onSubmit} noValidate>
    <div className="mb-3">
      <label htmlFor="name" className="form-label">Shipping method name</label>
      <input
        id="name"
        name="name"
        type="text"
        className={`form-control ${errors.name ? "is-invalid" : ""}`}
        value={values.name}
        onChange={onChange}
        maxLength={255}
        required
      />
      {errors.name && <div className="invalid-feedback">{errors.name}</div>}
    </div>

    <div className="mb-3">
      <label htmlFor="price" className="form-label">Shipping price</label>
      <input
        id="price"
        name="price"
        type="number"
        className={`form-control ${errors.price ? "is-invalid" : ""}`}
        value={values.price}
        onChange={onChange}
        min="0"
        step="0.01"
        required
      />
      {errors.price && <div className="invalid-feedback">{errors.price}</div>}
    </div>

    <div className="mb-3">
      <label htmlFor="status" className="form-label">Status</label>
      <select
        id="status"
        name="status"
        className="form-select"
        value={values.status}
        onChange={onChange}
        required
      >
        <option value="1">Active</option>
        <option value="0">Inactive</option>
      </select>
    </div>

    {errors.general && <div className="alert alert-danger" role="alert">{errors.general}</div>}

    <button type="submit" className="btn btn-primary" disabled={loading}>
      {loading ? "Saving..." : submitLabel}
    </button>
  </form>
);

export default ShippingMethodForm;
