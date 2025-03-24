import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { apiUrl } from "../../common/http";

const Edit = () => {
  const { id } = useParams(); // Get category ID from URL params
  const navigate = useNavigate(); // For navigation
  const [name, setName] = useState(""); // State for category name
  const [status, setStatus] = useState("1"); // State for category status
  const [loading, setLoading] = useState(false); // State for loading

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
        } else {
          toast.error(data.message || "Failed to fetch category details.");
        }
      } catch (error) {
        console.error("Error fetching category:", error);
        toast.error("An error occurred while fetching the category.");
      }
    };

    fetchCategory();
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
        }),
      });

      const data = await response.json();

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