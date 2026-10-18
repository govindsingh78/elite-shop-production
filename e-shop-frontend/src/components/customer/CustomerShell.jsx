import React from "react";
import Layout from "../common/Layout";
import Sidebar from "../common/Sidebar";

/** Page frame for the signed-in customer area: storefront chrome plus the account sidebar. */
const CustomerShell = ({ children }) => (
  <Layout>
    <div className="container py-5">
      <div className="d-flex admin-dashboard-layout">
        <Sidebar variant="customer" />
        <main className="container-fluid admin-dashboard-content customer-content">{children}</main>
      </div>
    </div>
  </Layout>
);

export default CustomerShell;
