import React, { useState } from "react";
import Layout from "../../common/Layout";
import Sidebar from "../../common/Sidebar";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { apiUrl } from "../../common/http";

const CreateBrands = () => {
  const [name, setName] = useState(""); // State for Brand name
  const [status, setStatus] = useState("1"); // State for Brand status (default: Active)
  const [loading, setLoading] = useState(false); // State for loading

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("adminToken"); // Retrieve the token from localStorage
      const response = await fetch(`${apiUrl}/brands`, {
        method: "POST",
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
        toast.success("Brand created successfully!");
        setName(""); // Clear the form
        setStatus("1"); // Reset status to Active
      } else {
        toast.error(data.message || "Failed to create Brand.");
      }
    } catch (error) {
      console.error("Error creating Brand:", error);
      toast.error("An error occurred while creating the Brand.");
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
          <h2 className="mb-4">Create New Brand</h2>

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="name" className="form-label">
                Brand Name
              </label>
              <input
                type="text"
                id="name"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter Brand name"
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
              {loading ? "Creating..." : "Create Brand"}
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

export default CreateBrands;