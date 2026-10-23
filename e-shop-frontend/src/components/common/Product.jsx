import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import Layout from "./Layout";
import { apiUrl } from "./http";
import { useCart } from "../context/CartContext";
import { formatPrice } from "./currency";
import StorefrontProductCard from "./StorefrontProductCard";
import { ProductReturnsNote } from "./PolicyBits";

const imageBase = apiUrl.replace(/\/api\/?$/, "");
const LOW_STOCK = 5;

const perks = [
  { title: "Cash on delivery", copy: "Pay when your order arrives.", icon: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></> },
  { title: "Live order tracking", copy: "Follow your parcel to your door.", icon: <><path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z" /><circle cx="7.5" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" /></> },
  { title: "Carefully packed", copy: "Checked and wrapped with care.", icon: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.4 7.7 7.6 4.4 7.6-4.4M12 12v9" /></> },
];

const Product = () => {
  const { id: routeId } = useParams();
  const [searchParams] = useSearchParams();
  const id = routeId || searchParams.get("id");
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [images, setImages] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [related, setRelated] = useState([]);
  const [added, setAdded] = useState(false);
  const [zoom, setZoom] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadProduct = async () => {
      setLoading(true);
      setError("");
      setQuantity(1);
      setSelectedIndex(0);
      try {
        if (!id) throw new Error("No product was selected.");
        const response = await fetch(`${apiUrl}/storefront/products/${encodeURIComponent(id)}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Could not load this product.");
        const item = result.data;
        setProduct(item);
        setImages([...new Set([item.image, ...(item.images || []).map((image) => image.image)].filter(Boolean))]);
      } catch (requestError) {
        if (requestError.name !== "AbortError") setError(requestError.message || "Could not load this product.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadProduct();
    window.scrollTo({ top: 0 });
    return () => controller.abort();
  }, [id]);

  // "You may also like": other products from the same category.
  useEffect(() => {
    if (!product?.category_id) return undefined;
    const controller = new AbortController();
    fetch(`${apiUrl}/storefront/products?category_id=${product.category_id}`, { headers: { Accept: "application/json" }, signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => setRelated((result?.products?.data || []).filter((item) => item.id !== product.id).slice(0, 4)))
      .catch(() => {});
    return () => controller.abort();
  }, [product]);

  const stock = product?.qty;
  const soldOut = stock === 0;
  const maxQuantity = stock ?? 999;
  const compare = Number(product?.compare_price || 0);
  const price = Number(product?.price || 0);
  const discount = compare > price ? Math.round(((compare - price) / compare) * 100) : 0;
  const selectedImage = images[selectedIndex];

  const changeQuantity = (next) => setQuantity(Math.min(Math.max(1, next), Math.max(1, maxQuantity)));

  const addToBag = () => {
    addItem(product, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
    toast.success(<span>Added to your bag. <Link to="/cart">View bag</Link></span>);
  };

  const buyNow = () => {
    addItem(product, quantity);
    navigate("/checkout");
  };

  const showImage = (step) => setSelectedIndex((current) => (current + step + images.length) % images.length);

  const trackZoom = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setZoom(`${((event.clientX - rect.left) / rect.width) * 100}% ${((event.clientY - rect.top) / rect.height) * 100}%`);
  };

  return (
    <Layout>
      <main className="container pd-page py-3 py-lg-4">
        <nav aria-label="Breadcrumb" className="pd-breadcrumb">
          <ol className="breadcrumb mb-0">
            <li className="breadcrumb-item"><Link to="/">Home</Link></li>
            <li className="breadcrumb-item"><Link to="/shop">Shop</Link></li>
            {product?.category?.parent && <li className="breadcrumb-item"><Link to={`/shop/${product.category.parent.slug}`}>{product.category.parent.name}</Link></li>}
            {product?.category && <li className="breadcrumb-item"><Link to={`/shop/${product.category.slug}`}>{product.category.name}</Link></li>}
            {product && <li className="breadcrumb-item active" aria-current="page">{product.title}</li>}
          </ol>
        </nav>

        {loading && (
          <div className="row g-4 g-xl-5 pd-skeleton" role="status" aria-label="Loading product">
            <div className="col-lg-6"><span className="pd-skeleton-image" /></div>
            <div className="col-lg-6"><i /><b /><i /><i /><b /></div>
          </div>
        )}
        {error && <div className="alert alert-danger" role="alert">{error} <Link to="/shop">Back to shop</Link></div>}

        {!loading && product && (
          <>
            <div className="row g-4 g-xl-5 pd-layout">
              <div className="col-lg-6">
                <div className={`pd-gallery${images.length > 1 ? " has-thumbs" : ""}`}>
                  {images.length > 1 && (
                    <div className="pd-thumbs" role="tablist" aria-label="Product images">
                      {images.map((image, index) => (
                        <button type="button" role="tab" aria-selected={index === selectedIndex} key={image} className={`pd-thumb${index === selectedIndex ? " is-selected" : ""}`} onClick={() => setSelectedIndex(index)} aria-label={`Image ${index + 1} of ${images.length}`}>
                          <img src={`${imageBase}/uploads/products/small/${encodeURIComponent(image)}`} alt="" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="pd-stage">
                    {discount > 0 && <span className="pd-badge">−{discount}%</span>}
                    {selectedImage ? (
                      <div className={`pd-stage-frame${zoom ? " is-zooming" : ""}`} onMouseMove={trackZoom} onMouseLeave={() => setZoom(null)}>
                        <img key={selectedImage} src={`${imageBase}/uploads/products/large/${encodeURIComponent(selectedImage)}`} alt={product.title} style={zoom ? { transformOrigin: zoom } : undefined} />
                      </div>
                    ) : (
                      <div className="pd-stage-placeholder">ELITE SHOP<span>Image coming soon</span></div>
                    )}
                    {images.length > 1 && <>
                      <button type="button" className="pd-nav pd-nav--prev" onClick={() => showImage(-1)} aria-label="Previous image">‹</button>
                      <button type="button" className="pd-nav pd-nav--next" onClick={() => showImage(1)} aria-label="Next image">›</button>
                      <span className="pd-counter">{selectedIndex + 1} / {images.length}</span>
                    </>}
                  </div>
                </div>
              </div>

              <div className="col-lg-6">
                <section className="pd-buy">
                  <div className="pd-tags">
                    {product.category && <Link to={`/shop/${product.category.slug}`} className="pd-tag">{product.category.name}</Link>}
                    {product.brand?.name && <span className="pd-tag pd-tag--brand">{product.brand.name}</span>}
                  </div>
                  <h1 className="pd-title">{product.title}</h1>

                  <div className="pd-price">
                    <strong>{formatPrice(price)}</strong>
                    {discount > 0 && <>
                      <s>{formatPrice(compare)}</s>
                      <span className="pd-save">Save {formatPrice(compare - price)} ({discount}%)</span>
                    </>}
                  </div>

                  {stock != null && (
                    <p className={`pd-stock ${soldOut ? "is-out" : stock <= LOW_STOCK ? "is-low" : "is-in"}`}>
                      <i aria-hidden="true" />{soldOut ? "Sold out" : stock <= LOW_STOCK ? `Hurry — only ${stock} left` : "In stock, ready to ship"}
                    </p>
                  )}

                  {product.short_description && <p className="pd-lead">{product.short_description}</p>}

                  <div className="pd-actions">
                    <div className="pd-qty" role="group" aria-label="Quantity">
                      <button type="button" onClick={() => changeQuantity(quantity - 1)} disabled={quantity <= 1 || soldOut} aria-label="Decrease quantity">−</button>
                      <input id="quantity" type="number" inputMode="numeric" min="1" max={maxQuantity} value={quantity} onChange={(event) => changeQuantity(Number(event.target.value) || 1)} disabled={soldOut} aria-label="Quantity" />
                      <button type="button" onClick={() => changeQuantity(quantity + 1)} disabled={quantity >= maxQuantity || soldOut} aria-label="Increase quantity">+</button>
                    </div>
                    <button type="button" className={`btn btn-primary pd-add${added ? " is-added" : ""}`} onClick={addToBag} disabled={soldOut}>
                      {soldOut ? "Sold out" : added ? "Added to bag ✓" : <>Add to bag <span aria-hidden="true">↗</span></>}
                    </button>
                  </div>
                  {!soldOut && <button type="button" className="pd-buy-now" onClick={buyNow}>Buy now — {formatPrice(price * quantity)}</button>}

                  <ul className="pd-perks">
                    {perks.map((perk) => (
                      <li key={perk.title}>
                        <span><svg viewBox="0 0 24 24" aria-hidden="true">{perk.icon}</svg></span>
                        <div><strong>{perk.title}</strong><small>{perk.copy}</small></div>
                      </li>
                    ))}
                  </ul>
                  <ProductReturnsNote />

                  <p className="pd-sku">SKU <strong>{product.sku || "—"}</strong></p>
                </section>
              </div>
            </div>

            <section className="pd-details">
              <div className="row g-4">
                <div className="col-lg-7">
                  <span className="shop-eyebrow">THE DETAILS</span>
                  <h2>Description</h2>
                  {(product.description || product.short_description)
                    ? <p className="pd-description">{product.description || product.short_description}</p>
                    : <p className="pd-description text-muted">More details about this piece are coming soon.</p>}
                </div>
                <div className="col-lg-5">
                  <dl className="pd-specs">
                    <div><dt>Category</dt><dd>{product.category ? [product.category.parent?.name, product.category.name].filter(Boolean).join(" › ") : "—"}</dd></div>
                    <div><dt>Brand</dt><dd>{product.brand?.name || "—"}</dd></div>
                    <div><dt>SKU</dt><dd>{product.sku || "—"}</dd></div>
                    <div><dt>Availability</dt><dd>{stock == null ? "Available" : soldOut ? "Sold out" : `${stock} in stock`}</dd></div>
                    <div><dt>Payment</dt><dd>Cash on delivery</dd></div>
                  </dl>
                </div>
              </div>
            </section>

            {related.length > 0 && (
              <section className="pd-related">
                <div className="pd-related-head">
                  <div><span className="shop-eyebrow">MORE TO LOVE</span><h2>You may also like</h2></div>
                  {product.category && <Link to={`/shop/${product.category.slug}`} className="customer-link">Shop {product.category.name} →</Link>}
                </div>
                <div className="row g-3 g-lg-4">
                  {related.map((item) => <div className="col-6 col-lg-3" key={item.id}><StorefrontProductCard product={item} /></div>)}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </Layout>
  );
};

export default Product;
