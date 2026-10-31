import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { apiUrl } from "../../common/http";
import { toast } from "react-toastify";

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({ search: "", role: "", page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) throw new Error("Your admin session has expired. Sign in again.");

      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.role) params.set("role", filters.role);
      params.set("page", String(filters.page));

      const response = await fetch(`${apiUrl}/admin/users?${params.toString()}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load users.");
      setUsers(data.data || []);
      setPagination(data);
    } catch (requestError) {
      setError(requestError.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (event) => {
    event.preventDefault();
    setFilters((current) => ({ ...current, search: searchInput.trim(), page: 1 }));
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete user ${user.name} (${user.email})? This cannot be undone.`)) return;

    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`${apiUrl}/admin/users/${user.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json", Authorization: `Bearer ${token || ""}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to delete user.");
      toast.success(data.message || "User deleted.");
      if (users.length === 1 && filters.page > 1) {
        setFilters((current) => ({ ...current, page: current.page - 1 }));
      } else {
        setUsers((current) => current.filter((item) => item.id !== user.id));
      }
    } catch (requestError) {
      toast.error(requestError.message || "Unable to delete user.");
    }
  };

  const changePage = (page) => setFilters((current) => ({ ...current, page }));

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex admin-dashboard-layout">
          <Sidebar />
          <main className="container-fluid p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
              <div>
                <h2 className="mb-1">Manage Users</h2>
                <p className="text-muted mb-0">Search accounts and manage roles.</p>
              </div>
              <button className="btn btn-primary" onClick={() => navigate("/admin/create-user")}>
                Add user
              </button>
            </div>

            <form className="row g-2 mb-3" onSubmit={handleSearch}>
              <div className="col-sm-6 col-lg-5">
                <label className="visually-hidden" htmlFor="user-search">Search users</label>
                <input
                  id="user-search"
                  className="form-control"
                  placeholder="Search name or email"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
              </div>
              <div className="col-sm-4 col-lg-3">
                <label className="visually-hidden" htmlFor="user-role-filter">Filter by role</label>
                <select
                  id="user-role-filter"
                  className="form-select"
                  value={filters.role}
                  onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value, page: 1 }))}
                >
                  <option value="">All roles</option>
                  <option value="customer">Customer</option>
                  <option value="seller">Seller</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
              <div className="col-sm-2">
                <button className="btn btn-outline-primary w-100" type="submit">Search</button>
              </div>
            </form>

            {error && (
              <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
                <span>{error}</span>
                <button className="btn btn-outline-danger btn-sm" onClick={fetchUsers}>Try again</button>
              </div>
            )}

            {loading ? <p role="status">Loading users...</p> : (
              <>
                <div className="table-responsive">
                  <table className="table table-bordered table-hover align-middle">
                    <thead className="table-light">
                      <tr><th>#</th><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {users.length ? users.map((user, index) => (
                        <tr key={user.id}>
                          <td>{(pagination?.from || 1) + index}</td>
                          <td>{user.name}</td>
                          <td>{user.email}</td>
                          <td><span className="badge bg-secondary">{user.role}</span></td>
                          <td>{user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</td>
                          <td className="text-nowrap">
                            <button className="btn btn-outline-primary btn-sm me-2" onClick={() => navigate(`/admin/edit-user/${user.id}`)}>
                              Edit
                            </button>
                            <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete(user)}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan="6" className="text-center text-muted py-4">No users found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {pagination && pagination.last_page > 1 && (
                  <nav className="d-flex justify-content-between align-items-center" aria-label="User pages">
                    <button className="btn btn-outline-secondary btn-sm" disabled={!pagination.prev_page_url || loading} onClick={() => changePage(filters.page - 1)}>
                      Previous
                    </button>
                    <span>Page {pagination.current_page} of {pagination.last_page}</span>
                    <button className="btn btn-outline-secondary btn-sm" disabled={!pagination.next_page_url || loading} onClick={() => changePage(filters.page + 1)}>
                      Next
                    </button>
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

export default ManageUsers;
