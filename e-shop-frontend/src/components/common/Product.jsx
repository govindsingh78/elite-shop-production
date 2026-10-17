import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Layout from "./Layout";
import { apiUrl } from "./http";
import { useCart } from "../context/CartContext";
import { formatPrice } from "./currency";

const imageBase = apiUrl.replace(/\/api\/?$/, "");

const Product = () => {
    const { id: routeId } = useParams();
    const [searchParams] = useSearchParams();
    const id = routeId || searchParams.get("id");
    const navigate = useNavigate();
    const { addItem } = useCart();
    const [product, setProduct] = useState(null);
    const [images, setImages] = useState([]);
    const [selectedImage, setSelectedImage] = useState("");
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();
        const loadProduct = async () => {
            setLoading(true);
            setError("");
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
                const productImages = [...new Set([...(item.images || []).map((image) => image.image), item.image].filter(Boolean))];
                setImages(productImages);
                setSelectedImage(productImages[0] || "");
            } catch (requestError) {
                if (requestError.name !== "AbortError") setError(requestError.message || "Could not load this product.");
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        loadProduct();
        return () => controller.abort();
    }, [id]);

    const handleAddToCart = () => {
        addItem(product, quantity);
        navigate("/cart");
    };

    return (
        <Layout>
            <main className="container product-detail product-detail-page py-3 py-lg-4">
                <nav aria-label="Breadcrumb" className="product-detail-breadcrumb mb-3">
                    <ol className="breadcrumb">
                        <li className="breadcrumb-item"><Link to="/">Home</Link></li>
                        <li className="breadcrumb-item"><Link to="/shop">Shop</Link></li>
                        {product?.category && <li className="breadcrumb-item"><Link to={`/shop/${product.category.slug}`}>{product.category.name}</Link></li>}
                        {product && <li className="breadcrumb-item active" aria-current="page">{product.title}</li>}
                    </ol>
                </nav>

                {loading && <p role="status">Loading product...</p>}
                {error && <div className="alert alert-danger" role="alert">{error} <Link to="/shop">Back to shop</Link></div>}
                {!loading && product && (
                    <>
                        <div className="row g-4 g-xl-5 product-detail-layout">
                            <div className="col-lg-7 product-detail-purchase-column">
                                <section className="product-purchase-panel">
                                    <div className="product-detail-meta"><span>{product.category?.name || "Collection"}</span>{product.brand?.name && <><i aria-hidden="true">·</i><span>{product.brand.name}</span></>}</div>
                                    <h1 className="product-detail-title">{product.title}</h1>
                                    <div className="product-detail-price">{formatPrice(product.price)} {product.compare_price && <span>{formatPrice(product.compare_price)}</span>}</div>
                                    {product.short_description && <p className="product-detail-short-description">{product.short_description}</p>}
                                    <div className="product-detail-specs">
                                        <span>SKU <strong>{product.sku || "—"}</strong></span>
                                        {product.qty != null && <span className={product.qty > 0 ? "product-stock-in" : "product-stock-out"}><i />{product.qty > 0 ? `${product.qty} available` : "Currently unavailable"}</span>}
                                    </div>
                                    <div className="product-add-row">
                                        <div className="col-auto">
                                            <label htmlFor="quantity" className="form-label">Quantity</label>
                                            <input id="quantity" className="form-control product-quantity-input" type="number" min="1" max={product.qty ?? 999} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} />
                                        </div>
                                        <div className="col-auto">
                                            <button type="button" className="btn btn-primary product-add-button" onClick={handleAddToCart} disabled={product.qty === 0 || (product.qty != null && quantity > product.qty)}>Add to bag <span aria-hidden="true">↗</span></button>
                                        </div>
                                    </div>
                                    <div className="product-service-points"><span>✓ Secure checkout</span><span>✓ Cash on delivery</span><span>✓ Carefully packed</span></div>
                                </section>
                            </div>

                            <div className="col-lg-5 product-detail-gallery-column">
                                {selectedImage ? (
                                    <div className="product-detail-image-frame">
                                        <img src={`${imageBase}/uploads/products/large/${encodeURIComponent(selectedImage)}`} alt={product.title} className="product-detail-image" />
                                    </div>
                                ) : (
                                    <div className="product-detail-image-placeholder">Product image coming soon</div>
                                )}
                                {images.length > 1 && <div className="product-detail-thumbnails">{images.map((image) => (
                                    <button type="button" key={image} className={`product-detail-thumbnail ${image === selectedImage ? "is-selected" : ""}`} onClick={() => setSelectedImage(image)} aria-label={`View ${product.title} image`}>
                                        <img src={`${imageBase}/uploads/products/small/${encodeURIComponent(image)}`} alt="" width="72" height="76" style={{ objectFit: "cover" }} />
                                    </button>
                                ))}</div>}
                            </div>
                        </div>

                        {product.description && <section className="product-description-panel"><span className="shop-eyebrow">THE DETAILS</span><h2>Description</h2><p>{product.description}</p></section>}
                    </>
                )}
            </main>
        </Layout>
    );
};

export default Product;
