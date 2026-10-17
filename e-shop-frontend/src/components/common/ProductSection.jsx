import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiUrl } from "./http";
import StorefrontProductCard from "./StorefrontProductCard";

const ProductSection = ({ title, featured = false }) => {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const query = featured ? "?featured=yes" : "";
        const response = await fetch(`${apiUrl}/storefront/products${query}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not load products.");
        const results = data.products?.data || [];
        setProducts(featured ? results : results.slice(0, 4));
      } catch (requestError) {
        if (requestError.name !== "AbortError") setError(requestError.message || "Could not load products.");
      }
    };
    load();
    return () => controller.abort();
  }, [featured]);

  if (!products.length && !error) return null;

  return (
    <section className="py-5">
      <div className="container">
        <div className="d-flex justify-content-between align-items-end mb-4">
          <div>
            <p className="text-uppercase text-muted small mb-1">The collection</p>
            <h2 className="mb-0">{title}</h2>
          </div>
          <Link className="btn btn-outline-secondary btn-sm" to="/shop">Shop all</Link>
        </div>
        {error ? <div className="alert alert-warning" role="status">{error}</div> : (
          <div className="row g-4">
            {products.map((product) => <div className="col-6 col-lg-3" key={product.id}><StorefrontProductCard product={product} /></div>)}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductSection;
