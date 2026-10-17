import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Layout from "./Layout";
import { apiUrl } from "./http";
import { useStorefrontCategories } from "./useStorefrontCategories";
import StorefrontProductCard from "./StorefrontProductCard";
import { formatPrice } from "./currency";

const Shop = () => {
  const { categorySlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories, loading: categoriesLoading } = useStorefrontCategories();
  const [products, setProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [brands, setBrands] = useState([]);
  const [priceRange, setPriceRange] = useState({ min: 0, max: 0 });
  const [resolvedCategory, setResolvedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchDraft, setSearchDraft] = useState(searchParams.get("q") || "");
  const brandId = searchParams.get("brand") || "";
  const search = searchParams.get("q") || "";
  const minPriceFilter = searchParams.get("min_price") || "";
  const maxPriceFilter = searchParams.get("max_price") || "";
  const page = Math.max(1, Number(searchParams.get("page") || 1));

  useEffect(() => setSearchDraft(search), [search]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchProducts = async () => {
      setLoading(true);
      setError("");
      setResolvedCategory(null);
      try {
        const params = new URLSearchParams();
        if (categorySlug) params.set("category_slug", categorySlug);
        if (brandId) params.set("brand_id", brandId);
        if (search) params.set("search", search);
        if (minPriceFilter !== "") params.set("min_price", minPriceFilter);
        if (maxPriceFilter !== "") params.set("max_price", maxPriceFilter);
        params.set("page", String(page));
        const response = await fetch(`${apiUrl}/storefront/products?${params}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not load products.");
        setProducts(data.products?.data || []);
        setTotalProducts(Number(data.products?.total || 0));
        setBrands(data.brands || []);
        setPriceRange({ min: Number(data.price_range?.min || 0), max: Number(data.price_range?.max || 0) });
        setResolvedCategory(data.category || null);
      } catch (requestError) {
        if (requestError.name !== "AbortError") setError(requestError.message || "Could not load products.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchProducts();
    return () => controller.abort();
  }, [categorySlug, brandId, search, minPriceFilter, maxPriceFilter, page]);

  const activeCategory = categories.find((category) => category.slug === categorySlug) || resolvedCategory;
  const activeBrand = brands.find((brand) => String(brand.id) === brandId);
  const resultLabel = useMemo(() => {
    const labels = [activeCategory?.name, activeBrand?.name, search && `“${search}”`, (minPriceFilter || maxPriceFilter) && "Price range"].filter(Boolean);
    return labels.length ? labels.join(" · ") : "All products";
  }, [activeCategory, activeBrand, search, minPriceFilter, maxPriceFilter]);

  const updateFilters = (updates) => {
    const next = new URLSearchParams(searchParams);
    if (Object.keys(updates).some((key) => key !== "page")) next.delete("page");
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setSearchParams(next);
  };

  const clearFilters = () => {
    setSearchDraft("");
    setSearchParams({});
  };

  const submitSearch = (event) => {
    event.preventDefault();
    updateFilters({ q: searchDraft.trim() });
  };

  if (categorySlug && !activeCategory && !categoriesLoading && error) {
    return <Layout><main className="container py-5"><h1 className="h2">Collection not found</h1><p className="text-muted">This category may have been renamed or is no longer available.</p><Link to="/shop" className="btn btn-primary">Browse all products</Link></main></Layout>;
  }

  return (
    <Layout>
      <main className="shop-page">
        <div className="shop-hero"><div className="container">
          <nav aria-label="Breadcrumb" className="mb-3"><ol className="breadcrumb shop-breadcrumb mb-0"><li className="breadcrumb-item"><Link to="/">Home</Link></li><li className="breadcrumb-item active" aria-current="page">Shop</li></ol></nav>
        </div></div>

        <div className="container py-4 py-lg-5">
          <div className="row g-4 g-xl-5 mt-1">
            <aside className="col-lg-3 col-xl-2">
              <div className="shop-filter-panel">
                <div className="shop-filter-heading"><span>Refine</span><span className="shop-filter-dot" /></div>
                <form className="shop-sidebar-search" onSubmit={submitSearch}>
                  <label htmlFor="shop-search" className="shop-filter-label">Search products</label>
                  <div className="shop-sidebar-search-input">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
                    <input id="shop-search" type="search" placeholder="Name or SKU" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} />
                    {searchDraft && <button type="button" aria-label="Clear search" onClick={() => { setSearchDraft(""); updateFilters({ q: "" }); }}>×</button>}
                  </div>
                  <button className="shop-sidebar-search-button" type="submit">Search products <span aria-hidden="true">↗</span></button>
                </form>
                <div className="shop-filter-group"><h2>Category</h2><ul className="shop-filter-list">
                  <li><Link className={!categorySlug ? "is-selected" : ""} to={`/shop${searchParams.size ? `?${searchParams}` : ""}`}><span>All collections</span><span className="shop-filter-arrow">↗</span></Link></li>
                  {categories.map((category) => <li key={category.id}><Link className={categorySlug === category.slug ? "is-selected" : ""} to={`/shop/${category.slug}${searchParams.size ? `?${searchParams}` : ""}`}><span>{category.name}</span><span className="shop-filter-arrow">↗</span></Link></li>)}
                </ul></div>
                <div className="shop-filter-group"><label htmlFor="shop-brand-filter">Brand</label><select id="shop-brand-filter" className="shop-brand-select" value={brandId} onChange={(event) => updateFilters({ brand: event.target.value })}><option value="">All brands</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></div>
                <div className="shop-filter-group">
                  <label>Price range</label>
                  {priceRange.max > priceRange.min ? <>
                    <div className="shop-price-labels"><span>{formatPrice(minPriceFilter || priceRange.min)}</span><span>{formatPrice(maxPriceFilter || priceRange.max)}</span></div>
                    <div className="shop-price-sliders">
                      <input aria-label="Minimum price" type="range" min={priceRange.min} max={priceRange.max} step="1" value={Math.min(Number(minPriceFilter || priceRange.min), Number(maxPriceFilter || priceRange.max))} onChange={(event) => updateFilters({ min_price: event.target.value === String(priceRange.min) ? "" : event.target.value })} />
                      <input aria-label="Maximum price" type="range" min={priceRange.min} max={priceRange.max} step="1" value={Math.max(Number(maxPriceFilter || priceRange.max), Number(minPriceFilter || priceRange.min))} onChange={(event) => updateFilters({ max_price: event.target.value === String(priceRange.max) ? "" : event.target.value })} />
                    </div>
                    <div className="shop-price-inputs">
                      <label><span>Min</span><input aria-label="Minimum price value" type="number" min={priceRange.min} max={priceRange.max} value={minPriceFilter || priceRange.min} onChange={(event) => updateFilters({ min_price: event.target.value === String(priceRange.min) ? "" : event.target.value })} /></label>
                      <label><span>Max</span><input aria-label="Maximum price value" type="number" min={priceRange.min} max={priceRange.max} value={maxPriceFilter || priceRange.max} onChange={(event) => updateFilters({ max_price: event.target.value === String(priceRange.max) ? "" : event.target.value })} /></label>
                    </div>
                  </> : <p className="shop-price-unavailable">Price range unavailable</p>}
                </div>
                {(categorySlug || brandId || search || minPriceFilter || maxPriceFilter) && <button type="button" className="shop-reset-filters" onClick={clearFilters}>Clear all filters <span aria-hidden="true">×</span></button>}
                <div className="shop-filter-note"><span aria-hidden="true">✦</span><span>Considered pieces.<br />Everyday favourites.</span></div>
              </div>
            </aside>

            <section className="col-lg-9 col-xl-10" aria-label="Products">
              <div className="shop-results-header"><div><span className="shop-results-eyebrow">CURATED FOR YOU</span><h2>{resultLabel}</h2></div><span className="shop-results-count">{loading ? "Finding pieces…" : `${totalProducts} ${totalProducts === 1 ? "piece" : "pieces"}`}</span></div>
              {error && <div className="alert alert-danger" role="alert">{error}</div>}
              {loading ? <div className="row g-4">{[1, 2, 3, 4].map((item) => <div className="col-6 col-xl-4 col-xxl-3" key={item}><div className="shop-product-skeleton"><span /><i /><b /></div></div>)}</div> : products.length ? (
                <div className="row g-4">{products.map((product) => <div className="col-6 col-xl-4 col-xxl-3" key={product.id}><StorefrontProductCard product={product} /></div>)}</div>
              ) : <div className="shop-empty-state"><span>✦</span><h3>No pieces found</h3><p>Try another category, brand, or search phrase.</p><button type="button" className="btn btn-primary" onClick={clearFilters}>Show all products</button></div>}
              {!loading && totalProducts > 12 && <nav className="shop-pagination" aria-label="Product pages"><button type="button" disabled={page <= 1} onClick={() => updateFilters({ page: String(page - 1) })}>← Previous</button><span>Page {page} of {Math.ceil(totalProducts / 12)}</span><button type="button" disabled={page >= Math.ceil(totalProducts / 12)} onClick={() => updateFilters({ page: String(page + 1) })}>Next →</button></nav>}
            </section>
          </div>
        </div>
      </main>
    </Layout>
  );
};

export default Shop;
