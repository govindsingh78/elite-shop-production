import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../common/Layout";
import { AdminAuthContext } from "../context/AdminAuth";
import VendorSidebar from "./VendorSidebar";

const VendorDashboard = () => {
  const { user, logout } = useContext(AdminAuthContext);
  const navigate = useNavigate();
  const vendor = user?.user || user;

  const handleLogout = () => {
    logout();
    navigate("/vendor/login", { replace: true });
  };

  return (
    <Layout>
      <div className="container py-5">
        <div className="d-flex">
          <VendorSidebar />
          <main className="container-fluid p-4">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
              <div>
                <p className="text-uppercase text-muted small mb-1">Vendor workspace</p>
                <h1 className="h2">Welcome, {vendor?.name || "Seller"}</h1>
                <p className="text-muted">You’re signed in to the vendor portal.</p>
              </div>
              <button className="btn btn-outline-secondary" onClick={handleLogout}>Sign out</button>
            </div>
            <div className="alert alert-info mt-3" role="status">
              Your seller account is ready. Product and order tools can be enabled for your vendor role when vendor-specific permissions and catalog ownership are configured.
            </div>
            <div className="card border-0 shadow-sm mt-4" style={{ maxWidth: 620 }}>
              <div className="card-body p-4">
                <h2 className="h5">Account details</h2>
                <div className="d-flex justify-content-between border-bottom py-2"><span>Name</span><strong>{vendor?.name}</strong></div>
                <div className="d-flex justify-content-between border-bottom py-2"><span>Email</span><strong>{vendor?.email}</strong></div>
                <div className="d-flex justify-content-between py-2"><span>Account type</span><strong>Vendor / Seller</strong></div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </Layout>
  );
};

export default VendorDashboard;
