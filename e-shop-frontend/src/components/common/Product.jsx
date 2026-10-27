import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import Layout from "./Layout";
import { apiUrl } from "./http";
import { useCart } from "../context/CartContext";
import { formatPrice } from "./currency";
import StorefrontProductCard from "./StorefrontProductCard";
import { ProductReturnsNote } from "./PolicyBits";
import DeliveryCheck from "./DeliveryCheck";
import ProductOffers from "./ProductOffers";
import WishlistButton from "./WishlistButton";
import ProductReviews from "./ProductReviews";
import { Stars } from "./ReviewBits";
import { ORGANIZATION_ID, SITE_URL, breadcrumbs, summarize, useSeo } from "./seo";
import { productPath } from "./productPath";

const imageBase = apiUrl.replace(/\/api\/?$/, "");
const LOW_STOCK = 5;
const largeImage = (name) => `${imageBase}/uploads/products/large/${encodeURIComponent(name)}`;

/** schema.org Product, so search results can show the price, stock and rating. */
const productSchema = (product, images) => {
  const url = `${SITE_URL}${productPath(product)}`;
  const reviews = Number(product.reviews_count || 0);
  return {
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.title,
    description: summarize(product.description || product.short_description, 5000) || undefined,
    sku: product.sku || undefined,
    gtin: /^\d{8,14}$/.test(product.barcode || "") ? product.barcode : undefined,
    image: images.map(largeImage),
    brand: product.brand?.name ? { "@type": "Brand", name: product.brand.name } : undefined,
    category: product.category?.name,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "INR",
      price: Number(product.price).toFixed(2),
      availability: `https://schema.org/${product.qty === 0 ? "OutOfStock" : "InStock"}`,
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": ORGANIZATION_ID },
      // Mirrors the Return & Refund Policy (resources/policies/return-refund.json): 7 days from delivery.
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "IN",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 7,
        returnMethod: "https://schema.org/ReturnByMail",
      },
    },
    aggregateRating: reviews > 0
      ? { "@type": "AggregateRating", ratingValue: Number(product.reviews_avg_rating).toFixed(1), reviewCount: reviews, bestRating: 5, worstRating: 1 }
      : undefined,
  };
};

const perks = [
  { title: "Cash on delivery", copy: "Pay when your order arrives.", icon: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h3" /></> },
  { title: "Live order tracking", copy: "Follow your parcel to your door.", icon: <><path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z" /><circle cx="7.5" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" /></> },
  { title: "Carefully packed", copy: "Checked and wrapped with care.", icon: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.4 7.7 7.6 4.4 7.6-4.4M12 12v9" /></> },
];

const Product = () => {
  // What follows /product/: the product's readable name, or an id or older name from an old link.
  const { handle: routeHandle } = useParams();
  const [searchParams] = useSearchParams();
  const handle = routeHandle || searchParams.get("id");
  // The address the page last loaded, so moving the URL on to the product's own name doesn't load it again.
  const loadedFor = useRef(null);
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [images, setImages] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  // The chosen size, for products sold in sizes; sizeMissing flags "Add to bag" pressed before choosing one.
  const [sizeId, setSizeId] = useState(null);
  const [sizeMissing, setSizeMissing] = useState(false);
  const sizePickerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [related, setRelated] = useState([]);
  const [added, setAdded] = useState(false);
  const [zoom, setZoom] = useState(null);
  // The reviews section reports the live summary, e.g. after the shopper posts a review.
  const [ratingSummary, setRatingSummary] = useState(null);

  useEffect(() => {
    if (handle && handle === loadedFor.current) return undefined;
    const controller = new AbortController();
    const loadProduct = async () => {
      setLoading(true);
      setError("");
      setQuantity(1);
      setSelectedIndex(0);
      try {
        if (!handle) throw new Error("No product was selected.");
        const response = await fetch(`${apiUrl}/storefront/products/${encodeURIComponent(handle)}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Could not load this product.");
        const item = result.data;
        loadedFor.current = item.slug;
        setProduct(item);
        // A product in a single size (say Free Size) needs no choosing.
        const sizes = item.sizes || [];
        setSizeId(sizes.length === 1 && sizes[0].in_stock ? sizes[0].size_id : null);
        setSizeMissing(false);
        setImages([...new Set([item.image, ...(item.images || []).map((image) => image.image)].filter(Boolean))]);
        // Old links (/product/12, a name from before a rename) move on to the product's current address.
        if (item.slug && handle !== item.slug) navigate(`${productPath(item)}${window.location.hash}`, { replace: true });
      } catch (requestError) {
        if (requestError.name !== "AbortError") setError(requestError.message || "Could not load this product.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadProduct();
    window.scrollTo({ top: 0 });
    return () => controller.abort();
  }, [handle, navigate]);

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

  const sizes = product?.sizes || [];
  const selectedSize = sizes.find((size) => size.size_id === sizeId) || null;
  // With sizes, the product's own stock is the total of them; the chosen size has its own.
  const totalStock = product?.qty;
  const stock = selectedSize ? selectedSize.qty : totalStock;
  const soldOut = totalStock === 0;
  const maxQuantity = stock ?? 999;
  const compare = Number(product?.compare_price || 0);
  const price = Number(product?.price || 0);
  const discount = compare > price ? Math.round(((compare - price) / compare) * 100) : 0;
  const selectedImage = images[selectedIndex];

  useSeo(product ? {
    title: `${product.title}${product.brand?.name ? ` by ${product.brand.name}` : ""}`,
    description: summarize(`${product.short_description || product.description || ""} Buy ${product.title} for ${formatPrice(price)} on Elitezaar, with cash on delivery and live order tracking.`),
    path: productPath(product),
    image: images[0] ? largeImage(images[0]) : undefined,
    type: "product",
    extraMeta: [["product:price:amount", price.toFixed(2)], ["product:price:currency", "INR"], ["product:availability", soldOut ? "out of stock" : "in stock"]],
    jsonLd: [
      productSchema(product, images),
      breadcrumbs([
        ["Home", "/"],
        ["Shop", "/shop"],
        ...(product.category?.parent ? [[product.category.parent.name, `/shop/${product.category.parent.slug}`]] : []),
        ...(product.category ? [[product.category.name, `/shop/${product.category.slug}`]] : []),
        [product.title, productPath(product)],
      ]),
    ],
  } : error ? { title: "Product not found", noindex: true } : { ready: false });

  const changeQuantity = (next) => setQuantity(Math.min(Math.max(1, next), Math.max(1, maxQuantity)));

  const chooseSize = (size) => {
    setSizeId(size.size_id);
    setSizeMissing(false);
    setQuantity((current) => Math.max(1, Math.min(current, size.qty ?? 999)));
  };

  /** Products sold in sizes can't go in the bag until a size is chosen. */
  const sizeChosen = () => {
    if (!sizes.length || selectedSize) return true;
    setSizeMissing(true);
    sizePickerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    sizePickerRef.current?.querySelector("input:not(:disabled)")?.focus({ preventScroll: true });
    return false;
  };

  const addToBag = () => {
    if (!sizeChosen()) return;
    addItem(product, quantity, selectedSize);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
    toast.success(<span>{selectedSize ? `Size ${selectedSize.name} added` : "Added"} to your bag. <Link to="/cart">View bag</Link></span>);
  };

  const buyNow = () => {
    if (!sizeChosen()) return;
    addItem(product, quantity, selectedSize);
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
                  {(() => {
                    const rating = ratingSummary?.productId === product.id
                      ? ratingSummary
                      : { count: Number(product.reviews_count || 0), average: Number(product.reviews_avg_rating || 0) };
                    return (
                      <a href="#reviews" className="pd-rating">
                        {rating.count ? <><Stars value={rating.average} size={15} /><strong>{rating.average.toFixed(1)}</strong><span>{rating.count} {rating.count === 1 ? "review" : "reviews"}</span></> : <span>No reviews yet · Be the first to review</span>}
                      </a>
                    );
                  })()}

                  <div className="pd-price">
                    <strong>{formatPrice(price)}</strong>
                    {discount > 0 && <>
                      <s>{formatPrice(compare)}</s>
                      <span className="pd-save">Save {formatPrice(compare - price)} ({discount}%)</span>
                    </>}
                  </div>

                  {(soldOut || (stock != null && (!sizes.length || selectedSize))) && (
                    <p className={`pd-stock ${soldOut ? "is-out" : stock <= LOW_STOCK ? "is-low" : "is-in"}`}>
                      <i aria-hidden="true" />
                      {soldOut
                        ? (sizes.length > 1 ? "Sold out in every size" : "Sold out")
                        : stock <= LOW_STOCK ? `Hurry — only ${stock} left${selectedSize ? ` in ${selectedSize.name}` : ""}` : "In stock, ready to ship"}
                    </p>
                  )}

                  {product.short_description && <p className="pd-lead">{product.short_description}</p>}

                  {sizes.length > 0 && !soldOut && (
                    <fieldset className={`pd-sizes${sizeMissing ? " is-missing" : ""}`} ref={sizePickerRef}>
                      <legend>Size{selectedSize && <>: <strong>{selectedSize.name}</strong></>}</legend>
                      <div className="pd-size-list">
                        {sizes.map((size) => {
                          const inputId = `pd-size-${size.size_id}`;
                          const low = size.in_stock && size.qty != null && size.qty <= LOW_STOCK;
                          return (
                            <span key={size.size_id} className="pd-size-option">
                              <input type="radio" name="pd-size" id={inputId} className="pd-size-input" checked={size.size_id === sizeId} onChange={() => chooseSize(size)} disabled={!size.in_stock} />
                              <label htmlFor={inputId} className={`pd-size${size.in_stock ? "" : " is-out"}`} title={size.in_stock ? undefined : `${size.name} is sold out`}>
                                {size.name}
                                {low && <small>{size.qty} left</small>}
                                {!size.in_stock && <span className="visually-hidden"> (sold out)</span>}
                              </label>
                            </span>
                          );
                        })}
                      </div>
                      {sizeMissing && <p className="pd-size-alert" role="alert">Please choose a size first.</p>}
                    </fieldset>
                  )}

                  <div className="pd-actions">
                    <div className="pd-qty" role="group" aria-label="Quantity">
                      <button type="button" onClick={() => changeQuantity(quantity - 1)} disabled={quantity <= 1 || soldOut} aria-label="Decrease quantity">−</button>
                      <input id="quantity" type="number" inputMode="numeric" min="1" max={maxQuantity} value={quantity} onChange={(event) => changeQuantity(Number(event.target.value) || 1)} disabled={soldOut} aria-label="Quantity" />
                      <button type="button" onClick={() => changeQuantity(quantity + 1)} disabled={quantity >= maxQuantity || soldOut} aria-label="Increase quantity">+</button>
                    </div>
                    <button type="button" className={`btn btn-primary pd-add${added ? " is-added" : ""}`} onClick={addToBag} disabled={soldOut}>
                      {soldOut ? "Sold out" : added ? "Added to bag ✓" : <>Add to bag <span aria-hidden="true">↗</span></>}
                    </button>
                    <WishlistButton product={product} variant="detail" />
                  </div>
                  {!soldOut && <button type="button" className="pd-buy-now" onClick={buyNow}>Buy now — {formatPrice(price * quantity)}</button>}

                  <ProductOffers key={`offers-${product.id}`} productId={product.id} productTitle={product.title} />
                  <DeliveryCheck key={product.id} productId={product.id} />

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
                    {sizes.length > 0 && <div><dt>Sizes</dt><dd>{sizes.map((size) => (size.in_stock ? size.name : `${size.name} (sold out)`)).join(", ")}</dd></div>}
                    <div><dt>Availability</dt><dd>{totalStock == null ? "Available" : soldOut ? "Sold out" : `${totalStock} in stock`}</dd></div>
                    <div><dt>Payment</dt><dd>Cash on delivery</dd></div>
                  </dl>
                </div>
              </div>
            </section>

            <ProductReviews key={product.id} productId={product.id} path={productPath(product)} onSummary={setRatingSummary} />

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
