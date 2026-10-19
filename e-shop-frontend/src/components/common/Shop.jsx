import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Layout from "./Layout";
import { apiUrl } from "./http";
import { useStorefrontCategories } from "./useStorefrontCategories";
import StorefrontProductCard from "./StorefrontProductCard";
import { formatPrice } from "./currency";

const PER_PAGE = 12;
const SORTS = [
  ["newest", "Newest first"],
  ["price_asc", "Price: low to high"],
  ["price_desc", "Price: high to low"],
];

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState(searchParams.get("q") || "");
  const brandId = searchParams.get("brand") || "";
  const search = searchParams.get("q") || "";
  const sort = searchParams.get("sort") || "newest";
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
        if (sort !== "newest") params.set("sort", sort);
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
  }, [categorySlug, brandId, search, minPriceFilter, maxPriceFilter, sort, page]);

  const activeCategory = categories.find((category) => category.slug === categorySlug) || resolvedCategory;
  const activeBrand = brands.find((brand) => String(brand.id) === brandId);
  const totalPages = Math.ceil(totalProducts / PER_PAGE);
  const queryString = searchParams.size ? `?${searchParams}` : "";

  const updateFilters = (updates) => {
    const next = new URLSearchParams(searchParams);
    if (Object.keys(updates).some((key) => key !== "page")) next.delete("page");
    Object.entries(updates).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setSearchParams(next);
  };

  const clearFilters = () => {
    setSearchDraft("");
    setSearchParams(sort !== "newest" ? { sort } : {});
  };

  const submitSearch = (event) => {
    event.preventDefault();
    updateFilters({ q: searchDraft.trim() });
    setFiltersOpen(false);
  };

  const goToPage = (next) => {
    updateFilters({ page: next > 1 ? String(next) : "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Removable chips for each active filter (the category is changed via the pills instead).
  const chips = [
    search && { key: "q", label: `“${search}”`, clear: () => { setSearchDraft(""); updateFilters({ q: "" }); } },
    activeBrand && { key: "brand", label: activeBrand.name, clear: () => updateFilters({ brand: "" }) },
    (minPriceFilter || maxPriceFilter) && {
      key: "price",
      label: `${formatPrice(minPriceFilter || priceRange.min)} – ${formatPrice(maxPriceFilter || priceRange.max)}`,
      clear: () => updateFilters({ min_price: "", max_price: "" }),
    },
  ].filter(Boolean);

  if (categorySlug && !activeCategory && !categoriesLoading && error) {
    return <Layout><main className="container py-5"><h1 className="h2">Collection not found</h1><p className="text-muted">This category may have been renamed or is no longer available.</p><Link to="/shop" className="btn btn-primary">Browse all products</Link></main></Layout>;
  }

  return (
    <Layout>
      <main className="shop-page">
        <section className="sp-hero">
          <div className="container">
            <nav aria-label="Breadcrumb">
              <ol className="breadcrumb shop-breadcrumb mb-0">
                <li className="breadcrumb-item"><Link to="/">Home</Link></li>
                {activeCategory ? <>
                  <li className="breadcrumb-item"><Link to="/shop">Shop</Link></li>
                  <li className="breadcrumb-item active" aria-current="page">{activeCategory.name}</li>
                </> : <li className="breadcrumb-item active" aria-current="page">Shop</li>}
              </ol>
            </nav>
            <div className="sp-hero-copy">
              <div>
                <span className="shop-eyebrow">{activeCategory ? "THE COLLECTION" : "SHOP ALL"}</span>
                <h1>{activeCategory?.name || "Everyday, elevated"}</h1>
                <p>{activeCategory ? `Considered ${activeCategory.name.toLowerCase()} pieces, picked to be worn on repeat.` : "Thoughtfully picked pieces across every collection."}</p>
              </div>
              <div className="sp-hero-count"><strong>{loading ? "—" : totalProducts}</strong><span>{totalProducts === 1 ? "piece" : "pieces"}</span></div>
            </div>
            <nav className="sp-pills" aria-label="Collections">
              <Link to={`/shop${queryString}`} className={`sp-pill${!categorySlug ? " is-active" : ""}`}>All</Link>
              {categories.map((category) => (
                <Link key={category.id} to={`/shop/${category.slug}${queryString}`} className={`sp-pill${categorySlug === category.slug ? " is-active" : ""}`}>{category.name}</Link>
              ))}
            </nav>
          </div>
        </section>

        <div className="container py-4 py-lg-5">
          <div className="row g-4 g-xl-5">
            <aside className="col-lg-3">
              <button type="button" className="sp-filter-toggle" aria-expanded={filtersOpen} aria-controls="shop-filters" onClick={() => setFiltersOpen((open) => !open)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
                Filters{chips.length > 0 && <span className="sp-filter-count">{chips.length}</span>}
                <span className={`ms-auto sp-chevron${filtersOpen ? " is-open" : ""}`} aria-hidden="true">⌄</span>
              </button>
              <div id="shop-filters" className={`shop-filter-panel sp-filters${filtersOpen ? " is-open" : ""}`}>
                <div className="shop-filter-heading"><span>Refine</span>{chips.length > 0 && <button type="button" className="sp-clear-link" onClick={clearFilters}>Clear all</button>}</div>
                <form className="shop-sidebar-search" onSubmit={submitSearch}>
                  <label htmlFor="shop-search" className="shop-filter-label">Search</label>
                  <div className="shop-sidebar-search-input">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
                    <input id="shop-search" type="search" placeholder="Name or SKU, then Enter" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} />
                    {searchDraft && <button type="button" aria-label="Clear search" onClick={() => { setSearchDraft(""); updateFilters({ q: "" }); }}>×</button>}
                  </div>
                </form>
                <div className="shop-filter-group">
                  <h2>Brand</h2>
                  <div className="sp-brand-list" role="group" aria-label="Brand">
                    <button type="button" className={`sp-brand${!brandId ? " is-active" : ""}`} onClick={() => updateFilters({ brand: "" })}>All brands</button>
                    {brands.map((brand) => (
                      <button type="button" key={brand.id} className={`sp-brand${brandId === String(brand.id) ? " is-active" : ""}`} onClick={() => updateFilters({ brand: brandId === String(brand.id) ? "" : String(brand.id) })}>{brand.name}</button>
                    ))}
                  </div>
                </div>
                <div className="shop-filter-group">
                  <h2>Price</h2>
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
                  </> : <p className="shop-price-unavailable">Not enough products to filter by price.</p>}
                </div>
                <div className="shop-filter-note"><span aria-hidden="true">✦</span><span>Cash on delivery &amp; live order tracking on every order.</span></div>
              </div>
            </aside>

            <section className="col-lg-9" aria-label="Products">
              <div className="sp-toolbar">
                <div className="sp-toolbar-copy">
                  <strong>{loading ? "Finding pieces…" : `Showing ${products.length} of ${totalProducts}`}</strong>
                  {chips.length > 0 && (
                    <div className="sp-chips">
                      {chips.map((chip) => <button key={chip.key} type="button" className="sp-chip" onClick={chip.clear} aria-label={`Remove filter ${chip.label}`}>{chip.label}<span aria-hidden="true">×</span></button>)}
                    </div>
                  )}
                </div>
                <label className="sp-sort">
                  <span>Sort</span>
                  <select value={sort} onChange={(event) => updateFilters({ sort: event.target.value === "newest" ? "" : event.target.value })}>
                    {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              </div>

              {error && <div className="alert alert-danger" role="alert">{error}</div>}
              {loading ? (
                <div className="row g-3 g-md-4">{[1, 2, 3, 4, 5, 6].map((item) => <div className="col-6 col-xl-4" key={item}><div className="sp-skeleton"><span /><i /><b /></div></div>)}</div>
              ) : products.length ? (
                <div className="row g-3 g-md-4">{products.map((product, index) => <div className="col-6 col-xl-4 sp-grid-item" style={{ "--item-index": index }} key={product.id}><StorefrontProductCard product={product} /></div>)}</div>
              ) : (
                <div className="shop-empty-state"><span>✦</span><h3>No pieces found</h3><p>Try another collection, brand, or search phrase.</p><button type="button" className="btn btn-primary" onClick={clearFilters}>Show all products</button></div>
              )}

              {!loading && totalPages > 1 && (
                <nav className="sp-pagination" aria-label="Product pages">
                  <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)} aria-label="Previous page">‹</button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
                    <button type="button" key={number} className={number === page ? "is-active" : ""} aria-current={number === page ? "page" : undefined} onClick={() => goToPage(number)}>{number}</button>
                  ))}
                  <button type="button" disabled={page >= totalPages} onClick={() => goToPage(page + 1)} aria-label="Next page">›</button>
                </nav>
              )}
            </section>
          </div>
        </div>
      </main>
    </Layout>
  );
};

export default Shop;
