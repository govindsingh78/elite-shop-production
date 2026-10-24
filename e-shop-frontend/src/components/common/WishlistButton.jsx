import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useWishlist } from "../context/wishlist";

export const HeartIcon = ({ filled = false }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 20.3s-7.6-4.6-7.6-10.5A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.6 2.6c0 5.9-7.6 10.5-7.6 10.5Z" fill={filled ? "currentColor" : "none"} />
  </svg>
);

/** Heart toggle. `card` sits on a product image; `detail` is the square button beside "Add to bag". */
const WishlistButton = ({ product, variant = "card" }) => {
  const { isSaved, toggle } = useWishlist();
  const [busy, setBusy] = useState(false);
  const saved = isSaved(product.id);
  const label = saved ? `Remove ${product.title} from your wishlist` : `Save ${product.title} to your wishlist`;

  const onClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setBusy(true);
    try {
      const nowSaved = await toggle(product);
      if (nowSaved) toast.success(<span>Saved to your wishlist. <Link to="/wishlist">View wishlist</Link></span>);
      else toast.info("Removed from your wishlist.");
    } catch (error) {
      toast.error(error.message || "Couldn’t update your wishlist. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={`${variant === "detail" ? "pd-wish" : "sp-card-wish"}${saved ? " is-saved" : ""}`}
      aria-pressed={saved}
      aria-label={label}
      title={saved ? "Saved to your wishlist" : "Save to wishlist"}
      onClick={onClick}
      disabled={busy}
    >
      <HeartIcon filled={saved} />
    </button>
  );
};

export default WishlistButton;
