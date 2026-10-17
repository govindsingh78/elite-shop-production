import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { apiUrl } from "../../common/http";
import { toast } from "react-toastify";

const ManageShipping = () => {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const navigate = useNavigate();

  const fetchMethods = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`${apiUrl}/shipping-methods`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load shipping methods.");
      setMethods(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoadError(error.message || "Unable to load shipping methods.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  const handleDelete = async (method) => {
    if (!window.confirm(`Delete the “${method.name}” shipping method?`)) return;

    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`${apiUrl}/shipping-methods/${method.id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to delete shipping method.");
      setMethods((current) => current.filter((item) => item.id !== method.id));
      toast.success(data.message || "Shipping method deleted.");
    } catch (error) {
      toast.error(error.message || "Unable to delete shipping method.");
    }
  };

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex">
          <Sidebar />
          <main className="container-fluid p-4">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
              <div>
                <h2 className="mb-1">Manage Shipping</h2>
                <p className="text-muted mb-0">Configure delivery options and their prices.</p>
              </div>
              <button className="btn btn-primary" onClick={() => navigate("/admin/create-shipping")}>
                Add shipping method
              </button>
            </div>

            {loadError && (
              <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
                <span>{loadError}</span>
                <button className="btn btn-outline-danger btn-sm" onClick={fetchMethods}>Try again</button>
              </div>
            )}

            {loading ? (
              <p role="status">Loading shipping methods...</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-bordered table-hover align-middle">
                  <thead className="table-light">
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Method</th>
                      <th scope="col">Price</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {methods.length ? methods.map((method, index) => (
                      <tr key={method.id}>
                        <td>{index + 1}</td>
                        <td>{method.name}</td>
                        <td>{Number(method.price).toFixed(2)}</td>
                        <td>
                          {Number(method.status) === 1
                            ? <span className="badge bg-success">Active</span>
                            : <span className="badge bg-secondary">Inactive</span>}
                        </td>
                        <td className="text-nowrap">
                          <button
                            className="btn btn-outline-primary btn-sm me-2"
                            onClick={() => navigate(`/admin/edit-shipping/${method.id}`)}
                          >Edit</button>
                          <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete(method)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan="5" className="text-center text-muted py-4">No shipping methods yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </main>
        </div>
      </div>
    </Layout>
  );
};

export default ManageShipping;
