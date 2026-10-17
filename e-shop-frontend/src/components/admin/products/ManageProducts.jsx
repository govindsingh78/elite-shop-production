import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { apiUrl } from "../../common/http";
import { toast } from "react-toastify";

const ManageProducts = () => {
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
      const token = localStorage.getItem("adminToken");
      if (!token) throw new Error("Your admin session has expired. Sign in again.");
      const params = new URLSearchParams({ page: String(filters.page) });
      if (filters.search) params.set("search", filters.search);
      if (filters.status !== "") params.set("status", filters.status);
      const response = await fetch(`${apiUrl}/admin/products?${params}`, {
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
  }, [filters]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete “${product.title}”? This cannot be undone.`)) return;
    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`${apiUrl}/admin/products/${product.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json", Authorization: `Bearer ${token || ""}` },
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

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex">
          <Sidebar />
          <main className="container-fluid p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
              <div>
                <h2 className="mb-1">Manage Products</h2>
                <p className="text-muted mb-0">Create and maintain your product catalog.</p>
              </div>
              <button className="btn btn-primary" onClick={() => navigate("/admin/create-product")}>Add product</button>
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
                    <thead className="table-light"><tr><th>#</th><th>Product</th><th>SKU</th><th>Category</th><th>Brand</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {products.length ? products.map((product, index) => (
                        <tr key={product.id}>
                          <td>{(pagination?.from || 1) + index}</td>
                          <td>{product.title}</td>
                          <td>{product.sku}</td>
                          <td>{product.category?.name || "—"}</td>
                          <td>{product.brand?.name || "—"}</td>
                          <td>{Number(product.price).toFixed(2)}</td>
                          <td>{product.qty ?? 0}</td>
                          <td>{Number(product.status) === 1 ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Inactive</span>}</td>
                          <td className="text-nowrap">
                            <button className="btn btn-outline-primary btn-sm me-2" onClick={() => navigate(`/admin/edit-product/${product.id}`)}>Edit</button>
                            <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete(product)}>Delete</button>
                          </td>
                        </tr>
                      )) : <tr><td colSpan="9" className="text-center text-muted py-4">No products found.</td></tr>}
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
