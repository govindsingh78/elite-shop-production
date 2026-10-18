import React, { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { AdminAuthContext } from "../context/AdminAuth";
import CustomerShell from "./CustomerShell";
import AddressFields from "./AddressFields";
import { customerRequest } from "./customerApi";

const blankAddress = (user) => ({
  label: "Home", full_name: user?.name || "", phone: user?.phone || "", address: "", city: "", state: "", postal_code: "", country: "India", is_default: false,
});

const CustomerAddresses = () => {
  const { user } = useContext(AdminAuthContext);
  const profile = user?.user;
  const [addresses, setAddresses] = useState(null);
  const [editing, setEditing] = useState(null); // null = closed, "new" or an address id
  const [form, setForm] = useState(blankAddress(profile));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => customerRequest("addresses").then(setAddresses).catch((requestError) => setError(requestError.message));

  useEffect(() => { load(); }, []);

  const openForm = (address) => {
    setEditing(address ? address.id : "new");
    setForm(address ? { ...address } : blankAddress(profile));
    setErrors({});
  };

  const change = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const isNew = editing === "new";
      const result = await customerRequest(isNew ? "addresses" : `addresses/${editing}`, { method: isNew ? "POST" : "PUT", body: form });
      toast.success(result.message);
      setEditing(null);
      await load();
    } catch (requestError) {
      setErrors(requestError.errors || {});
      toast.error(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const makeDefault = async (address) => {
    try {
      const result = await customerRequest(`addresses/${address.id}/default`, { method: "PATCH" });
      toast.success(result.message);
      await load();
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  const remove = async (address) => {
    if (!window.confirm(`Remove the “${address.label}” address?`)) return;
    try {
      const result = await customerRequest(`addresses/${address.id}`, { method: "DELETE" });
      toast.success(result.message);
      await load();
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  const formPanel = (
    <section className="customer-panel customer-address-form">
      <header className="customer-panel-header"><div><h2>{editing === "new" ? "Add a new address" : "Edit address"}</h2><p>We’ll use this for deliveries.</p></div></header>
      <form onSubmit={save}>
        <AddressFields values={form} errors={errors} onChange={change} idPrefix="book" />
        {!(editing !== "new" && addresses?.find((address) => address.id === editing)?.is_default) && (
          <div className="form-check mt-3">
            <input id="book-default" name="is_default" type="checkbox" className="form-check-input" checked={!!form.is_default} onChange={change} />
            <label htmlFor="book-default" className="form-check-label">Make this my default delivery address</label>
          </div>
        )}
        <div className="d-flex gap-2 mt-4">
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save address"}</button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
        </div>
      </form>
    </section>
  );

  return (
    <CustomerShell>
      <div className="customer-page-head customer-page-head--split">
        <div>
          <span className="customer-eyebrow">ADDRESS BOOK</span>
          <h1>Delivery addresses</h1>
          <p>Your default address is pre-filled at checkout.</p>
        </div>
        {editing === null && <button type="button" className="btn btn-primary admin-dashboard-create" onClick={() => openForm(null)}>＋ Add address</button>}
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {editing === "new" && formPanel}
      {!addresses && !error && <div className="customer-skeleton-list">{[0, 1].map((key) => <span key={key} />)}</div>}

      <div className="row g-3">
        {addresses?.map((address) => (
          editing === address.id ? <div className="col-12" key={address.id}>{formPanel}</div> : (
            <div className="col-md-6" key={address.id}>
              <article className={`customer-address-card${address.is_default ? " is-default" : ""}`}>
                <div className="customer-address-card-top">
                  <span className="customer-address-label">{address.label}</span>
                  {address.is_default && <span className="customer-default-badge">Default</span>}
                </div>
                <address className="customer-address-preview">
                  <strong>{address.full_name}</strong>
                  <span>{address.address}</span>
                  <span>{address.city}, {address.state} {address.postal_code}</span>
                  <span>{address.country}</span>
                  <small>☎ {address.phone}</small>
                </address>
                <div className="customer-address-actions">
                  <button type="button" onClick={() => openForm(address)}>Edit</button>
                  {!address.is_default && <button type="button" onClick={() => makeDefault(address)}>Set as default</button>}
                  {addresses.length > 1 && <button type="button" className="is-danger" onClick={() => remove(address)}>Remove</button>}
                </div>
              </article>
            </div>
          )
        ))}
      </div>
    </CustomerShell>
  );
};

export default CustomerAddresses;
