import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { formatPrice } from "../../common/currency";
import { commissionRequest, formatDay } from "../commissions/commissions";

const request = (path, options) => commissionRequest("admin", path, options);
const TABS = [["active", "Active"], ["scheduled", "Scheduled"], ["expired", "Expired"], ["paused", "Paused"], ["all", "All"]];
const STATES = { active: ["Active", "is-approved"], scheduled: ["Scheduled", "is-pending"], expired: ["Expired", "is-rejected"], paused: ["Paused", "is-deactivated"], used_up: ["Used up", "is-rejected"] };
const emptyForm = {
  code: "", title: "", description: "", terms: "", type: "percent", value: "", max_discount: "", min_order: "", starts_on: "", ends_on: "",
  usage_limit: "", per_customer_limit: "1", first_order_only: false, show_on_product: true, funded_by: "store", status: true,
  covers: "all", category_ids: [], products: [],
};
const asForm = (coupon) => ({
  ...emptyForm,
  ...Object.fromEntries(Object.entries(coupon).filter(([key]) => key in emptyForm).map(([key, value]) => [key, value ?? emptyForm[key]])),
  value: String(coupon.value ?? ""), max_discount: coupon.max_discount == null ? "" : String(coupon.max_discount), min_order: coupon.min_order == null ? "" : String(coupon.min_order),
  usage_limit: coupon.usage_limit == null ? "" : String(coupon.usage_limit), per_customer_limit: coupon.per_customer_limit == null ? "" : String(coupon.per_customer_limit),
  covers: coupon.category_ids?.length || coupon.product_ids?.length ? "select" : "all",
  category_ids: coupon.category_ids || [], products: coupon.products || [],
});
const number = (value) => (value === "" ? null : Number(value));

/** Admin: coupon codes — what they take off and on what, for how long and how often, who pays, and how they've been used. */
const ManageCoupons = () => {
  const [filters, setFilters] = useState({ state: "active", search: "", page: 1 });
  const [searchInput, setSearchInput] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  // null (closed), "new", or the coupon being edited.
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await request(`/admin/coupons?${new URLSearchParams({ state: filters.state, page: String(filters.page), ...(filters.search ? { search: filters.search } : {}) })}`));
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (coupon, status) => {
    try {
      toast.success((await request(`/admin/coupons/${coupon.id}/status`, { method: "PATCH", body: { status } })).message);
      load();
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  const remove = async (coupon) => {
    if (!window.confirm(`Delete ${coupon.code}?`)) return;
    try {
      toast.success((await request(`/admin/coupons/${coupon.id}`, { method: "DELETE" })).message);
      load();
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex admin-dashboard-layout">
          <Sidebar />
          <main className="container-fluid admin-dashboard-content customer-content">
            <section className="customer-hero">
              <div>
                <span className="customer-eyebrow customer-eyebrow--light">PROMOTIONS</span>
                <h1>Coupons<span>.</span></h1>
                <p>Codes for a percentage or amount off. Listed ones show as offers on the products they cover; shoppers apply them at checkout.</p>
              </div>
              <button type="button" className="customer-hero-cta border-0" onClick={() => setEditing("new")}>＋ New coupon</button>
            </section>

            {editing && data && (
              <CouponForm key={editing === "new" ? "new" : editing.id} coupon={editing === "new" ? null : editing} categories={data.categories}
                onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
            )}

            <div className="product-review-tabs" role="tablist" aria-label="Coupon state">
              {TABS.map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={filters.state === key} className={`product-review-tab${filters.state === key ? " is-active" : ""}`} onClick={() => setFilters({ ...filters, state: key, page: 1 })}>
                  {label}{data?.counts?.[key] > 0 && <span>{data.counts[key]}</span>}
                </button>
              ))}
            </div>
            <form className="seller-search" role="search" onSubmit={(event) => { event.preventDefault(); setFilters({ ...filters, search: searchInput.trim(), page: 1 }); }}>
              <label className="visually-hidden" htmlFor="coupon-search">Find a coupon</label>
              <input id="coupon-search" className="form-control" placeholder="Code or title" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
              <button type="submit" className="btn btn-outline-primary">Search</button>
            </form>

            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            {!data && !error && <p className="text-muted" role="status">Loading coupons…</p>}
            {data && (data.data.length ? (
              <ul className="coupon-list">
                {data.data.map((coupon) => (
                  <li key={coupon.id} className={`coupon-card is-${coupon.state}`}>
                    <div className="coupon-card-code"><span>{coupon.code}</span><small>{coupon.headline}</small></div>
                    <div className="coupon-card-body">
                      <h2>{coupon.title} <span className={`seller-status ${STATES[coupon.state]?.[1]}`}>{STATES[coupon.state]?.[0]}</span></h2>
                      <p>{coupon.conditions.join(" ")}</p>
                      <small>
                        {coupon.starts_on ? `From ${formatDay(coupon.starts_on)} · ` : ""}
                        {coupon.usage_limit ? `${coupon.uses} of ${coupon.usage_limit} used` : `Used ${coupon.uses} ${coupon.uses === 1 ? "time" : "times"}`}
                        {coupon.discount_given > 0 ? ` · ${formatPrice(coupon.discount_given)} off in all` : ""}
                        {` · ${coupon.funded_by === "store" ? "Elitezaar pays" : "Sellers pay"}`}
                        {coupon.show_on_product ? "" : " · not listed on products"}
                      </small>
                    </div>
                    <div className="coupon-card-actions">
                      <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { setEditing(coupon); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
                      {coupon.status
                        ? <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setStatus(coupon, false)}>Pause</button>
                        : <button type="button" className="btn btn-primary btn-sm" onClick={() => setStatus(coupon, true)}>Switch on</button>}
                      {coupon.uses === 0 && <button type="button" className="btn btn-link btn-sm text-danger" onClick={() => remove(coupon)}>Delete</button>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <div className="customer-panel text-center text-muted py-5">{filters.state === "active" && !filters.search ? "No coupons running. Create one with “New coupon”." : "Nothing here."}</div>)}
            {data && data.last_page > 1 && (
              <nav className="d-flex justify-content-between align-items-center mt-3" aria-label="Pages">
                <button type="button" className="btn btn-outline-secondary btn-sm" disabled={data.current_page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Previous</button>
                <span>Page {data.current_page} of {data.last_page}</span>
                <button type="button" className="btn btn-outline-secondary btn-sm" disabled={data.current_page >= data.last_page} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</button>
              </nav>
            )}
          </main>
        </div>
      </div>
    </Layout>
  );
};

const CouponForm = ({ coupon, categories, onClose, onSaved }) => {
  const [values, setValues] = useState(coupon ? asForm(coupon) : emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState([]);
  const set = (name) => (event) => setValues((current) => ({ ...current, [name]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  const fieldError = (name) => errors[name] && <div className="invalid-feedback d-block">{errors[name]}</div>;
  const mains = categories.filter((category) => !category.parent_id);

  const findProducts = async (event) => {
    event.preventDefault();
    try {
      setProductResults((await request(`/admin/coupons/products?search=${encodeURIComponent(productSearch)}`)).products);
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  const toggleCategory = (id) => setValues((current) => ({ ...current, category_ids: current.category_ids.includes(id) ? current.category_ids.filter((each) => each !== id) : [...current.category_ids, id] }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    const select = values.covers === "select";
    const body = {
      code: values.code, title: values.title, description: values.description || null, terms: values.terms || null, type: values.type, value: number(values.value),
      max_discount: values.type === "percent" ? number(values.max_discount) : null, min_order: number(values.min_order), starts_on: values.starts_on || null, ends_on: values.ends_on || null,
      usage_limit: number(values.usage_limit), per_customer_limit: number(values.per_customer_limit), first_order_only: values.first_order_only, show_on_product: values.show_on_product,
      funded_by: values.funded_by, status: values.status, category_ids: select ? values.category_ids : [], product_ids: select ? values.products.map((product) => product.id) : [],
    };
    try {
      const result = await request(coupon ? `/admin/coupons/${coupon.id}` : "/admin/coupons", { method: coupon ? "PUT" : "POST", body });
      toast.success(result.message);
      onSaved();
    } catch (requestError) {
      setErrors(requestError.fieldErrors || {});
      toast.error(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const headline = values.value ? (values.type === "percent" ? `${values.value}% off` : `${formatPrice(values.value)} off`) : "Your offer";

  return (
    <form className="customer-panel coupon-form mb-4" onSubmit={save} noValidate>
      <header className="customer-panel-header">
        <div><h2>{coupon ? `Edit ${coupon.code}` : "New coupon"}</h2><p>Shoppers type the code at checkout, or copy it from a product’s offers.</p></div>
        <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
      </header>
      <div className="row g-4">
        <div className="col-xl-8">
          <div className="row g-3">
            <div className="col-md-4">
              <label htmlFor="coupon-code" className="form-label">Code</label>
              <input id="coupon-code" className={`form-control text-uppercase ${errors.code ? "is-invalid" : ""}`} maxLength={20} placeholder="AW30" value={values.code} onChange={(event) => setValues({ ...values, code: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} />
              {fieldError("code")}
            </div>
            <div className="col-md-8">
              <label htmlFor="coupon-title" className="form-label">Title</label>
              <input id="coupon-title" className={`form-control ${errors.title ? "is-invalid" : ""}`} maxLength={120} placeholder="Flat 30% Off On Select Fashion" value={values.title} onChange={set("title")} />
              {fieldError("title")}
            </div>
            <div className="col-12">
              <label htmlFor="coupon-description" className="form-label">Short description <span className="text-muted fw-normal">Shown under the title</span></label>
              <input id="coupon-description" className="form-control" maxLength={255} placeholder="On shirts, kurtas and more" value={values.description} onChange={set("description")} />
            </div>
            <div className="col-md-4">
              <span className="form-label d-block">Discount</span>
              <div className="btn-group w-100" role="group" aria-label="Discount type">
                {[["percent", "% off"], ["flat", "₹ off"]].map(([type, label]) => (
                  <React.Fragment key={type}>
                    <input type="radio" className="btn-check" id={`coupon-type-${type}`} checked={values.type === type} onChange={() => setValues({ ...values, type })} />
                    <label className="btn btn-outline-primary" htmlFor={`coupon-type-${type}`}>{label}</label>
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div className="col-md-4">
              <label htmlFor="coupon-value" className="form-label">{values.type === "percent" ? "Percentage" : "Amount (₹)"}</label>
              <input id="coupon-value" type="number" min="0" step="0.01" className={`form-control ${errors.value ? "is-invalid" : ""}`} value={values.value} onChange={set("value")} />
              {fieldError("value")}
            </div>
            {values.type === "percent" && (
              <div className="col-md-4">
                <label htmlFor="coupon-cap" className="form-label">Up to (₹) <span className="text-muted fw-normal">Optional</span></label>
                <input id="coupon-cap" type="number" min="0" step="1" className={`form-control ${errors.max_discount ? "is-invalid" : ""}`} placeholder="No cap" value={values.max_discount} onChange={set("max_discount")} />
                {fieldError("max_discount")}
              </div>
            )}
            <div className="col-md-4">
              <label htmlFor="coupon-min" className="form-label">Minimum purchase (₹)</label>
              <input id="coupon-min" type="number" min="0" step="1" className={`form-control ${errors.min_order ? "is-invalid" : ""}`} placeholder="None" value={values.min_order} onChange={set("min_order")} />
              {fieldError("min_order")}
            </div>
            <div className="col-md-4">
              <label htmlFor="coupon-from" className="form-label">First day</label>
              <input id="coupon-from" type="date" className="form-control" value={values.starts_on} onChange={set("starts_on")} />
            </div>
            <div className="col-md-4">
              <label htmlFor="coupon-until" className="form-label">Last day</label>
              <input id="coupon-until" type="date" className={`form-control ${errors.ends_on ? "is-invalid" : ""}`} value={values.ends_on} onChange={set("ends_on")} />
              {fieldError("ends_on")}
            </div>
            <div className="col-md-4">
              <label htmlFor="coupon-limit" className="form-label">Uses in all</label>
              <input id="coupon-limit" type="number" min="1" className="form-control" placeholder="No limit" value={values.usage_limit} onChange={set("usage_limit")} />
            </div>
            <div className="col-md-4">
              <label htmlFor="coupon-each" className="form-label">Uses per customer</label>
              <input id="coupon-each" type="number" min="1" className="form-control" placeholder="No limit" value={values.per_customer_limit} onChange={set("per_customer_limit")} />
            </div>
            <div className="col-md-4 d-flex flex-column justify-content-end gap-1">
              <div className="form-check"><input id="coupon-first" type="checkbox" className="form-check-input" checked={values.first_order_only} onChange={set("first_order_only")} /><label htmlFor="coupon-first" className="form-check-label">First order only</label></div>
              <div className="form-check"><input id="coupon-listed" type="checkbox" className="form-check-input" checked={values.show_on_product} onChange={set("show_on_product")} /><label htmlFor="coupon-listed" className="form-check-label">Show on product pages</label></div>
              <div className="form-check"><input id="coupon-on" type="checkbox" className="form-check-input" checked={values.status} onChange={set("status")} /><label htmlFor="coupon-on" className="form-check-label">Switched on</label></div>
            </div>

            <div className="col-12">
              <span className="form-label d-block">Works on</span>
              <div className="d-flex flex-wrap gap-3 mb-2">
                {[["all", "Everything in the store"], ["select", "Select categories and products"]].map(([covers, label]) => (
                  <div key={covers} className="form-check"><input id={`coupon-covers-${covers}`} type="radio" className="form-check-input" checked={values.covers === covers} onChange={() => setValues({ ...values, covers })} /><label htmlFor={`coupon-covers-${covers}`} className="form-check-label">{label}</label></div>
                ))}
              </div>
              {values.covers === "select" && (
                <div className="coupon-scope">
                  <div className="coupon-scope-categories">
                    {mains.map((main) => (
                      <fieldset key={main.id}>
                        <label className="coupon-chip-check"><input type="checkbox" checked={values.category_ids.includes(main.id)} onChange={() => toggleCategory(main.id)} /> <strong>{main.name}</strong> <small>(all of it)</small></label>
                        {categories.filter((child) => child.parent_id === main.id).map((child) => (
                          <label key={child.id} className="coupon-chip-check"><input type="checkbox" checked={values.category_ids.includes(child.id)} onChange={() => toggleCategory(child.id)} /> {child.name}</label>
                        ))}
                      </fieldset>
                    ))}
                  </div>
                  <div className="coupon-scope-products">
                    <div className="input-group input-group-sm">
                      <input className="form-control" placeholder="Find a product by name or SKU" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && findProducts(event)} />
                      <button type="button" className="btn btn-outline-secondary" onClick={findProducts}>Find</button>
                    </div>
                    {productResults.length > 0 && (
                      <ul className="coupon-product-results">
                        {productResults.filter((product) => !values.products.some((chosen) => chosen.id === product.id)).map((product) => (
                          <li key={product.id}><span>{product.title} <small>{product.sku}</small></span><button type="button" className="btn btn-link btn-sm" onClick={() => setValues({ ...values, products: [...values.products, product] })}>Add</button></li>
                        ))}
                      </ul>
                    )}
                    <div className="coupon-chosen">
                      {values.products.map((product) => (
                        <span key={product.id}>{product.title}<button type="button" aria-label={`Remove ${product.title}`} onClick={() => setValues({ ...values, products: values.products.filter((each) => each.id !== product.id) })}>×</button></span>
                      ))}
                    </div>
                  </div>
                  {(errors.category_ids || errors.product_ids) && <div className="text-danger small">{errors.category_ids || errors.product_ids}</div>}
                </div>
              )}
            </div>

            <div className="col-12">
              <span className="form-label d-block">Who pays for the discount</span>
              {[["store", "Elitezaar", "Sellers are paid as if there were no coupon; it comes out of Elitezaar’s commission."], ["seller", "The seller", "Sellers earn on the discounted price."]].map(([funder, label, hint]) => (
                <div key={funder} className="form-check"><input id={`coupon-funder-${funder}`} type="radio" className="form-check-input" checked={values.funded_by === funder} onChange={() => setValues({ ...values, funded_by: funder })} /><label htmlFor={`coupon-funder-${funder}`} className="form-check-label"><strong>{label}</strong> <span className="text-muted">— {hint}</span></label></div>
              ))}
            </div>
            <div className="col-12">
              <label htmlFor="coupon-terms" className="form-label">Extra terms <span className="text-muted fw-normal">Optional; the rules above are listed for shoppers automatically</span></label>
              <textarea id="coupon-terms" rows="3" className="form-control" maxLength={3000} placeholder="e.g. Can’t be combined with other offers." value={values.terms} onChange={set("terms")} />
            </div>
          </div>
        </div>
        <div className="col-xl-4 coupon-form-side">
          <span className="form-label d-block">How shoppers see it</span>
          <article className="pd-offer pd-offer--0 coupon-preview">
            <div className="pd-offer-top"><span className="pd-offer-badge" aria-hidden="true">%</span><strong>{values.title || "Coupon title"}</strong><span className="pd-offer-terms">T&amp;C ›</span></div>
            <p>{values.description || headline}</p>
            <div className="pd-offer-actions"><span className="pd-offer-code"><span>{values.code || "CODE"}</span></span></div>
          </article>
          <button type="submit" className="btn btn-primary w-100 mt-4" disabled={saving}>{saving ? "Saving…" : coupon ? "Save coupon" : "Create coupon"}</button>
          <button type="button" className="btn btn-link w-100" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </form>
  );
};

export default ManageCoupons;
