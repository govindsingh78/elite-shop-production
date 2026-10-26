import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { apiUrl } from "../../common/http";
import GstFields from "../gst/GstFields";
import { gstFieldValues, gstPayload } from "../gst/gst";

const Edit = () => {
  const { id } = useParams(); // Get category ID from URL params
  const navigate = useNavigate(); // For navigation
  const [name, setName] = useState(""); // State for category name
  const [status, setStatus] = useState("1"); // State for category status
  const [parentId, setParentId] = useState(""); // Empty = a main category
  const [parents, setParents] = useState([]); // Main categories that can hold subcategories
  const [hasChildren, setHasChildren] = useState(false); // Categories with subcategories stay main categories
  const [loading, setLoading] = useState(false); // State for loading
  const [gst, setGst] = useState(gstFieldValues); // HSN code and GST rate for the category's products
  const [gstErrors, setGstErrors] = useState({});

  // Fetch category details to pre-fill the form
  useEffect(() => {
    const fetchCategory = async () => {
      try {
        const token = localStorage.getItem("adminToken"); // Retrieve the token from localStorage
        const response = await fetch(`${apiUrl}/categories/${id}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`, // Add Authorization header
          },
        });

        const data = await response.json();

        if (response.ok) {
          setName(data.name); // Pre-fill name
          setStatus(data.status.toString()); // Pre-fill status
          setParentId(data.parent_id ? String(data.parent_id) : ""); // Pre-fill parent
          setHasChildren(Number(data.children_count) > 0);
          setGst(gstFieldValues(data));
        } else {
          toast.error(data.message || "Failed to fetch category details.");
        }
      } catch (error) {
        console.error("Error fetching category:", error);
        toast.error("An error occurred while fetching the category.");
      }
    };

    fetchCategory();

    fetch(`${apiUrl}/categories`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${localStorage.getItem("adminToken")}` },
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setParents(Array.isArray(data) ? data.filter((category) => !category.parent_id && String(category.id) !== String(id)) : []))
      .catch(() => setParents([]));
  }, [id]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("adminToken"); // Retrieve the token from localStorage
      const response = await fetch(`${apiUrl}/categories/${id}`, {
        method: "PUT", // Use PUT for updating the category
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // Add Authorization header
        },
        body: JSON.stringify({
          name,
          status,
          parent_id: parentId ? Number(parentId) : null,
          ...gstPayload(gst),
        }),
      });

      const data = await response.json();
      setGstErrors(Object.fromEntries(Object.entries(data.errors || {}).map(([field, messages]) => [field, messages[0]])));

      if (response.ok) {
        toast.success("Category updated successfully!");
        navigate("/admin/manage-categories"); // Redirect to category listing page
      } else {
        toast.error(data.message || "Failed to update category.");
      }
    } catch (error) {
      console.error("Error updating category:", error);
      toast.error("An error occurred while updating the category.");
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
          <h2 className="mb-4">Edit Category</h2>

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
                disabled={hasChildren}
              >
                <option value="">None — this is a main category</option>
                {parents.map((parent) => (
                  <option key={parent.id} value={parent.id}>{parent.name}</option>
                ))}
              </select>
              <div className="form-text">
                {hasChildren ? "This category has its own subcategories, so it stays a main category." : "Choose a parent to make this a subcategory, e.g. Kids › Toys."}
              </div>
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

            <GstFields values={gst} onChange={setGst} errors={gstErrors} />

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Updating..." : "Update Category"}
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

export default Edit;