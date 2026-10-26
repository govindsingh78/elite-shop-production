import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { apiUrl } from "../../common/http";
import { Stars } from "../../common/ReviewBits";
import { productPath } from "../../common/productPath";

const TABS = [["", "All reviews"], ["published", "Published"], ["hidden", "Hidden"]];

const request = async (path, { method = "GET", body } = {}) => {
  const response = await fetch(`${apiUrl}/admin/reviews${path}`, {
    method,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("adminToken") || ""}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
};

/** Admin: read every customer review and hide or delete the ones that break the rules. */
const ManageReviews = () => {
  const [filters, setFilters] = useState({ status: "", rating: "", search: "", page: 1 });
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(filters.page) });
      ["status", "rating", "search"].forEach((key) => filters[key] && params.set(key, filters[key]));
      setPage(await request(`?${params}`));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (review, status) => {
    try {
      const data = await request(`/${review.id}`, { method: "PATCH", body: { status } });
      toast.success(data.message);
      setPage((current) => ({ ...current, data: current.data.map((item) => (item.id === review.id ? data.data : item)) }));
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  const remove = async (review) => {
    if (!window.confirm(`Delete this ${review.rating}-star review by ${review.user?.name || "a customer"}? This can’t be undone.`)) return;
    try {
      const data = await request(`/${review.id}`, { method: "DELETE" });
      toast.success(data.message);
      load();
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  const update = (changes) => setFilters((current) => ({ ...current, ...changes, page: 1 }));

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex">
          <Sidebar />
          <main className="container-fluid p-4">
            <div className="mb-4">
              <h2 className="mb-1">Customer reviews</h2>
              <p className="text-muted mb-0">Reviews go live as soon as verified buyers post them. Hide or delete any that break the rules.</p>
            </div>

            <div className="product-review-tabs" role="tablist" aria-label="Review status">
              {TABS.map(([value, label]) => (
                <button key={label} type="button" role="tab" aria-selected={filters.status === value} className={`product-review-tab${filters.status === value ? " is-active" : ""}`} onClick={() => update({ status: value })}>{label}</button>
              ))}
            </div>

            <form className="row g-2 mb-3" onSubmit={(event) => { event.preventDefault(); update({ search: searchInput.trim() }); }}>
              <div className="col-sm-6 col-lg-5">
                <label htmlFor="review-search" className="visually-hidden">Search reviews</label>
                <input id="review-search" className="form-control" placeholder="Search review text or product" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
              </div>
              <div className="col-sm-4 col-lg-3">
                <label htmlFor="review-rating" className="visually-hidden">Filter by rating</label>
                <select id="review-rating" className="form-select" value={filters.rating} onChange={(event) => update({ rating: event.target.value })}>
                  <option value="">All ratings</option>
                  {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} star{rating > 1 ? "s" : ""}</option>)}
                </select>
              </div>
              <div className="col-sm-2"><button type="submit" className="btn btn-outline-primary w-100">Search</button></div>
            </form>

            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            {loading && !page ? <p role="status">Loading reviews…</p> : (
              <div className="table-responsive">
                <table className="table table-bordered table-hover align-middle admin-reviews-table">
                  <thead className="table-light"><tr><th>Product</th><th>Rating</th><th>Review</th><th>Customer</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {page?.data?.length ? page.data.map((review) => (
                      <tr key={review.id}>
                        <td>{review.product ? <Link to={`${productPath(review.product)}#reviews`} target="_blank">{review.product.title}</Link> : "—"}</td>
                        <td><Stars value={review.rating} size={14} /></td>
                        <td className="admin-review-text">
                          {review.title && <strong className="d-block">{review.title}</strong>}
                          {review.comment ? <span>{review.comment.length > 180 ? `${review.comment.slice(0, 180)}…` : review.comment}</span> : !review.title && <span className="text-muted">Rating only</span>}
                        </td>
                        <td>{review.user?.name || "—"}<small className="d-block text-muted">{review.user?.email}</small></td>
                        <td className="text-nowrap">{new Date(review.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td>{review.status === "hidden" ? <span className="badge bg-secondary">Hidden</span> : <span className="badge bg-success">Published</span>}</td>
                        <td className="text-nowrap">
                          {review.status === "hidden"
                            ? <button type="button" className="btn btn-outline-success btn-sm me-2" onClick={() => setStatus(review, "published")}>Publish</button>
                            : <button type="button" className="btn btn-outline-secondary btn-sm me-2" onClick={() => setStatus(review, "hidden")}>Hide</button>}
                          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => remove(review)}>Delete</button>
                        </td>
                      </tr>
                    )) : <tr><td colSpan={7} className="text-center text-muted py-4">No reviews found.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            {page && page.last_page > 1 && (
              <nav className="d-flex justify-content-between align-items-center" aria-label="Review pages">
                <button type="button" className="btn btn-outline-secondary btn-sm" disabled={!page.prev_page_url} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>
                <span>Page {page.current_page} of {page.last_page}</span>
                <button type="button" className="btn btn-outline-secondary btn-sm" disabled={!page.next_page_url} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
              </nav>
            )}
          </main>
        </div>
      </div>
    </Layout>
  );
};

export default ManageReviews;
