import React, { useEffect, useState } from "react";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { apiUrl } from "../../common/http";
import { commissionRequest } from "../commissions/commissions";
import { Link, useNavigate } from "react-router-dom"; // Import useNavigate
import { toast } from "react-toastify"; // Import toast for notifications
import "react-toastify/dist/ReactToastify.css";

const Show = () => {
  const [categories, setCategories] = useState([]); // State to store categories
  const [loading, setLoading] = useState(true); // State to handle loading
  const [waitingRequests, setWaitingRequests] = useState(0); // Categories sellers asked for, not yet answered
  const navigate = useNavigate(); // Get navigate function from useNavigate hook

  useEffect(() => {
    commissionRequest("admin", "/admin/category-requests?status=pending")
      .then((data) => setWaitingRequests(data.counts?.pending || 0))
      .catch(() => {});
  }, []);

  // Fetch categories from API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const token = localStorage.getItem("adminToken"); // Retrieve the token from localStorage
        const response = await fetch(`${apiUrl}/categories`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`, // Add Authorization header
          },
        });
        const data = await response.json();
        setCategories(Array.isArray(data) ? data : []); // Main categories, each followed by its subcategories
        setLoading(false);
      } catch (error) {
        console.error("Error fetching categories:", error);
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // Handle Delete Category
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this category?")) {
      return;
    }

    try {
      const token = localStorage.getItem("adminToken"); // Retrieve the token from localStorage
      const response = await fetch(`${apiUrl}/categories/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // Add Authorization header
        },
      });

      if (response.ok) {
        toast.success("Category deleted successfully!");
        const removed = categories.find((category) => category.id === id);
        // Remove deleted category from the list; its parent now has one subcategory fewer.
        setCategories(categories
          .filter((category) => category.id !== id)
          .map((category) => (category.id === removed?.parent_id ? { ...category, children_count: category.children_count - 1 } : category)));
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to delete category.");
      }
    } catch (error) {
      console.error("Error deleting category:", error);
      toast.error("An error occurred while deleting the category.");
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
                <h2 className="mb-4">Category Listing</h2>
                {waitingRequests > 0 && (
                  <Link to="/admin/category-requests" className="review-callout">
                    <span className="review-callout-text">
                      <strong>{waitingRequests} category {waitingRequests === 1 ? "request" : "requests"} from sellers</strong>
                      <small>Sellers asked for categories the store doesn’t have yet. Add them or decline with a reason.</small>
                    </span>
                    <span className="review-callout-cta">Review <span aria-hidden="true">→</span></span>
                  </Link>
                )}
                {/* Create Category Button */}
                <button
                  className="btn btn-primary mb-3 justify-content-end float-end"
                  onClick={() => navigate("/admin/create-category")} // Navigate to Create Category page
                >
                  Create Category
                </button>
                {loading ? (
                  <p>Loading categories...</p>
                ) : (
                  <table className="table table-bordered table-hover">
                    <thead className="thead-dark">
                      <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Parent</th>
                        <th>Products</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.length > 0 ? (
                        categories.map((category, index) => (
                          <tr key={category.id}>
                            <td>{index + 1}</td>
                            <td>
                              {category.parent_id ? (
                                <span className="ps-3"><span className="text-muted me-2" aria-hidden="true">↳</span>{category.name}</span>
                              ) : (
                                <strong>{category.name}</strong>
                              )}
                              {!category.parent_id && category.children_count > 0 && (
                                <span className="badge bg-light text-dark border ms-2">{category.children_count} sub</span>
                              )}
                            </td>
                            <td>{category.parent_name || <span className="text-muted">—</span>}</td>
                            <td>{category.products_count ?? 0}</td>
                            <td>
                              {category.status === 1 ? (
                                <span className="badge bg-success">Active</span>
                              ) : (
                                <span className="badge bg-danger">Blocked</span>
                              )}
                            </td>
                            <td>
                              {/* Edit Button */}
                              <button
                                className="btn btn-primary btn-sm m-2"
                                onClick={() =>
                                  navigate(`/admin/edit-category/${category.id}`) // Navigate to Edit Category page with ID
                                }
                              >
                                Edit
                              </button>
                              {/* Add Subcategory Button (main categories only) */}
                              {!category.parent_id && (
                                <button
                                  className="btn btn-outline-primary btn-sm m-2"
                                  onClick={() => navigate(`/admin/create-category?parent=${category.id}`)}
                                >
                                  Add subcategory
                                </button>
                              )}
                              {/* Delete Button */}
                              <button
                                className="btn btn-danger btn-sm m-2"
                                onClick={() => handleDelete(category.id)} // Call handleDelete with category ID
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="text-center">
                            No categories found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Show;