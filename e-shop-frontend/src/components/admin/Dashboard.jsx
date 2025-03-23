import React  from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../common/Layout";
import Sidebar from "../common/Sidebar";

const Dashboard = () => {
  return (
    <Layout>
    <div className="container py-5">
    <div className="row">
    <div className="col-md-12">
    <div className="d-flex justify-content-between">
      {/* Left Navigation Bar */}
      <Sidebar />

      {/* Right Content Area */}
      <div className="container-fluid p-4 pb-2">
               <div className="row">
          {/* Card 1 */}
          <div className="col-md-4">
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="card-title">Total Users</h5>
                <p className="card-text">Manage all registered users.</p>
                <a href="/manage-users" className="btn btn-primary">
                  View Users
                </a>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="col-md-4">
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="card-title">Total Products</h5>
                <p className="card-text">Manage all products in the shop.</p>
                <a href="/manage-products" className="btn btn-secondary">
                  View Products
                </a>
              </div>
            </div>
          </div>

          {/* Card 3 */}
          <div className="col-md-4">
            <div className="card shadow-sm">
              <div className="card-body">
                <h5 className="card-title">Reports</h5>
                <p className="card-text">View detailed reports and analytics.</p>
                <a href="/view-reports" className="btn btn-success">
                  View Reports
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
    </div>
    </div>
    </Layout>
  );
};

export default Dashboard;