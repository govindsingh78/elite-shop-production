import React, { useEffect, useState } from "react";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { apiUrl } from "../../common/http";
import { commissionRequest } from "../commissions/commissions";
import { Link, useNavigate } from "react-router-dom"; // Import useNavigate
import { toast } from "react-toastify"; // Import toast for notifications
import "react-toastify/dist/ReactToastify.css";

const ShowBrands = () => {
  const [brand, setBrand] = useState([]); // State to store Brand
  const [loading, setLoading] = useState(true); // State to handle loading
  const [waitingRequests, setWaitingRequests] = useState(0); // Brands sellers asked for, not yet answered
  const navigate = useNavigate(); // Get navigate function from useNavigate hook

  useEffect(() => {
    commissionRequest("admin", "/admin/brand-requests?status=pending")
      .then((data) => setWaitingRequests(data.counts?.pending || 0))
      .catch(() => {});
  }, []);

  // Fetch Brand from API
  useEffect(() => {
    const fetchBrand = async () => {
      try {
        const token = localStorage.getItem("adminToken"); // Retrieve the token from localStorage
        const response = await fetch(`${apiUrl}/brands`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`, // Add Authorization header
          },
        });
        const data = await response.json();
        setBrand(data); // Assuming the API returns { Brand: [...] }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching Brand:", error);
        setLoading(false);
      }
    };

    fetchBrand();
  }, []);

  // Handle Delete Brand
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this Brand?")) {
      return;
    }

    try {
      const token = localStorage.getItem("adminToken"); // Retrieve the token from localStorage
      const response = await fetch(`${apiUrl}/brands/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // Add Authorization header
        },
      });

      if (response.ok) {
        toast.success("Brand deleted successfully!");
        setBrand(brand.filter((brand) => brand.id !== id)); // Remove deleted Brand from the list
      } else {
        const data = await response.json();
        toast.error(data.message || "Failed to delete Brand.");
      }
    } catch (error) {
      console.error("Error deleting Brand:", error);
      toast.error("An error occurred while deleting the Brand.");
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
                <h2 className="mb-4">Brand Listing</h2>
                {waitingRequests > 0 && (
                  <Link to="/admin/brand-requests" className="review-callout">
                    <span className="review-callout-text">
                      <strong>{waitingRequests} brand {waitingRequests === 1 ? "request" : "requests"} from sellers</strong>
                      <small>Sellers asked for brands the store doesn’t have yet. Add them or decline with a reason.</small>
                    </span>
                    <span className="review-callout-cta">Review <span aria-hidden="true">→</span></span>
                  </Link>
                )}
                {/* Create Brand Button */}
                <button
                  className="btn btn-primary mb-3 justify-content-end float-end"
                  onClick={() => navigate("/admin/create-Brand")} // Navigate to Create Brand page
                >
                  Create Brand
                </button>
                {loading ? (
                  <p>Loading Brand...</p>
                ) : (
                  <table className="table table-bordered table-hover">
                    <thead className="thead-dark">
                      <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brand.length > 0 ? (
                        brand.map((brand, index) => (
                          <tr key={brand.id}>
                            <td>{index + 1}</td>
                            <td>{brand.name}</td>
                            <td>
                              {brand.status === 1 ? (
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
                                  navigate(`/admin/edit-brand/${brand.id}`) // Navigate to Edit Brand page with ID
                                }
                              >
                                Edit
                              </button>
                              {/* Delete Button */}
                              <button
                                className="btn btn-danger btn-sm m-2"
                                onClick={() => handleDelete(brand.id)} // Call handleDelete with Brand ID
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="text-center">
                            No Brand found.
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

export default ShowBrands;