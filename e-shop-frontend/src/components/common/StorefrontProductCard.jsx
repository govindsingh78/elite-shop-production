import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { apiUrl } from "./http";
import { formatPrice } from "./currency";
import { useCart } from "../context/CartContext";
import WishlistButton from "./WishlistButton";

const imageBase = apiUrl.replace(/\/api\/?$/, "");
const LOW_STOCK = 5;

const StorefrontProductCard = ({ product }) => {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const price = Number(product.price || 0);
  const compare = Number(product.compare_price || 0);
  const discount = compare > price ? Math.round(((compare - price) / compare) * 100) : 0;
  const soldOut = product.qty === 0;
  const lowStock = !soldOut && product.qty != null && product.qty <= LOW_STOCK;

  const quickAdd = () => {
    addItem(product, 1);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
    toast.success(<span>{product.title} added to your bag. <Link to="/cart">View bag</Link></span>);
  };

  return (
    <article className={`sp-card${soldOut ? " is-sold-out" : ""}`}>
      <div className="sp-card-media">
        <Link to={`/product/${product.id}`} aria-label={`View ${product.title}`} className="sp-card-image">
          {product.image ? (
            <img src={`${imageBase}/uploads/products/small/${encodeURIComponent(product.image)}`} alt={product.title} loading="lazy" />
          ) : (
            <span className="sp-card-placeholder">ELITE SHOP<small>Image coming soon</small></span>
          )}
        </Link>
        <WishlistButton product={product} />
        <div className="sp-card-badges">
          {discount > 0 && <span className="sp-badge sp-badge--sale">−{discount}%</span>}
          {soldOut && <span className="sp-badge sp-badge--out">Sold out</span>}
          {lowStock && <span className="sp-badge sp-badge--low">Only {product.qty} left</span>}
        </div>
        {!soldOut && (
          <button type="button" className={`sp-card-quick${added ? " is-added" : ""}`} onClick={quickAdd} aria-label={`Add ${product.title} to bag`}>
            {added ? "Added ✓" : <><span aria-hidden="true">＋</span> Add to bag</>}
          </button>
        )}
      </div>
      <div className="sp-card-body">
        <div className="sp-card-meta">
          <span>{product.brand?.name || product.category?.name || "Elitezaar"}</span>
          {product.brand?.name && product.category?.name && <span>{product.category.name}</span>}
        </div>
        <Link to={`/product/${product.id}`} className="sp-card-title">{product.title}</Link>
        {Number(product.reviews_count) > 0 && (
          <div className="sp-card-rating" aria-label={`Rated ${Number(product.reviews_avg_rating).toFixed(1)} out of 5 from ${product.reviews_count} reviews`}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.4l2.65 5.37 5.93.86-4.29 4.18 1.01 5.9L12 16.92l-5.3 2.79 1.01-5.9-4.29-4.18 5.93-.86L12 3.4Z" /></svg><strong>{Number(product.reviews_avg_rating).toFixed(1)}</strong><span>({product.reviews_count})</span>
          </div>
        )}
        <div className="sp-card-price">
          <strong>{formatPrice(price)}</strong>
          {discount > 0 && <><s>{formatPrice(compare)}</s><span>{discount}% off</span></>}
        </div>
      </div>
    </article>
  );
};

export default StorefrontProductCard;
