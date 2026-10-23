import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { apiUrl } from "../../common/http";

const Create = () => {
  const [searchParams] = useSearchParams();
  const [name, setName] = useState(""); // State for category name
  const [parentId, setParentId] = useState(searchParams.get("parent") || ""); // Empty = a main category
  const [parents, setParents] = useState([]); // Main categories that can hold subcategories
  const [status, setStatus] = useState("1"); // State for category status (default: Active)
  const [loading, setLoading] = useState(false); // State for loading

  // Only main categories can hold subcategories (one level deep).
  useEffect(() => {
    fetch(`${apiUrl}/categories`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${localStorage.getItem("adminToken")}` },
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setParents(Array.isArray(data) ? data.filter((category) => !category.parent_id) : []))
      .catch(() => setParents([]));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("adminToken"); // Retrieve the token from localStorage
      const response = await fetch(`${apiUrl}/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // Add Authorization header
        },
        body: JSON.stringify({
          name,
          status,
          parent_id: parentId ? Number(parentId) : null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(parentId ? "Subcategory created successfully!" : "Category created successfully!");
        setName(""); // Clear the form
        setStatus("1"); // Reset status to Active
        // The parent stays selected so several subcategories can be added in a row.
        if (!parentId && data.data) setParents((current) => [...current, data.data].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        toast.error(data.message || "Failed to create category.");
      }
    } catch (error) {
      console.error("Error creating category:", error);
      toast.error("An error occurred while creating the category.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
         <div className="container py-5">
    <div className="row">
    <div className="col-md-12">
        
      <div className="d-flex">
        {/* Left Navigation Bar */}
        <Sidebar />

        {/* Right Content Area */}
        <div className="container-fluid p-4">
          <h2 className="mb-4">Create New Category</h2>

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="name" className="form-label">
                Category Name
              </label>
              <input
                type="text"
                id="name"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter category name"
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="parent_id" className="form-label">
                Parent category
              </label>
              <select
                id="parent_id"
                className="form-control"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">None — this is a main category</option>
                {parents.map((parent) => (
                  <option key={parent.id} value={parent.id}>{parent.name}</option>
                ))}
              </select>
              <div className="form-text">Choose a parent to make this a subcategory, e.g. Kids › Toys.</div>
            </div>

            <div className="mb-3">
              <label htmlFor="status" className="form-label">
                Status
              </label>
              <select
                id="status"
                className="form-control"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                required
              >
                <option value="1">Active</option>
                <option value="0">Blocked</option>
              </select>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Category"}
            </button>
          </form>
        </div>
      </div>

    </div>
    </div>
    </div>
    
    </Layout>
  );
};

export default Create;