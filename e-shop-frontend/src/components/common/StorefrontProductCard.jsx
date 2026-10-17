import React from "react";
import { Link } from "react-router-dom";
import { apiUrl } from "./http";
import { formatPrice } from "./currency";

const imageBase = apiUrl.replace(/\/api\/?$/, "");

const StorefrontProductCard = ({ product }) => (
  <article className="shop-product-card h-100">
    <Link to={`/product/${product.id}`} className="shop-product-image" aria-label={`View ${product.title}`}>
      {product.image ? (
        <img src={`${imageBase}/uploads/products/small/${encodeURIComponent(product.image)}`} alt={product.title} loading="lazy" />
      ) : (
        <div className="shop-product-image-placeholder">PURE WEAR <span>IMAGE COMING SOON</span></div>
      )}
      <span className="shop-product-quick-view">Discover piece <span aria-hidden="true">↗</span></span>
    </Link>
    <div className="shop-product-info">
      <div className="shop-product-meta"><span>{product.category?.name || "Collection"}</span>{product.brand?.name && <span>{product.brand.name}</span>}</div>
      <Link to={`/product/${product.id}`} className="shop-product-title">{product.title}</Link>
      <div className="shop-product-price">
        <strong>{formatPrice(product.price)}</strong>
        {product.compare_price && <span className="text-decoration-line-through">{formatPrice(product.compare_price)}</span>}
      </div>
    </div>
  </article>
);

export default StorefrontProductCard;
