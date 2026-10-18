import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { apiUrl } from "../../common/http";
import { toast } from "react-toastify";
import { portalConfig, portalToken } from "../portal";

const ManageProducts = ({ portal = "admin" }) => {
  const config = portalConfig(portal);
  const isVendor = portal === "vendor";
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({ search: "", status: "", page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = portalToken(portal);
      if (!token) throw new Error(config.sessionExpired);
      const params = new URLSearchParams({ page: String(filters.page) });
      if (filters.search) params.set("search", filters.search);
      if (filters.status !== "") params.set("status", filters.status);
      const response = await fetch(`${apiUrl}/${config.api}/products?${params}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load products.");
      setProducts(data.data || []);
      setPagination(data);
    } catch (requestError) {
      setError(requestError.message || "Unable to load products.");
    } finally {
      setLoading(false);
    }
  }, [filters, portal, config]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete “${product.title}”? This cannot be undone.`)) return;
    try {
      const response = await fetch(`${apiUrl}/${config.api}/products/${product.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json", Authorization: `Bearer ${portalToken(portal) || ""}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to delete product.");
      toast.success(data.message || "Product deleted.");
      if (products.length === 1 && filters.page > 1) {
        setFilters((current) => ({ ...current, page: current.page - 1 }));
      } else {
        setProducts((current) => current.filter((item) => item.id !== product.id));
      }
    } catch (requestError) {
      toast.error(requestError.message || "Unable to delete product.");
    }
  };

  const submitSearch = (event) => {
    event.preventDefault();
    setFilters((current) => ({ ...current, search: searchInput.trim(), page: 1 }));
  };

  const columns = isVendor ? 9 : 10;

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex">
          <Sidebar variant={config.sidebar} />
          <main className="container-fluid p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
              <div>
                <h2 className="mb-1">{isVendor ? "My Products" : "Manage Products"}</h2>
                <p className="text-muted mb-0">{isVendor ? "Create and maintain the products you sell on Street Shop." : "Create and maintain your product catalog."}</p>
              </div>
              <button className="btn btn-primary" onClick={() => navigate(config.createProductPath)}>Add product</button>
            </div>

            <form className="row g-2 mb-3" onSubmit={submitSearch}>
              <div className="col-sm-6 col-lg-5">
                <label htmlFor="product-search" className="visually-hidden">Search products</label>
                <input id="product-search" className="form-control" placeholder="Search title, SKU, or barcode" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
              </div>
              <div className="col-sm-4 col-lg-3">
                <label htmlFor="product-status" className="visually-hidden">Filter status</label>
                <select id="product-status" className="form-select" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}>
                  <option value="">All statuses</option>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
              <div className="col-sm-2"><button type="submit" className="btn btn-outline-primary w-100">Search</button></div>
            </form>

            {error && <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert"><span>{error}</span><button className="btn btn-outline-danger btn-sm" onClick={fetchProducts}>Try again</button></div>}
            {loading ? <p role="status">Loading products...</p> : (
              <>
                <div className="table-responsive">
                  <table className="table table-bordered table-hover align-middle">
                    <thead className="table-light"><tr><th>#</th><th>Product</th><th>SKU</th>{!isVendor && <th>Seller</th>}<th>Category</th><th>Brand</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {products.length ? products.map((product, index) => (
                        <tr key={product.id}>
                          <td>{(pagination?.from || 1) + index}</td>
                          <td>{product.title}</td>
                          <td>{product.sku}</td>
                          {!isVendor && <td>{product.vendor?.name || <span className="text-muted">Store</span>}</td>}
                          <td>{product.category?.name || "—"}</td>
                          <td>{product.brand?.name || "—"}</td>
                          <td>{Number(product.price).toFixed(2)}</td>
                          <td>{product.qty ?? 0}{product.qty != null && product.qty <= 5 && <span className="badge bg-warning text-dark ms-2">Low</span>}</td>
                          <td>{Number(product.status) === 1 ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Inactive</span>}</td>
                          <td className="text-nowrap">
                            <button className="btn btn-outline-primary btn-sm me-2" onClick={() => navigate(config.editProductPath(product.id))}>Edit</button>
                            <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete(product)}>Delete</button>
                          </td>
                        </tr>
                      )) : <tr><td colSpan={columns} className="text-center text-muted py-4">{isVendor && !filters.search && filters.status === "" ? "You haven’t listed any products yet. Use “Add product” to create your first listing." : "No products found."}</td></tr>}
                    </tbody>
                  </table>
                </div>
                {pagination && pagination.last_page > 1 && (
                  <nav className="d-flex justify-content-between align-items-center" aria-label="Product pages">
                    <button className="btn btn-outline-secondary btn-sm" disabled={!pagination.prev_page_url || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</button>
                    <span>Page {pagination.current_page} of {pagination.last_page}</span>
                    <button className="btn btn-outline-secondary btn-sm" disabled={!pagination.next_page_url || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</button>
                  </nav>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </Layout>
  );
};

export default ManageProducts;
