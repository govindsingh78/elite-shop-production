import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { apiUrl } from "./http";
import { RatingSummary, ReviewCard, StarPicker } from "./ReviewBits";
import { AdminAuthContext } from "../context/AdminAuth";
import { customerRequest } from "../customer/customerApi";

const EMPTY_FORM = { rating: 0, title: "", comment: "" };

/**
 * Ratings & reviews on the product page. Anyone can read them; customers whose order with the product was delivered
 * can write one review, then edit or delete it. `onSummary` receives the latest rating summary.
 */
const ProductReviews = ({ productId, path, onSummary }) => {
  const { user } = useContext(AdminAuthContext);
  const isCustomer = user?.portal === "customer";
  const location = useLocation();
  const sectionRef = useRef(null);
  const [list, setList] = useState({ summary: null, reviews: [], page: 1, last: 1, loading: true, error: "" });
  const [mine, setMine] = useState({ loading: isCustomer, review: null, canReview: false, reason: "" });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (page = 1) => {
    try {
      const response = await fetch(`${apiUrl}/storefront/products/${productId}/reviews?page=${page}`, { headers: { Accept: "application/json" } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Reviews couldn’t be loaded.");
      setList((current) => ({
        summary: data.summary,
        reviews: page === 1 ? data.reviews.data : [...current.reviews, ...data.reviews.data],
        page: data.reviews.current_page,
        last: data.reviews.last_page,
        loading: false,
        error: "",
      }));
      onSummary?.({ ...data.summary, productId });
    } catch (error) {
      setList((current) => ({ ...current, loading: false, error: error.message }));
    }
  }, [productId, onSummary]);

  useEffect(() => { load(1); }, [load]);

  useEffect(() => {
    if (!isCustomer) return undefined;
    let active = true;
    customerRequest(`reviews/${productId}`)
      .then((data) => active && setMine({ loading: false, review: data.review, canReview: data.can_review, reason: data.reason || "" }))
      .catch(() => active && setMine({ loading: false, review: null, canReview: false, reason: "" }));
    return () => { active = false; };
  }, [isCustomer, productId]);

  // Links to #reviews (the rating under the title, "Rate & review" on orders) land here once the list has loaded.
  useEffect(() => {
    if (location.hash === "#reviews" && !list.loading) sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash, list.loading]);

  const startEditing = () => {
    setForm(mine.review ? { rating: mine.review.rating, title: mine.review.title || "", comment: mine.review.comment || "" } : EMPTY_FORM);
    setErrors({});
    setEditing(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.rating) {
      setErrors({ rating: "Choose a star rating." });
      return;
    }
    setSaving(true);
    try {
      const data = await customerRequest(`reviews/${productId}`, { method: "PUT", body: form });
      setMine((current) => ({ ...current, review: data.review, canReview: true }));
      setEditing(false);
      toast.success(data.message);
      load(1);
    } catch (error) {
      setErrors(error.errors || { general: error.message });
    } finally {
      setSaving(false);
    }
  };

  const removeReview = async () => {
    if (!window.confirm("Delete your review? You can write a new one any time.")) return;
    try {
      const data = await customerRequest(`reviews/${productId}`, { method: "DELETE" });
      setMine((current) => ({ ...current, review: null }));
      toast.success(data.message);
      load(1);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const others = list.reviews.filter((review) => review.id !== mine.review?.id);

  return (
    <section className="pd-reviews" id="reviews" ref={sectionRef}>
      <div className="row g-4 g-xl-5">
        <div className="col-lg-4">
          <span className="shop-eyebrow">WHAT CUSTOMERS SAY</span>
          <h2>Ratings &amp; reviews</h2>
          {list.summary && <RatingSummary summary={list.summary} />}
          <div className="rv-cta">
            {!isCustomer ? (
              <>
                <p>Bought this piece? Tell other shoppers what you think.</p>
                <Link to="/customer/login" state={{ from: `${path || `/product/${productId}`}#reviews` }} className="btn btn-outline-primary">Sign in to review</Link>
              </>
            ) : mine.loading ? null : mine.review ? (
              <p>Thanks for sharing your thoughts. You can edit your review whenever you like.</p>
            ) : mine.canReview ? (
              !editing && <button type="button" className="btn btn-primary" onClick={startEditing}>Write a review</button>
            ) : (
              <p className="rv-note">{mine.reason}</p>
            )}
          </div>
        </div>

        <div className="col-lg-8">
          {editing && (
            <form className="rv-form" onSubmit={submit} noValidate>
              <h3>{mine.review ? "Edit your review" : "Write a review"}</h3>
              <label className="form-label d-block">Your rating</label>
              <StarPicker value={form.rating} onChange={(rating) => { setForm((current) => ({ ...current, rating })); setErrors((current) => ({ ...current, rating: undefined })); }} error={errors.rating} />
              {errors.rating && <p className="rv-error">{errors.rating}</p>}
              <label htmlFor="review-title" className="form-label mt-3">Headline <span className="text-muted fw-normal">(optional)</span></label>
              <input id="review-title" className={`form-control${errors.title ? " is-invalid" : ""}`} maxLength={120} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Beautiful fabric, true to size" />
              <label htmlFor="review-comment" className="form-label mt-3">Your review <span className="text-muted fw-normal">(optional)</span></label>
              <textarea id="review-comment" className={`form-control${errors.comment ? " is-invalid" : ""}`} rows={4} maxLength={2000} value={form.comment} onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))} placeholder="How does it look, feel and fit? Would you recommend it?" />
              <div className="rv-form-foot">
                <small>{form.comment.length}/2000</small>
                {errors.general && <span className="rv-error">{errors.general}</span>}
                <button type="button" className="btn btn-link" onClick={() => setEditing(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : mine.review ? "Save changes" : "Post review"}</button>
              </div>
            </form>
          )}

          {mine.review && !editing && <ReviewCard review={mine.review} mine onEdit={startEditing} onDelete={removeReview} />}

          {list.error && <div className="alert alert-danger" role="alert">{list.error}</div>}
          {!list.loading && !others.length && !mine.review && !editing && (
            <div className="rv-empty">
              <span aria-hidden="true">★</span>
              <p>No reviews yet. Customers who buy this piece can be the first to review it.</p>
            </div>
          )}
          {others.map((review) => <ReviewCard key={review.id} review={review} />)}
          {list.page < list.last && (
            <button type="button" className="rv-more" onClick={() => load(list.page + 1)}>Show more reviews</button>
          )}
        </div>
      </div>
    </section>
  );
};

export default ProductReviews;
