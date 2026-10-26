import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { apiUrl } from "../../common/http";

const request = async (path, { method = "GET", body } = {}) => {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("adminToken") || ""}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Object.values(data.errors || {})[0]?.[0] || data.message || "Something went wrong. Please try again.");
  return data;
};

/** The sizes sellers and the store can offer products in, in the order shoppers see them. */
const ManageSizes = () => {
  const [sizes, setSizes] = useState(null);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => request("/sizes")
    .then((data) => { setSizes(data); setError(""); })
    .catch((loadError) => setError(loadError.message)), []);

  useEffect(() => { load(); }, [load]);

  const run = async (action) => {
    setBusy(true);
    try {
      const data = await action();
      if (data?.message) toast.success(data.message);
      await load();
      return true;
    } catch (actionError) {
      toast.error(actionError.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (event) => {
    event.preventDefault();
    if (!newName.trim()) return;
    if (await run(() => request("/sizes", { method: "POST", body: { name: newName.trim() } }))) setNewName("");
  };

  const saveName = async (event) => {
    event.preventDefault();
    if (await run(() => request(`/sizes/${editing.id}`, { method: "PUT", body: { name: editing.name.trim(), sort_order: editing.sort_order } }))) setEditing(null);
  };

  /** Swaps a size with its neighbour, so shoppers see sizes in a sensible order. */
  const move = (index, step) => {
    const order = [...sizes];
    [order[index], order[index + step]] = [order[index + step], order[index]];
    // Number the list 10, 20, 30… and save only the sizes whose position changed (usually just the two).
    run(async () => {
      for (const [position, size] of order.entries()) {
        if (size.sort_order !== (position + 1) * 10) {
          await request(`/sizes/${size.id}`, { method: "PUT", body: { name: size.name, sort_order: (position + 1) * 10 } });
        }
      }
    });
  };

  const remove = (size) => {
    if (!window.confirm(`Delete size ${size.name}?`)) return;
    run(() => request(`/sizes/${size.id}`, { method: "DELETE" }));
  };

  return (
    <Layout>
      <div className="container py-5"><div className="d-flex"><Sidebar /><main className="container-fluid p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
          <div>
            <h2 className="mb-1">Sizes</h2>
            <p className="text-muted mb-0">The sizes products can be sold in. Shoppers see them in this order; sellers pick from this list.</p>
          </div>
        </div>

        <form className="size-add card shadow-sm mb-3" onSubmit={add}>
          <div className="card-body d-flex flex-wrap gap-2 align-items-end">
            <div className="flex-grow-1">
              <label htmlFor="new-size" className="form-label mb-1">Add a size</label>
              <input id="new-size" className="form-control" value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={60} placeholder="e.g. UK 8, 32, 2–3 years" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy || !newName.trim()}>Add size</button>
          </div>
        </form>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {!sizes && !error && <p role="status">Loading sizes…</p>}
        {sizes && (
          <div className="card shadow-sm"><div className="table-responsive">
            <table className="table align-middle mb-0 size-table">
              <thead><tr><th>Order</th><th>Size</th><th>Used by</th><th className="text-end">Actions</th></tr></thead>
              <tbody>
                {sizes.map((size, index) => (
                  <tr key={size.id}>
                    <td className="size-order">
                      <button type="button" className="btn btn-sm btn-light" onClick={() => move(index, -1)} disabled={busy || index === 0} aria-label={`Move ${size.name} up`}>↑</button>
                      <button type="button" className="btn btn-sm btn-light" onClick={() => move(index, 1)} disabled={busy || index === sizes.length - 1} aria-label={`Move ${size.name} down`}>↓</button>
                    </td>
                    <td>
                      {editing?.id === size.id ? (
                        <form className="d-flex gap-2" onSubmit={saveName}>
                          <input className="form-control form-control-sm" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} maxLength={60} aria-label="Size name" autoFocus />
                          <button type="submit" className="btn btn-sm btn-primary" disabled={busy || !editing.name.trim()}>Save</button>
                          <button type="button" className="btn btn-sm btn-link" onClick={() => setEditing(null)}>Cancel</button>
                        </form>
                      ) : <strong className="size-chip">{size.name}</strong>}
                    </td>
                    <td className="text-muted">{size.products_count ? `${size.products_count} ${size.products_count === 1 ? "product" : "products"}` : "Not used yet"}</td>
                    <td className="text-end text-nowrap">
                      <button type="button" className="btn btn-sm btn-outline-primary me-2" onClick={() => setEditing({ id: size.id, name: size.name, sort_order: size.sort_order })} disabled={busy}>Rename</button>
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(size)} disabled={busy || size.products_count > 0} title={size.products_count ? "In use: remove it from those products first" : undefined}>Delete</button>
                    </td>
                  </tr>
                ))}
                {!sizes.length && <tr><td colSpan="4" className="text-center text-muted py-4">No sizes yet. Add the first one above.</td></tr>}
              </tbody>
            </table>
          </div></div>
        )}
      </main></div></div>
    </Layout>
  );
};

export default ManageSizes;
