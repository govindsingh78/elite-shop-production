import React from "react";

const roles = ["customer", "seller", "admin", "superadmin"];

const UserForm = ({ values, onChange, onSubmit, errors = {}, loading, editing = false }) => (
  <form onSubmit={onSubmit} noValidate>
    <div className="mb-3">
      <label htmlFor="name" className="form-label">Name</label>
      <input
        id="name"
        name="name"
        className={`form-control ${errors.name ? "is-invalid" : ""}`}
        value={values.name}
        onChange={onChange}
        maxLength={255}
        autoComplete="name"
        required
      />
      {errors.name && <div className="invalid-feedback">{errors.name}</div>}
    </div>

    <div className="mb-3">
      <label htmlFor="email" className="form-label">Email</label>
      <input
        id="email"
        name="email"
        type="email"
        className={`form-control ${errors.email ? "is-invalid" : ""}`}
        value={values.email}
        onChange={onChange}
        maxLength={255}
        autoComplete="email"
        required
      />
      {errors.email && <div className="invalid-feedback">{errors.email}</div>}
    </div>

    <div className="mb-3">
      <label htmlFor="role" className="form-label">Role</label>
      <select
        id="role"
        name="role"
        className={`form-select ${errors.role ? "is-invalid" : ""}`}
        value={values.role}
        onChange={onChange}
        required
      >
        {roles.map((role) => <option key={role} value={role}>{role}</option>)}
      </select>
      {errors.role && <div className="invalid-feedback">{errors.role}</div>}
    </div>

    <div className="mb-3">
      <label htmlFor="password" className="form-label">
        {editing ? "New password (optional)" : "Password"}
      </label>
      <input
        id="password"
        name="password"
        type="password"
        className={`form-control ${errors.password ? "is-invalid" : ""}`}
        value={values.password}
        onChange={onChange}
        autoComplete="new-password"
        minLength={8}
        required={!editing}
      />
      {errors.password && <div className="invalid-feedback">{errors.password}</div>}
      {editing && <div className="form-text">Leave blank to keep the current password.</div>}
    </div>

    <div className="mb-3">
      <label htmlFor="password_confirmation" className="form-label">
        {editing ? "Confirm new password" : "Confirm password"}
      </label>
      <input
        id="password_confirmation"
        name="password_confirmation"
        type="password"
        className={`form-control ${errors.password_confirmation ? "is-invalid" : ""}`}
        value={values.password_confirmation}
        onChange={onChange}
        autoComplete="new-password"
        minLength={8}
        required={!editing || Boolean(values.password)}
      />
      {errors.password_confirmation && <div className="invalid-feedback">{errors.password_confirmation}</div>}
    </div>

    {errors.general && <div className="alert alert-danger" role="alert">{errors.general}</div>}

    <button type="submit" className="btn btn-primary" disabled={loading}>
      {loading ? "Saving..." : editing ? "Save changes" : "Create user"}
    </button>
  </form>
);

export default UserForm;
