import React, { useState } from "react";

const STAR = "M12 3.4l2.65 5.37 5.93.86-4.29 4.18 1.01 5.9L12 16.92l-5.3 2.79 1.01-5.9-4.29-4.18 5.93-.86L12 3.4Z";
const LABELS = { 1: "Poor", 2: "Fair", 3: "Good", 4: "Very good", 5: "Excellent" };
const FIVE = [1, 2, 3, 4, 5];

const StarIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={STAR} /></svg>;

/** Read-only stars; fractional values fill part of a star. */
export const Stars = ({ value = 0, size = 16 }) => (
  <span className="rv-stars" style={{ "--rv-size": `${size}px` }} role="img" aria-label={`${Number(value).toFixed(1)} out of 5 stars`}>
    <span className="rv-stars-row">{FIVE.map((n) => <StarIcon key={n} />)}</span>
    <span className="rv-stars-row rv-stars-fill" style={{ width: `${Math.max(0, Math.min(5, value)) * 20}%` }}>{FIVE.map((n) => <StarIcon key={n} />)}</span>
  </span>
);

/** Five tappable stars for writing a review. */
export const StarPicker = ({ value, onChange, error }) => {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className={`rv-picker${error ? " has-error" : ""}`}>
      <div role="radiogroup" aria-label="Your rating" onMouseLeave={() => setHover(0)}>
        {FIVE.map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}, ${LABELS[n]}`}
            className={n <= shown ? "is-on" : ""} onMouseEnter={() => setHover(n)} onFocus={() => setHover(n)} onBlur={() => setHover(0)} onClick={() => onChange(n)}>
            <StarIcon />
          </button>
        ))}
      </div>
      <span className="rv-picker-label">{LABELS[shown] || "Tap a star to rate"}</span>
    </div>
  );
};

/** Average, total and the 5→1 star breakdown. */
export const RatingSummary = ({ summary }) => (
  <div className="rv-summary">
    <div className="rv-summary-score">
      <strong>{summary.count ? summary.average.toFixed(1) : "–"}</strong>
      <Stars value={summary.average} size={18} />
      <span>{summary.count ? `Based on ${summary.count} ${summary.count === 1 ? "review" : "reviews"}` : "No reviews yet"}</span>
    </div>
    <ul className="rv-bars" aria-label="Rating breakdown">
      {[5, 4, 3, 2, 1].map((rating) => {
        const total = summary.distribution?.[rating] || 0;
        const percent = summary.count ? Math.round((total / summary.count) * 100) : 0;
        return (
          <li key={rating}>
            <span>{rating}<StarIcon /></span>
            <span className="rv-bar"><i style={{ width: `${percent}%` }} /></span>
            <span className="rv-bar-count">{total}</span>
          </li>
        );
      })}
    </ul>
  </div>
);

const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

/** One review. The customer's own review shows its status and edit/delete buttons. */
export const ReviewCard = ({ review, mine = false, onEdit, onDelete }) => (
  <article className={`rv-card${mine ? " is-mine" : ""}`}>
    <header>
      <Stars value={review.rating} size={15} />
      {review.title && <h3>{review.title}</h3>}
      {mine && <span className="rv-mine-badge">Your review</span>}
    </header>
    {review.comment && <p>{review.comment}</p>}
    {mine && review.status === "hidden" && <p className="rv-hidden-note">Hidden by our team, so only you can see it. Contact us if you think this is a mistake.</p>}
    <footer>
      <span className="rv-author">{review.author}</span>
      {review.verified && <span className="rv-verified">✓ Verified purchase</span>}
      <time dateTime={review.created_at}>{formatDate(review.created_at)}</time>
      {mine && (
        <span className="rv-mine-actions">
          <button type="button" onClick={onEdit}>Edit</button>
          <button type="button" onClick={onDelete}>Delete</button>
        </span>
      )}
    </footer>
  </article>
);
